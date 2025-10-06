'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiService from '@/lib/api-service';
import { Job, JobStatus } from '@/types';

/**
 * ジョブステータスに応じたバッジを表示するコンポーネント
 */
function StatusBadge({ status }: { status: JobStatus }) {
  const statusConfig = {
    UPLOADED: { label: 'アップロード完了', color: 'bg-blue-100 text-blue-800' },
    TRANSCRIBING: { label: '文字起こし中', color: 'bg-yellow-100 text-yellow-800' },
    GENERATING: { label: '議事録生成中', color: 'bg-purple-100 text-purple-800' },
    COMPLETED: { label: '完了', color: 'bg-green-100 text-green-800' },
    FAILED: { label: '失敗', color: 'bg-red-100 text-red-800' },
  };

  const config = statusConfig[status];

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}>
      {config.label}
    </span>
  );
}

/**
 * ジョブカードコンポーネント
 */
function JobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6 border border-gray-200"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
            {job.videoFileName}
          </h3>
          <p className="text-sm text-gray-500">
            {formatFileSize(job.videoSize)}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center">
          <svg
            className="w-4 h-4 mr-2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>作成日時: {formatDate(job.createdAt)}</span>
        </div>

        {job.metadata?.meetingTitle && (
          <div className="flex items-center">
            <svg
              className="w-4 h-4 mr-2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
            <span className="truncate">{job.metadata.meetingTitle}</span>
          </div>
        )}

        {job.errorMessage && (
          <div className="flex items-start mt-2 p-2 bg-red-50 rounded">
            <svg
              className="w-4 h-4 mr-2 text-red-500 flex-shrink-0 mt-0.5"
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
            <span className="text-red-700 text-xs">{job.errorMessage}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
          詳細を見る
          <svg
            className="w-4 h-4 ml-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * ジョブ一覧ページ
 */
export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // TODO: 実際のユーザーIDを取得（Cognito統合後）
  const userId = 'test-user-001';

  // ジョブ一覧を取得
  const fetchJobs = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setJobs([]);
        setLastEvaluatedKey(undefined);
      } else {
        setLoadingMore(true);
      }

      const response = await apiService.listJobs(
        userId,
        reset ? undefined : lastEvaluatedKey
      );

      if (reset) {
        setJobs(response.jobs);
      } else {
        setJobs((prev) => [...prev, ...response.jobs]);
      }

      setLastEvaluatedKey(response.lastEvaluatedKey);
      setHasMore(!!response.lastEvaluatedKey);
      setError(null);
    } catch (err) {
      console.error('ジョブ一覧の取得に失敗しました:', err);
      setError('ジョブ一覧の取得に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // 初回読み込み
  useEffect(() => {
    fetchJobs(true);
  }, []);

  // ジョブ詳細ページへ遷移
  const handleJobClick = (jobId: string) => {
    router.push(`/jobs/${jobId}`);
  };

  // さらに読み込む
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchJobs(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* ヘッダー */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  ジョブ一覧
                </h1>
                <p className="text-gray-600">
                  処理中および完了したジョブの一覧
                </p>
              </div>
              <button
                onClick={() => router.push('/upload')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center"
              >
                <svg
                  className="w-5 h-5 mr-2"
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
              onClick={() => fetchJobs(true)}
              disabled={loading}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`}
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
          {loading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* ジョブ一覧 */}
          {!loading && jobs.length === 0 && (
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
                ジョブがありません
              </h2>
              <p className="text-gray-600 mb-6">
                まだジョブが作成されていません。新しいファイルをアップロードしてください。
              </p>
              <button
                onClick={() => router.push('/upload')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                ファイルをアップロード
              </button>
            </div>
          )}

          {!loading && jobs.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {jobs.map((job) => (
                  <JobCard
                    key={job.jobId}
                    job={job}
                    onClick={() => handleJobClick(job.jobId)}
                  />
                ))}
              </div>

              {/* ページネーション */}
              {hasMore && (
                <div className="flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-8 rounded-lg shadow border border-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {loadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-800 mr-2"></div>
                        読み込み中...
                      </>
                    ) : (
                      <>
                        さらに読み込む
                        <svg
                          className="w-5 h-5 ml-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
