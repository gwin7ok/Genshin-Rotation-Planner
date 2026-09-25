import React, { useState, useRef, useLayoutEffect } from 'react';
import { Play, Pause, RotateCcw, Users, Settings2, Copy, Check, FileText, HelpCircle, Save, Database } from 'lucide-react';
import { SavedRotationSlot } from '../types/genshin';

interface HeaderProps {
  savedSlots: SavedRotationSlot[];
  activeSlotId: string | null;
  onSelectSavedSlot: (slot: SavedRotationSlot) => void;
  onOverwriteActiveSlot: () => void;
  overwriteSaved: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetPlayback: () => void;
  currentTime: number;
  totalDuration: number;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  onOpenPartyModal: () => void;
  onOpenSummaryModal: () => void;
  onOpenHelpModal: () => void;
  onOpenSaveModal: () => void;
  onOpenDatabaseModal: () => void;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCopyNotation: () => void;
  copiedNotation: boolean;
  loopStartTime?: number;
  rotationNotation?: string;
}

export const Header: React.FC<HeaderProps> = ({
  savedSlots,
  activeSlotId,
  onSelectSavedSlot,
  onOverwriteActiveSlot,
  overwriteSaved,
  isPlaying,
  onTogglePlay,
  onResetPlayback,
  currentTime,
  totalDuration,
  playbackSpeed,
  onChangeSpeed,
  onOpenPartyModal,
  onOpenSummaryModal,
  onOpenHelpModal,
  onOpenSaveModal,
  onOpenDatabaseModal,
  onExportJson,
  onImportJson,
  onCopyNotation,
  copiedNotation,
  loopStartTime = 0,
  rotationNotation = '',
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const headerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const updateHeight = () => {
      if (headerRef.current) {
        const h = headerRef.current.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--header-height', `${h}px`);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [isCollapsed, isPlaying, currentTime, totalDuration]);

  return (
    <header
      ref={headerRef}
      className="bg-slate-900/95 backdrop-blur border-b border-slate-800 sticky top-0 z-50 px-3 sm:px-4 py-2 shadow-xl transition-all"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-2">
        {/* Main Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 flex items-center justify-center shadow-md text-slate-950 font-black text-base shrink-0">
              ✦
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-1">
                  原神ローテーション <span className="text-amber-400 font-extrabold text-xs sm:text-sm">Gantt</span>
                </h1>
                <span className="hidden lg:inline-flex px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  数珠つなぎ・CT完全追従
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                出場ターンの直列スナップ &amp; スキル/爆発CT・バフ重複シミュレーター
              </p>
            </div>
          </div>

          {/* Saved Party (Slot) Selector & Save/Load */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/70">
              <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300 hidden xl:inline">編成選択:</span>
              <select
                value={activeSlotId && savedSlots.some(s => s.id === activeSlotId) ? activeSlotId : ''}
                onChange={(e) => {
                  const slot = savedSlots.find(s => s.id === e.target.value);
                  if (slot) onSelectSavedSlot(slot);
                }}
                disabled={savedSlots.length === 0}
                className="bg-slate-900 text-xs font-semibold text-amber-200 rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none focus:border-amber-400 cursor-pointer disabled:cursor-not-allowed disabled:text-slate-500 max-w-[130px] sm:max-w-xs truncate"
                title="「保存・読込」で保存した編成を呼び出します"
              >
                <option value="" disabled hidden={savedSlots.length > 0}>
                  {savedSlots.length === 0 ? '保存された編成はありません' : '-- 保存した編成を選択 --'}
                </option>
                {savedSlots.map(slot => (
                  <option key={slot.id} value={slot.id}>
                    {slot.name}
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const activeSlot = savedSlots.find(s => s.id === activeSlotId);
              return (
                <button
                  onClick={onOverwriteActiveSlot}
                  disabled={!activeSlot}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    overwriteSaved
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40 hover:border-amber-400'
                  }`}
                  title={activeSlot
                    ? `現在の画面の状態で「${activeSlot.name}」を上書き保存します`
                    : '編成選択で保存編成を呼び出すと上書き保存できます'}
                >
                  {overwriteSaved ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Save className="w-3.5 h-3.5 shrink-0" />}
                  <span>{overwriteSaved ? '保存しました' : '上書き保存'}</span>
                </button>
              );
            })()}

            <button
              onClick={onOpenSaveModal}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all"
              title="ローテーションの保存・読込・スロット管理・バックアップ"
            >
              <Save className="w-3.5 h-3.5 shrink-0" />
              <span>保存・読込</span>
            </button>
          </div>

          {/* Playback Controls & Scrubber */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-800">
            <button
              onClick={onTogglePlay}
              title={isPlaying ? '一時停止' : '再生'}
              className={`p-1 rounded-lg font-medium transition-all ${
                isPlaying 
                  ? 'bg-amber-500 text-slate-950 shadow ring-2 ring-amber-400/50' 
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            </button>
            
            <button
              onClick={onResetPlayback}
              title={loopStartTime > 0 ? `初動の先頭に戻る (-${loopStartTime.toFixed(1)}s)` : "先頭に戻る (0.0s)"}
              className="p-1 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>

            {/* Time indicator */}
            <div className="flex items-center gap-1 font-mono text-xs text-right min-w-[65px]">
              {loopStartTime > 0 ? (
                <div>
                  {(() => {
                    const rel = currentTime - loopStartTime;
                    const relStr = Math.abs(rel) < 0.05 ? '0.0s' : rel < 0 ? `-${Math.abs(rel).toFixed(1)}s` : `+${rel.toFixed(1)}s`;
                    return (
                      <span className={`font-bold ${rel < 0 ? 'text-amber-300' : 'text-purple-300'}`}>
                        {relStr}
                      </span>
                    );
                  })()}
                </div>
              ) : (
                <div>
                  <span className="text-amber-400 font-bold">{currentTime.toFixed(1)}s</span>
                  <span className="text-slate-500 text-[10px]">/{totalDuration.toFixed(1)}s</span>
                </div>
              )}
            </div>

            {/* Speed Selector */}
            <div className="flex items-center rounded bg-slate-900 border border-slate-800 text-[10px] overflow-hidden">
              {[0.5, 1.0, 2.0].map(spd => (
                <button
                  key={spd}
                  onClick={() => onChangeSpeed(spd)}
                  className={`px-1 py-0.5 transition-colors ${
                    playbackSpeed === spd 
                      ? 'bg-amber-500/30 text-amber-300 font-bold' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Button for Collapsing/Expanding DB管理, 並び替え・使い方, etc. */}
          <button
            type="button"
            onClick={() => setIsCollapsed(prev => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
              isCollapsed
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 shadow-sm'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
            title={isCollapsed ? 'DB管理・便利ツールメニューを展開 (▼)' : 'DB管理・便利ツールメニューを省略 (△)'}
          >
            <span>{isCollapsed ? '▼ メニュー展開' : '△ 省略'}</span>
          </button>
        </div>

        {/* Collapsible Action Tools Row (DB管理, 並び替え・使い方, 編成設定, 手順書, 記法コピー, 記法表示) */}
        {!isCollapsed && (
          <div className="flex flex-wrap items-center justify-start gap-1.5 pt-1.5 border-t border-slate-800/80 animate-fade-in w-full">
            <button
              onClick={onOpenDatabaseModal}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors shadow-sm shrink-0"
              title="キャラ・武器・聖遺物の最新公式データ同期とカスタム編集"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>DB管理</span>
            </button>

            <button
              onClick={onOpenHelpModal}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors shadow-sm shrink-0"
              title="登場キャラの順番入れ替え・操作ガイドを開く"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>並び替え・使い方</span>
            </button>

            <button
              onClick={onOpenPartyModal}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors shrink-0"
              title="パーティ4人の編成・武器・聖遺物変更"
            >
              <Settings2 className="w-3.5 h-3.5 text-amber-400" />
              <span>編成設定</span>
            </button>

            <button
              onClick={onOpenSummaryModal}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors shrink-0"
              title="ローテーション手順書・チートシート表示"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>手順書</span>
            </button>

            <button
              onClick={onCopyNotation}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors shrink-0"
              title="テキスト記法コピー (行秋 [Q E E N1] ➔ ベネット [Q E]...)"
            >
              {copiedNotation ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedNotation ? 'コピー完了' : '記法コピー'}</span>
            </button>

            {/* Notation Text Display right next to 記法コピー */}
            {rotationNotation && (
              <div 
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-slate-950/90 text-amber-300/90 border border-slate-800 rounded-lg max-w-full overflow-x-auto whitespace-nowrap custom-scrollbar shrink min-w-0"
                title="現在のローテーション記法"
              >
                <span className="text-[10px] text-slate-500 font-sans shrink-0 select-none">記法:</span>
                <span className="select-all font-semibold tracking-wide">{rotationNotation}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

