/**
 * List Jobs Lambda Handler
 * ユーザーのジョブ一覧を取得する
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { ValidationError } from '../../utils/errors';

const logger = new Logger({ component: 'ListJobsHandler' });
const repository = new MeetingJobRepository(
    process.env.JOBS_TABLE_NAME || 'MeetingJobs'
);

/**
 * Lambda handler
 */
export const handler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    logger.info('List jobs request received', {
        queryStringParameters: event.queryStringParameters,
    });

    try {
        // ユーザーIDを取得（Cognito認証から取得する想定）
        // 現時点では認証が実装されていないため、クエリパラメータから取得
        const userId = event.queryStringParameters?.userId;
        if (!userId) {
            throw new ValidationError('userId is required');
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
                'Access-Control-Allow-Credentials': true,
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
    } catch (error) {
        logger.error('Error listing jobs', error as Error);

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
