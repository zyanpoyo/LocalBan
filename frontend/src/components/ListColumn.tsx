import React, { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, MoreHorizontal, Trash2, X } from 'lucide-react';
import { Card, ListModel } from '../types';
import { CardItem } from './CardItem';

interface ListColumnProps {
  list: ListModel;
  index: number;
  cards: Card[];
  onUpdateListTitle: (listId: string, newTitle: string) => void;
  onDeleteList: (list: ListModel) => void;
  onAddCard: (listId: string, title: string) => void;
  onSelectCard: (card: Card) => void;
}

export const ListColumn: React.FC<ListColumnProps> = ({
  list,
  index,
  cards,
  onUpdateListTitle,
  onDeleteList,
  onAddCard,
  onSelectCard,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const handleTitleSubmit = () => {
    if (title.trim() && title.trim() !== list.title) {
      onUpdateListTitle(list.id, title.trim());
    } else {
      setTitle(list.title);
    }
    setIsEditingTitle(false);
  };

  const handleAddCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCardTitle.trim()) {
      onAddCard(list.id, newCardTitle.trim());
      setNewCardTitle('');
      setIsAddingCard(false);
    }
  };

  return (
    <Draggable draggableId={list.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="w-72 sm:w-80 shrink-0 bg-slate-100/90 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col max-h-[calc(100vh-6rem)]"
        >
          {/* リストヘッダー */}
          <div
            {...provided.dragHandleProps}
            className="p-3.5 flex items-center justify-between gap-2 border-b border-slate-200/50 cursor-grab active:cursor-grabbing"
          >
            {isEditingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') {
                    setTitle(list.title);
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                className="w-full px-2 py-1 text-sm font-semibold bg-white border border-indigo-500 rounded-md outline-hidden shadow-xs"
              />
            ) : (
              <div
                onClick={() => setIsEditingTitle(true)}
                className="flex items-center gap-2 flex-1 cursor-pointer group"
              >
                <h2 className="text-sm font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">
                  {list.title}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-semibold">
                  {cards.length}
                </span>
              </div>
            )}

            {/* リストメニュー */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="リスト操作"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDeleteList(list);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>リストを削除</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* カード一覧 (Droppable) */}
          <Droppable droppableId={list.id} type="card">
            {(dropProvided, snapshot) => (
              <div
                ref={dropProvided.innerRef}
                {...dropProvided.droppableProps}
                className={`flex-1 p-2.5 overflow-y-auto space-y-2.5 min-h-16 transition-colors rounded-b-xl ${
                  snapshot.isDraggingOver ? 'bg-indigo-50/50' : ''
                }`}
              >
                {cards.map((card, cIndex) => (
                  <CardItem
                    key={card.id}
                    card={card}
                    index={cIndex}
                    onClick={() => onSelectCard(card)}
                  />
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>

          {/* カード追加フッター */}
          <div className="p-2.5 border-t border-slate-200/50">
            {isAddingCard ? (
              <form onSubmit={handleAddCardSubmit} className="space-y-2">
                <textarea
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  placeholder="カードのタイトルを入力..."
                  autoFocus
                  rows={2}
                  className="w-full p-2.5 text-sm bg-white rounded-xl border border-indigo-400 shadow-xs outline-hidden resize-none focus:ring-2 focus:ring-indigo-400/20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddCardSubmit(e);
                    }
                    if (e.key === 'Escape') setIsAddingCard(false);
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingCard(false)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setIsAddingCard(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>カードを追加</span>
              </button>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};
