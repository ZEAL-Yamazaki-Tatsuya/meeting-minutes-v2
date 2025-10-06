/**
 * BedrockClient unit tests
 */

import { mockClient } from 'aws-sdk-client-mock';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { BedrockClient } from '../bedrock-client';
import { ParsedTranscript } from '../../models/transcript';

const bedrockMock = mockClient(BedrockRuntimeClient);

// ヘルパー関数: モックレスポンスボディを作成
function createMockBody(responseBody: any): any {
  return new TextEncoder().encode(JSON.stringify(responseBody)) as any;
}

describe('BedrockClient', () => {
  let client: BedrockClient;

  beforeEach(() => {
    bedrockMock.reset();
    client = new BedrockClient({
      maxRetries: 2,
      retryDelay: 100,
    });
  });

  describe('generateMinutes', () => {
    it('議事録を正常に生成できる', async () => {
      const parsedTranscript: ParsedTranscript = {
        fullText: 'こんにちは。今日のプロジェクトについて話し合いましょう。',
        duration: 120,
        speakerCount: 2,
        segments: [
          {
            speakerId: 'spk_0',
            startTime: 0,
            endTime: 60,
            text: 'こんにちは。今日のプロジェクトについて話し合いましょう。',
            confidence: 0.99,
          },
          {
            speakerId: 'spk_1',
            startTime: 60,
            endTime: 120,
            text: 'はい、よろしくお願いします。来週までにデザインを完成させます。',
            confidence: 0.98,
          },
        ],
      };

      const mockLLMResponse = {
        summary: 'プロジェクトの進捗について話し合いました。',
        decisions: [
          {
            description: 'デザインを来週までに完成させることを決定',
            timestamp: '[00:01:00]',
          },
        ],
        nextActions: [
          {
            description: 'デザインを完成させる',
            assignee: 'spk_1',
            dueDate: '2025-10-13',
            timestamp: '[00:01:00]',
          },
        ],
      };

      const mockResponseBody = {
        content: [
          {
            text: JSON.stringify(mockLLMResponse),
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: createMockBody(mockResponseBody),
      });

      const result = await client.generateMinutes('test-job-id', parsedTranscript);

      expect(result.jobId).toBe('test-job-id');
      expect(result.summary).toBe('プロジェクトの進捗について話し合いました。');
      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0].description).toBe('デザインを来週までに完成させることを決定');
      expect(result.nextActions).toHaveLength(1);
      expect(result.nextActions[0].description).toBe('デザインを完成させる');
      expect(result.nextActions[0].assignee).toBe('spk_1');
      expect(result.transcript).toBe(parsedTranscript.fullText);
    });

    it('マークダウンコードブロックで囲まれたJSONを正常にパースできる', async () => {
      const parsedTranscript: ParsedTranscript = {
        fullText: 'テスト',
        duration: 10,
        speakerCount: 1,
        segments: [
          {
            speakerId: 'spk_0',
            startTime: 0,
            endTime: 10,
            text: 'テスト',
            confidence: 0.99,
          },
        ],
      };

      const mockLLMResponse = {
        summary: 'テスト会議',
        decisions: [],
        nextActions: [],
      };

      const mockResponseBody = {
        content: [
          {
            text: '```json\n' + JSON.stringify(mockLLMResponse, null, 2) + '\n```',
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: createMockBody(mockResponseBody),
      });

      const result = await client.generateMinutes('test-job-id', parsedTranscript);

      expect(result.summary).toBe('テスト会議');
      expect(result.decisions).toHaveLength(0);
      expect(result.nextActions).toHaveLength(0);
    });

    it('リトライロジックが正常に動作する', async () => {
      const parsedTranscript: ParsedTranscript = {
        fullText: 'テスト',
        duration: 10,
        speakerCount: 1,
        segments: [],
      };

      const mockLLMResponse = {
        summary: 'テスト会議',
        decisions: [],
        nextActions: [],
      };

      const mockResponseBody = {
        content: [
          {
            text: JSON.stringify(mockLLMResponse),
          },
        ],
      };

      // 最初の呼び出しは失敗、2回目は成功
      bedrockMock
        .on(InvokeModelCommand)
        .rejectsOnce(new Error('一時的なエラー'))
        .resolvesOnce({
          body: createMockBody(mockResponseBody),
        });

      const result = await client.generateMinutes('test-job-id', parsedTranscript);

      expect(result.summary).toBe('テスト会議');
      expect(bedrockMock.calls()).toHaveLength(2);
    });

    it('最大リトライ回数を超えた場合はエラーをスローする', async () => {
      const parsedTranscript: ParsedTranscript = {
        fullText: 'テスト',
        duration: 10,
        speakerCount: 1,
        segments: [],
      };

      bedrockMock.on(InvokeModelCommand).rejects(new Error('永続的なエラー'));

      await expect(
        client.generateMinutes('test-job-id', parsedTranscript)
      ).rejects.toThrow('LLM呼び出しが2回失敗しました');

      expect(bedrockMock.calls()).toHaveLength(2);
    });

    it('Bedrockレスポンスが空の場合はエラーをスローする', async () => {
      const parsedTranscript: ParsedTranscript = {
        fullText: 'テスト',
        duration: 10,
        speakerCount: 1,
        segments: [],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: undefined,
      });

      await expect(
        client.generateMinutes('test-job-id', parsedTranscript)
      ).rejects.toThrow('Bedrockからのレスポンスが空です');
    });

    it('無効なJSONレスポンスの場合はエラーをスローする', async () => {
      const parsedTranscript: ParsedTranscript = {
        fullText: 'テスト',
        duration: 10,
        speakerCount: 1,
        segments: [],
      };

      const mockResponseBody = {
        content: [
          {
            text: '無効なJSON',
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: createMockBody(mockResponseBody),
      });

      await expect(
        client.generateMinutes('test-job-id', parsedTranscript)
      ).rejects.toThrow('LLMレスポンスのパースに失敗しました');
    });
  });
});
