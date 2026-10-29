import { staleReactionsBadge } from './StaleReactionsBadge';
import React, { useState, useRef, useLayoutEffect } from 'react';
import { Play, Pause, RotateCcw, Users, Settings2, Copy, Check, HelpCircle, Save, Database, FilePlus2, FolderCog, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SavedRotationSlot } from '../types/genshin';
import { ListSelect } from './ListSelect';
import { LanguageSwitcher } from './LanguageSwitcher';
import { t } from '../i18n';
import { slotDisplayName } from '../utils/presets';

interface HeaderProps {
  savedSlots: SavedRotationSlot[];
  activeSlotId: string | null;
  onSelectSavedSlot: (slot: SavedRotationSlot) => void;
  onOverwriteActiveSlot: () => void;
  overwriteSaved: boolean;
  onOpenSaveAs: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetPlayback: () => void;
  currentTime: number;
  totalDuration: number;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  onOpenPartyModal: () => void;
  onOpenHelpModal: () => void;
  onOpenSaveModal: () => void;
  onOpenDatabaseModal: () => void;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCopyNotation: () => void;
  onCopyGcsimConfig: () => void;
  /** 「gcsim で計算」: 設定文を作って gcsim を実行し、結果を一括で反映する（D120） */
  onGcsimCompute?: () => void;
  gcsimComputing?: boolean;
  /** gcsim の結果の反映・個別の変更を外し、アクションの並びを基準にアプリの計算へ戻す */
  onResetToAppCalculation?: () => void;
  copiedNotation: boolean;
  loopStartTime?: number;
  rotationNotation?: string;
  /** 記法のモード（略号 / 名称）と、切り替え */
  notationMode?: 'short' | 'name';
  onChangeNotationMode?: (mode: 'short' | 'name') => void;
  totalCTCollisions?: number;
  /** 発動バフのCT警告の件数（CT中の発動。効果が発動しないだけで、gcsim の計算は止めない） */
  totalCTWarnings?: number;
  playbackCycleCount?: number;
  loopPeriod?: number;
}

export const Header: React.FC<HeaderProps> = ({
  savedSlots,
  activeSlotId,
  onSelectSavedSlot,
  onOverwriteActiveSlot,
  overwriteSaved,
  onOpenSaveAs,
  isPlaying,
  onTogglePlay,
  onResetPlayback,
  currentTime,
  totalDuration,
  playbackSpeed,
  onChangeSpeed,
  onOpenPartyModal,
  onOpenHelpModal,
  onOpenSaveModal,
  onOpenDatabaseModal,
  onExportJson,
  onImportJson,
  onCopyNotation,
  onCopyGcsimConfig,
  onGcsimCompute,
  gcsimComputing = false,
  onResetToAppCalculation,
  copiedNotation,
  loopStartTime = 0,
  rotationNotation = '',
  notationMode = 'short',
  onChangeNotationMode,
  totalCTCollisions = 0,
  totalCTWarnings = 0,
  playbackCycleCount = 1,
  loopPeriod = 0,
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
      <div className="w-full flex flex-col items-center gap-2">
        {/* Main Header Row */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 w-full">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 flex items-center justify-center shadow-md text-slate-950 font-black text-base shrink-0">
              ✦
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-1">
                  {t('header:title')} <span className="text-amber-400 font-extrabold text-xs sm:text-sm">Gantt</span>
                </h1>
                <span className="hidden lg:inline-flex px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {t('header:badge')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                {t('header:subtitle')}
              </p>
            </div>
          </div>

          {/* Saved Party (Slot) Selector & Save/Load */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/70">
              <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300 hidden xl:inline">{t('header:slot.label')}</span>
              <ListSelect
                value={activeSlotId && savedSlots.some(s => s.id === activeSlotId) ? activeSlotId : ''}
                placeholder={t('header:slot.unsaved')}
                options={[
                  { value: '', label: t('header:slot.unsaved'), disabled: true },
                  ...savedSlots.map(slot => ({ value: slot.id, label: slotDisplayName(slot), badge: staleReactionsBadge(slot.reactions) })),
                ]}
                onChange={(v) => {
                  const slot = savedSlots.find(s => s.id === v);
                  if (slot) onSelectSavedSlot(slot);
                }}
                disabled={savedSlots.length === 0}
                className={`bg-slate-900 text-xs font-semibold rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none focus:border-amber-400 max-w-[130px] sm:max-w-xs ${
                  activeSlotId && savedSlots.some(s => s.id === activeSlotId) ? 'text-amber-200' : 'text-slate-400'
                }`}
                title={savedSlots.length === 0 ? t('header:slot.noneTitle') : t('header:slot.selectTitle')}
              />
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
                    ? t('header:overwrite.title', { name: slotDisplayName(activeSlot) })
                    : t('header:overwrite.disabledTitle')}
                >
                  {overwriteSaved ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Save className="w-3.5 h-3.5 shrink-0" />}
                  <span>{overwriteSaved ? t('header:overwrite.saved') : t('header:overwrite.button')}</span>
                </button>
              );
            })()}

            <button
              onClick={onOpenSaveAs}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all"
              title={t('header:saveAs.title')}
            >
              <FilePlus2 className="w-3.5 h-3.5 shrink-0" />
              <span>{t('header:saveAs.button')}</span>
            </button>
          </div>

          {/* Playback Controls & Scrubber */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-800">
            <button
              onClick={onTogglePlay}
              title={isPlaying ? t('header:playback.pause') : t('header:playback.play')}
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
              title={loopStartTime > 0 ? t('header:playback.resetToOpener', { seconds: loopStartTime.toFixed(1) }) : t('header:playback.resetToStart')}
              className="p-1 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>

            {/* Playback Cycle Counter (1周目, 2周目, 3周目...) */}
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono select-none transition-all ${
                playbackCycleCount >= 2
                  ? 'bg-purple-900/90 text-purple-200 border border-purple-500 shadow-sm shadow-purple-500/20'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
              title={t('header:playback.cycleTitle', { count: playbackCycleCount })}
            >
              {t('header:playback.cycle', { count: playbackCycleCount })}
            </span>

            {/* Time indicator */}
            <div className="flex items-center gap-1 font-mono text-xs text-right min-w-[70px]">
              {(() => {
                if (playbackCycleCount >= 2 && loopPeriod > 0) {
                  const rel = Math.max(0, currentTime - loopStartTime);
                  return (
                    <div title={t('header:playback.positionCycle', { time: currentTime.toFixed(2), count: playbackCycleCount })}>
                      <span className="text-purple-300 font-bold">
                        +{rel.toFixed(1)}s
                      </span>
                      <span className="text-sky-300 font-semibold" title={t('header:playback.loopPeriod')}>
                        /{loopPeriod.toFixed(1)}s
                      </span>
                    </div>
                  );
                }

                if (loopStartTime > 0) {
                  const rel = currentTime - loopStartTime;
                  const relStr = Math.abs(rel) < 0.05 ? '0.0s' : rel < 0 ? `-${Math.abs(rel).toFixed(1)}s` : `+${rel.toFixed(1)}s`;
                  const curLoopPeriod = loopPeriod > 0 ? loopPeriod : Math.max(0, totalDuration - loopStartTime);
                  return (
                    <div title={t('header:playback.positionFirst', { time: currentTime.toFixed(2) })}>
                      <span className={`font-bold ${rel < 0 ? 'text-amber-300' : 'text-purple-300'}`}>
                        {relStr}
                      </span>
                      <span className="text-sky-300 font-semibold" title={t('header:playback.loopPeriodFromStart')}>
                        /{curLoopPeriod.toFixed(1)}s
                      </span>
                    </div>
                  );
                }

                return (
                  <div>
                    <span className="text-amber-400 font-bold">{currentTime.toFixed(1)}s</span>
                    <span className="text-sky-300 font-semibold" title={t('header:playback.total')}>/{totalDuration.toFixed(1)}s</span>
                  </div>
                );
              })()}
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

          {/* Overall CT Collision Status Badge (Always Visible between Play Controls & Collapse Toggle) */}
          {totalCTCollisions > 0 ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-950/90 border border-red-500 text-red-300 text-xs font-bold shadow-red-500/30 shadow animate-pulse shrink-0"
              title={t('header:ct.collisionTitle', { count: totalCTCollisions })}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{t('header:ct.collision', { count: totalCTCollisions })}</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/90 border border-emerald-500/70 text-emerald-300 text-xs font-bold shadow-sm shrink-0"
              title={t('header:ct.okTitle')}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{t('header:ct.ok')}</span>
            </div>
          )}

          {totalCTWarnings > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-950/80 border border-amber-500/80 text-amber-300 text-xs font-bold shrink-0"
              title={t('header:ct.warningTitle', { count: totalCTWarnings })}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{t('header:ct.warning', { count: totalCTWarnings })}</span>
            </div>
          )}

          {/* ボタン列の表示・非表示 */}
          <button
            type="button"
            onClick={() => setIsCollapsed(prev => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
              isCollapsed
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 shadow-sm'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
            title={isCollapsed ? t('header:collapse.expandTitle') : t('header:collapse.collapseTitle')}
          >
            <span>{isCollapsed ? t('header:collapse.expand') : t('header:collapse.collapse')}</span>
          </button>

          <LanguageSwitcher />
        </div>

        {/* ボタン列（使い方 → 編成設定 → 編成管理 → DB管理 → gcsim で計算 → gcsim設定文をコピー → アプリの計算に戻す → 記法コピー（と記法の表示）） */}
        {!isCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1.5 border-t border-slate-800/80 animate-fade-in w-full">
            <button
              onClick={onOpenHelpModal}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors shadow-sm shrink-0"
              title={t('header:menu.helpTitle')}
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('header:menu.help')}</span>
            </button>

            <button
              onClick={onOpenPartyModal}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-700 hover:bg-sky-600 text-white border border-sky-500/70 transition-colors shrink-0"
              title={t('header:menu.partyTitle')}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{t('header:menu.party')}</span>
            </button>

            <button
              onClick={onOpenSaveModal}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/40 transition-colors shadow-sm shrink-0"
              title={t('header:menu.saveTitle')}
            >
              <FolderCog className="w-3.5 h-3.5 text-violet-400" />
              <span>{t('header:menu.save')}</span>
            </button>

            <button
              onClick={onOpenDatabaseModal}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/40 transition-colors shadow-sm shrink-0"
              title={t('header:menu.databaseTitle')}
            >
              <Database className="w-3.5 h-3.5 text-violet-400" />
              <span>{t('header:menu.database')}</span>
            </button>

            {onGcsimCompute && (
              <button
                onClick={onGcsimCompute}
                disabled={gcsimComputing}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-60 disabled:cursor-wait text-white border border-sky-500/70 transition-colors"
                title={t('header:menu.gcsimComputeTitle')}
              >
                <Play className="w-3.5 h-3.5" />
                <span>{gcsimComputing ? t('header:menu.gcsimComputing') : t('header:menu.gcsimCompute')}</span>
              </button>
            )}

            <button
              onClick={onCopyGcsimConfig}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors shrink-0"
              title={t('header:menu.copyGcsimConfigTitle')}
            >
              <Copy className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('header:menu.copyGcsimConfig')}</span>
            </button>

            {onResetToAppCalculation && (
              <button
                onClick={onResetToAppCalculation}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors shrink-0"
                title={t('header:menu.resetToAppTitle')}
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('header:menu.resetToApp')}</span>
              </button>
            )}

            <button
              onClick={onCopyNotation}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors shrink-0"
              title={t('header:menu.copyNotationTitle')}
            >
              {copiedNotation ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedNotation ? t('header:menu.copied') : t('header:menu.copyNotation')}</span>
            </button>

            {/* 現在の記法の表示（記法コピーの隣） */}
            {rotationNotation && (
              <div
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-slate-950/90 text-amber-300/90 border border-slate-800 rounded-lg max-w-full overflow-x-auto whitespace-nowrap custom-scrollbar shrink min-w-0"
                title={t('header:notation.title')}
              >
                <span className="text-[10px] text-slate-500 font-sans shrink-0 select-none">{t('header:notation.label')}</span>
                <div className="flex items-center gap-0.5 shrink-0 font-sans">
                  {([['short', t('header:notation.short')], ['name', t('header:notation.name')]] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onChangeNotationMode?.(value)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                        notationMode === value
                          ? 'bg-sky-500 text-slate-950 border-sky-400'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-sky-400'
                      }`}
                      title={value === 'short' ? t('header:notation.shortTitle') : t('header:notation.nameTitle')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="select-all font-semibold tracking-wide">{rotationNotation}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

