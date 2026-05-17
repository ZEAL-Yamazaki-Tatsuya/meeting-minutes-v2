import { MinutesSummary } from '@/types';
import { resolveDisplayDate, formatMeetingDateRange } from '@/lib/metadata-validation';

interface MinutesListItemProps {
  minute: MinutesSummary;
  onClick: (jobId: string) => void;
}

/**
 * 議事録一覧アイテムコンポーネント
 * 会議名、日時、概要プレビューを表示
 * meetingDate が存在する場合はそれを優先し、なければ createdAt にフォールバック
 * 終了日時がある場合は時間帯表示（例: 2025/01/15 10:00 〜 11:00）
 */
export default function MinutesListItem({ minute, onClick }: MinutesListItemProps) {
  // 表示用の日時を解決（meetingDate 優先、なければ createdAt にフォールバック）
  const displayDate = resolveDisplayDate(minute.meetingDate, minute.createdAt);
  // 時間帯フォーマットで表示（終了日時がある場合は「〜 HH:MM」を付加）
  const formattedDate = formatMeetingDateRange(displayDate, minute.meetingEndDate);

  return (
    <div
      onClick={() => onClick(minute.jobId)}
      className="bg-white rounded-lg shadow hover:shadow-lg active:shadow-xl transition-shadow cursor-pointer p-4 sm:p-5 lg:p-6 border border-gray-200 touch-manipulation"
      data-testid="minutes-list-item"
    >
      <div className="flex flex-col gap-3">
        {/* 会議名 */}
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-2">
          {minute.meetingName}
        </h3>

        {/* 日時表示（meetingDate 優先、createdAt フォールバック） */}
        <div className="flex items-center text-xs sm:text-sm text-gray-500">
          <svg
            className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-gray-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{formattedDate}</span>
        </div>

        {/* 概要プレビュー */}
        <p className="text-sm text-gray-600 line-clamp-3">
          {minute.summaryPreview}
        </p>

        {/* 詳細を見るボタン */}
        <div className="mt-2 pt-3 border-t border-gray-200">
          <button className="text-blue-600 hover:text-blue-800 active:text-blue-900 text-xs sm:text-sm font-medium flex items-center touch-manipulation">
            詳細を見る
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
