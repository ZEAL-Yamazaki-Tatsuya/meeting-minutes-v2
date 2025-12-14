/**
 * Meeting Job data model
 * Represents a job for processing a meeting video and generating minutes
 */

export type JobStatus =
  | 'UPLOADED'      // アップロード完了
  | 'TRANSCRIBING'  // 文字起こし中
  | 'GENERATING'    // 議事録生成中
  | 'COMPLETED'     // 完了
  | 'FAILED';       // 失敗

export interface MeetingJobMetadata {
  meetingTitle?: string;
  meetingDate?: string;
  participants?: string[];
}

export interface MeetingContext {
  meetingType?: string; // 会議の種類（例：定例会議、プロジェクト会議、ブレスト等）
  attendees?: string[]; // 出席者リスト
  focusAreas?: string[]; // 重点的に整理したい項目
  additionalInstructions?: string; // 追加の指示
}

export interface MeetingJob {
  jobId: string;              // Partition Key (UUID)
  userId: string;             // Sort Key
  status: JobStatus;
  createdAt: string;          // ISO 8601 timestamp
  updatedAt: string;          // ISO 8601 timestamp

  // ファイル情報
  videoFileName: string;
  videoS3Key: string;
  videoSize: number;
  videoDuration?: number;

  // 処理情報
  transcribeJobName?: string;
  transcriptS3Key?: string;
  minutesS3Key?: string;

  // 議事録情報
  summaryPreview?: string;    // 概要の最初の200文字（一覧表示用）

  // エラー情報
  errorMessage?: string;

  // メタデータ
  metadata?: MeetingJobMetadata;

  // 会議コンテキスト（議事録生成の精度向上用）
  meetingContext?: MeetingContext;

  // TTL for automatic cleanup (optional)
  ttl?: number;
}

export interface CreateMeetingJobInput {
  userId: string;
  videoFileName: string;
  videoS3Key: string;
  videoSize: number;
  metadata?: MeetingJobMetadata;
  meetingContext?: MeetingContext;
}

export interface UpdateMeetingJobInput {
  jobId: string;
  userId: string;
  status?: JobStatus;
  videoDuration?: number;
  transcribeJobName?: string;
  transcriptS3Key?: string;
  minutesS3Key?: string;
  summaryPreview?: string;
  errorMessage?: string;
  metadata?: MeetingJobMetadata;
  topics?: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
  }>;
}

export interface ListJobsQuery {
  userId: string;
  limit?: number;
  lastEvaluatedKey?: Record<string, any>;
}

export interface ListJobsResult {
  jobs: MeetingJob[];
  lastEvaluatedKey?: Record<string, any>;
}
