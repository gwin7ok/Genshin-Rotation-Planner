import type { CustomStats, OwnedBuild } from '../types/genshin';
import defaultBuildsJson from '../data/default_builds.json';

/** 仮値（D2）: キャラ・武器 Lv90/90、天賦レベル 9/9/9、聖遺物ステータスは会心率 100% だけ */
export const DEFAULT_CUSTOM_STATS: CustomStats = {
  level: 90,
  maxLevel: 90,
  talents: [9, 9, 9],
  weaponLevel: 90,
  weaponMaxLevel: 90,
  artifactStats: { cr: 1 },
};

/** 持ちキャラの装備から、ステータスの部分だけを取り出す（コピー） */
export const statsOfBuild = (b: OwnedBuild): CustomStats => ({
  level: b.level,
  maxLevel: b.maxLevel,
  talents: [...b.talents] as [number, number, number],
  weaponLevel: b.weaponLevel,
  weaponMaxLevel: b.weaponMaxLevel,
  artifactStats: { ...b.artifactStats },
});

/** 編集できる聖遺物ステータスのキー（gcsim の `add stats` のキー）。% は小数で持つ（0.466 = 46.6%） */
export const ARTIFACT_STAT_KEYS: { key: string; percent: boolean }[] = [
  { key: 'hp', percent: false },
  { key: 'hp%', percent: true },
  { key: 'atk', percent: false },
  { key: 'atk%', percent: true },
  { key: 'def', percent: false },
  { key: 'def%', percent: true },
  { key: 'em', percent: false },
  { key: 'er', percent: true },
  { key: 'cr', percent: true },
  { key: 'cd', percent: true },
  { key: 'heal', percent: true },
  { key: 'pyro%', percent: true },
  { key: 'hydro%', percent: true },
  { key: 'cryo%', percent: true },
  { key: 'electro%', percent: true },
  { key: 'anemo%', percent: true },
  { key: 'geo%', percent: true },
  { key: 'dendro%', percent: true },
  { key: 'phys%', percent: true },
];

// ---------------------------------------------------------------------------
// キャラごとの仮値（「仮値を使う」を押したときの聖遺物ステータス）
// ---------------------------------------------------------------------------

/** 伸ばす能力値の型。攻撃型（既定）・HP 型・防御型・熟知型 */
export type ArtifactProfile = 'atk' | 'hp' | 'def' | 'em';

/**
 * 攻撃型以外のキャラ（ゲームの ID → 型）。ここに無いキャラは攻撃型。
 * 目安であり、キャラの使い方（サポート・アタッカー）で最適は変わる。気づいたら足す・直す。
 */
const ARTIFACT_PROFILE_BY_GENSHIN_ID: Record<number, ArtifactProfile> = {
  // HP 型
  10000014: 'hp', // バーバラ
  10000030: 'hp', // 鍾離
  10000046: 'hp', // 胡桃
  10000054: 'hp', // 珊瑚宮心海
  10000060: 'hp', // 夜蘭
  10000061: 'hp', // 綺良々
  10000065: 'hp', // 久岐忍
  10000066: 'hp', // 神里綾人
  10000070: 'hp', // ニィロウ
  10000072: 'hp', // キャンディス
  10000074: 'hp', // レイラ
  10000082: 'hp', // 白朮
  10000087: 'hp', // ヌヴィレット
  10000089: 'hp', // フリーナ
  10000095: 'hp', // シグウィン
  10000102: 'hp', // ムアラニ
  10000125: 'hp', // コロンビーナ
  // 防御型
  10000034: 'def', // ノエル
  10000038: 'def', // アルベド
  10000055: 'def', // ゴロー
  10000057: 'def', // 荒瀧一斗
  10000064: 'def', // 雲菫
  10000094: 'def', // 千織
  10000100: 'def', // カチーナ
  10000103: 'def', // シロネン
  10000130: 'def', // リンネア
  // 熟知型
  10000022: 'em', // ウェンティ
  10000043: 'em', // スクロース
  10000047: 'em', // 楓原万葉
  10000069: 'em', // ティナリ
  10000073: 'em', // ナヒーダ
  10000078: 'em', // アルハイゼン
  10000081: 'em', // カーヴェ
  10000107: 'em', // シトラリ
  10000109: 'em', // 夢見月瑞希
  10000119: 'em', // ラウマ
  10000121: 'em', // アイノ
  10000122: 'em', // ネフェル
};

/** キャラ ID（"10000073-dendro" など）から、型を決める */
export const artifactProfileOf = (characterId: string): ArtifactProfile => ARTIFACT_PROFILE_BY_GENSHIN_ID[Number(characterId.split('-')[0])] ?? 'atk';

/**
 * 型ごとの、聖遺物 5 個の合計ステータスの目安（育った 5 つ星の聖遺物。会心率 55〜35%・会心ダメージ 60〜110% あたり。`add stats` のキー。% は小数）。
 * 元素ダメージ（杯）は、熟知型では熟知を選ぶので付けない。
 */
const PROFILE_STATS: Record<ArtifactProfile, Record<string, number>> = {
  atk: { hp: 4780, atk: 311, 'atk%': 0.7, cr: 0.55, cd: 1.1, er: 0.2, em: 40 },
  hp: { hp: 4780, atk: 311, 'hp%': 0.8, cr: 0.5, cd: 1.0, er: 0.3, em: 40 },
  def: { hp: 4780, atk: 311, 'def%': 0.8, cr: 0.5, cd: 1.0, er: 0.3, em: 40 },
  em: { hp: 4780, atk: 311, em: 600, cr: 0.35, cd: 0.6, er: 0.25 },
};

/** キャラ ID の末尾（元素）→ 元素ダメージのキー */
const ELEMENT_BONUS_KEY: Record<string, string> = {
  pyro: 'pyro%', hydro: 'hydro%', cryo: 'cryo%', electro: 'electro%', anemo: 'anemo%', geo: 'geo%', dendro: 'dendro%',
};

// ---------------------------------------------------------------------------
// 原神 Wiki のおすすめ（src/data/default_builds.json。tools/wiki-default-builds/README.md で生成）から作る仮値
// ---------------------------------------------------------------------------

/** 1 キャラのおすすめ。メインは候補の並び（先頭を使う）、sub は優先順位ごとのキー（同じ順位は同列） */
interface DefaultBuild {
  name?: string;
  sands: string[];
  goblet: string[];
  circlet: string[];
  sub: string[][];
  weaponId?: string;
  sets?: { id: string; count: number }[];
}
const DEFAULT_BUILDS = defaultBuildsJson as unknown as Record<string, DefaultBuild>;
const defaultBuildOf = (characterId: string): DefaultBuild | undefined => {
  const [genshinId, element] = characterId.split('-');
  // 旅人（空・蛍）は、元素ごとの共通の既定（キーは「traveler-<元素>」）
  if (genshinId === '10000005' || genshinId === '10000007') return DEFAULT_BUILDS[`traveler-${element}`];
  return DEFAULT_BUILDS[genshinId];
};

/** メインステータスの値（5 つ星・Lv20） */
const MAIN_VALUE: Record<string, number> = { 'atk%': 0.466, 'hp%': 0.466, 'def%': 0.583, em: 187, er: 0.518, cr: 0.311, cd: 0.622, heal: 0.359, phys: 0.583, elem: 0.466 };
const SANDS_OK = ['atk%', 'hp%', 'def%', 'em', 'er'];
const GOBLET_OK = ['elem', 'phys', 'atk%', 'hp%', 'def%', 'em'];
const CIRCLET_OK = ['cr', 'cd', 'heal', 'atk%', 'hp%', 'def%', 'em'];

/** サブステータス 1 回分の強化の値（5 つ星の平均） */
const ROLL_VALUE: Record<string, number> = { hp: 254, atk: 16.5, def: 19.7, 'hp%': 0.0496, 'atk%': 0.0496, 'def%': 0.062, em: 19.8, er: 0.055, cr: 0.033, cd: 0.066 };
/** 優先順位ごとの強化回数（上位ほど多い。合計 45 回 = 5 部位 × 9 回） */
const ROLL_BUDGET = [20, 12, 8, 5];
const CRIT_RATE_CAP = 1;

/** 候補の先頭から、その部位で使えるものを選ぶ。冠は、会心があれば会心率 */
const pickMain = (options: string[], ok: string[], slot: 'sands' | 'goblet' | 'circlet'): string | undefined => {
  const list = options.map(o => (o === 'crit' ? 'cr' : o));
  if (slot === 'circlet' && list.includes('cr')) return 'cr';
  return list.find(o => ok.includes(o));
};

/** 優先順位（会心率と会心ダメージが別の順位なら、1 つの順位にまとめる）ごとに強化回数を配る */
const rollsOf = (ranks: string[][]): Record<string, number> => {
  let r = ranks.map(x => [...x]);
  const ci = r.findIndex(x => x.includes('cr') || x.includes('cd'));
  if (ci >= 0 && !(r[ci].includes('cr') && r[ci].includes('cd'))) {
    const missing = r[ci].includes('cr') ? 'cd' : 'cr';
    const mj = r.findIndex((x, i) => i !== ci && x.includes(missing));
    if (mj >= 0 && mj <= 1) { const lo = Math.min(ci, mj); r[lo] = [...new Set([...r[ci], ...r[mj]])]; r = r.filter((_, i) => i !== Math.max(ci, mj)); }
  }
  const rolls: Record<string, number> = {};
  r.slice(0, ROLL_BUDGET.length).forEach((keys, i) => {
    for (const k of keys) rolls[k] = (rolls[k] ?? 0) + ROLL_BUDGET[i] / keys.length;
  });
  return rolls;
};

/** おすすめから、聖遺物 5 個の合計ステータス（花 HP 4780・羽 攻撃力 311 つき）を作る */
function statsFromBuild(b: DefaultBuild, element: string): Record<string, number> {
  const stats: Record<string, number> = { hp: 4780, atk: 311 };
  const add = (k: string, v: number) => { stats[k] = (stats[k] ?? 0) + v; };
  const key = (m: string) => (m === 'elem' ? ELEMENT_BONUS_KEY[element] : m === 'phys' ? 'phys%' : m);
  const mains = [pickMain(b.sands, SANDS_OK, 'sands'), pickMain(b.goblet, GOBLET_OK, 'goblet'), pickMain(b.circlet, CIRCLET_OK, 'circlet')];
  for (const m of mains) if (m && key(m)) add(key(m), MAIN_VALUE[m]);
  for (const [k, n] of Object.entries(rollsOf(b.sub))) if (ROLL_VALUE[k] !== undefined) add(k, ROLL_VALUE[k] * n);
  if ((stats.cr ?? 0) > CRIT_RATE_CAP) stats.cr = CRIT_RATE_CAP;
  for (const k of Object.keys(stats)) stats[k] = Math.round(stats[k] * 1000) / 1000;
  return stats;
}

/** 「仮値を使う」で入れる、そのキャラの仮値（Lv・天賦は共通の仮値。聖遺物ステータスだけ、Wiki のおすすめ（無ければ型の目安）から作る） */
export function defaultCustomStatsFor(characterId: string): CustomStats {
  const element = characterId.split('-')[1] ?? '';
  const build = defaultBuildOf(characterId);
  let stats: Record<string, number>;
  if (build && build.sub.length > 0) {
    stats = statsFromBuild(build, element);
  } else {
    const profile = artifactProfileOf(characterId);
    stats = { ...PROFILE_STATS[profile] };
    const bonus = ELEMENT_BONUS_KEY[element];
    if (profile !== 'em' && bonus) stats[bonus] = 0.466;
  }
  return { ...DEFAULT_CUSTOM_STATS, talents: [...DEFAULT_CUSTOM_STATS.talents] as CustomStats['talents'], artifactStats: stats };
}

/**
 * 「仮値を使う」で入れる、そのキャラの武器・聖遺物セット（Wiki のおすすめの先頭）。データが無い・マスターに無いときは、何も入れない（今の選択のまま）。
 * 武器の精錬は、5 つ星なら 1、それ以外は 5。セットは、先頭が「2 個」と書かれていれば 2+2、それ以外は 4 個セット。
 */
export function defaultEquipmentFor(
  characterId: string,
  masters: { weapons: { id: string; rarity?: string | number }[]; artifacts: { id: string }[] },
): { weaponId?: string; weaponRefinementRank?: number; artifactSetId?: string; artifactSetMode?: '4pc' | '2+2' } {
  const build = defaultBuildOf(characterId);
  const out: { weaponId?: string; weaponRefinementRank?: number; artifactSetId?: string; artifactSetMode?: '4pc' | '2+2' } = {};
  if (!build) return out;
  const w = build.weaponId ? masters.weapons.find(x => x.id === build.weaponId) : undefined;
  if (w) { out.weaponId = w.id; out.weaponRefinementRank = Number(w.rarity) >= 5 ? 1 : 5; }
  const s = build.sets?.[0];
  if (s && masters.artifacts.some(a => a.id === s.id)) { out.artifactSetId = s.id; out.artifactSetMode = s.count === 2 ? '2+2' : '4pc'; }
  return out;
}
