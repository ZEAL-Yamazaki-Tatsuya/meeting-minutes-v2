/**
 * List Jobs Lambda Handler
 * ユーザーのジョブ一覧を取得する
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { ValidationError } from '../../utils/errors';
import { getUserIdFromEvent } from '../../utils/auth';
import { withErrorHandler } from '../../utils/error-handler';

const logger = new Logger({ component: 'ListJobsHandler' });
const repository = new MeetingJobRepository(
    process.env.JOBS_TABLE_NAME || 'MeetingJobs'
);

/**
 * メインハンドラーロジック
 */
async function listJobs(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    logger.info('List jobs request received', {
        queryStringParameters: event.queryStringParameters,
    });

    // ユーザーIDを取得（Cognito認証から、またはクエリパラメータから）
    const userId = getUserIdFromEvent(event) || event.queryStringParameters?.userId;
    if (!userId) {
        throw new ValidationError('認証が必要です');
    }

    // ページネーションパラメータを取得
    const limit = event.queryStringParameters?.limit
        ? parseInt(event.queryStringParameters.limit, 10)
        : 50;

    if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new ValidationError('limit must be between 1 and 100');
    }

    // lastEvaluatedKeyを取得（Base64エンコードされたJSON）
    let lastEvaluatedKey: Record<string, any> | undefined;
    if (event.queryStringParameters?.nextToken) {
        try {
            const decoded = Buffer.from(
                event.queryStringParameters.nextToken,
                'base64'
            ).toString('utf-8');
            lastEvaluatedKey = JSON.parse(decoded);
        } catch (error) {
            throw new ValidationError('Invalid nextToken format');
        }
    }

    // DynamoDBからジョブ一覧を取得
    const result = await repository.listJobsByUser({
        userId,
        limit,
        lastEvaluatedKey,
    });

    // nextTokenを生成（Base64エンコードされたJSON）
    let nextToken: string | undefined;
    if (result.lastEvaluatedKey) {
        nextToken = Buffer.from(
            JSON.stringify(result.lastEvaluatedKey)
        ).toString('base64');
    }

    logger.info('Jobs retrieved successfully', {
        userId,
        count: result.jobs.length,
        hasMore: !!nextToken,
    });

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
                jobs: result.jobs,
                nextToken,
                count: result.jobs.length,
            },
        }),
    };
}

/**
 * Lambda handler（エラーハンドリングミドルウェアでラップ）
 */
export const handler = withErrorHandler(listJobs, logger);
