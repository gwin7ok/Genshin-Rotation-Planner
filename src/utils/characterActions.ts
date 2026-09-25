import { ActionDefinition, CharacterActionInstance, CharacterConfig } from '../types/genshin';

const SKILL_TYPES = new Set(['skill', 'skill_hold', 'skill_reset']);

/** キャラのスキル/爆発アクションに設定された CT を "5s / 10s" の形でまとめる (未設定なら "-") */
export function formatCharacterCooldowns(char: CharacterConfig, kind: 'skill' | 'burst'): string {
  const values = char.availableActions
    .filter(a => (kind === 'burst' ? a.type === 'burst' : SKILL_TYPES.has(a.type)))
    .filter(a => (kind === 'burst' ? a.startsBurstCooldown !== false : a.startsSkillCooldown))
    .map(a => a.cooldown)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const unique = [...new Set(values)].sort((a, b) => a - b);
  return unique.length > 0 ? unique.map(v => `${v}s`).join(' / ') : '-';
}

/**
 * 登録済みアクションが開始する CT の情報。CT を開始しないアクションは null
 * - cooldown: 個別に変更された値があればそれ、なければアクション定義の値
 */
export function getActionCooldownInfo(
  act: Pick<CharacterActionInstance, 'type' | 'cooldown'>,
  def: ActionDefinition | undefined,
): { kind: 'skill' | 'burst'; cooldown: number; defaultCooldown: number } | null {
  if (!def || !(typeof def.cooldown === 'number' && def.cooldown > 0)) return null;
  const kind = act.type === 'burst' ? 'burst' : SKILL_TYPES.has(act.type) ? 'skill' : null;
  if (!kind) return null;
  const startsCooldown = kind === 'burst' ? def.startsBurstCooldown !== false : !!def.startsSkillCooldown;
  if (!startsCooldown) return null;
  return { kind, cooldown: act.cooldown ?? def.cooldown, defaultCooldown: def.cooldown };
}

/** CT スパンの長さをまとめて表示する ("6.0s / 9.0s") */
export function formatSpanDurations(spans: { duration: number }[]): string {
  const unique = [...new Set(spans.map(s => s.duration))].sort((a, b) => a - b);
  return unique.map(v => `${v.toFixed(1)}s`).join(' / ');
}
