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
import { handleStepFunctionError, recordErrorMetric } from '../../utils/error-handler';

const logger = new Logger({ component: 'TranscribeTrigger' });

// 環境変数
const INPUT_BUCKET_NAME = process.env.INPUT_BUCKET_NAME!;
const OUTPUT_BUCKET_NAME = process.env.OUTPUT_BUCKET_NAME!;
const JOBS_TABLE_NAME = process.env.JOBS_TABLE_NAME!;
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';
const APP_NAME = process.env.APP_NAME || 'meeting-minutes-generator';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

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
  meetingContext?: {
    meetingType?: string;
    attendees?: string[];
    focusAreas?: string[];
    additionalInstructions?: string;
  };
}

/**
 * Step Functions出力の型定義
 */
interface TranscribeTriggerOutput {
  jobId: string;
  userId: string;
  transcribeJobName: string;
  status: string;
  meetingContext?: {
    meetingType?: string;
    attendees?: string[];
    focusAreas?: string[];
    additionalInstructions?: string;
  };
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
  // AWS Transcribeは自動的に.jsonを追加するため、拡張子なしで指定
  const outputKey = `${input.userId}/${input.jobId}/transcript`;

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

    // Transcribeジョブを開始（タグ付き）
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
      // コスト追跡用のタグを付与
      Tags: [
        { Key: 'Application', Value: APP_NAME },
        { Key: 'Environment', Value: ENVIRONMENT },
        { Key: 'JobId', Value: input.jobId },
        { Key: 'UserId', Value: input.userId },
        { Key: 'ManagedBy', Value: 'CDK' },
      ],
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
      meetingContext: input.meetingContext, // 会議コンテキストを次のステップに渡す
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

    // 成功メトリクスを記録
    recordErrorMetric(new Error('Success'), 'TranscribeTrigger', logger);

    return result;
  } catch (error) {
    const err = error as Error;
    
    // エラーメトリクスを記録
    recordErrorMetric(err, 'TranscribeTrigger', logger);

    // Step Functions用のエラーハンドリング
    return await handleStepFunctionError(err, logger, {
      jobId: input.jobId,
      userId: input.userId,
    });
  }
}
