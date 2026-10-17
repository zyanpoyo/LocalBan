import React, { useState, useEffect } from 'react';
import {
  Archive,
  Power,
  Check,
  Loader2,
  AlertCircle,
  Keyboard,
  ShieldCheck,
  Minimize2,
} from 'lucide-react';
import { onSaveStatusChange, fetchAppSettings, updateAppSettings } from '../api';
import { SaveStatus } from '../types';

interface HeaderProps {
  onOpenArchive: () => void;
  onOpenShutdown: () => void;
  onOpenShortcutHelp?: () => void;
  onOpenInfo?: () => void;
  archivedCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenArchive,
  onOpenShutdown,
  onOpenShortcutHelp,
  onOpenInfo,
  archivedCount,
}) => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [closeToTray, setCloseToTray] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onSaveStatusChange((status) => {
      setSaveStatus(status);
    });
    fetchAppSettings()
      .then((s) => setCloseToTray(s.close_to_tray))
      .catch(() => {});
    return unsubscribe;
  }, []);

  const handleToggleCloseBehavior = async () => {
    const next = !closeToTray;
    setCloseToTray(next);
    try {
      const updated = await updateAppSettings(next);
      setCloseToTray(updated.close_to_tray);
    } catch {
      setCloseToTray(!next);
    }
  };

  return (
    <header className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* ロゴ & タイトル (新デザイン: レイヤード・タスクカード & エメラルド・チェックバッジ) */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-sm border border-slate-700/80">
          <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
            <rect x="7.5" y="4.5" width="19" height="11.5" rx="2.5" fill="#0ea5e9" fillOpacity="0.9" />
            <rect x="5.5" y="8" width="19.5" height="12" rx="2.5" fill="#6366f1" />
            <rect x="3.5" y="11.5" width="20" height="14" rx="2.5" fill="#ffffff" />
            <rect x="5.8" y="13.8" width="5.2" height="1.8" rx="0.9" fill="#10b981" />
            <rect x="12" y="13.8" width="4.4" height="1.8" rx="0.9" fill="#f59e0b" />
            <rect x="5.8" y="17" width="13" height="2" rx="1" fill="#1e293b" />
            <rect x="5.8" y="20.2" width="9.5" height="1.6" rx="0.8" fill="#94a3b8" />
            <circle cx="23.5" cy="23" r="6" fill="#0f172a" />
            <circle cx="23.5" cy="23" r="5" fill="#10b981" />
            <path
              d="M21 23L22.8 24.8L26.2 21.2"
              stroke="#ffffff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-indigo-700 to-emerald-600 bg-clip-text text-transparent">
          LocalBan
        </h1>
        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/80">
          v2.0.0
        </span>
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
        {/* ×ボタン動作切替トグル (Store 審査基準 10.4.2 ユーザビリティ対応) */}
        <button
          onClick={handleToggleCloseBehavior}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
            closeToTray
              ? 'text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border-indigo-200/80'
              : 'text-slate-600 bg-slate-100 hover:bg-slate-200 border-slate-200/80'
          }`}
          title={
            closeToTray
              ? '現在：右上の「×」ボタンでタスクトレイに格納します（クリックで「×ボタンで完全終了」に切替）'
              : '現在：右上の「×」ボタンでアプリを完全終了します（クリックで「×ボタンでトレイ格納」に切替）'
          }
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span className="hidden md:inline">
            {closeToTray ? '×: トレイ格納' : '×: 完全終了'}
          </span>
        </button>

        {/* ショートカット一覧 */}
        {onOpenShortcutHelp && (
          <button
            onClick={onOpenShortcutHelp}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition-colors cursor-pointer"
            title="キーボードショートカット一覧 (?)"
          >
            <Keyboard className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline text-xs">ショートカット</span>
            <kbd className="px-1 py-0.2 text-[10px] font-mono font-semibold bg-white text-slate-600 border border-slate-300 rounded">
              ?
            </kbd>
          </button>
        )}

        {/* アプリ情報・プライバシーポリシー・免責事項 (Store 審査基準 10.2 / 10.5.1 対応) */}
        {onOpenInfo && (
          <button
            onClick={onOpenInfo}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition-colors cursor-pointer"
            title="プライバシーポリシー・免責事項・アプリ情報"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="hidden lg:inline">規約・免責</span>
          </button>
        )}

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
