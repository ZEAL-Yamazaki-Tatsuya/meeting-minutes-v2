# GitHub連携でAmplifyを自動デプロイする

このガイドでは、GitHubリポジトリとAWS Amplifyを連携して、`git push`で自動的にフロントエンドをデプロイする方法を説明します。

## 📋 前提条件

- GitHubアカウント
- このプロジェクトのGitHubリポジトリ
- AWS Amplifyスタックがデプロイ済み

## 🚀 セットアップ手順

### ステップ1: GitHubリポジトリの準備

#### 1-1. リポジトリが存在しない場合

```bash
# GitHubで新しいリポジトリを作成
# https://github.com/new

# ローカルリポジトリを初期化（まだの場合）
git init
git add .
git commit -m "Initial commit"

# リモートリポジトリを追加
git remote add origin https://github.com/YOUR_USERNAME/meeting-minutes-generator.git
git branch -M main
git push -u origin main
```

#### 1-2. リポジトリが既に存在する場合

```bash
# 最新の変更をコミット
git add .
git commit -m "Add Amplify deployment configuration"
git push origin main
```

### ステップ2: GitHub Personal Access Tokenの作成

#### 2-1. GitHubでトークンを作成

1. GitHub にログイン
2. 右上のプロフィールアイコン → **Settings**
3. 左メニューの一番下 → **Developer settings**
4. **Personal access tokens** → **Tokens (classic)**
5. **Generate new token** → **Generate new token (classic)**

#### 2-2. トークンの設定

**Note**: `Amplify Deployment for Meeting Minutes Generator`

**Expiration**: `90 days` または `No expiration`（推奨: 90 days）

**Select scopes**: 以下をチェック
- ✅ `repo` (Full control of private repositories)
  - ✅ `repo:status`
  - ✅ `repo_deployment`
  - ✅ `public_repo`
  - ✅ `repo:invite`
  - ✅ `security_events`
- ✅ `admin:repo_hook` (Full control of repository hooks)
  - ✅ `write:repo_hook`
  - ✅ `read:repo_hook`

#### 2-3. トークンをコピー

**Generate token** をクリックして、表示されたトークンをコピーします。

⚠️ **重要**: このトークンは一度しか表示されません！必ずコピーして安全な場所に保存してください。

例: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### ステップ3: .envファイルにGitHub情報を追加

`.env`ファイルに以下を追加：

```bash
# GitHub Configuration
GITHUB_REPO=https://github.com/YOUR_USERNAME/meeting-minutes-generator
GITHUB_BRANCH=main
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**例**:
```bash
GITHUB_REPO=https://github.com/tatsuya-yamazaki/meeting-minutes-generator
GITHUB_BRANCH=main
GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz
```

### ステップ4: Amplifyスタックを再デプロイ

GitHub情報を含めてAmplifyスタックを再デプロイします：

```powershell
npm run deploy:amplify
```

または：

```powershell
$env:USE_AMPLIFY = "true"
npx cdk deploy meeting-minutes-generator-amplify-dev
```

### ステップ5: Amplify Consoleで確認

#### 5-1. Amplify Consoleを開く

```
https://console.aws.amazon.com/amplify/home?region=ap-northeast-1#/d2fe685r4k8eh6
```

または：

```powershell
# Amplify App IDを取得
$APP_ID = aws cloudformation describe-stacks `
  --stack-name meeting-minutes-generator-amplify-dev `
  --query "Stacks[0].Outputs[?OutputKey=='AmplifyAppId'].OutputValue" `
  --output text `
  --region ap-northeast-1

# ブラウザで開く
Start-Process "https://console.aws.amazon.com/amplify/home?region=ap-northeast-1#/$APP_ID"
```

#### 5-2. リポジトリ接続を確認

Amplify Consoleで以下を確認：

1. **App settings** → **General**
2. **Repository** セクションに GitHubリポジトリが表示されているか確認
3. **Branch** セクションに `main` ブランチが表示されているか確認

### ステップ6: 初回ビルドをトリガー

#### 方法A: Amplify Consoleから

1. Amplify Console → アプリを選択
2. ブランチ（`main`）を選択
3. **Redeploy this version** をクリック

#### 方法B: Git Pushで

```bash
# 小さな変更を加える
echo "# Meeting Minutes Generator" > README.md
git add README.md
git commit -m "Trigger Amplify build"
git push origin main
```

### ステップ7: ビルドの進行状況を確認

Amplify Consoleでビルドの進行状況を確認できます：

1. **Provision** - 環境のプロビジョニング
2. **Build** - フロントエンドのビルド
3. **Deploy** - デプロイ
4. **Verify** - 検証

ビルドログを確認するには、各ステップをクリックします。

## 🔄 自動デプロイの動作確認

### テスト1: コードを変更してプッシュ

```bash
# フロントエンドのコードを変更
# 例: frontend/app/page.tsx を編集

git add .
git commit -m "Update homepage"
git push origin main
```

Amplify Consoleで自動的にビルドが開始されることを確認します。

### テスト2: ビルド完了後にアクセス

ビルドが完了したら、Amplify URLにアクセス：

```
https://main.d2fe685r4k8eh6.amplifyapp.com
```

変更が反映されていることを確認します。

## 🔧 ビルド設定のカスタマイズ

### amplify.ymlファイルの作成（オプション）

プロジェクトルートに`amplify.yml`を作成すると、ビルド設定をカスタマイズできます：

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

### 環境変数の確認

Amplify Console → **Environment variables** で以下が設定されているか確認：

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- `NEXT_PUBLIC_AWS_REGION`
- `AMPLIFY_MONOREPO_APP_ROOT` = `frontend`

## 🌿 ブランチ戦略

### 開発ブランチの追加

```bash
# 開発ブランチを作成
git checkout -b develop
git push origin develop
```

Amplify Consoleで開発ブランチを追加：

1. Amplify Console → アプリを選択
2. **Hosting environments** → **Connect branch**
3. `develop` ブランチを選択
4. **Save and deploy**

これで、`develop`ブランチ用のURLが作成されます：
```
https://develop.d2fe685r4k8eh6.amplifyapp.com
```

### プルリクエストプレビュー（オプション）

1. Amplify Console → **Previews**
2. **Enable previews** をクリック
3. プルリクエストを作成すると、自動的にプレビュー環境が作成されます

## 🔒 セキュリティのベストプラクティス

### 1. GitHubトークンの管理

- ✅ トークンは`.env`ファイルに保存（`.gitignore`に含まれている）
- ✅ トークンは定期的に更新（90日ごと）
- ✅ 不要になったトークンは削除

### 2. AWS Secrets Managerの使用（推奨）

本番環境では、GitHubトークンをAWS Secrets Managerに保存することを推奨：

```bash
# Secrets Managerにトークンを保存
aws secretsmanager create-secret \
  --name github-token-amplify \
  --secret-string "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  --region ap-northeast-1
```

CDKコードを更新してSecrets Managerから取得：

```typescript
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

const githubToken = secretsmanager.Secret.fromSecretNameV2(
  this,
  'GitHubToken',
  'github-token-amplify'
);
```

## 📊 モニタリング

### ビルド通知の設定

1. Amplify Console → **Notifications**
2. **Add notification**
3. SNSトピックまたはメールアドレスを設定
4. ビルドの成功/失敗時に通知を受け取る

### CloudWatchログ

Amplify のビルドログは CloudWatch Logs に保存されます：

```
/aws/amplify/d2fe685r4k8eh6
```

## ❓ トラブルシューティング

### ビルドが失敗する

1. Amplify Console → ビルドを選択 → **Build logs**
2. エラーメッセージを確認
3. 環境変数が正しく設定されているか確認

### GitHubリポジトリに接続できない

1. GitHubトークンが有効か確認
2. トークンのスコープが正しいか確認（`repo`と`admin:repo_hook`）
3. リポジトリURLが正しいか確認

### 環境変数が反映されない

1. Amplify Console → **Environment variables** で確認
2. 変数を追加/更新後、**Redeploy** を実行

## 🎉 完了！

これで、GitHubにプッシュするだけで自動的にフロントエンドがデプロイされるようになりました！

### 通常のワークフロー

```bash
# 1. コードを変更
# 2. コミット
git add .
git commit -m "Add new feature"

# 3. プッシュ（自動デプロイが開始される）
git push origin main

# 4. Amplify Consoleでビルドの進行状況を確認
# 5. ビルド完了後、URLにアクセスして確認
```

簡単ですね！🚀
