import type { CustomStats, OwnedBuild } from '../types/genshin';

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

/** 「仮値を使う」で入れる、そのキャラの仮値（Lv・天賦は共通の仮値。聖遺物ステータスだけ、キャラの型の目安にする） */
export function defaultCustomStatsFor(characterId: string): CustomStats {
  const profile = artifactProfileOf(characterId);
  const stats = { ...PROFILE_STATS[profile] };
  const bonus = ELEMENT_BONUS_KEY[characterId.split('-')[1] ?? ''];
  if (profile !== 'em' && bonus) stats[bonus] = 0.466;
  return { ...DEFAULT_CUSTOM_STATS, talents: [...DEFAULT_CUSTOM_STATS.talents] as CustomStats['talents'], artifactStats: stats };
}
