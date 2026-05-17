# 実装計画: 会議メタデータ入力機能

## 概要

既存のファイルアップロード画面を改修し、会議メタデータ（会議名・開催日時・参加者・論点）の入力フォームを追加する。入力されたメタデータはバックエンドに保存され、議事録生成時のAIプロンプトに活用される。また、議事録一覧画面と議事録詳細画面の表示を改善し、入力されたメタデータを反映する。

## Tasks

- [x] 1. 型定義の拡張とユーティリティ関数の作成
  - [x] 1.1 フロントエンド型定義の拡張（frontend/types/index.ts）
    - `MinutesSummary` に `meetingDate?: string` フィールドを追加
    - `Job` の `metadata` に `agenda?: string[]` フィールドを追加
    - `Minutes` に `meetingDate?: string` と `participants?: string[]` フィールドを追加
    - `MetadataFormErrors` インターフェースを新規追加
    - _Requirements: 5.1, 7.3, 8.1_

  - [x] 1.2 バックエンド Upload Handler の型定義拡張（src/lambdas/upload-handler/index.ts）
    - `UploadRequest` の `metadata` に `agenda?: string[]` フィールドを追加
    - _Requirements: 5.4_

  - [x] 1.3 バリデーションユーティリティ関数の作成（frontend/lib/metadata-validation.ts）
    - `validateMetadataForm` 関数を作成（meetingName非空、meetingDate有効、participants1名以上）
    - `filterEmptyValues` 関数を作成（空文字列・ホワイトスペースのみの要素を除外）
    - `resolveDisplayDate` 関数を作成（meetingDate優先、なければcreatedAtフォールバック）
    - _Requirements: 4.4, 4.5, 5.2, 5.3, 7.3, 7.4_

  - [ ]* 1.4 バリデーションユーティリティのプロパティベーステスト（frontend/lib/__tests__/metadata-validation.pbt.test.ts）
    - fast-check をフロントエンドの devDependencies に追加
    - **Property 5: メタデータバリデーション** — validateMetadataForm が正しい条件でのみ true を返すことを検証
    - **Validates: Requirements 4.4, 4.5**
    - **Property 6: 空要素のフィルタリング** — filterEmptyValues の結果に空文字列が含まれず、非空要素が保持されることを検証
    - **Validates: Requirements 5.2, 5.3**
    - **Property 9: 議事録一覧の日時表示解決** — resolveDisplayDate が meetingDate 優先でフォールバックすることを検証
    - **Validates: Requirements 7.3, 7.4**

- [x] 2. DynamicInputList コンポーネントの実装
  - [x] 2.1 DynamicInputList コンポーネントの作成（frontend/components/dynamic-input-list.tsx）
    - 入力値の配列を管理する汎用コンポーネントを実装
    - 入力欄に文字が入力されたとき、空の入力欄が存在しなければ新しい空の入力欄を追加
    - 空の入力欄が既に存在する場合は追加しない
    - 各入力欄に削除ボタンを表示（入力欄が1つのみの場合を除く）
    - 削除ボタンクリックで対象の入力欄を削除
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 2.2 DynamicInputList のプロパティベーステスト（frontend/components/__tests__/dynamic-input-list.pbt.test.ts）
    - **Property 1: 動的入力欄の追加** — 空の入力欄が存在しない状態で入力が行われた場合、入力欄の数が正確に1つ増加することを検証
    - **Validates: Requirements 2.2, 3.2**
    - **Property 2: 空の入力欄が存在する場合の追加抑制** — 空文字列を含む配列に対して入力しても配列の長さが変化しないことを検証
    - **Validates: Requirements 2.3, 3.3**
    - **Property 3: 削除ボタンの表示条件** — N > 1のとき削除ボタン表示、N = 1のとき非表示を検証
    - **Validates: Requirements 2.4, 3.4**
    - **Property 4: 入力欄の削除** — 削除後の配列が元の配列からi番目の要素を除いた配列と等しいことを検証
    - **Validates: Requirements 2.5, 3.5**

- [x] 3. MetadataForm コンポーネントの実装
  - [x] 3.1 MetadataForm コンポーネントの作成（frontend/components/metadata-form.tsx）
    - 会議名（テキスト入力、必須、最大100文字）
    - 開催日時（datetime-local入力、必須）
    - 参加者（DynamicInputList使用、必須、各名前最大50文字）
    - 論点（DynamicInputList使用、任意、各項目最大200文字）
    - バリデーションエラーのインライン表示
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3_

  - [ ]* 3.2 MetadataForm のユニットテスト（frontend/components/__tests__/metadata-form.test.tsx）
    - フォームの各入力欄が正しくレンダリングされることを確認
    - バリデーションエラーメッセージの表示テスト
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3_

- [x] 4. チェックポイント - フロントエンドコンポーネントの確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 5. アップロード画面の改修
  - [x] 5.1 アップロード画面の状態管理とフォーム統合（frontend/app/upload/page.tsx）
    - 既存の会議コンテキスト入力セクションを MetadataForm コンポーネントに置き換え
    - meetingName, meetingDate, participants, agenda の状態管理を追加
    - ファイル選択後にメタデータフォームを表示する制御を実装
    - _Requirements: 1.1, 5.1_

  - [x] 5.2 アップロード処理のバリデーション統合（frontend/app/upload/page.tsx）
    - アップロードボタンクリック時にバリデーション実行
    - 必須項目未入力時のエラーメッセージ表示
    - バリデーション通過時のみアップロード処理を実行
    - 送信前に空の参加者・論点をフィルタリング
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 5.3_

  - [x] 5.3 APIサービスの改修（frontend/lib/api-service.ts）
    - `getUploadUrl` メソッドの `metadata` パラメータに `agenda` フィールドを追加
    - アップロード時に会議メタデータ（meetingTitle, meetingDate, participants, agenda）を送信
    - _Requirements: 5.1_

- [x] 6. バックエンドの改修
  - [x] 6.1 Upload Handler の metadata 保存拡張（src/lambdas/upload-handler/index.ts）
    - リクエストボディから `metadata.agenda` を受け取り DynamoDB に保存
    - 既存の metadata フィールド（meetingTitle, meetingDate, participants）の保存ロジックは維持
    - _Requirements: 5.4_

  - [x] 6.2 Minutes Generator の論点ベースプロンプト改修（src/lambdas/minutes-generator/index.ts）
    - DynamoDB からジョブの metadata を取得するロジックを追加
    - metadata.agenda が存在する場合、入力された論点をベースに議事録を構造化するプロンプトを生成
    - metadata.agenda が存在しない場合、AIが文字起こしから論点を自動抽出する既存動作を維持
    - どちらの場合も同じ出力フォーマット（agendaItems構造）を要求
    - 論点が20件を超える場合は最初の20件に制限
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.3 List Minutes の meetingDate 対応（src/lambdas/list-minutes/index.ts）
    - `MinutesSummary` レスポンスに `meetingDate` フィールドを追加
    - DynamoDB の metadata.meetingDate を MinutesSummary に含める
    - _Requirements: 7.3, 7.4_

  - [ ]* 6.4 バックエンドのユニットテスト更新
    - Upload Handler テスト: metadata.agenda の保存テスト追加
    - Minutes Generator テスト: 論点あり/なしのプロンプト構築テスト追加
    - List Minutes テスト: meetingDate を含むレスポンス形式テスト追加
    - _Requirements: 5.4, 6.1, 6.2, 6.3, 7.3_

  - [ ]* 6.5 プロンプト生成のプロパティベーステスト（src/lambdas/minutes-generator/__tests__/prompt.pbt.test.ts）
    - fast-check をルートの devDependencies に追加
    - **Property 7: 論点ベースのプロンプト生成** — 非空の論点リストに対して、生成されるプロンプトにすべての論点が含まれることを検証
    - **Validates: Requirements 6.1**
    - **Property 8: 出力フォーマットの一貫性** — 任意の論点リストに対して、同一のJSON出力形式（agendaItems構造）を要求することを検証
    - **Validates: Requirements 6.3**

- [x] 7. チェックポイント - バックエンド改修の確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 8. 議事録一覧の表示改修
  - [x] 8.1 議事録一覧アイテムの日時表示改修（frontend/components/minutes-list-item.tsx）
    - `meetingDate` が存在する場合は `meetingDate` を日時表示に使用
    - `meetingDate` が存在しない場合は従来通り `createdAt` を表示（フォールバック）
    - `resolveDisplayDate` ユーティリティ関数を使用
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 8.2 議事録一覧表示のユニットテスト（frontend/components/__tests__/minutes-list-item.test.tsx）
    - meetingDate あり/なしの表示切り替えテスト
    - 後方互換性テスト（メタデータなしの既存データ）
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 9. 議事録詳細画面のヘッダー改修
  - [x] 9.1 議事録詳細画面のヘッダー表示改修（frontend/app/jobs/[jobId]/minutes/page.tsx）
    - ページタイトルとして `meetingTitle` を表示（存在する場合）
    - タイトル下に開催日時と参加者一覧をシンプルに表示
    - 「会議メタデータヘッダー」等のラベルは表示しない
    - メタデータが存在しない過去の議事録は従来通りの表示を維持
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 9.2 議事録詳細画面のユニットテスト（frontend/app/jobs/[jobId]/minutes/__tests__/page.test.tsx）
    - メタデータあり/なしのヘッダー表示テスト
    - 参加者一覧の表示テスト
    - フォールバック表示テスト
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 10. 最終チェックポイント - 全体統合確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## Notes

- `*` マーク付きのタスクはオプションであり、MVP実装時にはスキップ可能
- 各タスクは特定の要件を参照しており、トレーサビリティを確保
- チェックポイントで段階的な検証を実施
- プロパティベーステストは fast-check を使用し、各プロパティは設計ドキュメントのプロパティ番号に対応
- ユニットテストは具体的な例とエッジケースを検証
- バックエンドのテストは Jest、フロントエンドのプロパティベーステストも Jest + fast-check を使用
