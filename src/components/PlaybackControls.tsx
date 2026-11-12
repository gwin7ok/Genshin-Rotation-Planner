import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { t } from '../i18n';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetPlayback: () => void;
  currentTime: number;
  totalDuration: number;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  loopStartTime?: number;
  playbackCycleCount?: number;
  loopPeriod?: number;
}

/** 再生の操作（再生・周回・時間・速度）。ヘッダーの記法コピーの行の左端に出す */
export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onResetPlayback,
  currentTime,
  totalDuration,
  playbackSpeed,
  onChangeSpeed,
  loopStartTime = 0,
  playbackCycleCount = 1,
  loopPeriod = 0,
}) => (
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
);
