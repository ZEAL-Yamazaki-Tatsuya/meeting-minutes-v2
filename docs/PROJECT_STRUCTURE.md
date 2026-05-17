# プロジェクト構造ガイド

## 📁 概要

このドキュメントは、Meeting Minutes Generatorプロジェクトの全体的なディレクトリ構造とファイルの役割を説明します。

## 目次

- [ルートディレクトリ](#ルートディレクトリ)
- [主要ディレクトリ](#主要ディレクトリ)
  - [/bin - CDKエントリーポイント](#bin---cdkエントリーポイント)
  - [/lib - インフラストラクチャコード](#lib---インフラストラクチャコード)
  - [/src - バックエンドソースコード](#src---バックエンドソースコード)
  - [/frontend - フロントエンド](#frontend---フロントエンド)
  - [/scripts - スクリプト](#scripts---スクリプト)
  - [/test - テスト](#test---テスト)
  - [/docs - ドキュメント](#docs---ドキュメント)
  - [/.github - CI/CD](#github---cicd)
  - [/.kiro - Kiro設定](#kiro---kiro設定)
  - [その他のディレクトリ](#その他のディレクトリ)
- [ファイルの役割](#ファイルの役割)
- [データフロー](#データフロー)

---

## ルートディレクトリ

```
meeting-minutes-v2/
├── .env                          # 環境変数（ローカル開発用）
├── .env.example                  # 環境変数のサンプル
├── .env.production               # 本番環境用環境変数
├── .env.staging                  # ステージング環境用環境変数
├── .gitignore                    # Gitで無視するファイル
├── package.json                  # プロジェクトの依存関係とスクリプト
├── package-lock.json             # 依存関係のロックファイル
├── tsconfig.json                 # TypeScriptコンパイラ設定
├── cdk.json                      # AWS CDK設定
├── cdk-outputs.json              # CDKデプロイ後の出力値
├── jest.config.js                # Jestテスト設定
├── README.md                     # プロジェクトの概要とクイックスタート
├── ARCHITECTURE.md               # アーキテクチャの詳細説明
├── SETUP_COMPLETE.md             # セットアップ完了ガイド
├── PROJECT_COMPLETION_SUMMARY.md # プロジェクト完了サマリー
├── DEPLOYMENT.md                 # デプロイメントガイド
├── DEPLOYMENT.ja.md              # デプロイメントガイド（日本語版）
└── CI_TEST_FIX_SUMMARY.md        # CIテスト修正サマリー
```

---

## 主要ディレクトリ

### `/bin` - CDKエントリーポイント

CDKアプリケーションのエントリーポイントを含むディレクトリです。

```
bin/
└── meeting-minutes-app.ts        # CDKアプリケーションのメインファイル
```

**meeting-minutes-app.ts**:
- すべてのCDKスタックをインスタンス化
- 環境変数から設定を読み込み
- スタック間の依存関係を定義

---

### `/lib` - インフラストラクチャコード

AWS CDKを使用したインフラストラクチャ定義を含むディレクトリです。

```
lib/
├── config.ts                     # 環境別設定（dev/staging/prod）
├── storage-stack.ts              # ストレージスタック（S3、DynamoDB）
├── compute-stack.ts              # コンピュートスタック（Lambda、API Gateway、Step Functions）
├── auth-stack.ts                 # 認証スタック（Cognito）
├── monitoring-stack.ts           # モニタリングスタック（CloudWatch）
└── amplify-frontend-stack.ts     # Amplifyフロントエンドスタック
```

#### 各スタックの役割

| スタック | 説明 | 主要リソース |
|---------|------|------------|
| **config.ts** | 環境別の設定管理 | 環境変数、リージョン、タグ |
| **storage-stack.ts** | データストレージ | S3バケット（入力/出力）、DynamoDBテーブル、ライフサイクルポリシー |
| **compute-stack.ts** | コンピュートリソース | Lambda関数（14個）、API Gateway、Step Functions、IAMロール |
| **auth-stack.ts** | 認証・認可 | Cognito User Pool、User Pool Client、認証設定 |
| **monitoring-stack.ts** | モニタリング | CloudWatchダッシュボード、アラーム、メトリクス |
| **amplify-frontend-stack.ts** | フロントエンド | AWS Amplify Hosting、自動ビルド・デプロイ |

---

### `/src` - バックエンドソースコード

バックエンドのビジネスロジックとデータアクセス層を含むディレクトリです。

```
src/
├── lambdas/                      # Lambda関数
├── models/                       # データモデル
├── repositories/                 # データアクセス層
├── utils/                        # ユーティリティ
└── DATA_ACCESS_LAYER.md          # データアクセス層の説明
```

#### `/src/lambdas` - Lambda関数

```
src/lambdas/
├── upload-handler/               # ファイルアップロード処理
├── start-processing/             # Step Functions起動
├── transcribe-trigger/           # Transcribeジョブ開始
├── check-transcribe-status/      # Transcribeステータス確認
├── minutes-generator/            # 議事録生成
├── get-job-status/               # ジョブステータス取得
├── list-jobs/                    # ジョブ一覧取得
├── get-minutes/                  # 議事録取得
├── list-minutes/                 # 議事録一覧取得
├── download-minutes/             # ダウンロードURL生成
├── update-minutes/               # 議事録更新
├── search-minutes/               # AI検索
├── chat-handler/                 # チャットQ&A
├── s3-upload-trigger/            # S3アップロードトリガー
└── README.md                     # Lambda関数の概要
```

**Lambda関数の詳細**:

| 関数名 | 説明 | トリガー | 主要な処理 |
|-------|------|---------|-----------|
| **upload-handler** | ファイルアップロード | API Gateway | Presigned URL生成、ジョブレコード作成 |
| **start-processing** | 処理開始 | API Gateway | Step Functionsワークフロー起動 |
| **transcribe-trigger** | 文字起こし開始 | Step Functions | AWS Transcribeジョブ開始（話者識別有効） |
| **check-transcribe-status** | ステータス確認 | Step Functions | Transcribeジョブのステータスポーリング |
| **minutes-generator** | 議事録生成 | Step Functions | Bedrock呼び出し、議事録生成 |
| **get-job-status** | ジョブステータス取得 | API Gateway | DynamoDBからステータス取得 |
| **list-jobs** | ジョブ一覧取得 | API Gateway | ユーザー別ジョブ一覧取得 |
| **get-minutes** | 議事録取得 | API Gateway | S3から議事録取得 |
| **list-minutes** | 議事録一覧取得 | API Gateway | ユーザー別議事録一覧取得 |
| **download-minutes** | ダウンロード | API Gateway | Presigned URL生成（日本語ファイル名対応） |
| **update-minutes** | 議事録更新 | API Gateway | トピック編集、S3更新 |
| **search-minutes** | AI検索 | API Gateway | Bedrock Embeddings、セマンティック検索 |
| **chat-handler** | チャットQ&A | API Gateway | Bedrock Chat、コンテキスト検索 |
| **s3-upload-trigger** | S3イベント処理 | S3 Event | アップロード完了時の処理 |


#### `/src/models` - データモデル

```
src/models/
├── index.ts                      # モデルのエクスポート
├── meeting-job.ts                # MeetingJobモデル（ジョブ情報）
├── minutes.ts                    # Minutesモデル（議事録）
└── transcript.ts                 # Transcriptモデル（文字起こし結果）
```

**データモデルの詳細**:

| モデル | 説明 | 主要フィールド |
|-------|------|--------------|
| **MeetingJob** | ジョブ情報 | jobId, userId, status, videoFileName, createdAt, updatedAt |
| **Minutes** | 議事録 | jobId, summary, agendaItems, topics(後方互換), decisions(後方互換), nextActions(後方互換) |
| **AgendaItem** | 論点ごとの議事録 | issue, discussion[], conclusion, nextIssues[], nextActions[] |
| **DiscussionEntry** | 議論内容の各発言 | speaker, content |
| **AgendaNextAction** | 論点ごとのネクストアクション | assignee, action, dueDate |
| **Transcript** | 文字起こし結果 | jobId, speakers, segments, fullText, confidence |

**議事録の出力構造（論点ベース）**:

```json
{
  "summary": "会議の概要",
  "agendaItems": [
    {
      "issue": "論点（議題）",
      "discussion": [{"speaker": "発言者", "content": "発言内容"}],
      "conclusion": "結論",
      "nextIssues": ["派生した次の論点"],
      "nextActions": [{"assignee": "担当者", "action": "アクション", "dueDate": "期限"}]
    }
  ],
  "decisions": [{"description": "決定内容", "timestamp": "HH:MM:SS"}],
  "nextActions": [{"description": "アクション", "assignee": "担当者", "dueDate": "YYYY-MM-DD", "timestamp": "HH:MM:SS"}]
}
```

#### `/src/repositories` - データアクセス層

```
src/repositories/
├── index.ts                      # リポジトリのエクスポート
├── meeting-job-repository.ts     # DynamoDB操作（CRUD）
├── example.ts                    # リポジトリの使用例
├── README.md                     # リポジトリの説明
└── __tests__/                    # リポジトリのテスト
```

**リポジトリパターン**:
- DynamoDBへのアクセスを抽象化
- CRUD操作の統一インターフェース
- エラーハンドリングの一元化
- テスタビリティの向上

#### `/src/utils` - ユーティリティ

```
src/utils/
├── index.ts                      # ユーティリティのエクスポート
├── bedrock-client.ts             # Bedrock APIクライアント
├── transcript-parser.ts          # 文字起こし結果パーサー
├── logger.ts                     # CloudWatchロガー
├── metrics.ts                    # CloudWatchメトリクス
├── error-handler.ts              # エラーハンドリング
├── errors.ts                     # カスタムエラークラス
├── auth.ts                       # 認証ユーティリティ
└── __tests__/                    # ユーティリティのテスト
```

**ユーティリティの詳細**:

| ユーティリティ | 説明 | 主要機能 |
|--------------|------|---------|
| **bedrock-client.ts** | Bedrock API | 議事録生成、検索、チャット |
| **transcript-parser.ts** | パーサー | Transcribe結果の解析、話者識別 |
| **logger.ts** | ロガー | 構造化ログ、CloudWatch連携 |
| **metrics.ts** | メトリクス | カスタムメトリクス送信 |
| **error-handler.ts** | エラー処理 | 統一エラーレスポンス |
| **errors.ts** | エラークラス | カスタムエラー定義 |
| **auth.ts** | 認証 | JWT検証、ユーザー情報取得 |

---

### `/frontend` - フロントエンド

Next.js 14（App Router）を使用したフロントエンドアプリケーションです。

```
frontend/
├── app/                          # Next.js App Router
├── components/                   # Reactコンポーネント
├── lib/                          # ライブラリとユーティリティ
├── types/                        # TypeScript型定義
├── e2e/                          # E2Eテスト（Playwright）
├── .next/                        # Next.jsビルド出力
├── node_modules/                 # 依存関係
├── .env.local                    # ローカル環境変数
├── .env.example                  # 環境変数のサンプル
├── next.config.mjs               # Next.js設定
├── tailwind.config.ts            # TailwindCSS設定
├── postcss.config.mjs            # PostCSS設定
├── playwright.config.ts          # Playwright設定
├── tsconfig.json                 # TypeScript設定
├── package.json                  # 依存関係とスクリプト
├── README.md                     # フロントエンドの説明
└── SETUP.md                      # フロントエンドセットアップガイド
```

#### `/frontend/app` - Next.js App Router

```
frontend/app/
├── layout.tsx                    # ルートレイアウト
├── page.tsx                      # トップページ
├── globals.css                   # グローバルスタイル
├── fonts/                        # フォントファイル
├── auth/                         # 認証ページ
│   ├── login/                    # ログインページ
│   ├── register/                 # 登録ページ
│   └── verify/                   # メール確認ページ
├── upload/                       # アップロードページ
│   └── page.tsx                  # ファイルアップロードUI
├── jobs/                         # ジョブ関連ページ
│   ├── page.tsx                  # ジョブ一覧ページ
│   └── [jobId]/                  # ジョブ詳細ページ
│       ├── page.tsx              # ジョブステータス表示
│       └── minutes/              # 議事録ページ
│           └── page.tsx          # 議事録表示・編集
└── minutes/                      # 議事録一覧ページ
    └── page.tsx                  # 議事録一覧表示
```

**ページの役割**:

| ページ | パス | 説明 |
|-------|------|------|
| **トップページ** | `/` | アプリケーションの概要、ナビゲーション |
| **ログイン** | `/auth/login` | ユーザーログイン |
| **登録** | `/auth/register` | 新規ユーザー登録 |
| **メール確認** | `/auth/verify` | メールアドレス確認 |
| **アップロード** | `/upload` | MP4ファイルアップロード |
| **ジョブ一覧** | `/jobs` | ジョブ一覧表示 |
| **ジョブ詳細** | `/jobs/[jobId]` | ジョブステータス、進捗表示 |
| **議事録** | `/jobs/[jobId]/minutes` | 議事録表示・編集・ダウンロード |
| **議事録一覧** | `/minutes` | 議事録一覧表示 |

#### `/frontend/components` - Reactコンポーネント

```
frontend/components/
├── chat-button.tsx               # チャットボタン
├── chat-container.tsx            # チャットコンテナ
├── chat-input.tsx                # チャット入力
├── chat-message.tsx              # チャットメッセージ
├── chat-modal.tsx                # チャットモーダル
├── ai-search-modal.tsx           # AI検索モーダル
├── search-container.tsx          # 検索コンテナ
├── search-input.tsx              # 検索入力
├── search-message.tsx            # 検索メッセージ
├── topic-editor.tsx              # トピック編集
├── topic-list.tsx                # トピック一覧
├── minutes-list-item.tsx         # 議事録リストアイテム
├── minutes-filter.tsx            # 議事録フィルター
├── pagination.tsx                # ページネーション
├── loading-skeleton.tsx          # ローディングスケルトン
├── error-message.tsx             # エラーメッセージ
├── typing-indicator.tsx          # タイピングインジケーター
└── protected-route.tsx           # 認証保護ルート
```

**コンポーネントの分類**:

| カテゴリ | コンポーネント | 説明 |
|---------|--------------|------|
| **チャット** | chat-button, chat-container, chat-input, chat-message, chat-modal | チャットQ&A機能 |
| **検索** | ai-search-modal, search-container, search-input, search-message | AI検索機能 |
| **議事録** | topic-editor, topic-list, minutes-list-item, minutes-filter | 議事録表示・編集 |
| **UI** | pagination, loading-skeleton, error-message, typing-indicator | 共通UIコンポーネント |
| **認証** | protected-route | 認証保護 |

#### `/frontend/lib` - ライブラリとユーティリティ

```
frontend/lib/
├── api-client.ts                 # Axiosクライアント設定
├── api-service.ts                # API通信サービス
├── auth.ts                       # 認証ユーティリティ
├── auth-context.tsx              # 認証コンテキスト
├── config.ts                     # フロントエンド設定
├── utils.ts                      # 汎用ユーティリティ
├── cache.ts                      # キャッシュ管理
├── query-provider.tsx            # React Query Provider
└── toast-provider.tsx            # Toast通知Provider
```

**ライブラリの役割**:

| ファイル | 説明 | 主要機能 |
|---------|------|---------|
| **api-client.ts** | HTTPクライアント | Axios設定、インターセプター、エラーハンドリング |
| **api-service.ts** | APIサービス | API呼び出しメソッド、型安全性 |
| **auth.ts** | 認証 | ログイン、ログアウト、トークン管理 |
| **auth-context.tsx** | 認証コンテキスト | グローバル認証状態管理 |
| **config.ts** | 設定 | 環境変数、API URL |
| **utils.ts** | ユーティリティ | 日付フォーマット、ファイルサイズ変換 |
| **cache.ts** | キャッシュ | ローカルストレージ、セッションストレージ |
| **query-provider.tsx** | React Query | サーバー状態管理 |
| **toast-provider.tsx** | 通知 | トースト通知表示 |

#### `/frontend/e2e` - E2Eテスト

```
frontend/e2e/
├── auth.spec.ts                  # 認証テスト
├── upload.spec.ts                # アップロードテスト
├── jobs.spec.ts                  # ジョブテスト
├── minutes.spec.ts               # 議事録テスト
├── integration.spec.ts           # 統合テスト
├── smoke.spec.ts                 # スモークテスト
├── global-setup.ts               # グローバルセットアップ
├── global-teardown.ts            # グローバルティアダウン
├── README.md                     # E2Eテストの説明
├── fixtures/                     # テストフィクスチャ
├── helpers/                      # テストヘルパー
└── mocks/                        # モックデータ
```

**テストの種類**:

| テストファイル | 説明 | テストケース |
|--------------|------|------------|
| **auth.spec.ts** | 認証テスト | ログイン、登録、ログアウト |
| **upload.spec.ts** | アップロードテスト | ファイル選択、アップロード、進捗表示 |
| **jobs.spec.ts** | ジョブテスト | ジョブ一覧、ジョブ詳細、ステータス更新 |
| **minutes.spec.ts** | 議事録テスト | 議事録表示、トピック編集、ダウンロード |
| **integration.spec.ts** | 統合テスト | エンドツーエンドフロー |
| **smoke.spec.ts** | スモークテスト | 基本的な動作確認 |


---

### `/scripts` - スクリプト

デプロイ、セットアップ、モニタリング用のスクリプトを含むディレクトリです。

```
scripts/
├── build-lambdas.ps1             # Lambda関数のビルド（esbuild）
├── deploy-frontend.ps1           # フロントエンドデプロイ（CloudFront）
├── deploy-frontend.sh            # フロントエンドデプロイ（Bash版）
├── deploy-amplify.ps1            # Amplifyデプロイ
├── deploy-staging.ps1            # ステージング環境デプロイ
├── deploy-production.ps1         # 本番環境デプロイ
├── deploy-monitoring.ps1         # モニタリングスタックデプロイ
├── setup.ps1                     # 初期セットアップ（PowerShell）
├── setup.sh                      # 初期セットアップ（Bash）
├── setup-mfa-credentials.ps1     # MFA認証情報セットアップ
├── setup-mfa-credentials.sh      # MFA認証情報セットアップ（Bash）
├── setup-budget-alert.ps1        # 予算アラート設定
├── get-env-values.ps1            # 環境変数取得
├── get-env-values.sh             # 環境変数取得（Bash）
├── check-costs.ps1               # コスト確認
├── check-costs-by-tags.ps1       # タグ別コスト確認
├── check-monitoring.ps1          # モニタリング確認
├── check-monitoring-simple.ps1   # シンプルモニタリング確認
├── check-all-services.ps1        # 全サービス確認
├── check-llm-output.ps1          # LLM出力確認
├── verify-resource-tags.ps1      # リソースタグ検証
├── verify-tags.ps1               # タグ検証
├── validate.ps1                  # バリデーション
├── migrate-summary-preview.ps1   # サマリープレビュー移行
├── migrate-summary-preview.ts    # サマリープレビュー移行（TypeScript）
├── cost-filter.json              # コストフィルター設定
├── README-MFA.md                 # MFA設定ガイド
└── README-MIGRATION.md           # マイグレーションガイド
```

**スクリプトの分類**:

| カテゴリ | スクリプト | 説明 |
|---------|-----------|------|
| **ビルド** | build-lambdas.ps1 | Lambda関数のTypeScriptコンパイルとバンドル（esbuild） |
| **デプロイ** | deploy-*.ps1 | 各環境へのデプロイ自動化（dev/staging/production） |
| **セットアップ** | setup*.ps1/sh | 初期環境構築、MFA設定、予算アラート |
| **モニタリング** | check-*.ps1 | コスト確認、リソース監視、サービス状態確認 |
| **バリデーション** | verify-*.ps1, validate.ps1 | タグ検証、設定確認 |
| **マイグレーション** | migrate-*.ps1/ts | データ移行、スキーマ更新 |

---

### `/test` - テスト

バックエンドのユニットテストと統合テストを含むディレクトリです。

```
test/
├── storage-stack.test.ts         # ストレージスタックのテスト
├── compute-stack.test.ts         # コンピュートスタックのテスト
├── step-functions-workflow.test.ts # Step Functionsワークフローのテスト
├── step-functions-integration.test.ts # Step Functions統合テスト
└── api-integration.test.ts       # API統合テスト
```

**テストの種類**:

| テストファイル | 説明 | テスト対象 |
|--------------|------|-----------|
| **storage-stack.test.ts** | ストレージスタック | S3バケット、DynamoDBテーブル、ライフサイクルポリシー |
| **compute-stack.test.ts** | コンピュートスタック | Lambda関数、API Gateway、Step Functions |
| **step-functions-workflow.test.ts** | ワークフロー | Step Functionsの状態遷移、エラーハンドリング |
| **step-functions-integration.test.ts** | 統合テスト | Step FunctionsとLambdaの連携 |
| **api-integration.test.ts** | API統合テスト | APIエンドポイント、認証、レスポンス |

---

### `/docs` - ドキュメント

プロジェクトのドキュメントを含むディレクトリです。

```
docs/
├── QUICK_START.md                # クイックスタートガイド
├── QUICK_START_CLOUDFRONT.md     # CloudFrontクイックスタート
├── USER_GUIDE.md                 # ユーザーガイド
├── AUTHENTICATION.md             # 認証ガイド
├── AMPLIFY_DEPLOYMENT.md         # Amplifyデプロイガイド
├── CLOUDFRONT_DEPLOYMENT.md      # CloudFrontデプロイガイド
├── GITHUB_AMPLIFY_SETUP.md       # GitHub連携セットアップ
├── GITHUB_TOKEN_SETUP.md         # GitHubトークンセットアップ
├── DEPLOYMENT_PIPELINE.md        # デプロイメントパイプライン
├── STEP_FUNCTIONS_WORKFLOW.md    # Step Functionsワークフロー
├── COST_MANAGEMENT.md            # コスト管理ガイド
├── MONITORING.md                 # モニタリングガイド
├── TAGGING_STRATEGY.md           # タグ戦略
├── ENV_VARIABLES_GUIDE.md        # 環境変数ガイド
├── MEETING_CONTEXT_FEATURE.md    # 会議コンテキスト機能
├── JAPANESE_FILENAME_FIX.md      # 日本語ファイル名対応
├── TIMESTAMP_FIX.md              # タイムスタンプ修正
├── NEXT_STEPS.md                 # 次のステップガイド
└── PROJECT_STRUCTURE.md          # プロジェクト構造ガイド（このファイル）
```

**ドキュメントの分類**:

| カテゴリ | ドキュメント | 対象読者 |
|---------|------------|---------|
| **ユーザー向け** | QUICK_START.md, USER_GUIDE.md | エンドユーザー |
| **開発者向け** | ARCHITECTURE.md, STEP_FUNCTIONS_WORKFLOW.md | 開発者 |
| **運用向け** | DEPLOYMENT_PIPELINE.md, MONITORING.md, COST_MANAGEMENT.md | DevOps、運用担当者 |
| **セットアップ** | AMPLIFY_DEPLOYMENT.md, GITHUB_AMPLIFY_SETUP.md | デプロイ担当者 |
| **機能説明** | AUTHENTICATION.md, MEETING_CONTEXT_FEATURE.md | 開発者、ユーザー |
| **トラブルシューティング** | JAPANESE_FILENAME_FIX.md, TIMESTAMP_FIX.md | 開発者、運用担当者 |

---

### `/.github` - CI/CD

GitHub Actionsのワークフロー定義を含むディレクトリです。

```
.github/
└── workflows/                    # GitHub Actionsワークフロー
    ├── ci.yml                    # 継続的インテグレーション
    ├── deploy-staging.yml        # ステージング環境デプロイ
    └── deploy-production.yml     # 本番環境デプロイ
```

**CI/CDパイプライン**:

| ワークフロー | トリガー | 処理内容 |
|------------|---------|---------|
| **ci.yml** | プルリクエスト、mainブランチへのプッシュ | Lint、テスト、ビルド、セキュリティスキャン |
| **deploy-staging.yml** | stagingブランチへのプッシュ | ステージング環境への自動デプロイ |
| **deploy-production.yml** | productionブランチへのプッシュ | 本番環境への手動承認デプロイ |

---

### `/.kiro` - Kiro設定

Kiro（AI開発アシスタント）の設定と仕様書を含むディレクトリです。

```
.kiro/
├── settings/                     # Kiro設定
│   └── mcp.json                  # MCP設定
├── steering/                     # ステアリングファイル
│   └── japanese-response.md      # 日本語応答ルール
└── specs/                        # 仕様書
    ├── minutes-feedback-system/  # 議事録フィードバックシステム仕様
    │   ├── requirements.md       # 要件定義
    │   ├── design.md             # 設計書
    │   └── tasks.md              # タスク一覧
    └── chat-to-minutes-reflection/ # チャット議事録リフレクション仕様
        └── requirements.md       # 要件定義
```

---

### その他のディレクトリ

#### `/cdk_logs` - CDKデプロイログ

```
cdk_logs/
├── init_cdk_deploy_dev.log       # 初期デプロイログ
├── init_cdk_diff_dev.log         # 初期差分ログ
├── after_task3_cdk_deploy_dev.log # タスク3後デプロイログ
├── after_task3_cdk_diff_dev.log  # タスク3後差分ログ
├── task5_cdk_deploy_dev.log      # タスク5デプロイログ
└── task5_cdk_diff_dev.log        # タスク5差分ログ
```

#### `/cdk.out` - CDK出力

```
cdk.out/                          # CloudFormationテンプレート
├── assembly-*.json               # アセンブリマニフェスト
├── *.template.json               # CloudFormationテンプレート
└── manifest.json                 # CDKマニフェスト
```

#### `/dist` - ビルド出力

```
dist/                             # TypeScriptコンパイル出力
├── lambdas/                      # Lambda関数のビルド
├── models/                       # モデルのビルド
├── repositories/                 # リポジトリのビルド
└── utils/                        # ユーティリティのビルド
```

---

## ファイルの役割

### 設定ファイル

| ファイル | 説明 | 主要設定 |
|---------|------|---------|
| **package.json** | プロジェクトの依存関係、スクリプト、メタデータ | dependencies, devDependencies, scripts |
| **tsconfig.json** | TypeScriptコンパイラ設定 | target: ES2020, module: commonjs, strict: true |
| **cdk.json** | AWS CDK設定 | app: ts-node bin/meeting-minutes-app.ts |
| **jest.config.js** | Jestテスト設定 | preset: ts-jest, testEnvironment: node, coverage |
| **.gitignore** | Gitで無視するファイル | node_modules, .env, dist, cdk.out |
| **.env** | ローカル環境変数 | AWS認証情報、リージョン、API URL |
| **.env.example** | 環境変数のサンプル | 必要な環境変数のテンプレート |
| **.env.staging** | ステージング環境変数 | ステージング環境固有の設定 |
| **.env.production** | 本番環境変数 | 本番環境固有の設定 |

### ドキュメントファイル

| ファイル | 説明 | 対象読者 |
|---------|------|---------|
| **README.md** | プロジェクトの概要、クイックスタート、使い方 | すべてのユーザー |
| **ARCHITECTURE.md** | システムアーキテクチャの詳細説明 | 開発者、アーキテクト |
| **SETUP_COMPLETE.md** | セットアップ完了ガイド | 開発者 |
| **PROJECT_COMPLETION_SUMMARY.md** | プロジェクト完了サマリー | プロジェクトマネージャー、開発者 |
| **DEPLOYMENT.md** | デプロイメントガイド（英語） | DevOps、運用担当者 |
| **DEPLOYMENT.ja.md** | デプロイメントガイド（日本語） | DevOps、運用担当者 |
| **CI_TEST_FIX_SUMMARY.md** | CIテスト修正サマリー | 開発者 |

### ログファイル

| ファイル | 説明 | 用途 |
|---------|------|------|
| **amplify-build-log.txt** | Amplifyビルドログ | ビルドエラーのデバッグ |
| **cdk_logs/*.log** | CDKデプロイ・差分ログ | デプロイ履歴、トラブルシューティング |
| **temp_minutes.md** | 一時的な議事録ファイル | 開発中のテスト用 |

---

## データフロー

### 1. ファイルアップロードフロー

```
ユーザー
  ↓ (1) ファイル選択
フロントエンド (upload/page.tsx)
  ↓ (2) Presigned URLリクエスト
API Gateway (/api/upload)
  ↓ (3) Lambda呼び出し
upload-handler Lambda
  ↓ (4) Presigned URL生成
S3 (入力バケット)
  ↓ (5) 直接アップロード
フロントエンド
  ↓ (6) ジョブレコード作成
DynamoDB (MeetingJobsテーブル)
```

### 2. 処理フロー

```
start-processing Lambda
  ↓ (1) ワークフロー起動
Step Functions
  ↓ (2) Transcribeジョブ開始
transcribe-trigger Lambda
  ↓ (3) Transcribeジョブ実行
AWS Transcribe
  ↓ (4) 文字起こし結果
S3 (出力バケット)
  ↓ (5) ステータス確認（ポーリング）
check-transcribe-status Lambda
  ↓ (6) 議事録生成
minutes-generator Lambda
  ↓ (7) Bedrock呼び出し
Amazon Bedrock (Claude 3.5 Sonnet v2)
  ↓ (8) 議事録保存
S3 (出力バケット)
  ↓ (9) ステータス更新
DynamoDB (MeetingJobsテーブル)
```

### 3. 議事録取得フロー

```
ユーザー
  ↓ (1) 議事録リクエスト
フロントエンド (jobs/[jobId]/minutes/page.tsx)
  ↓ (2) API呼び出し
API Gateway (/api/jobs/{jobId}/minutes)
  ↓ (3) Lambda呼び出し
get-minutes Lambda
  ↓ (4) 議事録取得
S3 (出力バケット)
  ↓ (5) 議事録データ
フロントエンド
  ↓ (6) Markdown表示
ユーザー
```

### 4. AI検索フロー

```
ユーザー
  ↓ (1) 検索クエリ入力
フロントエンド (ai-search-modal.tsx)
  ↓ (2) 検索リクエスト
API Gateway (/api/search)
  ↓ (3) Lambda呼び出し
search-minutes Lambda
  ↓ (4) Embeddings生成
Amazon Bedrock (Titan Embeddings)
  ↓ (5) セマンティック検索
DynamoDB + S3
  ↓ (6) 検索結果
フロントエンド
  ↓ (7) 結果表示
ユーザー
```

### 5. チャットQ&Aフロー

```
ユーザー
  ↓ (1) 質問入力
フロントエンド (chat-container.tsx)
  ↓ (2) チャットリクエスト
API Gateway (/api/jobs/{jobId}/chat)
  ↓ (3) Lambda呼び出し
chat-handler Lambda
  ↓ (4) コンテキスト取得
S3 (議事録)
  ↓ (5) Bedrock呼び出し
Amazon Bedrock (Claude 3.5 Sonnet v2)
  ↓ (6) 回答生成
フロントエンド
  ↓ (7) 回答表示
ユーザー
```

---

## まとめ

このプロジェクトは、以下の主要コンポーネントで構成されています：

1. **インフラストラクチャ** (`/lib`): AWS CDKによるIaC
2. **バックエンド** (`/src`): Lambda関数、データモデル、ユーティリティ
3. **フロントエンド** (`/frontend`): Next.js 14 + React 18
4. **スクリプト** (`/scripts`): デプロイ、モニタリング、セットアップ
5. **テスト** (`/test`, `/frontend/e2e`): ユニットテスト、統合テスト、E2Eテスト
6. **ドキュメント** (`/docs`): 包括的なドキュメント
7. **CI/CD** (`/.github`): GitHub Actions

各コンポーネントは明確に分離されており、保守性と拡張性が高い設計になっています。

---

**最終更新日**: 2025年1月6日
