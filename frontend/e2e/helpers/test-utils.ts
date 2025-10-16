import { Page } from '@playwright/test';

/**
 * テスト用のユーティリティ関数
 */

/**
 * 認証済みのセッションを作成する（モック）
 */
export async function authenticateUser(page: Page) {
  // ホームページに移動
  await page.goto('/');
  
  // 有効期限を未来に設定したモックトークンを作成
  const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1時間後
  const mockIdToken = `header.${btoa(JSON.stringify({
    sub: 'test-user-123',
    email: 'test@example.com',
    exp: futureTimestamp
  }))}.signature`;
  
  // ローカルストレージに認証情報を設定
  await page.evaluate((token) => {
    localStorage.setItem('cognito_id_token', token);
    localStorage.setItem('cognito_access_token', token);
    localStorage.setItem('cognito_refresh_token', token);
    localStorage.setItem('cognito_user', JSON.stringify({ 
      email: 'test@example.com',
      userId: 'test-user-123'
    }));
  }, mockIdToken);
}

/**
 * テスト用のジョブを作成する
 */
export async function createTestJob(page: Page): Promise<string> {
  // APIを直接呼び出してテストジョブを作成
  const response = await page.request.post('/api/test/create-job', {
    data: {
      fileName: 'test-video.mp4',
      status: 'COMPLETED',
    },
  });
  
  const data = await response.json();
  return data.jobId;
}

/**
 * テスト用の議事録データを作成する
 */
export async function createTestMinutes(page: Page, jobId: string) {
  // APIを直接呼び出してテスト議事録を作成
  await page.request.post(`/api/test/create-minutes/${jobId}`, {
    data: {
      summary: 'テスト会議の概要',
      decisions: ['決定事項1', '決定事項2'],
      nextActions: ['アクション1', 'アクション2'],
    },
  });
}

/**
 * トースト通知が表示されるまで待機する
 */
export async function waitForToast(page: Page, message: string) {
  await page.waitForSelector(`text=${message}`, { timeout: 5000 });
}

/**
 * ローディングインジケーターが消えるまで待機する
 */
export async function waitForLoadingToComplete(page: Page) {
  await page.waitForSelector('[data-testid="loading"]', { state: 'hidden', timeout: 10000 });
}

/**
 * APIレスポンスをモックする
 */
export async function mockApiResponse(page: Page, url: string, response: any) {
  await page.route(url, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * ファイルアップロードをシミュレートする
 */
export async function simulateFileUpload(page: Page, filePath: string) {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
}

/**
 * ダウンロードを待機して検証する
 */
export async function waitForDownload(page: Page, expectedExtension: string) {
  const downloadPromise = page.waitForEvent('download');
  const download = await downloadPromise;
  const fileName = download.suggestedFilename();
  
  if (!fileName.endsWith(expectedExtension)) {
    throw new Error(`Expected file extension ${expectedExtension}, but got ${fileName}`);
  }
  
  return download;
}

/**
 * ページのスクリーンショットを撮る（デバッグ用）
 */
export async function takeDebugScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });
}

/**
 * 要素が表示されるまで待機する
 */
export async function waitForElement(page: Page, selector: string, timeout = 5000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * テキストが表示されるまで待機する
 */
export async function waitForText(page: Page, text: string, timeout = 5000) {
  await page.waitForSelector(`text=${text}`, { timeout });
}

/**
 * ネットワークアイドル状態を待機する
 */
export async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle');
}

/**
 * ローカルストレージをクリアする
 */
export async function clearLocalStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

/**
 * セッションストレージをクリアする
 */
export async function clearSessionStorage(page: Page) {
  await page.evaluate(() => {
    sessionStorage.clear();
  });
}
