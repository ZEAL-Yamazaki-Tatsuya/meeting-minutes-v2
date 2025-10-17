'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import apiService from '@/lib/api-service';
import { FILE_UPLOAD_CONFIG } from '@/lib/config';
import ProtectedRoute from '@/components/protected-route';

/**
 * ファイルアップロードページ
 */
function UploadPageContent() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // 会議コンテキスト（オプション）
  const [meetingType, setMeetingType] = useState('');
  const [attendees, setAttendees] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  /**
   * ファイルバリデーション
   */
  const validateFile = useCallback((file: File): string | null => {
    // ファイル形式チェック
    if (!FILE_UPLOAD_CONFIG.acceptedFormats.includes(file.type)) {
      return 'MP4ファイルのみアップロード可能です';
    }

    // 拡張子チェック
    const hasValidExtension = FILE_UPLOAD_CONFIG.acceptedExtensions.some(
      ext => file.name.toLowerCase().endsWith(ext)
    );
    if (!hasValidExtension) {
      return 'ファイル拡張子は.mp4である必要があります';
    }

    // ファイルサイズチェック
    if (file.size > FILE_UPLOAD_CONFIG.maxFileSize) {
      const maxSizeGB = FILE_UPLOAD_CONFIG.maxFileSize / (1024 * 1024 * 1024);
      return `ファイルサイズは${maxSizeGB}GB以下である必要があります`;
    }

    // ファイルサイズが0でないことを確認
    if (file.size === 0) {
      return 'ファイルが空です';
    }

    return null;
  }, []);

  /**
   * ファイル選択ハンドラー
   */
  const handleFileSelect = useCallback((selectedFile: File) => {
    const error = validateFile(selectedFile);
    if (error) {
      setValidationError(error);
      setFile(null);
      toast.error(error);
      return;
    }

    setValidationError(null);
    setFile(selectedFile);
    toast.success('ファイルが選択されました');
  }, [validateFile]);

  /**
   * ドラッグオーバーハンドラー
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  /**
   * ドラッグリーブハンドラー
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * ドロップハンドラー
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) {
      return;
    }

    if (droppedFiles.length > 1) {
      toast.error('一度に1つのファイルのみアップロード可能です');
      return;
    }

    handleFileSelect(droppedFiles[0]);
  }, [handleFileSelect]);

  /**
   * ファイル入力変更ハンドラー
   */
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFileSelect(selectedFiles[0]);
    }
  }, [handleFileSelect]);

  /**
   * アップロード処理
   */
  const handleUpload = async () => {
    if (!file) {
      toast.error('ファイルを選択してください');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 会議コンテキストを準備
      const meetingContext = (meetingType || attendees || focusAreas.length > 0 || additionalInstructions) ? {
        meetingType: meetingType || undefined,
        attendees: attendees ? attendees.split(',').map(a => a.trim()).filter(a => a) : undefined,
        focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
        additionalInstructions: additionalInstructions || undefined,
      } : undefined;

      // Presigned URLを取得（ユーザーIDはJWTトークンから自動取得）
      toast.loading('アップロードの準備中...');
      const { jobId, uploadUrl } = await apiService.getUploadUrl(
        file.name,
        file.size,
        file.type || 'video/mp4',
        undefined,
        meetingContext
      );

      // S3に直接アップロード
      toast.dismiss();
      toast.loading('アップロード中...');
      await apiService.uploadFileToS3(uploadUrl, file, (progress) => {
        setUploadProgress(progress);
      });

      toast.dismiss();
      toast.success('アップロードが完了しました！');

      // 処理を開始（Step Functionsワークフローを起動）
      toast.loading('処理を開始しています...');
      try {
        await apiService.startProcessing(jobId);
        toast.dismiss();
        toast.success('処理を開始しました！');
      } catch (error) {
        console.error('Failed to start processing:', error);
        toast.dismiss();
        toast.error('処理の開始に失敗しましたが、ジョブは作成されました');
      }

      // ジョブ詳細ページへリダイレクト
      router.push(`/jobs/${jobId}`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.dismiss();
      
      if (error instanceof Error) {
        toast.error(`アップロードに失敗しました: ${error.message}`);
      } else {
        toast.error('アップロードに失敗しました');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  /**
   * ファイルサイズをフォーマット
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <div className="max-w-3xl mx-auto">
          {/* ヘッダー */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 px-2">
              ファイルアップロード
            </h1>
            <p className="text-sm sm:text-base text-gray-600 px-4">
              MP4形式の会議録画ファイルをアップロードしてください
            </p>
          </div>

          {/* アップロードエリア */}
          <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
            {/* ドラッグ&ドロップエリア */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-6 sm:p-8 lg:p-12 text-center transition-all touch-manipulation
                ${isDragging 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
                }
                ${isUploading ? 'opacity-50 pointer-events-none' : ''}
              `}
            >
              {/* アイコン */}
              <div className="mb-3 sm:mb-4">
                <svg
                  className="mx-auto h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* テキスト */}
              <div className="mb-3 sm:mb-4">
                <p className="text-base sm:text-lg text-gray-700 mb-1 sm:mb-2 px-2">
                  ファイルをドラッグ&ドロップ
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  または
                </p>
              </div>

              {/* ファイル選択ボタン */}
              <label className="inline-block">
                <input
                  type="file"
                  accept=".mp4,video/mp4"
                  onChange={handleFileInputChange}
                  disabled={isUploading}
                  className="hidden"
                />
                <span className="cursor-pointer inline-flex items-center px-4 sm:px-6 py-2.5 sm:py-3 border border-transparent text-sm sm:text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation">
                  ファイルを選択
                </span>
              </label>

              {/* ファイル形式の説明 */}
              <p className="mt-3 sm:mt-4 text-xs text-gray-500 px-2">
                MP4形式のみ対応（最大2GB）
              </p>
            </div>

            {/* 選択されたファイル情報 */}
            {file && (
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-8 w-8 sm:h-10 sm:w-10 text-blue-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  {!isUploading && (
                    <button
                      onClick={() => setFile(null)}
                      className="text-red-600 hover:text-red-800 active:text-red-900 text-xs sm:text-sm font-medium flex-shrink-0 touch-manipulation px-2 py-1"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* バリデーションエラー */}
            {validationError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{validationError}</p>
              </div>
            )}

            {/* アップロード進捗バー */}
            {isUploading && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    アップロード中...
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* 会議コンテキスト（オプション） */}
            {file && !isUploading && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  会議情報（オプション）- 議事録の精度向上
                </h3>
                <p className="text-xs text-gray-600 mb-4">
                  以下の情報を入力すると、より正確で詳細な議事録が生成されます
                </p>
                
                <div className="space-y-4">
                  {/* 会議の種類 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      会議の種類
                    </label>
                    <input
                      type="text"
                      value={meetingType}
                      onChange={(e) => setMeetingType(e.target.value)}
                      placeholder="例：定例会議、プロジェクト会議、ブレスト"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* 出席者 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      出席者（カンマ区切り）
                    </label>
                    <input
                      type="text"
                      value={attendees}
                      onChange={(e) => setAttendees(e.target.value)}
                      placeholder="例：田中、佐藤、鈴木"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* 重点整理項目 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      重点的に整理したい項目
                    </label>
                    <div className="space-y-2">
                      {['決定事項', 'ネクストアクション', '課題・リスク', '議論のポイント'].map((area) => (
                        <label key={area} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={focusAreas.includes(area)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFocusAreas([...focusAreas, area]);
                              } else {
                                setFocusAreas(focusAreas.filter(a => a !== area));
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{area}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 追加の指示 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      追加の指示
                    </label>
                    <textarea
                      value={additionalInstructions}
                      onChange={(e) => setAdditionalInstructions(e.target.value)}
                      placeholder="例：技術的な詳細を重視してください"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* アップロードボタン */}
            <div className="mt-4 sm:mt-6">
              <button
                onClick={handleUpload}
                disabled={!file || isUploading || !!validationError}
                className={`
                  w-full py-3 sm:py-3.5 px-4 rounded-lg font-medium text-white transition-colors text-sm sm:text-base touch-manipulation
                  ${!file || isUploading || validationError
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 active:bg-green-800'
                  }
                `}
              >
                {isUploading ? 'アップロード中...' : 'アップロード開始'}
              </button>
            </div>
          </div>

          {/* 戻るリンク */}
          <div className="text-center">
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:text-blue-800 active:text-blue-900 font-medium text-sm sm:text-base touch-manipulation py-2 px-4"
            >
              ← ホームに戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <ProtectedRoute>
      <UploadPageContent />
    </ProtectedRoute>
  );
}
