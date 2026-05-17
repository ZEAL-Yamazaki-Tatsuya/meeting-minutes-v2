/**
 * Amazon Bedrock client for generating meeting minutes
 * LLMを使用して議事録を生成する
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { Minutes, LLMMinutesResponse, AgendaItem } from '../models/minutes';
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
   * チャット用にBedrockを呼び出す（公開メソッド）
   */
  async invokeChatModel(prompt: string): Promise<string> {
    try {
      logger.info('チャット用Bedrock呼び出しを開始', {
        promptLength: prompt.length,
      });

      // リトライロジック付きで呼び出し
      const response = await this.invokeModelWithRetry(prompt);

      logger.info('チャット用Bedrock呼び出しに成功', {
        responseLength: response.length,
      });

      return response;
    } catch (error) {
      logger.error('チャット用Bedrock呼び出しに失敗', error as Error);
      throw error;
    }
  }

  /**
   * 議事録を生成する
   * @param jobId ジョブID
   * @param parsedTranscript パース済み文字起こし
   * @param meetingContext 会議コンテキスト（オプション）
   * @param agenda 論点リスト（オプション）- metadata.agenda から取得
   */
  async generateMinutes(
    jobId: string,
    parsedTranscript: ParsedTranscript,
    meetingContext?: MeetingContext,
    agenda?: string[]
  ): Promise<Minutes> {
    try {
      logger.info('議事録生成を開始', {
        jobId,
        transcriptLength: parsedTranscript.fullText.length,
        speakerCount: parsedTranscript.speakerCount,
        meetingContext,
        agendaCount: agenda?.length || 0,
      });

      // プロンプトを構築（会議コンテキストと論点を含む）
      const prompt = this.buildPrompt(parsedTranscript, meetingContext, agenda);

      // デバッグ: プロンプトの最初の500文字をログ出力
      logger.info('LLMに送信するプロンプト（抜粋）', {
        promptPreview: prompt.substring(0, 500),
        promptLength: prompt.length,
      });

      // LLMを呼び出し（リトライロジック付き）
      const llmResponse = await this.invokeModelWithRetry(prompt);

      // デバッグ: LLMレスポンスをログ出力
      logger.info('LLMからのレスポンス', {
        response: llmResponse.substring(0, 1000), // 最初の1000文字
        responseLength: llmResponse.length,
      });

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
   * @param parsedTranscript パース済み文字起こし
   * @param meetingContext 会議コンテキスト（オプション）
   * @param agenda 論点リスト（オプション）- 入力された論点に基づいて議事録を構造化
   */
  buildPrompt(parsedTranscript: ParsedTranscript, meetingContext?: MeetingContext, agenda?: string[]): string {
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

    // 重点整理項目に基づいた指示を追加
    let focusInstruction = '';
    if (meetingContext?.focusAreas && meetingContext.focusAreas.length > 0) {
      focusInstruction = `\n**重要**: 以下の項目を特に重点的に抽出してください：${meetingContext.focusAreas.join('、')}\n`;
    }

    // 論点ベースの構造化指示を構築
    // agenda が存在する場合は入力された論点をベースに構造化
    // agenda が存在しない場合はAIが文字起こしから論点を自動抽出
    const agendaInstruction = this.buildAgendaInstruction(agenda);

    const prompt = `以下は会議の文字起こしテキストです。このテキストを分析して、論点ベースの構造化された議事録を生成してください。
${contextSection}
# 文字起こしテキスト

${transcriptText}

# 指示
${focusInstruction}
${agendaInstruction}

上記の会議内容から、以下の形式で議事録を生成してください。

**重要：議事録は「論点（議題）」ごとに整理してください。各論点について、議論の内容、結論、次に検討すべき論点、ネクストアクションをまとめます。**

## 出力構造

1. **概要（summary）**: 会議の主要なトピックと目的を2-3文で簡潔にまとめてください。

2. **論点ごとの議事録（agendaItems）**: 
   
   会議で議論された各論点（議題）について、以下の構造で整理してください：
   
   - **issue（論点）**: 「XXXはどうするか？」「XXXについて」のように、議論のテーマを疑問形または名詞形で記述
   - **discussion（内容）**: 各発言者の主要な発言を記録。発言者名と発言内容のペアで記述
   - **conclusion（結論）**: その論点に対する結論。「XXXとする」「XXXで進める」のように記述。結論が出ていない場合は「継続検討」
   - **nextIssues（ネクスト論点）**: この論点から派生した、次回以降に検討すべき論点。「YYYはどうするか？」の形式
   - **nextActions（ネクストアクション）**: この論点に関連する具体的なアクション。担当者、アクション内容、期限を記述

   **ガイドライン：**
   - 会議で議論された順序で並べる
   - すべての論点を漏らさず記録する（小さな議題も含む）
   - 各発言者の発言は要約してよいが、重要な発言は省略しない
   - 結論が明確でない場合は「継続検討」「次回持ち越し」等と記述
   - ネクスト論点がない場合は空配列
   - ネクストアクションがない場合は空配列

3. **決定事項（decisions）**: 全論点を通じた決定事項の一覧（後方互換性のため）
4. **ネクストアクション（nextActions）**: 全論点を通じたアクションの一覧（後方互換性のため）

# 出力形式

以下のJSON形式で出力してください：

\`\`\`json
{
  "summary": "会議の概要をここに記述",
  "agendaItems": [
    {
      "issue": "新規プロジェクトの進め方はどうするか？",
      "discussion": [
        {"speaker": "田中", "content": "スケジュールを前倒しにすべきではないか"},
        {"speaker": "佐藤", "content": "リソースが足りないので現状維持が良い"},
        {"speaker": "鈴木", "content": "外部委託を検討してはどうか"}
      ],
      "conclusion": "外部委託を含めて検討し、次回までに見積もりを取る",
      "nextIssues": [
        "外部委託先の選定はどうするか？",
        "予算の確保はどうするか？"
      ],
      "nextActions": [
        {"assignee": "田中", "action": "外部委託先3社に見積もりを依頼する", "dueDate": "6/15"},
        {"assignee": "佐藤", "action": "予算申請書を作成する", "dueDate": "6/20"}
      ]
    },
    {
      "issue": "次回の定例会議の日程について",
      "discussion": [
        {"speaker": "田中", "content": "来週火曜日はどうか"},
        {"speaker": "佐藤", "content": "火曜日で問題ない"}
      ],
      "conclusion": "次回は来週火曜日14時に開催する",
      "nextIssues": [],
      "nextActions": [
        {"assignee": "鈴木", "action": "会議室を予約する", "dueDate": "6/10"}
      ]
    }
  ],
  "decisions": [
    {"description": "外部委託を含めて検討する方針とする", "timestamp": "00:15:30"},
    {"description": "次回定例は来週火曜日14時に開催", "timestamp": "00:45:00"}
  ],
  "nextActions": [
    {"description": "外部委託先3社に見積もりを依頼する", "assignee": "田中", "dueDate": "2025-06-15", "timestamp": "00:20:00"},
    {"description": "予算申請書を作成する", "assignee": "佐藤", "dueDate": "2025-06-20", "timestamp": "00:22:00"},
    {"description": "会議室を予約する", "assignee": "鈴木", "dueDate": "2025-06-10", "timestamp": "00:46:00"}
  ]
}
\`\`\`

# 論点の抽出ガイドライン

**論点として抽出すべきもの：**
- 明示的な議題：「次の議題は〜」「〜について話しましょう」
- 質問形式の議論：「〜はどうしますか？」「〜についてどう思いますか？」
- 報告事項：「〜の進捗を報告します」「〜の結果を共有します」
- 確認事項：「〜を確認したいのですが」
- 小さな議題も含む：日程調整、連絡事項、確認事項

**発言者の特定：**
- 文字起こしの「spk_0」「spk_1」等は、会議コンテキストの出席者リストがあればそれに対応させる
- 出席者リストがない場合は「話者A」「話者B」等で記述

**ネクストアクションの期限：**
- 期限が明示されている場合は「MM/DD」形式で記述（例：「6/15」「12/1」）
- 期限が不明な場合はdueDateフィールドを省略

# 絶対に守るべきルール

1. **網羅性**: 会議中のすべての論点を漏らさず記録してください
2. **具体性**: 各発言は具体的に記述してください
3. **正確性**: 文字起こしテキストに忠実に記録してください
4. **形式**: JSON形式のみを出力し、他の説明文は含めないでください
5. **タイムスタンプ**: decisions と nextActions（トップレベル）には必ずtimestampを含めてください`;

    return prompt;
  }

  /**
   * 論点ベースの構造化指示を構築する
   * - agenda が存在する場合: 入力された論点をベースに議事録を構造化するよう指示
   * - agenda が存在しない場合: AIが文字起こしから論点を自動抽出するよう指示
   * - 論点が20件を超える場合は最初の20件に制限
   * @param agenda 論点リスト（オプション）
   */
  buildAgendaInstruction(agenda?: string[]): string {
    // 論点の最大件数
    const MAX_AGENDA_ITEMS = 20;

    if (agenda && agenda.length > 0) {
      // 論点が20件を超える場合は最初の20件に制限
      const limitedAgenda = agenda.slice(0, MAX_AGENDA_ITEMS);

      // 論点リストを番号付きで構築
      const agendaList = limitedAgenda
        .map((item, index) => `${index + 1}. ${item}`)
        .join('\n');

      return `以下の論点に基づいて議事録を構造化してください：\n${agendaList}\n\n各論点について、文字起こしテキストから関連する議論内容を抽出し、結論・ネクスト論点・ネクストアクションを整理してください。文字起こしに含まれていない論点については、「議論なし」と記載してください。`;
    }

    // 論点が入力されていない場合はAIが自動抽出
    return '文字起こしから主要な論点を抽出し、議事録を構造化してください。';
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

      // デバッグ: パースされたLLMレスポンスをログ出力
      logger.info('パースされたLLMレスポンス', {
        agendaItemsCount: llmMinutes.agendaItems?.length || 0,
        decisionsCount: llmMinutes.decisions.length,
        nextActionsCount: llmMinutes.nextActions.length,
      });

      // agendaItemsにIDと順序を追加
      const agendaItems: AgendaItem[] = (llmMinutes.agendaItems || []).map((item, index) => ({
        id: `agenda-${Date.now()}-${index}`,
        issue: item.issue,
        discussion: item.discussion.map(d => ({
          speaker: d.speaker,
          content: d.content,
        })),
        conclusion: item.conclusion,
        nextIssues: item.nextIssues || [],
        nextActions: (item.nextActions || []).map(a => ({
          assignee: a.assignee,
          action: a.action,
          dueDate: a.dueDate,
        })),
        order: index,
      }));

      // トピックにIDと順序を追加（後方互換性）
      const topics = llmMinutes.topics?.map((topic, index) => ({
        id: `topic-${Date.now()}-${index}`,
        title: topic.title,
        description: topic.description,
        order: index,
      }));

      // Minutesオブジェクトに変換
      const minutes: Minutes = {
        jobId,
        generatedAt: new Date().toISOString(),
        summary: llmMinutes.summary || '',
        agendaItems,
        topics: topics && topics.length > 0 ? topics : undefined,
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

      // デバッグ: 変換後のMinutesオブジェクトをログ出力
      logger.info('変換後のMinutesオブジェクト', {
        agendaItemsCount: minutes.agendaItems.length,
        decisionsCount: minutes.decisions.length,
        nextActionsCount: minutes.nextActions.length,
      });

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
