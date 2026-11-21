/**
 * 知識辞書から、探索の出発点を組む（設計: 辞書設計.md の「探索での使い方」）。
 * 辞書にあるキャラの運用型（Archetype）の組み合わせを作り、出場の順番（slot）で並べ、アタッカーの攻撃の出場を最後に置く。
 * 総当たりでは、全部そろった形（ニィロウ E×4 + ラウマの長押し + コロンビーナの先置きと重撃…）に届かないので、そろえた形で出発点にする。
 */
import type { CharacterConfig, Stint } from '../../types/genshin';
import type { Archetype, KnowledgeBundle } from '../../masterdata/knowledge/types';
import { stintOf, type SearchRole } from './candidates';

export interface KnowledgeSeed {
  stints: Stint[];
  loopStartIndex: number;
  assignment: Record<string, SearchRole>;
}

const MAX_COMBOS = 400;

function product<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap(a => list.map(x => [...a, x])), [[]]);
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map(r => [x, ...r]));
}

export function knowledgeSeeds(characters: CharacterConfig[], bundle: KnowledgeBundle): KnowledgeSeed[] {
  const ids = new Set(characters.map(c => c.id));
  const members = characters.filter(c => (bundle[c.id]?.archetypes.length ?? 0) > 0);
  if (members.length === 0) return [];
  const options = members.map(c => bundle[c.id].archetypes.filter(a => (a.withCharacters ?? []).every(id => ids.has(id))));
  if (options.some(o => o.length === 0)) return [];
  const out = new Map<string, KnowledgeSeed>();
  for (const combo of product(options).slice(0, MAX_COMBOS)) {
    const picked = members.map((c, i) => ({ c, a: combo[i] as Archetype }));
    const attackers = picked.filter(p => p.a.role === 'attacker' && (p.a.fill?.length ?? 0) > 0);
    if (attackers.length === 0) continue;
    // 先置き・サポートの出場: slot の小さい順。同じ slot は、並べ替えを全部試す
    const setups = picked.filter(p => p.a.use.length > 0);
    const slots = [...new Set(setups.map(p => p.a.slot))].sort((x, y) => x - y);
    const orders = product(slots.map(s => permutations(setups.filter(p => p.a.slot === s)))).map(groups => groups.flat());
    for (const order of orders) {
      for (const repeats of product(attackers.map(p => p.a.fillRepeat ?? [1]))) {
        for (const leads of product(attackers.map(p => (p.a.lead && p.a.lead.length > 0 ? [true, false] : [false])))) {
          const stints: Stint[] = [];
          let ok = true;
          const push = (c: CharacterConfig, steps: string[]) => {
            const s = stintOf(c, steps, `k${stints.length}`);
            if (!s) ok = false; else stints.push(s);
          };
          attackers.forEach((p, i) => { if (leads[i]) push(p.c, p.a.lead!); });
          const loopStartIndex = stints.length;
          for (const p of order) push(p.c, p.a.use);
          attackers.forEach((p, i) => push(p.c, Array.from({ length: repeats[i] }, () => p.a.fill!).flat()));
          if (!ok || stints.length === 0) continue;
          const assignment = Object.fromEntries(characters.map(c => [c.id, (picked.find(p => p.c.id === c.id)?.a.role ?? 'supporter') as SearchRole]));
          const key = stints.map(s => `${s.characterId}:${s.actions.map(a => a.actionTypeId).join(',')}`).join('|') + `@${loopStartIndex}`;
          if (!out.has(key)) out.set(key, { stints, loopStartIndex, assignment });
        }
      }
    }
  }
  return [...out.values()];
}
