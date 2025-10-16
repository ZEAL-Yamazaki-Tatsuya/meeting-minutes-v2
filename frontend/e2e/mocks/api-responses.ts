/**
 * テスト用のAPIレスポンスモックデータ
 */

export const mockJob = {
  jobId: 'test-job-123',
  userId: 'test-user-123',
  status: 'COMPLETED',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T01:00:00Z',
  videoFileName: 'test-video.mp4',
  videoS3Key: 'test-user-123/test-job-123/video.mp4',
  videoSize: 1024000,
  transcriptS3Key: 'test-user-123/test-job-123/transcript.json',
  minutesS3Key: 'test-user-123/test-job-123/minutes.md',
};

export const mockJobProcessing = {
  ...mockJob,
  status: 'TRANSCRIBING',
  transcriptS3Key: undefined,
  minutesS3Key: undefined,
};

export const mockJobFailed = {
  ...mockJob,
  status: 'FAILED',
  errorMessage: 'テストエラーメッセージ',
};

export const mockJobList = [
  mockJob,
  {
    ...mockJob,
    jobId: 'test-job-456',
    status: 'TRANSCRIBING',
    createdAt: '2024-01-02T00:00:00Z',
  },
  {
    ...mockJob,
    jobId: 'test-job-789',
    status: 'GENERATING',
    createdAt: '2024-01-03T00:00:00Z',
  },
];

export const mockMinutes = {
  jobId: 'test-job-123',
  generatedAt: '2024-01-01T01:00:00Z',
  summary: 'これはテスト会議の概要です。プロジェクトの進捗について議論しました。',
  decisions: [
    {
      id: 'decision-1',
      description: '次回のリリース日を2024年2月1日に決定',
      timestamp: '00:15:30',
    },
    {
      id: 'decision-2',
      description: '新機能の開発を優先することに合意',
      timestamp: '00:25:45',
    },
  ],
  nextActions: [
    {
      id: 'action-1',
      description: '要件定義書を作成する',
      assignee: '山田太郎',
      dueDate: '2024-01-15',
      timestamp: '00:30:00',
    },
    {
      id: 'action-2',
      description: 'デザインモックを準備する',
      assignee: '佐藤花子',
      dueDate: '2024-01-20',
      timestamp: '00:35:15',
    },
  ],
  transcript: 'これは文字起こしの全文です。\n\n話者1: こんにちは、今日の会議を始めます。\n話者2: よろしくお願いします。',
  speakers: [
    {
      id: 'speaker-1',
      name: '話者1',
      segments: 15,
    },
    {
      id: 'speaker-2',
      name: '話者2',
      segments: 12,
    },
  ],
};

export const mockUploadResponse = {
  jobId: 'test-job-123',
  uploadUrl: 'https://s3.amazonaws.com/test-bucket/presigned-url',
};

export const mockDownloadResponse = {
  downloadUrl: 'https://s3.amazonaws.com/test-bucket/download-url',
};

export const mockAuthUser = {
  userId: 'test-user-123',
  email: 'test@example.com',
  name: 'テストユーザー',
};

export const mockAuthTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  idToken: 'mock-id-token',
};
