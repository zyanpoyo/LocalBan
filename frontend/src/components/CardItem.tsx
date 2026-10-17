import React, { useEffect, useRef } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Clock, CheckSquare, Paperclip, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card } from '../types';
import { getAttachmentDownloadUrl } from '../api';

interface CardItemProps {
  card: Card;
  index: number;
  isSelected?: boolean;
  onClick: () => void;
}

const LABEL_COLOR_MAP: Record<string, string> = {
  red: 'bg-rose-500 text-white',
  yellow: 'bg-amber-400 text-slate-900',
  orange: 'bg-orange-500 text-white',
  green: 'bg-emerald-500 text-white',
  blue: 'bg-sky-500 text-white',
  purple: 'bg-purple-500 text-white',
};

export const CardItem: React.FC<CardItemProps> = ({ card, index, isSelected = false, onClick }) => {
  const itemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [isSelected]);

  // 期限判定 【項目10】
  const getDueBadge = () => {
    if (!card.due_date) return null;
    const dueDate = new Date(card.due_date);
    const now = new Date();

    if (card.is_due_complete) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-medium">
          <CheckCircle className="w-3 h-3" />
          {dueDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
        </span>
      );
    }

    const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 0) {
      // 期限超過
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-medium">
          <Clock className="w-3 h-3" />
          {dueDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} 超過
        </span>
      );
    } else if (diffHours <= 24) {
      // 24時間以内
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-medium">
          <AlertTriangle className="w-3 h-3" />
          {dueDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} 間近
        </span>
      );
    } else {
      // 通常
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
          <Clock className="w-3 h-3" />
          {dueDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
        </span>
      );
    }
  };

  // チェックリスト進捗
  const totalItems = card.checklists.reduce((acc, cl) => acc + cl.items.length, 0);
  const completedItems = card.checklists.reduce(
    (acc, cl) => acc + cl.items.filter((i) => i.is_completed).length,
    0
  );

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={(node) => {
            provided.innerRef(node);
            itemRef.current = node;
          }}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          data-coachmark={index === 0 ? 'sample-card' : undefined}
          onClick={onClick}
          className={`group bg-white rounded-xl border shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-150 cursor-pointer overflow-hidden ${
            snapshot.isDragging
              ? 'shadow-lg rotate-1 scale-[1.02] border-indigo-500 z-50 ring-2 ring-indigo-400/20'
              : isSelected
                ? 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-sm'
                : 'border-slate-200/90'
          }`}
        >
          {/* カバー画像 */}
          {card.cover_attachment_id && (
            <div className="h-32 w-full bg-slate-100 overflow-hidden relative">
              <img
                src={getAttachmentDownloadUrl(card.cover_attachment_id, true)}
                alt="Card Cover"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
            </div>
          )}

          <div className="p-3">
            {/* ラベル */}
            {card.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {card.labels.map((l) => (
                  <span
                    key={l.id}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      LABEL_COLOR_MAP[l.color] || 'bg-slate-500 text-white'
                    }`}
                  >
                    {l.name}
                  </span>
                ))}
              </div>
            )}

            {/* タイトル */}
            <h3 className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">
              {card.title}
            </h3>

            {/* バッジ・メタ情報 */}
            {(card.due_date || totalItems > 0 || card.attachments.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-slate-100">
                {/* 期限バッジ */}
                {getDueBadge()}

                {/* チェックリスト */}
                {totalItems > 0 && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md ${
                      completedItems === totalItems
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-500'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>
                      {completedItems}/{totalItems}
                    </span>
                  </span>
                )}

                {/* 添付数 */}
                {card.attachments.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{card.attachments.length}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};
