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
  Bold,
  Italic,
  Strikethrough,
  Code,
  SquareCode,
  Link as LinkIcon,
  Info,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
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
  downloadAttachmentFile,
  openExternalUrl,
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

type MarkdownFormatType =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'codeblock'
  | 'link'
  | 'note-info'
  | 'note-warn'
  | 'note-alert';

type NoteVariant = 'info' | 'warn' | 'alert';

type MarkdownSegment =
  | { type: 'markdown'; content: string }
  | { type: 'note'; variant: NoteVariant; content: string };

const MARKDOWN_SHORTCUT_ITEMS: {
  type: string;
  label: string;
  shortcut: string;
  syntax: string;
}[] = [
  { type: 'toggle-preview', label: '編集 ⇄ プレビュー切替', shortcut: 'Ctrl+Shift+P', syntax: 'モード切替' },
  { type: 'save-desc', label: '説明文を保存', shortcut: 'Ctrl+Enter', syntax: '保存確定' },
  { type: 'bold', label: '太字', shortcut: 'Ctrl+B', syntax: '**太字**' },
  { type: 'italic', label: '斜体', shortcut: 'Ctrl+I', syntax: '*斜体*' },
  { type: 'strikethrough', label: '取り消し線', shortcut: 'Ctrl+Shift+X', syntax: '~~取消~~' },
  { type: 'code', label: 'インラインコード', shortcut: 'Ctrl+E', syntax: '`コード`' },
  { type: 'codeblock', label: 'コードブロック', shortcut: 'Ctrl+Shift+K', syntax: '```...```' },
  { type: 'link', label: 'リンク挿入', shortcut: 'Ctrl+K', syntax: '[text](url)' },
  { type: 'note-info', label: 'Qiitaノート (補足)', shortcut: 'Ctrl+Shift+1', syntax: ':::note info' },
  { type: 'note-warn', label: 'Qiitaノート (警告)', shortcut: 'Ctrl+Shift+2', syntax: ':::note warn' },
  { type: 'note-alert', label: 'Qiitaノート (強い警告)', shortcut: 'Ctrl+Shift+3', syntax: ':::note alert' },
];

// Qiita互換 :::note [info|warn|alert] ブロックを抽出するパーサー（コードブロック内は除外）
const parseMarkdownSegments = (markdown: string): MarkdownSegment[] => {
  const lines = markdown.split(/\r?\n/);
  const segments: MarkdownSegment[] = [];
  let mdBuffer: string[] = [];
  let inCodeFence = false;
  let fenceMarker = '';

  let inNote = false;
  let noteVariant: NoteVariant = 'info';
  let noteOpenLine = '';
  let noteBuffer: string[] = [];

  const flushMd = () => {
    if (mdBuffer.length > 0) {
      const content = mdBuffer.join('\n');
      if (content.trim()) {
        segments.push({ type: 'markdown', content });
      }
      mdBuffer = [];
    }
  };

  for (const line of lines) {
    // コードフェンスの開始・終了判定
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inCodeFence) {
        inCodeFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inCodeFence = false;
        fenceMarker = '';
      }
    }

    if (!inCodeFence) {
      if (!inNote) {
        const noteStartMatch = line.match(/^:::note(?:\s+(info|warn|alert))?\s*$/);
        if (noteStartMatch) {
          flushMd();
          inNote = true;
          noteVariant = (noteStartMatch[1] as NoteVariant) || 'info';
          noteOpenLine = line;
          noteBuffer = [];
          continue;
        }
      } else {
        if (/^:::\s*$/.test(line)) {
          segments.push({
            type: 'note',
            variant: noteVariant,
            content: noteBuffer.join('\n'),
          });
          inNote = false;
          noteBuffer = [];
          continue;
        }
      }
    }

    if (inNote) {
      noteBuffer.push(line);
    } else {
      mdBuffer.push(line);
    }
  }

  // 閉じられていない :::note が末尾に残った場合は通常Markdownとして扱う
  if (inNote) {
    mdBuffer.push(noteOpenLine, ...noteBuffer);
  }
  flushMd();

  return segments;
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
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

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
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

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

  // 編集 ⇄ プレビュー モードのトグル切替 (Ctrl+Shift+P)
  const toggleDescMode = () => {
    if (descMode === 'edit') {
      setDescMode('preview');
      setShowShortcutHelp(false);
    } else {
      setDescMode('edit');
      setIsEditingDesc(true);
      requestAnimationFrame(() => {
        descTextareaRef.current?.focus();
      });
    }
  };

  // Markdown 装飾・テンプレート挿入ヘルパー
  const applyMarkdownFormat = (type: MarkdownFormatType) => {
    const textarea = descTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = description.slice(start, end);
    setIsEditingDesc(true);

    const updateWithSelection = (nextText: string, selStart: number, selEnd: number) => {
      setDescription(nextText);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(selStart, selEnd);
      });
    };

    // インライン装飾の囲み・トグル解除
    const applyInlineWrapper = (wrapper: string, placeholder: string) => {
      const len = wrapper.length;
      const before = description.slice(Math.max(0, start - len), start);
      const after = description.slice(end, end + len);

      // 選択範囲の直前・直後が既に同じ記号で囲まれている場合は解除
      const isValidOuterToggle =
        before === wrapper &&
        after === wrapper &&
        !(wrapper === '*' && (description.slice(Math.max(0, start - 2), start) === '**' || description.slice(end, end + 2) === '**'));

      if (isValidOuterToggle) {
        const nextText =
          description.slice(0, start - len) + selected + description.slice(end + len);
        updateWithSelection(nextText, start - len, end - len);
        return;
      }

      // 選択範囲自体が記号を含んで選択されている場合も解除
      const isValidInnerToggle =
        selected.length >= len * 2 &&
        selected.startsWith(wrapper) &&
        selected.endsWith(wrapper) &&
        !(wrapper === '*' && selected.startsWith('**') && !selected.startsWith('***'));

      if (isValidInnerToggle) {
        const unwrapped = selected.slice(len, selected.length - len);
        const nextText = description.slice(0, start) + unwrapped + description.slice(end);
        updateWithSelection(nextText, start, start + unwrapped.length);
        return;
      }

      const inner = selected || placeholder;
      const inserted = `${wrapper}${inner}${wrapper}`;
      const nextText = description.slice(0, start) + inserted + description.slice(end);
      updateWithSelection(nextText, start + len, start + len + inner.length);
    };

    // ブロック装飾（コードブロック / Qiita :::note）の挿入
    const applyBlockWrapper = (openFence: string, closeFence: string, placeholder: string) => {
      const prefix = start > 0 && description[start - 1] !== '\n' ? '\n' : '';
      const suffix = end < description.length && description[end] !== '\n' ? '\n' : '';
      const inner = selected || placeholder;
      const inserted = `${prefix}${openFence}\n${inner}\n${closeFence}${suffix}`;
      const nextText = description.slice(0, start) + inserted + description.slice(end);
      const innerStart = start + prefix.length + openFence.length + 1;
      updateWithSelection(nextText, innerStart, innerStart + inner.length);
    };

    switch (type) {
      case 'bold':
        applyInlineWrapper('**', '太字');
        break;
      case 'italic':
        applyInlineWrapper('*', '斜体');
        break;
      case 'strikethrough':
        applyInlineWrapper('~~', '取り消し線');
        break;
      case 'code':
        applyInlineWrapper('`', 'コード');
        break;
      case 'codeblock':
        applyBlockWrapper('```', '```', 'コード');
        break;
      case 'link': {
        const isUrl = /^https?:\/\/\S+$/i.test(selected.trim());
        if (isUrl) {
          const linkText = 'リンクテキスト';
          const url = selected.trim();
          const inserted = `[${linkText}](${url})`;
          const nextText = description.slice(0, start) + inserted + description.slice(end);
          updateWithSelection(nextText, start + 1, start + 1 + linkText.length);
        } else {
          const linkText = selected || 'リンクテキスト';
          const urlPlaceholder = 'url';
          const inserted = `[${linkText}](${urlPlaceholder})`;
          const nextText = description.slice(0, start) + inserted + description.slice(end);
          const urlStart = start + linkText.length + 3;
          updateWithSelection(nextText, urlStart, urlStart + urlPlaceholder.length);
        }
        break;
      }
      case 'note-info':
        applyBlockWrapper(':::note info', ':::', 'インフォメーション');
        break;
      case 'note-warn':
        applyBlockWrapper(':::note warn', ':::', '警告\n○○に注意してください。');
        break;
      case 'note-alert':
        applyBlockWrapper(':::note alert', ':::', 'より強い警告\n○○しないでください。');
        break;
    }
  };

  // 説明欄のショートカットキー入力ハンドラ (IME変換中は無視)
  const handleDescKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
      return;
    }

    const isMod = e.ctrlKey || e.metaKey;
    if (!isMod || e.altKey) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      void handleSaveDescription();
      return;
    }

    const key = e.key.toLowerCase();

    if (!e.shiftKey) {
      if (key === 'b') {
        e.preventDefault();
        applyMarkdownFormat('bold');
      } else if (key === 'i') {
        e.preventDefault();
        applyMarkdownFormat('italic');
      } else if (key === 'e') {
        e.preventDefault();
        applyMarkdownFormat('code');
      } else if (key === 'k') {
        e.preventDefault();
        applyMarkdownFormat('link');
      }
    } else {
      if (key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        toggleDescMode();
      } else if (key === 'x') {
        e.preventDefault();
        applyMarkdownFormat('strikethrough');
      } else if (key === 'k' || key === 'c') {
        e.preventDefault();
        applyMarkdownFormat('codeblock');
      } else if (e.code === 'Digit1' || key === '1' || key === '!') {
        e.preventDefault();
        applyMarkdownFormat('note-info');
      } else if (e.code === 'Digit2' || key === '2' || key === '"' || key === '@') {
        e.preventDefault();
        applyMarkdownFormat('note-warn');
      } else if (e.code === 'Digit3' || key === '3' || key === '#') {
        e.preventDefault();
        applyMarkdownFormat('note-alert');
      }
    }
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

  // 安全なモーダル終了ハンドラ (未保存の説明文があれば自動保存)
  const handleSafeClose = async () => {
    if (description !== (currentCard.description || '')) {
      try {
        const updated = await updateCard(currentCard.id, { description });
        onCardUpdated(updated);
      } catch (err) {
        console.error('Failed to auto-save description on close:', err);
      }
    }
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

      // 2. Ctrl+Enter: 説明文の変更を保存
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
          descTextareaRef.current?.focus();
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
                  if (e.key === 'Enter') handleTitleBlur();
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
                      requestAnimationFrame(() => {
                        descTextareaRef.current?.focus();
                      });
                    }}
                    title="編集モード (Ctrl+Shift+P で切替 / e でフォーカス)"
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                      descMode === 'edit' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    編集
                  </button>
                  <button
                    onClick={() => {
                      setDescMode('preview');
                      setShowShortcutHelp(false);
                    }}
                    title="プレビュー切替 (Ctrl+Shift+P)"
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
                  {/* Markdown フォーマットツールバー */}
                  <div className="relative flex flex-wrap items-center justify-between gap-1 px-2 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl">
                    <div className="flex flex-wrap items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => applyMarkdownFormat('bold')}
                        title="太字 (Ctrl+B)"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdownFormat('italic')}
                        title="斜体 (Ctrl+I)"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdownFormat('strikethrough')}
                        title="取り消し線 (Ctrl+Shift+X)"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                      >
                        <Strikethrough className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdownFormat('code')}
                        title="インラインコード (Ctrl+E)"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                      >
                        <Code className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdownFormat('codeblock')}
                        title="コードブロック (Ctrl+Shift+K)"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                      >
                        <SquareCode className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdownFormat('link')}
                        title="リンク挿入 (Ctrl+K)"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                      </button>

                      <span className="w-px h-4 bg-slate-300 mx-1" />

                      {/* Qiita 互換 :::note ボタン */}
                      <button
                        type="button"
                        onClick={() => applyMarkdownFormat('note-info')}
                        title="Qiitaノート: 補足説明 :::note info (Ctrl+Shift+1)"
                        className="px-1.5 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium"
                      >
                        <Info className="w-3.5 h-3.5 text-emerald-600" />
                        <span>info</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdownFormat('note-warn')}
                        title="Qiitaノート: 警告 :::note warn (Ctrl+Shift+2)"
                        className="px-1.5 py-1 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>warn</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdownFormat('note-alert')}
                        title="Qiitaノート: 強い警告 :::note alert (Ctrl+Shift+3)"
                        className="px-1.5 py-1 rounded-lg text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>alert</span>
                      </button>
                    </div>

                    {/* ショートカット一覧ヘルプボタン */}
                    <button
                      type="button"
                      onClick={() => setShowShortcutHelp((prev) => !prev)}
                      title="Markdownショートカットキー一覧"
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium ${
                        showShortcutHelp
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">ショートカット</span>
                    </button>

                    {/* ショートカット一覧ポップオーバー */}
                    {showShortcutHelp && (
                      <div className="absolute right-0 top-full mt-1.5 z-30 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="font-bold text-slate-800">Markdown ショートカットキー一覧</span>
                          <button
                            type="button"
                            onClick={() => setShowShortcutHelp(false)}
                            className="p-0.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {MARKDOWN_SHORTCUT_ITEMS.map((item) => (
                            <div
                              key={item.type}
                              className="py-1.5 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-medium text-slate-700">{item.label}</span>
                                <code className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm font-mono truncate">
                                  {item.syntax}
                                </code>
                              </div>
                              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-md shrink-0">
                                {item.shortcut}
                              </kbd>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <textarea
                    ref={descTextareaRef}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onFocus={() => setIsEditingDesc(true)}
                    onKeyDown={handleDescKeyDown}
                    placeholder="Markdown形式でカードの詳細な説明を入力... (ショートカットキー対応)"
                    rows={12}
                    className="w-full min-h-[280px] max-h-[60vh] p-3.5 text-sm leading-relaxed bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/20 transition-all font-mono resize-y [field-sizing:content]"
                  />
                  {isEditingDesc && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveDescription}
                          title="説明を保存 (Ctrl+Enter)"
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
                      <span className="text-[10px] text-slate-400 hidden sm:inline">
                        <kbd className="font-mono font-semibold text-slate-500">Ctrl+Shift+P</kbd> プレビュー切替 / <kbd className="font-mono font-semibold text-slate-500">Ctrl+Enter</kbd> 保存
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-4 min-h-[280px] bg-slate-50 border border-slate-200 rounded-xl text-sm space-y-3 break-words">
                    {description.trim() ? (
                      parseMarkdownSegments(description).map((seg, idx) => {
                        if (seg.type === 'note') {
                          const noteStyles: Record<
                            NoteVariant,
                            { container: string; icon: React.ReactNode }
                          > = {
                            info: {
                              container:
                                'bg-emerald-50/90 border-l-4 border-emerald-500 text-emerald-950',
                              icon: (
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              ),
                            },
                            warn: {
                              container:
                                'bg-amber-50/90 border-l-4 border-amber-500 text-amber-950',
                              icon: (
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                              ),
                            },
                            alert: {
                              container:
                                'bg-rose-50/90 border-l-4 border-rose-500 text-rose-950',
                              icon: (
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              ),
                            },
                          };
                          const style = noteStyles[seg.variant];

                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-r-lg flex items-start gap-2.5 ${style.container}`}
                            >
                              {style.icon}
                              <div className="prose prose-sm max-w-none prose-slate break-words flex-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    a: ({ href, children, ...props }) => (
                                      <a
                                        {...props}
                                        href={href}
                                        onClick={(e) => {
                                          if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                                            e.preventDefault();
                                            openExternalUrl(href).catch(console.error);
                                          }
                                        }}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 underline hover:text-indigo-800 cursor-pointer"
                                      >
                                        {children}
                                      </a>
                                    ),
                                  }}
                                >
                                  {seg.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={idx}
                            className="prose prose-sm max-w-none prose-slate break-words"
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                a: ({ href, children, ...props }) => (
                                  <a
                                    {...props}
                                    href={href}
                                    onClick={(e) => {
                                      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                                        e.preventDefault();
                                        openExternalUrl(href).catch(console.error);
                                      }
                                    }}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 underline hover:text-indigo-800 cursor-pointer"
                                  >
                                    {children}
                                  </a>
                                ),
                              }}
                            >
                              {seg.content}
                            </ReactMarkdown>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-slate-400 italic">説明はありません。</span>
                    )}
                  </div>
                  {description !== (currentCard.description || '') && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveDescription}
                          title="説明を保存 (Ctrl+Enter)"
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
                          変更を破棄
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 hidden sm:inline">
                        <kbd className="font-mono font-semibold text-slate-500">Ctrl+Shift+P</kbd> 編集に戻る / <kbd className="font-mono font-semibold text-slate-500">Ctrl+Enter</kbd> 保存
                      </span>
                    </div>
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
                        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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
                          <button
                            type="button"
                            onClick={() => downloadAttachmentFile(att.id, att.filename)}
                            className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                            title="保存"
                          >
                            <Download className="w-3 h-3" />
                            DL
                          </button>
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
                    ref={dateInputRef}
                    type="date"
                    value={dueDate ? dueDate.substring(0, 10) : ''}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="flex-1 min-w-[110px] px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:border-indigo-500"
                    title="期限日 (d キーでフォーカス)"
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
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleAddChecklist();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowAddChecklist(false);
                      }
                    }}
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
                  title="チェックリストを追加 (t または -)"
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
                  title="カードを複製 (c)"
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>カードを複製</span>
                </button>
              )}

              {/* アーカイブ */}
              <button
                onClick={handleArchive}
                title="アーカイブ (a)"
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
