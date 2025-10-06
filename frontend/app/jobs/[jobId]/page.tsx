'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import apiService from '@/lib/api-service';
import { Job, JobStatus } from '@/types';

/**
 * ステータスに応じた進捗ステップを表示するコンポーネント
 */
function ProgressSteps({ status }: { status: JobStatus }) {
  const steps = [
    { key: 'UPLOADED', label: 'アップロード完了', icon: '📤' },
    { key: 'TRANSCRIBING', label: '文字起こし中', icon: '🎤' },
    { key: 'GENERATING', label: '議事録生成中', icon: '📝' },
    { key: 'COMPLETED', label: '完了', icon: '✅' },
  ];

  const statusOrder = ['UPLOADED', 'TRANSCRIBING', 'GENERATING', 'COMPLETED'];
  const currentIndex = statusOrder.indexOf(status);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex || status === 'COMPLETED';

          return (
            <div key={step.key} className="flex-1 relative">
              <div className="flex flex-col items-center">
                {/* アイコン */}
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-2 transition-all ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-blue-500 text-white animate-pulse'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {step.icon}
                </div>

                {/* ラベル */}
                <div
                  className={`text-sm font-medium text-center ${
                    isCompleted || isActive ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </div>
              </div>

              {/* 接続線 */}
              {index < steps.length - 1 && (
                <div
                  className={`absolute top-8 left-1/2 w-full h-1 -z-10 transition-all ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                  style={{ transform: 'translateY(-50%)' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ステータスバッジコンポーネント
 */
function StatusBadge({ status }: { status: JobStatus }) {
  const statusConfig = {
    UPLOADED: { label: 'アップロード完了', color: 'bg-blue-100 text-blue-800', icon: '📤' },
    TRANSCRIBING: { label: '文字起こし中', color: 'bg-yellow-100 text-yellow-800', icon: '🎤' },
    GENERATING: { label: '議事録生成中', color: 'bg-purple-100 text-purple-800', icon: '📝' },
    COMPLETED: { label: '完了', color: 'bg-green-100 text-green-800', icon: '✅' },
    FAILED: { label: '失敗', color: 'bg-red-100 text-red-800', icon: '❌' },
  };

  const config = statusConfig[status];

  return (
    <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${config.color}`}>
      <span className="mr-2">{config.icon}</span>
      {config.label}
    </div>
  );
}

/**
 * ローディングスピナーコンポーネント
 */
function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

/**
 * ジョブ詳細ページ
 */
export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // ジョブステータスを取得
  const fetchJobStatus = async () => {
    try {
      const jobData = await apiService.getJobStatus(jobId);
      setJob(jobData);
      setError(null);

      // 完了または失敗したらポーリングを停止
      if (jobData.status === 'COMPLETED' || jobData.status === 'FAILED') {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    } catch (err) {
      console.error('ジョブステータスの取得に失敗しました:', err);
      setError('ジョブステータスの取得に失敗しました。');
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // 初回読み込みとポーリング設定
  useEffect(() => {
    fetchJobStatus();

    // 5秒ごとにポーリング
    const interval = setInterval(() => {
      fetchJobStatus();
    }, 5000);

    setPollingInterval(interval);

    // クリーンアップ
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [jobId]);

  // 日時フォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // ファイルサイズフォーマット
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // 議事録を表示
  const handleViewMinutes = () => {
    router.push(`/jobs/${jobId}/minutes`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 戻るボタン */}
          <button
            onClick={() => router.push('/jobs')}
            className="mb-6 text-blue-600 hover:text-blue-800 font-medium flex items-center"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            ジョブ一覧に戻る
          </button>

          {/* ヘッダー */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              ジョブ詳細
            </h1>
            <p className="text-gray-600 text-sm font-mono">
              ID: {jobId}
            </p>
          </div>

          {/* ローディング表示 */}
          {loading && <LoadingSpinner />}

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <div className="flex items-start">
                <svg
                  className="w-6 h-6 text-red-500 mr-3 flex-shrink-0"
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
                  <p className="text-red-700">{error}</p>
                  <button
                    onClick={fetchJobStatus}
                    className="mt-4 text-red-600 hover:text-red-800 font-medium text-sm"
                  >
                    再試行
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ジョブ情報 */}
          {!loading && job && (
            <>
              {/* ステータスカード */}
              <div className="bg-white rounded-lg shadow-xl p-8 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    処理ステータス
                  </h2>
                  <StatusBadge status={job.status} />
                </div>

                {/* 進捗ステップ（失敗時は非表示） */}
                {job.status !== 'FAILED' && (
                  <ProgressSteps status={job.status} />
                )}

                {/* 処理中メッセージ */}
                {(job.status === 'UPLOADED' || job.status === 'TRANSCRIBING' || job.status === 'GENERATING') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
                    <div className="flex items-start">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3 flex-shrink-0"></div>
                      <div>
                        <h3 className="text-blue-900 font-semibold mb-2">
                          処理中です
                        </h3>
                        <p className="text-blue-800 text-sm">
                          このページは自動的に更新されます。処理には数分かかる場合があります。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 完了メッセージ */}
                {job.status === 'COMPLETED' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-6">
                    <div className="flex items-start">
                      <svg
                        className="w-6 h-6 text-green-500 mr-3 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="flex-1">
                        <h3 className="text-green-900 font-semibold mb-2">
                          処理が完了しました！
                        </h3>
                        <p className="text-green-800 text-sm mb-4">
                          議事録が正常に生成されました。
                        </p>
                        <button
                          onClick={handleViewMinutes}
                          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                        >
                          議事録を表示
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* エラーメッセージ */}
                {job.status === 'FAILED' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 mt-6">
                    <div className="flex items-start">
                      <svg
                        className="w-6 h-6 text-red-500 mr-3 flex-shrink-0"
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
                        <h3 className="text-red-900 font-semibold mb-2">
                          処理に失敗しました
                        </h3>
                        {job.errorMessage && (
                          <p className="text-red-800 text-sm mb-4">
                            {job.errorMessage}
                          </p>
                        )}
                        <button
                          onClick={() => router.push('/upload')}
                          className="text-red-600 hover:text-red-800 font-medium text-sm"
                        >
                          新しいファイルをアップロード
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ジョブ詳細情報 */}
              <div className="bg-white rounded-lg shadow-xl p-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                  ジョブ情報
                </h2>

                <div className="space-y-4">
                  <div className="flex items-start border-b border-gray-200 pb-4">
                    <div className="w-1/3 text-gray-600 font-medium">
                      ファイル名
                    </div>
                    <div className="w-2/3 text-gray-900 break-all">
                      {job.videoFileName}
                    </div>
                  </div>

                  <div className="flex items-start border-b border-gray-200 pb-4">
                    <div className="w-1/3 text-gray-600 font-medium">
                      ファイルサイズ
                    </div>
                    <div className="w-2/3 text-gray-900">
                      {formatFileSize(job.videoSize)}
                    </div>
                  </div>

                  <div className="flex items-start border-b border-gray-200 pb-4">
                    <div className="w-1/3 text-gray-600 font-medium">
                      作成日時
                    </div>
                    <div className="w-2/3 text-gray-900">
                      {formatDate(job.createdAt)}
                    </div>
                  </div>

                  <div className="flex items-start border-b border-gray-200 pb-4">
                    <div className="w-1/3 text-gray-600 font-medium">
                      更新日時
                    </div>
                    <div className="w-2/3 text-gray-900">
                      {formatDate(job.updatedAt)}
                    </div>
                  </div>

                  {job.metadata?.meetingTitle && (
                    <div className="flex items-start border-b border-gray-200 pb-4">
                      <div className="w-1/3 text-gray-600 font-medium">
                        会議タイトル
                      </div>
                      <div className="w-2/3 text-gray-900">
                        {job.metadata.meetingTitle}
                      </div>
                    </div>
                  )}

                  {job.metadata?.meetingDate && (
                    <div className="flex items-start border-b border-gray-200 pb-4">
                      <div className="w-1/3 text-gray-600 font-medium">
                        会議日時
                      </div>
                      <div className="w-2/3 text-gray-900">
                        {job.metadata.meetingDate}
                      </div>
                    </div>
                  )}

                  {job.metadata?.participants && job.metadata.participants.length > 0 && (
                    <div className="flex items-start pb-4">
                      <div className="w-1/3 text-gray-600 font-medium">
                        参加者
                      </div>
                      <div className="w-2/3 text-gray-900">
                        {job.metadata.participants.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
