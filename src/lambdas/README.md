# Lambda関数

このディレクトリには、Meeting Minutes Generatorのすべての Lambda 関数が含まれています。

## 構造

各Lambda関数は独自のディレクトリに配置されており、以下の構造になっています：

```
lambdas/
├── upload-handler/          # アップロード処理
│   ├── index.ts            # メインハンドラー
│   └── __tests__/          # ユニットテスト
│       └── index.test.ts
└── README.md
```

## 実装済みの関数

### 1. Upload Handler (`upload-handler`)

**目的**: MP4ファイルのアップロード用Presigned URLを生成し、DynamoDBにジョブレコードを作成します。

**エンドポイント**: `POST /api/upload`

**リクエスト**:
```json
{
  "fileName": "meeting.mp4",
  "fileSize": 104857600,
  "contentType": "video/mp4",
  "userId": "user-123",
  "metadata": {
    "meetingTitle": "週次ミーティング",
    "meetingDate": "2025-10-06",
    "participants": ["田中", "佐藤"]
  }
}
```

**レスポンス**:
```json
{
  "jobId": "uuid-v4",
  "uploadUrl": "https://s3.amazonaws.com/...",
  "expiresIn": 3600
}
```

**機能**:
- ファイルバリデーション（形式、サイズ、MIMEタイプ）
- S3 Presigned URL生成
- DynamoDBへのジョブレコード作成
- エラーハンドリングとログ記録

**環境変数**:
- `INPUT_BUCKET_NAME`: 入力ファイル用S3バケット名
- `JOBS_TABLE_NAME`: ジョブ管理用DynamoDBテーブル名
- `MAX_FILE_SIZE_MB`: 最大ファイルサイズ（MB）
- `ALLOWED_FILE_TYPES`: 許可されるファイルタイプ（カンマ区切り）

## ビルド

Lambda関数をビルドするには：

```bash
npm run build:lambdas
```

これにより、TypeScriptがコンパイルされ、必要な依存関係が `dist/lambdas/` ディレクトリにコピーされます。

## テスト

すべてのLambda関数のテストを実行：

```bash
npm test
```

特定のLambda関数のテストを実行：

```bash
npm test -- --testPathPattern=upload-handler
```

## デプロイ

Lambda関数はAWS CDKを使用してデプロイされます：

```bash
npm run deploy
```

## 開発ガイドライン

### 新しいLambda関数の追加

1. 新しいディレクトリを作成: `src/lambdas/your-function-name/`
2. `index.ts` にハンドラーを実装
3. `__tests__/index.test.ts` にユニットテストを作成
4. `scripts/build-lambdas.ps1` に関数名を追加
5. `lib/compute-stack.ts` でCDKリソースを定義

### コーディング規約

- すべてのエラーは適切にログに記録する
- 構造化ログフォーマットを使用する（Logger クラス）
- カスタムエラークラスを使用する（ValidationError, InternalServerError など）
- 環境変数は関数の先頭で定義する
- すべての公開関数にJSDocコメントを追加する

### エラーハンドリング

```typescript
try {
  // 処理
} catch (error) {
  logger.error('エラーメッセージ', error as Error, { context });
  
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: JSON.stringify({ error: error.message }),
    };
  }
  
  return {
    statusCode: 500,
    body: JSON.stringify({ error: '予期しないエラーが発生しました' }),
  };
}
```

## トラブルシューティング

### ビルドエラー

TypeScriptのコンパイルエラーが発生した場合：

```bash
npm run build
```

エラーメッセージを確認して修正してください。

### テストエラー

テストが失敗した場合：

1. モックが正しく設定されているか確認
2. 環境変数が設定されているか確認
3. 依存関係が最新か確認: `npm install`

### デプロイエラー

デプロイが失敗した場合：

1. AWS認証情報が設定されているか確認
2. 必要なIAM権限があるか確認
3. CDKスタックが正しく定義されているか確認
