# Requirements Document

## Introduction

議事録の概要セクションを改善し、トピック別に章立てした詳細な情報を提供します。現在の概要は全体的な要約のみですが、会議の内容をトピックごとに分類し、各トピックについてより詳細な情報を提供することで、ユーザーが会議の内容をより理解しやすくします。

## Glossary

- **System**: 議事録生成システム
- **Summary**: 議事録の概要セクション
- **Overall Summary**: 全体概要（現在の概要と同じ）
- **Topic**: 会議で議論されたトピック・テーマ
- **Topic Breakdown**: トピック別の詳細情報
- **AI Model**: Amazon Bedrock（Claude）を使用した議事録生成エンジン

## Requirements

### Requirement 1

**User Story:** ユーザーとして、議事録の概要セクションで全体概要とトピック別の詳細情報を確認したい

#### Acceptance Criteria

1. THE System SHALL 概要セクションに全体概要を表示する
2. THE System SHALL 概要セクションにトピック別の詳細情報を表示する
3. THE System SHALL 各トピックにタイトルを付ける
4. THE System SHALL 各トピックに詳細な説明を含める
5. THE System SHALL トピックを視覚的に区別できるUIを提供する

### Requirement 2

**User Story:** ユーザーとして、AIが自動的に会議内容をトピック別に分類し、詳細情報を生成してほしい

#### Acceptance Criteria

1. WHEN 議事録を生成する時、THE System SHALL 文字起こし全文を分析してトピックを抽出する
2. THE System SHALL 各トピックについて詳細な説明を生成する
3. THE System SHALL トピックを論理的な順序で並べる
4. THE System SHALL 最小2個、最大6個のトピックを生成する
5. THE System SHALL 各トピックの説明を100-300文字程度にする

### Requirement 3

**User Story:** ユーザーとして、編集モードでトピック別の詳細情報を編集したい

#### Acceptance Criteria

1. WHEN ユーザーが編集モードに入る時、THE System SHALL トピックのタイトルと説明を編集可能にする
2. THE System SHALL トピックを追加するボタンを提供する
3. THE System SHALL トピックを削除するボタンを提供する
4. THE System SHALL トピックの順序を変更する機能を提供する
5. WHEN ユーザーが保存する時、THE System SHALL 編集内容をDynamoDBとS3に保存する

### Requirement 4

**User Story:** ユーザーとして、トピック別の詳細情報がMarkdownファイルにも含まれることを確認したい

#### Acceptance Criteria

1. THE System SHALL ダウンロードするMarkdownファイルにトピック別の詳細情報を含める
2. THE System SHALL 各トピックを見出しとして表示する
3. THE System SHALL トピックの説明を本文として表示する
4. THE System SHALL 全体概要とトピック別詳細を明確に区別する
5. THE System SHALL 既存のMarkdownフォーマットと互換性を保つ

### Requirement 5

**User Story:** ユーザーとして、モバイルデバイスでもトピック別の詳細情報を快適に閲覧したい

#### Acceptance Criteria

1. THE System SHALL レスポンシブデザインでトピック別詳細を表示する
2. THE System SHALL モバイル画面でも読みやすいフォントサイズを使用する
3. THE System SHALL トピック間の視覚的な区切りを明確にする
4. THE System SHALL 長いトピック説明を適切に折り返す
5. THE System SHALL タッチ操作に最適化されたUIを提供する

### Requirement 6

**User Story:** システム管理者として、トピック生成の品質を確保したい

#### Acceptance Criteria

1. THE System SHALL トピック生成時に適切なプロンプトを使用する
2. THE System SHALL トピックの重複を避ける
3. THE System SHALL 意味のあるトピックタイトルを生成する
4. THE System SHALL トピック生成のエラーをログに記録する
5. WHEN トピック生成が失敗する時、THE System SHALL 全体概要のみを表示する
