import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { JobStatus } from '@/types';

/**
 * Tailwind CSSクラスをマージ
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * ファイルサイズを人間が読みやすい形式に変換
 * @param bytes バイト数
 * @returns フォーマットされた文字列
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 日時を人間が読みやすい形式に変換
 * @param dateString ISO 8601形式の日時文字列
 * @returns フォーマットされた日時文字列
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * 相対時間を取得（例: "3分前"）
 * @param dateString ISO 8601形式の日時文字列
 * @returns 相対時間文字列
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'たった今';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}分前`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}時間前`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}日前`;
  } else {
    return formatDate(dateString);
  }
}

/**
 * ジョブステータスを日本語に変換
 * @param status ジョブステータス
 * @returns 日本語のステータス
 */
export function getStatusLabel(status: JobStatus): string {
  const statusLabels: Record<JobStatus, string> = {
    UPLOADED: 'アップロード完了',
    TRANSCRIBING: '文字起こし中',
    GENERATING: '議事録生成中',
    COMPLETED: '完了',
    FAILED: '失敗',
  };
  return statusLabels[status] || status;
}

/**
 * ジョブステータスに応じた色を取得
 * @param status ジョブステータス
 * @returns Tailwind CSSの色クラス
 */
export function getStatusColor(status: JobStatus): string {
  const statusColors: Record<JobStatus, string> = {
    UPLOADED: 'bg-blue-100 text-blue-800',
    TRANSCRIBING: 'bg-yellow-100 text-yellow-800',
    GENERATING: 'bg-purple-100 text-purple-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
  };
  return statusColors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * ファイル名からファイル拡張子を取得
 * @param fileName ファイル名
 * @returns 拡張子
 */
export function getFileExtension(fileName: string): string {
  return fileName.slice(((fileName.lastIndexOf('.') - 1) >>> 0) + 2);
}

/**
 * ファイルバリデーション
 * @param file ファイル
 * @param maxSize 最大サイズ（バイト）
 * @param acceptedFormats 許可されるMIMEタイプ
 * @returns バリデーション結果
 */
export function validateFile(
  file: File,
  maxSize: number,
  acceptedFormats: string[]
): { valid: boolean; error?: string } {
  // ファイルサイズチェック
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `ファイルサイズが大きすぎます。最大${formatFileSize(maxSize)}まで対応しています。`,
    };
  }

  // ファイル形式チェック
  if (!acceptedFormats.includes(file.type)) {
    return {
      valid: false,
      error: `このファイル形式はサポートされていません。MP4ファイルをアップロードしてください。`,
    };
  }

  // 拡張子チェック
  const extension = getFileExtension(file.name).toLowerCase();
  if (extension !== 'mp4') {
    return {
      valid: false,
      error: `ファイル拡張子が正しくありません。.mp4ファイルをアップロードしてください。`,
    };
  }

  return { valid: true };
}

/**
 * エラーメッセージを取得
 * @param error エラーオブジェクト
 * @returns ユーザーフレンドリーなエラーメッセージ
 */
export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { message?: string } } };
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message);
  }
  return 'エラーが発生しました。もう一度お試しください。';
}
