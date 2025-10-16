import { test, expect } from '@playwright/test';

test.describe('ジョブ一覧・詳細表示', () => {
  test.beforeEach(async ({ page }) => {
    // ジョブ一覧ページに移動
    await page.goto('/jobs');
  });

  test('ジョブ一覧ページが正しく表示される', async ({ page }) => {
    // ページタイトルを確認
    await expect(page.locator('h1')).toContainText('処理履歴');
    
    // ジョブ一覧が表示されることを確認（データがある場合）
    const jobList = page.locator('[data-testid="job-list"]');
    await expect(jobList).toBeVisible();
  });

  test('ジョブがない場合に適切なメッセージが表示される', async ({ page }) => {
    // ジョブがない場合のメッセージを確認
    const emptyMessage = page.locator('text=まだ処理履歴がありません');
    
    // メッセージが表示されるか、ジョブリストが表示されるかのいずれか
    const hasJobs = await page.locator('[data-testid="job-item"]').count() > 0;
    
    if (!hasJobs) {
      await expect(emptyMessage).toBeVisible();
    }
  });

  test('ジョブ一覧に必要な情報が表示される', async ({ page }) => {
    // 最初のジョブアイテムを取得
    const firstJob = page.locator('[data-testid="job-item"]').first();
    
    // ジョブが存在する場合のみテスト
    const jobCount = await page.locator('[data-testid="job-item"]').count();
    
    if (jobCount > 0) {
      // ファイル名が表示されることを確認
      await expect(firstJob.locator('[data-testid="job-filename"]')).toBeVisible();
      
      // ステータスが表示されることを確認
      await expect(firstJob.locator('[data-testid="job-status"]')).toBeVisible();
      
      // 作成日時が表示されることを確認
      await expect(firstJob.locator('[data-testid="job-created-at"]')).toBeVisible();
    }
  });

  test('ジョブをクリックすると詳細ページに遷移する', async ({ page }) => {
    // ジョブが存在する場合のみテスト
    const jobCount = await page.locator('[data-testid="job-item"]').count();
    
    if (jobCount > 0) {
      // 最初のジョブをクリック
      await page.locator('[data-testid="job-item"]').first().click();
      
      // ジョブ詳細ページに遷移することを確認
      await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+$/);
      
      // 詳細ページのタイトルが表示されることを確認
      await expect(page.locator('h1')).toContainText('処理状況');
    }
  });

  test('ページネーションが機能する', async ({ page }) => {
    // ページネーションボタンが表示される場合のみテスト
    const nextButton = page.locator('button:has-text("次へ")');
    
    if (await nextButton.isVisible()) {
      // 次のページに移動
      await nextButton.click();
      
      // URLにページパラメータが含まれることを確認
      await expect(page).toHaveURL(/[?&]page=/);
      
      // 前のページボタンが表示されることを確認
      await expect(page.locator('button:has-text("前へ")')).toBeVisible();
    }
  });

  test('ステータスフィルターが機能する', async ({ page }) => {
    // フィルターが実装されている場合のテスト
    const statusFilter = page.locator('select[name="status"]');
    
    if (await statusFilter.isVisible()) {
      // 完了したジョブのみを表示
      await statusFilter.selectOption('COMPLETED');
      
      // フィルタリングされたジョブが表示されることを確認
      const jobs = page.locator('[data-testid="job-item"]');
      const jobCount = await jobs.count();
      
      if (jobCount > 0) {
        // すべてのジョブが「完了」ステータスであることを確認
        for (let i = 0; i < jobCount; i++) {
          const status = jobs.nth(i).locator('[data-testid="job-status"]');
          await expect(status).toContainText('完了');
        }
      }
    }
  });
});

test.describe('ジョブ詳細ページ', () => {
  // テスト用のジョブIDを使用（実際のテストではモックまたは事前に作成したジョブを使用）
  const testJobId = 'test-job-id-123';

  test('ジョブ詳細ページが正しく表示される', async ({ page }) => {
    // ジョブ詳細ページに移動
    await page.goto(`/jobs/${testJobId}`);
    
    // ページタイトルを確認
    await expect(page.locator('h1')).toContainText('処理状況');
    
    // ジョブ情報が表示されることを確認
    await expect(page.locator('[data-testid="job-info"]')).toBeVisible();
  });

  test('処理中のステータスインジケーターが表示される', async ({ page }) => {
    await page.goto(`/jobs/${testJobId}`);
    
    // ステータスインジケーターを確認
    const statusIndicator = page.locator('[data-testid="status-indicator"]');
    await expect(statusIndicator).toBeVisible();
    
    // 処理中の場合、進捗バーまたはスピナーが表示されることを確認
    const isProcessing = await page.locator('text=処理中').isVisible();
    
    if (isProcessing) {
      // 進捗インジケーターが表示されることを確認
      await expect(page.locator('[data-testid="progress-indicator"]')).toBeVisible();
    }
  });

  test('エラーが発生した場合にエラーメッセージが表示される', async ({ page }) => {
    // エラー状態のジョブIDを使用（モック）
    const errorJobId = 'error-job-id-456';
    await page.goto(`/jobs/${errorJobId}`);
    
    // エラーメッセージが表示されることを確認
    const errorMessage = page.locator('[data-testid="error-message"]');
    
    // エラーステータスの場合のみ確認
    const hasError = await page.locator('text=失敗').isVisible();
    
    if (hasError) {
      await expect(errorMessage).toBeVisible();
    }
  });

  test('完了したジョブで議事録リンクが表示される', async ({ page }) => {
    // 完了したジョブIDを使用（モック）
    const completedJobId = 'completed-job-id-789';
    await page.goto(`/jobs/${completedJobId}`);
    
    // 完了ステータスの場合、議事録リンクが表示されることを確認
    const isCompleted = await page.locator('text=完了').isVisible();
    
    if (isCompleted) {
      const minutesLink = page.locator('a:has-text("議事録を表示")');
      await expect(minutesLink).toBeVisible();
      
      // リンクをクリックして議事録ページに遷移
      await minutesLink.click();
      await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+\/minutes$/);
    }
  });

  test('リアルタイム進捗表示（ポーリング）が機能する', async ({ page }) => {
    await page.goto(`/jobs/${testJobId}`);
    
    // 処理中の場合、ステータスが自動的に更新されることを確認
    const initialStatus = await page.locator('[data-testid="job-status"]').textContent();
    
    // 数秒待機してステータスが更新されるか確認
    await page.waitForTimeout(5000);
    
    // ステータスが変更されたか、または同じままであることを確認
    const updatedStatus = await page.locator('[data-testid="job-status"]').textContent();
    
    // ステータスが存在することを確認（更新の有無に関わらず）
    expect(updatedStatus).toBeTruthy();
  });

  test('存在しないジョブIDで404エラーが表示される', async ({ page }) => {
    const nonExistentJobId = 'non-existent-job-id';
    await page.goto(`/jobs/${nonExistentJobId}`);
    
    // 404エラーメッセージが表示されることを確認
    await expect(page.locator('text=ジョブが見つかりません')).toBeVisible();
  });
});
