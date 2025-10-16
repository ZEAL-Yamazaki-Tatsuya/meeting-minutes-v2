import { test as base } from '@playwright/test';
import { mockJob, mockJobList, mockMinutes, mockAuthUser } from '../mocks/api-responses';

/**
 * カスタムフィクスチャ
 * テストで共通して使用するセットアップを定義
 */

type CustomFixtures = {
  authenticatedPage: any;
  mockApiData: any;
};

export const test = base.extend<CustomFixtures>({
  /**
   * 認証済みのページフィクスチャ
   */
  authenticatedPage: async ({ page }, use) => {
    // 認証トークンをローカルストレージに設定
    await page.goto('/');
    await page.evaluate((user) => {
      localStorage.setItem('authUser', JSON.stringify(user));
      localStorage.setItem('accessToken', 'mock-access-token');
    }, mockAuthUser);

    await use(page);

    // クリーンアップ
    await page.evaluate(() => {
      localStorage.clear();
    });
  },

  /**
   * モックAPIデータフィクスチャ
   */
  mockApiData: async ({ page }, use) => {
    // APIレスポンスをモック
    await page.route('**/api/jobs', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobs: mockJobList }),
      });
    });

    await page.route('**/api/jobs/*', (route) => {
      const url = route.request().url();
      const jobId = url.match(/\/api\/jobs\/([^\/]+)/)?.[1];

      if (url.includes('/minutes')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMinutes),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockJob),
        });
      }
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
