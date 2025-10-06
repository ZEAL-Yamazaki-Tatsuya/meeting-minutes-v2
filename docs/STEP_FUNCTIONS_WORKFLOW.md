# Step Functions ワークフロー実装ドキュメント

## 概要

このドキュメントは、会議録画から議事録を生成するStep Functionsワークフローの実装について説明します。

## アーキテクチャ

### ワークフローの構成

```
開始
  ↓
TranscribeVideo (Lambda)
  ↓
WaitForTranscription (30秒待機)
  ↓
CheckTranscriptionStatus (Lambda)
  ↓
IsTranscriptionComplete? (Choice)
  ├─ No → WaitForTranscription (ループ)
  ├─ Yes → GenerateMinutes (将来実装)
  └─ Failed → TranscriptionFailed (Fail)
```

## ステート定義

### 1. TranscribeVideo

**タイプ**: Task (Lambda Invoke)

**説明**: AWS Transcribeジョブを開始し、話者識別を有効化します。

**入力**:
```json
{
  "jobId": "string",
  "userId": "string",
  "videoS3Key": "string",
  "languageCode": "ja-JP (optional)",
  "maxSpeakerLabels": 10
}
```

**出力**:
```json
{
  "jobId": "string",
  "userId": "string",
  "transcribeJobName": "string",
  "status": "IN_PROGRESS"
}
```

**エラーハンドリング**:
- すべてのエラーをキャッチして`TranscriptionFailed`ステートに遷移
- エラー情報は`$.error`に格納

### 2. WaitForTranscription

**タイプ**: Wait

**説明**: Transcribeジョブの完了を待つため、30秒間待機します。

**待機時間**: 30秒

### 3. CheckTranscriptionStatus

**タイプ**: Task (Lambda Invoke)

**説明**: Transcribeジョブのステータスをポーリングし、DynamoDBを更新します。

**入力**:
```json
{
  "jobId": "string",
  "userId": "string",
  "transcribeJobName": "string"
}
```

**出力**:
```json
{
  "jobId": "string",
  "userId": "string",
  "transcribeJobName": "string",
  "status": "COMPLETED | FAILED | IN_PROGRESS",
  "isComplete": true | false,
  "transcriptS3Key": "string (if completed)",
  "errorMessage": "string (if failed)"
}
```

**エラーハンドリング**:
- すべてのエラーをキャッチして`TranscriptionFailed`ステートに遷移

### 4. IsTranscriptionComplete

**タイプ**: Choice

**説明**: Transcribeジョブが完了したかどうかを判定します。

**条件分岐**:
1. `$.status == "FAILED"` → `TranscriptionFailed`
2. `$.isComplete == true` → `GenerateMinutes`
3. それ以外 → `WaitForTranscription` (ループ)

### 5. GenerateMinutes

**タイプ**: Pass (将来はTask)

**説明**: 議事録生成処理（タスク6で実装予定）

**現在の実装**: プレースホルダーとして`Pass`ステートを使用

### 6. TranscriptionFailed

**タイプ**: Fail

**説明**: Transcribeジョブが失敗した場合の終了ステート

**エラー**: `TranscriptionJobFailed`

**原因**: `AWS Transcribeジョブが失敗しました`

### 7. Success

**タイプ**: Succeed

**説明**: ワークフローが正常に完了した場合の終了ステート

## IAM権限

### Step Functions Role

Step Functionsワークフローには以下の権限が付与されています：

1. **Lambda実行権限**:
   - `lambda:InvokeFunction` - Lambda関数を呼び出す

2. **CloudWatch Logs権限**:
   - `logs:CreateLogDelivery`
   - `logs:CreateLogGroup`
   - `logs:CreateLogStream`
   - `logs:PutLogEvents`
   - `logs:DeleteLogDelivery`
   - `logs:DescribeLogGroups`
   - `logs:DescribeResourcePolicies`
   - `logs:GetLogDelivery`
   - `logs:ListLogDeliveries`
   - `logs:PutResourcePolicy`
   - `logs:UpdateLogDelivery`

3. **X-Ray権限**:
   - `xray:GetSamplingRules`
   - `xray:GetSamplingTargets`
   - `xray:PutTelemetryRecords`
   - `xray:PutTraceSegments`

### Lambda Execution Role

Upload Handler Lambdaには以下の権限が追加されています：

- `states:StartExecution` - Step Functionsワークフローを開始する

## ログとモニタリング

### CloudWatch Logs

- **ロググループ**: `/aws/vendedlogs/states/meeting-minutes-generator-workflow-{environment}`
- **ログレベル**: `ALL`
- **実行データの記録**: 有効
- **保持期間**: 7日間

### X-Ray トレーシング

- **有効化**: はい
- **用途**: ワークフローの各ステップのパフォーマンスとエラーを追跡

## タイムアウト設定

- **ワークフロー全体**: 2時間
- **TranscribeVideo Lambda**: 60秒
- **CheckTranscribeStatus Lambda**: 30秒
- **待機時間**: 30秒（ポーリング間隔）

## エラーハンドリング戦略

### リトライポリシー

Lambda Invokeタスクには以下のリトライポリシーが適用されています：

- **retryOnServiceExceptions**: `true`
  - AWSサービスの一時的なエラーに対して自動的にリトライ

### エラーキャッチ

各Lambda Invokeタスクには以下のCatchブロックが設定されています：

- **エラータイプ**: `States.ALL`
- **結果パス**: `$.error`
- **次のステート**: `TranscriptionFailed`

## デプロイ情報

### CDK スタック

- **スタック名**: `meeting-minutes-generator-compute-{environment}`
- **リソース名**: `MeetingMinutesWorkflow`
- **物理名**: `meeting-minutes-generator-workflow-{environment}`

### 環境変数

Upload Handler Lambdaに以下の環境変数が設定されています：

- `STATE_MACHINE_ARN`: Step FunctionsワークフローのARN

### 出力

デプロイ後、以下の出力が利用可能です：

- `StateMachineArn`: Step FunctionsワークフローのARN

## 使用方法

### ワークフローの開始

Upload Handler Lambdaから以下のようにワークフローを開始します：

```typescript
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

const sfnClient = new SFNClient({ region: 'ap-northeast-1' });

const command = new StartExecutionCommand({
  stateMachineArn: process.env.STATE_MACHINE_ARN,
  input: JSON.stringify({
    jobId: 'job-123',
    userId: 'user-456',
    videoS3Key: 'user-456/job-123/video.mp4',
    languageCode: 'ja-JP',
    maxSpeakerLabels: 10,
  }),
});

const response = await sfnClient.send(command);
console.log('Execution ARN:', response.executionArn);
```

### ワークフローの監視

AWS Management Consoleから以下の手順で監視できます：

1. Step Functions コンソールを開く
2. `meeting-minutes-generator-workflow-dev` を選択
3. 実行履歴を確認
4. 各ステップの入出力とログを確認

## 今後の実装予定

### タスク6: 議事録生成機能

現在、`GenerateMinutes`ステートはプレースホルダーです。タスク6で以下を実装予定：

1. 文字起こし結果の解析処理
2. Amazon Bedrock統合
3. 議事録保存Lambda関数

実装後、`Pass`ステートを`Task`ステートに置き換えます。

## トラブルシューティング

### ワークフローが開始されない

1. Upload Handler LambdaのIAM権限を確認
2. `STATE_MACHINE_ARN`環境変数が正しく設定されているか確認
3. CloudWatch Logsでエラーメッセージを確認

### Transcribeジョブが失敗する

1. S3バケットへのアクセス権限を確認
2. ビデオファイルの形式とサイズを確認
3. Transcribe Roleの権限を確認

### ワークフローがタイムアウトする

1. ビデオファイルのサイズと長さを確認
2. ワークフローのタイムアウト設定を調整
3. Transcribeジョブのステータスを手動で確認

## 参考資料

- [AWS Step Functions ドキュメント](https://docs.aws.amazon.com/step-functions/)
- [AWS Transcribe ドキュメント](https://docs.aws.amazon.com/transcribe/)
- [AWS CDK Step Functions モジュール](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_stepfunctions-readme.html)
