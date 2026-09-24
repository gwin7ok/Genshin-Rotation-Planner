import { CharacterConfig } from '../types/genshin';

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

/** CT スパンの長さをまとめて表示する ("6.0s / 9.0s") */
export function formatSpanDurations(spans: { duration: number }[]): string {
  const unique = [...new Set(spans.map(s => s.duration))].sort((a, b) => a - b);
  return unique.map(v => `${v.toFixed(1)}s`).join(' / ');
}
