import React, { useMemo, useRef, useState } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X,
  AlignLeft,
  CheckSquare,
  Eye,
  Edit3,
  Columns2,
  Maximize2,
  Minimize2,
  ListTree,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Strikethrough,
  Code,
  SquareCode,
  Quote,
  Minus,
  Table as TableIcon,
  Link as LinkIcon,
  List,
  Info,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { openExternalUrl } from '../../api';
import {
  MarkdownLiveEditor,
  MarkdownLiveEditorHandle,
  MarkdownFormatType,
} from '../editor/MarkdownLiveEditor';
import { AutoSaveState } from '../../hooks/useDescriptionAutoSave';
import {
  extractMarkdownHeadings,
  MARKDOWN_SHORTCUT_ITEMS,
  NoteVariant,
  parseMarkdownSegments,
} from '../../utils/markdownSegments';

export type DescViewMode = 'edit' | 'split' | 'preview';

interface CardDescriptionSectionProps {
  cardId: string;
  description: string;
  saveState: AutoSaveState;
  descMode: DescViewMode;
  isZenMode: boolean;
  showShortcutHelp: boolean;
  editorRef: React.RefObject<MarkdownLiveEditorHandle | null>;
  onDescriptionChange: (nextValue: string) => void;
  onSelectDescMode: (mode: DescViewMode) => void;
  onTogglePreviewMode: () => void;
  onToggleZenMode: () => void;
  onToggleShortcutHelp: () => void;
  onCloseShortcutHelp: () => void;
  onApplyMarkdownFormat: (type: MarkdownFormatType) => void;
  onEditorFocus: () => void;
  onRequestSaveFlush: () => void;
}

const markdownComponents: Components = {
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
};

const NOTE_STYLES: Record<NoteVariant, { container: string; icon: React.ReactNode }> = {
  info: {
    container: 'bg-emerald-50/90 border-l-4 border-emerald-500 text-emerald-950',
    icon: <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
  },
  warn: {
    container: 'bg-amber-50/90 border-l-4 border-amber-500 text-amber-950',
    icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
  },
  alert: {
    container: 'bg-rose-50/90 border-l-4 border-rose-500 text-rose-950',
    icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
  },
};

const SAVE_STATUS_BADGE: Partial<Record<AutoSaveState, { label: string; className: string }>> = {
  saving: {
    label: '自動保存中...',
    className: 'text-indigo-600 bg-indigo-50 animate-pulse',
  },
  dirty: {
    label: 'ローカル保護済み',
    className: 'text-slate-500 bg-slate-100',
  },
  saved: {
    label: '自動保存済み',
    className: 'text-emerald-700 bg-emerald-50',
  },
  restored: {
    label: '未保存ドラフトを復元しました',
    className: 'text-amber-700 bg-amber-50',
  },
  error: {
    label: '保存エラー（ローカル保持中）',
    className: 'text-rose-700 bg-rose-50',
  },
};

interface ToolbarButtonDef {
  type: MarkdownFormatType;
  title: string;
  icon: React.ReactNode;
}

const STRUCTURE_BUTTONS: ToolbarButtonDef[] = [
  { type: 'h1', title: '見出し 1 (# )', icon: <Heading1 className="w-3.5 h-3.5" /> },
  { type: 'h2', title: '見出し 2 (## )', icon: <Heading2 className="w-3.5 h-3.5" /> },
  { type: 'h3', title: '見出し 3 (### )', icon: <Heading3 className="w-3.5 h-3.5" /> },
];

const INLINE_FORMAT_BUTTONS: ToolbarButtonDef[] = [
  { type: 'bold', title: '太字 (Ctrl+B)', icon: <Bold className="w-3.5 h-3.5" /> },
  { type: 'italic', title: '斜体 (Ctrl+I)', icon: <Italic className="w-3.5 h-3.5" /> },
  { type: 'strikethrough', title: '取り消し線 (Ctrl+Shift+X)', icon: <Strikethrough className="w-3.5 h-3.5" /> },
  { type: 'code', title: 'インラインコード (Ctrl+E)', icon: <Code className="w-3.5 h-3.5" /> },
  { type: 'codeblock', title: 'コードブロック (Ctrl+Shift+K)', icon: <SquareCode className="w-3.5 h-3.5" /> },
  { type: 'link', title: 'リンク挿入 (Ctrl+K)', icon: <LinkIcon className="w-3.5 h-3.5" /> },
];

const BLOCK_FORMAT_BUTTONS: ToolbarButtonDef[] = [
  { type: 'bullet-list', title: '箇条書きリスト (Ctrl+Shift+U)', icon: <List className="w-3.5 h-3.5" /> },
  { type: 'task-list', title: 'チェックボックス / タスク (Ctrl+Shift+C)', icon: <CheckSquare className="w-3.5 h-3.5" /> },
  { type: 'quote', title: '引用 (> )', icon: <Quote className="w-3.5 h-3.5" /> },
  { type: 'hr', title: '区切り線 (---)', icon: <Minus className="w-3.5 h-3.5" /> },
  { type: 'table', title: 'テーブル挿入', icon: <TableIcon className="w-3.5 h-3.5" /> },
];

interface MarkdownPreviewPaneProps {
  description: string;
  isZenMode: boolean;
  isSplitPane?: boolean;
  previewRef: React.RefObject<HTMLDivElement | null>;
  onRequestEdit: () => void;
}

const MarkdownPreviewPane: React.FC<MarkdownPreviewPaneProps> = ({
  description,
  isZenMode,
  isSplitPane = false,
  previewRef,
  onRequestEdit,
}) => {
  const segments = useMemo(() => parseMarkdownSegments(description), [description]);
  const isEmpty = !description.trim();

  return (
    <div
      ref={previewRef}
      onDoubleClick={(e) => {
        if (isSplitPane) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest('a')) return;
        onRequestEdit();
      }}
      onClick={() => {
        if (isEmpty && !isSplitPane) {
          onRequestEdit();
        }
      }}
      title={isSplitPane ? undefined : isEmpty ? 'クリックして説明を入力' : 'ダブルクリックして編集'}
      style={{ scrollbarGutter: 'stable', overscrollBehavior: 'contain' }}
      className={`bg-slate-50 border border-slate-200 rounded-xl text-sm break-words overflow-y-auto ${
        isEmpty && !isSplitPane
          ? 'cursor-pointer hover:border-indigo-300 hover:bg-slate-50/70 transition-colors'
          : ''
      } ${
        isZenMode ? 'flex-1 min-h-0 h-full p-6 sm:p-8' : 'p-4 min-h-[280px]'
      }`}
    >
      <div
        className={`space-y-3 ${
          isZenMode && !isSplitPane ? 'max-w-4xl mx-auto pb-[25vh]' : isZenMode ? 'pb-[25vh]' : ''
        }`}
      >
        {description.trim() ? (
          segments.map((seg, idx) => {
            if (seg.type === 'note') {
              const style = NOTE_STYLES[seg.variant];
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-r-lg flex items-start gap-2.5 ${style.container}`}
                >
                  {style.icon}
                  <div className="prose prose-sm max-w-none prose-slate break-words flex-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {seg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              );
            }

            return (
              <div key={idx} className="prose prose-sm max-w-none prose-slate break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {seg.content}
                </ReactMarkdown>
              </div>
            );
          })
        ) : (
          <span className="text-slate-400 italic">
            説明はありません。{!isSplitPane && '（クリックして入力）'}
          </span>
        )}
      </div>
    </div>
  );
};

export const CardDescriptionSection: React.FC<CardDescriptionSectionProps> = ({
  cardId,
  description,
  saveState,
  descMode,
  isZenMode,
  showShortcutHelp,
  editorRef,
  onDescriptionChange,
  onSelectDescMode,
  onTogglePreviewMode,
  onToggleZenMode,
  onToggleShortcutHelp,
  onCloseShortcutHelp,
  onApplyMarkdownFormat,
  onEditorFocus,
  onRequestSaveFlush,
}) => {
  const [showTocPanel, setShowTocPanel] = useState(true);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const headings = useMemo(() => extractMarkdownHeadings(description), [description]);
  const saveBadge = SAVE_STATUS_BADGE[saveState];

  const handleHeadingClick = (lineNumber: number, headingIndex: number) => {
    if (descMode === 'edit' || descMode === 'split') {
      editorRef.current?.scrollToLine(lineNumber);
    }
    if (descMode === 'preview' || descMode === 'split') {
      const headingEls = previewRef.current?.querySelectorAll('h1, h2, h3');
      const targetEl = headingEls?.[headingIndex];
      targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderToolbarButtons = (buttons: ToolbarButtonDef[]) =>
    buttons.map((btn) => (
      <button
        key={btn.type}
        type="button"
        onClick={() => onApplyMarkdownFormat(btn.type)}
        title={btn.title}
        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
      >
        {btn.icon}
      </button>
    ));

  const showEditorToolbar = descMode === 'edit' || descMode === 'split';

  return (
    <div className={isZenMode ? 'flex-1 flex flex-col min-h-0 gap-2.5' : 'space-y-2'}>
      {/* セクションヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 text-slate-700 font-semibold text-sm">
          <AlignLeft className="w-4 h-4 text-slate-500" />
          <span>説明</span>
          {saveBadge && (
            <span className={`text-[11px] font-normal px-2 py-0.5 rounded-full ${saveBadge.className}`}>
              {saveBadge.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 集中モード時のみ：目次パネル開閉ボタン */}
          {isZenMode && (
            <button
              type="button"
              onClick={() => setShowTocPanel((prev) => !prev)}
              title={showTocPanel ? '目次パネルを閉じる' : '目次パネルを開く'}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                showTocPanel
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {showTocPanel ? (
                <PanelLeftClose className="w-3.5 h-3.5" />
              ) : (
                <PanelLeftOpen className="w-3.5 h-3.5" />
              )}
              <span>目次</span>
              {headings.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/80 border border-current/20">
                  {headings.length}
                </span>
              )}
            </button>
          )}

          {/* 表示モード切替タブ */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onSelectDescMode('preview')}
              title="全体プレビュー切替 (Ctrl+Shift+P)"
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                descMode === 'preview' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>プレビュー</span>
            </button>
            {isZenMode && (
              <button
                type="button"
                onClick={() => onSelectDescMode('split')}
                title="左右2分割（左: Live編集 / 右: プレビュー）"
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  descMode === 'split' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Columns2 className="w-3 h-3" />
                <span>分割</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectDescMode('edit')}
              title="Live Preview 編集モード (Ctrl+Shift+P で切替 / e でフォーカス)"
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                descMode === 'edit' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>編集</span>
            </button>
          </div>

          {/* 集中執筆 (Zen) モード切替トグル */}
          <button
            type="button"
            onClick={onToggleZenMode}
            title={
              isZenMode
                ? '通常表示に戻る (Ctrl+Shift+F / Esc)'
                : '集中執筆モードで広く書く (Ctrl+Shift+F)'
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
              isZenMode
                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50'
            }`}
          >
            {isZenMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>通常表示</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>集中モード</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Markdown フォーマットツールバー */}
      {showEditorToolbar && (
        <div className="relative flex flex-wrap items-center justify-between gap-1 px-2 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl shrink-0">
          <div className="flex flex-wrap items-center gap-0.5">
            {renderToolbarButtons(STRUCTURE_BUTTONS)}
            <span className="w-px h-4 bg-slate-300 mx-1" />
            {renderToolbarButtons(INLINE_FORMAT_BUTTONS)}
            <span className="w-px h-4 bg-slate-300 mx-1" />
            {renderToolbarButtons(BLOCK_FORMAT_BUTTONS)}
            <span className="w-px h-4 bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={() => onApplyMarkdownFormat('note-info')}
              title="Qiitaノート: 補足説明 :::note info (Ctrl+Shift+1)"
              className="px-1.5 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium"
            >
              <Info className="w-3.5 h-3.5 text-emerald-600" />
              <span>info</span>
            </button>
            <button
              type="button"
              onClick={() => onApplyMarkdownFormat('note-warn')}
              title="Qiitaノート: 警告 :::note warn (Ctrl+Shift+2)"
              className="px-1.5 py-1 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>warn</span>
            </button>
            <button
              type="button"
              onClick={() => onApplyMarkdownFormat('note-alert')}
              title="Qiitaノート: 強い警告 :::note alert (Ctrl+Shift+3)"
              className="px-1.5 py-1 rounded-lg text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>alert</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleShortcutHelp}
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

          {showShortcutHelp && (
            <div className="absolute right-0 top-full mt-1.5 z-30 w-80 sm:w-96 max-h-[65vh] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="font-bold text-slate-800">Markdown ショートカットキー一覧</span>
                <button
                  type="button"
                  onClick={onCloseShortcutHelp}
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
      )}

      {/* メイン領域 (目次サイドパネル + エディタ / プレビュー / 2分割) */}
      <div className={isZenMode ? 'flex-1 flex gap-3 min-h-0' : 'space-y-2'}>
        {/* 集中モード専用: 見出しアウトライン（目次）サイドパネル */}
        {isZenMode && showTocPanel && (
          <aside
            style={{ scrollbarGutter: 'stable', overscrollBehavior: 'contain' }}
            className="hidden md:flex flex-col w-60 shrink-0 bg-slate-50/90 border border-slate-200 rounded-xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-slate-200/80 flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white/70">
              <ListTree className="w-3.5 h-3.5 text-indigo-600" />
              <span>アウトライン</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {headings.length > 0 ? (
                headings.map((h, idx) => (
                  <button
                    key={`${h.lineNumber}-${idx}`}
                    type="button"
                    onClick={() => handleHeadingClick(h.lineNumber, idx)}
                    title={`L${h.lineNumber}: ${h.text}`}
                    className={`w-full text-left py-1.5 px-2 rounded-lg text-xs transition-colors cursor-pointer truncate hover:bg-indigo-50 hover:text-indigo-700 ${
                      h.level === 1
                        ? 'font-bold text-slate-800'
                        : h.level === 2
                          ? 'pl-4 font-medium text-slate-700'
                          : 'pl-7 text-slate-500'
                    }`}
                  >
                    {h.text}
                  </button>
                ))
              ) : (
                <div className="px-2 py-4 text-[11px] text-slate-400 leading-relaxed">
                  見出し（<code className="font-mono bg-slate-200/60 px-1 rounded">#</code>〜
                  <code className="font-mono bg-slate-200/60 px-1 rounded">###</code>
                  ）を入力すると目次が表示されます
                </div>
              )}
            </div>
          </aside>
        )}

        {/* エディタ / 分割 / プレビューペイン */}
        <div
          className={
            isZenMode
              ? descMode === 'split'
                ? 'flex-1 min-w-0 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3'
                : 'flex-1 min-w-0 min-h-0 flex flex-col'
              : ''
          }
        >
          {(descMode === 'edit' || descMode === 'split') && (
            <div className={isZenMode ? 'flex-1 min-w-0 min-h-0 flex flex-col' : ''}>
              <MarkdownLiveEditor
                ref={editorRef}
                cardId={cardId}
                value={description}
                onChange={onDescriptionChange}
                onFocus={onEditorFocus}
                onRequestSaveFlush={onRequestSaveFlush}
                onTogglePreviewMode={onTogglePreviewMode}
                onToggleZenMode={onToggleZenMode}
                isZenMode={isZenMode}
                isCenteredWidth={isZenMode && descMode === 'edit'}
              />
            </div>
          )}

          {(descMode === 'preview' || descMode === 'split') && (
            <div className={isZenMode ? 'flex-1 min-w-0 min-h-0 flex flex-col' : ''}>
              <MarkdownPreviewPane
                description={description}
                isZenMode={isZenMode}
                isSplitPane={descMode === 'split'}
                previewRef={previewRef}
                onRequestEdit={() => onSelectDescMode('edit')}
              />
            </div>
          )}
        </div>
      </div>

      {/* フッターヒント */}
      {showEditorToolbar ? (
        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 px-1 shrink-0">
          <span>
            インラインLive Preview有効（カーソル行のみMarkdown記号を表示 / 自動保存対応）
          </span>
          <span className="hidden sm:inline">
            <kbd className="font-mono font-semibold text-slate-500">Ctrl+Enter</kbd> 保存してプレビュー /{' '}
            <kbd className="font-mono font-semibold text-slate-500">Ctrl+Shift+F</kbd> 集中モード /{' '}
            <kbd className="font-mono font-semibold text-slate-500">Ctrl+Shift+P</kbd> 全体プレビュー /{' '}
            <kbd className="font-mono font-semibold text-slate-500">Ctrl+Z</kbd> 元に戻す
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 px-1 shrink-0">
          <span>ダブルクリックで編集（未入力時はクリックで編集）</span>
          <span className="hidden sm:inline">
            <kbd className="font-mono font-semibold text-slate-500">Ctrl+Shift+F</kbd> 集中モード /{' '}
            <kbd className="font-mono font-semibold text-slate-500">Ctrl+Shift+P</kbd> 編集に切替
          </span>
        </div>
      )}
    </div>
  );
};
