# Meeting Minutes Generator

MP4ファイルからAWSサービスを使用して自動的に議事録を生成するアプリケーション。

## アーキテクチャ

このアプリケーションはAWS上のサーバーレスアーキテクチャを使用しています:

- **フロントエンド**: Next.js 14 (React) with TypeScript
- **バックエンド**: AWS Lambda関数
- **ストレージ**: S3（動画とドキュメント）、DynamoDB（ジョブメタデータ）
- **処理**: AWS Transcribe（音声テキスト変換）、Amazon Bedrock（議事録生成用LLM）
- **オーケストレーション**: AWS Step Functions
- **API**: API Gateway

## 前提条件

- Node.js 18+とnpm
- 適切な認証情報で設定されたAWS CLI
- AWS CDK CLI（`npm install -g aws-cdk`）
- リソースを作成する権限を持つAWSアカウント

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

サンプル環境ファイルをコピーして、値を更新します:

```bash
copy .env.example .env
```

`.env`を編集して以下を設定:
- `AWS_ACCOUNT_ID`: AWSアカウントID
- `AWS_REGION`: 希望するAWSリージョン（例: us-east-1）
- `ENVIRONMENT`: 環境名（dev、staging、prod）
- 必要に応じてその他の設定値

### 3. CDKのブートストラップ（初回のみ）

このAWSアカウント/リージョンでCDKを初めて使用する場合:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### 4. プロジェクトのビルド

```bash
npm run build
```

### 5. インフラストラクチャのデプロイ

すべてのスタックをデプロイ:

```bash
npm run deploy
```

または特定のスタックをデプロイ:

```bash
cdk deploy meeting-minutes-generator-storage-dev
cdk deploy meeting-minutes-generator-compute-dev
```

## プロジェクト構造

```
.
├── bin/
│   └── meeting-minutes-app.ts      # CDKアプリエントリーポイント
├── lib/
│   ├── storage-stack.ts            # S3とDynamoDBリソース
│   ├── compute-stack.ts            # LambdaとIAMロール
│   └── config.ts                   # 設定管理
├── src/
│   ├── lambdas/                    # Lambda関数コード
│   └── utils/                      # ユーティリティ関数
├── frontend/                       # Next.jsフロントエンド
│   ├── app/                        # Next.js App Router
│   ├── lib/                        # API通信とユーティリティ
│   ├── types/                      # TypeScript型定義
│   └── package.json                # フロントエンド依存関係
├── test/                          # テストファイル
├── cdk.json                       # CDK設定
├── tsconfig.json                  # TypeScript設定
├── package.json                   # 依存関係
└── .env                          # 環境変数（gitには含まれません）
```

## 利用可能なスクリプト

- `npm run build` - TypeScriptをコンパイル
- `npm run watch` - 開発用ウォッチモード
- `npm test` - テストを実行
- `npm run cdk` - CDK CLIコマンドを実行
- `npm run deploy` - すべてのスタックをデプロイ
- `npm run synth` - CloudFormationテンプレートを合成

## CDKスタック

### ストレージスタック

作成されるもの:
- 入力動画用S3バケット（ライフサイクルルール付き）
- 出力ドキュメント用S3バケット（バージョニング付き）
- ジョブメタデータ用DynamoDBテーブル（GSI付き）

### コンピュートスタック

作成されるもの:
- Lambda関数用IAMロール
- AWS Transcribe用IAMロール
- Step Functions用IAMロール
- Bedrockアクセス権限

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

デプロイされたすべてのリソースを削除するには:

```bash
cdk destroy --all
```

**警告**: これによりS3バケットとDynamoDBテーブルを含むすべてのリソースが削除されます（本番環境でない場合）。

## セキュリティ

- すべてのS3バケットでサーバーサイド暗号化を使用
- S3バケットはすべてのパブリックアクセスをブロック
- DynamoDBはAWS管理暗号化を使用
- IAMロールは最小権限の原則に従う
- フロントエンドアクセス用にCORSを設定

## コスト最適化

- S3ライフサイクルルールで古いファイルを安価なストレージに移動
- DynamoDBはオンデマンド課金を使用
- Lambda関数はサーバーレス（使用量に応じた支払い）
- CloudWatchログには保持ポリシーあり

## フロントエンド開発

フロントエンドはNext.js 14を使用して実装されています。

### フロントエンドのセットアップ

```bash
cd frontend
npm install
```

### 環境変数の設定

`frontend/.env.local`を作成して以下を設定:

```env
NEXT_PUBLIC_API_URL=https://your-api-gateway-url.execute-api.ap-northeast-1.amazonaws.com/prod
NEXT_PUBLIC_APP_NAME=Meeting Minutes Generator
```

### 開発サーバーの起動

```bash
cd frontend
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアクセスできます。

### フロントエンドのビルド

```bash
cd frontend
npm run build
```

詳細は`frontend/README.md`と`frontend/SETUP.md`を参照してください。

## 次のステップ

1. ✅ Lambda関数の実装（タスク2-8）- 完了
2. ✅ Step Functionsワークフローの作成（タスク5）- 完了
3. ✅ フロントエンドプロジェクトのセットアップ（タスク9）- 完了
4. フロントエンドUIの実装（タスク10-13）
5. 認証の追加（タスク14）
6. モニタリングとアラートの設定（タスク19）
7. デプロイメントパイプラインの作成（タスク18）

## ライセンス

MIT
