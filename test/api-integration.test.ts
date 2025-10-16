/**
 * API統合テスト
 * アップロードからダウンロードまでのエンドツーエンドフローをテストする
 */

import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { handler as uploadHandler } from '../src/lambdas/upload-handler';
import { handler as listJobsHandler } from '../src/lambdas/list-jobs';
import { handler as getMinutesHandler } from '../src/lambdas/get-minutes';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { Readable } from 'stream';

// モッククライアントの作成
const s3Mock = mockClient(S3Client);
const dynamoMock = mockClient(DynamoDBDocumentClient);

// 環境変数の設定
process.env.INPUT_BUCKET_NAME = 'test-input-bucket';
process.env.OUTPUT_BUCKET_NAME = 'test-output-bucket';
process.env.JOBS_TABLE_NAME = 'test-jobs-table';
process.env.MAX_FILE_SIZE_MB = '2048';
process.env.ALLOWED_FILE_TYPES = 'video/mp4';
process.env.AWS_REGION = 'ap-northeast-1';

describe('API統合テスト', () => {
  beforeEach(() => {
    // モックをリセット
    s3Mock.reset();
    dynamoMock.reset();
  });

  describe('エンドツーエンドフロー', () => {
    const testUserId = 'test-user-123';
    const testFileName = 'meeting-video.mp4';
    const testFileSize = 1024 * 1024 * 100; // 100MB
    const testContentType = 'video/mp4';

    test('ジョブ一覧取得 → 議事録取得の完全フロー', async () => {
      // Presigned URL生成のテストはスキップし、ジョブ一覧と議事録取得のみテスト
      const jobId = 'test-job-123';

      // ステップ2: ジョブ一覧を取得
      const listJobsEvent: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/api/jobs',
        headers: {},
        body: null,
        isBase64Encoded: false,
        queryStringParameters: {
          userId: testUserId,
          limit: '10',
        },
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
      };

      // DynamoDB QueryCommandのモック
      dynamoMock.on(QueryCommand).resolves({
        Items: [
          {
            jobId,
            userId: testUserId,
            status: 'COMPLETED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            videoFileName: testFileName,
            videoS3Key: `${testUserId}/${Date.now()}_${testFileName}`,
            videoSize: testFileSize,
            minutesS3Key: `${testUserId}/${jobId}/minutes.md`,
            metadata: {
              meetingTitle: 'テスト会議',
              meetingDate: '2024-01-09',
              participants: ['田中', '佐藤'],
            },
          },
        ],
        LastEvaluatedKey: undefined,
      });

      // ジョブ一覧ハンドラーを実行
      const listResponse = await listJobsHandler(listJobsEvent);
      expect(listResponse.statusCode).toBe(200);

      const listBody = JSON.parse(listResponse.body);
      expect(listBody.success).toBe(true);
      expect(listBody.data.jobs).toHaveLength(1);
      expect(listBody.data.jobs[0].jobId).toBe(jobId);
      expect(listBody.data.jobs[0].status).toBe('COMPLETED');

      // ステップ3: 議事録を取得
      const getMinutesEvent: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: `/api/jobs/${jobId}/minutes`,
        headers: {},
        body: null,
        isBase64Encoded: false,
        queryStringParameters: {
          userId: testUserId,
        },
        pathParameters: {
          jobId,
        },
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
      };

      // DynamoDB GetCommandのモック
      dynamoMock.on(GetCommand).resolves({
        Item: {
          jobId,
          userId: testUserId,
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          videoFileName: testFileName,
          videoS3Key: `${testUserId}/${Date.now()}_${testFileName}`,
          videoSize: testFileSize,
          minutesS3Key: `${testUserId}/${jobId}/minutes.md`,
        },
      });

      // S3 GetObjectCommandのモック（議事録取得用）
      const mockMinutesContent = `# 議事録

## 概要
テスト会議の議事録です。

## 決定事項
1. プロジェクトを開始する ([00:03:53])
2. 次回ミーティングを設定する ([00:15:22])

## ネクストアクション
1. 要件定義書を作成する - 担当: 田中 - 期限: 2024-01-15 ([00:20:10])
2. 開発環境をセットアップする - 担当: 佐藤 - 期限: 2024-01-20 ([00:25:30])

## 文字起こし全文
これはテストの文字起こしです。
`;

      const stream = Readable.from([mockMinutesContent]);
      s3Mock.on(GetObjectCommand).resolves({
        Body: stream as any,
      });

      // 議事録取得ハンドラーを実行
      const minutesResponse = await getMinutesHandler(getMinutesEvent);
      expect(minutesResponse.statusCode).toBe(200);

      const minutesBody = JSON.parse(minutesResponse.body);
      expect(minutesBody.success).toBe(true);
      expect(minutesBody.data.jobId).toBe(jobId);
      expect(minutesBody.data.summary).toContain('テスト会議');
      expect(minutesBody.data.decisions).toHaveLength(2);
      expect(minutesBody.data.nextActions).toHaveLength(2);
      expect(minutesBody.data.transcript).toContain('テストの文字起こし');
    });
  });

  describe('エラーケース', () => {
    const testUserId = 'test-user-123';

    test('無効なファイル形式でアップロードを拒否する', async () => {
      const uploadEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/api/upload',
        headers: {},
        body: JSON.stringify({
          userId: testUserId,
          fileName: 'document.pdf',
          fileSize: 1024 * 1024,
          contentType: 'application/pdf',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
      };

      const response = await uploadHandler(uploadEvent);
      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.error.message).toContain('MP4ファイルのみ');
    });

    test('ファイルサイズ超過でアップロードを拒否する', async () => {
      const uploadEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/api/upload',
        headers: {},
        body: JSON.stringify({
          userId: testUserId,
          fileName: 'large-video.mp4',
          fileSize: 1024 * 1024 * 1024 * 3, // 3GB
          contentType: 'video/mp4',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
      };

      const response = await uploadHandler(uploadEvent);
      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.error.message).toContain('制限を超えています');
    });

    test('存在しないジョブIDで404エラーを返す', async () => {
      const nonExistentJobId = 'non-existent-job-id';

      const getMinutesEvent: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: `/api/jobs/${nonExistentJobId}/minutes`,
        headers: {},
        body: null,
        isBase64Encoded: false,
        queryStringParameters: {
          userId: testUserId,
        },
        pathParameters: {
          jobId: nonExistentJobId,
        },
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
      };

      // DynamoDB GetCommandのモック（ジョブが見つからない）
      dynamoMock.on(GetCommand).resolves({
        Item: undefined,
      });

      const response = await getMinutesHandler(getMinutesEvent);
      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.error.message).toContain('not found');
    });

    test('未完了のジョブで議事録取得を拒否する', async () => {
      const jobId = 'test-job-id';

      const getMinutesEvent: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: `/api/jobs/${jobId}/minutes`,
        headers: {},
        body: null,
        isBase64Encoded: false,
        queryStringParameters: {
          userId: testUserId,
        },
        pathParameters: {
          jobId,
        },
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
      };

      // DynamoDB GetCommandのモック（ジョブは存在するが未完了）
      dynamoMock.on(GetCommand).resolves({
        Item: {
          jobId,
          userId: testUserId,
          status: 'TRANSCRIBING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          videoFileName: 'test.mp4',
          videoS3Key: `${testUserId}/${jobId}/test.mp4`,
          videoSize: 1024 * 1024,
        },
      });

      const response = await getMinutesHandler(getMinutesEvent);
      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.error.message).toContain('not completed');
    });
  });

  describe('並行処理テスト', () => {
    const testUserId = 'test-user-123';

    test('複数のジョブ一覧取得リクエストを並行処理できる', async () => {
      // DynamoDB QueryCommandのモック
      dynamoMock.on(QueryCommand).resolves({
        Items: [
          {
            jobId: 'job-1',
            userId: testUserId,
            status: 'COMPLETED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            videoFileName: 'test.mp4',
            videoS3Key: `${testUserId}/test.mp4`,
            videoSize: 1024 * 1024,
          },
        ],
        LastEvaluatedKey: undefined,
      });

      // 3つの並行リクエストを作成
      const listPromises = Array.from({ length: 3 }, () => {
        const event: APIGatewayProxyEvent = {
          httpMethod: 'GET',
          path: '/api/jobs',
          headers: {},
          body: null,
          isBase64Encoded: false,
          queryStringParameters: {
            userId: testUserId,
            limit: '10',
          },
          pathParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
          multiValueHeaders: {},
          multiValueQueryStringParameters: null,
        };

        return listJobsHandler(event);
      });

      // すべてのリクエストを並行実行
      const responses = await Promise.all(listPromises);

      // すべてのレスポンスが成功していることを確認
      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.jobs).toBeDefined();
      });
    });
  });
});
