/**
 * Enka.Network の応答（ゲーム内「キャラクター詳細表示」に並べたキャラ）→ 持ちキャラ（OwnedCharacter）。
 * 他のアカウントの UID では、HoYoLAB の詳細が取れないので、これを使う（docs/hoyolab-import/plan.md）。
 *
 * HoYoLAB の変換（importCharacters.ts）との違い:
 * - 突破段階は、propMap の 1002 で正確に分かる（曖昧さなし）。
 * - 天賦は、skillLevelMap が基礎レベル（凸の加算は別の proudSkillExtraLevelMap）。
 * - キャラ・武器・聖遺物セットは、ゲームの ID で返る。マスターの武器・聖遺物セットの ID も、ゲームの ID と同じなので、ID で名前を引く。
 * - 元素は返らない。旅人だけ、skillDepotId から決める（それ以外は、マスターのキャラの元素）。
 */

import type { OwnedCharacter } from './importCharacters';

/** Enka の応答（使う項目だけ） */
export interface EnkaReliquary {
  itemId: number;
  reliquary: { level: number };
  flat: {
    setId: number;
    equipType: string;
    reliquaryMainstat: { mainPropId: string; statValue: number };
    reliquarySubstats?: { appendPropId: string; statValue: number }[];
  };
}
export interface EnkaWeapon {
  itemId: number;
  weapon: { level: number; promoteLevel?: number; affixMap?: Record<string, number> };
}
export interface EnkaAvatar {
  avatarId: number;
  propMap: Record<string, { val?: string }>;
  talentIdList?: number[];
  skillDepotId: number;
  skillLevelMap: Record<string, number>;
  equipList: (EnkaReliquary | EnkaWeapon | { itemId: number })[];
}
export interface EnkaResponse {
  playerInfo?: { nickname?: string };
  avatarInfoList?: EnkaAvatar[];
  ttl?: number;
}

export interface EnkaMasters {
  characters: { id: string; name: string; element: string }[];
  weapons: { id: string; name: string }[];
  artifacts: { id: string; name: string }[];
}

const ASCENSION_CAPS = [20, 40, 50, 60, 70, 80, 90];

/** 聖遺物のステータス（Enka の appendPropId / mainPropId）→ gcsim のキー。割合（%）で返るものは、100 で割る */
const STAT_KEYS: Record<string, { key: string; percent: boolean }> = {
  FIGHT_PROP_HP: { key: 'hp', percent: false },
  FIGHT_PROP_HP_PERCENT: { key: 'hp%', percent: true },
  FIGHT_PROP_ATTACK: { key: 'atk', percent: false },
  FIGHT_PROP_ATTACK_PERCENT: { key: 'atk%', percent: true },
  FIGHT_PROP_DEFENSE: { key: 'def', percent: false },
  FIGHT_PROP_DEFENSE_PERCENT: { key: 'def%', percent: true },
  FIGHT_PROP_CRITICAL: { key: 'cr', percent: true },
  FIGHT_PROP_CRITICAL_HURT: { key: 'cd', percent: true },
  FIGHT_PROP_CHARGE_EFFICIENCY: { key: 'er', percent: true },
  FIGHT_PROP_ELEMENT_MASTERY: { key: 'em', percent: false },
  FIGHT_PROP_HEAL_ADD: { key: 'heal', percent: true },
  FIGHT_PROP_FIRE_ADD_HURT: { key: 'pyro%', percent: true },
  FIGHT_PROP_WATER_ADD_HURT: { key: 'hydro%', percent: true },
  FIGHT_PROP_ELEC_ADD_HURT: { key: 'electro%', percent: true },
  FIGHT_PROP_GRASS_ADD_HURT: { key: 'dendro%', percent: true },
  FIGHT_PROP_WIND_ADD_HURT: { key: 'anemo%', percent: true },
  FIGHT_PROP_ROCK_ADD_HURT: { key: 'geo%', percent: true },
  FIGHT_PROP_ICE_ADD_HURT: { key: 'cryo%', percent: true },
  FIGHT_PROP_PHYSICAL_ADD_HURT: { key: 'phys%', percent: true },
};

/** 旅人（空 10000005・蛍 10000007）の元素。skillDepotId の下 1 桁（502=炎 503=水 504=風 505=氷 506=岩 507=雷 508=草。蛍は 702〜708） */
const TRAVELER_ELEMENT_BY_DIGIT: Record<number, string> = { 2: 'Pyro', 3: 'Hydro', 4: 'Anemo', 5: 'Cryo', 6: 'Geo', 7: 'Electro', 8: 'Dendro' };
const isTraveler = (id: number) => id === 10000005 || id === 10000007;

const isReliquary = (e: EnkaAvatar['equipList'][number]): e is EnkaReliquary => 'reliquary' in e && 'flat' in e;
const isWeapon = (e: EnkaAvatar['equipList'][number]): e is EnkaWeapon => 'weapon' in e;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** 基礎の天賦レベル [通常, スキル, 爆発]。skillLevelMap のキー（スキル ID）の昇順で、先頭=通常・2 番目=スキル・最後=爆発 */
function talentLevels(map: Record<string, number>, warnings: string[]): [number, number, number] {
  const ids = Object.keys(map).map(Number).sort((a, b) => a - b);
  if (ids.length < 3) {
    warnings.push(`天賦の数が想定外です（${ids.length} 個）。足りない分は Lv.1 にします`);
    const lv = (i: number) => map[String(ids[i])] ?? 1;
    return [lv(0), lv(1), lv(ids.length - 1)];
  }
  return [map[String(ids[0])], map[String(ids[1])], map[String(ids[ids.length - 1])]];
}

export function convertEnkaAvatar(a: EnkaAvatar, masters: EnkaMasters): OwnedCharacter {
  const warnings: string[] = [];
  const level = Number(a.propMap['4001']?.val) || 1;
  const promote = Number(a.propMap['1002']?.val) || 0;
  const maxLevel = ASCENSION_CAPS[promote] ?? 90;

  const prefix = String(a.avatarId);
  const candidates = masters.characters.filter(c => c.id.split('-')[0] === prefix);
  let element = '';
  if (isTraveler(a.avatarId)) {
    element = TRAVELER_ELEMENT_BY_DIGIT[a.skillDepotId % 10] ?? '';
    if (!element) warnings.push('旅人の元素を判別できません');
  } else if (candidates[0]) {
    element = cap(candidates[0].element);
  }
  const master = candidates.find(c => element !== '' && c.element.toLowerCase() === element.toLowerCase()) ?? candidates[0];

  const weaponEquip = a.equipList.find(isWeapon);
  const weaponMaster = weaponEquip ? masters.weapons.find(w => w.id === String(weaponEquip.itemId)) : undefined;
  const refinement = weaponEquip ? (Object.values(weaponEquip.weapon.affixMap ?? {})[0] ?? 0) + 1 : 1;
  if (!weaponEquip) warnings.push('武器の情報がありません');

  const reliquaries = a.equipList.filter(isReliquary);
  const setCounts = new Map<number, number>();
  const stats: Record<string, number> = {};
  const add = (propId: string, value: number) => {
    const def = STAT_KEYS[propId];
    if (!def) { warnings.push(`未対応のステータス（${propId}）を無視しました`); return; }
    stats[def.key] = (stats[def.key] ?? 0) + (def.percent ? value / 100 : value);
  };
  for (const r of reliquaries) {
    setCounts.set(r.flat.setId, (setCounts.get(r.flat.setId) ?? 0) + 1);
    add(r.flat.reliquaryMainstat.mainPropId, r.flat.reliquaryMainstat.statValue);
    for (const s of r.flat.reliquarySubstats ?? []) add(s.appendPropId, s.statValue);
  }
  for (const k of Object.keys(stats)) stats[k] = Math.round(stats[k] * 1e6) / 1e6;

  return {
    genshinId: a.avatarId,
    name: master?.name ?? `キャラ ${a.avatarId}`,
    element,
    level,
    maxLevel,
    ambiguousAscension: false,
    constellation: a.talentIdList?.length ?? 0,
    talents: talentLevels(a.skillLevelMap, warnings),
    weapon: {
      genshinId: weaponEquip?.itemId ?? 0,
      name: weaponMaster?.name ?? `武器 ${weaponEquip?.itemId ?? 0}`,
      level: weaponEquip?.weapon.level ?? 1,
      maxLevel: ASCENSION_CAPS[weaponEquip?.weapon.promoteLevel ?? 0] ?? 90,
      refinement,
    },
    artifactSets: [...setCounts].map(([id, count]) => ({ name: masters.artifacts.find(x => x.id === String(id))?.name ?? `聖遺物セット ${id}`, count })),
    artifactStats: stats,
    warnings,
  };
}

export const convertEnkaResponse = (res: EnkaResponse, masters: EnkaMasters): OwnedCharacter[] =>
  (res.avatarInfoList ?? []).map(a => convertEnkaAvatar(a, masters));
