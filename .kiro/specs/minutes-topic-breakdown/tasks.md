# Implementation Plan

- [x] 1. データモデルとTypeScript型定義を追加




  - Topic型を定義し、Minutes型を拡張する
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 1.1 Topic型を定義


  - `frontend/types/index.ts`に`Topic`インターフェースを追加
  - `id`, `title`, `description`, `order`フィールドを定義
  - _Requirements: 1.3, 1.4_


- [x] 1.2 Minutes型を拡張

  - `frontend/types/index.ts`の`Minutes`インターフェースに`topics`フィールドを追加
  - オプショナルフィールドとして定義（後方互換性）
  - _Requirements: 1.2_

- [x] 2. バックエンド - 議事録生成時のトピック抽出





  - Minutes Generator Lambdaを更新してトピック別詳細を生成する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3_

- [x] 2.1 プロンプトを拡張


  - `src/lambdas/minutes-generator/index.ts`のプロンプトにトピック抽出指示を追加
  - JSON出力形式に`topics`配列を含める
  - トピック数を2-6個に制限する指示を追加
  - _Requirements: 2.1, 2.2, 2.4, 6.1_

- [x] 2.2 Bedrockレスポンスのパース処理を更新


  - JSONレスポンスから`topics`配列を抽出
  - 各トピックに`id`と`order`を自動生成
  - エラーハンドリング（JSONパース失敗時のフォールバック）
  - _Requirements: 2.1, 6.4, 6.5_

- [x] 2.3 DynamoDBへの保存処理を更新


  - `topics`フィールドをDynamoDBに保存
  - `MeetingJobRepository`の`updateJob`メソッドで対応
  - _Requirements: 2.1_

- [x] 2.4 Markdown生成を更新


  - `generateMarkdown`関数を更新してトピック別詳細を含める
  - 「全体概要」と「トピック別詳細」のセクションを追加
  - 各トピックを見出しとして表示
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3. バックエンド - 議事録更新時のトピック編集





  - Update Minutes Lambdaを更新してトピックの編集を可能にする
  - _Requirements: 3.1, 3.5_


- [x] 3.1 更新可能フィールドに`topics`を追加

  - `src/lambdas/update-minutes/index.ts`の`allowedFields`に`topics`を追加
  - トピック配列の検証処理を追加
  - _Requirements: 3.1, 3.5_

- [x] 3.2 Markdown再生成処理を更新


  - 更新後のトピック情報を含めてMarkdownを再生成
  - S3に保存
  - _Requirements: 4.1, 4.5_

- [x] 4. フロントエンド - TopicListコンポーネント




  - トピック一覧を表示するコンポーネントを作成する
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.4_

- [x] 4.1 TopicListコンポーネントを作成


  - `frontend/components/topic-list.tsx`を作成
  - トピックを視覚的に区別できるデザイン（背景色、ボーダー）
  - 各トピックに番号、タイトル、説明を表示
  - レスポンシブデザイン対応
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.4_

- [x] 5. フロントエンド - TopicEditorコンポーネント





  - トピックを編集するコンポーネントを作成する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.5_

- [x] 5.1 TopicEditorコンポーネントを作成


  - `frontend/components/topic-editor.tsx`を作成
  - トピックのタイトルと説明を編集可能にする
  - 各トピックに編集フィールドを表示
  - _Requirements: 3.1_


- [x] 5.2 トピック追加機能を実装

  - 「トピックを追加」ボタンを実装
  - 新しいトピックに一意のIDを生成
  - _Requirements: 3.2_


- [x] 5.3 トピック削除機能を実装

  - 各トピックに削除ボタンを追加
  - 削除確認なしで即座に削除
  - _Requirements: 3.3_


- [x] 5.4 トピック並び替え機能を実装

  - 上下移動ボタンを追加
  - `order`フィールドを更新
  - 最初/最後のトピックでボタンを無効化
  - _Requirements: 3.4_

- [x] 6. フロントエンド - 議事録画面への統合





  - 既存の議事録画面にトピック表示機能を統合する
  - _Requirements: 1.1, 1.2, 1.5, 3.1, 3.5_


- [x] 6.1 概要セクションのUIを更新

  - `frontend/app/jobs/[jobId]/minutes/page.tsx`を更新
  - 「全体概要」と「トピック別詳細」のサブセクションを追加
  - 見出しを追加してセクションを明確に区別
  - _Requirements: 1.1, 1.2, 1.5_

- [x] 6.2 閲覧モードでTopicListを表示

  - `minutes.topics`が存在する場合にTopicListを表示
  - 存在しない場合は全体概要のみ表示（後方互換性）
  - _Requirements: 1.2, 6.5_


- [x] 6.3 編集モードでTopicEditorを表示










  - 編集モード時にTopicEditorを表示
  - `editedTopics`状態を追加
  - トピックの初期値を設定
  - _Requirements: 3.1_


- [x] 6.4 保存処理を更新





  - `handleConfirmSave`関数を更新して`topics`を含める
  - `apiService.updateMinutes`に`topics`を渡す
  - _Requirements: 3.5_

- [x] 7. デプロイと動作確認




  - 実装した機能をデプロイし、動作を確認する
  - _Requirements: All_

- [x] 7.1 バックエンドをデプロイ


  - CDKでLambda関数をデプロイ
  - CloudWatch Logsでトピック生成を確認
  - _Requirements: 2.1, 2.2, 6.4_

- [x] 7.2 フロントエンドをデプロイ


  - Amplifyまたは手動でデプロイ
  - 各デバイスで表示を確認
  - _Requirements: 5.1, 5.2_

- [x] 7.3 統合テストを実施


  - 新しい議事録を生成してトピックが表示されることを確認
  - トピックの編集・保存が正常に動作することを確認
  - Markdownダウンロードにトピックが含まれることを確認
  - 既存の議事録（topicsなし）が正常に表示されることを確認
  - _Requirements: All_
