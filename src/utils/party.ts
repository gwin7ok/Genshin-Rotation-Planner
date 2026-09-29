import { CharacterConfig, PartyMember, Stint } from '../types/genshin';
import { EMPTY_SLOT_ID_PREFIX, createEmptySlotCharacter, isEmptySlotCharacter } from '../data/characters';

export const PARTY_SIZE = 4;

/** 未設定枠（slotIndex は 0 始まり） */
export const createEmptyMember = (slotIndex: number): PartyMember => ({
  characterId: `${EMPTY_SLOT_ID_PREFIX}${slotIndex + 1}`,
  energyRecharge: 100,
});

export const createEmptyParty = (): PartyMember[] =>
  Array.from({ length: PARTY_SIZE }, (_, i) => createEmptyMember(i));

export const isEmptyMember = (m: Pick<PartyMember, 'characterId'>): boolean =>
  isEmptySlotCharacter({ id: m.characterId });

/**
 * 編成（ID と編成ごとの設定）を、DB のキャラと合わせた表示・計算用のキャラに解決する。
 * 未設定枠と、DB に無いキャラを参照している枠は未設定枠になる（保存データの characterId は変えない）。
 */
export function resolvePartyCharacters(
  party: PartyMember[],
  databaseCharacters: CharacterConfig[],
): CharacterConfig[] {
  const byId = new Map(databaseCharacters.map(c => [c.id, c]));
  return party.map((m, i) => {
    const dbChar = isEmptyMember(m) ? undefined : byId.get(m.characterId);
    if (!dbChar) {
      return { ...createEmptySlotCharacter(i), energyRecharge: m.energyRecharge ?? 100 };
    }
    return {
      ...dbChar,
      energyRecharge: m.energyRecharge,
      weaponId: m.weaponId,
      weaponRefinementRank: m.weaponRefinementRank,
      artifactSetId: m.artifactSetId,
      artifactSetMode: m.artifactSetMode,
      constellation: m.constellation,
    };
  });
}

/** 解決後のキャラの ID（DB に無い枠は未設定枠の ID になる） */
export const resolvedCharacterIds = (characters: CharacterConfig[]): Set<string> =>
  new Set(characters.map(c => c.id));

/** 解決後の編成に無いキャラの出場ブロックを除く（DB に無いキャラの出場ブロックは計算・表示に出さない） */
export const filterStintsForCharacters = (stints: Stint[], characters: CharacterConfig[]): Stint[] => {
  const ids = resolvedCharacterIds(characters);
  return stints.filter(s => ids.has(s.characterId));
};

/**
 * 編集後の出場ブロック（表示中のキャラの分）に、DB に無いキャラの出場ブロックを足し戻す。
 * 足し戻すのは、編成がまだそのキャラの ID を参照しているものだけ（DB に戻れば復活する）。
 */
export function mergeHiddenStints(
  edited: Stint[],
  allStints: Stint[],
  characters: CharacterConfig[],
  party: PartyMember[],
): Stint[] {
  const visibleIds = resolvedCharacterIds(characters);
  const referenced = new Set(party.map(m => m.characterId));
  const hidden = allStints.filter(s => !visibleIds.has(s.characterId) && referenced.has(s.characterId));
  return hidden.length === 0 ? edited : [...edited, ...hidden];
}
