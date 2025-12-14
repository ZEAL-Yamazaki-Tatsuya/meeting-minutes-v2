/**
 * List Minutes Lambda Handler のユニットテスト
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../index';
import { MeetingJobRepository } from '../../../repositories/meeting-job-repository';
import { MeetingJob } from '../../../models/meeting-job';

// MeetingJobRepositoryをモック
jest.mock('../../../repositories/meeting-job-repository');

const mockListJobsByUser = jest.fn();

// モックの実装を設定
(MeetingJobRepository as jest.MockedClass<typeof MeetingJobRepository>).mockImplementation(() => {
    return {
        listJobsByUser: mockListJobsByUser,
    } as any;
});

describe('List Minutes Handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockListJobsByUser.mockReset();
    });

    const createMockEvent = (queryStringParameters?: Record<string, string>): APIGatewayProxyEvent => ({
        httpMethod: 'GET',
        path: '/api/minutes',
        headers: {},
        queryStringParameters: queryStringParameters || null,
        body: null,
        isBase64Encoded: false,
        requestContext: {
            accountId: '',
            apiId: '',
            protocol: '',
            requestId: '',
            requestTimeEpoch: 0,
            resourceId: '',
            resourcePath: '',
            stage: '',
            authorizer: {
                claims: {
                    sub: 'test-user-id',
                },
            },
            identity: {} as any,
        } as any,
        pathParameters: null,
        stageVariables: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        resource: '',
    });

    const createMockJob = (overrides?: Partial<MeetingJob>): MeetingJob => ({
        jobId: 'job-1',
        userId: 'test-user-id',
        status: 'COMPLETED',
        createdAt: '2025-12-14T10:00:00Z',
        updatedAt: '2025-12-14T10:00:00Z',
        videoFileName: 'test-meeting.mp4',
        videoS3Key: 'input/test-meeting.mp4',
        videoSize: 1024,
        minutesS3Key: 'output/minutes.json',
        summaryPreview: 'これはテスト議事録の概要です。',
        ...overrides,
    });



    describe('パラメータ検証', () => {
        it('無効なページ番号の場合はエラーを返すこと', async () => {
            const event = createMockEvent({ page: '0' });
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
        });

        it('limitが範囲外の場合はエラーを返すこと', async () => {
            const event = createMockEvent({ limit: '101' });
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
        });

        it('無効な日付形式の場合はエラーを返すこと', async () => {
            const event = createMockEvent({ startDate: 'invalid-date' });
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
        });
    });



    describe('認証', () => {
        it('認証されていない場合はエラーを返すこと', async () => {
            const event = createMockEvent();
            event.requestContext = {} as any;

            const result = await handler(event);

            expect(result.statusCode).toBe(401);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
        });
    });
});
