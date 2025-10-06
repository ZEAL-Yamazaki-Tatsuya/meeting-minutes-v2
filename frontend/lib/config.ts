/**
 * アプリケーション設定
 */

// API Gateway URL
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// アプリケーション名
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Meeting Minutes Generator';

// ファイルアップロード設定
export const FILE_UPLOAD_CONFIG = {
  // 最大ファイルサイズ（2GB）
  maxFileSize: 2 * 1024 * 1024 * 1024,
  // 許可されるファイル形式
  acceptedFormats: ['video/mp4'],
  // 許可される拡張子
  acceptedExtensions: ['.mp4'],
};

// ポーリング設定
export const POLLING_CONFIG = {
  // ポーリング間隔（ミリ秒）
  interval: 5000,
  // 最大ポーリング回数
  maxAttempts: 360, // 30分（5秒 × 360回）
};

// ページネーション設定
export const PAGINATION_CONFIG = {
  // 1ページあたりのアイテム数
  itemsPerPage: 20,
};

// 環境変数の検証
if (!API_URL && process.env.NODE_ENV === 'production') {
  console.warn('警告: NEXT_PUBLIC_API_URLが設定されていません');
}
