'use client';

import { useState, useRef, useEffect } from 'react';
import ChatMessage, { Message } from './chat-message';
import ChatInput from './chat-input';
import TypingIndicator from './typing-indicator';
import ErrorMessage, { ErrorType } from './error-message';
import apiService from '@/lib/api-service';
import toast from 'react-hot-toast';
import { ChatContext } from './chat-modal';

/**
 * チャットコンテナコンポーネント
 * 会話履歴管理とAPI呼び出しを統合
 */

interface ChatContainerProps {
  jobId: string;
  minutesContext: ChatContext;
}

const MAX_HISTORY = 1; // 会話履歴の最大件数（Bedrockの応答時間を短縮するため1件に削減）

interface ErrorState {
  type: ErrorType;
  message: string;
  lastUserMessage?: string;
}

export default function ChatContainer({
  jobId,
  minutesContext,
}: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 最新メッセージまでスクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // メッセージ、エラー、ローディング状態が変わったらスクロール
  useEffect(() => {
    scrollToBottom();
  }, [messages, error, isLoading]);

  // メッセージ送信
  const handleSendMessage = async (content: string) => {
    // エラー状態をクリア
    setError(null);

    // ユーザーメッセージを追加
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // リトライロジック（最大3回）
    let retryCount = 0;
    const maxRetries = 2; // 初回 + 2回リトライ = 最大3回

    while (retryCount <= maxRetries) {
      try {
        // 会話履歴を準備（最大3件）
        const history = messages
          .slice(-MAX_HISTORY)
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

        // 会話履歴が制限を超えた場合、ユーザーに通知
        if (messages.length > MAX_HISTORY * 2 && retryCount === 0) {
          toast('古い会話履歴は自動的にクリアされました', {
            icon: 'ℹ️',
            duration: 3000,
          });
        }

        // API呼び出し
        const response = await apiService.sendChatMessage(
          jobId,
          content,
          minutesContext,
          history
        );

        // AIメッセージを追加
        const aiMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.message,
          timestamp: response.timestamp,
        };

        setMessages((prev) => {
          const newMessages = [...prev, aiMessage];
          // 最大1件の会話ペア（2メッセージ）を保持
          if (newMessages.length > MAX_HISTORY * 2) {
            return newMessages.slice(-MAX_HISTORY * 2);
          }
          return newMessages;
        });

        // 成功したらループを抜ける
        break;
      } catch (error: unknown) {
        const err = error as Error & { 
          code?: string;
          response?: {
            data?: {
              error?: {
                message?: string;
                code?: string;
              };
            };
            status?: number;
          };
        };
        
        // サーバーから返されたエラーメッセージを取得
        const serverErrorMessage = err.response?.data?.error?.message;
        const serverErrorCode = err.response?.data?.error?.code;
        const statusCode = err.response?.status;
        
        // デバッグ用にエラー詳細をコンソールに出力
        console.error('チャットエラー詳細:', {
          message: err.message,
          code: err.code,
          serverMessage: serverErrorMessage,
          serverCode: serverErrorCode,
          statusCode: statusCode,
          fullError: err,
        });
        
        // リトライ可能なエラーかチェック
        const isRetryable = 
          err.message?.includes('timeout') ||
          err.message?.includes('時間がかかっています') ||
          err.code === 'ECONNABORTED' ||
          err.message?.includes('Network Error') ||
          statusCode === 503 || // Service Unavailable
          statusCode === 504;   // Gateway Timeout

        // 最後のリトライでもエラーの場合、またはリトライ不可能なエラーの場合
        if (retryCount >= maxRetries || !isRetryable) {
          console.error('チャットメッセージの送信に失敗しました:', err);

          // エラータイプを判定
          let errorType: ErrorType = 'general';
          let errorMessage = '申し訳ございません。回答の生成に失敗しました。';

          // サーバーからのエラーメッセージを優先的に使用
          if (serverErrorMessage) {
            errorMessage = serverErrorMessage;
            
            // エラーコードに基づいてタイプを判定
            if (serverErrorCode === 'ValidationError') {
              errorType = 'general';
            } else if (serverErrorCode === 'ServiceUnavailableError') {
              errorType = 'timeout';
            } else if (serverErrorCode === 'InternalServerError') {
              errorType = 'general';
            }
          } else if (err.message?.includes('timeout') || err.message?.includes('時間がかかっています') || err.code === 'ECONNABORTED') {
            errorType = 'timeout';
            errorMessage = 'AIの応答に時間がかかっています。質問を短くするか、もう一度お試しください。';
          } else if (
            err.message?.includes('network') ||
            err.message?.includes('Network Error') ||
            err.message?.includes('fetch') ||
            !navigator.onLine
          ) {
            errorType = 'network';
            errorMessage =
              'ネットワークエラーが発生しました。インターネット接続を確認してください。';
          } else if (statusCode === 400) {
            errorType = 'general';
            errorMessage = serverErrorMessage || 'リクエストが不正です。入力内容を確認してください。';
          } else if (statusCode === 500) {
            errorType = 'general';
            errorMessage = serverErrorMessage || 'サーバーエラーが発生しました。しばらくしてから再度お試しください。';
          }

          // エラー状態を設定
          setError({
            type: errorType,
            message: errorMessage,
            lastUserMessage: content,
          });

          toast.error(errorMessage);
          break;
        }

        // リトライする場合
        retryCount++;
        console.log(`リトライ中... (${retryCount}/${maxRetries})`);
        
        // 指数バックオフ（1秒、2秒、4秒...）
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
      }
    }

    setIsLoading(false);
  };

  // エラーからの再試行
  const handleRetry = () => {
    if (error?.lastUserMessage) {
      // エラー状態をクリアしてから再試行
      setError(null);
      handleSendMessage(error.lastUserMessage);
    }
  };

  // 会話履歴をクリア
  const handleClearHistory = () => {
    if (window.confirm('会話履歴をクリアしますか？')) {
      setMessages([]);
      setError(null); // エラーもクリア
      toast.success('会話履歴をクリアしました');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <svg
              className="w-16 h-16 text-gray-300 mb-4"
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
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              議事録について質問してください
            </h3>
            <p className="text-sm text-gray-500 max-w-md">
              この会議の内容、決定事項、ネクストアクションなど、何でもお聞きください。
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {/* エラーメッセージ */}
            {error && (
              <ErrorMessage
                type={error.type}
                message={error.message}
                onRetry={handleRetry}
              />
            )}
            
            {/* ローディングインジケーター */}
            {isLoading && <TypingIndicator />}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 会話履歴クリアボタン */}
      {messages.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClearHistory}
            disabled={isLoading}
            className="text-sm text-gray-600 hover:text-gray-800 active:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            🗑️ 会話履歴をクリア
          </button>
        </div>
      )}

      {/* 入力エリア */}
      <ChatInput onSend={handleSendMessage} disabled={isLoading} />
    </div>
  );
}
