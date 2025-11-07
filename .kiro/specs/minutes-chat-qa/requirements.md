# Requirements Document

## Introduction

議事録結果画面に、議事録の内容について質疑応答できるチャット機能を追加します。ユーザーは生成された議事録や文字起こし全文を基に、AIと対話形式で質問し、詳細な情報を得ることができます。

## Glossary

- **System**: 議事録チャットQAシステム
- **User**: 議事録を閲覧・質問するユーザー
- **Chat Interface**: チャット形式のUI
- **Context**: 議事録の内容（概要、決定事項、ネクストアクション、文字起こし全文）
- **AI Model**: Amazon Bedrock（Claude）を使用した質疑応答エンジン
- **Chat History**: ユーザーとAIの会話履歴

## Requirements

### Requirement 1

**User Story:** ユーザーとして、議事録画面でチャットインターフェースを開き、議事録の内容について質問したい

#### Acceptance Criteria

1. WHEN ユーザーが議事録画面を表示する時、THE System SHALL チャットボタンを表示する
2. WHEN ユーザーがチャットボタンをクリックする時、THE System SHALL チャットインターフェースを開く
3. THE System SHALL チャットインターフェースに質問入力欄と送信ボタンを表示する
4. THE System SHALL チャットインターフェースに会話履歴を表示するエリアを提供する
5. WHEN ユーザーがチャットインターフェースを閉じる時、THE System SHALL 会話履歴を保持する

### Requirement 2

**User Story:** ユーザーとして、議事録の内容について自然言語で質問し、AIから回答を得たい

#### Acceptance Criteria

1. WHEN ユーザーが質問を入力して送信する時、THE System SHALL 質問を会話履歴に追加する
2. THE System SHALL 議事録の内容（概要、決定事項、ネクストアクション、文字起こし全文）をコンテキストとしてAIに送信する
3. THE System SHALL Amazon Bedrock（Claude）を使用してAI回答を生成する
4. WHEN AI回答が生成される時、THE System SHALL 回答を会話履歴に追加する
5. THE System SHALL 回答生成中にローディングインジケーターを表示する

### Requirement 3

**User Story:** ユーザーとして、会話の文脈を保持しながら複数の質問をしたい

#### Acceptance Criteria

1. THE System SHALL 同一セッション内の会話履歴を保持する
2. WHEN ユーザーが追加の質問をする時、THE System SHALL 過去の会話履歴を含めてAIに送信する
3. THE System SHALL 最大10件の会話履歴を保持する
4. WHEN 会話履歴が10件を超える時、THE System SHALL 古い会話から削除する
5. THE System SHALL 会話履歴をクリアするボタンを提供する

### Requirement 4

**User Story:** ユーザーとして、チャット機能がエラーになった場合、適切なエラーメッセージを確認したい

#### Acceptance Criteria

1. WHEN API呼び出しが失敗する時、THE System SHALL エラーメッセージを表示する
2. THE System SHALL ネットワークエラー時に再試行ボタンを表示する
3. WHEN AIの回答生成が失敗する時、THE System SHALL ユーザーに通知する
4. THE System SHALL エラー発生時も会話履歴を保持する
5. THE System SHALL タイムアウト（30秒）を設定し、超過時にエラーを表示する

### Requirement 5

**User Story:** ユーザーとして、モバイルデバイスでもチャット機能を快適に使用したい

#### Acceptance Criteria

1. THE System SHALL レスポンシブデザインでチャットインターフェースを表示する
2. THE System SHALL モバイル画面では全画面モーダルとしてチャットを表示する
3. THE System SHALL タッチ操作に最適化されたUIを提供する
4. THE System SHALL 仮想キーボード表示時もUIが適切に調整される
5. THE System SHALL スクロール位置を最新メッセージに自動調整する

### Requirement 6

**User Story:** システム管理者として、チャット機能のコストを管理したい

#### Acceptance Criteria

1. THE System SHALL 1回のAPI呼び出しで送信するトークン数を制限する（最大10,000トークン）
2. THE System SHALL ユーザーごとに1日あたりの質問回数を制限する（最大50回）
3. THE System SHALL API呼び出しのログを記録する
4. THE System SHALL エラー率を監視する
5. THE System SHALL レスポンス時間を監視する
