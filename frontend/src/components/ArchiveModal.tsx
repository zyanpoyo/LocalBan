import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Trash2, Search, Archive } from 'lucide-react';
import { Card, ListModel } from '../types';
import { fetchArchivedCards, restoreCard, permanentlyDeleteCard } from '../api';

interface ArchiveModalProps {
  lists: ListModel[];
  onClose: () => void;
  onCardRestored: (card: Card) => void;
  onCardPermanentlyDeleted: (cardId: string) => void;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  lists,
  onClose,
  onCardRestored,
  onCardPermanentlyDeleted,
}) => {
  const [archivedCards, setArchivedCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedListIds, setSelectedListIds] = useState<Record<string, string>>({});
  const [deletingCard, setDeletingCard] = useState<Card | null>(null);

  useEffect(() => {
    loadArchived();
  }, []);

  const loadArchived = async () => {
    try {
      setLoading(true);
      const data = await fetchArchivedCards();
      setArchivedCards(data);
      // 初期復元先リストの設定
      const initialMap: Record<string, string> = {};
      data.forEach((c) => {
        const listExists = lists.some((l) => l.id === c.list_id);
        initialMap[c.id] = listExists && c.list_id ? c.list_id : lists[0]?.id || '';
      });
      setSelectedListIds(initialMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (cardId: string) => {
    const targetListId = selectedListIds[cardId] || lists[0]?.id;
    if (!targetListId) {
      alert('復元先のリストが存在しません');
      return;
    }
    const restored = await restoreCard(cardId, targetListId);
    setArchivedCards((prev) => prev.filter((c) => c.id !== cardId));
    onCardRestored(restored);
  };

  const handleConfirmPermanentDelete = async () => {
    if (!deletingCard) return;
    await permanentlyDeleteCard(deletingCard.id);
    setArchivedCards((prev) => prev.filter((c) => c.id !== deletingCard.id));
    onCardPermanentlyDeleted(deletingCard.id);
    setDeletingCard(null);
  };

  const filteredCards = archivedCards.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ヘッダー */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <Archive className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">アーカイブ済みアイテム</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
              {archivedCards.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 検索バー */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="アーカイブカードを検索..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-indigo-500 focus:bg-white"
            />
          </div>
        </div>

        {/* リストエリア */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              {searchQuery ? '一致するアーカイブカードはありません' : 'アーカイブされたカードはありません'}
            </div>
          ) : (
            filteredCards.map((card) => (
              <div
                key={card.id}
                className="p-3.5 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
              >
                {/* カード情報 */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-slate-800 truncate">{card.title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    元リスト: {card.original_list_title || lists.find((l) => l.id === card.list_id)?.title || '未所属'}
                  </p>
                </div>

                {/* アクション (復元先選択・復元・完全削除) */}
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedListIds[card.id] || lists[0]?.id || ''}
                    onChange={(e) =>
                      setSelectedListIds((prev) => ({ ...prev, [card.id]: e.target.value }))
                    }
                    className="text-xs py-1.5 px-2 bg-white border border-slate-200 rounded-lg outline-hidden"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        復元先: {l.title}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleRestore(card.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 rounded-lg transition-colors cursor-pointer"
                    title="ボードに復元"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    復元
                  </button>

                  <button
                    onClick={() => setDeletingCard(card)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="完全に削除 (元に戻せません)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 完全削除確認ダイアログ 【対応必須 7】 */}
      {deletingCard && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">カードを完全に削除しますか？</h3>
                <p className="text-xs text-slate-500">この操作は元に戻せません。</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              「<strong className="text-slate-800">{deletingCard.title}</strong>」および関連するすべての添付ファイル実体がディスクから完全に削除されます。
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingCard(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmPermanentDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
              >
                完全に削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
