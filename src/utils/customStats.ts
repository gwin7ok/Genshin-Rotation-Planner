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
