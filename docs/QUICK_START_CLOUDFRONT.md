# CloudFrontデプロイ クイックスタート

このガイドでは、フロントエンドをCloudFront + S3でホスティングする最速の方法を説明します。

## 📋 前提条件

- AWS CLIがインストールされ、設定済み
- Node.js 18以上
- バックエンドスタックがデプロイ済み

## 🚀 デプロイ手順（5ステップ）

### 1. 環境変数の設定

`.env`ファイルを作成または更新：

```bash
# 必須
AWS_ACCOUNT_ID=your-account-id
AWS_REGION=us-east-1
ENVIRONMENT=dev

# バックエンドのデプロイ後に取得
NEXT_PUBLIC_API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxx
NEXT_PUBLIC_AWS_REGION=us-east-1
```

### 2. バックエンドのデプロイ（まだの場合）

```bash
npm run deploy
```

### 3. API URLとCognito情報の取得

**簡単な方法（推奨）**:

```bash
# Windows
.\scripts\get-env-values.ps1

# Linux/Mac
chmod +x scripts/get-env-values.sh
./scripts/get-env-values.sh
```

このスクリプトは自動的に以下の値を取得し、`.env`ファイルに追加するか確認します：
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- `NEXT_PUBLIC_AWS_REGION`

**手動で取得する場合**:

```bash
# API URL
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-compute-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text

# Cognito User Pool ID
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-auth-dev \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text

# Cognito Client ID
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-auth-dev \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text
```

これらの値を`.env`ファイルに追加します。

### 4. フロントエンドのデプロイ

```bash
npm run deploy:frontend
```

または手動で：

```bash
# Windows
.\scripts\deploy-frontend.ps1

# Linux/Mac
./scripts/deploy-frontend.sh
```

### 5. CloudFront URLの取得

デプロイが完了すると、URLが表示されます：

```
🌐 フロントエンドURL: https://d1234567890abc.cloudfront.net
```

## 🔄 Cognitoの更新

CloudFrontのURLをCognitoのコールバックURLに追加：

```bash
# 1. CloudFront URLを取得
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-frontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" \
  --output text)

# 2. .envを更新
echo "COGNITO_CALLBACK_URLS=http://localhost:3000/auth/callback,${CLOUDFRONT_URL}/auth/callback" >> .env
echo "COGNITO_LOGOUT_URLS=http://localhost:3000,${CLOUDFRONT_URL}" >> .env

# 3. AuthStackを再デプロイ
npx cdk deploy meeting-minutes-generator-auth-dev
```

## ✅ 動作確認

1. CloudFront URLにアクセス
2. サインアップ/サインイン
3. ファイルをアップロード
4. 議事録が生成されることを確認

## 🔧 トラブルシューティング

### APIリクエストが失敗する

CORSの設定を更新：

```bash
# .envに追加
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-cloudfront-url.cloudfront.net

# ComputeStackを再デプロイ
npx cdk deploy meeting-minutes-generator-compute-dev
```

### 認証が機能しない

Cognitoのコールバック URLを確認：

```bash
# 現在の設定を確認
aws cognito-idp describe-user-pool-client \
  --user-pool-id your-user-pool-id \
  --client-id your-client-id \
  --query "UserPoolClient.CallbackURLs"
```

### キャッシュの問題

CloudFrontのキャッシュを無効化：

```bash
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-frontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

## 📚 詳細ドキュメント

より詳しい情報は[CLOUDFRONT_DEPLOYMENT.md](./CLOUDFRONT_DEPLOYMENT.md)を参照してください。

## 💰 コスト

小規模な使用（月間10GB、100,000リクエスト）で約$2-3/月です。

## 🎉 完了！

これでフロントエンドがCloudFrontでホスティングされました！
