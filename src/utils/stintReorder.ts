import { CharacterConfig, Stint, ActionDefinition } from '../types/genshin';

/**
 * Swaps stint positions of character A and character B in the timeline sequence.
 * This ensures the horizontal axis (appearance order) reflects the swap between two characters.
 */
export function swapStintsForCharacters(
  stints: Stint[],
  charIdA: string,
  charIdB: string
): Stint[] {
  if (charIdA === charIdB) return stints;

  const next = [...stints];
  const indicesA: number[] = [];
  const indicesB: number[] = [];

  next.forEach((s, idx) => {
    if (s.characterId === charIdA) indicesA.push(idx);
    if (s.characterId === charIdB) indicesB.push(idx);
  });

  if (indicesA.length > 0 && indicesB.length > 0) {
    // If both have stints, swap their positions in the array
    const minLen = Math.min(indicesA.length, indicesB.length);
    for (let k = 0; k < minLen; k++) {
      const idxA = indicesA[k];
      const idxB = indicesB[k];
      const temp = next[idxA];
      next[idxA] = next[idxB];
      next[idxB] = temp;
    }

    // If one character has more stints than the other, ensure relative ordering
    if (indicesA.length !== indicesB.length) {
      // Re-evaluate to maintain neat grouped flow
      const orderMap = new Map<string, number>();
      // Whichever index was earlier now takes precedence
      const firstA = Math.min(...indicesA);
      const firstB = Math.min(...indicesB);
      orderMap.set(charIdA, firstB);
      orderMap.set(charIdB, firstA);
    }
  }

  return next;
}

/**
 * Stably aligns stints so that characters appear in the same order as the 4 party slots:
 * Slot 1's stints come first, then Slot 2's, then Slot 3's, then Slot 4's.
 */
export function alignStintsToCharacterOrder(
  stints: Stint[],
  characters: CharacterConfig[]
): Stint[] {
  const orderMap = new Map<string, number>();
  characters.forEach((c, idx) => orderMap.set(c.id, idx));

  // Stably sort stints by character slot order
  return [...stints].sort((a, b) => {
    const orderA = orderMap.get(a.characterId) ?? 99;
    const orderB = orderMap.get(b.characterId) ?? 99;
    return orderA - orderB;
  });
}

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
      note: `${newChar.name}の出場`,
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
