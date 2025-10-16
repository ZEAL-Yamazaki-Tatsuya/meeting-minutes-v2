'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import apiService from '@/lib/api-service';
import { Minutes, Decision, NextAction } from '@/types';

/**
 * ローディングスピナーコンポーネント
 */
function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

/**
 * セクションカードコンポーネント
 */
function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
        <span className="mr-3 text-3xl">{icon}</span>
        {title}
      </h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

/**
 * 議事録表示ページ
 */
export default function MinutesPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [minutes, setMinutes] = useState<Minutes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  
  // 編集モード関連の状態
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [editedDecisions, setEditedDecisions] = useState<Decision[]>([]);
  const [editedNextActions, setEditedNextActions] = useState<NextAction[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  
  // ダウンロード関連の状態
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // 議事録を取得
  useEffect(() => {
    const fetchMinutes = async () => {
      try {
        setLoading(true);
        const data = await apiService.getMinutes(jobId);
        setMinutes(data);
        // 編集用の状態を初期化
        setEditedSummary(data.summary);
        setEditedDecisions(data.decisions || []);
        setEditedNextActions(data.nextActions || []);
        setError(null);
      } catch (err) {
        console.error('議事録の取得に失敗しました:', err);
        setError('議事録の取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchMinutes();
  }, [jobId]);

  // ダウンロードメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDownloadMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.download-menu-container')) {
          setShowDownloadMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDownloadMenu]);

  // 編集モードを開始
  const handleStartEdit = () => {
    if (minutes) {
      setEditedSummary(minutes.summary);
      setEditedDecisions([...minutes.decisions]);
      setEditedNextActions([...minutes.nextActions]);
      setIsEditing(true);
    }
  };

  // 編集をキャンセル
  const handleCancelEdit = () => {
    if (minutes) {
      setEditedSummary(minutes.summary);
      setEditedDecisions([...minutes.decisions]);
      setEditedNextActions([...minutes.nextActions]);
      setIsEditing(false);
    }
  };

  // 保存確認ダイアログを表示
  const handleSaveClick = () => {
    setShowSaveConfirm(true);
  };

  // 変更を保存
  const handleConfirmSave = async () => {
    try {
      setIsSaving(true);
      setShowSaveConfirm(false);

      const updatedMinutes = await apiService.updateMinutes(jobId, {
        summary: editedSummary,
        decisions: editedDecisions,
        nextActions: editedNextActions,
      });

      setMinutes(updatedMinutes);
      setIsEditing(false);
      toast.success('議事録を保存しました');
    } catch (err) {
      console.error('議事録の保存に失敗しました:', err);
      toast.error('議事録の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 決定事項を追加
  const handleAddDecision = () => {
    const newDecision: Decision = {
      id: `decision-${Date.now()}`,
      description: '',
    };
    setEditedDecisions([...editedDecisions, newDecision]);
  };

  // 決定事項を削除
  const handleRemoveDecision = (id: string) => {
    setEditedDecisions(editedDecisions.filter((d) => d.id !== id));
  };

  // 決定事項を更新
  const handleUpdateDecision = (id: string, description: string) => {
    setEditedDecisions(
      editedDecisions.map((d) => (d.id === id ? { ...d, description } : d))
    );
  };

  // ネクストアクションを追加
  const handleAddNextAction = () => {
    const newAction: NextAction = {
      id: `action-${Date.now()}`,
      description: '',
    };
    setEditedNextActions([...editedNextActions, newAction]);
  };

  // ネクストアクションを削除
  const handleRemoveNextAction = (id: string) => {
    setEditedNextActions(editedNextActions.filter((a) => a.id !== id));
  };

  // ネクストアクションを更新
  const handleUpdateNextAction = (
    id: string,
    field: keyof NextAction,
    value: string
  ) => {
    setEditedNextActions(
      editedNextActions.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  // ダウンロード処理
  const handleDownload = async (format: 'markdown' | 'pdf' | 'text') => {
    try {
      setIsDownloading(true);
      setShowDownloadMenu(false);

      const downloadUrl = await apiService.getDownloadUrl(jobId, format);
      
      // ダウンロードを実行
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `minutes-${jobId}.${format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('ダウンロードを開始しました');
    } catch (err) {
      console.error('ダウンロードに失敗しました:', err);
      toast.error('ダウンロードに失敗しました');
    } finally {
      setIsDownloading(false);
    }
  };

  // 日時フォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* 戻るボタン */}
          <button
            onClick={() => router.push(`/jobs/${jobId}`)}
            className="mb-6 text-blue-600 hover:text-blue-800 font-medium flex items-center"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            ジョブ詳細に戻る
          </button>

          {/* ヘッダー */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                議事録
              </h1>
              {minutes && (
                <p className="text-gray-600 text-sm">
                  生成日時: {formatDate(minutes.generatedAt)}
                </p>
              )}
            </div>
            
            {/* アクションボタン */}
            {!loading && minutes && !isEditing && (
              <div className="flex gap-3">
                {/* ダウンロードボタン */}
                <div className="relative download-menu-container">
                  <button
                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    disabled={isDownloading}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        ダウンロード中...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        ダウンロード
                      </>
                    )}
                  </button>

                  {/* ダウンロードメニュー */}
                  {showDownloadMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
                      <button
                        onClick={() => handleDownload('markdown')}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center rounded-t-lg"
                      >
                        <span className="mr-3">📄</span>
                        Markdown (.md)
                      </button>
                      <button
                        onClick={() => handleDownload('text')}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center border-t border-gray-100 rounded-b-lg"
                      >
                        <span className="mr-3">📝</span>
                        テキスト (.txt)
                      </button>
                    </div>
                  )}
                </div>

                {/* 編集ボタン */}
                <button
                  onClick={handleStartEdit}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  編集
                </button>
              </div>
            )}

            {/* 保存・キャンセルボタン */}
            {isEditing && (
              <div className="flex gap-3">
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveClick}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      保存中...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      保存
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* ローディング表示 */}
          {loading && <LoadingSpinner />}

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <div className="flex items-start">
                <svg
                  className="w-6 h-6 text-red-500 mr-3 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="text-red-800 font-semibold mb-1">エラー</h3>
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* 議事録表示 */}
          {!loading && minutes && (
            <>
              {/* 概要セクション */}
              <SectionCard title="概要" icon="📋">
                {isEditing ? (
                  <textarea
                    value={editedSummary}
                    onChange={(e) => setEditedSummary(e.target.value)}
                    className="w-full min-h-[150px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="会議の概要を入力してください..."
                  />
                ) : (
                  <div className="prose max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {minutes.summary}
                    </ReactMarkdown>
                  </div>
                )}
              </SectionCard>

              {/* 決定事項セクション */}
              <SectionCard title="決定事項" icon="✅">
                {isEditing ? (
                  <div className="space-y-3">
                    {editedDecisions.map((decision, index) => (
                      <div
                        key={decision.id}
                        className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200"
                      >
                        <span className="text-green-600 mt-3 flex-shrink-0">
                          ✓
                        </span>
                        <textarea
                          value={decision.description}
                          onChange={(e) =>
                            handleUpdateDecision(decision.id, e.target.value)
                          }
                          className="flex-1 min-h-[80px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder={`決定事項 ${index + 1}`}
                        />
                        <button
                          onClick={() => handleRemoveDecision(decision.id)}
                          className="text-red-600 hover:text-red-800 mt-3 flex-shrink-0"
                          title="削除"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={handleAddDecision}
                      className="w-full py-3 border-2 border-dashed border-green-300 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                    >
                      + 決定事項を追加
                    </button>
                  </div>
                ) : minutes.decisions && minutes.decisions.length > 0 ? (
                  <ul className="space-y-3">
                    {minutes.decisions.map((decision) => (
                      <li
                        key={decision.id}
                        className="flex items-start p-4 bg-green-50 rounded-lg border border-green-200"
                      >
                        <span className="text-green-600 mr-3 mt-1 flex-shrink-0">
                          ✓
                        </span>
                        <div className="flex-1">
                          <div className="prose max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {decision.description}
                            </ReactMarkdown>
                          </div>
                          {decision.timestamp && (
                            <p className="text-sm text-gray-500 mt-2">
                              タイムスタンプ: {decision.timestamp}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 italic">決定事項はありません。</p>
                )}
              </SectionCard>

              {/* ネクストアクションセクション */}
              <SectionCard title="ネクストアクション" icon="🎯">
                {isEditing ? (
                  <div className="space-y-3">
                    {editedNextActions.map((action, index) => (
                      <div
                        key={action.id}
                        className="p-4 bg-blue-50 rounded-lg border border-blue-200"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <span className="text-blue-600 mt-3 flex-shrink-0">
                            →
                          </span>
                          <textarea
                            value={action.description}
                            onChange={(e) =>
                              handleUpdateNextAction(
                                action.id,
                                'description',
                                e.target.value
                              )
                            }
                            className="flex-1 min-h-[80px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={`アクション ${index + 1}`}
                          />
                          <button
                            onClick={() => handleRemoveNextAction(action.id)}
                            className="text-red-600 hover:text-red-800 mt-3 flex-shrink-0"
                            title="削除"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-8">
                          <input
                            type="text"
                            value={action.assignee || ''}
                            onChange={(e) =>
                              handleUpdateNextAction(
                                action.id,
                                'assignee',
                                e.target.value
                              )
                            }
                            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="担当者"
                          />
                          <input
                            type="text"
                            value={action.dueDate || ''}
                            onChange={(e) =>
                              handleUpdateNextAction(
                                action.id,
                                'dueDate',
                                e.target.value
                              )
                            }
                            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="期限（例: 2025-10-15）"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={handleAddNextAction}
                      className="w-full py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      + ネクストアクションを追加
                    </button>
                  </div>
                ) : minutes.nextActions && minutes.nextActions.length > 0 ? (
                  <ul className="space-y-3">
                    {minutes.nextActions.map((action) => (
                      <li
                        key={action.id}
                        className="flex items-start p-4 bg-blue-50 rounded-lg border border-blue-200"
                      >
                        <span className="text-blue-600 mr-3 mt-1 flex-shrink-0">
                          →
                        </span>
                        <div className="flex-1">
                          <div className="prose max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {action.description}
                            </ReactMarkdown>
                          </div>
                          <div className="flex flex-wrap gap-4 mt-2 text-sm">
                            {action.assignee && (
                              <span className="text-gray-600">
                                <strong>担当者:</strong> {action.assignee}
                              </span>
                            )}
                            {action.dueDate && (
                              <span className="text-gray-600">
                                <strong>期限:</strong> {action.dueDate}
                              </span>
                            )}
                            {action.timestamp && (
                              <span className="text-gray-500">
                                タイムスタンプ: {action.timestamp}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 italic">
                    ネクストアクションはありません。
                  </p>
                )}
              </SectionCard>

              {/* 話者情報セクション（存在する場合） */}
              {minutes.speakers && minutes.speakers.length > 0 && (
                <SectionCard title="話者情報" icon="👥">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {minutes.speakers.map((speaker) => (
                      <div
                        key={speaker.id}
                        className="p-4 bg-purple-50 rounded-lg border border-purple-200"
                      >
                        <p className="font-semibold text-gray-900">
                          {speaker.name || `話者 ${speaker.id}`}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          発言回数: {speaker.segments}
                        </p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* 文字起こし全文セクション */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
                    <span className="mr-3 text-3xl">📝</span>
                    文字起こし全文
                  </h2>
                  <svg
                    className={`w-6 h-6 text-gray-600 transition-transform ${
                      showTranscript ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showTranscript && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                      {minutes.transcript}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 保存確認ダイアログ */}
          {showSaveConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  変更を保存しますか？
                </h3>
                <p className="text-gray-600 mb-6">
                  議事録の変更内容を保存します。この操作は元に戻せません。
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowSaveConfirm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleConfirmSave}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    保存する
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
