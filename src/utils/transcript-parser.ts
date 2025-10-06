/**
 * Transcript parser utility
 * AWS Transcribeの出力JSONを解析して構造化されたデータに変換する
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  TranscribeOutput,
  ParsedTranscript,
  TranscriptSegment,
  Speaker,
  TranscribeItem,
} from '../models/transcript';
import { Logger } from './logger';
import { InternalServerError, ValidationError } from './errors';

const logger = new Logger({ module: 'transcript-parser' });

export class TranscriptParser {
  private s3Client: S3Client;

  constructor(s3Client?: S3Client) {
    this.s3Client = s3Client || new S3Client({});
  }

  /**
   * S3からTranscribe出力JSONを取得する
   */
  async fetchTranscriptFromS3(bucket: string, key: string): Promise<TranscribeOutput> {
    try {
      logger.info('S3からTranscript JSONを取得中', { bucket, key });

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new InternalServerError('S3オブジェクトが空です');
      }

      const bodyString = await response.Body.transformToString();
      const transcribeOutput = JSON.parse(bodyString) as TranscribeOutput;

      logger.info('Transcript JSONの取得に成功', {
        jobName: transcribeOutput.jobName,
        status: transcribeOutput.status,
      });

      return transcribeOutput;
    } catch (error) {
      logger.error('Transcript JSONの取得に失敗', error as Error, { bucket, key });
      throw error;
    }
  }

  /**
   * TranscribeOutputを解析して構造化されたデータに変換する
   */
  parseTranscript(transcribeOutput: TranscribeOutput): ParsedTranscript {
    try {
      logger.info('Transcriptの解析を開始', { jobName: transcribeOutput.jobName });

      const { results } = transcribeOutput;

      if (!results || !results.transcripts || results.transcripts.length === 0) {
        throw new ValidationError('Transcript結果が空です');
      }

      // 全文テキストを取得
      const fullText = results.transcripts[0].transcript;

      // 話者情報がある場合はセグメントに分割
      const segments = this.extractSegments(results);

      // 話者情報を集計
      const speakers = this.aggregateSpeakers(segments);

      // 動画の長さを計算
      const duration = this.calculateDuration(results.items);

      const parsed: ParsedTranscript = {
        fullText,
        duration,
        speakerCount: speakers.length,
        segments,
      };

      logger.info('Transcriptの解析に成功', {
        duration,
        speakerCount: speakers.length,
        segmentCount: segments.length,
        textLength: fullText.length,
      });

      return parsed;
    } catch (error) {
      logger.error('Transcriptの解析に失敗', error as Error);
      throw error;
    }
  }

  /**
   * 話者ごとのセグメントを抽出する
   */
  private extractSegments(results: any): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];

    // 話者識別情報がない場合は、全体を1つのセグメントとして扱う
    if (!results.speaker_labels || !results.speaker_labels.segments) {
      logger.warn('話者識別情報がありません。全体を1つのセグメントとして扱います');

      const items = results.items.filter((item: TranscribeItem) => item.type === 'pronunciation');
      if (items.length === 0) {
        return segments;
      }

      const text = results.transcripts[0].transcript;
      const startTime = parseFloat(items[0].start_time || '0');
      const endTime = parseFloat(items[items.length - 1].end_time || '0');
      const avgConfidence = this.calculateAverageConfidence(items);

      segments.push({
        speakerId: 'spk_0',
        startTime,
        endTime,
        text,
        confidence: avgConfidence,
      });

      return segments;
    }

    // 話者識別情報がある場合
    const speakerSegments = results.speaker_labels.segments;

    for (const segment of speakerSegments) {
      const startTime = parseFloat(segment.start_time);
      const endTime = parseFloat(segment.end_time);
      const speakerId = segment.speaker_label;

      // このセグメントに含まれるアイテムを取得
      const segmentItems = results.items.filter((item: TranscribeItem) => {
        if (item.type !== 'pronunciation' || !item.start_time) {
          return false;
        }
        const itemTime = parseFloat(item.start_time);
        return itemTime >= startTime && itemTime <= endTime;
      });

      // テキストを構築
      const text = this.buildTextFromItems(segmentItems, results.items);

      // 平均信頼度を計算
      const confidence = this.calculateAverageConfidence(segmentItems);

      segments.push({
        speakerId,
        startTime,
        endTime,
        text: text.trim(),
        confidence,
      });
    }

    return segments;
  }

  /**
   * アイテムからテキストを構築する（句読点を含む）
   */
  private buildTextFromItems(pronunciationItems: TranscribeItem[], allItems: TranscribeItem[]): string {
    let text = '';
    const startTime = pronunciationItems.length > 0 ? parseFloat(pronunciationItems[0].start_time || '0') : 0;
    const endTime = pronunciationItems.length > 0
      ? parseFloat(pronunciationItems[pronunciationItems.length - 1].end_time || '0')
      : 0;

    for (const item of allItems) {
      if (item.type === 'pronunciation') {
        const itemTime = parseFloat(item.start_time || '0');
        if (itemTime >= startTime && itemTime <= endTime) {
          text += item.alternatives[0].content + ' ';
        }
      } else if (item.type === 'punctuation') {
        // 句読点は前の単語に直接追加
        text = text.trim() + item.alternatives[0].content + ' ';
      }
    }

    return text;
  }

  /**
   * 平均信頼度を計算する
   */
  private calculateAverageConfidence(items: TranscribeItem[]): number {
    if (items.length === 0) {
      return 0;
    }

    const sum = items.reduce((acc, item) => {
      const confidence = parseFloat(item.alternatives[0].confidence || '0');
      return acc + confidence;
    }, 0);

    return sum / items.length;
  }

  /**
   * 話者情報を集計する
   */
  private aggregateSpeakers(segments: TranscriptSegment[]): Speaker[] {
    const speakerMap = new Map<string, Speaker>();

    for (const segment of segments) {
      const existing = speakerMap.get(segment.speakerId);

      if (existing) {
        existing.segmentCount++;
        existing.totalDuration += segment.endTime - segment.startTime;
      } else {
        speakerMap.set(segment.speakerId, {
          id: segment.speakerId,
          segmentCount: 1,
          totalDuration: segment.endTime - segment.startTime,
        });
      }
    }

    return Array.from(speakerMap.values());
  }

  /**
   * 動画の長さを計算する
   */
  private calculateDuration(items: TranscribeItem[]): number {
    const pronunciationItems = items.filter(item => item.type === 'pronunciation' && item.end_time);

    if (pronunciationItems.length === 0) {
      return 0;
    }

    const lastItem = pronunciationItems[pronunciationItems.length - 1];
    return parseFloat(lastItem.end_time || '0');
  }

  /**
   * 整形されたテキストを生成する（話者情報とタイムスタンプ付き）
   */
  formatTranscript(parsed: ParsedTranscript): string {
    let formatted = '';

    for (const segment of parsed.segments) {
      const startTimeFormatted = this.formatTime(segment.startTime);
      const endTimeFormatted = this.formatTime(segment.endTime);

      formatted += `[${startTimeFormatted} - ${endTimeFormatted}] ${segment.speakerId}:\n`;
      formatted += `${segment.text}\n\n`;
    }

    return formatted;
  }

  /**
   * 秒数を HH:MM:SS 形式に変換する
   */
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
