/**
 * HoYoLAB の戦績（character/detail のレスポンス）→ 持ちキャラのデータ → gcsim の設定文（キャラ・武器・聖遺物・ステータスの行）
 *
 * 計画・調査結果: docs/hoyolab-import/plan.md。
 * - 天賦レベルは、HoYoLAB では凸の加算（スキルLv.+3）込みなので、基礎レベルに戻す。
 * - キャラの突破段階は取れないので、レベルから決める（境界ちょうどのレベルは、突破前とし、ambiguousAscension を立てる）。
 * - 聖遺物のステータスは、メイン・サブの値を足して作る（キャラ・武器の基礎値は gcsim が持つ）。
 * - マスターとの対応は、キャラ・武器は ID、聖遺物セットは名前（HoYoLAB のセット ID はゲームの ID と形式が違うため）。
 */

/** HoYoLAB のレスポンス（使う項目だけ） */
export interface HoyolabProperty { property_type: number; value: string; times: number }
export interface HoyolabCharacter {
  base: { id: number; name: string; level: number; actived_constellation_num: number; element: string };
  weapon: { id: number; name: string; level: number; promote_level: number; affix_level: number };
  relics: {
    pos: number;
    name: string;
    level: number;
    set: { id: number; name: string };
    main_property: HoyolabProperty;
    sub_property_list: HoyolabProperty[];
  }[];
  constellations: { pos: number; effect: string; is_actived: boolean }[];
  base_properties?: { property_type: number; base: string }[];
  skills: { skill_id: number; skill_type: number; name: string; level: number }[];
}
export interface HoyolabDetailResponse { list: HoyolabCharacter[] }

/** 持ちキャラ（取り込んだ結果）。マスターの ID で参照する */
export interface OwnedCharacter {
  /** HoYoLAB（ゲーム）のキャラ ID（マスターの `<id>-<元素>` の前半と同じ） */
  genshinId: number;
  name: string;
  level: number;
  /** 突破後の最大レベル（20/40/50/60/70/80/90） */
  maxLevel: number;
  /** 突破段階がレベルから決まらない（境界ちょうどのレベル）。突破前として扱っている */
  ambiguousAscension: boolean;
  /** HoYoLAB が返す基礎 HP（キャラ・Lv・突破で決まる）。突破段階が不明なとき、gcsim の基礎 HP と比べて決める（イファ Lv.80 で確認: 突破前 8934 / 突破後 9383 → HoYoLAB は 9383） */
  hoyolabBaseHp?: number;
  constellation: number;
  /** 基礎の天賦レベル（通常・スキル・爆発。凸の加算を除いた値） */
  talents: [number, number, number];
  weapon: { genshinId: number; name: string; level: number; maxLevel: number; refinement: number };
  /** 聖遺物セットごとの装備数（名前で数える） */
  artifactSets: { name: string; count: number }[];
  /** 聖遺物の合計ステータス（gcsim の `add stats` のキー。割合は小数: 0.466 = 46.6%） */
  artifactStats: Record<string, number>;
  /** 取り込み時に気づいた注意（日本語の文） */
  warnings: string[];
}

const ASCENSION_CAPS = [20, 40, 50, 60, 70, 80, 90];
const WEAPON_CAPS = [20, 40, 50, 60, 70, 80, 90];

/** キャラのレベル → 突破後の最大レベル。境界ちょうど（20・40…80）は、突破前とする */
export function characterMaxLevel(level: number): { maxLevel: number; ambiguous: boolean } {
  const cap = ASCENSION_CAPS.find(c => level <= c) ?? 90;
  return { maxLevel: cap, ambiguous: ASCENSION_CAPS.includes(level) && level < 90 };
}

/** 凸の説明文の整形（色タグ除去・中点の表記ゆれ「・」「·」をそろえる） */
const normalizeText = (s: string) => s.replace(/<[^>]+>/g, '').replace(/・/g, '·');

/** 基礎の天賦レベル [通常, スキル, 爆発]。有効な凸の「スキルLv.+3」を、名前の一致で引く */
export function baseTalentLevels(c: HoyolabCharacter, warnings: string[]): [number, number, number] {
  const skills = c.skills.filter(s => s.skill_type === 1);
  // 並びは [通常, スキル, (ダッシュ系)?, 爆発]
  if (skills.length < 3 || skills.length > 4) warnings.push(`天賦の数が想定外です（${skills.length} 個）。レベルをそのまま使います`);
  const boosted = new Set<number>();
  for (const x of c.constellations) {
    if (!x.is_actived) continue;
    const text = normalizeText(x.effect);
    if (!text.includes('Lv.+3')) continue;
    skills.forEach((s, i) => { if (text.includes(normalizeText(s.name))) boosted.add(i); });
  }
  const level = (i: number) => (skills[i]?.level ?? 1) - (boosted.has(i) ? 3 : 0);
  return [level(0), level(1), level(skills.length - 1)];
}

const ELEMENT_DMG_KEYS: Record<number, string> = {
  40: 'pyro%', 41: 'electro%', 42: 'hydro%', 43: 'dendro%', 44: 'anemo%', 45: 'geo%', 46: 'cryo%', 30: 'phys%',
};
/** 聖遺物のステータス ID → gcsim のキー（HoYoLAB の property_type） */
const STAT_KEYS: Record<number, string> = {
  2: 'hp', 3: 'hp%', 5: 'atk', 6: 'atk%', 7: 'def', 8: 'def', 9: 'def%',
  20: 'cr', 22: 'cd', 23: 'er', 28: 'em', 26: 'heal', ...ELEMENT_DMG_KEYS,
};

const parseValue = (v: string): number => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v));

/** 聖遺物の合計ステータス。表示の丸め（小数 1 桁）の分の誤差は残る */
export function sumArtifactStats(c: HoyolabCharacter, warnings: string[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const r of c.relics) {
    for (const p of [r.main_property, ...r.sub_property_list]) {
      const key = STAT_KEYS[p.property_type];
      if (!key) { warnings.push(`未対応のステータス（種類 ${p.property_type}）を無視しました`); continue; }
      total[key] = (total[key] ?? 0) + parseValue(p.value);
    }
  }
  for (const k of Object.keys(total)) total[k] = Math.round(total[k] * 1e6) / 1e6;
  return total;
}

export function convertCharacter(c: HoyolabCharacter): OwnedCharacter {
  const warnings: string[] = [];
  const { maxLevel, ambiguous } = characterMaxLevel(c.base.level);
  if (ambiguous) warnings.push(`Lv.${c.base.level} は突破前か突破後か分かりません（突破前として扱います）`);
  const setCounts = new Map<string, number>();
  for (const r of c.relics) setCounts.set(r.set.name, (setCounts.get(r.set.name) ?? 0) + 1);
  const wCap = WEAPON_CAPS[c.weapon.promote_level] ?? 90;
  return {
    genshinId: c.base.id,
    name: c.base.name,
    level: c.base.level,
    maxLevel,
    ambiguousAscension: ambiguous,
    hoyolabBaseHp: Number(c.base_properties?.find(p => p.property_type === 2000)?.base) || undefined,
    constellation: c.base.actived_constellation_num,
    talents: baseTalentLevels(c, warnings),
    weapon: { genshinId: c.weapon.id, name: c.weapon.name, level: c.weapon.level, maxLevel: wCap, refinement: c.weapon.affix_level },
    artifactSets: [...setCounts].map(([name, count]) => ({ name, count })),
    artifactStats: sumArtifactStats(c, warnings),
    warnings,
  };
}

export const convertResponse = (res: HoyolabDetailResponse): OwnedCharacter[] => res.list.map(convertCharacter);

/**
 * 旅人のストーリークエストの強化（真月: Song of the Welkin Moon の達成）。gcsim の既定は有効。
 * HoYoLAB の最終値は達成済みの分だけを含む。実データ（旅人 星鋒の剣）は真月だけ未達成で、これをオフにすると HP・攻撃・防御・熟知・会心率が HoYoLAB と一致した。
 * 達成状況は取れないので、既定は有効（gcsim と同じ）とし、編成の設定（PartyMember.trueMoon。ヘクセレイ・諭示と同じ形）で切り替える。
 */
export const TRUE_MOON_PARAM = 'true_moon_story_buff';
export const travelerParams = (trueMoon: boolean): string[] => (trueMoon ? [] : [`${TRUE_MOON_PARAM}=0`]);
export const isTravelerKey = (gcsimKey: string) => /^(aether|lumine)/.test(gcsimKey);

/** マスターの最小の形（ID・名前・gcsim キー） */
export interface MasterRef { id: string; name: string; gcsimKey?: string }

/** gcsim の設定文の行（キャラ・武器・聖遺物・ステータス）を作る。対応できないものは warnings に出す */
export function buildOwnedCharacterLines(
  owned: OwnedCharacter,
  gcsimCharacterKey: string,
  masters: { weapons: MasterRef[]; artifacts: MasterRef[] },
  /** キャラ行の `+params=[...]`（例: 旅人の `true_moon_story_buff=0`。ヘクセレイ・諭示など） */
  params: string[] = [],
): { lines: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const key = gcsimCharacterKey;
  const lines = [`${key} char lvl=${owned.level}/${owned.maxLevel} cons=${owned.constellation} talent=${owned.talents.join(',')}${params.length > 0 ? ` +params=[${params.join(',')}]` : ''};`];

  const weapon = masters.weapons.find(w => w.id === String(owned.weapon.genshinId))
    ?? masters.weapons.find(w => w.name === owned.weapon.name);
  if (!weapon?.gcsimKey) warnings.push(`武器「${owned.weapon.name}」がマスターにありません`);
  else lines.push(`${key} add weapon="${weapon.gcsimKey}" refine=${owned.weapon.refinement} lvl=${owned.weapon.level}/${owned.weapon.maxLevel};`);

  for (const s of owned.artifactSets) {
    if (s.count < 2) continue;
    const art = masters.artifacts.find(a => a.name === s.name);
    if (!art?.gcsimKey) { warnings.push(`聖遺物セット「${s.name}」がマスターにありません`); continue; }
    lines.push(`${key} add set="${art.gcsimKey}" count=${s.count >= 4 ? 4 : 2};`);
  }

  const stats = Object.entries(owned.artifactStats).map(([k, v]) => `${k}=${v}`).join(' ');
  if (stats) lines.push(`${key} add stats ${stats};`);
  return { lines, warnings };
}
