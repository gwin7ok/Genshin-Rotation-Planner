/**
 * ローテーション自動探索の、候補の生成（設計: docs/gcsim-integration/phase-9-auto-rotation-search/設計.md の ①）。
 * gcsim は使わない。編成（4 人）と役割から、「出場の順番 ＋ 各出場のアクション」の候補を作る。
 *
 *  - 役割の割り当て（決定 C）: 複数の役割を持つキャラは、どの役割で置くかを全部試す。アタッカーは最低 1 人
 *  - 出場の順番（決定 B）: サポーター → サブアタッカー → アタッカー。同じ役割の中の順番は、並べ替えを全部試す
 *  - 使う E・Q（決定 A）: 使わない E・Q も候補。アタッカー・サブアタッカーの Q は使う
 *  - アタッカーの攻撃の型: 通常攻撃・通常＋重撃・重撃・落下・高落下の繰り返し。回数は、ローテーションの長さの目安（使う E・Q の最長 CT + 1 秒）から決める
 */
import { macrosOf } from '../../masterdata/sequenceRules';
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
  /** 周回の開始位置（出場の番号。0 = 最初から。1 以上 = 最初の数個の出場は 1 回目だけで、それ以降を繰り返す。手組みの「最初に通常攻撃を 1 回だけ当てる」形） */
  loopStartIndex?: number;
  /** 近傍操作で作ったときの、操作の種類（山登りで、種類ごとに均等に測るのに使う） */
  op?: string;
  /** 近傍操作が、ダメージの少ないキャラの動作を狙って削ったもの（山登りで、先に測る） */
  focus?: boolean;
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
  // 重撃だけを続ける型（コロンビーナのように、通常攻撃を挟まず重撃を出せるキャラ。挟まないと gcsim が実行できないキャラは、その候補が失敗して落ちる）
  { name: '重撃のみ', steps: ['ca'] },
  { name: '落下', steps: ['jump', 'lp'] },
  { name: '高落下', steps: ['jump', 'hp'] },
  // スキルを挟む型（スキルの CT が短いキャラは、スキルと重撃・通常攻撃を交互に出す。例: サンドローネの E C E C）
  { name: 'E+重撃', steps: ['e', 'ca'] },
  { name: 'E+通常+重撃', steps: ['e', 'n', 'ca'] },
  { name: 'E+通常', steps: ['e', 'n', 'n'] },
];

// 動作の名前に「@秒」がつくものは、所要時間（長押しの長さ）を手で決めた動作（例: e_hold@6.6）
const defOf = (c: CharacterConfig, step: string) => c.availableActions.find(a => a.id === `${c.id}_${step.split('@')[0]}`);

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
  // 編成にアタッカーの役割を持つキャラがいないとき（例: 蒸発フリーナ編成）は、サブアタッカー（それもいなければ全員）にアタッカーの役割も許す
  if (!options.some(o => o.includes('attacker'))) {
    const subs = options.some(o => o.includes('subAttacker'));
    options.forEach((o, i) => { if (!subs || o.includes('subAttacker')) options[i] = [...o, 'attacker']; });
  }
  const picks = product(options).filter(pick => pick.includes('attacker'));
  // サブアタッカー（アタッカーの役割は持たない）を、単独のアタッカーにした割り当ても足す。手組みでは、サブアタッカーの役割のキャラが、主な火力になることがある
  // （例: 月開花のコロンビーナ。マスターの役割はサブアタッカーだが、最後に重撃を撃つ主役にすると、探索の 1 位が 142.9k → 165.0k）。ほかの人は、アタッカー以外の役割にする
  options.forEach((o, i) => {
    if (!o.includes('subAttacker') || o.includes('attacker')) return;
    picks.push(options.map((oo, j) => (j === i ? 'attacker' : oo.find(r => r !== 'attacker') ?? 'supporter')));
  });
  const seen = new Set<string>();
  return picks
    .filter(pick => { const k = pick.join(','); if (seen.has(k)) return false; seen.add(k); return true; })
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
    // E の連続（ニィロウの E×4 のように、全部そろって初めて効く形。1 回ずつ足す山登りでは届かないので、出発点に入れる）
    // マスターデータから導く: 「モード中にもう一度 E」を使い切る回数（mode.repress.frames の数 + 最初の 1 回。maxUses があればそれ）。
    // 使い切ると別の効果（ニィロウの E×4 → 天を滌う水環）が出るので、その全部そろった並びを出発点に入れる
    const repress = eDef.mode?.repress;
    if (repress && (!repress.actions || repress.actions.includes('e'))) {
      const n = Math.min(1 + (repress.maxUses ?? repress.frames.length), 6);
      if (n >= 2 && n !== charges) esOptions.push(Array.from({ length: n }, () => 'e'));
    }
    if (defOf(c, 'e_recast')) esOptions.push(['e', 'e_recast']);
  }
  // マスターデータの「ひとまとまりの並び」（sequenceRules）。E・長押し・再発動だけの部分は E の使い方に、末尾の Q は Q を使うかどうかに入れる
  for (const m of macrosOf(c.id)) {
    const body = m[m.length - 1] === 'q' ? m.slice(0, -1) : m;
    if (body.length > 0 && body.every(s => s !== 'q' && s !== 'n' && s !== 'ca' && !!defOf(c, s)) && !esOptions.some(o => o.join() === body.join())) esOptions.push(body);
  }
  if (defOf(c, 'e_hold') && !esOptions.some(o => o.join() === 'e_hold')) esOptions.push(['e_hold']); // 長押しは、役割を問わず試す（例: ラウマの長押しスキル）
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
  const manual = step.includes('@') ? Number(step.split('@')[1]) : NaN;
  return { id: `r${++seq}`, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: Number.isFinite(manual) ? manual : def.defaultDuration, ...(Number.isFinite(manual) ? { durationManual: true } : {}) };
};

/** 使い方 → アクションの並び（E → Q の順） */
const useSteps = (u: Use): string[] => [...u.es, ...(u.q ? ['q'] : [])];

const cooldownOf = (c: CharacterConfig, step: string): number => defOf(c, step)?.cooldown ?? 0;
const durationOf = (c: CharacterConfig, step: string): number => defOf(c, step)?.defaultDuration ?? 0;

/**
 * 同じキャラの隣り合う出場を 1 つにまとめた候補を返す（探索の途中は、出場の分け方も試すので分かれているが、結果としては 1 つの出場として見せる・置く）。
 * 周回の開始位置をまたぐ（1 周目だけの出場と周回の出場の間）ところは、まとめない。まとめた分、開始位置を前へずらす
 */
export function mergeAdjacentStints(characters: CharacterConfig[], candidate: Candidate): Candidate {
  const loop = candidate.loopStartIndex ?? 0;
  const stints: Stint[] = [];
  let newLoop = loop;
  candidate.stints.forEach((s, i) => {
    const prev = stints[stints.length - 1];
    if (prev && prev.characterId === s.characterId && i !== loop) {
      stints[stints.length - 1] = { ...prev, actions: [...prev.actions, ...s.actions] };
      if (i < loop) newLoop--;
    } else stints.push({ ...s, actions: [...s.actions] });
  });
  if (stints.length === candidate.stints.length) return candidate;
  return { ...candidate, stints, loopStartIndex: newLoop, label: describe(characters, stints, newLoop) };
}

/** 候補の要約（出場ごとに「キャラ名[アクション…]」。同じアクションの連続は ×n にまとめる） */
export function describe(characters: CharacterConfig[], stints: Stint[], loopStartIndex = 0): string {
  const name = (id: string) => characters.find(c => c.id === id)?.name ?? id;
  return stints.map((s, si) => {
    const parts: Array<{ s: string; n: number }> = [];
    for (const a of s.actions) {
      const last = parts[parts.length - 1];
      const key = a.durationManual ? `${a.shortName}(${a.duration}s)` : a.shortName;
      if (last && last.s === key) last.n++;
      else parts.push({ s: key, n: 1 });
    }
    return `${loopStartIndex > 0 && si === loopStartIndex ? '↻' : ''}${name(s.characterId)}[${parts.map(p => (p.n > 1 ? `${p.s}×${p.n}` : p.s)).join(' ')}]`;
  }).join(' → ');
}

/** 決まった順序で、等間隔に間引く（乱数を使わない。同じ入力は同じ結果） */
function thin<T>(xs: T[], max: number): T[] {
  if (xs.length <= max) return xs;
  const step = xs.length / max;
  return Array.from({ length: max }, (_, i) => xs[Math.floor(i * step)]);
}

/** 生成の上限（アタッカーの割り当てごと）: 使い方の組み合わせ / 出場の順番。超えた分は間引く（山登りの近傍が、順番の入れ替え・動作の差し込みなどで補う） */
const MAX_USES = 260;
const MAX_ORDERS = 6;

/** 層ごとに、ほぼ同じ数ずつ残す（少ない層は全部残し、余りを多い層に回す。乱数なし） */
function thinStratified<T>(xs: T[], max: number, keyOf: (x: T) => string): T[] {
  if (xs.length <= max) return xs;
  const groups = new Map<string, T[]>();
  for (const x of xs) { const k = keyOf(x); const l = groups.get(k); if (l) l.push(x); else groups.set(k, [x]); }
  const sorted = [...groups.values()].sort((a, b) => a.length - b.length);
  const out: T[] = [];
  let remaining = max;
  sorted.forEach((g, i) => {
    const quota = Math.floor(remaining / (sorted.length - i));
    const taken = thin(g, quota);
    out.push(...taken);
    remaining -= taken.length;
  });
  return out;
}

export function generateCandidates(characters: CharacterConfig[], roles: Record<string, SearchRole[]>, options: CandidateOptions = {}): Candidate[] {
  const pad = options.lengthPad ?? 1;
  const swap = options.switchDelay ?? 0.5;
  const maxCandidates = options.maxCandidates ?? 20000;
  // 候補は、まず軽い形（動作の並びだけ）で貯め、間引いたあとで Stint に組み立てる（全部を組み立てると、メモリが足りなくなる）
  interface Slim { label: string; assignment: Record<string, SearchRole>; target: number; plan: Array<[CharacterConfig, string[]]>; loop: number }
  const all: Slim[] = [];
  const pushPlan = (plan: Array<[CharacterConfig, string[]]>, assignment: Record<string, SearchRole>, target: number, loop = 0): void => {
    if (plan.length === 0) return;
    const parts: string[] = [];
    for (const [c, steps] of plan) {
      const names: Array<{ s: string; n: number }> = [];
      for (const st of steps) {
        const d = defOf(c, st);
        if (!d) return;
        const last = names[names.length - 1];
        if (last && last.s === d.shortName) last.n++; else names.push({ s: d.shortName, n: 1 });
      }
      parts.push(`${loop > 0 && parts.length === loop ? '↻' : ''}${c.name}[${names.map(x => (x.n > 1 ? `${x.s}×${x.n}` : x.s)).join(' ')}]`);
    }
    all.push({ label: parts.join(' → '), assignment, target, plan, loop });
  };

  for (const assignment of roleAssignments(characters, roles)) {
    const byRole = (r: SearchRole) => characters.filter(c => assignment[c.id] === r);
    const P = byRole('supporter');
    const S = byRole('subAttacker');
    const A = byRole('attacker');
    // 出場の順番: サポーター → サブアタッカー → アタッカー。同じ役割の中は、並べ替えを全部試す（役割をまたぐ入れ替えは、近傍探索 neighborsOf が試す）
    const orders = thin(product([permutations(P), permutations(S), permutations(A)]).map(([p, s, a]) => [...p, ...s, ...a] as CharacterConfig[]), MAX_ORDERS);
    // 使い方: キャラごとの選択肢の直積
    const useLists = characters.map(c => useOptions(c, assignment[c.id]));
    if (useLists.some(l => l.length === 0)) continue;
    // 使い方の組み合わせは、E の連続・長押しを足すと数万通りになる。決まった間隔で間引いて残し（足りない分は、山登りの近傍が補う）
    for (const uses of thin(product(useLists), MAX_USES)) {
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
          // E を含む型は、E の CT より短い間隔で繰り返せない（CT 違反になる）ので、回数を E の CT で抑える
          const eCt = tpl.steps.includes('e') ? Math.max(...attackers.map(c => cooldownOf(c, 'e'))) : 0;
          const rMax = eCt > 0 ? Math.max(1, Math.min(5, Math.floor((fill + cycle) / Math.max(eCt, cycle)))) : Math.min(r0 + 1, 5);
          for (let r = Math.max(1, Math.min(r0 - 1, rMax)); r <= rMax; r++) {
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
                if (attackers.length === 1) { const i = base.findIndex(s => s === 'e'); if (i >= 0) pos.add(i + 1); }
                for (const p of [...pos].sort((a, b) => a - b)) out.push([...base.slice(0, p), 'q', ...base.slice(p)]);
              }
              return out;
            };
            for (const attackerSteps of product(attackers.map(variants))) {
              pushPlan([...others, ...attackers].map(c => [c, assignment[c.id] === 'attacker' ? attackerSteps[attackers.indexOf(c)] : useSteps(useOf.get(c.id)!)] as [CharacterConfig, string[]]), assignment, target);
            }
            // アタッカーが 1 人のとき: 出場を 2 つに分ける型（スキル・爆発だけの出場を、他のキャラと同じ並びに置き、攻撃だけの出場を最後に置く。例: コロンビーナ [E Q] → … → [重撃]）
            if (attackers.length === 1 && useSteps(useOf.get(attackers[0].id)!).length > 0) {
              const a = attackers[0];
              for (const tail of withTail) {
                const fill: string[] = [];
                for (let i = 0; i < r; i++) fill.push(...tpl.steps);
                if (tail) fill.push('e');
                const rest = others.map(c => [c, useSteps(useOf.get(c.id)!)] as [CharacterConfig, string[]]);
                pushPlan([...rest, [a, useSteps(useOf.get(a.id)!)], [a, fill]], assignment, target);
                // 最初にアタッカーが通常攻撃を 1 回だけ当てる形
                if (defOf(a, 'n')) {
                  pushPlan([[a, ['n']], ...rest, [a, useSteps(useOf.get(a.id)!)], [a, fill]], assignment, target);
                  pushPlan([[a, ['n']], ...rest, [a, useSteps(useOf.get(a.id)!)], [a, fill]], assignment, target, 1);
                }
              }
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
  const slimKey = (s: Slim): string => {
    const atk = Object.entries(s.assignment).filter(([, r]) => r === 'attacker').map(([id]) => id).sort();
    return `${atk.join('+')}|${atk.some(id => s.plan.filter(([c]) => c.id === id).length > 1) ? 'split' : 'one'}`;
  };
  return thinStratified(unique, maxCandidates, slimKey).map((s, i) => {
    const stints: Stint[] = [];
    for (const [c, steps] of s.plan) stints.push({ id: `s${stints.length}`, characterId: c.id, actions: steps.map(st => instance(c, st) as CharacterActionInstance) });
    return { id: `c${i}`, label: s.label, assignment: s.assignment, targetSeconds: s.target, stints, ...(s.loop > 0 ? { loopStartIndex: s.loop } : {}) };
  });
}

/** 近傍探索で、1 人の出場に入れる・並べ替える動作の種類 */
const NEIGHBOR_STEPS = ['e', 'q', 'ca', 'n', 'e_recast'];

/**
 * 近傍: 候補を、1 か所だけ変えたもの（gcsim で良かった候補の周りを調べるのに使う。CT 違反などは、呼び出し側が評価で除く）
 *   ・隣り合う 2 人の出場を入れ替える
 *   ・出場の中の動作を 1 つ消す / 1 つ移す / 1 つ差し込む（e・q・ca・n・e_recast）
 */
export function neighborsOf(characters: CharacterConfig[], base: Candidate, hints?: { lowShare?: string[] }): Candidate[] {
  const out = new Map<string, Candidate>();
  let loop = base.loopStartIndex ?? 0;
  const make = (plan: Array<{ c: CharacterConfig; steps: string[] }>, op: string, who?: string): void => {
    const stints: Stint[] = [];
    for (const { c, steps } of plan) {
      const actions = steps.map(s => instance(c, s));
      if (actions.length === 0 || actions.some(a => a === null)) return;
      stints.push({ id: `s${stints.length}`, characterId: c.id, actions: actions as CharacterActionInstance[] });
    }
    const label = describe(characters, stints, loop);
    if (label === base.label || out.has(label)) return;
    out.set(label, { ...base, id: 'n', label, stints, loopStartIndex: loop, op, ...(who && hints?.lowShare?.includes(who) ? { focus: true } : {}) });
  };
  const plan0 = base.stints.map(s => ({
    c: characters.find(c => c.id === s.characterId)!,
    steps: s.actions.map(a => a.actionTypeId.replace(`${s.characterId}_`, '') + (a.durationManual ? `@${a.duration}` : '')),
  }));
  const clone = () => plan0.map(p => ({ c: p.c, steps: [...p.steps] }));
  // 周回の開始位置を変える（最初の数個の出場を 1 回目だけにする / 戻す）。出場の並びは変えない
  for (let k = 0; k < plan0.length; k++) {
    if (k === (base.loopStartIndex ?? 0)) continue;
    const stints = base.stints;
    const label = describe(characters, stints, k);
    if (!out.has(label)) out.set(label, { ...base, id: 'n', label, loopStartIndex: k, op: 'loop' });
  }
  // 出場の並びを変える操作では、周回の開始位置は 0 に戻す（位置がずれるため）。開始位置の変更は上の操作でできる
  loop = 0;
  // 出場の入れ替え（隣どうし）と、出場を別の位置へ移す
  for (let i = 0; i + 1 < plan0.length; i++) {
    const pl = clone();
    [pl[i], pl[i + 1]] = [pl[i + 1], pl[i]];
    make(pl, 'swap');
  }
  for (let i = 0; i < plan0.length; i++) {
    for (let j = 0; j < plan0.length; j++) {
      if (j === i || Math.abs(i - j) === 1) continue;
      const pl = clone();
      const [x] = pl.splice(i, 1);
      pl.splice(j, 0, x);
      make(pl, 'move');
    }
  }
  // 出場を 2 つに分ける（例: コロンビーナの [E Q] と、あとの [重撃]）/ 同じキャラの隣り合う出場を 1 つにまとめる
  plan0.forEach((p, si) => {
    for (let k = 1; k < p.steps.length; k++) {
      const pl = clone();
      pl.splice(si, 1, { c: p.c, steps: p.steps.slice(0, k) }, { c: p.c, steps: p.steps.slice(k) });
      make(pl, 'split');
    }
    if (si + 1 < plan0.length && plan0[si + 1].c.id === p.c.id) {
      const pl = clone();
      pl.splice(si, 2, { c: p.c, steps: [...p.steps, ...plan0[si + 1].steps] });
      make(pl, 'merge');
    }
  });
  // 新しい出場（通常攻撃 1 回だけ）を、どこかに足す（手組みでは、アタッカーが最初に通常攻撃を 1 回だけ当ててから、他のキャラのスキルに移る形が、DPS を大きく上げた）
  // マスターデータの並び（sequenceRules）をひとまとまりで差し込む
  for (const p of plan0) for (const m of macrosOf(p.c.id)) {
    if (!m.every(s => !!defOf(p.c, s))) continue;
    plan0.forEach((q, si) => { if (q.c.id !== p.c.id) return; for (let i = 0; i <= q.steps.length; i++) { const pl = clone(); pl[si].steps.splice(i, 0, ...m); make(pl, 'macro'); } });
  }
  const seenChars = new Map(plan0.map(p => [p.c.id, p.c]));
  for (const c of seenChars.values()) {
    if (!defOf(c, 'n')) continue;
    for (let i = 0; i <= plan0.length; i++) { const pl = clone(); pl.splice(i, 0, { c, steps: ['n'] }); make(pl, 'newN'); }
    // 先頭に足して、そこまでを 1 回目だけにする（周回の開始位置を 1 つ後ろへ。1 回で届くようにする）
  }
  // 1 周目だけ行う動作（周回の前の、1 回きりの出場）を、先頭に足す: どのキャラの、基本の動作（E・Q・重撃・通常攻撃など）でも試す。周回の開始位置は 1 つ後ろへ（1 周目だけ置く出場は、最大 2 つ）
  // 例: アタッカーが周回の前に E を 1 回だけ使って、周回の中では別の並びにする。サポーターが先に爆発を撃っておく
  if ((base.loopStartIndex ?? 0) < 2) {
    for (const c of seenChars.values()) for (const st of new Set([...NEIGHBOR_STEPS, ...c.availableActions.map(a => a.id.slice(c.id.length + 1)).filter(x => /^(e_|q_)/.test(x))])) {
      if (!defOf(c, st)) continue;
      const pl = clone(); pl.unshift({ c, steps: [st] }); loop = (base.loopStartIndex ?? 0) + 1; make(pl, st === 'n' ? 'newN' : 'pre'); loop = 0;
    }
  }
  // 出場を、まるごと消す（そのキャラが少ししかダメージを出していないとき、先に試す。gcsim の結果から）
  if (hints?.lowShare?.length) {
    loop = 0;
    plan0.forEach((p, si) => { if (plan0.length <= 2 || !hints.lowShare!.includes(p.c.id)) return; const pl = clone(); pl.splice(si, 1); make(pl, 'drop', p.c.id); });
  }
  loop = base.loopStartIndex ?? 0; // 出場の中だけを変える操作は、周回の開始位置を保つ
  plan0.forEach((p, si) => {
    const n = p.steps.length;
    for (let i = 0; i < n; i++) {
      // 消す
      if (n > 1) { const pl = clone(); pl[si].steps.splice(i, 1); make(pl, 'del', p.c.id); }
      // 隣り合う 2 つをまとめて消す（「重撃 → E」の 1 組を減らすなど。1 つずつ消すと、途中で下がって届かない）
      if (n > 2 && i + 1 < n) { const pl = clone(); pl[si].steps.splice(i, 2); make(pl, 'del2', p.c.id); }
      // 移す
      for (let j = 0; j < n; j++) {
        if (j === i || p.steps[i] === p.steps[j]) continue;
        const pl = clone();
        const [x] = pl[si].steps.splice(i, 1);
        pl[si].steps.splice(j, 0, x);
        make(pl, 'mv');
      }
    }
    // 同じ動作をまとめて差し込む（E を 2〜4 回、重撃を 2〜5 回）/ 先頭から続く同じ動作の連続をまとめて消す
    for (const [s, ks] of [['e', [2, 3, 4]], ['ca', [2, 3, 5]]] as Array<[string, number[]]>) {
      if (!defOf(p.c, s)) continue;
      for (const k of ks) for (let i = 0; i <= n; i++) { const pl = clone(); pl[si].steps.splice(i, 0, ...Array.from({ length: k }, () => s)); make(pl, 'bulk'); }
    }
    for (let i = 0; i < n; i++) {
      let j = i;
      while (j < n && p.steps[j] === p.steps[i]) j++;
      if (j - i >= 2 && !(i === 0 && j === n)) { const pl = clone(); pl[si].steps.splice(i, j - i); make(pl, 'del'); }
    }
    // 置き換える: 動作 1 つを、別の動作にする（例: 通常攻撃 → ダッシュ、E → 長押し E。消してから差し込む 2 手では、途中で下がって届かない）
    {
      const vocab = [...NEIGHBOR_STEPS, ...p.c.availableActions.map(a => a.id.slice(p.c.id.length + 1)).filter(s => !NEIGHBOR_STEPS.includes(s))];
      for (let i = 0; i < n; i++) for (const s of vocab) {
        if (s === p.steps[i] || !defOf(p.c, s)) continue;
        const pl = clone(); pl[si].steps[i] = s; make(pl, 'rep');
      }
    }
    // 長押しの長さを変える（標準の所要時間の 4 割〜8.5 割。手組みでは、標準より短い長押しが使われる。例: 早柚の長押し E）
    for (let i = 0; i < n; i++) {
      const base0 = p.steps[i].split('@')[0];
      const d = defOf(p.c, base0);
      if (d?.cooldownStart?.from !== 'holdEnd') continue;
      for (const f of [undefined, 0.4, 0.55, 0.7, 0.85]) {
        const step = f === undefined ? base0 : `${base0}@${Number((d.defaultDuration * f).toFixed(2))}`;
        if (step === p.steps[i]) continue;
        const pl = clone(); pl[si].steps[i] = step; make(pl, 'hold');
      }
    }
    // 差し込む
    // 差し込む動作の語彙: 基本（e / q / ca / n / e_recast）+ そのキャラが持つ、ほかのアクション全部（ダッシュ・ジャンプ・落下・長押し・特殊スキルなど。手組みでは、ダッシュキャンセルや長押しが使われている）
    const vocabulary = [...NEIGHBOR_STEPS, ...p.c.availableActions.map(a => a.id.slice(p.c.id.length + 1)).filter(s => !NEIGHBOR_STEPS.includes(s))];
    for (const s of vocabulary) {
      if (!defOf(p.c, s)) continue;
      for (let i = 0; i <= n; i++) { const pl = clone(); pl[si].steps.splice(i, 0, s); make(pl, NEIGHBOR_STEPS.includes(s) ? 'ins' : `ins:${s}`); }
    }
  });
  return [...out.values()];
}
