import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Clock, 
  ZoomIn, 
  ZoomOut, 
  Shield, 
  Flame, 
  Zap, 
  Info, 
  Layers, 
  Activity, 
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Repeat,
  Check,
  RefreshCw
} from 'lucide-react';
import { CharacterAvatar } from './CharacterAvatar';
import { 
  CharacterConfig, 
  Stint, 
  ActiveBuffSpan, 
  CooldownSpan, StockSpan, 
  CharacterRuntimeState,
  PassiveSpan,
} from '../types/genshin';
import { ELEMENT_COLORS } from '../data/characters';
import { scrollStintCardBelowSticky, focusStintInGantt, GANTT_STICKY_HEADER_ID, GANTT_SCROLL_CONTAINER_ID, ganttStintRowId } from '../utils/scrollToStintCard';
import { actionDisplayName, formatCharacterCooldowns, formatSpanDurations } from '../utils/characterActions';
import { getBuffBadgeConfig } from '../utils/buffUtils';
import { GlobalBuffRow } from './GlobalBuffRow';
import type { GenshinDatabase } from '../types/database';
import type { BuffOverlapSegment } from '../utils/rotationCalculator';

// Organization structure for active buffs into independent non-overlapping rows.
// Distinct buffs (such as Xiangling's E and Q effects) are placed on separate independent rows.
export interface BuffRowInfo {
  tag: string;
  cleanName: string;
  sample: ActiveBuffSpan;
  spans: ActiveBuffSpan[];
  /** 設置物（殺生桜）の行（0 始まり）。あれば、ラベルに ①②③ を付ける */
  lane?: number;
}

export function getBuffClassification(buff: ActiveBuffSpan) {
  const bId = (buff.buffId || '').toLowerCase();
  const name = (buff.name || '').toLowerCase();

  const isSkill = 
    bId.includes('skill') || 
    bId.includes('guoba') || 
    bId.includes('pepper') || 
    bId.includes('ring') || 
    bId.includes('tri_karma') || 
    bId.includes('salon') || 
    bId.includes('paramita') ||
    bId.includes('mirror') ||
    name.includes('スキル') || 
    name.includes('グゥオパァー') || 
    name.includes('唐辛子') || 
    name.includes('e');

  const isBurst = 
    bId.includes('burst') || 
    bId.includes('pyronado') || 
    bId.includes('raincutter') || 
    bId.includes('fanfare') || 
    bId.includes('shrine') || 
    bId.includes('eye_buff') || 
    name.includes('爆発') || 
    name.includes('旋火輪') || 
    name.includes('q');

  if (isSkill) {
    return { rank: 1, tag: '[E]' };
  }
  if (isBurst) {
    return { rank: 2, tag: '[Q]' };
  }
  if (buff.sourceType === 'weapon') {
    return { rank: 4, tag: '[武器]' };
  }
  if (buff.sourceType === 'artifact') {
    return { rank: 5, tag: '[聖遺物]' };
  }
  if (buff.sourceType === 'constellation') {
    return { rank: 3.5, tag: '[凸]' };
  }
  return { rank: 3, tag: '[天賦]' };
}

export function organizeBuffsIntoRows(buffs: ActiveBuffSpan[]): BuffRowInfo[] {
  if (!buffs || buffs.length === 0) return [];

  // Group by buffId / buff type so different buffs (e.g. E vs Q) are on distinct rows
  const byId = new Map<string, ActiveBuffSpan[]>();
  for (const b of buffs) {
    // 行を持つバー（殺生桜）は、行ごとに別の行にする
    const key = (b.buffId || b.name) + (b.lane !== undefined ? `#${b.lane}` : '');
    if (!byId.has(key)) {
      byId.set(key, []);
    }
    byId.get(key)!.push(b);
  }

  const result: BuffRowInfo[] = [];

  // Sort: E (skill) first, Q (burst) second, other talents third, weapon fourth, artifact fifth
  const sortedKeys = Array.from(byId.keys()).sort((keyA, keyB) => {
    const listA = byId.get(keyA)!;
    const listB = byId.get(keyB)!;
    const classA = getBuffClassification(listA[0]);
    const classB = getBuffClassification(listB[0]);
    if (classA.rank !== classB.rank) {
      return classA.rank - classB.rank;
    }
    // 同じバフの行は、行の番号順
    if (listA[0].buffId === listB[0].buffId && listA[0].lane !== undefined && listB[0].lane !== undefined) return listA[0].lane - listB[0].lane;
    const minStartA = Math.min(...listA.map(s => s.startTime));
    const minStartB = Math.min(...listB.map(s => s.startTime));
    return minStartA - minStartB;
  });

  for (const key of sortedKeys) {
    const spans = byId.get(key)!.sort((a, b) => a.startTime - b.startTime);
    const sample = spans.find(s => !s.isCarryOver) || spans[0];
    const classification = getBuffClassification(sample);
    const lane = sample.lane;
    const cleanName = sample.name.replace(/^[^:]+:\s*/, '') + (lane !== undefined ? ' ' + '①②③④⑤⑥'.charAt(lane) : '');

    result.push({
      tag: classification.tag,
      cleanName,
      sample,
      spans,
      ...(lane !== undefined ? { lane } : {}),
    });
  }

  return result;
}

// バフ重複行の色（寒色→暖色）: 0 / 1〜3 / 4〜6 / 7〜9 / 10以上。文字色は背景の明るさに合わせて白か黒
function buffCountStyle(count: number): { backgroundColor: string; color: string } {
  if (count === 0) return { backgroundColor: 'rgba(30, 41, 59, 0.3)', color: '#fff' };
  if (count <= 3) return { backgroundColor: 'rgba(59, 130, 246, 0.45)', color: '#fff' };
  if (count <= 6) return { backgroundColor: 'rgba(16, 185, 129, 0.55)', color: '#fff' };
  if (count <= 9) return { backgroundColor: 'rgb(189, 187, 63)', color: '#000' };
  return { backgroundColor: 'rgb(255, 30, 30)', color: '#fff' };
}

interface GanttChartProps {
  characters: CharacterConfig[];
  stints: Stint[];
  activeBuffs: ActiveBuffSpan[];
  skillCooldowns: CooldownSpan[];
  burstCooldowns: CooldownSpan[];
  characterStates: Record<string, CharacterRuntimeState>;
  totalDuration: number;
  activeTime: number;
  onSeek: (time: number) => void;
  buffOverlapSegments: BuffOverlapSegment[];
  loopedBuffOverlapSegments: BuffOverlapSegment[];
  /** 発動バフ（固有天賦）の効果・CT */
  passiveSpans?: PassiveSpan[];
  onReorderCharacters?: (newChars: CharacterConfig[]) => void;
  onReorderCharactersAndStints?: (newChars: CharacterConfig[], newStints: Stint[]) => void;
  onUpdateStints?: (newStints: Stint[]) => void;
  selectedAction?: { stintId: string; actionId: string } | null;
  onSelectAction?: (stintId: string, actionId: string) => void;
  loopStartTime?: number;
  /** 2周目ループの開始位置（何番目の出場キャラの前か。0=基準なし） */
  loopStartIndex?: number;
  onUpdateLoopStartIndex?: (index: number) => void;
  /** キャラ交代の所要時間（2周目の先頭に入れる交代アクションに使う） */
  switchDelay?: number;
  /** 2周目折り返し（Carry-Over）情報 */
  /** スキルのストック数の区間（回数が 2 以上のスキルを持つキャラ。1 周目・2 周目） */
  stockSpans?: StockSpan[];
  carryOverCooldowns?: CooldownSpan[];
  carryOverBuffs?: ActiveBuffSpan[];
  carryOverPassives?: PassiveSpan[];
  /** 再生開始からの累積時間（周をまたいでも増え続ける） */
  elapsedTime: number;
  /** 全体の行で、武器・聖遺物の発動バフを引くマスターデータ */
  database?: GenshinDatabase;
}

export const GanttChart: React.FC<GanttChartProps> = ({
  database,
  characters,
  stints,
  activeBuffs,
  skillCooldowns,
  burstCooldowns,
  characterStates,
  totalDuration,
  activeTime,
  onSeek,
  buffOverlapSegments,
  loopedBuffOverlapSegments,
  passiveSpans = [],
  stockSpans = [],
  carryOverCooldowns = [],
  carryOverBuffs = [],
  carryOverPassives = [],
  elapsedTime,
  onReorderCharacters,
  onReorderCharactersAndStints,
  onUpdateStints,
  selectedAction,
  onSelectAction,
  loopStartTime = 0,
  loopStartIndex = 0,
  onUpdateLoopStartIndex,
  switchDelay = 0.5,
}) => {
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(55);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [showConnectors, setShowConnectors] = useState<boolean>(true);
  const [highlightBuffId, setHighlightBuffId] = useState<string | null>(null);

  // Loop marker dragging state
  const [isDraggingLoopMarker, setIsDraggingLoopMarker] = useState<boolean>(false);

  // 持ち越しバーは、累積時間が元の発動位置を通過するまでグレー（まだ発動していない）
  const isCarryOverActive = (originalStartTime?: number) =>
    originalStartTime !== undefined && elapsedTime >= originalStartTime;

  // 再生バーが重なっている効果 → 残り秒数（本体と折り返し部分は同じ効果として本体のIDで扱う）
  const runningEffects = new Map<string, number>();
  for (const s of [...activeBuffs.filter(b => b.origin !== 'passive'), ...passiveSpans.filter(p => p.duration > 0)]) {
    if (s.startTime <= activeTime && activeTime < s.endTime) runningEffects.set(s.id, s.endTime - activeTime);
  }
  for (const s of [...carryOverBuffs.filter(b => b.origin !== 'passive'), ...carryOverPassives]) {
    if (s.sourceId && isCarryOverActive(s.originalStartTime) && s.startTime <= activeTime && activeTime < s.endTime) {
      runningEffects.set(s.sourceId, s.endTime - activeTime);
    }
  }
  const effectRemaining = (span: { id: string; sourceId?: string }) => runningEffects.get(span.sourceId ?? span.id);

  // 統合出場トラックの出場ボックスのドラッグ（出場順の入れ替え）
  const [draggingTrackStint, setDraggingTrackStint] = useState<{
    fromIndex: number;
    startClientX: number;
    dx: number;
    moved: boolean;
    /** 挿入先（ドラッグ中のボックスを除いた並びでの位置） */
    targetIndex: number;
    /** 統合出場トラック（時間 0 の位置）の画面上の左端 */
    trackLeft: number;
  } | null>(null);

  // 発動バフ（固有天賦）の発動位置ドラッグ: 出場の先頭からの秒数を、退場後も含めて左右に自由移動
  const [draggingPassive, setDraggingPassive] = useState<{
    stintId: string;
    triggerId: string;
    startClientX: number;
    originOffset: number;
    offset: number;
    /** 出場の開始時刻（発動位置の秒数 = 開始時刻 − これ） */
    stintStart: number;
    /** 掴んだバーが表示されている位置（2周目の発動は折り返した位置） */
    originPos: number;
    /** ドラッグ開始時に再生位置が2周目以降だった（D40-2） */
    lapTwo: boolean;
  } | null>(null);

  // 2周目の発動（開始が周の終端以降）の表示位置: ループ先頭 + (開始 − 総時間)。ループの無い編成は表示しない
  const loopPeriodSec = Math.max(0, totalDuration - loopStartTime);
  const hasLoop = loopPeriodSec > 0.05;
  /** 出場の先頭からの秒数の表示（負のときは出場の前） */
  const fmtOffset = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
  const passiveDrawPos = (start: number) => (start >= totalDuration - 0.001 && hasLoop ? loopStartTime + Math.max(0, start - totalDuration) : start);
  /** 再生位置が2周目以降か */
  const isLapTwoView = hasLoop && elapsedTime >= totalDuration;
  /**
   * ドラッグ中の発動位置（出場の先頭からの秒数）を求める（D40-2）。
   * 再生位置が1周目: 開始時刻 = 掴んだバーの表示位置 + 移動量（ローテの終了より右 = 2周目、範囲は 総時間 + 周期 まで。ループの無い編成は終端まで）
   * 再生位置が2周目: 表示位置 + 移動量をループ先頭〜終端に収め、2周目の位置（総時間 + (位置 − ループ先頭)）にする
   */
  const dragPassiveOffset = (d: { originOffset: number; originPos: number; stintStart: number; lapTwo: boolean }, deltaSec: number) => {
    let start: number;
    if (d.lapTwo) {
      const pos = Math.min(totalDuration, Math.max(loopStartTime, d.originPos + deltaSec));
      start = totalDuration + (pos - loopStartTime);
    } else {
      const max = hasLoop ? totalDuration + loopPeriodSec : totalDuration;
      // 掴んだバーの表示位置 + 移動量 = ドロップした位置（2周目の発動を掴んだときも、ドロップした位置の1周目に置く）
      start = Math.min(max, d.originPos + deltaSec);
    }
    // 出場の前にも置ける（下限は時間 0）。出場の先頭からの秒数は負になりうる
    const raw = Math.max(-d.stintStart, start - d.stintStart);
    // 0.05秒単位。2周目に置いたものは、丸めで周の終端の手前に戻らないよう切り上げる
    return d.lapTwo ? Math.ceil(raw * 20 - 1e-6) / 20 : Math.round(raw * 20) / 20;
  };

  // Drag and Drop state for timeline action reordering directly on the Gantt Chart
  const [draggedAction, setDraggedAction] = useState<{
    stintId: string;
    actionIndex: number;
    actionId: string;
  } | null>(null);
  const [dragOverAction, setDragOverAction] = useState<{
    stintId: string;
    actionIndex: number;
  } | null>(null);

  const cleanStintsForState = (rawStints: Stint[]): Stint[] => {
    return rawStints.map(({ modeHold, ...s }) => ({
      ...s,
      actions: s.actions
        .filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char')
        .map(a => {
          const { hasCTCollision, collisionRemainingCT, specialWindowWarning, usedSpecialCharge, holdSeconds, modeHoldSeconds, startTime, endTime, ...rest } = a;
          return rest;
        })
    }));
  };

  const handleReorderActionsInStint = (stintId: string, fromIndex: number, toIndex: number) => {
    if (!onUpdateStints || fromIndex === toIndex) return;
    const newStints = stints.map(s => {
      if (s.id !== stintId) return s;
      const cleanActions = s.actions.map(a => {
        const { hasCTCollision, collisionRemainingCT, specialWindowWarning, usedSpecialCharge, holdSeconds, modeHoldSeconds, startTime, endTime, ...rest } = a;
        return rest;
      });
      const [moved] = cleanActions.splice(fromIndex, 1);
      cleanActions.splice(toIndex, 0, moved);
      return { ...s, actions: cleanActions };
    });
    onUpdateStints(cleanStintsForState(newStints));
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleContainerScroll = () => {
    if (isSyncingScroll.current) return;
    if (containerRef.current && headerScrollRef.current) {
      isSyncingScroll.current = true;
      headerScrollRef.current.scrollLeft = containerRef.current.scrollLeft;
      setScrollLeft(containerRef.current.scrollLeft);
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const handleHeaderScroll = () => {
    if (isSyncingScroll.current) return;
    if (containerRef.current && headerScrollRef.current) {
      isSyncingScroll.current = true;
      containerRef.current.scrollLeft = headerScrollRef.current.scrollLeft;
      setScrollLeft(headerScrollRef.current.scrollLeft);
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const characterMap = new Map<string, CharacterConfig>();
  characters.forEach(c => characterMap.set(c.id, c));

  // アクション ID → そのアクションがある出場ブロックの ID（持ち越しバーを、発動した出場ブロックの行に出すため）
  const homeStintIdOfAction = new Map<string, string>();
  stints.forEach(s => s.actions.forEach(a => homeStintIdOfAction.set(a.id, s.id)));

  // ループ基準を置ける位置（出場キャラの境目）。index は「何番目の出場キャラの前か」（0=先頭・基準なし）
  const loopBoundaries = useMemo(() => {
    const list: { index: number; time: number; label: string }[] = [
      { index: 0, time: 0, label: '先頭（基準なし・全周同一）' },
    ];
    stints.forEach((stint, sIdx) => {
      if (sIdx === 0) return;
      const prevName = characterMap.get(stints[sIdx - 1].characterId)?.name || '';
      const name = characterMap.get(stint.characterId)?.name || '';
      list.push({
        index: sIdx,
        time: stint.startTime ?? 0,
        label: `${sIdx + 1}番目の出場（${prevName} と ${name} の間）`,
      });
    });
    return list;
  }, [stints, characterMap]);

  // 全体のCT違反（スキル・爆発）の合計数。発動バフのCT中の発動は「CT警告」（黄色）で、含めない
  const totalCTCollisions = useMemo(() => {
    let count = 0;
    stints.forEach(s => {
      count += s.actions.filter(a => a.hasCTCollision).length;
    });
    return count;
  }, [stints]);

  // Total timeline duration (single cycle width [0, totalDuration])
  const chartWidth = Math.max(800, Math.ceil(totalDuration + 2) * pixelsPerSecond);

  // Combined Buff Synergy Points (calculated with 3-D carryover deduplication in rotationCalculator)

  // Handle timeline scrubber click or drag
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft - 180; // 180px is character header width
    if (clickX >= 0) {
      const time = Math.min(totalDuration, Math.max(0, clickX / pixelsPerSecond));
      onSeek(Number(time.toFixed(2)));
    }
  };

  // アクション要素以外をドラッグすると上下左右にスクロール（横: チャート / 縦: ページ）。
  // 5px 未満の移動はクリック扱いのまま（再生位置の移動）、それ以上動いたら直後のクリックを打ち消す
  const PAN_THRESHOLD_PX = 5;
  const handlePanMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !containerRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, label, [draggable="true"], [data-no-pan]')) return;

    const container = containerRef.current;
    const start = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollY: window.scrollY,
    };
    let panning = false;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!panning) {
        if (Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return;
        panning = true;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
      ev.preventDefault();
      container.scrollLeft = start.scrollLeft - dx;
      window.scrollTo(window.scrollX, start.scrollY - dy);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!panning) return;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // ドラッグ終了時に発生するクリック（再生位置の移動）を1回だけ打ち消す
      const suppressClick = (ce: MouseEvent) => {
        ce.stopPropagation();
        ce.preventDefault();
      };
      window.addEventListener('click', suppressClick, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', suppressClick, { capture: true }), 0);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft - 180;
    if (clickX >= 0) {
      setHoveredTime(Number((clickX / pixelsPerSecond).toFixed(2)));
    } else {
      setHoveredTime(null);
    }
  };

  // Format relative time helper considering loopStartTime as 0s (negative for 1st-cycle setup)
  const fmtTime = (absTime: number, precision: number = 1, showPlus: boolean = true): string => {
    if (!loopStartTime || loopStartTime <= 0) {
      return `${absTime.toFixed(precision)}s`;
    }
    const rel = absTime - loopStartTime;
    if (Math.abs(rel) < 0.001) return `0${precision > 0 ? '.' + '0'.repeat(precision) : ''}s`;
    if (rel < 0) return `-${Math.abs(rel).toFixed(precision)}s`;
    return `${showPlus ? '+' : ''}${rel.toFixed(precision)}s`;
  };

  const fmtRange = (start: number, end: number, precision: number = 1): string => {
    return `${fmtTime(start, precision)} ~ ${fmtTime(end, precision)}`;
  };

  // Generate ticks spanning timeline
  const timelineTicks = useMemo(() => {
    const list: { absTime: number; relTime: number; label: string; isZero: boolean; isNegative: boolean; isCycle2?: boolean }[] = [];
    const c1End = totalDuration;

    if (!loopStartTime || loopStartTime <= 0) {
      const maxSeconds = Math.floor(c1End);
      for (let s = 0; s <= maxSeconds; s++) {
        list.push({
          absTime: s,
          relTime: s,
          label: `${s}s`,
          isZero: s === 0,
          isNegative: false,
          isCycle2: false,
        });
      }
    } else {
      const minRel = -Math.ceil(loopStartTime);
      const maxRel = Math.ceil(c1End - loopStartTime + 1);

      // If loopStartTime is non-integer, add the absolute 0 point (rotation start)
      if (Math.abs(loopStartTime - Math.round(loopStartTime)) > 0.05) {
        list.push({
          absTime: 0,
          relTime: -loopStartTime,
          label: `-${loopStartTime.toFixed(1)}s`,
          isZero: false,
          isNegative: true,
          isCycle2: false,
        });
      }

      for (let r = minRel; r <= maxRel; r++) {
        const absTime = Number((loopStartTime + r).toFixed(3));
        if (absTime >= -0.001 && absTime <= c1End) {
          list.push({
            absTime: Math.max(0, absTime),
            relTime: r,
            label: r === 0 ? '0s' : r < 0 ? `${r}s` : `+${r}s`,
            isZero: r === 0,
            isNegative: r < 0,
            isCycle2: false,
          });
        }
      }
    }

    list.sort((a, b) => a.absTime - b.absTime);
    return list.filter((item, idx, arr) => idx === 0 || Math.abs(item.absTime - arr[idx - 1].absTime) > 0.1);
  }, [loopStartTime, totalDuration]);

  // 指定秒数に一番近い出場キャラの境目（ループ基準番号）
  const findClosestLoopBoundaryIndex = (rawTime: number) => {
    let closest = loopBoundaries[0];
    let minDiff = Math.abs(rawTime - closest.time);
    for (const b of loopBoundaries) {
      const diff = Math.abs(rawTime - b.time);
      if (diff < minDiff) {
        minDiff = diff;
        closest = b;
      }
    }
    return closest.index;
  };

  // Window-level mouseup/mousemove listeners for dragging the loop marker smoothly
  useEffect(() => {
    if (!isDraggingLoopMarker) return;

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left + containerRef.current.scrollLeft - 180;
      if (clickX >= 0) {
        const rawTime = Math.min(totalDuration, Math.max(0, clickX / pixelsPerSecond));
        onUpdateLoopStartIndex?.(findClosestLoopBoundaryIndex(rawTime));
      } else {
        onUpdateLoopStartIndex?.(0);
      }
    };

    const onWindowMouseUp = () => {
      setIsDraggingLoopMarker(false);
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [isDraggingLoopMarker, totalDuration, pixelsPerSecond, onUpdateLoopStartIndex, loopBoundaries]);

  useEffect(() => {
    if (!draggingPassive) return;
    const onMove = (e: MouseEvent) => {
      const delta = (e.clientX - draggingPassive.startClientX) / pixelsPerSecond;
      const offset = dragPassiveOffset(draggingPassive, delta);
      setDraggingPassive(prev => (prev && prev.offset !== offset ? { ...prev, offset } : prev));
    };
    const onUp = () => {
      const d = draggingPassive;
      setDraggingPassive(null);
      document.body.style.cursor = '';
      if (!onUpdateStints || Math.abs(d.offset - d.originOffset) < 0.001) return;
      onUpdateStints(stints.map(st => st.id !== d.stintId ? st : {
        ...st,
        passiveTriggers: (st.passiveTriggers ?? []).map(t => (t.id === d.triggerId ? { ...t, offset: d.offset } : t)),
      }));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingPassive, pixelsPerSecond, stints, onUpdateStints, totalDuration, loopStartTime]);

  useEffect(() => {
    if (!draggingTrackStint) return;
    const DRAG_THRESHOLD_PX = 5;
    const onMove = (e: MouseEvent) => {
      setDraggingTrackStint(prev => {
        if (!prev) return prev;
        const dx = e.clientX - prev.startClientX;
        const moved = prev.moved || Math.abs(dx) >= DRAG_THRESHOLD_PX;
        // ポインター位置の時刻より中点が左にある出場の数 = 挿入先
        const pointerTime = (e.clientX - prev.trackLeft) / pixelsPerSecond;
        const others = stints.filter((_, i) => i !== prev.fromIndex);
        const targetIndex = others.filter(st => ((st.startTime ?? 0) + (st.endTime ?? 0)) / 2 < pointerTime).length;
        return { ...prev, dx, moved, targetIndex };
      });
    };
    const onUp = () => {
      const d = draggingTrackStint;
      setDraggingTrackStint(null);
      document.body.style.cursor = '';
      if (!d.moved) return; // クリック扱い（行へスクロール）
      // ドラッグ後のクリック（行へスクロール・再生位置の移動）を1回だけ打ち消す
      const suppressClick = (ce: MouseEvent) => { ce.stopPropagation(); ce.preventDefault(); };
      window.addEventListener('click', suppressClick, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', suppressClick, { capture: true }), 0);
      if (!onUpdateStints || d.targetIndex === d.fromIndex) return;
      const next = [...stints];
      const [moved] = next.splice(d.fromIndex, 1);
      next.splice(d.targetIndex, 0, moved);
      onUpdateStints(cleanStintsForState(next));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingTrackStint, pixelsPerSecond, stints, onUpdateStints]);

  // Pre-calculate connector points between consecutive stints for vertical snap visualization (1st cycle + 2nd cycle)
  // Stint i ends at t_end, Stint i+1 starts at t_end!
  const handoffConnectors = useMemo(() => {
    // 1. 1st Cycle Connectors
    const c1List = stints.slice(0, stints.length - 1).map((stint, idx) => {
      const nextStint = stints[idx + 1];
      const fromCharIdx = characters.findIndex(c => c.id === stint.characterId);
      const toCharIdx = characters.findIndex(c => c.id === nextStint.characterId);
      const snapTime = stint.endTime ?? 0;
      return {
        id: `c1_conn_${idx}`,
        snapTime,
        relTime: snapTime,
        displayLabel: `${snapTime.toFixed(1)}s`,
        fromCharIdx,
        toCharIdx,
        fromCharId: stint.characterId,
        toCharId: nextStint.characterId,
        xPos: snapTime * pixelsPerSecond,
        isCycle2: false,
      };
    });

    return c1List;
  }, [stints, characters, pixelsPerSecond]);

  // Playhead color state aligned with playback tool in Header
  const isPlayheadNegative = loopStartTime > 0 && (activeTime - loopStartTime) < -0.05;
  const isPlayheadLoop = (loopStartTime > 0 && !isPlayheadNegative) || activeTime >= totalDuration;

  return (
    <section className="bg-slate-950 p-3 sm:p-4 border-b border-slate-800 w-full max-w-full overflow-x-clip">
      <div className="w-full">
        {/* =========================================================================
            STICKY TOP HEADER PANEL (Gantt Title & Toolbar + Time Ruler + Loop + Unified + Synergy)
            Sticks directly below <Header> at var(--header-height) during page scroll
        ========================================================================= */}
        <div 
          id={GANTT_STICKY_HEADER_ID}
          className="sticky z-30 rounded-t-xl border border-slate-800 bg-slate-950 shadow-2xl w-full mb-0 overflow-x-clip"
          style={{ top: 'var(--header-height, 56px)' }}
        >
          {/* A. Gantt Title Bar & Toolbar Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 sm:px-3 sm:py-2 border-b border-slate-800 bg-slate-900/95">
            {/* Title & Duration */}
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                ローテーション ガントチャート
              </h2>
              <span className="text-[11px] text-slate-400 font-mono shrink-0">
                総時間: <strong className="text-amber-300 font-bold">{totalDuration.toFixed(1)}s</strong>
              </span>
              <span className="text-[11px] text-slate-600 font-mono hidden sm:inline shrink-0">|</span>
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline shrink-0">
                再生位置: <strong className="text-cyan-300 font-bold">{activeTime.toFixed(1)}s</strong>
              </span>
            </div>

            {/* Header Controls (snap lines, loop reset, zoom) */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Toggle vertical handoff snap guides */}
              <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer select-none bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                <input
                  type="checkbox"
                  checked={showConnectors}
                  onChange={(e) => setShowConnectors(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0 focus:ring-offset-0 bg-slate-800 border-slate-700 w-3 h-3"
                />
                <span>交代垂直スナップ線 (端点一致)</span>
              </label>

              {/* Loop Boundary Marker Info / Reset */}
              <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-purple-500/40 text-[11px]">
                <Repeat className="w-3 h-3 text-purple-400" />
                <span className="text-purple-300 font-semibold">ループ基準点:</span>
                <span className="font-mono text-purple-200 font-bold">
                  {loopStartIndex === 0 ? '先頭 (全周同一)' : `${loopStartIndex + 1}番目の前 (${loopStartTime.toFixed(2)}s)`}
                </span>
                {loopStartIndex > 0 && onUpdateLoopStartIndex && (
                  <button
                    type="button"
                    onClick={() => onUpdateLoopStartIndex(0)}
                    className="ml-1 text-[9px] text-slate-400 hover:text-white underline decoration-slate-600"
                    title="0s (先頭) にリセット"
                  >
                    リセット
                  </button>
                )}
              </div>

              {/* Zoom Slider */}
              <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                <ZoomOut 
                  className="w-3 h-3 text-slate-400 cursor-pointer hover:text-white" 
                  onClick={() => setPixelsPerSecond(prev => Math.max(30, prev - 10))}
                />
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={pixelsPerSecond}
                  onChange={(e) => setPixelsPerSecond(Number(e.target.value))}
                  className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <ZoomIn 
                  className="w-3 h-3 text-slate-400 cursor-pointer hover:text-white" 
                  onClick={() => setPixelsPerSecond(prev => Math.min(100, prev + 10))}
                />
                <span className="text-slate-400 font-mono text-[10px] min-w-[28px]">{pixelsPerSecond}px/s</span>
              </div>
            </div>
          </div>

          {/* B. Scrollable 4 Header Tracks (Time Ruler, Loop, Unified, Buff Synergy) */}
          <div 
            ref={headerScrollRef}
            onScroll={handleHeaderScroll}
            className="overflow-x-auto w-full relative border-b border-slate-800 no-scrollbar bg-slate-950"
          >
            <div style={{ width: chartWidth + 180, minWidth: '100%' }} className="relative select-none">
              
              {/* Vertical Handoff Connector Lines through Header Tracks (Behind tracks) */}
              {showConnectors && handoffConnectors.map((conn) => (
                <div
                  key={`handoff_header_line_${conn.id}`}
                  style={{ left: `${conn.xPos + 180}px` }}
                  className="absolute top-4 bottom-0 w-0 border-l border-amber-400/60 border-dashed pointer-events-none z-0"
                />
              ))}

              {/* Vertical Loop Boundary Guide Lines through Header Tracks */}
              {loopStartTime > 0 && (
                <div
                  style={{ left: `${loopStartTime * pixelsPerSecond + 180}px` }}
                  className="absolute top-7 bottom-0 w-0 border-l-2 border-purple-400/80 border-dotted pointer-events-none z-0"
                />
              )}

              {/* Playhead Vertical Line in Fixed Header: begins directly from bottom tip of ▼ (top-[43px]) down through header tracks to bottom edge */}
              <div
                style={{ left: `${activeTime * pixelsPerSecond + 180}px` }}
                className={`absolute top-[43px] bottom-0 w-0.5 pointer-events-none z-10 shadow-md ${
                  isPlayheadLoop
                    ? 'bg-gradient-to-b from-purple-400 via-fuchsia-300 to-purple-500 shadow-purple-500/50'
                    : 'bg-gradient-to-b from-amber-400 via-yellow-300 to-amber-500 shadow-amber-400/50'
                }`}
              />

              {/* 1. Loop Boundary Separator Track (ループ基準点) */}
              <div className="flex border-b border-purple-900/60 bg-slate-950 items-center h-7 group select-none">
                <div className="w-[180px] shrink-0 px-3 border-r border-slate-800 flex items-center justify-between text-[11px] font-bold text-purple-300 sticky left-0 z-30 bg-slate-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] h-full">
                  <span className="flex items-center gap-1.5 truncate">
                    <Repeat className="w-3 h-3 text-purple-400 shrink-0" />
                    <span className="truncate">ループ基準点 (0s)</span>
                  </span>
                  <span className="text-[9px] text-purple-400/80 font-mono shrink-0">
                    {loopStartIndex === 0 ? '全周同一' : `${loopStartIndex + 1}番目の前`}
                  </span>
                </div>

                <div 
                  className="relative flex-1 h-full flex items-center bg-slate-950/80"
                  onClick={(e) => {
                    if (!containerRef.current) return;
                    const rect = containerRef.current.getBoundingClientRect();
                    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft - 180;
                    if (clickX >= 0) {
                      const rawTime = Math.min(totalDuration, Math.max(0, clickX / pixelsPerSecond));
                      onUpdateLoopStartIndex?.(findClosestLoopBoundaryIndex(rawTime));
                    }
                  }}
                >
                  {/* 1st Cycle only (1周目のみ) shaded range */}
                  {loopStartTime > 0 && (
                    <div
                      style={{ left: 0, width: `${loopStartTime * pixelsPerSecond}px` }}
                      className="absolute inset-y-0.5 bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-purple-500/20 border-r border-dashed border-purple-400/60 flex items-center px-2 pr-16 pointer-events-none"
                    >
                      <span className="text-[10px] font-bold text-amber-300/90 truncate">
                        ◀ 1周目初動 (-{loopStartTime.toFixed(1)}s ~ 0.0s)
                      </span>
                    </div>
                  )}

                  {/* 1st Cycle Loop (1周目定常ループ) shaded range */}
                  <div
                    style={{ 
                      left: `${loopStartTime * pixelsPerSecond}px`, 
                      width: `${Math.max(0, (totalDuration - loopStartTime) * pixelsPerSecond)}px` 
                    }}
                    className={`absolute inset-y-0.5 bg-gradient-to-r from-purple-500/15 to-indigo-500/10 flex items-center px-2 pointer-events-none ${
                      loopStartTime > 0 ? 'pl-20' : 'pl-2'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-purple-200 truncate">
                      🔁 1周目ループ (0.0s ~ +{(totalDuration - loopStartTime).toFixed(1)}s) ▶
                    </span>
                  </div>

                  {/* Snapping tick dots for each action boundary */}
                  {loopBoundaries.map((b, idx) => {
                    const bX = b.time * pixelsPerSecond;
                    const isCurrent = b.index === loopStartIndex;
                    return (
                      <button
                        key={`b_snap_${idx}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateLoopStartIndex?.(b.index);
                        }}
                        style={{ left: `${bX}px` }}
                        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform z-10 ${
                          isCurrent 
                            ? 'w-3 h-3 bg-purple-400 ring-2 ring-purple-300 shadow scale-110' 
                            : 'w-1.5 h-1.5 bg-purple-600/60 hover:scale-150 hover:bg-purple-300'
                        }`}
                        title={`【ループ基準に設定】\n${b.label} (${fmtTime(b.time, 2)})`}
                      />
                    );
                  })}

                  {/* Draggable Loop Boundary Marker Pin (1周目ループ区切) */}
                  <div
                    style={{ left: `${loopStartTime * pixelsPerSecond}px` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsDraggingLoopMarker(true);
                    }}
                    className={`absolute top-0 bottom-0 -translate-x-1/2 z-10 flex flex-col items-center cursor-ew-resize group/marker ${
                      isDraggingLoopMarker ? 'scale-105' : ''
                    }`}
                    title="【ドラッグで移動】1周目初動と定常ループの区切りマーク（0.0s基準点）"
                  >
                    {/* Pin Handle Badge */}
                    <div className="flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-full shadow-lg border border-purple-300 ring-1 ring-purple-400/50 cursor-grab active:cursor-grabbing transition-transform">
                      <Repeat className="w-2.5 h-2.5" />
                      <span>0.00s 基準 ({loopStartTime.toFixed(2)}s)</span>
                    </div>
                    {/* Pin stem */}
                    <div className="w-0.5 flex-1 bg-purple-400 shadow" />
                  </div>
                </div>
              </div>

              {/* 2. Top Time Ruler（経過時間の目盛り） */}
              <div className="flex border-b border-slate-800 bg-slate-900 h-6">
                {/* Left Column Label (Corner: Sticky Left) */}
                <div className="w-[180px] shrink-0 px-3 flex items-center justify-between border-r border-slate-800 bg-slate-950 text-[10px] leading-none font-bold text-slate-400 tracking-wider sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] h-full">
                  <span>経過時間</span>
                  <Clock className="w-3 h-3 text-slate-500" />
                </div>

                {/* Time Ruler Ticks */}
                <div 
                  className="relative flex-1 cursor-pointer h-full bg-slate-900"
                  onClick={handleTimelineClick}
                >
                  {timelineTicks.map(t => (
                    <div
                      key={`tick_${t.absTime}`}
                      className={`absolute top-0 bottom-0 border-l flex items-center pl-1 ${
                        t.isZero
                          ? 'border-purple-400 z-10'
                          : 'border-slate-800/40'
                      }`}
                      style={{ left: `${t.absTime * pixelsPerSecond}px` }}
                    >
                      <span className={`text-[10px] leading-none font-mono font-bold ${
                        t.isZero
                          ? 'text-purple-300'
                          : t.isCycle2
                          ? 'text-purple-300/90'
                          : 'text-slate-400'
                      }`}>
                        {t.label}
                      </span>
                    </div>
                  ))}

                  {/* Sub-second ticks (0.5s) */}
                  {timelineTicks.map(t => (
                    <div
                      key={`sub_${t.absTime}`}
                      className="absolute bottom-0 h-1 border-l border-slate-800/40"
                      style={{ left: `${(t.absTime + 0.5) * pixelsPerSecond}px` }}
                    />
                  ))}

                  {/* Orange Handoff Connector Badges (交代秒数: 1周目は絶対秒数 / 2周目は2周目開始0s基準) */}
                  {showConnectors && handoffConnectors.map((conn) => (
                    <div
                      key={`handoff_ruler_badge_${conn.id}`}
                      style={{ left: `${conn.snapTime * pixelsPerSecond}px` }}
                      className="absolute top-0 bottom-0 flex items-center z-20 pointer-events-none -translate-x-1/2"
                      title={
                        conn.isCycle2
                          ? `【2周目 交代垂直スナップ】\n2周目開始より: +${conn.relTime.toFixed(2)}s (通算 ${conn.snapTime.toFixed(2)}s)`
                          : `【1周目 交代垂直スナップ】\n交代時刻: ${conn.snapTime.toFixed(2)}s`
                      }
                    >
                      <span className="bg-amber-500 text-slate-950 text-[9px] leading-none font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                        {conn.displayLabel}
                      </span>
                    </div>
                  ))}

                  {/* Playhead Indicator in 経過時間 Row (▼ Marker at top, time badge side-by-side) - z-10 behind sticky left col */}
                  <div
                    style={{ left: `${activeTime * pixelsPerSecond}px` }}
                    className="absolute top-0 bottom-0 flex items-center pointer-events-none z-10"
                  >
                    <div className="relative flex items-center">
                      {/* ▼ Marker at top */}
                      <div className="-translate-x-1/2 flex items-center relative">
                        <svg 
                          className={`w-2.5 h-2.5 shrink-0 drop-shadow relative z-10 ${
                            isPlayheadLoop ? 'text-purple-400 fill-purple-400' : 'text-amber-400 fill-amber-400'
                          }`} 
                          viewBox="0 0 10 10"
                        >
                          <polygon points="1,2 9,2 5,8" />
                        </svg>
                      </div>
                      <span className={`ml-0.5 text-[9px] font-mono font-black leading-none px-1.5 py-0.5 rounded shadow-md whitespace-nowrap border ${
                        isPlayheadLoop
                          ? 'bg-purple-600 text-white border-purple-400/80 shadow-purple-900/50'
                          : 'bg-amber-500 text-slate-950 border-amber-300 shadow-amber-900/50'
                      }`}>
                        {fmtTime(activeTime, 1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Unified Master On-Field Ribbon */}
              <div className="flex border-b border-slate-800 bg-slate-950 items-center h-10 group relative">
                <div className="w-[180px] shrink-0 px-3 border-r border-slate-800 flex items-center justify-between text-xs font-bold text-amber-300 sticky left-0 z-30 bg-slate-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] h-full">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    <span>統合出場トラック</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono font-normal">全周連結</span>
                </div>

                <div 
                  className="relative flex-1 h-full flex items-center cursor-pointer bg-slate-950"
                  onClick={handleTimelineClick}
                >
                  {/* 1st Cycle Stints（ドラッグで出場順を入れ替え / クリックでその行へスクロール） */}
                  {stints.map((stint, stintIdx) => {
                    const char = characterMap.get(stint.characterId);
                    if (!char) return null;
                    const startX = (stint.startTime ?? 0) * pixelsPerSecond;
                    const width = (stint.duration ?? 0) * pixelsPerSecond;
                    const isCurrent = (stint.startTime ?? 0) <= activeTime && activeTime < (stint.endTime ?? 0);
                    const isDraggingThis = draggingTrackStint?.moved && draggingTrackStint.fromIndex === stintIdx;

                    return (
                      <div
                        key={stint.id}
                        onMouseDown={(e) => {
                          if (e.button !== 0 || !onUpdateStints) return;
                          e.preventDefault();
                          const trackLeft = (e.currentTarget.parentElement?.getBoundingClientRect().left ?? 0);
                          setDraggingTrackStint({
                            fromIndex: stintIdx,
                            startClientX: e.clientX,
                            dx: 0,
                            moved: false,
                            targetIndex: stintIdx,
                            trackLeft,
                          });
                        }}
                        onClick={() => focusStintInGantt(stint, onSelectAction)}
                        style={{
                          left: `${startX}px`,
                          width: `${width}px`,
                          ...(isDraggingThis ? { transform: `translateX(${draggingTrackStint!.dx}px)`, zIndex: 30 } : {}),
                        }}
                        className={`absolute h-7 rounded-md flex items-center px-1.5 overflow-hidden text-xs border cursor-grab ${
                          isDraggingThis ? 'opacity-70 ring-2 ring-amber-300 shadow-xl cursor-grabbing' : 'transition-all'
                        } ${
                          isCurrent
                            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-md font-bold'
                            : 'border-slate-700/80 hover:border-slate-500'
                        }`}
                        title={`${char.name} 出場: ${(stint.startTime ?? 0).toFixed(2)}s ~ ${(stint.endTime ?? 0).toFixed(2)}s (${(stint.duration ?? 0).toFixed(2)}s)\nドラッグで出場順を入れ替え / クリックでこの行へ移動`}
                      >
                        <div 
                          className="absolute inset-0 opacity-40"
                          style={{ backgroundColor: char.color }}
                        />
                        <div className="relative z-10 flex items-center gap-1 truncate text-white">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: char.accentColor }} />
                          <span className="font-semibold text-[11px] truncate">{char.name}</span>
                          <span className="text-[10px] opacity-75 font-mono">({(stint.duration ?? 0).toFixed(1)}s)</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* 出場順ドラッグ中の挿入位置 */}
                  {draggingTrackStint?.moved && (() => {
                    const others = stints.filter((_, i) => i !== draggingTrackStint.fromIndex);
                    const t = draggingTrackStint.targetIndex === 0
                      ? 0
                      : (others[draggingTrackStint.targetIndex - 1]?.endTime ?? 0);
                    return (
                      <div
                        className="absolute top-0 bottom-0 w-1 -translate-x-1/2 bg-amber-300 rounded shadow-[0_0_8px_rgba(252,211,77,0.9)] z-40 pointer-events-none"
                        style={{ left: `${t * pixelsPerSecond}px` }}
                      />
                    );
                  })()}
                </div>
              </div>

              {/* 2.5 Party Buff Synergy & DPS Heatmap Lane */}
              <div className="flex border-b border-slate-800 bg-slate-950 items-center h-8 group relative">
                <div className="w-[180px] shrink-0 px-3 border-r border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-400 sticky left-0 z-30 bg-slate-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] h-full">
                  <span className="flex items-center gap-1.5 truncate">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">バフ重複 (Synergy)</span>
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono shrink-0">火力集中</span>
                </div>

                <div 
                  className="relative flex-1 h-full flex items-center cursor-pointer bg-slate-950/90"
                  onClick={handleTimelineClick}
                >
                  {(() => {
                    const segments = elapsedTime >= totalDuration ? loopedBuffOverlapSegments : buffOverlapSegments;
                    if (segments.length === 0) return null;
                    // 帯は1つの要素のグラデーションで塗り、区切りごとに1px透明にして背景を区切り線として見せる
                    // （区間ごとに箱を並べると、画面の拡大率によって区切りの見え方が不揃いになるため）
                    const GAP_PX = 1;
                    const band = segments
                      .map((pt, i) => {
                        const color = buffCountStyle(pt.count).backgroundColor;
                        const start = pt.start * pixelsPerSecond;
                        const end = pt.end * pixelsPerSecond;
                        const fillEnd = i < segments.length - 1 ? end - GAP_PX : end;
                        return `${color} ${start}px ${fillEnd}px, transparent ${fillEnd}px ${end}px`;
                      })
                      .join(', ');
                    return (
                      <>
                        {/* 上下の縁取りは全区間共通（色の明るさの違いで輪郭の位置がずれて見えないように） */}
                        <div
                          className="absolute top-1 bottom-1 left-0 border-y border-slate-400/50"
                          style={{
                            width: `${segments[segments.length - 1].end * pixelsPerSecond}px`,
                            background: `linear-gradient(to right, ${band})`,
                            backgroundClip: 'padding-box',
                          }}
                        />
                        {segments.map(pt => {
                          const w = (pt.end - pt.start) * pixelsPerSecond;
                          return (
                            <div
                              key={pt.start}
                              style={{ left: `${pt.start * pixelsPerSecond}px`, width: `${w}px`, color: buffCountStyle(pt.count).color }}
                              className="absolute top-1 bottom-1 flex items-center justify-center text-[10px] font-mono select-none"
                              title={`${pt.start.toFixed(2)}s ~ ${pt.end.toFixed(2)}s: 有効バフ ${pt.count}個 [${pt.activeBuffs.join(', ')}]`}
                            >
                              {pt.count > 0 && w >= 10 && <span className="font-bold text-[9px]">{pt.count}</span>}
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* =========================================================================
            MAIN CHARACTER SWIMLANES CANVAS (ガントチャート部分)
            Rendered behind sticky header (z-10 vs sticky header z-30) so when scrolling down,
            the Gantt chart long bar goes behind the header instead of piercing through.
        ========================================================================= */}
        <div 
          ref={containerRef}
          id={GANTT_SCROLL_CONTAINER_ID}
          onScroll={handleContainerScroll}
          onMouseDown={handlePanMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredTime(null)}
          className="relative z-10 overflow-x-auto rounded-b-xl border border-slate-800 bg-slate-900/60 shadow-2xl custom-scrollbar w-full border-t-0"
        >
          <div style={{ width: chartWidth + 180, minWidth: '100%' }} className="relative select-none pt-3 pb-4">

            {/* =========================================================================
                3. Swimlanes: Stint-by-Stint (登場回ごと)
            ========================================================================= */}
            <div className="divide-y divide-slate-800/80">
              {/* 登場回（出場キャラ）ごとに1行ずつ表示 */}
              {stints.map((stint, stintIdx) => {
                  const char = characterMap.get(stint.characterId) || characters[0];
                  const isStintCurrentlyOnField = (stint.startTime ?? 0) <= activeTime && activeTime < (stint.endTime ?? 0);

                  // Calculate occurrence index for this character (e.g., 1st or 2nd appearance)
                  const sameCharStints = stints.filter(s => s.characterId === char.id);
                  const occurrenceNum = sameCharStints.findIndex(s => s.id === stint.id) + 1;
                  const totalOccurrences = sameCharStints.length;
                  const isFirstOccurrence = occurrenceNum === 1;

                  // 2周目への持ち越し（折り返し）バー: そのCT・効果を発動したアクションの出場ブロックの行に出す。
                  // 発動元の出場ブロックが分からないもの（2周目で発動したものなど）は、そのキャラの最初の出場の行に出す。
                  // CT違反の判定は、出場ブロックに関係なく、そのキャラの全出場のCTで行っている（rotationCalculator の ctEvents）
                  const ctCarryHere = (c: CooldownSpan) => {
                    const home = homeStintIdOfAction.get(c.actionInstanceId);
                    return home ? home === stint.id : isFirstOccurrence;
                  };
                  const buffCarryHere = (b: ActiveBuffSpan) => {
                    const home = b.ownerStintId
                      ?? (b.originalStartTime !== undefined
                        ? stints.find(s => s.characterId === char.id && b.originalStartTime! >= (s.startTime ?? 0) - 0.2 && b.originalStartTime! <= (s.endTime ?? 0) + 0.2)?.id
                        : undefined);
                    return home ? home === stint.id : isFirstOccurrence;
                  };
                  const charCarryOverSkillCDs = carryOverCooldowns.filter(c => c.characterId === char.id && c.type === 'skill' && ctCarryHere(c));
                  const charCarryOverSpecialCDs = carryOverCooldowns.filter(c => c.characterId === char.id && c.type === 'special' && ctCarryHere(c));
                  const charCarryOverBurstCDs = carryOverCooldowns.filter(c => c.characterId === char.id && c.type === 'burst' && ctCarryHere(c));
                  const charCarryOverBuffs = carryOverBuffs.filter(b => b.origin !== 'passive' && b.sourceCharacterId === char.id && buffCarryHere(b));
                  const charCarryOverPassives = isFirstOccurrence
                    ? carryOverPassives.filter(p => p.characterId === char.id)
                    : [];

                  // Find actions and cooldowns/buffs initiated by this stint
                  const stintActionIds = new Set(stint.actions.map(a => a.id));
                  const stintSkillCDs = skillCooldowns.filter(c => 
                    c.type !== 'special' && c.characterId === char.id && (
                      stintActionIds.has(c.actionInstanceId) || 
                      (c.startTime >= (stint.startTime ?? 0) - 0.05 && c.startTime <= (stint.endTime ?? 0) + 0.05)
                    )
                  );
                  const stintSpecialCDs = skillCooldowns.filter(c => 
                    c.type === 'special' && c.characterId === char.id && (
                      stintActionIds.has(c.actionInstanceId) || 
                      (c.startTime >= (stint.startTime ?? 0) - 0.05 && c.startTime <= (stint.endTime ?? 0) + 0.05)
                    )
                  );
                  const stintBurstCDs = burstCooldowns.filter(c => 
                    c.characterId === char.id && (
                      stintActionIds.has(c.actionInstanceId) || 
                      (c.startTime >= (stint.startTime ?? 0) - 0.05 && c.startTime <= (stint.endTime ?? 0) + 0.05)
                    )
                  );
                  const stintBuffs = activeBuffs.filter(b => 
                    b.origin !== 'passive' && // 発動バフは専用の行に表示
                    b.sourceCharacterId === char.id && 
                    (b.ownerStintId
                      // 副次効果は、出場の終わりより後に始まっても、そのアクションの出場ブロックの行に出す
                      ? b.ownerStintId === stint.id
                      : b.startTime >= (stint.startTime ?? 0) - 0.2 && b.startTime <= (stint.endTime ?? 0) + 0.2)
                  );

                  // 左のキャラカードには、そのアクション本来のCT（持ち越しバーの残りCTではなく、元のCTの長さ）を表示する
                  const originalCtSeconds = (list: CooldownSpan[]): number => {
                    const own = list.find(c => !c.isCarryOver);
                    if (own) return own.baseDuration ?? own.duration;
                    const carried = list[0];
                    return carried.originalStartTime !== undefined && carried.originalEndTime !== undefined
                      ? carried.originalEndTime - carried.originalStartTime
                      : carried.duration;
                  };
                  const allStintSkillCDs = [...charCarryOverSkillCDs, ...stintSkillCDs];
                  const allStintBurstCDs = [...charCarryOverBurstCDs, ...stintBurstCDs];
                  const allStintSpecialCDs = [...charCarryOverSpecialCDs, ...stintSpecialCDs].sort((a, b) => a.startTime - b.startTime);
                  const allStintBuffs = [...charCarryOverBuffs, ...stintBuffs];
                  const stintBuffRows = organizeBuffsIntoRows(allStintBuffs);
                  // スキルの後の受付のバーの行は、スキルストックの行とスキル CT の行の間に出す。それ以外の効果バーは、これまでの位置
                  const windowBuffRows = stintBuffRows.filter(r => r.spans.some(sp => sp.windowBar));
                  const otherBuffRows = stintBuffRows.filter(r => !r.spans.some(sp => sp.windowBar));
                  const renderBuffLabel = (bRow, rIdx) => (
                            <div 
                              key={`stint_buff_lbl_${stint.id}_${rIdx}`} 
                              className="h-6 px-2 flex items-center justify-between text-emerald-300 text-[9px] truncate font-mono border-b border-slate-800/40" 
                              title={`【${bRow.tag} 効果持続時間】\n${bRow.sample.name} (${bRow.sample.duration.toFixed(2)}s)\n${bRow.sample.description}`}
                            >
                              <span className="truncate flex items-center gap-1">
                                <span className="text-emerald-400 font-bold shrink-0">{bRow.tag}</span>
                                <span className="truncate">{bRow.cleanName}</span>
                              </span>
                              <span className="shrink-0 text-emerald-400/80 ml-1">{(bRow.sample.windowBar && bRow.sample.standardDuration !== undefined ? bRow.sample.standardDuration : bRow.lane !== undefined ? Math.max(...bRow.spans.map(x => x.duration)) : bRow.sample.duration).toFixed(1)}s</span>
                            </div>
                          );
                  const renderBuffBar = (bRow, rIdx) => {
                            return (
                              <div key={`stint_buff_row_${stint.id}_${rIdx}`} className="h-6 relative flex items-center border-b border-slate-800/20 z-10">
                                {bRow.spans.map(buff => {
                                  const isCarryOver = Boolean(buff.isCarryOver);
                                  if (buff.startTime >= totalDuration) return null;
                                  const visualEnd = Math.min(totalDuration, buff.endTime);

                                  const isBarActive = !isCarryOver || isCarryOverActive(buff.originalStartTime);
                                  const startX = buff.startTime * pixelsPerSecond;
                                  const width = Math.max(16, (visualEnd - buff.startTime) * pixelsPerSecond);
                                  const remaining = effectRemaining(buff);
                                  const isBuffActive = remaining !== undefined;

                                  return (
                                    <div
                                      key={buff.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSeek(buff.startTime);
                                      }}
                                      style={{ 
                                        left: `${startX}px`, 
                                        width: `${width}px`,
                                        zIndex: isCarryOver ? 10 : 20,
                                      }}
                                      className={`absolute h-3.5 rounded text-[9px] font-medium flex items-center px-1.5 border transition-all cursor-pointer select-none shadow-sm ${
                                        isCarryOver && !isBarActive
                                          ? 'bg-slate-800/60 border-slate-600/70 text-slate-400 opacity-60 border-dashed hover:opacity-100 hover:border-slate-400'
                                          : isBuffActive 
                                          ? 'bg-emerald-950 border-emerald-400 text-emerald-100 ring-2 ring-emerald-400 font-bold brightness-125 shadow-emerald-500/30' 
                                          : isCarryOver
                                          ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200 opacity-90'
                                          : 'bg-emerald-950 border-emerald-400 text-emerald-100 opacity-90 hover:border-emerald-300'
                                      }`}
                                      title={`【${bRow.tag} 効果持続時間】${isCarryOver ? ' (1周目からの持ち越しバフ)' : ''}${!isBarActive ? ' (※元の発動位置を通過すると有効化)' : ''}\n${buff.name} (${buff.duration.toFixed(2)}s)\n期間: [${buff.startTime.toFixed(2)}s ~ ${buff.endTime.toFixed(2)}s] (クリックで開始位置へシーク)\n詳細: ${buff.description}`}
                                    >
                                      <span className="truncate">
                                        ✨ {isCarryOver ? '[持越] ' : ''}{bRow.tag} {buff.name.replace(/^[^:]+:\s*/, '')} {isCarryOver ? `(${buff.duration.toFixed(1)}s)` : `(${buff.duration.toFixed(1)}s)`} {isBuffActive ? `[残${remaining.toFixed(1)}s]` : ''}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          };
                  const stintPassives = passiveSpans.filter(p => p.stintId === stint.id);
                  // スキルのストック数（回数が 2 以上のスキル）。1 周目の行と、2 周目（ループがあるとき）の行
                  const stockLaps = ([1, 2] as const)
                    .map(lap => ({ lap, spans: stockSpans.filter(s => s.characterId === char.id && s.lap === lap) }))
                    .filter(l => l.spans.length > 0);

                  // パッシブバフ（通常発動 + 1周目からの持ち越し）を同一の passiveEffectId ごとに統合
                  const allPassiveEffectIds = Array.from(new Set([
                    ...stintPassives.map(p => p.effectGroup),
                    ...charCarryOverPassives.map(p => p.effectGroup),
                  ]));

                  const stintPassiveGroups = allPassiveEffectIds.map(effectId => {
                    const regular = stintPassives.filter(p => p.effectGroup === effectId);
                    const carry = charCarryOverPassives.filter(p => p.effectGroup === effectId);
                    const sample = regular[0] || carry[0];
                    const category = sample.category || (effectId.startsWith('wbuff_') ? 'weapon' : effectId.startsWith('abuff_') ? 'artifact' : 'talent');
                    return {
                      passiveEffectId: effectId,
                      name: sample.name,
                      category,
                      duration: sample.duration,
                      cooldown: sample.cooldown,
                      color: sample.color,
                      description: sample.description,
                      regularPassives: regular,
                      carryOverPassives: carry,
                      hasCarryOver: carry.length > 0,
                    };
                  });
                  const isStintSelected = selectedAction?.stintId === stint.id;

                  return (
                    <div key={stint.id} id={ganttStintRowId(stint.id)} data-start-px={(stint.startTime ?? 0) * pixelsPerSecond} className={`relative group/stint transition-colors ${
                      isStintSelected ? 'bg-amber-500/10' : 'bg-slate-950/30 hover:bg-slate-900/30'
                    }`}>
                      <div className="flex">
                        {/* Stint Row Header (Left Column: Sticky Left) */}
                        <div className={`w-[180px] shrink-0 border-r border-slate-800 flex flex-col sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] ${
                          isStintSelected
                            ? 'bg-amber-950 border-l-4 border-l-yellow-400 ring-1 ring-yellow-400/50 shadow-md'
                            : isStintCurrentlyOnField 
                            ? 'bg-slate-900 border-l-2 border-l-amber-400' 
                            : 'bg-slate-950'
                        }`}>
                          {/* Row 0: Character Info & Controls (Height: h-9 = 36px) */}
                          <div className="h-9 px-2 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/40">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <CharacterAvatar char={char} className="w-6 h-6 rounded-md text-xs shadow-inner shrink-0" borderWidth={1.5} />
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="font-bold text-xs text-white truncate">{char.name}</span>
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-900 border border-slate-700 text-amber-300 font-bold shrink-0">
                                  #{stintIdx + 1}
                                </span>
                                {isStintCurrentlyOnField && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="現在出場中" />
                                )}
                              </div>
                            </div>

                            {/* Move Stint Row Up / Down */}
                            {onUpdateStints && (
                              <div className="flex items-center shrink-0 bg-slate-900 rounded border border-slate-800 p-0.5 gap-0.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (stintIdx > 0) {
                                      const next = [...stints];
                                      const temp = next[stintIdx];
                                      next[stintIdx] = next[stintIdx - 1];
                                      next[stintIdx - 1] = temp;
                                      onUpdateStints(cleanStintsForState(next));
                                    }
                                  }}
                                  disabled={stintIdx === 0}
                                  title={`#${stintIdx + 1} (${char.name}) の登場順を上（前）へ`}
                                  className="leading-none text-slate-500 hover:text-white disabled:opacity-20 text-[9px] px-1 py-0.5"
                                >
                                  ▲
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (stintIdx < stints.length - 1) {
                                      const next = [...stints];
                                      const temp = next[stintIdx];
                                      next[stintIdx] = next[stintIdx + 1];
                                      next[stintIdx + 1] = temp;
                                      onUpdateStints(cleanStintsForState(next));
                                    }
                                  }}
                                  disabled={stintIdx === stints.length - 1}
                                  title={`#${stintIdx + 1} (${char.name}) の登場順を下（次）へ`}
                                  className="leading-none text-slate-500 hover:text-white disabled:opacity-20 text-[9px] px-1 py-0.5"
                                >
                                  ▼
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Row 1: Actions & Time Band (Height: h-10 = 40px) */}
                          <div className="h-10 px-2 flex flex-col justify-center border-b border-slate-800/60 text-[9px] font-mono leading-tight">
                            <div className="flex items-center justify-between text-amber-300/90 font-semibold truncate">
                              <span className="truncate flex items-center gap-1">
                                {stint.actions.some(a => a.hasCTCollision) && (
                                  <span title="CT未回復あり" className="inline-flex items-center">
                                    <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 animate-pulse" />
                                  </span>
                                )}
                                {stintPassives.some(p => p.hasCTViolation) && (
                                  <span title="CT警告あり（発動バフがCT中に発動する配置。効果が発動しないだけ）" className="inline-flex items-center">
                                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                  </span>
                                )}
                                <span className="truncate">{stint.note || `${char.name}の行動`}</span>
                              </span>
                              <span className="shrink-0 text-slate-400 font-mono text-[9px] ml-1">
                                {(stint.duration ?? 0).toFixed(1)}s
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-400 mt-0.5">
                              <span>時間帯</span>
                              <span className="font-mono">{(stint.startTime ?? 0).toFixed(1)}s ~ {(stint.endTime ?? 0).toFixed(1)}s</span>
                            </div>
                          </div>

                          {/* スキルストック数の行（1 周目・2 周目で 1 行ずつ） */}
                          {stockLaps.map(l => (
                            <div key={`stock_label_${l.lap}`} className="h-6 px-2 flex items-center justify-between text-emerald-300 text-[9px] font-mono border-b border-slate-800/40">
                              <span className="truncate">🔢 スキルストック</span>
                              <span className="shrink-0 ml-1">{stockLaps.length > 1 ? `${l.lap}周目` : ''}</span>
                            </div>
                          ))}

                          {/* スキルの後の受付のバーの行（スキルストックの行の下・スキル CT の行の上） */}
                          {windowBuffRows.map(renderBuffLabel)}

                          {/* Row 2: Skill (E) Cooldown Row (Height: h-6 = 24px) */}
                          {allStintSkillCDs.length > 0 && (
                            <div className="h-6 px-2 flex items-center justify-between text-sky-300 text-[9px] font-mono border-b border-slate-800/40">
                              <span className="truncate">⏱️ スキルCT</span>
                              <span className="shrink-0 ml-1">{originalCtSeconds(allStintSkillCDs).toFixed(1)}s</span>
                            </div>
                          )}

                          {/* Row 2b: Special Skill Cooldown Row (特殊元素スキル。スキルとは別のCT) */}
                          {/* 特殊スキルのCTは、1本ごとに別の行にする（重なって見えなくなるのを防ぐ） */}
                          {allStintSpecialCDs.map((cd, i) => (
                            <div key={cd.id} className="h-6 px-2 flex items-center justify-between text-sky-300 text-[9px] font-mono border-b border-slate-800/40">
                              <span className="truncate">⏱️ 特殊スキルCT{allStintSpecialCDs.length > 1 ? ` ${i + 1}` : ''}</span>
                              <span className="shrink-0 ml-1">{originalCtSeconds([cd]).toFixed(1)}s</span>
                            </div>
                          ))}

                          {/* Row 3: Burst (Q) Cooldown Row (Height: h-6 = 24px) */}
                          {allStintBurstCDs.length > 0 && (
                            <div className="h-6 px-2 flex items-center justify-between text-sky-300 text-[9px] font-mono border-b border-slate-800/40">
                              <span className="truncate">⏱️ 爆発CT</span>
                              <span className="shrink-0 ml-1">{originalCtSeconds(allStintBurstCDs).toFixed(1)}s</span>
                            </div>
                          )}

                          {/* Row 4+: Action Effect Buff Rows (Height: h-6 = 24px each) */}
                          {otherBuffRows.map(renderBuffLabel)}

                          {/* Row 5+: Passive Group Rows (Height: h-6 = 24px each) */}
                          {stintPassiveGroups.map(grp => {
                            const category = grp.category;
                            const badgeCfg = getBuffBadgeConfig(category);
                            return (
                              <React.Fragment key={`passive_lbl_grp_${stint.id}_${grp.passiveEffectId}`}>
                                {grp.duration > 0 && (
                                  <div 
                                    className={`h-6 px-2 flex items-center justify-between text-[9px] font-mono border-b border-slate-800/40 truncate ${
                                      category === 'weapon' ? 'text-blue-400 font-semibold' : category === 'artifact' ? 'text-purple-300' : category === 'constellation' ? 'text-rose-300' : 'text-lime-300'
                                    }`} 
                                    title={`【発動バフ（${badgeCfg.label}）】\n${grp.name}\n効果 ${grp.duration.toFixed(2)}s / CT ${grp.cooldown > 0 ? `${grp.cooldown}s` : 'なし'}`}
                                  >
                                    <span className="truncate"><span className="font-bold">[{badgeCfg.label}]</span> {grp.name}{grp.hasCarryOver ? ' [持越]' : ''}</span>
                                    <span className={`shrink-0 ml-1 ${category === 'weapon' ? 'text-blue-400' : ''}`}>{grp.duration.toFixed(1)}s</span>
                                  </div>
                                )}
                                {grp.cooldown > 0 && (
                                  <div className={`h-6 px-2 flex items-center justify-between text-[9px] font-mono border-b border-slate-800/40 ${badgeCfg.timingValueClass}`}>
                                    <span>⏱️ {badgeCfg.label}CT{grp.hasCarryOver ? ' [持越]' : ''}</span>
                                    <span>{grp.cooldown.toFixed(1)}s</span>
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>

                        {/* Right Timeline Canvas for this Stint */}
                        <div 
                          className="relative flex-1 flex flex-col cursor-pointer"
                          onClick={handleTimelineClick}
                        >
                          {/* Background Vertical Grid Lines */}
                          {timelineTicks.map(t => (
                            <div
                              key={`grid_stint_${stint.id}_${t.absTime}`}
                              className={`absolute top-0 bottom-0 border-l pointer-events-none z-0 ${
                                t.isZero ? 'border-purple-400/70' : 'border-slate-800/40'
                              }`}
                              style={{ left: `${t.absTime * pixelsPerSecond}px` }}
                            />
                          ))}

                          {/* --- Row 0: Top Header Space Match (Height: h-9 = 36px) --- */}
                          <div className="h-9 relative border-b border-slate-800/40 pointer-events-none z-10" />

                          {/* --- Row 1: On-field Active Stint & Actions (Height: h-10 = 40px) --- */}
                          <div className="h-10 relative flex items-center border-b border-slate-800/40 z-10">
                            {(() => {
                              const startX = (stint.startTime ?? 0) * pixelsPerSecond;
                              const width = (stint.duration ?? 0) * pixelsPerSecond;

                              return (
                                <div
                                  className={`absolute h-7 rounded-lg flex items-center overflow-hidden border shadow-sm transition-all ${
                                    isStintCurrentlyOnField
                                      ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-amber-500/20'
                                      : 'border-slate-700 hover:border-slate-500'
                                  }`}
                                  style={{
                                    left: `${startX}px`,
                                    width: `${width}px`,
                                    background: `linear-gradient(90deg, ${char.color}55, ${char.color}33)`,
                                  }}
                                >
                                  {stint.actions.map((act, actIdx) => {
                                    const actStartX = ((act.startTime ?? 0) - (stint.startTime ?? 0)) * pixelsPerSecond;
                                    const actWidth = act.duration * pixelsPerSecond;
                                    const isActActive = (act.startTime ?? 0) <= activeTime && activeTime < (act.endTime ?? 0);
                                    const isBurst = act.type === 'burst';
                                    const isSkill = act.type === 'skill' || act.type === 'skill_hold' || act.type === 'skill_reset';
                                    const isSelected = selectedAction?.stintId === stint.id && selectedAction?.actionId === act.id;
                                    const isBeingDragged = draggedAction?.stintId === stint.id && draggedAction?.actionIndex === actIdx;
                                    const isDragOverTarget = dragOverAction?.stintId === stint.id && dragOverAction?.actionIndex === actIdx && draggedAction?.actionIndex !== actIdx;

                                    const hasCollision = act.hasCTCollision;
                                    const colRem = act.collisionRemainingCT;
                                    const windowWarning = act.specialWindowWarning;

                                    return (
                                      <div
                                        key={act.id}
                                        draggable={true}
                                        onDragStart={(e) => {
                                          e.stopPropagation();
                                          setDraggedAction({ stintId: stint.id, actionIndex: actIdx, actionId: act.id });
                                          onSelectAction?.(stint.id, act.id);
                                          e.dataTransfer.effectAllowed = 'move';
                                          e.dataTransfer.setData('text/plain', act.id);
                                        }}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (draggedAction && draggedAction.stintId === stint.id) {
                                            e.dataTransfer.dropEffect = 'move';
                                            if (!dragOverAction || dragOverAction.actionIndex !== actIdx) {
                                              setDragOverAction({ stintId: stint.id, actionIndex: actIdx });
                                            }
                                          }
                                        }}
                                        onDragLeave={(e) => {
                                          e.stopPropagation();
                                          if (dragOverAction?.stintId === stint.id && dragOverAction?.actionIndex === actIdx) {
                                            setDragOverAction(null);
                                          }
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (draggedAction && draggedAction.stintId === stint.id && draggedAction.actionIndex !== actIdx) {
                                            handleReorderActionsInStint(stint.id, draggedAction.actionIndex, actIdx);
                                          }
                                          setDraggedAction(null);
                                          setDragOverAction(null);
                                        }}
                                        onDragEnd={(e) => {
                                          e.stopPropagation();
                                          setDraggedAction(null);
                                          setDragOverAction(null);
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSelectAction?.(stint.id, act.id);
                                          onSeek(act.startTime ?? 0);
                                          scrollStintCardBelowSticky(stint.id);
                                        }}
                                        style={{ left: `${actStartX}px`, width: `${actWidth}px` }}
                                        className={`absolute h-full flex items-center justify-center border-r border-slate-950/60 text-[10px] font-bold select-none cursor-grab active:cursor-grabbing transition-all ${
                                          hasCollision
                                            ? 'bg-red-950/90 text-white ring-2 ring-inset ring-red-500/80 animate-pulse z-20'
                                            : windowWarning && !isSelected
                                            ? 'bg-sky-600/90 text-white ring-2 ring-inset ring-amber-400/80 z-20'
                                            : isSelected 
                                            ? 'ring-2 ring-yellow-400 border-yellow-300 z-30 shadow-[0_0_12px_rgba(250,204,21,0.8)]' 
                                            : isActActive 
                                            ? 'bg-amber-400 text-slate-950 ring-1 ring-white' 
                                            : isBurst
                                            ? 'bg-purple-600/90 text-white hover:brightness-110'
                                            : isSkill
                                            ? 'bg-sky-600/90 text-white hover:brightness-110'
                                            : 'bg-slate-800/80 text-slate-200 hover:brightness-110'
                                        } ${
                                          isBeingDragged ? 'opacity-30 scale-95 ring-1 ring-dashed ring-amber-400' : ''
                                        } ${
                                          isDragOverTarget 
                                            ? (draggedAction && draggedAction.actionIndex < actIdx 
                                                ? 'border-r-4 border-r-amber-400 ring-2 ring-amber-400/80 bg-amber-400/30' 
                                                : 'border-l-4 border-l-amber-400 ring-2 ring-amber-400/80 bg-amber-400/30') 
                                            : ''
                                        }`}
                                        title={
                                          hasCollision
                                            ? `【⚠️ CT衝突エラー】発動時点（${(act.startTime ?? 0).toFixed(2)}s）でクールタイムがまだ解消されていません！\n残りCT: ${colRem ?? '?'}s\nアクション: ${act.name}`
                                            : windowWarning
                                            ? `【⚠️ 警告】${windowWarning}\nアクション: ${act.name}（gcsim の計算は制限されません）`
                                            : `【ドラッグで順序入れ替え / クリックで選択】\n${act.name} (${act.duration.toFixed(2)}s) [${(act.startTime ?? 0).toFixed(2)}s ~ ${(act.endTime ?? 0).toFixed(2)}s]${act.usedSpecialCharge ? '\n【特殊重撃（蒼牙）】特殊スキルの使用回数を 1 回分使います（スタミナは使いません）' : ''}`
                                        }
                                      >
                                        <span className="truncate px-0.5 flex items-center gap-0.5">
                                          {hasCollision && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                                          {!hasCollision && windowWarning && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
                                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-ping inline-block shrink-0" />}
                                          {act.type === 'swap' || act.actionTypeId === 'action_switch_char'
                                            ? <RefreshCw className="w-3.5 h-3.5 text-sky-300 shrink-0" aria-label="キャラ交代" />
                                            : actionDisplayName(act)}
                                          {act.usedSpecialCharge && (
                                            <span className="text-[9px] bg-cyan-400 text-slate-950 font-black px-1 rounded ml-0.5 shrink-0">特殊</span>
                                          )}
                                          {hasCollision && colRem !== undefined && (
                                            <span className="text-[9px] bg-red-600 text-white font-black px-1 rounded shadow ml-0.5 shrink-0">
                                              残{colRem}s
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {/* モードの維持のために、出場の最後のアクションの後に自動で足した待ち（薄い色。保存しない） */}
                                  {stint.actions.filter(act => (act.modeHoldSeconds ?? 0) > 0).map(act => {
                                    const hold = act.modeHoldSeconds ?? 0;
                                    return (
                                      <div
                                        key={`${act.id}_modehold`}
                                        style={{ left: `${((stint.endTime ?? 0) - hold - (stint.startTime ?? 0)) * pixelsPerSecond}px`, width: `${hold * pixelsPerSecond}px` }}
                                        className={`absolute h-full flex items-center justify-center border-r border-dashed border-slate-400/50 text-[9px] text-slate-200/70 select-none ${
                                          act.type === 'burst' ? 'bg-purple-600/30' : act.type === 'skill' || act.type === 'skill_hold' ? 'bg-sky-600/30' : 'bg-slate-500/30'
                                        }`}
                                        title={`【モード維持】${stint.modeHold?.label ?? 'モード'}が最大時間まで続くように、「${act.name}」の後を自動で延ばしています（+${hold.toFixed(2)}s。保存しません）。\n切り替えは、アクション構築エリアの出場ブロックの「モード維持」`}
                                      >
                                        <span className="truncate px-0.5">維持</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>

                          {/* --- スキルストック数のバー（1 周目・2 周目で 1 行ずつ。数が変わるたびに別のバー。0 はバーなし） --- */}
                          {stockLaps.map(l => (
                            <div key={`stock_bar_${l.lap}`} className="h-6 relative flex items-center border-b border-slate-800/20 z-10">
                              {l.spans.map(sp => {
                                const startX = sp.startTime * pixelsPerSecond;
                                const width = Math.max(14, (Math.min(totalDuration, sp.endTime) - sp.startTime) * pixelsPerSecond);
                                return (
                                  <div
                                    key={sp.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSeek(l.lap === 2 ? totalDuration + (sp.startTime - loopStartTime) : sp.startTime);
                                    }}
                                    style={{ left: `${startX}px`, width: `${width}px` }}
                                    className="absolute h-3.5 rounded text-[9px] font-mono flex items-center justify-center px-1 border bg-emerald-950 border-emerald-400/80 text-emerald-200 hover:border-emerald-300 cursor-pointer select-none shadow-sm"
                                    title={`【スキルのストック ${sp.count} / ${sp.max}】${l.lap}周目 [${sp.startTime.toFixed(2)}s ~ ${sp.endTime.toFixed(2)}s]（クリックで開始位置へシーク）${l.lap === 1 ? '\n時間 0 は満タンの仮定' : ''}`}
                                  >
                                    <span className="truncate">{sp.count}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ))}

                          {/* スキルの後の受付のバーの行 */}
                          {windowBuffRows.map(renderBuffBar)}

                          {/* --- Row 2: Skill (E) Cooldown Bar (Height: h-6 = 24px) --- */}
                          {allStintSkillCDs.length > 0 && (
                            <div className="h-6 relative flex items-center border-b border-slate-800/20 z-10">
                              {allStintSkillCDs.map(cd => {
                                const isCarryOver = Boolean(cd.isCarryOver);
                                if (cd.startTime >= totalDuration) return null;
                                const visualEnd = Math.min(totalDuration, cd.endTime);
                                const startX = cd.startTime * pixelsPerSecond;
                                const width = Math.max(16, (visualEnd - cd.startTime) * pixelsPerSecond);
                                const isBarActive = !isCarryOver || isCarryOverActive(cd.originalStartTime);

                                const violatingAction = !isCarryOver
                                  ? stint.actions.find(a => a.id === cd.actionInstanceId && a.hasCTCollision)
                                  : undefined;

                                return (
                                  <React.Fragment key={cd.id}>
                                  {violatingAction && (
                                    <CTViolationMarker x={(violatingAction.startTime ?? cd.startTime) * pixelsPerSecond} remaining={violatingAction.collisionRemainingCT} />
                                  )}
                                  <div
                                    key={cd.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSeek(cd.startTime);
                                    }}
                                    style={{ left: `${startX}px`, width: `${width}px`, zIndex: isCarryOver ? 10 : 20 }}
                                    className={`absolute h-3.5 rounded text-[9px] font-mono flex items-center px-1.5 border transition-all cursor-pointer select-none shadow-sm ${
                                      isCarryOver && !isBarActive
                                        ? 'bg-slate-800/60 border-slate-600/70 text-slate-400 opacity-60 border-dashed hover:opacity-100 hover:border-slate-400'
                                        : isCarryOver
                                        ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                                        : 'bg-sky-950 border-sky-400/90 text-sky-200 hover:border-sky-300'
                                    }`}
                                    title={
                                      isCarryOver
                                        ? `【1周目からの持ち越しスキルCT】${!isBarActive ? '(※元の発動位置を通過すると有効化)' : ''}\n期間: [${cd.startTime.toFixed(2)}s ~ ${cd.endTime.toFixed(2)}s]\n残りCT: ${(cd.endTime - cd.startTime).toFixed(1)}s (クリックで開始位置へシーク)`
                                        : `【スキルCT】${cd.duration.toFixed(1)}s [${cd.startTime.toFixed(1)}s ~ ${cd.endTime.toFixed(1)}s] (クリックで開始位置へシーク)`
                                    }
                                  >
                                    <span className="truncate">
                                      ⏱️ {isCarryOver ? '[持越] ' : ''}E-CT {(cd.endTime - cd.startTime).toFixed(1)}s
                                    </span>
                                  </div>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          )}

                          {/* --- Row 2b: Special Skill Cooldown Bar (Height: h-6 = 24px) --- */}
                          {allStintSpecialCDs.map(rowCd => (
                            <div key={rowCd.id} className="h-6 relative flex items-center border-b border-slate-800/20 z-10">
                              {[rowCd].map(cd => {
                                const isCarryOver = Boolean(cd.isCarryOver);
                                if (cd.startTime >= totalDuration) return null;
                                const visualEnd = Math.min(totalDuration, cd.endTime);
                                const startX = cd.startTime * pixelsPerSecond;
                                const width = Math.max(16, (visualEnd - cd.startTime) * pixelsPerSecond);
                                const isBarActive = !isCarryOver || isCarryOverActive(cd.originalStartTime);

                                const violatingAction = !isCarryOver
                                  ? stint.actions.find(a => a.id === cd.actionInstanceId && a.hasCTCollision)
                                  : undefined;

                                return (
                                  <React.Fragment key={cd.id}>
                                  {violatingAction && (
                                    <CTViolationMarker x={(violatingAction.startTime ?? cd.startTime) * pixelsPerSecond} remaining={violatingAction.collisionRemainingCT} />
                                  )}
                                  <div
                                    key={cd.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSeek(cd.startTime);
                                    }}
                                    style={{ left: `${startX}px`, width: `${width}px`, zIndex: isCarryOver ? 10 : 20 }}
                                    className={`absolute h-3.5 rounded text-[9px] font-mono flex items-center px-1.5 border transition-all cursor-pointer select-none shadow-sm ${
                                      isCarryOver && !isBarActive
                                        ? 'bg-slate-800/60 border-slate-600/70 text-slate-400 opacity-60 border-dashed hover:opacity-100 hover:border-slate-400'
                                        : isCarryOver
                                        ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                                        : 'bg-sky-950 border-sky-400/90 text-sky-200 hover:border-sky-300'
                                    }`}
                                    title={
                                      isCarryOver
                                        ? `【1周目からの持ち越し特殊スキルCT】${!isBarActive ? '(※元の発動位置を通過すると有効化)' : ''}\n期間: [${cd.startTime.toFixed(2)}s ~ ${cd.endTime.toFixed(2)}s]\n残りCT: ${(cd.endTime - cd.startTime).toFixed(1)}s (クリックで開始位置へシーク)`
                                        : `【特殊スキルCT】${cd.duration.toFixed(1)}s [${cd.startTime.toFixed(1)}s ~ ${cd.endTime.toFixed(1)}s] (クリックで開始位置へシーク)`
                                    }
                                  >
                                    <span className="truncate">
                                      ⏱️ {isCarryOver ? '[持越] ' : ''}spE-CT {(cd.endTime - cd.startTime).toFixed(1)}s
                                    </span>
                                  </div>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          ))}

                          {/* --- Row 3: Burst (Q) Cooldown Bar (Height: h-6 = 24px) --- */}
                          {allStintBurstCDs.length > 0 && (
                            <div className="h-6 relative flex items-center border-b border-slate-800/20 z-10">
                              {allStintBurstCDs.map(cd => {
                                const isCarryOver = Boolean(cd.isCarryOver);
                                if (cd.startTime >= totalDuration) return null;
                                const visualEnd = Math.min(totalDuration, cd.endTime);
                                const startX = cd.startTime * pixelsPerSecond;
                                const width = Math.max(16, (visualEnd - cd.startTime) * pixelsPerSecond);
                                const isBarActive = !isCarryOver || isCarryOverActive(cd.originalStartTime);

                                const violatingAction = !isCarryOver
                                  ? stint.actions.find(a => a.id === cd.actionInstanceId && a.hasCTCollision)
                                  : undefined;

                                return (
                                  <React.Fragment key={cd.id}>
                                  {violatingAction && (
                                    <CTViolationMarker x={(violatingAction.startTime ?? cd.startTime) * pixelsPerSecond} remaining={violatingAction.collisionRemainingCT} />
                                  )}
                                  <div
                                    key={cd.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSeek(cd.startTime);
                                    }}
                                    style={{ left: `${startX}px`, width: `${width}px`, zIndex: isCarryOver ? 10 : 20 }}
                                    className={`absolute h-3.5 rounded text-[9px] font-mono flex items-center px-1.5 border transition-all cursor-pointer select-none shadow-sm ${
                                      isCarryOver && !isBarActive
                                        ? 'bg-slate-800/60 border-slate-600/70 text-slate-400 opacity-60 border-dashed hover:opacity-100 hover:border-slate-400'
                                        : isCarryOver
                                        ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                                        : 'bg-sky-950 border-sky-400/90 text-sky-200 hover:border-sky-300'
                                    }`}
                                    title={
                                      isCarryOver
                                        ? `【1周目からの持ち越し元素爆発CT】${!isBarActive ? '(※元の発動位置を通過すると有効化)' : ''}\n期間: [${cd.startTime.toFixed(2)}s ~ ${cd.endTime.toFixed(2)}s]\n残りCT: ${(cd.endTime - cd.startTime).toFixed(1)}s (クリックで開始位置へシーク)`
                                        : `【爆発CT】${cd.duration.toFixed(1)}s [${cd.startTime.toFixed(1)}s ~ ${cd.endTime.toFixed(1)}s] (クリックで開始位置へシーク)`
                                    }
                                  >
                                    <span className="truncate">
                                      ⏱️ {isCarryOver ? '[持越] ' : ''}Q-CT {(cd.endTime - cd.startTime).toFixed(1)}s
                                    </span>
                                  </div>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          )}

                          {/* --- Row 4+: Active Buffs & Summons (Height: h-6 = 24px each) --- */}
                          {otherBuffRows.map(renderBuffBar)}

                          {/* --- Row 5+: 発動バフ（固有天賦・武器・聖遺物） (Height: h-6 = 24px each) --- */}
                          {stintPassiveGroups.map(grp => {
                            const category = grp.category;
                            const badgeCfg = getBuffBadgeConfig(category);
                            const barCommon = 'absolute h-3.5 rounded text-[9px] flex items-center px-1.5 border select-none shadow-sm transition-all';

                            const runningRingClass = category === 'weapon'
                              ? 'ring-2 ring-blue-300 font-bold brightness-125 shadow-blue-500/30'
                              : category === 'artifact'
                              ? 'ring-2 ring-purple-300 font-bold brightness-125 shadow-purple-500/30'
                              : category === 'constellation'
                              ? 'ring-2 ring-rose-300 font-bold brightness-125 shadow-rose-500/30'
                              : 'ring-2 ring-lime-300 font-bold brightness-125 shadow-lime-500/30';

                            return (
                              <React.Fragment key={`passive_group_row_${stint.id}_${grp.passiveEffectId}`}>
                                {/* 1. 効果持続時間行（同じ行の中に持ち越しバーと通常バーを配置） */}
                                {grp.duration > 0 && (
                                  <div className="h-6 relative flex items-center border-b border-slate-800/20 z-10">
                                    {/* 持ち越し効果バー (zIndex: 10) */}
                                    {grp.carryOverPassives.map(cp => {
                                      const isBarActive = isCarryOverActive(cp.originalStartTime);
                                      const start = cp.startTime;
                                      if (start >= totalDuration) return null;
                                      // 2周目の発動そのものは、通常バー側で折り返した位置に表示する
                                      if ((cp.originalStartTime ?? 0) >= totalDuration) return null;
                                      const visualEnd = Math.min(totalDuration, cp.endTime);

                                      const dur = cp.duration;
                                      const remaining = effectRemaining(cp);
                                      const isBuffActive = remaining !== undefined;

                                      return (
                                        <div
                                          key={`wrap_p_eff_${cp.id}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onSeek(start);
                                          }}
                                          style={{ left: `${start * pixelsPerSecond}px`, width: `${Math.max(16, (visualEnd - start) * pixelsPerSecond)}px`, zIndex: 10 }}
                                          className={`${barCommon} font-medium border-dashed cursor-pointer ${
                                            !isBarActive
                                              ? 'bg-slate-800/60 border-slate-600/70 text-slate-400 opacity-60 hover:opacity-100 hover:border-slate-400'
                                              : badgeCfg.ganttBarClass
                                          } ${isBuffActive ? runningRingClass : isBarActive ? 'opacity-90' : ''}`}
                                          title={`【1周目からの持ち越し発動バフ（${badgeCfg.label}）】${!isBarActive ? '(※元の発動位置を通過すると有効化)' : ''}\n${cp.name} (${cp.duration.toFixed(2)}s)\n期間: [${start.toFixed(2)}s ~ ${cp.endTime.toFixed(2)}s] (クリックで開始位置へシーク)`}
                                        >
                                          <span className="truncate flex items-center gap-1">
                                            {badgeCfg.icon}
                                            <span>[持越] [{badgeCfg.label}] {cp.name} ({dur.toFixed(1)}s)</span>
                                            {isBuffActive ? ` [残${remaining.toFixed(1)}s]` : ''}
                                          </span>
                                        </div>
                                      );
                                    })}

                                    {/* 通常発動効果バー（ドラッグ調整可能, zIndex: 20 で前面） */}
                                    {grp.regularPassives.map(p => {
                                      const isDragging = draggingPassive?.triggerId === p.triggerId;
                                      const offset = isDragging ? draggingPassive!.offset : p.startTime - (stint.startTime ?? 0);
                                      const realStart = (stint.startTime ?? 0) + offset;
                                      // 2周目の発動（開始が周の終端以降）は、折り返した位置に表示し、再生位置が届くまでグレー（D39）
                                      const isLapTwoBar = realStart >= totalDuration - 0.001;
                                      const drawX = passiveDrawPos(realStart);
                                      if (drawX >= totalDuration) return null;
                                      const start = drawX;
                                      const isPending = isLapTwoBar && !isCarryOverActive(realStart);
                                      const visualEnd = Math.min(totalDuration, start + (p.endTime - p.startTime));
                                      const remaining = effectRemaining(p);
                                      const isBuffActive = remaining !== undefined;
                                      const startDrag = (e: React.MouseEvent) => {
                                        if (e.button !== 0) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        document.body.style.cursor = 'grabbing';
                                        setDraggingPassive({
                                          stintId: stint.id,
                                          triggerId: p.triggerId,
                                          startClientX: e.clientX,
                                          originOffset: offset,
                                          offset,
                                          stintStart: stint.startTime ?? 0,
                                          originPos: drawX,
                                          lapTwo: isLapTwoView,
                                        });
                                      };
                                      const cursor = isDragging ? 'cursor-grabbing ring-2 ring-amber-300' : p.auto ? 'cursor-default' : 'cursor-grab';
                                      const activeRingClass = isPending ? 'opacity-60' : isBuffActive ? runningRingClass : 'opacity-90';

                                      return (
                                        <React.Fragment key={`reg_p_eff_${p.id}`}>
                                        {p.hasCTViolation && !(grp.cooldown > 0) && (
                                          <CTViolationMarker x={start * pixelsPerSecond} remaining={p.collisionRemainingCT} warning />
                                        )}
                                        <div
                                          key={`reg_p_eff_${p.id}`}
                                          data-no-pan
                                          onMouseDown={p.auto ? undefined : startDrag}
                                          onClick={(e) => e.stopPropagation()}
                                          style={{ left: `${start * pixelsPerSecond}px`, width: `${Math.max(16, (visualEnd - start) * pixelsPerSecond)}px`, zIndex: 20 }}
                                          className={`${barCommon} ${cursor} font-medium border-dashed ${
                                            p.hasCTViolation
                                              ? 'bg-amber-950/80 border-amber-500 text-amber-100 ring-2 ring-inset ring-amber-500/70 z-20'
                                              : isPending
                                              ? 'bg-slate-800/60 border-slate-600/70 text-slate-400'
                                              : badgeCfg.ganttBarClass
                                          } ${activeRingClass}`}
                                          title={`【発動バフ（${badgeCfg.label}）${isLapTwoBar ? '・2周目の発動' : ''}】${isPending ? '(※再生位置が発動位置に届くまでグレー) ' : ''}${p.auto ? '自動（アプリの計算。確率 100%・スキルのダメージが当たったとき）' : `ドラッグで発動位置を調整（出場の先頭から ${fmtOffset(offset)}s）`}\n${p.name} (${p.duration.toFixed(2)}s)\n発動: ${realStart.toFixed(2)}s${isLapTwoBar ? `（2周目。表示位置 ${drawX.toFixed(2)}s）` : ''}（出場の先頭から ${fmtOffset(offset)}s）${p.hasCTViolation ? `\n⚠️ 【CT警告】CTがまだ ${p.collisionRemainingCT ?? '?'}s 残っています。この発動では効果は発動しません（gcsim の計算は制限されません）` : ''}`}
                                        >
                                          <span className="truncate flex items-center gap-1">
                                            {p.hasCTViolation ? <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" /> : badgeCfg.icon}
                                            <span>[{badgeCfg.label}] {p.name} ({p.duration.toFixed(1)}s)</span>
                                            {p.hasCTViolation && p.collisionRemainingCT !== undefined && (
                                              <span className="text-[9px] bg-amber-600 text-white font-black px-1 rounded shadow ml-0.5 shrink-0">
                                                残{p.collisionRemainingCT}s
                                              </span>
                                            )}
                                            {isBuffActive && !p.hasCTViolation ? ` [残${remaining.toFixed(1)}s]` : ''}
                                            {isDragging ? ` @${fmtOffset(offset)}s` : ''}
                                          </span>
                                        </div>
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* 2. CT行（同じ行の中に持ち越しCTバーと通常CTバーを配置） */}
                                {grp.cooldown > 0 && (
                                  <div className="h-6 relative flex items-center border-b border-slate-800/20 z-10">
                                    {/* 持ち越しCTバー (zIndex: 10) */}
                                    {grp.carryOverPassives.filter(cp => cp.cooldownEnd && cp.cooldownEnd > cp.startTime).map(cp => {
                                      const isBarActive = isCarryOverActive(cp.originalStartTime);
                                      const start = cp.startTime;
                                      if (start >= totalDuration) return null;
                                      if ((cp.originalStartTime ?? 0) >= totalDuration) return null;
                                      const cdEnd = cp.cooldownEnd!;
                                      const visualEnd = Math.min(totalDuration, cdEnd);
                                      const cdDur = cdEnd - start;

                                      return (
                                        <div
                                          key={`wrap_p_cd_${cp.id}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onSeek(start);
                                          }}
                                          style={{ left: `${start * pixelsPerSecond}px`, width: `${Math.max(16, (visualEnd - start) * pixelsPerSecond)}px`, zIndex: 10 }}
                                          className={`${barCommon} font-mono cursor-pointer ${
                                            !isBarActive
                                              ? 'bg-slate-800/60 border-slate-600/70 text-slate-400 opacity-60 border-dashed hover:opacity-100 hover:border-slate-400'
                                              : badgeCfg.cooldownBarClass
                                          }`}
                                          title={`【1周目からの持ち越し${badgeCfg.label}CT】${!isBarActive ? '(※元の発動位置を通過すると有効化)' : ''}\n${cp.name}\nCT残り: ${cdDur.toFixed(2)}s [${start.toFixed(2)}s ~ ${cdEnd.toFixed(2)}s] (クリックで開始位置へシーク)`}
                                        >
                                          <span className="truncate">⏱️ [持越] {badgeCfg.label}CT {cdDur.toFixed(1)}s</span>
                                        </div>
                                      );
                                    })}

                                    {/* 通常CTバー (zIndex: 20 で前面) */}
                                    {grp.regularPassives.map(p => {
                                      const isDragging = draggingPassive?.triggerId === p.triggerId;
                                      const offset = isDragging ? draggingPassive!.offset : p.startTime - (stint.startTime ?? 0);
                                      const realStart = (stint.startTime ?? 0) + offset;
                                      const isLapTwoBar = realStart >= totalDuration - 0.001;
                                      const drawX = passiveDrawPos(realStart);
                                      if (drawX >= totalDuration) return null;
                                      const start = drawX;
                                      const isPending = isLapTwoBar && !isCarryOverActive(realStart);
                                      const visualEnd = Math.min(totalDuration, start + p.cooldown);
                                      const cursor = isDragging ? 'cursor-grabbing ring-2 ring-amber-300' : p.auto ? 'cursor-default' : 'cursor-grab';
                                      const startDrag = (e: React.MouseEvent) => {
                                        if (e.button !== 0) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        document.body.style.cursor = 'grabbing';
                                        setDraggingPassive({
                                          stintId: stint.id,
                                          triggerId: p.triggerId,
                                          startClientX: e.clientX,
                                          originOffset: offset,
                                          offset,
                                          stintStart: stint.startTime ?? 0,
                                          originPos: drawX,
                                          lapTwo: isLapTwoView,
                                        });
                                      };

                                      return (
                                        <React.Fragment key={`reg_p_cd_${p.id}`}>
                                        {p.hasCTViolation && (
                                          <CTViolationMarker x={start * pixelsPerSecond} remaining={p.collisionRemainingCT} warning />
                                        )}
                                        <div
                                          key={`reg_p_cd_${p.id}`}
                                          data-no-pan
                                          onMouseDown={p.auto ? undefined : startDrag}
                                          onClick={(e) => e.stopPropagation()}
                                          style={{ left: `${start * pixelsPerSecond}px`, width: `${Math.max(16, (visualEnd - start) * pixelsPerSecond)}px`, zIndex: 20 }}
                                          className={`${barCommon} ${cursor} font-mono ${isPending ? 'bg-slate-800/60 border-slate-600/70 text-slate-400 opacity-60' : badgeCfg.cooldownBarClass}`}
                                          title={`【${badgeCfg.label}バフのCT${isLapTwoBar ? '・2周目' : ''}】${p.name}\nCT ${p.cooldown.toFixed(2)}s [${start.toFixed(2)}s ~ ${(start + p.cooldown).toFixed(2)}s]${p.auto ? '（自動。精錬で長さが決まる）' : '（ドラッグで効果と一緒に移動）'}`}
                                        >
                                          <span className="truncate">⏱️ {badgeCfg.label}CT {p.cooldown.toFixed(1)}s</span>
                                        </div>
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* 時間指定のない効果の行（常時の効果・継続時間の無い固有天賦。D39-4）。最後のキャラ出場行の下 */}
              <GlobalBuffRow characters={characters} database={database} />
            </div>



            {/* =========================================================================
                5. Vertical Handoff Connector Lines (交代スナップ垂直ガイド線: 1周目＋2周目)
                "前のキャラの登場期間終点と、次のキャラの登場期間始点の縦位置が重ならないよう一致していなければならない"
            ========================================================================= */}
            {showConnectors && handoffConnectors.map((conn) => (
              <div
                key={`handoff_${conn.id}`}
                style={{ left: `${conn.xPos + 180}px` }}
                className="absolute top-0 bottom-0 w-0 border-l border-amber-400/60 border-dashed pointer-events-none z-0"
              />
            ))}

            {/* =========================================================================
                5.5 Vertical Loop Boundary Guide Line (1周目ループ区切 & 2周目開始地点)
            ========================================================================= */}
            {loopStartTime > 0 && (
              <div
                style={{ left: `${loopStartTime * pixelsPerSecond + 180}px` }}
                className="absolute top-9 bottom-0 w-0 border-l-2 border-purple-400 border-dotted pointer-events-none z-10 shadow-lg"
              />
            )}




            {/* =========================================================================
                6. Playhead Scrubber Laser (再生カーソル縦棒)
            ========================================================================= */}
            <div
              style={{ left: `${activeTime * pixelsPerSecond + 180}px` }}
              className={`absolute top-0 bottom-0 w-0.5 pointer-events-none z-20 shadow-lg ${
                isPlayheadLoop
                  ? 'bg-gradient-to-b from-purple-400 via-fuchsia-300 to-purple-500 shadow-purple-500/50'
                  : 'bg-gradient-to-b from-amber-400 via-yellow-300 to-amber-500 shadow-amber-400/50'
              }`}
            />

            {/* Hover Indicator */}
            {hoveredTime !== null && (
              <div
                style={{ left: `${hoveredTime * pixelsPerSecond + 180}px` }}
                className="absolute top-0 bottom-0 w-0 border-l border-sky-400/60 pointer-events-none z-10"
              >
                <div className="absolute top-4 left-1 bg-sky-950/90 text-sky-200 border border-sky-700 text-[10px] font-mono px-1 rounded">
                  {fmtTime(hoveredTime, 1)}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Legend / Guide */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 px-1 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-300">凡例:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded bg-amber-500/50 border border-amber-400"></span>
              <span className="text-slate-200">出場・行動時間</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded bg-sky-950 border border-sky-400"></span>
              <span className="text-sky-300 font-semibold">CT（クールタイム / スキル・爆発統一）</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded bg-emerald-950 border border-emerald-400"></span>
              <span className="text-emerald-300 font-semibold">効果持続時間（バフ・設置物・継続効果統一）</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0 border-t border-dashed border-amber-400"></span>
              <span className="text-amber-300 font-medium">交代垂直スナップ (前の退場＝次の登場)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0 border-t-2 border-dotted border-purple-400"></span>
              <span className="text-purple-300 font-medium">🔁 2周目以降ループ区切り</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded bg-slate-800/80 border border-dashed border-slate-500"></span>
              <span className="text-slate-300 font-medium">[持越] 1周目からの持ち越し（元の発動位置を通過すると有効化）</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            ※ タイムライン上の任意の場所をクリックして再生位置をシークできます
          </div>
        </div>
      </div>
    </section>
  );
};

/** CT違反マーク（キャラカードの違反マークと同じ）。x = バーの先頭（発動位置）の横座標。その左側に表示する */
/** CT違反（スキル・爆発。赤）/ CT警告（発動バフ。黄色。`warning`）のマーク */
const CTViolationMarker: React.FC<{ x: number; remaining?: number; warning?: boolean }> = ({ x, remaining, warning }) => (
  <span
    className="absolute top-1/2 -translate-y-1/2 inline-flex items-center pointer-events-auto"
    style={{ left: `${x - 15}px`, zIndex: 30 }}
    title={warning ? `CT警告: 発動時点で CT がまだ ${remaining ?? '?'} 秒残っています（効果は発動しません）` : `CT違反: 発動時点で CT がまだ ${remaining ?? '?'} 秒残っています`}
  >
    <AlertTriangle className={`w-3 h-3 shrink-0 ${warning ? 'text-amber-400' : 'text-red-400 animate-pulse'}`} />
  </span>
);
