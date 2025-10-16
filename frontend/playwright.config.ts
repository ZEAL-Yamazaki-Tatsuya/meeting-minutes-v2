import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2Eテスト設定
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // テストディレクトリ
  testDir: './e2e',
  
  // 並列実行の設定
  fullyParallel: true,
  
  // CI環境でのリトライ設定
  retries: process.env.CI ? 2 : 0,
  
  // ワーカー数
  workers: process.env.CI ? 1 : undefined,
  
  // レポーター設定
  reporter: 'html',
  
  // グローバルセットアップ
  globalSetup: require.resolve('./e2e/global-setup'),
  
  // グローバルティアダウン
  globalTeardown: require.resolve('./e2e/global-teardown'),
  
  // 共通設定
  use: {
    // ベースURL
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    
    // トレース設定（失敗時のみ）
    trace: 'on-first-retry',
    
    // スクリーンショット設定
    screenshot: 'only-on-failure',
    
    // ビデオ設定
    video: 'retain-on-failure',
    
    // アクションタイムアウト
    actionTimeout: 10000,
    
    // ナビゲーションタイムアウト
    navigationTimeout: 30000,
  },

  // プロジェクト設定（ブラウザ）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // 開発サーバー設定
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
