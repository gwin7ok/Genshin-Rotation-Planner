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
 * DB に無いキャラを参照している枠を未設定枠に置き換える（DB管理でのキャラ削除時）。
 * 置き換えた枠のキャラの出場ブロックは除く。
 */
export function dropMissingMembers(
  party: PartyMember[],
  stints: Stint[],
  databaseCharacters: CharacterConfig[],
): { party: PartyMember[]; stints: Stint[]; changed: boolean } {
  const validIds = new Set(databaseCharacters.map(c => c.id));
  const removed = new Set<string>();
  const next = party.map((m, i) => {
    if (isEmptyMember(m) || validIds.has(m.characterId)) return m;
    removed.add(m.characterId);
    return createEmptyMember(i);
  });
  if (removed.size === 0) return { party, stints, changed: false };
  return { party: next, stints: stints.filter(s => !removed.has(s.characterId)), changed: true };
}
