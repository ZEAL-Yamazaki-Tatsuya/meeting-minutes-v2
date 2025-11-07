'use client';

/**
 * タイピングインジケーターコンポーネント
 * AIが回答を生成中であることを示す3つの点のアニメーション
 */

export default function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4 animate-fade-in">
      <div className="bg-gray-100 rounded-r-lg rounded-tl-lg p-4 shadow-sm">
        <div className="flex space-x-2" role="status" aria-label="回答を生成中">
          <div
            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          ></div>
          <div
            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          ></div>
          <div
            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          ></div>
        </div>
      </div>
    </div>
  );
}
