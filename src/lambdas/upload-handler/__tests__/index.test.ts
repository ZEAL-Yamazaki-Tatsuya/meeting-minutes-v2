/**
 * Upload Handler Lambda のユニットテスト
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../index';

// AWS SDKのモック
const s3Mock = mockClient(S3Client);
const dynamoMock = mockClient(DynamoDBDocumentClient);

// 環境変数の設定
process.env.INPUT_BUCKET_NAME = 'test-input-bucket';
process.env.JOBS_TABLE_NAME = 'test-jobs-table';
process.env.MAX_FILE_SIZE_MB = '2048';
process.env.ALLOWED_FILE_TYPES = 'video/mp4';

// getSignedUrlのモック
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://test-bucket.s3.amazonaws.com/presigned-url'),
}));

describe('Upload Handler Lambda', () => {
  beforeEach(() => {
    // モックをリセット
    s3Mock.reset();
    dynamoMock.reset();
  });

  const createMockEvent = (body: any): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/api/upload',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  };

  describe('正常系', () => {
    it('有効なリクエストでPresigned URLとjobIdを返す', async () => {
      // DynamoDBのモック設定
      dynamoMock.on(PutCommand).resolves({});

      const requestBody = {
        fileName: 'test-meeting.mp4',
        fileSize: 1024 * 1024 * 100, // 100MB
        contentType: 'video/mp4',
        userId: 'user-123',
        metadata: {
          meetingTitle: 'テスト会議',
          meetingDate: '2025-10-06',
        },
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      
      const response = JSON.parse(result.body);
      expect(response.jobId).toBeDefined();
      expect(response.uploadUrl).toBeDefined();
      expect(response.expiresIn).toBe(3600);
    });

    it('メタデータなしでも正常に動作する', async () => {
      dynamoMock.on(PutCommand).resolves({});

      const requestBody = {
        fileName: 'meeting.mp4',
        fileSize: 1024 * 1024 * 50,
        contentType: 'video/mp4',
        userId: 'user-456',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      
      const response = JSON.parse(result.body);
      expect(response.jobId).toBeDefined();
      expect(response.uploadUrl).toBeDefined();
    });
  });

  describe('バリデーションエラー', () => {
    it('リクエストボディが空の場合、400エラーを返す', async () => {
      const event = {
        ...createMockEvent({}),
        body: null,
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toContain('リクエストボディが空です');
    });

    it('必須フィールドが不足している場合、400エラーを返す', async () => {
      const requestBody = {
        fileName: 'test.mp4',
        // fileSize, contentType, userId が不足
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toBeDefined();
    });

    it('MP4以外のファイルの場合、400エラーを返す', async () => {
      const requestBody = {
        fileName: 'test.avi',
        fileSize: 1024 * 1024 * 100,
        contentType: 'video/avi',
        userId: 'user-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toContain('MP4ファイルのみアップロード可能です');
    });

    it('ファイルサイズが制限を超える場合、400エラーを返す', async () => {
      const requestBody = {
        fileName: 'large-file.mp4',
        fileSize: 1024 * 1024 * 3000, // 3GB (制限: 2GB)
        contentType: 'video/mp4',
        userId: 'user-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toContain('ファイルサイズが制限を超えています');
    });

    it('ファイルサイズが0以下の場合、400エラーを返す', async () => {
      const requestBody = {
        fileName: 'test.mp4',
        fileSize: 0,
        contentType: 'video/mp4',
        userId: 'user-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toBeDefined();
    });

    it('サポートされていないMIMEタイプの場合、400エラーを返す', async () => {
      const requestBody = {
        fileName: 'test.mp4',
        fileSize: 1024 * 1024 * 100,
        contentType: 'video/avi',
        userId: 'user-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toContain('サポートされていないファイル形式です');
    });

    it('ファイル名が空の場合、400エラーを返す', async () => {
      const requestBody = {
        fileName: '',
        fileSize: 1024 * 1024 * 100,
        contentType: 'video/mp4',
        userId: 'user-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toBeDefined();
    });
  });

  describe('エラーハンドリング', () => {
    it('DynamoDBエラーの場合、500エラーを返す', async () => {
      // DynamoDBがエラーを返すようにモック
      dynamoMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      const requestBody = {
        fileName: 'test.mp4',
        fileSize: 1024 * 1024 * 100,
        contentType: 'video/mp4',
        userId: 'user-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const response = JSON.parse(result.body);
      expect(response.error).toBeDefined();
    });

    it('不正なJSONの場合、エラーを返す', async () => {
      const event = {
        ...createMockEvent({}),
        body: 'invalid json',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const response = JSON.parse(result.body);
      expect(response.error).toBeDefined();
    });
  });

  describe('CORSヘッダー', () => {
    it('すべてのレスポンスにCORSヘッダーが含まれる', async () => {
      dynamoMock.on(PutCommand).resolves({});

      const requestBody = {
        fileName: 'test.mp4',
        fileSize: 1024 * 1024 * 100,
        contentType: 'video/mp4',
        userId: 'user-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
    });
  });
});
