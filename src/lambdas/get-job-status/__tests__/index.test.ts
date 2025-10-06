/**
 * Get Job Status Lambda Handler Tests
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { MeetingJob } from '../../../models/meeting-job';

// MeetingJobRepositoryをモック
const mockGetJob = jest.fn();
jest.mock('../../../repositories/meeting-job-repository', () => {
    return {
        MeetingJobRepository: jest.fn().mockImplementation(() => {
            return {
                getJob: mockGetJob,
            };
        }),
    };
});

// モックの後にhandlerをインポート
import { handler } from '../index';

describe('Get Job Status Handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createMockEvent = (
        jobId?: string,
        userId?: string
    ): APIGatewayProxyEvent => {
        return {
            pathParameters: jobId ? { jobId } : null,
            queryStringParameters: userId ? { userId } : null,
            body: null,
            headers: {},
            multiValueHeaders: {},
            httpMethod: 'GET',
            isBase64Encoded: false,
            path: `/api/jobs/${jobId}`,
            resource: '/api/jobs/{jobId}',
            requestContext: {} as any,
            stageVariables: null,
            multiValueQueryStringParameters: null,
        };
    };

    const mockJob: MeetingJob = {
        jobId: 'test-job-123',
        userId: 'user-456',
        status: 'COMPLETED',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T01:00:00.000Z',
        videoFileName: 'meeting.mp4',
        videoS3Key: 'videos/user-456/test-job-123/meeting.mp4',
        videoSize: 1024000,
        transcriptS3Key: 'transcripts/user-456/test-job-123/transcript.json',
        minutesS3Key: 'minutes/user-456/test-job-123/minutes.md',
    };

    describe('正常系', () => {
        it('ジョブが存在する場合、200とジョブ情報を返す', async () => {
            mockGetJob.mockResolvedValue(mockJob);

            const event = createMockEvent('test-job-123', 'user-456');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            expect(mockGetJob).toHaveBeenCalledWith('test-job-123', 'user-456');

            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.data).toEqual(mockJob);
            expect(body.data.jobId).toBe('test-job-123');
            expect(body.data.status).toBe('COMPLETED');
        });

        it('処理中のジョブのステータスを正しく返す', async () => {
            const processingJob: MeetingJob = {
                ...mockJob,
                status: 'TRANSCRIBING',
                transcriptS3Key: undefined,
                minutesS3Key: undefined,
            };
            mockGetJob.mockResolvedValue(processingJob);

            const event = createMockEvent('test-job-123', 'user-456');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.data.status).toBe('TRANSCRIBING');
        });

        it('失敗したジョブのエラーメッセージを含めて返す', async () => {
            const failedJob: MeetingJob = {
                ...mockJob,
                status: 'FAILED',
                errorMessage: 'Transcription failed: Invalid audio format',
            };
            mockGetJob.mockResolvedValue(failedJob);

            const event = createMockEvent('test-job-123', 'user-456');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.data.status).toBe('FAILED');
            expect(body.data.errorMessage).toBe('Transcription failed: Invalid audio format');
        });
    });

    describe('エラーハンドリング', () => {
        it('jobIdが指定されていない場合、400エラーを返す', async () => {
            const event = createMockEvent(undefined, 'user-456');
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Bad Request');
            expect(body.message).toContain('jobId is required');
        });

        it('userIdが指定されていない場合、400エラーを返す', async () => {
            const event = createMockEvent('test-job-123', undefined);
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Bad Request');
            expect(body.message).toContain('userId is required');
        });

        it('ジョブが存在しない場合、404エラーを返す', async () => {
            mockGetJob.mockResolvedValue(null);

            const event = createMockEvent('non-existent-job', 'user-456');
            const result = await handler(event);

            expect(result.statusCode).toBe(404);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Not Found');
            expect(body.message).toContain('Job not found');
        });

        it('DynamoDBエラーが発生した場合、500エラーを返す', async () => {
            mockGetJob.mockRejectedValue(new Error('DynamoDB connection failed'));

            const event = createMockEvent('test-job-123', 'user-456');
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Internal Server Error');
        });
    });

    describe('CORSヘッダー', () => {
        it('すべてのレスポンスにCORSヘッダーが含まれる', async () => {
            mockGetJob.mockResolvedValue(mockJob);

            const event = createMockEvent('test-job-123', 'user-456');
            const result = await handler(event);

            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Credentials', true);
            expect(result.headers).toHaveProperty('Content-Type', 'application/json');
        });
    });
});
