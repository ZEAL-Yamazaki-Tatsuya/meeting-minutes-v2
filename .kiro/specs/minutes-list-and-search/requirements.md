# Requirements Document

## Introduction

現在のシステムはジョブ単位での一覧表示のみをサポートしていますが、ユーザーは全議事録を横断的に閲覧・検索したいというニーズがあります。本機能では、議事録ベースの一覧表示と、AI を活用した全議事録横断のあいまい検索機能を提供します。

## Glossary

- **System**: 議事録一覧・検索システム
- **User**: 議事録を閲覧・検索するユーザー
- **Minutes**: 生成された議事録（概要、決定事項、ネクストアクション、文字起こし全文を含む）
- **Job**: 音声ファイルのアップロードから議事録生成までの処理単位
- **AI Search**: Amazon Bedrock を使用した自然言語による検索機能
- **Semantic Search**: 意味的な類似性に基づく検索
- **Minutes List**: 全議事録の一覧表示画面
- **Search Interface**: AI 検索のためのチャットインターフェース

## Requirements

### Requirement 1

**User Story:** ユーザーとして、自分の議事録を一覧表示し、作成日時や会議名で確認したい

#### Acceptance Criteria

1. THE System SHALL 認証されたユーザーに紐づく議事録のみを一覧表示する画面を提供する
2. WHEN ユーザーが議事録一覧画面にアクセスする時、THE System SHALL 該当ユーザーの議事録を作成日時の降順で表示する
3. THE System SHALL 各議事録に会議名、作成日時、概要の冒頭を表示する
4. WHEN ユーザーが議事録をクリックする時、THE System SHALL 該当する議事録の詳細画面に遷移する
5. THE System SHALL ページネーション機能を提供し、1ページあたり20件の議事録を表示する

### Requirement 2

**User Story:** ユーザーとして、議事録一覧を日付範囲や会議名でフィルタリングしたい

#### Acceptance Criteria

1. THE System SHALL 日付範囲指定のフィルター機能を提供する
2. THE System SHALL 会議名による部分一致検索機能を提供する
3. WHEN ユーザーがフィルターを適用する時、THE System SHALL 条件に合致する議事録のみを表示する
4. THE System SHALL フィルター条件をクリアするボタンを提供する
5. THE System SHALL フィルター適用中も作成日時の降順でソートを維持する

### Requirement 3

**User Story:** ユーザーとして、自分の議事録を横断して自然言語で検索したい

#### Acceptance Criteria

1. THE System SHALL 議事録一覧画面に AI 検索ボタンを表示する
2. WHEN ユーザーが AI 検索ボタンをクリックする時、THE System SHALL 検索用のチャットインターフェースを開く
3. THE System SHALL チャットインターフェースに質問入力欄と送信ボタンを表示する
4. WHEN ユーザーが質問を入力して送信する時、THE System SHALL 認証されたユーザーの議事録のみを対象に検索を実行する
5. THE System SHALL Amazon Bedrock を使用して質問の意図を理解し、関連する議事録を特定する

### Requirement 4

**User Story:** ユーザーとして、AI 検索の結果として関連する議事録と該当箇所を確認したい

#### Acceptance Criteria

1. WHEN AI が関連する議事録を特定する時、THE System SHALL 該当する議事録のリストを返す
2. THE System SHALL 各議事録について会議名、作成日時、関連する内容の抜粋を表示する
3. THE System SHALL 最大5件の関連議事録を表示する
4. WHEN ユーザーが検索結果の議事録をクリックする時、THE System SHALL 該当する議事録の詳細画面に遷移する
5. THE System SHALL 検索結果に該当箇所のハイライトまたは引用を含める

### Requirement 5

**User Story:** ユーザーとして、AI 検索で具体的な内容（例：「hoge テーブルは移行対象外」）がどの議事録にあるか特定したい

#### Acceptance Criteria

1. WHEN ユーザーが具体的な内容を含む質問をする時、THE System SHALL 該当する文言を含む議事録を特定する
2. THE System SHALL 文字起こし全文、決定事項、ネクストアクションを検索対象とする
3. THE System SHALL 完全一致だけでなく、意味的に類似する内容も検索対象とする
4. WHEN 該当する議事録が見つからない時、THE System SHALL 「該当する議事録が見つかりませんでした」と表示する
5. THE System SHALL 検索結果に該当箇所の前後のコンテキストを含める

### Requirement 6

**User Story:** ユーザーとして、AI 検索で会話形式で追加の質問をしたい

#### Acceptance Criteria

1. THE System SHALL 同一セッション内の会話履歴を保持する
2. WHEN ユーザーが追加の質問をする時、THE System SHALL 前の検索結果を考慮して回答する
3. THE System SHALL 最大5件の会話履歴を保持する
4. WHEN 会話履歴が5件を超える時、THE System SHALL 古い会話から削除する
5. THE System SHALL 会話履歴をクリアするボタンを提供する

### Requirement 7

**User Story:** ユーザーとして、AI 検索がエラーになった場合、適切なエラーメッセージを確認したい

#### Acceptance Criteria

1. WHEN API 呼び出しが失敗する時、THE System SHALL エラーメッセージを表示する
2. THE System SHALL ネットワークエラー時に再試行ボタンを表示する
3. WHEN AI の検索が失敗する時、THE System SHALL ユーザーに通知する
4. THE System SHALL エラー発生時も会話履歴を保持する
5. THE System SHALL タイムアウト（60秒）を設定し、超過時にエラーを表示する

### Requirement 8

**User Story:** ユーザーとして、モバイルデバイスでも議事録一覧と AI 検索を快適に使用したい

#### Acceptance Criteria

1. THE System SHALL レスポンシブデザインで議事録一覧を表示する
2. THE System SHALL モバイル画面では全画面モーダルとして AI 検索を表示する
3. THE System SHALL タッチ操作に最適化された UI を提供する
4. THE System SHALL 仮想キーボード表示時も UI が適切に調整される
5. THE System SHALL スクロール位置を最新メッセージに自動調整する

### Requirement 9

**User Story:** システム管理者として、AI 検索機能のコストとパフォーマンスを管理したい

#### Acceptance Criteria

1. THE System SHALL 1回の検索で処理する議事録数を制限する（最大100件）
2. THE System SHALL ユーザーごとに1日あたりの検索回数を制限する（最大30回）
3. THE System SHALL API 呼び出しのログを記録する
4. THE System SHALL 検索レスポンス時間を監視する
5. THE System SHALL エラー率を監視する

### Requirement 10

**User Story:** ユーザーとして、議事録一覧の読み込みが高速であることを期待する

#### Acceptance Criteria

1. THE System SHALL 議事録一覧の初期表示を3秒以内に完了する
2. THE System SHALL ページネーション時の読み込みを1秒以内に完了する
3. THE System SHALL 議事録データをキャッシュして再表示を高速化する
4. WHEN 議事録が100件を超える時、THE System SHALL 仮想スクロールまたは遅延読み込みを使用する
5. THE System SHALL 読み込み中にスケルトンスクリーンまたはローディングインジケーターを表示する

### Requirement 11

**User Story:** システム管理者として、ユーザーが自分の議事録のみにアクセスできることを保証したい

#### Acceptance Criteria

1. THE System SHALL Cognito 認証を使用してユーザーを識別する
2. THE System SHALL 全ての API リクエストで認証トークンを検証する
3. WHEN ユーザーが議事録一覧を取得する時、THE System SHALL 該当ユーザーの userId でフィルタリングする
4. WHEN ユーザーが AI 検索を実行する時、THE System SHALL 該当ユーザーの議事録のみを検索対象とする
5. THE System SHALL 他のユーザーの議事録へのアクセスを拒否し、403エラーを返す
