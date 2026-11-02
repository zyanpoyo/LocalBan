import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X,
  AlignLeft,
  CheckSquare,
  Eye,
  Edit3,
  CheckCircle,
  Bold,
  Italic,
  Strikethrough,
  Code,
  SquareCode,
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
  MARKDOWN_SHORTCUT_ITEMS,
  NoteVariant,
  parseMarkdownSegments,
} from '../../utils/markdownSegments';

interface CardDescriptionSectionProps {
  cardId: string;
  description: string;
  saveState: AutoSaveState;
  descMode: 'edit' | 'preview';
  showShortcutHelp: boolean;
  editorRef: React.RefObject<MarkdownLiveEditorHandle | null>;
  onDescriptionChange: (nextValue: string) => void;
  onSelectEditMode: () => void;
  onSelectPreviewMode: () => void;
  onTogglePreviewMode: () => void;
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

export const CardDescriptionSection: React.FC<CardDescriptionSectionProps> = ({
  cardId,
  description,
  saveState,
  descMode,
  showShortcutHelp,
  editorRef,
  onDescriptionChange,
  onSelectEditMode,
  onSelectPreviewMode,
  onTogglePreviewMode,
  onToggleShortcutHelp,
  onCloseShortcutHelp,
  onApplyMarkdownFormat,
  onEditorFocus,
  onRequestSaveFlush,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-slate-700 font-semibold text-sm">
          <AlignLeft className="w-4 h-4 text-slate-500" />
          <span>説明</span>
          {saveState === 'saving' && (
            <span className="text-[11px] font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full animate-pulse">
              自動保存中...
            </span>
          )}
          {saveState === 'dirty' && (
            <span className="text-[11px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              ローカル保護済み
            </span>
          )}
          {saveState === 'saved' && (
            <span className="text-[11px] font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              自動保存済み
            </span>
          )}
          {saveState === 'restored' && (
            <span className="text-[11px] font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              未保存ドラフトを復元しました
            </span>
          )}
          {saveState === 'error' && (
            <span className="text-[11px] font-normal text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
              保存エラー（ローカル保持中）
            </span>
          )}
        </div>
        {/* Live編集 / 全体プレビュー 切替タブ */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs">
          <button
            onClick={onSelectEditMode}
            title="Live Preview 編集モード (Ctrl+Shift+P で切替 / e でフォーカス)"
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
              descMode === 'edit' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            編集
          </button>
          <button
            onClick={onSelectPreviewMode}
            title="全体プレビュー切替 (Ctrl+Shift+P)"
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
                onClick={() => onApplyMarkdownFormat('bold')}
                title="太字 (Ctrl+B)"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onApplyMarkdownFormat('italic')}
                title="斜体 (Ctrl+I)"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onApplyMarkdownFormat('strikethrough')}
                title="取り消し線 (Ctrl+Shift+X)"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onApplyMarkdownFormat('code')}
                title="インラインコード (Ctrl+E)"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onApplyMarkdownFormat('codeblock')}
                title="コードブロック (Ctrl+Shift+K)"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
              >
                <SquareCode className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onApplyMarkdownFormat('link')}
                title="リンク挿入 (Ctrl+K)"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
              >
                <LinkIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onApplyMarkdownFormat('bullet-list')}
                title="箇条書きリスト (Ctrl+Shift+U)"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onApplyMarkdownFormat('task-list')}
                title="チェックボックス / タスク (Ctrl+Shift+C)"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </button>

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
              <div className="absolute right-0 top-full mt-1.5 z-30 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-xs space-y-2">
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

          <MarkdownLiveEditor
            ref={editorRef}
            cardId={cardId}
            value={description}
            onChange={onDescriptionChange}
            onFocus={onEditorFocus}
            onRequestSaveFlush={onRequestSaveFlush}
            onTogglePreviewMode={onTogglePreviewMode}
          />
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 px-1">
            <span>
              インラインLive Preview有効（カーソル行のみMarkdown記号を表示 / 自動保存対応）
            </span>
            <span className="hidden sm:inline">
              <kbd className="font-mono font-semibold text-slate-500">Ctrl+Z</kbd> 元に戻す /{' '}
              <kbd className="font-mono font-semibold text-slate-500">Ctrl+Shift+P</kbd> 全体プレビュー
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="p-4 min-h-[280px] bg-slate-50 border border-slate-200 rounded-xl text-sm space-y-3 break-words">
            {description.trim() ? (
              parseMarkdownSegments(description).map((seg, idx) => {
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
                  <div
                    key={idx}
                    className="prose prose-sm max-w-none prose-slate break-words"
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
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
          <div className="flex items-center justify-end text-[10px] text-slate-400 px-1">
            <span className="hidden sm:inline">
              <kbd className="font-mono font-semibold text-slate-500">Ctrl+Shift+P</kbd> Live編集に戻る
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
