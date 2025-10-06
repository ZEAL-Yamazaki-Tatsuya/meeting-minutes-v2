/**
 * Transcribe Trigger Lambda
 * AWS Transcribeジョブを開始し、話者識別を有効化する
 */

import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  TranscriptionJob,
  LanguageCode,
  MediaFormat,
} from '@aws-sdk/client-transcribe';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { ValidationError, InternalServerError, AppError } from '../../utils/errors';

const logger = new Logger({ component: 'TranscribeTrigger' });

// 環境変数
const INPUT_BUCKET_NAME = process.env.INPUT_BUCKET_NAME!;
const OUTPUT_BUCKET_NAME = process.env.OUTPUT_BUCKET_NAME!;
const JOBS_TABLE_NAME = process.env.JOBS_TABLE_NAME!;
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

// クライアントの初期化
const transcribeClient = new TranscribeClient({ region: AWS_REGION });
const jobRepository = new MeetingJobRepository(JOBS_TABLE_NAME);

/**
 * Step Functions入力の型定義
 */
interface TranscribeTriggerInput {
  jobId: string;
  userId: string;
  videoS3Key: string;
  languageCode?: string;
  maxSpeakerLabels?: number;
}

/**
 * Step Functions出力の型定義
 */
interface TranscribeTriggerOutput {
  jobId: string;
  userId: string;
  transcribeJobName: string;
  status: string;
}

/**
 * Transcribeジョブ名を生成
 */
function generateTranscribeJobName(jobId: string): string {
  // Transcribeジョブ名は英数字、ハイフン、アンダースコアのみ使用可能
  const timestamp = Date.now();
  return `meeting-minutes-${jobId}-${timestamp}`;
}

/**
 * S3 URIを生成
 */
function generateS3Uri(bucketName: string, key: string): string {
  return `s3://${bucketName}/${key}`;
}

/**
 * Transcribeジョブを開始
 */
async function startTranscriptionJob(
  input: TranscribeTriggerInput
): Promise<TranscribeTriggerOutput> {
  const transcribeJobName = generateTranscribeJobName(input.jobId);
  const mediaUri = generateS3Uri(INPUT_BUCKET_NAME, input.videoS3Key);
  const outputKey = `${input.userId}/${input.jobId}/transcript.json`;

  logger.info('Transcribeジョブ開始準備', {
    jobId: input.jobId,
    transcribeJobName,
    mediaUri,
  });

  try {
    // DynamoDBのステータスを更新
    await jobRepository.updateJob({
      jobId: input.jobId,
      userId: input.userId,
      status: 'TRANSCRIBING',
      transcribeJobName,
    });

    logger.info('ジョブステータスをTRANSCRIBINGに更新', {
      jobId: input.jobId,
      transcribeJobName,
    });

    // Transcribeジョブを開始
    const command = new StartTranscriptionJobCommand({
      TranscriptionJobName: transcribeJobName,
      LanguageCode: (input.languageCode as LanguageCode) || LanguageCode.JA_JP,
      MediaFormat: MediaFormat.MP4,
      Media: {
        MediaFileUri: mediaUri,
      },
      OutputBucketName: OUTPUT_BUCKET_NAME,
      OutputKey: outputKey,
      Settings: {
        ShowSpeakerLabels: true,
        MaxSpeakerLabels: input.maxSpeakerLabels || 10,
      },
    });

    const response = await transcribeClient.send(command);

    logger.info('Transcribeジョブ開始成功', {
      jobId: input.jobId,
      transcribeJobName,
      transcriptionJob: response.TranscriptionJob?.TranscriptionJobName,
      status: response.TranscriptionJob?.TranscriptionJobStatus,
    });

    return {
      jobId: input.jobId,
      userId: input.userId,
      transcribeJobName,
      status: response.TranscriptionJob?.TranscriptionJobStatus || 'IN_PROGRESS',
    };
  } catch (error) {
    logger.error('Transcribeジョブ開始失敗', error as Error, {
      jobId: input.jobId,
      transcribeJobName,
    });

    // DynamoDBのステータスをFAILEDに更新
    await jobRepository.updateJob({
      jobId: input.jobId,
      userId: input.userId,
      status: 'FAILED',
      errorMessage: `Transcribeジョブの開始に失敗しました: ${
        error instanceof Error ? error.message : '不明なエラー'
      }`,
    });

    throw new InternalServerError(
      `Transcribeジョブの開始に失敗しました: ${
        error instanceof Error ? error.message : '不明なエラー'
      }`
    );
  }
}

/**
 * Lambda ハンドラー（Step Functions用）
 */
export async function handler(input: TranscribeTriggerInput): Promise<TranscribeTriggerOutput> {
  logger.info('Transcribeトリガー実行開始', {
    jobId: input.jobId,
    userId: input.userId,
  });

  try {
    // 入力バリデーション
    if (!input.jobId) {
      throw new ValidationError('jobIdが必要です');
    }
    if (!input.userId) {
      throw new ValidationError('userIdが必要です');
    }
    if (!input.videoS3Key) {
      throw new ValidationError('videoS3Keyが必要です');
    }

    // Transcribeジョブを開始
    const result = await startTranscriptionJob(input);

    logger.info('Transcribeトリガー実行成功', {
      jobId: input.jobId,
      transcribeJobName: result.transcribeJobName,
    });

    return result;
  } catch (error) {
    logger.error('Transcribeトリガー実行失敗', error as Error, {
      jobId: input.jobId,
    });

    // エラーを再スロー（Step Functionsがキャッチする）
    throw error;
  }
}
