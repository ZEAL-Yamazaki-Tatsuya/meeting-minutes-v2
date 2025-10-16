import { FullConfig } from '@playwright/test';

/**
 * グローバルティアダウン
 * すべてのテストの後に一度だけ実行される
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 E2Eテストのグローバルティアダウンを開始します...');

  // テスト用のデータをクリーンアップ（必要に応じて）
  // 例: テストユーザーの削除、テストデータの削除など

  console.log('✅ グローバルティアダウンが完了しました');
}

export default globalTeardown;
