# タグ付け戦略

## 概要

このアプリケーションのすべてのAWSリソースには、コスト管理とリソース管理のために統一されたタグが付与されています。

## 適用されるタグ

すべてのリソースに以下のタグが自動的に付与されます：

| タグキー | タグ値 | 説明 |
|---------|--------|------|
| `Application` | `meeting-minutes-generator` | アプリケーション識別子 |
| `Environment` | `dev` / `staging` / `prod` | 環境識別子 |
| `ManagedBy` | `CDK` | 管理ツール |
| `Project` | `meeting-minutes-generator` | プロジェクト名 |
| `CostCenter` | `Development` | コストセンター |
| `Owner` | 環境変数から取得 | 所有者メールアドレス |

## タグ付け対象リソース

### ✅ タグ付け可能なリソース

以下のリソースには自動的にタグが付与されます：

1. **Lambda関数**
   - すべてのLambda関数（8個）
   - 関数ごとのコスト追跡が可能

2. **S3バケット**
   - 入力バケット（音声ファイル）
   - 出力バケット（議事録）
   - ストレージコストの追跡

3. **DynamoDBテーブル**
   - ジョブ管理テーブル
   - 読み書きキャパシティのコスト追跡

4. **API Gateway**
   - REST API
   - APIリクエスト数のコスト追跡

5. **Step Functions**
   - ワークフロー状態マシン
   - 実行回数のコスト追跡

6. **Cognito User Pool**
   - ユーザー認証
   - アクティブユーザー数の追跡

7. **CloudWatch Log Groups**
   - すべてのLambda関数のログ
   - ログストレージコストの追跡

8. **IAM Roles**
   - Lambda実行ロール
   - Step Functions実行ロール
   - Transcribeロール

9. **SNS Topics**
   - アラーム通知トピック

10. **CloudWatch Alarms**
    - エラー率アラーム
    - レイテンシアラーム

11. **Amplify App**
    - フロントエンドホスティング

### ⚠️ タグ付けに制限があるリソース

以下のリソースはタグ付けに制限があります：

1. **Amazon Transcribe**
   - ジョブ単位でのタグ付けは可能
   - サービス全体へのタグ付けは不可
   - 対応：ジョブ作成時に個別にタグを付与

2. **Amazon Bedrock**
   - モデル呼び出しにはタグ付け不可
   - 対応：CloudWatch Logsでコスト追跡

3. **CloudWatch Dashboards**
   - タグ付け非対応
   - 対応：命名規則で識別

4. **API Gateway Deployment/Stage**
   - REST API自体にはタグ付け可能
   - Deployment/Stageには個別タグ不可

## タグの設定方法

### CDKでの設定

`bin/meeting-minutes-app.ts`で一括設定：

```typescript
// Add tags to all resources
cdk.Tags.of(app).add('Application', 'meeting-minutes-generator');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Project', 'meeting-minutes-generator');
cdk.Tags.of(app).add('CostCenter', 'Development');
cdk.Tags.of(app).add('Owner', process.env.OWNER_EMAIL || 'admin');
```

### タグの確認

タグが正しく適用されているか確認：

```bash
# すべてのリソースのタグを確認
./scripts/verify-tags.ps1

# 特定のリソースのタグを確認
aws lambda list-tags --resource <function-arn>
aws s3api get-bucket-tagging --bucket <bucket-name>
aws dynamodb list-tags-of-resource --resource-arn <table-arn>
```

## コスト管理での活用

### Cost Explorerでのフィルタリング

AWS Cost Explorerで以下のタグを使用してコストを分析：

```
Tag: Application = meeting-minutes-generator
```

これにより、このアプリケーション全体のコストを追跡できます。

### コスト配分タグの有効化

1. AWS Billing Consoleにアクセス
2. Cost Allocation Tags を開く
3. `Application` タグを有効化
4. 24時間後にCost Explorerで利用可能

## ベストプラクティス

1. **一貫性**: すべてのリソースに同じタグを適用
2. **自動化**: CDKで自動的にタグを付与
3. **検証**: デプロイ後にタグを確認
4. **ドキュメント化**: タグの意味と用途を文書化

## 関連スクリプト

- `scripts/verify-tags.ps1` - タグの確認
- `scripts/check-costs.ps1` - コストの確認（タグでフィルタ）

## 参考リンク

- [AWS Tagging Best Practices](https://docs.aws.amazon.com/general/latest/gr/aws_tagging.html)
- [CDK Tagging](https://docs.aws.amazon.com/cdk/v2/guide/tagging.html)
- [Cost Allocation Tags](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html)
