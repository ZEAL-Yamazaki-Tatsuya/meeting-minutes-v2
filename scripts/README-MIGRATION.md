# 議事録 summaryPreview マイグレーションスクリプト

## 概要

既存の議事録から概要の最初の200文字を抽出し、DynamoDB の `summaryPreview` フィールドに保存するバッチ処理スクリプトです。

## 前提条件

- Node.js と npm がインストールされていること
- AWS 認証情報が設定されていること（AWS CLI または環境変数）
- `.env` ファイルに以下の環境変数が設定されていること：
  - `JOBS_TABLE_NAME`: DynamoDB テーブル名
  - `OUTPUT_BUCKET_NAME`: 議事録が保存されている S3 バケット名
  - `AWS_REGION`: AWS リージョン（オプション、デフォルト: us-east-1）

## 使用方法

### TypeScript スクリプトを直接実行

```bash
npx ts-node scripts/migrate-summary-preview.ts
```

### PowerShell スクリプトを使用（Windows）

```powershell
.\scripts\migrate-summary-preview.ps1
```

### DRY RUN モード（実際の更新は行わない）

実際の更新を行わずに、どのジョブが処理されるかを確認できます。

**TypeScript:**
```bash
DRY_RUN=true npx ts-node scripts/migrate-summary-preview.ts
```

**PowerShell:**
```powershell
.\scripts\migrate-summary-preview.ps1 -DryRun
```

## 処理内容

1. DynamoDB テーブルから `status = 'COMPLETED'` のジョブをスキャン
2. 各ジョブについて：
   - すでに `summaryPreview` が存在する場合はスキップ
   - `minutesS3Key` が存在しない場合はスキップ
   - S3 から議事録ファイル（Markdown）を取得
   - Markdown から概要セクションを抽出
   - 概要の最初の200文字を抽出（200文字を超える場合は「...」を追加）
   - DynamoDB の `summaryPreview` フィールドを更新
3. 処理結果のサマリーを表示

## 出力例

```
============================================================
既存議事録の summaryPreview マイグレーション
============================================================
テーブル名: meeting-minutes-generator-jobs-dev
バケット名: meeting-minutes-generator-output-dev
リージョン: us-east-1
DRY RUN: いいえ
============================================================

[1] 処理中: abc123-def456-ghi789
  → S3 から取得中: user-123/abc123-def456-ghi789/minutes.md
  → 概要プレビュー: 本日はプロジェクトのキックオフミーティングを実施しました...
  ✓ 更新完了: abc123-def456-ghi789

[2] 処理中: xyz789-uvw456-rst123
  → スキップ: summaryPreview が既に存在します

============================================================
マイグレーション完了
============================================================
処理したジョブ数: 10
更新したジョブ数: 8
スキップしたジョブ数: 2
エラー数: 0
============================================================

✓ マイグレーションが正常に完了しました
```

## エラーハンドリング

- S3 からの取得に失敗した場合、そのジョブはスキップされ、エラーがログに記録されます
- DynamoDB の更新に失敗した場合、そのジョブはスキップされ、エラーがログに記録されます
- 処理は継続され、最後にエラー数が表示されます

## 注意事項

- このスクリプトは DynamoDB の全テーブルをスキャンするため、大量のジョブがある場合は時間がかかる可能性があります
- DRY RUN モードで事前に確認することを推奨します
- AWS の読み取り/書き込みキャパシティに注意してください
- S3 からの読み取りには料金が発生します

## トラブルシューティング

### 環境変数が設定されていないエラー

```
エラー: JOBS_TABLE_NAME 環境変数が設定されていません
```

→ `.env` ファイルに必要な環境変数が設定されているか確認してください。

### AWS 認証エラー

```
Error: Missing credentials in config
```

→ AWS CLI で認証情報を設定するか、環境変数（`AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`）を設定してください。

### S3 アクセスエラー

```
S3 からの取得に失敗: AccessDenied
```

→ 使用している AWS 認証情報に S3 バケットへの読み取り権限があるか確認してください。

### DynamoDB アクセスエラー

```
更新失敗: AccessDeniedException
```

→ 使用している AWS 認証情報に DynamoDB テーブルへの読み取り/書き込み権限があるか確認してください。
