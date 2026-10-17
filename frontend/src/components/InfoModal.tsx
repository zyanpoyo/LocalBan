import React, { useEffect } from 'react';
import { X, ShieldCheck, Scale, ExternalLink, Lock, Database, HardDrive, Sparkles } from 'lucide-react';
import { openExternalUrl } from '../api';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCoachMarks?: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, onOpenCoachMarks }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOpenExternal = (url: string) => {
    openExternalUrl(url).catch(console.error);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-xs border border-slate-700">
              <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
                <rect x="7.5" y="4.5" width="19" height="11.5" rx="2.5" fill="#0ea5e9" fillOpacity="0.9" />
                <rect x="5.5" y="8" width="19.5" height="12" rx="2.5" fill="#6366f1" />
                <rect x="3.5" y="11.5" width="20" height="14" rx="2.5" fill="#ffffff" />
                <rect x="5.8" y="13.8" width="5.2" height="1.8" rx="0.9" fill="#10b981" />
                <rect x="12" y="13.8" width="4.4" height="1.8" rx="0.9" fill="#f59e0b" />
                <rect x="5.8" y="17" width="13" height="2" rx="1" fill="#1e293b" />
                <circle cx="23.5" cy="23" r="6" fill="#0f172a" />
                <circle cx="23.5" cy="23" r="5" fill="#10b981" />
                <path d="M21 23L22.8 24.8L26.2 21.2" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                LocalBan v2.0.0 — プライバシーポリシー・免責事項
              </h2>
              <p className="text-xs text-slate-500">
                LocalBan Project | ライセンス: MIT License
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title="閉じる (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 leading-relaxed">
          {/* 1. プライバシーポリシー (Microsoft Store Policy 10.5.1 対応) */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
              <h3>プライバシーポリシー (Privacy Policy)</h3>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 space-y-2 text-xs text-slate-700">
              <p className="font-semibold text-emerald-900">
                本アプリケーション（LocalBan）は、ユーザーの個人情報や利用データを外部へ一切収集・送信しません。
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-slate-600">
                <li>
                  <strong className="text-slate-800">外部通信・テレメトリ送信ゼロ</strong>:
                  インターネット経由のデータ送信、アクセス解析、トラッキング、広告配信は一切行いません。
                </li>
                <li>
                  <strong className="text-slate-800">完全ローカル保存</strong>:
                  作成したボード・カード・添付画像・設定はすべてお使いのPC内のローカル領域（
                  <code className="px-1 py-0.5 bg-white rounded border border-emerald-200 font-mono text-[11px]">
                    %APPDATA%\LocalBan
                  </code>
                  ）にのみ保存されます。
                </li>
                <li>
                  <strong className="text-slate-800">第三者提供なし</strong>:
                  ユーザーデータが開発者や第三者に送信・共有されることはありません。
                </li>
                <li>
                  <strong className="text-slate-800">データの管理・削除</strong>:
                  ユーザーご自身の操作により、アプリ内の「アーカイブから完全削除」またはローカルフォルダの削除によっていつでも全データを消去できます。
                </li>
              </ul>
            </div>
          </section>

          {/* 2. 免責事項・知的財産権について (Microsoft Store Policy 10.2 / 11.2 対応) */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
              <Scale className="w-4.5 h-4.5 text-indigo-600" />
              <h3>免責事項・知的財産権について (Disclaimer)</h3>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs text-slate-600">
              <div>
                <p className="font-semibold text-slate-800 mb-1">
                  ■ 非提携について
                </p>
                <p>
                  本ソフトウェア（LocalBan）は、独立した個人開発者によるオープンソース／ローカルファーストのプロジェクトです。
                  本ソフトウェアは、いかなる特定の第三者企業、法人、または既存のタスク管理製品・クラウドサービスとも提携、協賛、承認、または関連関係にありません。
                </p>
              </div>
              <div className="border-t border-slate-200 pt-2.5">
                <p className="font-semibold text-slate-800 mb-1">
                  ■ ソフトウェア利用に関する無保証・免責事項
                </p>
                <p>
                  本ソフトウェアは「現状有姿（AS IS）」で提供されており、商品性、特定目的への適合性、および権利非侵害の保証を含め、明示または黙示を問わずいかなる保証も行いません。
                  本ソフトウェアの使用、または使用できなかったことに起因して生じたいかなる直接的・間接的損害（データの消失・破損、業務の中断等を含む）についても、開発者および著作権者は一切の責任を負いません。重要なデータは定期的なバックアップを推奨します。
                </p>
              </div>
            </div>
          </section>

          {/* 3. システム・データ保存仕様 */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-800">完全オフライン</div>
                <div className="text-slate-500 text-[11px]">認証不要・外部通信ゼロ</div>
              </div>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-start gap-2.5">
              <Database className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-800">SQLite WAL + 自動保護</div>
                <div className="text-slate-500 text-[11px]">起動時7世代自動バックアップ</div>
              </div>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-start gap-2.5">
              <HardDrive className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-800">WebView2 ネイティブ</div>
                <div className="text-slate-500 text-[11px]">Tauri v2 + Full Rust</div>
              </div>
            </div>
          </section>

          {/* 4. 操作ガイド（コーチマーク）の再表示 */}
          {onOpenCoachMarks && (
            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  操作ガイド（ツアー）を再確認する
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  初回起動時のコーチマークガイドを再生し、カンバンの基本操作や便利機能の配置を復習できます。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCoachMarks();
                }}
                className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>ツアーを再生</span>
              </button>
            </div>
          )}
        </div>

        {/* フッター（外部リンク & 閉じるボタン） */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                handleOpenExternal('https://github.com/zyanpoyo/LocalBan/blob/main/PRIVACY_POLICY.md')
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
            >
              <span>Web版プライバシーポリシー</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleOpenExternal('https://github.com/zyanpoyo/LocalBan/issues')}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 underline underline-offset-2 cursor-pointer"
            >
              <span>サポート・お問い合わせ (GitHub)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
