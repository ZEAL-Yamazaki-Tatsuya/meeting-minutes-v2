import axios, { AxiosInstance } from 'axios';
import { getAuthHeader } from './auth';

// APIクライアントのインスタンスを作成
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 60000, // 60秒に延長（チャット機能のため）
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター（認証トークンの追加）
apiClient.interceptors.request.use(
  async (config) => {
    // Cognitoトークンを追加
    const token = await getAuthHeader();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター（エラーハンドリング）
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // エラーハンドリング
    if (error.response) {
      // サーバーからのエラーレスポンス
      console.error('API Error:', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url,
      });
      
      // エラーメッセージをより詳細に
      if (error.response.data?.error?.message) {
        error.message = error.response.data.error.message;
      }
    } else if (error.request) {
      // リクエストは送信されたがレスポンスがない
      console.error('Network Error:', {
        message: error.message,
        code: error.code,
        url: error.config?.url,
      });
    } else {
      // その他のエラー
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
