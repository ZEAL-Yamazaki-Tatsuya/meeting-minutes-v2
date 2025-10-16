/**
 * CloudWatchメトリクス用のヘルパーユーティリティ
 * カスタムメトリクスの定義と記録を簡素化
 */

import { Logger } from './logger';

/**
 * メトリクス名の定数
 */
export const MetricNames = {
  // API関連
  API_REQUEST_COUNT: 'ApiRequestCount',
  API_REQUEST_DURATION: 'ApiRequestDuration',
  API_ERROR_COUNT: 'ApiErrorCount',
  
  // 処理関連
  PROCESSING_DURATION: 'ProcessingDuration',
  OPERATION_SUCCESS: 'OperationSuccess',
  OPERATION_COUNT: 'OperationCount',
  
  // ビジネスメトリクス
  UPLOAD_FILE_SIZE: 'UploadFileSize',
  VIDEO_DURATION: 'VideoDuration',
  DECISIONS_COUNT: 'DecisionsCount',
  NEXT_ACTIONS_COUNT: 'NextActionsCount',
  TRANSCRIBE_JOB_COUNT: 'TranscribeJobCount',
  MINUTES_GENERATED_COUNT: 'MinutesGeneratedCount',
  
  // エラー関連
  ERROR_COUNT: 'ErrorCount',
  ERROR_RATE: 'ErrorRate',
  
  // ジョブステータス
  JOB_STATUS_CHANGE: 'JobStatusChange',
  JOB_COMPLETION_TIME: 'JobCompletionTime',
} as const;

/**
 * ディメンション名の定数
 */
export const DimensionNames = {
  ENVIRONMENT: 'Environment',
  COMPONENT: 'Component',
  FUNCTION_NAME: 'FunctionName',
  METHOD: 'Method',
  STATUS_CODE: 'StatusCode',
  ERROR_TYPE: 'ErrorType',
  ERROR_CATEGORY: 'ErrorCategory',
  OPERATION: 'Operation',
  STATUS: 'Status',
  JOB_STATUS: 'JobStatus',
} as const;

/**
 * メトリクスレコーダークラス
 * 特定のコンポーネント用のメトリクス記録を簡素化
 */
export class MetricsRecorder {
  private logger: Logger;
  private component: string;

  constructor(logger: Logger, component: string) {
    this.logger = logger;
    this.component = component;
  }

  /**
   * API リクエストメトリクスを記録
   */
  recordApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number
  ): void {
    this.logger.logApiRequest(method, path, statusCode, duration, {
      component: this.component,
    });
  }

  /**
   * 処理時間メトリクスを記録
   */
  recordProcessingDuration(
    operation: string,
    duration: number,
    additionalDimensions?: Record<string, string>
  ): void {
    this.logger.recordMetric({
      name: MetricNames.PROCESSING_DURATION,
      value: duration,
      unit: 'Milliseconds',
      dimensions: {
        [DimensionNames.COMPONENT]: this.component,
        [DimensionNames.OPERATION]: operation,
        ...additionalDimensions,
      },
    });
  }

  /**
   * 成功/失敗メトリクスを記録
   */
  recordOperationResult(
    operation: string,
    success: boolean,
    additionalDimensions?: Record<string, string>
  ): void {
    this.logger.recordSuccessMetric(operation, success, {
      component: this.component,
      ...additionalDimensions,
    });
  }

  /**
   * エラーメトリクスを記録
   */
  recordError(
    errorType: string,
    errorCategory: string,
    additionalDimensions?: Record<string, string>
  ): void {
    this.logger.recordMetric({
      name: MetricNames.ERROR_COUNT,
      value: 1,
      unit: 'Count',
      dimensions: {
        [DimensionNames.COMPONENT]: this.component,
        [DimensionNames.ERROR_TYPE]: errorType,
        [DimensionNames.ERROR_CATEGORY]: errorCategory,
        ...additionalDimensions,
      },
    });
  }

  /**
   * ジョブステータス変更メトリクスを記録
   */
  recordJobStatusChange(
    fromStatus: string,
    toStatus: string,
    jobId: string
  ): void {
    this.logger.recordMetric({
      name: MetricNames.JOB_STATUS_CHANGE,
      value: 1,
      unit: 'Count',
      dimensions: {
        [DimensionNames.COMPONENT]: this.component,
        FromStatus: fromStatus,
        ToStatus: toStatus,
      },
    });

    this.logger.info('ジョブステータス変更', {
      jobId,
      fromStatus,
      toStatus,
      component: this.component,
    });
  }

  /**
   * ジョブ完了時間メトリクスを記録
   */
  recordJobCompletionTime(
    jobId: string,
    duration: number,
    status: string
  ): void {
    this.logger.recordMetric({
      name: MetricNames.JOB_COMPLETION_TIME,
      value: duration,
      unit: 'Seconds',
      dimensions: {
        [DimensionNames.COMPONENT]: this.component,
        [DimensionNames.JOB_STATUS]: status,
      },
    });

    this.logger.info('ジョブ完了時間を記録', {
      jobId,
      duration,
      status,
      component: this.component,
    });
  }

  /**
   * カスタムビジネスメトリクスを記録
   */
  recordBusinessMetric(
    metricName: string,
    value: number,
    unit: 'Count' | 'Seconds' | 'Milliseconds' | 'Bytes' | 'Percent',
    additionalDimensions?: Record<string, string>
  ): void {
    this.logger.recordBusinessMetric(metricName, value, unit, {
      [DimensionNames.COMPONENT]: this.component,
      ...additionalDimensions,
    });
  }
}

/**
 * メトリクスの集計ヘルパー
 */
export class MetricsAggregator {
  private metrics: Map<string, number[]> = new Map();

  /**
   * メトリクス値を追加
   */
  add(metricName: string, value: number): void {
    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }
    this.metrics.get(metricName)!.push(value);
  }

  /**
   * 平均値を計算
   */
  getAverage(metricName: string): number | null {
    const values = this.metrics.get(metricName);
    if (!values || values.length === 0) {
      return null;
    }
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * 最小値を取得
   */
  getMin(metricName: string): number | null {
    const values = this.metrics.get(metricName);
    if (!values || values.length === 0) {
      return null;
    }
    return Math.min(...values);
  }

  /**
   * 最大値を取得
   */
  getMax(metricName: string): number | null {
    const values = this.metrics.get(metricName);
    if (!values || values.length === 0) {
      return null;
    }
    return Math.max(...values);
  }

  /**
   * 合計値を取得
   */
  getSum(metricName: string): number | null {
    const values = this.metrics.get(metricName);
    if (!values || values.length === 0) {
      return null;
    }
    return values.reduce((acc, val) => acc + val, 0);
  }

  /**
   * カウントを取得
   */
  getCount(metricName: string): number {
    const values = this.metrics.get(metricName);
    return values ? values.length : 0;
  }

  /**
   * すべてのメトリクスをクリア
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * 集計結果をログに記録
   */
  logSummary(logger: Logger, prefix: string = ''): void {
    this.metrics.forEach((values, metricName) => {
      logger.info(`${prefix}メトリクス集計: ${metricName}`, {
        count: values.length,
        average: this.getAverage(metricName),
        min: this.getMin(metricName),
        max: this.getMax(metricName),
        sum: this.getSum(metricName),
      });
    });
  }
}

/**
 * パフォーマンストラッカー
 * 複数の処理ステップのパフォーマンスを追跡
 */
export class PerformanceTracker {
  private steps: Map<string, number> = new Map();
  private startTime: number;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.startTime = Date.now();
  }

  /**
   * ステップの開始を記録
   */
  startStep(stepName: string): void {
    this.steps.set(stepName, Date.now());
  }

  /**
   * ステップの終了を記録
   */
  endStep(stepName: string): number {
    const startTime = this.steps.get(stepName);
    if (!startTime) {
      this.logger.warn(`ステップ "${stepName}" の開始時刻が見つかりません`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.logger.info(`ステップ完了: ${stepName}`, {
      duration,
      durationMs: duration,
    });

    return duration;
  }

  /**
   * 全体の処理時間を取得
   */
  getTotalDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * すべてのステップの処理時間をログに記録
   */
  logSummary(context?: Record<string, any>): void {
    const totalDuration = this.getTotalDuration();
    
    this.logger.info('パフォーマンスサマリー', {
      totalDuration,
      totalDurationMs: totalDuration,
      ...context,
    });
  }
}
