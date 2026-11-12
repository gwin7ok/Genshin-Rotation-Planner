/**
 * genshin-db のデータ（キャラ・武器・聖遺物・天賦・命ノ星座の一覧）の取得の窓口。
 *
 * 取得元は 2 つ。どちらも、同じ形（API の `?query=names&matchCategories=true&verboseCategories=true` の応答）で返す。
 *   - api   : 公開 API（https://genshin-db-api.vercel.app/api/v5）。デプロイが遅れて、新しい版のデータが入らないことがある（2026-11: 原神 7.2 が未反映）
 *   - local : 手元の npm パッケージ genshin-db（node_modules）。Node（コマンドラインの生成）だけで使える
 *
 * モード（環境変数 GENSHIN_DB_SOURCE。Node だけ。ブラウザは常に api）:
 *   - auto（既定）: キャラ・武器・聖遺物の ID の集合を、API と手元で比べ、手元が上位集合（API の全 ID を含み、さらに増えている）なら local、それ以外は api を、丸ごと使う。
 *                   API が読めないときは local。使った側は、実行ログに 1 回出す
 *   - api   : API だけを読む（従来どおり）
 *   - local : 手元の npm だけを読む
 * 1 回の実行では、どちらか一方だけを使う（版の違う説明文を混ぜない）。
 *
 * 注意: auto の判定は ID の集合だけ。説明文の修正だけの更新（ID が増えない）は検知できない。そのときは GENSHIN_DB_SOURCE=local で固定する。
 * 画面（DB 管理の「最新データをオンライン生成」）は、npm のパッケージを使えないので、API だけに頼る。
 */
import { fetchJson } from './fetchUtil.ts';

export const GENSHIN_DB_API_BASE = 'https://genshin-db-api.vercel.app/api/v5';
const VERBOSE_QUERY = 'query=names&matchCategories=true&verboseCategories=true';

export type GenshinDbCategory = 'characters' | 'weapons' | 'artifacts' | 'talents' | 'constellations';
export type GenshinDbLanguage = 'Japanese' | 'English';
export type GenshinDbSourceMode = 'auto' | 'api' | 'local';
export type GenshinDbChosen = 'api' | 'local';

/** 取得元の判定に使う、ID を比べる分類 */
const COMPARED: GenshinDbCategory[] = ['characters', 'weapons', 'artifacts'];

const isNode = typeof window === 'undefined' && typeof process !== 'undefined' && !!process.versions?.node;

/** 環境変数から、モードを読む（ブラウザは api）。不正な値はエラー（黙って api に戻さない） */
export function genshinDbSourceMode(): GenshinDbSourceMode {
  if (!isNode) return 'api';
  const raw = (process.env.GENSHIN_DB_SOURCE ?? '').trim().toLowerCase();
  if (raw === '') return 'auto';
  if (raw === 'auto' || raw === 'api' || raw === 'local') return raw;
  throw new Error(`環境変数 GENSHIN_DB_SOURCE は auto / api / local のどれか（指定: ${process.env.GENSHIN_DB_SOURCE}）`);
}

interface LocalModule {
  localList(category: GenshinDbCategory, language: GenshinDbLanguage): unknown[];
  localVersion(): string;
}

let localModule: Promise<LocalModule> | undefined;
/** 手元の npm 版の読み込み（Node だけ。ブラウザのバンドルに入れないよう、変数経由で読む） */
function loadLocal(): Promise<LocalModule> {
  if (!localModule) {
    const path = './genshinDbLocal.ts';
    localModule = import(/* @vite-ignore */ path) as Promise<LocalModule>;
  }
  return localModule;
}

const apiCache = new Map<string, Promise<unknown[]>>();
function fetchApi<T>(category: GenshinDbCategory, language: GenshinDbLanguage): Promise<T[]> {
  const key = `${category}/${language}`;
  let p = apiCache.get(key);
  if (!p) {
    p = fetchJson<unknown[]>(`${GENSHIN_DB_API_BASE}/${category}?${VERBOSE_QUERY}&resultLanguage=${language}`);
    apiCache.set(key, p);
    // 失敗した結果は、残さない（再試行できるように）
    p.catch(() => apiCache.delete(key));
  }
  return p as Promise<T[]>;
}

const idSet = (list: unknown[]): Set<string> => new Set(list.map(x => String((x as { id?: unknown })?.id)));

let decision: Promise<GenshinDbChosen> | undefined;

/** この実行で使う取得元を決める（1 回だけ。結果と理由をログに出す） */
export function chooseGenshinDbSource(): Promise<GenshinDbChosen> {
  if (!decision) decision = decide();
  return decision;
}

async function decide(): Promise<GenshinDbChosen> {
  const mode = genshinDbSourceMode();
  if (mode === 'api') return 'api';
  const local = await loadLocal();
  const version = local.localVersion();
  if (mode === 'local') {
    console.log(`[genshin-db] 取得元: local（npm genshin-db ${version}。GENSHIN_DB_SOURCE=local）`);
    return 'local';
  }
  // auto: ID の集合で比べる
  const extra: string[] = [];
  const missing: string[] = [];
  try {
    for (const category of COMPARED) {
      const api = idSet(await fetchApi(category, 'Japanese'));
      const loc = idSet(local.localList(category, 'Japanese'));
      for (const id of loc) if (!api.has(id)) extra.push(`${category}:${id}`);
      for (const id of api) if (!loc.has(id)) missing.push(`${category}:${id}`);
    }
  } catch (e) {
    console.log(`[genshin-db] 取得元: local（npm genshin-db ${version}。API を読めなかった: ${e instanceof Error ? e.message : String(e)}）`);
    return 'local';
  }
  if (extra.length > 0 && missing.length === 0) {
    console.log(`[genshin-db] 取得元: local（npm genshin-db ${version}。API に無い ID が ${extra.length} 件: ${extra.slice(0, 8).join(' ')}${extra.length > 8 ? ' …' : ''}）`);
    return 'local';
  }
  if (extra.length > 0) {
    console.log(`[genshin-db] 警告: API と手元（npm genshin-db ${version}）で ID が食い違う（手元だけ ${extra.length} 件・API だけ ${missing.length} 件）。API を使う。手元を使うなら GENSHIN_DB_SOURCE=local`);
  } else {
    console.log(`[genshin-db] 取得元: api（手元の npm genshin-db ${version} と ID が一致${missing.length > 0 ? `。手元に無い ID が ${missing.length} 件` : ''}）`);
  }
  return 'api';
}

/** 一覧（API と同じ形）を取る。使う取得元は、1 回の実行で固定 */
export async function fetchGenshinDb<T>(category: GenshinDbCategory, language: GenshinDbLanguage): Promise<T[]> {
  if (!isNode) return fetchApi<T>(category, language);
  const chosen = await chooseGenshinDbSource();
  if (chosen === 'api') return fetchApi<T>(category, language);
  const local = await loadLocal();
  return local.localList(category, language) as T[];
}
