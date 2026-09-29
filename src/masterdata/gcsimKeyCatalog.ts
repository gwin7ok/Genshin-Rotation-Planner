/**
 * gcsim キーの辞書の抽出（フェーズ5 / 5-2a、D10・D45 の決定）
 *
 * gcsim の詳細ログに出るバフ・状態・内部CTのキー名（例: `khaj-nisut-team-buff`, `tom-4pc-icd`）から、
 * 「どのキャラ・武器・聖遺物の何か」を引けるようにする辞書を、gcsim のソース（Go）から自動で作る。
 *
 * - 抽出するもの: キーを登録している呼び出し（`AddStatus` / `Core.Status.Add` / `modifier.NewBase(WithHitlag)`。各種の mod はすべて NewBase を通る）
 * - 分類: キーを定義しているファイルの場所で決める（skill.go = スキル、burst.go = 爆発、asc.go = 固有天賦、cons.go = 命ノ星座、weapons/ = 武器、artifacts/ = 聖遺物 など）
 * - キー名の解決: リテラル・同じパッケージの定数・「定数 + 文字列」。組み立てられるキー（`"prefix-" + 元素.String()` や `fmt.Sprintf`）はパターンとして持つ
 * - 種類（効果 / CT / 内部）は名前からの「候補」。最終判定は 5-2b の手で補う一覧で行う
 * 純粋関数。取得・書き出しは scripts/build-key-catalog.ts。
 */
import { evaluateGoExpr, parseGoFile, type ParsedGoFile } from './gcsimParser.ts';

export type KeyCategory =
  | 'skill' | 'burst' | 'talent' | 'constellation' | 'attack' | 'character'
  | 'weapon' | 'artifact' | 'template' | 'system';

export type KeyKind = 'effect' | 'cooldown' | 'internal';

export interface KeySource {
  /** gcsim ソースのパス（リポジトリのルートから） */
  file: string;
  /** status = `AddStatus` / `Status.Add`、mod = `modifier.NewBase` を使う各種 mod */
  api: 'status' | 'mod';
}

export interface KeyOwner {
  type: 'character' | 'weapon' | 'artifact' | 'template' | 'system';
  /** gcsim のキー（キャラ = キャラのキー、武器・聖遺物 = ディレクトリ名）。共有パッケージ（weapons/common など）は 'common' */
  gcsimKey: string;
}

export interface KeyCatalogEntry {
  /** キー名。パターンのときは `durin-a1-{element}` や `scroll-*pc-*` の形 */
  key: string;
  /** 組み立てられるキー（パターン）か */
  isPattern?: boolean;
  /** `{element}` の中身になりうる元素（同じファイルに出てくる元素から推定） */
  elements?: string[];
  category: KeyCategory;
  owner: KeyOwner;
  /** 名前からの候補（確定は 5-2b の手で補う一覧） */
  kind: KeyKind;
  /** 継続時間が -1（効果が切れない）の登録がある */
  permanent?: boolean;
  /** 継続時間（フレーム）。式を評価できたものだけ */
  durationFrames?: number;
  /** 定義場所が複数の分類・持ち主にまたがる（先頭の定義場所を採用。5-2b で確認） */
  ambiguous?: boolean;
  sources: KeySource[];
  source: 'auto';
}

export interface UnresolvedKeyCall {
  file: string;
  /** キー名の式（例: `key`, `fmt.Sprintf(key`） */
  expr: string;
}

export interface KeyCatalogReport {
  totalCalls: number;
  resolvedCalls: number;
  patternCalls: number;
  unresolved: UnresolvedKeyCall[];
  /** 定義場所が複数の分類・持ち主にまたがるキー */
  ambiguous: Array<{ key: string; places: string[] }>;
  byCategory: Record<string, number>;
  byKind: Record<string, number>;
}

export interface KeyCatalog {
  gcsimCommit: string;
  generatedAt: string;
  entries: KeyCatalogEntry[];
}

// ---------------------------------------------------------------------------
// 分類（定義場所）
// ---------------------------------------------------------------------------

/** ファイルのパスから、分類と持ち主を決める */
export function classifyPath(path: string): { category: KeyCategory; owner: KeyOwner } {
  let m = /^internal\/characters\/(.+)\/(\w+)\.go$/.exec(path);
  if (m) {
    const file = m[2];
    const category: KeyCategory = file === 'skill' ? 'skill'
      : file === 'burst' ? 'burst'
      : file === 'asc' ? 'talent'
      : file === 'cons' ? 'constellation'
      : ['attack', 'charge', 'aimed', 'aim', 'plunge'].includes(file) ? 'attack'
      : 'character';
    return { category, owner: { type: 'character', gcsimKey: m[1] } };
  }
  if (path.startsWith('internal/weapons/')) {
    const dir = /^internal\/weapons\/(?:[^/]+\/)?([^/]+)\//.exec(path)?.[1] ?? 'common';
    return { category: 'weapon', owner: { type: 'weapon', gcsimKey: dir } };
  }
  m = /^internal\/artifacts\/([^/]+)\//.exec(path);
  if (m) return { category: 'artifact', owner: { type: 'artifact', gcsimKey: m[1] } };
  m = /^internal\/template\/([^/]+)\//.exec(path);
  if (m) return { category: 'template', owner: { type: 'template', gcsimKey: m[1] } };
  return { category: 'system', owner: { type: 'system', gcsimKey: path.replace(/\.go$/, '') } };
}

const packageOf = (path: string) => path.replace(/\/[^/]+$/, '');

/** 種類の候補（名前から）。粒子・エネルギー・ヒットラグは内部、icd / cd / cooldown は CT、それ以外は効果 */
export function guessKind(key: string): KeyKind {
  if (/particle|energy|hitlag/i.test(key)) return 'internal';
  if (/icd|cooldown|(^|[^a-z])cd([^a-z]|$)/i.test(key)) return 'cooldown';
  return 'effect';
}

// ---------------------------------------------------------------------------
// キー名の解決
// ---------------------------------------------------------------------------

/** Go の文字列リテラル（"..." と バッククォート）を値にする。リテラルでなければ undefined */
function parseStringLiteral(p: string): string | undefined {
  if (/^`[^`]*`$/.test(p)) return p.slice(1, -1);
  if (/^"(?:[^"\\]|\\.)*"$/.test(p)) {
    try { return JSON.parse(p) as string; } catch { return undefined; }
  }
  return undefined;
}

const STRING_TERM = '(?:"(?:[^"\\\\]|\\\\.)*"|`[^`]*`|[A-Za-z_]\\w*)';
/** `name = 項 (+ 項)*`（項はリテラルか他の定数）。行末のコメントは許す */
const STRING_CONST_RE = new RegExp(`^\\s*(?:const\\s+|var\\s+)?([A-Za-z_]\\w*)\\s*(?::=|=)\\s*(${STRING_TERM}(?:\\s*\\+\\s*${STRING_TERM})*)\\s*(?://.*)?$`, 'gm');

/**
 * パッケージごとの文字列定数（`name = "..."` / `const name = "..."` / `name := "..."` / `name = other + "-x"`）。
 * 最初に見つかった定義を採用し、定数どうしの連結は解決できるまで数回繰り返す
 */
function collectStringConsts(files: Record<string, string>): Map<string, Map<string, string>> {
  const result = new Map<string, Map<string, string>>();
  const pending = new Map<string, Array<[string, string[]]>>();
  for (const [path, text] of Object.entries(files)) {
    const pkg = packageOf(path);
    if (!result.has(pkg)) result.set(pkg, new Map());
    if (!pending.has(pkg)) pending.set(pkg, []);
    for (const m of text.matchAll(STRING_CONST_RE)) {
      pending.get(pkg)!.push([m[1], m[2].split(/\s*\+\s*/)]);
    }
  }
  for (let pass = 0; pass < 4; pass++) {
    for (const [pkg, list] of pending) {
      const consts = result.get(pkg)!;
      for (const [name, parts] of list) {
        if (consts.has(name)) continue;
        const values = parts.map(p => parseStringLiteral(p) ?? consts.get(p));
        if (values.every((v): v is string => v !== undefined)) consts.set(name, values.join(''));
      }
    }
  }
  return result;
}

/** パッケージごとの数値定数（継続時間の式の評価用） */
function collectNumberConsts(files: Record<string, string>): Map<string, ParsedGoFile> {
  const merged = new Map<string, Map<string, number>>();
  for (const [path, text] of Object.entries(files)) {
    const pkg = packageOf(path);
    if (!merged.has(pkg)) merged.set(pkg, new Map());
    const target = merged.get(pkg)!;
    parseGoFile(text).consts.forEach((v, k) => { if (!target.has(k)) target.set(k, v); });
  }
  const result = new Map<string, ParsedGoFile>();
  for (const [pkg, consts] of merged) {
    result.set(pkg, { consts, intArrays: new Map(), tables: [], attackFuncTables: [], genderIndexPositions: {}, unresolved: [] });
  }
  return result;
}

const ELEMENT_NAMES = ['Pyro', 'Hydro', 'Electro', 'Cryo', 'Dendro', 'Anemo', 'Geo'];

/** 同じファイルに出てくる元素（`attributes.Pyro` など） */
function elementsIn(text: string): string[] {
  return ELEMENT_NAMES.filter(e => new RegExp(`attributes\\.${e}\\b`).test(text)).map(e => e.toLowerCase());
}

type ResolvedKey =
  | { kind: 'key'; key: string }
  | { kind: 'pattern'; key: string; elements?: string[] };

/**
 * キー名の式を解決する。
 *   - リテラル `"abc"`、定数 `abcKey`、定数 + 文字列 `abcKey+"-buff"`、共有パッケージの定数 `common.XxxKey`
 *   - `"prefix-"+元素.String()` → `prefix-{element}`（元素は同じファイルに出てくるもの）
 *   - `fmt.Sprintf("prefix-%v", ...)` → `prefix-*`
 * 解決できなければ undefined
 */
function resolveKeyExpr(
  expr: string,
  consts: Map<string, string>,
  aliases: Map<string, Map<string, string>[]>,
  fileText: string,
): ResolvedKey | undefined {
  const arg = expr.trim();
  const lookup = (name: string): string | undefined => {
    const own = consts.get(name);
    if (own !== undefined) return own;
    const shared = /^(\w+)\.(\w+)$/.exec(name);
    if (!shared) return undefined;
    for (const c of aliases.get(shared[1]) ?? []) {
      const v = c.get(shared[2]);
      if (v !== undefined) return v;
    }
    return undefined;
  };

  // リテラルと定数の連結（`a + "x" + b`）
  const parts = arg.split(/\s*\+\s*/);
  const resolved: string[] = [];
  let dynamic = false;
  for (const p of parts) {
    const literal = parseStringLiteral(p);
    if (literal !== undefined) {
      resolved.push(literal);
    } else if (/^[A-Za-z_][\w.]*$/.test(p) && lookup(p) !== undefined) {
      resolved.push(lookup(p)!);
    } else if (/\.String\(\)$/.test(p)) {
      resolved.push('{element}');
      dynamic = true;
    } else {
      return undefined;
    }
  }
  if (!dynamic) return { kind: 'key', key: resolved.join('') };
  const elements = elementsIn(fileText);
  return elements.length > 0
    ? { kind: 'pattern', key: resolved.join(''), elements }
    : { kind: 'pattern', key: resolved.join('').replace(/\{element\}/g, '*') };
}

/** `fmt.Sprintf("scroll-%dpc-%v", ...)` の書式から、動詞を * に置き換えたパターンを作る */
function resolveSprintf(expr: string): ResolvedKey | undefined {
  const m = /^fmt\.Sprintf\(\s*("(?:[^"\\]|\\.)*")/.exec(expr.trim());
  if (!m) return undefined;
  try {
    const format = JSON.parse(m[1]) as string;
    return { kind: 'pattern', key: format.replace(/%[-+# 0-9.]*[a-zA-Z]/g, '*') };
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// 抽出
// ---------------------------------------------------------------------------

/** キー登録の呼び出し: 1 つ目の引数がキー、2 つ目が継続時間 */
const CALL_RE = /(\.AddStatus\(|Core\.Status\.Add\(|modifier\.NewBase(?:WithHitlag)?\()\s*([^,]+?)\s*,\s*([^,)]+(?:\([^)]*\))?[^,)]*)/g;

interface RawKey {
  key: string;
  isPattern: boolean;
  elements?: string[];
  path: string;
  api: 'status' | 'mod';
  durationFrames?: number;
}

/**
 * gcsim のソース（パス → 中身）から、キーの辞書を作る。
 * @param files internal/characters・weapons・artifacts・template と pkg/simulation/setup.go の Go ソース
 */
export function extractKeyCatalog(
  files: Record<string, string>,
  gcsimCommit: string,
): { catalog: KeyCatalog; report: KeyCatalogReport } {
  const stringConsts = collectStringConsts(files);
  const numberConsts = collectNumberConsts(files);
  // 別パッケージの定数（common.XxxKey / player.XxxKey / reactable.XxxKey）
  const aliasOf = (dirs: string[]) => dirs.map(d => stringConsts.get(d)).filter((c): c is Map<string, string> => c !== undefined);
  const aliases = new Map<string, Map<string, string>[]>([
    ['common', aliasOf(['internal/weapons/common', 'internal/artifacts/common'])],
    ['player', aliasOf(['pkg/core/player'])],
    ['reactable', aliasOf(['pkg/reactable'])],
  ]);

  const raws: RawKey[] = [];
  const report: KeyCatalogReport = {
    totalCalls: 0, resolvedCalls: 0, patternCalls: 0, unresolved: [], ambiguous: [], byCategory: {}, byKind: {},
  };

  for (const [path, text] of Object.entries(files)) {
    const pkg = packageOf(path);
    const consts = stringConsts.get(pkg) ?? new Map<string, string>();
    const numbers = numberConsts.get(pkg);
    for (const m of text.matchAll(CALL_RE)) {
      report.totalCalls++;
      const api: 'status' | 'mod' = m[1].includes('NewBase') ? 'mod' : 'status';
      const expr = m[2];
      const resolved = resolveKeyExpr(expr, consts, aliases, text) ?? resolveSprintf(expr);
      // パターンは、固定の接頭辞が 3 文字以上あるものだけ（`*-*` のような何にでも一致するものは使えない）
      if (!resolved || (resolved.kind === 'pattern' && !/^[^*{]{3,}/.test(resolved.key))) {
        report.unresolved.push({ file: path, expr: expr.trim().replace(/\s+/g, ' ') });
        continue;
      }
      const duration = numbers ? evaluateGoExpr(m[3].trim(), numbers) : undefined;
      raws.push({
        key: resolved.key,
        isPattern: resolved.kind === 'pattern',
        elements: resolved.kind === 'pattern' ? resolved.elements : undefined,
        path,
        api,
        durationFrames: duration,
      });
      if (resolved.kind === 'pattern') report.patternCalls++;
      else report.resolvedCalls++;
    }
  }

  // キーごとにまとめる
  const byKey = new Map<string, RawKey[]>();
  for (const r of raws) {
    if (!byKey.has(r.key)) byKey.set(r.key, []);
    byKey.get(r.key)!.push(r);
  }

  const entries: KeyCatalogEntry[] = [];
  for (const [key, list] of [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const first = list[0];
    const { category, owner } = classifyPath(first.path);
    const places = new Set(list.map(r => {
      const c = classifyPath(r.path);
      return `${c.category}:${c.owner.gcsimKey}`;
    }));
    const ambiguous = places.size > 1;
    if (ambiguous) report.ambiguous.push({ key, places: [...places] });

    const durations = list.map(r => r.durationFrames).filter((d): d is number => d !== undefined);
    const sources: KeySource[] = [];
    for (const r of list) {
      if (!sources.some(s => s.file === r.path && s.api === r.api)) sources.push({ file: r.path, api: r.api });
    }
    const entry: KeyCatalogEntry = {
      key,
      ...(first.isPattern ? { isPattern: true } : {}),
      ...(first.elements ? { elements: first.elements } : {}),
      category,
      owner,
      kind: guessKind(key),
      ...(durations.includes(-1) ? { permanent: true } : {}),
      ...(durations.length > 0 && !durations.includes(-1) ? { durationFrames: durations[0] } : {}),
      ...(ambiguous ? { ambiguous: true } : {}),
      sources,
      source: 'auto',
    };
    entries.push(entry);
    report.byCategory[category] = (report.byCategory[category] ?? 0) + 1;
    report.byKind[entry.kind] = (report.byKind[entry.kind] ?? 0) + 1;
  }

  return {
    catalog: { gcsimCommit, generatedAt: new Date().toISOString(), entries },
    report,
  };
}
