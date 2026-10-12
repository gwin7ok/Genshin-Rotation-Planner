import { CharacterConfig, PartyMember, Stint, SavedRotationSlot } from '../types/genshin';
import { isEmptySlotCharacter } from '../data/characters';
import { STORAGE_KEYS, readJson, removeKey, writeJson } from './persistence';

export interface ActiveRotationState {
  /** 編成（キャラの ID と編成ごとの設定） */
  party: PartyMember[];
  stints: Stint[];
  /** 2周目ループの開始位置（何番目の出場キャラの前か。0始まり、0=基準なし） */
  loopStartIndex?: number;
  /** 旧形式のループ基準（秒）。読込時に loopStartIndex へ変換する */
  loopStartTime?: number;
  switchDelay?: number;
  /** 現在読み込んでいるユーザー保存編成（スロット）のID */
  activeSlotId?: string | null;
  lastSavedAt: string;
  customName?: string;
}

/**
 * 現在編集中の編成を保存する（自動保存。保存先は persistence.ts）
 */
export function saveActiveState(state: Omit<ActiveRotationState, 'lastSavedAt'>): void {
  const payload: ActiveRotationState = {
    ...state,
    lastSavedAt: new Date().toISOString(),
  };
  writeJson(STORAGE_KEYS.activeRotation, payload);
}

/**
 * 保存してある、編集中の編成を読む
 */
export function loadActiveState(): ActiveRotationState | null {
  const parsed = readJson<Partial<ActiveRotationState>>(STORAGE_KEYS.activeRotation);
  if (parsed && Array.isArray(parsed.party) && Array.isArray(parsed.stints)) {
    return parsed as ActiveRotationState;
  }
  return null;
}

/**
 * 編集中の編成の保存を消す（初期状態に戻す）
 */
export function clearActiveState(): void {
  removeKey(STORAGE_KEYS.activeRotation);
}

/**
 * 保存編成（スロット）の一覧を読む
 */
export function getSavedSlots(): SavedRotationSlot[] {
  const list = readJson<unknown>(STORAGE_KEYS.savedSlots);
  if (!Array.isArray(list)) return [];
  // 旧形式（キャラを丸ごと持つ）の保存編成は読み込まない（D13）
  return (list as SavedRotationSlot[])
    .filter(slot => Array.isArray(slot.party))
    .map(slot => ({ ...slot, stints: slot.stints ?? [] }));
}

/**
 * 保存編成を、追加または更新する
 */
export function saveSlot(slot: SavedRotationSlot): SavedRotationSlot[] {
  const current = getSavedSlots();
  const existingIdx = current.findIndex(s => s.id === slot.id);
  const stamped = { ...slot, updatedAt: new Date().toISOString() };
  let updated: SavedRotationSlot[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = stamped;
  } else {
    updated = [stamped, ...current];
  }
  return writeJson(STORAGE_KEYS.savedSlots, updated) ? updated : getSavedSlots();
}

/**
 * 保存編成の一覧を、そのまま置き換える（バックアップの復元用。更新日時は書き換えない）
 */
export function replaceSavedSlots(slots: SavedRotationSlot[]): void {
  writeJson(STORAGE_KEYS.savedSlots, slots);
}

/**
 * 保存編成を削除する
 */
export function deleteSlot(slotId: string): SavedRotationSlot[] {
  const updated = getSavedSlots().filter(s => s.id !== slotId);
  return writeJson(STORAGE_KEYS.savedSlots, updated) ? updated : getSavedSlots();
}

/**
 * 「名前をつけて保存」の初期編成名
 * - 保存スロットを読み込み中ならその保存編成名
 * - 未保存なら「編成キャラ名（ローテーション時間）」（未設定スロットは除く）
 */
export function buildDefaultSlotName(
  characters: CharacterConfig[],
  totalDuration: number,
  activeSlot?: SavedRotationSlot | null,
): string {
  if (activeSlot) return activeSlot.name;
  return `${buildPartyMemberNames(characters)} (${totalDuration.toFixed(1)}s)`;
}

/** 編成メンバー名を「・」でつないだ文字列（未設定スロットは除く） */
export function buildPartyMemberNames(characters: CharacterConfig[]): string {
  return characters.filter(c => !isEmptySlotCharacter(c)).map(c => c.name).join('・');
}

/** 編成名の同一判定用に正規化（前後空白・全角半角・大文字小文字の違いを無視） */
export function normalizeSlotName(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase();
}

/** 同じ編成名（正規化して一致）の保存スロットを探す */
export function findSlotByName(slots: SavedRotationSlot[], name: string): SavedRotationSlot | undefined {
  const key = normalizeSlotName(name);
  return slots.find(s => normalizeSlotName(s.name) === key);
}
