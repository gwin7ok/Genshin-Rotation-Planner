/**
 * 全データのバックアップ（一括の書き出し・復元。D174）。
 *
 * 目的: 別のブラウザ・端末への引っ越し、配信先の移行（URL が変わると localStorage が引き継がれない）、データを消す前の退避。
 * 含めるもの: 現在の編成・保存編成（全スロット）・設定・利用者が作成/ロックしたキャラ・武器・聖遺物。
 * 含めないもの: マスターデータ（アプリに同梱されていて、新しい版で再生成される）・gcsim の実行エンジンの選択（開発用）。
 *
 * 将来の Google Drive 保存も、この形式（BackupFile）を使う。
 */
import type { SavedRotationSlot, CharacterConfig } from '../types/genshin';
import type { AppDatabase, WeaponDatabaseItem, ArtifactSetDatabaseItem } from '../types/database';
import { loadActiveState, saveActiveState, getSavedSlots, replaceSavedSlots, type ActiveRotationState } from './storage';
import { loadDatabase, saveDatabase } from './databaseService';
import { BACKUP_SETTING_KEYS, readString, writeString } from './persistence';
import { GCSIM_VERSION } from './gcsim/gcsimConfig.ts';
import { APP_VERSION } from './appVersion';

export const BACKUP_FORMAT = 'genshin-rotation-planner-backup';
export const BACKUP_VERSION = 1;


export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** 書き出したときの、アプリの版と gcsim の版（問い合わせ・移行の切り分け用。復元には使わない） */
  app: { version: string; gcsimVersion: string };
  /** 現在編集中の編成（無いときは null） */
  currentState: Omit<ActiveRotationState, 'lastSavedAt'> | null;
  savedSlots: SavedRotationSlot[];
  /** 設定（キー → 文字列。未設定は含めない） */
  settings: Record<string, string>;
  /** 利用者が作成・ロックしたもの（マスターのものは含めない） */
  database: {
    characters: CharacterConfig[];
    weapons: WeaponDatabaseItem[];
    artifacts: ArtifactSetDatabaseItem[];
  };
}

const isUserCharacter = (c: CharacterConfig) => c.id.startsWith('custom_') || !!c.isCustom || !!c.isLocked;
const isUserWeapon = (w: WeaponDatabaseItem) => w.id.startsWith('weapon_custom_') || !!w.isCustom || !!w.isLocked;
const isUserArtifact = (a: ArtifactSetDatabaseItem) => a.id.startsWith('art_custom_') || !!a.isCustom || !!a.isLocked;

/** 今のブラウザの全データから、バックアップを作る */
export function buildBackup(now: Date = new Date()): BackupFile {
  const active = loadActiveState();
  const settings: Record<string, string> = {};
  // 設定のキーは persistence.ts の SETTING_KEYS（値は、文字列のまま退避・復元する）
  for (const key of BACKUP_SETTING_KEYS) {
    const v = readString(key);
    if (v !== null) settings[key] = v;
  }
  const db: AppDatabase = loadDatabase();
  let currentState: BackupFile['currentState'] = null;
  if (active) {
    const { lastSavedAt: _unused, ...rest } = active;
    void _unused;
    currentState = rest;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    app: { version: APP_VERSION, gcsimVersion: GCSIM_VERSION },
    currentState,
    savedSlots: getSavedSlots(),
    settings,
    database: {
      characters: db.characters.filter(isUserCharacter),
      weapons: db.weapons.filter(isUserWeapon),
      artifacts: db.artifacts.filter(isUserArtifact),
    },
  };
}

export type ParseBackupResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

/** ファイルの内容を、バックアップとして読む（形式・版・主な項目の型を検査する） */
export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON として読めません。' };
  }
  const b = raw as Partial<BackupFile> | null;
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'このアプリの「全データのバックアップ」ファイルではありません（1 つの編成の JSON は、「JSONファイル読み込み」から読み込んでください）。' };
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    return { ok: false, error: `新しい版のバックアップ（形式 ${String(b.version)}）です。アプリを更新してから、読み込んでください。` };
  }
  if (!Array.isArray(b.savedSlots) || !b.database || !Array.isArray(b.database.characters) || !Array.isArray(b.database.weapons) || !Array.isArray(b.database.artifacts)) {
    return { ok: false, error: 'バックアップの内容が壊れています（保存編成・データベースの項目がありません）。' };
  }
  if (b.currentState && (!Array.isArray(b.currentState.party) || !Array.isArray(b.currentState.stints))) {
    return { ok: false, error: 'バックアップの内容が壊れています（現在の編成の形が違います）。' };
  }
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: b.version,
      exportedAt: String(b.exportedAt ?? ''),
      app: { version: String(b.app?.version ?? ''), gcsimVersion: String(b.app?.gcsimVersion ?? '') },
      currentState: b.currentState ?? null,
      savedSlots: b.savedSlots.filter(s => s && typeof s.id === 'string' && Array.isArray(s.party)),
      settings: Object.fromEntries(Object.entries(b.settings ?? {}).filter(([k, v]) => BACKUP_SETTING_KEYS.includes(k) && typeof v === 'string')) as Record<string, string>,
      database: b.database,
    },
  };
}

export interface BackupSummary {
  hasCurrentState: boolean;
  slots: number;
  settings: number;
  characters: number;
  weapons: number;
  artifacts: number;
}

export function summarizeBackup(b: BackupFile): BackupSummary {
  return {
    hasCurrentState: b.currentState !== null,
    slots: b.savedSlots.length,
    settings: Object.keys(b.settings).length,
    characters: b.database.characters.length,
    weapons: b.database.weapons.length,
    artifacts: b.database.artifacts.length,
  };
}

export interface RestoreResult {
  slotsAdded: number;
  slotsUpdated: number;
  slotsKept: number;
  settings: number;
  items: number;
  currentStateRestored: boolean;
}

/** 同じ ID の項目は置き換え、無ければ末尾に足す */
function mergeById<T extends { id: string }>(current: T[], incoming: T[]): { merged: T[]; count: number } {
  const merged = [...current];
  for (const item of incoming) {
    const i = merged.findIndex(x => x.id === item.id);
    if (i >= 0) merged[i] = item;
    else merged.push(item);
  }
  return { merged, count: incoming.length };
}

/**
 * バックアップを、今のブラウザに復元する。
 *   - 保存編成: ID が同じものは、バックアップの更新日時が新しいときだけ置き換える（古いときは今のものを残す）。無い ID は足す。
 *   - 設定・利用者のデータ: バックアップのもので置き換える（データベースは ID で突き合わせて足す・置き換える）。
 *   - 現在の編成: restoreCurrent が true のとき、バックアップのもので置き換える。
 * 復元の後は、画面の再読み込みが要る（呼び出し側で行う）。
 */
export function restoreBackup(b: BackupFile, options: { restoreCurrent: boolean } = { restoreCurrent: true }): RestoreResult {
  const result: RestoreResult = { slotsAdded: 0, slotsUpdated: 0, slotsKept: 0, settings: 0, items: 0, currentStateRestored: false };

  const slots = [...getSavedSlots()];
  for (const incoming of b.savedSlots) {
    const i = slots.findIndex(s => s.id === incoming.id);
    if (i < 0) {
      slots.push(incoming);
      result.slotsAdded++;
    } else if (new Date(incoming.updatedAt).getTime() > new Date(slots[i].updatedAt).getTime()) {
      slots[i] = incoming;
      result.slotsUpdated++;
    } else {
      result.slotsKept++;
    }
  }
  replaceSavedSlots(slots);

  for (const [key, value] of Object.entries(b.settings)) {
    if (writeString(key, value)) result.settings++;
  }

  const { characters, weapons, artifacts } = b.database;
  if (characters.length + weapons.length + artifacts.length > 0) {
    const db = loadDatabase();
    const c = mergeById(db.characters, characters);
    const w = mergeById(db.weapons, weapons);
    const a = mergeById(db.artifacts, artifacts);
    saveDatabase({ ...db, characters: c.merged, weapons: w.merged, artifacts: a.merged });
    result.items = c.count + w.count + a.count;
  }

  if (options.restoreCurrent && b.currentState) {
    saveActiveState(b.currentState);
    result.currentStateRestored = true;
  }
  return result;
}
