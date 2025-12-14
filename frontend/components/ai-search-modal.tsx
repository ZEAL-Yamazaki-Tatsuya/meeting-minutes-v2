'use client';

import { useEffect, useRef, ReactNode } from 'react';

/**
 * AI検索モーダルコンポーネント
 * 全議事録を横断してAI検索を行うためのモーダルウィンドウ
 */

interface AISearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function AISearchModal({
  isOpen,
  onClose,
  children,
}: AISearchModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // モーダルが開いているときはbodyのスクロールを無効化
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // モバイルでの仮想キーボード対応
      if (window.visualViewport) {
        const handleResize = () => {
          if (modalRef.current) {
            const viewportHeight = window.visualViewport?.height || window.innerHeight;
            modalRef.current.style.height = `${viewportHeight}px`;
          }
        };
        window.visualViewport.addEventListener('resize', handleResize);
        handleResize();
        return () => {
          window.visualViewport?.removeEventListener('resize', handleResize);
          document.body.style.overflow = 'unset';
        };
      }
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* モーダルコンテンツ */}
      <div
        ref={modalRef}
        className="relative bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-3xl sm:rounded-lg shadow-xl flex flex-col safe-area-inset"
        data-testid="ai-search-modal"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center min-w-0 flex-1">
            <svg
              className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">
              AI議事録検索
            </h2>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 active:text-gray-800 transition-colors p-2 flex-shrink-0 touch-manipulation"
            aria-label="閉じる"
            data-testid="close-modal"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
