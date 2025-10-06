/**
 * Check Transcribe Status Lambda のユニットテスト
 */

// 環境変数を最初に設定（モジュールインポート前）
process.env.JOBS_TABLE_NAME = 'test-jobs-table';
process.env.OUTPUT_BUCKET_NAME = 'test-output-bucket';
process.env.AWS_REGION = 'ap-northeast-1';

import { handler } from '../index';
import {
  TranscribeClient,
  GetTranscriptionJobCommand,
  TranscriptionJobStatus,
} from '@aws-sdk/client-transcribe';
import { mockClient } from 'aws-sdk-client-mock';
const repositoryModule = require('../../../repositories/meeting-job-repository');

// AWS SDK のモック
const transcribeMock = mockClient(TranscribeClient);

// MeetingJobRepository のモック
const mockUpdateJob = jest.fn();
jest.mock('../../../repositories/meeting-job-repository', () => {
  const mockUpdateJobFn = jest.fn();
  return {
    MeetingJobRepository: jest.fn().mockImplementation(() => {
      return {
        updateJob: mockUpdateJobFn,
      };
    }),
    __mockUpdateJob: mockUpdateJobFn,
  };
});

describe('Check Transcribe Status Lambda', () => {
  const mockUpdateJobFn = repositoryModule.__mockUpdateJob;

  beforeEach(() => {
    // モックをリセット
    transcribeMock.reset();
    jest.clearAllMocks();
    mockUpdateJobFn.mockClear();

    // リポジトリのモック実装
    mockUpdateJobFn.mockResolvedValue({
      jobId: 'test-job-id',
      userId: 'test-user-id',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('正常系 - COMPLETED', () => {
    it('Transcribeジョブが完了している場合、正しく処理される', async () => {
      // Transcribe API のモック（完了状態）
      transcribeMock.on(GetTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'meeting-minutes-test-job-id-123456789',
          TranscriptionJobStatus: TranscriptionJobStatus.COMPLETED,
          Transcript: {
            TranscriptFileUri: 's3://test-output-bucket/test-user-id/test-job-id/transcript.json',
          },
        },
      });

      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
      };

      const result = await handler(input);

      // 結果の検証
      expect(result).toEqual({
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
        status: 'COMPLETED',
        isComplete: true,
        transcriptS3Key: 'test-user-id/test-job-id/transcript.json',
      });

      // Transcribe API が呼ばれたことを確認
      const calls = transcribeMock.commandCalls(GetTranscriptionJobCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input).toMatchObject({
        TranscriptionJobName: 'meeting-minutes-test-job-id-123456789',
      });

      // DynamoDB が更新されたことを確認
      expect(mockUpdateJobFn).toHaveBeenCalledWith({
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcriptS3Key: 'test-user-id/test-job-id/transcript.json',
      });
    });
  });

  describe('正常系 - IN_PROGRESS', () => {
    it('Transcribeジョブが進行中の場合、待機が必要と返す', async () => {
      // Transcribe API のモック（進行中）
      transcribeMock.on(GetTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'meeting-minutes-test-job-id-123456789',
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
      };

      const result = await handler(input);

      // 結果の検証
      expect(result).toEqual({
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
        status: 'IN_PROGRESS',
        isComplete: false,
      });

      // DynamoDB は更新されないことを確認
      expect(mockUpdateJobFn).not.toHaveBeenCalled();
    });

    it('Transcribeジョブがキューに入っている場合、待機が必要と返す', async () => {
      // Transcribe API のモック（キュー中）
      transcribeMock.on(GetTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'meeting-minutes-test-job-id-123456789',
          TranscriptionJobStatus: TranscriptionJobStatus.QUEUED,
        },
      });

      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
      };

      const result = await handler(input);

      // 結果の検証
      expect(result).toEqual({
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
        status: 'QUEUED',
        isComplete: false,
      });
    });
  });

  describe('正常系 - FAILED', () => {
    it('Transcribeジョブが失敗した場合、エラー情報を記録する', async () => {
      // Transcribe API のモック（失敗状態）
      transcribeMock.on(GetTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'meeting-minutes-test-job-id-123456789',
          TranscriptionJobStatus: TranscriptionJobStatus.FAILED,
          FailureReason: 'Invalid media format',
        },
      });

      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
      };

      const result = await handler(input);

      // 結果の検証
      expect(result).toEqual({
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
        status: 'FAILED',
        isComplete: true,
        errorMessage: 'Invalid media format',
      });

      // DynamoDB がFAILEDステータスで更新されたことを確認
      expect(mockUpdateJobFn).toHaveBeenCalledWith({
        jobId: 'test-job-id',
        userId: 'test-user-id',
        status: 'FAILED',
        errorMessage: 'Transcribeジョブが失敗しました: Invalid media format',
      });
    });

    it('失敗理由が不明な場合、デフォルトメッセージを使用する', async () => {
      // Transcribe API のモック（失敗状態、理由なし）
      transcribeMock.on(GetTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'meeting-minutes-test-job-id-123456789',
          TranscriptionJobStatus: TranscriptionJobStatus.FAILED,
        },
      });

      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
      };

      const result = await handler(input);

      // デフォルトエラーメッセージが使用されることを確認
      expect(result.errorMessage).toBe('不明なエラー');
      expect(mockUpdateJobFn).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Transcribeジョブが失敗しました: 不明なエラー',
        })
      );
    });
  });

  describe('異常系', () => {
    it('jobIdが指定されていない場合はエラーを返す', async () => {
      const input = {
        jobId: '',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
      };

      await expect(handler(input)).rejects.toThrow('jobIdが必要です');
    });

    it('userIdが指定されていない場合はエラーを返す', async () => {
      const input = {
        jobId: 'test-job-id',
        userId: '',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
      };

      await expect(handler(input)).rejects.toThrow('userIdが必要です');
    });

    it('transcribeJobNameが指定されていない場合はエラーを返す', async () => {
      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: '',
      };

      await expect(handler(input)).rejects.toThrow('transcribeJobNameが必要です');
    });

    it('Transcribe APIがエラーを返した場合、ジョブステータスをFAILEDに更新する', async () => {
      // Transcribe API がエラーを返すようにモック
      transcribeMock
        .on(GetTranscriptionJobCommand)
        .rejects(new Error('Transcribe API エラー'));

      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
      };

      await expect(handler(input)).rejects.toThrow('Transcribeステータスの確認に失敗しました');

      // ステータスがFAILEDに更新されたことを確認
      expect(mockUpdateJobFn).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'test-job-id',
          userId: 'test-user-id',
          status: 'FAILED',
          errorMessage: expect.stringContaining('Transcribe API エラー'),
        })
      );
    });

    it('Transcribeジョブが見つからない場合はエラーを返す', async () => {
      // Transcribe API が空のレスポンスを返すようにモック
      transcribeMock.on(GetTranscriptionJobCommand).resolves({});

      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
      };

      await expect(handler(input)).rejects.toThrow('Transcribeジョブが見つかりません');
    });

    it('完了したジョブに文字起こし結果URIがない場合はエラーを返す', async () => {
      // Transcribe API のモック（完了状態だがURIなし）
      transcribeMock.on(GetTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'meeting-minutes-test-job-id-123456789',
          TranscriptionJobStatus: TranscriptionJobStatus.COMPLETED,
          Transcript: {},
        },
      });

      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: 'meeting-minutes-test-job-id-123456789',
      };

      await expect(handler(input)).rejects.toThrow('文字起こし結果のURIが見つかりません');
    });
  });
});
