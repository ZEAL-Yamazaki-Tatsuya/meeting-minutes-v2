import apiClient from './api-client';
import cacheStorage from './cache';
import {
  Job,
  Minutes,
  UploadResponse,
  JobListResponse,
  MinutesListResponse,
  MinutesFilters,
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
   * @param contentType ファイルのMIMEタイプ
   * @param metadata メタデータ（オプション）
   * @param meetingContext 会議コンテキスト（オプション）
   * @returns ジョブIDとアップロードURL
   */
  async getUploadUrl(
    fileName: string,
    fileSize: number,
    contentType: string = 'video/mp4',
    metadata?: {
      meetingTitle?: string;
      meetingDate?: string;
      participants?: string[];
    },
    meetingContext?: {
      meetingType?: string;
      attendees?: string[];
      focusAreas?: string[];
      additionalInstructions?: string;
    }
  ): Promise<UploadResponse> {
    const response = await apiClient.post<UploadResponse>('/api/upload', {
      fileName,
      fileSize,
      contentType,
      metadata,
      meetingContext,
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
    const response = await apiClient.get<{ success: boolean; data: Job }>(`/api/jobs/${jobId}`);
    return response.data.data;
  }

  /**
   * ジョブ一覧を取得
   * @param lastEvaluatedKey ページネーション用のキー
   * @returns ジョブ一覧
   */
  async listJobs(
    lastEvaluatedKey?: string
  ): Promise<JobListResponse> {
    const params: Record<string, string> = {};
    if (lastEvaluatedKey) {
      params.lastEvaluatedKey = lastEvaluatedKey;
    }
    const response = await apiClient.get<{ success: boolean; data: JobListResponse }>('/api/jobs', {
      params,
    });
    return response.data.data;
  }

  /**
   * 議事録を取得
   * @param jobId ジョブID
   * @returns 議事録データ
   */
  async getMinutes(jobId: string): Promise<Minutes> {
    const response = await apiClient.get<{ success: boolean; data: Minutes }>(
      `/api/jobs/${jobId}/minutes`
    );
    return response.data.data;
  }

  /**
   * 議事録のダウンロードURLを取得
   * @param jobId ジョブID
   * @param format ダウンロード形式（markdown, text）
   * @returns ダウンロードURL
   */
  async getDownloadUrl(
    jobId: string,
    format: 'markdown' | 'text' = 'markdown'
  ): Promise<string> {
    const response = await apiClient.get<{ success: boolean; data: { downloadUrl: string } }>(
      `/api/jobs/${jobId}/download`,
      {
        params: { format },
      }
    );
    return response.data.data.downloadUrl;
  }

  /**
   * 議事録を更新（編集機能）
   * @param jobId ジョブID
   * @param minutes 更新する議事録データ
   * @returns 更新された議事録
   */
  async updateMinutes(jobId: string, minutes: Partial<Minutes>): Promise<Minutes> {
    const response = await apiClient.put<{ success: boolean; data: Minutes }>(
      `/api/jobs/${jobId}/minutes`,
      minutes
    );
    return response.data.data;
  }

  /**
   * 処理を開始（Step Functionsワークフローを起動）
   * @param jobId ジョブID
   * @returns 処理開始結果
   */
  async startProcessing(jobId: string): Promise<{ jobId: string; executionArn: string; message: string }> {
    const response = await apiClient.post<{ success: boolean; data: { jobId: string; executionArn: string; message: string } }>(
      `/api/jobs/${jobId}/start`
    );
    return response.data.data;
  }

  /**
   * チャットメッセージを送信
   * @param jobId ジョブID
   * @param message ユーザーのメッセージ
   * @param context 議事録コンテキスト
   * @param history 会話履歴
   * @returns AIの回答
   */
  async sendChatMessage(
    jobId: string,
    message: string,
    context: {
      summary: string;
      decisions: { id: string; description: string; timestamp?: string }[];
      nextActions: { id: string; description: string; assignee?: string; dueDate?: string; timestamp?: string }[];
      transcript: string;
    },
    history: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<{ message: string; timestamp: string }> {
    const response = await apiClient.post<{
      success: boolean;
      data: { message: string; timestamp: string };
    }>(`/api/jobs/${jobId}/chat`, {
      message,
      context,
      history,
    });
    return response.data.data;
  }

  /**
   * 議事録一覧を取得
   * @param userId ユーザーID
   * @param page ページ番号（デフォルト: 1）
   * @param limit 1ページあたりの件数（デフォルト: 20）
   * @param filters フィルター条件
   * @param useCache キャッシュを使用するか（デフォルト: true）
   * @returns 議事録一覧
   */
  async fetchMinutes(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: MinutesFilters,
    useCache: boolean = true
  ): Promise<MinutesListResponse> {
    // キャッシュキーを生成
    const cacheKey = cacheStorage.generateKey(userId, page, limit, filters);

    // キャッシュを確認
    if (useCache) {
      const cachedData = cacheStorage.get<MinutesListResponse>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    // キャッシュがない場合はAPI呼び出し
    const params: Record<string, string> = {
      page: page.toString(),
      limit: limit.toString(),
    };

    // フィルター条件を追加
    if (filters?.startDate) {
      params.startDate = filters.startDate;
    }
    if (filters?.endDate) {
      params.endDate = filters.endDate;
    }
    if (filters?.meetingName) {
      params.meetingName = filters.meetingName;
    }

    const response = await apiClient.get<{ success: boolean; data: MinutesListResponse }>(
      '/api/minutes',
      { params }
    );

    // レスポンスをキャッシュに保存
    if (useCache) {
      cacheStorage.set(cacheKey, response.data.data);
    }

    return response.data.data;
  }

  /**
   * 議事録キャッシュをクリア
   * @param userId ユーザーID
   */
  clearMinutesCache(userId: string): void {
    cacheStorage.clearUserCache(userId);
  }

  /**
   * AI検索を実行
   * @param query 検索クエリ
   * @param history 会話履歴
   * @returns 検索結果
   */
  async searchMinutes(
    query: string,
    history: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<{
    message: string;
    results: {
      jobId: string;
      meetingName: string;
      createdAt: string;
      excerpt: string;
      relevanceScore: number;
    }[];
    timestamp: string;
  }> {
    const response = await apiClient.post<{
      success: boolean;
      data: {
        message: string;
        results: {
          jobId: string;
          meetingName: string;
          createdAt: string;
          excerpt: string;
          relevanceScore: number;
        }[];
        timestamp: string;
      };
    }>('/api/minutes/search', {
      query,
      history,
    });
    return response.data.data;
  }
}

// シングルトンインスタンスをエクスポート
const apiService = new APIService();
export default apiService;
