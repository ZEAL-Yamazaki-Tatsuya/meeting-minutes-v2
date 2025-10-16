/**
 * Get Job Status Lambda Handler
 * 指定されたジョブIDのステータス情報を取得する
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { getUserIdFromEvent } from '../../utils/auth';
import { withErrorHandler } from '../../utils/error-handler';

const logger = new Logger({ component: 'GetJobStatusHandler' });
const repository = new MeetingJobRepository(
    process.env.JOBS_TABLE_NAME || 'MeetingJobs'
);

/**
 * メインハンドラーロジック
 */
async function getJobStatus(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    logger.info('Get job status request received', {
        pathParameters: event.pathParameters,
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
            'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({
            success: true,
            data: job,
        }),
    };
}

/**
 * Lambda handler（エラーハンドリングミドルウェアでラップ）
 */
export const handler = withErrorHandler(getJobStatus, logger);
