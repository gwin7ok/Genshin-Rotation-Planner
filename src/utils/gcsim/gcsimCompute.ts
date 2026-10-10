/**
 * gcsim の実行と、結果の書き戻しの計画（「gcsim で計算」ボタンと、設定文のポップアップの両方から使う。6-5 / D120）。
 *
 * - runGcsimForConfig: 設定文を実行（祭礼の種の探索を含む）し、ログを読み取り、CT待ち・アクションの対応を求める
 * - computeGcsimApply: 実行結果から、書き戻した後の出場ブロックと、変更の一覧を求める（アプリのデータは触らない）
 */
import type { GcsimConfigResult } from './buildGcsimConfig';
import { runGcsimSample, type GcsimLogEvent } from './gcsimClient';
import { runWithSacrificialSeed, type SacrificialSearchInfo } from './sacrificialSeed';
import { readGcsimLog, type GcsimLogSummary } from './readGcsimLog';
import { loadKeyCatalog } from './keyCatalogLookup';
import { mapCtWaitsToActions, type CtWaitMarks } from './mapCtWaits';
import { applyPassiveTriggers, applyCharacterLinkedEffects } from './applyBuffEffects';
import { CHARACTER_LINKED_EFFECTS } from '../../masterdata/characterLinkedEffects';
import type { TriggerableBuffDefinition } from '../buffUtils';
import {
  alignActions,
  applyActionDurations,
  applyActionCooldowns,
  applyActionEffectDurations,
  applyActionExtraEffects,
  type AlignResult,
} from './applyGcsimResult';
import type { ActionLinkTables } from '../../masterdata/actionGcsimLink';
import type { CalculatedRotation } from '../rotationCalculator';
import type { Stint } from '../../types/genshin';

/** 実行の乱数の種（祭礼リセットの種の探索は 6-4） */
export const DEFAULT_SEED = 1;

export interface GcsimRunOk {
  status: 'ok';
  summary: GcsimLogSummary;
  seed: number;
  sacrificial?: SacrificialSearchInfo;
  gcsimCommit?: string;
  waits: CtWaitMarks;
  align: AlignResult;
  /** gcsim の詳細ログ（反応の状態の読み取りに使う） */
  logs: GcsimLogEvent[];
}
export type GcsimRunOutcome = GcsimRunOk | { status: 'error' | 'unreachable'; message: string };

/** 設定文を実行して、ログを読み取る。実行前のチェック（アプリの CT 違反）は、呼び出し側で行う */
export async function runGcsimForConfig(result: GcsimConfigResult, calculated: CalculatedRotation): Promise<GcsimRunOutcome> {
  // 祭礼系の武器があれば、アプリの発動がすべて発動し、余分な発動が無い乱数の種を探す（6-4・D86。無ければ、最初の種で 1 回だけ実行）
  const res = await runWithSacrificialSeed(result.config, runGcsimSample, { appProcs: calculated.sacrificialProcs, refs: result.actionRefs }, DEFAULT_SEED);
  if (res.status !== 'ok') return { status: res.status, message: res.message };
  const catalog = await loadKeyCatalog();
  const summary = readGcsimLog(res.logs, { members: result.members, lookup: catalog.lookup, initialCharacterKey: res.initialCharacter });
  const waits = mapCtWaitsToActions(summary, result.actionRefs);
  const align = alignActions(summary, result.actionRefs);
  return { status: 'ok', summary, seed: res.seed, sacrificial: res.sacrificial, gcsimCommit: catalog.gcsimCommit, waits, align, logs: res.logs };
}

export interface GcsimApplyInput {
  stints: Stint[];
  calculated: CalculatedRotation;
  result: GcsimConfigResult;
  buffsByCharacter: Record<string, TriggerableBuffDefinition[]>;
  actionLinks: ActionLinkTables;
  outcome: GcsimRunOk;
}

/** 書き戻しの計画（各段の変更の一覧と、全部を反映した後の出場ブロック） */
export function computeGcsimApply(input: GcsimApplyInput) {
  const { stints, calculated, result, buffsByCharacter, actionLinks, outcome } = input;
  // 変更前は、画面に出ている値（計算後）を使う
  const effectiveDurations: Record<string, number> = {};
  for (const st of calculated.calculatedStints) for (const a of st.actions) effectiveDurations[a.id] = a.duration;
  const effectiveCooldowns: Record<string, number> = {};
  for (const cd of [...calculated.skillCooldowns, ...calculated.burstCooldowns]) {
    if (cd.actionInstanceId) effectiveCooldowns[cd.actionInstanceId] = cd.duration;
  }
  const durations = applyActionDurations(stints, outcome.align.pairs, effectiveDurations);
  const specialActionIds = new Set(calculated.calculatedStints.flatMap(st => st.actions).filter(a => a.cooldownPool === 'special').map(a => a.id));
  // 祭礼の武器を持つキャラのスキルの CT は、書き戻さない（発動による CT のリセットは、アプリの計算が持つ。書き戻すと、CT がすでに短く、
  // アプリの祭礼の計算がさらに短くしてしまうため）
  const sacrificialSkillIds = new Set(
    calculated.calculatedStints.filter(st => calculated.sacrificialCharIds.includes(st.characterId)).flatMap(st => st.actions).filter(a => a.type === 'skill' || a.type === 'skill_hold').map(a => a.id),
  );
  const cooldowns = applyActionCooldowns(durations.stints, outcome.align.pairs, outcome.summary, effectiveCooldowns, specialActionIds, calculated.cdResonanceScale, sacrificialSkillIds);
  const effectiveEffects: Record<string, number> = {};
  for (const b of calculated.activeBuffs) {
    if (b.origin === 'passive') continue;
    for (const a of stints.flatMap(st => st.actions)) {
      if (b.id.includes(`_${a.id}_`)) effectiveEffects[a.id] = b.duration;
    }
  }
  const effects = applyActionEffectDurations(cooldowns.stints, outcome.align.pairs, outcome.summary, actionLinks.effects, effectiveEffects);
  const extras = applyActionExtraEffects(effects.stints, outcome.align.pairs, outcome.summary, actionLinks.extras);
  const passives = applyPassiveTriggers(extras.stints, outcome.align.pairs, outcome.summary, result.members, buffsByCharacter, result.swapDelayFrames);
  const charEffects = applyCharacterLinkedEffects(passives.stints, outcome.align.pairs, outcome.summary, result.members, CHARACTER_LINKED_EFFECTS, result.swapDelayFrames);
  const total = durations.changes.length + cooldowns.changes.length + effects.changes.length + extras.changes.length + passives.changes.length + charEffects.changes.length;
  return { durations, cooldowns, effects, extras, passives, charEffects, total, stints: charEffects.stints };
}

export type GcsimApplyPlan = ReturnType<typeof computeGcsimApply>;

/** 書き戻しの内訳を 1 行にする（「gcsim で計算」の結果の表示用） */
export function summarizeApplyPlan(plan: GcsimApplyPlan): string {
  const parts = [
    `所要時間 ${plan.durations.changes.length} 件`,
    `スキル・爆発の CT ${plan.cooldowns.changes.length} 件`,
    `効果時間 ${plan.effects.changes.length} 件`,
    `副次効果 ${plan.extras.changes.length} 件`,
    `発動バフ ${plan.passives.changes.length} 件`,
    `キャラの効果 ${plan.charEffects.changes.length} 件`,
  ];
  return parts.join(' / ');
}

/** 書き戻しの内訳の行（「詳細」の表示用）。誰の（何番目の出場の）アクションかを付ける */
export function describeApplyPlan(plan: GcsimApplyPlan, stints: Stint[], members: { characterId: string; name: string }[]): string[] {
  const owner = (stintId: string) => {
    const idx = stints.findIndex(st => st.id === stintId);
    const name = idx >= 0 ? members.find(m => m.characterId === stints[idx].characterId)?.name : undefined;
    return `${name ?? '?'}（出場 #${idx + 1}）`;
  };
  const lines: string[] = [];
  for (const c of plan.durations.changes) lines.push(`所要時間 ${owner(c.stintId)} ${c.name}: ${c.before.toFixed(2)}s → ${c.after.toFixed(2)}s`);
  for (const c of plan.cooldowns.changes) lines.push(`CT ${owner(c.stintId)} ${c.name}: ${c.before.toFixed(1)}s → ${c.after.toFixed(1)}s`);
  for (const c of plan.effects.changes) lines.push(`効果時間 ${owner(c.stintId)} ${c.name}: ${c.before.toFixed(1)}s → ${c.after.toFixed(1)}s`);
  if (plan.extras.changes.length) lines.push(`副次効果のバー: ${plan.extras.changes.length} 件のアクション`);
  if (plan.passives.changes.length) lines.push(`発動バフ: ${plan.passives.changes.length} 件の追加・更新`);
  if (plan.charEffects.changes.length) lines.push(`キャラクターに紐づく効果: ${plan.charEffects.changes.length} 件の出場`);
  return lines;
}
