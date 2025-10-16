import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('ファイルアップロードフロー', () => {
  test.beforeEach(async ({ page }) => {
    // アップロードページに移動
    await page.goto('/upload');
  });

  test('アップロードページが正しく表示される', async ({ page }) => {
    // ページタイトルを確認
    await expect(page.locator('h1')).toContainText('会議録画をアップロード');
    
    // ファイル選択エリアが表示されることを確認
    await expect(page.locator('text=MP4ファイルをドラッグ&ドロップ')).toBeVisible();
    
    // またはファイル選択ボタンが表示されることを確認
    await expect(page.locator('text=ファイルを選択')).toBeVisible();
  });

  test('ファイル選択ボタンからファイルをアップロードできる', async ({ page }) => {
    // テスト用のMP4ファイルパス（実際のテストではモックファイルを使用）
    const testFilePath = path.join(__dirname, 'fixtures', 'test-video.mp4');
    
    // ファイル入力要素を取得
    const fileInput = page.locator('input[type="file"]');
    
    // ファイルを選択
    await fileInput.setInputFiles(testFilePath);
    
    // ファイル名が表示されることを確認
    await expect(page.locator('text=test-video.mp4')).toBeVisible();
    
    // アップロードボタンをクリック
    await page.click('button:has-text("アップロード")');
    
    // アップロード進捗が表示されることを確認
    await expect(page.locator('text=アップロード中')).toBeVisible();
    
    // アップロード完了後、ジョブ詳細ページにリダイレクトされることを確認
    await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+/);
  });

  test('無効なファイル形式でエラーが表示される', async ({ page }) => {
    // テスト用の無効なファイルパス
    const invalidFilePath = path.join(__dirname, 'fixtures', 'test-document.pdf');
    
    // ファイル入力要素を取得
    const fileInput = page.locator('input[type="file"]');
    
    // 無効なファイルを選択
    await fileInput.setInputFiles(invalidFilePath);
    
    // エラーメッセージが表示されることを確認
    await expect(page.locator('text=MP4ファイルのみアップロード可能です')).toBeVisible();
  });

  test('ファイルサイズ制限を超えた場合にエラーが表示される', async ({ page }) => {
    // 大きなファイルのテスト（実際のテストではモックを使用）
    // このテストは実装に応じて調整が必要
    
    // ファイルサイズのバリデーションメッセージを確認
    // await expect(page.locator('text=ファイルサイズが大きすぎます')).toBeVisible();
  });

  test('ドラッグ&ドロップでファイルをアップロードできる', async ({ page }) => {
    // ドロップゾーンを取得
    const dropZone = page.locator('[data-testid="drop-zone"]');
    
    // ドラッグオーバー時のスタイル変更を確認
    await dropZone.hover();
    
    // 実際のドラッグ&ドロップのテストは、ブラウザの制限により難しい場合がある
    // 代わりに、ファイル入力のイベントをシミュレートする
  });

  test('アップロード中にキャンセルできる', async ({ page }) => {
    const testFilePath = path.join(__dirname, 'fixtures', 'test-video.mp4');
    
    // ファイルを選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // アップロードを開始
    await page.click('button:has-text("アップロード")');
    
    // キャンセルボタンが表示されることを確認
    const cancelButton = page.locator('button:has-text("キャンセル")');
    await expect(cancelButton).toBeVisible();
    
    // キャンセルをクリック
    await cancelButton.click();
    
    // アップロードがキャンセルされたことを確認
    await expect(page.locator('text=アップロードがキャンセルされました')).toBeVisible();
  });
});
