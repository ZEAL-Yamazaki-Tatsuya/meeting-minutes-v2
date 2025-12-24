/**
 * Chat Handler Lambda Function
 * 議事録に関する質問に対してBedrockを使用して回答を生成する
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockClient } from '../../utils/bedrock-client';
import { Logger } from '../../utils/logger';
import { ValidationError, InternalServerError, ServiceUnavailableError } from '../../utils/errors';

const logger = new Logger({ lambda: 'chat-handler' });

// 環境変数
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0';

// 定数
const MAX_MESSAGE_LENGTH = 1000; // 質問の最大文字数
const MAX_CONTEXT_SIZE = 100000; // コンテキストの最大文字数（文字起こし全文を含めるため100,000文字に拡大）
const MAX_HISTORY_LENGTH = 3; // 会話履歴の最大件数（Bedrockの応答時間を短縮するため3件に削減）
const BEDROCK_TIMEOUT_MS = 55000; // Bedrockのタイムアウト（55秒）- API Gatewayの60秒タイムアウトを考慮

// クライアントの初期化
let bedrockClient: BedrockClient;

// 依存性注入用の関数（テスト用）
export function initializeDependencies(bedrock?: BedrockClient) {
  bedrockClient = bedrock || new BedrockClient({ modelId: BEDROCK_MODEL_ID });
}

// デフォルトの初期化
initializeDependencies();

/**
 * リクエストボディの型定義
 */
interface ChatRequest {
  message: string;
  context: {
    summary: string;
    decisions: Array<{
      id: string;
      description: string;
      timestamp?: string;
    }>;
    nextActions: Array<{
      id: string;
      description: string;
      assignee?: string;
      dueDate?: string;
      timestamp?: string;
    }>;
    transcript: string;
  };
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * レスポンスボディの型定義
 */
interface ChatResponse {
  success: boolean;
  data?: {
    message: string;
    timestamp: string;
  };
  error?: {
    message: string;
    code: string;
  };
}

/**
 * Lambda handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const requestId = event.requestContext.requestId;
  const jobId = event.pathParameters?.jobId || 'unknown';
  
  // リクエストIDとジョブIDをロガーに追加
  const requestLogger = logger.withRequestId(requestId).withJobId(jobId);

  requestLogger.info('チャットリクエストを受信', {
    jobId,
    method: event.httpMethod,
    path: event.path,
  });

  try {
    // 1. リクエストボディの取得とバリデーション
    if (!event.body) {
      throw new ValidationError('リクエストボディが空です');
    }

    const request: ChatRequest = JSON.parse(event.body);
    
    // 入力検証
    validateRequest(request);

    requestLogger.info('リクエストの検証に成功', {
      messageLength: request.message.length,
      historyLength: request.history?.length || 0,
    });

    // 2. プロンプトとメッセージを構築
    const { systemPrompt, messages } = buildPromptWithHistory(request);

    requestLogger.info('プロンプトを構築', {
      systemPromptLength: systemPrompt.length,
      messagesCount: messages.length,
      contextSummaryLength: request.context.summary.length,
      decisionsCount: request.context.decisions.length,
      nextActionsCount: request.context.nextActions.length,
      transcriptLength: request.context.transcript.length,
    });

    // デバッグ用: プロンプトの一部を出力（開発環境のみ）
    if (process.env.ENVIRONMENT === 'dev') {
      requestLogger.info('プロンプト内容（抜粋）', {
        systemPromptPreview: systemPrompt.substring(0, 500),
        userMessage: messages[messages.length - 1]?.content,
      });
    }

    // 3. Bedrockを呼び出して回答を生成（タイムアウト付き）
    const bedrockStartTime = Date.now();
    const response = await invokeBedrockWithTimeout(systemPrompt, messages, BEDROCK_TIMEOUT_MS);
    
    requestLogger.logDuration('Bedrock呼び出し完了', bedrockStartTime);

    // 4. レスポンスを返す
    const chatResponse: ChatResponse = {
      success: true,
      data: {
        message: response,
        timestamp: new Date().toISOString(),
      },
    };

    requestLogger.logApiRequest(
      event.httpMethod,
      event.path,
      200,
      Date.now() - startTime
    );

    // 成功メトリクスを記録
    requestLogger.recordSuccessMetric('ChatHandler', true, { jobId });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify(chatResponse),
    };
  } catch (error) {
    const err = error as Error;
    
    requestLogger.error('チャットリクエストの処理に失敗', err, { jobId });

    // 失敗メトリクスを記録
    requestLogger.recordSuccessMetric('ChatHandler', false, {
      jobId,
      errorType: err.name,
    });

    // エラータイプ別のメトリクスを記録
    requestLogger.recordBusinessMetric('ChatErrorCount', 1, 'Count', {
      Component: 'ChatHandler',
      ErrorType: err.name,
    });

    // エラーレスポンスを返す
    const statusCode = (err as any).statusCode || 500;
    const errorResponse: ChatResponse = {
      success: false,
      error: {
        message: err.message || '予期しないエラーが発生しました',
        code: err.name || 'InternalServerError',
      },
    };

    requestLogger.logApiRequest(
      event.httpMethod,
      event.path,
      statusCode,
      Date.now() - startTime
    );

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify(errorResponse),
    };
  }
}

/**
 * リクエストの入力検証
 */
function validateRequest(request: ChatRequest): void {
  // メッセージの検証
  if (!request.message || typeof request.message !== 'string') {
    throw new ValidationError('メッセージが指定されていません');
  }

  if (request.message.trim().length === 0) {
    throw new ValidationError('メッセージが空です');
  }

  if (request.message.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError(`メッセージは${MAX_MESSAGE_LENGTH}文字以内で入力してください`);
  }

  // コンテキストの検証
  if (!request.context) {
    throw new ValidationError('コンテキストが指定されていません');
  }

  if (!request.context.summary || typeof request.context.summary !== 'string') {
    throw new ValidationError('概要が指定されていません');
  }

  if (!Array.isArray(request.context.decisions)) {
    throw new ValidationError('決定事項が配列ではありません');
  }

  if (!Array.isArray(request.context.nextActions)) {
    throw new ValidationError('ネクストアクションが配列ではありません');
  }

  if (!request.context.transcript || typeof request.context.transcript !== 'string') {
    throw new ValidationError('文字起こしが指定されていません');
  }

  // コンテキストサイズの検証
  const contextSize = JSON.stringify(request.context).length;
  if (contextSize > MAX_CONTEXT_SIZE) {
    throw new ValidationError(`コンテキストのサイズが大きすぎます（最大${MAX_CONTEXT_SIZE}文字）`);
  }

  // 会話履歴の検証
  if (request.history) {
    if (!Array.isArray(request.history)) {
      throw new ValidationError('会話履歴が配列ではありません');
    }

    if (request.history.length > MAX_HISTORY_LENGTH) {
      throw new ValidationError(`会話履歴は${MAX_HISTORY_LENGTH}件以内にしてください（長い会話は応答時間が長くなります）`);
    }

    for (const item of request.history) {
      if (!item.role || !item.content) {
        throw new ValidationError('会話履歴の形式が不正です');
      }

      if (item.role !== 'user' && item.role !== 'assistant') {
        throw new ValidationError('会話履歴のroleは"user"または"assistant"である必要があります');
      }
    }
  }
}

/**
 * プロンプトと会話履歴を構築
 */
function buildPromptWithHistory(request: ChatRequest): {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  // 決定事項をフォーマット
  const decisionsText = request.context.decisions.length > 0
    ? request.context.decisions
        .map((d, i) => {
          let text = `${i + 1}. ${d.description}`;
          if (d.timestamp) {
            text += ` (${d.timestamp})`;
          }
          return text;
        })
        .join('\n')
    : 'なし';

  // ネクストアクションをフォーマット
  const nextActionsText = request.context.nextActions.length > 0
    ? request.context.nextActions
        .map((a, i) => {
          let text = `${i + 1}. ${a.description}`;
          if (a.assignee) {
            text += ` [担当: ${a.assignee}]`;
          }
          if (a.dueDate) {
            text += ` [期限: ${a.dueDate}]`;
          }
          if (a.timestamp) {
            text += ` (${a.timestamp})`;
          }
          return text;
        })
        .join('\n')
    : 'なし';

  // 文字起こし全文（制限なし）
  const limitedTranscript = request.context.transcript;

  // システムプロンプト
  const systemPrompt = `あなたは議事録アシスタントです。
以下の議事録の内容に基づいて、ユーザーの質問に答えてください。

【議事録の概要】
${request.context.summary}

【決定事項】
${decisionsText}

【ネクストアクション】
${nextActionsText}

【文字起こし全文】
${limitedTranscript}

# 回答のガイドライン
- 議事録の内容に基づいて、正確かつ簡潔に回答してください
- 情報が議事録に含まれていない場合は、「議事録には記載されていません」と伝えてください
- タイムスタンプが利用可能な場合は、参照してください
- 日本語で回答してください`;

  // 会話履歴を含むメッセージ配列を構築
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // 過去の会話履歴を追加
  if (request.history && request.history.length > 0) {
    messages.push(...request.history);
  }

  // 現在のユーザーメッセージを追加
  messages.push({
    role: 'user',
    content: request.message,
  });

  return { systemPrompt, messages };
}

/**
 * Bedrockを呼び出して回答を生成
 */
async function invokeBedrock(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  // BedrockClientのinvokeChatModelメソッドを使用
  // システムプロンプトとメッセージを結合
  let fullPrompt = systemPrompt + '\n\n';

  // 会話履歴を追加
  for (const message of messages) {
    if (message.role === 'user') {
      fullPrompt += `\n\nユーザー: ${message.content}`;
    } else {
      fullPrompt += `\n\nアシスタント: ${message.content}`;
    }
  }

  fullPrompt += '\n\nアシスタント:';

  try {
    return await bedrockClient.invokeChatModel(fullPrompt);
  } catch (error) {
    const err = error as Error;
    logger.error('Bedrock呼び出しエラー', err);
    
    // Bedrockエラーを適切なエラーメッセージに変換
    if (err.name === 'ServiceUnavailableError') {
      throw new ServiceUnavailableError('AIサービスが一時的に利用できません。しばらくしてから再度お試しください。');
    } else if (err.name === 'ThrottlingException') {
      throw new ServiceUnavailableError('リクエストが多すぎます。しばらくしてから再度お試しください。');
    } else {
      throw new InternalServerError('回答の生成に失敗しました。もう一度お試しください。');
    }
  }
}

/**
 * タイムアウト付きでBedrockを呼び出す
 */
async function invokeBedrockWithTimeout(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  timeoutMs: number
): Promise<string> {
  return Promise.race([
    invokeBedrock(systemPrompt, messages),
    new Promise<string>((_, reject) =>
      setTimeout(
        () => reject(new InternalServerError('AIの応答に時間がかかっています。質問を短くするか、もう一度お試しください。')),
        timeoutMs
      )
    ),
  ]);
}
