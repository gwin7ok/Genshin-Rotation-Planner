import type { RotationState } from './state';
import type { ActionContext, StintContext } from './context';
import { detectModeContext, applyModeEnderAndRepress, updateModeGaugesAndDrain } from './modePhases';
import { selectFrames, resolveDuration, buildComputedAction } from './durationPhases';
import { computeCooldown, registerCooldownEvents, openMode, applySpecialRules } from './cooldownPhases';
import { applySpecialWindows, buildEffectBars, buildSideEffects, advanceClock } from './effectPhases';

/** 1 つのアクションの計算（段階ごとの関数を順に呼ぶ。段階から次の段階への受け渡しは ActionContext） */
export function processAction(state: RotationState, sc: StintContext, aIdx: number): void {
  const { rawActions, charActions } = sc;
  const act = rawActions[aIdx];
  const actionStartTime = state.currentTime;
  // CT・効果継続時間はアクション定義ごとに持つ（凸の変更を適用済み）
  const actionDef = charActions.find(a => a.id === act.actionTypeId);
  const ac = { aIdx, act, actionStartTime, actionDef } as ActionContext;
  detectModeContext(state, sc, ac);
  applyModeEnderAndRepress(state, sc, ac);
  updateModeGaugesAndDrain(state, sc, ac);
  selectFrames(state, sc, ac);
  resolveDuration(state, sc, ac);
  buildComputedAction(state, sc, ac);
  computeCooldown(state, sc, ac);
  registerCooldownEvents(state, sc, ac);
  openMode(state, sc, ac);
  applySpecialRules(state, sc, ac);
  applySpecialWindows(state, sc, ac);
  buildEffectBars(state, sc, ac);
  buildSideEffects(state, sc, ac);
  advanceClock(state, sc, ac);
}
