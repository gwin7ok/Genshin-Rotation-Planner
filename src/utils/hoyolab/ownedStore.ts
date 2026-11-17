/**
 * 持ちキャラ（HoYoLAB から取り込んだ装備）の保存。保存先は persistence.ts（設定として、バックアップに入る）。
 * 生の HoYoLAB の JSON（UID・所持品が入る・約 2MB）は保存しない。変換済みの OwnedCharacter だけを持つ。
 */
import { SETTING_KEYS, readJson, readString, removeKey, writeJson, writeString } from '../persistence';
import type { OwnedCharacter } from './importCharacters';

export interface OwnedStore {
  /** 取り込んだ日時（ISO） */
  importedAt: string;
  /** 取り込んだアカウントのプレイヤー名（取れなかったときは無い） */
  nickname?: string;
  characters: OwnedCharacter[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** 保存された持ちキャラの検査（バックアップの復元などで、壊れた値が入っても、画面・計算で例外にしない） */
export function isValidOwnedCharacter(v: unknown): v is OwnedCharacter {
  if (!isRecord(v)) return false;
  return isInt(v.genshinId, 1, 1e9) && typeof v.name === 'string' && typeof v.element === 'string'
    && isInt(v.level, 1, 100) && isInt(v.maxLevel, 1, 100) && typeof v.ambiguousAscension === 'boolean'
    && isInt(v.constellation, 0, 6)
    && Array.isArray(v.talents) && v.talents.length === 3 && v.talents.every(n => isInt(n, 1, 15))
    && isRecord(v.weapon) && isInt(v.weapon.genshinId, 0, 1e9) && typeof v.weapon.name === 'string'
    && isInt(v.weapon.level, 1, 100) && isInt(v.weapon.maxLevel, 1, 100) && isInt(v.weapon.refinement, 1, 5)
    && Array.isArray(v.artifactSets) && v.artifactSets.every(s => isRecord(s) && typeof s.name === 'string' && isInt(s.count, 1, 5))
    && isRecord(v.artifactStats) && Object.entries(v.artifactStats).every(([k, n]) => /^[a-z]+%?$/.test(k) && typeof n === 'number' && Number.isFinite(n))
    && Array.isArray(v.warnings) && v.warnings.every(w => typeof w === 'string');
}

/** 保存された持ちキャラを読む。無い・壊れているときは null（壊れた要素だけ除く） */
export function loadOwned(): OwnedStore | null {
  const raw = readJson<unknown>(SETTING_KEYS.ownedCharacters);
  if (!isRecord(raw) || typeof raw.importedAt !== 'string' || !Array.isArray(raw.characters)) return null;
  return {
    importedAt: raw.importedAt,
    ...(typeof raw.nickname === 'string' && raw.nickname !== '' ? { nickname: raw.nickname.slice(0, 40) } : {}),
    characters: raw.characters.filter(isValidOwnedCharacter),
  };
}

/** 取り込んだ持ちキャラを保存する（前回の分は置き換える）。書き込めなかったら false */
export function saveOwned(characters: OwnedCharacter[], nickname?: string, now: Date = new Date()): boolean {
  const store: OwnedStore = { importedAt: now.toISOString(), ...(nickname ? { nickname } : {}), characters };
  return writeJson(SETTING_KEYS.ownedCharacters, store);
}

export const clearOwned = (): void => removeKey(SETTING_KEYS.ownedCharacters);

/** 原神の UID（取り込み画面の入力の手間を減らす。9 桁の数字のときだけ保存・返す） */
export const loadHoyolabUid = (): string => {
  const v = readString(SETTING_KEYS.hoyolabUid);
  return v && /^\d{9}$/.test(v) ? v : '';
};
export const saveHoyolabUid = (uid: string): boolean => (/^\d{9}$/.test(uid) ? writeString(SETTING_KEYS.hoyolabUid, uid) : false);
