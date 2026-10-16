import React, { useEffect } from 'react';
import { X, Keyboard, PlusSquare, Compass, FileEdit, Code2 } from 'lucide-react';

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  icon: React.ReactNode;
  items: ShortcutItem[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: 'カード作成・保存フロー',
    icon: <PlusSquare className="w-4 h-4 text-indigo-600" />,
    items: [
      { keys: ['c', 'n'], description: '選択中（または先頭）のリストでカード追加を開始' },
      { keys: ['1〜9'], description: '対応する番号のリストでカード追加を直接開始' },
      { keys: ['Enter'], description: 'カードを保存し、続けて次のカードを入力（連続作成）' },
      { keys: ['Ctrl', 'Enter'], description: 'カードを保存して入力フォームを閉じる' },
      { keys: ['Shift', 'Enter'], description: 'カードを保存し、そのまま詳細モーダルを開く' },
      { keys: ['Escape'], description: 'カード入力をキャンセルして閉じる' },
    ],
  },
  {
    title: 'ボードナビゲーション・選択',
    icon: <Compass className="w-4 h-4 text-indigo-600" />,
    items: [
      { keys: ['←', '→'], description: 'アクティブなリスト（カラム）を左右に切り替え' },
      { keys: ['↑', '↓'], description: 'リスト内のカードを上下に選択移動' },
      { keys: ['Enter', 'Space'], description: '選択中のカードの詳細モーダルを開く' },
      { keys: ['?'], description: 'このショートカットキー一覧を表示 / 閉じる' },
    ],
  },
  {
    title: 'カード詳細モーダル内操作',
    icon: <FileEdit className="w-4 h-4 text-indigo-600" />,
    items: [
      { keys: ['Ctrl', 'Shift', 'P'], description: '説明文の「編集 ⇄ プレビュー」を切り替え' },
      { keys: ['Ctrl', 'Enter'], description: '説明文の変更を保存' },
      { keys: ['e'], description: '説明文の編集モードを開始してフォーカス' },
      { keys: ['d'], description: '期限日（Due Date）入力にフォーカス' },
      { keys: ['t', '-'], description: 'チェックリスト追加フォームを開く' },
      { keys: ['c'], description: 'カードの複製メニューを開く' },
      { keys: ['a'], description: 'カードをアーカイブする' },
      { keys: ['Escape'], description: '編集中断または詳細モーダルを閉じる' },
    ],
  },
  {
    title: 'Markdown 装飾（説明欄編集中）',
    icon: <Code2 className="w-4 h-4 text-indigo-600" />,
    items: [
      { keys: ['Ctrl', 'B'], description: '太字 (**太字**)' },
      { keys: ['Ctrl', 'I'], description: '斜体 (*斜体*)' },
      { keys: ['Ctrl', 'Shift', 'X'], description: '取り消し線 (~~取消~~)' },
      { keys: ['Ctrl', 'E'], description: 'インラインコード (`コード`)' },
      { keys: ['Ctrl', 'Shift', 'K'], description: 'コードブロック (```...```)' },
      { keys: ['Ctrl', 'K'], description: 'リンク挿入 ([text](url))' },
      { keys: ['Ctrl', 'Shift', '1〜3'], description: 'Qiita ノート挿入 (info / warn / alert)' },
    ],
  },
];

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-modal-title"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* ヘッダー */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Keyboard className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 id="shortcut-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
                キーボードショートカット一覧
              </h2>
              <p className="text-xs text-slate-500">
                キーボードのみでカード作成から編集・保存まで素早く操作できます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="閉じる (Escape)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ボディ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {SHORTCUT_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center gap-2 border-b border-slate-200/70 pb-2">
                {section.icon}
                <h3 className="text-xs font-bold text-slate-800 tracking-wide">{section.title}</h3>
              </div>
              <div className="divide-y divide-slate-200/50">
                {section.items.map((item, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-700 leading-snug">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <React.Fragment key={k}>
                          {kIdx > 0 && <span className="text-[10px] text-slate-400">+</span>}
                          <kbd className="px-1.5 py-0.5 text-[11px] font-mono font-semibold text-slate-700 bg-white border border-slate-300 rounded-md shadow-2xs">
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-slate-200/80 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
          <span>
            ヒント: ボード上でいつでも <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-white border border-slate-300 rounded text-slate-700">?</kbd> キーを押すとこの画面を開けます
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
