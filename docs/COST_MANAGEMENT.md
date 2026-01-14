# コスト管理ガイド

## 概要

このドキュメントでは、Meeting Minutes Generatorアプリケーションのコストを監視・管理する方法を説明します。

## リソースタグ付け戦略

すべてのAWSリソースには、コスト追跡のために以下のタグが付与されています：

### グローバルタグ（すべてのリソースに適用）
- **Application**: `meeting-minutes-generator`
- **Environment**: `dev` / `prod`
- **ManagedBy**: `CDK`
- **Project**: `meeting-minutes-generator`
- **CostCenter**: `Development`
- **Owner**: `OWNER_EMAIL`環境変数から取得

### スタック固有のタグ
- **Stack**: `Storage` / `Auth` / `Compute` / `Frontend`
- **Component**: `Backend` / `Frontend` / `Security`
- **Service**: サービス名（例：`Amplify`、`Lambda`、`S3`）

## コスト監視

### 1. クイックコストチェック

当月のコストを確認：

```powershell
.\scripts\check-costs.ps1
```

### 2. タグ別コスト確認

アプリケーションタグでフィルタリングしたコストを確認：

```powershell
.\scripts\check-costs-by-tags.ps1
```

### 3. 全サービスレポート

すべてのサービスの詳細な内訳を表示：

```powershell
.\scripts\check-all-services.ps1
```

## コスト配分タグの有効化

タグベースのコストフィルタリングを使用するには、コスト配分タグを有効化する必要があります：

1. [AWS Billing - コスト配分タグ](https://console.aws.amazon.com/billing/home#/tags)にアクセス
2. 以下のタグを有効化：
   - `Application`
   - `Environment`
   - `Stack`
   - `Component`
   - `Project`
   - `CostCenter`
   - `Owner`
3. コストデータが表示されるまで24時間待機

## 予算アラートの設定

メール通知付きの月間予算を作成：

```powershell
.\scripts\setup-budget-alert.ps1 -MonthlyBudget 10 -EmailAddress "your-email@example.com"
```

以下の場合に通知が送信されます：
- 実際のコストが予算の80%を超える
- 予測コストが予算の100%を超える

## Cost Explorer

詳細な分析にはAWS Cost Explorerを使用：
- URL: https://console.aws.amazon.com/cost-management/home#/cost-explorer

### 推奨フィルター
- **Service**: 特定のAWSサービスでフィルタ
- **Tag**: Application、Environment、Stackでフィルタ
- **Time Range**: 日次、月次、カスタム

### 有用なレポート
1. **Cost by Service**: コストが最も高いサービスを特定
2. **Cost by Tag**: スタックまたは環境別にコストを追跡
3. **Daily Costs**: 支出トレンドを監視
4. **Forecast**: 月末のコストを予測

## 予想コスト

### 無料枠サービス（最初の12ヶ月）
- **Lambda**: 月間100万リクエスト、400,000 GB秒
- **API Gateway**: 月間100万リクエスト
- **S3**: 5GBストレージ、20,000 GETリクエスト、2,000 PUTリクエスト
- **DynamoDB**: 25GBストレージ、25読み書き容量ユニット
- **Cognito**: 50,000 MAU（月間アクティブユーザー）
- **Amplify**: 1,000ビルド分、5GBストレージ

### 常に無料のサービス
- **Lambda**: 月間100万リクエスト、400,000 GB秒
- **DynamoDB**: 25GBストレージ、25読み書き容量ユニット
- **Cognito**: 50,000 MAU
- **Step Functions**: 月間4,000ステート遷移

### 従量課金サービス（無料枠なし）

#### Amazon Bedrock（Claude 3.5 Sonnet v2）
- **入力**: 100万トークンあたり$3.00
- **出力**: 100万トークンあたり$15.00
- **例**: 10分の会議（約3,000トークン）= $0.05～0.10

#### Amazon Transcribe
- **標準**: 1分あたり$0.024（最初の12ヶ月は月間60分無料）
- **例**: 1時間の会議 = $1.44

## コスト最適化のヒント

### 1. ライフサイクルポリシーの使用
- 入力ビデオは7日後に自動削除
- 出力ドキュメントは90日後に自動削除

### 2. Bedrockの使用状況を監視
Bedrockが最も高額なサービスです。コストを削減するには：
- より短いプロンプトを使用
- 議事録生成プロンプトを最適化
- テスト用に小さいモデルの使用を検討

### 3. 未使用リソースのクリーンアップ
定期的に以下を確認：
- 古いS3オブジェクト
- 未使用のDynamoDBアイテム
- 失敗した文字起こしジョブ

### 4. 開発環境を賢く使用
- 使用していない場合は開発リソースを削除
- 開発中は小さいテストファイルを使用
- テスト実行の回数を制限

## サービス別コスト内訳

### 高コストサービス（注意が必要）
1. **Amazon Bedrock**: 100万トークンあたり$3～15
2. **Amazon Transcribe**: 1分あたり$0.024

### 中程度のコストサービス
3. **AWS Amplify**: ビルド分とバンド幅
4. **Amazon S3**: ストレージとデータ転送
5. **AWS Lambda**: 無料枠を超える実行時間

### 低コスト/無料サービス
6. **Amazon DynamoDB**: 通常は無料枠内
7. **Amazon API Gateway**: 通常は無料枠内
8. **Amazon Cognito**: 通常は無料枠内
9. **AWS Step Functions**: 通常は無料枠内
10. **Amazon CloudWatch**: ログとメトリクス

## 監視のベストプラクティス

1. **週次でコストを確認**: 毎週`.\scripts\check-costs.ps1`を実行
2. **予算アラートを設定**: 過支出前に通知を受け取る
3. **月次でCost Explorerをレビュー**: トレンドと異常を特定
4. **すべてのリソースにタグを付与**: 適切なコスト配分を確保
5. **定期的にクリーンアップ**: 未使用リソースを削除

## トラブルシューティング

### Cost Explorerにタグが表示されない
- コスト配分タグを有効化してから24～48時間待機
- タグがリソースに正しく適用されているか確認
- タグ有効化後に作成されたリソースか確認

### 予想より高いコスト
1. Bedrock使用状況を確認（最も高額）
2. Transcribe使用状況を確認
3. S3ストレージとデータ転送を確認
4. 複数回リトライされた失敗ジョブを確認

### コストデータが利用できない
- コストデータは24時間の遅延があります
- 正しい期間を確認しているか確認
- リソースが実際に使用されているか確認

## 参考リンク

- [AWS Cost Management](https://aws.amazon.com/aws-cost-management/)
- [AWS 無料利用枠](https://aws.amazon.com/free/)
- [AWS 料金計算ツール](https://calculator.aws/)
- [Bedrock 料金](https://aws.amazon.com/bedrock/pricing/)
- [Transcribe 料金](https://aws.amazon.com/transcribe/pricing/)
