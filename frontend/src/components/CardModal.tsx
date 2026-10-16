import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X,
  AlignLeft,
  Tag,
  CheckSquare,
  Clock,
  Paperclip,
  Copy,
  Archive,
  Trash2,
  Image,
  Upload,
  Plus,
  Eye,
  Edit3,
  ExternalLink,
  Download,
  CheckCircle,
} from 'lucide-react';
import { Card, Label, ListModel, Checklist, Attachment } from '../types';
import {
  updateCard,
  copyCard,
  archiveCard,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  uploadAttachment,
  deleteAttachment,
  getAttachmentDownloadUrl,
} from '../api';

interface CardModalProps {
  card: Card;
  lists: ListModel[];
  allLabels: Label[];
  onClose: () => void;
  onCardUpdated: (updatedCard: Card) => void;
  onCardArchived: (cardId: string) => void;
  onCardCopied: (newCard: Card) => void;
}

const DEFAULT_DUE_TIME = '18:00';

const padZero = (n: number) => String(n).padStart(2, '0');

const toLocalDatetimeString = (isoString?: string | null): string => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = padZero(date.getMonth() + 1);
  const day = padZero(date.getDate());
  const hours = padZero(date.getHours());
  const minutes = padZero(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getTodayDateString = (offsetDays: number = 0): string => {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = padZero(d.getMonth() + 1);
  const day = padZero(d.getDate());
  return `${year}-${month}-${day}`;
};

const LABEL_COLOR_MAP: Record<string, string> = {
  red: 'bg-rose-500 text-white',
  yellow: 'bg-amber-400 text-slate-900',
  orange: 'bg-orange-500 text-white',
  green: 'bg-emerald-500 text-white',
  blue: 'bg-sky-500 text-white',
  purple: 'bg-purple-500 text-white',
};

export const CardModal: React.FC<CardModalProps> = ({
  card,
  lists,
  allLabels,
  onClose,
  onCardUpdated,
  onCardArchived,
  onCardCopied,
}) => {
  const [currentCard, setCurrentCard] = useState<Card>(card);
  const [title, setTitle] = useState(card.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Markdown 説明文
  const [description, setDescription] = useState(card.description || '');
  const [descMode, setDescMode] = useState<'edit' | 'preview'>('edit');
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  // 新規チェックリスト
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});

  // 期限
  const [dueDate, setDueDate] = useState(toLocalDatetimeString(card.due_date));
  const [isDueComplete, setIsDueComplete] = useState(card.is_due_complete);

  // 画像ライトボックス
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // コピー先リスト
  const [targetCopyListId, setTargetCopyListId] = useState<string>(card.list_id || lists[0]?.id || '');
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentCard(card);
    setTitle(card.title);
    setDescription(card.description || '');
    setDueDate(toLocalDatetimeString(card.due_date));
    setIsDueComplete(card.is_due_complete);
  }, [card]);

  // クリップボードからの画像ペースト (Ctrl+V) 対応
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const att = await uploadAttachment(currentCard.id, file);
            const updated = {
              ...currentCard,
              attachments: [...currentCard.attachments, att],
              cover_attachment_id: currentCard.cover_attachment_id || att.id,
            };
            setCurrentCard(updated);
            onCardUpdated(updated);
          } catch (err: any) {
            alert(err.message || '画像の添付に失敗しました');
          }
          break;
        }
      }
    }
  };

  // ファイルアップロード (ボタン & ドラッグ&ドロップ)
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let latestCard = currentCard;
    for (let i = 0; i < files.length; i++) {
      try {
        const att = await uploadAttachment(currentCard.id, files[i]);
        const isImage = att.mime_type?.startsWith('image/') && att.mime_type !== 'image/svg+xml';
        latestCard = {
          ...latestCard,
          attachments: [...latestCard.attachments, att],
          cover_attachment_id: (!latestCard.cover_attachment_id && isImage) ? att.id : latestCard.cover_attachment_id,
        };
        setCurrentCard(latestCard);
        onCardUpdated(latestCard);
      } catch (err: any) {
        alert(err.message || 'ファイルのアップロードに失敗しました');
      }
    }
  };

  // タイトル更新
  const handleTitleBlur = async () => {
    if (title.trim() && title.trim() !== currentCard.title) {
      const updated = await updateCard(currentCard.id, { title: title.trim() });
      setCurrentCard(updated);
      onCardUpdated(updated);
    } else {
      setTitle(currentCard.title);
    }
    setIsEditingTitle(false);
  };

  // 説明文更新
  const handleSaveDescription = async () => {
    const updated = await updateCard(currentCard.id, { description });
    setCurrentCard(updated);
    onCardUpdated(updated);
    setIsEditingDesc(false);
  };

  // ラベル着脱
  const handleToggleLabel = async (labelId: string) => {
    const currentLabelIds = currentCard.labels.map((l) => l.id);
    const newLabelIds = currentLabelIds.includes(labelId)
      ? currentLabelIds.filter((id) => id !== labelId)
      : [...currentLabelIds, labelId];

    const updated = await updateCard(currentCard.id, { label_ids: newLabelIds });
    setCurrentCard(updated);
    onCardUpdated(updated);
  };

  // 期限更新
  const handleDueDateChange = async (newDate: string) => {
    setDueDate(newDate);
    if (!newDate) {
      setIsDueComplete(false);
    }
    const isoDate = newDate ? new Date(newDate).toISOString() : null;
    const updated = await updateCard(currentCard.id, {
      due_date: isoDate,
      is_due_complete: newDate ? isDueComplete : false,
    });
    setCurrentCard(updated);
    onCardUpdated(updated);
  };

  const handleDateChange = (newDateStr: string) => {
    if (!newDateStr) {
      handleDueDateChange('');
      return;
    }
    const currentTime = dueDate ? dueDate.substring(11, 16) : DEFAULT_DUE_TIME;
    handleDueDateChange(`${newDateStr}T${currentTime || DEFAULT_DUE_TIME}`);
  };

  const handleTimeChange = (newTimeStr: string) => {
    const time = newTimeStr || DEFAULT_DUE_TIME;
    if (dueDate) {
      const currentDate = dueDate.substring(0, 10);
      handleDueDateChange(`${currentDate}T${time}`);
    } else {
      const today = getTodayDateString(0);
      handleDueDateChange(`${today}T${time}`);
    }
  };

  const setQuickDue = (daysOffset: number) => {
    const dateStr = getTodayDateString(daysOffset);
    handleDueDateChange(`${dateStr}T${DEFAULT_DUE_TIME}`);
  };

  const handleDueCompleteToggle = async () => {
    const nextComplete = !isDueComplete;
    setIsDueComplete(nextComplete);
    const updated = await updateCard(currentCard.id, { is_due_complete: nextComplete });
    setCurrentCard(updated);
    onCardUpdated(updated);
  };

  // カバー画像設定
  const handleToggleCover = async (attachmentId: string) => {
    const newCoverId = currentCard.cover_attachment_id === attachmentId ? null : attachmentId;
    const updated = await updateCard(currentCard.id, { cover_attachment_id: newCoverId });
    setCurrentCard(updated);
    onCardUpdated(updated);
  };

  // 添付ファイル削除
  const handleDeleteAttachment = async (attachmentId: string) => {
    await deleteAttachment(attachmentId);
    const updated = {
      ...currentCard,
      attachments: currentCard.attachments.filter((a) => a.id !== attachmentId),
      cover_attachment_id: currentCard.cover_attachment_id === attachmentId ? null : currentCard.cover_attachment_id,
    };
    setCurrentCard(updated);
    onCardUpdated(updated);
  };

  // チェックリスト操作
  const handleAddChecklist = async () => {
    if (!newChecklistTitle.trim()) return;
    const cl = await createChecklist(currentCard.id, newChecklistTitle.trim());
    const updated = { ...currentCard, checklists: [...currentCard.checklists, cl] };
    setCurrentCard(updated);
    onCardUpdated(updated);
    setNewChecklistTitle('');
    setShowAddChecklist(false);
  };

  const handleDeleteChecklist = async (clId: string) => {
    await deleteChecklist(clId);
    const updated = { ...currentCard, checklists: currentCard.checklists.filter((c) => c.id !== clId) };
    setCurrentCard(updated);
    onCardUpdated(updated);
  };

  const handleAddChecklistItem = async (clId: string) => {
    const text = newItemTexts[clId]?.trim();
    if (!text) return;
    const item = await createChecklistItem(clId, text);
    const updated = {
      ...currentCard,
      checklists: currentCard.checklists.map((c) =>
        c.id === clId ? { ...c, items: [...c.items, item] } : c
      ),
    };
    setCurrentCard(updated);
    onCardUpdated(updated);
    setNewItemTexts((prev) => ({ ...prev, [clId]: '' }));
  };

  const handleToggleItemComplete = async (item: Checklist['items'][0]) => {
    const nextCompleted = !item.is_completed;
    const updatedItem = await updateChecklistItem(item.id, { is_completed: nextCompleted });
    const updated = {
      ...currentCard,
      checklists: currentCard.checklists.map((c) =>
        c.id === item.checklist_id
          ? { ...c, items: c.items.map((i) => (i.id === item.id ? updatedItem : i)) }
          : c
      ),
    };
    setCurrentCard(updated);
    onCardUpdated(updated);
  };

  const handleDeleteItem = async (clId: string, itemId: string) => {
    await deleteChecklistItem(itemId);
    const updated = {
      ...currentCard,
      checklists: currentCard.checklists.map((c) =>
        c.id === clId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c
      ),
    };
    setCurrentCard(updated);
    onCardUpdated(updated);
  };

  // カード複製
  const handleCopyCard = async () => {
    const newCard = await copyCard(currentCard.id, targetCopyListId);
    onCardCopied(newCard);
    setShowCopyDialog(false);
    onClose();
  };

  // カードアーカイブ
  const handleArchive = async () => {
    await archiveCard(currentCard.id);
    onCardArchived(currentCard.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onPaste={handlePaste}
    >
      {/* モーダル枠 */}
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* モーダルヘッダー */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-start justify-between gap-4 bg-slate-50/50">
          <div className="flex-1">
            {isEditingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleBlur();
                  if (e.key === 'Escape') {
                    setTitle(currentCard.title);
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                className="w-full text-lg font-bold px-2 py-1 bg-white border border-indigo-500 rounded-lg outline-hidden"
              />
            ) : (
              <h2
                onClick={() => setIsEditingTitle(true)}
                className="text-lg sm:text-xl font-bold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
              >
                {currentCard.title}
              </h2>
            )}
            <p className="text-xs text-slate-500 mt-1">
              所属リスト:{' '}
              <span className="font-semibold text-slate-700">
                {lists.find((l) => l.id === currentCard.list_id)?.title || '未所属'}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* モーダルボディ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 左側メインエリア (説明, チェックリスト, 添付) */}
          <div className="md:col-span-2 space-y-6">
            {/* ラベル表示 */}
            {currentCard.labels.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ラベル</h4>
                <div className="flex flex-wrap gap-1.5">
                  {currentCard.labels.map((l) => (
                    <span
                      key={l.id}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        LABEL_COLOR_MAP[l.color] || 'bg-slate-500 text-white'
                      }`}
                    >
                      {l.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 説明欄 (Markdown対応) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                  <AlignLeft className="w-4 h-4 text-slate-500" />
                  <span>説明</span>
                </div>
                {/* 編集 / プレビュー 切替タブ */}
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => {
                      setDescMode('edit');
                      setIsEditingDesc(true);
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                      descMode === 'edit' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    編集
                  </button>
                  <button
                    onClick={() => setDescMode('preview')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                      descMode === 'preview' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    プレビュー
                  </button>
                </div>
              </div>

              {descMode === 'edit' ? (
                <div className="space-y-2">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onFocus={() => setIsEditingDesc(true)}
                    placeholder="Markdown形式でカードの詳細な説明を入力..."
                    rows={5}
                    className="w-full p-3 text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/20 transition-all font-mono"
                  />
                  {isEditingDesc && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveDescription}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setDescription(currentCard.description || '');
                          setIsEditingDesc(false);
                        }}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        キャンセル
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 min-h-24 bg-slate-50 border border-slate-200 rounded-xl text-sm prose prose-sm max-w-none prose-slate break-words">
                  {description.trim() ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ ...props }) => (
                          <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 underline hover:text-indigo-800"
                          />
                        ),
                      }}
                    >
                      {description}
                    </ReactMarkdown>
                  ) : (
                    <span className="text-slate-400 italic">説明はありません。</span>
                  )}
                </div>
              )}
            </div>

            {/* チェックリスト */}
            {currentCard.checklists.map((cl) => {
              const total = cl.items.length;
              const completed = cl.items.filter((i) => i.is_completed).length;
              const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <div key={cl.id} className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                      <CheckSquare className="w-4 h-4 text-slate-500" />
                      <span>{cl.title}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteChecklist(cl.id)}
                      className="text-xs text-rose-500 hover:text-rose-700 cursor-pointer"
                    >
                      削除
                    </button>
                  </div>

                  {/* 進捗バー */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-500 w-8">{percent}%</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          percent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* アイテム一覧 */}
                  <div className="space-y-1.5">
                    {cl.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 group transition-colors"
                      >
                        <label className="flex items-center gap-2.5 text-sm cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={item.is_completed}
                            onChange={() => handleToggleItemComplete(item)}
                            className="w-4 h-4 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                          />
                          <span
                            className={
                              item.is_completed ? 'line-through text-slate-400' : 'text-slate-800'
                            }
                          >
                            {item.content}
                          </span>
                        </label>
                        <button
                          onClick={() => handleDeleteItem(cl.id, item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* アイテム追加フォーム */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newItemTexts[cl.id] || ''}
                      onChange={(e) =>
                        setNewItemTexts((prev) => ({ ...prev, [cl.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddChecklistItem(cl.id);
                        }
                      }}
                      placeholder="アイテムを追加..."
                      className="flex-1 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:border-indigo-500"
                    />
                    <button
                      onClick={() => handleAddChecklistItem(cl.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      追加
                    </button>
                  </div>
                </div>
              );
            })}

            {/* 添付ファイル & 画像 */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <span>添付ファイル ({currentCard.attachments.length})</span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  追加
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* ドラッグ＆ドロップまたはペースト案内 */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileUpload(e.dataTransfer.files);
                }}
                className="p-3 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl text-center text-xs text-slate-500 bg-slate-50/50 transition-colors"
              >
                ファイルをドラッグ＆ドロップ、またはクリップボードから画像をペースト (Ctrl+V)
              </div>

              {/* 添付一覧 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentCard.attachments.map((att) => {
                  const isImage = att.mime_type?.startsWith('image/') && att.mime_type !== 'image/svg+xml';
                  const isCover = currentCard.cover_attachment_id === att.id;

                  return (
                    <div
                      key={att.id}
                      className="border border-slate-200 rounded-xl p-2.5 flex items-center gap-3 bg-white shadow-2xs hover:border-slate-300 transition-all"
                    >
                      {/* サムネイル */}
                      {isImage ? (
                        <div
                          onClick={() => setPreviewImageUrl(getAttachmentDownloadUrl(att.id, true))}
                          className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={getAttachmentDownloadUrl(att.id, true)}
                            alt={att.filename}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                          <Paperclip className="w-6 h-6" />
                        </div>
                      )}

                      {/* ファイル情報 & 操作 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate" title={att.filename}>
                          {att.filename}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {(att.file_size / 1024).toFixed(1)} KB
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <a
                            href={getAttachmentDownloadUrl(att.id, false)}
                            download
                            className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5"
                          >
                            <Download className="w-3 h-3" />
                            DL
                          </a>
                          {isImage && (
                            <button
                              onClick={() => handleToggleCover(att.id)}
                              className={`text-[11px] font-medium cursor-pointer ${
                                isCover ? 'text-emerald-600 font-semibold' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              {isCover ? 'カバー設定中' : 'カバーにする'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAttachment(att.id)}
                            className="text-[11px] text-rose-500 hover:text-rose-700 cursor-pointer ml-auto"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右側サイドバー (アクション・設定) */}
          <div className="space-y-6 border-t md:border-t-0 md:border-l border-slate-200/80 md:pl-6">
            {/* 期限 (Due Date) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  期限
                </h4>
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => handleDueDateChange('')}
                    className="text-[11px] text-rose-500 hover:text-rose-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="期限を解除"
                  >
                    <X className="w-3 h-3" />
                    解除
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <input
                    type="date"
                    value={dueDate ? dueDate.substring(0, 10) : ''}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="flex-1 min-w-[110px] px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:border-indigo-500"
                    title="期限日"
                  />
                  <input
                    type="time"
                    value={dueDate ? dueDate.substring(11, 16) : DEFAULT_DUE_TIME}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="w-[76px] shrink-0 px-1.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:border-indigo-500 text-center"
                    title="期限時刻 (デフォルト 18:00)"
                  />
                </div>

                {/* クイック設定ボタン */}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuickDue(0)}
                    className="flex-1 text-[11px] py-1 px-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors cursor-pointer text-center"
                  >
                    今日 18:00
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDue(1)}
                    className="flex-1 text-[11px] py-1 px-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors cursor-pointer text-center"
                  >
                    明日 18:00
                  </button>
                </div>
              </div>

              {dueDate && (
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={isDueComplete}
                    onChange={handleDueCompleteToggle}
                    className="w-3.5 h-3.5 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                  <span>完了としてマーク</span>
                </label>
              )}
            </div>

            {/* ラベル付与 */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                ラベル
              </h4>
              <div className="space-y-1">
                {allLabels.map((label) => {
                  const isChecked = currentCard.labels.some((l) => l.id === label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => handleToggleLabel(label.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        isChecked ? 'ring-2 ring-indigo-500 bg-slate-50' : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                            LABEL_COLOR_MAP[label.color] || 'bg-slate-400'
                          }`}
                        />
                        <span className="text-slate-700">{label.name}</span>
                      </div>
                      {isChecked && <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* チェックリスト追加 */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                チェックリスト
              </h4>
              {showAddChecklist ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    placeholder="タイトル..."
                    autoFocus
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddChecklist}
                      className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg cursor-pointer"
                    >
                      追加
                    </button>
                    <button
                      onClick={() => setShowAddChecklist(false)}
                      className="px-2 py-1 text-xs text-slate-500 cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddChecklist(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  リスト追加
                </button>
              )}
            </div>

            {/* アクション (コピー, アーカイブ) */}
            <div className="space-y-2 pt-2 border-t border-slate-200/80">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">アクション</h4>

              {/* カードコピー 【項目9】 */}
              {showCopyDialog ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <p className="text-xs font-semibold text-slate-700">コピー先リスト</p>
                  <select
                    value={targetCopyListId}
                    onChange={(e) => setTargetCopyListId(e.target.value)}
                    className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg outline-hidden"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleCopyCard}
                      className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg cursor-pointer"
                    >
                      複製実行
                    </button>
                    <button
                      onClick={() => setShowCopyDialog(false)}
                      className="px-2 py-1 text-xs text-slate-500 cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCopyDialog(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>カードを複製</span>
                </button>
              )}

              {/* アーカイブ */}
              <button
                onClick={handleArchive}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors cursor-pointer border border-amber-200/60"
              >
                <Archive className="w-4 h-4 text-amber-600" />
                <span>アーカイブ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 画像拡大ライトボックス */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={previewImageUrl} alt="拡大プレビュー" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
