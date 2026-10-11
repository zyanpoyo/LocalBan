import React, { useState, useEffect, useCallback } from 'react';
import { BoardState, Card, ListModel } from './types';
import {
  fetchBoardState,
  createList,
  updateList,
  deleteList,
  createCard,
  moveCard,
  shutdownServer,
  onSyncMessage,
} from './api';
import { Header } from './components/Header';
import { Board } from './components/Board';
import { CardModal } from './components/CardModal';
import { ArchiveModal } from './components/ArchiveModal';
import { ConfirmModal } from './components/ConfirmModal';
import { Loader2, PowerOff } from 'lucide-react';

export const App: React.FC = () => {
  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // モーダル管理
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isShutdownOpen, setIsShutdownOpen] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);

  // リスト削除確認モーダル
  const [deletingList, setDeletingList] = useState<ListModel | null>(null);

  // ボード全データの取得
  const loadData = useCallback(async () => {
    try {
      const state = await fetchBoardState();
      setBoardState(state);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'ボードデータの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // 複数タブ間のリアルタイム同期 【項目22】
    const unsubscribeSync = onSyncMessage(() => {
      loadData();
    });

    return () => {
      unsubscribeSync();
    };
  }, [loadData]);

  // リスト操作
  const handleCreateList = async (title: string) => {
    await createList(title);
    await loadData();
  };

  const handleUpdateListTitle = async (listId: string, title: string) => {
    await updateList(listId, title);
    await loadData();
  };

  const handleMoveList = async (listId: string, position: number) => {
    if (!boardState) return;
    // 楽観的更新
    const updatedLists = boardState.lists
      .map((l) => (l.id === listId ? { ...l, position } : l))
      .sort((a, b) => a.position - b.position);
    setBoardState({ ...boardState, lists: updatedLists });

    await updateList(listId, undefined, position);
  };

  const handleDeleteListConfirm = async () => {
    if (!deletingList) return;
    await deleteList(deletingList.id);
    setDeletingList(null);
    await loadData();
  };

  // カード操作
  const handleCreateCard = async (listId: string, title: string) => {
    await createCard(listId, title);
    await loadData();
  };

  const handleMoveCard = async (cardId: string, targetListId: string, position: number) => {
    if (!boardState) return;
    // 楽観的更新
    const updatedCards = boardState.cards.map((c) =>
      c.id === cardId ? { ...c, list_id: targetListId, position } : c
    );
    setBoardState({ ...boardState, cards: updatedCards });

    await moveCard(cardId, targetListId, position);
  };

  // カード詳細モーダル更新コールバック
  const handleCardUpdated = (updatedCard: Card) => {
    if (!boardState) return;
    setBoardState({
      ...boardState,
      cards: boardState.cards.map((c) => (c.id === updatedCard.id ? updatedCard : c)),
    });
    setSelectedCard(updatedCard);
  };

  const handleCardArchived = (cardId: string) => {
    if (!boardState) return;
    setBoardState({
      ...boardState,
      cards: boardState.cards.filter((c) => c.id !== cardId),
    });
    setSelectedCard(null);
  };

  const handleCardCopied = async () => {
    await loadData();
  };

  // アーカイブ復元
  const handleCardRestored = async () => {
    await loadData();
  };

  // シャットダウン実行
  const handleConfirmShutdown = async () => {
    try {
      setIsShutdownOpen(false);
      setIsTerminated(true);
      await shutdownServer();
    } catch {
      // サーバー終了により通信切断されるのは正常
    }
  };

  if (isTerminated) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-rose-500 shadow-xl border border-slate-700">
          <PowerOff className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-100">LocalBan は終了しました</h1>
        <p className="text-sm text-slate-400 max-w-sm">
          バックグラウンドサーバーは安全に停止しました。このブラウザタブは閉じていただいて構いません。
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-sm font-semibold text-slate-600">LocalBan を読み込み中...</span>
        </div>
      </div>
    );
  }

  if (error || !boardState) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full text-center space-y-4 border border-rose-200">
          <div className="text-rose-600 font-bold text-lg">エラーが発生しました</div>
          <p className="text-xs text-slate-600">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              loadData();
            }}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* グローバルヘッダー */}
      <Header
        onOpenArchive={() => setIsArchiveOpen(true)}
        onOpenShutdown={() => setIsShutdownOpen(true)}
        archivedCount={0}
      />

      {/* カンバンボード */}
      <main className="flex-1 flex overflow-hidden">
        <Board
          lists={boardState.lists}
          cards={boardState.cards}
          onMoveCard={handleMoveCard}
          onMoveList={handleMoveList}
          onCreateList={handleCreateList}
          onUpdateListTitle={handleUpdateListTitle}
          onDeleteList={(list) => setDeletingList(list)}
          onCreateCard={handleCreateCard}
          onSelectCard={(card) => setSelectedCard(card)}
        />
      </main>

      {/* カード詳細モーダル */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          lists={boardState.lists}
          allLabels={boardState.labels}
          onClose={() => setSelectedCard(null)}
          onCardUpdated={handleCardUpdated}
          onCardArchived={handleCardArchived}
          onCardCopied={handleCardCopied}
        />
      )}

      {/* アーカイブ一覧モーダル */}
      {isArchiveOpen && (
        <ArchiveModal
          lists={boardState.lists}
          onClose={() => setIsArchiveOpen(false)}
          onCardRestored={handleCardRestored}
          onCardPermanentlyDeleted={() => {}}
        />
      )}

      {/* リスト削除確認モーダル 【対応必須 4】 */}
      <ConfirmModal
        isOpen={!!deletingList}
        title="リストを削除しますか？"
        message={`「${deletingList?.title}」を削除します。`}
        subMessage="このリストに所属しているカードは削除されず、自動的に「アーカイブ」へ移動します。アーカイブ一覧からいつでも復元できます。"
        confirmLabel="リストを削除"
        isDanger
        onConfirm={handleDeleteListConfirm}
        onCancel={() => setDeletingList(null)}
      />

      {/* シャットダウン確認モーダル */}
      <ConfirmModal
        isOpen={isShutdownOpen}
        title="LocalBan を終了しますか？"
        message="ローカルサーバーを停止し、アプリケーションを完全終了します。"
        confirmLabel="終了する"
        isShutdown
        onConfirm={handleConfirmShutdown}
        onCancel={() => setIsShutdownOpen(false)}
      />
    </div>
  );
};
