// 参加者エントリの型定義（会社名+名前）
export interface ParticipantEntry {
  company: string;  // 会社名（任意）
  name: string;     // 名前（必須）
}

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
    agenda?: string[];       // 論点リスト
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

// 議論内容の各発言の型定義
export interface DiscussionEntry {
  speaker: string;
  content: string;
}

// 論点ごとのネクストアクションの型定義
export interface AgendaNextAction {
  assignee: string;
  action: string;
  dueDate?: string;
}

// 論点（議題）ごとの構造の型定義
export interface AgendaItem {
  id: string;
  issue: string;
  discussion: DiscussionEntry[];
  conclusion: string;
  nextIssues: string[];
  nextActions: AgendaNextAction[];
  order: number;
}

// 議事録の型定義
export interface Minutes {
  jobId: string;
  userId: string;
  generatedAt: string;
  videoFileName: string;
  meetingTitle?: string;
  meetingDate?: string;        // 会議開始日時
  meetingEndDate?: string;     // 会議終了日時
  participants?: string[] | ParticipantEntry[];  // 参加者リスト（旧形式・新形式のユニオン型）
  summary: string;
  agendaItems?: AgendaItem[];
  decisions: Decision[];
  nextActions: NextAction[];
  transcript: string;
  formattedTranscript?: string; // 整形された文字起こし（話者・タイムスタンプ付き）
  speakers?: Speaker[];
  topics?: Topic[]; // トピック別詳細（後方互換性のため）
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
  meetingDate?: string;        // 会議開始日時
  meetingEndDate?: string;     // 会議終了日時
  summaryPreview: string;
  status: JobStatus;
}

// メタデータフォームのバリデーションエラー型定義
export interface MetadataFormErrors {
  meetingName?: string;        // 会議名のエラーメッセージ
  meetingDate?: string;        // 開始日時のエラーメッセージ
  meetingEndDate?: string;     // 終了日時のエラーメッセージ
  participants?: string;       // 参加者のエラーメッセージ
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
