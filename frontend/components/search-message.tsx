'use client';

/**
 * 検索メッセージコンポーネント
 * ユーザーメッセージとAIメッセージ（検索結果含む）を表示
 */

export interface SearchResult {
  jobId: string;
  meetingName: string;
  createdAt: string;
  excerpt: string;
  relevanceScore: number;
}

export interface SearchMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  results?: SearchResult[];
  timestamp: string;
}

interface SearchMessageProps {
  message: SearchMessage;
}

export default function SearchMessage({ message }: SearchMessageProps) {
  const isUser = message.role === 'user';

  // タイムスタンプをフォーマット
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 日時をフォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 議事録詳細ページに遷移（新しいタブで開く）
  const handleResultClick = (jobId: string) => {
    window.open(`/jobs/${jobId}/minutes`, '_blank', 'noopener,noreferrer');
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
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* 検索結果（AIメッセージの場合のみ） */}
        {!isUser && message.results && message.results.length > 0 && (
          <div className="mt-4 space-y-3">
            {message.results.map((result) => (
              <div
                key={result.jobId}
                onClick={() => handleResultClick(result.jobId)}
                className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
              >
                {/* 会議名 */}
                <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">
                  {result.meetingName}
                </h4>

                {/* 作成日時 */}
                <p className="text-xs text-gray-500 mb-2">
                  {formatDate(result.createdAt)}
                </p>

                {/* 抜粋 */}
                <p className="text-sm text-gray-700 line-clamp-3">
                  {result.excerpt}
                </p>

                {/* 関連度スコア（デバッグ用、本番では非表示にしても良い） */}
                {result.relevanceScore && (
                  <div className="mt-2 flex items-center">
                    <span className="text-xs text-gray-500">
                      関連度: {Math.round(result.relevanceScore * 100)}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 検索結果なし */}
        {!isUser && message.results && message.results.length === 0 && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">
              該当する議事録が見つかりませんでした。
            </p>
          </div>
        )}

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
