'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <div className="max-w-4xl mx-auto">
          {/* ヘッダー */}
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">
              Meeting Minutes Generator
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 px-4">
              MP4ファイルから自動的に議事録を生成
            </p>
          </div>

          {/* アクションボタン */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <button
              onClick={() => router.push('/upload')}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-4 sm:py-5 lg:py-6 px-6 sm:px-8 rounded-lg shadow-lg transition-colors flex items-center justify-center space-x-2 sm:space-x-3 touch-manipulation"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm sm:text-base">ファイルをアップロード</span>
            </button>

            <button
              onClick={() => router.push('/jobs')}
              className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold py-4 sm:py-5 lg:py-6 px-6 sm:px-8 rounded-lg shadow-lg transition-colors flex items-center justify-center space-x-2 sm:space-x-3 touch-manipulation"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
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
              <span className="text-sm sm:text-base">ジョブ一覧を見る</span>
            </button>
          </div>

          {/* 次のステップ */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-2 sm:mb-3">
              使い方
            </h3>
            <ol className="space-y-1.5 sm:space-y-2 text-sm sm:text-base text-blue-800 list-decimal list-inside pl-1">
              <li className="break-words">MP4形式の会議録画ファイルをアップロード</li>
              <li className="break-words">自動的に文字起こしが実行されます</li>
              <li className="break-words">AIが議事録を生成します</li>
              <li className="break-words">生成された議事録を確認・編集・ダウンロード</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
