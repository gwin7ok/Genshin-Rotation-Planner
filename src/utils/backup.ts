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
import { isValidArtifactItem, isValidCharacterItem, isValidWeaponItem, sanitizeDbItems } from './databaseValidation';
import { loadActiveState, saveActiveState, flushActiveState, getSavedSlots, replaceSavedSlots, type ActiveRotationState } from './storage';
import { loadDatabase, saveDatabase } from './databaseService';
import { BACKUP_SETTING_KEYS, STORAGE_KEYS, readString, removeKey, writeString } from './persistence';
import { GCSIM_VERSION } from './gcsim/gcsimConfig.ts';
import { APP_VERSION } from './appVersion';
import { addSkipped, emptySkipped, isValidParty, sanitizeRotationNumbers, sanitizeSlot, sanitizeStints, totalSkipped } from './rotationValidation';

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

/** 読み込み時に除外した、壊れた項目の数 */
export interface SkippedItems {
  slots: number;
  items: number;
  /** 使える編成の中で除外した、出場・アクション・グループ・発動バフなどの数 */
  rotationParts: number;
}

export type ParseBackupResult = { ok: true; backup: BackupFile; skipped: SkippedItems } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** ファイルの内容を、バックアップとして読む（形式・版・主な項目の型を検査し、壊れた項目は除外して数を返す） */
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
  if (b.currentState && (!isRecord(b.currentState) || !isValidParty(b.currentState.party) || !Array.isArray(b.currentState.stints))) {
    return { ok: false, error: 'バックアップの内容が壊れています（現在の編成の形が違います）。' };
  }
  // 保存編成・現在の編成: 壊れた編成は除外し、使える編成も、壊れた出場・アクションは除く
  let inner = emptySkipped();
  const slots = b.savedSlots.flatMap(raw => {
    const r = sanitizeSlot(raw);
    if (!r) return [];
    inner = addSkipped(inner, r.skipped);
    return [r.slot];
  });
  let currentState = b.currentState ?? null;
  if (currentState) {
    const cleaned = sanitizeStints(currentState.stints);
    inner = addSkipped(inner, cleaned.skipped);
    currentState = sanitizeRotationNumbers({ ...currentState, stints: cleaned.stints });
  }
  const characters = sanitizeDbItems<CharacterConfig>(b.database.characters, isValidCharacterItem);
  const weapons = sanitizeDbItems<WeaponDatabaseItem>(b.database.weapons, isValidWeaponItem);
  const artifacts = sanitizeDbItems<ArtifactSetDatabaseItem>(b.database.artifacts, isValidArtifactItem);
  return {
    ok: true,
    skipped: {
      slots: b.savedSlots.length - slots.length,
      items: characters.skipped + weapons.skipped + artifacts.skipped,
      rotationParts: totalSkipped(inner),
    },
    backup: {
      format: BACKUP_FORMAT,
      version: b.version,
      exportedAt: String(b.exportedAt ?? ''),
      app: { version: String(b.app?.version ?? ''), gcsimVersion: String(b.app?.gcsimVersion ?? '') },
      currentState,
      savedSlots: slots,
      settings: Object.fromEntries(Object.entries(b.settings ?? {}).filter(([k, v]) => BACKUP_SETTING_KEYS.includes(k) && typeof v === 'string')) as Record<string, string>,
      database: { characters: characters.items, weapons: weapons.items, artifacts: artifacts.items },
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
  /** false のとき、保存に失敗して元の状態に戻した（ほかの項目は 0 件） */
  ok: boolean;
  error?: string;
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

/** 更新日時の比較用（読めない値は NaN） */
const timeOf = (v: unknown): number => (typeof v === 'string' ? new Date(v).getTime() : NaN);

/**
 * バックアップを、今のブラウザに復元する。
 *   - 保存編成: ID が同じものは、バックアップの更新日時が新しいときだけ置き換える（古いときは今のものを残す。
 *     今のものの日時が読めないときは、バックアップのものに置き換える。バックアップの日時が読めないときは、今のものを残す）。無い ID は足す。
 *   - 設定・利用者のデータ: バックアップのもので置き換える（データベースは ID で突き合わせて足す・置き換える）。
 *   - 現在の編成: restoreCurrent が true のとき、バックアップのもので置き換える。
 * 先にメモリ上で結果を組み立ててから書き込む。書き込みが 1 つでも失敗したら、書き込む前の内容に戻して ok: false を返す。
 * 復元の後は、画面の再読み込みが要る（呼び出し側で行う）。
 */
export function restoreBackup(b: BackupFile, options: { restoreCurrent: boolean } = { restoreCurrent: true }): RestoreResult {
  const failed = (error: string): RestoreResult => ({ ok: false, error, slotsAdded: 0, slotsUpdated: 0, slotsKept: 0, settings: 0, items: 0, currentStateRestored: false });

  // --- 結果をメモリ上で組み立てる（まだ書かない） ---
  let slotsAdded = 0;
  let slotsUpdated = 0;
  let slotsKept = 0;
  const slots = [...getSavedSlots()];
  for (const incoming of b.savedSlots) {
    const i = slots.findIndex(s => s.id === incoming.id);
    if (i < 0) {
      slots.push(incoming);
      slotsAdded++;
      continue;
    }
    const inTime = timeOf(incoming.updatedAt);
    const curTime = timeOf(slots[i].updatedAt);
    if (!Number.isNaN(inTime) && (Number.isNaN(curTime) || inTime > curTime)) {
      slots[i] = incoming;
      slotsUpdated++;
    } else {
      slotsKept++;
    }
  }

  const { characters, weapons, artifacts } = b.database;
  let mergedDb: AppDatabase | null = null;
  let items = 0;
  if (characters.length + weapons.length + artifacts.length > 0) {
    const db = loadDatabase();
    const c = mergeById(db.characters, characters);
    const w = mergeById(db.weapons, weapons);
    const a = mergeById(db.artifacts, artifacts);
    mergedDb = { ...db, characters: c.merged, weapons: w.merged, artifacts: a.merged };
    items = c.count + w.count + a.count;
  }

  // --- 書き込む前の内容を退避してから、順に書く ---
  flushActiveState(); // 待っている自動保存を先に書く（退避・巻き戻しの対象に、最新の内容を含める）
  const keys = [STORAGE_KEYS.savedSlots, STORAGE_KEYS.database, STORAGE_KEYS.activeRotation, ...Object.keys(b.settings)];
  const before = new Map<string, string | null>(keys.map(k => [k, readString(k)]));
  // 書き込みを始めた順（巻き戻しは、逆の順に行う）。
  // 順に戻さないと、保存編成を小さくして空いた容量を、大きな設定が使っているときに、元の大きな保存編成を先に書き戻すことになり、容量超過で失敗する
  const attempted: string[] = [];
  const write = (key: string, fn: () => boolean): boolean => {
    attempted.push(key);
    return fn();
  };
  /** 退避した内容に戻す。すべて戻せたか（戻せなかったキーがあれば false。保存先の状態が、一部変わったまま） */
  const rollback = (): boolean => {
    let all = true;
    for (const k of [...attempted].reverse()) {
      const v = before.get(k);
      if (v === null || v === undefined) {
        removeKey(k);
      } else if (!writeString(k, v)) {
        all = false;
      }
    }
    return all;
  };

  let settingsWritten = 0;
  let ok = write(STORAGE_KEYS.savedSlots, () => replaceSavedSlots(slots));
  if (ok) {
    for (const [key, value] of Object.entries(b.settings)) {
      if (!write(key, () => writeString(key, value))) { ok = false; break; }
      settingsWritten++;
    }
  }
  if (ok && mergedDb) ok = write(STORAGE_KEYS.database, () => saveDatabase(mergedDb));
  let currentStateRestored = false;
  if (ok && options.restoreCurrent && b.currentState) {
    ok = write(STORAGE_KEYS.activeRotation, () => saveActiveState(b.currentState!));
    currentStateRestored = ok;
  }
  if (!ok) {
    const restored = rollback();
    return failed(restored
      ? 'ブラウザに保存できませんでした（保存容量の不足、または保存が無効になっている可能性があります）。今のデータは、変更していません。'
      : 'ブラウザに保存できませんでした（保存容量の不足、または保存が無効になっている可能性があります）。さらに、元の状態に戻すことにも失敗し、保存してあるデータの一部が、変わったままの可能性があります。先に「全データを書き出す」で、バックアップを取り直してください。');
  }
  return { ok: true, slotsAdded, slotsUpdated, slotsKept, settings: settingsWritten, items, currentStateRestored };
}
