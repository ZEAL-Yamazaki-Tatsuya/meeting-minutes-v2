/**
 * スケルトンスクリーンコンポーネント
 * 議事録一覧の読み込み中に表示
 */
export default function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
      {[...Array(6)].map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow p-4 sm:p-5 lg:p-6 border border-gray-200 animate-pulse"
        >
          {/* タイトル */}
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>

          {/* 日時 */}
          <div className="flex items-center mb-3">
            <div className="w-4 h-4 bg-gray-200 rounded mr-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>

          {/* 概要プレビュー */}
          <div className="space-y-2 mb-4">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>

          {/* ボタン */}
          <div className="pt-3 border-t border-gray-200">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
