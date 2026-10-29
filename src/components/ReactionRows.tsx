import React from 'react';
import { GANTT_LABEL_WIDTH } from '../utils/ganttLayout';
import { t } from '../i18n';
import type { ReactionKind, ReactionRow } from '../types/genshin';

/**
 * 反応（月反応・星反応）の状態の行（D112）。最後の出場キャラの行と、時間指定のない効果の行の間に出す。
 * gcsim を実行した結果から読み取った状態だけを出す（実行する前は何も出さない）。種類ごとに 1 行。
 * スタック数・設置物の数があるものは、数が変わるたびに別のバーにして、数を書く（スキルのストックの行と同じ）。
 */
interface ReactionRowsProps {
  rows: ReactionRow[];
  pixelsPerSecond: number;
  totalDuration: number;
  timelineTicks: { absTime: number; isZero?: boolean }[];
  /** ループの先頭の時刻（2 周目の行の再生位置への変換に使う） */
  loopStartTime: number;
  onSeek: (time: number) => void;
  onTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const KIND_ORDER: ReactionKind[] = ['lunarcharged', 'lunarcrystallize', 'verdantdew', 'moonridgedew', 'stellarconduct', 'stellarswirl', 'stellarswirl_airborne'];

const KIND_INFO: Record<ReactionKind, { label: string; unit: string; barClass: string; labelClass: string; help: string }> = {
  lunarcharged: {
    label: t('chart:reaction.lunarcharged.label'),
    unit: '',
    barClass: 'bg-indigo-950 border-indigo-400/80 text-indigo-200',
    labelClass: 'text-indigo-300',
    help: t('chart:reaction.lunarcharged.help'),
  },
  lunarcrystallize: {
    label: t('chart:reaction.lunarcrystallize.label'),
    unit: t('chart:reaction.unitPieces'),
    barClass: 'bg-amber-950 border-amber-400/80 text-amber-200',
    labelClass: 'text-amber-300',
    help: t('chart:reaction.lunarcrystallize.help'),
  },
  verdantdew: {
    label: t('chart:reaction.verdantdew.label'),
    unit: t('chart:reaction.unitPieces'),
    barClass: 'bg-lime-950 border-lime-400/80 text-lime-200',
    labelClass: 'text-lime-300',
    help: t('chart:reaction.verdantdew.help'),
  },
  moonridgedew: {
    label: t('chart:reaction.moonridgedew.label'),
    unit: t('chart:reaction.unitPieces'),
    barClass: 'bg-sky-950 border-sky-400/80 text-sky-200',
    labelClass: 'text-sky-300',
    help: t('chart:reaction.moonridgedew.help'),
  },
  stellarconduct: {
    label: t('chart:reaction.stellarconduct.label'),
    unit: t('chart:reaction.unitStacks'),
    barClass: 'bg-cyan-950 border-cyan-400/80 text-cyan-200',
    labelClass: 'text-cyan-300',
    help: t('chart:reaction.stellarconduct.help'),
  },
  stellarswirl: {
    label: t('chart:reaction.stellarswirl.label'),
    unit: t('chart:reaction.unitStacks'),
    barClass: 'bg-teal-950 border-teal-400/80 text-teal-200',
    labelClass: 'text-teal-300',
    help: t('chart:reaction.stellarswirl.help'),
  },
  stellarswirl_airborne: {
    label: t('chart:reaction.stellarswirl_airborne.label'),
    unit: '',
    barClass: 'bg-emerald-950 border-emerald-400/80 text-emerald-200',
    labelClass: 'text-emerald-300',
    help: t('chart:reaction.stellarswirl_airborne.help'),
  },
};

export const ReactionRows: React.FC<ReactionRowsProps> = (props) => {
  const { rows } = props;
  const lap1 = rows.filter(r => r.lap === 1);
  const lap2 = rows.filter(r => r.lap === 2);
  if (lap1.length === 0 && lap2.length === 0) return null;
  return (
    <>
      {lap1.length > 0 && <ReactionArea {...props} lap={1} areaRows={lap1} />}
      {lap2.length > 0 && <ReactionArea {...props} lap={2} areaRows={lap2} />}
    </>
  );
};

/** 1 周目・2 周目それぞれの表示エリア（スキルのストックの行と同じ考え方。2 周目は 1 周目の終わりの状態から続く） */
const ReactionArea: React.FC<ReactionRowsProps & { lap: 1 | 2; areaRows: ReactionRow[] }> = ({ areaRows, lap, pixelsPerSecond, totalDuration, timelineTicks, loopStartTime, onSeek, onTimelineClick }) => {
  const ordered = KIND_ORDER.map(k => areaRows.find(r => r.kind === k)).filter((r): r is ReactionRow => !!r && r.segments.length > 0);
  if (ordered.length === 0) return null;
  const seekTo = (t: number) => onSeek(lap === 2 ? totalDuration + (t - loopStartTime) : t);

  return (
    <div className="relative border-b border-slate-800 bg-slate-950/30" data-testid={`reaction-rows-lap${lap}`}>
      <div className="flex">
        {/* 左の列（横スクロールしても見えるよう固定） */}
        <div style={{ width: GANTT_LABEL_WIDTH }} className="shrink-0 border-r border-slate-800 flex flex-col sticky left-0 z-30 bg-slate-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
          <div className="h-6 px-2 flex items-center justify-between text-violet-300 text-[10px] font-bold border-b border-slate-800/60">
            <span>{t('chart:reaction.header', { lap })}</span>
            <span className="text-[9px] text-slate-500 font-mono font-normal">{t('chart:reaction.gcsimResult')}</span>
          </div>
          {ordered.map(row => (
            <div
              key={`reaction_label_${lap}_${row.kind}`}
              className={`h-6 px-2 flex items-center justify-between text-[9px] font-mono border-b border-slate-800/40 ${KIND_INFO[row.kind].labelClass}`}
              title={KIND_INFO[row.kind].help}
            >
              <span className="truncate">{KIND_INFO[row.kind].label}</span>
              {row.max !== undefined && <span className="shrink-0 ml-1 text-slate-500">{t('chart:reaction.max', { max: row.max })}</span>}
            </div>
          ))}
        </div>

        {/* 右のバーの列 */}
        <div className="relative flex-1 flex flex-col cursor-pointer" onClick={onTimelineClick}>
          {timelineTicks.map(t => (
            <div
              key={`grid_reaction_${lap}_${t.absTime}`}
              className={`absolute top-0 bottom-0 border-l pointer-events-none z-0 ${t.isZero ? 'border-purple-400/70' : 'border-slate-800/40'}`}
              style={{ left: `${t.absTime * pixelsPerSecond}px` }}
            />
          ))}
          <div className="h-6 border-b border-slate-800/60" />
          {ordered.map(row => {
            const info = KIND_INFO[row.kind];
            return (
              <div key={`reaction_bar_${lap}_${row.kind}`} className="h-6 relative flex items-center border-b border-slate-800/20 z-10">
                {row.segments.map((sp, i) => {
                  if (sp.startTime >= totalDuration) return null;
                  const end = Math.min(totalDuration, sp.endTime);
                  const startX = sp.startTime * pixelsPerSecond;
                  const width = Math.max(14, (end - sp.startTime) * pixelsPerSecond);
                  const dur = sp.endTime - sp.startTime;
                  const countText = sp.count !== undefined ? `${sp.count}${info.unit ? info.unit : ''}` : `${dur.toFixed(1)}s`;
                  return (
                    <div
                      key={`${lap}_${row.kind}_${i}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        seekTo(sp.startTime);
                      }}
                      style={{ left: `${startX}px`, width: `${width}px` }}
                      className={`absolute h-3.5 rounded text-[9px] font-mono flex items-center justify-center px-1 border hover:brightness-125 cursor-pointer ${info.barClass}`}
                      title={`【${info.label.replace(/^\S+\s/, '')}】${sp.count !== undefined ? ` ${sp.count}${info.unit}${row.max !== undefined ? ` / ${row.max}` : ''}` : ''} [${sp.startTime.toFixed(2)}s ~ ${sp.endTime.toFixed(2)}s] (${dur.toFixed(2)}s)\n${info.help}\n${t('chart:reaction.barNote', { lap })}`}
                    >
                      <span className="truncate">{sp.count !== undefined && width < 60 ? sp.count : countText}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
