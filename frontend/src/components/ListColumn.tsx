import React, { useState, useEffect, useRef } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, MoreHorizontal, Trash2, X } from 'lucide-react';
import { Card, ListModel } from '../types';
import { CardItem } from './CardItem';

interface ListColumnProps {
  list: ListModel;
  index: number;
  cards: Card[];
  isActiveList?: boolean;
  isAddingCard?: boolean;
  selectedCardId?: string | null;
  onSetAddingCard?: (adding: boolean) => void;
  onActivateList?: () => void;
  onUpdateListTitle: (listId: string, newTitle: string) => void;
  onDeleteList: (list: ListModel) => void;
  onAddCard: (listId: string, title: string, openModal?: boolean) => void | Promise<void>;
  onSelectCard: (card: Card) => void;
}

export const ListColumn: React.FC<ListColumnProps> = ({
  list,
  index,
  cards,
  isActiveList = false,
  isAddingCard: isAddingCardProp,
  selectedCardId = null,
  onSetAddingCard,
  onActivateList,
  onUpdateListTitle,
  onDeleteList,
  onAddCard,
  onSelectCard,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [internalAddingCard, setInternalAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const columnRef = useRef<HTMLDivElement | null>(null);
  const addCardTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isAddingCard = isAddingCardProp !== undefined ? isAddingCardProp : internalAddingCard;
  const setIsAddingCard = (adding: boolean) => {
    if (onSetAddingCard) {
      onSetAddingCard(adding);
    } else {
      setInternalAddingCard(adding);
    }
  };

  useEffect(() => {
    if (isActiveList && columnRef.current) {
      columnRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [isActiveList]);

  useEffect(() => {
    if (isAddingCard) {
      requestAnimationFrame(() => {
        addCardTextareaRef.current?.focus();
      });
    }
  }, [isAddingCard]);

  const handleTitleSubmit = () => {
    if (title.trim() && title.trim() !== list.title) {
      onUpdateListTitle(list.id, title.trim());
    } else {
      setTitle(list.title);
    }
    setIsEditingTitle(false);
  };

  const submitNewCard = async (closeAfter: boolean, openModalAfter: boolean) => {
    const trimmed = newCardTitle.trim();
    if (!trimmed) {
      if (closeAfter) setIsAddingCard(false);
      return;
    }
    setNewCardTitle('');
    if (closeAfter || openModalAfter) {
      setIsAddingCard(false);
    }
    await onAddCard(list.id, trimmed, openModalAfter);
    if (!closeAfter && !openModalAfter) {
      requestAnimationFrame(() => {
        addCardTextareaRef.current?.focus();
      });
    }
  };

  const handleAddCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitNewCard(false, false);
  };

  return (
    <Draggable draggableId={list.id} index={index}>
      {(provided) => (
        <div
          ref={(node) => {
            provided.innerRef(node);
            columnRef.current = node;
          }}
          {...provided.draggableProps}
          data-coachmark={
            index === 0
              ? 'list-column-first'
              : index === 1
                ? 'list-column-doing'
                : undefined
          }
          onClick={() => onActivateList?.()}
          className={`w-72 sm:w-80 shrink-0 bg-slate-100/90 rounded-2xl border shadow-xs flex flex-col max-h-[calc(100vh-6rem)] transition-colors ${
            isActiveList
              ? 'border-indigo-400/90 ring-2 ring-indigo-400/20'
              : 'border-slate-200/60'
          }`}
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
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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
                className="flex items-center gap-2 flex-1 cursor-pointer group min-w-0"
              >
                {index < 9 && (
                  <kbd
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded border shrink-0 transition-colors ${
                      isActiveList
                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                        : 'bg-white/80 text-slate-400 border-slate-200/80'
                    }`}
                    title={`ショートカット: ${index + 1} キーでこのリストにカードを追加`}
                  >
                    {index + 1}
                  </kbd>
                )}
                <h2 className="text-sm font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors truncate">
                  {list.title}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-semibold shrink-0">
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
                    isSelected={selectedCardId === card.id}
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
                  ref={addCardTextareaRef}
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  placeholder="カードのタイトルを入力..."
                  autoFocus
                  rows={2}
                  className="w-full p-2.5 text-sm bg-white rounded-xl border border-indigo-400 shadow-xs outline-hidden resize-none focus:ring-2 focus:ring-indigo-400/20"
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (e.shiftKey) {
                        void submitNewCard(true, true);
                      } else if (e.ctrlKey || e.metaKey) {
                        void submitNewCard(true, false);
                      } else {
                        void submitNewCard(false, false);
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsAddingCard(false);
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="submit"
                      title="カードを追加して続けて入力 (Enter)"
                      className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      追加
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitNewCard(true, true)}
                      disabled={!newCardTitle.trim()}
                      title="カードを追加して詳細モーダルを開く (Shift+Enter)"
                      className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 disabled:opacity-40 text-indigo-600 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                    >
                      追加して詳細へ
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingCard(false)}
                      title="キャンセル (Escape)"
                      className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5 px-0.5">
                  <span><kbd className="font-mono font-semibold text-slate-500">Enter</kbd> 連続追加</span>
                  <span><kbd className="font-mono font-semibold text-slate-500">Ctrl+Enter</kbd> 完了</span>
                  <span><kbd className="font-mono font-semibold text-slate-500">Shift+Enter</kbd> 詳細</span>
                  <span><kbd className="font-mono font-semibold text-slate-500">Esc</kbd> 閉じる</span>
                </div>
              </form>
            ) : (
              <button
                data-coachmark={index === 0 ? 'add-card-btn' : undefined}
                onClick={() => {
                  onActivateList?.();
                  setIsAddingCard(true);
                }}
                title="カードを追加 (c または n)"
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer group"
              >
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>カードを追加</span>
                </span>
                <kbd className="hidden group-hover:inline-block text-[10px] font-mono px-1.5 py-0.2 bg-white text-slate-500 border border-slate-200 rounded">
                  c
                </kbd>
              </button>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};
