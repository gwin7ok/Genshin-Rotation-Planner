import { ActionDefinition, CharacterConfig } from '../types/genshin';

/**
 * 旧形式 (キャラ単位に skillCooldown / burstCooldown 等を持ち、エネルギー・粒子数を持つ) のキャラデータを
 * 現行形式 (CT・効果継続時間をアクションごとに持つ) に変換する。
 * localStorage に保存済みのローテーション・DB や、書き出し済み JSON の読み込みで使う。
 */

interface LegacyCharacterLevel {
  skillCooldown?: number;
  skillDuration?: number;
  burstCooldown?: number;
  burstDuration?: number;
}

const SKILL_TYPES = new Set(['skill', 'skill_hold', 'skill_reset']);

function migrateLegacyAction(raw: Record<string, any>, charLevel: LegacyCharacterLevel): ActionDefinition {
  const {
    energyCost, particlesGenerated, customSkillCT,
    skillCooldown, skillDuration, burstCooldown, burstDuration,
    startupFrames, totalFrames, cancelableFrames,
    ...rest
  } = raw;
  const action = rest as ActionDefinition;

  if (SKILL_TYPES.has(action.type)) {
    const cooldown = action.cooldown ?? skillCooldown ?? customSkillCT ?? charLevel.skillCooldown;
    return {
      ...action,
      cooldown,
      effectDuration: action.effectDuration ?? skillDuration ?? charLevel.skillDuration,
      // 旧計算ではスキル系は常に CT を開始していた
      startsSkillCooldown: action.startsSkillCooldown ?? (cooldown ?? 0) > 0,
    };
  }
  if (action.type === 'burst') {
    return {
      ...action,
      cooldown: action.cooldown ?? burstCooldown ?? charLevel.burstCooldown,
      effectDuration: action.effectDuration ?? burstDuration ?? charLevel.burstDuration,
      startsBurstCooldown: action.startsBurstCooldown ?? true,
    };
  }
  return action;
}

export function isLegacyCharacter(raw: Record<string, any>): boolean {
  const legacyCharKeys = ['skillCooldown', 'burstCooldown', 'burstEnergyCost', 'skillParticles', 'frameData'];
  const legacyActionKeys = ['customSkillCT', 'energyCost', 'particlesGenerated', 'skillCooldown', 'burstCooldown', 'totalFrames'];
  return legacyCharKeys.some(k => k in raw)
    || (raw.availableActions ?? []).some((a: Record<string, any>) => legacyActionKeys.some(k => k in a));
}

export function migrateLegacyCharacter(raw: Record<string, any>): CharacterConfig {
  if (!isLegacyCharacter(raw)) return raw as CharacterConfig;
  const {
    skillCooldown, skillDuration, burstCooldown, burstDuration,
    burstEnergyCost, skillParticles, frameData,
    ...rest
  } = raw;
  const charLevel = { skillCooldown, skillDuration, burstCooldown, burstDuration };
  return {
    ...(rest as CharacterConfig),
    availableActions: (raw.availableActions ?? []).map((a: Record<string, any>) => migrateLegacyAction(a, charLevel)),
  };
}
