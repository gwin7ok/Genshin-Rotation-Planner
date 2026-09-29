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
