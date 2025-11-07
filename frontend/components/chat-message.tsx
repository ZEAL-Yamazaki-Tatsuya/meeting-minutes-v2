'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * チャットメッセージコンポーネント
 * ユーザーメッセージとAIメッセージを表示
 */

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  // タイムスタンプをフォーマット
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] ${
          isUser
            ? 'bg-blue-600 text-white rounded-l-lg rounded-tr-lg'
            : 'bg-gray-100 text-gray-900 rounded-r-lg rounded-tl-lg'
        } p-3 sm:p-4 shadow-sm`}
      >
        {/* メッセージ内容 */}
        <div className="text-sm sm:text-base break-words">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm sm:prose max-w-none prose-invert:false">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // リンクを新しいタブで開く
                  a: ({ ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" />
                  ),
                  // コードブロックのスタイル調整
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code
                        className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs sm:text-sm"
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <code
                        className="block bg-gray-800 text-gray-100 p-2 rounded text-xs sm:text-sm overflow-x-auto"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* タイムスタンプ */}
        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}
