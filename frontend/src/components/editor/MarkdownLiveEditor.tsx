import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, isolateHistory } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { smartTypingExtension } from './smartTypingExtension';
import { livePreviewExtension } from './livePreviewExtension';

export type MarkdownFormatType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'codeblock'
  | 'quote'
  | 'hr'
  | 'table'
  | 'link'
  | 'bullet-list'
  | 'task-list'
  | 'note-info'
  | 'note-warn'
  | 'note-alert';

export interface MarkdownLiveEditorHandle {
  focus: () => void;
  blur: () => void;
  applyFormat: (type: MarkdownFormatType) => void;
  scrollToLine: (lineNumber: number) => void;
}

interface MarkdownLiveEditorProps {
  /** カードID（カード切り替え時のエディタ再初期化識別用） */
  cardId: string;
  /** 初期または外部同期されたMarkdownテキスト */
  value: string;
  /** 1キーストロークごとの変更コールバック */
  onChange: (nextValue: string) => void;
  /** エディタフォーカス時コールバック */
  onFocus?: () => void;
  /** Ctrl+Enter 等による即時保存フラッシュ要求 */
  onRequestSaveFlush?: () => void;
  /** Ctrl+Shift+P によるプレビューモード切替要求 */
  onTogglePreviewMode?: () => void;
  /** Ctrl+Shift+F による集中執筆モード切替要求 */
  onToggleZenMode?: () => void;
  /** 集中執筆モード状態 */
  isZenMode?: boolean;
  /** 集中執筆モード1画面表示時の本文中央幅制限 */
  isCenteredWidth?: boolean;
  placeholder?: string;
}

/**
 * 選択範囲の行に対して箇条書き・タスクリストの行頭プレフィックスをトグル適用する共通ヘルパー
 */
function toggleLineListPrefix(
  view: EditorView,
  options: {
    prefix: string;
    emptyLineDefault: string;
    samePrefixRegex: RegExp;
    otherPrefixRegex: RegExp;
    userEvent: string;
  }
): void {
  const { state } = view;
  const sel = state.selection.main;
  const start = sel.from;
  const end = sel.to;
  const fromLine = state.doc.lineAt(start);
  const toLine = state.doc.lineAt(end);
  const changes: { from: number; to: number; insert: string }[] = [];

  for (let l = fromLine.number; l <= toLine.number; l++) {
    const line = state.doc.line(l);
    const text = line.text;
    const indentMatch = text.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    const textWithoutIndent = text.slice(indent.length);

    if (textWithoutIndent.trim().length === 0 && start === end) {
      changes.push({
        from: line.from,
        to: line.to,
        insert: `${indent}${options.emptyLineDefault}`,
      });
    } else if (options.samePrefixRegex.test(textWithoutIndent)) {
      const m = textWithoutIndent.match(options.samePrefixRegex)!;
      changes.push({
        from: line.from + indent.length,
        to: line.from + indent.length + m[0].length,
        insert: '',
      });
    } else {
      const otherMatch = textWithoutIndent.match(options.otherPrefixRegex);
      if (otherMatch) {
        changes.push({
          from: line.from + indent.length,
          to: line.from + indent.length + otherMatch[0].length,
          insert: options.prefix,
        });
      } else {
        changes.push({
          from: line.from + indent.length,
          to: line.from + indent.length,
          insert: options.prefix,
        });
      }
    }
  }

  view.dispatch({
    changes,
    userEvent: options.userEvent,
    annotations: isolateHistory.of('full'),
    scrollIntoView: true,
  });
  view.focus();
}

/**
 * CodeMirror 6 上でインライン・ブロック装飾コマンドを Atomic Transaction として実行する
 */
function executeMarkdownFormat(view: EditorView, type: MarkdownFormatType): void {
  const { state } = view;
  const sel = state.selection.main;
  const start = sel.from;
  const end = sel.to;
  const selected = state.doc.sliceString(start, end);
  const docText = state.doc.toString();

  const dispatchFormat = (nextInsert: string, replaceFrom: number, replaceTo: number, selStart: number, selEnd: number) => {
    view.dispatch({
      changes: { from: replaceFrom, to: replaceTo, insert: nextInsert },
      selection: EditorSelection.range(selStart, selEnd),
      userEvent: 'input.format',
      annotations: isolateHistory.of('full'),
      scrollIntoView: true,
    });
    view.focus();
  };

  const applyInlineWrapper = (wrapper: string, defaultPlaceholder: string) => {
    const len = wrapper.length;
    const before = docText.slice(Math.max(0, start - len), start);
    const after = docText.slice(end, end + len);

    // 選択範囲の外側が既に同じ記号で囲まれている場合はトグル解除
    const isValidOuterToggle =
      before === wrapper &&
      after === wrapper &&
      !(
        wrapper === '*' &&
        (docText.slice(Math.max(0, start - 2), start) === '**' ||
          docText.slice(end, end + 2) === '**')
      );

    if (isValidOuterToggle) {
      dispatchFormat(selected, start - len, end + len, start - len, end - len);
      return;
    }

    // 選択範囲自体が記号を含んでいる場合もトグル解除
    const isValidInnerToggle =
      selected.length >= len * 2 &&
      selected.startsWith(wrapper) &&
      selected.endsWith(wrapper) &&
      !(wrapper === '*' && selected.startsWith('**') && !selected.startsWith('***'));

    if (isValidInnerToggle) {
      const unwrapped = selected.slice(len, selected.length - len);
      dispatchFormat(unwrapped, start, end, start, start + unwrapped.length);
      return;
    }

    const inner = selected || defaultPlaceholder;
    const inserted = `${wrapper}${inner}${wrapper}`;
    dispatchFormat(inserted, start, end, start + len, start + len + inner.length);
  };

  const applyBlockWrapper = (openFence: string, closeFence: string, defaultPlaceholder: string) => {
    const prefix = start > 0 && docText[start - 1] !== '\n' ? '\n' : '';
    const suffix = end < docText.length && docText[end] !== '\n' ? '\n' : '';
    const inner = selected || defaultPlaceholder;
    const inserted = `${prefix}${openFence}\n${inner}\n${closeFence}${suffix}`;
    const innerStart = start + prefix.length + openFence.length + 1;
    dispatchFormat(inserted, start, end, innerStart, innerStart + inner.length);
  };

  switch (type) {
    case 'h1':
    case 'h2':
    case 'h3': {
      const levelPrefix = type === 'h1' ? '# ' : type === 'h2' ? '## ' : '### ';
      const exactRegex =
        type === 'h1' ? /^#\s+/ : type === 'h2' ? /^##\s+/ : /^###\s+/;
      toggleLineListPrefix(view, {
        prefix: levelPrefix,
        emptyLineDefault: `${levelPrefix}見出し`,
        samePrefixRegex: exactRegex,
        otherPrefixRegex: /^#{1,6}\s+/,
        userEvent: `input.format.${type}`,
      });
      break;
    }
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
    case 'quote':
      toggleLineListPrefix(view, {
        prefix: '> ',
        emptyLineDefault: '> 引用',
        samePrefixRegex: /^>\s*/,
        otherPrefixRegex: /$^/,
        userEvent: 'input.format.quote',
      });
      break;
    case 'hr': {
      const prefix = start > 0 && docText[start - 1] !== '\n' ? '\n' : '';
      const suffix = end < docText.length && docText[end] !== '\n' ? '\n' : '';
      const inserted = `${prefix}---\n${suffix}`;
      const caretPos = start + inserted.length;
      dispatchFormat(inserted, start, end, caretPos, caretPos);
      break;
    }
    case 'table': {
      const prefix = start > 0 && docText[start - 1] !== '\n' ? '\n\n' : start > 0 && docText[start - 2] !== '\n' ? '\n' : '';
      const suffix = end < docText.length && docText[end] !== '\n' ? '\n' : '';
      const firstHeader = '見出し1';
      const tableTemplate = `| ${firstHeader} | 見出し2 | 見出し3 |\n| --- | --- | --- |\n| 内容1 | 内容2 | 内容3 |\n`;
      const inserted = `${prefix}${tableTemplate}${suffix}`;
      const selStart = start + prefix.length + 2;
      dispatchFormat(inserted, start, end, selStart, selStart + firstHeader.length);
      break;
    }
    case 'link': {
      const isUrl = /^https?:\/\/\S+$/i.test(selected.trim());
      if (isUrl) {
        const linkText = 'リンクテキスト';
        const url = selected.trim();
        const inserted = `[${linkText}](${url})`;
        dispatchFormat(inserted, start, end, start + 1, start + 1 + linkText.length);
      } else {
        const linkText = selected || 'リンクテキスト';
        const urlPlaceholder = 'url';
        const inserted = `[${linkText}](${urlPlaceholder})`;
        const urlStart = start + linkText.length + 3;
        dispatchFormat(inserted, start, end, urlStart, urlStart + urlPlaceholder.length);
      }
      break;
    }
    case 'bullet-list':
      toggleLineListPrefix(view, {
        prefix: '- ',
        emptyLineDefault: '- リスト項目',
        samePrefixRegex: /^[-*+]\s+(?!\[[ xX]\])/,
        otherPrefixRegex: /^([-*+]\s+\[[ xX]\]\s+|\d+\.\s+)/,
        userEvent: 'input.format.bullet',
      });
      break;
    case 'task-list':
      toggleLineListPrefix(view, {
        prefix: '- [ ] ',
        emptyLineDefault: '- [ ] タスク',
        samePrefixRegex: /^[-*+]\s+\[[ xX]\]\s+/,
        otherPrefixRegex: /^([-*+]\s+|\d+\.\s+)/,
        userEvent: 'input.format.task',
      });
      break;
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
}

export const MarkdownLiveEditor = forwardRef<MarkdownLiveEditorHandle, MarkdownLiveEditorProps>(
  (
    {
      cardId,
      value,
      onChange,
      onFocus,
      onRequestSaveFlush,
      onTogglePreviewMode,
      onToggleZenMode,
      isZenMode = false,
      isCenteredWidth = false,
      placeholder = 'Markdown形式でカードの詳細な説明を入力... (インラインプレビュー・スマート入力対応)',
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);

    // 最新コールバックの参照を保持
    const onChangeRef = useRef(onChange);
    const onFocusRef = useRef(onFocus);
    const onRequestSaveFlushRef = useRef(onRequestSaveFlush);
    const onTogglePreviewModeRef = useRef(onTogglePreviewMode);
    const onToggleZenModeRef = useRef(onToggleZenMode);

    useEffect(() => {
      onChangeRef.current = onChange;
      onFocusRef.current = onFocus;
      onRequestSaveFlushRef.current = onRequestSaveFlush;
      onTogglePreviewModeRef.current = onTogglePreviewMode;
      onToggleZenModeRef.current = onToggleZenMode;
    });

    useImperativeHandle(ref, () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      blur: () => {
        viewRef.current?.contentDOM.blur();
      },
      applyFormat: (type: MarkdownFormatType) => {
        if (viewRef.current) {
          executeMarkdownFormat(viewRef.current, type);
        }
      },
      scrollToLine: (lineNumber: number) => {
        const view = viewRef.current;
        if (!view) return;
        const clampedLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines));
        const line = view.state.doc.line(clampedLine);
        view.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 48 }),
        });
        view.focus();
      },
    }));

    // カードIDが変わった時（またはマウント時）にエディタを初期化
    useEffect(() => {
      if (!containerRef.current) return;

      const shortcutKeymap = keymap.of([
        {
          key: 'Mod-b',
          run: (view) => {
            if (view.composing) return false;
            executeMarkdownFormat(view, 'bold');
            return true;
          },
        },
        {
          key: 'Mod-i',
          run: (view) => {
            if (view.composing) return false;
            executeMarkdownFormat(view, 'italic');
            return true;
          },
        },
        {
          key: 'Mod-e',
          run: (view) => {
            if (view.composing) return false;
            executeMarkdownFormat(view, 'code');
            return true;
          },
        },
        {
          key: 'Mod-k',
          run: (view) => {
            if (view.composing) return false;
            executeMarkdownFormat(view, 'link');
            return true;
          },
        },
        {
          key: 'Mod-Shift-u',
          run: (view) => {
            if (view.composing) return false;
            executeMarkdownFormat(view, 'bullet-list');
            return true;
          },
        },
        {
          key: 'Mod-Shift-c',
          run: (view) => {
            if (view.composing) return false;
            executeMarkdownFormat(view, 'task-list');
            return true;
          },
        },
        {
          key: 'Mod-Shift-x',
          run: (view) => {
            if (view.composing) return false;
            executeMarkdownFormat(view, 'strikethrough');
            return true;
          },
        },
        {
          key: 'Mod-Shift-k',
          run: (view) => {
            if (view.composing) return false;
            executeMarkdownFormat(view, 'codeblock');
            return true;
          },
        },
        {
          key: 'Mod-Shift-p',
          run: (view) => {
            if (view.composing) return false;
            onTogglePreviewModeRef.current?.();
            return true;
          },
        },
        {
          key: 'Mod-Shift-f',
          run: (view) => {
            if (view.composing) return false;
            onToggleZenModeRef.current?.();
            return true;
          },
        },
        {
          key: 'Mod-Enter',
          run: (view) => {
            if (view.composing) return false;
            onRequestSaveFlushRef.current?.();
            return true;
          },
        },
        {
          key: 'Escape',
          run: (view) => {
            if (view.composing) return false;
            view.contentDOM.blur();
            return true;
          },
        },
      ]);

      // Ctrl+Shift+1〜3 等の物理キーコード判定用ハンドラ
      const customDomKeyHandler = EditorView.domEventHandlers({
        keydown(event, view) {
          if (view.composing || event.isComposing || event.keyCode === 229) return false;
          const isMod = event.ctrlKey || event.metaKey;
          if (isMod && event.shiftKey && !event.altKey) {
            if (event.code === 'Digit1' || event.key === '1' || event.key === '!') {
              event.preventDefault();
              executeMarkdownFormat(view, 'note-info');
              return true;
            }
            if (event.code === 'Digit2' || event.key === '2' || event.key === '"' || event.key === '@') {
              event.preventDefault();
              executeMarkdownFormat(view, 'note-warn');
              return true;
            }
            if (event.code === 'Digit3' || event.key === '3' || event.key === '#') {
              event.preventDefault();
              executeMarkdownFormat(view, 'note-alert');
              return true;
            }
          }
          return false;
        },
        focus() {
          onFocusRef.current?.();
          return false;
        },
      });

      const state = EditorState.create({
        doc: value,
        extensions: [
          history({ minDepth: 150, newGroupDelay: 500 }),
          shortcutKeymap,
          smartTypingExtension(),
          keymap.of([...historyKeymap, ...defaultKeymap]),
          markdown(),
          EditorView.lineWrapping,
          cmPlaceholder(placeholder),
          livePreviewExtension(),
          customDomKeyHandler,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const nextDoc = update.state.doc.toString();
              onChangeRef.current(nextDoc);
            }
          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cardId]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const currentDoc = view.state.doc.toString();
      if (value !== currentDoc) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: value },
          annotations: isolateHistory.of('full'),
        });
      }
    }, [value]);

    return (
      <div
        ref={containerRef}
        className={`cm-localban-wrapper w-full overflow-y-auto bg-slate-50 hover:bg-white focus-within:bg-white border border-slate-200 rounded-xl focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all text-sm ${
          isZenMode ? 'cm-zen-editor flex-1 min-h-0 h-full' : 'min-h-[280px] max-h-[60vh]'
        } ${isZenMode && isCenteredWidth ? 'cm-zen-centered' : ''}`}
      />
    );
  }
);

MarkdownLiveEditor.displayName = 'MarkdownLiveEditor';
