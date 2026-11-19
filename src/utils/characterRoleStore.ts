/**
 * キャラの役割（アタッカー・サブアタッカー・サポーター）の、利用者による上書きの保存。
 * 初期値はマスターのキャラの `roles`（src/masterdata/characterRoles.ts）。利用者が変えたキャラだけを、キャラ ID をキーにして持つ（設定として、バックアップに入る）。
 * マスターを作り直しても、上書きは残る。
 */
import type { CharacterRole } from '../types/genshin';
import { SETTING_KEYS, readJson, removeKey, writeJson } from './persistence';

export const ROLE_ORDER: readonly CharacterRole[] = ['attacker', 'subAttacker', 'supporter'];

/** キャラ ID → 上書きした役割（1 つ以上。順序は ROLE_ORDER の順） */
export type CharacterRoleOverrides = Record<string, CharacterRole[]>;

const isRole = (v: unknown): v is CharacterRole => (ROLE_ORDER as readonly unknown[]).includes(v);

/** 役割の並びを、重複なし・定義の順にそろえる */
export function normalizeRoles(roles: readonly unknown[]): CharacterRole[] {
  return ROLE_ORDER.filter(r => roles.includes(r));
}

/** 保存された上書きの検査（壊れた項目・空の役割は捨てる） */
export function sanitizeRoleOverrides(raw: unknown): CharacterRoleOverrides {
  const out: CharacterRoleOverrides = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (!Array.isArray(v)) continue;
    const roles = normalizeRoles(v.filter(isRole));
    if (roles.length > 0) out[id] = roles;
  }
  return out;
}

export function loadRoleOverrides(): CharacterRoleOverrides {
  return sanitizeRoleOverrides(readJson<unknown>(SETTING_KEYS.characterRoleOverrides));
}

/** 1 キャラの上書きを保存する。roles が空・初期値と同じなら、上書きを消す（戻り値: 書けたか） */
export function saveRoleOverride(characterId: string, roles: readonly CharacterRole[], defaults: readonly CharacterRole[] | undefined): boolean {
  const next = loadRoleOverrides();
  const normalized = normalizeRoles(roles);
  if (normalized.length === 0 || JSON.stringify(normalized) === JSON.stringify(normalizeRoles(defaults ?? []))) delete next[characterId];
  else next[characterId] = normalized;
  if (Object.keys(next).length === 0) {
    removeKey(SETTING_KEYS.characterRoleOverrides);
    return true;
  }
  return writeJson(SETTING_KEYS.characterRoleOverrides, next);
}

/** キャラの、実際に使う役割（上書きがあればそれ、無ければマスターの初期値） */
export function effectiveRoles(character: { id: string; roles?: readonly CharacterRole[] }, overrides: CharacterRoleOverrides = loadRoleOverrides()): CharacterRole[] {
  return overrides[character.id] ?? normalizeRoles(character.roles ?? []);
}
