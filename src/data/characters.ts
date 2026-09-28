import { CharacterConfig, ElementType, WeaponType } from '../types/genshin';
import masterDataJson from './characters_master_data.json';

export const ELEMENT_COLORS: Record<ElementType, { bg: string; border: string; text: string; light: string; hex: string }> = {
  pyro: { bg: 'bg-red-950/70', border: 'border-red-500', text: 'text-red-400', light: 'bg-red-500/20', hex: '#ef4444' },
  hydro: { bg: 'bg-sky-950/70', border: 'border-sky-500', text: 'text-sky-400', light: 'bg-sky-500/20', hex: '#0ea5e9' },
  electro: { bg: 'bg-purple-950/70', border: 'border-purple-500', text: 'text-purple-400', light: 'bg-purple-500/20', hex: '#a855f7' },
  dendro: { bg: 'bg-emerald-950/70', border: 'border-emerald-500', text: 'text-emerald-400', light: 'bg-emerald-500/20', hex: '#10b981' },
  cryo: { bg: 'bg-cyan-950/70', border: 'border-cyan-400', text: 'text-cyan-300', light: 'bg-cyan-500/20', hex: '#06b6d4' },
  anemo: { bg: 'bg-teal-950/70', border: 'border-teal-400', text: 'text-teal-300', light: 'bg-teal-500/20', hex: '#14b8a6' },
  geo: { bg: 'bg-amber-950/70', border: 'border-amber-500', text: 'text-amber-400', light: 'bg-amber-500/20', hex: '#f59e0b' },
  physical: { bg: 'bg-slate-900', border: 'border-slate-400', text: 'text-slate-300', light: 'bg-slate-500/20', hex: '#94a3b8' },
};

/** 編成クリア後の「未設定」スロット用プレースホルダーID接頭辞 */
export const EMPTY_SLOT_ID_PREFIX = 'empty_slot_';

export const isEmptySlotCharacter = (c: Pick<CharacterConfig, 'id'>): boolean =>
  c.id.startsWith(EMPTY_SLOT_ID_PREFIX);

export const createEmptySlotCharacter = (slotIndex: number): CharacterConfig => ({
  id: `${EMPTY_SLOT_ID_PREFIX}${slotIndex + 1}`,
  name: '未設定',
  element: 'physical',
  weaponType: 'sword',
  avatarUrl: '',
  color: '#475569',
  accentColor: '#94a3b8',
  energyRecharge: 100,
  availableActions: [],
});

export const ELEMENT_NAMES_JA: Record<ElementType, string> = {
  pyro: '炎元素',
  hydro: '水元素',
  electro: '雷元素',
  dendro: '草元素',
  cryo: '氷元素',
  anemo: '風元素',
  geo: '岩元素',
  physical: '物理',
};

export const WEAPON_TYPE_NAMES_JA: Record<WeaponType, string> = {
  sword: '片手剣',
  claymore: '両手剣',
  polearm: '長柄武器',
  bow: '弓',
  catalyst: '法器',
};

/** genshin-db + gcsim から生成したキャラクターマスター (npm run build:master で再生成) */
export const MASTER_CHARACTERS = masterDataJson as CharacterConfig[];
