import { MinutesFilters } from '@/types';

/**
 * キャッシュエントリの型定義
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * キャッシュストレージクラス
 * メモリベースのキャッシュを提供し、有効期限管理を行う
 */
class CacheStorage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cache: Map<string, CacheEntry<any>>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5分（ミリ秒）

  constructor() {
    this.cache = new Map();
  }

  /**
   * キャッシュキーを生成
   * @param userId ユーザーID
   * @param page ページ番号
   * @param limit 1ページあたりの件数
   * @param filters フィルター条件
   * @returns キャッシュキー
   */
  generateKey(
    userId: string,
    page: number,
    limit: number,
    filters?: MinutesFilters
  ): string {
    const filterStr = filters
      ? JSON.stringify({
          startDate: filters.startDate || '',
          endDate: filters.endDate || '',
          meetingName: filters.meetingName || '',
        })
      : '';
    return `minutes:${userId}:${page}:${limit}:${filterStr}`;
  }

  /**
   * キャッシュからデータを取得
   * @param key キャッシュキー
   * @returns キャッシュされたデータ、または存在しない/期限切れの場合はnull
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // 有効期限をチェック
    const now = Date.now();
    if (now > entry.expiresAt) {
      // 期限切れのエントリを削除
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * キャッシュにデータを保存
   * @param key キャッシュキー
   * @param data 保存するデータ
   * @param ttl 有効期限（ミリ秒）、省略時はデフォルト値を使用
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.DEFAULT_TTL);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });
  }

  /**
   * 特定のキーのキャッシュを削除
   * @param key キャッシュキー
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 全てのキャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 期限切れのキャッシュエントリを削除
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * 特定のユーザーに関連する全てのキャッシュを削除
   * @param userId ユーザーID
   */
  clearUserCache(userId: string): void {
    const prefix = `minutes:${userId}:`;
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }
}

// シングルトンインスタンスをエクスポート
const cacheStorage = new CacheStorage();

// 定期的にクリーンアップを実行（1分ごと）
if (typeof window !== 'undefined') {
  setInterval(() => {
    cacheStorage.cleanup();
  }, 60 * 1000);
}

export default cacheStorage;
