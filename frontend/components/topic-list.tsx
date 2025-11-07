'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Topic } from '@/types';

interface TopicListProps {
  topics: Topic[];
}

/**
 * トピック一覧表示コンポーネント
 * 
 * 議事録のトピック別詳細情報を視覚的に区別して表示します。
 * レスポンシブデザインに対応し、モバイルデバイスでも快適に閲覧できます。
 */
export default function TopicList({ topics }: TopicListProps) {
  // トピックをorder順にソート
  const sortedTopics = [...topics].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3 sm:space-y-4">
      {sortedTopics.map((topic, index) => (
        <div
          key={topic.id}
          className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200 hover:shadow-md transition-shadow"
        >
          {/* トピックタイトル */}
          <h4 className="text-sm sm:text-base font-semibold text-blue-900 mb-2 flex items-start">
            <span className="flex-shrink-0 mr-2">{index + 1}.</span>
            <span className="break-words">{topic.title}</span>
          </h4>
          
          {/* トピック説明 */}
          <div className="text-xs sm:text-sm text-gray-700 prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {topic.description}
            </ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}
