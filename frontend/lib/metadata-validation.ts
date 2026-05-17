import { MetadataFormErrors } from '@/types';

/**
 * メタデータフォームのバリデーションを実行する
 *
 * - meetingName が空の場合: エラーメッセージを返す
 * - meetingDate が空の場合: エラーメッセージを返す
 * - participants に1名も非空文字列がない場合: エラーメッセージを返す
 * - すべてOKの場合: 空オブジェクトを返す
 */
export function validateMetadataForm(
  meetingName: string,
  meetingDate: string,
  participants: string[]
): MetadataFormErrors {
  const errors: MetadataFormErrors = {};

  // 会議名のバリデーション: 空文字・ホワイトスペースのみは不可
  if (!meetingName.trim()) {
    errors.meetingName = '会議名を入力してください';
  }

  // 開催日時のバリデーション: 空文字は不可
  if (!meetingDate.trim()) {
    errors.meetingDate = '開催日時を入力してください';
  }

  // 参加者のバリデーション: 1名以上の非空文字列が必要
  const hasValidParticipant = participants.some(
    (participant) => participant.trim() !== ''
  );
  if (!hasValidParticipant) {
    errors.participants = '参加者を1名以上入力してください';
  }

  return errors;
}

/**
 * 文字列配列から空文字列・ホワイトスペースのみの要素を除外する
 *
 * 送信前に参加者リストや論点リストから不要な空要素を取り除くために使用する
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
