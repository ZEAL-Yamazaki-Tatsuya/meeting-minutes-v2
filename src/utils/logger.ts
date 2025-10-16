/**
 * Logger utility for structured logging with CloudWatch integration
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  [key: string]: any;
}

/**
 * 構造化ログエントリの型定義
 */
export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  version?: string;
  requestId?: string;
  userId?: string;
  jobId?: string;
  component?: string;
  duration?: number;
  statusCode?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  [key: string]: any;
}

/**
 * カスタムメトリクスの型定義
 */
export interface CustomMetric {
  name: string;
  value: number;
  unit: 'Count' | 'Seconds' | 'Milliseconds' | 'Bytes' | 'Percent';
  dimensions?: Record<string, string>;
  timestamp?: number;
}

/**
 * CloudWatch Embedded Metric Format (EMF)
 * CloudWatch Logsに出力すると自動的にメトリクスに変換される
 */
interface CloudWatchEMF {
  _aws: {
    Timestamp: number;
    CloudWatchMetrics: Array<{
      Namespace: string;
      Dimensions: string[][];
      Metrics: Array<{
        Name: string;
        Unit: string;
      }>;
    }>;
  };
  [key: string]: any;
}

export class Logger {
  private context: LogContext;
  private service: string;
  private environment: string;
  private version?: string;

  constructor(context: LogContext = {}) {
    this.context = context;
    this.service = process.env.SERVICE_NAME || 'MeetingMinutesGenerator';
    this.environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
    this.version = process.env.VERSION || '1.0.0';
  }

  /**
   * 構造化ログエントリを作成
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    additionalContext?: LogContext
  ): StructuredLogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      environment: this.environment,
      version: this.version,
      ...this.context,
      ...additionalContext,
    };
  }

  /**
   * ログを出力
   */
  private log(level: LogLevel, message: string, additionalContext?: LogContext): void {
    const logEntry = this.createLogEntry(level, message, additionalContext);

    // 構造化JSONとして出力（CloudWatch Logsが自動的にパース）
    const logString = JSON.stringify(logEntry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logString);
        break;
      case LogLevel.INFO:
        console.info(logString);
        break;
      case LogLevel.WARN:
        console.warn(logString);
        break;
      case LogLevel.ERROR:
        console.error(logString);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      } : undefined,
    });
  }

  /**
   * 処理時間を記録
   */
  logDuration(
    message: string,
    startTime: number,
    context?: LogContext
  ): void {
    const duration = Date.now() - startTime;
    this.info(message, {
      ...context,
      duration,
      durationMs: duration,
    });

    // カスタムメトリクスとしても記録
    this.recordMetric({
      name: 'ProcessingDuration',
      value: duration,
      unit: 'Milliseconds',
      dimensions: {
        Component: this.context.component || 'Unknown',
        Environment: this.environment,
      },
    });
  }

  /**
   * APIリクエストを記録
   */
  logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    this.info('API Request', {
      ...context,
      method,
      path,
      statusCode,
      duration,
      durationMs: duration,
    });

    // カスタムメトリクスとして記録
    this.recordMetric({
      name: 'ApiRequestCount',
      value: 1,
      unit: 'Count',
      dimensions: {
        Method: method,
        StatusCode: statusCode.toString(),
        Environment: this.environment,
      },
    });

    this.recordMetric({
      name: 'ApiRequestDuration',
      value: duration,
      unit: 'Milliseconds',
      dimensions: {
        Method: method,
        Path: path,
        Environment: this.environment,
      },
    });
  }

  /**
   * カスタムメトリクスを記録
   * CloudWatch Embedded Metric Format (EMF) を使用
   */
  recordMetric(metric: CustomMetric): void {
    const emf: CloudWatchEMF = {
      _aws: {
        Timestamp: metric.timestamp || Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: this.service,
            Dimensions: metric.dimensions
              ? [Object.keys(metric.dimensions)]
              : [['Environment']],
            Metrics: [
              {
                Name: metric.name,
                Unit: metric.unit,
              },
            ],
          },
        ],
      },
      Environment: this.environment,
      ...metric.dimensions,
      [metric.name]: metric.value,
    };

    // EMF形式でログ出力（CloudWatch Logsが自動的にメトリクスに変換）
    console.log(JSON.stringify(emf));
  }

  /**
   * 成功率メトリクスを記録
   */
  recordSuccessMetric(operation: string, success: boolean, context?: LogContext): void {
    this.info(`Operation ${success ? 'succeeded' : 'failed'}: ${operation}`, {
      ...context,
      operation,
      success,
    });

    this.recordMetric({
      name: 'OperationSuccess',
      value: success ? 1 : 0,
      unit: 'Count',
      dimensions: {
        Operation: operation,
        Status: success ? 'Success' : 'Failure',
        Environment: this.environment,
      },
    });

    this.recordMetric({
      name: 'OperationCount',
      value: 1,
      unit: 'Count',
      dimensions: {
        Operation: operation,
        Environment: this.environment,
      },
    });
  }

  /**
   * ビジネスメトリクスを記録
   */
  recordBusinessMetric(
    metricName: string,
    value: number,
    unit: CustomMetric['unit'],
    dimensions?: Record<string, string>
  ): void {
    this.recordMetric({
      name: metricName,
      value,
      unit,
      dimensions: {
        ...dimensions,
        Environment: this.environment,
      },
    });
  }

  /**
   * 新しいコンテキストを追加したLoggerインスタンスを作成
   */
  withContext(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * リクエストIDを追加したLoggerインスタンスを作成
   */
  withRequestId(requestId: string): Logger {
    return this.withContext({ requestId });
  }

  /**
   * ユーザーIDを追加したLoggerインスタンスを作成
   */
  withUserId(userId: string): Logger {
    return this.withContext({ userId });
  }

  /**
   * ジョブIDを追加したLoggerインスタンスを作成
   */
  withJobId(jobId: string): Logger {
    return this.withContext({ jobId });
  }
}

// Default logger instance
export const logger = new Logger();

/**
 * パフォーマンス測定用のヘルパー関数
 */
export function measurePerformance<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  return fn()
    .then((result) => {
      logger.logDuration(`${operation} completed`, startTime);
      logger.recordSuccessMetric(operation, true);
      return result;
    })
    .catch((error) => {
      logger.logDuration(`${operation} failed`, startTime);
      logger.recordSuccessMetric(operation, false);
      throw error;
    });
}
