'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { Decision, NextAction } from '@/types';

/**
 * チャットモーダルコンポーネント
 * モーダルウィンドウでチャットインターフェースを表示
 */

export interface ChatContext {
  summary: string;
  decisions: Decision[];
  nextActions: NextAction[];
  transcript: string;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function ChatModal({
  isOpen,
  onClose,
  children,
}: ChatModalProps) {
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
        className="relative bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:rounded-lg shadow-xl flex flex-col safe-area-inset"
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
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">
              議事録チャット
            </h2>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 active:text-gray-800 transition-colors p-2 flex-shrink-0 touch-manipulation"
            aria-label="閉じる"
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
