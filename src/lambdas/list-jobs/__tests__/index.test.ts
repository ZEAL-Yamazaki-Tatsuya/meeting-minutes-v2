/**
 * List Jobs Lambda Handler Tests
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { MeetingJob, ListJobsResult } from '../../../models/meeting-job';

// MeetingJobRepositoryをモック
const mockListJobsByUser = jest.fn();
jest.mock('../../../repositories/meeting-job-repository', () => {
    return {
        MeetingJobRepository: jest.fn().mockImplementation(() => {
            return {
                listJobsByUser: mockListJobsByUser,
            };
        }),
    };
});

// モックの後にhandlerをインポート
import { handler } from '../index';

describe('List Jobs Handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createMockEvent = (
        userId?: string,
        limit?: string,
        nextToken?: string
    ): APIGatewayProxyEvent => {
        const queryStringParameters: Record<string, string> = {};
        if (userId) queryStringParameters.userId = userId;
        if (limit) queryStringParameters.limit = limit;
        if (nextToken) queryStringParameters.nextToken = nextToken;

        return {
            pathParameters: null,
            queryStringParameters: Object.keys(queryStringParameters).length > 0
                ? queryStringParameters
                : null,
            body: null,
            headers: {},
            multiValueHeaders: {},
            httpMethod: 'GET',
            isBase64Encoded: false,
            path: '/api/jobs',
            resource: '/api/jobs',
            requestContext: {} as any,
            stageVariables: null,
            multiValueQueryStringParameters: null,
        };
    };

    const createMockJobs = (count: number): MeetingJob[] => {
        return Array.from({ length: count }, (_, i) => ({
            jobId: `job-${i + 1}`,
            userId: 'user-456',
            status: i % 3 === 0 ? 'COMPLETED' : i % 3 === 1 ? 'TRANSCRIBING' : 'GENERATING',
            createdAt: new Date(Date.now() - i * 3600000).toISOString(),
            updatedAt: new Date(Date.now() - i * 1800000).toISOString(),
            videoFileName: `meeting-${i + 1}.mp4`,
            videoS3Key: `videos/user-456/job-${i + 1}/meeting.mp4`,
            videoSize: 1024000 + i * 1000,
        })) as MeetingJob[];
    };

    describe('正常系', () => {
        it('ジョブ一覧を取得して返す', async () => {
            const mockJobs = createMockJobs(5);
            const mockResult: ListJobsResult = {
                jobs: mockJobs,
            };
            mockListJobsByUser.mockResolvedValue(mockResult);

            const event = createMockEvent('user-456');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockListJobsByUser).toHaveBeenCalledWith({
                userId: 'user-456',
                limit: 50,
                lastEvaluatedKey: undefined,
            });

            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.data.jobs).toHaveLength(5);
            expect(body.data.count).toBe(5);
            expect(body.data.nextToken).toBeUndefined();
        });

        it('limitパラメータを指定してジョブ一覧を取得する', async () => {
            const mockJobs = createMockJobs(10);
            const mockResult: ListJobsResult = {
                jobs: mockJobs,
            };
            mockListJobsByUser.mockResolvedValue(mockResult);

            const event = createMockEvent('user-456', '10');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockListJobsByUser).toHaveBeenCalledWith({
                userId: 'user-456',
                limit: 10,
                lastEvaluatedKey: undefined,
            });

            const body = JSON.parse(result.body);
            expect(body.data.jobs).toHaveLength(10);
        });

        it('ページネーション付きでジョブ一覧を取得する', async () => {
            const mockJobs = createMockJobs(50);
            const lastEvaluatedKey = { jobId: 'job-50', userId: 'user-456' };
            const mockResult: ListJobsResult = {
                jobs: mockJobs,
                lastEvaluatedKey,
            };
            mockListJobsByUser.mockResolvedValue(mockResult);

            const event = createMockEvent('user-456', '50');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.data.jobs).toHaveLength(50);
            expect(body.data.nextToken).toBeDefined();

            // nextTokenをデコードして検証
            const decodedToken = JSON.parse(
                Buffer.from(body.data.nextToken, 'base64').toString('utf-8')
            );
            expect(decodedToken).toEqual(lastEvaluatedKey);
        });

        it('nextTokenを使用して次のページを取得する', async () => {
            const lastEvaluatedKey = { jobId: 'job-50', userId: 'user-456' };
            const nextToken = Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64');
            const mockJobs = createMockJobs(20);
            const mockResult: ListJobsResult = {
                jobs: mockJobs,
            };
            mockListJobsByUser.mockResolvedValue(mockResult);

            const event = createMockEvent('user-456', '50', nextToken);
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockListJobsByUser).toHaveBeenCalledWith({
                userId: 'user-456',
                limit: 50,
                lastEvaluatedKey,
            });

            const body = JSON.parse(result.body);
            expect(body.data.jobs).toHaveLength(20);
            expect(body.data.nextToken).toBeUndefined();
        });

        it('ジョブが0件の場合、空の配列を返す', async () => {
            const mockResult: ListJobsResult = {
                jobs: [],
            };
            mockListJobsByUser.mockResolvedValue(mockResult);

            const event = createMockEvent('user-456');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.data.jobs).toHaveLength(0);
            expect(body.data.count).toBe(0);
        });
    });

    describe('エラーハンドリング', () => {
        it('userIdが指定されていない場合、400エラーを返す', async () => {
            const event = createMockEvent(undefined);
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Bad Request');
            expect(body.message).toContain('userId is required');
        });

        it('limitが不正な値の場合、400エラーを返す', async () => {
            const event = createMockEvent('user-456', 'invalid');
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.message).toContain('limit must be between 1 and 100');
        });

        it('limitが範囲外の場合、400エラーを返す', async () => {
            const event = createMockEvent('user-456', '101');
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.message).toContain('limit must be between 1 and 100');
        });

        it('nextTokenが不正な形式の場合、400エラーを返す', async () => {
            const event = createMockEvent('user-456', '50', 'invalid-token');
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.message).toContain('Invalid nextToken format');
        });

        it('DynamoDBエラーが発生した場合、500エラーを返す', async () => {
            mockListJobsByUser.mockRejectedValue(
                new Error('DynamoDB connection failed')
            );

            const event = createMockEvent('user-456');
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Internal Server Error');
        });
    });

    describe('CORSヘッダー', () => {
        it('すべてのレスポンスにCORSヘッダーが含まれる', async () => {
            const mockResult: ListJobsResult = {
                jobs: createMockJobs(5),
            };
            mockListJobsByUser.mockResolvedValue(mockResult);

            const event = createMockEvent('user-456');
            const result = await handler(event);

            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Credentials', true);
            expect(result.headers).toHaveProperty('Content-Type', 'application/json');
        });
    });
});
