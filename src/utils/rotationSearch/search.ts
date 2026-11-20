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

const DEFAULT_REFINE_BUDGET = 360;
/** 探索中（④④b）の戦闘時間の上限（秒） */
const EXPLORE_SECONDS = 60;
/** 山登りの 1 回で試す近傍の数の上限 */
const REFINE_BATCH = 70;
/** 山登りの先行 1 回の足切り（いまの最良に対する割合） */
const REFINE_PREFILTER = 0.85;

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = { battleSeconds: 60, keep1: 30, runs1: 3, keep2: 6, runs2: 10, maxCandidates: 20000 };

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
  | { status: 'ok'; results: SearchResultItem[]; counts: SearchCounts; elapsedMs: number; spearman?: number; bestQuickScoreRank?: number }
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
    const ev = evaluateCandidates(characters, candidates, { switchDelay: args.switchDelay, defHalt: args.defHalt });
    if (ev.scored.length === 0) return { status: 'error', message: 'NO_VALID_CANDIDATES' };
    if (cancelled()) return { status: 'cancelled' };

    // 1 候補ぶんの gcsim 実行。同時に動かす候補の数 = コア数 ÷ 1 候補の並列数
    const runOne = async (sc: ScoredCandidate, runs: number, parallel: number, seconds: number): Promise<QuickRun> => {
      const cfg = buildGcsimConfig({
        characters, stints: sc.candidate.stints, loopStartIndex: 0, switchDelay: args.switchDelay, defHalt: args.defHalt,
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
    const r1 = await mapLimit(ev.scored.slice(0, Math.max(1, settings.keep1) * 3), settings.runs1, 'quick', Math.max(1, settings.keep1), exploreSeconds);
    if (cancelled()) return { status: 'cancelled' };
    const ok1 = r1.filter(r => r.dps !== undefined);
    const quickFailed: Record<string, number> = {};
    for (const r of r1) if (r.dps === undefined) quickFailed[r.error ?? '?'] = (quickFailed[r.error ?? '?'] ?? 0) + 1;
    if (ok1.length === 0) return { status: 'error', message: Object.keys(quickFailed)[0] ?? 'ALL_FAILED' };

    // ④b 山登り: gcsim の結果が一番良い候補（上位 2 つ）から、1 か所だけ変えた候補（出場の入れ替え・動作の消去・移動・差し込み）を全部試し、良くなったらそこへ移る。
    //   簡易スコアが外れても、良い形に寄っていける（手で組んだ例と同じ DPS の形まで、実測で到達した）
    const budget = settings.refineBudget ?? DEFAULT_REFINE_BUDGET;
    const bestOf = () => r1.reduce((m, r) => (r.dps !== undefined ? Math.max(m, r.dps) : m), 0);
    if (budget > 0 && !cancelled()) {
      const tried = new Set<string>(r1.map(r => r.sc.candidate.label));
      let used = 0;
      args.onProgress?.({ phase: 'refine', done: 0, total: budget });
      let stale = 0;
      for (let round = 0; round < 12 && used < budget && !cancelled(); round++) {
        const frontier = r1.filter(r => r.dps !== undefined).sort((x, y) => y.dps! - x.dps!).slice(0, 2);
        const pool = new Map<string, Candidate>();
        for (const f of frontier) for (const n of neighborsOf(characters, f.sc.candidate)) if (!tried.has(n.label)) pool.set(n.label, n);
        if (pool.size === 0) break;
        const ev2 = evaluateCandidates(characters, [...pool.values()], { switchDelay: args.switchDelay, defHalt: args.defHalt });
        for (const c of pool.keys()) tried.add(c);
        const batch = ev2.scored.slice(0, Math.min(REFINE_BATCH, budget - used));
        if (batch.length === 0) break;
        const before = bestOf();
        // 先に 1 回だけ回して、明らかに悪い候補（いまの最良の 85% 未満）を落とし、残りだけ決めた回数で測り直す（1 回の値は、ばらつきが大きいので、落とす基準は緩め）
        const first = await mapLimit(batch, 1, 'refine', batch.length, exploreSeconds);
        const keepSc = first.filter(r => r.dps !== undefined && r.dps >= before * REFINE_PREFILTER).map(r => r.sc);
        const rr = settings.runs1 <= 1 ? first : await mapLimit(keepSc, settings.runs1, 'refine', keepSc.length, exploreSeconds);
        used += batch.length;
        args.onProgress?.({ phase: 'refine', done: Math.min(used, budget), total: budget });
        r1.push(...rr);
        // 良くならない回が 2 回続いたら終わり
        stale = bestOf() > before * 1.003 ? 0 : stale + 1;
        if (stale >= 2) break;
      }
    }
    if (cancelled()) return { status: 'cancelled' };
    const okAll = r1.filter(r => r.dps !== undefined);

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
      status: 'ok', results, elapsedMs: Date.now() - t0, spearman, bestQuickScoreRank,
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
