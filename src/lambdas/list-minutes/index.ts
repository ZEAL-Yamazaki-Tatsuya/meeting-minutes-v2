/**
 * List Minutes Lambda Handler
 * ユーザーの議事録一覧を取得する（ページネーションとフィルター機能付き）
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { ValidationError, UnauthorizedError } from '../../utils/errors';
import { getUserIdFromEvent } from '../../utils/auth';
import { withErrorHandler } from '../../utils/error-handler';
import { MeetingJob } from '../../models/meeting-job';

const logger = new Logger({ component: 'ListMinutesHandler' });
const repository = new MeetingJobRepository(
    process.env.JOBS_TABLE_NAME || 'MeetingJobs'
);

interface MinutesSummary {
    jobId: string;
    userId: string;
    meetingName: string;
    createdAt: string;
    meetingDate?: string;   // 会議開催日時（metadata.meetingDate から取得）
    summaryPreview: string;
    status: string;
}

interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/**
 * メインハンドラーロジック
 */
async function listMinutes(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    logger.info('List minutes request received', {
        queryStringParameters: event.queryStringParameters,
    });

    // ユーザーIDを取得（Cognito認証から）
    const userId = getUserIdFromEvent(event);
    if (!userId) {
        throw new UnauthorizedError('認証が必要です');
    }

    // クエリパラメータを取得
    const page = event.queryStringParameters?.page
        ? parseInt(event.queryStringParameters.page, 10)
        : 1;

    const limit = event.queryStringParameters?.limit
        ? parseInt(event.queryStringParameters.limit, 10)
        : 20;

    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;
    const meetingName = event.queryStringParameters?.meetingName;

    // パラメータ検証
    if (isNaN(page) || page < 1) {
        throw new ValidationError('page must be a positive integer');
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new ValidationError('limit must be between 1 and 100');
    }

    // 日付形式の検証
    if (startDate && !isValidISODate(startDate)) {
        throw new ValidationError('startDate must be in ISO 8601 format');
    }

    if (endDate && !isValidISODate(endDate)) {
        throw new ValidationError('endDate must be in ISO 8601 format');
    }

    logger.info('Fetching minutes', {
        userId,
        page,
        limit,
        startDate,
        endDate,
        meetingName,
    });

    // DynamoDBから全議事録を取得（フィルタリングとページネーションのため）
    const allJobs = await fetchAllJobsForUser(userId);

    // 完了した議事録のみをフィルタリング
    let filteredJobs = allJobs.filter(job => job.status === 'COMPLETED' && job.minutesS3Key);

    // フィルター適用
    if (startDate) {
        filteredJobs = filteredJobs.filter(job => job.createdAt >= startDate);
    }

    if (endDate) {
        filteredJobs = filteredJobs.filter(job => job.createdAt <= endDate);
    }

    if (meetingName) {
        const searchTerm = meetingName.toLowerCase();
        filteredJobs = filteredJobs.filter(job =>
            job.videoFileName.toLowerCase().includes(searchTerm)
        );
    }

    // 作成日時の降順でソート（最新が先）
    filteredJobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // 総件数と総ページ数を計算
    const total = filteredJobs.length;
    const totalPages = Math.ceil(total / limit);

    // ページネーション適用
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

    // レスポンス用のデータに変換
    // meetingDate: metadata.meetingDate が存在すれば含める（フロントエンドでフォールバック処理）
    const minutes: MinutesSummary[] = paginatedJobs.map(job => ({
        jobId: job.jobId,
        userId: job.userId,
        meetingName: job.videoFileName,
        createdAt: job.createdAt,
        meetingDate: job.metadata?.meetingDate,
        summaryPreview: job.summaryPreview || '概要がありません',
        status: job.status,
    }));

    const pagination: PaginationInfo = {
        page,
        limit,
        total,
        totalPages,
    };

    logger.info('Minutes retrieved successfully', {
        userId,
        count: minutes.length,
        total,
        page,
        totalPages,
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
            data: {
                minutes,
                pagination,
            },
        }),
    };
}

/**
 * ユーザーの全ジョブを取得（ページネーションを使用して全件取得）
 */
async function fetchAllJobsForUser(userId: string): Promise<MeetingJob[]> {
    const allJobs: MeetingJob[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
        const result = await repository.listJobsByUser({
            userId,
            limit: 100, // DynamoDBから一度に取得する件数
            lastEvaluatedKey,
        });

        allJobs.push(...result.jobs);
        lastEvaluatedKey = result.lastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allJobs;
}

/**
 * ISO 8601形式の日付文字列かどうかを検証
 */
function isValidISODate(dateString: string): boolean {
    const date = new Date(dateString);
    // 日付が有効で、ISO形式に変換できることを確認
    if (isNaN(date.getTime())) {
        return false;
    }
    // ISO形式の文字列として再パースして同じ値になることを確認
    const isoString = date.toISOString();
    return new Date(isoString).getTime() === date.getTime();
}

/**
 * Lambda handler（エラーハンドリングミドルウェアでラップ）
 */
export const handler = withErrorHandler(listMinutes, logger);
