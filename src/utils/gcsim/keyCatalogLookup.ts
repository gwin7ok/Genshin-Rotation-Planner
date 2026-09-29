/**
 * gcsim キーの辞書（src/data/gcsim_key_catalog.json）の読み込みと検索（フェーズ6 / 6-2）
 *
 * 辞書は約 670KB あるため、gcsim の結果を読むときにだけ動的に読み込む（初期表示のバンドルに含めない）。
 * 組み立てられるキー（パターン。`durin-a1-{element}` や `scroll-*pc-*`）にも対応する。
 */
import type { KeyCatalogEntry } from '../../masterdata/gcsimKeyCatalog.ts';
import type { KeyLookup } from './readGcsimLog.ts';

interface CatalogFile {
  gcsimCommit?: string;
  generatedAt?: string;
  entries: KeyCatalogEntry[];
}

export interface LoadedKeyCatalog {
  lookup: KeyLookup;
  /** 辞書を生成した gcsim のコミット（対応した gcsim のバージョンの記録） */
  gcsimCommit?: string;
}

const escapeRegex = (s: string) => s.replace(/[.+?^$()|[\]\\]/g, m => '\\' + m);

/** 辞書の検索関数を作る（完全一致 → パターン） */
export function createKeyLookup(entries: KeyCatalogEntry[]): KeyLookup {
  const exact = new Map(entries.filter(e => !e.isPattern).map(e => [e.key, e]));
  const patterns = entries.filter(e => e.isPattern).map(e => {
    const re = new RegExp(
      '^' + escapeRegex(e.key).replace('{element}', '(' + (e.elements ?? []).join('|') + ')').replace(/\*/g, '.*') + '$',
    );
    return { entry: e, re };
  });
  return key => exact.get(key) ?? patterns.find(p => p.re.test(key))?.entry;
}

let cached: Promise<LoadedKeyCatalog> | null = null;

/** 辞書を読み込む（最初の1回だけ取得し、以降は使い回す） */
export function loadKeyCatalog(): Promise<LoadedKeyCatalog> {
  if (!cached) {
    cached = import('../../data/gcsim_key_catalog.json').then(mod => {
      const file = (mod.default ?? mod) as unknown as CatalogFile;
      return { lookup: createKeyLookup(file.entries), gcsimCommit: file.gcsimCommit };
    });
    cached.catch(() => { cached = null; });
  }
  return cached;
}
