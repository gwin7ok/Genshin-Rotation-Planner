/**
 * プリセット編成（アプリに同梱する、5 編成。D207）。
 *
 * 元のデータは `src/data/presets/*.json`（アプリの「JSON 書き出し」と同じ形）。
 * 保存編成としての名前は、先頭に「[プリセット]」を付ける。
 *   - 初めて使うとき（保存編成の保存先がまだ無いとき）は、5 編成を保存編成に入れる（seedPresetsOnFirstRun）
 *   - 編成管理の「プリセットを復元する」で、いつでも入れ直せる（同じ名前の保存編成は、上書き）
 */
import type { CharacterConfig, PartyMember, SavedReactions, SavedRotationSlot, Stint } from '../types/genshin';
import { isEmptySlotCharacter } from '../data/characters';
import { charName } from '../i18n/loc';
import { STORAGE_KEYS, readString, writeJson } from './persistence';
import { findSlotByName, getSavedSlots, trySaveSlot } from './storage';
import { currentLanguage } from '../i18n';

import keqingIntensify from '../data/presets/keqing-intensify.json';
import furinaVaporize from '../data/presets/furina-vaporize.json';
import sandroneStellarConduct from '../data/presets/sandrone-stellar-conduct.json';
import raidenNational from '../data/presets/raiden-national.json';
import lunarBloom from '../data/presets/lunar-bloom.json';

/** 保存編成の名前の先頭（保存する名前。同じ名前の保存編成の上書きに使うので、表示の言語に関係なく日本語） */
export const PRESET_NAME_PREFIX = '[プリセット]';
/** 名前の先頭の、表示の言語の文字（英語のときは [Preset]） */
export const presetNamePrefixLabel = (): string => (currentLanguage === 'en' ? '[Preset]' : PRESET_NAME_PREFIX);

interface PresetFile {
  name: string;
  description?: string;
  party: PartyMember[];
  stints: Stint[];
  loopStartIndex?: number;
  loopStartTime?: number;
  totalDuration?: number;
  switchDelay?: number;
  reactions?: SavedReactions;
}

/** キー: 保存編成の ID の一部（preset_<キー>）。並びは、編成管理の表示順 */
/** en: 英語の表示用の名前・説明（D255。保存する名前は日本語のまま。表示のときに slotDisplayName などで選ぶ） */
const PRESET_FILES: { key: string; file: PresetFile; en: { name: string; description: string } }[] = [
  { key: 'keqing-intensify', file: keqingIntensify as unknown as PresetFile, en: { name: 'Aggravate Keqing', description: 'Keqing・Nahida・Kaedehara Kazuha・Fischl' } },
  { key: 'furina-vaporize', file: furinaVaporize as unknown as PresetFile, en: { name: 'Rolling Vaporize Furina (Revised)', description: 'Sayu・Furina・Xiangling・Citlali' } },
  { key: 'sandrone-stellar-conduct', file: sandroneStellarConduct as unknown as PresetFile, en: { name: 'Sandrone Stellar-Conduct', description: 'Odette・Yae Miko・Qiqi・Sandrone' } },
  { key: 'raiden-national', file: raidenNational as unknown as PresetFile, en: { name: 'Raiden National', description: 'Raiden Shogun・Xingqiu・Bennett・Xiangling' } },
  { key: 'lunar-bloom', file: lunarBloom as unknown as PresetFile, en: { name: 'Bountiful Lunar-Bloom', description: 'Nahida・Nilou・Columbina・Lauma' } },
];

/** 保存されている名前が、プリセットの名前のまま（ユーザーが変えていない）なら、そのプリセット */
const presetOfSlot = (slot: { name: string }) => PRESET_FILES.find(p => slot.name === `${PRESET_NAME_PREFIX}${p.file.name}`);

/** 保存編成の表示名（3-6）。プリセットの名前のままなら、表示の言語の名前。それ以外は保存されている名前 */
export function slotDisplayName(slot: { name: string }): string {
  const preset = currentLanguage === 'en' ? presetOfSlot(slot) : undefined;
  return preset ? `${presetNamePrefixLabel()} ${preset.en.name}` : slot.name;
}

/**
 * 保存編成の説明の表示。プリセットの説明のままなら、表示の言語の説明。
 * 保存したときに自動で付けた説明（編成のキャラ名を「・」でつないだもの。保存したときの言語）のままなら、いまの言語のキャラ名で作り直す。
 * それ以外（ユーザーが書いた説明）は、そのまま
 */
export function slotDisplayDescription(
  slot: { name: string; description?: string; party?: PartyMember[] },
  dbCharacters: CharacterConfig[] = [],
): string | undefined {
  const preset = currentLanguage === 'en' ? presetOfSlot(slot) : undefined;
  if (preset && slot.description === preset.file.description) return preset.en.description;
  const members = (slot.party ?? []).map(m => dbCharacters.find(c => c.id === m.characterId)).filter((c): c is CharacterConfig => !!c && !isEmptySlotCharacter(c));
  if (!slot.description || members.length === 0) return slot.description;
  const autoJa = members.map(c => c.name).join('・');
  const autoEn = members.map(c => c.en?.name || c.englishName || c.name).join('・');
  return slot.description === autoJa || slot.description === autoEn ? members.map(c => charName(c)).join('・') : slot.description;
}

export const PRESET_COUNT = PRESET_FILES.length;

/** プリセットを、保存編成の形にする（毎回、データのコピーを作る） */
export function buildPresetSlots(now: Date = new Date()): SavedRotationSlot[] {
  return PRESET_FILES.map(({ key, file }) => {
    const copy = structuredClone(file);
    return {
      id: `preset_${key}`,
      name: `${PRESET_NAME_PREFIX}${copy.name}`,
      description: copy.description,
      updatedAt: now.toISOString(),
      party: copy.party,
      stints: copy.stints,
      loopStartIndex: copy.loopStartIndex,
      loopStartTime: copy.loopStartTime ?? 0,
      totalDuration: copy.totalDuration ?? 0,
      switchDelay: copy.switchDelay,
      ...(copy.reactions ? { reactions: copy.reactions } : {}),
    };
  });
}

export interface RestorePresetsResult {
  slots: SavedRotationSlot[];
  /** 新しく入れた数 */
  added: number;
  /** 同じ名前の保存編成を上書きした数 */
  overwritten: number;
  /** false のとき、途中で保存できなかった（容量超過など）。added・overwritten は、保存できた分だけ */
  ok: boolean;
}

/**
 * プリセットを、保存編成に入れ直す。同じ名前の保存編成は、上書きする（ID は、既存のものを引き継ぐ）。
 * 名前が無いものは、新しく入れる（ID は preset_<キー>。すでに別の名前で使われているときは、日時を付ける）。
 */
export function restorePresets(now: Date = new Date()): RestorePresetsResult {
  let slots = getSavedSlots();
  let added = 0;
  let overwritten = 0;
  let ok = true;
  // 先頭に入れるので、逆順に処理して、編成管理の表示順を、定義の並びにする
  for (const preset of [...buildPresetSlots(now)].reverse()) {
    const dup = findSlotByName(slots, preset.name);
    const target = dup
      ? { ...preset, id: dup.id }
      : { ...preset, id: slots.some(s => s.id === preset.id) ? `${preset.id}_${now.getTime()}` : preset.id };
    const result = trySaveSlot(target);
    slots = result.slots;
    if (!result.ok) {
      ok = false;
      break;
    }
    if (dup) overwritten += 1;
    else added += 1;
  }
  return { slots, added, overwritten, ok };
}

/**
 * 初めて使うとき（保存編成の保存先が、まだ無いとき）だけ、プリセットを保存編成に入れる。
 * 保存先がある（一度でも保存した・全部削除した）ときは、何もしない。
 */
export function seedPresetsOnFirstRun(now: Date = new Date()): boolean {
  if (readString(STORAGE_KEYS.savedSlots) !== null) return false;
  return writeJson(STORAGE_KEYS.savedSlots, buildPresetSlots(now));
}
