# Implementation Plan

- [x] 1. DynamoDB スキーマ拡張とデータマイグレーション




  - MeetingJobs テーブルに summaryPreview フィールドを追加し、既存データをマイグレーション
  - _Requirements: 1.3_

- [x] 1.1 Minutes Generator Lambda を更新して summaryPreview を保存



  - 議事録生成時に概要の最初の200文字を抽出
  - DynamoDB に summaryPreview フィールドを保存
  - _Requirements: 1.3_

- [x] 1.2 既存議事録の summaryPreview をバッチ処理で追加






  - S3 から既存の議事録を取得
  - 概要の最初の200文字を抽出
  - DynamoDB を更新
  - _Requirements: 1.3_

- [x] 2. バックエンド API 実装 - 議事録一覧取得




  - List Minutes Lambda を実装し、ページネーションとフィルター機能を提供
  - _Requirements: 1.2, 1.3, 1.5, 2.3, 2.5, 11.3_

- [x] 2.1 List Minutes Lambda 関数を作成


  - `src/lambdas/list-minutes/index.ts` を作成
  - リクエストパラメータの検証（userId, page, limit, filters）
  - DynamoDB GSI `userId-createdAt-index` を使用したクエリ
  - _Requirements: 1.2, 11.3_

- [x] 2.2 ページネーション処理を実装

  - page と limit パラメータに基づいてデータを取得
  - 総ページ数を計算
  - レスポンスに pagination 情報を含める
  - _Requirements: 1.5_

- [x] 2.3 フィルター機能を実装

  - 日付範囲フィルター（startDate, endDate）
  - 会議名フィルター（部分一致）
  - DynamoDB の FilterExpression を使用
  - _Requirements: 2.3, 2.5_

- [x] 2.4 API Gateway エンドポイントを追加


  - `lib/compute-stack.ts` に `GET /api/minutes` を追加
  - Cognito 認証を有効化
  - CORS 設定
  - _Requirements: 11.2_

- [ ]* 2.5 Property test for 議事録リストのソート順
  - **Property 1: 議事録リストのソート順**
  - **Validates: Requirements 1.2, 2.5**

- [ ]* 2.6 Property test for 議事録表示内容の完全性
  - **Property 2: 議事録表示内容の完全性**
  - **Validates: Requirements 1.3**

- [ ]* 2.7 Property test for ページネーションの正確性
  - **Property 3: ページネーションの正確性**
  - **Validates: Requirements 1.5**

- [ ]* 2.8 Property test for フィルター適用の正確性
  - **Property 4: フィルター適用の正確性**
  - **Validates: Requirements 2.3**

- [ ]* 2.9 Property test for ユーザー分離の保証
  - **Property 5: ユーザー分離の保証**
  - **Validates: Requirements 3.4, 11.3, 11.4**

- [x] 3. バックエンド API 実装 - AI 検索



  - Search Minutes Lambda を実装し、Bedrock を使用した意味検索を提供
  - _Requirements: 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.4, 5.5, 6.1, 6.3, 6.4, 9.1_


- [x] 3.1 Search Minutes Lambda 関数を作成

  - `src/lambdas/search-minutes/index.ts` を作成
  - リクエストボディの検証（userId, query, history）
  - DynamoDB から該当ユーザーの議事録メタデータを取得（最大100件）
  - _Requirements: 3.4, 9.1, 11.4_


- [x] 3.2 S3 から議事録内容を並列取得
  - 各議事録の S3 キーを取得
  - Promise.all を使用して並列取得
  - エラーハンドリング
  - _Requirements: 5.2_


- [x] 3.3 Bedrock プロンプト構築ロジックを実装
  - システムプロンプトに全議事録の情報を含める
  - 会話履歴を含める（最大5件）
  - JSON 形式のレスポンスを要求
  - _Requirements: 4.1, 4.2, 5.2, 6.1, 6.3_


- [x] 3.4 Bedrock 呼び出しと結果パースを実装
  - Bedrock API を呼び出し
  - JSON レスポンスをパース
  - 関連度スコアでソート
  - 最大5件に制限
  - _Requirements: 4.1, 4.3_


- [x] 3.5 会話履歴管理を実装
  - 会話履歴を最大5件まで保持
  - 5件を超えた場合は古い会話から削除
  - _Requirements: 6.1, 6.3, 6.4_


- [x] 3.6 エラーハンドリングを実装
  - Bedrock エラーのキャッチ
  - タイムアウト処理（60秒）
  - エラー時も会話履歴を保持
  - _Requirements: 7.1, 7.3, 7.4, 7.5_

- [x] 3.7 API Gateway エンドポイントを追加



  - `lib/compute-stack.ts` に `POST /api/minutes/search` を追加
  - Cognito 認証を有効化
  - CORS 設定
  - タイムアウト60秒
  - _Requirements: 11.2_

- [ ]* 3.8 Property test for 検索結果の形式
  - **Property 6: 検索結果の形式**
  - **Validates: Requirements 4.1, 4.2, 4.5, 5.5**

- [ ]* 3.9 Property test for 検索結果の件数制限
  - **Property 7: 検索結果の件数制限**
  - **Validates: Requirements 4.3**

- [ ]* 3.10 Property test for 検索対象の範囲
  - **Property 8: 検索対象の範囲**
  - **Validates: Requirements 5.2**

- [ ]* 3.11 Property test for 会話履歴の保持
  - **Property 9: 会話履歴の保持**
  - **Validates: Requirements 6.1, 6.3, 6.4**

- [ ]* 3.12 Property test for エラー時の状態保持
  - **Property 10: エラー時の状態保持**
  - **Validates: Requirements 7.4**

- [ ]* 3.13 Property test for 検索対象議事録数の制限
  - **Property 12: 検索対象議事録数の制限**
  - **Validates: Requirements 9.1**

- [ ]* 3.14 Property test for API ログの記録
  - **Property 13: API ログの記録**
  - **Validates: Requirements 9.3**

- [x] 4. Checkpoint - バックエンドテスト




  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. フロントエンド実装 - 議事録一覧ページ




  - 議事録一覧ページを作成し、ページネーションとフィルター機能を実装
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 10.5_

- [x] 5.1 議事録一覧ページを作成


  - `frontend/app/minutes/page.tsx` を作成
  - ページレイアウトとナビゲーション
  - _Requirements: 1.1_

- [x] 5.2 MinutesListItem コンポーネントを作成


  - `frontend/components/minutes-list-item.tsx` を作成
  - 会議名、作成日時、概要プレビューを表示
  - クリックで議事録詳細画面に遷移
  - _Requirements: 1.3, 1.4_

- [x] 5.3 ページネーションコンポーネントを実装


  - ページ番号表示
  - 前へ/次へボタン
  - ページ番号クリックで遷移
  - _Requirements: 1.5_

- [x] 5.4 MinutesFilter コンポーネントを作成


  - `frontend/components/minutes-filter.tsx` を作成
  - 日付範囲入力フィールド
  - 会議名検索フィールド
  - フィルタークリアボタン
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 5.5 API 呼び出しロジックを実装


  - `frontend/lib/api-service.ts` に `fetchMinutes` メソッドを追加
  - クエリパラメータの構築
  - ローディング状態の管理
  - エラーハンドリング
  - _Requirements: 1.2, 2.3, 2.5_

- [x] 5.6 ローディングインジケーターを実装


  - スケルトンスクリーンまたはスピナー
  - 読み込み中の表示
  - _Requirements: 10.5_

- [x] 5.7 レスポンシブデザインを実装


  - モバイル対応のレイアウト
  - タブレット対応のレイアウト
  - _Requirements: 8.1_

- [x] 6. フロントエンド実装 - AI 検索モーダル




  - AI 検索モーダルを作成し、チャット形式の検索インターフェースを実装
  - _Requirements: 3.1, 3.2, 3.3, 4.4, 6.5, 7.1, 7.2, 8.2, 8.5_

- [x] 6.1 AISearchModal コンポーネントを作成


  - `frontend/components/ai-search-modal.tsx` を作成
  - モーダルウィンドウのレイアウト
  - 閉じるボタン
  - レスポンシブデザイン（デスクトップ/モバイル）
  - _Requirements: 3.2, 8.2_

- [x] 6.2 SearchMessage コンポーネントを作成


  - `frontend/components/search-message.tsx` を作成
  - ユーザーメッセージと AI メッセージのスタイル分け
  - 検索結果の表示（議事録リスト + 抜粋）
  - タイムスタンプ表示
  - _Requirements: 4.4_

- [x] 6.3 SearchInput コンポーネントを作成


  - `frontend/components/search-input.tsx` を作成
  - テキストエリアと送信ボタン
  - Enter キーで送信（Shift+Enter で改行）
  - 文字数制限（1,000文字）
  - _Requirements: 3.3_

- [x] 6.4 会話履歴管理を実装


  - useState で会話履歴を管理
  - 最大5件に制限
  - 会話履歴クリアボタン
  - _Requirements: 6.5_

- [x] 6.5 API 呼び出しロジックを実装


  - `frontend/lib/api-service.ts` に `searchMinutes` メソッドを追加
  - ローディング状態の管理
  - エラーハンドリング
  - _Requirements: 7.1, 7.2_

- [x] 6.6 スクロール位置の自動調整を実装

  - 新しいメッセージが追加されたら最下部にスクロール
  - スムーズスクロール
  - _Requirements: 8.5_

- [x] 6.7 議事録一覧ページに AI 検索ボタンを追加


  - 固定位置（右下）に配置
  - クリックで AI 検索モーダルを開く
  - _Requirements: 3.1_

- [ ]* 6.8 Property test for スクロール位置の自動調整
  - **Property 11: スクロール位置の自動調整**
  - **Validates: Requirements 8.5**

- [x] 7. キャッシュ機能の実装





  - フロントエンドでの議事録データキャッシュを実装
  - _Requirements: 10.3_

- [x] 7.1 キャッシュストレージを実装


  - ローカルストレージまたはメモリキャッシュ
  - キャッシュキーの生成（userId + filters）
  - キャッシュの有効期限（5分）
  - _Requirements: 10.3_

- [x] 7.2 キャッシュの読み書きロジックを実装


  - API 呼び出し前にキャッシュを確認
  - キャッシュがあれば返却
  - なければ API 呼び出し後にキャッシュに保存
  - _Requirements: 10.3_

- [ ]* 7.3 Property test for キャッシュによる高速化
  - **Property 14: キャッシュによる高速化**
  - **Validates: Requirements 10.3**

- [x] 8. Checkpoint - フロントエンドテスト






  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. 統合テストとデプロイ





  - 統合テストを実施し、本番環境にデプロイ
  - _Requirements: All_


- [x] 9.1 バックエンドをデプロイ


  - CDK で Lambda 関数と API Gateway をデプロイ
  - CloudWatch Logs で動作確認
  - _Requirements: All_


- [x] 9.2 フロントエンドをデプロイ


  - Amplify または手動でデプロイ
  - 各デバイスで動作確認
  - _Requirements: All_


- [x] 9.3 統合テストを実施

  - 議事録一覧の表示確認
  - フィルター機能の動作確認
  - AI 検索の動作確認
  - エラーケースのテスト
  - _Requirements: All_
