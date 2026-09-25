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
  Lock,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  ShieldAlert,
  Check
} from 'lucide-react';
import { 
  CharacterConfig, 
  Stint, 
  ActiveBuffSpan, 
  CooldownSpan, 
  CharacterRuntimeState ,
  PassiveSpan,
} from '../types/genshin';
import { ELEMENT_COLORS } from '../data/characters';
import { buildActionEffectSpan, countDistinctActiveBuffs } from '../utils/characterActions';
import { scrollStintCardBelowSticky, focusStintInGantt, GANTT_STICKY_HEADER_ID, GANTT_SCROLL_CONTAINER_ID, ganttStintRowId } from '../utils/scrollToStintCard';
import { formatCharacterCooldowns, formatSpanDurations } from '../utils/characterActions';

// Organization structure for active buffs into independent non-overlapping rows.
// Distinct buffs (such as Xiangling's E and Q effects) are placed on separate independent rows.
export interface BuffRowInfo {
  tag: string;
  cleanName: string;
  sample: ActiveBuffSpan;
  spans: ActiveBuffSpan[];
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
  return { rank: 3, tag: '[天賦]' };
}

export function organizeBuffsIntoRows(buffs: ActiveBuffSpan[]): BuffRowInfo[] {
  if (!buffs || buffs.length === 0) return [];

  // Group by buffId / buff type so different buffs (e.g. E vs Q) are on distinct rows
  const byId = new Map<string, ActiveBuffSpan[]>();
  for (const b of buffs) {
    const key = b.buffId || b.name;
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
    const minStartA = Math.min(...listA.map(s => s.startTime));
    const minStartB = Math.min(...listB.map(s => s.startTime));
    return minStartA - minStartB;
  });

  for (const key of sortedKeys) {
    const spans = byId.get(key)!.sort((a, b) => a.startTime - b.startTime);
    const classification = getBuffClassification(spans[0]);
    const cleanName = spans[0].name.replace(/^[^:]+:\s*/, '');

    // Track packing in case of recasts
    const tracks: ActiveBuffSpan[][] = [];
    for (const span of spans) {
      let placed = false;
      for (const track of tracks) {
        const last = track[track.length - 1];
        if (last.endTime <= span.startTime + 0.05) {
          track.push(span);
          placed = true;
          break;
        }
      }
      if (!placed) {
        tracks.push([span]);
      }
    }

    tracks.forEach((trackSpans, tIdx) => {
      result.push({
        tag: classification.tag,
        cleanName: tracks.length > 1 ? `${cleanName} #${tIdx + 1}` : cleanName,
        sample: trackSpans[0],
        spans: trackSpans,
      });
    });
  }

  return result;
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
  activeBuffCountBySecond: { time: number; count: number; activeBuffs: string[] }[];
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
  /** アクション間所要時間（2周目の先頭の交代アクションの後に入る空白） */
  actionDelay?: number;
}

export const GanttChart: React.FC<GanttChartProps> = ({
  characters,
  stints,
  activeBuffs,
  skillCooldowns,
  burstCooldowns,
  characterStates,
  totalDuration,
  activeTime,
  onSeek,
  activeBuffCountBySecond,
  passiveSpans = [],
  onReorderCharacters,
  onReorderCharactersAndStints,
  onUpdateStints,
  selectedAction,
  onSelectAction,
  loopStartTime = 0,
  loopStartIndex = 0,
  onUpdateLoopStartIndex,
  switchDelay = 0.5,
  actionDelay = 0.1,
}) => {
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(55);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [showConnectors, setShowConnectors] = useState<boolean>(true);
  const [highlightBuffId, setHighlightBuffId] = useState<string | null>(null);

  // Loop marker dragging state
  const [isDraggingLoopMarker, setIsDraggingLoopMarker] = useState<boolean>(false);

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

  // 発動バフ（固有天賦）の発動位置ドラッグ: 出場の先頭からの秒数を、その出場の時間内で左右に動かす
  const [draggingPassive, setDraggingPassive] = useState<{
    stintId: string;
    triggerId: string;
    startClientX: number;
    originOffset: number;
    offset: number;
    maxOffset: number;
  } | null>(null);

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

  const handleReorderActionsInStint = (stintId: string, fromIndex: number, toIndex: number) => {
    if (!onUpdateStints || fromIndex === toIndex) return;
    const newStints = stints.map(s => {
      if (s.id !== stintId) return s;
      const actions = [...s.actions];
      const [moved] = actions.splice(fromIndex, 1);
      actions.splice(toIndex, 0, moved);
      return { ...s, actions };
    });
    onUpdateStints(newStints);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const handleContainerScroll = () => {
    if (isSyncingScroll.current) return;
    if (containerRef.current && headerScrollRef.current) {
      isSyncingScroll.current = true;
      headerScrollRef.current.scrollLeft = containerRef.current.scrollLeft;
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
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const characterMap = new Map<string, CharacterConfig>();
  characters.forEach(c => characterMap.set(c.id, c));

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

  // Projected 2nd Cycle Calculations & Automatic CT/Buff Collision Checks
  const cycle2Data = useMemo(() => {
    const loopPeriod = Math.max(0, totalDuration - loopStartTime);
    if (loopPeriod < 0.05 || stints.length === 0) {
      return {
        enabled: false,
        loopPeriod: 0,
        cycle2StartTime: totalDuration,
        cycle2EndTime: totalDuration,
        stints: [],
        cooldownCollisions: [],
        carryOverCooldowns: [],
        carryOverSkillCDs: [],
        carryOverBurstCDs: [],
        cycle1SkillCDs: [],
        cycle1BurstCDs: [],
        cycle2NewCooldowns: [],
        carryOverBuffs: [],
        cycle2NewBuffs: [],
        allCycle2Buffs: [],
        buffSynergyPoints: [],
      };
    }

    // ループの先頭が1周目の一番最初の出場（交代なし）の場合、2周目では1周目の最後のキャラからの交代が入るので、
    // 先頭に交代アクションを入れ、2周目全体をその所要時間だけ後ろへずらす
    const loopHeadStint = stints[loopStartIndex];
    const needsHeadSwap = switchDelay > 0 && !!loopHeadStint &&
      !loopHeadStint.actions.some(a => a.type === 'swap' || a.actionTypeId === 'action_switch_char');
    // 交代の後は、ほかの出場と同じくアクション間所要時間の空白が入る
    const headSwapShift = needsHeadSwap
      ? switchDelay + (loopHeadStint.actions.length > 0 ? actionDelay : 0)
      : 0;

    const offset = totalDuration - loopStartTime + headSwapShift;
    const cycle2StartTime = totalDuration;
    const cycle2EndTime = totalDuration + loopPeriod + headSwapShift;

    // 1. Project Stints & Actions into 2nd Cycle (offset by totalDuration - loopStartTime)
    const c2Stints: Array<{
      id: string;
      originalStintId: string;
      characterId: string;
      startTime: number;
      endTime: number;
      duration: number;
      note?: string;
      actions: Array<{
        id: string;
        originalActionId: string;
        actionTypeId: string;
        name: string;
        shortName: string;
        type: string;
        duration: number;
        startTime: number;
        endTime: number;
        isSkill: boolean;
        isBurst: boolean;
        hasCTCollision: boolean;
        ctRemaining: number;
        conflictingCDName?: string;
        conflictingCDEndTime?: number;
      }>;
    }> = [];

    const cooldownCollisions: Array<{
      actionName: string;
      characterName: string;
      characterId: string;
      actionTime: number;
      remainingCT: number;
      type: 'skill' | 'burst';
    }> = [];

    const cycle2NewCooldowns: CooldownSpan[] = [];
    const cycle2NewBuffs: Array<ActiveBuffSpan & { isCarryOver: boolean }> = [];

    stints.forEach((stint, sIdx) => {
      const char = characterMap.get(stint.characterId);
      if (!char) return;

      // ループ基準番号以降の出場キャラが 2周目ループの対象
      if (sIdx < loopStartIndex) return;
      const loopActions = stint.actions;
      if (loopActions.length === 0 && !(needsHeadSwap && sIdx === loopStartIndex)) return;

      const c2Actions = loopActions.map(act => {
        // Shift time into Cycle 2
        const rawActStart = act.startTime ?? 0;
        const c2ActStart = Math.max(cycle2StartTime, rawActStart + offset);
        const c2ActEnd = c2ActStart + act.duration;
        const isSkill = act.type === 'skill' || act.type === 'skill_hold' || act.type === 'skill_reset';
        const isBurst = act.type === 'burst';

        let hasCTCollision = false;
        let ctRemaining = 0;
        let conflictingCDName = '';
        let conflictingCDEndTime = 0;

        // Check 1st cycle skill cooldown collision
        if (isSkill && act.type !== 'skill_reset') {
          const charSkillCDs = skillCooldowns.filter(cd => cd.characterId === char.id);
          for (const cd of charSkillCDs) {
            if (cd.endTime > c2ActStart + 0.02) {
              const rem = cd.endTime - c2ActStart;
              if (rem > ctRemaining) {
                hasCTCollision = true;
                ctRemaining = rem;
                conflictingCDName = '元素スキルCT';
                conflictingCDEndTime = cd.endTime;
              }
            }
          }
        }

        // Check 1st cycle burst cooldown collision
        if (isBurst) {
          const charBurstCDs = burstCooldowns.filter(cd => cd.characterId === char.id);
          for (const cd of charBurstCDs) {
            if (cd.endTime > c2ActStart + 0.02) {
              const rem = cd.endTime - c2ActStart;
              if (rem > ctRemaining) {
                hasCTCollision = true;
                ctRemaining = rem;
                conflictingCDName = '元素爆発CT';
                conflictingCDEndTime = cd.endTime;
              }
            }
          }
        }

        if (hasCTCollision) {
          cooldownCollisions.push({
            actionName: act.name,
            characterName: char.name,
            characterId: char.id,
            actionTime: c2ActStart,
            remainingCT: Number(ctRemaining.toFixed(1)),
            type: isBurst ? 'burst' : 'skill',
          });
        }

        const matchedCharActionDef = char.availableActions.find(a => a.id === act.actionTypeId);
        const actionCT = act.cooldown ?? matchedCharActionDef?.cooldown ?? 0;
        const actionSkillCT = matchedCharActionDef?.startsSkillCooldown ? actionCT : 0;
        const actionBurstCT = matchedCharActionDef?.startsBurstCooldown !== false ? actionCT : 0;

        // New Cooldowns triggered in Cycle 2
        if (isSkill && actionSkillCT > 0) {
          cycle2NewCooldowns.push({
            id: `c2_cd_skill_${char.id}_${c2ActStart}`,
            characterId: char.id,
            type: 'skill',
            startTime: c2ActStart,
            endTime: c2ActStart + actionSkillCT,
            duration: actionSkillCT,
            actionInstanceId: `c2_${act.id}`,
          });
        }
        if (isBurst && actionBurstCT > 0) {
          cycle2NewCooldowns.push({
            id: `c2_cd_burst_${char.id}_${c2ActStart}`,
            characterId: char.id,
            type: 'burst',
            startTime: c2ActStart,
            endTime: c2ActStart + actionBurstCT,
            duration: actionBurstCT,
            actionInstanceId: `c2_${act.id}`,
          });
        }

        // 2周目で発動する効果バー（効果継続時間から作る）
        const c2EffectSpan = buildActionEffectSpan(char, act, matchedCharActionDef, c2ActStart, 'c2_effect');
        if (c2EffectSpan) cycle2NewBuffs.push({ ...c2EffectSpan, isCarryOver: false });

        return {
          id: `c2_${act.id}`,
          originalActionId: act.id,
          actionTypeId: act.actionTypeId,
          name: act.name,
          shortName: act.shortName,
          type: act.type,
          duration: act.duration,
          startTime: c2ActStart,
          endTime: c2ActEnd,
          isSkill,
          isBurst,
          hasCTCollision,
          ctRemaining: Number(ctRemaining.toFixed(1)),
          conflictingCDName,
          conflictingCDEndTime,
        };
      });

      // 発動バフ（固有天賦）も2周目に投影（読取専用の効果バーとして表示）
      for (const p of passiveSpans) {
        if (p.stintId !== stint.id || p.duration <= 0) continue;
        const c2Start = p.startTime + offset;
        cycle2NewBuffs.push({
          id: `c2_${p.id}`,
          buffId: `passive_${p.characterId}_${p.passiveEffectId}`,
          name: `${char.name}: ${p.name}`,
          sourceCharacterId: char.id,
          sourceType: 'talent',
          startTime: c2Start,
          endTime: c2Start + p.duration,
          duration: p.duration,
          color: char.color,
          description: `発動バフ（固有天賦）: ${p.name}`,
          isCarryOver: false,
        });
      }

      // 2周目の先頭の出場: 1周目の最後のキャラからの交代アクションを先頭に入れる
      if (needsHeadSwap && sIdx === loopStartIndex) {
        c2Actions.unshift({
          id: `c2_switch_head_${stint.id}`,
          originalActionId: '',
          actionTypeId: 'action_switch_char',
          name: 'キャラ交代',
          shortName: '交代',
          type: 'swap',
          duration: switchDelay,
          startTime: cycle2StartTime,
          endTime: cycle2StartTime + switchDelay,
          isSkill: false,
          isBurst: false,
          hasCTCollision: false,
          ctRemaining: 0,
          conflictingCDName: '',
          conflictingCDEndTime: 0,
        });
      }

      if (c2Actions.length > 0) {
        const stintStart = c2Actions[0].startTime;
        const stintEnd = c2Actions[c2Actions.length - 1].endTime;
        c2Stints.push({
          id: `c2_${stint.id}`,
          originalStintId: stint.id,
          characterId: stint.characterId,
          startTime: stintStart,
          endTime: stintEnd,
          duration: stintEnd - stintStart,
          note: stint.note,
          actions: c2Actions,
        });
      }
    });

    // 2. 1st Cycle Cooldowns (ALL 1st-cycle skill & burst CDs: both finished in 1st cycle and carryovers)
    const cycle1SkillCDs: Array<CooldownSpan & { isCarryOver: boolean; isFinishedInCycle1: boolean }> = skillCooldowns
      .map(cd => ({
        ...cd,
        isCarryOver: cd.endTime > cycle2StartTime + 0.05,
        isFinishedInCycle1: cd.endTime <= cycle2StartTime + 0.05,
      }));

    const cycle1BurstCDs: Array<CooldownSpan & { isCarryOver: boolean; isFinishedInCycle1: boolean }> = burstCooldowns
      .map(cd => ({
        ...cd,
        isCarryOver: cd.endTime > cycle2StartTime + 0.05,
        isFinishedInCycle1: cd.endTime <= cycle2StartTime + 0.05,
      }));

    const carryOverSkillCDs = cycle1SkillCDs.filter(cd => cd.isCarryOver);
    const carryOverBurstCDs = cycle1BurstCDs.filter(cd => cd.isCarryOver);
    const carryOverCooldowns = [...carryOverSkillCDs, ...carryOverBurstCDs];

    // 3. 2nd Cycle Buffs (Only 2nd Cycle newly triggered buffs are shown in 2nd cycle lanes)
    const allCycle2Buffs = [...cycle2NewBuffs];

    // 4. Buff synergy point counts across [cycle2StartTime, cycle2EndTime]
    const buffSynergyPoints: Array<{ time: number; count: number; activeBuffs: string[] }> = [];
    const minSec = Math.floor(cycle2StartTime);
    const maxSec = Math.ceil(cycle2EndTime);
    for (let t = minSec; t <= maxSec; t += 0.5) {
      // 同じアクション由来のバーが重なっても1つとして数える
      const { count, names } = countDistinctActiveBuffs(allCycle2Buffs, t);
      buffSynergyPoints.push({
        time: t,
        count,
        activeBuffs: names,
      });
    }

    return {
      enabled: true,
      loopPeriod: loopPeriod + headSwapShift,
      cycle2StartTime,
      cycle2EndTime,
      stints: c2Stints,
      cooldownCollisions,
      carryOverCooldowns,
      carryOverSkillCDs,
      carryOverBurstCDs,
      cycle1SkillCDs,
      cycle1BurstCDs,
      cycle2NewCooldowns,
      cycle2NewBuffs,
      allCycle2Buffs,
      buffSynergyPoints,
    };
  }, [stints, totalDuration, loopStartTime, loopStartIndex, switchDelay, actionDelay, passiveSpans, characterMap, skillCooldowns, burstCooldowns, activeBuffs]);

  // Combined Buff Synergy Points spanning full timeline (1st cycle + 2nd cycle)
  const allBuffSynergyPoints = useMemo(() => {
    return [
      ...activeBuffCountBySecond,
      ...(cycle2Data.buffSynergyPoints || []),
    ];
  }, [activeBuffCountBySecond, cycle2Data.buffSynergyPoints]);

  // Total timeline duration spanning 1st Cycle + 2nd Cycle Preview
  const extendedTotalDuration = cycle2Data.enabled ? cycle2Data.cycle2EndTime : totalDuration;
  const chartWidth = Math.max(800, Math.ceil(extendedTotalDuration + 2) * pixelsPerSecond);

  // Handle timeline scrubber click or drag
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft - 180; // 180px is character header width
    if (clickX >= 0) {
      const time = Math.min(extendedTotalDuration, Math.max(0, clickX / pixelsPerSecond));
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

  // Generate ticks spanning full timeline (1st cycle + 2nd cycle)
  // When loopStartTime > 0, ticks are generated relative to loopStartTime as 0s
  const timelineTicks = useMemo(() => {
    if (!loopStartTime || loopStartTime <= 0) {
      const maxSeconds = Math.ceil(extendedTotalDuration + 2);
      const list: { absTime: number; relTime: number; label: string; isZero: boolean; isNegative: boolean }[] = [];
      for (let s = 0; s <= maxSeconds; s++) {
        list.push({
          absTime: s,
          relTime: s,
          label: `${s}s`,
          isZero: s === 0,
          isNegative: false,
        });
      }
      return list;
    }

    const minRel = -Math.ceil(loopStartTime);
    const maxRel = Math.ceil(extendedTotalDuration - loopStartTime + 1);
    const list: { absTime: number; relTime: number; label: string; isZero: boolean; isNegative: boolean }[] = [];

    // If loopStartTime is non-integer, add the absolute 0 point (rotation start)
    if (Math.abs(loopStartTime - Math.round(loopStartTime)) > 0.05) {
      list.push({
        absTime: 0,
        relTime: -loopStartTime,
        label: `-${loopStartTime.toFixed(1)}s`,
        isZero: false,
        isNegative: true,
      });
    }

    for (let r = minRel; r <= maxRel; r++) {
      const absTime = Number((loopStartTime + r).toFixed(3));
      if (absTime >= -0.001 && absTime <= extendedTotalDuration + 2) {
        list.push({
          absTime: Math.max(0, absTime),
          relTime: r,
          label: r === 0 ? '0s 🔁' : r < 0 ? `${r}s` : `+${r}s`,
          isZero: r === 0,
          isNegative: r < 0,
        });
      }
    }

    list.sort((a, b) => a.absTime - b.absTime);
    return list.filter((item, idx, arr) => idx === 0 || Math.abs(item.absTime - arr[idx - 1].absTime) > 0.1);
  }, [loopStartTime, extendedTotalDuration]);

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
      const raw = Math.min(draggingPassive.maxOffset, Math.max(0, draggingPassive.originOffset + delta));
      const offset = Math.round(raw * 20) / 20; // 0.05秒単位
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
  }, [draggingPassive, pixelsPerSecond, stints, onUpdateStints]);

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
      onUpdateStints(next);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingTrackStint, pixelsPerSecond, stints, onUpdateStints]);

  // Pre-calculate connector points between consecutive stints for vertical snap visualization
  // Stint i ends at t_end, Stint i+1 starts at t_end!
  const handoffConnectors = stints.slice(0, stints.length - 1).map((stint, idx) => {
    const nextStint = stints[idx + 1];
    const fromCharIdx = characters.findIndex(c => c.id === stint.characterId);
    const toCharIdx = characters.findIndex(c => c.id === nextStint.characterId);
    const snapTime = stint.endTime ?? 0;
    return {
      snapTime,
      fromCharIdx,
      toCharIdx,
      fromCharId: stint.characterId,
      toCharId: nextStint.characterId,
      xPos: snapTime * pixelsPerSecond,
    };
  });

  return (
    <section className="bg-slate-950 p-3 sm:p-4 border-b border-slate-800 w-full max-w-full overflow-x-clip">
      <div className="w-full">
        {/* =========================================================================
            STICKY TOP HEADER PANEL (Gantt Title & Toolbar + Time Ruler + Loop + Unified + Synergy)
            Sticks directly below <Header> at var(--header-height) during page scroll
        ========================================================================= */}
        <div 
          id={GANTT_STICKY_HEADER_ID}
          className="sticky z-30 rounded-t-xl border border-slate-800 bg-slate-900/95 backdrop-blur-md shadow-2xl w-full mb-0 overflow-x-clip"
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

          {/* B. Scrollable 4 Header Tracks (Time Ruler, Loop, Unified, Buff Synergy) + Horizontal Scrollbar */}
          <div 
            ref={headerScrollRef}
            onScroll={handleHeaderScroll}
            className="overflow-x-auto w-full relative border-b border-slate-800 custom-scrollbar bg-slate-900/90"
          >
            <div style={{ width: chartWidth + 180, minWidth: '100%' }} className="relative select-none">
              
              {/* 1. Top Time Ruler */}
              <div className="flex border-b border-slate-800 bg-slate-900 h-9">
                {/* Left Column Label (Corner: Sticky Left) */}
                <div className="w-[180px] shrink-0 px-3 flex items-center justify-between border-r border-slate-800 bg-slate-900 text-[11px] font-bold text-slate-400 uppercase tracking-wider sticky left-0 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] h-full">
                  <span>キャラクター / 項目</span>
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                </div>

                {/* Time Ruler Ticks */}
                <div 
                  className="relative flex-1 cursor-pointer h-full bg-slate-900"
                  onClick={handleTimelineClick}
                >
                  {timelineTicks.map(t => (
                    <div
                      key={`tick_${t.absTime}`}
                      className={`absolute top-0 bottom-0 border-l flex flex-col justify-between pl-1 ${
                        t.isZero
                          ? 'border-purple-400 bg-purple-950/20 z-10'
                          : t.isNegative
                          ? 'border-amber-500/40'
                          : 'border-slate-800/80'
                      }`}
                      style={{ left: `${t.absTime * pixelsPerSecond}px` }}
                    >
                      <span className={`text-[10px] font-mono font-bold ${
                        t.isZero 
                          ? 'text-purple-300 bg-purple-950 px-1 rounded border border-purple-500/50 shadow' 
                          : t.isNegative 
                          ? 'text-amber-300/90' 
                          : 'text-slate-400'
                      }`}>
                        {t.label}
                      </span>
                      <span className={`w-0.5 h-1.5 ${t.isZero ? 'bg-purple-400' : 'bg-slate-700'}`}></span>
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
                </div>
              </div>

              {/* 1.5 Loop Boundary Separator Track */}
              <div className="flex border-b border-purple-900/60 bg-slate-950 items-center h-7 group select-none">
                <div className="w-[180px] shrink-0 px-3 border-r border-slate-800 flex items-center justify-between text-[11px] font-bold text-purple-300 sticky left-0 z-40 bg-slate-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] h-full">
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
                      className="absolute inset-y-0.5 bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-purple-500/20 border-r border-dashed border-purple-400/60 flex items-center px-2 pointer-events-none"
                    >
                      <span className="text-[10px] font-bold text-amber-300/90 truncate">
                        ◀ 1周目初動 (-{loopStartTime.toFixed(1)}s ~ 0.0s)
                      </span>
                    </div>
                  )}

                  {/* 2nd+ Cycle Loop (2周目以降も繰り返す) shaded range */}
                  <div
                    style={{ 
                      left: `${loopStartTime * pixelsPerSecond}px`, 
                      width: `${Math.max(0, (totalDuration - loopStartTime) * pixelsPerSecond)}px` 
                    }}
                    className="absolute inset-y-0.5 bg-gradient-to-r from-purple-500/15 to-indigo-500/10 flex items-center px-2 pointer-events-none"
                  >
                    <span className="text-[10px] font-bold text-purple-200 truncate">
                      🔁 定常ループ (0.0s ~ +{(totalDuration - loopStartTime).toFixed(1)}s) ▶
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

                  {/* Draggable Loop Boundary Marker Pin */}
                  <div
                    style={{ left: `${loopStartTime * pixelsPerSecond}px` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsDraggingLoopMarker(true);
                    }}
                    className={`absolute top-0 bottom-0 -translate-x-1/2 z-20 flex flex-col items-center cursor-ew-resize group/marker ${
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

              {/* 2. Unified Master On-Field Ribbon */}
              <div className="flex border-b border-slate-800 bg-slate-950 items-center h-10 group">
                <div className="w-[180px] shrink-0 px-3 border-r border-slate-800 flex items-center justify-between text-xs font-bold text-amber-300 sticky left-0 z-40 bg-slate-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] h-full">
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

                  {/* 2nd Cycle Stints (Together in Unified Track) */}
                  {cycle2Data.enabled && cycle2Data.stints.map((stint) => {
                    const char = characterMap.get(stint.characterId);
                    if (!char) return null;
                    const startX = stint.startTime * pixelsPerSecond;
                    const width = stint.duration * pixelsPerSecond;
                    const isCurrent = stint.startTime <= activeTime && activeTime < stint.endTime;

                    return (
                      <div
                        key={stint.id}
                        onClick={() => focusStintInGantt(stint)}
                        style={{ left: `${startX}px`, width: `${width}px` }}
                        className={`absolute h-7 rounded-md flex items-center px-1.5 overflow-hidden transition-all text-xs border ${
                          isCurrent 
                            ? 'border-purple-400 ring-2 ring-purple-400/50 shadow-md font-bold' 
                            : 'border-purple-800/80 hover:border-purple-500'
                        }`}
                        title={`【2周目】${char.name} 出場: ${stint.startTime.toFixed(2)}s ~ ${stint.endTime.toFixed(2)}s (${stint.duration.toFixed(2)}s)`}
                      >
                        <div 
                          className="absolute inset-0 opacity-40"
                          style={{ backgroundColor: char.color }}
                        />
                        <div className="relative z-10 flex items-center gap-1 truncate text-white">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: char.accentColor }} />
                          <span className="font-semibold text-[11px] truncate">{char.name}</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-900/80 text-purple-200 border border-purple-700 font-mono ml-0.5">2周目</span>
                          <span className="text-[10px] opacity-75 font-mono ml-0.5">({stint.duration.toFixed(1)}s)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2.5 Party Buff Synergy & DPS Heatmap Lane */}
              <div className="flex border-b border-slate-800 bg-slate-950 items-center h-8 group">
                <div className="w-[180px] shrink-0 px-3 border-r border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-400 sticky left-0 z-40 bg-slate-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] h-full">
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
                  {allBuffSynergyPoints.map((pt, idx) => {
                    const x = pt.time * pixelsPerSecond;
                    const w = 0.5 * pixelsPerSecond;

                    return (
                      <div
                        key={idx}
                        style={{ 
                          left: `${x}px`, 
                          width: `${w}px`,
                          backgroundColor: pt.count === 0 
                            ? 'rgba(30, 41, 59, 0.3)' 
                            : pt.count >= 3 
                            ? 'rgba(234, 88, 12, 0.65)' 
                            : pt.count >= 2 
                            ? 'rgba(16, 185, 129, 0.55)' 
                            : 'rgba(14, 165, 233, 0.35)',
                        }}
                        className="absolute top-1 bottom-1 rounded-sm border-r border-slate-950/40 flex items-center justify-center text-[10px] font-mono text-white select-none"
                        title={`${pt.time.toFixed(1)}s: 有効バフ ${pt.count}個 [${pt.activeBuffs.join(', ')}]`}
                      >
                        {pt.count > 0 && <span className="font-bold text-[9px]">{pt.count}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* =========================================================================
            MAIN CHARACTER SWIMLANES CANVAS
        ========================================================================= */}
        <div 
          ref={containerRef}
          id={GANTT_SCROLL_CONTAINER_ID}
          onScroll={handleContainerScroll}
          onMouseDown={handlePanMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredTime(null)}
          className="relative overflow-x-auto rounded-b-xl border border-slate-800 bg-slate-900/60 shadow-2xl custom-scrollbar w-full border-t-0"
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

                  // Find actions and cooldowns/buffs initiated by this stint
                  const stintActionIds = new Set(stint.actions.map(a => a.id));
                  const stintSkillCDs = skillCooldowns.filter(c => 
                    c.characterId === char.id && (
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
                    b.startTime >= (stint.startTime ?? 0) - 0.2 && 
                    b.startTime <= (stint.endTime ?? 0) + 0.2
                  );
                  const stintBuffRows = organizeBuffsIntoRows(stintBuffs);
                  const stintPassives = passiveSpans.filter(p => p.stintId === stint.id);
                  const isStintSelected = selectedAction?.stintId === stint.id;

                  return (
                    <div key={stint.id} id={ganttStintRowId(stint.id)} data-start-px={(stint.startTime ?? 0) * pixelsPerSecond} className={`relative group/stint transition-colors ${
                      isStintSelected ? 'bg-amber-500/10' : 'bg-slate-950/30 hover:bg-slate-900/30'
                    }`}>
                      <div className="flex">
                        {/* Stint Row Header (Left Column: Sticky Left) */}
                        <div className={`w-[180px] shrink-0 p-2.5 border-r border-slate-800 flex flex-col justify-between sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] ${
                          isStintSelected
                            ? 'bg-amber-950/80 border-l-4 border-l-yellow-400 ring-1 ring-yellow-400/50 shadow-md'
                            : isStintCurrentlyOnField 
                            ? 'bg-slate-900 border-l-2 border-l-amber-400' 
                            : 'bg-slate-950'
                        }`}>
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <div 
                                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner shrink-0"
                                style={{ backgroundColor: `${char.color}33`, color: char.accentColor, border: `1.5px solid ${char.color}` }}
                              >
                                {char.name.slice(0, 1)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-xs text-white truncate">{char.name}</span>
                                  {isStintCurrentlyOnField && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="現在出場中" />
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-amber-300 font-bold">
                                    #{stintIdx + 1}
                                  </span>
                                  {totalOccurrences > 1 ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                      登場 {occurrenceNum}/{totalOccurrences}回目
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-400 font-medium">単回出場</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Move Stint Row Up / Down */}
                            {onUpdateStints && (
                              <div className="flex flex-col items-center shrink-0 bg-slate-900 rounded border border-slate-800 p-0.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (stintIdx > 0) {
                                      const next = [...stints];
                                      const temp = next[stintIdx];
                                      next[stintIdx] = next[stintIdx - 1];
                                      next[stintIdx - 1] = temp;
                                      onUpdateStints(next);
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
                                      onUpdateStints(next);
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

                          {/* Sub-labels for the stint row */}
                          <div className="space-y-1 mt-2 text-[10px] font-mono text-slate-400 pl-0.5">
                            <div className="flex items-center justify-between text-amber-300/90 font-semibold truncate">
                              <span className="truncate">{stint.note || `${char.name}の行動`}</span>
                              <span className="shrink-0 text-slate-400 font-mono text-[9px]">
                                {(stint.duration ?? 0).toFixed(1)}s
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-400 text-[9px]">
                              <span>時間帯</span>
                              <span className="font-mono">{(stint.startTime ?? 0).toFixed(1)}s ~ {(stint.endTime ?? 0).toFixed(1)}s</span>
                            </div>
                            {stintSkillCDs.length > 0 && (
                              <div className="flex items-center justify-between text-sky-300 text-[9px] font-mono">
                                <span>⏱️ スキルCT</span>
                                <span>{stintSkillCDs[0].duration.toFixed(1)}s</span>
                              </div>
                            )}
                            {stintBurstCDs.length > 0 && (
                              <div className="flex items-center justify-between text-sky-300 text-[9px] font-mono">
                                <span>⏱️ 爆発CT</span>
                                <span>{stintBurstCDs[0].duration.toFixed(1)}s</span>
                              </div>
                            )}
                            {stintBuffRows.length > 0 && (
                              <div className="space-y-0.5 pt-0.5 border-t border-slate-800/60">
                                {stintBuffRows.map((bRow, rIdx) => (
                                  <div key={`stint_buff_lbl_${stint.id}_${rIdx}`} className="flex items-center justify-between text-emerald-300 text-[9px] truncate font-mono" title={`【${bRow.tag} 効果持続時間】\n${bRow.sample.name} (${bRow.sample.duration}s)\n${bRow.sample.description}`}>
                                    <span className="truncate flex items-center gap-1">
                                      <span className="text-emerald-400 font-bold shrink-0">{bRow.tag}</span>
                                      <span className="truncate">{bRow.cleanName}</span>
                                    </span>
                                    <span className="shrink-0 text-emerald-400/80 ml-1">{bRow.sample.duration.toFixed(0)}s</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {stintPassives.length > 0 && (
                              <div className="space-y-0.5 pt-0.5 border-t border-slate-800/60">
                                {stintPassives.map(p => (
                                  <div key={`passive_lbl_${p.id}`} className="text-[9px] font-mono" title={`【発動バフ（固有天賦）】\n${p.name}\n効果 ${p.duration}s / CT ${p.cooldown}s`}>
                                    <div className="flex items-center justify-between text-lime-300 truncate">
                                      <span className="truncate"><span className="font-bold text-lime-400">[天賦]</span> {p.name}</span>
                                      <span className="shrink-0 ml-1">{p.duration.toFixed(0)}s</span>
                                    </div>
                                    {p.cooldown > 0 && (
                                      <div className="flex items-center justify-between text-sky-300">
                                        <span>⏱️ 天賦CT</span>
                                        <span>{p.cooldown.toFixed(1)}s</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Timeline Canvas for this Stint */}
                        <div 
                          className="relative flex-1 min-h-[95px] flex flex-col justify-around py-1 cursor-pointer"
                          onClick={handleTimelineClick}
                        >
                          {/* Background Vertical Grid Lines */}
                          {timelineTicks.map(t => (
                            <div
                              key={`grid_stint_${stint.id}_${t.absTime}`}
                              className={`absolute top-0 bottom-0 border-l pointer-events-none ${
                                t.isZero ? 'border-purple-400/70' : t.isNegative ? 'border-amber-500/30' : 'border-slate-800/40'
                              }`}
                              style={{ left: `${t.absTime * pixelsPerSecond}px` }}
                            />
                          ))}

                          {/* --- Sublane 1: On-field Active Stint & Actions --- */}
                          <div className="relative h-7 my-0.5">
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
                                          isSelected 
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
                                        title={`【ドラッグで順序入れ替え / クリックで選択】\n${act.name} (${act.duration.toFixed(2)}s) [${(act.startTime ?? 0).toFixed(2)}s ~ ${(act.endTime ?? 0).toFixed(2)}s]`}
                                      >
                                        <span className="truncate px-0.5 flex items-center gap-0.5">
                                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-ping inline-block shrink-0" />}
                                          {act.shortName}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>

                          {/* --- Sublane 2: Skill (E) Cooldown Bar (Unified CT Color: Sky Blue) --- */}
                          <div className="relative h-4 my-0.5">
                            {stintSkillCDs.map(cd => {
                              const startX = cd.startTime * pixelsPerSecond;
                              const width = cd.duration * pixelsPerSecond;
                              const isCoolingDown = cd.startTime <= activeTime && activeTime < cd.endTime;
                              const remaining = Math.max(0, cd.endTime - activeTime);

                              return (
                                <div
                                  key={cd.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSeek(cd.startTime);
                                  }}
                                  style={{ left: `${startX}px`, width: `${width}px` }}
                                  className={`absolute h-3.5 rounded text-[9px] font-mono flex items-center px-1.5 border transition-all cursor-pointer select-none bg-sky-950 border-sky-400/90 text-sky-200 shadow-sm hover:border-sky-300 ${
                                    isCoolingDown ? 'ring-1 ring-sky-400 font-bold brightness-125' : ''
                                  }`}
                                  title={`【スキルCT】${cd.duration.toFixed(1)}s [${cd.startTime.toFixed(1)}s ~ ${cd.endTime.toFixed(1)}s] (クリックで開始位置へシーク)`}
                                >
                                  <span className="truncate">
                                    ⏱️ E-CT {cd.duration.toFixed(1)}s {isCoolingDown ? `(残${remaining.toFixed(1)}s)` : ''}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* --- Sublane 3: Burst (Q) Cooldown Bar (Unified CT Color: Sky Blue) --- */}
                          <div className="relative h-4 my-0.5">
                            {stintBurstCDs.map(cd => {
                              const startX = cd.startTime * pixelsPerSecond;
                              const width = cd.duration * pixelsPerSecond;
                              const isCoolingDown = cd.startTime <= activeTime && activeTime < cd.endTime;
                              const remaining = Math.max(0, cd.endTime - activeTime);

                              return (
                                <div
                                  key={cd.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSeek(cd.startTime);
                                  }}
                                  style={{ left: `${startX}px`, width: `${width}px` }}
                                  className={`absolute h-3.5 rounded text-[9px] font-mono flex items-center px-1.5 border transition-all cursor-pointer select-none bg-sky-950 border-sky-400/90 text-sky-200 shadow-sm hover:border-sky-300 ${
                                    isCoolingDown ? 'ring-1 ring-sky-400 font-bold brightness-125' : ''
                                  }`}
                                  title={`【爆発CT】${cd.duration.toFixed(1)}s [${cd.startTime.toFixed(1)}s ~ ${cd.endTime.toFixed(1)}s] (クリックで開始位置へシーク)`}
                                >
                                  <span className="truncate">
                                    ⏱️ Q-CT {cd.duration.toFixed(1)}s {isCoolingDown ? `(残${remaining.toFixed(1)}s)` : ''}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* --- Sublane 4+: Active Buffs & Summons (Each effect duration in its own independent row) --- */}
                          {stintBuffRows.map((bRow, rIdx) => (
                            <div key={`stint_buff_row_${stint.id}_${rIdx}`} className="relative h-4 my-0.5">
                              {bRow.spans.map(buff => {
                                const startX = buff.startTime * pixelsPerSecond;
                                const width = Math.max(16, buff.duration * pixelsPerSecond);
                                const isBuffActive = buff.startTime <= activeTime && activeTime < buff.endTime;
                                const remaining = Math.max(0, buff.endTime - activeTime);

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
                                    }}
                                    className={`absolute h-3.5 rounded text-[9px] font-medium flex items-center px-1.5 border transition-all cursor-pointer select-none bg-emerald-950 border-emerald-400 text-emerald-100 shadow-sm hover:border-emerald-300 ${
                                      isBuffActive 
                                        ? 'ring-1 ring-emerald-400 font-bold brightness-125' 
                                        : 'opacity-90'
                                    }`}
                                    title={`【${bRow.tag} 効果持続時間】\n${buff.name} (${buff.duration}s)\n期間: [${buff.startTime.toFixed(2)}s ~ ${buff.endTime.toFixed(2)}s] (クリックで開始位置へシーク)\n詳細: ${buff.description}`}
                                  >
                                    <span className="truncate">
                                      ✨ {bRow.tag} {buff.name.replace(/^[^:]+:\s*/, '')} ({buff.duration.toFixed(0)}s) {isBuffActive ? `[残${remaining.toFixed(1)}s]` : ''}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ))}

                          {/* --- 発動バフ（固有天賦）: 登録1つにつき「効果」の行と「CT」の行。ドラッグで効果と CT を一緒に左右へ動かす --- */}
                          {stintPassives.map(p => {
                            const isDragging = draggingPassive?.triggerId === p.triggerId;
                            const offset = isDragging ? draggingPassive!.offset : p.startTime - (stint.startTime ?? 0);
                            const start = (stint.startTime ?? 0) + offset;
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
                                maxOffset: stint.duration ?? 0,
                              });
                            };
                            const barCommon = 'absolute h-3.5 rounded text-[9px] flex items-center px-1.5 border select-none shadow-sm';
                            const cursor = isDragging ? 'cursor-grabbing ring-1 ring-lime-300' : 'cursor-grab';
                            return (
                              <React.Fragment key={`passive_rows_${p.id}`}>
                                <div className="relative h-4 my-0.5">
                                  <div
                                    data-no-pan
                                    onMouseDown={startDrag}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ left: `${start * pixelsPerSecond}px`, width: `${Math.max(16, p.duration * pixelsPerSecond)}px` }}
                                    className={`${barCommon} ${cursor} font-medium border-dashed ${
                                      p.hasCTViolation
                                        ? 'bg-red-950 border-red-400 text-red-100'
                                        : 'bg-lime-950 border-lime-400 text-lime-100 hover:border-lime-300'
                                    }`}
                                    title={`【発動バフ（固有天賦）】ドラッグで発動位置を調整（この出場の時間内）\n${p.name} (${p.duration}s)\n発動: ${start.toFixed(2)}s（出場の先頭から +${offset.toFixed(2)}s）${p.hasCTViolation ? '\n⚠️ CT中の発動です' : ''}`}
                                  >
                                    <span className="truncate">
                                      {p.hasCTViolation ? '⚠️' : '🎯'} [天賦] {p.name} ({p.duration.toFixed(0)}s){isDragging ? ` @+${offset.toFixed(2)}s` : ''}
                                    </span>
                                  </div>
                                </div>
                                {p.cooldown > 0 && (
                                  <div className="relative h-4 my-0.5">
                                    <div
                                      data-no-pan
                                      onMouseDown={startDrag}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ left: `${start * pixelsPerSecond}px`, width: `${Math.max(16, p.cooldown * pixelsPerSecond)}px` }}
                                      className={`${barCommon} ${cursor} font-mono bg-sky-950 border-sky-400/90 text-sky-200 hover:border-sky-300`}
                                      title={`【発動バフのCT】${p.name}\nCT ${p.cooldown.toFixed(1)}s [${start.toFixed(1)}s ~ ${(start + p.cooldown).toFixed(1)}s]（ドラッグで効果と一緒に移動）`}
                                    >
                                      <span className="truncate">⏱️ 天賦CT {p.cooldown.toFixed(1)}s</span>
                                    </div>
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
            </div>

            {/* =========================================================================
                4.5 Automatic 2nd-Cycle Loop Projection & CT/Buff Collision Analyzer (2周目自動投影・読取専用)
            ========================================================================= */}
            {cycle2Data.enabled && cycle2Data.stints.length > 0 && (
              <div className="border-t-2 border-purple-800/80 bg-slate-950/95">
                {/* 2nd Cycle Section Header */}
                <div className="flex items-center border-b border-purple-900/60 bg-gradient-to-r from-purple-950/90 via-slate-950 to-indigo-950/80 px-3 py-2">
                  <div className="w-[180px] shrink-0 sticky left-0 z-45 flex items-center gap-1.5 font-bold text-xs text-purple-300 bg-slate-950 px-2 py-1 rounded border border-purple-800/60 shadow">
                    <Repeat className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">2周目ループ投影</span>
                    <span className="text-[9px] bg-purple-900/80 border border-purple-700 text-purple-200 px-1 py-0.2 rounded flex items-center gap-0.5 shrink-0">
                      <Lock className="w-2.5 h-2.5" /> 読取専用
                    </span>
                  </div>

                  <div className="flex-1 flex flex-wrap items-center justify-between gap-2 px-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-purple-300/90 font-medium">
                        🔁 1周目 <strong className="text-white font-mono">{loopStartTime.toFixed(1)}s ~ {totalDuration.toFixed(1)}s</strong> の定常区間を <strong className="text-purple-300 font-mono">{cycle2Data.cycle2StartTime.toFixed(1)}s ~ {cycle2Data.cycle2EndTime.toFixed(1)}s</strong> に自動投影
                      </span>
                      <span className="text-[10px] text-slate-500">（1周目の設定がリアルタイム反映・編集不可）</span>
                    </div>

                    {/* Global CT Collision Status Banner */}
                    <div className="flex items-center gap-2">
                      {cycle2Data.cooldownCollisions.length > 0 ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/80 border border-red-500 text-red-300 text-xs font-bold animate-pulse shadow-red-500/20 shadow">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>⚠️ CT衝突検出: {cycle2Data.cooldownCollisions.length}件のアクションでCT未回復</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-500/70 text-emerald-300 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>✅ 全アクションCT解消済み（2周目即座移行可能）</span>
                        </div>
                      )}

                      {cycle2Data.carryOverCooldowns.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-sky-950/80 border border-sky-500/60 text-sky-300 text-[11px] font-mono">
                          <span>⏱️ 1周目持ち越しCT: <strong>{cycle2Data.carryOverCooldowns.length}件</strong> (E:{cycle2Data.carryOverSkillCDs.length} / Q:{cycle2Data.carryOverBurstCDs.length})</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2nd Cycle Swimlanes (1 Row per Stint, with separate Skill CT row, Burst CT row, and individual Buff rows) */}
                <div className="divide-y divide-purple-900/30">
                  {cycle2Data.stints.map((stint, stintIdx) => {
                    const char = characterMap.get(stint.characterId) || characters[0];
                    const isStintCurrentlyOnField = stint.startTime <= activeTime && activeTime < stint.endTime;
                    
                    // 1. Skill Cooldowns (ALL 1st-cycle CDs + 2nd cycle new)
                    const stintCycle1SkillCDs = cycle2Data.cycle1SkillCDs.filter(c => c.characterId === char.id);
                    const stintNewSkillCDs = cycle2Data.cycle2NewCooldowns.filter(c => c.characterId === char.id && c.type === 'skill');
                    const allStintSkillCDs = [...stintCycle1SkillCDs, ...stintNewSkillCDs];

                    // 2. Burst Cooldowns (ALL 1st-cycle CDs + 2nd cycle new)
                    const stintCycle1BurstCDs = cycle2Data.cycle1BurstCDs.filter(c => c.characterId === char.id);
                    const stintNewBurstCDs = cycle2Data.cycle2NewCooldowns.filter(c => c.characterId === char.id && c.type === 'burst');
                    const allStintBurstCDs = [...stintCycle1BurstCDs, ...stintNewBurstCDs];

                    // 3. 2nd Cycle Buffs (Only 2nd-cycle new buffs, organized into 1 row per unique buff effect)
                    const stintBuffs = cycle2Data.allCycle2Buffs.filter(b => 
                      b.sourceCharacterId === char.id &&
                      b.startTime >= stint.startTime - 0.2 &&
                      b.startTime <= stint.endTime + 0.2
                    );
                    const stintBuffRows = organizeBuffsIntoRows(stintBuffs);

                    return (
                      <div key={stint.id} id={ganttStintRowId(stint.id)} data-start-px={stint.startTime * pixelsPerSecond} className="relative group/stint bg-purple-950/10 hover:bg-purple-900/15 transition-colors">
                        <div className="flex">
                          {/* Left Column (Sticky Left) */}
                          <div className={`w-[180px] shrink-0 p-2.5 border-r border-slate-800 flex flex-col justify-between sticky left-0 z-45 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] ${
                            isStintCurrentlyOnField ? 'bg-slate-900 border-l-2 border-l-purple-400' : 'bg-slate-950'
                          }`}>
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div 
                                    className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner shrink-0"
                                    style={{ backgroundColor: `${char.color}33`, color: char.accentColor, border: `1.5px solid ${char.color}` }}
                                  >
                                    {char.name.slice(0, 1)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="font-bold text-xs text-white truncate">{char.name}</span>
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-900/80 text-purple-300 border border-purple-700">
                                        2周目 #{stintIdx + 1}
                                      </span>
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                      {stint.startTime.toFixed(1)}s ~ {stint.endTime.toFixed(1)}s
                                    </div>
                                  </div>
                                </div>
                                <span title="読取専用（自動反映）">
                                  <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                                </span>
                              </div>

                              {/* CT status badge */}
                              <div className="mt-1.5 text-[9px] font-mono">
                                {stint.actions.some(a => a.hasCTCollision) ? (
                                  <div className="text-red-400 font-bold flex items-center gap-1 bg-red-950/60 border border-red-800/80 rounded px-1.5 py-0.5">
                                    <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                                    <span>CT未回復あり</span>
                                  </div>
                                ) : (
                                  <div className="text-emerald-400 flex items-center gap-1 bg-emerald-950/40 border border-emerald-800/60 rounded px-1.5 py-0.5">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                    <span>CT全解消</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Sub-labels matching 1st-cycle structure */}
                            <div className="space-y-1 mt-2 text-[10px] font-mono text-slate-400 pl-0.5">
                              <div className="flex items-center justify-between text-purple-300 font-semibold truncate">
                                <span className="truncate">{stint.note || `${char.name}の行動 (2周目)`}</span>
                                <span className="shrink-0 text-slate-400 font-mono text-[9px]">
                                  {stint.duration.toFixed(1)}s
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-400 text-[9px]">
                                <span>時間帯</span>
                                <span className="font-mono">{stint.startTime.toFixed(1)}s ~ {stint.endTime.toFixed(1)}s</span>
                              </div>
                              {allStintSkillCDs.length > 0 && (
                                <div className="flex items-center justify-between text-sky-300 text-[9px] font-mono">
                                  <span>⏱️ スキルCT</span>
                                  <span>
                                    {stintCycle1SkillCDs.some(c => c.isCarryOver) && <span className="text-sky-400 text-[8px] mr-1">[持越あり]</span>}
                                    {formatSpanDurations(allStintSkillCDs)}
                                  </span>
                                </div>
                              )}
                              {allStintBurstCDs.length > 0 && (
                                <div className="flex items-center justify-between text-sky-300 text-[9px] font-mono">
                                  <span>⏱️ 爆発CT</span>
                                  <span>
                                    {stintCycle1BurstCDs.some(c => c.isCarryOver) && <span className="text-sky-400 text-[8px] mr-1">[持越あり]</span>}
                                    {formatSpanDurations(allStintBurstCDs)}
                                  </span>
                                </div>
                              )}
                              {stintBuffRows.length > 0 && (
                                <div className="space-y-0.5 pt-0.5 border-t border-slate-800/60">
                                  {stintBuffRows.map((bRow, rIdx) => (
                                    <div key={`c2_stint_buff_lbl_${stint.id}_${rIdx}`} className="flex items-center justify-between text-emerald-300 text-[9px] truncate font-mono" title={`【${bRow.tag} 2周目効果持続時間】\n${bRow.sample.name} (${bRow.sample.duration}s)\n${bRow.sample.description}`}>
                                      <span className="truncate flex items-center gap-1">
                                        <span className="text-emerald-400 font-bold shrink-0">{bRow.tag}</span>
                                        <span className="truncate">{bRow.cleanName}</span>
                                      </span>
                                      <span className="shrink-0 text-emerald-400/80 ml-1">{bRow.sample.duration.toFixed(0)}s</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Timeline Canvas for 2nd Cycle */}
                          <div 
                            className="relative flex-1 min-h-[95px] flex flex-col justify-around py-1 cursor-pointer"
                            onClick={handleTimelineClick}
                          >
                            {/* Background Vertical Grid Lines */}
                            {timelineTicks.map(t => (
                              <div
                                key={`grid_c2_${stint.id}_${t.absTime}`}
                                className={`absolute top-0 bottom-0 border-l pointer-events-none ${
                                  t.isZero ? 'border-purple-400/70' : t.isNegative ? 'border-amber-500/30' : 'border-slate-800/40'
                                }`}
                                style={{ left: `${t.absTime * pixelsPerSecond}px` }}
                              />
                            ))}

                            {/* --- Sublane 1: 2nd Cycle Stint & Actions --- */}
                            <div className="relative h-7 my-0.5">
                              {(() => {
                                const startX = stint.startTime * pixelsPerSecond;
                                const width = stint.duration * pixelsPerSecond;

                                return (
                                  <div
                                    className={`absolute h-7 rounded-lg flex items-center overflow-hidden border shadow-sm transition-all ${
                                      isStintCurrentlyOnField
                                        ? 'border-purple-400 ring-2 ring-purple-400/50 shadow-purple-500/20'
                                        : 'border-purple-800/70 hover:border-purple-500'
                                    }`}
                                    style={{
                                      left: `${startX}px`,
                                      width: `${width}px`,
                                      background: `linear-gradient(90deg, ${char.color}44, ${char.color}22)`,
                                    }}
                                  >
                                    {stint.actions.map((act) => {
                                      // 見た目は1周目のアクション要素と同じ（CT衝突時のみ警告表示を重ねる）
                                      const actStartX = (act.startTime - stint.startTime) * pixelsPerSecond;
                                      const actWidth = act.duration * pixelsPerSecond;
                                      const isSwap = act.type === 'swap' || (act as any).actionTypeId === 'action_switch_char';
                                      const isActActive = act.startTime <= activeTime && activeTime < act.endTime;

                                      return (
                                        <div
                                          key={act.id}
                                          style={{ left: `${actStartX}px`, width: `${actWidth}px` }}
                                          className={`absolute h-full flex items-center justify-center border-r border-slate-950/60 text-[10px] font-bold select-none transition-all ${
                                            act.hasCTCollision
                                              ? 'bg-red-950/90 text-white ring-2 ring-inset ring-red-500/80 animate-pulse'
                                              : isActActive
                                              ? 'bg-amber-400 text-slate-950 ring-1 ring-white'
                                              : act.isBurst
                                              ? 'bg-purple-600/90 text-white hover:brightness-110'
                                              : act.isSkill
                                              ? 'bg-sky-600/90 text-white hover:brightness-110'
                                              : 'bg-slate-800/80 text-slate-200 hover:brightness-110'
                                          }`}
                                          title={
                                            act.hasCTCollision
                                              ? `【⚠️ CT衝突エラー】1周目の発動CTが2周目の発動時点（${act.startTime.toFixed(2)}s）までに解消されていません！
残り待機時間: ${act.ctRemaining}s
アクション: ${act.name}`
                                              : isSwap
                                              ? `【2周目キャラ交代】
所要時間: ${act.duration.toFixed(2)}s
開始: ${act.startTime.toFixed(2)}s ~ 終了: ${act.endTime.toFixed(2)}s`
                                              : `【2周目アクション (読取専用)】
${act.name} (${act.duration.toFixed(2)}s)
開始: ${act.startTime.toFixed(2)}s ~ 終了: ${act.endTime.toFixed(2)}s
CT状態: ✅ 解消済み`
                                          }
                                        >
                                          <span className="truncate px-0.5 flex items-center gap-0.5">
                                            {act.hasCTCollision && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                                            {act.shortName}
                                            {act.hasCTCollision && (
                                              <span className="text-[9px] bg-red-600 text-white font-black px-1 rounded shadow ml-0.5 shrink-0">
                                                残{act.ctRemaining}s
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* --- Sublane 2: Skill (E) Cooldown Row (1st-cycle carryover/finished + 2nd-cycle new) --- */}
                            <div className="relative h-4 my-0.5">
                              {allStintSkillCDs.map((cd) => {
                                const isCarryOver = (cd as any).isCarryOver;
                                const isFinishedInCycle1 = (cd as any).isFinishedInCycle1;
                                const startX = cd.startTime * pixelsPerSecond;
                                const width = cd.duration * pixelsPerSecond;
                                const isCoolingDown = cd.startTime <= activeTime && activeTime < cd.endTime;
                                const remaining = Math.max(0, cd.endTime - activeTime);

                                return (
                                  <div
                                    key={`c2_skill_cd_${cd.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSeek(cd.startTime);
                                    }}
                                    style={{ left: `${startX}px`, width: `${width}px` }}
                                    className={`absolute h-3.5 rounded text-[9px] font-mono flex items-center px-1.5 border transition-all cursor-pointer select-none ${
                                      isFinishedInCycle1
                                        ? 'bg-sky-950/70 border-sky-600/70 text-sky-300 hover:border-sky-400'
                                        : isCarryOver
                                        ? 'bg-sky-950/95 border-sky-400 ring-1 ring-sky-400/50 text-sky-200 shadow-sm'
                                        : 'bg-sky-950 border-sky-400/90 text-sky-200 shadow-sm hover:border-sky-300'
                                    } ${isCoolingDown ? 'brightness-125 font-bold' : ''}`}
                                    title={
                                      isFinishedInCycle1
                                        ? `【1周目スキルCT (1周目中に解消済)】\nスキルCT (${cd.duration.toFixed(1)}s)\n期間: [${cd.startTime.toFixed(2)}s ~ ${cd.endTime.toFixed(2)}s] (クリックで開始位置へシーク)`
                                        : isCarryOver
                                        ? `【1周目からの持ち越しスキルCT】\nスキルCT (${cd.duration.toFixed(1)}s)\n期間: [${cd.startTime.toFixed(2)}s ~ ${cd.endTime.toFixed(2)}s]\n2周目開始時残り: ${(cd.endTime - cycle2Data.cycle2StartTime).toFixed(1)}s (クリックで開始位置へシーク)`
                                        : `【2周目スキルCT】${cd.duration.toFixed(1)}s [${cd.startTime.toFixed(1)}s ~ ${cd.endTime.toFixed(1)}s] (クリックで開始位置へシーク)`
                                    }
                                  >
                                    <span className="truncate">
                                      ⏱️ {isFinishedInCycle1
                                        ? `[1周目] E-CT ${cd.duration.toFixed(1)}s (解消済)`
                                        : isCarryOver
                                        ? `[1周目持越] E-CT (${(cd.endTime - cycle2Data.cycle2StartTime).toFixed(1)}s残)`
                                        : `E-CT ${cd.duration.toFixed(1)}s`} {isCoolingDown ? `(残${remaining.toFixed(1)}s)` : ''}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* --- Sublane 3: Burst (Q) Cooldown Row (1st-cycle carryover/finished + 2nd-cycle new) --- */}
                            <div className="relative h-4 my-0.5">
                              {allStintBurstCDs.map((cd) => {
                                const isCarryOver = (cd as any).isCarryOver;
                                const isFinishedInCycle1 = (cd as any).isFinishedInCycle1;
                                const startX = cd.startTime * pixelsPerSecond;
                                const width = cd.duration * pixelsPerSecond;
                                const isCoolingDown = cd.startTime <= activeTime && activeTime < cd.endTime;
                                const remaining = Math.max(0, cd.endTime - activeTime);

                                return (
                                  <div
                                    key={`c2_burst_cd_${cd.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSeek(cd.startTime);
                                    }}
                                    style={{ left: `${startX}px`, width: `${width}px` }}
                                    className={`absolute h-3.5 rounded text-[9px] font-mono flex items-center px-1.5 border transition-all cursor-pointer select-none ${
                                      isFinishedInCycle1
                                        ? 'bg-sky-950/70 border-sky-600/70 text-sky-300 hover:border-sky-400'
                                        : isCarryOver
                                        ? 'bg-sky-950/95 border-sky-400 ring-1 ring-sky-400/50 text-sky-200 shadow-sm'
                                        : 'bg-sky-950 border-sky-400/90 text-sky-200 shadow-sm hover:border-sky-300'
                                    } ${isCoolingDown ? 'brightness-125 font-bold' : ''}`}
                                    title={
                                      isFinishedInCycle1
                                        ? `【1周目元素爆発CT (1周目中に解消済)】\n爆発CT (${cd.duration.toFixed(1)}s)\n期間: [${cd.startTime.toFixed(2)}s ~ ${cd.endTime.toFixed(2)}s] (クリックで開始位置へシーク)`
                                        : isCarryOver
                                        ? `【1周目からの持ち越し元素爆発CT】\n爆発CT (${cd.duration.toFixed(1)}s)\n期間: [${cd.startTime.toFixed(2)}s ~ ${cd.endTime.toFixed(2)}s]\n2周目開始時残り: ${(cd.endTime - cycle2Data.cycle2StartTime).toFixed(1)}s (クリックで開始位置へシーク)`
                                        : `【2周目爆発CT】${cd.duration.toFixed(1)}s [${cd.startTime.toFixed(1)}s ~ ${cd.endTime.toFixed(1)}s] (クリックで開始位置へシーク)`
                                    }
                                  >
                                    <span className="truncate">
                                      ⏱️ {isFinishedInCycle1
                                        ? `[1周目] Q-CT ${cd.duration.toFixed(1)}s (解消済)`
                                        : isCarryOver
                                        ? `[1周目持越] Q-CT (${(cd.endTime - cycle2Data.cycle2StartTime).toFixed(1)}s残)`
                                        : `Q-CT ${cd.duration.toFixed(1)}s`} {isCoolingDown ? `(残${remaining.toFixed(1)}s)` : ''}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* --- Sublane 4+: 2nd Cycle Buff Rows (Each effect duration in its own independent row) --- */}
                            {stintBuffRows.map((bRow, rIdx) => (
                              <div key={`c2_buff_row_${stint.id}_${rIdx}`} className="relative h-4 my-0.5">
                                {bRow.spans.map((buff) => {
                                  const startX = buff.startTime * pixelsPerSecond;
                                  const width = Math.max(16, buff.duration * pixelsPerSecond);
                                  const isBuffActive = buff.startTime <= activeTime && activeTime < buff.endTime;
                                  const remaining = Math.max(0, buff.endTime - activeTime);

                                  return (
                                    <div
                                      key={`c2_buff_span_${buff.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSeek(buff.startTime);
                                      }}
                                      style={{ 
                                        left: `${startX}px`, 
                                        width: `${width}px`,
                                      }}
                                      className={`absolute h-3.5 rounded text-[9px] font-medium flex items-center px-1.5 border transition-all cursor-pointer select-none bg-emerald-950 border-emerald-400 text-emerald-100 shadow-sm hover:border-emerald-300 ${
                                        isBuffActive ? 'ring-1 ring-emerald-400 font-bold brightness-125' : 'opacity-90'
                                      }`}
                                      title={`【${bRow.tag} 2周目効果持続時間】\n${buff.name} (${buff.duration}s)\n期間: [${buff.startTime.toFixed(2)}s ~ ${buff.endTime.toFixed(2)}s] (クリックで開始位置へシーク)\n詳細: ${buff.description}`}
                                    >
                                      <span className="truncate">
                                        ✨ {bRow.tag} {buff.name.replace(/^[^:]+:\s*/, '')} ({buff.duration.toFixed(0)}s) {isBuffActive ? `[残${remaining.toFixed(1)}s]` : ''}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2nd Cycle Party Synergy Lane */}
                {cycle2Data.buffSynergyPoints.length > 0 && (
                  <div className="flex border-t border-purple-900/60 bg-slate-950/90 py-2">
                    <div className="w-[180px] shrink-0 px-3 border-r border-slate-800 flex flex-col justify-center sticky left-0 z-45 bg-slate-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                      <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>2周目 バフ重複度</span>
                      </span>
                      <span className="text-[10px] text-slate-400">1周目持ち越し+2周目バフ</span>
                    </div>

                    <div 
                      className="relative flex-1 h-8 flex items-center cursor-pointer"
                      onClick={handleTimelineClick}
                    >
                      {cycle2Data.buffSynergyPoints.map((pt, idx) => {
                        const x = pt.time * pixelsPerSecond;
                        const w = 0.5 * pixelsPerSecond;

                        return (
                          <div
                            key={idx}
                            style={{ 
                              left: `${x}px`, 
                              width: `${w}px`,
                              backgroundColor: pt.count === 0 
                                ? 'rgba(30, 41, 59, 0.3)' 
                                : pt.count >= 3 
                                ? 'rgba(234, 88, 12, 0.65)' 
                                : pt.count >= 2 
                                ? 'rgba(168, 85, 247, 0.55)' 
                                : 'rgba(14, 165, 233, 0.35)',
                            }}
                            className="absolute top-1 bottom-1 rounded-sm border-r border-slate-950/40 flex items-center justify-center text-[10px] font-mono text-white"
                            title={`${pt.time.toFixed(1)}s: 2周目有効バフ ${pt.count}個 [${pt.activeBuffs.join(', ')}]`}
                          >
                            {pt.count > 0 && <span className="font-bold text-[9px]">{pt.count}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* =========================================================================
                5. Vertical Handoff Connector Lines (交代スナップ垂直ガイド線)
                The user specifically highlighted:
                "前のキャラの登場期間終点と、次のキャラの登場期間始点の縦位置が重ならないよう一致していなければならない"
            ========================================================================= */}
            {showConnectors && handoffConnectors.map((conn, idx) => (
              <div
                key={`handoff_${idx}`}
                style={{ left: `${conn.xPos + 180}px` }}
                className="absolute top-9 bottom-0 w-0 border-l border-amber-400/70 border-dashed pointer-events-none z-10"
              >
                <span className="absolute -top-3 -translate-x-1/2 bg-amber-500 text-slate-950 text-[9px] font-bold px-1 rounded shadow">
                  {conn.snapTime.toFixed(1)}s
                </span>
              </div>
            ))}

            {/* =========================================================================
                5.5 Vertical Loop Boundary Guide Line (2周目以降ループ開始垂直線)
            ========================================================================= */}
            {loopStartTime > 0 && (
              <div
                style={{ left: `${loopStartTime * pixelsPerSecond + 180}px` }}
                className="absolute top-9 bottom-0 w-0 border-l-2 border-purple-400 border-dotted pointer-events-none z-25 shadow-lg"
              >
                <div className="absolute top-1/4 -translate-x-1/2 bg-purple-900/90 border border-purple-400 text-purple-200 text-[9px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                  🔁 2周目ループ対象区切 (0.00s基準 / {loopStartTime.toFixed(2)}s)
                </div>
              </div>
            )}

            {/* =========================================================================
                5.6 Vertical Cycle 1 Completion / Cycle 2 Loop Start Divider
            ========================================================================= */}
            {cycle2Data.enabled && (
              <div
                style={{ left: `${totalDuration * pixelsPerSecond + 180}px` }}
                className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-amber-400 pointer-events-none z-30 shadow-xl"
              >
                <div className="absolute top-1 -translate-x-1/2 bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded shadow-lg whitespace-nowrap flex items-center gap-1 border border-amber-300">
                  <span>🏁 1周目完了 ({fmtTime(totalDuration, 2)}) / 🔁 2周目開始</span>
                </div>
              </div>
            )}

            {/* =========================================================================
                6. Playhead Scrubber Laser (再生カーソル)
            ========================================================================= */}
            <div
              style={{ left: `${activeTime * pixelsPerSecond + 180}px` }}
              className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-400 via-yellow-300 to-amber-500 pointer-events-none z-40 shadow-lg shadow-amber-400/50"
            >
              <div className="absolute -top-1 -translate-x-1/2 w-3.5 h-3.5 bg-amber-400 rotate-45 border-2 border-slate-950 shadow" />
              <div className="absolute top-3 left-1 bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                {fmtTime(activeTime, 1)}
              </div>
            </div>

            {/* Hover Indicator */}
            {hoveredTime !== null && (
              <div
                style={{ left: `${hoveredTime * pixelsPerSecond + 180}px` }}
                className="absolute top-0 bottom-0 w-0 border-l border-sky-400/60 pointer-events-none z-39"
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
          </div>

          <div className="text-[11px] text-slate-400">
            ※ タイムライン上の任意の場所をクリックして再生位置をシークできます
          </div>
        </div>
      </div>
    </section>
  );
};
