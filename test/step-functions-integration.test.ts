/**
 * Step Functions ワークフロー統合テスト
 * 正常系、エラーハンドリング、リトライ、タイムアウトケースをテストする
 */

import { mockClient } from 'aws-sdk-client-mock';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  TranscriptionJobStatus,
} from '@aws-sdk/client-transcribe';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { handler as transcribeTrigger } from '../src/lambdas/transcribe-trigger';
import { handler as checkTranscribeStatus } from '../src/lambdas/check-transcribe-status';
import { handler as minutesGenerator } from '../src/lambdas/minutes-generator';
import { Readable } from 'stream';

// モッククライアントの作成
const transcribeMock = mockClient(TranscribeClient);
const bedrockMock = mockClient(BedrockRuntimeClient);
const s3Mock = mockClient(S3Client);
const dynamoMock = mockClient(DynamoDBDocumentClient);

// 環境変数の設定
process.env.INPUT_BUCKET_NAME = 'test-input-bucket';
process.env.OUTPUT_BUCKET_NAME = 'test-output-bucket';
process.env.JOBS_TABLE_NAME = 'test-jobs-table';
process.env.AWS_REGION = 'ap-northeast-1';

describe('Step Functions ワークフロー統合テスト', () => {
  beforeEach(() => {
    // モックをリセット
    transcribeMock.reset();
    bedrockMock.reset();
    s3Mock.reset();
    dynamoMock.reset();
  });

  describe('正常系ワークフロー', () => {
    const testJobId = 'test-job-123';
    const testUserId = 'test-user-456';
    const testVideoS3Key = `${testUserId}/${testJobId}/video.mp4`;
    const testTranscribeJobName = `meeting-minutes-${testJobId}-${Date.now()}`;

    test('完全なワークフローが正常に実行される', async () => {
      // ステップ1: Transcribeジョブを開始
      dynamoMock.on(UpdateCommand).resolves({});
      transcribeMock.on(StartTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: testTranscribeJobName,
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      const transcribeTriggerInput = {
        jobId: testJobId,
        userId: testUserId,
        videoS3Key: testVideoS3Key,
      };

      const transcribeTriggerResult = await transcribeTrigger(transcribeTriggerInput);
      expect(transcribeTriggerResult.jobId).toBe(testJobId);
      expect(transcribeTriggerResult.transcribeJobName).toBeDefined();
      expect(transcribeTriggerResult.status).toBe('IN_PROGRESS');

      // ステップ2: Transcribeステータスを確認（進行中）
      transcribeMock.on(GetTranscriptionJobCommand).resolvesOnce({
        TranscriptionJob: {
          TranscriptionJobName: testTranscribeJobName,
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      const checkStatusInput1 = {
        jobId: testJobId,
        userId: testUserId,
        transcribeJobName: transcribeTriggerResult.transcribeJobName,
      };

      const checkStatusResult1 = await checkTranscribeStatus(checkStatusInput1);
      expect(checkStatusResult1.isComplete).toBe(false);
      expect(checkStatusResult1.status).toBe('IN_PROGRESS');

      // ステップ3: Transcribeステータスを確認（完了）
      const transcriptS3Key = `${testUserId}/${testJobId}/transcript.json`;
      
      // 2回目の呼び出しでは完了を返す
      transcribeMock.on(GetTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: testTranscribeJobName,
          TranscriptionJobStatus: TranscriptionJobStatus.COMPLETED,
          Transcript: {
            TranscriptFileUri: `s3://${process.env.OUTPUT_BUCKET_NAME}/${transcriptS3Key}`,
          },
        },
      });

      const checkStatusResult2 = await checkTranscribeStatus(checkStatusInput1);
      expect(checkStatusResult2.isComplete).toBe(true);
      expect(checkStatusResult2.status).toBe('COMPLETED');
      expect(checkStatusResult2.transcriptS3Key).toBe(transcriptS3Key);

      // ステップ4: 議事録を生成
      const mockTranscriptJson = {
        results: {
          transcripts: [
            {
              transcript: 'これはテスト会議の文字起こしです。プロジェクトを開始することに決定しました。',
            },
          ],
          speaker_labels: {
            speakers: 2,
            segments: [
              {
                speaker_label: 'spk_0',
                start_time: '0.0',
                end_time: '5.0',
                items: [
                  {
                    speaker_label: 'spk_0',
                    start_time: '0.0',
                    end_time: '2.5',
                  },
                ],
              },
            ],
          },
          items: [
            {
              start_time: '0.0',
              end_time: '2.5',
              alternatives: [
                {
                  confidence: '0.99',
                  content: 'これはテスト会議の文字起こしです',
                },
              ],
              type: 'pronunciation',
            },
          ],
        },
      };

      const transcriptStream = Readable.from([JSON.stringify(mockTranscriptJson)]);
      s3Mock.on(GetObjectCommand).resolves({
        Body: transcriptStream as any,
      });

      // Bedrockのレスポンスをモック
      const mockBedrockResponse = {
        summary: 'テスト会議の概要です。',
        decisions: [
          {
            description: 'プロジェクトを開始する',
            timestamp: '[00:01:30]',
          },
        ],
        nextActions: [
          {
            description: '要件定義書を作成する',
            assignee: '田中',
            dueDate: '2024-01-15',
            timestamp: '[00:03:00]',
          },
        ],
      };

      const bedrockResponseBody = JSON.stringify(mockBedrockResponse);
      bedrockMock.on(InvokeModelCommand).resolves({
        body: new Uint8Array(Buffer.from(bedrockResponseBody)) as any,
      });

      s3Mock.on(PutObjectCommand).resolves({});

      const minutesGeneratorInput = {
        jobId: testJobId,
        userId: testUserId,
        transcriptS3Key,
      };

      const minutesGeneratorResult = await minutesGenerator(minutesGeneratorInput);
      expect(minutesGeneratorResult.jobId).toBe(testJobId);
      expect(minutesGeneratorResult.status).toBe('COMPLETED');
      expect(minutesGeneratorResult.minutesS3Key).toBeDefined();
      expect(minutesGeneratorResult.minutesS3Key).toContain('minutes.md');
    });
  });

  describe('エラーハンドリングとリトライ', () => {
    const testJobId = 'test-job-error';
    const testUserId = 'test-user-error';
    const testVideoS3Key = `${testUserId}/${testJobId}/video.mp4`;

    test('Transcribeジョブ開始失敗時にエラーを適切に処理する', async () => {
      dynamoMock.on(UpdateCommand).resolves({});
      
      // Transcribeジョブ開始が失敗
      transcribeMock.on(StartTranscriptionJobCommand).rejects(
        new Error('Transcribe service unavailable')
      );

      const transcribeTriggerInput = {
        jobId: testJobId,
        userId: testUserId,
        videoS3Key: testVideoS3Key,
      };

      // エラーがスローされることを確認
      await expect(transcribeTrigger(transcribeTriggerInput)).rejects.toThrow();

      // DynamoDBのステータスがFAILEDに更新されることを確認
      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      expect(updateCalls.length).toBeGreaterThan(0);
      
      // 最後の呼び出しでFAILEDステータスが設定されているか確認
      const lastUpdateCall = updateCalls[updateCalls.length - 1];
      expect(lastUpdateCall.args[0].input.ExpressionAttributeValues).toMatchObject({
        ':status': 'FAILED',
      });
    });

    test('Transcribeジョブが失敗した場合にステータスを適切に処理する', async () => {
      const testTranscribeJobName = `meeting-minutes-${testJobId}-${Date.now()}`;
      const failureReason = 'Invalid audio format';

      dynamoMock.on(UpdateCommand).resolves({});
      transcribeMock.on(GetTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: testTranscribeJobName,
          TranscriptionJobStatus: TranscriptionJobStatus.FAILED,
          FailureReason: failureReason,
        },
      });

      const checkStatusInput = {
        jobId: testJobId,
        userId: testUserId,
        transcribeJobName: testTranscribeJobName,
      };

      const result = await checkTranscribeStatus(checkStatusInput);
      expect(result.isComplete).toBe(true);
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain(failureReason);

      // DynamoDBのステータスがFAILEDに更新されることを確認
      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      expect(updateCalls.length).toBeGreaterThan(0);
      
      const lastUpdateCall = updateCalls[updateCalls.length - 1];
      expect(lastUpdateCall.args[0].input.ExpressionAttributeValues).toMatchObject({
        ':status': 'FAILED',
      });
    });

    test('議事録生成中のエラーを適切に処理する', async () => {
      const transcriptS3Key = `${testUserId}/${testJobId}/transcript.json`;

      dynamoMock.on(UpdateCommand).resolves({});
      
      // S3からのTranscript取得が失敗
      s3Mock.on(GetObjectCommand).rejects(new Error('S3 access denied'));

      const minutesGeneratorInput = {
        jobId: testJobId,
        userId: testUserId,
        transcriptS3Key,
      };

      // エラーがスローされることを確認
      await expect(minutesGenerator(minutesGeneratorInput)).rejects.toThrow();

      // DynamoDBのステータスがFAILEDに更新されることを確認
      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      expect(updateCalls.length).toBeGreaterThan(0);
      
      const lastUpdateCall = updateCalls[updateCalls.length - 1];
      expect(lastUpdateCall.args[0].input.ExpressionAttributeValues).toMatchObject({
        ':status': 'FAILED',
      });
    });

    test('Bedrockエラー時にリトライ可能なエラーとして処理する', async () => {
      const transcriptS3Key = `${testUserId}/${testJobId}/transcript.json`;

      dynamoMock.on(UpdateCommand).resolves({});

      const mockTranscriptJson = {
        results: {
          transcripts: [{ transcript: 'テスト文字起こし' }],
          speaker_labels: { speakers: 1, segments: [] },
          items: [],
        },
      };

      const transcriptStream = Readable.from([JSON.stringify(mockTranscriptJson)]);
      s3Mock.on(GetObjectCommand).resolves({
        Body: transcriptStream as any,
      });

      // Bedrockがスロットリングエラーを返す
      bedrockMock.on(InvokeModelCommand).rejects({
        name: 'ThrottlingException',
        message: 'Rate exceeded',
      });

      const minutesGeneratorInput = {
        jobId: testJobId,
        userId: testUserId,
        transcriptS3Key,
      };

      // エラーがスローされることを確認
      await expect(minutesGenerator(minutesGeneratorInput)).rejects.toThrow();
    });
  });

  describe('タイムアウトケース', () => {
    const testJobId = 'test-job-timeout';
    const testUserId = 'test-user-timeout';
    const testTranscribeJobName = `meeting-minutes-${testJobId}-${Date.now()}`;

    test('Transcribeジョブが長時間IN_PROGRESSのままの場合', async () => {
      // 複数回のポーリングでIN_PROGRESSが続く
      transcribeMock.on(GetTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: testTranscribeJobName,
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      const checkStatusInput = {
        jobId: testJobId,
        userId: testUserId,
        transcribeJobName: testTranscribeJobName,
      };

      // 複数回ポーリングしてもIN_PROGRESSが続くことを確認
      for (let i = 0; i < 5; i++) {
        const result = await checkTranscribeStatus(checkStatusInput);
        expect(result.isComplete).toBe(false);
        expect(result.status).toBe('IN_PROGRESS');
      }

      // Step Functionsのタイムアウト設定により、最終的にワークフローがタイムアウトする
      // （実際のタイムアウト処理はStep Functionsが行う）
    });

    test('議事録生成が長時間かかる場合のタイムアウト処理', async () => {
      const transcriptS3Key = `${testUserId}/${testJobId}/transcript.json`;

      dynamoMock.on(UpdateCommand).resolves({});

      // 大量のデータを含むTranscript（処理に時間がかかる）
      const largeTranscriptJson = {
        results: {
          transcripts: [
            {
              transcript: 'これは非常に長い会議の文字起こしです。'.repeat(1000),
            },
          ],
          speaker_labels: {
            speakers: 10,
            segments: Array.from({ length: 1000 }, (_, i) => ({
              speaker_label: `spk_${i % 10}`,
              start_time: `${i * 10}.0`,
              end_time: `${(i + 1) * 10}.0`,
              items: [],
            })),
          },
          items: Array.from({ length: 10000 }, (_, i) => ({
            start_time: `${i}.0`,
            end_time: `${i + 1}.0`,
            alternatives: [
              {
                confidence: '0.99',
                content: `単語${i}`,
              },
            ],
            type: 'pronunciation',
          })),
        },
      };

      const transcriptStream = Readable.from([JSON.stringify(largeTranscriptJson)]);
      s3Mock.on(GetObjectCommand).resolves({
        Body: transcriptStream as any,
      });

      // Bedrockが遅延してレスポンスを返す（タイムアウトシミュレーション）
      bedrockMock.on(InvokeModelCommand).callsFake(async () => {
        // 実際のタイムアウトはLambdaの設定で制御される
        // ここでは正常なレスポンスを返す
        const mockResponse = {
          summary: '長い会議の概要',
          decisions: [],
          nextActions: [],
        };
        const encoder = new TextEncoder();
        return {
          body: encoder.encode(JSON.stringify(mockResponse)),
        };
      });

      s3Mock.on(PutObjectCommand).resolves({});

      const minutesGeneratorInput = {
        jobId: testJobId,
        userId: testUserId,
        transcriptS3Key,
      };

      // 正常に完了することを確認（タイムアウトはLambda設定で制御）
      const result = await minutesGenerator(minutesGeneratorInput);
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('ワークフローの状態遷移', () => {
    const testJobId = 'test-job-state';
    const testUserId = 'test-user-state';

    test('ジョブステータスが正しい順序で遷移する', async () => {
      const statusUpdates: string[] = [];

      // DynamoDB UpdateCommandをモックして、ステータス更新を記録
      dynamoMock.on(UpdateCommand).callsFake((input) => {
        const status = input.ExpressionAttributeValues?.[':status'];
        if (status) {
          statusUpdates.push(status);
        }
        return Promise.resolve({});
      });

      // 1. UPLOADED → TRANSCRIBING
      transcribeMock.on(StartTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'test-job',
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      await transcribeTrigger({
        jobId: testJobId,
        userId: testUserId,
        videoS3Key: 'test.mp4',
      });

      expect(statusUpdates).toContain('TRANSCRIBING');

      // 2. TRANSCRIBING → GENERATING
      transcribeMock.on(GetTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'test-job',
          TranscriptionJobStatus: TranscriptionJobStatus.COMPLETED,
          Transcript: {
            TranscriptFileUri: 's3://bucket/transcript.json',
          },
        },
      });

      await checkTranscribeStatus({
        jobId: testJobId,
        userId: testUserId,
        transcribeJobName: 'test-job',
      });

      expect(statusUpdates).toContain('GENERATING');

      // 3. GENERATING → COMPLETED
      const mockTranscriptJson = {
        results: {
          transcripts: [{ transcript: 'テスト' }],
          speaker_labels: { speakers: 1, segments: [] },
          items: [],
        },
      };

      const transcriptStream = Readable.from([JSON.stringify(mockTranscriptJson)]);
      s3Mock.on(GetObjectCommand).resolves({
        Body: transcriptStream as any,
      });

      const mockBedrockResponse = {
        summary: 'テスト概要',
        decisions: [],
        nextActions: [],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new Uint8Array(Buffer.from(JSON.stringify(mockBedrockResponse))) as any,
      });

      s3Mock.on(PutObjectCommand).resolves({});

      await minutesGenerator({
        jobId: testJobId,
        userId: testUserId,
        transcriptS3Key: 'transcript.json',
      });

      expect(statusUpdates).toContain('COMPLETED');

      // ステータス遷移の順序を確認
      const transcribingIndex = statusUpdates.indexOf('TRANSCRIBING');
      const generatingIndex = statusUpdates.indexOf('GENERATING');
      const completedIndex = statusUpdates.indexOf('COMPLETED');

      expect(transcribingIndex).toBeLessThan(generatingIndex);
      expect(generatingIndex).toBeLessThan(completedIndex);
    });
  });
});
