/**
 * Minutes data models
 * 議事録の構造化されたデータモデル
 */

export interface Minutes {
  jobId: string;
  generatedAt: string;

  // 議事録の内容
  summary: string;              // 概要
  agendaItems: AgendaItem[];    // 論点ごとの議事録
  topics?: Topic[];             // トピック別詳細（後方互換性のため）
  decisions: Decision[];        // 決定事項（後方互換性のため）
  nextActions: NextAction[];    // ネクストアクション（後方互換性のため）

  // 元データ
  transcript: string;           // 文字起こし全文（生テキスト）
  formattedTranscript?: string; // 整形された文字起こし（話者・タイムスタンプ付き）
  speakers?: Speaker[];         // 話者情報
}

// 論点（議題）ごとの構造
export interface AgendaItem {
  id: string;
  issue: string;                // 論点：XXXはどうするか？
  discussion: DiscussionEntry[]; // 内容：各発言者の発言
  conclusion: string;           // 結論：XXXとする
  nextIssues: string[];         // ネクスト論点
  nextActions: AgendaNextAction[]; // ネクストアクション
  order: number;
}

// 議論内容の各発言
export interface DiscussionEntry {
  speaker: string;              // 発言者名
  content: string;              // 発言内容
}

// 論点ごとのネクストアクション
export interface AgendaNextAction {
  assignee: string;             // 担当者
  action: string;               // アクション内容
  dueDate?: string;             // 期限（MM/DD形式）
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

export interface Topic {
  id: string;
  title: string;
  description: string;
  order: number;
}

// LLMからのレスポンス形式
export interface LLMMinutesResponse {
  summary: string;
  agendaItems: Array<{
    issue: string;
    discussion: Array<{
      speaker: string;
      content: string;
    }>;
    conclusion: string;
    nextIssues: string[];
    nextActions: Array<{
      assignee: string;
      action: string;
      dueDate?: string;
    }>;
  }>;
  // 後方互換性のため残す
  topics?: Array<{
    title: string;
    description: string;
  }>;
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
