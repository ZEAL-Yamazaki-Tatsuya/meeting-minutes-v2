# GitHub Personal Access Token の作成手順

## 📝 ステップバイステップガイド

### ステップ1: GitHubにアクセス

1. ブラウザで GitHub にログイン
2. 右上のプロフィールアイコンをクリック
3. **Settings** を選択

### ステップ2: Developer Settingsを開く

1. 左メニューを一番下までスクロール
2. **Developer settings** をクリック

### ステップ3: Personal Access Tokenを作成

1. 左メニューで **Personal access tokens** を展開
2. **Tokens (classic)** を選択
3. **Generate new token** ボタンをクリック
4. **Generate new token (classic)** を選択

### ステップ4: トークンの設定

#### Note（トークンの説明）
```
Amplify Deployment for Meeting Minutes Generator
```

#### Expiration（有効期限）
- **90 days** を選択（推奨）
- または **No expiration**（セキュリティ上は推奨しません）

#### Select scopes（権限の選択）

以下のスコープにチェックを入れます：

**✅ repo** - Full control of private repositories
- ✅ repo:status - Access commit status
- ✅ repo_deployment - Access deployment status
- ✅ public_repo - Access public repositories
- ✅ repo:invite - Access repository invitations
- ✅ security_events - Read and write security events

**✅ admin:repo_hook** - Full control of repository hooks
- ✅ write:repo_hook - Write repository hooks
- ✅ read:repo_hook - Read repository hooks

### ステップ5: トークンを生成

1. ページ下部の **Generate token** ボタンをクリック
2. トークンが表示されます（例: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`）

⚠️ **重要**: このトークンは一度しか表示されません！

### ステップ6: トークンをコピー

1. 表示されたトークンをコピー
2. 安全な場所に保存（後で使用します）

## 🔐 トークンの保存

### .envファイルに追加

プロジェクトルートの`.env`ファイルに以下を追加：

```bash
# GitHub Configuration
GITHUB_REPO=https://github.com/ZEAL-Yamazaki-Tatsuya/meeting-minutes-v2
GITHUB_BRANCH=main
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**実際の値に置き換えてください**:
- `GITHUB_TOKEN`: 先ほどコピーしたトークン

### 確認

`.env`ファイルが以下のようになっているか確認：

```bash
# AWS Configuration
AWS_ACCOUNT_ID=490030480543
AWS_REGION=ap-northeast-1

# Environment
ENVIRONMENT=dev

# Application Configuration
APP_NAME=meeting-minutes-generator

# ... (他の設定)

# Frontend Deployment Method
USE_AMPLIFY=true

# GitHub Configuration
GITHUB_REPO=https://github.com/ZEAL-Yamazaki-Tatsuya/meeting-minutes-v2
GITHUB_BRANCH=main
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## ✅ 次のステップ

トークンを`.env`ファイルに追加したら、以下のコマンドでAmplifyスタックを再デプロイします：

```powershell
npm run deploy:amplify
```

これで、GitHubリポジトリとAmplifyが連携され、`git push`で自動デプロイされるようになります！

## 🔒 セキュリティ注意事項

1. **トークンを共有しない**: GitHubトークンは秘密情報です
2. **.gitignoreを確認**: `.env`ファイルが`.gitignore`に含まれていることを確認
3. **定期的に更新**: トークンは90日ごとに更新することを推奨
4. **不要になったら削除**: 使用しなくなったトークンはGitHubで削除

## 📚 参考リンク

- [GitHub Personal Access Tokens Documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [AWS Amplify GitHub Integration](https://docs.aws.amazon.com/amplify/latest/userguide/setting-up-GitHub-access.html)
