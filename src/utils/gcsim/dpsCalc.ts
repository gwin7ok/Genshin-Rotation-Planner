/**
 * DPS（秒間ダメージ）計算（D343）。
 * gcsim の詳細ログ（/sample）の `damage` イベントを集計する。種を変えて複数回実行し、平均とばらつきを出す。
 *
 * - 時間: 初動 + ループ N 周（設定文の loopIterations = N）。0 フレームから、最後のアクションの開始・最後のダメージのうち遅いほうまで
 * - 総ダメージ: すべての敵へのダメージ（反応・追加ダメージを含む）の合計。キャラ別は、ログの char_index（設定文のキャラの並び）で分ける
 * - 爆発のエネルギー: 既定は考慮する（足りない爆発は、溜まるまで待つ。敵の粒子は設定）。切ると、アプリの計算と同じく無視する（`ignore_burst_energy=true`）
 */
import type { GcsimConfigResult, EnemySetting } from './buildGcsimConfig';
import type { GcsimLogEvent, GcsimSampleResult } from './gcsimClient';
import { GCSIM_FPS } from './readGcsimLog';
import type { EnemyParticles } from './requiredEnergyRecharge';

/** 周数の既定・上限 */
export const DPS_DEFAULT_LOOPS = 5;
export const DPS_MAX_LOOPS = 20;
/** 実行回数（種の数）の既定・上限 */
export const DPS_DEFAULT_RUNS = 100;
export const DPS_MAX_RUNS = 1000;
/** 敵の数の上限 */
export const DPS_MAX_ENEMIES = 4;

/** 画面の入力（保存する） */
export interface DpsSettings {
  loops: number;
  runs: number;
  enemies: EnemySetting[];
  /** 爆発のエネルギーを考慮するか（既定 true。false = 爆発をいつでも撃てる理想の場合。`ignore_burst_energy=true`） */
  energy: boolean;
  /** 敵から出る粒子（エネルギーを考慮するときだけ使う。個数 0 = 出さない） */
  particles: EnemyParticles;
}

/** 1 回の実行の集計 */
export interface DpsRun {
  /** 総ダメージ */
  total: number;
  /** 経過時間（秒） */
  seconds: number;
  /** キャラ別のダメージ（char_index の順） */
  byChar: number[];
  /** キャラ別の、爆発のエネルギー待ちの回数（char_index の順。爆発がエネルギー不足で撃てず、待った回数） */
  energyWaits: number[];
  /** 始まったローテーションの周数（設定文の `print("loop ", i)` の数）。設定の周数より少なければ、時間内に終わらず打ち切られている */
  loopsStarted: number;
}

/**
 * ログから 1 回分を集計する。char_index が範囲外のダメージは、総ダメージにだけ入れる */
export function summarizeDamage(logs: GcsimLogEvent[], memberCount: number): DpsRun {
  const byChar = new Array<number>(memberCount).fill(0);
  const energyWaits = new Array<number>(memberCount).fill(0);
  // 爆発のエネルギー待ち: gcsim は、撃てない爆発を毎フレーム「could not execute burst; action not ready」と記録する（CT 待ちも同じ）。
  // 連続したフレームを 1 回の待ちとし、その間に、爆発の CT が明けている（CT 中でない）フレームがあれば、エネルギー待ちと数える
  const burstCd = new Array<boolean>(memberCount).fill(false);
  const waitLast = new Array<number>(memberCount).fill(-2);
  const waitIsEnergy = new Array<boolean>(memberCount).fill(false);
  const closeWait = (i: number) => { if (waitIsEnergy[i]) energyWaits[i]++; waitIsEnergy[i] = false; };
  let total = 0;
  let endFrame = 0;
  let loopsStarted = 0;
  for (const l of logs) {
    if (l.event === 'user') {
      if (/^loop \d+$/.test(l.msg)) loopsStarted++;
    } else if (l.event === 'damage') {
      const d = Number((l.logs as { damage?: unknown } | undefined)?.damage);
      if (!Number.isFinite(d)) continue;
      total += d;
      if (l.char_index !== undefined && l.char_index >= 0 && l.char_index < memberCount) byChar[l.char_index] += d;
      if (l.frame > endFrame) endFrame = l.frame;
    } else if (l.event === 'action' && l.msg.startsWith('executed ') && l.frame > endFrame) {
      endFrame = l.frame;
    } else if (l.event === 'cooldown' && l.char_index !== undefined && l.char_index >= 0 && l.char_index < memberCount) {
      if (l.msg === 'burst cooldown triggered') burstCd[l.char_index] = true;
      else if (l.msg === 'burst cooldown ready') burstCd[l.char_index] = false;
    } else if (l.event === 'sim' && l.msg.startsWith('could not execute burst') && l.char_index !== undefined && l.char_index >= 0 && l.char_index < memberCount) {
      const i = l.char_index;
      if (l.frame !== waitLast[i] && l.frame !== waitLast[i] + 1) closeWait(i);
      waitLast[i] = l.frame;
      if (!burstCd[i]) waitIsEnergy[i] = true;
    }
  }
  for (let i = 0; i < memberCount; i++) closeWait(i);
  return { total, seconds: endFrame / GCSIM_FPS, byChar, energyWaits, loopsStarted };
}

export interface DpsStats {
  mean: number;
  /** 標準偏差（母集団） */
  sd: number;
  min: number;
  max: number;
}

const statsOf = (xs: number[]): DpsStats => {
  if (xs.length === 0) return { mean: 0, sd: 0, min: 0, max: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { mean, sd, min: Math.min(...xs), max: Math.max(...xs) };
};

export interface DpsResult {
  runs: number;
  /** 全体の DPS（実行ごとの 総ダメージ ÷ 時間 の統計） */
  dps: DpsStats;
  /** 総ダメージの統計 */
  total: DpsStats;
  /** 経過時間（秒）の平均 */
  seconds: number;
  /** キャラ別（char_index の順）: ダメージの平均・DPS の平均・全体に占める割合（平均ダメージの比） */
  byChar: { damage: number; dps: number; share: number; /** 1 回の実行あたりの、爆発のエネルギー待ちの回数の平均 */ energyWaits: number }[];
  /** 全員の、1 回の実行あたりの爆発のエネルギー待ちの回数の平均 */
  energyWaits: number;
  /** 設定の周数より少ない周数で打ち切られた実行（count = その実行の数・worst = 最も短かった実行の周数）。無ければ undefined */
  truncated?: { count: number; worst: number };
}

/** 実行ごとの集計から、結果を作る */
export function aggregateDps(runs: DpsRun[], memberCount: number, loops?: number): DpsResult {
  const valid = runs.filter(r => r.seconds > 0);
  const cut = loops === undefined ? [] : valid.filter(r => r.loopsStarted < loops);
  const dps = statsOf(valid.map(r => r.total / r.seconds));
  const total = statsOf(valid.map(r => r.total));
  const seconds = valid.length ? valid.reduce((a, r) => a + r.seconds, 0) / valid.length : 0;
  const meanTotal = total.mean;
  const byChar = Array.from({ length: memberCount }, (_, i) => {
    const damage = valid.length ? valid.reduce((a, r) => a + (r.byChar[i] ?? 0), 0) / valid.length : 0;
    const cdps = valid.length ? valid.reduce((a, r) => a + (r.byChar[i] ?? 0) / r.seconds, 0) / valid.length : 0;
    const energyWaits = valid.length ? valid.reduce((a, r) => a + (r.energyWaits?.[i] ?? 0), 0) / valid.length : 0;
    return { damage, dps: cdps, share: meanTotal > 0 ? damage / meanTotal : 0, energyWaits };
  });
  return {
    runs: valid.length, dps, total, seconds, byChar, energyWaits: byChar.reduce((a, c) => a + c.energyWaits, 0),
    ...(cut.length > 0 ? { truncated: { count: cut.length, worst: Math.min(...cut.map(r => r.loopsStarted)) } } : {}),
  };
}

export interface DpsProgress {
  done: number;
  total: number;
  /** ここまでに終えた実行の平均（計算中の途中経過。まだ 1 回も終えていなければ無い） */
  partial?: DpsResult;
}

export type DpsOutcome =
  | { status: 'ok'; result: DpsResult; members: GcsimConfigResult['members'] }
  | { status: 'error' | 'unreachable'; message: string }
  | { status: 'cancelled' };

/** 設定文を、種 1〜runs で実行して集計する（parallel 個ずつ同時に）。1 回でも失敗したら、そのメッセージを返す */
export async function computeDps(args: {
  config: GcsimConfigResult;
  runs: number;
  /** ローテーションの周数（設定文の loopIterations）。渡すと、これより少ない周数で打ち切られた実行を数える */
  loops?: number;
  parallel: number;
  run: (config: string, seed: number) => Promise<GcsimSampleResult>;
  onProgress?: (p: DpsProgress) => void;
  shouldCancel?: () => boolean;
}): Promise<DpsOutcome> {
  const { config, run } = args;
  if (!config.runnable) return { status: 'error', message: '' };
  const parallel = Math.max(1, Math.floor(args.parallel));
  const runs = Math.max(1, Math.floor(args.runs));
  const collected: DpsRun[] = [];
  args.onProgress?.({ done: 0, total: runs });
  for (let start = 1; start <= runs; start += parallel) {
    if (args.shouldCancel?.()) return { status: 'cancelled' };
    const seeds = Array.from({ length: Math.min(parallel, runs - start + 1) }, (_, i) => start + i);
    const results = await Promise.all(seeds.map(seed => run(config.config, seed)));
    for (const r of results) {
      if (r.status !== 'ok') return { status: r.status, message: r.message };
      collected.push(summarizeDamage(r.logs, config.members.length));
    }
    args.onProgress?.({ done: collected.length, total: runs, partial: aggregateDps(collected, config.members.length, args.loops) });
  }
  return { status: 'ok', result: aggregateDps(collected, config.members.length, args.loops), members: config.members };
}
