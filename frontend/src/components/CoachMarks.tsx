import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Sparkles, HelpCircle } from 'lucide-react';

export interface CoachStep {
  targetSelector: string;
  title: string;
  description: string;
  preferredPlacement?: 'top' | 'bottom' | 'left' | 'right';
  badge?: string;
}

export const COACH_STEPS: CoachStep[] = [
  {
    targetSelector: '[data-coachmark="list-column-first"]',
    title: 'カンバンボードへようこそ！',
    description:
      'LocalBan は完全オフライン・安全に動作するローカルタスク管理アプリです。タスクは状態別に「ToDo」「進行中」「完了」などのリストに分けて可視化・管理します。',
    preferredPlacement: 'right',
    badge: '基本構造',
  },
  {
    targetSelector: '[data-coachmark="sample-card"]',
    title: 'カードの詳細と編集',
    description:
      'カードをクリックすると詳細モーダルが開き、Markdown対応の説明記述、チェックリストの追加、優先度ラベルの設定、画像などの添付ファイル追加が行えます。',
    preferredPlacement: 'bottom',
    badge: 'カード操作',
  },
  {
    targetSelector: '[data-coachmark="list-column-doing"]',
    title: 'ドラッグ＆ドロップで進捗更新',
    description:
      'カードをつかんで左右のリストへドラッグ＆ドロップするだけで、進捗ステータスを直感的に更新できます。同じリスト内での優先度並び替えも自由に行えます。',
    preferredPlacement: 'bottom',
    badge: '進捗管理',
  },
  {
    targetSelector: '[data-coachmark="add-card-btn"]',
    title: 'カードやリストの追加',
    description:
      'リスト下部の「+ カードを追加」から新しいタスクを素早く登録できます。また、ボード右端からは新しいリストを自由に追加して独自のフローを作れます。',
    preferredPlacement: 'top',
    badge: 'タスク作成',
  },
  {
    targetSelector: '[data-coachmark="header-tools"]',
    title: '便利ツールとデータ管理',
    description:
      'キーボードショートカット一覧（?キー）、安全な完全バックアップ＆復元、アーカイブ管理、終了・トレイ格納設定などをヘッダーからいつでも利用できます。',
    preferredPlacement: 'bottom',
    badge: 'データ & 設定',
  },
];

interface CoachMarksProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const CoachMarks: React.FC<CoachMarksProps> = ({ isOpen, onComplete, onSkip }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const popoverRef = useRef<HTMLDivElement>(null);

  const step = COACH_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === COACH_STEPS.length - 1;

  // ターゲット要素の位置を更新
  const updateTargetRect = useCallback(() => {
    if (!isOpen || !step) return;

    const element = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (element) {
      // 画面内にスクロール
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      const rect = element.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setTargetRect(null);
    }
  }, [isOpen, step]);

  // ステップ切り替え時・リサイズ・スクロール時の位置追従
  useEffect(() => {
    if (!isOpen) return;

    updateTargetRect();
    const timer = setTimeout(updateTargetRect, 100);

    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      updateTargetRect();
    };

    const handleScroll = () => {
      updateTargetRect();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, currentStepIndex, updateTargetRect]);

  // キーボードナビゲーション
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (isLastStep) {
          onComplete();
        } else {
          setCurrentStepIndex((prev) => Math.min(COACH_STEPS.length - 1, prev + 1));
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!isFirstStep) {
          setCurrentStepIndex((prev) => Math.max(0, prev - 1));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFirstStep, isLastStep, onComplete, onSkip]);

  if (!isOpen || !step) return null;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // ポップオーバーの計算
  const padding = 8;
  const popoverWidth = 360;
  const popoverMargin = 14;

  let popoverStyle: React.CSSProperties = {
    position: 'fixed',
    width: `${popoverWidth}px`,
    zIndex: 60,
  };

  if (targetRect) {
    const { top, left, width, height } = targetRect;
    const placement = step.preferredPlacement || 'bottom';

    let popoverTop = 0;
    let popoverLeft = 0;

    if (placement === 'bottom') {
      popoverTop = top + height + popoverMargin;
      popoverLeft = left + width / 2 - popoverWidth / 2;
    } else if (placement === 'top') {
      popoverTop = top - 240 - popoverMargin;
      popoverLeft = left + width / 2 - popoverWidth / 2;
    } else if (placement === 'right') {
      popoverTop = top + 10;
      popoverLeft = left + width + popoverMargin;
    } else if (placement === 'left') {
      popoverTop = top + 10;
      popoverLeft = left - popoverWidth - popoverMargin;
    }

    // 画面外にはみ出さないようクランプ
    popoverLeft = Math.max(16, Math.min(windowSize.width - popoverWidth - 16, popoverLeft));
    popoverTop = Math.max(16, Math.min(windowSize.height - 280, popoverTop));

    popoverStyle = {
      ...popoverStyle,
      top: `${popoverTop}px`,
      left: `${popoverLeft}px`,
    };
  } else {
    // ターゲットが存在しない場合の画面中央表示
    popoverStyle = {
      ...popoverStyle,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  // スポットライト領域の座標
  const spotlightX = targetRect ? Math.max(0, targetRect.left - padding) : 0;
  const spotlightY = targetRect ? Math.max(0, targetRect.top - padding) : 0;
  const spotlightW = targetRect ? targetRect.width + padding * 2 : 0;
  const spotlightH = targetRect ? targetRect.height + padding * 2 : 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coachmark-title"
    >
      {/* SVG スポットライトマスクオーバーレイ */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ width: '100vw', height: '100vh' }}
      >
        <defs>
          <mask id="coachmark-spotlight-mask">
            {/* 白 = 表示（背景を暗くする） */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* 黒 = くり抜き（ターゲットをハイライト） */}
            {targetRect && (
              <rect
                x={spotlightX}
                y={spotlightY}
                width={spotlightW}
                height={spotlightH}
                rx="12"
                ry="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* 暗幕背景（マスク適用） */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.65)"
          mask="url(#coachmark-spotlight-mask)"
        />
      </svg>

      {/* スポットライトのアウトラインリング演出 */}
      {targetRect && (
        <div
          className="fixed pointer-events-none rounded-xl border-2 border-indigo-400/90 shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all duration-300"
          style={{
            top: `${spotlightY}px`,
            left: `${spotlightX}px`,
            width: `${spotlightW}px`,
            height: `${spotlightH}px`,
            zIndex: 55,
          }}
        />
      )}

      {/* ガイドポップオーバーカード */}
      <div
        ref={popoverRef}
        style={popoverStyle}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* ヘッダー: ステップインジケーター & スキップ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              ガイド {currentStepIndex + 1} / {COACH_STEPS.length}
            </span>
            {step.badge && (
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {step.badge}
              </span>
            )}
          </div>
          <button
            onClick={onSkip}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="ツアーをスキップ (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* プログレスバー */}
        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full transition-all duration-300 ease-out"
            style={{
              width: `${((currentStepIndex + 1) / COACH_STEPS.length) * 100}%`,
            }}
          />
        </div>

        {/* タイトル & 説明文 */}
        <div className="space-y-1.5">
          <h3 id="coachmark-title" className="text-base font-bold text-slate-800 leading-snug">
            {step.title}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
        </div>

        {/* フッターナビゲーションボタン */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            onClick={onSkip}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            スキップ
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                前へ
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isLastStep ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  はじめる
                </>
              ) : (
                <>
                  次へ
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* 操作ヒント */}
        <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-2">
          <span>Enter / 矢印キーで移動</span>
          <span>•</span>
          <span>Esc で終了</span>
        </div>
      </div>
    </div>
  );
};
