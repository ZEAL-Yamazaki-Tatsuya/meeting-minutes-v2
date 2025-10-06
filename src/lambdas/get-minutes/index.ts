/**
 * Get Minutes Lambda Handler
 * 指定されたジョブIDの議事録を取得する
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { NotFoundError, ValidationError, InternalServerError } from '../../utils/errors';

const logger = new Logger({ component: 'GetMinutesHandler' });
const repository = new MeetingJobRepository(
    process.env.JOBS_TABLE_NAME || 'MeetingJobs'
);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

/**
 * S3から議事録ファイルを取得する
 */
async function getMinutesFromS3(s3Key: string, bucketName: string): Promise<string> {
    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
        });

        const response = await s3Client.send(command);
        
        if (!response.Body) {
            throw new InternalServerError('S3 response body is empty');
        }

        // Streamをstringに変換
        const bodyContents = await response.Body.transformToString('utf-8');
        return bodyContents;
    } catch (error) {
        logger.error('Error getting minutes from S3', error as Error, { s3Key, bucketName });
        throw new InternalServerError(`Failed to retrieve minutes from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Lambda handler
 */
export const handler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    logger.info('Get minutes request received', {
        pathParameters: event.pathParameters,
    });

    try {
        // パスパラメータからjobIdを取得
        const jobId = event.pathParameters?.jobId;
        if (!jobId) {
            throw new ValidationError('jobId is required');
        }

        // ユーザーIDを取得（Cognito認証から取得する想定）
        // 現時点では認証が実装されていないため、クエリパラメータから取得
        const userId = event.queryStringParameters?.userId;
        if (!userId) {
            throw new ValidationError('userId is required');
        }

        // DynamoDBからジョブ情報を取得
        const job = await repository.getJob(jobId, userId);

        if (!job) {
            throw new NotFoundError(`Job not found: ${jobId}`);
        }

        // ジョブのステータスを確認
        if (job.status !== 'COMPLETED') {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': true,
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Bad Request',
                    message: `Job is not completed yet. Current status: ${job.status}`,
                }),
            };
        }

        // 議事録のS3キーを確認
        if (!job.minutesS3Key) {
            throw new InternalServerError('Minutes S3 key is not set');
        }

        // S3から議事録を取得
        const outputBucketName = process.env.OUTPUT_BUCKET_NAME;
        if (!outputBucketName) {
            throw new InternalServerError('OUTPUT_BUCKET_NAME environment variable is not set');
        }

        const minutesContent = await getMinutesFromS3(job.minutesS3Key, outputBucketName);

        logger.info('Minutes retrieved successfully', { jobId, userId });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({
                success: true,
                data: {
                    jobId: job.jobId,
                    userId: job.userId,
                    status: job.status,
                    videoFileName: job.videoFileName,
                    createdAt: job.createdAt,
                    updatedAt: job.updatedAt,
                    minutesContent: minutesContent,
                    metadata: job.metadata,
                },
            }),
        };
    } catch (error) {
        logger.error('Error getting minutes', error as Error);

        if (error instanceof NotFoundError) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': true,
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Not Found',
                    message: error.message,
                }),
            };
        }

        if (error instanceof ValidationError) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': true,
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Bad Request',
                    message: error.message,
                }),
            };
        }

        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({
                success: false,
                error: 'Internal Server Error',
                message: errorMessage,
            }),
        };
    }
};
