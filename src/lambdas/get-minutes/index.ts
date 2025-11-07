/**
 * Get Minutes Lambda Handler
 * 指定されたジョブIDの議事録を取得する
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { NotFoundError, ValidationError, InternalServerError } from '../../utils/errors';
import { getUserIdFromEvent } from '../../utils/auth';
import { withErrorHandler } from '../../utils/error-handler';

const logger = new Logger({ component: 'GetMinutesHandler' });
const repository = new MeetingJobRepository(
    process.env.JOBS_TABLE_NAME || 'MeetingJobs'
);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

/**
 * Markdownから構造化データを抽出する
 */
function parseMarkdownMinutes(markdown: string): {
    summary: string;
    topics?: Array<{ id: string; title: string; description: string; order: number }>;
    decisions: Array<{ id: string; description: string; timestamp?: string }>;
    nextActions: Array<{ id: string; description: string; assignee?: string; dueDate?: string; timestamp?: string }>;
    transcript: string;
    speakers: Array<{ id: string; name?: string; segments: number }>;
} {
    const lines = markdown.split('\n');
    let summary = '';
    const topics: Array<{ id: string; title: string; description: string; order: number }> = [];
    const decisions: Array<{ id: string; description: string; timestamp?: string }> = [];
    const nextActions: Array<{ id: string; description: string; assignee?: string; dueDate?: string; timestamp?: string }> = [];
    let transcript = '';
    const speakers: Array<{ id: string; name?: string; segments: number }> = [];

    let currentSection = '';
    let currentText = '';
    let currentTopicTitle = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // セクションヘッダーを検出
        if (line.startsWith('## 概要')) {
            currentSection = 'overview';
            currentText = '';
            continue;
        } else if (line.startsWith('### 全体概要')) {
            currentSection = 'summary';
            currentText = '';
            continue;
        } else if (line.startsWith('### トピック別詳細')) {
            if (currentSection === 'summary') {
                summary = currentText.trim();
            }
            currentSection = 'topics';
            currentText = '';
            continue;
        } else if (line.startsWith('## 決定事項')) {
            if (currentSection === 'summary') {
                summary = currentText.trim();
            } else if (currentSection === 'topics' && currentTopicTitle && currentText.trim()) {
                // 最後のトピックを保存
                topics.push({
                    id: `topic-${topics.length}`,
                    title: currentTopicTitle,
                    description: currentText.trim(),
                    order: topics.length,
                });
            }
            currentSection = 'decisions';
            currentText = '';
            continue;
        } else if (line.startsWith('## ネクストアクション')) {
            currentSection = 'nextActions';
            currentText = '';
            continue;
        } else if (line.startsWith('## 文字起こし全文')) {
            currentSection = 'transcript';
            currentText = '';
            continue;
        }

        // トピックのタイトルを検出（#### 1. タイトル形式）
        if (currentSection === 'topics' && line.startsWith('####')) {
            // 前のトピックを保存
            if (currentTopicTitle && currentText.trim()) {
                topics.push({
                    id: `topic-${topics.length}`,
                    title: currentTopicTitle,
                    description: currentText.trim(),
                    order: topics.length,
                });
            }
            // 新しいトピックを開始
            const titleMatch = line.match(/^####\s+\d+\.\s+(.+)$/);
            if (titleMatch) {
                currentTopicTitle = titleMatch[1].trim();
                currentText = '';
            }
            continue;
        }

        // 各セクションの内容を処理
        if (currentSection === 'summary' && line && !line.startsWith('#')) {
            currentText += line + '\n';
        } else if (currentSection === 'topics' && line && !line.startsWith('#')) {
            currentText += line + '\n';
        } else if (currentSection === 'decisions' && line) {
            // 決定事項の行をパース（例: 1. 決定内容 (00:03:53) または 1. 決定内容）
            const match = line.match(/^\d+\.\s+(.+?)(?:\s+\(([^\)]+)\))?$/);
            if (match) {
                const timestamp = match[2] ? match[2].replace(/[\[\]]/g, '') : undefined;
                decisions.push({
                    id: `decision-${decisions.length + 1}`,
                    description: match[1].trim(),
                    timestamp,
                });
            } else if (line !== '決定事項はありません。') {
                currentText += line + '\n';
            }
        } else if (currentSection === 'nextActions' && line) {
            // ネクストアクションの行をパース（複数行形式）
            // 例: 
            // 1. アクション内容
            //    - **担当**: 名前
            //    - **期限**: 2024-01-09
            //    - **タイムスタンプ**: 00:31:47
            
            const actionMatch = line.match(/^\d+\.\s+(.+)$/);
            if (actionMatch) {
                // 新しいアクションを開始
                nextActions.push({
                    id: `action-${nextActions.length + 1}`,
                    description: actionMatch[1].trim(),
                });
            } else if (line.includes('**担当**:') || line.includes('**担当者**:')) {
                // 担当者を設定
                const assigneeMatch = line.match(/\*\*担当(?:者)?\*\*:\s*(.+)$/);
                if (assigneeMatch && nextActions.length > 0) {
                    const assignee = assigneeMatch[1].trim();
                    nextActions[nextActions.length - 1].assignee = assignee !== '不明' ? assignee : undefined;
                }
            } else if (line.includes('**期限**:')) {
                // 期限を設定
                const dueDateMatch = line.match(/\*\*期限\*\*:\s*(.+)$/);
                if (dueDateMatch && nextActions.length > 0) {
                    const dueDate = dueDateMatch[1].trim();
                    nextActions[nextActions.length - 1].dueDate = dueDate !== '不明' ? dueDate : undefined;
                }
            } else if (line.includes('**タイムスタンプ**:')) {
                // タイムスタンプを設定（角括弧を除去）
                const timestampMatch = line.match(/\*\*タイムスタンプ\*\*:\s*(.+)$/);
                if (timestampMatch && nextActions.length > 0) {
                    let timestamp = timestampMatch[1].trim();
                    // 角括弧を除去
                    timestamp = timestamp.replace(/[\[\]]/g, '');
                    nextActions[nextActions.length - 1].timestamp = timestamp !== '不明' ? timestamp : undefined;
                }
            } else if (line !== 'ネクストアクションはありません。') {
                currentText += line + '\n';
            }
        } else if (currentSection === 'transcript' && line && !line.startsWith('#')) {
            currentText += line + '\n';
        }
    }

    // 最後のセクションを処理
    if (currentSection === 'transcript') {
        transcript = currentText.trim();
    } else if (currentSection === 'topics' && currentTopicTitle && currentText.trim()) {
        // 最後のトピックを保存
        topics.push({
            id: `topic-${topics.length}`,
            title: currentTopicTitle,
            description: currentText.trim(),
            order: topics.length,
        });
    }

    return {
        summary,
        topics: topics.length > 0 ? topics : undefined,
        decisions,
        nextActions,
        transcript,
        speakers,
    };
}

/**
 * S3から議事録ファイルを取得する
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

        // Streamをstringに変換
        const bodyContents = await response.Body.transformToString('utf-8');
        return bodyContents;
    } catch (error) {
        logger.error('Error getting minutes from S3', error as Error, { s3Key, bucketName });
        throw new InternalServerError(`Failed to retrieve minutes from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * メインハンドラーロジック
 */
async function getMinutes(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    logger.info('Get minutes request received', {
        pathParameters: event.pathParameters,
    });

    // パスパラメータからjobIdを取得
    const jobId = event.pathParameters?.jobId;
    if (!jobId) {
        throw new ValidationError('jobId is required');
    }

    // ユーザーIDを取得（Cognito認証から、またはクエリパラメータから）
    const userId = getUserIdFromEvent(event) || event.queryStringParameters?.userId;
    if (!userId) {
        throw new ValidationError('認証が必要です');
    }

    // DynamoDBからジョブ情報を取得
    const job = await repository.getJob(jobId, userId);

    if (!job) {
        throw new NotFoundError(`Job not found: ${jobId}`);
    }

    // ジョブのステータスを確認
    if (job.status !== 'COMPLETED') {
        throw new ValidationError(`Job is not completed yet. Current status: ${job.status}`);
    }

    // 議事録のS3キーを確認
    if (!job.minutesS3Key) {
        throw new InternalServerError('Minutes S3 key is not set');
    }

    // S3から議事録を取得
    const outputBucketName = process.env.OUTPUT_BUCKET_NAME;
    if (!outputBucketName) {
        throw new InternalServerError('OUTPUT_BUCKET_NAME environment variable is not set');
    }

    const minutesContent = await getMinutesFromS3(job.minutesS3Key, outputBucketName);

    // Markdownから構造化データを抽出
    const parsedMinutes = parseMarkdownMinutes(minutesContent);

    logger.info('Minutes retrieved successfully', { jobId, userId });

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({
            success: true,
            data: {
                jobId: job.jobId,
                userId: job.userId,
                generatedAt: job.updatedAt,
                summary: parsedMinutes.summary,
                topics: parsedMinutes.topics,
                decisions: parsedMinutes.decisions,
                nextActions: parsedMinutes.nextActions,
                transcript: parsedMinutes.transcript,
                speakers: parsedMinutes.speakers,
            },
        }),
    };
}

/**
 * Lambda handler（エラーハンドリングミドルウェアでラップ）
 */
export const handler = withErrorHandler(getMinutes, logger);
