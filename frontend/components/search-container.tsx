'use client';

import { useState, useRef, useEffect } from 'react';
import SearchMessage, { SearchMessage as SearchMessageType } from './search-message';
import SearchInput from './search-input';
import TypingIndicator from './typing-indicator';

/**
 * 検索コンテナコンポーネント
 * 会話履歴の管理とメッセージ表示を担当
 */

import { SearchResult } from './search-message';

interface SearchContainerProps {
  onSearch: (query: string, history: { role: 'user' | 'assistant'; content: string }[]) => Promise<{
    message: string;
    results?: SearchResult[];
    timestamp: string;
  }>;
}

const MAX_HISTORY = 5;

export default function SearchContainer({ onSearch }: SearchContainerProps) {
  const [messages, setMessages] = useState<SearchMessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが追加されたら最下部にスクロール
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 検索を実行
  const handleSearch = async (query: string) => {
    setLoading(true);
    setError(null);

    // ユーザーメッセージを追加
    const userMessage: SearchMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // 会話履歴を準備（最大5件、最新のメッセージは除く）
      const history = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // API呼び出し
      const response = await onSearch(query, history);

      // AIレスポンスを追加
      const assistantMessage: SearchMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        results: response.results,
        timestamp: response.timestamp,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // 会話履歴が5件を超えたら古いものから削除（ユーザー+アシスタントのペアで削除）
      setMessages((prev) => {
        if (prev.length > MAX_HISTORY * 2) {
          return prev.slice(2); // 最も古いペアを削除
        }
        return prev;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '検索に失敗しました。もう一度お試しください。'
      );
    } finally {
      setLoading(false);
    }
  };

  // 会話履歴をクリア
  const handleClearHistory = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* メッセージエリア */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 max-w-md px-4">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-400"
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
              <p className="text-lg font-semibold mb-2">AI議事録検索</p>
              <p className="text-sm">
                全議事録を横断して検索できます。
                <br />
                例: 「hogeテーブルは移行対象外と言っていたけど、それってどの議事録？」
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <SearchMessage key={message.id} message={message} />
        ))}

        {loading && <TypingIndicator />}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-800">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-sm text-red-600 hover:text-red-800 underline mt-2"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 会話履歴クリアボタン */}
      {messages.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClearHistory}
            disabled={loading}
            className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            会話履歴をクリア
          </button>
        </div>
      )}

      {/* 入力エリア */}
      <SearchInput onSend={handleSearch} disabled={loading} />
    </div>
  );
}
