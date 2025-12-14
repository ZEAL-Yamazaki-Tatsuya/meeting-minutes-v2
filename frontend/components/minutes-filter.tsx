import { useState } from 'react';
import { MinutesFilters } from '@/types';

interface MinutesFilterProps {
  filters: MinutesFilters;
  onFilterChange: (filters: MinutesFilters) => void;
  onClear: () => void;
}

/**
 * 議事録フィルターコンポーネント
 * 日付範囲入力フィールド、会議名検索フィールド、フィルタークリアボタン
 */
export default function MinutesFilter({ filters, onFilterChange, onClear }: MinutesFilterProps) {
  const [localFilters, setLocalFilters] = useState<MinutesFilters>(filters);
  const [isExpanded, setIsExpanded] = useState(false);

  // フィルター値の変更
  const handleChange = (field: keyof MinutesFilters, value: string) => {
    const newFilters = { ...localFilters, [field]: value || undefined };
    setLocalFilters(newFilters);
  };

  // フィルター適用
  const handleApply = () => {
    onFilterChange(localFilters);
  };

  // フィルタークリア
  const handleClear = () => {
    setLocalFilters({});
    onClear();
  };

  // アクティブなフィルター数をカウント
  const activeFilterCount = Object.values(filters).filter(v => v).length;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
      {/* フィルターヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-gray-700 font-medium hover:text-gray-900 transition-colors"
        >
          <svg
            className="w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span>フィルター</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={handleClear}
            className="text-sm text-gray-600 hover:text-gray-900 underline transition-colors"
          >
            クリア
          </button>
        )}
      </div>

      {/* フィルターフォーム */}
      {isExpanded && (
        <div className="space-y-4">
          {/* 会議名検索 */}
          <div>
            <label htmlFor="meetingName" className="block text-sm font-medium text-gray-700 mb-1">
              会議名
            </label>
            <input
              type="text"
              id="meetingName"
              value={localFilters.meetingName || ''}
              onChange={(e) => handleChange('meetingName', e.target.value)}
              placeholder="会議名で検索"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
            />
          </div>

          {/* 日付範囲 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                開始日
              </label>
              <input
                type="date"
                id="startDate"
                value={localFilters.startDate || ''}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
              />
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                終了日
              </label>
              <input
                type="date"
                id="endDate"
                value={localFilters.endDate || ''}
                onChange={(e) => handleChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
              />
            </div>
          </div>

          {/* 適用ボタン */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleApply}
              className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm touch-manipulation"
            >
              適用
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
