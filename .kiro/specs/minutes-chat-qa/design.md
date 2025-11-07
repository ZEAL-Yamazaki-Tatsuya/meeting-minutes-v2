# Design Document

## Overview

議事録結果画面に統合されたチャット機能を実装します。ユーザーは議事録の内容について質問し、Amazon Bedrock（Claude）を使用したAIから回答を得ることができます。

## Architecture

### システム構成

```
Frontend (Next.js)
  └─ Minutes Page with Chat Component
       ↓ (REST API)
API Gateway
       ↓
Lambda Function (Chat Handler)
       ↓
Amazon Bedrock (Claude)
       ↑
DynamoDB (Chat History - Optional)
```

### コンポーネント構成

1. **フロントエンド**
   - `ChatButton`: チャット開始ボタン
   - `ChatModal`: チャットインターフェース（モーダル）
   - `ChatMessage`: 個別メッセージコンポーネント
   - `ChatInput`: 質問入力フォーム

2. **バックエンド**
   - `chat-handler` Lambda: チャットAPI
   - `BedrockClient`: 既存のBedrockクライアントを再利用

## Components and Interfaces

### Frontend Components

#### ChatButton Component
```typescript
interface ChatButtonProps {
  onClick: () => void;
  disabled?: boolean;
}
```

#### ChatModal Component
```typescript
interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  minutesContext: {
    summary: string;
    decisions: Decision[];
    nextActions: NextAction[];
    transcript: string;
  };
}
```

#### ChatMessage Component
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatMessageProps {
  message: Message;
}
```

### Backend API

#### POST /api/jobs/{jobId}/chat

**Request:**
```json
{
  "message": "この会議で決まったことは何ですか？",
  "context": {
    "summary": "...",
    "decisions": [...],
    "nextActions": [...],
    "transcript": "..."
  },
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
    "message": "この会議では以下のことが決まりました...",
    "timestamp": "2025-11-07T12:00:00Z"
  }
}
```

## Data Models

### Message Model
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
```

### ChatContext Model
```typescript
interface ChatContext {
  summary: string;
  decisions: Decision[];
  nextActions: NextAction[];
  transcript: string;
}
```

### ChatHistory Model
```typescript
interface ChatHistory {
  role: 'user' | 'assistant';
  content: string;
}
```

## Implementation Details

### フロントエンド実装

1. **状態管理**
   - `useState`で会話履歴を管理
   - `useEffect`でスクロール位置を自動調整
   - ローカルストレージに会話履歴を保存（オプション）

2. **UI/UX**
   - デスクトップ: 右下に固定されたチャットボタン、モーダルウィンドウ
   - モバイル: 全画面モーダル
   - メッセージのストリーミング表示（オプション）
   - タイピングインジケーター

3. **エラーハンドリング**
   - ネットワークエラー時の再試行
   - タイムアウト処理
   - エラーメッセージの表示

### バックエンド実装

1. **Lambda Function (chat-handler)**
   ```typescript
   // プロンプト構築
   const systemPrompt = `あなたは議事録アシスタントです。
   以下の議事録の内容に基づいて、ユーザーの質問に答えてください。
   
   【議事録の概要】
   ${context.summary}
   
   【決定事項】
   ${formatDecisions(context.decisions)}
   
   【ネクストアクション】
   ${formatNextActions(context.nextActions)}
   
   【文字起こし全文】
   ${context.transcript}
   `;
   
   // Bedrock呼び出し
   const response = await bedrockClient.invokeModel({
     modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
     messages: [
       { role: 'system', content: systemPrompt },
       ...history,
       { role: 'user', content: message }
     ]
   });
   ```

2. **トークン制限**
   - コンテキストの長さを確認
   - 10,000トークンを超える場合は要約または切り詰め
   - 文字起こし全文は最初の5,000文字のみ使用

3. **レート制限**
   - DynamoDBに使用回数を記録（オプション）
   - または、API Gatewayのレート制限を使用

## Error Handling

### エラーケース

1. **ネットワークエラー**
   - 再試行ボタンを表示
   - 最大3回まで自動再試行

2. **Bedrockエラー**
   - エラーメッセージを表示
   - 「申し訳ございません。回答の生成に失敗しました。」

3. **タイムアウト**
   - 30秒でタイムアウト
   - 「回答の生成に時間がかかっています。もう一度お試しください。」

4. **レート制限超過**
   - 「1日の質問回数の上限に達しました。明日再度お試しください。」

## Testing Strategy

### ユニットテスト

1. **フロントエンド**
   - ChatModalコンポーネントのレンダリング
   - メッセージ送信処理
   - エラーハンドリング

2. **バックエンド**
   - プロンプト構築ロジック
   - Bedrock呼び出し
   - エラーハンドリング

### 統合テスト

1. **E2Eテスト**
   - チャットボタンのクリック
   - 質問の送信と回答の受信
   - 会話履歴の保持

### 手動テスト

1. **UI/UXテスト**
   - レスポンシブデザインの確認
   - モバイルでの動作確認
   - エラーメッセージの表示確認

## Performance Considerations

1. **レスポンス時間**
   - Bedrock呼び出し: 平均3-5秒
   - タイムアウト: 30秒

2. **コスト最適化**
   - コンテキストの長さを制限
   - 不要な会話履歴を削除
   - キャッシュの活用（オプション）

3. **スケーラビリティ**
   - Lambda同時実行数の設定
   - API Gatewayのレート制限

## Security Considerations

1. **認証・認可**
   - Cognito認証を使用
   - ユーザーは自分の議事録のみアクセス可能

2. **入力検証**
   - 質問の長さを制限（最大1,000文字）
   - XSS対策

3. **データ保護**
   - 会話履歴は一時的にのみ保存
   - 機密情報のマスキング（オプション）

## Deployment Strategy

1. **段階的デプロイ**
   - Phase 1: バックエンドAPI実装
   - Phase 2: フロントエンドUI実装
   - Phase 3: 統合テスト
   - Phase 4: 本番デプロイ

2. **ロールバック計画**
   - 機能フラグを使用
   - 問題発生時は即座に無効化

## Monitoring and Logging

1. **メトリクス**
   - API呼び出し回数
   - レスポンス時間
   - エラー率
   - Bedrockトークン使用量

2. **ログ**
   - ユーザーの質問（個人情報を除く）
   - AI回答
   - エラーログ

3. **アラート**
   - エラー率が5%を超えた場合
   - レスポンス時間が10秒を超えた場合
