/**
 * 既存議事録の summaryPreview をバッチ処理で追加するスクリプト
 * 
 * 使用方法:
 * npx ts-node scripts/migrate-summary-preview.ts
 * 
 * 環境変数:
 * - JOBS_TABLE_NAME: DynamoDB テーブル名
 * - OUTPUT_BUCKET_NAME: 議事録が保存されている S3 バケット名
 * - AWS_REGION: AWS リージョン
 * - DRY_RUN: true の場合、実際の更新は行わない（デフォルト: false）
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config();

// 環境変数の取得
const JOBS_TABLE_NAME = process.env.JOBS_TABLE_NAME || '';
const OUTPUT_BUCKET_NAME = process.env.OUTPUT_BUCKET_NAME || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const DRY_RUN = process.env.DRY_RUN === 'true';

// クライアントの初期化
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});
const s3Client = new S3Client({ region: AWS_REGION });

interface MeetingJob {
  jobId: string;
  userId: string;
  status: string;
  minutesS3Key?: string;
  summaryPreview?: string;
}

/**
 * S3 から議事録ファイルを取得する
 */
async function getMinutesFromS3(s3Key: string): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: OUTPUT_BUCKET_NAME,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('S3 response body is empty');
    }

    // Stream を string に変換
    const bodyContents = await response.Body.transformToString('utf-8');
    return bodyContents;
  } catch (error) {
    console.error(`S3 からの取得に失敗: ${s3Key}`, error);
    throw error;
  }
}

/**
 * Markdown から概要を抽出する
 */
function extractSummaryFromMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  let inSummarySection = false;
  let inOverallSummary = false;
  const summaryLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 概要セクションの開始
    if (trimmedLine.startsWith('## 概要')) {
      inSummarySection = true;
      continue;
    }

    // 全体概要セクションの開始
    if (inSummarySection && trimmedLine.startsWith('### 全体概要')) {
      inOverallSummary = true;
      continue;
    }

    // 次のセクションに到達したら終了
    if (inOverallSummary && (trimmedLine.startsWith('###') || trimmedLine.startsWith('##'))) {
      break;
    }

    // 全体概要の内容を収集
    if (inOverallSummary && trimmedLine && !trimmedLine.startsWith('#')) {
      summaryLines.push(trimmedLine);
    }
  }

  return summaryLines.join(' ');
}

/**
 * 概要の最初の200文字を抽出する（一覧表示用）
 */
function extractSummaryPreview(summary: string): string {
  if (!summary) {
    return '';
  }

  // 改行や余分な空白を削除
  const cleanedSummary = summary.replace(/\s+/g, ' ').trim();

  // 200文字以内の場合はそのまま返す
  if (cleanedSummary.length <= 200) {
    return cleanedSummary;
  }

  // 200文字で切り詰めて「...」を追加
  return cleanedSummary.substring(0, 200) + '...';
}

/**
 * DynamoDB を更新する
 */
async function updateJobSummaryPreview(
  jobId: string,
  userId: string,
  summaryPreview: string
): Promise<void> {
  if (DRY_RUN) {
    console.log(`[DRY RUN] 更新をスキップ: ${jobId}`);
    return;
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: JOBS_TABLE_NAME,
        Key: {
          jobId,
          userId,
        },
        UpdateExpression: 'SET summaryPreview = :summaryPreview, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':summaryPreview': summaryPreview,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );
    console.log(`✓ 更新完了: ${jobId}`);
  } catch (error) {
    console.error(`✗ 更新失敗: ${jobId}`, error);
    throw error;
  }
}

/**
 * 全ジョブをスキャンして処理する
 */
async function processAllJobs(): Promise<void> {
  console.log('='.repeat(60));
  console.log('既存議事録の summaryPreview マイグレーション');
  console.log('='.repeat(60));
  console.log(`テーブル名: ${JOBS_TABLE_NAME}`);
  console.log(`バケット名: ${OUTPUT_BUCKET_NAME}`);
  console.log(`リージョン: ${AWS_REGION}`);
  console.log(`DRY RUN: ${DRY_RUN ? 'はい（実際の更新は行いません）' : 'いいえ'}`);
  console.log('='.repeat(60));
  console.log('');

  let processedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    // DynamoDB をスキャン
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: JOBS_TABLE_NAME,
        FilterExpression: '#status = :completed',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':completed': 'COMPLETED',
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const jobs = (scanResult.Items || []) as MeetingJob[];

    for (const job of jobs) {
      processedCount++;
      console.log(`\n[${processedCount}] 処理中: ${job.jobId}`);

      // すでに summaryPreview が存在する場合はスキップ
      if (job.summaryPreview) {
        console.log(`  → スキップ: summaryPreview が既に存在します`);
        skippedCount++;
        continue;
      }

      // minutesS3Key が存在しない場合はスキップ
      if (!job.minutesS3Key) {
        console.log(`  → スキップ: minutesS3Key が存在しません`);
        skippedCount++;
        continue;
      }

      try {
        // S3 から議事録を取得
        console.log(`  → S3 から取得中: ${job.minutesS3Key}`);
        const minutesContent = await getMinutesFromS3(job.minutesS3Key);

        // 概要を抽出
        const summary = extractSummaryFromMarkdown(minutesContent);
        if (!summary) {
          console.log(`  → スキップ: 概要が見つかりませんでした`);
          skippedCount++;
          continue;
        }

        // 概要プレビューを生成
        const summaryPreview = extractSummaryPreview(summary);
        console.log(`  → 概要プレビュー: ${summaryPreview.substring(0, 50)}...`);

        // DynamoDB を更新
        await updateJobSummaryPreview(job.jobId, job.userId, summaryPreview);
        updatedCount++;
      } catch (error) {
        console.error(`  ✗ エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
        errorCount++;
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // 結果サマリー
  console.log('');
  console.log('='.repeat(60));
  console.log('マイグレーション完了');
  console.log('='.repeat(60));
  console.log(`処理したジョブ数: ${processedCount}`);
  console.log(`更新したジョブ数: ${updatedCount}`);
  console.log(`スキップしたジョブ数: ${skippedCount}`);
  console.log(`エラー数: ${errorCount}`);
  console.log('='.repeat(60));
}

/**
 * メイン処理
 */
async function main() {
  // 環境変数のチェック
  if (!JOBS_TABLE_NAME) {
    console.error('エラー: JOBS_TABLE_NAME 環境変数が設定されていません');
    process.exit(1);
  }

  if (!OUTPUT_BUCKET_NAME) {
    console.error('エラー: OUTPUT_BUCKET_NAME 環境変数が設定されていません');
    process.exit(1);
  }

  try {
    await processAllJobs();
    console.log('\n✓ マイグレーションが正常に完了しました');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ マイグレーションが失敗しました:', error);
    process.exit(1);
  }
}

// スクリプトを実行
main();
