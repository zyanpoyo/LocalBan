export type NoteVariant = 'info' | 'warn' | 'alert';

export type MarkdownSegment =
  | { type: 'markdown'; content: string }
  | { type: 'note'; variant: NoteVariant; content: string };

export const MARKDOWN_SHORTCUT_ITEMS: {
  type: string;
  label: string;
  shortcut: string;
  syntax: string;
}[] = [
  { type: 'toggle-preview', label: 'Live編集 ⇄ 全体プレビュー', shortcut: 'Ctrl+Shift+P', syntax: 'モード切替' },
  { type: 'save-desc', label: '説明文を即時保存 (自動保存対応)', shortcut: 'Ctrl+Enter', syntax: '即時Flush' },
  { type: 'smart-list', label: 'リスト・引用の自動継続 / 空行解除', shortcut: 'Enter', syntax: '- / 1. / - [ ] / >' },
  { type: 'smart-indent', label: 'リストのインデント増減', shortcut: 'Tab / Shift+Tab', syntax: '階層ネスト' },
  { type: 'auto-surround', label: '選択テキストの自動囲み', shortcut: '` * ~ [ (', syntax: '選択中に記号キー' },
  { type: 'smart-paste', label: 'スマートペースト (URLリンク化)', shortcut: 'Ctrl+V', syntax: '選択中にURL貼付' },
  { type: 'bold', label: '太字', shortcut: 'Ctrl+B', syntax: '**太字**' },
  { type: 'italic', label: '斜体', shortcut: 'Ctrl+I', syntax: '*斜体*' },
  { type: 'strikethrough', label: '取り消し線', shortcut: 'Ctrl+Shift+X', syntax: '~~取消~~' },
  { type: 'code', label: 'インラインコード', shortcut: 'Ctrl+E', syntax: '`コード`' },
  { type: 'codeblock', label: 'コードブロック', shortcut: 'Ctrl+Shift+K', syntax: '```...```' },
  { type: 'link', label: 'リンク挿入', shortcut: 'Ctrl+K', syntax: '[text](url)' },
  { type: 'bullet-list', label: '箇条書きリスト', shortcut: 'Ctrl+Shift+U', syntax: '- 項目' },
  { type: 'task-list', label: 'チェックボックス', shortcut: 'Ctrl+Shift+C', syntax: '- [ ] タスク' },
  { type: 'note-info', label: 'Qiitaノート (補足)', shortcut: 'Ctrl+Shift+1', syntax: ':::note info' },
  { type: 'note-warn', label: 'Qiitaノート (警告)', shortcut: 'Ctrl+Shift+2', syntax: ':::note warn' },
  { type: 'note-alert', label: 'Qiitaノート (強い警告)', shortcut: 'Ctrl+Shift+3', syntax: ':::note alert' },
];

// Qiita互換 :::note [info|warn|alert] ブロックを抽出するパーサー（コードブロック内は除外）
export const parseMarkdownSegments = (markdown: string): MarkdownSegment[] => {
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
