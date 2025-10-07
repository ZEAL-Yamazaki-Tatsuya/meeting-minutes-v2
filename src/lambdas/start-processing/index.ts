/**
 * Start Processing Lambda
 * S3へのアップロード完了後にStep Functionsワークフローを起動する
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { ValidationError, NotFoundError, InternalServerError, AppError } from '../../utils/errors';

const logger = new Logger({ component: 'StartProcessingHandler' });

// 環境変数
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!;
const JOBS_TABLE_NAME = process.env.JOBS_TABLE_NAME!;
const INPUT_BUCKET_NAME = process.env.INPUT_BUCKET_NAME!;

// クライアントの初期化
const sfnClient = new SFNClient({});
const jobRepository = new MeetingJobRepository(JOBS_TABLE_NAME);

/**
 * Lambda ハンドラー
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('処理開始リクエスト受信', {
    path: event.path,
    method: event.httpMethod,
  });

  try {
    // パスパラメータからjobIdを取得
    const jobId = event.pathParameters?.jobId;
    if (!jobId) {
      throw new ValidationError('jobIdが必要です');
    }

    // クエリパラメータからuserIdを取得
    const userId = event.queryStringParameters?.userId;
    if (!userId) {
      throw new ValidationError('userIdが必要です');
    }

    // DynamoDBからジョブ情報を取得
    const job = await jobRepository.getJob(jobId, userId);
    if (!job) {
      throw new NotFoundError(`ジョブが見つかりません: ${jobId}`);
    }

    logger.info('ジョブ情報取得成功', {
      jobId,
      userId,
      status: job.status,
    });

    // ジョブステータスがUPLOADEDであることを確認
    if (job.status !== 'UPLOADED') {
      throw new ValidationError(
        `ジョブステータスが無効です。現在のステータス: ${job.status}`
      );
    }

    // Step Functionsの入力データを準備
    const input = {
      jobId: job.jobId,
      userId: job.userId,
      videoS3Key: job.videoS3Key,
      bucketName: INPUT_BUCKET_NAME,
      fileName: job.videoFileName,
      fileSize: job.videoSize,
    };

    // Step Functionsワークフローを起動
    const executionName = `execution-${jobId}-${Date.now()}`;
    const command = new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      name: executionName,
      input: JSON.stringify(input),
    });

    const result = await sfnClient.send(command);

    logger.info('Step Functionsワークフロー起動成功', {
      executionArn: result.executionArn,
      jobId,
      userId,
    });

    // レスポンスを返す
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        success: true,
        data: {
          jobId,
          executionArn: result.executionArn,
          message: '処理を開始しました',
        },
      }),
    };
  } catch (error) {
    logger.error('処理開始リクエスト失敗', error as Error);

    // エラーレスポンスを返す
    if (error instanceof AppError) {
      return {
        statusCode: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({
          success: false,
          error: error.constructor.name,
          message: error.message,
        }),
      };
    }

    // 予期しないエラー
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        success: false,
        error: 'InternalServerError',
        message: '予期しないエラーが発生しました',
      }),
    };
  }
}
