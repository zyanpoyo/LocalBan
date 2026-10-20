import { Extension, RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { isolateHistory } from '@codemirror/commands';
import { openExternalUrl } from '../../api';

/**
 * タスクリスト (- [ ] / - [x]) のインタラクティブ・チェックボックス Widget
 */
class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly bracketPos: number // '[' のドキュメント内絶対位置
  ) {
    super();
  }

  eq(other: TaskCheckboxWidget): boolean {
    return this.checked === other.checked && this.bracketPos === other.bracketPos;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-lp-task-widget';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.className = 'cm-lp-task-checkbox';
    input.title = this.checked ? '未完了に戻す' : '完了にする';

    // クリック時にキャレット移動による生テキスト化を防ぎつつ、[ ] ⇄ [x] をトグルする
    input.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetFrom = this.bracketPos;
      const targetTo = this.bracketPos + 3; // "[ ]" or "[x]"
      const currentSlice = view.state.doc.sliceString(targetFrom, targetTo);
      if (/^\[[ xX]\]$/.test(currentSlice)) {
        const nextStr = this.checked ? '[ ]' : '[x]';
        view.dispatch({
          changes: { from: targetFrom, to: targetTo, insert: nextStr },
          userEvent: 'input.toggle-task',
          annotations: isolateHistory.of('full'),
        });
      }
    });

    wrapper.appendChild(input);
    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/**
 * 順不同リスト (- / * / +) のビュレット記号 Widget
 */
class BulletPointWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-lp-bullet-widget';
    span.textContent = '• ';
    return span;
  }

  eq(): boolean {
    return true;
  }
}

/**
 * リンク末尾の外部遷移アイコン Widget
 */
class LinkIconWidget extends WidgetType {
  constructor(readonly url: string) {
    super();
  }

  eq(other: LinkIconWidget): boolean {
    return this.url === other.url;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-lp-link-icon';
    span.textContent = ' ↗';
    span.title = `${this.url} を開く`;
    span.dataset.lpUrl = this.url;
    return span;
  }
}

interface PendingDeco {
  from: number;
  to: number;
  deco: Decoration;
}

/**
 * 現在カーソルまたは選択範囲が存在するアクティブ行番号の Set を取得する
 */
function getActiveLineNumbers(view: EditorView): Set<number> {
  const active = new Set<number>();
  // エディタにフォーカスがない場合は全行を非アクティブ（プレビュー装飾状態）にする
  if (!view.hasFocus) return active;

  const { doc, selection } = view.state;
  for (const range of selection.ranges) {
    const startLine = doc.lineAt(range.from).number;
    const endLine = doc.lineAt(range.to).number;
    for (let l = startLine; l <= endLine; l++) {
      active.add(l);
    }
  }
  return active;
}

function areSetsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

/**
 * 単一行内のインラインMarkdown構文（コード・リンク・太字・斜体・取消線）を解析して Decoration を追加する
 */
function collectInlineDecorations(
  lineText: string,
  lineFrom: number,
  contentStartOffset: number,
  out: PendingDeco[]
): void {
  const occupied = new Uint8Array(lineText.length);
  const markOccupied = (start: number, end: number) => {
    for (let i = start; i < end; i++) occupied[i] = 1;
  };
  const isRangeFree = (start: number, end: number) => {
    for (let i = start; i < end; i++) {
      if (occupied[i]) return false;
    }
    return true;
  };

  // contentStartOffset より手前（行頭マーカー領域）はインライン解析対象外とする
  markOccupied(0, contentStartOffset);

  // 1. インラインコード: `code` または ``code``
  const codeRegex = /(`+)([^`]+?)\1/g;
  let match: RegExpExecArray | null;
  while ((match = codeRegex.exec(lineText)) !== null) {
    const fullStart = match.index;
    const fullEnd = fullStart + match[0].length;
    if (!isRangeFree(fullStart, fullEnd)) continue;

    const tickLen = match[1].length;
    const innerStart = fullStart + tickLen;
    const innerEnd = fullEnd - tickLen;
    if (innerStart >= innerEnd) continue;

    out.push({
      from: lineFrom + fullStart,
      to: lineFrom + innerStart,
      deco: Decoration.replace({}),
    });
    out.push({
      from: lineFrom + innerStart,
      to: lineFrom + innerEnd,
      deco: Decoration.mark({ class: 'cm-lp-inline-code' }),
    });
    out.push({
      from: lineFrom + innerEnd,
      to: lineFrom + fullEnd,
      deco: Decoration.replace({}),
    });

    markOccupied(fullStart, fullEnd);
  }

  // 2. リンク: [title](url) （画像 ![alt](url) は除く）
  const linkRegex = /(?<!\!)\[([^\]]+)\]\((https?:\/\/[^\s)]+|[^\s)]+)\)/g;
  while ((match = linkRegex.exec(lineText)) !== null) {
    const fullStart = match.index;
    const fullEnd = fullStart + match[0].length;
    if (!isRangeFree(fullStart, fullEnd)) continue;

    const titleText = match[1];
    const urlText = match[2];
    const titleStart = fullStart + 1;
    const titleEnd = titleStart + titleText.length;

    // '[' を隠蔽
    out.push({
      from: lineFrom + fullStart,
      to: lineFrom + titleStart,
      deco: Decoration.replace({}),
    });
    // タイトル部分にリンクスタイルと data-lp-url 属性を付与
    out.push({
      from: lineFrom + titleStart,
      to: lineFrom + titleEnd,
      deco: Decoration.mark({
        class: 'cm-lp-link',
        attributes: {
          'data-lp-url': urlText,
          title: `${urlText} (クリックまたは Ctrl+Click で開く)`,
        },
      }),
    });
    // '](url)' を隠蔽し、外部リンクアイコンWidgetを表示
    out.push({
      from: lineFrom + titleEnd,
      to: lineFrom + fullEnd,
      deco: Decoration.replace({
        widget: new LinkIconWidget(urlText),
      }),
    });

    markOccupied(fullStart, fullEnd);
  }

  // 3. 太字 + 斜体: ***text***
  const boldItalicRegex = /(\*\*\*)([^*]+?)(\*\*\*)/g;
  while ((match = boldItalicRegex.exec(lineText)) !== null) {
    const fullStart = match.index;
    const fullEnd = fullStart + match[0].length;
    if (!isRangeFree(fullStart, fullEnd)) continue;

    const innerStart = fullStart + 3;
    const innerEnd = fullEnd - 3;
    out.push({
      from: lineFrom + fullStart,
      to: lineFrom + innerStart,
      deco: Decoration.replace({}),
    });
    out.push({
      from: lineFrom + innerStart,
      to: lineFrom + innerEnd,
      deco: Decoration.mark({ class: 'cm-lp-bold cm-lp-italic' }),
    });
    out.push({
      from: lineFrom + innerEnd,
      to: lineFrom + fullEnd,
      deco: Decoration.replace({}),
    });
    markOccupied(fullStart, fullEnd);
  }

  // 4. 太字: **text** または __text__
  const boldRegex = /(\*\*|__)((?:(?!\1).)+?)\1/g;
  while ((match = boldRegex.exec(lineText)) !== null) {
    const fullStart = match.index;
    const fullEnd = fullStart + match[0].length;
    if (!isRangeFree(fullStart, fullEnd)) continue;

    const innerStart = fullStart + 2;
    const innerEnd = fullEnd - 2;
    out.push({
      from: lineFrom + fullStart,
      to: lineFrom + innerStart,
      deco: Decoration.replace({}),
    });
    out.push({
      from: lineFrom + innerStart,
      to: lineFrom + innerEnd,
      deco: Decoration.mark({ class: 'cm-lp-bold' }),
    });
    out.push({
      from: lineFrom + innerEnd,
      to: lineFrom + fullEnd,
      deco: Decoration.replace({}),
    });
    markOccupied(fullStart, fullEnd);
  }

  // 5. 打ち消し線: ~~text~~
  const strikeRegex = /(~~)((?:(?!~~).)+?)(~~)/g;
  while ((match = strikeRegex.exec(lineText)) !== null) {
    const fullStart = match.index;
    const fullEnd = fullStart + match[0].length;
    if (!isRangeFree(fullStart, fullEnd)) continue;

    const innerStart = fullStart + 2;
    const innerEnd = fullEnd - 2;
    out.push({
      from: lineFrom + fullStart,
      to: lineFrom + innerStart,
      deco: Decoration.replace({}),
    });
    out.push({
      from: lineFrom + innerStart,
      to: lineFrom + innerEnd,
      deco: Decoration.mark({ class: 'cm-lp-strikethrough' }),
    });
    out.push({
      from: lineFrom + innerEnd,
      to: lineFrom + fullEnd,
      deco: Decoration.replace({}),
    });
    markOccupied(fullStart, fullEnd);
  }

  // 6. 斜体: *text* （前後に * がない単一アスタリスク）
  const italicRegex = /(?<!\*)\*([^*\s][^*]*?)\*(?!\*)/g;
  while ((match = italicRegex.exec(lineText)) !== null) {
    const fullStart = match.index;
    const fullEnd = fullStart + match[0].length;
    if (!isRangeFree(fullStart, fullEnd)) continue;

    const innerStart = fullStart + 1;
    const innerEnd = fullEnd - 1;
    out.push({
      from: lineFrom + fullStart,
      to: lineFrom + innerStart,
      deco: Decoration.replace({}),
    });
    out.push({
      from: lineFrom + innerStart,
      to: lineFrom + innerEnd,
      deco: Decoration.mark({ class: 'cm-lp-italic' }),
    });
    out.push({
      from: lineFrom + innerEnd,
      to: lineFrom + fullEnd,
      deco: Decoration.replace({}),
    });
    markOccupied(fullStart, fullEnd);
  }
}

/**
 * Live Preview の DecorationSet を構築する（非アクティブ行のみ装飾、アクティブ行は生テキスト）
 */
function buildLivePreviewDecorations(view: EditorView, activeLines: Set<number>): DecorationSet {
  const { doc } = view.state;
  const pending: PendingDeco[] = [];

  // コードフェンスと Qiita :::note の状態をドキュメント先頭から走査して把握
  let inCodeFence = false;
  let fenceChar = '';
  let inNoteVariant: 'info' | 'warn' | 'alert' | null = null;

  for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
    const line = doc.line(lineNo);
    const text = line.text;
    const isActive = activeLines.has(lineNo);

    // 1. コードフェンス判定
    const fenceMatch = text.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const ch = fenceMatch[1][0];
      if (!inCodeFence) {
        inCodeFence = true;
        fenceChar = ch;
        if (!isActive) {
          pending.push({
            from: line.from,
            to: line.from,
            deco: Decoration.line({ class: 'cm-lp-codeblock-fence cm-lp-codeblock-start' }),
          });
        }
        continue;
      } else if (ch === fenceChar) {
        inCodeFence = false;
        fenceChar = '';
        if (!isActive) {
          pending.push({
            from: line.from,
            to: line.from,
            deco: Decoration.line({ class: 'cm-lp-codeblock-fence cm-lp-codeblock-end' }),
          });
        }
        continue;
      }
    }

    if (inCodeFence) {
      pending.push({
        from: line.from,
        to: line.from,
        deco: Decoration.line({ class: 'cm-lp-codeblock-line' }),
      });
      continue;
    }

    // 2. Qiita :::note ブロック判定
    if (!inNoteVariant) {
      const noteStartMatch = text.match(/^:::note(?:\s+(info|warn|alert))?\s*$/);
      if (noteStartMatch) {
        inNoteVariant = (noteStartMatch[1] as 'info' | 'warn' | 'alert') || 'info';
        if (!isActive) {
          pending.push({
            from: line.from,
            to: line.from,
            deco: Decoration.line({ class: `cm-lp-note-line cm-lp-note-${inNoteVariant} cm-lp-note-header` }),
          });
        }
        continue;
      }
    } else if (/^:::\s*$/.test(text)) {
      const closingVariant = inNoteVariant;
      inNoteVariant = null;
      if (!isActive) {
        pending.push({
          from: line.from,
          to: line.from,
          deco: Decoration.line({ class: `cm-lp-note-line cm-lp-note-${closingVariant} cm-lp-note-footer` }),
        });
      }
      continue;
    }

    if (inNoteVariant) {
      pending.push({
        from: line.from,
        to: line.from,
        deco: Decoration.line({ class: `cm-lp-note-line cm-lp-note-${inNoteVariant}` }),
      });
    }

    // アクティブ行（キャレットが存在する行）は構文記号の隠蔽を行わず、生テキストをそのまま表示する
    if (isActive) {
      continue;
    }

    let contentStartOffset = 0;

    // 3. 見出し (# 〜 ######)
    const headingMatch = text.match(/^(#{1,6})(\s+)(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const prefixLen = headingMatch[1].length + headingMatch[2].length;
      pending.push({
        from: line.from,
        to: line.from,
        deco: Decoration.line({ class: `cm-lp-heading cm-lp-h${level}` }),
      });
      pending.push({
        from: line.from,
        to: line.from + prefixLen,
        deco: Decoration.replace({}),
      });
      contentStartOffset = prefixLen;
      collectInlineDecorations(text, line.from, contentStartOffset, pending);
      continue;
    }

    // 4. タスクリスト (- [ ] / - [x])
    const taskMatch = text.match(/^(\s*)([-*+]\s+\[([ xX])\]\s+)(.*)$/);
    if (taskMatch) {
      const indentLen = taskMatch[1].length;
      const markerLen = taskMatch[2].length;
      const isChecked = taskMatch[3].toLowerCase() === 'x';
      const bracketIndexInLine = text.indexOf('[', indentLen);

      pending.push({
        from: line.from,
        to: line.from,
        deco: Decoration.line({ class: isChecked ? 'cm-lp-task-line cm-lp-task-done' : 'cm-lp-task-line' }),
      });
      pending.push({
        from: line.from + indentLen,
        to: line.from + indentLen + markerLen,
        deco: Decoration.replace({
          widget: new TaskCheckboxWidget(isChecked, line.from + bracketIndexInLine),
        }),
      });
      contentStartOffset = indentLen + markerLen;
      if (isChecked && line.from + contentStartOffset < line.to) {
        pending.push({
          from: line.from + contentStartOffset,
          to: line.to,
          deco: Decoration.mark({ class: 'cm-lp-task-checked-text' }),
        });
      }
      collectInlineDecorations(text, line.from, contentStartOffset, pending);
      continue;
    }

    // 5. 順不同リスト (- / * / +)
    const bulletMatch = text.match(/^(\s*)([-*+]\s+)(.+)$/);
    if (bulletMatch) {
      const indentLen = bulletMatch[1].length;
      const markerLen = bulletMatch[2].length;
      pending.push({
        from: line.from + indentLen,
        to: line.from + indentLen + markerLen,
        deco: Decoration.replace({
          widget: new BulletPointWidget(),
        }),
      });
      contentStartOffset = indentLen + markerLen;
      collectInlineDecorations(text, line.from, contentStartOffset, pending);
      continue;
    }

    // 6. 順序付きリスト (1. , 2. 等)
    const orderedMatch = text.match(/^(\s*)(\d+\.\s+)(.+)$/);
    if (orderedMatch) {
      const indentLen = orderedMatch[1].length;
      const markerLen = orderedMatch[2].length;
      pending.push({
        from: line.from + indentLen,
        to: line.from + indentLen + markerLen,
        deco: Decoration.mark({ class: 'cm-lp-ordered-marker' }),
      });
      contentStartOffset = indentLen + markerLen;
      collectInlineDecorations(text, line.from, contentStartOffset, pending);
      continue;
    }

    // 7. 引用 (> )
    const quoteMatch = text.match(/^(\s*)((?:>\s*)+)(.*)$/);
    if (quoteMatch) {
      const indentLen = quoteMatch[1].length;
      const markerLen = quoteMatch[2].length;
      pending.push({
        from: line.from,
        to: line.from,
        deco: Decoration.line({ class: 'cm-lp-blockquote-line' }),
      });
      pending.push({
        from: line.from + indentLen,
        to: line.from + indentLen + markerLen,
        deco: Decoration.replace({}),
      });
      contentStartOffset = indentLen + markerLen;
      collectInlineDecorations(text, line.from, contentStartOffset, pending);
      continue;
    }

    // 8. 通常の段落行
    collectInlineDecorations(text, line.from, 0, pending);
  }

  // RangeSetBuilder は from 昇順（同一 from の場合は startSide 昇順）である必要があるためソート
  pending.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return a.deco.startSide - b.deco.startSide;
  });

  const builder = new RangeSetBuilder<Decoration>();
  for (const item of pending) {
    builder.add(item.from, item.to, item.deco);
  }
  return builder.finish();
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    activeLines: Set<number>;

    constructor(view: EditorView) {
      this.activeLines = getActiveLineNumbers(view);
      this.decorations = buildLivePreviewDecorations(view, this.activeLines);
    }

    update(update: ViewUpdate) {
      const nextActiveLines = getActiveLineNumbers(update.view);
      const activeLinesChanged = !areSetsEqual(this.activeLines, nextActiveLines);

      // ドキュメント変更、フォーカス変化、ビューポート変化、またはキャレット行の移動があった場合のみ更新
      if (
        update.docChanged ||
        update.focusChanged ||
        update.viewportChanged ||
        activeLinesChanged
      ) {
        this.activeLines = nextActiveLines;
        this.decorations = buildLivePreviewDecorations(update.view, this.activeLines);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * リンク（[title](url)）のクリック遷移ハンドラ
 * - 非アクティブ行の装飾リンクをクリックした時、または Ctrl/Cmd + Click した時に外部ブラウザで開く
 */
const livePreviewLinkClickHandler = EditorView.domEventHandlers({
  mousedown(event) {
    if (event.button !== 0) return false;
    const target = event.target as HTMLElement | null;
    if (!target) return false;

    const linkElem = target.closest?.('[data-lp-url]') as HTMLElement | null;
    if (!linkElem) return false;

    const url = linkElem.dataset.lpUrl;
    if (!url) return false;

    // 外部アイコンクリック、または Ctrl/Cmd + Click、または通常の左クリックでリンク遷移
    const isIconClick = target.classList.contains('cm-lp-link-icon');
    const isModClick = event.ctrlKey || event.metaKey;

    if (isIconClick || isModClick || linkElem.classList.contains('cm-lp-link')) {
      event.preventDefault();
      event.stopPropagation();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        openExternalUrl(url).catch(console.error);
      }
      return true;
    }

    return false;
  },
});

/**
 * Live Preview（インラインレンダリング）統合拡張
 */
export function livePreviewExtension(): Extension {
  return [livePreviewPlugin, livePreviewLinkClickHandler];
}
