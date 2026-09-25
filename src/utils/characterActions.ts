import { ActionDefinition, ActiveBuffSpan, CharacterActionInstance, CharacterConfig } from '../types/genshin';

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

// 出典ラベルから「継続時間」を除いた残りが、効果名として意味をなさないもの
const GENERIC_EFFECT_LABELS = new Set(['', '基礎', '最大', '長押し最大', '一回押し/長押し']);

/**
 * 効果バーの効果名。出典ラベル（例: 「ピルエット継続時間」「蘊種印の継続時間」）から「継続時間」と末尾の「の」を除く。
 * 残りが汎用語（「継続時間」「基礎継続時間」など）の場合は、アクション名のスキル名部分（「元素爆発: 心景幻成」→「心景幻成」）を使う
 */
function buildEffectLabel(sourceLabel: string | undefined, actionName: string): string {
  const label = (sourceLabel ?? '').replace(/継続時間$/, '').replace(/[の・]+$/, '').trim();
  if (!GENERIC_EFFECT_LABELS.has(label)) {
    // 凸アクション（アクション名末尾が「(n凸)」）は、元アクションの効果バーと区別できるよう効果名にも付ける
    const constellationTag = /\(\d凸\)$/.exec(actionName.trim())?.[0];
    return constellationTag ? `${label} ${constellationTag}` : label;
  }
  const skillName = (actionName.includes(':') ? actionName.split(':').slice(1).join(':') : actionName).trim();
  return skillName || '効果';
}

/**
 * 登録済みアクションの効果継続時間の情報。入力欄を出さないアクションは null
 * - 元素スキル / 元素爆発は常に対象（定義に値がなくても手で設定できる）
 * - それ以外のアクションは、定義に効果継続時間があるときだけ対象
 */
export function getActionEffectInfo(
  act: Pick<CharacterActionInstance, 'type' | 'effectDuration'>,
  def: ActionDefinition | undefined,
): { duration: number; defaultDuration: number; label: string } | null {
  if (act.type === 'swap' || act.type === 'wait') return null;
  const defaultDuration = def?.effectDuration && def.effectDuration > 0 ? def.effectDuration : 0;
  const isSkillOrBurst = act.type === 'burst' || SKILL_TYPES.has(act.type);
  if (!isSkillOrBurst && defaultDuration === 0 && act.effectDuration === undefined) return null;
  return {
    duration: act.effectDuration ?? defaultDuration,
    defaultDuration,
    label: buildEffectLabel(def?.dataSource?.effectDuration, def?.name ?? ''),
  };
}

/**
 * アクションの効果継続時間から、ガントチャートの効果バー（ActiveBuffSpan）を作る。効果時間が 0 なら null
 * buffId は「キャラ + アクション定義」ごとに固定なので、同じアクション由来のバーはバフ重複の集計で1つとして数えられる
 */
export function buildActionEffectSpan(
  char: Pick<CharacterConfig, 'id' | 'name' | 'color'>,
  act: CharacterActionInstance,
  def: ActionDefinition | undefined,
  startTime: number,
  idPrefix = 'effect',
): ActiveBuffSpan | null {
  const info = getActionEffectInfo(act, def);
  if (!info || !(info.duration > 0)) return null;
  const kind = act.type === 'burst' ? 'burst' : SKILL_TYPES.has(act.type) ? 'skill' : 'other';
  return {
    id: `${idPrefix}_${char.id}_${act.id}_${startTime}`,
    buffId: `effect_${kind}_${char.id}_${act.actionTypeId}`,
    name: `${char.name} ${act.shortName}: ${info.label}`,
    sourceCharacterId: char.id,
    sourceType: 'talent',
    startTime,
    endTime: startTime + info.duration,
    duration: info.duration,
    color: char.color,
    description: `${act.name}${def?.dataSource?.effectDuration ? `（${def.dataSource.effectDuration}）` : ''}`,
  };
}

/** 指定時刻に有効な効果バーを、同じアクション由来（buffId が同じ）は1つとして数える */
export function countDistinctActiveBuffs(buffs: ActiveBuffSpan[], time: number): { count: number; names: string[] } {
  const byId = new Map<string, string>();
  for (const b of buffs) {
    if (b.startTime <= time && b.endTime >= time && !byId.has(b.buffId)) byId.set(b.buffId, b.name);
  }
  return { count: byId.size, names: [...byId.values()] };
}

/** CT スパンの長さをまとめて表示する ("6.0s / 9.0s") */
export function formatSpanDurations(spans: { duration: number }[]): string {
  const unique = [...new Set(spans.map(s => s.duration))].sort((a, b) => a - b);
  return unique.map(v => `${v.toFixed(1)}s`).join(' / ');
}
