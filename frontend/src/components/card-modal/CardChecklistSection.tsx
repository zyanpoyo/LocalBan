import React, { useState } from 'react';
import { CheckSquare, Trash2 } from 'lucide-react';
import { Checklist } from '../../types';

interface CardChecklistSectionProps {
  checklists: Checklist[];
  onDeleteChecklist: (checklistId: string) => void;
  onAddChecklistItem: (checklistId: string, text: string) => Promise<void> | void;
  onToggleItemComplete: (item: Checklist['items'][0]) => void;
  onDeleteItem: (checklistId: string, itemId: string) => void;
}

export const CardChecklistSection: React.FC<CardChecklistSectionProps> = ({
  checklists,
  onDeleteChecklist,
  onAddChecklistItem,
  onToggleItemComplete,
  onDeleteItem,
}) => {
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});

  if (checklists.length === 0) return null;

  const handleSubmitItem = async (clId: string) => {
    const text = newItemTexts[clId]?.trim();
    if (!text) return;
    await onAddChecklistItem(clId, text);
    setNewItemTexts((prev) => ({ ...prev, [clId]: '' }));
  };

  return (
    <>
      {checklists.map((cl) => {
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
                onClick={() => onDeleteChecklist(cl.id)}
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
                      onChange={() => onToggleItemComplete(item)}
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
                    onClick={() => onDeleteItem(cl.id, item.id)}
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
                    void handleSubmitItem(cl.id);
                  }
                }}
                placeholder="アイテムを追加..."
                className="flex-1 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:border-indigo-500"
              />
              <button
                onClick={() => void handleSubmitItem(cl.id)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                追加
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
};
