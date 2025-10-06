'use client';

import { useParams, useRouter } from 'next/navigation';

/**
 * ジョブ詳細ページ（プレースホルダー）
 * タスク11で完全に実装予定
 */
export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* ヘッダー */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              ジョブ詳細
            </h1>
            <p className="text-gray-600">
              ジョブID: {jobId}
            </p>
          </div>

          {/* メインコンテンツ */}
          <div className="bg-white rounded-lg shadow-xl p-8 mb-6">
            <div className="text-center py-12">
              <div className="mb-6">
                <svg
                  className="mx-auto h-16 w-16 text-green-500"
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
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                アップロード完了！
              </h2>
              <p className="text-gray-600 mb-8">
                ファイルのアップロードが完了しました。<br />
                処理が開始されています。
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">
                  処理の流れ
                </h3>
                <ol className="space-y-2 text-blue-800 list-decimal list-inside text-left">
                  <li>音声の文字起こし（AWS Transcribe）</li>
                  <li>議事録の生成（Amazon Bedrock）</li>
                  <li>結果の保存</li>
                </ol>
                <p className="text-sm text-blue-700 mt-4">
                  処理には数分かかる場合があります
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => router.push('/jobs')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  ジョブ一覧を見る
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

          {/* 注意事項 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              注意
            </h3>
            <p className="text-sm text-yellow-800">
              このページは現在プレースホルダーです。タスク11で完全な機能が実装されます。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
