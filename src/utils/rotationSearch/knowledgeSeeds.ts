/**
 * 知識辞書から、探索の出発点を組む（設計: 辞書設計.md の「探索での使い方」）。
 * 辞書にあるキャラの運用型（Archetype）の組み合わせを作り、出場の順番（slot）で並べ、アタッカーの攻撃の出場を最後に置く。
 * 総当たりでは、全部そろった形（ニィロウ E×4 + ラウマの長押し + コロンビーナの先置きと重撃…）に届かないので、そろえた形で出発点にする。
 */
import type { CharacterConfig, Stint } from '../../types/genshin';
import type { Archetype, KnowledgeBundle } from '../../masterdata/knowledge/types';
import { stintOf, type SearchRole } from './candidates';
import { defaultConstellation } from '../../models/CharacterModel';

export interface KnowledgeSeed {
  stints: Stint[];
  loopStartIndex: number;
  assignment: Record<string, SearchRole>;
}

/** 組み合わせ（キャラごとの運用型の選び方）の上限 */
const MAX_COMBOS = 400;
/** 出発点の上限（探索の 1 次の枠は、keep1 の 3 倍まで。それより後ろは使われない）。組み合わせを交互に並べて、この数に切る */
const MAX_SEEDS = 300;

function product<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap(a => list.map(x => [...a, x])), [[]]);
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map(r => [x, ...r]));
}

export function knowledgeSeeds(characters: CharacterConfig[], bundle: KnowledgeBundle): KnowledgeSeed[] {
  const ids = new Set(characters.map(c => c.id));
  // 編成の条件を満たす運用型が 1 つもないキャラは、出発点に入れない（辞書にないキャラも同じ）
  // 凸数の条件（constellation）も見る。凸数は、編成の設定（未指定は、星 4 = 6 凸・星 5 = 0 凸）
  const applicable = (c: CharacterConfig) => {
    const cons = c.constellation ?? defaultConstellation(c.rarity);
    return (bundle[c.id]?.archetypes ?? []).filter(a => (a.withCharacters ?? []).every(id => ids.has(id)) && cons >= (a.constellation?.min ?? 0) && cons <= (a.constellation?.max ?? 6));
  };
  const members = characters.filter(c => applicable(c).length > 0);
  if (members.length === 0) return [];
  const options = members.map(applicable);
  const perCombo = combosOf(options).map(combo => variantsOf(characters, members, combo as Archetype[]));
  // 組み合わせごとの形（並べ方・繰り返し・先頭の違い）を、組み合わせを交互にして並べる（探索の 1 次の枠は、先頭の一部だけ。全部の組み合わせの代表が、先に入るようにする）
  const out = new Map<string, KnowledgeSeed>();
  for (let round = 0; out.size < MAX_SEEDS; round++) {
    let any = false;
    for (const variants of perCombo) {
      if (round >= variants.length) continue;
      any = true;
      const v = variants[round];
      if (!out.has(v.key) && out.size < MAX_SEEDS) out.set(v.key, v.seed);
    }
    if (!any) break;
  }
  return [...out.values()];
}

/** KQM Sim Database 由来の形か（evidence の書き出しで見分ける） */
const isKqm = (a: Archetype): boolean => a.evidence.startsWith('KQM');

/**
 * キャラごとの運用型の選び方（組み合わせ）を並べる。
 * 基準は 2 つ: 全員が先頭の形（手作り・測定済みの形が先頭）と、全員が KQM 由来の形（なければ先頭）。先頭の形が外れても、もう一方が出発点に入る。
 * 続けて、それぞれの基準から 1 人だけ別の運用型にした組み合わせを全部（どの運用型も、必ず 1 回は入る）。残りは、全組み合わせから等間隔に取る（上限 MAX_COMBOS）。
 */
function combosOf(options: Archetype[][]): Archetype[][] {
  const bases: Archetype[][] = [options.map(o => o[0])];
  const kqmBase = options.map(o => o.find(isKqm) ?? o[0]);
  if (kqmBase.some((a, i) => a !== bases[0][i])) bases.push(kqmBase);
  const list: Archetype[][] = [...bases];
  const seenKey = (c: Archetype[]) => c.map(a => a.name).join('|');
  const seenOfat = new Set(list.map(seenKey));
  for (const base of bases) {
    options.forEach((o, i) => {
      for (let j = 0; j < o.length; j++) {
        if (o[j] === base[i]) continue;
        const c = base.map((a, k) => (k === i ? o[j] : a));
        if (seenOfat.has(seenKey(c))) continue;
        seenOfat.add(seenKey(c));
        list.push(c);
      }
    });
  }
  const total = options.reduce((n, o) => n * o.length, 1);
  const rest = Math.max(0, MAX_COMBOS - list.length);
  const seen = new Set(list.map(c => c.map((a, i) => i + ':' + options[i].indexOf(a)).join('|')));
  const all = product(options) as Archetype[][];
  const step = total / Math.max(1, rest);
  for (let x = 0; x < total && list.length < MAX_COMBOS; x += Math.max(1, step)) {
    const c = all[Math.floor(x)];
    const k = c.map((a, i) => i + ':' + options[i].indexOf(a)).join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    list.push(c);
  }
  return list;
}

/** 1 つの組み合わせから、出発点（出場の順番・アタッカーの繰り返し・先頭の出場の違い）を作る */
function variantsOf(characters: CharacterConfig[], members: CharacterConfig[], combo: Archetype[]): Array<{ key: string; seed: KnowledgeSeed }> {
  const out = new Map<string, KnowledgeSeed>();
  const picked = members.map((c, i) => ({ c, a: combo[i] }));
  const attackers = picked.filter(p => p.a.role === 'attacker');
  if (attackers.length === 0) return [];
  // 先置き・サポートの出場: slot の小さい順。同じ slot は、並べ替えを全部試す。
  // 1 人の運用型は、出場を複数持てる（use と、続きの出場 then）。同じキャラで同じ slot の出場は、1 つに結合する
  const setups = picked.flatMap(p => {
    const parts: Array<{ slot: number; use: string[] }> = [];
    for (const part of [{ slot: p.a.slot, use: p.a.use }, ...(p.a.then ?? [])]) {
      if (part.use.length === 0) continue;
      const same = parts.find(x => x.slot === part.slot);
      if (same) same.use = [...same.use, ...part.use]; else parts.push({ slot: part.slot, use: [...part.use] });
    }
    return parts.map(x => ({ c: p.c, a: p.a, slot: x.slot, use: x.use }));
  });
  const slots = [...new Set(setups.map(p => p.slot))].sort((x, y) => x - y);
  const orders = product(slots.map(s => permutations(setups.filter(p => p.slot === s)))).map(groups => groups.flat());
  for (const order of orders) {
    for (const repeats of product(attackers.map(p => ((p.a.fill?.length ?? 0) > 0 ? p.a.fillRepeat ?? [1] : [0])))) {
      for (const leads of product(attackers.map(p => (p.a.lead && p.a.lead.length > 0 ? [true, false] : [false])))) {
        const stints: Stint[] = [];
        let ok = true;
        const push = (c: CharacterConfig, steps: string[]) => {
          const s = stintOf(c, steps, `k${stints.length}`);
          if (!s) ok = false; else stints.push(s);
        };
        attackers.forEach((p, i) => { if (leads[i]) push(p.c, p.a.lead!); });
        const loopStartIndex = stints.length;
        for (const p of order) push(p.c, p.use);
        attackers.forEach((p, i) => { if (repeats[i] > 0) push(p.c, Array.from({ length: repeats[i] }, () => p.a.fill!).flat()); });
        if (!ok || stints.length === 0) continue;
        const assignment = Object.fromEntries(characters.map(c => [c.id, (picked.find(p => p.c.id === c.id)?.a.role ?? 'supporter') as SearchRole]));
        const key = stints.map(s => `${s.characterId}:${s.actions.map(a => a.actionTypeId).join(',')}`).join('|') + `@${loopStartIndex}`;
        if (!out.has(key)) out.set(key, { stints, loopStartIndex, assignment });
      }
    }
  }
  return [...out].map(([key, seed]) => ({ key, seed }));
}
