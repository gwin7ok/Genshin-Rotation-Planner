/**
 * DB 管理の「JSON 取り込み」の読み取りと検査（キャラ・武器・聖遺物の全データを、ファイルの内容で置き換える）。
 * 形の合わない項目（ID・名前が文字列でない、画面・計算が使う項目の型が違う、ID の重複）は除外して、その数を返す。
 */
import type { AppDatabase } from '../types/database';
import { isValidArtifactItem, isValidCharacterItem, isValidWeaponItem, sanitizeDbItems } from './databaseValidation';
import { t } from '../i18n';

export interface DatabaseImportSummary {
  characters: number;
  weapons: number;
  artifacts: number;
}

export type ParseDatabaseFileResult =
  | { ok: true; db: AppDatabase; skipped: number; counts: DatabaseImportSummary }
  | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 同期の記録（lastSync）。形が合わなければ捨てる（表示は lastSyncedAt の文になる） */
function sanitizeLastSync(v: unknown): AppDatabase['lastSync'] {
  if (!isRecord(v) || typeof v.key !== 'string' || !v.key.startsWith('messages:db.')) return undefined;
  const params = isRecord(v.params)
    ? Object.fromEntries(Object.entries(v.params).filter((e): e is [string, string | number] => typeof e[1] === 'string' || typeof e[1] === 'number'))
    : undefined;
  return { key: v.key as `messages:db.${string}`, ...(params ? { params } : {}), ...(typeof v.at === 'string' ? { at: v.at } : {}) };
}

export function parseDatabaseFile(text: string): ParseDatabaseFileResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: t('messages:file.notJson') };
  }
  if (!isRecord(raw) || !Array.isArray(raw.characters) || !Array.isArray(raw.weapons) || !Array.isArray(raw.artifacts)) {
    return { ok: false, error: t('messages:file.invalidDatabase') };
  }
  const characters = sanitizeDbItems<AppDatabase['characters'][number]>(raw.characters, isValidCharacterItem);
  const weapons = sanitizeDbItems<AppDatabase['weapons'][number]>(raw.weapons, isValidWeaponItem);
  const artifacts = sanitizeDbItems<AppDatabase['artifacts'][number]>(raw.artifacts, isValidArtifactItem);
  return {
    ok: true,
    db: {
      // version が無い・数値でないファイルは 0 として扱い、読み込み時に最新のマスターとマージして更新する
      version: typeof raw.version === 'number' ? raw.version : 0,
      lastSyncedAt: typeof raw.lastSyncedAt === 'string' ? raw.lastSyncedAt : '',
      lastSync: sanitizeLastSync(raw.lastSync),
      characters: characters.items,
      weapons: weapons.items,
      artifacts: artifacts.items,
    },
    skipped: characters.skipped + weapons.skipped + artifacts.skipped,
    counts: { characters: characters.items.length, weapons: weapons.items.length, artifacts: artifacts.items.length },
  };
}
