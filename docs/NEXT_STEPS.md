# 次のステップガイド

プロジェクトのすべてのタスクが完了しました！🎉

このドキュメントでは、本番環境への移行と運用開始のための次のステップを説明します。

## 📋 目次

1. [GitHubリポジトリの設定](#1-githubリポジトリの設定)
2. [実際の動作確認](#2-実際の動作確認)
3. [モニタリングの設定](#3-モニタリングの設定)
4. [本番環境へのデプロイ](#4-本番環境へのデプロイ)
5. [運用開始](#5-運用開始)

## 1. GitHubリポジトリの設定

CI/CDパイプラインを有効化するために、GitHubリポジトリの設定を行います。

### 1.1 GitHub Secretsの設定

GitHubリポジトリの **Settings** → **Secrets and variables** → **Actions** で以下を設定：

#### 必須シークレット

| シークレット名 | 説明 | 取得方法 |
|--------------|------|---------|
| `AWS_ACCESS_KEY_ID` | AWSアクセスキーID | IAMユーザーから取得 |
| `AWS_SECRET_ACCESS_KEY` | AWSシークレットアクセスキー | IAMユーザーから取得 |
| `GITHUB_TOKEN` | GitHub Personal Access Token | GitHub設定から生成 |
| `GITHUB_REPO` | GitHubリポジトリURL | `https://github.com/username/repo` |

#### AWS IAMユーザーの作成

```bash
# 1. IAMユーザーを作成
aws iam create-user --user-name github-actions-deploy

# 2. アクセスキーを作成
aws iam create-access-key --user-name github-actions-deploy

# 3. 必要なポリシーをアタッチ（本番環境では最小権限を推奨）
aws iam attach-user-policy \
  --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

**出力例**:
```json
{
    "AccessKey": {
        "AccessKeyId": "AKIAIOSFODNN7EXAMPLE",
        "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    }
}
```

これらの値をGitHub Secretsに保存してください。

#### GitHub Personal Access Tokenの作成

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token (classic)**
3. スコープを選択:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `admin:repo_hook` (Full control of repository hooks)
4. トークンをコピーしてGitHub Secretsに保存

### 1.2 GitHub Environmentsの設定

#### Staging Environment

1. Settings → **Environments** → **New environment**
2. Name: `staging`
3. Protection rules: なし（自動デプロイ）

#### Production Environment

1. Settings → **Environments** → **New environment**
2. Name: `production`
3. Protection rules:
   - ✅ **Required reviewers**: 1人以上
   - ✅ **Wait timer**: 5分
   - ✅ **Deployment branches**: `main`のみ

### 1.3 ブランチ保護ルールの設定

#### mainブランチ

Settings → **Branches** → **Add rule**

- Branch name pattern: `main`
- ✅ Require a pull request before merging
- ✅ Require approvals: 1
- ✅ Require status checks to pass before merging
  - ✅ CI Summary
- ✅ Require branches to be up to date before merging

#### developブランチ

Settings → **Branches** → **Add rule**

- Branch name pattern: `develop`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - ✅ CI Summary

### 1.4 CI/CDパイプラインの動作確認

```bash
# 1. 新しいブランチを作成
git checkout -b test/ci-pipeline

# 2. 小さな変更を加える
echo "# CI/CD Test" >> README.md

# 3. コミット & プッシュ
git add README.md
git commit -m "Test CI/CD pipeline"
git push origin test/ci-pipeline

# 4. GitHubでプルリクエストを作成
# → CI が自動実行される

# 5. CIが成功したら、developにマージ
# → Staging環境に自動デプロイ

# 6. Stagingで動作確認後、mainにマージ
# → Production環境に自動デプロイ（承認必要）
```

## 2. 実際の動作確認

### 2.1 アプリケーションへのアクセス

**URL**: https://main.d1iv2q5yh6oc7s.amplifyapp.com

⚠️ **重要**: ジールのVPNに接続してからアクセスしてください。

### 2.2 ユーザー登録とログイン

1. アプリケーションにアクセス
2. **サインアップ**をクリック
3. メールアドレスとパスワードを入力
4. 確認コードを入力（メールで送信されます）
5. ログイン

### 2.3 日本語ファイル名のテスト

#### テストファイルの準備

日本語ファイル名を含むMP4ファイルを準備します：

例: `営業支援AI関連 隔週MTG-20251017_110031-会議の録音.mp4`

#### アップロードとダウンロードのテスト

1. **アップロード**
   - ファイルをドラッグ&ドロップまたは選択
   - アップロード進捗を確認
   - ジョブ詳細ページに遷移

2. **処理の確認**
   - ステータスが`UPLOADED` → `TRANSCRIBING` → `GENERATING_MINUTES` → `COMPLETED`と変化することを確認
   - 各ステップの進捗を確認

3. **ダウンロード**
   - 処理完了後、**ダウンロード**ボタンをクリック
   - ファイルが正常にダウンロードされることを確認
   - ファイル名が日本語で正しく表示されることを確認

#### 期待される結果

- ✅ ファイルが正常にアップロードされる
- ✅ 処理が正常に完了する
- ✅ 議事録が生成される
- ✅ 日本語ファイル名でダウンロードできる
- ✅ ダウンロードしたファイルの内容が正しい

### 2.4 エラーケースのテスト

以下のエラーケースもテストしてください：

1. **サイズ超過**
   - 2GB以上のファイルをアップロード
   - エラーメッセージが表示されることを確認

2. **非対応形式**
   - MP4以外のファイルをアップロード
   - エラーメッセージが表示されることを確認

3. **ネットワークエラー**
   - アップロード中にネットワークを切断
   - エラーハンドリングが正しく動作することを確認

## 3. モニタリングの設定

### 3.1 CloudWatch Dashboardsの作成

```bash
# CloudWatch Consoleを開く
aws cloudwatch list-dashboards --region ap-northeast-1
```

または、AWSコンソールから：
https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:

#### 推奨メトリクス

- **Lambda関数**
  - 実行時間（Duration）
  - エラー率（Errors）
  - 同時実行数（ConcurrentExecutions）

- **API Gateway**
  - リクエスト数（Count）
  - レイテンシー（Latency）
  - 4xxエラー、5xxエラー

- **Step Functions**
  - 実行数（ExecutionsStarted）
  - 成功率（ExecutionsSucceeded）
  - 失敗数（ExecutionsFailed）

- **DynamoDB**
  - 読み取り容量（ConsumedReadCapacityUnits）
  - 書き込み容量（ConsumedWriteCapacityUnits）
  - スロットリング（UserErrors）

### 3.2 CloudWatch Alarmsの設定

```bash
# Lambda関数のエラー率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name meeting-minutes-lambda-errors \
  --alarm-description "Lambda function error rate > 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --region ap-northeast-1

# API Gateway 5xxエラーアラーム
aws cloudwatch put-metric-alarm \
  --alarm-name meeting-minutes-api-5xx-errors \
  --alarm-description "API Gateway 5xx errors > 10/min" \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --region ap-northeast-1
```

### 3.3 コスト予算アラートの確認

```bash
# 既存の予算を確認
npm run check-costs

# 予算アラートを設定（まだの場合）
npm run setup-budget-alert
```

### 3.4 ログの確認

```bash
# Lambda関数のログを確認
aws logs tail /aws/lambda/meeting-minutes-generator-upload-handler-dev --follow

# Step Functionsのログを確認
aws logs tail /aws/states/meeting-minutes-workflow-dev --follow

# API Gatewayのログを確認
aws logs tail /aws/apigateway/meeting-minutes-api-dev --follow
```

## 4. 本番環境へのデプロイ

### 4.1 本番環境の準備

#### 環境変数の設定

`.env.production`ファイルを確認・更新：

```bash
# Production Environment Configuration
AWS_REGION=ap-northeast-1
ENVIRONMENT=prod
APP_NAME=meeting-minutes-generator

# 本番用のドメイン設定
CORS_ALLOWED_ORIGINS=https://app.example.com

# GitHub設定
GITHUB_BRANCH=main
```

#### 本番用のドメイン設定（オプション）

Route 53でカスタムドメインを設定する場合：

1. Route 53でホストゾーンを作成
2. Amplify Consoleでカスタムドメインを追加
3. SSL証明書が自動的に発行される

### 4.2 本番環境へのデプロイ

#### 方法1: GitHub Actions（推奨）

```bash
# 1. developブランチの最新をmainにマージ
git checkout main
git merge develop

# 2. プッシュ
git push origin main

# 3. GitHub Actionsで自動デプロイ
# → 承認が必要（GitHub Environmentsで設定）

# 4. 承認後、自動的にデプロイされる
```

#### 方法2: 手動デプロイ

```bash
# 本番環境へのデプロイ
npm run deploy:production

# 確認プロンプトで "yes" を入力
```

### 4.3 本番環境の動作確認

1. 本番環境のURLにアクセス
2. ユーザー登録とログイン
3. ファイルアップロードとダウンロードのテスト
4. モニタリングダッシュボードで確認

## 5. 運用開始

### 5.1 ユーザーへの案内

#### ユーザーガイドの共有

`docs/USER_GUIDE.md`をユーザーに共有してください。

主な内容：
- アプリケーションの使い方
- ファイルアップロード方法
- 議事録のダウンロード方法
- トラブルシューティング

#### アクセス方法の案内

```
アプリケーションURL: https://app.example.com
（または https://main.d1iv2q5yh6oc7s.amplifyapp.com）

⚠️ 注意: ジールのVPNに接続してからアクセスしてください。

初回利用時:
1. サインアップをクリック
2. メールアドレスとパスワードを入力
3. 確認コードを入力（メールで送信されます）
4. ログイン
```

### 5.2 定期的なメンテナンス

#### 週次タスク

- [ ] CloudWatchダッシュボードでメトリクスを確認
- [ ] エラーログを確認
- [ ] コストレポートを確認

#### 月次タスク

- [ ] 依存関係の更新（`npm audit`）
- [ ] セキュリティパッチの適用
- [ ] バックアップの確認
- [ ] コスト最適化の検討

#### 四半期タスク

- [ ] パフォーマンスレビュー
- [ ] ユーザーフィードバックの収集
- [ ] 機能改善の検討
- [ ] セキュリティ監査

### 5.3 トラブルシューティング

問題が発生した場合の対応手順：

#### 1. ログの確認

```bash
# Lambda関数のエラーログ
aws logs tail /aws/lambda/meeting-minutes-generator-upload-handler-dev --follow

# Step Functionsの実行履歴
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:ap-northeast-1:490030480543:stateMachine:meeting-minutes-generator-workflow-dev \
  --status-filter FAILED
```

#### 2. メトリクスの確認

CloudWatch Dashboardsで以下を確認：
- Lambda関数のエラー率
- API Gatewayのレスポンスタイム
- DynamoDBのスロットリング

#### 3. ロールバック

問題が解決しない場合は、前のバージョンにロールバック：

```bash
# 前のコミットに戻す
git revert HEAD
git push origin main

# 自動的に前のバージョンがデプロイされる
```

### 5.4 サポート体制

#### 問い合わせ先

- **技術的な問題**: [開発チームのメールアドレス]
- **アカウント関連**: [管理者のメールアドレス]
- **緊急時**: [緊急連絡先]

#### エスカレーションフロー

1. **レベル1**: ユーザーガイドを確認
2. **レベル2**: 開発チームに問い合わせ
3. **レベル3**: AWSサポートに問い合わせ

## 📚 参考ドキュメント

- [ユーザーガイド](USER_GUIDE.md)
- [デプロイメントパイプライン](DEPLOYMENT_PIPELINE.md)
- [GitHub連携設定](GITHUB_AMPLIFY_SETUP.md)
- [コスト管理](COST_MANAGEMENT.md)
- [日本語ファイル名対応](JAPANESE_FILENAME_FIX.md)

## 🎉 おめでとうございます！

すべてのセットアップが完了しました。本番環境での運用を開始できます！

何か問題が発生した場合は、上記のトラブルシューティングセクションを参照してください。
