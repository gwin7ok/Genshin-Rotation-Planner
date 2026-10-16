/**
 * DB 管理の「JSON 取り込み」の読み取りと検査（キャラ・武器・聖遺物の全データを、ファイルの内容で置き換える）。
 * 形の合わない項目（ID・名前が文字列でない、ID の重複）は除外して、その数を返す。
 */
import type { AppDatabase } from '../types/database';

export interface DatabaseImportSummary {
  characters: number;
  weapons: number;
  artifacts: number;
}

export type ParseDatabaseFileResult =
  | { ok: true; db: AppDatabase; skipped: number; counts: DatabaseImportSummary }
  | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function sanitize<T>(list: unknown[]): { items: T[]; skipped: number } {
  const seen = new Set<string>();
  const items: T[] = [];
  for (const v of list) {
    if (!isRecord(v) || typeof v.id !== 'string' || v.id.length === 0 || typeof v.name !== 'string' || seen.has(v.id)) continue;
    seen.add(v.id);
    items.push(v as unknown as T);
  }
  return { items, skipped: list.length - items.length };
}

export function parseDatabaseFile(text: string): ParseDatabaseFileResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON として読めません。' };
  }
  if (!isRecord(raw) || !Array.isArray(raw.characters) || !Array.isArray(raw.weapons) || !Array.isArray(raw.artifacts)) {
    return { ok: false, error: '無効なデータベースファイル形式です（characters・weapons・artifacts の配列がありません）。' };
  }
  const characters = sanitize<AppDatabase['characters'][number]>(raw.characters);
  const weapons = sanitize<AppDatabase['weapons'][number]>(raw.weapons);
  const artifacts = sanitize<AppDatabase['artifacts'][number]>(raw.artifacts);
  return {
    ok: true,
    db: {
      // version が無い・数値でないファイルは 0 として扱い、読み込み時に最新のマスターとマージして更新する
      version: typeof raw.version === 'number' ? raw.version : 0,
      lastSyncedAt: typeof raw.lastSyncedAt === 'string' ? raw.lastSyncedAt : '',
      characters: characters.items,
      weapons: weapons.items,
      artifacts: artifacts.items,
    },
    skipped: characters.skipped + weapons.skipped + artifacts.skipped,
    counts: { characters: characters.items.length, weapons: weapons.items.length, artifacts: artifacts.items.length },
  };
}
