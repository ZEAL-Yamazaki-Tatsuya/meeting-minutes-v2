/**
 * Transcribe Trigger Lambda のユニットテスト
 */

// 環境変数を最初に設定（モジュールインポート前）
process.env.INPUT_BUCKET_NAME = 'test-input-bucket';
process.env.OUTPUT_BUCKET_NAME = 'test-output-bucket';
process.env.JOBS_TABLE_NAME = 'test-jobs-table';
process.env.AWS_REGION = 'ap-northeast-1';

import { handler } from '../index';
import { TranscribeClient, StartTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
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

describe('Transcribe Trigger Lambda', () => {
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
      status: 'TRANSCRIBING',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('正常系', () => {
    it('Transcribeジョブを正常に開始できる', async () => {
      // Transcribe API のモック
      transcribeMock.on(StartTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'meeting-minutes-test-job-id-123456789',
          TranscriptionJobStatus: 'IN_PROGRESS',
        },
      });

      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        videoS3Key: 'test-user-id/test-video.mp4',
      };

      const result = await handler(input);

      // 結果の検証
      expect(result).toEqual({
        jobId: 'test-job-id',
        userId: 'test-user-id',
        transcribeJobName: expect.stringContaining('meeting-minutes-test-job-id'),
        status: 'IN_PROGRESS',
      });

      // Transcribe API が呼ばれたことを確認
      const calls = transcribeMock.commandCalls(StartTranscriptionJobCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input).toMatchObject({
        LanguageCode: 'ja-JP',
        MediaFormat: 'mp4',
        Media: {
          MediaFileUri: 's3://test-input-bucket/test-user-id/test-video.mp4',
        },
        OutputBucketName: 'test-output-bucket',
        OutputKey: 'test-user-id/test-job-id/transcript.json',
        Settings: {
          ShowSpeakerLabels: true,
          MaxSpeakerLabels: 10,
        },
      });

      // DynamoDB が更新されたことを確認
      expect(mockUpdateJobFn).toHaveBeenCalledWith({
        jobId: 'test-job-id',
        userId: 'test-user-id',
        status: 'TRANSCRIBING',
        transcribeJobName: expect.stringContaining('meeting-minutes-test-job-id'),
      });
    });

    it('カスタム言語コードと話者数を指定できる', async () => {
      transcribeMock.on(StartTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'meeting-minutes-test-job-id-123456789',
          TranscriptionJobStatus: 'IN_PROGRESS',
        },
      });

      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        videoS3Key: 'test-user-id/test-video.mp4',
        languageCode: 'en-US',
        maxSpeakerLabels: 5,
      };

      await handler(input);

      // カスタムパラメータが使用されたことを確認
      const calls = transcribeMock.commandCalls(StartTranscriptionJobCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input).toMatchObject({
        LanguageCode: 'en-US',
        Settings: {
          ShowSpeakerLabels: true,
          MaxSpeakerLabels: 5,
        },
      });
    });
  });

  describe('異常系', () => {
    it('jobIdが指定されていない場合はエラーを返す', async () => {
      const input = {
        jobId: '',
        userId: 'test-user-id',
        videoS3Key: 'test-user-id/test-video.mp4',
      };

      await expect(handler(input)).rejects.toThrow('jobIdが必要です');
    });

    it('userIdが指定されていない場合はエラーを返す', async () => {
      const input = {
        jobId: 'test-job-id',
        userId: '',
        videoS3Key: 'test-user-id/test-video.mp4',
      };

      await expect(handler(input)).rejects.toThrow('userIdが必要です');
    });

    it('videoS3Keyが指定されていない場合はエラーを返す', async () => {
      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        videoS3Key: '',
      };

      await expect(handler(input)).rejects.toThrow('videoS3Keyが必要です');
    });

    it('Transcribe APIがエラーを返した場合、ジョブステータスをFAILEDに更新する', async () => {
      // Transcribe API がエラーを返すようにモック
      transcribeMock.on(StartTranscriptionJobCommand).rejects(new Error('Transcribe API エラー'));

      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        videoS3Key: 'test-user-id/test-video.mp4',
      };

      await expect(handler(input)).rejects.toThrow('Transcribeジョブの開始に失敗しました');

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
  });

  describe('エッジケース', () => {
    it('Transcribeジョブ名が正しい形式で生成される', async () => {
      transcribeMock.on(StartTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'meeting-minutes-test-job-id-123456789',
          TranscriptionJobStatus: 'IN_PROGRESS',
        },
      });

      const input = {
        jobId: 'test-job-id-with-special-chars',
        userId: 'test-user-id',
        videoS3Key: 'test-user-id/test-video.mp4',
      };

      const result = await handler(input);

      // ジョブ名が英数字とハイフンのみで構成されていることを確認
      expect(result.transcribeJobName).toMatch(/^meeting-minutes-[a-zA-Z0-9-]+$/);
    });

    it('S3 URIが正しく生成される', async () => {
      transcribeMock.on(StartTranscriptionJobCommand).resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'meeting-minutes-test-job-id-123456789',
          TranscriptionJobStatus: 'IN_PROGRESS',
        },
      });

      const input = {
        jobId: 'test-job-id',
        userId: 'test-user-id',
        videoS3Key: 'test-user-id/subfolder/test-video.mp4',
      };

      await handler(input);

      // S3 URI が正しい形式で生成されたことを確認
      const calls = transcribeMock.commandCalls(StartTranscriptionJobCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input.Media?.MediaFileUri).toBe(
        's3://test-input-bucket/test-user-id/subfolder/test-video.mp4'
      );
    });
  });
});
