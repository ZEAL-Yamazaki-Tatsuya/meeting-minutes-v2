# Implementation Plan

- [x] 1. バックエンドAPI実装





  - Lambda関数とAPI Gatewayエンドポイントを作成し、Bedrockを使用してチャット機能を実装する
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4_

- [x] 1.1 Chat Handler Lambda関数を作成


  - `src/lambdas/chat-handler/index.ts`を作成
  - リクエストボディから`message`, `context`, `history`を取得
  - 入力検証（質問の長さ、コンテキストのサイズ）
  - _Requirements: 2.1, 4.3_

- [x] 1.2 プロンプト構築ロジックを実装


  - システムプロンプトに議事録コンテキストを含める
  - 決定事項とネクストアクションをフォーマット
  - 文字起こし全文を最初の5,000文字に制限
  - _Requirements: 2.2_

- [x] 1.3 Bedrock呼び出しを実装


  - 既存の`BedrockClient`を使用
  - 会話履歴を含めてBedrockに送信
  - レスポンスを整形して返す
  - _Requirements: 2.3, 2.4_

- [x] 1.4 エラーハンドリングを実装


  - Bedrockエラーのキャッチと適切なエラーメッセージ
  - タイムアウト処理（30秒）
  - ログ記録
  - _Requirements: 4.1, 4.3, 4.5_

- [x] 1.5 API Gatewayエンドポイントを追加


  - `lib/compute-stack.ts`に`POST /api/jobs/{jobId}/chat`を追加
  - Cognito認証を有効化
  - CORSプリフライトを設定
  - _Requirements: 1.1, 6.4_

- [x] 2. フロントエンドUI実装




  - チャットコンポーネントを作成し、議事録画面に統合する
  - _Requirements: 1.2, 1.3, 1.4, 5.1, 5.2_

- [x] 2.1 ChatButtonコンポーネントを作成


  - `frontend/components/chat-button.tsx`を作成
  - 固定位置（右下）に配置
  - クリックでチャットモーダルを開く
  - _Requirements: 1.1, 1.2_

- [x] 2.2 ChatModalコンポーネントを作成


  - `frontend/components/chat-modal.tsx`を作成
  - モーダルウィンドウのレイアウト
  - 閉じるボタン
  - レスポンシブデザイン（デスクトップ/モバイル）
  - _Requirements: 1.2, 1.4, 5.1, 5.2_

- [x] 2.3 ChatMessageコンポーネントを作成


  - `frontend/components/chat-message.tsx`を作成
  - ユーザーメッセージとAIメッセージのスタイル分け
  - タイムスタンプ表示
  - Markdown対応
  - _Requirements: 2.4_

- [x] 2.4 ChatInputコンポーネントを作成


  - `frontend/components/chat-input.tsx`を作成
  - テキストエリアと送信ボタン
  - Enterキーで送信（Shift+Enterで改行）
  - 文字数制限（1,000文字）
  - _Requirements: 1.3, 6.1_

- [x] 2.5 会話履歴管理を実装


  - `useState`で会話履歴を管理
  - 最大10件に制限
  - 会話履歴クリアボタン
  - _Requirements: 3.1, 3.3, 3.4, 3.5_

- [x] 2.6 API呼び出しロジックを実装


  - `frontend/lib/api-service.ts`に`sendChatMessage`メソッドを追加
  - ローディング状態の管理
  - エラーハンドリング
  - _Requirements: 2.1, 2.5, 4.1, 4.2_

- [x] 2.7 議事録画面にチャット機能を統合


  - `frontend/app/jobs/[jobId]/minutes/page.tsx`を更新
  - ChatButtonを追加
  - 議事録コンテキストをChatModalに渡す
  - _Requirements: 1.1, 2.2_

- [x] 3. エラーハンドリングとUX改善





  - エラー処理とユーザー体験を向上させる
  - _Requirements: 4.1, 4.2, 4.4, 5.3, 5.4, 5.5_


- [x] 3.1 ローディングインジケーターを実装

  - タイピングインジケーター（3つの点）
  - 送信ボタンの無効化
  - _Requirements: 2.5_

- [x] 3.2 エラーメッセージ表示を実装


  - ネットワークエラー時の再試行ボタン
  - タイムアウトエラーメッセージ
  - 一般的なエラーメッセージ
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 3.3 スクロール位置の自動調整を実装


  - 新しいメッセージが追加されたら最下部にスクロール
  - スムーズスクロール
  - _Requirements: 5.5_

- [x] 3.4 モバイル対応を実装


  - 全画面モーダル
  - タッチ操作の最適化
  - 仮想キーボード対応
  - _Requirements: 5.2, 5.3, 5.4_

- [x] 4. デプロイと動作確認





  - 実装した機能をデプロイし、動作を確認する
  - _Requirements: All_


- [x] 4.1 バックエンドをデプロイ

  - CDKでLambda関数とAPI Gatewayをデプロイ
  - CloudWatch Logsで動作確認
  - _Requirements: 6.3, 6.4, 6.5_

- [x] 4.2 フロントエンドをデプロイ


  - Amplifyまたは手動でデプロイ
  - 各デバイスで動作確認
  - _Requirements: 5.1, 5.2_


- [x] 4.3 統合テストを実施

  - チャット機能の動作確認
  - エラーケースのテスト
  - レスポンス時間の確認
  - _Requirements: All_
