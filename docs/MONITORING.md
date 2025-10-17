# モニタリングとアラート設定ガイド

このドキュメントでは、Meeting Minutes Generatorのモニタリングとアラート設定について説明します。

## 概要

システムは以下のモニタリングツールを使用しています：

- **CloudWatch Logs**: すべてのLambda関数とStep Functionsのログ
- **CloudWatch Metrics**: カスタムメトリクスとAWSサービスメトリクス
- **CloudWatch Alarms**: エラー率、レイテンシ、スロットリングのアラート
- **CloudWatch Dashboard**: システム全体の可視化
- **AWS X-Ray**: 分散トレーシングとパフォーマンス分析

## CloudWatchダッシュボード

### アクセス方法

1. AWSコンソールにログイン
2. CloudWatchサービスに移動
3. 左側のメニューから「ダッシュボード」を選択
4. `meeting-minutes-generator-{environment}`ダッシュボードを開く

または、CDKデプロイ後に出力されるURLから直接アクセスできます。

### ダッシュボードの構成

ダッシュボードは以下のセクションで構成されています：

#### 1. Lambda Functions - Errors
各Lambda関数のエラー数を表示します。

- Upload Handler
- Transcribe Trigger
- Check Transcribe Status
- Minutes Generator
- Get Job Status
- List Jobs
- Get Minutes
- Download Minutes
- Start Processing

#### 2. Lambda Functions - Duration
各Lambda関数の平均実行時間を表示します。

#### 3. Lambda Functions - Invocations
各Lambda関数の呼び出し回数とスロットリング数を表示します。

#### 4. API Gateway
API Gatewayのメトリクスを表示します。

- リクエスト数
- 4xxエラー数
- 5xxエラー数
- レイテンシ

#### 5. Step Functions Workflow
Step Functionsワークフローのメトリクスを表示します。

- 開始された実行数
- 成功した実行数
- 失敗した実行数
- タイムアウトした実行数
- 平均実行時間

#### 6. System Metrics
システム全体のカスタムメトリクスを表示します。

- 処理成功率
- 平均処理時間
- アクティブジョブ数

## CloudWatchアラーム

### アラームの種類

#### Lambda関数のアラーム

各Lambda関数に対して以下のアラームが設定されています：

1. **エラーアラーム**
   - 条件: 5分間で5回以上のエラー
   - アクション: SNSトピックに通知

2. **レイテンシアラーム**
   - 条件: 平均実行時間が30秒を超える（2回連続）
   - アクション: SNSトピックに通知

3. **スロットリングアラーム**
   - 条件: スロットリングが1回以上発生
   - アクション: SNSトピックに通知

#### API Gatewayのアラーム

1. **5xxエラーアラーム**
   - 条件: 5分間で5回以上の5xxエラー
   - アクション: SNSトピックに通知

2. **レイテンシアラーム**
   - 条件: 平均レイテンシが5秒を超える（2回連続）
   - アクション: SNSトピックに通知

#### Step Functionsのアラーム

1. **失敗アラーム**
   - 条件: 5分間で3回以上の失敗
   - アクション: SNSトピックに通知

2. **タイムアウトアラーム**
   - 条件: タイムアウトが1回以上発生
   - アクション: SNSトピックに通知

#### システム全体のアラーム

1. **成功率アラーム**
   - 条件: 処理成功率が80%を下回る（2回連続）
   - アクション: SNSトピックに通知

### アラート通知の設定

アラート通知を受け取るには、環境変数`ALERT_EMAIL`にメールアドレスを設定します。

```bash
# .envファイルに追加
ALERT_EMAIL=your-email@example.com
```

デプロイ後、指定したメールアドレスにSNSサブスクリプション確認メールが送信されます。メール内のリンクをクリックして確認を完了してください。

## AWS X-Ray

### X-Rayトレーシングの有効化

すべてのLambda関数とStep Functionsでは、X-Rayトレーシングが自動的に有効化されています。

### X-Rayコンソールへのアクセス

1. AWSコンソールにログイン
2. X-Rayサービスに移動
3. 左側のメニューから「トレース」を選択
4. フィルターを使用して特定のリクエストを検索

### トレースの分析

X-Rayトレースを使用して以下を分析できます：

- リクエストの全体的なレイテンシ
- 各サービス（Lambda、DynamoDB、S3、Transcribe、Bedrock）の実行時間
- エラーの発生箇所
- ボトルネックの特定

### サービスマップ

X-Rayサービスマップを使用して、システムのアーキテクチャと依存関係を可視化できます。

## カスタムメトリクスの記録

Lambda関数からカスタムメトリクスを記録するには、以下のコードを使用します：

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });

async function recordMetric(metricName: string, value: number, unit: string = 'None') {
  const namespace = `${process.env.APP_NAME}/${process.env.ENVIRONMENT}`;
  
  await cloudwatch.send(new PutMetricDataCommand({
    Namespace: namespace,
    MetricData: [
      {
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
      },
    ],
  }));
}

// 使用例
await recordMetric('ProcessingSuccessRate', 0.95, 'None');
await recordMetric('AverageProcessingTime', 120, 'Seconds');
await recordMetric('ActiveJobs', 5, 'Count');
```

## ログの確認

### CloudWatch Logsへのアクセス

1. AWSコンソールにログイン
2. CloudWatchサービスに移動
3. 左側のメニューから「ログ」→「ロググループ」を選択
4. 確認したいLambda関数のロググループを選択

### ロググループの命名規則

- Lambda関数: `/aws/lambda/{appName}-{functionName}-{environment}`
- Step Functions: `/aws/vendedlogs/states/{appName}-workflow-{environment}`

### ログの検索

CloudWatch Logs Insightsを使用して、ログを効率的に検索できます。

#### エラーログの検索

```
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

#### 特定のジョブIDのログ検索

```
fields @timestamp, @message
| filter @message like /jobId: {your-job-id}/
| sort @timestamp desc
```

#### レイテンシの分析

```
fields @timestamp, @duration
| stats avg(@duration), max(@duration), min(@duration) by bin(5m)
```

## トラブルシューティング

### アラームが頻繁に発火する場合

1. CloudWatchダッシュボードで該当するメトリクスを確認
2. X-Rayトレースでボトルネックを特定
3. CloudWatch Logsでエラーメッセージを確認
4. 必要に応じてLambda関数のメモリやタイムアウトを調整

### メトリクスが表示されない場合

1. Lambda関数が実行されているか確認
2. IAMロールに適切な権限があるか確認
3. CloudWatchエージェントが正しく設定されているか確認

### X-Rayトレースが表示されない場合

1. Lambda関数でX-Rayトレーシングが有効化されているか確認
2. IAMロールに`AWSXRayDaemonWriteAccess`ポリシーがアタッチされているか確認
3. X-Ray SDKが正しくインストールされているか確認

## ベストプラクティス

1. **定期的なダッシュボードの確認**: 毎日または毎週、ダッシュボードを確認してシステムの健全性を監視
2. **アラートの調整**: 誤検知が多い場合は、アラームの閾値を調整
3. **ログの保持期間**: 本番環境では、ログの保持期間を30日以上に設定することを推奨
4. **カスタムメトリクスの活用**: ビジネスメトリクス（処理成功率、平均処理時間など）を記録して可視化
5. **X-Rayサンプリングレート**: トラフィックが多い場合は、サンプリングレートを調整してコストを最適化

## コスト最適化

### CloudWatchのコスト

- **ログの保持期間**: 開発環境では1週間、本番環境では30日に設定
- **メトリクスの頻度**: 必要最小限のメトリクスのみを記録
- **ダッシュボード**: 必要なウィジェットのみを表示

### X-Rayのコスト

- **サンプリングレート**: デフォルトでは全リクエストをトレース。トラフィックが多い場合は、サンプリングレートを調整
- **トレースの保持期間**: デフォルトでは30日。必要に応じて短縮

## 参考リンク

- [AWS CloudWatch ドキュメント](https://docs.aws.amazon.com/cloudwatch/)
- [AWS X-Ray ドキュメント](https://docs.aws.amazon.com/xray/)
- [CloudWatch Logs Insights クエリ構文](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
- [X-Ray サンプリングルール](https://docs.aws.amazon.com/xray/latest/devguide/xray-console-sampling.html)
