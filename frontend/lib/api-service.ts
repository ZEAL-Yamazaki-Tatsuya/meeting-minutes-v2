import apiClient from './api-client';
import {
  Job,
  Minutes,
  UploadResponse,
  JobListResponse,
} from '@/types';

/**
 * APIサービスクラス
 * バックエンドAPIとの通信を管理
 */
class APIService {
  /**
   * アップロード用のPresigned URLを取得
   * @param fileName ファイル名
   * @param fileSize ファイルサイズ
   * @param userId ユーザーID
   * @returns ジョブIDとアップロードURL
   */
  async getUploadUrl(
    fileName: string,
    fileSize: number,
    userId: string
  ): Promise<UploadResponse> {
    const response = await apiClient.post<UploadResponse>('/api/upload', {
      fileName,
      fileSize,
      userId,
    });
    return response.data;
  }

  /**
   * S3に直接ファイルをアップロード
   * @param uploadUrl Presigned URL
   * @param file アップロードするファイル
   * @param onProgress 進捗コールバック
   */
  async uploadFileToS3(
    uploadUrl: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    // S3への直接アップロードはaxiosを直接使用（baseURLを使わない）
    const axios = (await import('axios')).default;
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    });
  }

  /**
   * ジョブステータスを取得
   * @param jobId ジョブID
   * @returns ジョブ情報
   */
  async getJobStatus(jobId: string): Promise<Job> {
    const response = await apiClient.get<Job>(`/api/jobs/${jobId}`);
    return response.data;
  }

  /**
   * ジョブ一覧を取得
   * @param userId ユーザーID
   * @param lastEvaluatedKey ページネーション用のキー
   * @returns ジョブ一覧
   */
  async listJobs(
    userId: string,
    lastEvaluatedKey?: string
  ): Promise<JobListResponse> {
    const params: Record<string, string> = { userId };
    if (lastEvaluatedKey) {
      params.lastEvaluatedKey = lastEvaluatedKey;
    }
    const response = await apiClient.get<JobListResponse>('/api/jobs', {
      params,
    });
    return response.data;
  }

  /**
   * 議事録を取得
   * @param jobId ジョブID
   * @returns 議事録データ
   */
  async getMinutes(jobId: string): Promise<Minutes> {
    const response = await apiClient.get<Minutes>(
      `/api/jobs/${jobId}/minutes`
    );
    return response.data;
  }

  /**
   * 議事録のダウンロードURLを取得
   * @param jobId ジョブID
   * @param format ダウンロード形式（markdown, pdf, text）
   * @returns ダウンロードURL
   */
  async getDownloadUrl(
    jobId: string,
    format: 'markdown' | 'pdf' | 'text' = 'markdown'
  ): Promise<string> {
    const response = await apiClient.get<{ downloadUrl: string }>(
      `/api/jobs/${jobId}/download`,
      {
        params: { format },
      }
    );
    return response.data.downloadUrl;
  }

  /**
   * 議事録を更新（編集機能）
   * @param jobId ジョブID
   * @param minutes 更新する議事録データ
   * @returns 更新された議事録
   */
  async updateMinutes(jobId: string, minutes: Partial<Minutes>): Promise<Minutes> {
    const response = await apiClient.put<Minutes>(
      `/api/jobs/${jobId}/minutes`,
      minutes
    );
    return response.data;
  }
}

// シングルトンインスタンスをエクスポート
const apiService = new APIService();
export default apiService;
