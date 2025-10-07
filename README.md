# Meeting Minutes Generator

MP4形式の会議録画ファイルから、AWS Transcribe（音声文字起こし）とAmazon Bedrock（生成AI）を使用して、自動的に構造化された議事録を生成するサーバーレスアプリケーションです。

## 主な機能

- 📤 **ファイルアップロード**: ドラッグ&ドロップまたはファイル選択でMP4ファイルをアップロード
- 🎤 **自動文字起こし**: AWS Transcribeによる高精度な音声認識と話者識別
- 🤖 **AI議事録生成**: Amazon Bedrockを使用して、概要・決定事項・ネクストアクションを自動抽出
- 📊 **リアルタイム進捗表示**: 処理状況をリアルタイムで確認
- 📝 **議事録編集**: 生成された議事録をブラウザ上で編集可能
- 💾 **複数形式ダウンロード**: Markdown、PDF、テキスト形式でダウンロード

## アーキテクチャ

このアプリケーションはAWS上の完全サーバーレスアーキテクチャを使用しています:

### フロントエンド
- **Next.js 14** (App Router) with TypeScript
- **TailwindCSS** でスタイリング
- **React Hot Toast** で通知表示

### バックエンド
- **AWS Lambda**: 各種処理を実行するサーバーレス関数
- **API Gateway**: RESTful APIエンドポイント
- **Step Functions**: ワークフローオーケストレーション
- **AWS Transcribe**: 音声文字起こしと話者識別
- **Amazon Bedrock**: Claude 3を使用した議事録生成

### ストレージ
- **S3**: 動画ファイルと議事録の保存
- **DynamoDB**: ジョブメタデータとステータス管理

### インフラストラクチャ
- **AWS CDK**: Infrastructure as Code
- **TypeScript**: 型安全な開発

## 前提条件

- **Node.js 18以上** とnpm
- **AWS CLI** - 適切な認証情報で設定済み
- **AWS CDK CLI** - `npm install -g aws-cdk`でインストール
- **AWSアカウント** - 以下のサービスへのアクセス権限が必要:
  - S3、DynamoDB、Lambda、API Gateway、Step Functions
  - AWS Transcribe、Amazon Bedrock（Claude 3モデル）
  - IAM、CloudWatch Logs

## クイックスタート

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd meeting-minutes-v2
```

### 2. バックエンドのセットアップ

#### 依存関係のインストール

```bash
npm install
```

#### Amazon Bedrockモデルアクセスの有効化

AWS Consoleで以下を実行:
1. Amazon Bedrockコンソールを開く
2. 「Model access」から「Claude 3 Sonnet」モデルへのアクセスをリクエスト
3. 承認されるまで待機（通常は即時）

#### CDKのブートストラップ（初回のみ）

```bash
# AWSアカウントIDとリージョンを確認
aws sts get-caller-identity
aws configure get region

# ブートストラップ実行
cdk bootstrap aws://YOUR-ACCOUNT-ID/YOUR-REGION
```

#### プロジェクトのビルド

```bash
npm run build
```

#### インフラストラクチャのデプロイ

```bash
# すべてのスタックをデプロイ
npm run deploy

# または個別にデプロイ
npx cdk deploy meeting-minutes-generator-storage-dev
npx cdk deploy meeting-minutes-generator-compute-dev
```

デプロイ完了後、API Gateway URLが出力されます。この URLをメモしてください。

### 3. フロントエンドのセットアップ

#### 依存関係のインストール

```bash
cd frontend
npm install
```

#### 環境変数の設定

`frontend/.env.local`ファイルを作成:

```env
NEXT_PUBLIC_API_URL=https://YOUR-API-GATEWAY-URL.execute-api.ap-northeast-1.amazonaws.com/dev
NEXT_PUBLIC_APP_NAME=Meeting Minutes Generator
```

#### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアクセスできます。

### 4. 使い方

1. **ファイルアップロード**: トップページから「ファイルをアップロード」をクリック
2. **MP4ファイルを選択**: ドラッグ&ドロップまたはファイル選択でアップロード
3. **処理を待つ**: 自動的に文字起こしと議事録生成が開始されます（数分かかります）
4. **議事録を確認**: 処理完了後、議事録を表示・編集・ダウンロードできます

## プロジェクト構造

```
.
├── bin/
│   └── meeting-minutes-app.ts           # CDKアプリエントリーポイント
├── lib/
│   ├── storage-stack.ts                 # S3とDynamoDBリソース
│   ├── compute-stack.ts                 # Lambda、Step Functions、API Gateway
│   └── config.ts                        # 設定管理
├── src/
│   ├── lambdas/                         # Lambda関数
│   │   ├── upload-handler/              # ファイルアップロード処理
│   │   ├── start-processing/            # Step Functions起動
│   │   ├── transcribe-trigger/          # Transcribeジョブ開始
│   │   ├── check-transcribe-status/     # Transcribeステータス確認
│   │   ├── minutes-generator/           # 議事録生成（Bedrock）
│   │   ├── get-job-status/              # ジョブステータス取得
│   │   ├── list-jobs/                   # ジョブ一覧取得
│   │   ├── get-minutes/                 # 議事録取得
│   │   └── download-minutes/            # ダウンロードURL生成
│   ├── repositories/                    # データアクセス層
│   │   └── meeting-job-repository.ts    # DynamoDBアクセス
│   ├── models/                          # データモデル
│   │   ├── meeting-job.ts               # ジョブモデル
│   │   └── minutes.ts                   # 議事録モデル
│   └── utils/                           # ユーティリティ
│       ├── bedrock-client.ts            # Bedrock API クライアント
│       ├── transcript-parser.ts         # 文字起こし結果パーサー
│       ├── logger.ts                    # ロガー
│       └── errors.ts                    # エラークラス
├── frontend/                            # Next.jsフロントエンド
│   ├── app/                             # Next.js App Router
│   │   ├── page.tsx                     # トップページ
│   │   ├── upload/                      # アップロードページ
│   │   ├── jobs/                        # ジョブ一覧・詳細
│   │   └── jobs/[jobId]/minutes/        # 議事録表示・編集
│   ├── lib/                             # API通信とユーティリティ
│   │   ├── api-client.ts                # Axiosクライアント
│   │   ├── api-service.ts               # APIサービス
│   │   └── config.ts                    # 設定
│   ├── types/                           # TypeScript型定義
│   └── package.json                     # フロントエンド依存関係
├── docs/                                # ドキュメント
│   └── STEP_FUNCTIONS_WORKFLOW.md       # ワークフロー説明
├── test/                                # テストファイル
├── cdk.json                             # CDK設定
├── tsconfig.json                        # TypeScript設定
├── package.json                         # 依存関係
├── ARCHITECTURE.md                      # アーキテクチャ詳細
└── SETUP_COMPLETE.md                    # セットアップ完了ガイド
```

## 利用可能なスクリプト

- `npm run build` - TypeScriptをコンパイル
- `npm run watch` - 開発用ウォッチモード
- `npm test` - テストを実行
- `npm run cdk` - CDK CLIコマンドを実行
- `npm run deploy` - すべてのスタックをデプロイ
- `npm run synth` - CloudFormationテンプレートを合成

## デプロイされるAWSリソース

### ストレージスタック (`meeting-minutes-generator-storage-dev`)

- **S3バケット（入力用）**: 
  - アップロードされた動画ファイルを保存
  - 30日後に自動削除（ライフサイクルルール）
  - サーバーサイド暗号化（AES-256）
  
- **S3バケット（出力用）**: 
  - 文字起こし結果と議事録を保存
  - バージョニング有効
  - サーバーサイド暗号化（AES-256）
  
- **DynamoDBテーブル**: 
  - ジョブメタデータとステータス管理
  - GSI: userId-createdAt-index（ユーザー別ジョブ一覧取得用）
  - オンデマンド課金モード

### コンピュートスタック (`meeting-minutes-generator-compute-dev`)

- **Lambda関数（9個）**:
  - Upload Handler: Presigned URL生成
  - Start Processing: Step Functions起動
  - Transcribe Trigger: Transcribeジョブ開始
  - Check Transcribe Status: ステータス確認
  - Minutes Generator: 議事録生成（Bedrock）
  - Get Job Status: ジョブステータス取得
  - List Jobs: ジョブ一覧取得
  - Get Minutes: 議事録取得
  - Download Minutes: ダウンロードURL生成

- **Step Functions ステートマシン**:
  - 文字起こしから議事録生成までのワークフロー
  - 自動リトライとエラーハンドリング
  - CloudWatch Logsへの詳細ログ出力

- **API Gateway**:
  - RESTful APIエンドポイント
  - CORS設定済み
  - Lambda統合

- **IAMロール（3個）**:
  - Lambda実行ロール（S3、DynamoDB、Transcribe、Bedrockアクセス）
  - Transcribeロール（S3アクセス）
  - Step Functionsロール（Lambda呼び出し）

## 開発ワークフロー

1. `lib/`のインフラストラクチャコードを変更
2. ビルド: `npm run build`
3. 変更を確認: `cdk diff`
4. デプロイ: `cdk deploy`

## テスト

ユニットテストの実行:

```bash
npm test
```

ウォッチモードでテストを実行:

```bash
npm test -- --watch
```

## クリーンアップ

開発環境のリソースを削除する場合:

```bash
# すべてのスタックを削除
npx cdk destroy --all

# または個別に削除
npx cdk destroy meeting-minutes-generator-compute-dev
npx cdk destroy meeting-minutes-generator-storage-dev
```

**⚠️ 警告**: 
- S3バケット内のファイルは自動削除されません。先に手動で削除してください。
- DynamoDBテーブルのデータも削除されます。
- 本番環境では削除保護を有効にすることを推奨します。

## 参考ドキュメント

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 詳細なアーキテクチャ説明
- [SETUP_COMPLETE.md](./SETUP_COMPLETE.md) - セットアップ完了ガイド
- [docs/STEP_FUNCTIONS_WORKFLOW.md](./docs/STEP_FUNCTIONS_WORKFLOW.md) - ワークフロー詳細
- [frontend/README.md](./frontend/README.md) - フロントエンド開発ガイド
- [frontend/SETUP.md](./frontend/SETUP.md) - フロントエンドセットアップ

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## サポート

問題が発生した場合:
1. [Issues](https://github.com/your-repo/issues)で既存の問題を検索
2. 新しいissueを作成（エラーログとスクリーンショットを含める）
3. CloudWatch Logsでエラーの詳細を確認

## 処理フロー

1. **ファイルアップロード**
   - ユーザーがMP4ファイルをアップロード
   - Upload HandlerがPresigned URLを生成
   - フロントエンドがS3に直接アップロード
   - DynamoDBにジョブレコード作成（ステータス: UPLOADED）

2. **処理開始**
   - Start Processing HandlerがStep Functionsワークフローを起動

3. **文字起こし**
   - Transcribe TriggerがAWS Transcribeジョブを開始
   - Check Transcribe Statusが30秒ごとにステータスを確認
   - 完了したらステータスをGENERATINGに更新

4. **議事録生成**
   - Minutes Generatorが文字起こし結果を取得
   - Amazon Bedrock（Claude 3）で議事録を生成
   - 概要、決定事項、ネクストアクションを抽出
   - S3に議事録を保存
   - ステータスをCOMPLETEDに更新

5. **議事録表示**
   - ユーザーが議事録を表示・編集・ダウンロード

## API エンドポイント

### アップロード
- `POST /api/upload` - Presigned URL取得

### ジョブ管理
- `GET /api/jobs` - ジョブ一覧取得
- `GET /api/jobs/{jobId}` - ジョブステータス取得
- `POST /api/jobs/{jobId}/start` - 処理開始

### 議事録
- `GET /api/jobs/{jobId}/minutes` - 議事録取得
- `GET /api/jobs/{jobId}/download` - ダウンロードURL取得

詳細は`ARCHITECTURE.md`を参照してください。

## 実装状況

### ✅ 完了
- [x] インフラストラクチャのセットアップ（CDK）
- [x] DynamoDBデータモデルとアクセスレイヤー
- [x] ファイルアップロード機能
- [x] AWS Transcribe統合（文字起こし・話者識別）
- [x] Step Functionsワークフロー
- [x] 議事録生成機能（Amazon Bedrock）
- [x] ジョブステータス取得API
- [x] 議事録取得・ダウンロード機能
- [x] フロントエンドプロジェクトのセットアップ
- [x] ファイルアップロードUI
- [x] ジョブ一覧・詳細UI
- [x] 議事録表示・編集・ダウンロードUI

### 🚧 今後の実装予定
- [ ] レスポンシブデザインの最適化
- [ ] 認証機能（Amazon Cognito）
- [ ] エラーハンドリングとログの統合
- [ ] 統合テストとE2Eテスト
- [ ] CI/CDパイプライン
- [ ] モニタリングとアラート設定

## トラブルシューティング

### デプロイエラー

**問題**: CDKデプロイ時に権限エラーが発生
```
User: arn:aws:iam::xxx:user/xxx is not authorized to perform: iam:CreateRole
```

**解決策**: IAMユーザーに適切な権限を付与してください。最低限必要な権限:
- IAMFullAccess
- AmazonS3FullAccess
- AmazonDynamoDBFullAccess
- AWSLambda_FullAccess
- AmazonAPIGatewayAdministrator
- AWSStepFunctionsFullAccess

### Bedrockモデルアクセスエラー

**問題**: 議事録生成時に「AccessDeniedException」が発生

**解決策**: 
1. AWS Consoleで Amazon Bedrockを開く
2. 「Model access」から「Claude 3 Sonnet」へのアクセスをリクエスト
3. 承認されるまで待機

### フロントエンドがAPIに接続できない

**問題**: CORS エラーが発生

**解決策**: 
1. `frontend/.env.local`のAPI URLが正しいか確認
2. API GatewayのCORS設定を確認
3. ブラウザのキャッシュをクリア

### 処理が進まない

**問題**: ジョブステータスが「UPLOADED」のまま

**解決策**:
1. Step Functionsの実行状況を確認:
```bash
aws stepfunctions list-executions --state-machine-arn <STATE_MACHINE_ARN> --region ap-northeast-1
```
2. CloudWatch Logsでエラーを確認
3. 処理を再実行:
```bash
curl -X POST "https://YOUR-API-URL/dev/api/jobs/{jobId}/start?userId=test-user-id"
```

## コスト見積もり

月間100ファイル（各10分）を処理する場合の概算コスト（東京リージョン）:

- **AWS Transcribe**: 約$24（100ファイル × 10分 × $0.024/分）
- **Amazon Bedrock**: 約$3（Claude 3 Sonnet使用）
- **Lambda**: 約$1（実行時間とメモリ使用量による）
- **S3**: 約$1（ストレージとデータ転送）
- **DynamoDB**: 約$1（オンデマンド課金）
- **API Gateway**: 約$0.35（100,000リクエスト）
- **Step Functions**: 約$0.25（ステート遷移数による）

**合計**: 約$30-35/月

※ 実際のコストは使用量により変動します。AWS Cost Explorerで定期的に確認してください。

## セキュリティのベストプラクティス

- ✅ すべてのS3バケットでサーバーサイド暗号化を使用
- ✅ S3バケットはパブリックアクセスをブロック
- ✅ DynamoDBはAWS管理暗号化を使用
- ✅ IAMロールは最小権限の原則に従う
- ✅ API GatewayでCORSを適切に設定
- ✅ CloudWatch Logsで監査ログを記録
- ⚠️ 本番環境では認証機能（Cognito）の実装を推奨
- ⚠️ 本番環境ではAPI Gatewayでレート制限を設定

## ライセンス

MIT
