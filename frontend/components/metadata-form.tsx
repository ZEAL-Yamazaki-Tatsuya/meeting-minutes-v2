'use client';

import DynamicInputList from '@/components/dynamic-input-list';
import { MetadataFormErrors, ParticipantEntry } from '@/types';

/**
 * MetadataForm コンポーネントの Props
 */
interface MetadataFormProps {
  /** 会議名 */
  meetingName: string;
  /** 開始日時（datetime-local形式） */
  meetingStartDate: string;
  /** 終了日時（datetime-local形式、任意） */
  meetingEndDate: string;
  /** 参加者リスト */
  participants: ParticipantEntry[];
  /** 論点リスト */
  agenda: string[];
  /** 会議名変更コールバック */
  onMeetingNameChange: (value: string) => void;
  /** 開始日時変更コールバック */
  onMeetingStartDateChange: (value: string) => void;
  /** 終了日時変更コールバック */
  onMeetingEndDateChange: (value: string) => void;
  /** 参加者リスト変更コールバック */
  onParticipantsChange: (value: ParticipantEntry[]) => void;
  /** 論点リスト変更コールバック */
  onAgendaChange: (value: string[]) => void;
  /** バリデーションエラー */
  errors: MetadataFormErrors;
}

/**
 * 会議メタデータ入力フォームコンポーネント
 *
 * アップロード画面内に配置し、会議名・開始日時・終了日時・参加者・論点を入力する。
 * バリデーションエラーはインラインで表示する。
 */
export default function MetadataForm({
  meetingName,
  meetingStartDate,
  meetingEndDate,
  participants,
  agenda,
  onMeetingNameChange,
  onMeetingStartDateChange,
  onMeetingEndDateChange,
  onParticipantsChange,
  onAgendaChange,
  errors,
}: MetadataFormProps) {
  /**
   * 参加者の名前フィールド変更時の処理
   * - 対象インデックスの name を更新
   * - 空行（name === ''）が存在しなければ新しい空行を追加
   */
  const handleParticipantNameChange = (index: number, newName: string) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], name: newName };

    // 名前に文字が入力されたとき、空行が存在しなければ新しい空行を追加
    if (newName !== '') {
      const hasEmptyRow = updated.some((p) => p.name === '');
      if (!hasEmptyRow) {
        updated.push({ company: '', name: '' });
      }
    }

    onParticipantsChange(updated);
  };

  /**
   * 参加者の会社名フィールド変更時の処理
   */
  const handleParticipantCompanyChange = (index: number, newCompany: string) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], company: newCompany };
    onParticipantsChange(updated);
  };

  /**
   * 参加者行の削除処理
   */
  const handleParticipantRemove = (index: number) => {
    const updated = participants.filter((_, i) => i !== index);
    onParticipantsChange(updated);
  };

  // 削除ボタンを表示するかどうか（行が2つ以上の場合のみ表示）
  const showParticipantRemoveButton = participants.length > 1;

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

      {/* 開始日時入力欄（必須） */}
      <div>
        <label
          htmlFor="meeting-start-date"
          className="block text-sm font-medium text-gray-700"
        >
          開始日時<span className="text-red-500 ml-1">*</span>
        </label>
        <input
          id="meeting-start-date"
          type="datetime-local"
          value={meetingStartDate}
          onChange={(e) => onMeetingStartDateChange(e.target.value)}
          required
          className="mt-1 w-full p-2 border border-gray-300 rounded text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
          data-testid="meeting-start-date-input"
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

      {/* 終了日時入力欄（任意） */}
      <div>
        <label
          htmlFor="meeting-end-date"
          className="block text-sm font-medium text-gray-700"
        >
          終了日時
        </label>
        <input
          id="meeting-end-date"
          type="datetime-local"
          value={meetingEndDate}
          onChange={(e) => onMeetingEndDateChange(e.target.value)}
          className="mt-1 w-full p-2 border border-gray-300 rounded text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
          data-testid="meeting-end-date-input"
        />
        {errors.meetingEndDate && (
          <p
            className="mt-1 text-sm text-red-600"
            role="alert"
            data-testid="meeting-end-date-error"
          >
            {errors.meetingEndDate}
          </p>
        )}
      </div>

      {/* 参加者入力セクション（会社名+名前の2フィールド） */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          参加者<span className="text-red-500 ml-1">*</span>
        </label>

        <div className="mt-1 space-y-2">
          {participants.map((participant, index) => (
            <div key={index} className="flex items-center gap-2">
              {/* 会社名入力欄（任意、最大50文字） */}
              <input
                type="text"
                value={participant.company}
                onChange={(e) => handleParticipantCompanyChange(index, e.target.value)}
                placeholder="会社名"
                maxLength={50}
                className="w-2/5 p-2 border border-gray-300 rounded text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                data-testid={`participant-company-${index}`}
              />

              {/* 名前入力欄（必須、最大50文字） */}
              <input
                type="text"
                value={participant.name}
                onChange={(e) => handleParticipantNameChange(index, e.target.value)}
                placeholder="名前"
                maxLength={50}
                className="flex-1 p-2 border border-gray-300 rounded text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                data-testid={`participant-name-${index}`}
              />

              {/* 削除ボタン（行が1つのみの場合は非表示） */}
              {showParticipantRemoveButton && (
                <button
                  type="button"
                  onClick={() => handleParticipantRemove(index)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 active:bg-red-100 rounded transition-colors touch-manipulation flex-shrink-0"
                  title="削除"
                  aria-label={`参加者の${index + 1}番目を削除`}
                  data-testid={`participant-remove-${index}`}
                >
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 最大文字数の表示 */}
        <p className="mt-1 text-xs text-gray-500">
          各項目最大50文字
        </p>

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
