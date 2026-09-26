import { CharacterConfig, Stint, ActionDefinition } from '../types/genshin';

/**
 * When a character is replaced by a new roster character in a party slot,
 * migrate all stints referencing oldCharId to newChar.
 */
export function migrateStintsToNewCharacter(
  stints: Stint[],
  oldCharId: string,
  newChar: CharacterConfig
): Stint[] {
  return stints.map(stint => {
    if (stint.characterId !== oldCharId) return stint;

    const burstDef = newChar.availableActions.find(a => a.type === 'burst');
    const skillDef = newChar.availableActions.find(a => a.type === 'skill' || a.type === 'skill_hold');
    const normalDef = newChar.availableActions.find(a => a.type === 'normal' || a.type === 'combo') || newChar.availableActions[0];

    const migratedActions = stint.actions.map(act => {
      let mappedDef: ActionDefinition | undefined;
      if (act.type === 'burst') {
        mappedDef = burstDef;
      } else if (act.type === 'skill' || act.type === 'skill_hold' || act.type === 'skill_reset') {
        mappedDef = skillDef;
      } else {
        mappedDef = normalDef;
      }
      if (!mappedDef) mappedDef = newChar.availableActions[0];

      return {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        actionTypeId: mappedDef.id,
        name: mappedDef.name,
        shortName: mappedDef.shortName,
        type: mappedDef.type,
        duration: mappedDef.defaultDuration,
      };
    });

    return {
      ...stint,
      characterId: newChar.id,
      note: stint.note ?? '',
      passiveTriggers: [], // 固有天賦はキャラ固有なので入れ替え時は外す
      actions: migratedActions.length > 0 ? migratedActions : [
        {
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          actionTypeId: normalDef.id,
          name: normalDef.name,
          shortName: normalDef.shortName,
          type: normalDef.type,
          duration: normalDef.defaultDuration,
        }
      ]
    };
  });
}

/** アクションID の「キャラキー_」より後ろ（例: "10000046-pyro_e" → "e"、旧形式 "hutao_e" → "e"） */
const actionSuffix = (actionTypeId: string) => actionTypeId.slice(actionTypeId.indexOf('_') + 1);

/**
 * 編成中のキャラを、DB（マスターデータ）の同じキャラの最新データで登録し直す。
 * - ユーザー設定（元素チャージ効率・武器・聖遺物・凸数）は残す
 * - 出場ブロックの登録済みアクションは、新しいデータの同じアクション（ID → ID末尾 → 種類+略称 → 種類の順で照合）へ付け替える。
 *   所要時間は、旧データの初期値のままなら新しい初期値に更新し、ユーザーが変えていればその値を残す
 * - 発動バフ（固有天賦）は、新しいデータに同じ効果があるものだけ残す
 * DB に無いキャラ・未設定スロットはそのまま
 */
export function refreshCharactersFromDatabase(
  characters: CharacterConfig[],
  stints: Stint[],
  databaseCharacters: CharacterConfig[],
): { characters: CharacterConfig[]; stints: Stint[]; refreshed: string[]; missing: string[] } {
  const refreshed: string[] = [];
  const missing: string[] = [];
  const oldById = new Map(characters.map(c => [c.id, c]));
  const newById = new Map<string, CharacterConfig>();

  const nextCharacters = characters.map(c => {
    if (c.id.startsWith('empty_slot_')) return c;
    const latest = databaseCharacters.find(d => d.id === c.id);
    if (!latest) {
      missing.push(c.name);
      return c;
    }
    const next: CharacterConfig = {
      ...latest,
      energyRecharge: c.energyRecharge,
      weaponName: c.weaponName,
      artifactSetName: c.artifactSetName,
      constellation: c.constellation,
    };
    newById.set(c.id, next);
    refreshed.push(c.name);
    return next;
  });

  const nextStints = stints.map(stint => {
    const oldChar = oldById.get(stint.characterId);
    const newChar = newById.get(stint.characterId);
    if (!oldChar || !newChar) return stint;
    const defs = newChar.availableActions;

    const actions = stint.actions.map(act => {
      if (act.type === 'swap' || act.actionTypeId === 'action_switch_char') return act;
      const def: ActionDefinition | undefined =
        defs.find(d => d.id === act.actionTypeId) ??
        defs.find(d => actionSuffix(d.id) === actionSuffix(act.actionTypeId)) ??
        defs.find(d => d.type === act.type && d.shortName === act.shortName) ??
        defs.find(d => d.type === act.type);
      if (!def) return act;
      const oldDef = oldChar.availableActions.find(d => d.id === act.actionTypeId);
      const keepUserDuration = oldDef ? act.duration !== oldDef.defaultDuration : false;
      return {
        ...act,
        actionTypeId: def.id,
        name: def.name,
        shortName: def.shortName,
        type: def.type,
        duration: keepUserDuration ? act.duration : def.defaultDuration,
      };
    });

    const passiveIds = new Set((newChar.passiveEffects ?? []).map(p => p.id));
    const passiveTriggers = (stint.passiveTriggers ?? []).filter(t => passiveIds.has(t.passiveEffectId));
    return { ...stint, actions, passiveTriggers };
  });

  return { characters: nextCharacters, stints: nextStints, refreshed, missing };
}
