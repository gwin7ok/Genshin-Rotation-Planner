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
  /** 登録している関数の名前（例: `a1`、`c2`、`skillHold`）。固有天賦・命ノ星座の枠の確認に使う */
  func?: string;
}

export interface KeyOwner {
  type: 'character' | 'weapon' | 'artifact' | 'template' | 'system';
  /** gcsim ソースのディレクトリ（internal/ の下。例: `characters/kazuha`、`weapons/catalyst/nocturnes`） */
  dir: string;
  /**
   * gcsim のキー（キャラ = キャラのキー、武器・聖遺物 = 武器・聖遺物のキー）。ディレクトリ内の zz_<キー>.dm.go から決める。
   * キーを持たないディレクトリ（weapons/common など共有パッケージ、テンプレート、システム）はディレクトリ名
   */
  gcsimKey: string;
  /** ディレクトリが複数のキーを持つとき（旅人の空・蛍など）の全て */
  gcsimKeys?: string[];
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
  /** 日本語の表示名（手で補う一覧、または持ち主の名前＋キー名の規則。持ち主が分からないキーには無い） */
  name?: string;
  /** 英語の表示名（日本語名が無いときの表示に使う。持ち主が分からないキーには無い） */
  nameEn?: string;
  /** 表示名の由来（manual = 手で補う一覧、rule = 規則、partial = 規則だが一部が英語のまま） */
  nameSource?: 'manual' | 'rule' | 'partial';
  /** CT のとき、どの効果（キー）のCTか（手で補う一覧） */
  cooldownOf?: string;
  /** 手で補う一覧の注記 */
  note?: string;
  /** 手で補う一覧で種類・分類を変えたとき、自動判定の値 */
  autoKind?: KeyKind;
  autoCategory?: KeyCategory;
  sources: KeySource[];
  /** gcsim の実行（全キャラ・武器・聖遺物）のログで実際に出たキー */
  observed?: boolean;
  /** auto = 自動生成のみ、manual = 手で補う一覧で上書き・追記あり、observed = ソースから読めず、実行のログで確認できたキー */
  source: 'auto' | 'manual' | 'observed';
  /** observed のとき、ディレクトリが複数のキー（複数の武器・キャラ）を持つ場合の全て */
  gcsimKeys?: string[];
}

/** 手で補うパターンのキー（gcsimKeyCatalogOverrides.ts の MANUAL_PATTERN_KEYS） */
export interface ManualPatternInput {
  key: string;
  /** true のとき、パターンではなく、そのままのキー（`Core.Status.Add` など、自動抽出の対象外の登録） */
  exact?: boolean;
  /** 種類（既定 effect） */
  kind?: KeyKind;
  elements: string[];
  file: string;
  name: string;
  durationFrames?: number;
  note?: string;
}

/** 手で補う一覧（src/masterdata/gcsimKeyCatalogOverrides.ts）の1件 */
export interface KeyOverride {
  name: string;
  /** 自動判定の種類（名前からの候補）を変えるとき */
  kind?: KeyKind;
  /** 自動判定の分類（定義場所）を変えるとき（複数の定義場所にまたがるキーなど） */
  category?: KeyCategory;
  cooldownOf?: string;
  note?: string;
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
  /** 上のうち、分類を手で確定していないキー（要確認。gcsimKeyCatalogOverrides.ts の AMBIGUOUS_KEY_CATEGORIES に追加する） */
  ambiguousUnpinned: string[];
  /** 分類の確定が、実際の定義場所の分類に無いキー（gcsim の更新で変わった・書き間違い） */
  pinsInvalid: string[];
  byCategory: Record<string, number>;
  byKind: Record<string, number>;
  /** 手で補う一覧を適用したキー数 */
  manualCount: number;
  /** 実行のログで確認できたキーのうち、辞書にあったもの・辞書に無く追加したもの */
  observedHits: number;
  observedAdded: number;
  /** 手で補う一覧に書いてあるのに辞書に無いキー（gcsim の更新で消えた・書き間違い） */
  overridesMissing: string[];
}

export interface KeyCatalog {
  gcsimCommit: string;
  generatedAt: string;
  entries: KeyCatalogEntry[];
}

// ---------------------------------------------------------------------------
// 分類（定義場所）
// ---------------------------------------------------------------------------

/** ファイルのパスから、分類と持ち主（ディレクトリまで。gcsim のキーは buildOwnerKeys で決める）を決める */
export function classifyPath(path: string): { category: KeyCategory; owner: KeyOwner } {
  const dirOf = (prefix: string) => path.slice(prefix.length).replace(/\/?[^/]+$/, '');
  let m = /^internal\/characters\/(.+)\/(\w+)\.go$/.exec(path);
  if (m) {
    const file = m[2];
    const category: KeyCategory = file === 'skill' ? 'skill'
      : file === 'burst' ? 'burst'
      : file === 'asc' ? 'talent'
      : file === 'cons' ? 'constellation'
      : ['attack', 'charge', 'aimed', 'aim', 'plunge'].includes(file) ? 'attack'
      : 'character';
    return { category, owner: { type: 'character', dir: `characters/${m[1]}`, gcsimKey: m[1] } };
  }
  if (path.startsWith('internal/weapons/')) {
    // weapons/<武器種>/<ディレクトリ>/ か、共有パッケージ weapons/common/
    const rel = dirOf('internal/weapons/');
    const dir = rel === '' || rel === 'common' ? 'common' : rel;
    return { category: 'weapon', owner: { type: 'weapon', dir: `weapons/${dir}`, gcsimKey: dir.split('/').pop()! } };
  }
  m = /^internal\/artifacts\/([^/]+)\//.exec(path);
  if (m) return { category: 'artifact', owner: { type: 'artifact', dir: `artifacts/${m[1]}`, gcsimKey: m[1] } };
  m = /^internal\/template\/([^/]+)\//.exec(path);
  if (m) return { category: 'template', owner: { type: 'template', dir: `template/${m[1]}`, gcsimKey: m[1] } };
  return { category: 'system', owner: { type: 'system', dir: packageOfPath(path), gcsimKey: path.replace(/\.go$/, '') } };
}

const packageOfPath = (path: string) => path.replace(/\/[^/]+$/, '');

/**
 * ディレクトリ → gcsim のキー。各ディレクトリの zz_<キー>.dm.go（自動生成ファイル）の名前から決める。
 * 旅人は共通ディレクトリ（characters/traveler/common/<元素>）を空・蛍の両方で使うので、両方のキーを持たせる
 */
export function buildOwnerKeys(allPaths: string[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const add = (dir: string, key: string) => {
    if (!result.has(dir)) result.set(dir, []);
    if (!result.get(dir)!.includes(key)) result.get(dir)!.push(key);
  };
  for (const p of allPaths) {
    const m = /^internal\/(characters|weapons|artifacts)\/(.+)\/zz_(\w+)\.dm\.go$/.exec(p);
    if (!m) continue;
    add(`${m[1]}/${m[2]}`, m[3]);
    const traveler = /^traveler\/(\w+)\/(aether|lumine)$/.exec(m[2]);
    if (m[1] === 'characters' && traveler) add(`characters/traveler/common/${traveler[1]}`, m[3]);
  }
  return result;
}

const packageOf = (path: string) => path.replace(/\/[^/]+$/, '');

/** 種類の候補（名前から）。粒子・エネルギー・ヒットラグは内部、icd / cd / cooldown は CT、それ以外は効果 */
export function guessKind(key: string, durationFrames?: number): KeyKind {
  if (/particle|energy|hitlag/i.test(key)) return 'internal';
  if (/icd|cooldown|(^|[^a-z])cd([^a-z]|$)/i.test(key)) {
    // 1 秒未満の間隔は、効果を重ねる間隔・内部の間隔で、ユーザーに見せるCTではない（I1 と同じ規則）
    return durationFrames !== undefined && durationFrames > 0 && durationFrames < 60 ? 'internal' : 'cooldown';
  }
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
  for (const [path, text] of sortedEntries(files)) {
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
  for (const [path, text] of sortedEntries(files)) {
    const pkg = packageOf(path);
    if (!merged.has(pkg)) merged.set(pkg, new Map());
    const target = merged.get(pkg)!;
    parseGoFile(text).consts.forEach((v, k) => { if (!target.has(k)) target.set(k, v); });
  }
  const result = new Map<string, ParsedGoFile>();
  for (const [pkg, consts] of merged) {
    result.set(pkg, { consts, intArrays: new Map(), tables: [], attackFuncTables: [], genderIndexPositions: {}, unresolved: [], methods: [] });
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

/**
 * `fmt.Sprintf("%v-hp", buffKey)` の書式の動詞を、順に、定数の値で置き換える。
 * 値が分からない引数（変数・数値など）の動詞は * にして、パターンにする
 */
function resolveSprintf(
  expr: string,
  consts: Map<string, string>,
  aliases: Map<string, Map<string, string>[]>,
): ResolvedKey | undefined {
  const call = /^fmt\.Sprintf\(([\s\S]*)\)$/.exec(expr.trim());
  if (!call) return undefined;
  const args = splitTopLevel(call[1]);
  const format = parseStringLiteral(args[0]?.trim() ?? '');
  if (format === undefined) return undefined;
  let index = 1;
  let wildcard = false;
  const key = format.replace(/%[-+# 0-9.]*[a-zA-Z]/g, () => {
    const arg = args[index++]?.trim();
    const value = arg === undefined ? undefined : parseStringLiteral(arg) ?? consts.get(arg) ?? lookupAlias(arg, aliases);
    if (value === undefined) wildcard = true;
    return value ?? '*';
  });
  return wildcard ? { kind: 'pattern', key } : { kind: 'key', key };
}

/** `common.XxxKey` のような別パッケージの定数 */
function lookupAlias(name: string, aliases: Map<string, Map<string, string>[]>): string | undefined {
  const m = /^(\w+)\.(\w+)$/.exec(name);
  if (!m) return undefined;
  for (const c of aliases.get(m[1]) ?? []) {
    const v = c.get(m[2]);
    if (v !== undefined) return v;
  }
  return undefined;
}

/** 括弧・文字列の外にあるカンマで、引数の列を分ける */
function splitTopLevel(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === '`' || ch === "'") {
      const close = ch;
      i++;
      while (i < text.length && text[i] !== close) {
        if (close !== '`' && text[i] === '\\') i++;
        i++;
      }
    } else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      args.push(text.slice(start, i));
      start = i + 1;
    }
  }
  args.push(text.slice(start));
  return args;
}

/** 開き括弧の直後（start）から、対応する閉じ括弧までの中身 */
function callBody(text: string, start: number): string | undefined {
  let depth = 1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === '`' || ch === "'") {
      const close = ch;
      i++;
      while (i < text.length && text[i] !== close) {
        if (close !== '`' && text[i] === '\\') i++;
        i++;
      }
    } else if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return text.slice(start, i);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 実行で確認できたキー
// ---------------------------------------------------------------------------

/** scripts/run-catalog-coverage.mjs が書き出す、gcsim の実行のログで出たキー */
export interface ObservedKeys {
  entries: Array<{
    key: string;
    api: 'status' | 'mod';
    permanent?: boolean;
    durationFrames?: number;
    /** 出したキャラ・武器・聖遺物（`character:<キー>` など。最大 6 件） */
    subjects: string[];
  }>;
}

/** パターンのキー（`durin-a1-{element}` / `scroll-4pc-*`）に一致する正規表現 */
function patternToRegExp(e: KeyCatalogEntry): RegExp {
  const escaped = e.key.replace(/[.+?^$()|[\]\\]/g, '\\$&');
  return new RegExp('^' + escaped.replace('{element}', `(${(e.elements ?? []).join('|')})`).replace(/\*/g, '.*') + '$');
}

/** 実行のログにだけ出たキーから、辞書のエントリを作る。持ち主は、そのキーを出した対象 */
function entryFromObserved(o: ObservedKeys['entries'][number]): KeyCatalogEntry {
  const subjects = o.subjects.map(s => {
    const [type, key] = s.split(':');
    return { type: type as 'character' | 'weapon' | 'artifact', key };
  });
  const first = subjects[0];
  // 多くの対象が同じキーを出す（ダッシュ・夜魂の共通処理など）ものは、システムの効果
  const shared = subjects.length >= 5;
  const category: KeyCategory = shared ? 'system'
    : first.type === 'weapon' ? 'weapon'
    : first.type === 'artifact' ? 'artifact'
    : /-a[14]($|-)/.test(o.key) ? 'talent'
    : /-c[1-6]($|-)/.test(o.key) ? 'constellation'
    : 'character';
  const owner: KeyOwner = shared
    ? { type: 'system', dir: 'runtime', gcsimKey: 'shared' }
    : { type: first.type, dir: `${first.type}s/${first.key}`, gcsimKey: first.key, ...(subjects.length > 1 ? { gcsimKeys: subjects.map(s => s.key) } : {}) };
  return {
    key: o.key,
    category,
    owner,
    kind: guessKind(o.key, o.durationFrames),
    ...(o.permanent ? { permanent: true } : {}),
    ...(o.durationFrames !== undefined ? { durationFrames: o.durationFrames } : {}),
    observed: true,
    sources: [{ file: 'gcsim 実行のログ', api: o.api }],
    source: 'observed',
  };
}

// ---------------------------------------------------------------------------
// 抽出
// ---------------------------------------------------------------------------

/** キー登録の呼び出し: 1 つ目の引数がキー、2 つ目が継続時間 */
const CALL_RE = /(\.AddStatus\(|Core\.Status\.Add\(|modifier\.NewBase(?:WithHitlag)?\()/g;

interface RawKey {
  key: string;
  isPattern: boolean;
  elements?: string[];
  path: string;
  api: 'status' | 'mod';
  func?: string;
  durationFrames?: number;
}

/** ファイルをパス順に並べる（並列取得の完了順に依存しない。辞書の生成を決定的にする） */
function sortedEntries(files: Record<string, string>): Array<[string, string]> {
  return Object.entries(files).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** 定義場所が複数の分類・持ち主にまたがる「曖昧な」キーの、分類の確定（理由つき。gcsimKeyCatalogOverrides.ts の AMBIGUOUS_KEY_CATEGORIES） */
export interface AmbiguousKeyPin {
  category: KeyCategory;
  reason: string;
}

/**
 * gcsim のソース（パス → 中身）から、キーの辞書を作る。
 * @param files internal/characters・weapons・artifacts・template と pkg/simulation/setup.go の Go ソース
 * @param allPaths gcsim のリポジトリの全ファイルのパス（ディレクトリと gcsim のキーの対応に使う zz_*.dm.go を含む）
 */
export function extractKeyCatalog(
  files: Record<string, string>,
  gcsimCommit: string,
  allPaths: string[] = [],
  overrides: Record<string, KeyOverride> = {},
  observed?: ObservedKeys,
  manualPatterns: ManualPatternInput[] = [],
  ambiguousPins: Record<string, AmbiguousKeyPin> = {},
): { catalog: KeyCatalog; report: KeyCatalogReport } {
  const ownerKeys = buildOwnerKeys(allPaths);
  const withKeys = (owner: KeyOwner): KeyOwner => {
    const keys = ownerKeys.get(owner.dir);
    if (!keys || keys.length === 0) return owner;
    return { ...owner, gcsimKey: keys[0], ...(keys.length > 1 ? { gcsimKeys: keys } : {}) };
  };
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
    totalCalls: 0, resolvedCalls: 0, patternCalls: 0, unresolved: [], ambiguous: [], ambiguousUnpinned: [], pinsInvalid: [], byCategory: {}, byKind: {}, manualCount: 0, observedHits: 0, observedAdded: 0, overridesMissing: [],
  };

  for (const [path, text] of sortedEntries(files)) {
    const pkg = packageOf(path);
    const consts = stringConsts.get(pkg) ?? new Map<string, string>();
    const numbers = numberConsts.get(pkg);
    // 関数の位置（登録している関数の名前を調べる用）
    const funcStarts = [...text.matchAll(/^func\s+(?:\([^)]*\)\s*)?(\w+)/gm)].map(f => ({ index: f.index ?? 0, name: f[1] }));
    for (const m of text.matchAll(CALL_RE)) {
      const body = callBody(text, (m.index ?? 0) + m[0].length);
      if (body === undefined) continue;
      const callArgs = splitTopLevel(body);
      if (callArgs.length < 2) continue;
      report.totalCalls++;
      const api: 'status' | 'mod' = m[1].includes('NewBase') ? 'mod' : 'status';
      const expr = callArgs[0].trim();
      const resolved = resolveKeyExpr(expr, consts, aliases, text) ?? resolveSprintf(expr, consts, aliases);
      // パターンは、固定の接頭辞が 3 文字以上あるものだけ（`*-*` のような何にでも一致するものは使えない）
      if (!resolved || (resolved.kind === 'pattern' && !/^[^*{]{3,}/.test(resolved.key))) {
        report.unresolved.push({ file: path, expr: expr.trim().replace(/\s+/g, ' ') });
        continue;
      }
      const duration = numbers ? evaluateGoExpr(callArgs[1].trim(), numbers) : undefined;
      raws.push({
        key: resolved.key,
        isPattern: resolved.kind === 'pattern',
        elements: resolved.kind === 'pattern' ? resolved.elements : undefined,
        path,
        api,
        func: funcStarts.filter(f => f.index <= (m.index ?? 0)).pop()?.name,
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
    const places = new Set(list.map(r => {
      const c = classifyPath(r.path);
      return `${c.category}:${withKeys(c.owner).gcsimKey}`;
    }));
    const ambiguous = places.size > 1;
    if (ambiguous) report.ambiguous.push({ key, places: [...places] });
    // 分類: 曖昧なキーは、手で確定した分類（ambiguousPins）。無ければパス順で最初の定義場所（レポートに「未確定」として出す）
    let first = list[0];
    const pin = ambiguous ? ambiguousPins[key] : undefined;
    if (ambiguous && !pin) report.ambiguousUnpinned.push(key);
    if (pin) {
      const pinned = list.find(r => classifyPath(r.path).category === pin.category);
      if (pinned) first = pinned;
      else report.pinsInvalid.push(key);
    }
    const classified = classifyPath(first.path);
    const category = classified.category;
    let owner = withKeys(classified.owner);
    // 持ち主: 同じ種類（キャラ同士・武器同士）の持ち主が複数あるキーは、全員の gcsim のキーを持たせる（例: millennial-atk% は終焉を嘆く詩・松韻の響く頃・自由への誓い）
    const owners = list.map(r => withKeys(classifyPath(r.path).owner));
    if (owners.every(o => o.type === owner.type)) {
      const merged: string[] = [];
      for (const o of [owner, ...owners]) for (const k of o.gcsimKeys ?? (o.gcsimKey ? [o.gcsimKey] : [])) if (!merged.includes(k)) merged.push(k);
      if (merged.length > 1) owner = { ...owner, gcsimKey: merged[0], gcsimKeys: merged };
    }

    const durations = list.map(r => r.durationFrames).filter((d): d is number => d !== undefined);
    const sources: KeySource[] = [];
    for (const r of list) {
      if (!sources.some(s => s.file === r.path && s.api === r.api && s.func === r.func)) sources.push({ file: r.path, api: r.api, ...(r.func ? { func: r.func } : {}) });
    }
    const entry: KeyCatalogEntry = {
      key,
      ...(first.isPattern ? { isPattern: true } : {}),
      ...(first.elements ? { elements: first.elements } : {}),
      category,
      owner,
      kind: guessKind(key, durations.find(d => d > 0)),
      ...(durations.includes(-1) ? { permanent: true } : {}),
      ...(durations.length > 0 && !durations.includes(-1) ? { durationFrames: durations[0] } : {}),
      ...(ambiguous ? { ambiguous: true } : {}),
      sources,
      source: 'auto',
    };
    // 手で補う一覧（D10・5-2b）: 表示名・種類・分類・CTの紐付けを上書きする。自動判定の値は autoKind / autoCategory に残す
    const override = overrides[key];
    if (override) {
      entry.name = override.name;
      if (override.kind && override.kind !== entry.kind) { entry.autoKind = entry.kind; entry.kind = override.kind; }
      if (override.category && override.category !== entry.category) { entry.autoCategory = entry.category; entry.category = override.category; }
      if (override.cooldownOf) entry.cooldownOf = override.cooldownOf;
      if (override.note) entry.note = override.note;
      entry.source = 'manual';
      report.manualCount++;
    }
    entries.push(entry);
    report.byCategory[entry.category] = (report.byCategory[entry.category] ?? 0) + 1;
    report.byKind[entry.kind] = (report.byKind[entry.kind] ?? 0) + 1;
  }

  // 手で補うパターンのキー（自動で読めないもの。自動抽出で見つかっていれば追加しない）
  for (const mp of manualPatterns) {
    if (entries.some(e => e.key === mp.key)) continue;
    const classified = classifyPath(mp.file);
    const entry: KeyCatalogEntry = {
      key: mp.key,
      ...(mp.exact ? {} : { isPattern: true, elements: mp.elements }),
      category: classified.category,
      owner: withKeys(classified.owner),
      kind: mp.kind ?? 'effect',
      ...(mp.durationFrames !== undefined ? { durationFrames: mp.durationFrames } : {}),
      name: mp.name,
      ...(mp.note ? { note: mp.note } : {}),
      sources: [{ file: mp.file, api: 'mod' }],
      source: 'manual',
    };
    entries.push(entry);
    report.manualCount++;
    report.byCategory[entry.category] = (report.byCategory[entry.category] ?? 0) + 1;
    report.byKind[entry.kind] = (report.byKind[entry.kind] ?? 0) + 1;
  }
  entries.sort((a, b) => a.key.localeCompare(b.key));

  // 実行で確認できたキー（scripts/run-catalog-coverage.mjs の結果）: 辞書にあれば observed の印、無ければ追加する
  if (observed) {
    const matchers = entries.map(e => ({ e, re: e.isPattern ? patternToRegExp(e) : undefined }));
    const find = (key: string) => matchers.find(m => (m.re ? m.re.test(key) : m.e.key === key))?.e;
    for (const o of observed.entries) {
      const existing = find(o.key);
      if (existing) {
        existing.observed = true;
        report.observedHits++;
        continue;
      }
      const entry = entryFromObserved(o);
      const override = overrides[o.key];
      if (override) {
        entry.name = override.name;
        if (override.kind) entry.kind = override.kind;
        if (override.category) entry.category = override.category;
        if (override.cooldownOf) entry.cooldownOf = override.cooldownOf;
        if (override.note) entry.note = override.note;
        report.manualCount++;
      }
      entries.push(entry);
      matchers.push({ e: entry, re: undefined });
      report.observedAdded++;
      report.byCategory[entry.category] = (report.byCategory[entry.category] ?? 0) + 1;
      report.byKind[entry.kind] = (report.byKind[entry.kind] ?? 0) + 1;
    }
    entries.sort((a, b) => a.key.localeCompare(b.key));
  }

  const known = new Set(entries.map(e => e.key));
  report.overridesMissing = Object.keys(overrides).filter(k => !known.has(k));

  return {
    catalog: { gcsimCommit, generatedAt: new Date().toISOString(), entries },
    report,
  };
}
