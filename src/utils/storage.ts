import { CharacterConfig, Stint, SavedRotationSlot } from '../types/genshin';
import { ROTATION_PRESETS } from '../data/presets';

const ACTIVE_ROTATION_KEY = 'genshin_rotation_current_state_v2';
const SAVED_SLOTS_KEY = 'genshin_rotation_saved_slots_v2';

export interface ActiveRotationState {
  characters: CharacterConfig[];
  stints: Stint[];
  selectedPresetId: string;
  loopStartTime: number;
  switchDelay?: number;
  actionDelay?: number;
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
      return parsed as ActiveRotationState;
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
      return list as SavedRotationSlot[];
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
