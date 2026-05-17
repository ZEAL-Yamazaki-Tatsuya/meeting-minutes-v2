import { MetadataFormErrors, ParticipantEntry } from '@/types';

/**
 * メタデータフォームのバリデーションを実行する
 *
 * - meetingName が空の場合: エラーメッセージを返す
 * - meetingStartDate が空の場合: エラーメッセージを返す
 * - meetingEndDate が入力されている場合: 開始日時より後であることを検証
 * - participants に1名も name が非空のエントリがない場合: エラーメッセージを返す
 * - すべてOKの場合: 空オブジェクトを返す
 */
export function validateMetadataForm(
  meetingName: string,
  meetingStartDate: string,
  meetingEndDate: string,
  participants: ParticipantEntry[]
): MetadataFormErrors {
  const errors: MetadataFormErrors = {};

  // 会議名のバリデーション: 空文字・ホワイトスペースのみは不可
  if (!meetingName.trim()) {
    errors.meetingName = '会議名を入力してください';
  }

  // 開始日時のバリデーション: 空文字は不可
  if (!meetingStartDate.trim()) {
    errors.meetingDate = '開始日時を入力してください';
  }

  // 終了日時のバリデーション: 入力されている場合、開始日時より後であること
  if (meetingEndDate.trim() && meetingStartDate.trim()) {
    const startTime = new Date(meetingStartDate).getTime();
    const endTime = new Date(meetingEndDate).getTime();
    if (endTime <= startTime) {
      errors.meetingEndDate = '終了日時は開始日時より後に設定してください';
    }
  }

  // 参加者のバリデーション: 1名以上の name が非空であること
  const hasValidParticipant = participants.some(
    (participant) => participant.name.trim() !== ''
  );
  if (!hasValidParticipant) {
    errors.participants = '参加者を1名以上入力してください';
  }

  return errors;
}

/**
 * 参加者リストから名前が空文字またはホワイトスペースのみのエントリを除外する
 *
 * 送信前に参加者リストから不要な空エントリを取り除くために使用する
 */
export function filterEmptyParticipants(
  participants: ParticipantEntry[]
): ParticipantEntry[] {
  return participants.filter((participant) => participant.name.trim() !== '');
}

/**
 * 日時の範囲表示をフォーマットする
 *
 * - 開始日時と終了日時の両方がある場合: 「YYYY/MM/DD HH:MM 〜 HH:MM」形式
 * - 開始日時のみの場合: 「YYYY/MM/DD HH:MM」形式
 */
export function formatMeetingDateRange(
  startDate: string,
  endDate?: string | null
): string {
  const start = new Date(startDate);

  // 日付部分と時刻部分をフォーマット
  const dateStr = start.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/-/g, '/');

  const startTimeStr = start.toLocaleString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // 終了日時がある場合は時間帯表示
  if (endDate && endDate.trim()) {
    const end = new Date(endDate);
    const endTimeStr = end.toLocaleString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${dateStr} ${startTimeStr} 〜 ${endTimeStr}`;
  }

  // 開始日時のみの場合
  return `${dateStr} ${startTimeStr}`;
}

/**
 * 参加者の表示文字列を生成する
 *
 * - 新形式（{company, name}）で company が非空の場合: 「会社名 / 名前」形式
 * - 新形式で company が空の場合: 名前のみ
 * - 旧形式（string）の場合: そのまま返す
 */
export function formatParticipant(
  participant: string | { company: string; name: string }
): string {
  // 旧形式（string）の場合はそのまま返す
  if (typeof participant === 'string') {
    return participant;
  }

  // 新形式: company が非空の場合は「会社名 / 名前」形式
  if (participant.company && participant.company.trim() !== '') {
    return `${participant.company} / ${participant.name}`;
  }

  // 新形式: company が空の場合は名前のみ
  return participant.name;
}

/**
 * 文字列配列から空文字列・ホワイトスペースのみの要素を除外する
 *
 * 送信前に論点リストから不要な空要素を取り除くために使用する
 */
export function filterEmptyValues(values: string[]): string[] {
  return values.filter((value) => value.trim() !== '');
}

/**
 * 表示用の日時を解決する
 *
 * meetingDate が存在する場合はそれを優先し、
 * 存在しない場合は createdAt にフォールバックする
 */
export function resolveDisplayDate(
  meetingDate: string | undefined | null,
  createdAt: string
): string {
  // meetingDate が存在し、空文字でない場合はそれを使用
  if (meetingDate && meetingDate.trim() !== '') {
    return meetingDate;
  }
  // フォールバック: createdAt を返す
  return createdAt;
}
