import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '../types';
import { updateCard } from '../api';

const DRAFT_STORAGE_PREFIX = 'localban_draft_card_';
const DEFAULT_DEBOUNCE_MS = 500; // 要件 2.3.2: 300ms〜800ms のデバウンス

interface DraftRecord {
  cardId: string;
  description: string;
  updatedAt: number;
}

export type AutoSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'restored' | 'error';

function getDraftKey(cardId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${cardId}`;
}

function readLocalDraft(cardId: string): DraftRecord | null {
  try {
    const raw = localStorage.getItem(getDraftKey(cardId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftRecord;
    if (parsed && parsed.cardId === cardId && typeof parsed.description === 'string') {
      return parsed;
    }
  } catch {
    // 破損データは無視
  }
  return null;
}

function writeLocalDraft(cardId: string, description: string): void {
  try {
    const payload: DraftRecord = {
      cardId,
      description,
      updatedAt: Date.now(),
    };
    localStorage.setItem(getDraftKey(cardId), JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to write local draft cache:', err);
  }
}

function removeLocalDraft(cardId: string): void {
  try {
    localStorage.removeItem(getDraftKey(cardId));
  } catch {
    // ignore
  }
}

interface UseDescriptionAutoSaveOptions {
  card: Card;
  onCardSaved: (updatedCard: Card) => void;
  debounceMs?: number;
}

export function useDescriptionAutoSave({
  card,
  onCardSaved,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseDescriptionAutoSaveOptions) {
  const initialServerDesc = card.description || '';

  // 初回マウント時、クラッシュ・リロード前の未保存ドラフトが LocalStorage に残っていれば復元する
  const [description, setDescription] = useState<string>(() => {
    const draft = readLocalDraft(card.id);
    if (draft && draft.description !== initialServerDesc) {
      return draft.description;
    }
    return initialServerDesc;
  });

  const [saveState, setSaveState] = useState<AutoSaveState>(() => {
    const draft = readLocalDraft(card.id);
    if (draft && draft.description !== initialServerDesc) {
      return 'restored';
    }
    return 'idle';
  });

  // 最新の値を同期的に参照するための Ref 群
  const cardIdRef = useRef<string>(card.id);
  const latestDescRef = useRef<string>(description);
  const lastSavedDescRef = useRef<string>(initialServerDesc);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const onCardSavedRef = useRef(onCardSaved);

  useEffect(() => {
    onCardSavedRef.current = onCardSaved;
  });

  /**
   * 永続化層（SQLite バックエンド）へ即時保存するコア関数
   */
  const persistToBackend = useCallback(async (targetCardId: string, textToSave: string) => {
    if (textToSave === lastSavedDescRef.current) {
      removeLocalDraft(targetCardId);
      return;
    }

    isSavingRef.current = true;
    setSaveState('saving');

    try {
      const updated = await updateCard(targetCardId, { description: textToSave });
      lastSavedDescRef.current = textToSave;

      // 保存中にさらに新しいキー入力が行われていなければ LocalStorage キャッシュを削除して完了にする
      if (latestDescRef.current === textToSave) {
        removeLocalDraft(targetCardId);
        setSaveState('saved');
      } else {
        setSaveState('dirty');
      }

      onCardSavedRef.current(updated);
    } catch (err) {
      console.error('Failed to auto-save card description:', err);
      setSaveState('error');
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  /**
   * デバウンス待ちの未保存変更があれば即座に強制フラッシュ（Flush）する
   */
  const flushSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const currentId = cardIdRef.current;
    const currentText = latestDescRef.current;
    if (currentText !== lastSavedDescRef.current) {
      await persistToBackend(currentId, currentText);
    }
  }, [persistToBackend]);

  /**
   * カードIDが切り替わった際の初期化（前カードの未保存分を Flush してから新カードを読み込む）
   */
  useEffect(() => {
    if (cardIdRef.current !== card.id) {
      // 前のカードの未保存分をフラッシュ
      const prevId = cardIdRef.current;
      const prevText = latestDescRef.current;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (prevText !== lastSavedDescRef.current) {
        void updateCard(prevId, { description: prevText }).then((updated) => {
          removeLocalDraft(prevId);
          onCardSavedRef.current(updated);
        });
      }

      // 新しいカードの初期化
      cardIdRef.current = card.id;
      const serverDesc = card.description || '';
      lastSavedDescRef.current = serverDesc;

      const draft = readLocalDraft(card.id);
      if (draft && draft.description !== serverDesc) {
        latestDescRef.current = draft.description;
        setDescription(draft.description);
        setSaveState('restored');
        void persistToBackend(card.id, draft.description);
      } else {
        latestDescRef.current = serverDesc;
        setDescription(serverDesc);
        setSaveState('idle');
      }
    }
  }, [card.id, card.description, persistToBackend]);

  /**
   * 初回マウント時に未保存ドラフトから復元された場合、バックグラウンドでDBへ同期する
   */
  useEffect(() => {
    if (saveState === 'restored' && latestDescRef.current !== lastSavedDescRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void persistToBackend(cardIdRef.current, latestDescRef.current);
      }, debounceMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 1キーストロークごとの更新ハンドラ
   * - メモリ内ステート更新と同時に LocalStorage へ即時同期（Write-through）
   * - 500ms の Debounce タイマーを再設定
   */
  const handleDescriptionChange = useCallback(
    (nextValue: string) => {
      const currentId = cardIdRef.current;
      latestDescRef.current = nextValue;
      setDescription(nextValue);

      // 1. LocalStorage への即時ライトスルーキャッシュ
      if (nextValue !== lastSavedDescRef.current) {
        writeLocalDraft(currentId, nextValue);
        setSaveState('dirty');
      } else {
        removeLocalDraft(currentId);
        setSaveState('saved');
      }

      // 2. Debounce 自動保存のスケジュール
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void persistToBackend(currentId, latestDescRef.current);
      }, debounceMs);
    },
    [debounceMs, persistToBackend]
  );

  /**
   * アンマウント時およびウィンドウ終了・リロード時の強制フラッシュ
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentId = cardIdRef.current;
      const currentText = latestDescRef.current;
      if (currentText !== lastSavedDescRef.current) {
        // 念のため LocalStorage にも最新状態を確実に書き込む
        writeLocalDraft(currentId, currentText);
        void updateCard(currentId, { description: currentText });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const currentId = cardIdRef.current;
      const currentText = latestDescRef.current;
      if (currentText !== lastSavedDescRef.current) {
        void updateCard(currentId, { description: currentText }).then((updated) => {
          removeLocalDraft(currentId);
          onCardSavedRef.current(updated);
        });
      }
    };
  }, []);

  return {
    description,
    saveState,
    handleDescriptionChange,
    flushSave,
  };
}
