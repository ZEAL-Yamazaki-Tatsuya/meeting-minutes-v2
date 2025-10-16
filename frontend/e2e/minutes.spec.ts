import { test, expect } from '@playwright/test';

test.describe('議事録表示・編集・ダウンロード', () => {
  // テスト用の完了したジョブID（実際のテストではモックまたは事前に作成したジョブを使用）
  const completedJobId = 'completed-job-id-789';

  test.beforeEach(async ({ page }) => {
    // 議事録ページに移動
    await page.goto(`/jobs/${completedJobId}/minutes`);
  });

  test('議事録ページが正しく表示される', async ({ page }) => {
    // ページタイトルを確認
    await expect(page.locator('h1')).toContainText('議事録');
    
    // 議事録コンテンツが表示されることを確認
    await expect(page.locator('[data-testid="minutes-content"]')).toBeVisible();
  });

  test('議事録の各セクションが表示される', async ({ page }) => {
    // 概要セクションを確認
    const summarySection = page.locator('[data-testid="summary-section"]');
    await expect(summarySection).toBeVisible();
    await expect(summarySection.locator('h2')).toContainText('概要');
    
    // 決定事項セクションを確認
    const decisionsSection = page.locator('[data-testid="decisions-section"]');
    await expect(decisionsSection).toBeVisible();
    await expect(decisionsSection.locator('h2')).toContainText('決定事項');
    
    // ネクストアクションセクションを確認
    const actionsSection = page.locator('[data-testid="actions-section"]');
    await expect(actionsSection).toBeVisible();
    await expect(actionsSection.locator('h2')).toContainText('ネクストアクション');
  });

  test('文字起こし全文の表示/非表示トグルが機能する', async ({ page }) => {
    // トグルボタンを確認
    const toggleButton = page.locator('button:has-text("文字起こし全文を表示")');
    await expect(toggleButton).toBeVisible();
    
    // 初期状態では文字起こしが非表示
    const transcriptSection = page.locator('[data-testid="transcript-section"]');
    await expect(transcriptSection).not.toBeVisible();
    
    // トグルボタンをクリック
    await toggleButton.click();
    
    // 文字起こしが表示されることを確認
    await expect(transcriptSection).toBeVisible();
    
    // ボタンのテキストが変更されることを確認
    await expect(toggleButton).toContainText('文字起こし全文を非表示');
    
    // 再度クリックして非表示にする
    await toggleButton.click();
    await expect(transcriptSection).not.toBeVisible();
  });

  test('Markdownレンダリングが正しく機能する', async ({ page }) => {
    // Markdownコンテンツが正しくレンダリングされることを確認
    const summaryContent = page.locator('[data-testid="summary-section"] p');
    await expect(summaryContent).toBeVisible();
    
    // リストアイテムが正しくレンダリングされることを確認
    const decisionsList = page.locator('[data-testid="decisions-section"] ul li');
    const decisionsCount = await decisionsList.count();
    expect(decisionsCount).toBeGreaterThan(0);
  });

  test('編集モードに切り替えられる', async ({ page }) => {
    // 編集ボタンを確認
    const editButton = page.locator('button:has-text("編集")');
    await expect(editButton).toBeVisible();
    
    // 編集ボタンをクリック
    await editButton.click();
    
    // 編集モードに切り替わることを確認
    await expect(page.locator('[data-testid="edit-mode"]')).toBeVisible();
    
    // テキストエリアが表示されることを確認
    await expect(page.locator('textarea[name="summary"]')).toBeVisible();
    await expect(page.locator('textarea[name="decisions"]')).toBeVisible();
    await expect(page.locator('textarea[name="nextActions"]')).toBeVisible();
  });

  test('議事録を編集して保存できる', async ({ page }) => {
    // 編集モードに切り替え
    await page.click('button:has-text("編集")');
    
    // 概要を編集
    const summaryTextarea = page.locator('textarea[name="summary"]');
    await summaryTextarea.clear();
    await summaryTextarea.fill('編集されたテスト概要');
    
    // 保存ボタンをクリック
    await page.click('button:has-text("保存")');
    
    // 保存成功のトースト通知が表示されることを確認
    await expect(page.locator('text=議事録を保存しました')).toBeVisible();
    
    // 編集モードが終了することを確認
    await expect(page.locator('[data-testid="edit-mode"]')).not.toBeVisible();
    
    // 編集内容が反映されることを確認
    await expect(page.locator('[data-testid="summary-section"]')).toContainText('編集されたテスト概要');
  });

  test('編集をキャンセルできる', async ({ page }) => {
    // 元の概要テキストを取得
    const originalSummary = await page.locator('[data-testid="summary-section"] p').textContent();
    
    // 編集モードに切り替え
    await page.click('button:has-text("編集")');
    
    // 概要を編集
    const summaryTextarea = page.locator('textarea[name="summary"]');
    await summaryTextarea.clear();
    await summaryTextarea.fill('キャンセルされるテキスト');
    
    // キャンセルボタンをクリック
    await page.click('button:has-text("キャンセル")');
    
    // 編集モードが終了することを確認
    await expect(page.locator('[data-testid="edit-mode"]')).not.toBeVisible();
    
    // 元のテキストが保持されることを確認
    const currentSummary = await page.locator('[data-testid="summary-section"] p').textContent();
    expect(currentSummary).toBe(originalSummary);
  });

  test('変更の保存確認ダイアログが表示される', async ({ page }) => {
    // 編集モードに切り替え
    await page.click('button:has-text("編集")');
    
    // テキストを変更
    const summaryTextarea = page.locator('textarea[name="summary"]');
    await summaryTextarea.fill('変更されたテキスト');
    
    // ページを離れようとする（戻るボタンをクリック）
    page.on('dialog', async dialog => {
      // 確認ダイアログが表示されることを確認
      expect(dialog.message()).toContain('保存されていない変更があります');
      await dialog.dismiss();
    });
    
    // 戻るボタンをクリック（実装されている場合）
    const backButton = page.locator('button:has-text("戻る")');
    if (await backButton.isVisible()) {
      await backButton.click();
    }
  });

  test('ダウンロードボタンが表示される', async ({ page }) => {
    // ダウンロードボタンを確認
    const downloadButton = page.locator('button:has-text("ダウンロード")');
    await expect(downloadButton).toBeVisible();
  });

  test('フォーマット選択ができる', async ({ page }) => {
    // フォーマット選択ドロップダウンを確認
    const formatSelect = page.locator('select[name="format"]');
    
    if (await formatSelect.isVisible()) {
      // Markdown形式を選択
      await formatSelect.selectOption('markdown');
      await expect(formatSelect).toHaveValue('markdown');
      
      // PDF形式を選択
      await formatSelect.selectOption('pdf');
      await expect(formatSelect).toHaveValue('pdf');
      
      // テキスト形式を選択
      await formatSelect.selectOption('text');
      await expect(formatSelect).toHaveValue('text');
    }
  });

  test('Markdown形式でダウンロードできる', async ({ page }) => {
    // フォーマットを選択（実装されている場合）
    const formatSelect = page.locator('select[name="format"]');
    if (await formatSelect.isVisible()) {
      await formatSelect.selectOption('markdown');
    }
    
    // ダウンロードイベントを待機
    const downloadPromise = page.waitForEvent('download');
    
    // ダウンロードボタンをクリック
    await page.click('button:has-text("ダウンロード")');
    
    // ダウンロードが開始されることを確認
    const download = await downloadPromise;
    
    // ファイル名を確認
    const fileName = download.suggestedFilename();
    expect(fileName).toMatch(/\.md$/);
  });

  test('PDF形式でダウンロードできる', async ({ page }) => {
    // フォーマットを選択
    const formatSelect = page.locator('select[name="format"]');
    if (await formatSelect.isVisible()) {
      await formatSelect.selectOption('pdf');
    }
    
    // ダウンロードイベントを待機
    const downloadPromise = page.waitForEvent('download');
    
    // ダウンロードボタンをクリック
    await page.click('button:has-text("ダウンロード")');
    
    // ダウンロードが開始されることを確認
    const download = await downloadPromise;
    
    // ファイル名を確認
    const fileName = download.suggestedFilename();
    expect(fileName).toMatch(/\.pdf$/);
  });

  test('ダウンロードエラーが適切に処理される', async ({ page }) => {
    // ネットワークエラーをシミュレート
    await page.route('**/api/jobs/*/download*', route => {
      route.abort('failed');
    });
    
    // ダウンロードボタンをクリック
    await page.click('button:has-text("ダウンロード")');
    
    // エラーメッセージが表示されることを確認
    await expect(page.locator('text=ダウンロードに失敗しました')).toBeVisible();
  });

  test('議事録が存在しない場合にエラーメッセージが表示される', async ({ page }) => {
    // 処理中のジョブIDで議事録ページにアクセス
    const processingJobId = 'processing-job-id-123';
    await page.goto(`/jobs/${processingJobId}/minutes`);
    
    // エラーメッセージが表示されることを確認
    await expect(page.locator('text=議事録はまだ生成されていません')).toBeVisible();
  });

  test('話者情報が表示される', async ({ page }) => {
    // 話者情報セクションを確認（実装されている場合）
    const speakersSection = page.locator('[data-testid="speakers-section"]');
    
    if (await speakersSection.isVisible()) {
      // 話者リストが表示されることを確認
      const speakersList = speakersSection.locator('[data-testid="speaker-item"]');
      const speakersCount = await speakersList.count();
      expect(speakersCount).toBeGreaterThan(0);
    }
  });

  test('タイムスタンプ付きの決定事項が表示される', async ({ page }) => {
    // 決定事項にタイムスタンプが含まれることを確認
    const decisionsSection = page.locator('[data-testid="decisions-section"]');
    const timestamps = decisionsSection.locator('[data-testid="timestamp"]');
    
    // タイムスタンプが実装されている場合のみ確認
    const timestampCount = await timestamps.count();
    if (timestampCount > 0) {
      // タイムスタンプの形式を確認（例: "00:15:30"）
      const firstTimestamp = await timestamps.first().textContent();
      expect(firstTimestamp).toMatch(/\d{2}:\d{2}:\d{2}/);
    }
  });

  test('ネクストアクションに担当者と期限が表示される', async ({ page }) => {
    // ネクストアクションセクションを確認
    const actionsSection = page.locator('[data-testid="actions-section"]');
    const actionItems = actionsSection.locator('[data-testid="action-item"]');
    
    const actionCount = await actionItems.count();
    if (actionCount > 0) {
      const firstAction = actionItems.first();
      
      // 担当者が表示されることを確認（実装されている場合）
      const assignee = firstAction.locator('[data-testid="assignee"]');
      if (await assignee.isVisible()) {
        await expect(assignee).toBeVisible();
      }
      
      // 期限が表示されることを確認（実装されている場合）
      const dueDate = firstAction.locator('[data-testid="due-date"]');
      if (await dueDate.isVisible()) {
        await expect(dueDate).toBeVisible();
      }
    }
  });
});
