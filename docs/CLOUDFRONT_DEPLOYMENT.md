# CloudFrontを使用したフロントエンドのデプロイ

このドキュメントでは、Next.jsフロントエンドアプリケーションをCloudFront + S3でホスティングする方法を説明します。

## アーキテクチャ

```
ユーザー
  ↓
CloudFront Distribution
  ↓
S3 Bucket (静的ファイル)
```

### 主な特徴

- **グローバル配信**: CloudFrontのエッジロケーションを通じて世界中に高速配信
- **HTTPS対応**: 自動的にHTTPSでアクセス可能
- **キャッシング**: 静的ファイルをキャッシュして高速化
- **セキュリティ**: S3バケットは非公開、CloudFront経由でのみアクセス可能
- **コスト最適化**: 静的ホスティングのため、サーバーコストが不要

## 前提条件

1. AWS CLIがインストールされ、設定されていること
2. Node.js 18以上がインストールされていること
3. AWS CDKがインストールされていること
4. バックエンドスタック（API、Cognito）がデプロイ済みであること

## デプロイ手順

### 1. 環境変数の設定

`.env`ファイルに以下の環境変数を設定します：

```bash
# AWS設定
AWS_ACCOUNT_ID=your-account-id
AWS_REGION=us-east-1
ENVIRONMENT=dev

# フロントエンド設定
NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/dev
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your-user-pool-id
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id
NEXT_PUBLIC_AWS_REGION=us-east-1
```

**重要**: `NEXT_PUBLIC_API_URL`は、ComputeStackのデプロイ後に取得できるAPI Gateway URLを設定してください。

### 2. API URLの取得

バックエンドをデプロイ後、以下のコマンドでAPI URLを取得できます：

```bash
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-compute-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

### 3. Cognitoの設定更新

CloudFrontのURLをCognitoのコールバックURLとログアウトURLに追加します：

```bash
# CloudFrontのURLを取得（デプロイ後）
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-frontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" \
  --output text)

# .envファイルを更新
COGNITO_CALLBACK_URLS=http://localhost:3000/auth/callback,${CLOUDFRONT_URL}/auth/callback
COGNITO_LOGOUT_URLS=http://localhost:3000,${CLOUDFRONT_URL}
```

その後、AuthStackを再デプロイします：

```bash
npx cdk deploy meeting-minutes-generator-auth-dev
```

### 4. フロントエンドのデプロイ

#### Windows (PowerShell)

```powershell
.\scripts\deploy-frontend.ps1
```

#### Linux/Mac

```bash
chmod +x scripts/deploy-frontend.sh
./scripts/deploy-frontend.sh
```

#### 手動デプロイ

```bash
# 1. フロントエンドのビルド
cd frontend
npm ci
npm run build

# 2. CDKデプロイ
cd ..
npx cdk deploy meeting-minutes-generator-frontend-dev
```

### 5. デプロイの確認

デプロイが完了すると、CloudFrontのURLが表示されます：

```
🌐 フロントエンドURL: https://d1234567890abc.cloudfront.net
```

このURLにアクセスして、アプリケーションが正しく動作することを確認してください。

## 更新とデプロイ

### フロントエンドの更新

コードを変更した後、再度デプロイスクリプトを実行するだけです：

```bash
# Windows
.\scripts\deploy-frontend.ps1

# Linux/Mac
./scripts/deploy-frontend.sh
```

### キャッシュの無効化

CloudFrontはファイルをキャッシュするため、更新が即座に反映されない場合があります。
デプロイスクリプトは自動的にキャッシュを無効化しますが、手動で行う場合：

```bash
# Distribution IDを取得
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-frontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

# キャッシュを無効化
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

## トラブルシューティング

### 1. ビルドエラー

**エラー**: `Error: Cannot find module 'next'`

**解決策**: 依存関係をインストールします
```bash
cd frontend
npm ci
```

### 2. 環境変数が反映されない

**原因**: Next.jsの静的エクスポートでは、ビルド時に環境変数が埋め込まれます。

**解決策**: 
1. `.env`ファイルを更新
2. フロントエンドを再ビルド
3. 再デプロイ

### 3. APIリクエストが失敗する

**原因**: CORSの設定が正しくない可能性があります。

**解決策**: 
1. `.env`の`CORS_ALLOWED_ORIGINS`にCloudFrontのURLを追加
2. ComputeStackを再デプロイ

```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://d1234567890abc.cloudfront.net
npx cdk deploy meeting-minutes-generator-compute-dev
```

### 4. 認証が機能しない

**原因**: CognitoのコールバックURLが設定されていない可能性があります。

**解決策**: 
1. `.env`の`COGNITO_CALLBACK_URLS`と`COGNITO_LOGOUT_URLS`にCloudFrontのURLを追加
2. AuthStackを再デプロイ

### 5. 404エラーが表示される

**原因**: Next.jsのルーティングとS3の静的ホスティングの互換性の問題です。

**解決策**: CloudFrontのエラーレスポンス設定で、404を`index.html`にリダイレクトしています（既に設定済み）。

## コスト見積もり

### CloudFront

- **データ転送**: 最初の10TB/月は$0.085/GB
- **HTTPSリクエスト**: $0.01/10,000リクエスト
- **無効化**: 最初の1,000パスは無料、その後$0.005/パス

### S3

- **ストレージ**: $0.023/GB/月（最初の50TB）
- **リクエスト**: GETリクエストは$0.0004/1,000リクエスト

### 月間コスト例（小規模）

- トラフィック: 10GB/月
- リクエスト: 100,000リクエスト/月
- ストレージ: 1GB

**合計**: 約$2-3/月

## セキュリティのベストプラクティス

1. **S3バケットを非公開に保つ**: CloudFront経由でのみアクセス可能
2. **HTTPS強制**: CloudFrontでHTTPSを強制（設定済み）
3. **Origin Access Control (OAC)**: S3へのアクセスをCloudFrontのみに制限（設定済み）
4. **ログの有効化**: 本番環境ではCloudFrontのログを有効化（設定済み）

## カスタムドメインの設定（オプション）

独自ドメインを使用する場合：

1. **Route 53でドメインを管理**
2. **ACM証明書を取得**（us-east-1リージョン）
3. **FrontendStackを更新**してカスタムドメインを追加

詳細は[AWS公式ドキュメント](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html)を参照してください。

## 参考リンク

- [Next.js Static Exports](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [AWS CDK CloudFront Module](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront-readme.html)
