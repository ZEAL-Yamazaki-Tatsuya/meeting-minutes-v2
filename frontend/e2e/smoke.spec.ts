import { test, expect } from '@playwright/test';

/**
 * スモークテスト
 * 基本的な機能が動作することを確認する最小限のテスト
 */

test.describe('スモークテスト', () => {
  test('ホームページが正しく表示される', async ({ page }) => {
    await page.goto('/');
    
    // ページが読み込まれることを確認
    await expect(page).toHaveTitle(/Meeting Minutes Generator/i);
    
    // メインコンテンツが表示されることを確認
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('アップロードページにアクセスできる', async ({ page }) => {
    await page.goto('/upload');
    
    // ページが読み込まれることを確認
    await expect(page.locator('h1')).toBeVisible();
  });

  test('ジョブ一覧ページにアクセスできる', async ({ page }) => {
    await page.goto('/jobs');
    
    // ページが読み込まれることを確認
    await expect(page.locator('h1')).toBeVisible();
  });

  test('404ページが正しく表示される', async ({ page }) => {
    await page.goto('/non-existent-page');
    
    // 404ページまたはエラーメッセージが表示されることを確認
    const response = await page.waitForResponse(response => 
      response.url().includes('/non-existent-page')
    );
    
    // ステータスコードが404であることを確認
    expect(response.status()).toBe(404);
  });
});
