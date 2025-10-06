'use client';

import { useRouter } from 'next/navigation';

/**
 * ジョブ一覧ページ（プレースホルダー）
 * タスク11で完全に実装予定
 */
export default function JobsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* ヘッダー */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              ジョブ一覧
            </h1>
            <p className="text-gray-600">
              処理中および完了したジョブの一覧
            </p>
          </div>

          {/* メインコンテンツ */}
          <div className="bg-white rounded-lg shadow-xl p-8 mb-6">
            <div className="text-center py-12">
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
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                ジョブ一覧機能
              </h2>
              <p className="text-gray-600 mb-8">
                このページはタスク11で実装予定です。
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">
                  実装予定の機能
                </h3>
                <ul className="space-y-2 text-blue-800 list-disc list-inside text-left">
                  <li>ジョブ一覧の表示</li>
                  <li>ステータスの表示（処理中、完了、失敗）</li>
                  <li>作成日時とファイル名の表示</li>
                  <li>ジョブ詳細ページへのリンク</li>
                  <li>ページネーション機能</li>
                </ul>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => router.push('/upload')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  新しいファイルをアップロード
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  ホームに戻る
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
