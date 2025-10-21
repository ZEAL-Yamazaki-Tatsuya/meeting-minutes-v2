# タイムスタンプ・担当者・期限の表示修正

## 問題

議事録のネクストアクションに`timestamp`、`assignee`、`dueDate`が表示されない問題が発生していました。

## 原因

`get-minutes` Lambda関数の`parseMarkdownMinutes`関数で、Markdownファイルをパースする際の条件が厳しすぎました：

```typescript
// 問題のあったコード
line.startsWith('   - **担当**:')  // スペース3つで始まる行のみマッチ
```

実際のMarkdownファイルでは、インデントが異なる可能性があり、この条件では正しくパースできませんでした。

## 解決策

`startsWith`を`includes`に変更することで、インデントに関係なくパースできるようにしました：

```typescript
// 修正後のコード
line.includes('**担当**:')  // 行内に含まれていればマッチ
```

### 修正したファイル

1. **src/lambdas/get-minutes/index.ts**
   - `parseMarkdownMinutes`関数のnextActionsパース処理を修正
   - `startsWith` → `includes`に変更

2. **src/utils/bedrock-client.ts**
   - プロンプトを改善して、LLMが確実にフィールドを出力するように強化
   - フィールドの順序と必須/任意の区別を明確化

## 検証

修正後、以下の項目が正しく表示されることを確認：

- ✅ `timestamp`: すべてのアクションに表示
- ✅ `assignee`: 明示されている場合に表示（例：「柳生」）
- ✅ `dueDate`: 明示されている場合に表示

## デプロイ

```bash
cdk deploy meeting-minutes-generator-compute-dev --require-approval never
```

## 関連ファイル

- `src/lambdas/get-minutes/index.ts`
- `src/utils/bedrock-client.ts`
- `src/models/minutes.ts`
