/**
 * Get Job Status Lambda Handler
 * 指定されたジョブIDのステータス情報を取得する
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { NotFoundError, ValidationError } from '../../utils/errors';

const logger = new Logger({ component: 'GetJobStatusHandler' });
const repository = new MeetingJobRepository(
    process.env.JOBS_TABLE_NAME || 'MeetingJobs'
);

/**
 * Lambda handler
 */
export const handler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    logger.info('Get job status request received', {
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

        logger.info('Job retrieved successfully', { jobId, status: job.status });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({
                success: true,
                data: job,
            }),
        };
    } catch (error) {
        logger.error('Error getting job status', error as Error);

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
