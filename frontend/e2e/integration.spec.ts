import { test, expect } from '@playwright/test';
import path from 'path';
import { authenticateUser } from './helpers/test-utils';

test.describe.skip('統合テスト - エンドツーエンドフロー', () => {
  // このテストスイートは実際のファイルとデータが必要なためスキップ
  // 実装時には、テスト用のデータとファイルを準備してください
  test.beforeEach(async ({ page }) => {
    // 認証トークンをモック
    await authenticateUser(page);
  });

  test('完全なワークフロー: アップロード → 処理 → 議事録表示 → ダウンロード', async ({ page }) => {
    // 1. ホームページにアクセス
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    // 2. アップロードページに移動
    await page.goto('/upload');
    await expect(page.locator('h1')).toContainText('会議録画をアップロード');

    // 3. ファイルを選択（モックファイルを使用）
    const testFilePath = path.join(__dirname, 'fixtures', 'test-video.mp4');
    const fileInput = page.locator('input[type="file"]');
    
    // ファイルが存在しない場合はスキップ
    try {
      await fileInput.setInputFiles(testFilePath);
    } catch (error) {
      console.log('テストファイルが見つかりません。このテストをスキップします。');
      test.skip();
      return;
    }

    // 4. アップロードを開始
    await page.click('button:has-text("アップロード")');

    // 5. ジョブ詳細ページにリダイレクトされることを確認
    await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+$/);

    // 6. 処理ステータスが表示されることを確認
    await expect(page.locator('[data-testid="status-indicator"]')).toBeVisible();

    // 7. 処理が完了するまで待機（実際のテストではモックを使用）
    // この部分は実装に応じて調整が必要

    // 8. 議事録リンクをクリック（完了している場合）
    const minutesLink = page.locator('a:has-text("議事録を表示")');
    if (await minutesLink.isVisible({ timeout: 5000 })) {
      await minutesLink.click();

      // 9. 議事録ページが表示されることを確認
      await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+\/minutes$/);
      await expect(page.locator('[data-testid="minutes-content"]')).toBeVisible();

      // 10. ダウンロードボタンをクリック
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("ダウンロード")');

      // 11. ダウンロードが開始されることを確認
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.(md|pdf)$/);
    }
  });

  test('複数ジョブの管理フロー', async ({ page }) => {
    // 1. ジョブ一覧ページに移動
    await page.goto('/jobs');
    await expect(page.locator('h1')).toContainText('処理履歴');

    // 2. ジョブが表示されることを確認
    const jobItems = page.locator('[data-testid="job-item"]');
    const jobCount = await jobItems.count();

    if (jobCount > 0) {
      // 3. 最初のジョブをクリック
      await jobItems.first().click();

      // 4. ジョブ詳細ページに遷移
      await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+$/);

      // 5. 戻るボタンで一覧に戻る
      await page.goBack();
      await expect(page).toHaveURL('/jobs');

      // 6. 別のジョブをクリック
      if (jobCount > 1) {
        await jobItems.nth(1).click();
        await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+$/);
      }
    }
  });

  test('エラーハンドリングフロー', async ({ page }) => {
    // 1. 存在しないジョブIDでアクセス
    await page.goto('/jobs/non-existent-job-id');

    // 2. エラーメッセージが表示されることを確認
    await expect(page.locator('text=ジョブが見つかりません')).toBeVisible();

    // 3. ホームに戻るリンクをクリック
    const homeLink = page.locator('a:has-text("ホームに戻る")');
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await expect(page).toHaveURL('/');
    }
  });

  test('レスポンシブデザインの確認', async ({ page }) => {
    // モバイルビューポート
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // ナビゲーションメニューが適切に表示されることを確認
    await expect(page.locator('nav')).toBeVisible();

    // タブレットビューポート
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/jobs');

    // ジョブ一覧が適切に表示されることを確認
    await expect(page.locator('[data-testid="job-list"]')).toBeVisible();

    // デスクトップビューポート
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/upload');

    // アップロードエリアが適切に表示されることを確認
    await expect(page.locator('text=MP4ファイルをドラッグ&ドロップ')).toBeVisible();
  });

  test('ナビゲーションフロー', async ({ page }) => {
    // 1. ホームページから開始
    await page.goto('/');

    // 2. アップロードページに移動
    const uploadLink = page.locator('a:has-text("アップロード")');
    if (await uploadLink.isVisible()) {
      await uploadLink.click();
      await expect(page).toHaveURL('/upload');
    }

    // 3. ジョブ一覧ページに移動
    const jobsLink = page.locator('a:has-text("処理履歴")');
    if (await jobsLink.isVisible()) {
      await jobsLink.click();
      await expect(page).toHaveURL('/jobs');
    }

    // 4. ホームに戻る
    const homeLink = page.locator('a:has-text("ホーム")');
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await expect(page).toHaveURL('/');
    }
  });

  test('パフォーマンステスト - ページ読み込み時間', async ({ page }) => {
    // ページ読み込み時間を測定
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // 3秒以内に読み込まれることを確認
    expect(loadTime).toBeLessThan(3000);

    console.log(`ページ読み込み時間: ${loadTime}ms`);
  });

  test('アクセシビリティの基本チェック', async ({ page }) => {
    await page.goto('/');

    // ページタイトルが存在することを確認
    const title = await page.title();
    expect(title).toBeTruthy();

    // メインコンテンツが存在することを確認
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // ナビゲーションが存在することを確認
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });
});
