# E2Eテスト

このディレクトリには、Playwrightを使用したフロントエンドのE2E（End-to-End）テストが含まれています。

## セットアップ

### 依存関係のインストール

```bash
npm install
```

### Playwrightブラウザのインストール

```bash
npx playwright install
```

## テストの実行

### すべてのテストを実行

```bash
npm run test:e2e
```

### UIモードでテストを実行（推奨）

```bash
npm run test:e2e:ui
```

UIモードでは、テストの実行状況を視覚的に確認でき、デバッグが容易になります。

### ヘッドモードでテストを実行（ブラウザを表示）

```bash
npm run test:e2e:headed
```

### デバッグモードでテストを実行

```bash
npm run test:e2e:debug
```

### 特定のテストファイルのみを実行

```bash
npx playwright test upload.spec.ts
```

### テストレポートを表示

```bash
npm run test:e2e:report
```

## テストファイルの構成

- `smoke.spec.ts` - スモークテスト（基本的な機能の確認）✅
- `upload.spec.ts` - ファイルアップロードフローのテスト ⚠️ (一部スキップ)
- `jobs.spec.ts` - ジョブ一覧・詳細表示のテスト ⚠️ (一部スキップ)
- `minutes.spec.ts` - 議事録表示・編集・ダウンロードのテスト ⏭️ (スキップ)
- `auth.spec.ts` - 認証機能のテスト（オプション）
- `integration.spec.ts` - 統合テスト（エンドツーエンドフロー）⏭️ (スキップ)

### テストステータスの説明

- ✅ 実装済み・実行可能
- ⚠️ 一部実装済み（実際のデータが必要なテストはスキップ）
- ⏭️ スキップ（実際のデータとファイルが必要）

### スキップされているテスト

以下のテストは、実際のファイルやデータが必要なためスキップされています：

1. **ファイルアップロード関連**
   - 実際のMP4ファイルを使用したアップロードテスト
   - ファイルバリデーションテスト

2. **ジョブ詳細ページ**
   - 実際のジョブIDを使用した詳細表示テスト
   - ステータス更新のテスト

3. **議事録ページ**
   - 議事録の表示・編集・ダウンロードテスト

4. **統合テスト**
   - エンドツーエンドのワークフローテスト

これらのテストを有効にするには、`fixtures/`ディレクトリにテスト用のファイルを配置し、テストコードの`.skip`を削除してください。

## ヘルパー関数

`helpers/test-utils.ts`には、テストで使用する共通のユーティリティ関数が含まれています：

- `authenticateUser()` - ユーザー認証
- `createTestJob()` - テスト用ジョブの作成
- `waitForToast()` - トースト通知の待機
- `mockApiResponse()` - APIレスポンスのモック
- など

## フィクスチャ

`fixtures/`ディレクトリには、テストで使用するモックファイルを配置します：

- `test-video.mp4` - テスト用のMP4ファイル
- `test-document.pdf` - テスト用の無効なファイル

## 環境変数

テストで使用する環境変数は、`.env.local`または`.env.test`で設定できます：

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## CI/CD統合

GitHub ActionsなどのCI/CD環境でテストを実行する場合は、以下のように設定します：

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e
```

## トラブルシューティング

### テストが失敗する場合

1. アプリケーションが起動していることを確認してください
2. 環境変数が正しく設定されていることを確認してください
3. スクリーンショットとビデオを確認してください（`test-results/`ディレクトリ）

### タイムアウトエラーが発生する場合

`playwright.config.ts`でタイムアウト設定を調整してください：

```typescript
use: {
  actionTimeout: 10000, // アクション単位のタイムアウト
  navigationTimeout: 30000, // ナビゲーションのタイムアウト
}
```

## ベストプラクティス

1. **テストの独立性**: 各テストは独立して実行できるようにする
2. **データ属性の使用**: `data-testid`属性を使用して要素を特定する
3. **待機の適切な使用**: `waitForSelector()`などを使用して要素の表示を待つ
4. **モックの活用**: 外部APIはモックして、テストの安定性を向上させる
5. **スクリーンショット**: 失敗時のスクリーンショットを活用してデバッグする

## 参考資料

- [Playwright公式ドキュメント](https://playwright.dev/)
- [Playwrightベストプラクティス](https://playwright.dev/docs/best-practices)
- [Next.jsとPlaywright](https://nextjs.org/docs/testing#playwright)
