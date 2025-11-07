'use client';

/**
 * エラーメッセージコンポーネント
 * チャットでのエラーを表示し、再試行オプションを提供
 */

export type ErrorType = 'network' | 'timeout' | 'general';

interface ErrorMessageProps {
  type: ErrorType;
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({
  type,
  message,
  onRetry,
}: ErrorMessageProps) {
  // エラータイプに応じたアイコンとスタイル
  const getErrorIcon = () => {
    switch (type) {
      case 'network':
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
        );
      case 'timeout':
        return (
          <svg
            className="w-5 h-5"
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
        );
      default:
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
    }
  };

  return (
    <div className="flex justify-start mb-4 animate-fade-in">
      <div className="max-w-[85%] sm:max-w-[75%] bg-red-50 border border-red-200 rounded-r-lg rounded-tl-lg p-3 sm:p-4 shadow-sm">
        <div className="flex items-start gap-3">
          {/* エラーアイコン */}
          <div className="flex-shrink-0 text-red-600 mt-0.5">
            {getErrorIcon()}
          </div>

          {/* エラーメッセージ */}
          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-base text-red-800 break-words">
              {message}
            </p>

            {/* 再試行ボタン */}
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm rounded-md transition-colors touch-manipulation"
              >
                <svg
                  className="w-4 h-4"
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
                再試行
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
