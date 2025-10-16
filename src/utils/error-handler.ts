/**
 * 統一されたエラーハンドリングミドルウェア
 * すべてのLambda関数で使用する共通のエラーハンドリングロジック
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { AppError, isOperationalError } from './errors';
import { Logger } from './logger';

/**
 * エラーメッセージマッピング
 * ユーザーフレンドリーなエラーメッセージを提供
 */
const ERROR_MESSAGE_MAP: Record<string, string> = {
  // 4xx エラー
  'ValidationError': 'リクエストの内容が正しくありません。入力内容を確認してください。',
  'NotFoundError': '指定されたリソースが見つかりません。',
  'UnauthorizedError': '認証が必要です。ログインしてください。',
  'ForbiddenError': 'このリソースへのアクセス権限がありません。',
  'ConflictError': 'リクエストが競合しています。',
  
  // 5xx エラー
  'InternalServerError': 'サーバー内部でエラーが発生しました。しばらくしてから再度お試しください。',
  'ServiceUnavailableError': 'サービスが一時的に利用できません。しばらくしてから再度お試しください。',
  
  // AWS サービスエラー
  'ThrottlingException': 'リクエストが多すぎます。しばらくしてから再度お試しください。',
  'ResourceNotFoundException': '指定されたリソースが見つかりません。',
  'AccessDeniedException': 'アクセスが拒否されました。',
  'InvalidParameterException': 'パラメータが無効です。',
  
  // デフォルト
  'default': '予期しないエラーが発生しました。しばらくしてから再度お試しください。',
};

/**
 * エラー分類
 */
export enum ErrorCategory {
  CLIENT_ERROR = 'CLIENT_ERROR',      // 4xx
  SERVER_ERROR = 'SERVER_ERROR',      // 5xx
  EXTERNAL_ERROR = 'EXTERNAL_ERROR',  // 外部サービスエラー
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',    // 不明なエラー
}

/**
 * エラーを分類する
 */
export function categorizeError(error: Error): ErrorCategory {
  if (error instanceof AppError) {
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return ErrorCategory.CLIENT_ERROR;
    }
    if (error.statusCode >= 500) {
      return ErrorCategory.SERVER_ERROR;
    }
  }
  
  // AWS SDK エラー
  const errorName = error.name;
  if (errorName.includes('Exception') || errorName.includes('Error')) {
    if (errorName.includes('Throttling') || errorName.includes('ServiceUnavailable')) {
      return ErrorCategory.EXTERNAL_ERROR;
    }
    if (errorName.includes('InvalidParameter') || errorName.includes('ValidationException')) {
      return ErrorCategory.CLIENT_ERROR;
    }
    if (errorName.includes('InternalError') || errorName.includes('ServiceException')) {
      return ErrorCategory.SERVER_ERROR;
    }
  }
  
  return ErrorCategory.UNKNOWN_ERROR;
}

/**
 * エラーからHTTPステータスコードを取得
 */
export function getStatusCode(error: Error): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  
  // AWS SDK エラーのマッピング
  const errorName = error.name;
  if (errorName.includes('ValidationException') || errorName.includes('InvalidParameter')) {
    return 400;
  }
  if (errorName.includes('ResourceNotFound')) {
    return 404;
  }
  if (errorName.includes('AccessDenied') || errorName.includes('UnauthorizedException')) {
    return 403;
  }
  if (errorName.includes('Throttling')) {
    return 429;
  }
  if (errorName.includes('ServiceUnavailable')) {
    return 503;
  }
  
  // デフォルトは500
  return 500;
}

/**
 * ユーザーフレンドリーなエラーメッセージを取得
 */
export function getUserFriendlyMessage(error: Error): string {
  // AppErrorの場合はそのままメッセージを使用
  if (error instanceof AppError) {
    return error.message;
  }
  
  // エラー名からマッピングを検索
  const errorName = error.name;
  if (ERROR_MESSAGE_MAP[errorName]) {
    return ERROR_MESSAGE_MAP[errorName];
  }
  
  // デフォルトメッセージ
  return ERROR_MESSAGE_MAP['default'];
}

/**
 * エラーレスポンスの構造
 */
export interface ErrorResponse {
  success: false;
  error: {
    type: string;
    message: string;
    category: ErrorCategory;
    requestId?: string;
    timestamp: string;
  };
  // 開発環境でのみ詳細情報を含める
  details?: {
    originalError: string;
    stack?: string;
  };
}

/**
 * エラーレスポンスを生成
 */
export function createErrorResponse(
  error: Error,
  requestId?: string,
  includeDetails: boolean = false
): ErrorResponse {
  const category = categorizeError(error);
  const message = getUserFriendlyMessage(error);
  
  const response: ErrorResponse = {
    success: false,
    error: {
      type: error.name,
      message,
      category,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
  
  // 開発環境でのみ詳細情報を含める
  if (includeDetails || process.env.NODE_ENV === 'development') {
    response.details = {
      originalError: error.message,
      stack: error.stack,
    };
  }
  
  return response;
}

/**
 * Lambda関数用のエラーハンドラーラッパー
 * すべてのLambda関数でこのラッパーを使用することで統一されたエラーハンドリングを実現
 */
export function withErrorHandler<TEvent, TResult>(
  handler: (event: TEvent) => Promise<TResult>,
  logger: Logger
): (event: TEvent) => Promise<TResult | APIGatewayProxyResult> {
  return async (event: TEvent): Promise<TResult | APIGatewayProxyResult> => {
    try {
      return await handler(event);
    } catch (error) {
      const err = error as Error;
      const category = categorizeError(err);
      const statusCode = getStatusCode(err);
      
      // ログレベルを決定
      if (category === ErrorCategory.CLIENT_ERROR) {
        logger.warn('クライアントエラーが発生', { error: err.message, category });
      } else if (isOperationalError(err)) {
        logger.error('操作エラーが発生', err, { category });
      } else {
        logger.error('予期しないエラーが発生', err, { category });
      }
      
      // エラーレスポンスを生成
      const errorResponse = createErrorResponse(
        err,
        undefined,
        process.env.NODE_ENV === 'development'
      );
      
      // API Gateway形式のレスポンスを返す
      return {
        statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify(errorResponse),
      } as APIGatewayProxyResult;
    }
  };
}

/**
 * Step Functions用のエラーハンドラー
 * Step Functionsから呼び出されるLambda関数用
 */
export async function handleStepFunctionError(
  error: Error,
  logger: Logger,
  context: Record<string, any>
): Promise<never> {
  const category = categorizeError(error);
  
  // ログ記録
  logger.error('Step Function処理中にエラーが発生', error, {
    category,
    ...context,
  });
  
  // エラーを再スロー（Step Functionsがキャッチして処理）
  throw error;
}

/**
 * エラーメトリクスを記録
 * CloudWatch Metricsにカスタムメトリクスを送信
 */
export function recordErrorMetric(
  error: Error,
  functionName: string,
  logger: Logger
): void {
  const category = categorizeError(error);
  const statusCode = getStatusCode(error);
  
  logger.info('エラーメトリクスを記録', {
    metric: 'ErrorCount',
    functionName,
    errorType: error.name,
    errorCategory: category,
    statusCode,
  });
  
  // 実際のメトリクス送信はCloudWatch Embedded Metric Formatを使用
  // ここでは構造化ログとして出力（CloudWatch Logsが自動的にメトリクスに変換）
  console.log(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: 'MeetingMinutesGenerator',
          Dimensions: [['FunctionName', 'ErrorType', 'ErrorCategory']],
          Metrics: [
            { Name: 'ErrorCount', Unit: 'Count' },
          ],
        },
      ],
    },
    FunctionName: functionName,
    ErrorType: error.name,
    ErrorCategory: category,
    ErrorCount: 1,
  }));
}
