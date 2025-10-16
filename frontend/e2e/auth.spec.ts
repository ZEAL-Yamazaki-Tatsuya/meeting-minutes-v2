import { test, expect } from '@playwright/test';

test.describe('認証機能', () => {
  test.describe('サインアップ', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/signup');
    });

    test('サインアップページが正しく表示される', async ({ page }) => {
      // ページタイトルを確認
      await expect(page.locator('h1')).toContainText('アカウント作成');
      
      // フォームフィールドが表示されることを確認
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    });

    test('有効な情報でサインアップできる', async ({ page }) => {
      // フォームに入力
      await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
      
      // サインアップボタンをクリック
      await page.click('button[type="submit"]');
      
      // 成功メッセージまたはリダイレクトを確認
      await expect(page).toHaveURL('/');
    });

    test('無効なメールアドレスでエラーが表示される', async ({ page }) => {
      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
      
      await page.click('button[type="submit"]');
      
      // エラーメッセージを確認
      await expect(page.locator('text=有効なメールアドレスを入力してください')).toBeVisible();
    });

    test('パスワードが一致しない場合にエラーが表示される', async ({ page }) => {
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!');
      
      await page.click('button[type="submit"]');
      
      // エラーメッセージを確認
      await expect(page.locator('text=パスワードが一致しません')).toBeVisible();
    });

    test('弱いパスワードでエラーが表示される', async ({ page }) => {
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', '123');
      await page.fill('input[name="confirmPassword"]', '123');
      
      await page.click('button[type="submit"]');
      
      // エラーメッセージを確認
      await expect(page.locator('text=パスワードは8文字以上である必要があります')).toBeVisible();
    });
  });

  test.describe('サインイン', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/signin');
    });

    test('サインインページが正しく表示される', async ({ page }) => {
      // ページタイトルを確認
      await expect(page.locator('h1')).toContainText('ログイン');
      
      // フォームフィールドが表示されることを確認
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
    });

    test('有効な認証情報でサインインできる', async ({ page }) => {
      // テストユーザーでログイン
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'TestPassword123!');
      
      await page.click('button[type="submit"]');
      
      // ホームページにリダイレクトされることを確認
      await expect(page).toHaveURL('/');
      
      // ユーザーメニューが表示されることを確認
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });

    test('無効な認証情報でエラーが表示される', async ({ page }) => {
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'WrongPassword123!');
      
      await page.click('button[type="submit"]');
      
      // エラーメッセージを確認
      await expect(page.locator('text=メールアドレスまたはパスワードが正しくありません')).toBeVisible();
    });

    test('空のフィールドでエラーが表示される', async ({ page }) => {
      await page.click('button[type="submit"]');
      
      // エラーメッセージを確認
      await expect(page.locator('text=メールアドレスを入力してください')).toBeVisible();
      await expect(page.locator('text=パスワードを入力してください')).toBeVisible();
    });
  });

  test.describe('サインアウト', () => {
    test.beforeEach(async ({ page }) => {
      // ログイン
      await page.goto('/auth/signin');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
    });

    test('サインアウトできる', async ({ page }) => {
      // ユーザーメニューを開く
      await page.click('[data-testid="user-menu"]');
      
      // サインアウトボタンをクリック
      await page.click('button:has-text("ログアウト")');
      
      // サインインページにリダイレクトされることを確認
      await expect(page).toHaveURL('/auth/signin');
    });
  });

  test.describe('保護されたルート', () => {
    test('未認証ユーザーは保護されたページにアクセスできない', async ({ page }) => {
      // 直接保護されたページにアクセスを試みる
      await page.goto('/jobs');
      
      // サインインページにリダイレクトされることを確認
      await expect(page).toHaveURL('/auth/signin');
    });

    test('認証済みユーザーは保護されたページにアクセスできる', async ({ page }) => {
      // ログイン
      await page.goto('/auth/signin');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      
      // 保護されたページにアクセス
      await page.goto('/jobs');
      
      // ページが正しく表示されることを確認
      await expect(page.locator('h1')).toContainText('処理履歴');
    });
  });
});
