import { chromium, FullConfig } from '@playwright/test';

/**
 * グローバルセットアップ
 * すべてのテストの前に一度だけ実行される
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 E2Eテストのグローバルセットアップを開始します...');

  // ブラウザを起動
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 環境変数を確認
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';
  console.log(`📍 ベースURL: ${baseURL}`);

  // アプリケーションが起動しているか確認
  try {
    await page.goto(baseURL, { timeout: 30000 });
    console.log('✅ アプリケーションが正常に起動しています');
  } catch (error) {
    console.error('❌ アプリケーションへの接続に失敗しました:', error);
    throw error;
  }

  // テスト用のデータをセットアップ（必要に応じて）
  // 例: テストユーザーの作成、テストデータの投入など

  await browser.close();
  console.log('✅ グローバルセットアップが完了しました');
}

export default globalSetup;
