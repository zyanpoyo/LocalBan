import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Database,
  Download,
  Upload,
  History,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  RotateCcw,
  FileArchive,
  HardDrive,
  ShieldAlert,
} from 'lucide-react';
import {
  exportBackup,
  importBackup,
  listInternalBackups,
  createInternalBackup,
  restoreInternalBackup,
  openBackupsFolder,
} from '../api';
import { BackupFileInfo, RestoreResult } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onRestored,
}) => {
  const [activeTab, setActiveTab] = useState<'external' | 'snapshots'>('external');
  const [snapshots, setSnapshots] = useState<BackupFileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRestoreResult, setLastRestoreResult] = useState<RestoreResult | null>(null);

  // 復元確認モーダル
  const [confirmTarget, setConfirmTarget] = useState<{
    type: 'external' | 'snapshot';
    filename?: string;
  } | null>(null);

  // スナップショット一覧取得
  const loadSnapshots = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listInternalBackups();
      setSnapshots(list);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'スナップショット一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSuccessMessage(null);
      setErrorMessage(null);
      setLastRestoreResult(null);
      loadSnapshots();
    }
  }, [isOpen, loadSnapshots]);

  // Escキーで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape' && !confirmTarget && !actionLoading) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, confirmTarget, actionLoading, onClose]);

  if (!isOpen) return null;

  // 1. バックアップ書き出し (エクスポート)
  const handleExport = async () => {
    try {
      setActionLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const savedPath = await exportBackup();
      if (savedPath) {
        setSuccessMessage(`バックアップファイルを保存しました:\n${savedPath}`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'バックアップの保存に失敗しました');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. 外部ファイルからの復元 (インポート)
  const executeExternalRestore = async () => {
    try {
      setActionLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const result = await importBackup();
      if (result && result.success) {
        setLastRestoreResult(result);
        setSuccessMessage(result.message);
        onRestored();
        loadSnapshots();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'バックアップからの復元に失敗しました');
    } finally {
      setActionLoading(false);
      setConfirmTarget(null);
    }
  };

  // 3. 手動スナップショット作成
  const handleCreateSnapshot = async () => {
    try {
      setActionLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const created = await createInternalBackup();
      setSuccessMessage(`スナップショットを作成しました (${created.filename})`);
      await loadSnapshots();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'スナップショットの作成に失敗しました');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. スナップショットからの復元
  const executeSnapshotRestore = async (filename: string) => {
    try {
      setActionLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const result = await restoreInternalBackup(filename);
      if (result.success) {
        setLastRestoreResult(result);
        setSuccessMessage(result.message);
        onRestored();
        loadSnapshots();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'スナップショットからの復元に失敗しました');
    } finally {
      setActionLoading(false);
      setConfirmTarget(null);
    }
  };

  // 5. フォルダを開く
  const handleOpenFolder = async () => {
    try {
      await openBackupsFolder();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'バックアップフォルダを開けませんでした');
    }
  };

  // サイズ表示フォーマット
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // 日時表示フォーマット
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-xs text-white">
                <Database className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  データ管理（バックアップ & 復元）
                </h2>
                <p className="text-xs text-slate-500">
                  カンバンデータ・添付ファイル・設定の安全な保管と復元
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={actionLoading}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="閉じる (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* タブナビゲーション */}
          <div className="flex border-b border-slate-200 bg-slate-100/60 px-6 pt-2 gap-2 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('external')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg transition-colors border-t border-x cursor-pointer ${
                activeTab === 'external'
                  ? 'bg-white text-indigo-700 border-slate-200 border-b-transparent shadow-xs font-bold'
                  : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <FileArchive className="w-3.5 h-3.5" />
              ファイルで保存 / 復元
            </button>
            <button
              onClick={() => setActiveTab('snapshots')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg transition-colors border-t border-x cursor-pointer ${
                activeTab === 'snapshots'
                  ? 'bg-white text-indigo-700 border-slate-200 border-b-transparent shadow-xs font-bold'
                  : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              スナップショット履歴
              {snapshots.length > 0 && (
                <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px]">
                  {snapshots.length}
                </span>
              )}
            </button>
          </div>

          {/* メッセージバー */}
          {errorMessage && (
            <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="whitespace-pre-wrap">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="whitespace-pre-wrap font-medium">{successMessage}</div>
            </div>
          )}

          {lastRestoreResult && (
            <div className="mx-6 mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[11px] text-indigo-600 block">復元リスト</span>
                <span className="text-sm font-bold">{lastRestoreResult.lists_count} 件</span>
              </div>
              <div>
                <span className="text-[11px] text-indigo-600 block">復元カード</span>
                <span className="text-sm font-bold">{lastRestoreResult.cards_count} 件</span>
              </div>
              <div>
                <span className="text-[11px] text-indigo-600 block">添付ファイル展開</span>
                <span className="text-sm font-bold">{lastRestoreResult.attachments_restored} 件</span>
              </div>
            </div>
          )}

          {/* コンテンツエリア */}
          <div className="p-6 overflow-y-auto space-y-6">
            {activeTab === 'external' ? (
              <div className="space-y-6">
                {/* 1. バックアップの書き出し */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-800">
                      バックアップを外部ファイルに保存 (エクスポート)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    現在のカンバンボード、カード、チェックリスト、ラベル、添付ファイル（画像など）、設定のすべてを1つの完全バックアップファイル（
                    <code className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[11px]">
                      .localban
                    </code>
                    ）として書き出します。PCの移行や外部ドライブへの保管に最適です。
                  </p>
                  <div className="pt-1">
                    <button
                      onClick={handleExport}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      バックアップファイルを保存...
                    </button>
                  </div>
                </div>

                {/* 2. バックアップから復元 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-800">
                      バックアップファイルから復元 (インポート)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    以前保存した完全バックアップファイル（
                    <code className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[11px]">
                      .localban
                    </code>
                    ,{' '}
                    <code className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[11px]">
                      .zip
                    </code>
                    ）またはデータベースファイル（
                    <code className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[11px]">
                      .db
                    </code>
                    ）を選択して、ボードデータを復元します。
                  </p>

                  <div className="flex items-start gap-2 p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-lg text-xs text-amber-800">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>安心設計</strong>: 復元を実行する直前に、現在のデータが「復元前自動バックアップ（pre_restore）」として自動保存されるため、誤って上書きした場合でも元に戻せます。
                    </span>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={() => setConfirmTarget({ type: 'external' })}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      ファイルを選択して復元...
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-600">
                    起動時に自動生成される日次バックアップおよび復元直前に退避されたスナップショットです。
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleCreateSnapshot}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="現在の状態を手動で内部バックアップとして保存"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      今すぐ作成
                    </button>
                    <button
                      onClick={handleOpenFolder}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition-colors cursor-pointer"
                      title="バックアップファイルが保存されているフォルダをエクスプローラーで開く"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      フォルダを開く
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-xs">スナップショットを読み込み中...</span>
                  </div>
                ) : snapshots.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl p-6">
                    <HardDrive className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-medium">スナップショットはまだありません</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      「今すぐ作成」ボタンを押すと現在のスナップショットが保存されます。
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">種別 / ファイル名</th>
                          <th className="py-2.5 px-3">作成日時</th>
                          <th className="py-2.5 px-3">サイズ</th>
                          <th className="py-2.5 px-3 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {snapshots.map((snap) => (
                          <tr key={snap.filename} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-3 font-medium">
                              <div className="flex items-center gap-2">
                                {snap.is_safety_backup ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                                    復元前退避
                                  </span>
                                ) : snap.filename.startsWith('localban_manual_') ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">
                                    手動作成
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                    日次自動
                                  </span>
                                )}
                                <span className="font-mono text-[11px] truncate max-w-[200px]" title={snap.filename}>
                                  {snap.filename}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                              {formatDate(snap.created_at)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                              {formatBytes(snap.size_bytes)}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <button
                                onClick={() =>
                                  setConfirmTarget({
                                    type: 'snapshot',
                                    filename: snap.filename,
                                  })
                                }
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 active:bg-indigo-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="w-3 h-3" />
                                復元
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* フッター */}
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>
              保存場所: <code className="font-mono">%APPDATA%\LocalBan\backups</code>
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>

      {/* 復元確認ダイアログ */}
      {confirmTarget && (
        <ConfirmModal
          isOpen={true}
          title="ボードデータの復元確認"
          message={
            confirmTarget.type === 'external'
              ? '選択したバックアップファイルからデータを復元します。現在のボードデータは上書きされます。'
              : `スナップショット「${confirmTarget.filename}」からデータを復元します。現在のボードデータは上書きされます。`
          }
          subMessage="復元を実行する直前に、現在のデータは「復元前自動バックアップ (pre_restore)」として自動保存されます。よろしいですか？"
          confirmLabel="復元を実行"
          cancelLabel="キャンセル"
          isDanger={true}
          onConfirm={() => {
            if (confirmTarget.type === 'external') {
              executeExternalRestore();
            } else if (confirmTarget.filename) {
              executeSnapshotRestore(confirmTarget.filename);
            }
          }}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </>
  );
};
