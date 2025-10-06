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

// 議事録の型定義
export interface Minutes {
  jobId: string;
  generatedAt: string;
  summary: string;
  decisions: Decision[];
  nextActions: NextAction[];
  transcript: string;
  speakers?: Speaker[];
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
