/**
 * 枠の持ちキャラの装備（build）が、取り込み済みのデータ（ownedToPartyFields の結果）と一致するかの判定（D344）。
 * 編成設定の表示を、「持ちキャラの装備・ステータスを適用中（一致）」と「取り込み値と異なる値を適用中（相違）」に分けるために使う。
 * 比べる項目: 凸・武器 ID・精錬・聖遺物セット・組み合わせ・build の中身（Lv・天賦・武器 Lv・聖遺物ステータス・セット数）。数値は小数 4 桁で丸めて比べる。
 */
import type { PartyMember } from '../../types/genshin';

type OwnedFields = Pick<PartyMember, 'constellation' | 'weaponId' | 'weaponRefinementRank' | 'artifactSetId' | 'artifactSetMode' | 'build'>;

/** 数値を丸め、オブジェクトのキーを並べ替えて、比べられる文字列にする */
const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => {
    if (typeof x === 'number') return Math.round(x * 1e4) / 1e4;
    if (x && typeof x === 'object' && !Array.isArray(x)) return Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)));
    return x;
  });

/** セット数の並びは順序に意味がないので、ID で並べる */
const normBuild = (b: PartyMember['build']) => (b ? { ...b, artifactSets: [...b.artifactSets].sort((x, y) => (x.id < y.id ? -1 : 1)) } : undefined);

export function buildMatchesOwned(member: PartyMember, owned: OwnedFields): boolean {
  if (!member.build || !owned.build) return false;
  const pick = (m: OwnedFields) => ({
    c: m.constellation, w: m.weaponId, r: m.weaponRefinementRank, a: m.artifactSetId, m: m.artifactSetMode ?? '4pc', b: normBuild(m.build),
  });
  return canon(pick(member)) === canon(pick(owned));
}
