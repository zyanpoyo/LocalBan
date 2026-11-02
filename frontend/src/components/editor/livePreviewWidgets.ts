import { EditorView, WidgetType } from '@codemirror/view';
import { isolateHistory } from '@codemirror/commands';

/**
 * タスクリスト (- [ ] / - [x]) のインタラクティブ・チェックボックス Widget
 */
export class TaskCheckboxWidget extends WidgetType {
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
export class BulletPointWidget extends WidgetType {
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
export class LinkIconWidget extends WidgetType {
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
