# デプロイメントパイプライン

このドキュメントでは、Meeting Minutes GeneratorのCI/CDパイプラインについて説明します。

## 📋 目次

1. [概要](#概要)
2. [パイプライン構成](#パイプライン構成)
3. [環境構成](#環境構成)
4. [セットアップ](#セットアップ)
5. [デプロイフロー](#デプロイフロー)
6. [トラブルシューティング](#トラブルシューティング)

## 概要

このプロジェクトでは、GitHub Actionsを使用した自動CI/CDパイプラインを実装しています。

### パイプラインの特徴

- ✅ **自動テスト**: プルリクエストごとに自動テスト実行
- ✅ **環境分離**: Staging/Production環境の完全分離
- ✅ **自動デプロイ**: ブランチマージで自動デプロイ
- ✅ **E2Eテスト**: デプロイ後の自動E2Eテスト
- ✅ **承認フロー**: Production環境への承認フロー

## パイプライン構成

### 1. CI Pipeline (`ci.yml`)

**トリガー**: プルリクエスト、feature/*ブランチへのプッシュ

**ジョブ**:
```
lint-and-format → TypeScriptコンパイル、Lintチェック
unit-tests → バックエンド・フロントエンドのユニットテスト
integration-tests → 統合テスト
cdk-synth → CDK Synthチェック
security-scan → npm audit
build-check → ビルドチェック
summary → 全体の結果サマリー
```

### 2. Staging Pipeline (`deploy-staging.yml`)

**トリガー**: developブランチへのプッシュ

**ジョブ**:
```
test → ユニットテスト実行
  ↓
deploy-backend → バックエンドデプロイ (Storage, Auth, Compute)
  ↓
deploy-frontend → フロントエンドデプロイ (Amplify)
  ↓
e2e-tests → E2Eテスト実行
  ↓
notify → デプロイ結果通知
```

### 3. Production Pipeline (`deploy-production.yml`)

**トリガー**: mainブランチへのプッシュ

**ジョブ**:
```
test → ユニットテスト実行
  ↓
deploy-backend → バックエンドデプロイ (要承認)
  ↓
deploy-frontend → フロントエンドデプロイ (要承認)
  ↓
e2e-tests → E2Eテスト実行
  ↓
notify → デプロイ結果通知
```

## 環境構成

### Development (ローカル)

```bash
環境: dev
ブランチ: feature/*
デプロイ: 手動
URL: http://localhost:3000
```

### Staging

```bash
環境: staging
ブランチ: develop
デプロイ: 自動（developへのマージ時）
スタック名: meeting-minutes-generator-*-staging
URL: https://staging.d2fe685r4k8eh6.amplifyapp.com
```

### Production

```bash
環境: prod
ブランチ: main
デプロイ: 自動（承認後）
スタック名: meeting-minutes-generator-*-prod
URL: https://main.d2fe685r4k8eh6.amplifyapp.com
```

## セットアップ

### 1. GitHubリポジトリのシークレット設定

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

# 3. 必要なポリシーをアタッチ
aws iam attach-user-policy \
  --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

**注意**: 本番環境では、最小権限の原則に従ってカスタムポリシーを作成してください。

#### GitHub Personal Access Tokenの作成

1. GitHub → Settings → Developer settings → Personal access tokens
2. **Generate new token (classic)**
3. スコープを選択:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `admin:repo_hook` (Full control of repository hooks)
4. トークンをコピーしてGitHub Secretsに保存

### 2. GitHub Environmentsの設定

#### Staging Environment

1. Settings → Environments → **New environment**
2. Name: `staging`
3. Protection rules: なし（自動デプロイ）

#### Production Environment

1. Settings → Environments → **New environment**
2. Name: `production`
3. Protection rules:
   - ✅ **Required reviewers**: 1人以上
   - ✅ **Wait timer**: 5分
   - ✅ **Deployment branches**: `main`のみ

### 3. ブランチ保護ルールの設定

#### mainブランチ

Settings → Branches → **Add rule**

- Branch name pattern: `main`
- ✅ Require a pull request before merging
- ✅ Require approvals: 1
- ✅ Require status checks to pass before merging
  - ✅ CI Summary
- ✅ Require branches to be up to date before merging

#### developブランチ

Settings → Branches → **Add rule**

- Branch name pattern: `develop`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - ✅ CI Summary

## デプロイフロー

### 開発フロー

```bash
# 1. 新機能ブランチを作成
git checkout -b feature/new-feature

# 2. コードを変更
# ...

# 3. コミット & プッシュ
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 4. GitHubでプルリクエストを作成 (develop ← feature/new-feature)
# → CI が自動実行される

# 5. レビュー & 承認後、developにマージ
# → Staging環境に自動デプロイ

# 6. Stagingで動作確認

# 7. プルリクエストを作成 (main ← develop)
# → CI が自動実行される

# 8. レビュー & 承認後、mainにマージ
# → Production環境に自動デプロイ（承認必要）
```

### 手動デプロイ（ローカル）

#### Staging環境へのデプロイ

```bash
npm run deploy:staging
```

または：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-staging.ps1
```

#### Production環境へのデプロイ

```bash
npm run deploy:production
```

または：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-production.ps1
```

### GitHub Actionsからの手動実行

1. GitHub → **Actions** タブ
2. デプロイしたいワークフローを選択
3. **Run workflow** をクリック
4. ブランチを選択して実行

## デプロイ後の確認

### 1. デプロイ状況の確認

```bash
# Staging環境
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-compute-staging \
  --query "Stacks[0].StackStatus"

# Production環境
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-compute-prod \
  --query "Stacks[0].StackStatus"
```

### 2. エンドポイントの確認

```bash
# API URL
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-compute-staging \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text

# Amplify URL
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-amplify-staging \
  --query "Stacks[0].Outputs[?OutputKey=='AmplifyAppUrl'].OutputValue" \
  --output text
```

### 3. ログの確認

```bash
# Lambda関数のログ
aws logs tail /aws/lambda/meeting-minutes-generator-upload-handler-staging --follow

# Step Functionsのログ
aws logs tail /aws/states/meeting-minutes-workflow-staging --follow
```

## ロールバック

### 方法1: Gitリバート

```bash
# 1. 問題のあるコミットをリバート
git revert HEAD

# 2. プッシュ
git push origin main

# 3. 自動的に前のバージョンがデプロイされる
```

### 方法2: CDKロールバック

```bash
# 1. CloudFormationコンソールでスタックを選択
# 2. "Stack actions" → "Roll back"
# 3. 前のバージョンを選択
```

### 方法3: 手動デプロイ

```bash
# 1. 前のコミットをチェックアウト
git checkout <previous-commit-hash>

# 2. 手動デプロイ
npm run deploy:production
```

## トラブルシューティング

### デプロイが失敗する

#### 原因1: AWS認証エラー

```
Error: The security token included in the request is invalid
```

**解決策**:
1. GitHub Secretsの`AWS_ACCESS_KEY_ID`と`AWS_SECRET_ACCESS_KEY`を確認
2. IAMユーザーの権限を確認
3. アクセスキーが有効か確認

#### 原因2: CDKスタックエラー

```
Error: Stack already exists
```

**解決策**:
1. スタック名の競合を確認
2. 環境変数`environment`が正しく設定されているか確認
3. 既存のスタックを削除してから再デプロイ

### E2Eテストが失敗する

#### 原因: Amplify URLが取得できない

**解決策**:
```bash
# Amplifyスタックが正しくデプロイされているか確認
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-amplify-staging

# Amplifyアプリの状態を確認
aws amplify get-app --app-id <app-id>
```

### ビルドが遅い

#### 原因: キャッシュが効いていない

**解決策**:
1. `package-lock.json`をコミット
2. GitHub Actionsのキャッシュをクリア
3. 依存関係を最適化

## モニタリング

### CloudWatch Dashboards

各環境のCloudWatchダッシュボードで以下を監視：

- Lambda関数の実行時間
- API Gatewayのリクエスト数
- エラー率
- DynamoDBの読み書き容量

### アラート設定

CloudWatch Alarmsで以下のアラートを設定：

- Lambda関数のエラー率 > 5%
- API Gatewayの5xxエラー > 10件/分
- DynamoDBのスロットリング

### ログ集約

CloudWatch Logs Insightsで以下のクエリを実行：

```sql
# エラーログの集計
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100

# Lambda関数の実行時間
fields @timestamp, @duration
| stats avg(@duration), max(@duration), min(@duration)
```

## セキュリティ

### シークレット管理

- ✅ すべての機密情報はGitHub Secretsに保存
- ✅ ログにシークレットが表示されないようマスク
- ✅ 定期的にアクセスキーをローテーション

### IAMポリシー

本番環境では、最小権限の原則に従ったカスタムポリシーを使用：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "lambda:*",
        "dynamodb:*",
        "apigateway:*",
        "cognito-idp:*",
        "amplify:*",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

## コスト最適化

### CI/CDコスト

- GitHub Actions: 無料枠内（2,000分/月）
- AWS CodeBuild: 使用していない
- AWS CodePipeline: 使用していない

### デプロイコスト

- Lambda実行: デプロイ時のみ
- S3ストレージ: Lambda関数のZIPファイル
- CloudFormation: 無料

## 参考リンク

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS CDK Best Practices](https://docs.aws.amazon.com/cdk/latest/guide/best-practices.html)
- [Playwright CI Documentation](https://playwright.dev/docs/ci)

## まとめ

このCI/CDパイプラインにより、以下が実現されます：

- ✅ **品質保証**: 自動テストによるコード品質の維持
- ✅ **迅速なデプロイ**: プッシュから数分でデプロイ完了
- ✅ **環境分離**: Staging/Productionの完全分離
- ✅ **安全なリリース**: 承認フローによる本番デプロイの制御
- ✅ **問題の早期発見**: E2Eテストによる自動検証

開発者は安心してコードを書き、プッシュするだけで自動的にデプロイされます！🚀
