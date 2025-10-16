/**
 * Download Minutes Lambda Handler
 * 議事録のダウンロードURL（Presigned URL）を生成する
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { NotFoundError, ValidationError, InternalServerError } from '../../utils/errors';
import { getUserIdFromEvent } from '../../utils/auth';
import { withErrorHandler } from '../../utils/error-handler';

const logger = new Logger({ component: 'DownloadMinutesHandler' });
const repository = new MeetingJobRepository(
    process.env.JOBS_TABLE_NAME || 'MeetingJobs'
);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

// サポートされるダウンロードフォーマット
type DownloadFormat = 'markdown' | 'md' | 'text' | 'txt';

/**
 * Presigned URLを生成する
 */
async function generatePresignedUrl(
    s3Key: string,
    bucketName: string,
    format: DownloadFormat,
    fileName: string
): Promise<string> {
    try {
        // ファイル拡張子を決定
        let extension = 'md';
        let contentType = 'text/markdown';
        
        if (format === 'text' || format === 'txt') {
            extension = 'txt';
            contentType = 'text/plain';
        }

        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            ResponseContentDisposition: `attachment; filename="${fileName}.${extension}"`,
            ResponseContentType: contentType,
        });

        // Presigned URLを生成（有効期限: 1時間）
        const presignedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: 3600,
        });

        return presignedUrl;
    } catch (error) {
        logger.error('Error generating presigned URL', error as Error, { s3Key, bucketName });
        throw new InternalServerError(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * メインハンドラーロジック
 */
async function downloadMinutes(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    logger.info('Download minutes request received', {
        pathParameters: event.pathParameters,
        queryStringParameters: event.queryStringParameters,
    });

    // パスパラメータからjobIdを取得
    const jobId = event.pathParameters?.jobId;
    if (!jobId) {
        throw new ValidationError('jobId is required');
    }

    // ユーザーIDを取得（Cognito認証から、またはクエリパラメータから）
    const userId = getUserIdFromEvent(event) || event.queryStringParameters?.userId;
    if (!userId) {
        throw new ValidationError('認証が必要です');
    }

    // フォーマットを取得（デフォルト: markdown）
    const format = (event.queryStringParameters?.format || 'markdown') as DownloadFormat;
    
    // サポートされているフォーマットかチェック
    const supportedFormats: DownloadFormat[] = ['markdown', 'md', 'text', 'txt'];
    if (!supportedFormats.includes(format)) {
        throw new ValidationError(`Unsupported format: ${format}. Supported formats: ${supportedFormats.join(', ')}`);
    }

    // DynamoDBからジョブ情報を取得
    const job = await repository.getJob(jobId, userId);

    if (!job) {
        throw new NotFoundError(`Job not found: ${jobId}`);
    }

    // ジョブのステータスを確認
    if (job.status !== 'COMPLETED') {
        throw new ValidationError(`Job is not completed yet. Current status: ${job.status}`);
    }

    // 議事録のS3キーを確認
    if (!job.minutesS3Key) {
        throw new InternalServerError('Minutes S3 key is not set');
    }

    // 出力バケット名を取得
    const outputBucketName = process.env.OUTPUT_BUCKET_NAME;
    if (!outputBucketName) {
        throw new InternalServerError('OUTPUT_BUCKET_NAME environment variable is not set');
    }

    // ファイル名を生成（元のビデオファイル名から拡張子を除いたもの）
    const baseFileName = job.videoFileName.replace(/\.[^/.]+$/, '');
    const downloadFileName = `${baseFileName}_minutes`;

    // Presigned URLを生成
    const downloadUrl = await generatePresignedUrl(
        job.minutesS3Key,
        outputBucketName,
        format,
        downloadFileName
    );

    logger.info('Download URL generated successfully', { jobId, userId, format });

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
                jobId: job.jobId,
                downloadUrl: downloadUrl,
                format: format,
                fileName: `${downloadFileName}.${format === 'text' || format === 'txt' ? 'txt' : 'md'}`,
                expiresIn: 3600, // 秒単位
            },
        }),
    };
}

/**
 * Lambda handler（エラーハンドリングミドルウェアでラップ）
 */
export const handler = withErrorHandler(downloadMinutes, logger);
