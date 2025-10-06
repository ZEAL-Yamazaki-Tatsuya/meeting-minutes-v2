'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* ヘッダー */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Meeting Minutes Generator
            </h1>
            <p className="text-xl text-gray-600">
              MP4ファイルから自動的に議事録を生成
            </p>
          </div>

          {/* メインコンテンツ */}
          <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              フロントエンドセットアップ完了
            </h2>
            
            <div className="space-y-4 text-gray-700">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  ✓
                </div>
                <div>
                  <h3 className="font-semibold">Next.js 14プロジェクト</h3>
                  <p className="text-sm text-gray-600">App Routerを使用したモダンな構成</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  ✓
                </div>
                <div>
                  <h3 className="font-semibold">TypeScript & Tailwind CSS</h3>
                  <p className="text-sm text-gray-600">型安全性とスタイリングの効率化</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  ✓
                </div>
                <div>
                  <h3 className="font-semibold">API通信ライブラリ</h3>
                  <p className="text-sm text-gray-600">Axios + React Queryによる効率的なデータ管理</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  ✓
                </div>
                <div>
                  <h3 className="font-semibold">環境変数設定</h3>
                  <p className="text-sm text-gray-600">API Gateway URLの設定が可能</p>
                </div>
              </div>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => router.push('/upload')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 px-8 rounded-lg shadow-lg transition-colors flex items-center justify-center space-x-3"
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
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span>ファイルをアップロード</span>
            </button>

            <button
              onClick={() => router.push('/jobs')}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-6 px-8 rounded-lg shadow-lg transition-colors flex items-center justify-center space-x-3"
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>ジョブ一覧を見る</span>
            </button>
          </div>

          {/* 次のステップ */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              使い方
            </h3>
            <ol className="space-y-2 text-blue-800 list-decimal list-inside">
              <li>MP4形式の会議録画ファイルをアップロード</li>
              <li>自動的に文字起こしが実行されます</li>
              <li>AIが議事録を生成します</li>
              <li>生成された議事録を確認・編集・ダウンロード</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
