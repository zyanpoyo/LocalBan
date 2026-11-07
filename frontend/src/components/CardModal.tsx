import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Card, Label, ListModel, Checklist } from '../types';
import {
  updateCard,
  copyCard,
  archiveCard,
  createChecklist,
  deleteChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  uploadAttachment,
  uploadCardCover,
  deleteAttachment,
  createEmptyAttachment,
  renameAttachment,
  openAttachment,
  restoreAttachmentBackup,
  onAttachmentUpdated,
} from '../api';
import {
  MarkdownLiveEditorHandle,
  MarkdownFormatType,
} from './editor/MarkdownLiveEditor';
import { useDescriptionAutoSave } from '../hooks/useDescriptionAutoSave';
import { LABEL_COLOR_MAP } from './labelColorConfig';
import {
  DEFAULT_DUE_TIME,
  toLocalDatetimeString,
  getTodayDateString,
} from '../utils/dateFormat';
import { CardDescriptionSection } from './card-modal/CardDescriptionSection';
import { CardChecklistSection } from './card-modal/CardChecklistSection';
import { CardAttachmentSection } from './card-modal/CardAttachmentSection';
import { CardSidebar } from './card-modal/CardSidebar';

interface CardModalProps {
  card: Card;
  lists: ListModel[];
  allLabels: Label[];
  onClose: () => void;
  onCardUpdated: (updatedCard: Card) => void;
  onCardArchived: (cardId: string) => void;
  onCardCopied: (newCard: Card) => void;
}

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

  // Markdown 説明文 (LocalStorage即時キャッシュ + Debounce自動保存 + Flush機構)
  const {
    description,
    saveState,
    handleDescriptionChange,
    flushSave,
  } = useDescriptionAutoSave({
    card,
    onCardSaved: (updated) => {
      setCurrentCard(updated);
      onCardUpdated(updated);
    },
    debounceMs: 500,
  });

  const [descMode, setDescMode] = useState<'edit' | 'preview'>('edit');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  // 新規チェックリスト
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [showAddChecklist, setShowAddChecklist] = useState(false);

  // 期限
  const [dueDate, setDueDate] = useState(toLocalDatetimeString(card.due_date));
  const [isDueComplete, setIsDueComplete] = useState(card.is_due_complete);

  // 画像ライトボックス
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // コピー先リスト
  const [targetCopyListId, setTargetCopyListId] = useState<string>(card.list_id || lists[0]?.id || '');
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MarkdownLiveEditorHandle>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentCard(card);
    if (!isEditingTitle) {
      setTitle(card.title);
    }
    setDueDate(toLocalDatetimeString(card.due_date));
    setIsDueComplete(card.is_due_complete);
  }, [card, isEditingTitle]);

  // カバー画像のアップロード (ファイル選択 / ドラッグ＆ドロップ)
  const handleCoverUpload = async (file: File) => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      alert('カバー画像にはラスター画像（JPEG, PNG, WebP等）を指定してください');
      return;
    }
    try {
      const updated = await uploadCardCover(currentCard.id, file);
      setCurrentCard(updated);
      onCardUpdated(updated);
    } catch (err: any) {
      alert(err.message || 'カバー画像のアップロードに失敗しました');
    }
  };

  // カバー画像の解除
  const handleClearCover = async () => {
    try {
      const updated = await updateCard(currentCard.id, { cover_attachment_id: null });
      setCurrentCard(updated);
      onCardUpdated(updated);
    } catch (err: any) {
      alert(err.message || 'カバー画像の解除に失敗しました');
    }
  };

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
        latestCard = {
          ...latestCard,
          attachments: [...latestCard.attachments, att],
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

  // 説明文の即時フラッシュ保存
  const handleSaveDescription = async () => {
    await flushSave();
    setIsEditingDesc(false);
  };

  // 編集 ⇄ プレビュー モードのトグル切替 (Ctrl+Shift+P)
  const toggleDescMode = () => {
    if (descMode === 'edit') {
      setDescMode('preview');
      setShowShortcutHelp(false);
    } else {
      setDescMode('edit');
      setIsEditingDesc(true);
      requestAnimationFrame(() => {
        editorRef.current?.focus();
      });
    }
  };

  // Markdown 装飾・テンプレート挿入ヘルパー (CodeMirror トランザクション経由)
  const applyMarkdownFormat = (type: MarkdownFormatType) => {
    setIsEditingDesc(true);
    editorRef.current?.applyFormat(type);
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
      void handleDueDateChange('');
      return;
    }
    const currentTime = dueDate ? dueDate.substring(11, 16) : DEFAULT_DUE_TIME;
    void handleDueDateChange(`${newDateStr}T${currentTime || DEFAULT_DUE_TIME}`);
  };

  const handleTimeChange = (newTimeStr: string) => {
    const time = newTimeStr || DEFAULT_DUE_TIME;
    if (dueDate) {
      const currentDate = dueDate.substring(0, 10);
      void handleDueDateChange(`${currentDate}T${time}`);
    } else {
      const today = getTodayDateString(0);
      void handleDueDateChange(`${today}T${time}`);
    }
  };

  const setQuickDue = (daysOffset: number) => {
    const dateStr = getTodayDateString(daysOffset);
    void handleDueDateChange(`${dateStr}T${DEFAULT_DUE_TIME}`);
  };

  const handleDueCompleteToggle = async () => {
    const nextComplete = !isDueComplete;
    setIsDueComplete(nextComplete);
    const updated = await updateCard(currentCard.id, { is_due_complete: nextComplete });
    setCurrentCard(updated);
    onCardUpdated(updated);
  };

  // 添付ファイル削除

  const handleCreateFile = async (extension: 'md' | 'txt') => {
    try {
      const att = await createEmptyAttachment(currentCard.id, extension);
      const updated = {
        ...currentCard,
        attachments: [...currentCard.attachments, att],
      };
      setCurrentCard(updated);
      onCardUpdated(updated);

      // 作成直後に外部エディタを自動起動
      await openAttachment(att.id);
    } catch (err: any) {
      alert(err.message || 'ファイル作成に失敗しました');
    }
  };

  const handleRenameAttachment = async (attId: string, newFilename: string) => {
    try {
      const updatedAtt = await renameAttachment(attId, newFilename);
      const updated = {
        ...currentCard,
        attachments: currentCard.attachments.map((a) => (a.id === attId ? updatedAtt : a)),
      };
      setCurrentCard(updated);
      onCardUpdated(updated);
    } catch (err: any) {
      alert(err.message || '名前の変更に失敗しました');
    }
  };

  const handleOpenAttachment = async (attId: string, editor?: string) => {
    try {
      await openAttachment(attId, editor);
    } catch (err: any) {
      alert(err.message || 'ファイルを開けませんでした');
    }
  };

  const handleRestoreBackup = async (attId: string) => {
    try {
      const restoredAtt = await restoreAttachmentBackup(attId);
      const updated = {
        ...currentCard,
        attachments: currentCard.attachments.map((a) => (a.id === attId ? restoredAtt : a)),
      };
      setCurrentCard(updated);
      onCardUpdated(updated);
    } catch (err: any) {
      alert(err.message || '復元に失敗しました');
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    await deleteAttachment(attachmentId);
    const updated = {
      ...currentCard,
      attachments: currentCard.attachments.filter((a) => a.id !== attachmentId),
      cover_attachment_id:
        currentCard.cover_attachment_id === attachmentId ? null : currentCard.cover_attachment_id,
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
    const updated = {
      ...currentCard,
      checklists: currentCard.checklists.filter((c) => c.id !== clId),
    };
    setCurrentCard(updated);
    onCardUpdated(updated);
  };

  const handleAddChecklistItem = async (clId: string, text: string) => {
    const item = await createChecklistItem(clId, text);
    const updated = {
      ...currentCard,
      checklists: currentCard.checklists.map((c) =>
        c.id === clId ? { ...c, items: [...c.items, item] } : c
      ),
    };
    setCurrentCard(updated);
    onCardUpdated(updated);
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

  // 安全なモーダル終了ハンドラ (デバウンス待ちの未保存説明文があれば即時フラッシュ保存)
  const handleSafeClose = async () => {
    await flushSave();
    onClose();
  };

  // モーダル全体のキーボードショートカット
  useEffect(() => {
    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.defaultPrevented) return;

      const isMod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // 1. Ctrl+Shift+P: 編集 ⇄ プレビュー モード切替 (モーダル内どこでも有効)
      if (isMod && e.shiftKey && !e.altKey && key === 'p') {
        e.preventDefault();
        toggleDescMode();
        return;
      }

      // 2. Ctrl+Enter: 説明文の変更を即時フラッシュ保存
      if (isMod && !e.shiftKey && !e.altKey && e.key === 'Enter') {
        if (isEditingDesc || description !== (currentCard.description || '')) {
          e.preventDefault();
          void handleSaveDescription();
          return;
        }
      }

      const target = (e.composedPath?.()[0] || e.target) as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          !!target.closest?.('.cm-editor') ||
          target.matches?.(':read-write, select, input, textarea'));

      // 3. Escape: 段階的に閉じる
      if (e.key === 'Escape') {
        e.preventDefault();
        if (previewImageUrl) {
          setPreviewImageUrl(null);
        } else if (showShortcutHelp) {
          setShowShortcutHelp(false);
        } else if (showCopyDialog) {
          setShowCopyDialog(false);
        } else if (showAddChecklist) {
          setShowAddChecklist(false);
        } else if (isInputFocused && target) {
          target.blur();
        } else {
          void handleSafeClose();
        }
        return;
      }

      // 入力欄フォーカス中は単一キーショートカットを無効化
      if (isInputFocused || isMod || e.altKey || e.shiftKey) return;

      // 4. モーダル内クイックショートカット
      if (key === 'e') {
        e.preventDefault();
        setDescMode('edit');
        setIsEditingDesc(true);
        requestAnimationFrame(() => {
          editorRef.current?.focus();
        });
      } else if (key === 'd') {
        e.preventDefault();
        dateInputRef.current?.focus();
        try {
          dateInputRef.current?.showPicker?.();
        } catch {
          // ブラウザが showPicker 未対応の場合は focus のみ
        }
      } else if (key === 't' || e.key === '-') {
        e.preventDefault();
        setShowAddChecklist(true);
      } else if (key === 'c') {
        e.preventDefault();
        setShowCopyDialog(true);
      } else if (key === 'a') {
        e.preventDefault();
        void handleArchive();
      }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onPaste={handlePaste}
    >
      {/* モーダル枠 */}
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
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
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                  if (e.key === 'Enter') void handleTitleBlur();
                  if (e.key === 'Escape') {
                    e.stopPropagation();
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
                title="クリックしてタイトルを編集"
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
            onClick={() => void handleSafeClose()}
            title="閉じる (Escape)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* モーダルボディ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* 左側メインエリア (説明, チェックリスト, 添付) */}
          <div className="md:col-span-3 space-y-6">
            {/* ラベル表示 */}
            {currentCard.labels.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  ラベル
                </h4>
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

            {/* 説明欄 (Markdown Live Preview + Smart Typing 対応) */}
            <CardDescriptionSection
              cardId={currentCard.id}
              description={description}
              saveState={saveState}
              descMode={descMode}
              showShortcutHelp={showShortcutHelp}
              editorRef={editorRef}
              onDescriptionChange={handleDescriptionChange}
              onSelectEditMode={() => {
                setDescMode('edit');
                setIsEditingDesc(true);
                requestAnimationFrame(() => {
                  editorRef.current?.focus();
                });
              }}
              onSelectPreviewMode={() => {
                setDescMode('preview');
                setShowShortcutHelp(false);
              }}
              onTogglePreviewMode={toggleDescMode}
              onToggleShortcutHelp={() => setShowShortcutHelp((prev) => !prev)}
              onCloseShortcutHelp={() => setShowShortcutHelp(false)}
              onApplyMarkdownFormat={applyMarkdownFormat}
              onEditorFocus={() => setIsEditingDesc(true)}
              onRequestSaveFlush={() => void handleSaveDescription()}
            />

            {/* チェックリスト */}
            <CardChecklistSection
              checklists={currentCard.checklists}
              onDeleteChecklist={(clId) => void handleDeleteChecklist(clId)}
              onAddChecklistItem={handleAddChecklistItem}
              onToggleItemComplete={(item) => void handleToggleItemComplete(item)}
              onDeleteItem={(clId, itemId) => void handleDeleteItem(clId, itemId)}
            />

            {/* 添付ファイル & 画像 */}
            <CardAttachmentSection
              attachments={currentCard.attachments}
              onFileUpload={(files) => void handleFileUpload(files)}
              onCreateFile={handleCreateFile}
              onRenameAttachment={handleRenameAttachment}
              onOpenAttachment={handleOpenAttachment}
              onRestoreBackup={handleRestoreBackup}
              onDeleteAttachment={(attId) => void handleDeleteAttachment(attId)}
              onPreviewImage={(url) => setPreviewImageUrl(url)}
            />
          </div>

          {/* 右側サイドバー (アクション・設定) */}
          <CardSidebar
            currentCard={currentCard}
            lists={lists}
            allLabels={allLabels}
            dueDate={dueDate}
            isDueComplete={isDueComplete}
            dateInputRef={dateInputRef}
            showAddChecklist={showAddChecklist}
            newChecklistTitle={newChecklistTitle}
            showCopyDialog={showCopyDialog}
            targetCopyListId={targetCopyListId}
            onCoverUpload={(file) => void handleCoverUpload(file)}
            onClearCover={() => void handleClearCover()}
            onPreviewImage={(url) => setPreviewImageUrl(url)}
            onClearDueDate={() => void handleDueDateChange('')}
            onDateChange={handleDateChange}
            onTimeChange={handleTimeChange}
            onSetQuickDue={setQuickDue}
            onDueCompleteToggle={() => void handleDueCompleteToggle()}
            onToggleLabel={(labelId) => void handleToggleLabel(labelId)}
            onShowAddChecklistChange={setShowAddChecklist}
            onNewChecklistTitleChange={setNewChecklistTitle}
            onAddChecklist={() => void handleAddChecklist()}
            onShowCopyDialogChange={setShowCopyDialog}
            onTargetCopyListIdChange={setTargetCopyListId}
            onCopyCard={() => void handleCopyCard()}
            onArchiveCard={() => void handleArchive()}
          />
        </div>
      </div>

      {/* 画像拡大ライトボックス */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewImageUrl}
              alt="拡大プレビュー"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
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
