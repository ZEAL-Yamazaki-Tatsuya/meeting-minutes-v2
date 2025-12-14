# Design Document

## Overview

議事録一覧・検索機能は、ユーザーが自分の全議事録を一覧表示し、AI を活用した自然言語検索で横断的に情報を見つけることができる機能です。現在のシステムはジョブ単位での一覧のみをサポートしていますが、本機能により議事録ベースでの閲覧と、「hoge テーブルは移行対象外」のような具体的な内容がどの議事録に記載されているかを簡単に特定できるようになります。

## Architecture

### システム構成

```
Frontend (Next.js)
  └─ Minutes List Page
       ├─ Minutes List Component
       ├─ Filter Component
       └─ AI Search Modal
            ↓ (REST API)
API Gateway
       ↓
Lambda Functions
  ├─ List Minutes Handler
  └─ Search Minutes Handler
       ↓
DynamoDB (MeetingJobs Table)
       ↓
S3 (Output Bucket - Minutes Files)
       ↓
Amazon Bedrock (Claude)
```

### データフロー

**議事録一覧取得フロー:**
```
ユーザー → フロントエンド → API Gateway → List Minutes Lambda
                                                    ↓
                                              DynamoDB Query
                                                    ↓
                                              議事録メタデータ返却
```

**AI 検索フロー:**
```
ユーザー → フロントエンド → API Gateway → Search Minutes Lambda
                                                    ↓
                                              DynamoDB Query (userId)
                                                    ↓
                                              S3 から議事録取得
                                                    ↓
                                              Bedrock で意味検索
                                                    ↓
                                              関連議事録と抜粋を返却
```

## Components and Interfaces

### Frontend Components

#### MinutesListPage Component
```typescript
interface MinutesListPageProps {
  // ページコンポーネントのため、propsなし
}

interface MinutesListState {
  minutes: MinutesSummary[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  filters: MinutesFilters;
}
```

#### MinutesListItem Component
```typescript
interface MinutesSummary {
  jobId: string;
  meetingName: string;
  createdAt: string;
  summaryPreview: string; // 概要の最初の200文字
}

interface MinutesListItemProps {
  minute: MinutesSummary;
  onClick: (jobId: string) => void;
}
```

#### MinutesFilter Component
```typescript
interface MinutesFilters {
  startDate?: string;
  endDate?: string;
  meetingName?: string;
}

interface MinutesFilterProps {
  filters: MinutesFilters;
  onFilterChange: (filters: MinutesFilters) => void;
  onClear: () => void;
}
```

#### AISearchModal Component
```typescript
interface AISearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

interface SearchMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  results?: SearchResult[];
  timestamp: string;
}

interface SearchResult {
  jobId: string;
  meetingName: string;
  createdAt: string;
  excerpt: string; // 該当箇所の抜粋
  relevanceScore: number;
}
```

### Backend API

#### GET /api/minutes

**Query Parameters:**
```typescript
{
  userId: string;
  page?: number; // デフォルト: 1
  limit?: number; // デフォルト: 20
  startDate?: string; // ISO 8601形式
  endDate?: string; // ISO 8601形式
  meetingName?: string; // 部分一致検索
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "minutes": [
      {
        "jobId": "uuid",
        "meetingName": "プロジェクトキックオフ",
        "createdAt": "2025-12-14T10:00:00Z",
        "summaryPreview": "本日はプロジェクトのキックオフミーティングを実施しました..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

#### POST /api/minutes/search

**Request:**
```json
{
  "userId": "user-123",
  "query": "hogeテーブルは移行対象外と言っていたけど、それってどの議事録に記載されている？",
  "history": [
    {
      "role": "user",
      "content": "前の質問"
    },
    {
      "role": "assistant",
      "content": "前の回答"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "「hogeテーブルは移行対象外」という内容は以下の議事録に記載されています：",
    "results": [
      {
        "jobId": "uuid-1",
        "meetingName": "データベース移行計画会議",
        "createdAt": "2025-12-10T14:00:00Z",
        "excerpt": "...hogeテーブルについては、現行システムでのみ使用されているため、移行対象外とすることが決定されました...",
        "relevanceScore": 0.95
      }
    ],
    "timestamp": "2025-12-14T12:00:00Z"
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. 
Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 議事録リストのソート順

*For any* 議事録リスト、取得された議事録は作成日時の降順でソートされている
**Validates: Requirements 1.2, 2.5**

### Property 2: 議事録表示内容の完全性

*For any* 議事録、表示される情報には会議名、作成日時、概要の冒頭が含まれている
**Validates: Requirements 1.3**

### Property 3: ページネーションの正確性

*For any* 議事録リスト、ページネーションは1ページあたり20件を返し、総ページ数が正しく計算されている
**Validates: Requirements 1.5**

### Property 4: フィルター適用の正確性

*For any* フィルター条件（日付範囲、会議名）、フィルター適用後の議事録リストは全ての条件に合致する議事録のみを含む
**Validates: Requirements 2.3**

### Property 5: ユーザー分離の保証

*For any* ユーザー、取得される議事録リストおよび検索結果は該当ユーザーの userId に紐づく議事録のみを含む
**Validates: Requirements 3.4, 11.3, 11.4**

### Property 6: 検索結果の形式

*For any* 検索結果、各議事録には jobId、会議名、作成日時、該当箇所の抜粋、コンテキストが含まれている
**Validates: Requirements 4.1, 4.2, 4.5, 5.5**

### Property 7: 検索結果の件数制限

*For any* 検索結果、返される議事録は最大5件に制限されている
**Validates: Requirements 4.3**

### Property 8: 検索対象の範囲

*For any* 検索クエリ、検索は文字起こし全文、決定事項、ネクストアクションの全てを対象とする
**Validates: Requirements 5.2**

### Property 9: 会話履歴の保持

*For any* 検索セッション、会話履歴は最大5件まで保持され、5件を超えた場合は古い会話から削除される
**Validates: Requirements 6.1, 6.3, 6.4**

### Property 10: エラー時の状態保持

*For any* エラー発生時、会話履歴は保持され、ユーザーは以前の会話を失わない
**Validates: Requirements 7.4**

### Property 11: スクロール位置の自動調整

*For any* 新しいメッセージ追加時、チャットインターフェースのスクロール位置は最新メッセージに自動調整される
**Validates: Requirements 8.5**

### Property 12: 検索対象議事録数の制限

*For any* 検索リクエスト、処理される議事録は最大100件に制限されている
**Validates: Requirements 9.1**

### Property 13: API ログの記録

*For any* API 呼び出し、リクエストとレスポンスの情報がログに記録される
**Validates: Requirements 9.3**

### Property 14: キャッシュによる高速化

*For any* 議事録データ、同じデータへの2回目以降のアクセスはキャッシュから取得され、初回より高速である
**Validates: Requirements 10.3**

## Data Models

### MinutesSummary Model
```typescript
interface MinutesSummary {
  jobId: string;
  userId: string;
  meetingName: string;
  createdAt: string;
  summaryPreview: string;
  status: string;
}
```

### SearchQuery Model
```typescript
interface SearchQuery {
  userId: string;
  query: string;
  history: ChatHistory[];
}

interface ChatHistory {
  role: 'user' | 'assistant';
  content: string;
}
```

### SearchResult Model
```typescript
interface SearchResult {
  jobId: string;
  meetingName: string;
  createdAt: string;
  excerpt: string;
  relevanceScore: number;
  matchedSection: 'summary' | 'decisions' | 'nextActions' | 'transcript';
}
```

## Implementation Details

### バックエンド実装

#### 1. List Minutes Lambda

**処理フロー:**
1. リクエストパラメータを検証（userId, page, limit, filters）
2. DynamoDB の GSI `userId-createdAt-index` を使用してクエリ
3. フィルター条件を適用（日付範囲、会議名）
4. ページネーション処理
5. 各ジョブの概要の最初の200文字を抽出
6. レスポンスを返却

**DynamoDB クエリ:**
```typescript
const params = {
  TableName: process.env.JOBS_TABLE_NAME,
  IndexName: 'userId-createdAt-index',
  KeyConditionExpression: 'userId = :userId',
  ExpressionAttributeValues: {
    ':userId': userId,
  },
  ScanIndexForward: false, // 降順（新しい順）
  Limit: limit,
};

// フィルター条件を追加
if (startDate || endDate || meetingName) {
  params.FilterExpression = [];
  if (startDate) {
    params.FilterExpression.push('createdAt >= :startDate');
    params.ExpressionAttributeValues[':startDate'] = startDate;
  }
  if (endDate) {
    params.FilterExpression.push('createdAt <= :endDate');
    params.ExpressionAttributeValues[':endDate'] = endDate;
  }
  if (meetingName) {
    params.FilterExpression.push('contains(videoFileName, :meetingName)');
    params.ExpressionAttributeValues[':meetingName'] = meetingName;
  }
  params.FilterExpression = params.FilterExpression.join(' AND ');
}
```

**パフォーマンス最適化:**
- DynamoDB の既存 GSI `userId-createdAt-index` を活用
- 概要は S3 から取得せず、DynamoDB に保存された概要プレビューを使用（新規フィールド追加が必要）
- ページネーションで一度に取得する件数を制限

#### 2. Search Minutes Lambda

**処理フロー:**
1. リクエストボディを検証（userId, query, history）
2. DynamoDB から該当ユーザーの全議事録メタデータを取得（最大100件）
3. 各議事録の S3 キーを取得
4. S3 から議事録内容を並列取得（Promise.all）
5. Bedrock に検索クエリと全議事録を送信
6. Bedrock が関連する議事録を特定し、該当箇所を抽出
7. 関連度スコアでソート
8. 上位5件を返却

**Bedrock プロンプト構築:**
```typescript
const systemPrompt = `あなたは議事録検索アシスタントです。
ユーザーの質問に基づいて、関連する議事録を特定し、該当箇所を抽出してください。

【検索対象の議事録一覧】
${minutes.map((m, i) => `
議事録 ${i + 1}:
- 会議名: ${m.meetingName}
- 作成日時: ${m.createdAt}
- 概要: ${m.summary}
- 決定事項: ${m.decisions.map(d => d.description).join(', ')}
- ネクストアクション: ${m.nextActions.map(a => a.description).join(', ')}
- 文字起こし（抜粋）: ${m.transcript.substring(0, 2000)}
`).join('\n')}

【指示】
1. ユーザーの質問に最も関連する議事録を特定してください
2. 該当箇所を引用し、前後のコンテキストを含めて抜粋してください
3. 関連度の高い順に最大5件を返してください
4. 該当する議事録がない場合は、その旨を伝えてください

【回答形式】
以下のJSON形式で回答してください：
{
  "message": "検索結果の説明",
  "results": [
    {
      "index": 議事録のインデックス番号,
      "excerpt": "該当箇所の抜粋（前後のコンテキストを含む）",
      "relevanceScore": 0.0〜1.0の関連度スコア,
      "matchedSection": "summary" | "decisions" | "nextActions" | "transcript"
    }
  ]
}
`;

const response = await bedrockClient.invokeModel({
  modelId: 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0',
  messages: [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: query }
  ]
});
```

**トークン制限対策:**
- 議事録が100件を超える場合は、最新100件のみを対象
- 文字起こし全文は最初の2,000文字のみ使用
- 合計トークン数が10,000を超える場合は、古い議事録から削除

**レート制限:**
- DynamoDB に検索回数を記録するテーブルを追加（オプション）
- または、API Gateway のレート制限を使用（1ユーザーあたり30回/日）

### フロントエンド実装

#### 1. 議事録一覧ページ

**ファイル:** `frontend/app/minutes/page.tsx`

**機能:**
- 議事録一覧の表示
- ページネーション
- フィルター機能（日付範囲、会議名）
- AI 検索ボタン

**状態管理:**
```typescript
const [minutes, setMinutes] = useState<MinutesSummary[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [page, setPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const [filters, setFilters] = useState<MinutesFilters>({});
const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
```

**API 呼び出し:**
```typescript
const fetchMinutes = async () => {
  setLoading(true);
  try {
    const queryParams = new URLSearchParams({
      userId: user.id,
      page: page.toString(),
      limit: '20',
      ...filters,
    });
    
    const response = await fetch(`${API_URL}/api/minutes?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await response.json();
    setMinutes(data.data.minutes);
    setTotalPages(data.data.pagination.totalPages);
  } catch (err) {
    setError('議事録の取得に失敗しました');
  } finally {
    setLoading(false);
  }
};
```

#### 2. AI 検索モーダル

**ファイル:** `frontend/components/ai-search-modal.tsx`

**機能:**
- チャット形式の検索インターフェース
- 検索結果の表示（議事録リスト + 抜粋）
- 会話履歴の保持（最大5件）
- 検索結果から議事録詳細への遷移

**状態管理:**
```typescript
const [messages, setMessages] = useState<SearchMessage[]>([]);
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**検索API 呼び出し:**
```typescript
const handleSearch = async () => {
  setLoading(true);
  try {
    const history = messages.slice(-4).map(m => ({
      role: m.role,
      content: m.content,
    }));
    
    const response = await fetch(`${API_URL}/api/minutes/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: user.id,
        query: input,
        history,
      }),
    });
    
    const data = await response.json();
    
    // ユーザーメッセージを追加
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    }]);
    
    // AI レスポンスを追加
    setMessages(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: data.data.message,
      results: data.data.results,
      timestamp: data.data.timestamp,
    }]);
    
    setInput('');
  } catch (err) {
    setError('検索に失敗しました');
  } finally {
    setLoading(false);
  }
};
```

## Error Handling

### エラーケース

1. **認証エラー**
   - ユーザーが認証されていない場合、401エラー
   - 「ログインが必要です」

2. **権限エラー**
   - 他のユーザーの議事録にアクセスしようとした場合、403エラー
   - 「アクセス権限がありません」

3. **議事録が見つからない**
   - 指定された jobId の議事録が存在しない場合、404エラー
   - 「議事録が見つかりません」

4. **Bedrock エラー**
   - Bedrock 呼び出しが失敗した場合、500エラー
   - 「検索に失敗しました。もう一度お試しください」

5. **タイムアウト**
   - 検索が60秒を超えた場合、タイムアウト
   - 「検索に時間がかかっています。もう一度お試しください」

6. **レート制限超過**
   - 1日の検索回数が30回を超えた場合、429エラー
   - 「1日の検索回数の上限に達しました。明日再度お試しください」

## Testing Strategy

### ユニットテスト

1. **バックエンド**
   - List Minutes Lambda のページネーション処理
   - フィルター条件の適用
   - Search Minutes Lambda のプロンプト構築
   - Bedrock レスポンスのパース

2. **フロントエンド**
   - MinutesListPage のレンダリング
   - フィルター機能
   - AI 検索モーダルのメッセージ送信
   - 検索結果の表示

### 統合テスト

1. **API テスト**
   - GET /api/minutes のページネーション
   - GET /api/minutes のフィルター機能
   - POST /api/minutes/search の検索機能
   - 認証・認可の確認

2. **E2E テスト**
   - 議事録一覧の表示
   - フィルターの適用
   - AI 検索の実行
   - 検索結果から議事録詳細への遷移

## Performance Considerations

1. **議事録一覧のパフォーマンス**
   - DynamoDB GSI を使用した高速クエリ
   - ページネーションで一度に取得する件数を制限
   - 概要プレビューを DynamoDB に保存（S3 アクセスを削減）

2. **AI 検索のパフォーマンス**
   - 検索対象の議事録数を最大100件に制限
   - S3 からの並列取得（Promise.all）
   - 文字起こし全文の切り詰め（2,000文字）
   - Bedrock のレスポンスキャッシュ（オプション）

3. **コスト最適化**
   - Bedrock トークン使用量の制限（10,000トークン/リクエスト）
   - S3 アクセスの最小化
   - DynamoDB のオンデマンドスケーリング

## Security Considerations

1. **認証・認可**
   - Cognito 認証を使用
   - ユーザーは自分の議事録のみアクセス可能
   - API Gateway で JWT トークンを検証

2. **データ保護**
   - S3 バケットはプライベート
   - DynamoDB のデータは AWS 管理暗号化
   - API 通信は TLS 1.2 以上

3. **入力検証**
   - 検索クエリの長さを制限（最大1,000文字）
   - XSS 対策
   - SQL インジェクション対策（DynamoDB は影響なし）

## Deployment Strategy

1. **段階的デプロイ**
   - Phase 1: バックエンド API 実装（List Minutes Lambda）
   - Phase 2: フロントエンド議事録一覧ページ実装
   - Phase 3: バックエンド検索 API 実装（Search Minutes Lambda）
   - Phase 4: フロントエンド AI 検索モーダル実装
   - Phase 5: 統合テスト
   - Phase 6: 本番デプロイ

2. **ロールバック計画**
   - 機能フラグを使用
   - 問題発生時は即座に無効化

## Monitoring and Logging

1. **メトリクス**
   - API 呼び出し回数（一覧取得、検索）
   - レスポンス時間
   - エラー率
   - Bedrock トークン使用量
   - 検索クエリの種類と頻度

2. **ログ**
   - ユーザーの検索クエリ（個人情報を除く）
   - AI 検索結果
   - エラーログ
   - パフォーマンスログ

3. **アラート**
   - エラー率が5%を超えた場合
   - レスポンス時間が10秒を超えた場合
   - Bedrock のレート制限に達した場合

## Database Schema Changes

### DynamoDB テーブル変更

**MeetingJobs テーブルに新規フィールドを追加:**
```typescript
{
  // 既存フィールド
  jobId: string;
  userId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  videoFileName: string;
  videoS3Key: string;
  transcriptS3Key?: string;
  minutesS3Key?: string;
  errorMessage?: string;
  metadata?: object;
  
  // 新規フィールド
  summaryPreview?: string; // 概要の最初の200文字
}
```

**マイグレーション戦略:**
- 既存の議事録については、次回の議事録生成時に summaryPreview を追加
- または、バッチ処理で既存の議事録から summaryPreview を抽出

## API Gateway Changes

### 新規エンドポイント

1. **GET /api/minutes**
   - 議事録一覧取得
   - Cognito 認証必須
   - CORS 有効化

2. **POST /api/minutes/search**
   - AI 検索
   - Cognito 認証必須
   - CORS 有効化
   - タイムアウト: 60秒

## Infrastructure Changes

### CDK スタック変更

**ComputeStack に追加:**
```typescript
// List Minutes Lambda
this.listMinutesHandler = new nodejs.NodejsFunction(this, 'ListMinutesHandler', {
  functionName: `${appName}-list-minutes-${environment}`,
  runtime: lambda.Runtime.NODEJS_18_X,
  entry: path.join(__dirname, '../src/lambdas/list-minutes/index.ts'),
  handler: 'handler',
  role: this.lambdaExecutionRole,
  environment: lambdaEnvironment,
  timeout: cdk.Duration.seconds(10),
  memorySize: 256,
  logRetention: logs.RetentionDays.ONE_WEEK,
  description: 'ユーザーの議事録一覧を取得する',
  tracing: lambda.Tracing.ACTIVE,
});

// Search Minutes Lambda
this.searchMinutesHandler = new nodejs.NodejsFunction(this, 'SearchMinutesHandler', {
  functionName: `${appName}-search-minutes-${environment}`,
  runtime: lambda.Runtime.NODEJS_18_X,
  entry: path.join(__dirname, '../src/lambdas/search-minutes/index.ts'),
  handler: 'handler',
  role: this.lambdaExecutionRole,
  environment: lambdaEnvironment,
  timeout: cdk.Duration.seconds(60),
  memorySize: 1024,
  logRetention: logs.RetentionDays.ONE_WEEK,
  description: 'AI を使用して議事録を検索する',
  tracing: lambda.Tracing.ACTIVE,
});

// API Gateway エンドポイント
const minutesResource = apiResource.addResource('minutes');
minutesResource.addMethod('GET', new apigateway.LambdaIntegration(this.listMinutesHandler));

const searchResource = minutesResource.addResource('search');
searchResource.addMethod('POST', new apigateway.LambdaIntegration(this.searchMinutesHandler));
```
