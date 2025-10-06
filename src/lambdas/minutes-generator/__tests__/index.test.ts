/**
 * Minutes Generator Lambda unit tests
 */

import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { handler, MinutesGeneratorEvent, initializeDependencies } from '../index';
import { MeetingJobRepository } from '../../../repositories/meeting-job-repository';
import { BedrockClient } from '../../../utils/bedrock-client';
import { TranscriptParser } from '../../../utils/transcript-parser';

const s3Mock = mockClient(S3Client);

describe('Minutes Generator Lambda', () => {
  let mockRepository: Partial<MeetingJobRepository>;
  let mockBedrockClient: Partial<BedrockClient>;
  let mockTranscriptParser: Partial<TranscriptParser>;

  beforeEach(() => {
    s3Mock.reset();

    // 環境変数の設定
    process.env.TABLE_NAME = 'test-table';
    process.env.OUTPUT_BUCKET = 'test-output-bucket';
    process.env.INPUT_BUCKET = 'test-input-bucket';

    // モックインスタンスの作成
    mockRepository = {
      updateJobStatus: jest.fn().mockResolvedValue({}),
      updateJob: jest.fn().mockResolvedValue({}),
    };

    mockBedrockClient = {
      generateMinutes: jest.fn(),
    };

    mockTranscriptParser = {
      fetchTranscriptFromS3: jest.fn(),
      parseTranscript: jest.fn(),
      formatTranscript: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('議事録を正常に生成してS3に保存できる', async () => {
    const event: MinutesGeneratorEvent = {
      jobId: 'test-job-id',
      userId: 'test-user-id',
      transcriptS3Key: 'test-user-id/test-job-id/transcript.json',
    };

    const mockTranscribeOutput = {
      jobName: 'test-job',
      accountId: '123456789',
      status: 'COMPLETED',
      results: {
        transcripts: [{ transcript: 'こんにちは、テストです。' }],
        items: [
          {
            start_time: '0.0',
            end_time: '10.0',
            alternatives: [{ confidence: '0.99', content: 'こんにちは' }],
            type: 'pronunciation' as const,
          },
        ],
      },
    };

    const mockParsedTranscript = {
      fullText: 'こんにちは、テストです。',
      duration: 10,
      speakerCount: 1,
      segments: [
        {
          speakerId: 'spk_0',
          startTime: 0,
          endTime: 10,
          text: 'こんにちは、テストです。',
          confidence: 0.99,
        },
      ],
    };

    const mockMinutes = {
      jobId: 'test-job-id',
      generatedAt: new Date().toISOString(),
      summary: 'テスト会議の概要',
      decisions: [
        {
          id: 'decision-1',
          description: 'テスト決定事項',
          timestamp: '[00:00:05]',
        },
      ],
      nextActions: [
        {
          id: 'action-1',
          description: 'テストアクション',
          assignee: 'テスト担当者',
          dueDate: '2025-10-13',
          timestamp: '[00:00:08]',
        },
      ],
      transcript: 'こんにちは、テストです。',
      speakers: [
        {
          id: 'spk_0',
          segments: 1,
        },
      ],
    };

    // TranscriptParserのモック
    (mockTranscriptParser.fetchTranscriptFromS3 as jest.Mock).mockResolvedValue(
      mockTranscribeOutput
    );
    (mockTranscriptParser.parseTranscript as jest.Mock).mockReturnValue(mockParsedTranscript);
    (mockTranscriptParser.formatTranscript as jest.Mock).mockReturnValue(
      '[00:00:00 - 00:00:10] spk_0:\nこんにちは、テストです。\n\n'
    );

    // BedrockClientのモック
    (mockBedrockClient.generateMinutes as jest.Mock).mockResolvedValue(mockMinutes);

    // S3 PutObjectのモック
    s3Mock.on(PutObjectCommand).resolves({});

    // 依存性を注入
    initializeDependencies(
      new S3Client({}),
      mockTranscriptParser as TranscriptParser,
      mockBedrockClient as BedrockClient,
      mockRepository as MeetingJobRepository
    );

    const result = await handler(event);

    // 結果の検証
    expect(result.jobId).toBe('test-job-id');
    expect(result.status).toBe('COMPLETED');
    expect(result.minutesS3Key).toBe('test-user-id/test-job-id/minutes.md');

    // ステータス更新の検証
    expect(mockRepository.updateJobStatus).toHaveBeenCalledWith(
      'test-job-id',
      'test-user-id',
      'GENERATING'
    );

    expect(mockRepository.updateJob).toHaveBeenCalledWith({
      jobId: 'test-job-id',
      userId: 'test-user-id',
      status: 'COMPLETED',
      minutesS3Key: 'test-user-id/test-job-id/minutes.md',
      videoDuration: 10,
    });

    // S3への保存の検証
    expect(s3Mock.calls()).toHaveLength(2); // minutes.md と transcript.txt
  });

  it('エラーが発生した場合はステータスをFAILEDに更新する', async () => {
    const event: MinutesGeneratorEvent = {
      jobId: 'test-job-id',
      userId: 'test-user-id',
      transcriptS3Key: 'test-user-id/test-job-id/transcript.json',
    };

    // TranscriptParserがエラーをスローするようにモック
    (mockTranscriptParser.fetchTranscriptFromS3 as jest.Mock).mockRejectedValue(
      new Error('S3取得エラー')
    );

    // 依存性を注入
    initializeDependencies(
      new S3Client({}),
      mockTranscriptParser as TranscriptParser,
      mockBedrockClient as BedrockClient,
      mockRepository as MeetingJobRepository
    );

    await expect(handler(event)).rejects.toThrow('S3取得エラー');

    // FAILEDステータスへの更新を検証
    expect(mockRepository.updateJobStatus).toHaveBeenCalledWith(
      'test-job-id',
      'test-user-id',
      'FAILED',
      expect.stringContaining('S3取得エラー')
    );
  });
});
