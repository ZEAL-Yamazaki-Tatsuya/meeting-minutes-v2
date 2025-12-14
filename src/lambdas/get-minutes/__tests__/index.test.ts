/**
 * Get Minutes Lambda Handler Tests
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../index';
import { Readable } from 'stream';

// S3とDynamoDBのモック
const s3Mock = mockClient(S3Client);
const dynamoMock = mockClient(DynamoDBDocumentClient);

// テスト用のモックデータ
const mockJobId = 'test-job-123';
const mockUserId = 'test-user-456';
const mockMinutesContent = `# 議事録

## 概要
テスト会議の議事録です。

## 決定事項
- 決定事項1
- 決定事項2

## ネクストアクション
- アクション1
- アクション2
`;

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

/**
 * Streamをモックするヘルパー関数
 */
function createMockStream(content: string) {
    const stream = new Readable();
    stream.push(content);
    stream.push(null);
    // transformToStringメソッドを追加
    (stream as any).transformToString = async () => content;
    return stream;
}

describe('Get Minutes Lambda Handler', () => {
    beforeEach(() => {
        s3Mock.reset();
        dynamoMock.reset();
    });

    /**
     * モックイベントを作成するヘルパー関数
     */
    function createMockEvent(
        jobId: string,
        userId?: string
    ): APIGatewayProxyEvent {
        return {
            pathParameters: { jobId },
            queryStringParameters: userId ? { userId } : null,
            requestContext: {
                authorizer: {
                    claims: {}
                }
            } as any,
        } as any;
    }

    describe('正常系', () => {
        it('議事録を正常に取得できる', async () => {
            // DynamoDBのモック設定
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            // S3のモック設定
            s3Mock.on(GetObjectCommand).resolves({
                Body: createMockStream(mockMinutesContent) as any,
            });

            const event = createMockEvent(mockJobId, mockUserId);
            const result = await handler(event);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.data.jobId).toBe(mockJobId);
            expect(body.data.userId).toBe(mockUserId);
            expect(body.data.videoFileName).toBe('test-video.mp4');
            expect(body.data.meetingTitle).toBe('テスト会議');
            expect(body.data.summary).toBeDefined();
            expect(body.data.decisions).toBeDefined();
            expect(body.data.nextActions).toBeDefined();
            expect(body.data.transcript).toBeDefined();
        });

        it('議事録の内容が正しく返される', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            s3Mock.on(GetObjectCommand).resolves({
                Body: createMockStream(mockMinutesContent) as any,
            });

            const event = createMockEvent(mockJobId, mockUserId);
            const result = await handler(event);

            const body = JSON.parse(result.body);
            expect(body.data.summary).toBeDefined();
            expect(body.data.decisions).toBeInstanceOf(Array);
            expect(body.data.nextActions).toBeInstanceOf(Array);
            expect(body.data.transcript).toBeDefined();
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
            expect(body.error.type).toBe('ValidationError');
            expect(body.error.message).toContain('jobId is required');
        });

        it('userIdが指定されていない場合は400エラーを返す', async () => {
            const event = createMockEvent(mockJobId);

            const result = await handler(event);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error.type).toBe('ValidationError');
            expect(body.error.message).toContain('認証が必要です');
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
            expect(body.error.type).toBe('NotFoundError');
            expect(body.error.message).toContain('Job not found');
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
            expect(body.error.type).toBe('ValidationError');
            expect(body.error.message).toContain('Job is not completed yet');
            expect(body.error.message).toContain('TRANSCRIBING');
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
            expect(body.error.type).toBe('InternalServerError');
        });
    });

    describe('異常系 - S3エラー', () => {
        it('S3からの取得に失敗した場合は500エラーを返す', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            s3Mock.on(GetObjectCommand).rejects(new Error('S3 access denied'));

            const event = createMockEvent(mockJobId, mockUserId);
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error.type).toBe('InternalServerError');
        });

        it('S3レスポンスのBodyが空の場合は500エラーを返す', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            s3Mock.on(GetObjectCommand).resolves({
                Body: undefined,
            });

            const event = createMockEvent(mockJobId, mockUserId);
            const result = await handler(event);

            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.error.type).toBe('InternalServerError');
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
            expect(body.error.type).toBe('InternalServerError');
        });
    });

    describe('CORSヘッダー', () => {
        it('すべてのレスポンスにCORSヘッダーが含まれる', async () => {
            dynamoMock.on(GetCommand).resolves({
                Item: mockJob,
            });

            s3Mock.on(GetObjectCommand).resolves({
                Body: createMockStream(mockMinutesContent) as any,
            });

            const event = createMockEvent(mockJobId, mockUserId);
            const result = await handler(event);

            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(result.headers).toHaveProperty('Access-Control-Allow-Credentials', 'true');
            expect(result.headers).toHaveProperty('Content-Type', 'application/json');
        });
    });
});
