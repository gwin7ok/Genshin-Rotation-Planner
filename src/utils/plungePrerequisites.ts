import type { ActionType, CharacterConfig, Stint } from '../types/genshin';
import {
  DEFAULT_PLUNGE_RULE, PLUNGE_RULES, XIANYUN_AIRBORNE_PLUNGES, XIANYUN_AIRBORNE_SECONDS, XIANYUN_ID,
  type PlungeRule,
} from '../data/plungeRules';

export interface PlungeWarning {
  stintId: string;
  characterId: string;
  actionId: string;
  time: number;
  message: string;
  actionName: string;
}

const isRealAction = (a: { type: ActionType; actionTypeId: string }) => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char';

/**
 * 落下攻撃が、gcsim で実行できる前提（data/plungeRules.ts）を満たしているか確認する。満たさないと、gcsim は実行エラーになる。
 * 直前のアクションは、同じ出場の中で、待機・交代をはさまない 1 つ前。閑雲の爆発バフ（16 秒・落下攻撃 8 回）は、パーティー全員にかかる。
 * 計算済みの出場（1 周目。startTime あり）を渡す。
 */
export function checkPlungePrerequisites(characters: CharacterConfig[], stints: Stint[]): PlungeWarning[] {
  void characters;

  interface Item { stint: Stint; actions: Stint['actions']; index: number; act: Stint['actions'][number]; time: number }
  const items: Item[] = [];
  for (const stint of stints) {
    const actions = stint.actions.filter(isRealAction);
    actions.forEach((act, index) => items.push({ stint, actions, index, act, time: act.startTime ?? 0 }));
  }
  items.sort((a, b) => a.time - b.time);

  let buffUntil = -Infinity;
  let plungesLeft = 0;
  const warnings: PlungeWarning[] = [];

  for (const { stint, actions, index, act, time } of items) {
    if (act.type === 'burst' && stint.characterId === XIANYUN_ID) {
      buffUntil = time + XIANYUN_AIRBORNE_SECONDS;
      plungesLeft = XIANYUN_AIRBORNE_PLUNGES;
      continue;
    }
    if (act.type !== 'plunge_low' && act.type !== 'plunge_high') continue;

    const prev = index > 0 ? actions[index - 1] : undefined;
    const buffActive = time <= buffUntil + 0.001 && plungesLeft > 0;
    const rules = PLUNGE_RULES[stint.characterId];
    const rule: PlungeRule = (act.type === 'plunge_low' ? rules?.low : rules?.high) ?? DEFAULT_PLUNGE_RULE;

    const byAction = !!prev && !!rule.after?.includes(prev.type);
    const bySkill = !!rule.skillInStint && actions.slice(0, index).some(a => a.type === 'skill' || a.type === 'skill_hold');
    const byAirborne = rule.airborne !== false && prev?.type === 'jump' && buffActive;
    if (buffActive) plungesLeft--;
    if (byAction || bySkill || byAirborne) continue;

    const kind = act.type === 'plunge_low' ? '低空落下攻撃' : '高空落下攻撃';
    const prevName = prev ? `「${prev.name}」` : 'なし（出場の最初、または待機・交代の直後）';
    warnings.push({
      stintId: stint.id,
      characterId: stint.characterId,
      actionId: act.id,
      time,
      actionName: act.name,
      message: `${kind}は、gcsim では「${rule.needs}」でないと実行エラーになります（直前のアクション: ${prevName}）`,
    });
  }
  return warnings;
}
