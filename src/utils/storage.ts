import { CharacterConfig, Stint, SavedRotationSlot } from '../types/genshin';
import { migrateLegacyCharacter } from './legacyMigration';
import { isEmptySlotCharacter } from '../data/characters';

const ACTIVE_ROTATION_KEY = 'genshin_rotation_current_state_v2';
const SAVED_SLOTS_KEY = 'genshin_rotation_saved_slots_v2';

export interface ActiveRotationState {
  characters: CharacterConfig[];
  stints: Stint[];
  selectedPresetId: string;
  loopStartTime: number;
  switchDelay?: number;
  actionDelay?: number;
  /** 現在読み込んでいるユーザー保存編成（スロット）のID */
  activeSlotId?: string | null;
  lastSavedAt: string;
  customName?: string;
}

/**
 * Save current active working state to localStorage
 */
export function saveActiveState(state: Omit<ActiveRotationState, 'lastSavedAt'>): void {
  try {
    const payload: ActiveRotationState = {
      ...state,
      lastSavedAt: new Date().toISOString(),
    };
    localStorage.setItem(ACTIVE_ROTATION_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to auto-save rotation to localStorage:', e);
  }
}

/**
 * Load saved active working state from localStorage
 */
export function loadActiveState(): ActiveRotationState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ROTATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.characters) && Array.isArray(parsed.stints)) {
      return { ...parsed, characters: parsed.characters.map(migrateLegacyCharacter) } as ActiveRotationState;
    }
  } catch (e) {
    console.warn('Failed to load active rotation from localStorage:', e);
  }
  return null;
}

/**
 * Clear current active state from localStorage (reset to defaults)
 */
export function clearActiveState(): void {
  try {
    localStorage.removeItem(ACTIVE_ROTATION_KEY);
  } catch (e) {
    console.warn('Failed to clear active rotation:', e);
  }
}

/**
 * Get all user saved custom rotation slots
 */
export function getSavedSlots(): SavedRotationSlot[] {
  try {
    const raw = localStorage.getItem(SAVED_SLOTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      return (list as SavedRotationSlot[]).map(slot => ({
        ...slot,
        characters: (slot.characters ?? []).map(c => migrateLegacyCharacter(c as unknown as Record<string, unknown>)),
      }));
    }
  } catch (e) {
    console.warn('Failed to load saved slots from localStorage:', e);
  }
  return [];
}

/**
 * Save or update a custom slot
 */
export function saveSlot(slot: SavedRotationSlot): SavedRotationSlot[] {
  try {
    const current = getSavedSlots();
    const existingIdx = current.findIndex(s => s.id === slot.id);
    let updated: SavedRotationSlot[];
    if (existingIdx >= 0) {
      updated = [...current];
      updated[existingIdx] = { ...slot, updatedAt: new Date().toISOString() };
    } else {
      updated = [
        { ...slot, updatedAt: new Date().toISOString() },
        ...current,
      ];
    }
    localStorage.setItem(SAVED_SLOTS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to save slot to localStorage:', e);
    return getSavedSlots();
  }
}

/**
 * Delete a custom slot
 */
export function deleteSlot(slotId: string): SavedRotationSlot[] {
  try {
    const current = getSavedSlots();
    const updated = current.filter(s => s.id !== slotId);
    localStorage.setItem(SAVED_SLOTS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to delete slot from localStorage:', e);
    return getSavedSlots();
  }
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
  const charNames = characters.filter(c => !isEmptySlotCharacter(c)).map(c => c.name).join('・');
  return `${charNames} (${totalDuration.toFixed(1)}s)`;
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
