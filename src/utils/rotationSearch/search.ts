/**
 * ローテーション自動探索の本体（設計.md の ①〜⑤。画面とスクリプトで共通）。
 *   ① 候補を作る → ② CT 違反を除く → ③ 簡易スコアで絞る → ④ gcsim（少ない回数）で絞る → ⑤ gcsim（多い回数）で順位をつける
 * gcsim の呼び出し口は gcsimClient（画面は Web Worker、スクリプトは Node の worker_threads に差し替わる）。
 */
import type { CharacterConfig, Stint } from '../../types/genshin';
import type { HurtSetting } from '../gcsim/buildGcsimConfig';
import { buildGcsimConfig } from '../gcsim/buildGcsimConfig';
import { computeDps } from '../gcsim/dpsCalc';
import { runGcsimSample } from '../gcsim/gcsimClient';
import { generateCandidates, neighborsOf, type Candidate, type SearchRole } from './candidates';
import { evaluateCandidates, type ScoredCandidate } from './evaluate';

export interface SearchSettings {
  /** 戦闘時間（秒）。DPS = この時間までのダメージ ÷ この時間 */
  battleSeconds: number;
  /** ③ 簡易スコアで残す数 */
  keep1: number;
  /** ④ gcsim の実行回数（少ない回数） */
  runs1: number;
  /** ④ で残す数 */
  keep2: number;
  /** ⑤ gcsim の実行回数（多い回数） */
  runs2: number;
  /** 候補の上限 */
  maxCandidates: number;
  /** ④b 近傍の探索で試す候補の数の上限（0 で行わない。既定 DEFAULT_REFINE_BUDGET） */
  refineBudget?: number;
}

const DEFAULT_REFINE_BUDGET = 700;
/** 探索中（④④b）の戦闘時間の上限（秒） */
const EXPLORE_SECONDS = 60;
/** 山登りの 1 回で試す近傍の数の上限 */
const CROSS_PER_GROUP = 6;
const BEAM = 4;
const BEAM_RATIO = 0.9;
const STALE_LIMIT = 3;
const REFINE_BATCH = 70;
/** 許す CT 違反（CT 待ち）の数。gcsim が待ってから動くので、DPS は実測で正しく出る。決めた数を超える候補は捨てる（evaluate.ts の maxCtIssues） */
const TOLERATED_CT_ISSUES = 4;
/** 山登りの先行 1 回の足切り（いまの最良に対する割合） */
const REFINE_PREFILTER = 0.85;

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = { battleSeconds: 60, keep1: 900, runs1: 1, keep2: 12, runs2: 10, maxCandidates: 20000 };

export type SearchPhase = 'generate' | 'quick' | 'refine' | 'verify';

export interface SearchProgress {
  phase: SearchPhase;
  done: number;
  total: number;
}

export interface SearchResultItem {
  candidate: Candidate;
  dps: number;
  sd: number;
  /** アプリの計算でのローテーションの長さ（秒） */
  totalSeconds: number;
  /** 簡易スコア */
  score: number;
}

export interface SearchCounts {
  candidates: number;
  rejected: number;
  rejectedBy: Record<string, number>;
  scored: number;
  quick: number;
  quickOk: number;
  quickFailed: Record<string, number>;
}

export type SearchOutcome =
  | { status: 'ok'; results: SearchResultItem[]; counts: SearchCounts; elapsedMs: number; spearman?: number; bestQuickScoreRank?: number; groupBest?: Array<{ key: string; dps: number; label: string }> }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export interface SearchArgs {
  /** 編成のキャラ（空の枠は除く。装備・凸・天賦つきで解決済みのもの） */
  characters: CharacterConfig[];
  /** キャラ ID → 役割（探索で使う役割。利用者の上書きを反映したもの） */
  roles: Record<string, SearchRole[]>;
  weapons: Parameters<typeof buildGcsimConfig>[0]['weapons'];
  artifacts: Parameters<typeof buildGcsimConfig>[0]['artifacts'];
  settings: SearchSettings;
  switchDelay: number;
  defHalt: boolean;
  hurt?: HurtSetting;
  /** 同時に動かす gcsim の数（Worker の数） */
  cores: number;
  onProgress?: (p: SearchProgress) => void;
  shouldCancel?: () => boolean;
}

interface QuickRun { sc: ScoredCandidate; dps?: number; sd?: number; error?: string }

/** 順位（小さい順に 0 から） */
const ranksOf = (xs: number[]): number[] => {
  const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  idx.forEach(([, i], k) => { r[i] = k; });
  return r;
};

export async function searchRotation(args: SearchArgs): Promise<SearchOutcome> {
  const { characters, settings } = args;
  const t0 = Date.now();
  const cancelled = () => !!args.shouldCancel?.();
  try {
    args.onProgress?.({ phase: 'generate', done: 0, total: 1 });
    const candidates = generateCandidates(characters, args.roles, { maxCandidates: settings.maxCandidates, switchDelay: args.switchDelay });
    if (candidates.length === 0) return { status: 'error', message: 'NO_CANDIDATES' };
    const ev = evaluateCandidates(characters, candidates, { switchDelay: args.switchDelay, defHalt: args.defHalt, maxCtIssues: TOLERATED_CT_ISSUES });
    if (ev.scored.length === 0) return { status: 'error', message: 'NO_VALID_CANDIDATES' };
    if (cancelled()) return { status: 'cancelled' };

    // 1 候補ぶんの gcsim 実行。同時に動かす候補の数 = コア数 ÷ 1 候補の並列数
    const runOne = async (sc: ScoredCandidate, runs: number, parallel: number, seconds: number): Promise<QuickRun> => {
      const cfg = buildGcsimConfig({
        characters, stints: sc.candidate.stints, loopStartIndex: sc.candidate.loopStartIndex ?? 0, switchDelay: args.switchDelay, defHalt: args.defHalt,
        ...(args.hurt ? { hurt: args.hurt } : {}), weapons: args.weapons, artifacts: args.artifacts, battleSeconds: seconds,
      });
      if (!cfg.runnable) return { sc, error: cfg.warnings.find(w => w.level === 'error')?.message ?? 'NOT_RUNNABLE' };
      try {
        const out = await computeDps({ config: cfg, runs, parallel, run: runGcsimSample, context: { battleSeconds: seconds }, shouldCancel: cancelled });
        if (out.status === 'cancelled') return { sc, error: 'CANCELLED' };
        if (out.status !== 'ok') return { sc, error: out.message || out.status };
        return { sc, dps: out.result.dps.mean, sd: out.result.dps.sd };
      } catch (e) {
        return { sc, error: e instanceof Error ? e.message : String(e) };
      }
    };
    // wanted: 成功がこの数に届くまで、後ろの候補で補う（gcsim が実行できない候補が混じるので、その分を減らさない）。items の最後まで試したら終わる
    const mapLimit = async (items: ScoredCandidate[], runs: number, phase: SearchPhase, wanted = items.length, seconds = settings.battleSeconds): Promise<QuickRun[]> => {
      const parallel = Math.max(1, Math.min(runs, args.cores));
      const concurrent = Math.max(1, Math.floor(args.cores / parallel));
      const out: QuickRun[] = [];
      let next = 0;
      let done = 0;
      let okCount = 0;
      args.onProgress?.({ phase, done: 0, total: wanted });
      await Promise.all(Array.from({ length: concurrent }, async () => {
        while (next < items.length && okCount < wanted && !cancelled()) {
          const i = next++;
          const r = await runOne(items[i], runs, parallel, seconds);
          out.push(r);
          if (r.dps !== undefined) { okCount++; done = okCount; }
          args.onProgress?.({ phase, done, total: wanted });
        }
      }));
      return out;
    };

    // ④ 少ない回数（簡易スコアの順に、成功が keep1 個になるまで。補う上限は keep1 の 3 倍）
    // 探索中の戦闘時間は短め（最大 60 秒）にして速くする。最後の確認（⑤）だけ、指定の戦闘時間で行う
    const exploreSeconds = Math.min(settings.battleSeconds, EXPLORE_SECONDS);
    // 出発点は、アタッカーの割り当てごとに均等に取る（簡易スコアの上位だけだと、1 つの割り当てに偏り、別の割り当てに良い形があっても届かない）
    const groupOf = (sc: ScoredCandidate): string => Object.entries(sc.candidate.assignment).filter(([, r]) => r === 'attacker').map(([id]) => id).sort().join('+');
    const byGroup = new Map<string, ScoredCandidate[]>();
    for (const sc of ev.scored) { const k = groupOf(sc); const l = byGroup.get(k); if (l) l.push(sc); else byGroup.set(k, [sc]); }
    // キャラごとの「使い方」（E の種類と回数・最初の通常攻撃だけの出場があるか）。出発点を、どの使い方も一度は含むように選ぶ
    const optionsOf = (sc: ScoredCandidate): Map<string, string> => {
      const per = new Map<string, Map<string, number>>();
      for (const s of sc.candidate.stints) for (const x of s.actions) {
        const step = x.actionTypeId.slice(s.characterId.length + 1);
        if (step === 'n') continue;
        const key = step === 'ca' ? 'ca' : step;
        const m = per.get(s.characterId) ?? new Map<string, number>(); per.set(s.characterId, m); m.set(key, step === 'ca' ? 1 : (m.get(key) ?? 0) + 1);
      }
      const out = new Map<string, string>();
      for (const c of characters) out.set(c.id, [...(per.get(c.id) ?? new Map()).entries()].sort().map(([k, n]) => k + n).join(',') || '-');
      const first = sc.candidate.stints[0];
      if (first && first.actions.every(x => x.actionTypeId.endsWith('_n'))) out.set(first.characterId, out.get(first.characterId) + '|N>');
      if ((sc.candidate.loopStartIndex ?? 0) > 0) for (const [k, v] of out) out.set(k, v + '|L');
      return out;
    };
    const optsCache = new Map<ScoredCandidate, Map<string, string>>();
    const opts = (sc: ScoredCandidate) => { let o = optsCache.get(sc); if (!o) { o = optionsOf(sc); optsCache.set(sc, o); } return o; };
    for (const [k, l] of byGroup) {
      // 貪欲な被覆: まだ出ていない（キャラ, 使い方）をいちばん多く含む候補（同数なら簡易スコアの高い方）を、順に選ぶ
      const covered = new Set<string>();
      const left = [...l];
      const first: ScoredCandidate[] = [];
      while (left.length > 0 && first.length < 40) {
        let bi = -1, bn = 0;
        for (let i = 0; i < left.length; i++) {
          let n = 0; for (const [cid, o] of opts(left[i])) if (!covered.has(cid + '#' + o)) n++;
          if (n > bn) { bn = n; bi = i; }
        }
        if (bi < 0) break;
        const [pick] = left.splice(bi, 1);
        for (const [cid, o] of opts(pick)) covered.add(cid + '#' + o);
        first.push(pick);
      }
      byGroup.set(k, [...first, ...left]);
    }
    const seedPool: ScoredCandidate[] = [];
    for (let i = 0; seedPool.length < ev.scored.length; i++) {
      let any = false;
      for (const l of byGroup.values()) if (i < l.length) { seedPool.push(l[i]); any = true; }
      if (!any) break;
    }
    const r1 = await mapLimit(seedPool.slice(0, Math.max(1, settings.keep1) * 3), settings.runs1, 'quick', Math.max(1, settings.keep1), exploreSeconds);
    if (cancelled()) return { status: 'cancelled' };
    const ok1 = r1.filter(r => r.dps !== undefined);
    const quickFailed: Record<string, number> = {};
    for (const r of r1) if (r.dps === undefined) quickFailed[r.error ?? '?'] = (quickFailed[r.error ?? '?'] ?? 0) + 1;
    if (ok1.length === 0) return { status: 'error', message: Object.keys(quickFailed)[0] ?? 'ALL_FAILED' };

    // ④a 組み合わせ: 組ごとに、キャラごとの使い方の平均 DPS が一番高いものを選び、それを全部そろえた候補（まだ試していないもの）を、追加の出発点として測る。
    //   全部そろって初めて効く形（ニィロウの E×4 + ラウマの長押し + コロンビーナの最初の通常攻撃…）を、1 手ずつの山登りに頼らず拾う
    {
      const triedX = new Set<string>(r1.map(r => r.sc.candidate.label));
      const extra: ScoredCandidate[] = [];
      for (const [g, list] of byGroup) {
        const runs = r1.filter(r => r.dps !== undefined && groupOf(r.sc) === g);
        if (runs.length < 3) continue;
        const best = new Map<string, string[]>();
        for (const c of characters) {
          const agg = new Map<string, { sum: number; n: number }>();
          for (const r of runs) { const o = opts(r.sc).get(c.id)!; const a2 = agg.get(o) ?? { sum: 0, n: 0 }; a2.sum += r.dps!; a2.n++; agg.set(o, a2); }
          best.set(c.id, [...agg.entries()].sort((x, y) => y[1].sum / y[1].n - x[1].sum / x[1].n).slice(0, 2).map(([o]) => o));
        }
        const want = (sc: ScoredCandidate): number => { let s = 0; for (const c of characters) { const i = best.get(c.id)!.indexOf(opts(sc).get(c.id)!); s += i < 0 ? 100 : i; } return s; };
        const found = list.filter(sc => !triedX.has(sc.candidate.label) && want(sc) < 100).sort((x, y) => want(x) - want(y) || y.score - x.score).slice(0, CROSS_PER_GROUP);
        extra.push(...found);
      }
      if (extra.length > 0 && !cancelled()) {
        const rx = await mapLimit(extra, settings.runs1, 'quick', extra.length, exploreSeconds);
        r1.push(...rx);
      }
    }

    // ④b 山登り: アタッカーの割り当てごとに別々に、その中で gcsim の結果が一番良い候補から、1 か所だけ変えた候補（出場の入れ替え・分割・結合・移動、動作の消去・移動・差し込み）を
    //   全部試し、良くなったらそこへ移る。割り当て同士を比べて早く切ることはしない（出発点が低くても、登った先が一番高いことがある。例: 手で組んだ形は、出発点では 6 割だった）。
    //   その割り当ての中で、良くならない回が 2 回続いたら、その割り当てはそこで終わり
    const budget = settings.refineBudget ?? DEFAULT_REFINE_BUDGET;
    if (budget > 0 && !cancelled()) {
      const tried = new Set<string>(r1.map(r => r.sc.candidate.label));
      let used = 0;
      args.onProgress?.({ phase: 'refine', done: 0, total: budget });
      const stale = new Map<string, number>();
      const bestIn = (g: string): QuickRun | undefined => r1.filter(r => r.dps !== undefined && groupOf(r.sc) === g).sort((x, y) => y.dps! - x.dps!)[0];
      const groups = [...byGroup.keys()].filter(g => bestIn(g));
      // ビーム: 最良だけでなく、最良の 92% 以上の上位 BEAM 個のうち、まだ広げていないものを順に広げる（少し下がってから大きく上がる形に届くように。例: 周回の開始位置を変えてから、別のキャラの爆発を足すと、はじめて 1.2 倍になる）
      const expanded = new Set<string>();
      const nextStart = (g: string): QuickRun | undefined => {
        const all = r1.filter(r => r.dps !== undefined && groupOf(r.sc) === g).sort((x, y) => y.dps! - x.dps!);
        if (all.length === 0) return undefined;
        return all.slice(0, BEAM).find(r => r.dps! >= all[0].dps! * BEAM_RATIO && !expanded.has(r.sc.candidate.label));
      };
      for (let round = 0; round < 24 && used < budget && !cancelled(); round++) {
        let progressed = false;
        for (const g of groups) {
          if ((stale.get(g) ?? 0) >= STALE_LIMIT || used >= budget || cancelled()) continue;
          const start = nextStart(g);
          if (!start) { stale.set(g, 99); continue; }
          expanded.add(start.sc.candidate.label);
          const pool = new Map<string, Candidate>();
          for (const n of neighborsOf(characters, start.sc.candidate)) if (!tried.has(n.label)) pool.set(n.label, n);
          if (pool.size === 0) { stale.set(g, 99); continue; }
          const ev2 = evaluateCandidates(characters, [...pool.values()], { switchDelay: args.switchDelay, defHalt: args.defHalt, maxCtIssues: TOLERATED_CT_ISSUES });
          for (const c of pool.keys()) tried.add(c);
          const batch = ev2.scored.slice(0, Math.min(REFINE_BATCH, budget - used));
          if (batch.length === 0) { stale.set(g, 99); continue; }
          progressed = true;
          const before = bestIn(g)!.dps!;
          const startDps = start.dps!;
          // 先に 1 回だけ回して、明らかに悪い候補（その割り当ての最良の 85% 未満）を落とし、残りだけ決めた回数で測り直す（1 回の値は、ばらつきが大きいので、落とす基準は緩め）
          const first = await mapLimit(batch, 1, 'refine', batch.length, exploreSeconds);
          const keepSc = first.filter(r => r.dps !== undefined && r.dps >= startDps * REFINE_PREFILTER).map(r => r.sc);
          const rr = settings.runs1 <= 1 ? first : await mapLimit(keepSc, settings.runs1, 'refine', keepSc.length, exploreSeconds);
          used += batch.length;
          args.onProgress?.({ phase: 'refine', done: Math.min(used, budget), total: budget });
          r1.push(...rr);
          stale.set(g, (bestIn(g)?.dps ?? 0) > before * 1.003 ? 0 : (stale.get(g) ?? 0) + 1);
        }
        if (!progressed) break;
      }
    }
    if (cancelled()) return { status: 'cancelled' };
    const okAll = r1.filter(r => r.dps !== undefined);
    // 診断用: アタッカーの割り当てごとの、探索中（短い戦闘時間）の最良
    const groupBestMap = new Map<string, { key: string; dps: number; label: string }>();
    for (const r of okAll) { const k = groupOf(r.sc); const cur = groupBestMap.get(k); if (!cur || r.dps! > cur.dps) groupBestMap.set(k, { key: k, dps: r.dps!, label: r.sc.candidate.label }); }

    let spearman: number | undefined;
    let bestQuickScoreRank: number | undefined;
    if (ok1.length >= 3) {
      const a = ranksOf(ok1.map(r => r.sc.score));
      const b = ranksOf(ok1.map(r => r.dps!));
      const n = ok1.length;
      const d2 = a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0);
      spearman = 1 - (6 * d2) / (n * (n * n - 1));
      const best = ok1.reduce((x, y) => (y.dps! > x.dps! ? y : x));
      bestQuickScoreRank = ev.scored.indexOf(best.sc) + 1;
    }

    // ⑤ 多い回数（山登りで見つけたものも含める。上位は偶然に良かったものも混じるので、多めの回数で確かめ直す）
    const stage2 = [...okAll].sort((x, y) => y.dps! - x.dps!).slice(0, Math.max(1, settings.keep2)).map(r => r.sc);
    const r2 = (await mapLimit(stage2, settings.runs2, 'verify')).filter(r => r.dps !== undefined);
    if (cancelled()) return { status: 'cancelled' };
    if (r2.length === 0) return { status: 'error', message: 'ALL_FAILED' };
    const results: SearchResultItem[] = r2
      .map(r => ({ candidate: r.sc.candidate, dps: r.dps!, sd: r.sd!, totalSeconds: r.sc.totalSeconds, score: r.sc.score }))
      .sort((x, y) => y.dps - x.dps);
    return {
      status: 'ok', results, elapsedMs: Date.now() - t0, spearman, bestQuickScoreRank, groupBest: [...groupBestMap.values()],
      counts: { candidates: candidates.length, rejected: ev.rejected, rejectedBy: ev.rejectedBy, scored: ev.scored.length, quick: r1.length, quickOk: okAll.length, quickFailed },
    };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/** 候補の出場を、アプリの出場（Stint）として置けるよう、ID をつけ直す（保存データの ID と重ならないように） */
export function stintsForApp(stints: Stint[]): Stint[] {
  const stamp = Date.now().toString(36);
  let n = 0;
  return stints.map(s => ({ ...s, id: `stint_auto_${stamp}_${n++}`, actions: s.actions.map(a => ({ ...a, id: `act_auto_${stamp}_${n++}` })) }));
}
