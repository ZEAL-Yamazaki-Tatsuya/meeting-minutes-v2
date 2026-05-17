# 議事録精度向上機能

## 概要

議事録の出力精度を向上させるため、以下の改善を実装しました：

1. **LLMモデルのバージョン**: Claude 3.5 Sonnet v2を使用（最新の高精度モデル）
2. **論点ベースの構造化**: 議事録を「論点（議題）」ごとに整理し、各論点に議論・結論・アクションを紐づけ
3. **会議コンテキストのオプション入力**: 会議の種類、出席者、重点項目などを指定可能

## 1. LLMモデルのバージョン

### 使用モデル
- **モデルID**: `apac.anthropic.claude-3-5-sonnet-20241022-v2:0`
- **リージョン**: APACリージョン（ap-northeast-1）
- **特徴**: Claude 3.5 Sonnet v2は、より高精度な文章理解と構造化出力が可能

### 設定方法
`.env`ファイルで以下を設定：
```bash
BEDROCK_MODEL_ID=apac.anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_REGION=ap-northeast-1
```

## 2. プロンプトの改善（論点ベース構造）

### 改善内容

#### 論点ベースの議事録構造

従来のフラットな「トピック + 決定事項 + ネクストアクション」構造から、**論点（議題）ごとに議論・結論・アクションをまとめる構造**に変更しました。

#### 新しい出力構造

各論点（Agenda Item）には以下の情報が含まれます：

- **issue（論点）**: 「XXXはどうするか？」形式で議論テーマを記述
- **discussion（議論内容）**: 各発言者の発言を記録（speaker + content）
- **conclusion（結論）**: 「XXXとする」形式で結論を記述。結論が出ていない場合は「継続検討」
- **nextIssues（ネクスト論点）**: この議論から派生した次回以降の検討事項
- **nextActions（ネクストアクション）**: 担当者（assignee）、アクション内容（action）、期限（dueDate）

#### 後方互換性

トップレベルの `decisions` と `nextActions` フィールドは後方互換性のために維持されています。全論点を通じた決定事項・アクションの一覧として出力されます。

#### 技術的な改善
- **max_tokens**: 4096 → 8192に増加（より多くの項目を出力可能）
- **プロンプト**: 論点ベースの構造化を明確に指示
- **5つの絶対ルール**: 網羅性、具体性、正確性、形式、タイムスタンプを強調

### プロンプトの主な変更点

```typescript
// 改善前（フラット構造）
// topics: [{title, description}]
// decisions: [{description, timestamp}]
// nextActions: [{description, timestamp, assignee?, dueDate?}]

// 改善後（論点ベース構造）
// agendaItems: [{issue, discussion, conclusion, nextIssues, nextActions}]
// decisions: [{description, timestamp}]  ← 後方互換性
// nextActions: [{description, assignee?, dueDate?, timestamp}]  ← 後方互換性
```

### 論点の抽出ガイドライン

プロンプトに以下のガイドラインを明記：

- **明示的な議題**: 「次の議題は〜」「〜について話しましょう」
- **質問形式の議論**: 「〜はどうしますか？」「〜についてどう思いますか？」
- **報告事項**: 「〜の進捗を報告します」「〜の結果を共有します」
- **確認事項**: 「〜を確認したいのですが」
- **小さな議題も含む**: 日程調整、連絡事項、確認事項

### 絶対に守るべき5つのルール

1. **網羅性**: 会議中のすべての論点を漏らさず記録
2. **具体性**: 各発言は具体的に記述
3. **正確性**: 文字起こしテキストに忠実に記録
4. **形式**: JSON形式のみを出力し、他の説明文は含めない
5. **タイムスタンプ**: decisions と nextActions（トップレベル）には必ずtimestampを含める

## 3. 会議コンテキストのオプション入力

### 機能概要

アップロード時に以下の情報を指定することで、LLMがより正確な議事録を生成できます：

#### 入力項目

1. **会議の種類** (`meetingType`)
   - 例：定例会議、プロジェクト会議、ブレスト、レビュー会議
   - LLMが会議の性質を理解し、適切な形式で議事録を生成

2. **出席者** (`attendees`)
   - カンマ区切りで参加者の名前を指定
   - 例：田中、佐藤、鈴木
   - 話者識別の精度向上と、担当者の推測に活用

3. **重点整理項目** (`focusAreas`)
   - 決定事項
   - ネクストアクション
   - 課題・リスク
   - 議論のポイント
   - 選択した項目を特に詳細に抽出

4. **追加の指示** (`additionalInstructions`)
   - 自由記述で追加の要求を指定
   - 例：「技術的な詳細を重視してください」「予算に関する議論を詳しく記録してください」

### データフロー

```
フロントエンド（アップロードページ）
  ↓ meetingContext
アップロードAPI（upload-handler）
  ↓ DynamoDBに保存
処理開始API（start-processing）
  ↓ Step Functionsに渡す
議事録生成Lambda（minutes-generator）
  ↓ Bedrockに渡す
Amazon Bedrock（Claude 3.5 Sonnet v2）
  ↓ 会議コンテキストを考慮した議事録生成
```

### 実装詳細

#### フロントエンド（`frontend/app/upload/page.tsx`）

```typescript
// 会議コンテキストの状態管理
const [meetingType, setMeetingType] = useState('');
const [attendees, setAttendees] = useState('');
const [focusAreas, setFocusAreas] = useState<string[]>([]);
const [additionalInstructions, setAdditionalInstructions] = useState('');

// アップロード時にコンテキストを含める
const meetingContext = {
  meetingType: meetingType || undefined,
  attendees: attendees ? attendees.split(',').map(a => a.trim()) : undefined,
  focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
  additionalInstructions: additionalInstructions || undefined,
};
```

#### バックエンド（`src/utils/bedrock-client.ts`）

```typescript
export interface MeetingContext {
  meetingType?: string;
  attendees?: string[];
  focusAreas?: string[];
  additionalInstructions?: string;
}

async generateMinutes(
  jobId: string,
  parsedTranscript: ParsedTranscript,
  meetingContext?: MeetingContext
): Promise<Minutes>
```

プロンプトに会議情報セクションを追加：

```typescript
if (meetingContext) {
  contextSection = '\n# 会議情報\n\n';
  
  if (meetingContext.meetingType) {
    contextSection += `- **会議の種類**: ${meetingContext.meetingType}\n`;
  }
  
  if (meetingContext.attendees && meetingContext.attendees.length > 0) {
    contextSection += `- **出席者**: ${meetingContext.attendees.join('、')}\n`;
  }
  
  // ... 他の項目
}
```

## 使用方法

### 1. ファイルアップロード時

1. MP4ファイルを選択
2. 「会議情報（オプション）」セクションが表示される
3. 必要に応じて以下を入力：
   - 会議の種類
   - 出席者（カンマ区切り）
   - 重点整理項目（チェックボックス）
   - 追加の指示
4. 「アップロード開始」をクリック

### 2. 議事録生成

- 入力した会議コンテキストがLLMに渡される
- LLMは会議の性質を理解し、より正確な議事録を生成
- 決定事項とネクストアクションがすべて抽出される

## 期待される効果

### 精度向上

1. **論点ベースの構造化**
   - 改善前：フラットなトピック + 決定事項 + ネクストアクションの分離構造
   - 改善後：論点ごとに議論・結論・アクションが紐づいた構造
   - 各論点の文脈が保持され、議事録の可読性が大幅に向上

2. **発言者の記録**
   - 改善前：発言者情報なし
   - 改善後：各発言に発言者名を記録（speaker + content形式）
   - 誰が何を言ったかが明確に

3. **論点間の関連性**
   - 改善前：トピック間の関連性が不明
   - 改善後：nextIssues フィールドで派生論点を明示
   - 議論の流れと次回の検討事項が明確に

4. **出力トークン数の増加**
   - 改善前：max_tokens = 4096（約3,000文字相当）
   - 改善後：max_tokens = 8192（約6,000文字相当）
   - より多くの項目を出力可能

5. **会議コンテキストによる精度向上**
   - 会議の種類に応じた適切な形式
   - 出席者情報による発言者の特定精度向上
   - 重点項目の詳細な抽出

### コスト影響

- Claude 3.5 Sonnet v2の使用により、若干のコスト増加（約10-15%）
- ただし、精度向上により再処理の必要性が減少
- 全体としてはコスト効率が向上

## トラブルシューティング

### 会議コンテキストが反映されない

1. `.env`ファイルでBEDROCK_MODEL_IDが正しく設定されているか確認
2. Lambda関数の環境変数が更新されているか確認
3. CloudWatch Logsで会議コンテキストが渡されているか確認

### 決定事項が抽出されない

1. 会議の録音品質を確認（ノイズが多いと精度が低下）
2. 「重点整理項目」で「決定事項」をチェック
3. 「追加の指示」で「決定事項を詳しく記録してください」と指定

## 今後の改善案

1. **テンプレート機能**
   - よく使う会議コンテキストをテンプレートとして保存
   - ワンクリックで適用可能

2. **学習機能**
   - ユーザーの編集履歴から好みの形式を学習
   - 自動的に最適なプロンプトを生成

3. **多言語対応**
   - 英語の会議にも対応
   - 会議言語を自動検出

4. **カスタムプロンプト**
   - 上級ユーザー向けにプロンプトを直接編集可能
   - 組織固有の議事録形式に対応
