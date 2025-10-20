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

export interface MeetingContext {
  meetingType?: string; // 会議の種類（例：定例会議、プロジェクト会議、ブレスト等）
  attendees?: string[]; // 出席者リスト
  focusAreas?: string[]; // 重点的に整理したい項目（例：決定事項、アクション、課題等）
  additionalInstructions?: string; // 追加の指示
}

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
    // Claude 3.5 Sonnet v2を使用（より高精度なモデル）
    this.modelId = config.modelId || process.env.BEDROCK_MODEL_ID || 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0';
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * 議事録を生成する
   */
  async generateMinutes(
    jobId: string,
    parsedTranscript: ParsedTranscript,
    meetingContext?: MeetingContext
  ): Promise<Minutes> {
    try {
      logger.info('議事録生成を開始', {
        jobId,
        transcriptLength: parsedTranscript.fullText.length,
        speakerCount: parsedTranscript.speakerCount,
        meetingContext,
      });

      // プロンプトを構築（会議コンテキストを含む）
      const prompt = this.buildPrompt(parsedTranscript, meetingContext);

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
  private buildPrompt(parsedTranscript: ParsedTranscript, meetingContext?: MeetingContext): string {
    // 話者情報付きのテキストを構築
    let transcriptText = '';

    if (parsedTranscript.segments.length > 0) {
      for (const segment of parsedTranscript.segments) {
        const startTime = this.formatTime(segment.startTime);
        // 「???」を除去してクリーンなテキストにする
        const cleanText = segment.text.replace(/\?+/g, '').trim();
        // 空のテキストはスキップ
        if (cleanText) {
          transcriptText += `[${startTime}] ${segment.speakerId}: ${cleanText}\n\n`;
        }
      }
    } else {
      // fullTextからも「???」を除去
      transcriptText = parsedTranscript.fullText.replace(/\?+/g, '').trim();
    }

    // 会議コンテキスト情報を構築
    let contextSection = '';
    if (meetingContext) {
      contextSection = '\n# 会議情報\n\n';

      if (meetingContext.meetingType) {
        contextSection += `- **会議の種類**: ${meetingContext.meetingType}\n`;
      }

      if (meetingContext.attendees && meetingContext.attendees.length > 0) {
        contextSection += `- **出席者**: ${meetingContext.attendees.join('、')}\n`;
      }

      if (meetingContext.focusAreas && meetingContext.focusAreas.length > 0) {
        contextSection += `- **重点整理項目**: ${meetingContext.focusAreas.join('、')}\n`;
      }

      if (meetingContext.additionalInstructions) {
        contextSection += `- **追加指示**: ${meetingContext.additionalInstructions}\n`;
      }

      contextSection += '\n';
    }

    const prompt = `以下は会議の文字起こしテキストです。このテキストを分析して、構造化された議事録を生成してください。
${contextSection}
# 文字起こしテキスト

${transcriptText}

# 指示

上記の会議内容から、以下の形式で議事録を生成してください：

1. **概要（summary）**: 会議の主要なトピックと目的を2-3文で簡潔にまとめてください。

2. **決定事項（decisions）**: 
   
   **重要：決定事項が10個あれば10個、100個あれば100個、すべて漏らさず記録してください。要約や省略は絶対にしないでください。**
   
   以下のような内容をすべて抽出してください：
   - 明示的な決定：「〜に決定しました」「〜で進めます」「〜することにしました」
   - 暗黙的な合意：「それでいいですね」「了解です」「そうしましょう」
   - 方針決定：「〜の方向で検討します」「〜を優先します」
   - 承認事項：「承認します」「問題ありません」「OKです」
   - 却下事項：「〜はやめます」「〜は見送ります」
   - 小さな決定も含む：日程調整、担当者決定、次回の議題など
   
   各決定事項には以下を**必ず**含めてください：
   - description: 決定内容の具体的な説明（背景や理由も含めて詳細に）
   - timestamp: 該当する発言のタイムスタンプ（**必須**。文字起こしテキストの[HH:MM:SS]形式のタイムスタンプを必ず記録してください）

3. **ネクストアクション（nextActions）**: 
   
   **重要：アクションアイテムが10個あれば10個、100個あれば100個、すべて漏らさず記録してください。要約や省略は絶対にしないでください。**
   
   以下のような内容をすべて抽出してください：
   - 明示的なタスク：「〜を作成する」「〜を実施する」「〜を提出する」
   - 確認タスク：「〜を確認する」「〜をチェックする」「〜を見ておく」
   - 検討タスク：「〜を検討する」「〜を考える」「〜を調べる」
   - 連絡タスク：「〜に連絡する」「〜に共有する」「〜に報告する」
   - 準備タスク：「〜を準備する」「〜を用意する」
   - フォローアップ：「〜を追いかける」「〜を確認する」
   - 小さなタスクも含む：メール送信、資料共有、日程調整など
   
   各アクションには以下を**必ず**含めてください：
   - description: アクションの具体的な説明（5W1Hを意識：誰が、何を、いつ、どこで、なぜ、どのように）
   - assignee: 担当者（明示されている場合、または文脈から推測できる場合。不明な場合は省略）
   - dueDate: 期限（明示されている場合、YYYY-MM-DD形式。不明な場合は省略）
   - timestamp: 該当する発言のタイムスタンプ（**必須**。文字起こしテキストの[HH:MM:SS]形式のタイムスタンプを必ず記録してください）

# 出力形式

以下のJSON形式で出力してください：

\`\`\`json
{
  "summary": "会議の概要をここに記述",
  "decisions": [
    {
      "description": "決定事項の具体的な説明",
      "timestamp": "00:15:30"
    },
    {
      "description": "別の決定事項",
      "timestamp": "00:18:45"
    }
  ],
  "nextActions": [
    {
      "description": "アクションの具体的な説明",
      "assignee": "田中",
      "dueDate": "2025-10-30",
      "timestamp": "00:20:15"
    },
    {
      "description": "別のアクション",
      "timestamp": "00:25:00"
    }
  ]
}
\`\`\`

**タイムスタンプの抽出方法（最重要）:**
文字起こしテキストの各行は「[HH:MM:SS] spk_X: テキスト」の形式です。
決定事項やネクストアクションを見つけたら、その行の[HH:MM:SS]部分をそのままtimestampフィールドにコピーしてください。

例：
- 文字起こし: 「[00:15:30] spk_0: プロジェクトを来月開始することに決定しました」
  → decisions: [{"description": "プロジェクトを来月開始する", "timestamp": "00:15:30"}]

- 文字起こし: 「[00:20:45] spk_1: 田中さんが資料を準備してください」
  → nextActions: [{"description": "資料を準備する", "assignee": "田中", "timestamp": "00:20:45"}]

# 絶対に守るべきルール

1. **タイムスタンプは100%必須**: すべての決定事項とネクストアクションに必ずtimestampフィールドを含めてください。timestampがない項目は絶対に出力しないでください。
2. **網羅性**: 決定事項とネクストアクションは、会議中に言及されたものをすべて記録してください。数が多くても省略しないでください。
3. **具体性**: 各項目は具体的かつ詳細に記述してください。曖昧な表現は避けてください。
4. **正確性**: 文字起こしテキストに忠実に、事実のみを記録してください。
5. **形式**: JSON形式のみを出力し、他の説明文は含めないでください。

決定事項やアクションアイテムが本当に存在しない場合のみ、空の配列を返してください。
担当者や期限が明示されていない場合は、そのフィールドを省略してください。`;

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
        max_tokens: 8192, // より多くの決定事項・アクションを出力できるように増加
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1, // タイムスタンプ抽出の正確性を最大化するため極めて低く設定
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
