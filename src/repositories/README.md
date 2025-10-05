# Meeting Job Repository

データアクセスレイヤーの実装。DynamoDBとのやり取りを抽象化し、MeetingJobエンティティのCRUD操作を提供します。

## 使用方法

### 初期化

```typescript
import { MeetingJobRepository } from './repositories/meeting-job-repository';

const repository = new MeetingJobRepository(
  process.env.JOBS_TABLE_NAME!,
  process.env.AWS_REGION
);
```

### ジョブの作成

```typescript
const job = await repository.createJob({
  userId: 'user-123',
  videoFileName: 'meeting.mp4',
  videoS3Key: 'videos/user-123/meeting.mp4',
  videoSize: 1024000,
  metadata: {
    meetingTitle: 'Team Standup',
    meetingDate: '2025-10-06',
  },
});

console.log(`Created job: ${job.jobId}`);
```

### ジョブの取得

```typescript
const job = await repository.getJob('job-123', 'user-123');

if (job) {
  console.log(`Job status: ${job.status}`);
} else {
  console.log('Job not found');
}
```

### ジョブステータスの更新

```typescript
// シンプルなステータス更新
await repository.updateJobStatus(
  'job-123',
  'user-123',
  'TRANSCRIBING'
);

// エラーメッセージ付きの更新
await repository.updateJobStatus(
  'job-123',
  'user-123',
  'FAILED',
  'Transcription service unavailable'
);
```

### ジョブの詳細更新

```typescript
const updatedJob = await repository.updateJob({
  jobId: 'job-123',
  userId: 'user-123',
  status: 'COMPLETED',
  transcriptS3Key: 'transcripts/job-123/transcript.json',
  minutesS3Key: 'minutes/job-123/minutes.md',
});
```

### ユーザーのジョブ一覧取得

```typescript
// 最新50件を取得
const result = await repository.listJobsByUser({
  userId: 'user-123',
  limit: 50,
});

console.log(`Found ${result.jobs.length} jobs`);

// ページネーション
if (result.lastEvaluatedKey) {
  const nextPage = await repository.listJobsByUser({
    userId: 'user-123',
    limit: 50,
    lastEvaluatedKey: result.lastEvaluatedKey,
  });
}
```

### ジョブの削除

```typescript
await repository.deleteJob('job-123', 'user-123');
```

## エラーハンドリング

リポジトリは以下のカスタムエラーをスローします：

- `InternalServerError`: DynamoDB操作が失敗した場合
- `NotFoundError`: リソースが見つからない場合（将来の実装）

```typescript
try {
  const job = await repository.getJob('job-123', 'user-123');
} catch (error) {
  if (error instanceof InternalServerError) {
    console.error('Database error:', error.message);
  }
}
```

## ログ

リポジトリは構造化ログを出力します：

```json
{
  "timestamp": "2025-10-06T10:00:00.000Z",
  "level": "INFO",
  "message": "Created job",
  "component": "MeetingJobRepository",
  "jobId": "job-123",
  "userId": "user-123"
}
```

## テスト

```bash
npm test -- src/repositories/__tests__/meeting-job-repository.test.ts
```

## DynamoDBスキーマ

### テーブル: MeetingJobs

- **Partition Key**: `jobId` (String)
- **Sort Key**: `userId` (String)
- **GSI**: `userId-createdAt-index`
  - Partition Key: `userId` (String)
  - Sort Key: `createdAt` (String)

### 属性

| 属性名 | 型 | 説明 |
|--------|-----|------|
| jobId | String | ジョブID (UUID) |
| userId | String | ユーザーID |
| status | String | ジョブステータス |
| createdAt | String | 作成日時 (ISO 8601) |
| updatedAt | String | 更新日時 (ISO 8601) |
| videoFileName | String | 動画ファイル名 |
| videoS3Key | String | S3オブジェクトキー |
| videoSize | Number | ファイルサイズ (bytes) |
| videoDuration | Number | 動画の長さ (秒) |
| transcribeJobName | String | Transcribeジョブ名 |
| transcriptS3Key | String | 文字起こし結果のS3キー |
| minutesS3Key | String | 議事録のS3キー |
| errorMessage | String | エラーメッセージ |
| metadata | Map | メタデータ |
| ttl | Number | TTL (Unix timestamp) |

## ジョブステータス

- `UPLOADED`: アップロード完了
- `TRANSCRIBING`: 文字起こし中
- `GENERATING`: 議事録生成中
- `COMPLETED`: 完了
- `FAILED`: 失敗
