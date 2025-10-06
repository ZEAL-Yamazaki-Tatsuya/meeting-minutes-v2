/**
 * Transcript data models
 * AWS Transcribeの出力形式と解析結果のモデル
 */

// AWS Transcribeの出力形式
export interface TranscribeOutput {
  jobName: string;
  accountId: string;
  results: TranscribeResults;
  status: string;
}

export interface TranscribeResults {
  transcripts: TranscriptText[];
  items: TranscribeItem[];
  speaker_labels?: SpeakerLabels;
}

export interface TranscriptText {
  transcript: string;
}

export interface TranscribeItem {
  start_time?: string;
  end_time?: string;
  alternatives: Alternative[];
  type: 'pronunciation' | 'punctuation';
  speaker_label?: string;
}

export interface Alternative {
  confidence: string;
  content: string;
}

export interface SpeakerLabels {
  speakers: number;
  segments: SpeakerSegment[];
}

export interface SpeakerSegment {
  start_time: string;
  end_time: string;
  speaker_label: string;
  items: SpeakerItem[];
}

export interface SpeakerItem {
  start_time: string;
  end_time: string;
  speaker_label: string;
}

// 解析後のデータモデル
export interface ParsedTranscript {
  fullText: string;
  duration: number;
  speakerCount: number;
  segments: TranscriptSegment[];
}

export interface TranscriptSegment {
  speakerId: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
}

export interface Speaker {
  id: string;
  segmentCount: number;
  totalDuration: number;
}
