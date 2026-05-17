'use client';

import DynamicInputList from '@/components/dynamic-input-list';
import { MetadataFormErrors } from '@/types';

/**
 * MetadataForm コンポーネントの Props
 */
interface MetadataFormProps {
  /** 会議名 */
  meetingName: string;
  /** 開催日時（datetime-local形式） */
  meetingDate: string;
  /** 参加者リスト */
  participants: string[];
  /** 論点リスト */
  agenda: string[];
  /** 会議名変更コールバック */
  onMeetingNameChange: (value: string) => void;
  /** 開催日時変更コールバック */
  onMeetingDateChange: (value: string) => void;
  /** 参加者リスト変更コールバック */
  onParticipantsChange: (value: string[]) => void;
  /** 論点リスト変更コールバック */
  onAgendaChange: (value: string[]) => void;
  /** バリデーションエラー */
  errors: MetadataFormErrors;
}

/**
 * 会議メタデータ入力フォームコンポーネント
 *
 * アップロード画面内に配置し、会議名・開催日時・参加者・論点を入力する。
 * バリデーションエラーはインラインで表示する。
 */
export default function MetadataForm({
  meetingName,
  meetingDate,
  participants,
  agenda,
  onMeetingNameChange,
  onMeetingDateChange,
  onParticipantsChange,
  onAgendaChange,
  errors,
}: MetadataFormProps) {
  return (
    <div className="space-y-6" data-testid="metadata-form">
      {/* 会議名入力欄（必須、最大100文字） */}
      <div>
        <label
          htmlFor="meeting-name"
          className="block text-sm font-medium text-gray-700"
        >
          会議名<span className="text-red-500 ml-1">*</span>
        </label>
        <input
          id="meeting-name"
          type="text"
          value={meetingName}
          onChange={(e) => onMeetingNameChange(e.target.value)}
          placeholder="例: 第1回プロジェクト定例会議"
          maxLength={100}
          required
          className="mt-1 w-full p-2 border border-gray-300 rounded text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
          data-testid="meeting-name-input"
        />
        {errors.meetingName && (
          <p
            className="mt-1 text-sm text-red-600"
            role="alert"
            data-testid="meeting-name-error"
          >
            {errors.meetingName}
          </p>
        )}
      </div>

      {/* 開催日時入力欄（必須） */}
      <div>
        <label
          htmlFor="meeting-date"
          className="block text-sm font-medium text-gray-700"
        >
          開催日時<span className="text-red-500 ml-1">*</span>
        </label>
        <input
          id="meeting-date"
          type="datetime-local"
          value={meetingDate}
          onChange={(e) => onMeetingDateChange(e.target.value)}
          required
          className="mt-1 w-full p-2 border border-gray-300 rounded text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
          data-testid="meeting-date-input"
        />
        {errors.meetingDate && (
          <p
            className="mt-1 text-sm text-red-600"
            role="alert"
            data-testid="meeting-date-error"
          >
            {errors.meetingDate}
          </p>
        )}
      </div>

      {/* 参加者入力欄（必須、DynamicInputList使用、各名前最大50文字） */}
      <div>
        <DynamicInputList
          values={participants}
          onChange={onParticipantsChange}
          placeholder="参加者名を入力"
          label="参加者"
          required
          maxLength={50}
        />
        {errors.participants && (
          <p
            className="mt-1 text-sm text-red-600"
            role="alert"
            data-testid="participants-error"
          >
            {errors.participants}
          </p>
        )}
      </div>

      {/* 論点入力欄（任意、DynamicInputList使用、各項目最大200文字） */}
      <div>
        <DynamicInputList
          values={agenda}
          onChange={onAgendaChange}
          placeholder="論点を入力"
          label="論点"
          required={false}
          maxLength={200}
        />
      </div>
    </div>
  );
}
