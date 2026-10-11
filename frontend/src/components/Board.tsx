import React, { useState } from 'react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { Plus, X } from 'lucide-react';
import { Card, ListModel } from '../types';
import { ListColumn } from './ListColumn';

interface BoardProps {
  lists: ListModel[];
  cards: Card[];
  onMoveCard: (cardId: string, targetListId: string, newPosition: number) => void;
  onMoveList: (listId: string, newPosition: number) => void;
  onCreateList: (title: string) => void;
  onUpdateListTitle: (listId: string, newTitle: string) => void;
  onDeleteList: (list: ListModel) => void;
  onCreateCard: (listId: string, title: string) => void;
  onSelectCard: (card: Card) => void;
}

export const Board: React.FC<BoardProps> = ({
  lists,
  cards,
  onMoveCard,
  onMoveList,
  onCreateList,
  onUpdateListTitle,
  onDeleteList,
  onCreateCard,
  onSelectCard,
}) => {
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  const handleAddListSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newListTitle.trim()) {
      onCreateList(newListTitle.trim());
      setNewListTitle('');
      setIsAddingList(false);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === 'list') {
      // リストの並び替え
      const reorderedLists = Array.from(lists);
      const [moved] = reorderedLists.splice(source.index, 1);
      reorderedLists.splice(destination.index, 0, moved);

      // 新しい position の計算
      let newPos = 1000.0;
      if (destination.index === 0) {
        newPos = (reorderedLists[1]?.position || 2000.0) / 2;
      } else if (destination.index === reorderedLists.length - 1) {
        newPos = (reorderedLists[reorderedLists.length - 2]?.position || 1000.0) + 1000.0;
      } else {
        const prev = reorderedLists[destination.index - 1].position;
        const next = reorderedLists[destination.index + 1].position;
        newPos = (prev + next) / 2;
      }

      onMoveList(draggableId, newPos);
    } else if (type === 'card') {
      // カードの移動
      const targetListId = destination.droppableId;
      const targetCards = cards
        .filter((c) => c.list_id === targetListId && !c.is_archived)
        .sort((a, b) => a.position - b.position);

      let newPos = 1000.0;
      if (targetCards.length === 0) {
        newPos = 1000.0;
      } else if (destination.index === 0) {
        newPos = (targetCards[0].position || 1000.0) / 2;
      } else if (destination.index >= targetCards.length) {
        newPos = (targetCards[targetCards.length - 1].position || 1000.0) + 1000.0;
      } else {
        const prev = targetCards[destination.index - 1]?.position || 0.0;
        const next = targetCards[destination.index]?.position || prev + 2000.0;
        newPos = (prev + next) / 2;
      }

      onMoveCard(draggableId, targetListId, newPos);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="board" direction="horizontal" type="list">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 flex gap-4 p-5 overflow-x-auto overflow-y-hidden items-start"
          >
            {lists.map((list, index) => {
              const listCards = cards
                .filter((c) => c.list_id === list.id && !c.is_archived)
                .sort((a, b) => a.position - b.position);

              return (
                <ListColumn
                  key={list.id}
                  list={list}
                  index={index}
                  cards={listCards}
                  onUpdateListTitle={onUpdateListTitle}
                  onDeleteList={onDeleteList}
                  onAddCard={onCreateCard}
                  onSelectCard={onSelectCard}
                />
              );
            })}
            {provided.placeholder}

            {/* 新規リスト追加ボタン / フォーム */}
            <div className="w-72 sm:w-80 shrink-0">
              {isAddingList ? (
                <form
                  onSubmit={handleAddListSubmit}
                  className="bg-slate-100/90 rounded-2xl border border-slate-200 p-3 space-y-3 shadow-xs"
                >
                  <input
                    type="text"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    placeholder="リストのタイトルを入力..."
                    autoFocus
                    className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-indigo-500 outline-hidden shadow-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsAddingList(false);
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      リストを追加
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingList(false)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddingList(true)}
                  className="w-full h-12 flex items-center justify-center gap-2 px-4 rounded-2xl bg-white/60 hover:bg-white border border-slate-200/80 hover:border-slate-300 text-slate-600 hover:text-indigo-600 text-sm font-semibold transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>リストを追加</span>
                </button>
              )}
            </div>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};
