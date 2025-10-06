/**
 * Minutes data models
 * 議事録の構造化されたデータモデル
 */

export interface Minutes {
  jobId: string;
  generatedAt: string;

  // 議事録の内容
  summary: string;              // 概要
  decisions: Decision[];        // 決定事項
  nextActions: NextAction[];    // ネクストアクション

  // 元データ
  transcript: string;           // 文字起こし全文
  speakers?: Speaker[];         // 話者情報
}

export interface Decision {
  id: string;
  description: string;
  timestamp?: string;           // 文字起こし内のタイムスタンプ
}

export interface NextAction {
  id: string;
  description: string;
  assignee?: string;            // 担当者
  dueDate?: string;             // 期限
  timestamp?: string;
}

export interface Speaker {
  id: string;
  name?: string;                // 識別された場合
  segments: number;             // 発言回数
}

// LLMからのレスポンス形式
export interface LLMMinutesResponse {
  summary: string;
  decisions: Array<{
    description: string;
    timestamp?: string;
  }>;
  nextActions: Array<{
    description: string;
    assignee?: string;
    dueDate?: string;
    timestamp?: string;
  }>;
}
