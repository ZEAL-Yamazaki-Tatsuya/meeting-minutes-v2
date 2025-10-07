/**
 * S3 Upload Trigger Lambda
 * S3にファイルがアップロードされたときにStep Functionsワークフローを起動する
 */

import { S3Event } from 'aws-lambda';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { Logger } from '../../utils/logger';

const logger = new Logger({ component: 'S3UploadTrigger' });

// 環境変数
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!;

// クライアントの初期化
const sfnClient = new SFNClient({});

/**
 * Lambda ハンドラー
 */
export async function handler(event: S3Event): Promise<void> {
  logger.info('S3アップロードイベント受信', {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    try {
      // S3イベントの詳細を取得
      const bucketName = record.s3.bucket.name;
      const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      const fileSize = record.s3.object.size;

      logger.info('S3オブジェクト情報', {
        bucketName,
        s3Key,
        fileSize,
      });

      // S3キーからuserIdとjobIdを抽出
      // 形式: userId/timestamp_fileName.mp4
      const keyParts = s3Key.split('/');
      if (keyParts.length < 2) {
        logger.warn('無効なS3キー形式', { s3Key });
        continue;
      }

      const userId = keyParts[0];
      const fileName = keyParts[keyParts.length - 1];

      // timestampとfileNameを分離
      // 形式: timestamp_fileName.mp4
      const fileNameParts = fileName.split('_');
      if (fileNameParts.length < 2) {
        logger.warn('無効なファイル名形式', { fileName });
        continue;
      }

      const timestamp = fileNameParts[0];
      const originalFileName = fileNameParts.slice(1).join('_');

      // jobIdを生成（repositoryと同じロジック）
      // 注: 実際のjobIdはDynamoDBから取得する必要があるが、
      // ここでは簡易的にtimestampベースで生成
      // より正確には、S3キーにjobIdを含めるか、DynamoDBをクエリする必要がある

      // Step Functionsの入力データを準備
      const input = {
        userId,
        s3Key,
        bucketName,
        fileName: originalFileName,
        fileSize,
        timestamp,
      };

      // Step Functionsワークフローを起動
      const executionName = `execution-${userId}-${timestamp}`;
      const command = new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        name: executionName,
        input: JSON.stringify(input),
      });

      const result = await sfnClient.send(command);

      logger.info('Step Functionsワークフロー起動成功', {
        executionArn: result.executionArn,
        userId,
        s3Key,
      });
    } catch (error) {
      logger.error('Step Functionsワークフロー起動失敗', error as Error, {
        record,
      });
      // エラーが発生しても他のレコードの処理を続行
    }
  }
}
