'use client';

import { Topic } from '@/types';

interface TopicEditorProps {
  topics: Topic[];
  onUpdate: (topics: Topic[]) => void;
}

/**
 * トピック編集コンポーネント
 * 
 * 議事録のトピック別詳細情報を編集するためのコンポーネントです。
 * トピックの追加、削除、並び替え、タイトルと説明の編集が可能です。
 */
export default function TopicEditor({ topics, onUpdate }: TopicEditorProps) {
  /**
   * トピックを追加する
   */
  const handleAddTopic = () => {
    const newTopic: Topic = {
      id: `topic-${Date.now()}`,
      title: '',
      description: '',
      order: topics.length,
    };
    onUpdate([...topics, newTopic]);
  };

  /**
   * トピックを削除する
   * @param id 削除するトピックのID
   */
  const handleRemoveTopic = (id: string) => {
    const filteredTopics = topics.filter(t => t.id !== id);
    // orderを再計算
    const reorderedTopics = filteredTopics.map((t, index) => ({
      ...t,
      order: index,
    }));
    onUpdate(reorderedTopics);
  };

  /**
   * トピックのフィールドを更新する
   * @param id 更新するトピックのID
   * @param field 更新するフィールド名
   * @param value 新しい値
   */
  const handleUpdateTopic = (id: string, field: keyof Topic, value: string) => {
    onUpdate(
      topics.map(t => t.id === id ? { ...t, [field]: value } : t)
    );
  };

  /**
   * トピックを上に移動する
   * @param index 移動するトピックのインデックス
   */
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newTopics = [...topics];
    [newTopics[index - 1], newTopics[index]] = [newTopics[index], newTopics[index - 1]];
    // orderを再計算
    const reorderedTopics = newTopics.map((t, i) => ({ ...t, order: i }));
    onUpdate(reorderedTopics);
  };

  /**
   * トピックを下に移動する
   * @param index 移動するトピックのインデックス
   */
  const handleMoveDown = (index: number) => {
    if (index === topics.length - 1) return;
    const newTopics = [...topics];
    [newTopics[index], newTopics[index + 1]] = [newTopics[index + 1], newTopics[index]];
    // orderを再計算
    const reorderedTopics = newTopics.map((t, i) => ({ ...t, order: i }));
    onUpdate(reorderedTopics);
  };

  // トピックをorder順にソート
  const sortedTopics = [...topics].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      {sortedTopics.map((topic, index) => (
        <div
          key={topic.id}
          className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200"
        >
          {/* タイトル入力エリア */}
          <div className="flex items-start gap-2 mb-2">
            <span className="text-blue-600 font-semibold mt-2 flex-shrink-0 text-sm sm:text-base">
              {index + 1}.
            </span>
            <input
              type="text"
              value={topic.title}
              onChange={(e) => handleUpdateTopic(topic.id, 'title', e.target.value)}
              className="flex-1 p-2 border border-gray-300 rounded text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="トピックのタイトル"
            />
            {/* 操作ボタン */}
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                className="p-1 px-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
                title="上に移動"
                type="button"
              >
                ↑
              </button>
              <button
                onClick={() => handleMoveDown(index)}
                disabled={index === topics.length - 1}
                className="p-1 px-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
                title="下に移動"
                type="button"
              >
                ↓
              </button>
              <button
                onClick={() => handleRemoveTopic(topic.id)}
                className="p-1 px-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors text-sm sm:text-base font-bold"
                title="削除"
                type="button"
              >
                ×
              </button>
            </div>
          </div>
          
          {/* 説明入力エリア */}
          <textarea
            value={topic.description}
            onChange={(e) => handleUpdateTopic(topic.id, 'description', e.target.value)}
            className="w-full min-h-[80px] sm:min-h-[100px] p-2 border border-gray-300 rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder="トピックの詳細説明（100-300文字）"
            maxLength={500}
          />
          <div className="text-xs text-gray-500 mt-1 text-right">
            {topic.description.length} / 500文字
          </div>
        </div>
      ))}
      
      {/* トピック追加ボタン */}
      <button
        onClick={handleAddTopic}
        className="w-full py-2 sm:py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors text-sm sm:text-base font-medium"
        type="button"
      >
        + トピックを追加
      </button>
    </div>
  );
}
