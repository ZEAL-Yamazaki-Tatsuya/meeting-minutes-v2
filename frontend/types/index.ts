// ジョブステータスの型定義
export type JobStatus = 
  | 'UPLOADED'      // アップロード完了
  | 'TRANSCRIBING'  // 文字起こし中
  | 'GENERATING'    // 議事録生成中
  | 'COMPLETED'     // 完了
  | 'FAILED';       // 失敗

// ジョブの型定義
export interface Job {
  jobId: string;
  userId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  videoFileName: string;
  videoS3Key: string;
  videoSize: number;
  videoDuration?: number;
  transcribeJobName?: string;
  transcriptS3Key?: string;
  minutesS3Key?: string;
  errorMessage?: string;
  metadata?: {
    meetingTitle?: string;
    meetingDate?: string;
    participants?: string[];
  };
}

// 決定事項の型定義
export interface Decision {
  id: string;
  description: string;
  timestamp?: string;
}

// ネクストアクションの型定義
export interface NextAction {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  timestamp?: string;
}

// 話者情報の型定義
export interface Speaker {
  id: string;
  name?: string;
  segments: number;
}

// トピックの型定義
export interface Topic {
  id: string;
  title: string;
  description: string;
  order: number;
}

// 議事録の型定義
export interface Minutes {
  jobId: string;
  userId: string;
  generatedAt: string;
  videoFileName: string;
  meetingTitle?: string;
  summary: string;
  decisions: Decision[];
  nextActions: NextAction[];
  transcript: string;
  formattedTranscript?: string; // 整形された文字起こし（話者・タイムスタンプ付き）
  speakers?: Speaker[];
  topics?: Topic[]; // トピック別詳細（オプショナル：後方互換性のため）
}

// アップロードレスポンスの型定義
export interface UploadResponse {
  jobId: string;
  uploadUrl: string;
}

// ジョブ一覧レスポンスの型定義
export interface JobListResponse {
  jobs: Job[];
  lastEvaluatedKey?: string;
}

// エラーレスポンスの型定義
export interface ErrorResponse {
  error: string;
  message: string;
}

// 議事録サマリーの型定義（一覧表示用）
export interface MinutesSummary {
  jobId: string;
  userId: string;
  meetingName: string;
  createdAt: string;
  summaryPreview: string;
  status: JobStatus;
}

// 議事録フィルターの型定義
export interface MinutesFilters {
  startDate?: string;
  endDate?: string;
  meetingName?: string;
}

// 議事録一覧レスポンスの型定義
export interface MinutesListResponse {
  minutes: MinutesSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
