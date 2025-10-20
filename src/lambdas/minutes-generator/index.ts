/**
 * Minutes Generator Lambda Function
 * 文字起こし結果から議事録を生成してS3に保存する
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { TranscriptParser } from '../../utils/transcript-parser';
import { BedrockClient } from '../../utils/bedrock-client';
import { MeetingJobRepository } from '../../repositories/meeting-job-repository';
import { Logger } from '../../utils/logger';
import { Minutes } from '../../models/minutes';
import { handleStepFunctionError, recordErrorMetric } from '../../utils/error-handler';

const logger = new Logger({ lambda: 'minutes-generator' });

// 環境変数
const TABLE_NAME = process.env.JOBS_TABLE_NAME || process.env.TABLE_NAME || '';
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET_NAME || process.env.OUTPUT_BUCKET || '';
const INPUT_BUCKET = process.env.INPUT_BUCKET_NAME || process.env.INPUT_BUCKET || '';

// クライアントの初期化（テスト時に上書き可能）
let s3Client: S3Client;
let transcriptParser: TranscriptParser;
let bedrockClient: BedrockClient;
let repository: MeetingJobRepository;

// 依存性注入用の関数（テスト用）
export function initializeDependencies(
  s3?: S3Client,
  parser?: TranscriptParser,
  bedrock?: BedrockClient,
  repo?: MeetingJobRepository
) {
  s3Client = s3 || new S3Client({});
  transcriptParser = parser || new TranscriptParser(s3Client);
  bedrockClient = bedrock || new BedrockClient();
  repository = repo || new MeetingJobRepository(TABLE_NAME);
}

// デフォルトの初期化
initializeDependencies();

export interface MinutesGeneratorEvent {
  jobId: string;
  userId: string;
  transcriptS3Key: string;
  meetingContext?: {
    meetingType?: string;
    attendees?: string[];
    focusAreas?: string[];
    additionalInstructions?: string;
  };
}

export interface MinutesGeneratorResult {
  jobId: string;
  status: string;
  minutesS3Key: string;
}

/**
 * Lambda handler
 */
export async function handler(event: MinutesGeneratorEvent): Promise<MinutesGeneratorResult> {
  const { jobId, userId, transcriptS3Key, meetingContext } = event;
  const startTime = Date.now();

  logger.info('議事録生成を開始', { jobId, userId, transcriptS3Key, meetingContext });

  try {
    // ステータスを GENERATING に更新
    await repository.updateJobStatus(jobId, userId, 'GENERATING');

    // 1. S3からTranscript JSONを取得して解析
    const transcriptStartTime = Date.now();
    logger.info('Transcript JSONを取得中', { bucket: OUTPUT_BUCKET, transcriptS3Key });
    const transcribeOutput = await transcriptParser.fetchTranscriptFromS3(
      OUTPUT_BUCKET,
      transcriptS3Key
    );

    const parsedTranscript = transcriptParser.parseTranscript(transcribeOutput);
    logger.logDuration('Transcript解析完了', transcriptStartTime, {
      duration: parsedTranscript.duration,
      speakerCount: parsedTranscript.speakerCount,
      segmentCount: parsedTranscript.segments.length,
    });

    // 2. Bedrockを使用して議事録を生成（会議コンテキストを含む）
    const bedrockStartTime = Date.now();
    logger.info('議事録生成を開始', { jobId, meetingContext });
    const minutes = await bedrockClient.generateMinutes(jobId, parsedTranscript, meetingContext);
    logger.logDuration('議事録生成完了', bedrockStartTime, {
      decisionsCount: minutes.decisions.length,
      nextActionsCount: minutes.nextActions.length,
    });

    // ビジネスメトリクス: 決定事項とネクストアクションの数
    logger.recordBusinessMetric('DecisionsCount', minutes.decisions.length, 'Count', {
      Component: 'MinutesGenerator',
    });
    logger.recordBusinessMetric('NextActionsCount', minutes.nextActions.length, 'Count', {
      Component: 'MinutesGenerator',
    });

    // 3. 整形されたTranscriptを生成してminutesオブジェクトに追加
    const formattedTranscript = transcriptParser.formatTranscript(parsedTranscript);
    minutes.formattedTranscript = formattedTranscript;

    // 4. 議事録をMarkdown形式でS3に保存（整形されたTranscriptを含む）
    const minutesS3Key = `${userId}/${jobId}/minutes.md`;
    const markdownContent = formatMinutesAsMarkdown(minutes, formattedTranscript);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: OUTPUT_BUCKET,
        Key: minutesS3Key,
        Body: markdownContent,
        ContentType: 'text/markdown',
      })
    );

    logger.info('議事録をS3に保存', { minutesS3Key });

    // 5. 整形されたTranscriptもテキストファイルとして保存
    const transcriptTextS3Key = `${userId}/${jobId}/transcript.txt`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: OUTPUT_BUCKET,
        Key: transcriptTextS3Key,
        Body: formattedTranscript,
        ContentType: 'text/plain',
      })
    );

    logger.info('整形されたTranscriptをS3に保存', { transcriptTextS3Key });

    // 5. DynamoDBのジョブステータスを COMPLETED に更新
    await repository.updateJob({
      jobId,
      userId,
      status: 'COMPLETED',
      minutesS3Key,
      videoDuration: parsedTranscript.duration,
    });

    // 全体の処理時間を記録
    logger.logDuration('議事録生成処理が完了', startTime, { jobId, minutesS3Key });

    // 成功メトリクスを記録
    logger.recordSuccessMetric('MinutesGenerator', true, {
      jobId,
      userId,
    });

    // ビジネスメトリクス: 動画の長さ
    logger.recordBusinessMetric('VideoDuration', parsedTranscript.duration, 'Seconds', {
      Component: 'MinutesGenerator',
    });

    return {
      jobId,
      status: 'COMPLETED',
      minutesS3Key,
    };
  } catch (error) {
    const err = error as Error;
    
    // 処理時間を記録（失敗時も）
    logger.logDuration('議事録生成処理が失敗', startTime, { jobId, userId });

    // 成功メトリクスを記録（失敗）
    logger.recordSuccessMetric('MinutesGenerator', false, {
      jobId,
      userId,
      errorType: err.name,
    });

    // エラーメトリクスを記録
    recordErrorMetric(err, 'MinutesGenerator', logger);

    // エラー情報をDynamoDBに記録
    try {
      await repository.updateJobStatus(
        jobId,
        userId,
        'FAILED',
        `議事録生成エラー: ${err.message}`
      );
    } catch (updateError) {
      logger.error('ステータス更新に失敗', updateError as Error, { jobId, userId });
    }

    // Step Functions用のエラーハンドリング
    return await handleStepFunctionError(err, logger, { jobId, userId, transcriptS3Key });
  }
}

/**
 * 議事録をMarkdown形式にフォーマットする
 */
function formatMinutesAsMarkdown(minutes: Minutes, formattedTranscript: string): string {
  let markdown = `# 議事録\n\n`;
  markdown += `**生成日時**: ${new Date(minutes.generatedAt).toLocaleString('ja-JP')}\n\n`;

  // 概要
  markdown += `## 概要\n\n`;
  markdown += `${minutes.summary}\n\n`;

  // 決定事項
  markdown += `## 決定事項\n\n`;
  if (minutes.decisions.length === 0) {
    markdown += `決定事項はありません。\n\n`;
  } else {
    minutes.decisions.forEach((decision, index) => {
      markdown += `${index + 1}. ${decision.description}`;
      if (decision.timestamp) {
        markdown += ` (${decision.timestamp})`;
      }
      markdown += `\n`;
    });
    markdown += `\n`;
  }

  // ネクストアクション
  markdown += `## ネクストアクション\n\n`;
  if (minutes.nextActions.length === 0) {
    markdown += `ネクストアクションはありません。\n\n`;
  } else {
    minutes.nextActions.forEach((action, index) => {
      markdown += `${index + 1}. ${action.description}\n`;
      markdown += `   - **担当**: ${action.assignee || '不明'}\n`;
      markdown += `   - **期限**: ${action.dueDate || '不明'}\n`;
      markdown += `   - **タイムスタンプ**: ${action.timestamp || '不明'}\n`;
      markdown += `\n`;
    });
  }

  // 文字起こし全文（話者とタイムスタンプ付きで段落分け）
  markdown += `## 文字起こし全文\n\n`;
  markdown += `${formattedTranscript}\n`;

  return markdown;
}
