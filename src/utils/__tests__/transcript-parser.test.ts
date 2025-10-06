/**
 * TranscriptParser unit tests
 */

import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { TranscriptParser } from '../transcript-parser';
import { TranscribeOutput } from '../../models/transcript';
import { Readable } from 'stream';

const s3Mock = mockClient(S3Client);

describe('TranscriptParser', () => {
  let parser: TranscriptParser;

  beforeEach(() => {
    s3Mock.reset();
    parser = new TranscriptParser(new S3Client({}));
  });

  describe('fetchTranscriptFromS3', () => {
    it('S3からTranscript JSONを正常に取得できる', async () => {
      const mockTranscribeOutput: TranscribeOutput = {
        jobName: 'test-job',
        accountId: '123456789',
        status: 'COMPLETED',
        results: {
          transcripts: [{ transcript: 'こんにちは、テストです。' }],
          items: [
            {
              start_time: '0.0',
              end_time: '1.0',
              alternatives: [{ confidence: '0.99', content: 'こんにちは' }],
              type: 'pronunciation',
            },
          ],
        },
      };

      const mockBody = {
        transformToString: jest.fn().mockResolvedValue(JSON.stringify(mockTranscribeOutput)),
      };

      s3Mock.on(GetObjectCommand).resolves({
        Body: mockBody as any,
      });

      const result = await parser.fetchTranscriptFromS3('test-bucket', 'test-key');

      expect(result).toEqual(mockTranscribeOutput);
      expect(result.jobName).toBe('test-job');
    });

    it('S3オブジェクトが空の場合はエラーをスローする', async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: undefined,
      });

      await expect(
        parser.fetchTranscriptFromS3('test-bucket', 'test-key')
      ).rejects.toThrow('S3オブジェクトが空です');
    });
  });

  describe('parseTranscript', () => {
    it('話者識別なしのTranscriptを正常に解析できる', () => {
      const transcribeOutput: TranscribeOutput = {
        jobName: 'test-job',
        accountId: '123456789',
        status: 'COMPLETED',
        results: {
          transcripts: [{ transcript: 'こんにちは、テストです。' }],
          items: [
            {
              start_time: '0.0',
              end_time: '1.0',
              alternatives: [{ confidence: '0.99', content: 'こんにちは' }],
              type: 'pronunciation',
            },
            {
              alternatives: [{ confidence: '0', content: '、' }],
              type: 'punctuation',
            },
            {
              start_time: '1.0',
              end_time: '2.0',
              alternatives: [{ confidence: '0.98', content: 'テストです' }],
              type: 'pronunciation',
            },
            {
              alternatives: [{ confidence: '0', content: '。' }],
              type: 'punctuation',
            },
          ],
        },
      };

      const result = parser.parseTranscript(transcribeOutput);

      expect(result.fullText).toBe('こんにちは、テストです。');
      expect(result.duration).toBe(2.0);
      expect(result.speakerCount).toBe(1);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].speakerId).toBe('spk_0');
    });

    it('話者識別ありのTranscriptを正常に解析できる', () => {
      const transcribeOutput: TranscribeOutput = {
        jobName: 'test-job',
        accountId: '123456789',
        status: 'COMPLETED',
        results: {
          transcripts: [{ transcript: 'こんにちは。 はい、よろしくお願いします。' }],
          items: [
            {
              start_time: '0.0',
              end_time: '1.0',
              alternatives: [{ confidence: '0.99', content: 'こんにちは' }],
              type: 'pronunciation',
              speaker_label: 'spk_0',
            },
            {
              alternatives: [{ confidence: '0', content: '。' }],
              type: 'punctuation',
            },
            {
              start_time: '2.0',
              end_time: '2.5',
              alternatives: [{ confidence: '0.98', content: 'はい' }],
              type: 'pronunciation',
              speaker_label: 'spk_1',
            },
            {
              alternatives: [{ confidence: '0', content: '、' }],
              type: 'punctuation',
            },
            {
              start_time: '2.5',
              end_time: '4.0',
              alternatives: [{ confidence: '0.97', content: 'よろしくお願いします' }],
              type: 'pronunciation',
              speaker_label: 'spk_1',
            },
            {
              alternatives: [{ confidence: '0', content: '。' }],
              type: 'punctuation',
            },
          ],
          speaker_labels: {
            speakers: 2,
            segments: [
              {
                start_time: '0.0',
                end_time: '1.0',
                speaker_label: 'spk_0',
                items: [
                  {
                    start_time: '0.0',
                    end_time: '1.0',
                    speaker_label: 'spk_0',
                  },
                ],
              },
              {
                start_time: '2.0',
                end_time: '4.0',
                speaker_label: 'spk_1',
                items: [
                  {
                    start_time: '2.0',
                    end_time: '2.5',
                    speaker_label: 'spk_1',
                  },
                  {
                    start_time: '2.5',
                    end_time: '4.0',
                    speaker_label: 'spk_1',
                  },
                ],
              },
            ],
          },
        },
      };

      const result = parser.parseTranscript(transcribeOutput);

      expect(result.fullText).toBe('こんにちは。 はい、よろしくお願いします。');
      expect(result.duration).toBe(4.0);
      expect(result.speakerCount).toBe(2);
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].speakerId).toBe('spk_0');
      expect(result.segments[1].speakerId).toBe('spk_1');
    });

    it('空のTranscript結果の場合はエラーをスローする', () => {
      const transcribeOutput: TranscribeOutput = {
        jobName: 'test-job',
        accountId: '123456789',
        status: 'COMPLETED',
        results: {
          transcripts: [],
          items: [],
        },
      };

      expect(() => parser.parseTranscript(transcribeOutput)).toThrow('Transcript結果が空です');
    });
  });

  describe('formatTranscript', () => {
    it('整形されたテキストを生成できる', () => {
      const parsed = {
        fullText: 'こんにちは。 はい、よろしくお願いします。',
        duration: 4.0,
        speakerCount: 2,
        segments: [
          {
            speakerId: 'spk_0',
            startTime: 0.0,
            endTime: 1.0,
            text: 'こんにちは。',
            confidence: 0.99,
          },
          {
            speakerId: 'spk_1',
            startTime: 2.0,
            endTime: 4.0,
            text: 'はい、よろしくお願いします。',
            confidence: 0.975,
          },
        ],
      };

      const result = parser.formatTranscript(parsed);

      expect(result).toContain('[00:00:00 - 00:00:01] spk_0:');
      expect(result).toContain('こんにちは。');
      expect(result).toContain('[00:00:02 - 00:00:04] spk_1:');
      expect(result).toContain('はい、よろしくお願いします。');
    });

    it('時間フォーマットが正しい', () => {
      const parsed = {
        fullText: 'テスト',
        duration: 3665.5, // 1時間1分5秒
        speakerCount: 1,
        segments: [
          {
            speakerId: 'spk_0',
            startTime: 3600.0, // 1時間
            endTime: 3665.0, // 1時間1分5秒
            text: 'テスト',
            confidence: 0.99,
          },
        ],
      };

      const result = parser.formatTranscript(parsed);

      expect(result).toContain('[01:00:00 - 01:01:05]');
    });
  });
});
