import React, { useState, useEffect } from 'react';
import { Archive, Power, Check, Loader2, AlertCircle } from 'lucide-react';
import { onSaveStatusChange } from '../api';
import { SaveStatus } from '../types';

interface HeaderProps {
  onOpenArchive: () => void;
  onOpenShutdown: () => void;
  archivedCount: number;
}

export const Header: React.FC<HeaderProps> = ({ onOpenArchive, onOpenShutdown, archivedCount }) => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    const unsubscribe = onSaveStatusChange((status) => {
      setSaveStatus(status);
    });
    return unsubscribe;
  }, []);

  return (
    <header className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* ロゴ & タイトル */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
          <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
            <rect x="3" y="4" width="5" height="16" rx="1.5" opacity="0.95" />
            <rect x="9.5" y="4" width="5" height="11" rx="1.5" />
            <rect x="16" y="4" width="5" height="14" rx="1.5" opacity="0.8" />
          </svg>
        </div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-700 to-indigo-500 bg-clip-text text-transparent">
          LocalBan
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
          オフライン
        </span>
      </div>

      {/* リアルタイム保存状態インジケーター 【項目19】 */}
      <div className="flex items-center gap-2">
        <div className="text-xs font-medium transition-all duration-200">
          {saveStatus === 'saving' && (
            <span className="inline-flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              保存中...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              <Check className="w-3.5 h-3.5" />
              保存済み
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="inline-flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
              <AlertCircle className="w-3.5 h-3.5" />
              保存エラー
            </span>
          )}
          {saveStatus === 'idle' && (
            <span className="inline-flex items-center gap-1 text-slate-400 px-2 py-1">
              <Check className="w-3 h-3 text-slate-400" />
              最新
            </span>
          )}
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex items-center gap-2">
        {/* アーカイブ一覧 */}
        <button
          onClick={onOpenArchive}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition-colors cursor-pointer"
          title="アーカイブ済みアイテムを開く"
        >
          <Archive className="w-4 h-4 text-slate-500" />
          <span>アーカイブ</span>
          {archivedCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-slate-300 text-slate-700 rounded-full text-xs font-semibold">
              {archivedCount}
            </span>
          )}
        </button>

        {/* 電源（終了）ボタン */}
        <button
          onClick={onOpenShutdown}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-lg transition-colors cursor-pointer border border-rose-200/60"
          title="アプリを終了"
        >
          <Power className="w-4 h-4 text-rose-600" />
          <span>終了</span>
        </button>
      </div>
    </header>
  );
};
