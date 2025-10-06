/**
 * Download Minutes Lambda Handler Tests
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../index';

// S3とDynamoDBのモック
const s3Mock = mockClient(S3Client);
const dynamoMock = mockClient(DynamoDBDocumentClient);

// getSignedUrlのモック
jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: jest.fn().mockResolvedValue('https://test-bucket.s3.amazonaws.com/presigned-url'),
}));

// テスト用のモックデータ
const mockJobId = 'test-job-123';
const mockUserId = 'test-user-456';

const mockJob = {
    jobId: mockJobId,
    userId: mockUserId,
    status: 'COMPLETED',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T01:00:00.000Z',
    videoFileName: 'test-video.mp4',
    videoS3Key: 'test-user-456/test-job-123/video.mp4',
    videoSize: 1024000,
    transcribeJobName: 'transcribe-test-job-123',
    transcriptS3Key: 'test-user-456/test-job-123/transcript.json',
    minutesS3Key: 'test-user-456/test-job-123/minutes.md',
    metadata: {
        meetingTitle: 'テスト会議',
    },
};

// 環境変数のモック
process.env.JOBS_TABLE_NAME = 'MeetingJobs';
process.env.OUTPUT_BUCKET_NAME = 'test-output-bucket';
process.env.AWS_REGION = 'us-east-1';

describe('Download Minutes Lambda Handler', () => {
    beforeEach(() => {
        s3Mock.reset();
        dynamoMock.reset();
        jest.clearAllMocks();
    });

    /**
     * モックイベントを作成するヘルパー関数
     */
    function createMockEvent(
        jobId: string,
        userId?: string,
        format?: string
    ): APIGatewayProxyEvent {
        const queryParams: Record<string, string> = {};
        if (userId) queryParams.userId = userId;
        if (format) queryParams.format = format;

        return {
            pathParameters: { jobId },
            queryStringParameters: Object.keys(queryParams).length > 0 ? queryParams : null,
        } as any;
    }

    describe('正常系', () => {
        it('Markdown形式のダウンロードURLを正常に生成できる', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            const event = createMockEvent(mockJobId, mockUserId, 'markdown');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.data.jobId).toBe(mockJobId);
            expect(body.data.downloadUrl).toBeDefined();
            expect(body.data.format).toBe('markdown');
            expect(body.data.fileName).toContain('.md');
            expect(body.data.expiresIn).toBe(3600);
        });

        it('フォーマット指定なしの場合はMarkdownがデフォルトになる', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            const event = createMockEvent(mockJobId, mockUserId);
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.data.format).toBe('markdown');
            expect(body.data.fileName).toContain('.md');
        });

        it('Text形式のダウンロードURLを正常に生成できる', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            const event = createMockEvent(mockJobId, mockUserId, 'text');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.data.format).toBe('text');
            expect(body.data.fileName).toContain('.txt');
        });

        it('md形式（短縮形）のダウンロードURLを正常に生成できる', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            const event = createMockEvent(mockJobId, mockUserId, 'md');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.data.format).toBe('md');
        });

        it('txt形式（短縮形）のダウンロードURLを正常に生成できる', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            const event = createMockEvent(mockJobId, mockUserId, 'txt');
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.data.format).toBe('txt');
        });

        it('ファイル名が元のビデオファイル名から生成される', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            const event = createMockEvent(mockJobId, mockUserId);
            const result = await handler(event);

            const body = JSON.parse(result.body);
            expect(body.data.fileName).toContain('test-video_minutes');
        });
    });

    describe('異常系 - バリデーションエラー', () => {
        it('jobIdが指定されていない場合は400エラーを返す', async () => {
            const event = createMockEvent('', mockUserId);
            event.pathParameters = null;

            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Bad Request');
            expect(body.message).toContain('jobId is required');
        });

        it('userIdが指定されていない場合は400エラーを返す', async () => {
            const event = createMockEvent(mockJobId);

            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Bad Request');
            expect(body.message).toContain('userId is required');
        });

        it('サポートされていないフォーマットの場合は400エラーを返す', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            const event = createMockEvent(mockJobId, mockUserId, 'pdf');
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Bad Request');
            expect(body.message).toContain('Unsupported format');
        });
    });

    describe('異常系 - ジョブが見つからない', () => {
        it('ジョブが存在しない場合は404エラーを返す', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: undefined,
            });

            const event = createMockEvent(mockJobId, mockUserId);
            const result = await handler(event);

            expect(result.statusCode).toBe(404);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Not Found');
            expect(body.message).toContain('Job not found');
        });
    });

    describe('異常系 - ジョブのステータス', () => {
        it('ジョブが完了していない場合は400エラーを返す', async () => {
            const incompleteJob = {
                ...mockJob,
                status: 'TRANSCRIBING',
            };

            dynamoMock.on(GetCommand).resolves({
                Item: incompleteJob,
            });

            const event = createMockEvent(mockJobId, mockUserId);
            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Bad Request');
            expect(body.message).toContain('Job is not completed yet');
            expect(body.message).toContain('TRANSCRIBING');
        });

        it('minutesS3Keyが設定されていない場合は500エラーを返す', async () => {
            const jobWithoutMinutes = {
                ...mockJob,
                minutesS3Key: undefined,
            };

            dynamoMock.on(GetCommand).resolves({
                Item: jobWithoutMinutes,
            });

            const event = createMockEvent(mockJobId, mockUserId);
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Internal Server Error');
        });
    });

    describe('異常系 - DynamoDBエラー', () => {
        it('DynamoDBアクセスに失敗した場合は500エラーを返す', async () => {
            dynamoMock.on(GetCommand).rejects(new Error('DynamoDB error'));

            const event = createMockEvent(mockJobId, mockUserId);
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error).toBe('Internal Server Error');
        });
    });

    describe('CORSヘッダー', () => {
        it('すべてのレスポンスにCORSヘッダーが含まれる', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            const event = createMockEvent(mockJobId, mockUserId);
            const result = await handler(event);

            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Credentials', true);
            expect(result.headers).toHaveProperty('Content-Type', 'application/json');
        });
    });
});
