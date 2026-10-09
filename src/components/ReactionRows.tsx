import React from 'react';
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
  onSeek: (time: number) => void;
  onTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const KIND_ORDER: ReactionKind[] = ['lunarcharged', 'lunarcrystallize', 'stellarconduct', 'stellarswirl', 'stellarswirl_airborne'];

const KIND_INFO: Record<ReactionKind, { label: string; unit: string; barClass: string; labelClass: string; help: string }> = {
  lunarcharged: {
    label: '🌙 月感電の雲',
    unit: '',
    barClass: 'bg-indigo-950 border-indigo-400/80 text-indigo-200',
    labelClass: 'text-indigo-300',
    help: '月感電を起こすと雲ができ、雲がある間、約 2 秒ごとに敵へ月感電のダメージが出る。反応のたびに 5.5 秒に延びる',
  },
  lunarcrystallize: {
    label: '🌙 月結晶（設置物の数）',
    unit: '個',
    barClass: 'bg-amber-950 border-amber-400/80 text-amber-200',
    labelClass: 'text-amber-300',
    help: '月結晶を起こすと、月の結晶の設置物が最大 3 つできる（9 秒）。数字 = そのときの設置物の数',
  },
  stellarconduct: {
    label: '⭐ 星電導のフィールド',
    unit: 'スタック',
    barClass: 'bg-cyan-950 border-cyan-400/80 text-cyan-200',
    labelClass: 'text-cyan-300',
    help: '星電導を起こすと北辰のフィールドができる（6 秒。反応のたびに延びる）。数字 = 4 秒ごとに更新される、適用中のスタック（最大 12。氷・雷元素ダメージ +）',
  },
  stellarswirl: {
    label: '⭐ 星拡散の渦（スタック）',
    unit: 'スタック',
    barClass: 'bg-teal-950 border-teal-400/80 text-teal-200',
    labelClass: 'text-teal-300',
    help: '星拡散を起こすと渦ができ、起こすたびにスタックが 1 増える（最大 6）。約 3 秒後か、6 スタックで爆発する。数字 = そのときのスタック',
  },
  stellarswirl_airborne: {
    label: '⭐ 星拡散の爆発後',
    unit: '',
    barClass: 'bg-emerald-950 border-emerald-400/80 text-emerald-200',
    labelClass: 'text-emerald-300',
    help: '星拡散の渦が爆発した後の 5 秒間の状態',
  },
};

export const ReactionRows: React.FC<ReactionRowsProps> = ({ rows, pixelsPerSecond, totalDuration, timelineTicks, onSeek, onTimelineClick }) => {
  const ordered = KIND_ORDER.map(k => rows.find(r => r.kind === k)).filter((r): r is ReactionRow => !!r && r.segments.length > 0);
  if (ordered.length === 0) return null;

  return (
    <div className="relative border-b border-slate-800 bg-slate-950/30" data-testid="reaction-rows">
      <div className="flex">
        {/* 左の列（横スクロールしても見えるよう固定） */}
        <div className="w-[180px] shrink-0 border-r border-slate-800 flex flex-col sticky left-0 z-30 bg-slate-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
          <div className="h-6 px-2 flex items-center justify-between text-violet-300 text-[10px] font-bold border-b border-slate-800/60">
            <span>🌀 反応</span>
            <span className="text-[9px] text-slate-500 font-mono font-normal">gcsim の結果</span>
          </div>
          {ordered.map(row => (
            <div
              key={`reaction_label_${row.kind}`}
              className={`h-6 px-2 flex items-center justify-between text-[9px] font-mono border-b border-slate-800/40 ${KIND_INFO[row.kind].labelClass}`}
              title={KIND_INFO[row.kind].help}
            >
              <span className="truncate">{KIND_INFO[row.kind].label}</span>
              {row.max !== undefined && <span className="shrink-0 ml-1 text-slate-500">最大{row.max}</span>}
            </div>
          ))}
        </div>

        {/* 右のバーの列 */}
        <div className="relative flex-1 flex flex-col cursor-pointer" onClick={onTimelineClick}>
          {timelineTicks.map(t => (
            <div
              key={`grid_reaction_${t.absTime}`}
              className={`absolute top-0 bottom-0 border-l pointer-events-none z-0 ${t.isZero ? 'border-purple-400/70' : 'border-slate-800/40'}`}
              style={{ left: `${t.absTime * pixelsPerSecond}px` }}
            />
          ))}
          <div className="h-6 border-b border-slate-800/60" />
          {ordered.map(row => {
            const info = KIND_INFO[row.kind];
            return (
              <div key={`reaction_bar_${row.kind}`} className="h-6 relative flex items-center border-b border-slate-800/20 z-10">
                {row.segments.map((sp, i) => {
                  if (sp.startTime >= totalDuration) return null;
                  const end = Math.min(totalDuration, sp.endTime);
                  const startX = sp.startTime * pixelsPerSecond;
                  const width = Math.max(14, (end - sp.startTime) * pixelsPerSecond);
                  const dur = sp.endTime - sp.startTime;
                  const countText = sp.count !== undefined ? `${sp.count}${info.unit ? info.unit : ''}` : `${dur.toFixed(1)}s`;
                  return (
                    <div
                      key={`${row.kind}_${i}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeek(sp.startTime);
                      }}
                      style={{ left: `${startX}px`, width: `${width}px` }}
                      className={`absolute h-3.5 rounded text-[9px] font-mono flex items-center justify-center px-1 border hover:brightness-125 cursor-pointer ${info.barClass}`}
                      title={`【${info.label.replace(/^\S+\s/, '')}】${sp.count !== undefined ? ` ${sp.count}${info.unit}${row.max !== undefined ? ` / ${row.max}` : ''}` : ''} [${sp.startTime.toFixed(2)}s ~ ${sp.endTime.toFixed(2)}s] (${dur.toFixed(2)}s)\n${info.help}\n※ gcsim を実行した結果（1 周目）。編集すると、実行し直すまで位置のずれが残ることがあります（クリックで開始位置へシーク）`}
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
