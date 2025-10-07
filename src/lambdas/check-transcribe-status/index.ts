/**
 * Check Transcribe Status Lambda
 * Transcribeジョブのステータスをポーリングし、DynamoDBを更新する
 */

import {
  TranscribeClient,
  GetTranscriptionJobCommand,
  TranscriptionJobStatus,
} from '@aws-sdk/client-transcribe';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { ValidationError, InternalServerError } from '../../utils/errors';

const logger = new Logger({ component: 'CheckTranscribeStatus' });

// 環境変数
const JOBS_TABLE_NAME = process.env.JOBS_TABLE_NAME!;
const OUTPUT_BUCKET_NAME = process.env.OUTPUT_BUCKET_NAME!;
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

// クライアントの初期化
const transcribeClient = new TranscribeClient({ region: AWS_REGION });
const jobRepository = new MeetingJobRepository(JOBS_TABLE_NAME);

/**
 * Step Functions入力の型定義
 */
interface CheckTranscribeStatusInput {
  jobId: string;
  userId: string;
  transcribeJobName: string;
}

/**
 * Step Functions出力の型定義
 */
interface CheckTranscribeStatusOutput {
  jobId: string;
  userId: string;
  transcribeJobName: string;
  status: string;
  isComplete: boolean;
  transcriptS3Key?: string;
  errorMessage?: string;
}

/**
 * Transcribeジョブのステータスを確認
 */
async function checkTranscriptionStatus(
  input: CheckTranscribeStatusInput
): Promise<CheckTranscribeStatusOutput> {
  logger.info('Transcribeステータス確認開始', {
    jobId: input.jobId,
    transcribeJobName: input.transcribeJobName,
  });

  try {
    // Transcribeジョブのステータスを取得
    const command = new GetTranscriptionJobCommand({
      TranscriptionJobName: input.transcribeJobName,
    });

    const response = await transcribeClient.send(command);
    const transcriptionJob = response.TranscriptionJob;

    if (!transcriptionJob) {
      throw new InternalServerError('Transcribeジョブが見つかりません');
    }

    const status = transcriptionJob.TranscriptionJobStatus;

    logger.info('Transcribeステータス取得成功', {
      jobId: input.jobId,
      transcribeJobName: input.transcribeJobName,
      status,
    });

    // ステータスに応じて処理を分岐
    switch (status) {
      case TranscriptionJobStatus.COMPLETED: {
        // 完了: 文字起こし結果のS3キーを取得
        const transcriptFileUri = transcriptionJob.Transcript?.TranscriptFileUri;
        
        if (!transcriptFileUri) {
          throw new InternalServerError('文字起こし結果のURIが見つかりません');
        }

        // S3 URIからキーを抽出
        const transcriptS3Key = `${input.userId}/${input.jobId}/transcript.json`;

        // DynamoDBを更新（ステータスをGENERATINGに変更）
        await jobRepository.updateJob({
          jobId: input.jobId,
          userId: input.userId,
          status: 'GENERATING',
          transcriptS3Key,
        });

        logger.info('Transcribe完了、DynamoDB更新成功', {
          jobId: input.jobId,
          transcriptS3Key,
        });

        return {
          jobId: input.jobId,
          userId: input.userId,
          transcribeJobName: input.transcribeJobName,
          status: 'COMPLETED',
          isComplete: true,
          transcriptS3Key,
        };
      }

      case TranscriptionJobStatus.FAILED: {
        // 失敗: エラーメッセージを取得してDynamoDBを更新
        const failureReason = transcriptionJob.FailureReason || '不明なエラー';

        await jobRepository.updateJob({
          jobId: input.jobId,
          userId: input.userId,
          status: 'FAILED',
          errorMessage: `Transcribeジョブが失敗しました: ${failureReason}`,
        });

        logger.error('Transcribeジョブ失敗', new Error(failureReason), {
          jobId: input.jobId,
          transcribeJobName: input.transcribeJobName,
        });

        return {
          jobId: input.jobId,
          userId: input.userId,
          transcribeJobName: input.transcribeJobName,
          status: 'FAILED',
          isComplete: true,
          errorMessage: failureReason,
        };
      }

      case TranscriptionJobStatus.IN_PROGRESS:
      case TranscriptionJobStatus.QUEUED:
      default: {
        // 進行中: 待機が必要
        logger.info('Transcribeジョブ進行中', {
          jobId: input.jobId,
          transcribeJobName: input.transcribeJobName,
          status,
        });

        return {
          jobId: input.jobId,
          userId: input.userId,
          transcribeJobName: input.transcribeJobName,
          status: status || 'IN_PROGRESS',
          isComplete: false,
        };
      }
    }
  } catch (error) {
    logger.error('Transcribeステータス確認失敗', error as Error, {
      jobId: input.jobId,
      transcribeJobName: input.transcribeJobName,
    });

    // DynamoDBのステータスをFAILEDに更新
    await jobRepository.updateJob({
      jobId: input.jobId,
      userId: input.userId,
      status: 'FAILED',
      errorMessage: `Transcribeステータスの確認に失敗しました: ${
        error instanceof Error ? error.message : '不明なエラー'
      }`,
    });

    throw new InternalServerError(
      `Transcribeステータスの確認に失敗しました: ${
        error instanceof Error ? error.message : '不明なエラー'
      }`
    );
  }
}

/**
 * Lambda ハンドラー（Step Functions用）
 */
export async function handler(
  input: CheckTranscribeStatusInput
): Promise<CheckTranscribeStatusOutput> {
  logger.info('Transcribeステータス確認実行開始', {
    jobId: input.jobId,
    userId: input.userId,
    transcribeJobName: input.transcribeJobName,
  });

  try {
    // 入力バリデーション
    if (!input.jobId) {
      throw new ValidationError('jobIdが必要です');
    }
    if (!input.userId) {
      throw new ValidationError('userIdが必要です');
    }
    if (!input.transcribeJobName) {
      throw new ValidationError('transcribeJobNameが必要です');
    }

    // Transcribeステータスを確認
    const result = await checkTranscriptionStatus(input);

    logger.info('Transcribeステータス確認実行成功', {
      jobId: input.jobId,
      status: result.status,
      isComplete: result.isComplete,
    });

    return result;
  } catch (error) {
    logger.error('Transcribeステータス確認実行失敗', error as Error, {
      jobId: input.jobId,
    });

    // エラーを再スロー（Step Functionsがキャッチする）
    throw error;
  }
}
