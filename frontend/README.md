# Meeting Minutes Generator - Frontend

MP4ファイルから自動的に議事録を生成するWebアプリケーションのフロントエンド部分です。

## 技術スタック

- **Next.js 14** (App Router)
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **React Query** (@tanstack/react-query) - サーバーステート管理
- **Axios** - HTTP通信
- **React Hot Toast** - トースト通知

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```env
NEXT_PUBLIC_API_URL=https://your-api-gateway-url.execute-api.ap-northeast-1.amazonaws.com/prod
NEXT_PUBLIC_APP_NAME=Meeting Minutes Generator
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションにアクセスできます。

## プロジェクト構造

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # ルートレイアウト
│   └── page.tsx           # ホームページ
├── lib/                   # ライブラリとユーティリティ
│   ├── api-client.ts      # Axiosクライアント設定
│   ├── api-service.ts     # APIサービスクラス
│   ├── config.ts          # アプリケーション設定
│   ├── query-provider.tsx # React Queryプロバイダー
│   ├── toast-provider.tsx # Toastプロバイダー
│   └── utils.ts           # ユーティリティ関数
├── types/                 # TypeScript型定義
│   └── index.ts           # 共通型定義
├── components/            # Reactコンポーネント（今後追加）
├── .env.local            # 環境変数（ローカル）
├── .env.example          # 環境変数のサンプル
└── package.json          # 依存関係

```

## 主要機能

### API通信

`lib/api-service.ts`にすべてのAPI通信ロジックが実装されています：

- `getUploadUrl()` - アップロード用Presigned URL取得
- `uploadFileToS3()` - S3への直接アップロード
- `getJobStatus()` - ジョブステータス取得
- `listJobs()` - ジョブ一覧取得
- `getMinutes()` - 議事録取得
- `getDownloadUrl()` - ダウンロードURL取得
- `updateMinutes()` - 議事録更新

### 型定義

`types/index.ts`にすべての型定義があります：

- `Job` - ジョブ情報
- `JobStatus` - ジョブステータス
- `Minutes` - 議事録
- `Decision` - 決定事項
- `NextAction` - ネクストアクション

### ユーティリティ関数

`lib/utils.ts`に便利な関数が実装されています：

- `formatFileSize()` - ファイルサイズのフォーマット
- `formatDate()` - 日時のフォーマット
- `getStatusLabel()` - ステータスの日本語変換
- `validateFile()` - ファイルバリデーション
- `getErrorMessage()` - エラーメッセージ取得

## 開発ガイドライン

### コーディング規約

- すべてのコンポーネントはTypeScriptで記述
- コメントは日本語で記述
- 関数にはJSDocコメントを追加
- Tailwind CSSを使用したスタイリング

### ディレクトリ構造

- `app/` - ページとレイアウト
- `components/` - 再利用可能なコンポーネント
- `lib/` - ライブラリとユーティリティ
- `types/` - 型定義
- `hooks/` - カスタムフック（今後追加）

## ビルドとデプロイ

### 本番ビルド

```bash
npm run build
```

### 本番サーバーの起動

```bash
npm start
```

### 静的エクスポート（オプション）

```bash
npm run build
npm run export
```

## トラブルシューティング

### API接続エラー

環境変数`NEXT_PUBLIC_API_URL`が正しく設定されているか確認してください。

### ファイルアップロードエラー

- ファイルサイズが2GB以下であることを確認
- ファイル形式がMP4であることを確認
- ネットワーク接続を確認

## ライセンス

このプロジェクトは内部使用のみを目的としています。
