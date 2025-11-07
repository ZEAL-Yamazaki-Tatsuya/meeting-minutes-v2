# Design Document

## Overview

議事録の概要セクションを拡張し、全体概要に加えてトピック別の詳細情報を提供します。AIが会議内容を自動的に分析してトピックを抽出し、各トピックについて詳細な説明を生成します。

## Architecture

### データフロー

```
文字起こし全文
    ↓
Minutes Generator Lambda
    ↓
Bedrock (Claude) - トピック抽出プロンプト
    ↓
トピック別詳細情報
    ↓
DynamoDB + S3 (Markdown)
    ↓
Frontend表示
```

### 既存システムへの影響

- **Minutes Generator Lambda**: プロンプトを拡張してトピック別詳細を生成
- **DynamoDB**: `topics`フィールドを追加
- **Frontend**: 概要セクションのUIを拡張
- **Update Minutes Lambda**: トピック編集機能を追加

## Components and Interfaces

### Data Models

#### Topic Model
```typescript
interface Topic {
  id: string;
  title: string;
  description: string;
  order: number;
}
```

#### Minutes Model (拡張)
```typescript
interface Minutes {
  // 既存フィールド
  jobId: string;
  userId: string;
  summary: string; // 全体概要
  decisions: Decision[];
  nextActions: NextAction[];
  transcript: string;
  
  // 新規フィールド
  topics: Topic[]; // トピック別詳細
}
```

### Backend Changes

#### Minutes Generator Lambda

**プロンプト拡張:**
```typescript
const prompt = `
以下の会議の文字起こしを分析し、議事録を生成してください。

【文字起こし全文】
${transcript}

【出力形式】
以下のJSON形式で出力してください：

{
  "summary": "会議全体の概要（200-300文字）",
  "topics": [
    {
      "title": "トピック1のタイトル",
      "description": "トピック1の詳細説明（100-300文字）"
    },
    {
      "title": "トピック2のタイトル",
      "description": "トピック2の詳細説明（100-300文字）"
    }
  ],
  "decisions": [...],
  "nextActions": [...]
}

【トピック抽出の指示】
- 会議で議論された主要なテーマを2-6個抽出してください
- 各トピックには明確なタイトルを付けてください
- 各トピックの説明は100-300文字程度にしてください
- トピックは議論された順序で並べてください
- 重複するトピックは避けてください
`;
```

**レスポンス処理:**
```typescript
// Bedrockからのレスポンスをパース
const response = await bedrockClient.invokeModel(prompt);
const parsedResponse = JSON.parse(response);

// トピックにIDと順序を追加
const topics = parsedResponse.topics.map((topic, index) => ({
  id: `topic-${Date.now()}-${index}`,
  title: topic.title,
  description: topic.description,
  order: index,
}));

// DynamoDBに保存
await repository.updateJob({
  jobId,
  userId,
  summary: parsedResponse.summary,
  topics,
  decisions: parsedResponse.decisions,
  nextActions: parsedResponse.nextActions,
});
```

#### Update Minutes Lambda

**トピック更新処理:**
```typescript
// 更新可能なフィールドに'topics'を追加
const allowedFields = [
  'summary',
  'topics', // 新規追加
  'keyPoints',
  'decisions',
  'nextActions',
  'participants',
  'meetingDate',
];
```

#### Markdown生成

**フォーマット:**
```markdown
# 議事録

生成日時: 2025-11-07 12:00:00

## 概要

### 全体概要

[全体概要の内容]

### トピック別詳細

#### 1. [トピック1のタイトル]

[トピック1の詳細説明]

#### 2. [トピック2のタイトル]

[トピック2の詳細説明]

## 決定事項

...
```

### Frontend Changes

#### Minutes Page UI

**概要セクションの構造:**
```tsx
<SectionCard title="概要" icon="📋">
  {/* 全体概要 */}
  <div className="mb-6">
    <h3 className="text-lg font-semibold mb-2">全体概要</h3>
    {isEditing ? (
      <textarea value={editedSummary} onChange={...} />
    ) : (
      <ReactMarkdown>{minutes.summary}</ReactMarkdown>
    )}
  </div>
  
  {/* トピック別詳細 */}
  {minutes.topics && minutes.topics.length > 0 && (
    <div>
      <h3 className="text-lg font-semibold mb-3">トピック別詳細</h3>
      {isEditing ? (
        <TopicEditor
          topics={editedTopics}
          onUpdate={setEditedTopics}
        />
      ) : (
        <TopicList topics={minutes.topics} />
      )}
    </div>
  )}
</SectionCard>
```

#### TopicList Component

```tsx
interface TopicListProps {
  topics: Topic[];
}

function TopicList({ topics }: TopicListProps) {
  return (
    <div className="space-y-4">
      {topics.map((topic, index) => (
        <div
          key={topic.id}
          className="p-4 bg-blue-50 rounded-lg border border-blue-200"
        >
          <h4 className="text-md font-semibold text-blue-900 mb-2">
            {index + 1}. {topic.title}
          </h4>
          <p className="text-gray-700 text-sm">
            {topic.description}
          </p>
        </div>
      ))}
    </div>
  );
}
```

#### TopicEditor Component

```tsx
interface TopicEditorProps {
  topics: Topic[];
  onUpdate: (topics: Topic[]) => void;
}

function TopicEditor({ topics, onUpdate }: TopicEditorProps) {
  const handleAddTopic = () => {
    const newTopic: Topic = {
      id: `topic-${Date.now()}`,
      title: '',
      description: '',
      order: topics.length,
    };
    onUpdate([...topics, newTopic]);
  };

  const handleRemoveTopic = (id: string) => {
    onUpdate(topics.filter(t => t.id !== id));
  };

  const handleUpdateTopic = (id: string, field: keyof Topic, value: string) => {
    onUpdate(
      topics.map(t => t.id === id ? { ...t, [field]: value } : t)
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newTopics = [...topics];
    [newTopics[index - 1], newTopics[index]] = [newTopics[index], newTopics[index - 1]];
    onUpdate(newTopics.map((t, i) => ({ ...t, order: i })));
  };

  const handleMoveDown = (index: number) => {
    if (index === topics.length - 1) return;
    const newTopics = [...topics];
    [newTopics[index], newTopics[index + 1]] = [newTopics[index + 1], newTopics[index]];
    onUpdate(newTopics.map((t, i) => ({ ...t, order: i })));
  };

  return (
    <div className="space-y-3">
      {topics.map((topic, index) => (
        <div
          key={topic.id}
          className="p-4 bg-blue-50 rounded-lg border border-blue-200"
        >
          <div className="flex items-start gap-2 mb-2">
            <span className="text-blue-600 font-semibold mt-2">
              {index + 1}.
            </span>
            <input
              type="text"
              value={topic.title}
              onChange={(e) => handleUpdateTopic(topic.id, 'title', e.target.value)}
              className="flex-1 p-2 border border-gray-300 rounded"
              placeholder="トピックのタイトル"
            />
            <div className="flex gap-1">
              <button
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-30"
                title="上に移動"
              >
                ↑
              </button>
              <button
                onClick={() => handleMoveDown(index)}
                disabled={index === topics.length - 1}
                className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-30"
                title="下に移動"
              >
                ↓
              </button>
              <button
                onClick={() => handleRemoveTopic(topic.id)}
                className="p-1 text-red-600 hover:text-red-800"
                title="削除"
              >
                ×
              </button>
            </div>
          </div>
          <textarea
            value={topic.description}
            onChange={(e) => handleUpdateTopic(topic.id, 'description', e.target.value)}
            className="w-full min-h-[80px] p-2 border border-gray-300 rounded"
            placeholder="トピックの詳細説明（100-300文字）"
          />
        </div>
      ))}
      <button
        onClick={handleAddTopic}
        className="w-full py-2 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50"
      >
        + トピックを追加
      </button>
    </div>
  );
}
```

## Implementation Details

### DynamoDB Schema Changes

既存のジョブテーブルに`topics`フィールドを追加：

```typescript
interface JobItem {
  // 既存フィールド
  jobId: string;
  userId: string;
  status: string;
  summary: string;
  decisions: Decision[];
  nextActions: NextAction[];
  
  // 新規フィールド
  topics?: Topic[]; // オプショナル（後方互換性のため）
}
```

### Markdown Generation

```typescript
function generateMarkdown(data: any): string {
  const lines: string[] = [];

  lines.push('# 議事録');
  lines.push('');
  lines.push(`生成日時: ${new Date(data.updatedAt).toLocaleString('ja-JP')}`);
  lines.push('');

  // 概要
  lines.push('## 概要');
  lines.push('');
  
  // 全体概要
  lines.push('### 全体概要');
  lines.push('');
  lines.push(data.summary || '');
  lines.push('');

  // トピック別詳細
  if (data.topics && data.topics.length > 0) {
    lines.push('### トピック別詳細');
    lines.push('');
    data.topics.forEach((topic: Topic, index: number) => {
      lines.push(`#### ${index + 1}. ${topic.title}`);
      lines.push('');
      lines.push(topic.description);
      lines.push('');
    });
  }

  // 決定事項
  lines.push('## 決定事項');
  // ... 既存の処理

  return lines.join('\n');
}
```

### Error Handling

1. **トピック生成失敗時**
   - 全体概要のみを表示
   - エラーログを記録
   - ユーザーには通知しない（透過的に処理）

2. **JSONパースエラー**
   - フォールバック処理でテキストから抽出
   - 最低限の情報を保存

3. **編集時のバリデーション**
   - トピックタイトルは必須
   - 説明は500文字まで

## Testing Strategy

### ユニットテスト

1. **バックエンド**
   - トピック抽出プロンプトの生成
   - JSONレスポンスのパース
   - Markdown生成

2. **フロントエンド**
   - TopicListコンポーネントのレンダリング
   - TopicEditorの編集機能
   - トピックの並び替え

### 統合テスト

1. **E2Eテスト**
   - 議事録生成時のトピック表示
   - トピックの編集と保存
   - Markdownダウンロード

## Performance Considerations

1. **トピック生成時間**
   - Bedrockの呼び出しは既存の議事録生成と同時
   - 追加の遅延は最小限

2. **データサイズ**
   - トピック数は最大6個に制限
   - 各説明は300文字まで

## Migration Strategy

1. **後方互換性**
   - `topics`フィールドはオプショナル
   - 既存の議事録は`topics`なしで表示

2. **段階的ロールアウト**
   - バックエンドを先にデプロイ
   - フロントエンドを後からデプロイ
   - 既存データは影響を受けない
