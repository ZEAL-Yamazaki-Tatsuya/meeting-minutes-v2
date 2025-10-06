# フロントエンドセットアップガイド

このドキュメントでは、Meeting Minutes Generatorのフロントエンドプロジェクトのセットアップ手順を説明します。

## 完了した作業

### 1. Next.js 14プロジェクトの作成

- App Routerを使用した最新のNext.js構成
- TypeScriptによる型安全性の確保
- Tailwind CSSによる効率的なスタイリング
- ESLintによるコード品質管理

### 2. 依存関係のインストール

以下のパッケージがインストールされています：

#### 主要な依存関係
- `next@14.2.33` - Next.jsフレームワーク
- `react@18` - Reactライブラリ
- `typescript@5` - TypeScript
- `tailwindcss@3.4.1` - CSSフレームワーク

#### API通信関連
- `axios@1.12.2` - HTTP通信ライブラリ
- `@tanstack/react-query@5.90.2` - サーバーステート管理

#### UI関連
- `react-hot-toast@2.6.0` - トースト通知
- `clsx@2.1.1` - クラス名の条件付き結合
- `tailwind-merge@3.3.1` - Tailwindクラスのマージ

### 3. プロジェクト構造

```
frontend/
├── app/                      # Next.js App Router
│   ├── layout.tsx           # ルートレイアウト（プロバイダー設定済み）
│   ├── page.tsx             # ホームページ
│   └── globals.css          # グローバルスタイル
├── lib/                     # ライブラリとユーティリティ
│   ├── api-client.ts        # Axiosクライアント（インターセプター設定済み）
│   ├── api-service.ts       # APIサービスクラス（全エンドポイント実装済み）
│   ├── config.ts            # アプリケーション設定
│   ├── query-provider.tsx   # React Queryプロバイダー
│   ├── toast-provider.tsx   # Toastプロバイダー
│   └── utils.ts             # ユーティリティ関数
├── types/                   # TypeScript型定義
│   └── index.ts             # 共通型定義（Job, Minutes, etc.）
├── .env.local              # 環境変数（ローカル開発用）
├── .env.example            # 環境変数のサンプル
├── package.json            # 依存関係
├── tsconfig.json           # TypeScript設定
├── tailwind.config.ts      # Tailwind CSS設定
├── next.config.mjs         # Next.js設定
└── README.md               # プロジェクトドキュメント
```

### 4. API通信の設定

#### APIクライアント (`lib/api-client.ts`)
- Axiosインスタンスの作成
- リクエスト/レスポンスインターセプターの設定
- エラーハンドリングの実装
- 将来的な認証トークン追加の準備

#### APIサービス (`lib/api-service.ts`)
以下のメソッドが実装されています：
- `getUploadUrl()` - アップロード用Presigned URL取得
- `uploadFileToS3()` - S3への直接アップロード（進捗表示対応）
- `getJobStatus()` - ジョブステータス取得
- `listJobs()` - ジョブ一覧取得（ページネーション対応）
- `getMinutes()` - 議事録取得
- `getDownloadUrl()` - ダウンロードURL取得
- `updateMinutes()` - 議事録更新

### 5. 型定義

`types/index.ts`に以下の型が定義されています：
- `JobStatus` - ジョブステータスの型
- `Job` - ジョブ情報の型
- `Minutes` - 議事録の型
- `Decision` - 決定事項の型
- `NextAction` - ネクストアクションの型
- `Speaker` - 話者情報の型
- `UploadResponse` - アップロードレスポンスの型
- `JobListResponse` - ジョブ一覧レスポンスの型
- `ErrorResponse` - エラーレスポンスの型

### 6. ユーティリティ関数

`lib/utils.ts`に以下の関数が実装されています：
- `cn()` - Tailwindクラスのマージ
- `formatFileSize()` - ファイルサイズのフォーマット
- `formatDate()` - 日時のフォーマット
- `getRelativeTime()` - 相対時間の取得
- `getStatusLabel()` - ステータスの日本語変換
- `getStatusColor()` - ステータスに応じた色の取得
- `getFileExtension()` - ファイル拡張子の取得
- `validateFile()` - ファイルバリデーション
- `getErrorMessage()` - エラーメッセージの取得

### 7. 環境変数の設定

`.env.local`ファイルが作成されています：
```env
NEXT_PUBLIC_API_URL=https://your-api-gateway-url.execute-api.ap-northeast-1.amazonaws.com/prod
NEXT_PUBLIC_APP_NAME=Meeting Minutes Generator
```

**重要**: デプロイ前に`NEXT_PUBLIC_API_URL`を実際のAPI Gateway URLに更新してください。

### 8. プロバイダーの設定

`app/layout.tsx`に以下のプロバイダーが設定されています：
- `QueryProvider` - React Queryによるサーバーステート管理
- `ToastProvider` - トースト通知の表示

## 開発サーバーの起動

```bash
cd frontend
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアクセスできます。

## ビルドの確認

```bash
cd frontend
npm run build
```

ビルドが成功することを確認済みです。

## 次のステップ

以下のタスクを実装する準備が整いました：

### タスク10: ファイルアップロードUIの実装
- ドラッグ&ドロップエリアの実装
- ファイル選択ボタンの実装
- アップロード進捗バーの実装
- クライアント側のファイルバリデーション

### タスク11: ジョブ一覧・詳細UIの実装
- ジョブ一覧ページの作成
- ジョブ詳細ページの作成
- リアルタイム進捗表示（ポーリング）

### タスク12: 議事録表示・編集UIの実装
- 議事録プレビューコンポーネントの作成
- 議事録編集機能の実装
- ダウンロード機能の実装

## トラブルシューティング

### ビルドエラーが発生する場合

1. 依存関係を再インストール：
```bash
rm -rf node_modules package-lock.json
npm install
```

2. Next.jsのキャッシュをクリア：
```bash
rm -rf .next
npm run build
```

### 環境変数が読み込まれない場合

- 環境変数名が`NEXT_PUBLIC_`で始まっていることを確認
- 開発サーバーを再起動
- `.env.local`ファイルが正しい場所にあることを確認

## 参考リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Axios Documentation](https://axios-http.com/docs/intro)
