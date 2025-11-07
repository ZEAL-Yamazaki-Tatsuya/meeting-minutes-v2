'use client';

/**
 * チャットボタンコンポーネント
 * 画面右下に固定表示され、クリックでチャットモーダルを開く
 */

interface ChatButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export default function ChatButton({ onClick, disabled = false }: ChatButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full p-4 shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 active:scale-95 touch-manipulation"
      aria-label="チャットを開く"
      title="議事録について質問する"
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
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    </button>
  );
}
