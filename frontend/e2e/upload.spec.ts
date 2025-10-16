import { test, expect } from '@playwright/test';
import path from 'path';
import { authenticateUser } from './helpers/test-utils';

test.describe('ファイルアップロードフロー', () => {
  test.beforeEach(async ({ page }) => {
    // 認証トークンをモック
    await authenticateUser(page);
    
    // アップロードページに移動
    await page.goto('/upload');
  });

  test('アップロードページが正しく表示される', async ({ page }) => {
    // ページタイトルを確認
    await expect(page.locator('h1')).toContainText('ファイルアップロード');
    
    // ファイル選択エリアが表示されることを確認
    await expect(page.locator('text=ファイルをドラッグ&ドロップ')).toBeVisible();
    
    // またはファイル選択ボタンが表示されることを確認
    await expect(page.locator('text=ファイルを選択')).toBeVisible();
  });

  test.skip('ファイル選択ボタンからファイルをアップロードできる', async ({ page }) => {
    // このテストは実際のファイルが必要なためスキップ
    // 実装時には、テスト用のMP4ファイルを fixtures/ に配置してください
    
    // テスト用のMP4ファイルパス
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

  test.skip('無効なファイル形式でエラーが表示される', async ({ page }) => {
    // このテストは実際のファイルが必要なためスキップ
    // テスト用の無効なファイルパス
    const invalidFilePath = path.join(__dirname, 'fixtures', 'test-document.pdf');
    
    // ファイル入力要素を取得
    const fileInput = page.locator('input[type="file"]');
    
    // 無効なファイルを選択
    await fileInput.setInputFiles(invalidFilePath);
    
    // エラーメッセージが表示されることを確認
    await expect(page.locator('text=MP4ファイルのみアップロード可能です')).toBeVisible();
  });

  test.skip('ファイルサイズ制限を超えた場合にエラーが表示される', async ({ page }) => {
    // このテストは大きなファイルが必要なためスキップ
    // 大きなファイルのテスト（実際のテストではモックを使用）
    // このテストは実装に応じて調整が必要
    
    // ファイルサイズのバリデーションメッセージを確認
    // await expect(page.locator('text=ファイルサイズが大きすぎます')).toBeVisible();
  });

  test('ドラッグ&ドロップエリアが表示される', async ({ page }) => {
    // ドロップゾーンが表示されることを確認
    const dropZone = page.locator('text=ファイルをドラッグ&ドロップ');
    await expect(dropZone).toBeVisible();
  });

  test.skip('アップロード中にキャンセルできる', async ({ page }) => {
    // このテストは実際のファイルが必要なためスキップ
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
