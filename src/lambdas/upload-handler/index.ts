/**
 * Upload Handler Lambda
 * Presigned URLを生成し、DynamoDBにジョブレコードを作成する
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { ValidationError, InternalServerError, AppError } from '../../utils/errors';

const logger = new Logger({ component: 'UploadHandler' });

// 環境変数
const INPUT_BUCKET_NAME = process.env.INPUT_BUCKET_NAME!;
const JOBS_TABLE_NAME = process.env.JOBS_TABLE_NAME!;
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '2048', 10);
const ALLOWED_FILE_TYPES = (process.env.ALLOWED_FILE_TYPES || 'video/mp4').split(',');

// クライアントの初期化
const s3Client = new S3Client({});
const jobRepository = new MeetingJobRepository(JOBS_TABLE_NAME);

/**
 * リクエストボディの型定義
 */
interface UploadRequest {
  fileName: string;
  fileSize: number;
  contentType: string;
  userId: string;
  metadata?: {
    meetingTitle?: string;
    meetingDate?: string;
    participants?: string[];
  };
}

/**
 * レスポンスボディの型定義
 */
interface UploadResponse {
  jobId: string;
  uploadUrl: string;
  expiresIn: number;
}

/**
 * ファイルバリデーション
 */
function validateFile(fileName: string, fileSize: number, contentType: string): void {
  // ファイル名チェック
  if (!fileName || fileName.trim().length === 0) {
    throw new ValidationError('ファイル名が指定されていません');
  }

  // ファイル拡張子チェック
  if (!fileName.toLowerCase().endsWith('.mp4')) {
    throw new ValidationError('MP4ファイルのみアップロード可能です');
  }

  // ファイルサイズチェック
  const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
  if (fileSize <= 0) {
    throw new ValidationError('ファイルサイズが無効です');
  }
  if (fileSize > maxSizeBytes) {
    throw new ValidationError(
      `ファイルサイズが制限を超えています（最大: ${MAX_FILE_SIZE_MB}MB）`
    );
  }

  // MIMEタイプチェック
  if (!ALLOWED_FILE_TYPES.includes(contentType)) {
    throw new ValidationError(
      `サポートされていないファイル形式です（許可: ${ALLOWED_FILE_TYPES.join(', ')}）`
    );
  }

  logger.info('ファイルバリデーション成功', {
    fileName,
    fileSize,
    contentType,
  });
}

/**
 * Presigned URLを生成
 */
async function generatePresignedUrl(
  s3Key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: INPUT_BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    
    logger.info('Presigned URL生成成功', { s3Key, expiresIn });
    return url;
  } catch (error) {
    logger.error('Presigned URL生成失敗', error as Error, { s3Key });
    throw new InternalServerError('アップロードURLの生成に失敗しました');
  }
}

/**
 * Lambda ハンドラー
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('アップロードリクエスト受信', {
    path: event.path,
    method: event.httpMethod,
  });

  try {
    // リクエストボディのパース
    if (!event.body) {
      throw new ValidationError('リクエストボディが空です');
    }

    const request: UploadRequest = JSON.parse(event.body);

    // 必須フィールドのチェック
    if (!request.userId) {
      throw new ValidationError('userIdが必要です');
    }
    if (!request.fileName) {
      throw new ValidationError('fileNameが必要です');
    }
    if (request.fileSize === undefined || request.fileSize === null) {
      throw new ValidationError('fileSizeが必要です');
    }
    if (!request.contentType) {
      throw new ValidationError('contentTypeが必要です');
    }

    // ファイルバリデーション
    validateFile(request.fileName, request.fileSize, request.contentType);

    // S3キーの生成（userId/jobId/fileName形式）
    const timestamp = Date.now();
    const sanitizedFileName = request.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `${request.userId}/${timestamp}_${sanitizedFileName}`;

    // DynamoDBにジョブレコードを作成
    const job = await jobRepository.createJob({
      userId: request.userId,
      videoFileName: request.fileName,
      videoS3Key: s3Key,
      videoSize: request.fileSize,
      metadata: request.metadata,
    });

    logger.info('ジョブレコード作成成功', {
      jobId: job.jobId,
      userId: request.userId,
    });

    // Presigned URLを生成
    const uploadUrl = await generatePresignedUrl(s3Key, request.contentType);

    // レスポンスを返す
    const response: UploadResponse = {
      jobId: job.jobId,
      uploadUrl,
      expiresIn: 3600, // 1時間
    };

    logger.info('アップロードリクエスト処理成功', {
      jobId: job.jobId,
      userId: request.userId,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error('アップロードリクエスト処理失敗', error as Error);

    // エラーレスポンスを返す
    if (error instanceof AppError) {
      return {
        statusCode: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: error.message,
        }),
      };
    }

    // 予期しないエラー
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: '予期しないエラーが発生しました',
      }),
    };
  }
}
