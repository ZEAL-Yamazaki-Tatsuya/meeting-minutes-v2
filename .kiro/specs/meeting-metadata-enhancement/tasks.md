# 実装計画: 会議メタデータ入力機能の拡張

## 概要

既存の meeting-metadata-input 機能を拡張し、開催日時の開始/終了分割、参加者入力の会社名+名前フィールド化、バックエンドの保存形式変更、表示形式の改善、後方互換性の維持を実装する。既存コンポーネント（MetadataForm, DynamicInputList, metadata-validation.ts）を改修する形で進める。

## Tasks

- [x] 1. 型定義とデータモデルの拡張
  - [x] 1.1 フロントエンド型定義の拡張（frontend/types/index.ts）
    - `ParticipantEntry` インターフェース（company: string, name: string）を追加
    - `MinutesSummary` に `meetingEndDate?: string` を追加
    - `Minutes` に `meetingEndDate?: string` を追加し、`participants` を `string[] | ParticipantEntry[]` のユニオン型に変更
    - `MetadataFormErrors` に `meetingEndDate?: string` を追加
    - _Requirements: 4.3, 4.4, 5.1, 7.1_

  - [x] 1.2 バックエンドデータモデルの拡張（src/models/meeting-job.ts）
    - `MeetingJobMetadata` に `meetingEndDate?: string` を追加
    - `participants` の型を `string[] | Array<{ company: string; name: string }>` に変更
    - _Requirements: 4.3, 4.4, 7.1_

- [x] 2. バリデーション関数の拡張（frontend/lib/metadata-validation.ts）
  - [x] 2.1 `validateMetadataForm` 関数のシグネチャと実装を拡張
    - 引数に `meetingEndDate: string` と `participants: ParticipantEntry[]` を追加
    - 開始日時の空チェック（エラーメッセージ: 「開始日時を入力してください」）
    - 終了日時が入力されている場合、開始日時より後であることを検証（エラーメッセージ: 「終了日時は開始日時より後に設定してください」）
    - 参加者の name が1名以上非空であることを検証（エラーメッセージ: 「参加者を1名以上入力してください」）
    - 会議名の既存バリデーション（空文字不可）を維持
    - _Requirements: 1.5, 1.6, 3.1, 3.2, 3.3, 3.4, 3.5, 7.4_

  - [x] 2.2 `filterEmptyParticipants` 関数を新規追加
    - `ParticipantEntry[]` を受け取り、name が空文字またはホワイトスペースのみのエントリを除外して返す
    - _Requirements: 4.2_

  - [x] 2.3 `formatMeetingDateRange` 関数を新規追加
    - 開始日時と終了日時を受け取り、両方ある場合は「YYYY/MM/DD HH:MM 〜 HH:MM」形式、開始日時のみの場合は「YYYY/MM/DD HH:MM」形式の文字列を返す
    - _Requirements: 5.1, 5.2, 6.1, 6.2_

  - [x] 2.4 `formatParticipant` 関数を新規追加
    - 新形式（{company, name}）で company が非空の場合は「会社名 / 名前」形式、company が空の場合は名前のみ、旧形式（string）の場合はそのまま返す
    - _Requirements: 5.3, 5.4, 5.5, 7.2_

  - [ ]* 2.5 プロパティベーステスト: 終了日時バリデーション
    - **Property 1: 終了日時バリデーション**
    - **Validates: Requirements 1.5, 1.6, 3.3**
    - fast-check を使用し、任意の開始日時と終了日時のペアに対してバリデーション結果の正確性を検証

  - [ ]* 2.6 プロパティベーステスト: バリデーション関数の包括的正確性
    - **Property 2: バリデーション関数の包括的正確性**
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.5, 7.4**
    - fast-check を使用し、任意のフォーム入力状態に対してバリデーション結果の正確性を検証

  - [ ]* 2.7 プロパティベーステスト: 参加者フィルタリング
    - **Property 6: 参加者フィルタリング**
    - **Validates: Requirements 4.2**
    - fast-check を使用し、任意の ParticipantEntry 配列に対してフィルタリング結果の正確性を検証

  - [ ]* 2.8 プロパティベーステスト: 日時フォーマット関数
    - **Property 7: 日時フォーマット関数**
    - **Validates: Requirements 5.1, 5.2, 6.1, 6.2**
    - fast-check を使用し、任意の有効な日時文字列に対してフォーマット結果の正確性を検証

  - [ ]* 2.9 プロパティベーステスト: 日時解決関数
    - **Property 8: 日時解決関数**
    - **Validates: Requirements 6.3, 7.3**
    - fast-check を使用し、任意のジョブデータに対して日時解決結果の正確性を検証

  - [ ]* 2.10 プロパティベーステスト: 参加者表示フォーマット
    - **Property 9: 参加者表示フォーマット**
    - **Validates: Requirements 5.3, 5.4, 5.5, 7.2**
    - fast-check を使用し、任意の参加者データに対してフォーマット結果の正確性を検証

- [x] 3. チェックポイント - バリデーション関数のテスト確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 4. MetadataForm コンポーネントの改修（frontend/components/metadata-form.tsx）
  - [x] 4.1 Props インターフェースの変更
    - `meetingDate` を `meetingStartDate` に変更し、`meetingEndDate` を追加
    - `participants` の型を `ParticipantEntry[]` に変更
    - コールバック関数を対応する新しいシグネチャに更新
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1_

  - [x] 4.2 開始日時・終了日時の2フィールド表示を実装
    - 「開始日時」ラベル付き datetime-local 入力欄（必須）
    - 「終了日時」ラベル付き datetime-local 入力欄（任意）
    - 各フィールドのバリデーションエラー表示
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 4.3 参加者入力セクションの実装（会社名+名前の2フィールド）
    - 各参加者行に「会社名」（任意、最大50文字）と「名前」（必須、最大50文字）の2つの入力フィールドを横並びで表示
    - 名前フィールドに文字が入力されたとき、空行が存在しなければ新しい空行を追加
    - 空行が既に存在する場合は追加しない
    - 各行に削除ボタンを表示（行が1つのみの場合を除く）
    - 削除ボタンクリックで対象行を削除
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]* 4.4 プロパティベーステスト: 動的参加者行の追加ロジック
    - **Property 3: 動的参加者行の追加ロジック**
    - **Validates: Requirements 2.6, 2.7**
    - fast-check を使用し、任意の参加者リストに対して行追加ロジックの正確性を検証

  - [ ]* 4.5 プロパティベーステスト: 削除ボタン表示条件
    - **Property 4: 削除ボタン表示条件**
    - **Validates: Requirements 2.8**
    - fast-check を使用し、任意の参加者リスト行数に対して削除ボタン表示条件の正確性を検証

  - [ ]* 4.6 プロパティベーステスト: 参加者行の削除ロジック
    - **Property 5: 参加者行の削除ロジック**
    - **Validates: Requirements 2.9**
    - fast-check を使用し、任意の参加者リストと有効なインデックスに対して削除結果の正確性を検証

- [x] 5. アップロードページの改修（frontend/app/upload/page.tsx）
  - [x] 5.1 状態管理の変更
    - `meetingDate` を `meetingStartDate` に変更し、`meetingEndDate` 状態を追加
    - `participants` の型を `ParticipantEntry[]` に変更し、初期値を `[{ company: '', name: '' }]` に設定
    - _Requirements: 1.1, 2.1_

  - [x] 5.2 バリデーションとアップロード処理の更新
    - `validateMetadataForm` の呼び出しを新しいシグネチャに合わせて更新
    - `filterEmptyParticipants` を使用して空の参加者エントリを除外
    - metadata オブジェクトに `meetingEndDate` と新形式 participants を含める
    - _Requirements: 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 5.3 MetadataForm への Props 渡しを更新
    - 新しい Props（meetingStartDate, meetingEndDate, participants）を渡す
    - 対応するコールバック関数を接続
    - _Requirements: 1.1, 2.1_

- [x] 6. チェックポイント - フロントエンドフォーム動作確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 7. バックエンドの改修
  - [x] 7.1 Upload Handler の拡張（src/lambdas/upload-handler/index.ts）
    - `UploadRequest` インターフェースの `metadata.participants` を `Array<{ company: string; name: string }>` に変更
    - `metadata.meetingEndDate` フィールドを追加
    - `buildMetadata` 関数で `meetingEndDate` と新形式 participants を処理
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

  - [x] 7.2 List Minutes の拡張（src/lambdas/list-minutes/index.ts）
    - `MinutesSummary` インターフェースに `meetingEndDate?: string` を追加
    - レスポンスマッピングで `job.metadata?.meetingEndDate` を含める
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 7.3 バックエンドのユニットテスト
    - Upload Handler の metadata 保存テスト（meetingEndDate、新形式 participants）
    - List Minutes のレスポンス形式テスト（meetingEndDate 含む）
    - 後方互換性テスト（旧形式データの読み取り）
    - _Requirements: 4.3, 4.4, 7.1_

- [x] 8. API サービスの改修（frontend/lib/api-service.ts）
  - [x] 8.1 `getUploadUrl` メソッドの metadata 型を更新
    - `participants` を `Array<{ company: string; name: string }>` に変更
    - `meetingEndDate?: string` を追加
    - _Requirements: 4.1, 4.3, 4.4_

- [x] 9. 議事録一覧画面の表示改修（frontend/components/minutes-list-item.tsx）
  - [x] 9.1 日時表示を `formatMeetingDateRange` を使用した時間帯表示に変更
    - `meetingDate` と `meetingEndDate` を使って時間帯フォーマットで表示
    - `meetingDate` が存在しない場合は `createdAt` にフォールバック（既存動作維持）
    - _Requirements: 6.1, 6.2, 6.3, 7.3_

- [x] 10. 議事録詳細画面の表示改修（frontend/app/jobs/[jobId]/minutes/page.tsx）
  - [x] 10.1 開催日時の時間帯表示を実装
    - `formatMeetingDateRange` を使用して開始〜終了の時間帯表示に変更
    - _Requirements: 5.1, 5.2_

  - [x] 10.2 参加者表示を `formatParticipant` を使用した形式に変更
    - 新形式（{company, name}）と旧形式（string）の両方に対応
    - 会社名がある場合は「会社名 / 名前」形式で表示
    - _Requirements: 5.3, 5.4, 5.5, 7.2_

- [x] 11. チェックポイント - 全体統合確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 12. 後方互換性の最終確認
  - [x] 12.1 旧形式データの表示確認
    - 旧形式 participants（string[]）が正しく表示されることを確認
    - meetingEndDate が存在しない既存レコードが正しく表示されることを確認
    - meetingDate が存在しない既存レコードで createdAt にフォールバックすることを確認
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 12.2 統合テストの作成
    - 新形式データと旧形式データの混在表示テスト
    - アップロード→保存→一覧表示の一連のフローテスト
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 13. 最終チェックポイント - すべてのテストが通ることを確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## Notes

- タスクに `*` が付いているものはオプションであり、MVP実装時にはスキップ可能
- 各タスクは特定の要件を参照しており、トレーサビリティを確保
- チェックポイントで段階的に動作確認を行う
- プロパティベーステストは fast-check ライブラリを使用（要インストール）
- 既存の DynamicInputList コンポーネントは論点入力用としてそのまま維持し、参加者入力は MetadataForm 内に直接実装する
