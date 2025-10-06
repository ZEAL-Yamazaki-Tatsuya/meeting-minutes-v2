# アーキテクチャドキュメント

## 概要

Meeting Minutes Generatorは、AWS上に構築されたサーバーレスアプリケーションで、MP4形式の会議録画を自動的にAIを使用して構造化された議事録に変換します。

## システムアーキテクチャ

### 高レベルコンポーネント

```
┌─────────────┐
│  ユーザー   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│           フロントエンド (Next.js)                      │
│  - ファイルアップロードUI                               │
│  - ジョブステータス追跡                                 │
│  - 議事録表示・編集                                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│      API Gateway + Lambda関数                           │
│  - Upload Handler                                       │
│  - Status Checker                                       │
│  - Download Handler                                     │
└──────────────────────┬──────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│    S3    │    │ DynamoDB │    │   Step   │
│ Buckets  │    │  Table   │    │Functions │
└──────────┘    └──────────┘    └────┬─────┘
                                      │
                       ┌──────────────┼──────────────┐
                       ▼              ▼              ▼
                ┌──────────┐   ┌──────────┐   ┌──────────┐
                │   AWS    │   │  Amazon  │   │ Lambda   │
                │Transcribe│   │ Bedrock  │   │Functions │
                └──────────┘   └──────────┘   └──────────┘
```

## インフラストラクチャコンポーネント

### ストレージレイヤー

#### S3バケット

**入力バケット**
- 目的: アップロードされたMP4動画ファイルを保存
- 暗号化: S3管理（SSE-S3）
- ライフサイクル: 30日後に削除
- CORS: ブラウザからの直接アップロードのため有効化
- アクセス: Presigned URLによるプライベートアクセス

**出力バケット**
- 目的: 文字起こし結果と生成された議事録を保存
- 暗号化: S3管理（SSE-S3）
- バージョニング: 有効
- ライフサイクル: 90日後にIAに移行
- アクセス: ダウンロード用Presigned URLによるプライベートアクセス

#### DynamoDBテーブル

**MeetingJobsテーブル**
- パーティションキー: `jobId` (String)
- ソートキー: `userId` (String)
- 課金: オンデマンド（リクエストごとの支払い）
- 暗号化: AWS管理
- GSI: `userId-createdAt-index` ユーザージョブクエリ用

**スキーマ**:
```typescript
{
  jobId: string;           // UUID
  userId: string;          // ユーザー識別子
  status: string;          // ジョブステータス
  createdAt: string;       // ISOタイムスタンプ
  updatedAt: string;       // ISOタイムスタンプ
  videoFileName: string;
  videoS3Key: string;
  transcriptS3Key?: string;
  minutesS3Key?: string;
  errorMessage?: string;
  metadata?: object;
}
```

### コンピュートレイヤー

#### IAMロール

**Lambda実行ロール**
- 権限:
  - CloudWatch Logs（書き込み）
  - S3（両バケットへの読み書き）
  - DynamoDB（ジョブテーブルへの読み書き）
  - Transcribe（ジョブの開始・取得）
  - Bedrock（モデルの呼び出し）

**Transcribeロール**
- 権限:
  - S3（入力バケットからの読み取り）
  - S3（出力バケットへの書き込み）

**Step Functionsロール**
- 権限:
  - Lambda（関数の呼び出し）
  - CloudWatch Logs（書き込み）

### 処理パイプライン

#### ステップ1: ファイルアップロード
1. ユーザーがフロントエンドでMP4ファイルを選択
2. フロントエンドがAPIにPresigned URLをリクエスト
3. LambdaがS3用のPresigned URLを生成
4. フロントエンドがS3に直接アップロード
5. LambdaがDynamoDBにジョブレコードを作成
6. LambdaがStep Functionsワークフローをトリガー

#### ステップ2: 文字起こし
1. Step FunctionsがTranscribe Lambdaを呼び出し
2. LambdaがAWS Transcribeジョブを開始
3. Transcribeが話者識別付きで音声を処理
4. Step Functionsが完了をポーリング
5. TranscribeがJSON出力をS3に書き込み

#### ステップ3: 議事録生成
1. Step FunctionsがMinutes Generator Lambdaを呼び出し
2. LambdaがS3から文字起こし結果を取得
3. LambdaがAmazon Bedrock（Claude/GPT）を呼び出し
4. LLMが構造化された議事録を生成
5. Lambdaが議事録をS3に保存
6. LambdaがDynamoDBのジョブステータスを更新

#### ステップ4: 取得
1. ユーザーがフロントエンド経由で議事録をリクエスト
2. API GatewayがDownload Lambdaにルーティング
3. LambdaがS3から議事録を取得
4. LambdaがPresigned URLを生成
5. ユーザーが議事録をダウンロードまたは表示

## データフロー

### アップロードフロー
```
ユーザー → フロントエンド → API Gateway → Upload Lambda → S3
                                      ↓
                                  DynamoDB
                                      ↓
                              Step Functions
```

### 処理フロー
```
Step Functions → Transcribe Lambda → AWS Transcribe → S3
                                                        ↓
Step Functions → Minutes Lambda → Bedrock → S3
                        ↓
                    DynamoDB
```

### ダウンロードフロー
```
ユーザー → フロントエンド → API Gateway → Download Lambda → S3
                                      ↓
                                Presigned URL
                                      ↓
                                   ユーザー
```

## セキュリティアーキテクチャ

### 認証・認可
- Amazon Cognitoによるユーザー認証（オプション）
- API認証用のJWTトークン
- サービス間認証用のIAMロール

### データ保護
- **転送中**: すべての接続でTLS 1.2以上
- **保存時**: S3 SSE-S3暗号化、DynamoDB AWS管理暗号化
- **アクセス制御**: IAMポリシー、S3バケットポリシー

### ネットワークセキュリティ
- S3バケット: すべてのパブリックアクセスをブロック
- API Gateway: フロントエンドドメイン用にCORS設定
- Lambda: VPCはオプション（このアーキテクチャでは不要）

## スケーラビリティ

### 水平スケーリング
- Lambda: アカウント制限まで自動スケーリング
- DynamoDB: オンデマンドスケーリング
- S3: 無制限ストレージ
- API Gateway: 数百万リクエストを処理

### パフォーマンス最適化
- S3 Presigned URL: 直接アップロード/ダウンロード（Lambdaプロキシなし）
- DynamoDB GSI: 高速ユーザークエリ
- Lambda: 最適化されたメモリ割り当て
- CloudFront: フロントエンド用CDN（オプション）

## モニタリングと可観測性

### CloudWatch Logs
- すべてのLambda関数がCloudWatchにログ記録
- Step Functions実行ログ
- API Gatewayアクセスログ

### CloudWatchメトリクス
- Lambda呼び出し、実行時間、エラー
- DynamoDB読み書きキャパシティ
- S3リクエストメトリクス
- カスタムメトリクス: 処理時間、成功率

### X-Ray（オプション）
- サービス間の分散トレーシング
- パフォーマンスボトルネックの特定
- エラー分析

## コスト最適化

### ストレージ
- S3ライフサイクルポリシー: 古いファイルを安価なストレージに移動
- DynamoDBオンデマンド: 実際の使用量のみ支払い
- CloudWatchログ保持: 7〜30日

### コンピュート
- Lambda: 適切なメモリ割り当て
- Step Functions: 効率的なワークフロー設計
- Transcribe: 必要な時のみ処理

### データ転送
- S3 Presigned URL: Lambdaデータ転送を削減
- CloudFront: 静的アセットのキャッシュ（フロントエンド）

## 災害復旧

### バックアップ戦略
- S3: 出力バケットでバージョニング有効
- DynamoDB: ポイントインタイムリカバリ（本番環境）
- CloudFormation: Infrastructure as Code

### 復旧手順
1. CDKコードからインフラストラクチャを再デプロイ
2. DynamoDBをバックアップから復元（必要な場合）
3. S3データは永続化（本番環境ではスタック削除時も保持）

## 将来の拡張

### フェーズ2
- ライブ会議のリアルタイム文字起こし
- 多言語サポート
- カスタム議事録テンプレート
- カレンダーシステムとの統合

### フェーズ3
- 共同編集機能
- アクションアイテム追跡
- プロジェクト管理ツールとの統合
- 高度な分析とインサイト

## 技術スタック

### インフラストラクチャ
- AWS CDK (TypeScript)
- CloudFormation

### バックエンド
- Node.js 18+
- TypeScript
- AWS Lambda
- AWS Step Functions

### ストレージ
- Amazon S3
- Amazon DynamoDB

### AI/ML
- AWS Transcribe
- Amazon Bedrock (Claude 3)

### フロントエンド
- Next.js 14
- React
- TypeScript
- TailwindCSS

### DevOps
- GitHub Actions / AWS CodePipeline
- Jest（テスト）
- ESLint（リント）

## 開発ワークフロー

1. **ローカル開発**
   - インフラストラクチャコードを編集
   - テスト実行: `npm test`
   - ビルド: `npm run build`

2. **変更のプレビュー**
   - 合成: `cdk synth`
   - 差分確認: `cdk diff`

3. **デプロイ**
   - 開発環境へデプロイ: `cdk deploy --all`
   - 開発環境でテスト
   - ステージング/本番環境へデプロイ

4. **モニタリング**
   - CloudWatchログを確認
   - メトリクスをレビュー
   - コストを分析

## コンプライアンスとベストプラクティス

### AWS Well-Architected Framework

**運用の優秀性**
- Infrastructure as Code（CDK）
- 自動デプロイメント
- 包括的なログ記録

**セキュリティ**
- 保存時および転送中の暗号化
- 最小権限のIAMポリシー
- ハードコードされた認証情報なし

**信頼性**
- サーバーレスアーキテクチャ（管理するサーバーなし）
- Step Functionsでの自動リトライ
- すべてのLambda関数でのエラーハンドリング

**パフォーマンス効率**
- 適切なサイズのLambda関数
- DynamoDBオンデマンドスケーリング
- 効率的なストレージのためのS3

**コスト最適化**
- 従量課金モデル
- ストレージのライフサイクルポリシー
- コスト配分のためのリソースタグ付け

**持続可能性**
- サーバーレスでアイドルリソースを削減
- 効率的なデータ処理
- 最適化されたストレージ使用
