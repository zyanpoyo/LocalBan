import React, { useRef } from 'react';
import {
  X,
  Tag,
  CheckSquare,
  Clock,
  Copy,
  Archive,
  Image,
  Upload,
  Plus,
  Eye,
  CheckCircle,
} from 'lucide-react';
import { Card, Label, ListModel } from '../../types';
import { getAttachmentDownloadUrl } from '../../api';
import { LABEL_COLOR_MAP } from '../labelColorConfig';
import { DEFAULT_DUE_TIME } from '../../utils/dateFormat';

interface CardSidebarProps {
  currentCard: Card;
  lists: ListModel[];
  allLabels: Label[];
  dueDate: string;
  isDueComplete: boolean;
  dateInputRef: React.RefObject<HTMLInputElement | null>;
  showAddChecklist: boolean;
  newChecklistTitle: string;
  showCopyDialog: boolean;
  targetCopyListId: string;
  onCoverUpload: (file: File) => void;
  onClearCover: () => void;
  onPreviewImage: (url: string) => void;
  onClearDueDate: () => void;
  onDateChange: (newDateStr: string) => void;
  onTimeChange: (newTimeStr: string) => void;
  onSetQuickDue: (daysOffset: number) => void;
  onDueCompleteToggle: () => void;
  onToggleLabel: (labelId: string) => void;
  onShowAddChecklistChange: (show: boolean) => void;
  onNewChecklistTitleChange: (title: string) => void;
  onAddChecklist: () => void;
  onShowCopyDialogChange: (show: boolean) => void;
  onTargetCopyListIdChange: (listId: string) => void;
  onCopyCard: () => void;
  onArchiveCard: () => void;
}

export const CardSidebar: React.FC<CardSidebarProps> = ({
  currentCard,
  lists,
  allLabels,
  dueDate,
  isDueComplete,
  dateInputRef,
  showAddChecklist,
  newChecklistTitle,
  showCopyDialog,
  targetCopyListId,
  onCoverUpload,
  onClearCover,
  onPreviewImage,
  onClearDueDate,
  onDateChange,
  onTimeChange,
  onSetQuickDue,
  onDueCompleteToggle,
  onToggleLabel,
  onShowAddChecklistChange,
  onNewChecklistTitleChange,
  onAddChecklist,
  onShowCopyDialogChange,
  onTargetCopyListIdChange,
  onCopyCard,
  onArchiveCard,
}) => {
  const coverInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6 border-t md:border-t-0 md:border-l border-slate-200/80 md:pl-6">
      {/* カバー (Cover Image) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Image className="w-3.5 h-3.5" />
            カバー
          </h4>
          {currentCard.cover_attachment_id && (
            <button
              type="button"
              onClick={onClearCover}
              className="text-[11px] text-rose-500 hover:text-rose-700 hover:underline flex items-center gap-0.5 cursor-pointer"
              title="カバー画像を解除"
            >
              <X className="w-3 h-3" />
              解除
            </button>
          )}
        </div>

        {currentCard.cover_attachment_id ? (
          <div className="space-y-1.5">
            <div
              onClick={() =>
                currentCard.cover_attachment_id &&
                onPreviewImage(getAttachmentDownloadUrl(currentCard.cover_attachment_id, true))
              }
              className="w-full h-24 rounded-xl bg-slate-100 overflow-hidden relative border border-slate-200 cursor-pointer group shadow-2xs"
              title="クリックして拡大プレビュー"
            >
              <img
                src={getAttachmentDownloadUrl(currentCard.cover_attachment_id, true)}
                alt="Card Cover"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                <Eye className="w-4 h-4 mr-1" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file) onCoverUpload(file);
              }}
              className="w-full py-1.5 px-2 text-[11px] font-medium text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer text-center"
            >
              画像を変更
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file) onCoverUpload(file);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>画像を選択</span>
          </button>
        )}

        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onCoverUpload(file);
            e.target.value = '';
          }}
          className="hidden"
        />
      </div>

      {/* 期限 (Due Date) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            期限
          </h4>
          {dueDate && (
            <button
              type="button"
              onClick={onClearDueDate}
              className="text-[11px] text-rose-500 hover:text-rose-700 hover:underline flex items-center gap-0.5 cursor-pointer"
              title="期限を解除"
            >
              <X className="w-3 h-3" />
              解除
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input
              ref={dateInputRef}
              type="date"
              value={dueDate ? dueDate.substring(0, 10) : ''}
              onChange={(e) => onDateChange(e.target.value)}
              className="flex-1 min-w-[110px] px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:border-indigo-500"
              title="期限日 (d キーでフォーカス)"
            />
            <input
              type="time"
              value={dueDate ? dueDate.substring(11, 16) : DEFAULT_DUE_TIME}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-[76px] shrink-0 px-1.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:border-indigo-500 text-center"
              title="期限時刻 (デフォルト 18:00)"
            />
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onSetQuickDue(0)}
              className="flex-1 text-[11px] py-1 px-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors cursor-pointer text-center"
            >
              今日 18:00
            </button>
            <button
              type="button"
              onClick={() => onSetQuickDue(1)}
              className="flex-1 text-[11px] py-1 px-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors cursor-pointer text-center"
            >
              明日 18:00
            </button>
          </div>
        </div>

        {dueDate && (
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-0.5">
            <input
              type="checkbox"
              checked={isDueComplete}
              onChange={onDueCompleteToggle}
              className="w-3.5 h-3.5 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
            />
            <span>完了としてマーク</span>
          </label>
        )}
      </div>

      {/* ラベル付与 */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" />
          ラベル
        </h4>
        <div className="space-y-1">
          {allLabels.map((label) => {
            const isChecked = currentCard.labels.some((l) => l.id === label.id);
            return (
              <button
                key={label.id}
                onClick={() => onToggleLabel(label.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isChecked ? 'ring-2 ring-indigo-500 bg-slate-50' : 'hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                      LABEL_COLOR_MAP[label.color] || 'bg-slate-400'
                    }`}
                  />
                  <span className="text-slate-700">{label.name}</span>
                </div>
                {isChecked && <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* チェックリスト追加 */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <CheckSquare className="w-3.5 h-3.5" />
          チェックリスト
        </h4>
        {showAddChecklist ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newChecklistTitle}
              onChange={(e) => onNewChecklistTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onAddChecklist();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  onShowAddChecklistChange(false);
                }
              }}
              placeholder="タイトル..."
              autoFocus
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={onAddChecklist}
                className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg cursor-pointer"
              >
                追加
              </button>
              <button
                onClick={() => onShowAddChecklistChange(false)}
                className="px-2 py-1 text-xs text-slate-500 cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onShowAddChecklistChange(true)}
            title="チェックリストを追加 (t または -)"
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            リスト追加
          </button>
        )}
      </div>

      {/* アクション (コピー, アーカイブ) */}
      <div className="space-y-2 pt-2 border-t border-slate-200/80">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">アクション</h4>

        {showCopyDialog ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <p className="text-xs font-semibold text-slate-700">コピー先リスト</p>
            <select
              value={targetCopyListId}
              onChange={(e) => onTargetCopyListIdChange(e.target.value)}
              className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg outline-hidden"
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onCopyCard}
                className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg cursor-pointer"
              >
                複製実行
              </button>
              <button
                onClick={() => onShowCopyDialogChange(false)}
                className="px-2 py-1 text-xs text-slate-500 cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onShowCopyDialogChange(true)}
            title="カードを複製 (c)"
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <Copy className="w-4 h-4 text-slate-500" />
            <span>カードを複製</span>
          </button>
        )}

        <button
          onClick={onArchiveCard}
          title="アーカイブ (a)"
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors cursor-pointer border border-amber-200/60"
        >
          <Archive className="w-4 h-4 text-amber-600" />
          <span>アーカイブ</span>
        </button>
      </div>
    </div>
  );
};
