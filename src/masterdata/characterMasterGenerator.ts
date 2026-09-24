/**
 * キャラクターマスターデータ生成器 (ブラウザ / Node 共通)
 *
 * データソース (すべてネットから最新を取得する):
 *   - genshin-db API … キャラ基本データ (名前・元素・武器種・レア度)、スキル/爆発の CT・効果継続時間、アイコンのファイル名
 *       https://genshin-db-api.vercel.app/api/v5
 *   - enka.network … ゲーム内アイコン画像 (genshin-db の filename_icon から URL を組み立てる)
 *   - gcsim (GitHub) … 各アクションのモーションフレーム (60 FPS)
 *       https://github.com/genshinsim/gcsim/tree/main/internal/characters
 *
 * キャラの突き合わせは gcsim の ui/packages/ui/src/Data/character.dm.json にある
 * 公式キャラID (例: 胡桃 = 10000046) で行う。名前の表記ゆれ (raidenshogun / raiden 等) に依存しない。
 *
 * 取得できなかった値は仮の数値で埋めずに未設定のままにし、レポートに記録する。
 */
import type { ActionDefinition, ActionFrames, ActionType, CharacterConfig, ElementType, WeaponType } from '../types/genshin.ts';
import { parseGoFile, findHitmark, type FrameTable, type ParsedGoFile } from './gcsimParser.ts';

export const GENSHIN_DB_API = 'https://genshin-db-api.vercel.app/api/v5';
/** genshin-db の mihoyo_icon は新しいキャラほどリンク切れが多いため、ゲーム内ファイル名から enka の画像を使う */
const ICON_BASE_URL = 'https://enka.network/ui';
const GCSIM_REPO = 'genshinsim/gcsim';
const GCSIM_BRANCH = 'main';
const GCSIM_CHAR_DM_PATH = 'ui/packages/ui/src/Data/character.dm.json';

/** 旅人 (空 / 蛍)。genshin-db ではキャラとしては元素なし、天賦は元素ごとに別エントリ */
const AETHER_ID = 10000005;
const TRAVELER_IDS = new Set([AETHER_ID, 10000007]);

/** genshin-db の旅人天賦名 "旅人 (風元素)" の元素文字 → 元素 */
const TRAVELER_ELEMENT_JA: Record<string, ElementType> = {
  炎: 'pyro', 水: 'hydro', 風: 'anemo', 雷: 'electro', 草: 'dendro', 氷: 'cryo', 岩: 'geo',
};

/** gcsim の旅人フレームは先頭添字が性別 (0 = 空, 1 = 蛍) */
const TRAVELER_GENDERS = [
  { index: 0, label: '空', suffix: 'aether' },
  { index: 1, label: '蛍', suffix: 'lumine' },
] as const;

/** フレームが取得できなかった場合にタイムライン表示用として使う秒数 (レポートで「仮値」として明示) */
const PLACEHOLDER_DURATION: Partial<Record<ActionType, number>> = {
  normal: 0.4,
  charged: 0.8,
  skill: 0.8,
  skill_hold: 1.2,
  burst: 1.5,
  dash: 0.2,
};

const ELEMENT_MAP: Record<string, ElementType> = {
  ELEMENT_PYRO: 'pyro',
  ELEMENT_HYDRO: 'hydro',
  ELEMENT_ELECTRO: 'electro',
  ELEMENT_DENDRO: 'dendro',
  ELEMENT_CRYO: 'cryo',
  ELEMENT_ANEMO: 'anemo',
  ELEMENT_GEO: 'geo',
};

const ELEMENT_HEX: Record<ElementType, string> = {
  pyro: '#ef4444',
  hydro: '#0ea5e9',
  electro: '#a855f7',
  dendro: '#10b981',
  cryo: '#06b6d4',
  anemo: '#14b8a6',
  geo: '#f59e0b',
  physical: '#94a3b8',
};

const WEAPON_MAP: Record<string, WeaponType> = {
  WEAPON_SWORD_ONE_HAND: 'sword',
  WEAPON_CLAYMORE: 'claymore',
  WEAPON_POLE: 'polearm',
  WEAPON_BOW: 'bow',
  WEAPON_CATALYST: 'catalyst',
};

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export interface GenerationProgress {
  phase: string;
  done: number;
  total: number;
}

export interface CharacterGenerationReport {
  generatedAt: string;
  gcsimCommit: string;
  totalCharacters: number;
  charactersWithFrames: number;
  /** 生成対象外にしたキャラ */
  skipped: Array<{ name: string; reason: string }>;
  /** フレームが取れず仮の秒数を使ったアクション */
  placeholderDurations: Array<{ characterId: string; name: string; actions: string[]; reason: string }>;
  /** CT が genshin-db から取れなかったスキル/爆発 */
  missingCooldowns: Array<{ characterId: string; name: string; actionId: string }>;
  /** gcsim の式を評価できなかった行数 */
  unresolvedGoLines: Array<{ characterId: string; file: string; count: number }>;
  errors: string[];
}

export interface CharacterMasterResult {
  characters: CharacterConfig[];
  report: CharacterGenerationReport;
}

interface GenshinDbCharacter {
  id: number;
  name: string;
  elementType: string;
  weaponType: string;
  rarity: number;
  images?: Record<string, string>;
}

interface GenshinDbTalentCombat {
  name: string;
  attributes?: { labels?: string[]; parameters?: Record<string, number[]> };
}

interface GenshinDbTalent {
  id: number;
  name: string;
  combat2?: GenshinDbTalentCombat;
  combat3?: GenshinDbTalentCombat;
}

// ---------------------------------------------------------------------------
// 取得ヘルパー
// ---------------------------------------------------------------------------

async function fetchWithRetry(url: string, init?: RequestInit, retries = 2): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
      if (res.status === 403 || res.status === 404) break; // レート制限・存在しないものは再試行しない
    } catch (e) {
      lastError = e;
    }
    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => (await fetchWithRetry(url, init)).json() as Promise<T>;
const fetchText = async (url: string): Promise<string> => (await fetchWithRetry(url)).text();

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

// ---------------------------------------------------------------------------
// genshin-db: CT・効果継続時間の抽出
// ---------------------------------------------------------------------------

interface LabeledValue {
  value: number;
  label: string;
}

/** ラベル "クールタイム|{param6:F1}秒" から数値を取り出す (天賦 Lv1 の値)。複数 param があれば全て返す */
function labelValues(label: string, params: Record<string, number[]>): number[] {
  const formula = label.split('|')[1] ?? '';
  return [...formula.matchAll(/\{(param\d+):[^}]*\}/g)]
    .map(m => params[m[1]]?.[0])
    .filter((v): v is number => typeof v === 'number');
}

function findLabel(
  combat: GenshinDbTalentCombat | undefined,
  titles: string[],
  pick: 'first' | 'last' = 'first',
): LabeledValue | undefined {
  const labels = combat?.attributes?.labels ?? [];
  const params = combat?.attributes?.parameters ?? {};
  for (const title of titles) {
    const label = labels.find(l => l.split('|')[0].trim() === title);
    if (!label) continue;
    const values = labelValues(label, params);
    if (values.length === 0) continue;
    return { value: pick === 'first' ? values[0] : values[values.length - 1], label: title };
  }
  return undefined;
}

/** "〜継続時間" で終わるラベルのうち最初のもの (延長・CT 系は除外) */
function findAnyDuration(combat: GenshinDbTalentCombat | undefined, exclude: RegExp): LabeledValue | undefined {
  const labels = combat?.attributes?.labels ?? [];
  const params = combat?.attributes?.parameters ?? {};
  for (const label of labels) {
    const title = label.split('|')[0].trim();
    if (!/継続時間$/.test(title) || exclude.test(title)) continue;
    const values = labelValues(label, params);
    if (values.length > 0) return { value: values[0], label: title };
  }
  return undefined;
}

interface TalentTimings {
  skillTapCooldown?: LabeledValue;
  skillHoldCooldown?: LabeledValue;
  skillTapDuration?: LabeledValue;
  skillHoldDuration?: LabeledValue;
  burstCooldown?: LabeledValue;
  burstDuration?: LabeledValue;
}

function extractTalentTimings(talent: GenshinDbTalent | undefined): TalentTimings {
  const skill = talent?.combat2;
  const burst = talent?.combat3;

  const tapCdTitles = ['一回押しクールタイム', 'クールタイム', 'スキルクールタイム', 'スキルのクールタイム', '基本クールタイム'];
  let skillTapCooldown = findLabel(skill, tapCdTitles);
  let skillHoldCooldown = findLabel(skill, ['長押しクールタイム', '最大チャージクールタイム']);
  // "クールタイム|{一回押し}/{長押し}秒" のように1ラベルに2値ある場合
  if (!skillHoldCooldown) {
    const both = findLabel(skill, ['クールタイム'], 'last');
    if (both && skillTapCooldown && both.value !== skillTapCooldown.value) {
      skillHoldCooldown = { value: both.value, label: 'クールタイム (2値目)' };
    }
  }

  const tapDurTitles = ['継続時間', '一回押し/長押し継続時間', '基礎継続時間', '最大継続時間'];
  const skillTapDuration = findLabel(skill, tapDurTitles) ?? findAnyDuration(skill, /延長|長押し|クールタイム/);
  const skillHoldDuration = findLabel(skill, ['長押し最大継続時間', '長押しの継続時間', '一回押し/長押し継続時間']) ?? skillTapDuration;

  const burstCooldown = findLabel(burst, ['クールタイム']);
  const burstDuration = findLabel(burst, ['継続時間', '基礎継続時間']) ?? findAnyDuration(burst, /延長|クールタイム/);

  return { skillTapCooldown, skillHoldCooldown, skillTapDuration, skillHoldDuration, burstCooldown, burstDuration };
}

// ---------------------------------------------------------------------------
// gcsim: フレームテーブルの選択
// ---------------------------------------------------------------------------

interface ParsedCharacterFiles {
  /** ファイル名 (拡張子なし) → 解析結果 */
  files: Record<string, ParsedGoFile>;
}

/** "skillFrames[1]" → { base: "skillFrames", index: "1" } */
function splitTableName(name: string): { base: string; index?: string } {
  const m = /^(\w+?)((?:\[\w+\])*)$/.exec(name);
  if (!m || !m[2]) return { base: name };
  return { base: m[1], index: m[2] };
}

/** 同じ配列 (base 名) のうち最初に定義されたテーブルだけを残す */
function firstOfEachFamily(tables: FrameTable[]): FrameTable[] {
  const seen = new Set<string>();
  return tables.filter(t => {
    const { base } = splitTableName(t.name);
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  });
}

function toActionFrames(table: FrameTable, file: string, consts: Map<string, number>): ActionFrames {
  const hitmark = findHitmark(table, consts);
  return {
    total: table.total,
    ...(hitmark !== undefined ? { hitmark } : {}),
    cancels: { ...table.cancels },
    source: `${file}.go:${table.name}`,
  };
}

const framesToSec = (f: number) => Number((f / 60).toFixed(3));

// ---------------------------------------------------------------------------
// アクション定義の組み立て
// ---------------------------------------------------------------------------

interface BuildContext {
  id: string;
  weaponType: WeaponType;
  timings: TalentTimings;
  talent?: GenshinDbTalent;
  parsed?: ParsedCharacterFiles;
}

interface BuildResult {
  actions: ActionDefinition[];
  placeholderActions: string[];
}

function buildActions(ctx: BuildContext): BuildResult {
  const { id, timings, talent, parsed } = ctx;
  const actions: ActionDefinition[] = [];
  const placeholderActions: string[] = [];

  const withDuration = (action: Omit<ActionDefinition, 'defaultDuration'>, durationSec?: number): ActionDefinition => {
    if (durationSec === undefined) {
      placeholderActions.push(action.id);
      return { ...action, defaultDuration: PLACEHOLDER_DURATION[action.type] ?? 0.5 };
    }
    return { ...action, defaultDuration: durationSec };
  };

  const file = (name: string) => parsed?.files[name];

  // --- 通常攻撃 N1..Nn ---------------------------------------------------
  const attack = file('attack');
  let normalTables: FrameTable[] = [];
  if (attack) {
    // 段ごとのテーブルを「最後の添字を除いた名前」でグループ化する
    // (attackFrames[0..4] / attackFrames[attack0Stacks][0..3] / attackFrames[attackTypeLeft] など)
    const groups = new Map<string, FrameTable[]>();
    for (const t of attack.tables) {
      const m = /^(.*)\[\w+\]$/.exec(t.name);
      if (!m) continue;
      if (!groups.has(m[1])) groups.set(m[1], []);
      groups.get(m[1])!.push(t);
    }
    const groupKeys = [...groups.keys()];
    const baseOf = (key: string) => splitTableName(key).base;
    // NewAttackFunc で実際に使われている配列を優先し、無ければ attack* で始まる最初の配列
    const key = attack.attackFuncTables.map(af => groupKeys.find(k => baseOf(k) === af)).find(Boolean)
      ?? groupKeys.find(k => /^attack/i.test(baseOf(k)));
    if (key) normalTables = groups.get(key)!;
  }
  if (attack && normalTables.length > 0) {
    normalTables.forEach((table, i) => {
      const isLast = i === normalTables.length - 1;
      const frames = toActionFrames(table, 'attack', attack.consts);
      // gcsim の attackFrames[i] は「i+1段目を単体で振った」ときのフレーム (合計ではない)。
      // 次段へ繋ぐ前提: 最終段以外は「次の通常攻撃へのキャンセル」フレーム、最終段は全体フレーム
      const toNext = isLast ? table.total : (table.cancels.attack ?? table.total);
      actions.push(withDuration({
        id: `${id}_n${i + 1}`,
        name: `通常攻撃 ${i + 1}段目`,
        shortName: 'N',
        buttonLabel: `N(${i + 1}段目)`,
        type: 'normal',
        frames,
      }, framesToSec(toNext)));
    });
  } else {
    actions.push(withDuration({ id: `${id}_n1`, name: '通常攻撃 1段目', shortName: 'N', buttonLabel: 'N(1段目)', type: 'normal' }));
  }

  // --- 重撃 / 狙い撃ち -----------------------------------------------------
  const aimed = file('aimed') ?? file('aim');
  const charge = file('charge');
  if (aimed && aimed.tables.length > 0) {
    // aimedFrames[0] = 非チャージ, 最終添字 = フルチャージ
    const family = splitTableName(aimed.tables[0].name).base;
    const levels = aimed.tables.filter(t => splitTableName(t.name).base === family);
    const full = levels[levels.length - 1];
    actions.push(withDuration({
      id: `${id}_ca`,
      name: '狙い撃ち (フルチャージ)',
      shortName: 'CA',
      type: 'charged',
      frames: toActionFrames(full, 'aimed', aimed.consts),
    }, framesToSec(full.total)));
  } else if (charge && charge.tables.length > 0) {
    const table = charge.tables.find(t => t.name === 'chargeFrames')
      ?? charge.tables.find(t => /^charge/i.test(t.name))
      ?? charge.tables[0];
    actions.push(withDuration({
      id: `${id}_ca`,
      name: '重撃',
      shortName: 'CA',
      type: 'charged',
      frames: toActionFrames(table, 'charge', charge.consts),
    }, framesToSec(table.total)));
  } else {
    actions.push(withDuration({ id: `${id}_ca`, name: '重撃', shortName: 'CA', type: 'charged' }));
  }

  // --- 元素スキル (一回押し / 長押し / その他派生) ------------------------------
  const skillName = talent?.combat2?.name;
  const skill = file('skill');
  const skillTables = skill ? skill.tables.filter(t => !/Walk|Dash|Cancel|End|Lag|Delay/i.test(splitTableName(t.name).base)) : [];
  const families = firstOfEachFamily(skillTables);
  const holdTable = families.find(t => /hold/i.test(t.name) && !/short/i.test(t.name));
  const tapTable = families.find(t => !/hold/i.test(t.name));
  let resolvedHoldTable = holdTable;
  // 明示的な Hold テーブルが無く、genshin-db に長押しCTがあり、一回押しが添字付き配列なら [1] を長押しとみなす
  if (!resolvedHoldTable && timings.skillHoldCooldown && tapTable) {
    const { base } = splitTableName(tapTable.name);
    resolvedHoldTable = skillTables.find(t => t.name === `${base}[1]`);
  }

  actions.push(withDuration({
    id: `${id}_e`,
    name: skillName ? `元素スキル: ${skillName}` : '元素スキル',
    shortName: 'E',
    buttonLabel: timings.skillHoldCooldown || resolvedHoldTable ? 'E(一回押し)' : 'E',
    type: 'skill',
    startsSkillCooldown: true,
    cooldown: timings.skillTapCooldown?.value,
    effectDuration: timings.skillTapDuration?.value ?? 0,
    frames: tapTable && skill ? toActionFrames(tapTable, 'skill', skill.consts) : undefined,
    dataSource: {
      cooldown: timings.skillTapCooldown?.label,
      effectDuration: timings.skillTapDuration?.label,
    },
  }, tapTable ? framesToSec(tapTable.total) : undefined));

  if (timings.skillHoldCooldown || resolvedHoldTable) {
    const holdCd = timings.skillHoldCooldown ?? timings.skillTapCooldown;
    actions.push(withDuration({
      id: `${id}_e_hold`,
      name: skillName ? `元素スキル(長押し): ${skillName}` : '元素スキル(長押し)',
      shortName: '長押しE',
      buttonLabel: 'E(長押し)',
      type: 'skill_hold',
      startsSkillCooldown: true,
      cooldown: holdCd?.value,
      effectDuration: timings.skillHoldDuration?.value ?? 0,
      frames: resolvedHoldTable && skill ? toActionFrames(resolvedHoldTable, 'skill', skill.consts) : undefined,
      dataSource: {
        cooldown: holdCd?.label,
        effectDuration: timings.skillHoldDuration?.label,
      },
    }, resolvedHoldTable ? framesToSec(resolvedHoldTable.total) : undefined));
  }

  // 再発動などの派生スキル (CT は開始しない)
  if (skill) {
    for (const table of families) {
      if (table === tapTable || table === holdTable) continue;
      const suffix = splitTableName(table.name).base.replace(/^skill/i, '').replace(/Frames?$/i, '') || 'alt';
      const slug = suffix.charAt(0).toLowerCase() + suffix.slice(1);
      actions.push({
        id: `${id}_e_${slug.toLowerCase()}`,
        name: `元素スキル派生: ${slug}`,
        shortName: 'E',
        buttonLabel: `E(${slug})`,
        type: 'skill',
        startsSkillCooldown: false,
        defaultDuration: framesToSec(table.total),
        frames: toActionFrames(table, 'skill', skill.consts),
      });
    }
  }

  // --- 元素爆発 -------------------------------------------------------------
  const burstFile = file('burst');
  const burstTable = burstFile?.tables.find(t => /^burst/i.test(t.name)) ?? burstFile?.tables[0];
  const burstName = talent?.combat3?.name;
  actions.push(withDuration({
    id: `${id}_q`,
    name: burstName ? `元素爆発: ${burstName}` : '元素爆発',
    shortName: 'Q',
    type: 'burst',
    startsBurstCooldown: true,
    cooldown: timings.burstCooldown?.value,
    effectDuration: timings.burstDuration?.value ?? 0,
    frames: burstTable && burstFile ? toActionFrames(burstTable, 'burst', burstFile.consts) : undefined,
    dataSource: {
      cooldown: timings.burstCooldown?.label,
      effectDuration: timings.burstDuration?.label,
    },
  }, burstTable ? framesToSec(burstTable.total) : undefined));

  // --- ダッシュ (キャラ固有フレームは gcsim 側で共通処理のため仮値) --------------
  actions.push({ id: `${id}_dash`, name: 'ダッシュ', shortName: 'D', type: 'dash', defaultDuration: PLACEHOLDER_DURATION.dash! });

  return { actions, placeholderActions };
}

// ---------------------------------------------------------------------------
// 旅人: 性別ごとのフレーム
// ---------------------------------------------------------------------------

/** "a[1][0]" → ["1", "0"] */
const tableIndices = (name: string) => [...name.matchAll(/\[(\w+)\]/g)].map(m => m[1]);

/**
 * 性別の添字の位置を決める。X[..][c.gender] の参照があればその位置、
 * 無ければ (ローカル変数経由で参照される場合など) 先頭の添字がちょうど 0 と 1 の配列を性別とみなす。
 */
function genderPosition(file: ParsedGoFile, base: string): number | undefined {
  const explicit = file.genderIndexPositions[base];
  if (explicit !== undefined) return explicit;
  const firsts = new Set(file.tables.filter(t => splitTableName(t.name).base === base).map(t => tableIndices(t.name)[0]));
  return firsts.size === 2 && firsts.has('0') && firsts.has('1') ? 0 : undefined;
}

/** 性別で分かれたテーブルから指定性別の分だけを取り出し、性別の添字を外した見え方にする */
function genderView(parsed: ParsedCharacterFiles, gender: number): ParsedCharacterFiles {
  const files: Record<string, ParsedGoFile> = {};
  for (const [name, file] of Object.entries(parsed.files)) {
    const tables = file.tables.flatMap(t => {
      const { base } = splitTableName(t.name);
      const position = genderPosition(file, base);
      if (position === undefined) return [t];
      const indices = tableIndices(t.name);
      if (indices[position] !== String(gender)) return [];
      indices.splice(position, 1);
      return [{ ...t, name: `${base}${indices.map(i => `[${i}]`).join('')}` }];
    });
    files[name] = { ...file, tables };
  }
  return { files };
}

const sameFrames = (a?: ActionFrames, b?: ActionFrames) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * 空・蛍それぞれで組み立てたアクションを統合する。
 * フレームが同じものは1つにまとめ、異なるものは「(空)」「(蛍)」を付けて両方登録する (記法略称は共通)。
 */
function mergeGenderActions(results: BuildResult[]): BuildResult {
  const actions: ActionDefinition[] = [];
  const placeholderActions = new Set<string>();
  const ids = [...new Set(results.flatMap(r => r.actions.map(a => a.id)))];
  for (const id of ids) {
    const variants = results.map(r => r.actions.find(a => a.id === id));
    const first = variants.find((v): v is ActionDefinition => !!v)!;
    const allSame = variants.every(v => v && sameFrames(v.frames, first.frames) && v.defaultDuration === first.defaultDuration);
    if (allSame) {
      actions.push(first);
      if (results.some(r => r.placeholderActions.includes(id))) placeholderActions.add(id);
      continue;
    }
    variants.forEach((v, i) => {
      if (!v) return;
      const gender = TRAVELER_GENDERS[i];
      const variantId = `${id}_${gender.suffix}`;
      actions.push({
        ...v,
        id: variantId,
        name: `${v.name}(${gender.label})`,
        buttonLabel: `${v.buttonLabel ?? v.shortName}(${gender.label})`,
      });
      if (results[i].placeholderActions.includes(id)) placeholderActions.add(variantId);
    });
  }
  return { actions, placeholderActions: [...placeholderActions] };
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

export const normalizeCharacterId = (englishName: string) => englishName.toLowerCase().replace(/[^a-z0-9]/g, '');

const GCSIM_FILES = ['attack', 'charge', 'aimed', 'aim', 'skill', 'burst'];

export async function generateCharacterMaster(
  onProgress?: (p: GenerationProgress) => void,
): Promise<CharacterMasterResult> {
  const errors: string[] = [];
  const report: CharacterGenerationReport = {
    generatedAt: new Date().toISOString(),
    gcsimCommit: '',
    totalCharacters: 0,
    charactersWithFrames: 0,
    skipped: [],
    placeholderDurations: [],
    missingCooldowns: [],
    unresolvedGoLines: [],
    errors,
  };

  // 1. genshin-db + gcsim のインデックスを並列取得
  onProgress?.({ phase: 'genshin-db / gcsim の一覧を取得中', done: 0, total: 1 });
  const verbose = 'query=names&matchCategories=true&verboseCategories=true';
  const [charsJa, charsEn, talentsJa, tree, charDm] = await Promise.all([
    fetchJson<GenshinDbCharacter[]>(`${GENSHIN_DB_API}/characters?${verbose}&resultLanguage=Japanese`),
    fetchJson<GenshinDbCharacter[]>(`${GENSHIN_DB_API}/characters?${verbose}&resultLanguage=English`),
    fetchJson<GenshinDbTalent[]>(`${GENSHIN_DB_API}/talents?${verbose}&resultLanguage=Japanese`),
    fetchJson<{ sha: string; truncated: boolean; tree: Array<{ path: string; type: string }> }>(
      `https://api.github.com/repos/${GCSIM_REPO}/git/trees/${GCSIM_BRANCH}?recursive=1`,
      { headers: { Accept: 'application/vnd.github+json' } },
    ),
    fetchJson<{ data: Record<string, { id: number; key: string }> }>(
      `https://raw.githubusercontent.com/${GCSIM_REPO}/${GCSIM_BRANCH}/${GCSIM_CHAR_DM_PATH}`,
    ),
  ]);
  report.gcsimCommit = tree.sha;
  const rawBase = `https://raw.githubusercontent.com/${GCSIM_REPO}/${tree.sha}/`;

  // 2. gcsim: 公式キャラID → キー → ディレクトリ
  const dirByKey = new Map<string, string>();
  const filesByDir = new Map<string, Set<string>>();
  for (const { path } of tree.tree) {
    const dm = /^internal\/characters\/(.+)\/zz_(\w+)\.dm\.go$/.exec(path);
    if (dm) dirByKey.set(dm[2], dm[1]);
    const go = /^internal\/characters\/(.+)\/(\w+)\.go$/.exec(path);
    if (go) {
      if (!filesByDir.has(go[1])) filesByDir.set(go[1], new Set());
      filesByDir.get(go[1])!.add(go[2]);
    }
  }
  const gcsimKeyByGenshinId = new Map<number, string>();
  for (const [key, entry] of Object.entries(charDm.data)) {
    if (!TRAVELER_IDS.has(entry.id)) gcsimKeyByGenshinId.set(entry.id, key);
  }

  const englishById = new Map(charsEn.map(c => [c.id, c.name]));
  const talentByName = new Map(talentsJa.map(t => [t.name, t]));
  const talentById = new Map(talentsJa.map(t => [t.id, t]));
  const iconUrl = (c?: GenshinDbCharacter) =>
    c?.images?.filename_icon ? `${ICON_BASE_URL}/${c.images.filename_icon}.png` : (c?.images?.mihoyo_icon ?? '');

  // 生成単位 (通常キャラ + 元素ごとの旅人)
  interface BuildUnit {
    id: string;
    name: string;
    englishName: string;
    element: ElementType;
    weaponType: WeaponType;
    rarity: number;
    avatarUrl: string;
    genshinId: number;
    talent?: GenshinDbTalent;
    gcsimKey?: string;
    gcsimDir?: string;
    /** 旅人: 空・蛍でフレームを分けて組み立てる */
    genderSplit?: boolean;
  }
  const units: BuildUnit[] = [];
  const usedIds = new Set<string>();

  for (const c of charsJa) {
    if (TRAVELER_IDS.has(c.id)) continue;
    if (!ELEMENT_MAP[c.elementType]) {
      report.skipped.push({ name: c.name, reason: `元素 ${c.elementType} が未対応` });
      continue;
    }
    const englishName = englishById.get(c.id) ?? c.name;
    let id = normalizeCharacterId(englishName);
    if (usedIds.has(id)) id = `${id}${c.id}`;
    usedIds.add(id);
    const talent = talentByName.get(c.name) ?? talentById.get((c.id - 10000000) * 100 + 1);
    if (!talent) errors.push(`genshin-db: ${c.name} の天賦データが見つかりません`);
    const gcsimKey = gcsimKeyByGenshinId.get(c.id);
    units.push({
      id,
      name: c.name,
      englishName,
      element: ELEMENT_MAP[c.elementType],
      weaponType: WEAPON_MAP[c.weaponType] ?? 'sword',
      rarity: c.rarity,
      avatarUrl: iconUrl(c),
      genshinId: c.id,
      talent,
      gcsimKey,
      gcsimDir: gcsimKey ? dirByKey.get(gcsimKey) : undefined,
    });
  }

  // 旅人: genshin-db の元素別天賦 "旅人 (風元素)" ごとに1キャラ。gcsim のフレームは traveler/common/<元素>
  const aether = charsJa.find(c => c.id === AETHER_ID);
  for (const t of talentsJa) {
    const m = /^旅人\s*\((.)元素\)$/.exec(t.name);
    const element = m ? TRAVELER_ELEMENT_JA[m[1]] : undefined;
    if (!m || !element) continue;
    const gcsimDir = `traveler/common/${element}`;
    units.push({
      id: `traveler${element}`,
      name: `旅人(${m[1]})`,
      englishName: `Traveler (${element.charAt(0).toUpperCase()}${element.slice(1)})`,
      element,
      weaponType: 'sword',
      rarity: 5,
      avatarUrl: iconUrl(aether),
      genshinId: AETHER_ID,
      talent: t,
      gcsimKey: charDm.data[`aether${element}`] ? `aether${element}` : undefined,
      gcsimDir: filesByDir.has(gcsimDir) ? gcsimDir : undefined,
      genderSplit: true,
    });
  }

  // 3. gcsim の Go ソースを取得・解析
  const parsedById = new Map<string, ParsedCharacterFiles>();
  let done = 0;
  await runPool(units, 12, async u => {
    if (u.gcsimDir) {
      const available = filesByDir.get(u.gcsimDir) ?? new Set();
      const names = GCSIM_FILES.filter(f => available.has(f));
      try {
        const texts = await Promise.all(names.map(f => fetchText(`${rawBase}internal/characters/${u.gcsimDir}/${f}.go`)));
        // ファイル間で定数を共有するため、先に全ファイルの定数を集めてから解析する
        const shared = new Map<string, number>();
        texts.forEach(t => parseGoFile(t).consts.forEach((v, k) => shared.set(k, v)));
        const files: Record<string, ParsedGoFile> = {};
        names.forEach((f, i) => {
          files[f] = parseGoFile(texts[i], shared);
        });
        parsedById.set(u.id, { files });
      } catch (e) {
        errors.push(`gcsim ${u.gcsimDir}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    done++;
    onProgress?.({ phase: 'gcsim のモーションフレームを解析中', done, total: units.length });
  });

  // 4. キャラクター組み立て
  const characters: CharacterConfig[] = [];
  for (const u of units) {
    const timings = extractTalentTimings(u.talent);
    const parsed = parsedById.get(u.id);
    const ctx = { id: u.id, weaponType: u.weaponType, timings, talent: u.talent };

    const { actions, placeholderActions } = u.genderSplit && parsed
      ? mergeGenderActions(TRAVELER_GENDERS.map(g => buildActions({ ...ctx, parsed: genderView(parsed, g.index) })))
      : buildActions({ ...ctx, parsed });

    if (parsed) {
      report.charactersWithFrames++;
      for (const [f, p] of Object.entries(parsed.files)) {
        if (p.unresolved.length > 0) report.unresolvedGoLines.push({ characterId: u.id, file: `${f}.go`, count: p.unresolved.length });
      }
    }
    if (placeholderActions.length > 0) {
      report.placeholderDurations.push({
        characterId: u.id,
        name: u.name,
        actions: placeholderActions,
        reason: !u.gcsimKey ? 'gcsim 未実装キャラ' : !parsed ? 'gcsim ソース取得失敗' : 'gcsim にフレーム定義が見つからない',
      });
    }
    for (const a of actions) {
      if ((a.startsSkillCooldown || a.startsBurstCooldown) && a.cooldown === undefined) {
        report.missingCooldowns.push({ characterId: u.id, name: u.name, actionId: a.id });
      }
    }

    characters.push({
      id: u.id,
      name: u.name,
      englishName: u.englishName,
      element: u.element,
      weaponType: u.weaponType,
      rarity: u.rarity,
      avatarUrl: u.avatarUrl,
      color: ELEMENT_HEX[u.element],
      accentColor: ELEMENT_HEX[u.element],
      energyRecharge: 100,
      availableActions: actions,
      source: { genshinId: u.genshinId, ...(u.gcsimKey ? { gcsimKey: u.gcsimKey } : {}) },
    });
  }

  characters.sort((a, b) => a.id.localeCompare(b.id));
  report.totalCharacters = characters.length;
  return { characters, report };
}
