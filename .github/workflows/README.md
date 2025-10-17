# GitHub Actions CI/CD パイプライン

このディレクトリには、Meeting Minutes Generatorの自動ビルド・テスト・デプロイを行うGitHub Actionsワークフローが含まれています。

## 📋 ワークフロー一覧

### 1. CI - Continuous Integration (`ci.yml`)

**トリガー**: 
- プルリクエスト（main、developブランチへ）
- プッシュ（main、develop以外のブランチ）

**実行内容**:
- ✅ Lint & Format チェック
- ✅ バックエンド・フロントエンドのユニットテスト
- ✅ 統合テスト
- ✅ CDK Synthチェック
- ✅ セキュリティスキャン（npm audit）
- ✅ ビルドチェック

**目的**: コードの品質を保証し、マージ前に問題を検出

### 2. Deploy to Staging (`deploy-staging.yml`)

**トリガー**: 
- developブランチへのプッシュ
- 手動実行（workflow_dispatch）

**実行内容**:
1. テスト実行
2. バックエンドのデプロイ（staging環境）
3. フロントエンドのデプロイ（Amplify staging）
4. E2Eテスト実行
5. デプロイ結果の通知

**環境**: `staging`

### 3. Deploy to Production (`deploy-production.yml`)

**トリガー**: 
- mainブランチへのプッシュ
- 手動実行（workflow_dispatch）

**実行内容**:
1. テスト実行
2. バックエンドのデプロイ（production環境）
3. フロントエンドのデプロイ（Amplify production）
4. E2Eテスト実行
5. デプロイ結果の通知

**環境**: `production`

## 🔧 セットアップ手順

### 1. GitHubリポジトリのシークレット設定

GitHubリポジトリの **Settings** → **Secrets and variables** → **Actions** で以下のシークレットを追加：

#### 必須シークレット

| シークレット名 | 説明 | 例 |
|--------------|------|-----|
| `AWS_ACCESS_KEY_ID` | AWSアクセスキーID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWSシークレットアクセスキー | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `GITHUB_TOKEN` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxxx` |
| `GITHUB_REPO` | GitHubリポジトリURL | `https://github.com/username/repo` |

#### シークレットの作成方法

**AWS認証情報**:
```bash
# IAMユーザーを作成（デプロイ権限付き）
aws iam create-user --user-name github-actions-deploy

# アクセスキーを作成
aws iam create-access-key --user-name github-actions-deploy

# 必要なポリシーをアタッチ
aws iam attach-user-policy \
  --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

**GitHub Token**:
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. スコープ: `repo`, `admin:repo_hook`
4. トークンをコピー

### 2. GitHub Environments の設定

GitHubリポジトリの **Settings** → **Environments** で以下の環境を作成：

#### Staging Environment

- **Name**: `staging`
- **Protection rules**: なし（自動デプロイ）
- **Environment secrets**: なし（リポジトリシークレットを使用）

#### Production Environment

- **Name**: `production`
- **Protection rules**: 
  - ✅ Required reviewers（1人以上の承認が必要）
  - ✅ Wait timer（5分待機）
- **Environment secrets**: なし（リポジトリシークレットを使用）

### 3. ブランチ戦略

```
main (production)
  ↑
  └── develop (staging)
        ↑
        └── feature/* (CI only)
```

**ワークフロー**:
1. `feature/*` ブランチで開発
2. プルリクエストを作成 → CI実行
3. `develop` にマージ → Staging自動デプロイ
4. Stagingで動作確認
5. `main` にマージ → Production自動デプロイ（承認必要）

## 🚀 使用方法

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

# 4. GitHubでプルリクエストを作成
# → CI が自動実行される

# 5. CIが成功したら、developにマージ
# → Staging環境に自動デプロイ

# 6. Stagingで動作確認後、mainにマージ
# → Production環境に自動デプロイ（承認必要）
```

### 手動デプロイ

GitHub Actions タブから手動でワークフローを実行できます：

1. **Actions** タブを開く
2. デプロイしたいワークフローを選択
3. **Run workflow** をクリック
4. ブランチを選択して実行

### ロールバック

問題が発生した場合のロールバック手順：

```bash
# 1. 前のコミットに戻す
git revert HEAD

# 2. プッシュ
git push origin main

# 3. 自動的に前のバージョンがデプロイされる
```

## 📊 ワークフローの監視

### ビルドステータスの確認

GitHubリポジトリの **Actions** タブで、すべてのワークフローの実行状況を確認できます。

### 通知設定

GitHub通知設定で、ワークフローの失敗時にメール通知を受け取れます：

1. GitHub → Settings → Notifications
2. **Actions** セクションで通知を有効化

### ログの確認

各ワークフローの詳細ログは、Actions タブから確認できます：

1. **Actions** タブを開く
2. 実行したワークフローをクリック
3. 各ジョブをクリックしてログを表示

## 🔍 トラブルシューティング

### デプロイが失敗する

**原因1: AWS認証エラー**
```
Error: The security token included in the request is invalid
```

**解決策**: AWS認証情報が正しいか確認
```bash
# シークレットを再設定
# Settings → Secrets → AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
```

**原因2: CDKデプロイエラー**
```
Error: Stack already exists
```

**解決策**: スタック名の競合を確認
```bash
# 環境変数を確認
# context environment=staging/prod が正しく設定されているか
```

### E2Eテストが失敗する

**原因**: Amplify URLが取得できない

**解決策**: Amplifyスタックが正しくデプロイされているか確認
```bash
aws cloudformation describe-stacks \
  --stack-name meeting-minutes-generator-amplify-staging \
  --query "Stacks[0].Outputs"
```

### ビルドが遅い

**原因**: キャッシュが効いていない

**解決策**: package-lock.jsonをコミット
```bash
git add package-lock.json frontend/package-lock.json
git commit -m "Add package-lock.json for caching"
```

## 📈 パフォーマンス最適化

### キャッシュの活用

ワークフローでは以下をキャッシュしています：
- Node.js依存関係（`node_modules`）
- npm キャッシュ

### 並列実行

可能な限りジョブを並列実行して、全体の実行時間を短縮しています：
- Lint、テスト、ビルドチェックは並列実行
- デプロイは順次実行（依存関係あり）

## 🔐 セキュリティ

### シークレットの管理

- ✅ すべての機密情報はGitHub Secretsに保存
- ✅ ログにシークレットが表示されないようマスク
- ✅ 最小権限の原則に従ったIAMポリシー

### セキュリティスキャン

CIワークフローで以下を実行：
- `npm audit` による脆弱性チェック
- 依存関係の定期的な更新

## 📚 参考リンク

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS CDK GitHub Actions](https://github.com/aws-actions/configure-aws-credentials)
- [Playwright GitHub Actions](https://playwright.dev/docs/ci-intro)

## 🎉 まとめ

このCI/CDパイプラインにより、以下が実現されます：

- ✅ コードの品質保証（自動テスト）
- ✅ 迅速なデプロイ（自動化）
- ✅ 環境の分離（staging/production）
- ✅ 安全なリリース（承認フロー）
- ✅ 問題の早期発見（E2Eテスト）

開発者は安心してコードを書き、プッシュするだけで自動的にデプロイされます！🚀
