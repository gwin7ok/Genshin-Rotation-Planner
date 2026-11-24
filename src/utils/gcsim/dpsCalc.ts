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
import { type EnemyParticles, type TimedParticle } from './requiredEnergyRecharge';
import { makeDamageFactor, type EnemyStateWindow } from './enemyStates';

/** 周数の既定・上限 */
export const DPS_DEFAULT_LOOPS = 3; // DPS 計算・探索の周数の既定（ER 計算と同じ 3）
export const DPS_MAX_LOOPS = 20;
/** 実行回数（種の数）の既定・上限 */
export const DPS_DEFAULT_RUNS = 100;
export const DPS_MAX_RUNS = 1000;
/** 敵の数の上限 */
export const DPS_MAX_ENEMIES = 4;

/** 幽境モードの DPS 計算で、設定文に足す条件（画面からは外した。エネルギーを考慮するときは、開始エネルギー 0 と時刻指定の粒子） */
export interface DpsAbyssRun {
  startEnergyZero: boolean;
  timedParticles: TimedParticle[];
}

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

/**
 * 幽境モードの集計の条件（フェーズ8。段階 4）。無ければ、従来どおり（時間の区切りも補正もなし）。
 * - battleSeconds: 戦闘時間。この時刻までのダメージ・爆発待ちだけを数え、DPS = ダメージ ÷ 戦闘時間（ローテーションが終わるのが早いときは、終わった時刻）
 * - enemyStates・enemies: 敵の状態の時間帯の補正（enemyStates.ts）。enemies は、補正の元になる耐性
 */
export interface DamageContext {
  battleSeconds?: number;
  /** この時刻（フレーム）より前のエネルギー待ちは、数えない（幽境モード: 初動の分を除き、ループの分だけ数える） */
  waitsFromFrame?: number;
  enemyStates?: EnemyStateWindow[];
  enemies?: EnemySetting[];
}

/** 1 回の実行の集計 */
export interface DpsRun {
  /** 総ダメージ（敵の状態の時間帯の補正後） */
  total: number;
  /** 敵の状態の時間帯の補正で増減したダメージ（補正後 − 補正前。マイナス = 減った。補正が無ければ 0） */
  stateAdjust: number;
  /** 戦闘時間まで、ローテーションが続かなかった（戦闘時間を指定したときだけ。true = 終わるのが早かった） */
  short: boolean;
  /** 経過時間（秒） */
  seconds: number;
  /** キャラ別のダメージ（char_index の順） */
  byChar: number[];
  /** キャラ別の、爆発のエネルギー待ちの回数（char_index の順。爆発がエネルギー不足で撃てず、待った回数） */
  energyWaits: number[];
  /** キャラ別の、爆発のエネルギー待ちに使ったフレーム数の合計（char_index の順。待ちの間の、爆発の CT が明けているフレームだけ。CT 待ちは含めない） */
  energyWaitFrames: number[];
  /** 始まったローテーションの周数（設定文の `print("loop ", i)` の数）。設定の周数より少なければ、時間内に終わらず打ち切られている */
  loopsStarted: number;
  /** 発生した粒子の数（全員分。敵から出る粒子を含む。ログは、パーティの全員に 1 件ずつ出るので、先頭のキャラの分だけ数える） */
  particles: number;
  /** うち、敵から出る粒子（gcsim の `energy every`。ログの source が `drop`） */
  particlesEnemy: number;
  /** 粒子から受け取ったエネルギーの、全員の合計（元素チャージ効率を掛ける前 = ログの `amt` ÷ `ER`。粒子の色・出ているキャラ・控えの減りを、すべて反映した値） */
  particleEnergy: number;
  /** キャラ別（char_index の順）の、粒子から受け取ったエネルギー（ER 反映前） */
  particleEnergyByChar: number[];
}

/**
 * ログから 1 回分を集計する。char_index が範囲外のダメージは、総ダメージにだけ入れる */
export function summarizeDamage(logs: GcsimLogEvent[], memberCount: number, context?: DamageContext): DpsRun {
  const battleFrames = context?.battleSeconds !== undefined && Number.isFinite(context.battleSeconds) && context.battleSeconds > 0 ? Math.round(context.battleSeconds * GCSIM_FPS) : undefined;
  const factorOf = makeDamageFactor(context?.enemyStates, context?.enemies);
  let stateAdjust = 0;
  const byChar = new Array<number>(memberCount).fill(0);
  const energyWaits = new Array<number>(memberCount).fill(0);
  const energyWaitFrames = new Array<number>(memberCount).fill(0);
  // 爆発のエネルギー待ち: gcsim は、撃てない爆発を毎フレーム「could not execute burst; action not ready」と記録する（CT 待ちも同じ）。
  // 連続したフレームを 1 回の待ちとし、その間に、爆発の CT が明けている（CT 中でない）フレームがあれば、エネルギー待ちと数える。
  // 待ち時間は、その待ちの中の、CT が明けているフレームの数（同じフレームの重複ログは 1 フレーム）。CT 待ちの部分は含めない
  const burstCd = new Array<boolean>(memberCount).fill(false);
  const waitLast = new Array<number>(memberCount).fill(-2);
  const waitIsEnergy = new Array<boolean>(memberCount).fill(false);
  const waitFrames = new Array<number>(memberCount).fill(0);
  const waitCounted = new Array<number>(memberCount).fill(-1);
  const closeWait = (i: number) => {
    if (waitIsEnergy[i]) { energyWaits[i]++; energyWaitFrames[i] += waitFrames[i]; }
    waitIsEnergy[i] = false;
    waitFrames[i] = 0;
  };
  let total = 0;
  let endFrame = 0;
  let loopsStarted = 0;
  let particles = 0;
  let particlesEnemy = 0;
  let particleEnergy = 0;
  const particleEnergyByChar = new Array<number>(memberCount).fill(0);
  for (const l of logs) {
    if (l.event === 'user') {
      if (/^loop \d+$/.test(l.msg)) loopsStarted++;
    } else if (l.event === 'damage') {
      const raw = Number((l.logs as { damage?: unknown } | undefined)?.damage);
      if (!Number.isFinite(raw)) continue;
      if (l.frame > endFrame) endFrame = l.frame;
      // 戦闘時間より後のダメージは数えない
      if (battleFrames !== undefined && l.frame > battleFrames) continue;
      const lg = l.logs as { ele?: unknown; target?: unknown } | undefined;
      const d = raw * factorOf(l.frame, lg?.ele, lg?.target);
      stateAdjust += d - raw;
      total += d;
      if (l.char_index !== undefined && l.char_index >= 0 && l.char_index < memberCount) byChar[l.char_index] += d;
    } else if (l.event === 'energy' && l.msg === 'particle') {
      if (battleFrames !== undefined && l.frame > battleFrames) continue;
      const lg = l.logs as { count?: unknown; source?: unknown; amt?: unknown; ER?: unknown } | undefined;
      // 受け取ったエネルギー（ER を掛ける前）: 全員の分を足す（粒子の色の一致・控えの減りが入る）
      const amt = Number(lg?.amt);
      const er = Number(lg?.ER);
      if (Number.isFinite(amt) && Number.isFinite(er) && er > 0) {
        particleEnergy += amt / er;
        if (l.char_index !== undefined && l.char_index >= 0 && l.char_index < memberCount) particleEnergyByChar[l.char_index] += amt / er;
      }
      // 1 回の粒子は、パーティの全員に 1 件ずつ記録される。個数は、先頭のキャラ（char_index 0）の分だけ数える
      if (l.char_index !== 0) continue;
      const n = Number(lg?.count);
      if (!Number.isFinite(n)) continue;
      particles += n;
      if (lg?.source === 'drop') particlesEnemy += n;
    } else if (l.event === 'action' && l.msg.startsWith('executed ') && l.frame > endFrame) {
      endFrame = l.frame;
    } else if (l.event === 'cooldown' && l.char_index !== undefined && l.char_index >= 0 && l.char_index < memberCount) {
      if (l.msg === 'burst cooldown triggered') burstCd[l.char_index] = true;
      else if (l.msg === 'burst cooldown ready') burstCd[l.char_index] = false;
    } else if (l.event === 'sim' && l.msg.startsWith('could not execute burst') && l.char_index !== undefined && l.char_index >= 0 && l.char_index < memberCount) {
      if (battleFrames !== undefined && l.frame > battleFrames) continue;
      if (context?.waitsFromFrame !== undefined && l.frame < context.waitsFromFrame) continue;
      const i = l.char_index;
      if (l.frame !== waitLast[i] && l.frame !== waitLast[i] + 1) closeWait(i);
      waitLast[i] = l.frame;
      if (!burstCd[i]) {
        waitIsEnergy[i] = true;
        if (l.frame !== waitCounted[i]) { waitFrames[i]++; waitCounted[i] = l.frame; }
      }
    }
  }
  for (let i = 0; i < memberCount; i++) closeWait(i);
  // 戦闘時間を指定したとき: 時間は戦闘時間（それより早く終わったときは、終わった時刻）
  const short = battleFrames !== undefined && endFrame < battleFrames;
  const seconds = (battleFrames !== undefined ? Math.min(endFrame, battleFrames) : endFrame) / GCSIM_FPS;
  return { total, stateAdjust, short, seconds, byChar, energyWaits, energyWaitFrames, loopsStarted, particles, particlesEnemy, particleEnergy, particleEnergyByChar };
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
  byChar: {
    damage: number; dps: number; share: number;
    /** 1 回の実行あたりの、爆発のエネルギー待ちの回数の平均 */
    energyWaits: number;
    /** 爆発のエネルギー待ち 1 回あたりの平均の待ち時間（秒）。全実行の待ち時間の合計 ÷ 全実行の待ちの回数。待ちが 1 回も無ければ null */
    energyWaitSeconds: number | null;
  }[];
  /** 全員の、1 回の実行あたりの爆発のエネルギー待ちの回数の平均 */
  energyWaits: number;
  /** 全員の、爆発のエネルギー待ち 1 回あたりの平均の待ち時間（秒）。待ちが 1 回も無ければ null */
  energyWaitSeconds: number | null;
  /** 設定の周数より少ない周数で打ち切られた実行（count = その実行の数・worst = 最も短かった実行の周数）。無ければ undefined */
  truncated?: { count: number; worst: number };
  /** 敵の状態の時間帯の補正で増減したダメージの平均（1 回の実行あたり。マイナス = 減った。補正が無ければ 0）。総ダメージは補正後 */
  stateAdjust: number;
  /** 発生した粒子の数の平均（1 回の実行あたり。全員分・敵の粒子を含む）と、そのうち敵から出る粒子 */
  particles: { total: number; enemy: number; /** 粒子から受け取ったエネルギーの全員の合計（ER 反映前）の平均 */ energy: number; /** キャラ別（char_index の順）の平均 */ energyByChar: number[] };
  /** 戦闘時間まで、ローテーションが続かなかった実行の数（戦闘時間を指定したときだけ。無ければ undefined） */
  shortRuns?: number;
}

/** 待ち 1 回あたりの平均の待ち時間（秒）。全実行の合計フレーム ÷ 全実行の合計回数（実行ごとの平均の平均にはしない）。待ちが 1 回も無ければ null */
const waitSecondsOf = (frames: number, count: number): number | null => (count > 0 ? frames / GCSIM_FPS / count : null);

/** 実行ごとの集計から、結果を作る */
export function aggregateDps(runs: DpsRun[], memberCount: number, loops?: number): DpsResult {
  const valid = runs.filter(r => r.seconds > 0);
  const cut = loops === undefined ? [] : valid.filter(r => r.loopsStarted < loops);
  const dps = statsOf(valid.map(r => r.total / r.seconds));
  const total = statsOf(valid.map(r => r.total));
  const seconds = valid.length ? valid.reduce((a, r) => a + r.seconds, 0) / valid.length : 0;
  const meanTotal = total.mean;
  // エネルギー待ち: キャラごとの、全実行の合計（回数・フレーム数）。平均の待ち時間は、この合計から出す
  const waitCounts = Array.from({ length: memberCount }, (_, i) => valid.reduce((a, r) => a + (r.energyWaits?.[i] ?? 0), 0));
  const waitFrames = Array.from({ length: memberCount }, (_, i) => valid.reduce((a, r) => a + (r.energyWaitFrames?.[i] ?? 0), 0));
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const byChar = Array.from({ length: memberCount }, (_, i) => {
    const damage = valid.length ? valid.reduce((a, r) => a + (r.byChar[i] ?? 0), 0) / valid.length : 0;
    const cdps = valid.length ? valid.reduce((a, r) => a + (r.byChar[i] ?? 0) / r.seconds, 0) / valid.length : 0;
    const energyWaits = valid.length ? waitCounts[i] / valid.length : 0;
    return { damage, dps: cdps, share: meanTotal > 0 ? damage / meanTotal : 0, energyWaits, energyWaitSeconds: waitSecondsOf(waitFrames[i], waitCounts[i]) };
  });
  const shortRuns = valid.filter(r => r.short).length;
  return {
    runs: valid.length, dps, total, seconds, byChar,
    energyWaits: byChar.reduce((a, c) => a + c.energyWaits, 0), energyWaitSeconds: waitSecondsOf(sum(waitFrames), sum(waitCounts)),
    ...(cut.length > 0 ? { truncated: { count: cut.length, worst: Math.min(...cut.map(r => r.loopsStarted)) } } : {}),
    stateAdjust: valid.length ? valid.reduce((a, r) => a + (r.stateAdjust ?? 0), 0) / valid.length : 0,
    particles: { total: valid.length ? valid.reduce((a, r) => a + (r.particles ?? 0), 0) / valid.length : 0, enemy: valid.length ? valid.reduce((a, r) => a + (r.particlesEnemy ?? 0), 0) / valid.length : 0, energy: valid.length ? valid.reduce((a, r) => a + (r.particleEnergy ?? 0), 0) / valid.length : 0, energyByChar: Array.from({ length: memberCount }, (_, i) => valid.length ? valid.reduce((a, r) => a + (r.particleEnergyByChar?.[i] ?? 0), 0) / valid.length : 0) },
    ...(shortRuns > 0 ? { shortRuns } : {}),
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
  /** 幽境モード: 戦闘時間・敵の状態の時間帯の補正（無ければ、従来どおり） */
  context?: DamageContext;
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
      collected.push(summarizeDamage(r.logs, config.members.length, args.context));
    }
    args.onProgress?.({ done: collected.length, total: runs, partial: aggregateDps(collected, config.members.length, args.loops) });
  }
  return { status: 'ok', result: aggregateDps(collected, config.members.length, args.loops), members: config.members };
}
