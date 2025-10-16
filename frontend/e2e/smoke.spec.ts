import { test, expect } from '@playwright/test';

/**
 * スモークテスト
 * 基本的な機能が動作することを確認する最小限のテスト
 */

test.describe('スモークテスト', () => {
  test('ホームページが正しく表示される', async ({ page }) => {
    await page.goto('/');
    
    // ページタイトルまたはメインコンテンツが表示されることを確認
    await expect(page.locator('h1')).toBeVisible();
  });

  test('アップロードページにアクセスできる（認証あり）', async ({ page }) => {
    // 認証トークンをモック（有効期限を未来に設定）
    await page.goto('/');
    
    const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1時間後
    const mockIdToken = `header.${btoa(JSON.stringify({
      sub: 'test-user-123',
      email: 'test@example.com',
      exp: futureTimestamp
    }))}.signature`;
    
    await page.evaluate((token) => {
      localStorage.setItem('cognito_id_token', token);
      localStorage.setItem('cognito_access_token', token);
      localStorage.setItem('cognito_refresh_token', token);
      localStorage.setItem('cognito_user', JSON.stringify({ 
        email: 'test@example.com',
        userId: 'test-user-123'
      }));
    }, mockIdToken);
    
    await page.goto('/upload');
    
    // ページが読み込まれることを確認（タイムアウトを長めに設定）
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });

  test('ジョブ一覧ページにアクセスできる（認証あり）', async ({ page }) => {
    // 認証トークンをモック（有効期限を未来に設定）
    await page.goto('/');
    
    const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1時間後
    const mockIdToken = `header.${btoa(JSON.stringify({
      sub: 'test-user-123',
      email: 'test@example.com',
      exp: futureTimestamp
    }))}.signature`;
    
    await page.evaluate((token) => {
      localStorage.setItem('cognito_id_token', token);
      localStorage.setItem('cognito_access_token', token);
      localStorage.setItem('cognito_refresh_token', token);
      localStorage.setItem('cognito_user', JSON.stringify({ 
        email: 'test@example.com',
        userId: 'test-user-123'
      }));
    }, mockIdToken);
    
    await page.goto('/jobs');
    
    // ページが読み込まれることを確認（タイムアウトを長めに設定）
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });

  test('未認証ユーザーはサインインページにリダイレクトされる', async ({ page }) => {
    // ローカルストレージをクリア
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    
    // 保護されたページにアクセス
    await page.goto('/upload');
    
    // サインインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 10000 });
  });
});
