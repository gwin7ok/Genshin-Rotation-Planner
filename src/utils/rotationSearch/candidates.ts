/**
 * ローテーション自動探索の、候補の生成（設計: docs/gcsim-integration/phase-9-auto-rotation-search/設計.md の ①）。
 * gcsim は使わない。編成（4 人）と役割から、「出場の順番 ＋ 各出場のアクション」の候補を作る。
 *
 *  - 役割の割り当て（決定 C）: 複数の役割を持つキャラは、どの役割で置くかを全部試す。アタッカーは最低 1 人
 *  - 出場の順番（決定 B）: サポーター → サブアタッカー → アタッカー。同じ役割の中の順番は、並べ替えを全部試す
 *  - 使う E・Q（決定 A）: 使わない E・Q も候補。アタッカー・サブアタッカーの Q は使う
 *  - アタッカーの攻撃の型: 通常攻撃・通常＋重撃・重撃・落下・高落下の繰り返し。回数は、ローテーションの長さの目安（使う E・Q の最長 CT + 1 秒）から決める
 */
import type { CharacterActionInstance, CharacterConfig, CharacterRole, Stint } from '../../types/genshin';

export type SearchRole = CharacterRole;

/** 1 つの候補 */
export interface Candidate {
  id: string;
  /** 人が読む要約（出場の順番とアクション） */
  label: string;
  /** キャラ ID → このローテーションでの役割 */
  assignment: Record<string, SearchRole>;
  /** ローテーションの長さの目安（秒） */
  targetSeconds: number;
  stints: Stint[];
}

export interface CandidateOptions {
  /** 目安の長さに足す秒数（決定 A: 1 秒） */
  lengthPad?: number;
  /** 交代の時間（秒）。長さの見積もりに使う（アプリの既定 0.5） */
  switchDelay?: number;
  /** 候補の上限（超えたら、決まった順序で間引く） */
  maxCandidates?: number;
}

/** アタッカーの攻撃の型（1 回分の並び）。必要なアクションが無いキャラは、その型を飛ばす */
const FILL_TEMPLATES: { name: string; steps: string[] }[] = [
  { name: '通常', steps: ['n', 'n', 'n', 'n'] },
  { name: '通常+重撃', steps: ['n', 'n', 'ca'] },
  // 重撃は、直前に通常攻撃が要る（gcsim の規則）ので、通常攻撃 1 回を前に付ける
  { name: '重撃', steps: ['n', 'ca'] },
  { name: '落下', steps: ['jump', 'lp'] },
  { name: '高落下', steps: ['jump', 'hp'] },
  // スキルを挟む型（スキルの CT が短いキャラは、スキルと重撃・通常攻撃を交互に出す。例: サンドローネの E C E C）
  { name: 'E+重撃', steps: ['e', 'ca'] },
  { name: 'E+通常+重撃', steps: ['e', 'n', 'ca'] },
  { name: 'E+通常', steps: ['e', 'n', 'n'] },
];

const defOf = (c: CharacterConfig, step: string) => c.availableActions.find(a => a.id === `${c.id}_${step}`);

/** 配列の並べ替え（全部。4 人までなので少ない） */
function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  const out: T[][] = [];
  xs.forEach((x, i) => {
    for (const rest of permutations([...xs.slice(0, i), ...xs.slice(i + 1)])) out.push([x, ...rest]);
  });
  return out;
}

function product<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap(a => list.map(x => [...a, x])), [[]]);
}

/** 役割の割り当て: キャラごとの役割のどれか。アタッカーが 1 人もないものは捨てる */
export function roleAssignments(characters: CharacterConfig[], roles: Record<string, SearchRole[]>): Record<string, SearchRole>[] {
  const options = characters.map(c => {
    const r = roles[c.id] ?? [];
    return r.length > 0 ? r : (['supporter'] as SearchRole[]);
  });
  return product(options)
    .filter(pick => pick.includes('attacker'))
    .map(pick => Object.fromEntries(characters.map((c, i) => [c.id, pick[i]])));
}

/** 1 人分の使い方（使うスキル・爆発） */
interface Use { /** E の使い方（アクションの並び。空 = 使わない）。回数のあるスキル・再発動つきのスキルは、それも使う並びを持つ */ es: string[]; q: boolean }

function useOptions(c: CharacterConfig, role: SearchRole): Use[] {
  const eDef = defOf(c, 'e');
  const hasQ = !!defOf(c, 'q');
  // E の使い方の選択肢: 使わない / 1 回 / 回数ぶん（八重神子の 3 回など）/ 再発動つき（オデットの E → 特殊スキル）/ 長押し（アタッカーのみ）
  const esOptions: string[][] = [[]];
  if (eDef) {
    esOptions.push(['e']);
    const charges = eDef.charges ?? 1;
    if (charges > 1) esOptions.push(Array.from({ length: charges }, () => 'e'));
    if (defOf(c, 'e_recast')) esOptions.push(['e', 'e_recast']);
  }
  if (role === 'attacker' && defOf(c, 'e_hold')) esOptions.push(['e_hold']);
  const out: Use[] = [];
  for (const es of esOptions) {
    // Q は、使う・使わないの両方を試す（手で組んだ例: 八重神子・オデットは Q を使わない方が速い。決定 A）。
    // アタッカー以外は、E・Q とも外す（何もしない）のは、場に出さないのと同じなので作らない
    if (role === 'supporter') {
      if (hasQ && es.length <= 1) out.push({ es, q: true });
    } else if (hasQ) {
      out.push({ es, q: true });
    }
    if (es.length > 0 || role === 'attacker') out.push({ es, q: false });
  }
  return out;
}

let seq = 0;
const instance = (c: CharacterConfig, step: string): CharacterActionInstance | null => {
  const def = defOf(c, step);
  if (!def) return null;
  return { id: `r${++seq}`, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration };
};

/** 使い方 → アクションの並び（E → Q の順） */
const useSteps = (u: Use): string[] => [...u.es, ...(u.q ? ['q'] : [])];

const cooldownOf = (c: CharacterConfig, step: string): number => defOf(c, step)?.cooldown ?? 0;
const durationOf = (c: CharacterConfig, step: string): number => defOf(c, step)?.defaultDuration ?? 0;

/** 候補の要約（出場ごとに「キャラ名[アクション…]」。同じアクションの連続は ×n にまとめる） */
function describe(characters: CharacterConfig[], stints: Stint[]): string {
  const name = (id: string) => characters.find(c => c.id === id)?.name ?? id;
  return stints.map(s => {
    const parts: Array<{ s: string; n: number }> = [];
    for (const a of s.actions) {
      const last = parts[parts.length - 1];
      if (last && last.s === a.shortName) last.n++;
      else parts.push({ s: a.shortName, n: 1 });
    }
    return `${name(s.characterId)}[${parts.map(p => (p.n > 1 ? `${p.s}×${p.n}` : p.s)).join(' ')}]`;
  }).join(' → ');
}

/** 決まった順序で、等間隔に間引く（乱数を使わない。同じ入力は同じ結果） */
function thin<T>(xs: T[], max: number): T[] {
  if (xs.length <= max) return xs;
  const step = xs.length / max;
  return Array.from({ length: max }, (_, i) => xs[Math.floor(i * step)]);
}

export function generateCandidates(characters: CharacterConfig[], roles: Record<string, SearchRole[]>, options: CandidateOptions = {}): Candidate[] {
  const pad = options.lengthPad ?? 1;
  const swap = options.switchDelay ?? 0.5;
  const maxCandidates = options.maxCandidates ?? 20000;
  const all: Candidate[] = [];

  for (const assignment of roleAssignments(characters, roles)) {
    const byRole = (r: SearchRole) => characters.filter(c => assignment[c.id] === r);
    const P = byRole('supporter');
    const S = byRole('subAttacker');
    const A = byRole('attacker');
    // 出場の順番: サポーター → サブアタッカー → アタッカー。同じ役割の中は、並べ替えを全部試す
    const orders = product([permutations(P), permutations(S), permutations(A)]).map(([p, s, a]) => [...p, ...s, ...a] as CharacterConfig[]);
    // 使い方: キャラごとの選択肢の直積
    const useLists = characters.map(c => useOptions(c, assignment[c.id]));
    if (useLists.some(l => l.length === 0)) continue;
    for (const uses of product(useLists)) {
      const useOf = new Map(characters.map((c, i) => [c.id, uses[i]]));
      // 目安の長さ = 使う E・Q の最長 CT + pad（決定 A）。何も使わないときは作らない
      const cts = characters.flatMap(c => {
        const u = useOf.get(c.id)!;
        return [...(u.es.length > 0 ? [cooldownOf(c, u.es[0] === 'e_hold' ? 'e' : 'e')] : []), ...(u.q ? [cooldownOf(c, 'q')] : [])];
      });
      if (cts.length === 0) continue;
      const target = Math.max(...cts) + pad;
      for (const order of orders) {
        // アタッカー以外の出場（使うスキル・爆発がある人だけ）
        const others = order.filter(c => assignment[c.id] !== 'attacker' && useSteps(useOf.get(c.id)!).length > 0);
        const attackers = order.filter(c => assignment[c.id] === 'attacker');
        const timeOf = (c: CharacterConfig) => useSteps(useOf.get(c.id)!).reduce((x, s) => x + durationOf(c, s), 0);
        const othersTime = others.reduce((sum, c) => sum + timeOf(c), 0);
        const attackerOwnTime = attackers.reduce((sum, c) => sum + timeOf(c), 0);
        const fill = Math.max(0, target - othersTime - attackerOwnTime - swap * (others.length + attackers.length)) / attackers.length;
        for (const tpl of FILL_TEMPLATES) {
          if (attackers.some(c => tpl.steps.some(s => !defOf(c, s)))) continue;
          const cycle = Math.max(0.1, Math.min(...attackers.map(c => tpl.steps.reduce((x, s) => x + durationOf(c, s), 0))));
          const r0 = Math.max(1, Math.round(fill / cycle));
          // 繰り返しの回数: 1 回から目安 +1 回まで（上限 5 回）。手で組んだ例は、目安より短い 1 周の方が DPS が高かった
          for (let r = 1; r <= Math.min(r0 + 1, 5); r++) {
            // アタッカーごとの並び（スキル → 攻撃の型の繰り返し（→ 最後に E を足す）、Q はどこかに差し込む）の選択肢
            const withTail = tpl.steps.includes('e') ? [false, true] : [false];
            const variants = (c: CharacterConfig): string[][] => {
              const u = useOf.get(c.id)!;
              const out: string[][] = [];
              for (const tail of withTail) {
                const base = [...u.es];
                for (let i = 0; i < r; i++) base.push(...tpl.steps);
                if (tail) base.push('e');
                if (!u.q) { out.push(base); continue; }
                // Q の位置: 先頭・末尾・「E の直後」・「重撃の直前」（アタッカーが 2 人以上のときは、先頭と末尾だけ）
                const pos = new Set<number>([0, base.length]);
                if (attackers.length === 1) base.forEach((s, i) => { if (s === 'ca') pos.add(i); if (s === 'e') pos.add(i + 1); });
                for (const p of [...pos].sort((a, b) => a - b)) out.push([...base.slice(0, p), 'q', ...base.slice(p)]);
              }
              return out;
            };
            for (const attackerSteps of product(attackers.map(variants))) {
              const stints: Stint[] = [];
              let ok = true;
              for (const c of [...others, ...attackers]) {
                const steps = assignment[c.id] === 'attacker' ? attackerSteps[attackers.indexOf(c)] : useSteps(useOf.get(c.id)!);
                const actions = steps.map(s => instance(c, s));
                if (actions.some(a => a === null)) { ok = false; break; }
                stints.push({ id: `s${stints.length}`, characterId: c.id, actions: actions as CharacterActionInstance[] });
              }
              if (!ok || stints.length === 0) continue;
              all.push({ id: 'c', label: describe(characters, stints), assignment, targetSeconds: target, stints });
            }
          }
        }
      }
    }
  }
  // 同じ並びの候補（役割の割り当てだけが違い、結果が同じもの）は 1 つにする
  const seen = new Set<string>();
  const unique = all.filter(c => {
    if (seen.has(c.label)) return false;
    seen.add(c.label);
    return true;
  });
  return thin(unique, maxCandidates).map((c, i) => ({ ...c, id: `c${i}` }));
}
