import type { CharacterConfig, Stint } from '../types/genshin';

import { type SacrificialProc, type CalculatedRotation, type RotationOptions } from './rotation/types';
import { type StockLog, buildStockSpans } from './rotation/stockSpans';
import { buildBuffOverlapSegments, buildCarryOver, endAtNextStart } from './rotation/loopWrap';
import { checkCooldownViolations } from './rotation/cooldownCheck';
import { addModeEndCooldowns, warnGcsimUnsupportedActions, warnPlungePrerequisites, addStateBars, addSacrificialPassiveSpans, applyNightsoulBurstInterval } from './rotation/postProcess';
import { createRotationState } from './rotation/state';
import { beginStint, finishStint } from './rotation/stintFlow';
import { processAction } from './rotation/actionFlow';
export type { BuffOverlapSegment, SacrificialProc, CalculatedRotation, RotationOptions } from './rotation/types';

export function calculateRotation(
  characters: CharacterConfig[],
  inputStints: Stint[],
  options?: RotationOptions
): CalculatedRotation {
  const state = createRotationState(characters, inputStints, options);
  const {
    rawStints, switchDelay, loopStartIndex, characterMap, calculatedStints, activeBuffs, skillCooldowns, burstCooldowns, validationIssues, passiveSpans,
    ctEvents, charStates, cdResonanceScale, modeWindows, retiredModes, layerEventsByChar,
    totemLifetime, totemMax, totemBursts, sacrificialOf,
  } = state;

  // 1. Process Stints and Actions in strict chronological order
  for (let sIdx = 0; sIdx < rawStints.length; sIdx++) {
    const sc = beginStint(state, sIdx);
    if (!sc) continue;

    for (let aIdx = 0; aIdx < sc.rawActions.length; aIdx++) processAction(state, sc, aIdx);

    finishStint(state, sc);
  }

  addModeEndCooldowns({ retiredModes, modeWindows, ctEvents, skillCooldowns, charStates, switchDelay });

  const totalDuration = Number(state.currentTime.toFixed(2));
  warnGcsimUnsupportedActions({ characters, calculatedStints, validationIssues });

  warnPlungePrerequisites({ characters, calculatedStints, validationIssues });

  const safeLoopStartIndex = Math.min(loopStartIndex, Math.max(0, calculatedStints.length - 1));
  const loopStartTime = calculatedStints[safeLoopStartIndex]?.startTime ?? 0;
  const loopPeriod = Math.max(0, totalDuration - loopStartTime);

  addStateBars({ characters, activeBuffs, layerEventsByChar });

  // CT違反の判定（1周目・2周目を区別せず、ループを必要な周数だけ並べた時間軸で時刻順に判定）
  // 2 回分の CT を持つ特殊スキル（ファルカ）のバーは、判定のキューで CT が始まった時点に作られる
  // 使用者が場にいるか（祭礼の発動の条件）。時刻 t が 1 周目の終わりを過ぎたら、ループの区間に折り返して見る
  const stintIntervals = new Map<string, Array<[number, number]>>();
  for (const st of calculatedStints) {
    const list = stintIntervals.get(st.characterId) ?? [];
    list.push([st.startTime, st.endTime]);
    stintIntervals.set(st.characterId, list);
  }
  const isActiveAt = (charId: string, t: number): boolean => {
    let tt = t;
    if (loopPeriod > 0.05) while (tt >= totalDuration - 1e-6 && tt - loopPeriod >= loopStartTime - 1e-6) tt -= loopPeriod;
    return (stintIntervals.get(charId) ?? []).some(([s0, e0]) => tt >= s0 - 1e-6 && tt < e0 - 1e-6);
  };
  const sacrificialProcs: SacrificialProc[] = [];
  const stockLogs: StockLog[] = [];
  const usedSpecialCharged = new Set<string>();
  for (const span of checkCooldownViolations(ctEvents, safeLoopStartIndex, loopPeriod, isActiveAt, sacrificialProcs, stockLogs, usedSpecialCharged)) {
    skillCooldowns.push(span);
    charStates[span.characterId]?.skillCooldowns.push(span);
  }
  // 特殊スキルの回数を使って特殊重撃（蒼牙）になった重撃に印を付ける
  if (usedSpecialCharged.size > 0) {
    for (const st of calculatedStints) for (const a of st.actions) if (usedSpecialCharged.has(a.id)) a.usedSpecialCharge = true;
  }

  const stockSpans = buildStockSpans(stockLogs, totalDuration, loopStartTime, loopPeriod);

  addSacrificialPassiveSpans({ sacrificialProcs, characterMap, database: options?.database, calculatedStints, passiveSpans });

  applyNightsoulBurstInterval({ characters, characterMap, passiveSpans, validationIssues });

  // 同じ効果を再発動したら、前の発動の効果はそこで終わる（残りは上書きされる）
  endAtNextStart(activeBuffs, b => (b.stackable ? `${b.buffId}#${b.id}` : b.buffId));
  endAtNextStart(passiveSpans, p => `${p.characterId}:${p.effectGroup}`);

  const { carryOverCooldowns, carryOverBuffs, carryOverPassives } = buildCarryOver({ skillCooldowns, burstCooldowns, activeBuffs, passiveSpans, totalDuration, loopStartTime, loopPeriod, totemLifetime, totemMax, totemBursts });

  // バフ重複行: 1周目は折り返し部分をまだ数えず、2周目以降は数える
  const buffOverlapSegments = buildBuffOverlapSegments(activeBuffs, totalDuration);
  const loopedBuffOverlapSegments = buildBuffOverlapSegments([...activeBuffs, ...carryOverBuffs], totalDuration);

  return {
    stockSpans,
    sacrificialProcs,
    sacrificialCharIds: characters.filter(c => sacrificialOf(c)).map(c => c.id),
    cdResonanceScale,
    totalDuration,
    calculatedStints,
    activeBuffs,
    skillCooldowns,
    burstCooldowns,
    characterStates: charStates,
    validationIssues,
    buffOverlapSegments,
    loopedBuffOverlapSegments,
    passiveSpans,
    carryOverCooldowns,
    carryOverBuffs,
    carryOverPassives,
    loopStartTime,
    loopPeriod,
  };
}
