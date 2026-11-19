/**
 * 爆発のタイミングの確認（フェーズ8 段階 2。幽境モード）。
 *
 * 「いまのビルド」（編成・装備のまま。ER を足さない）で、開始エネルギー 0 から、決めた周数（時間の制限なし）だけ回し、
 * 各爆発が、計画した時刻（爆発のエネルギーを無視して回した実行の、爆発の時刻）より何秒遅れるかを、種ごとに調べる。
 * ER の算出（requiredEnergyRecharge.ts）の結果は使わない。画面の「繰り返しの位置の爆発が毎回撃てるか」の確認に使う。
 *
 * あわせて、爆発のエネルギー待ち（爆発の CT が明けているのに、エネルギーが足りず、粒子が入るまで待った回数と時間）を、
 * ループ 1 周あたりの回数と、1 回あたりの平均の待ち時間で出す（初動の分は数えない）。
 *
 * 遅れは、計画との差。前の爆発が遅れると、後ろの行動も同じだけずれるので、遅れは積み上がる。
 */
import { summarizeDamage } from './dpsCalc';
import {
  burstSignature,
  plannedBurstFrames,
  type AbyssRunCondition,
  type BuildForEr,
  type EnemyParticles,
  type RunSample,
} from './requiredEnergyRecharge';

/** この秒数以内の遅れは、「計画どおり」とする */
export const BURST_TIMING_ON_TIME_SECONDS = 0.5;

/** 1 種分の、1 回の爆発。delay = 計画からの遅れ（フレーム）。時間内に撃てなかったときは null */
export interface BurstDelay {
  planned: number;
  delay: number | null;
}

/** 1 回目・2 回目…の爆発ごとの、種をまとめた結果 */
export interface BurstTimingBurst {
  /** 何回目の爆発か（1 始まり） */
  n: number;
  /** 計画した時刻（秒。種の中央値） */
  plannedSeconds: number;
  /** 遅れ（秒）の中央値・最大（撃てた種の中で。撃てた種が無ければ null） */
  delayMedianSeconds: number | null;
  delayMaxSeconds: number | null;
  /** 計画どおり（遅れが BURST_TIMING_ON_TIME_SECONDS 以内）に撃てた種の数 */
  onTime: number;
  /** 時間内に撃てなかった種の数 */
  missed: number;
  /** 数えた種の数 */
  total: number;
}

export interface BurstTimingEntry {
  characterId: string;
  name: string;
  bursts: BurstTimingBurst[];
}

/** 爆発のエネルギー待ち（ループの分だけ。全ての種の平均） */
export interface BurstEnergyWait {
  characterId: string;
  name: string;
  /** ループ 1 周あたりの待ちの回数 */
  perLoop: number;
  /** 待ち 1 回あたりの平均の待ち時間（秒。CT 待ちは含まない）。待ちが 1 回も無ければ null */
  avgSeconds: number | null;
}

export interface BurstTimingResult {
  ranAt: number;
  seeds: number;
  /** ループ部分を回した周数 */
  loops: number;
  entries: BurstTimingEntry[];
  /** キャラ別の、爆発のエネルギー待ち（編成の全員。爆発を撃たないキャラは 0） */
  waits: BurstEnergyWait[];
  /** 全員の合計の、ループ 1 周あたりの待ちの回数・待ち 1 回あたりの平均の待ち時間 */
  waitsTotal: { perLoop: number; avgSeconds: number | null };
}

/** 種ごとの実行ログから、爆発のエネルギー待ちを、キャラごとにまとめる（ループが始まる前の分は数えない） */
export function summarizeEnergyWaits(runs: { logs: Parameters<typeof summarizeDamage>[0] }[], members: { characterId: string; name: string }[], loops: number): { waits: BurstEnergyWait[]; total: { perLoop: number; avgSeconds: number | null } } {
  const counts = new Array<number>(members.length).fill(0);
  const frames = new Array<number>(members.length).fill(0);
  for (const r of runs) {
    const loop1 = r.logs.find(l => l.event === 'user' && l.msg === 'loop 1')?.frame;
    const d = summarizeDamage(r.logs, members.length, loop1 !== undefined ? { waitsFromFrame: loop1 } : undefined);
    d.energyWaits.forEach((n, i) => { counts[i] += n; });
    d.energyWaitFrames.forEach((n, i) => { frames[i] += n; });
  }
  const n = Math.max(1, runs.length) * Math.max(1, loops);
  const avg = (c: number, f: number): number | null => (c > 0 ? f / 60 / c : null);
  const waits = members.map((m, i) => ({ characterId: m.characterId, name: m.name, perLoop: counts[i] / n, avgSeconds: avg(counts[i], frames[i]) }));
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return { waits, total: { perLoop: sum(counts) / n, avgSeconds: avg(sum(counts), sum(frames)) } };
}

export type BurstTimingOutcome =
  | { status: 'ok'; result: BurstTimingResult }
  | { status: 'cancelled' }
  | { status: 'error' | 'unreachable'; message: string };

/**
 * 1 種分: 基準の爆発の並びと、試験の爆発の並び（`キャラ@フレーム`）から、キャラごと・爆発の順ごとの、計画した時刻と遅れを求める。
 * 計画した時刻が limitFrame を超える爆発は数えない。試験に、同じ順の爆発が無いとき（時間内に撃てなかった）は、遅れは null
 */
export function burstDelays(baselineSig: string, testSig: string, limitFrame = Infinity): Map<number, BurstDelay[]> {
  const planned = plannedBurstFrames(baselineSig);
  const actual = plannedBurstFrames(testSig);
  const out = new Map<number, BurstDelay[]>();
  for (const [c, frames] of planned) {
    const list: BurstDelay[] = [];
    frames.forEach((f, k) => {
      if (f > limitFrame) return;
      const a = actual.get(c)?.[k];
      list.push({ planned: f, delay: a === undefined ? null : a - f });
    });
    if (list.length > 0) out.set(c, list);
  }
  return out;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** 種ごとの結果（burstDelays）を、キャラ（members の並び = char_index）ごと・爆発の順ごとにまとめる。爆発のないキャラは含めない */
export function summarizeBurstTiming(perSeed: Map<number, BurstDelay[]>[], members: { characterId: string; name: string }[]): BurstTimingEntry[] {
  const onTimeFrames = Math.round(BURST_TIMING_ON_TIME_SECONDS * 60);
  const entries: BurstTimingEntry[] = [];
  members.forEach((m, c) => {
    const maxN = Math.max(0, ...perSeed.map(s => s.get(c)?.length ?? 0));
    if (maxN === 0) return;
    const bursts: BurstTimingBurst[] = [];
    for (let n = 0; n < maxN; n++) {
      const rows = perSeed.map(s => s.get(c)?.[n]).filter((x): x is BurstDelay => x !== undefined);
      if (rows.length === 0) continue;
      const delays = rows.map(r => r.delay).filter((d): d is number => d !== null);
      bursts.push({
        n: n + 1,
        plannedSeconds: median(rows.map(r => r.planned)) / 60,
        delayMedianSeconds: delays.length > 0 ? median(delays) / 60 : null,
        delayMaxSeconds: delays.length > 0 ? Math.max(...delays) / 60 : null,
        onTime: delays.filter(d => d <= onTimeFrames).length,
        missed: rows.length - delays.length,
        total: rows.length,
      });
    }
    entries.push({ characterId: m.characterId, name: m.name, bursts });
  });
  return entries;
}

/**
 * いまのビルド（added の分だけ ER を足せる。既定は足さない）で、爆発のタイミングを調べる。
 * 設定文は、ER の算出と同じ build で作る（幽境の条件を渡す）。基準（爆発のエネルギーを無視）と試験（いまのビルド）を、同じ種で実行して比べる
 */
export async function computeBurstTiming(args: {
  build: BuildForEr;
  enemyParticles?: EnemyParticles;
  /** 幽境の戦闘条件（開始エネルギー 0・時刻指定の粒子など）。通常モードは無し（開始エネルギーは満タン） */
  abyss?: AbyssRunCondition;
  /** 周回数（ループの周数） */
  loops: number;
  /** 足す ER（キャラ ID → 割合）。既定は足さない（いまのビルドのまま） */
  added?: Record<string, number>;
  /** 増減する ER（キャラ ID → 割合。マイナスで下げる）。今のステータスの上に足す */
  erDelta?: Record<string, number>;
  seeds: number;
  /** 同時に実行する種の数（既定 1） */
  parallel?: number;
  run: RunSample;
  shouldCancel?: () => boolean;
}): Promise<BurstTimingOutcome> {
  const { abyss, enemyParticles } = args;
  const base = args.build({ ignoreBurstEnergy: true, added: {}, loops: args.loops, enemyParticles, abyss });
  if (!base.runnable) return { status: 'error', message: base.warnings.filter(w => w.level === 'error').map(w => w.message).join(' / ') };
  const test = args.build({ ignoreBurstEnergy: false, added: args.added ?? {}, erDelta: args.erDelta, loops: args.loops, enemyParticles, abyss });
  const parallel = Math.max(1, Math.floor(args.parallel ?? 1));
  const seeds = Math.max(1, Math.floor(args.seeds));
  const perSeed: Map<number, BurstDelay[]>[] = [];
  const testRuns: { logs: Parameters<typeof summarizeDamage>[0] }[] = [];
  const all = Array.from({ length: seeds }, (_, i) => i + 1);
  for (let i = 0; i < all.length; i += parallel) {
    if (args.shouldCancel?.()) return { status: 'cancelled' };
    const chunk = all.slice(i, i + parallel);
    const results = await Promise.all(chunk.map(async seed => ({ b: await args.run(base.config, seed), t: await args.run(test.config, seed) })));
    for (const { b, t } of results) {
      if (b.status !== 'ok') return { status: b.status, message: b.message };
      if (t.status !== 'ok') return { status: t.status, message: t.message };
      perSeed.push(burstDelays(burstSignature(b.logs), burstSignature(t.logs)));
      testRuns.push({ logs: t.logs });
    }
  }
  const entries = summarizeBurstTiming(perSeed, base.members);
  const w = summarizeEnergyWaits(testRuns, base.members, args.loops);
  return { status: 'ok', result: { ranAt: Date.now(), seeds, loops: args.loops, entries, waits: w.waits, waitsTotal: w.total } };
}
