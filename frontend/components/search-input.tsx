'use client';

import { useState, KeyboardEvent, useRef, useEffect } from 'react';

/**
 * 検索入力コンポーネント
 * AI検索用のテキストエリアと送信ボタンを提供
 */

interface SearchInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_LENGTH = 1000;

export default function SearchInput({
  onSend,
  disabled = false,
  placeholder = '議事録について質問してください...',
}: SearchInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // テキストエリアの高さを自動調整
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  // メッセージ送信
  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled && trimmedMessage.length <= MAX_LENGTH) {
      onSend(trimmedMessage);
      setMessage('');
      // テキストエリアの高さをリセット
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  // Enterキーで送信（Shift+Enterで改行）
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 文字数カウント
  const remainingChars = MAX_LENGTH - message.length;
  const isOverLimit = remainingChars < 0;

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      {/* 文字数カウンター */}
      <div className="flex justify-end mb-2">
        <span
          className={`text-xs ${
            isOverLimit
              ? 'text-red-600 font-semibold'
              : remainingChars < 100
              ? 'text-orange-600'
              : 'text-gray-500'
          }`}
        >
          {message.length} / {MAX_LENGTH}
        </span>
      </div>

      {/* 入力エリア */}
      <div className="flex items-end gap-2 sm:gap-3">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none border border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm sm:text-base max-h-32 overflow-y-auto"
          style={{ minHeight: '44px' }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          data-testid="search-input"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim() || isOverLimit}
          className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg px-4 sm:px-6 py-2 sm:py-3 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 touch-manipulation text-sm sm:text-base"
          aria-label="送信"
          data-testid="send-button"
        >
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
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>

      {/* ヒントテキスト */}
      <p className="text-xs text-gray-500 mt-2">
        Enterで送信、Shift+Enterで改行
      </p>
    </div>
  );
}
