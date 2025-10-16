# AWS Amplify Hostingを使用したデプロイ

AWS Amplify Hostingは、Next.jsアプリケーションのデプロイに最適なサービスです。動的ルート、SSR、ISRなどをサポートし、CloudFrontも自動的に統合されます。

## 🎯 Amplify vs CloudFront + S3

| 機能 | Amplify Hosting | CloudFront + S3 |
|------|----------------|-----------------|
| **動的ルート** | ✅ 完全サポート | ❌ 制限あり |
| **SSR/ISR** | ✅ サポート | ❌ 不可 |
| **自動ビルド** | ✅ Git連携 | ❌ 手動 |
| **CloudFront** | ✅ 自動統合 | ✅ 手動設定 |
| **セットアップ** | 🟢 簡単 | 🟡 複雑 |
| **コスト** | 💰 やや高い | 💰 安い |

**推奨**: Next.jsの全機能を使用する場合は **Amplify Hosting** を使用してください。

## 📋 前提条件

1. AWS CLIがインストールされ、設定済み
2. Node.js 18以上
3. バックエンドスタック（API、Cognito）がデプロイ済み

## 🚀 デプロイ手順

### 1. 環境変数の取得

```bash
npm run get-env
```

これにより、以下の環境変数が`.env`ファイルに追加されます：
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`

### 2. Amplifyを有効化

`.env`ファイルに以下を追加：

```bash
USE_AMPLIFY=true
```

### 3. Amplifyスタックをデプロイ

```bash
npm run deploy:amplify
```

または：

```bash
powershell -ExecutionPolicy Bypass -File scripts/deploy-amplify.ps1
```

### 4. Amplify Consoleでアプリを設定

デプロイが完了したら、Amplify Consoleを開きます：

```
https://console.aws.amazon.com/amplify/home?region=ap-northeast-1
```

## 📦 デプロイ方法

Amplifyには2つのデプロイ方法があります：

### 方法1: GitHubリポジトリ連携（推奨）

#### 1. GitHubトークンを取得

1. GitHub → Settings → Developer settings → Personal access tokens
2. "Generate new token (classic)"を選択
3. 以下のスコープを選択：
   - `repo` (Full control of private repositories)
4. トークンをコピー

#### 2. .envファイルに追加

```bash
GITHUB_REPO=https://github.com/username/meeting-minutes-generator
GITHUB_BRANCH=main
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

#### 3. 再デプロイ

```bash
npm run deploy:amplify
```

これで、GitHubにプッシュするたびに自動的にビルド・デプロイされます。

### 方法2: 手動デプロイ

#### 1. フロントエンドをビルド

```bash
cd frontend
npm run build
```

#### 2. ZIPファイルを作成

```powershell
# PowerShell
Compress-Archive -Path frontend\* -DestinationPath frontend.zip
```

#### 3. Amplify Consoleからアップロード

1. Amplify Console を開く
2. アプリを選択
3. "Deploy without Git provider" を選択
4. ZIPファイルをアップロード

## 🔄 更新とデプロイ

### GitHubリポジトリ連携の場合

```bash
git add .
git commit -m "Update frontend"
git push origin main
```

自動的にビルド・デプロイされます。

### 手動デプロイの場合

```bash
npm run deploy:amplify
```

## 🔧 Cognitoの設定更新

Amplify URLをCognitoのコールバックURLに追加：

```bash
# Amplify URLを取得
$AMPLIFY_URL = aws cloudformation describe-stacks `
  --stack-name meeting-minutes-generator-amplify-dev `
  --query "Stacks[0].Outputs[?OutputKey=='AmplifyAppUrl'].OutputValue" `
  --output text

# .envを更新
echo "COGNITO_CALLBACK_URLS=http://localhost:3000/auth/callback,$AMPLIFY_URL/auth/callback" >> .env
echo "COGNITO_LOGOUT_URLS=http://localhost:3000,$AMPLIFY_URL" >> .env

# AuthStackを再デプロイ
npx cdk deploy meeting-minutes-generator-auth-dev
```

## 📊 ビルド設定

Amplifyのビルド設定は自動的に設定されますが、カスタマイズする場合は`amplify.yml`を作成：

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/.next
    files:
      - '**/*'
  cache:
    paths:
      - frontend/node_modules/**/*
      - frontend/.next/cache/**/*
```

## 🌐 カスタムドメイン

### 1. Route 53でドメインを管理

### 2. Amplify Consoleでカスタムドメインを追加

1. Amplify Console → アプリを選択
2. "Domain management" → "Add domain"
3. ドメインを入力（例: `app.example.com`）
4. SSL証明書が自動的に発行されます

## 💰 コスト見積もり

### Amplify Hosting

- **ビルド時間**: $0.01/分
- **ホスティング**: $0.15/GB（データ転送）
- **リクエスト**: 最初の1,000万リクエスト/月は無料

### 月間コスト例（小規模）

- ビルド: 10回 × 5分 = $0.50
- データ転送: 10GB = $1.50
- **合計**: 約$2/月

## 🔍 トラブルシューティング

### ビルドエラー

Amplify Consoleでビルドログを確認：

1. Amplify Console → アプリを選択
2. ブランチを選択
3. 最新のビルドをクリック
4. "Build logs"を確認

### 環境変数が反映されない

1. Amplify Console → アプリを選択
2. "Environment variables"を確認
3. 必要な変数が設定されているか確認
4. 再ビルドを実行

### 404エラー

Amplifyは自動的にSPAルーティングを処理しますが、カスタムルールが必要な場合：

1. Amplify Console → アプリを選択
2. "Rewrites and redirects"
3. ルールを追加：
   - Source: `/<*>`
   - Target: `/index.html`
   - Type: `404-200`

## 📚 参考リンク

- [AWS Amplify Hosting Documentation](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html)
- [Next.js on Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/server-side-rendering-amplify.html)
- [Amplify Pricing](https://aws.amazon.com/amplify/pricing/)

## 🎉 完了！

これでフロントエンドがAWS Amplify Hostingでホスティングされました！
