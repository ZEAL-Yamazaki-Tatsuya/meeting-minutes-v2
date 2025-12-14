/**
 * Search Minutes Lambda Handler
 * Bedrockを使用して議事録を横断検索する
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { BedrockClient } from '../../utils/bedrock-client';
import { Logger } from '../../utils/logger';
import { ValidationError, UnauthorizedError, InternalServerError, ServiceUnavailableError } from '../../utils/errors';
import { getUserIdFromEvent } from '../../utils/auth';
import { withErrorHandler } from '../../utils/error-handler';
import { MeetingJob } from '../../models/meeting-job';

const logger = new Logger({ component: 'SearchMinutesHandler' });
const repository = new MeetingJobRepository(
    process.env.JOBS_TABLE_NAME || 'MeetingJobs'
);
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const bedrockClient = new BedrockClient({
    modelId: process.env.BEDROCK_MODEL_ID || 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0',
});

// 定数
const MAX_QUERY_LENGTH = 1000; // 質問の最大文字数
const MAX_HISTORY_LENGTH = 5; // 会話履歴の最大件数
const MAX_MINUTES_COUNT = 100; // 検索対象の議事録の最大件数
const MAX_RESULTS = 5; // 返却する検索結果の最大件数
const TRANSCRIPT_LIMIT = 2000; // 文字起こし全文の最大文字数
const SEARCH_TIMEOUT_MS = 240000; // 検索タイムアウト（4分 = 240秒、Lambda 5分タイムアウトより短く設定）

/**
 * リクエストボディの型定義
 */
interface SearchRequest {
    userId: string;
    query: string;
    history?: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
}

/**
 * 検索結果の型定義
 */
interface SearchResult {
    jobId: string;
    meetingName: string;
    createdAt: string;
    excerpt: string;
    relevanceScore: number;
    matchedSection?: 'summary' | 'decisions' | 'nextActions' | 'transcript';
}

/**
 * Bedrockレスポンスの型定義
 */
interface BedrockSearchResponse {
    message: string;
    results: Array<{
        index: number;
        excerpt: string;
        relevanceScore: number;
        matchedSection?: 'summary' | 'decisions' | 'nextActions' | 'transcript';
    }>;
}

/**
 * 議事録の内容
 */
interface MinutesContent {
    jobId: string;
    meetingName: string;
    createdAt: string;
    summary: string;
    decisions: Array<{ description: string }>;
    nextActions: Array<{ description: string }>;
    transcript: string;
}

/**
 * メインハンドラーロジック
 */
async function searchMinutes(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    const startTime = Date.now();
    
    logger.info('Search minutes request received', {
        body: event.body?.substring(0, 200),
    });

    // ユーザーIDを取得（Cognito認証から）
    const userId = getUserIdFromEvent(event);
    if (!userId) {
        throw new UnauthorizedError('認証が必要です');
    }

    // リクエストボディの取得とバリデーション
    if (!event.body) {
        throw new ValidationError('リクエストボディが空です');
    }

    const request: SearchRequest = JSON.parse(event.body);
    
    // 入力検証
    validateRequest(request, userId);

    logger.info('Request validated', {
        userId,
        queryLength: request.query.length,
        historyLength: request.history?.length || 0,
    });

    try {
        // タイムアウト付きで検索を実行
        const searchResult = await Promise.race([
            performSearch(userId, request),
            new Promise<never>((_, reject) =>
                setTimeout(
                    () => reject(new InternalServerError('検索に時間がかかっています。もう一度お試しください。')),
                    SEARCH_TIMEOUT_MS
                )
            ),
        ]);

        logger.info('Search completed successfully', {
            userId,
            resultsCount: searchResult.results.length,
            duration: Date.now() - startTime,
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true',
            },
            body: JSON.stringify({
                success: true,
                data: searchResult,
            }),
        };
    } catch (error) {
        // エラー時も会話履歴を保持するため、エラーをそのまま投げる
        logger.error('Search failed', error as Error, { userId });
        throw error;
    }
}

/**
 * リクエストの入力検証
 */
function validateRequest(request: SearchRequest, authenticatedUserId: string): void {
    // userIdの検証
    if (!request.userId || typeof request.userId !== 'string') {
        throw new ValidationError('userIdが指定されていません');
    }

    // 認証されたユーザーIDとリクエストのuserIdが一致することを確認
    if (request.userId !== authenticatedUserId) {
        throw new UnauthorizedError('他のユーザーの議事録を検索することはできません');
    }

    // クエリの検証
    if (!request.query || typeof request.query !== 'string') {
        throw new ValidationError('queryが指定されていません');
    }

    if (request.query.trim().length === 0) {
        throw new ValidationError('queryが空です');
    }

    if (request.query.length > MAX_QUERY_LENGTH) {
        throw new ValidationError(`queryは${MAX_QUERY_LENGTH}文字以内で入力してください`);
    }

    // 会話履歴の検証
    if (request.history) {
        if (!Array.isArray(request.history)) {
            throw new ValidationError('historyが配列ではありません');
        }

        if (request.history.length > MAX_HISTORY_LENGTH) {
            throw new ValidationError(`historyは${MAX_HISTORY_LENGTH}件以内にしてください`);
        }

        for (const item of request.history) {
            if (!item.role || !item.content) {
                throw new ValidationError('historyの形式が不正です');
            }

            if (item.role !== 'user' && item.role !== 'assistant') {
                throw new ValidationError('historyのroleは"user"または"assistant"である必要があります');
            }
        }
    }
}

/**
 * 検索を実行
 */
async function performSearch(
    userId: string,
    request: SearchRequest
): Promise<{
    message: string;
    results: SearchResult[];
    timestamp: string;
}> {
    // 1. DynamoDBから該当ユーザーの議事録メタデータを取得（最大100件）
    const jobs = await fetchUserJobs(userId);

    if (jobs.length === 0) {
        return {
            message: '議事録が見つかりませんでした。',
            results: [],
            timestamp: new Date().toISOString(),
        };
    }

    logger.info('Fetched user jobs', {
        userId,
        jobsCount: jobs.length,
    });

    // 2. S3から議事録内容を並列取得
    const minutesContents = await fetchMinutesContents(jobs);

    logger.info('Fetched minutes contents', {
        userId,
        minutesCount: minutesContents.length,
    });

    // 3. Bedrockプロンプトを構築
    const { systemPrompt, messages } = buildSearchPrompt(
        minutesContents,
        request.query,
        request.history
    );

    logger.info('Built search prompt', {
        userId,
        systemPromptLength: systemPrompt.length,
        messagesCount: messages.length,
    });

    // 4. Bedrockを呼び出して検索結果を取得
    const bedrockResponse = await invokeBedrockSearch(systemPrompt, messages);

    logger.info('Bedrock search completed', {
        userId,
        resultsCount: bedrockResponse.results.length,
    });

    // 5. 検索結果を変換
    const searchResults = convertSearchResults(bedrockResponse, minutesContents);

    return {
        message: bedrockResponse.message,
        results: searchResults,
        timestamp: new Date().toISOString(),
    };
}

/**
 * ユーザーの議事録を取得（最大100件）
 */
async function fetchUserJobs(userId: string): Promise<MeetingJob[]> {
    const allJobs: MeetingJob[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    // 完了した議事録のみを取得
    do {
        const result = await repository.listJobsByUser({
            userId,
            limit: 100,
            lastEvaluatedKey,
        });

        // 完了した議事録のみをフィルタリング
        const completedJobs = result.jobs.filter(
            job => job.status === 'COMPLETED' && job.minutesS3Key
        );

        allJobs.push(...completedJobs);
        lastEvaluatedKey = result.lastEvaluatedKey;

        // 最大100件に達したら終了
        if (allJobs.length >= MAX_MINUTES_COUNT) {
            break;
        }
    } while (lastEvaluatedKey && allJobs.length < MAX_MINUTES_COUNT);

    // 最大100件に制限
    return allJobs.slice(0, MAX_MINUTES_COUNT);
}

/**
 * S3から議事録内容を並列取得
 */
async function fetchMinutesContents(jobs: MeetingJob[]): Promise<MinutesContent[]> {
    const outputBucketName = process.env.OUTPUT_BUCKET_NAME;
    if (!outputBucketName) {
        throw new InternalServerError('OUTPUT_BUCKET_NAME environment variable is not set');
    }

    // 並列取得
    const promises = jobs.map(async (job) => {
        try {
            if (!job.minutesS3Key) {
                return null;
            }

            const minutesMarkdown = await getMinutesFromS3(job.minutesS3Key, outputBucketName);
            const parsedMinutes = parseMarkdownMinutes(minutesMarkdown);

            return {
                jobId: job.jobId,
                meetingName: job.videoFileName,
                createdAt: job.createdAt,
                summary: parsedMinutes.summary,
                decisions: parsedMinutes.decisions,
                nextActions: parsedMinutes.nextActions,
                transcript: parsedMinutes.transcript,
            };
        } catch (error) {
            logger.error('Failed to fetch minutes', error as Error, {
                jobId: job.jobId,
                s3Key: job.minutesS3Key,
            });
            return null;
        }
    });

    const results = await Promise.all(promises);
    
    // nullを除外
    return results.filter((content): content is MinutesContent => content !== null);
}

/**
 * S3から議事録ファイルを取得
 */
async function getMinutesFromS3(s3Key: string, bucketName: string): Promise<string> {
    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
        });

        const response = await s3Client.send(command);
        
        if (!response.Body) {
            throw new InternalServerError('S3 response body is empty');
        }

        return await response.Body.transformToString('utf-8');
    } catch (error) {
        logger.error('Error getting minutes from S3', error as Error, { s3Key, bucketName });
        throw new InternalServerError(`Failed to retrieve minutes from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Markdownから構造化データを抽出
 */
function parseMarkdownMinutes(markdown: string): {
    summary: string;
    decisions: Array<{ description: string }>;
    nextActions: Array<{ description: string }>;
    transcript: string;
} {
    const lines = markdown.split('\n');
    let summary = '';
    const decisions: Array<{ description: string }> = [];
    const nextActions: Array<{ description: string }> = [];
    let transcript = '';

    let currentSection = '';
    let currentText = '';

    for (const line of lines) {
        const trimmedLine = line.trim();

        // セクションヘッダーを検出
        if (trimmedLine.startsWith('### 全体概要')) {
            currentSection = 'summary';
            currentText = '';
            continue;
        } else if (trimmedLine.startsWith('## 決定事項')) {
            if (currentSection === 'summary') {
                summary = currentText.trim();
            }
            currentSection = 'decisions';
            currentText = '';
            continue;
        } else if (trimmedLine.startsWith('## ネクストアクション')) {
            currentSection = 'nextActions';
            currentText = '';
            continue;
        } else if (trimmedLine.startsWith('## 文字起こし全文')) {
            currentSection = 'transcript';
            currentText = '';
            continue;
        }

        // 各セクションの内容を処理
        if (currentSection === 'summary' && trimmedLine && !trimmedLine.startsWith('#')) {
            currentText += trimmedLine + '\n';
        } else if (currentSection === 'decisions' && trimmedLine) {
            const match = trimmedLine.match(/^\d+\.\s+(.+?)(?:\s+\(([^\)]+)\))?$/);
            if (match) {
                decisions.push({
                    description: match[1].trim(),
                });
            }
        } else if (currentSection === 'nextActions' && trimmedLine) {
            const actionMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
            if (actionMatch) {
                nextActions.push({
                    description: actionMatch[1].trim(),
                });
            }
        } else if (currentSection === 'transcript' && trimmedLine && !trimmedLine.startsWith('#')) {
            currentText += trimmedLine + '\n';
        }
    }

    // 最後のセクションを処理
    if (currentSection === 'transcript') {
        transcript = currentText.trim();
    } else if (currentSection === 'summary') {
        summary = currentText.trim();
    }

    return {
        summary,
        decisions,
        nextActions,
        transcript,
    };
}

/**
 * Lambda handler（エラーハンドリングミドルウェアでラップ）
 */
export const handler = withErrorHandler(searchMinutes, logger);

/**
 * Bedrock検索プロンプトを構築
 */
function buildSearchPrompt(
    minutesContents: MinutesContent[],
    query: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
): {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
    // 議事録情報を構築（文字起こし全文は含めず、概要・決定事項・ネクストアクションのみ）
    const minutesInfo = minutesContents.map((minutes, index) => {
        // 決定事項をフォーマット
        const decisionsText = minutes.decisions.length > 0
            ? minutes.decisions.map((d, i) => `${i + 1}. ${d.description}`).join('\n')
            : 'なし';

        // ネクストアクションをフォーマット
        const nextActionsText = minutes.nextActions.length > 0
            ? minutes.nextActions.map((a, i) => `${i + 1}. ${a.description}`).join('\n')
            : 'なし';

        return `
議事録 ${index + 1}:
- 会議名: ${minutes.meetingName}
- 作成日時: ${minutes.createdAt}
- 概要: ${minutes.summary}
- 決定事項:
${decisionsText}
- ネクストアクション:
${nextActionsText}
`;
    }).join('\n---\n');

    // システムプロンプト
    const systemPrompt = `あなたは議事録検索アシスタントです。
ユーザーの質問に基づいて、関連する議事録を特定し、該当箇所を抽出してください。

【検索対象の議事録一覧】
${minutesInfo}

【指示】
1. ユーザーの質問に最も関連する議事録を特定してください
2. 該当箇所を引用し、前後のコンテキストを含めて抜粋してください
3. 関連度の高い順に最大${MAX_RESULTS}件を返してください
4. 該当する議事録がない場合は、その旨を伝えてください
5. 具体的な内容（例：「hogeテーブルは移行対象外」）が質問に含まれている場合は、その文言を含む議事録を優先してください

【回答形式】
以下のJSON形式で回答してください：
{
  "message": "検索結果の説明（日本語で簡潔に）",
  "results": [
    {
      "index": 議事録のインデックス番号（1から始まる）,
      "excerpt": "該当箇所の抜粋（前後のコンテキストを含む、200-300文字程度）",
      "relevanceScore": 0.0〜1.0の関連度スコア,
      "matchedSection": "summary" | "decisions" | "nextActions" | "transcript"
    }
  ]
}

【重要】
- JSON形式のみを出力し、他の説明文は含めないでください
- resultsは関連度スコアの降順でソートしてください
- resultsは最大${MAX_RESULTS}件までにしてください
- 該当する議事録がない場合は、resultsを空の配列にしてください`;

    // 会話履歴を含むメッセージ配列を構築
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // 過去の会話履歴を追加（最大5件）
    if (history && history.length > 0) {
        // 最新5件のみを使用
        const recentHistory = history.slice(-MAX_HISTORY_LENGTH);
        messages.push(...recentHistory);
    }

    // 現在のユーザークエリを追加
    messages.push({
        role: 'user',
        content: query,
    });

    return { systemPrompt, messages };
}

/**
 * Bedrockを呼び出して検索を実行
 */
async function invokeBedrockSearch(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<BedrockSearchResponse> {
    try {
        // BedrockClientのinvokeChatModelメソッドを使用
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

        const response = await bedrockClient.invokeChatModel(fullPrompt);

        // JSONレスポンスをパース
        const parsedResponse = parseBedrockResponse(response);

        return parsedResponse;
    } catch (error) {
        const err = error as Error;
        logger.error('Bedrock search error', err);

        // Bedrockエラーを適切なエラーメッセージに変換
        if (err.name === 'ServiceUnavailableError') {
            throw new ServiceUnavailableError('AIサービスが一時的に利用できません。しばらくしてから再度お試しください。');
        } else if (err.name === 'ThrottlingException') {
            throw new ServiceUnavailableError('リクエストが多すぎます。しばらくしてから再度お試しください。');
        } else {
            throw new InternalServerError('検索に失敗しました。もう一度お試しください。');
        }
    }
}

/**
 * Bedrockレスポンスをパース
 */
function parseBedrockResponse(response: string): BedrockSearchResponse {
    try {
        // JSON部分を抽出（マークダウンのコードブロックに囲まれている可能性がある）
        let jsonText = response.trim();

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

        const parsed: BedrockSearchResponse = JSON.parse(jsonText);

        // バリデーション
        if (!parsed.message || typeof parsed.message !== 'string') {
            throw new Error('Invalid response: message is missing or invalid');
        }

        if (!Array.isArray(parsed.results)) {
            throw new Error('Invalid response: results is not an array');
        }

        // 関連度スコアでソート（降順）
        parsed.results.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // 最大5件に制限
        parsed.results = parsed.results.slice(0, MAX_RESULTS);

        return parsed;
    } catch (error) {
        logger.error('Failed to parse Bedrock response', error as Error, {
            response: response.substring(0, 500),
        });
        throw new InternalServerError('検索結果のパースに失敗しました。');
    }
}

/**
 * 検索結果を変換
 */
function convertSearchResults(
    bedrockResponse: BedrockSearchResponse,
    minutesContents: MinutesContent[]
): SearchResult[] {
    return bedrockResponse.results.map((result) => {
        // インデックスは1から始まるので、配列のインデックスに変換
        const minutesIndex = result.index - 1;

        if (minutesIndex < 0 || minutesIndex >= minutesContents.length) {
            logger.warn('Invalid minutes index in search result', {
                index: result.index,
                minutesCount: minutesContents.length,
            });
            // デフォルト値を返す
            return {
                jobId: 'unknown',
                meetingName: '不明',
                createdAt: new Date().toISOString(),
                excerpt: result.excerpt,
                relevanceScore: result.relevanceScore,
                matchedSection: result.matchedSection,
            };
        }

        const minutes = minutesContents[minutesIndex];

        return {
            jobId: minutes.jobId,
            meetingName: minutes.meetingName,
            createdAt: minutes.createdAt,
            excerpt: result.excerpt,
            relevanceScore: result.relevanceScore,
            matchedSection: result.matchedSection,
        };
    });
}
