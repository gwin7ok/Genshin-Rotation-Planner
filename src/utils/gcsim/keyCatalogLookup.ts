/**
 * gcsim キーの辞書（public/data/gcsim_key_catalog.json）の読み込みと検索（フェーズ6 / 6-2）
 *
 * 辞書は約 670KB あるため、ビルドに含めず、gcsim の結果を読むときにだけサーバーから取得する（public/data。毎回取り直す）。
 * 組み立てられるキー（パターン。`durin-a1-{element}` や `scroll-*pc-*`）にも対応する。
 */
import type { KeyCatalogEntry } from '../../masterdata/gcsimKeyCatalog.ts';
import type { KeyLookup } from './readGcsimLog.ts';
import { fetchRuntimeData } from './runtimeData.ts';

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

/** 取得した辞書を使い回す時間（ミリ秒）。実行 → 反映のように続けて呼ぶとき、約 670KB を何度も取り直さないため。開発中に辞書を作り直しても、これだけ待てば反映される */
const CATALOG_REUSE_MS = 60_000;
let loaded: { at: number; promise: Promise<LoadedKeyCatalog> } | null = null;

/** 辞書をサーバーから取得する（直近 1 分以内に取得したものは、使い回す。失敗は使い回さない） */
export function loadKeyCatalog(): Promise<LoadedKeyCatalog> {
  if (loaded && Date.now() - loaded.at < CATALOG_REUSE_MS) return loaded.promise;
  const promise = fetchRuntimeData<CatalogFile>('gcsim_key_catalog.json')
    .then((file): LoadedKeyCatalog => ({ lookup: createKeyLookup(file.entries), gcsimCommit: file.gcsimCommit }));
  const entry = { at: Date.now(), promise };
  loaded = entry;
  promise.catch(() => { if (loaded === entry) loaded = null; });
  return promise;
}
