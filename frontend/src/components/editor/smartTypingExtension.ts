import { EditorState, Extension, Transaction, ChangeSpec, EditorSelection } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { isolateHistory } from '@codemirror/commands';

export interface ParsedLineMarker {
  kind: 'task' | 'bullet' | 'ordered' | 'quote';
  indent: string;
  /** 現在の行のマーカー部分全体（インデント除く。例: "- [ ] ", "1. ", "> "） */
  rawMarker: string;
  /** 改行時に次行へ挿入するマーカー（インデント除く。例: "- [ ] ", "2. ", "> "） */
  nextMarker: string;
  /** 順序付きリストの場合の現在番号 */
  orderNumber?: number;
  /** 本文テキスト */
  content: string;
  /** 行内での本文開始オフセット */
  contentOffset: number;
}

/**
 * 行テキストからリスト・タスクリスト・引用のマーカー構造を解析する純粋関数
 */
export function parseLineMarker(lineText: string): ParsedLineMarker | null {
  // 1. タスクリスト: - [ ] , - [x] , * [ ] , + [ ]
  const taskMatch = lineText.match(/^(\s*)([-*+])\s+\[([ xX])\](\s+|$)(.*)$/);
  if (taskMatch) {
    const [, indent, bullet, , spaceAfter, content] = taskMatch;
    // "- [ ]" 直後にスペースがない場合はマーカーとして成立させない（ただし空行解除のため行末なら許容）
    if (!spaceAfter && content.length > 0) return null;
    const rawMarker = lineText.slice(indent.length, lineText.length - content.length);
    return {
      kind: 'task',
      indent,
      rawMarker,
      nextMarker: `${bullet} [ ] `,
      content,
      contentOffset: indent.length + rawMarker.length,
    };
  }

  // 2. 順不同リスト: - , * , +
  const bulletMatch = lineText.match(/^(\s*)([-*+])(\s+)(.*)$/);
  if (bulletMatch) {
    const [, indent, bullet, spaceAfter, content] = bulletMatch;
    const rawMarker = `${bullet}${spaceAfter}`;
    return {
      kind: 'bullet',
      indent,
      rawMarker,
      nextMarker: `${bullet} `,
      content,
      contentOffset: indent.length + rawMarker.length,
    };
  }

  // 3. 順序付きリスト: 1. , 2. 等
  const orderedMatch = lineText.match(/^(\s*)(\d+)\.(\s+)(.*)$/);
  if (orderedMatch) {
    const [, indent, numStr, spaceAfter, content] = orderedMatch;
    const num = parseInt(numStr, 10);
    const rawMarker = `${numStr}.${spaceAfter}`;
    return {
      kind: 'ordered',
      indent,
      rawMarker,
      nextMarker: `${num + 1}. `,
      orderNumber: num,
      content,
      contentOffset: indent.length + rawMarker.length,
    };
  }

  // 4. 引用: > , >> 等
  const quoteMatch = lineText.match(/^(\s*)((?:>\s*)+)(.*)$/);
  if (quoteMatch) {
    const [, indent, rawQuote, content] = quoteMatch;
    const normalizedQuote = rawQuote.endsWith(' ') ? rawQuote : `${rawQuote} `;
    return {
      kind: 'quote',
      indent,
      rawMarker: rawQuote,
      nextMarker: normalizedQuote,
      content,
      contentOffset: indent.length + rawQuote.length,
    };
  }

  return null;
}

/**
 * 指定行がコードフェンス（``` または ~~~）の内部にあるか判定する
 */
export function isInsideCodeFence(doc: EditorState['doc'], lineNumber: number): boolean {
  let inFence = false;
  let fenceChar = '';
  for (let i = 1; i < lineNumber; i++) {
    const text = doc.line(i).text;
    const match = text.match(/^\s*(`{3,}|~{3,})/);
    if (match) {
      const ch = match[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
      } else if (ch === fenceChar) {
        inFence = false;
        fenceChar = '';
      }
    }
  }
  return inFence;
}

/**
 * 選択テキストを記号で囲む Auto-surround の変換ペア定義
 */
const SURROUND_MAP: Record<string, { open: string; close: string }> = {
  '`': { open: '`', close: '`' },
  '*': { open: '*', close: '*' },
  '~': { open: '~~', close: '~~' },
  '[': { open: '[', close: ']' },
  '(': { open: '(', close: ')' },
};

/**
 * URL文字列かどうかを厳密に判定する（スマートペースト用）
 */
export function isValidHttpUrl(text: string): boolean {
  if (!text || /\s/.test(text)) return false;
  return /^https?:\/\/[^\s<>"]+$/i.test(text);
}

/**
 * Enterキー押下時のリスト・引用自動継続および空行解除コマンド
 */
function handleSmartEnter(view: EditorView): boolean {
  if (view.composing) return false;

  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;

  const line = state.doc.lineAt(sel.head);
  if (isInsideCodeFence(state.doc, line.number)) return false;

  const parsed = parseLineMarker(line.text);
  if (!parsed) return false;

  const offsetInLine = sel.head - line.from;

  // キャレットがマーカーより手前（行頭インデント部分など）にある場合は通常の改行を行う
  if (offsetInLine < parsed.contentOffset && parsed.content.trim().length > 0) {
    return false;
  }

  // (A) 空行での解除: マーカーのみが存在し、本文が入力されていない状態で Enter を押下した場合
  if (parsed.content.trim().length === 0) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
      userEvent: 'delete.marker',
      annotations: isolateHistory.of('full'),
    });
    return true;
  }

  // (B) 改行時の自動継続:
  // 要件 2.3.1: 自動継続で `- ` 等が挿入された直後に Ctrl+Z を押下した場合、
  // まず「自動挿入されたマーカーのみが取り消されて空行に戻る」よう、
  // 1. 改行トランザクション と 2. マーカー挿入トランザクション を明確に分離して dispatch する。

  // Step 1: 通常の改行のみを挿入
  view.dispatch({
    changes: { from: sel.head, to: sel.head, insert: '\n' },
    selection: { anchor: sel.head + 1 },
    userEvent: 'input.newline',
    annotations: isolateHistory.of('full'),
  });

  // Step 2: 次の行の行頭にマーカーを自動挿入（順序付きリストの場合は後続の連番もインクリメント）
  const nextState = view.state;
  const insertPos = nextState.selection.main.head;
  const fullPrefix = `${parsed.indent}${parsed.nextMarker}`;
  const changes: ChangeSpec[] = [{ from: insertPos, to: insertPos, insert: fullPrefix }];

  if (parsed.kind === 'ordered' && parsed.orderNumber !== undefined) {
    const newLine = nextState.doc.lineAt(insertPos);
    let expectedNum = parsed.orderNumber + 2;
    for (let lineNo = newLine.number + 1; lineNo <= nextState.doc.lines; lineNo++) {
      const targetLine = nextState.doc.line(lineNo);
      const m = targetLine.text.match(/^(\s*)(\d+)(\.\s+)/);
      if (m && m[1] === parsed.indent) {
        const numStart = targetLine.from + m[1].length;
        const numEnd = numStart + m[2].length;
        changes.push({ from: numStart, to: numEnd, insert: String(expectedNum) });
        expectedNum++;
      } else {
        break;
      }
    }
  }

  view.dispatch({
    changes,
    selection: { anchor: insertPos + fullPrefix.length },
    userEvent: 'input.autolist',
    annotations: isolateHistory.of('full'),
    scrollIntoView: true,
  });

  return true;
}

/**
 * Tab キーによるインデント追加（2スペース）
 */
function handleSmartTab(view: EditorView): boolean {
  if (view.composing) return false;
  const { state } = view;
  const sel = state.selection.main;
  const startLine = state.doc.lineAt(sel.from);
  const endLine = state.doc.lineAt(sel.to);

  const INDENT_UNIT = '  ';

  // 単一行または複数行でリスト・引用行、あるいは複数行選択時は行頭インデントを下げる
  const parsedStart = parseLineMarker(startLine.text);
  if (parsedStart || startLine.number !== endLine.number) {
    const changes: ChangeSpec[] = [];
    for (let i = startLine.number; i <= endLine.number; i++) {
      const l = state.doc.line(i);
      changes.push({ from: l.from, to: l.from, insert: INDENT_UNIT });
    }
    view.dispatch({
      changes,
      userEvent: 'indent',
      annotations: isolateHistory.of('full'),
    });
    return true;
  }

  // 通常行での Tab もフォーカスがエディタ外へ抜けないよう2スペースを挿入
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: INDENT_UNIT },
    selection: { anchor: sel.from + INDENT_UNIT.length },
    userEvent: 'indent',
    annotations: isolateHistory.of('full'),
  });
  return true;
}

/**
 * Shift + Tab キーによるインデント解除（1レベル上げる、最上位の場合は何もしない）
 */
function handleSmartShiftTab(view: EditorView): boolean {
  if (view.composing) return false;
  const { state } = view;
  const sel = state.selection.main;
  const startLine = state.doc.lineAt(sel.from);
  const endLine = state.doc.lineAt(sel.to);

  const changes: ChangeSpec[] = [];
  for (let i = startLine.number; i <= endLine.number; i++) {
    const l = state.doc.line(i);
    if (l.text.startsWith('\t')) {
      changes.push({ from: l.from, to: l.from + 1, insert: '' });
    } else {
      const spaceMatch = l.text.match(/^( {1,2})/);
      if (spaceMatch) {
        changes.push({ from: l.from, to: l.from + spaceMatch[1].length, insert: '' });
      }
    }
  }

  if (changes.length > 0) {
    view.dispatch({
      changes,
      userEvent: 'dedent',
      annotations: isolateHistory.of('full'),
    });
  }
  // 最上位でインデントがない場合もフォーカス移動を抑止するため true を返す
  return true;
}

/**
 * 選択テキストの自動ラップ (Auto-surround) ハンドラ
 */
const autoSurroundInputHandler = EditorView.inputHandler.of((view, from, to, text) => {
  if (view.composing) return false;

  // 文字列が選択されている状態 (from < to) で対象記号が1文字入力された場合のみ発火
  const sel = view.state.selection.main;
  if (sel.empty || from >= to) return false;

  const pair = SURROUND_MAP[text];
  if (!pair) return false;

  const selectedText = view.state.doc.sliceString(from, to);
  const wrapped = `${pair.open}${selectedText}${pair.close}`;

  // ラップ完了後、囲まれたテキスト全体を再選択状態のまま維持する（これにより * の2連続入力で **選択テキスト** へ自然に昇格可能）
  const newSelStart = from + pair.open.length;
  const newSelEnd = newSelStart + selectedText.length;

  view.dispatch({
    changes: { from, to, insert: wrapped },
    selection: EditorSelection.range(newSelStart, newSelEnd),
    userEvent: 'input.surround',
    annotations: isolateHistory.of('full'),
  });

  return true;
});

/**
 * スマートペースト（URL自動リンク化）および IME イベント監視ハンドラ
 */
const smartPasteAndImeHandlers = EditorView.domEventHandlers({
  paste(event, view) {
    if (view.composing) return false;

    const clipboardData = event.clipboardData;
    if (!clipboardData) return false;

    // クリップボードに画像が含まれる場合は CardModal 側の画像添付ペーストに委ねる
    for (let i = 0; i < clipboardData.items.length; i++) {
      if (clipboardData.items[i].type.startsWith('image/')) {
        return false;
      }
    }

    const sel = view.state.selection.main;
    // 1. エディタ上で1文字以上の文字列が選択されている
    if (sel.empty) return false;

    // 2. ペーストされるテキストが有効なURL形式 (https?://...) に完全一致している
    const pastedText = clipboardData.getData('text/plain');
    if (!isValidHttpUrl(pastedText)) {
      return false;
    }

    const selectedText = view.state.doc.sliceString(sel.from, sel.to);
    // 選択文字列自体に改行が含まれる場合は通常のペーストとする
    if (/[\r\n]/.test(selectedText)) {
      return false;
    }

    event.preventDefault();
    const markdownLink = `[${selectedText}](${pastedText})`;

    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: markdownLink },
      // 閉じ括弧の直後にカーソルを配置（1回のUndoで操作前の選択状態へ復帰可能）
      selection: { anchor: sel.from + markdownLink.length },
      userEvent: 'input.paste.smartlink',
      annotations: isolateHistory.of('full'),
      scrollIntoView: true,
    });

    return true;
  },
});

/**
 * 単語区切り（スペース、改行）ごとに Undo 履歴ステップを区切る Transaction Extender
 */
const wordBoundaryHistoryExtender = EditorState.transactionExtender.of((tr: Transaction) => {
  if (!tr.docChanged || !tr.isUserEvent('input.type')) return null;

  let hasBoundary = false;
  tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
    const text = inserted.toString();
    if (text === ' ' || text === '　' || text.includes('\n')) {
      hasBoundary = true;
    }
  });

  if (hasBoundary) {
    return {
      annotations: isolateHistory.of('before'),
    };
  }
  return null;
});

/**
 * Smart Typing 統合拡張
 */
export function smartTypingExtension(): Extension {
  return [
    keymap.of([
      {
        key: 'Enter',
        run: handleSmartEnter,
      },
      {
        key: 'Tab',
        run: handleSmartTab,
      },
      {
        key: 'Shift-Tab',
        run: handleSmartShiftTab,
      },
    ]),
    autoSurroundInputHandler,
    smartPasteAndImeHandlers,
    wordBoundaryHistoryExtender,
  ];
}
