/**
 * Amazon Bedrock client for generating meeting minutes
 * LLMを使用して議事録を生成する
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { Minutes, LLMMinutesResponse } from '../models/minutes';
import { ParsedTranscript } from '../models/transcript';
import { Logger } from './logger';
import { InternalServerError, ServiceUnavailableError } from './errors';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger({ module: 'bedrock-client' });

export interface BedrockClientConfig {
  modelId?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export class BedrockClient {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: BedrockClientConfig = {}) {
    this.client = new BedrockRuntimeClient({});
    this.modelId = config.modelId || 'anthropic.claude-3-sonnet-20240229-v1:0';
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * 議事録を生成する
   */
  async generateMinutes(
    jobId: string,
    parsedTranscript: ParsedTranscript
  ): Promise<Minutes> {
    try {
      logger.info('議事録生成を開始', {
        jobId,
        transcriptLength: parsedTranscript.fullText.length,
        speakerCount: parsedTranscript.speakerCount,
      });

      // プロンプトを構築
      const prompt = this.buildPrompt(parsedTranscript);

      // LLMを呼び出し（リトライロジック付き）
      const llmResponse = await this.invokeModelWithRetry(prompt);

      // レスポンスをパースしてMinutesオブジェクトに変換
      const minutes = this.parseResponse(jobId, llmResponse, parsedTranscript);

      logger.info('議事録生成に成功', {
        jobId,
        decisionsCount: minutes.decisions.length,
        nextActionsCount: minutes.nextActions.length,
      });

      return minutes;
    } catch (error) {
      logger.error('議事録生成に失敗', error as Error, { jobId });
      throw error;
    }
  }

  /**
   * プロンプトテンプレートを構築する
   */
  private buildPrompt(parsedTranscript: ParsedTranscript): string {
    // 話者情報付きのテキストを構築
    let transcriptText = '';

    if (parsedTranscript.segments.length > 0) {
      for (const segment of parsedTranscript.segments) {
        const startTime = this.formatTime(segment.startTime);
        transcriptText += `[${startTime}] ${segment.speakerId}: ${segment.text}\n\n`;
      }
    } else {
      transcriptText = parsedTranscript.fullText;
    }

    const prompt = `以下は会議の文字起こしテキストです。このテキストを分析して、構造化された議事録を生成してください。

# 文字起こしテキスト

${transcriptText}

# 指示

上記の会議内容から、以下の形式で議事録を生成してください：

1. **概要（summary）**: 会議の主要なトピックと目的を2-3文で簡潔にまとめてください。

2. **決定事項（decisions）**: 会議中に決定された事項をリストアップしてください。各決定事項には以下を含めてください：
   - description: 決定内容の説明
   - timestamp: 該当する発言のタイムスタンプ（可能な場合）

3. **ネクストアクション（nextActions）**: 今後のアクションアイテムをリストアップしてください。各アクションには以下を含めてください：
   - description: アクションの説明
   - assignee: 担当者（明示されている場合）
   - dueDate: 期限（明示されている場合、YYYY-MM-DD形式）
   - timestamp: 該当する発言のタイムスタンプ（可能な場合）

# 出力形式

以下のJSON形式で出力してください：

\`\`\`json
{
  "summary": "会議の概要をここに記述",
  "decisions": [
    {
      "description": "決定事項の説明",
      "timestamp": "[HH:MM:SS]"
    }
  ],
  "nextActions": [
    {
      "description": "アクションの説明",
      "assignee": "担当者名",
      "dueDate": "YYYY-MM-DD",
      "timestamp": "[HH:MM:SS]"
    }
  ]
}
\`\`\`

重要な注意事項：
- 決定事項やアクションアイテムが明確でない場合は、空の配列を返してください
- 担当者や期限が明示されていない場合は、そのフィールドを省略してください
- タイムスタンプは [HH:MM:SS] 形式で記述してください
- JSON形式のみを出力し、他の説明文は含めないでください`;

    return prompt;
  }

  /**
   * LLMを呼び出す（リトライロジック付き）
   */
  private async invokeModelWithRetry(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info('LLM呼び出しを試行', { attempt, maxRetries: this.maxRetries });

        const response = await this.invokeModel(prompt);

        logger.info('LLM呼び出しに成功', { attempt });
        return response;
      } catch (error) {
        lastError = error as Error;
        logger.warn('LLM呼び出しに失敗', {
          attempt,
          maxRetries: this.maxRetries,
          error: lastError.message,
        });

        if (attempt < this.maxRetries) {
          // 指数バックオフで待機
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          logger.info('リトライ前に待機', { delay });
          await this.sleep(delay);
        }
      }
    }

    throw new ServiceUnavailableError(
      `LLM呼び出しが${this.maxRetries}回失敗しました: ${lastError?.message}`
    );
  }

  /**
   * LLMを呼び出す
   */
  private async invokeModel(prompt: string): Promise<string> {
    try {
      // Claude 3のリクエスト形式
      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // 一貫性のある出力のため低めに設定
      };

      const input: InvokeModelCommandInput = {
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      };

      const command = new InvokeModelCommand(input);
      const response = await this.client.send(command);

      if (!response.body) {
        throw new InternalServerError('Bedrockからのレスポンスが空です');
      }

      // レスポンスをパース
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (!responseBody.content || responseBody.content.length === 0) {
        throw new InternalServerError('Bedrockレスポンスにcontentが含まれていません');
      }

      return responseBody.content[0].text;
    } catch (error) {
      if (error instanceof InternalServerError) {
        throw error;
      }
      throw new InternalServerError(`Bedrock呼び出しエラー: ${(error as Error).message}`);
    }
  }

  /**
   * LLMレスポンスをパースしてMinutesオブジェクトに変換する
   */
  private parseResponse(
    jobId: string,
    llmResponse: string,
    parsedTranscript: ParsedTranscript
  ): Minutes {
    try {
      // JSON部分を抽出（マークダウンのコードブロックに囲まれている可能性がある）
      let jsonText = llmResponse.trim();

      // ```json ... ``` の形式の場合は中身を抽出
      const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      } else {
        // ``` ... ``` の形式の場合も対応
        const codeBlockMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1];
        }
      }

      const llmMinutes: LLMMinutesResponse = JSON.parse(jsonText);

      // Minutesオブジェクトに変換
      const minutes: Minutes = {
        jobId,
        generatedAt: new Date().toISOString(),
        summary: llmMinutes.summary || '',
        decisions: llmMinutes.decisions.map((d) => ({
          id: uuidv4(),
          description: d.description,
          timestamp: d.timestamp,
        })),
        nextActions: llmMinutes.nextActions.map((a) => ({
          id: uuidv4(),
          description: a.description,
          assignee: a.assignee,
          dueDate: a.dueDate,
          timestamp: a.timestamp,
        })),
        transcript: parsedTranscript.fullText,
        speakers: parsedTranscript.segments.map((s) => ({
          id: s.speakerId,
          segments: 1,
        })),
      };

      return minutes;
    } catch (error) {
      logger.error('LLMレスポンスのパースに失敗', error as Error, {
        response: llmResponse.substring(0, 500),
      });
      throw new InternalServerError(
        `LLMレスポンスのパースに失敗しました: ${(error as Error).message}`
      );
    }
  }

  /**
   * 秒数を HH:MM:SS 形式に変換する
   */
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * 指定されたミリ秒待機する
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
