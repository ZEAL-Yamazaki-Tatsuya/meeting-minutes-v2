'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import apiService from '@/lib/api-service';
import { MinutesSummary, MinutesFilters } from '@/types';
import ProtectedRoute from '@/components/protected-route';
import MinutesListItem from '@/components/minutes-list-item';
import MinutesFilter from '@/components/minutes-filter';
import Pagination from '@/components/pagination';
import LoadingSkeleton from '@/components/loading-skeleton';
import AISearchModal from '@/components/ai-search-modal';
import SearchContainer from '@/components/search-container';

/**
 * 議事録一覧ページ（コンテンツ）
 */
function MinutesPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [minutes, setMinutes] = useState<MinutesSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<MinutesFilters>({});
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // 議事録一覧を取得
  const fetchMinutes = async (newPage: number = page, newFilters: MinutesFilters = filters) => {
    if (!user?.userId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await apiService.fetchMinutes(user.userId, newPage, 20, newFilters);

      setMinutes(response.minutes);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
      setPage(newPage);
    } catch (err) {
      console.error('議事録一覧の取得に失敗しました:', err);
      setError('議事録一覧の取得に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  // 初回読み込み
  useEffect(() => {
    if (user?.userId) {
      fetchMinutes(1, {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  // 議事録詳細ページへ遷移
  const handleMinuteClick = (jobId: string) => {
    router.push(`/jobs/${jobId}/minutes`);
  };

  // ページ変更
  const handlePageChange = (newPage: number) => {
    fetchMinutes(newPage, filters);
    // ページトップにスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // フィルター適用
  const handleFilterChange = (newFilters: MinutesFilters) => {
    setFilters(newFilters);
    fetchMinutes(1, newFilters);
  };

  // フィルタークリア
  const handleFilterClear = () => {
    setFilters({});
    fetchMinutes(1, {});
  };

  // AI検索を実行
  const handleSearch = async (
    query: string,
    history: { role: 'user' | 'assistant'; content: string }[]
  ) => {
    if (!user?.userId) {
      throw new Error('ユーザーIDが取得できません');
    }
    return await apiService.searchMinutes(user.userId, query, history);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          {/* 戻るボタン */}
          <button
            onClick={() => router.push('/')}
            className="mb-4 sm:mb-6 text-blue-600 hover:text-blue-800 active:text-blue-900 font-medium flex items-center touch-manipulation py-2 px-3 text-sm sm:text-base"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            ホームに戻る
          </button>

          {/* ヘッダー */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">
                  議事録一覧
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                  {total > 0 ? `全 ${total} 件の議事録` : '議事録を表示'}
                </p>
              </div>
              <button
                onClick={() => router.push('/upload')}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors flex items-center justify-center sm:justify-start touch-manipulation text-sm sm:text-base whitespace-nowrap"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                新規アップロード
              </button>
            </div>

            {/* リフレッシュボタン */}
            <button
              onClick={() => {
                if (user?.userId) {
                  // キャッシュをクリアして最新データを取得
                  apiService.clearMinutesCache(user.userId);
                  fetchMinutes(page, filters);
                }
              }}
              disabled={loading}
              className="text-blue-600 hover:text-blue-800 active:text-blue-900 text-xs sm:text-sm font-medium flex items-center disabled:opacity-50 touch-manipulation py-2 px-3"
            >
              <svg
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              更新
            </button>
          </div>

          {/* フィルター */}
          <div className="mb-6" data-testid="minutes-filter">
            <MinutesFilter
              filters={filters}
              onFilterChange={handleFilterChange}
              onClear={handleFilterClear}
            />
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="text-red-800 font-semibold mb-1">エラー</h3>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* ローディング表示 */}
          {loading && <LoadingSkeleton />}

          {/* 議事録一覧 */}
          {!loading && minutes.length === 0 && (
            <div className="bg-white rounded-lg shadow-xl p-12 text-center">
              <div className="mb-6">
                <svg
                  className="mx-auto h-16 w-16 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                議事録がありません
              </h2>
              <p className="text-gray-600 mb-6">
                {Object.values(filters).some(v => v)
                  ? 'フィルター条件に一致する議事録が見つかりませんでした。'
                  : 'まだ議事録が作成されていません。新しいファイルをアップロードしてください。'}
              </p>
              {Object.values(filters).some(v => v) ? (
                <button
                  onClick={handleFilterClear}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  フィルターをクリア
                </button>
              ) : (
                <button
                  onClick={() => router.push('/upload')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  ファイルをアップロード
                </button>
              )}
            </div>
          )}

          {!loading && minutes.length > 0 && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 mb-6">
                {minutes.map((minute) => (
                  <MinutesListItem
                    key={minute.jobId}
                    minute={minute}
                    onClick={handleMinuteClick}
                  />
                ))}
              </div>

              {/* ページネーション */}
              {totalPages > 1 && (
                <div className="mt-8" data-testid="pagination">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* AI検索ボタン（固定位置） */}
      <button
        onClick={() => setIsSearchModalOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full p-4 shadow-lg transition-all hover:shadow-xl z-40 touch-manipulation"
        aria-label="AI検索"
        data-testid="ai-search-button"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>

      {/* AI検索モーダル */}
      <AISearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      >
        <SearchContainer onSearch={handleSearch} />
      </AISearchModal>
    </div>
  );
}

/**
 * 議事録一覧ページ
 */
export default function MinutesPage() {
  return (
    <ProtectedRoute>
      <MinutesPageContent />
    </ProtectedRoute>
  );
}
