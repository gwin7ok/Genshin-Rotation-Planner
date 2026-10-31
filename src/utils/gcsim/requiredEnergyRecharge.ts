/**
 * 必要な元素チャージ効率（ER）の算出（フェーズ7 / issue #46。D242・D265・D266）
 *
 * ローテーションの全キャラの爆発が、毎周エネルギー待ちなしに出るための、キャラごとの ER を求める。
 * 純粋なロジック（gcsim の実行は run として受け取る）。画面は EnergyRechargeDialog、保存は appSettings.ts。
 *
 * 方式（docs/gcsim-integration/phase-7-required-er/plan.md）:
 *   1. 基準: `ignore_burst_energy=true` の実行の、爆発の実行（キャラ@フレーム）の並び（種ごと）
 *   2. 集計: 爆発のエネルギーを有効にし、全員を十分大きい ER にして実行（種ごとに 1 回）。ログの粒子（ER 100% 換算）・固定の回復・爆発の消費を、時系列で集める
 *      爆発のエネルギーに足りる ER を、ログの粒子（ER 100% 換算）と固定の回復から直接求める
 *        必要な ER(%) = (爆発のエネルギー − 固定の回復) ÷ 粒子の合計（ER 100% 換算）
 *   3. 3 段: 窓の分布の 70% = 目安 / 90% = 安定 / 100% = 確実（全ての窓で足りる）
 *   4. 確実の値を gcsim で確かめる（全員を確実の値にして、全種で爆発が基準と一致するか。足りなければ、上げ幅を倍々に増やして上げ、通ったあとは半分ずつに絞る）
 *   5. 確かめた値で実行し直し、そのときのエネルギーの出入りで、目安・安定を求め直す（他のキャラの ER で量が変わる回復 = 雷電将軍の爆発などへの対策）
 * 周数は ER_LOOP_ITERATIONS。粒子は乱数なので、最大（全窓）は周・種が増えるほど少しずつ上がる（最悪の窓を拾う）。目安・安定は、あまり動かない
 */
import { t } from '../../i18n';
import type { GcsimConfigResult } from './buildGcsimConfig';
import type { GcsimLogEvent, GcsimSampleResult } from './gcsimClient';

/**
 * ループを回す周数。エネルギーは 1〜2 周目に初期状態の影響が残り（初期エネルギーが満タン・スキルの CT など）、2 周では必要な ER が低く出る
 * （実測: ラウマ +15% → 5 周 +78%）。窓は、爆発の間（周数 − 1 個）。
 */
export const ER_LOOP_ITERATIONS = 4;
/** 立ち上がりとして数えない窓の数（最初の爆発から 2 回目の爆発まで。1 周目は粒子の入り方が 2 周目以降と違うため） */
export const ER_WARMUP_WINDOWS = 1;
/** 試す乱数の種の数（1 〜 この数）。粒子の出方は種で変わる */
export const ER_SEEDS = 10;
/** 探索の上限（足す分の割合。5 = +500%）。確実の値がこれを超えれば「届かない」 */
export const ER_MAX_ADDED = 5;
/** 他のキャラの ER（足す分。エネルギー不足で止まらない十分大きい値） */
const ER_OTHERS_ADDED = 10;
/** 確実の値が確かめで足りなかったときに、上げる幅（足す分の割合） */
const VERIFY_BUMP = 0.05;
/** 上げ幅の上限（倍々に増やしても、ここまで） */
const VERIFY_MAX_STEP = 0.4;
/** 確かめで、値を絞るのをやめる幅（足す分の割合）。概算 = 0.2（ER 20%）、精密 = 0.01（ER 1%。時間は 5 分前後延びる） */
export const ER_VERIFY_TOLERANCE_ROUGH = 0.2;
export const ER_VERIFY_TOLERANCE_PRECISE = 0.01;
/** 確かめの繰り返しの上限（無限ループの防止） */
const VERIFY_MAX_ROUNDS = 100;
/** 爆発の前に、エネルギーが貯まるのを待ってよい秒数の既定値（これ以内の遅れは「足りた」とみなす） */
export const ER_DEFAULT_BURST_WAIT_SECONDS = 1;
/** 同、フレーム数（60 フレーム = 1 秒） */
export const ER_BURST_DELAY_FRAMES = ER_DEFAULT_BURST_WAIT_SECONDS * 60;
/** 実行回数の見積り（基準 + 集計 + 確かめ。残り時間の推定に使う） */
const RUNS_ESTIMATE = ER_SEEDS * 6;

/** 敵から出る粒子（秒の間隔のランダム範囲と、1 回の個数。クリア粒子） */
export interface EnemyParticles {
  minSeconds: number;
  maxSeconds: number;
  amount: number;
}

/**
 * 敵の粒子の既定値: 5〜8 秒に 1 個（ユーザー決定 D269）。gcsim の公式ドキュメントの例は 8〜12 秒（`energy every interval=480,720 amount=1`）で、それより多め
 * 敵・結晶・ドロップなどの粒子をまとめた、ならした量。0 にすると敵の粒子なし
 */
export const ER_DEFAULT_ENEMY_PARTICLES: EnemyParticles = { minSeconds: 5, maxSeconds: 8, amount: 1 };

export interface RequiredErEntry {
  characterId: string;
  name: string;
  /**
   * ok = 求まった / unreachable = 確実の値が上限を超える・粒子が無い / noBurst = 周回の中に爆発が 2 回以上ない（窓が無い）
   */
  status: 'ok' | 'unreachable' | 'noBurst';
  /** 目安: 窓の中央値（必要な ER の合計 %。武器・聖遺物のサブステなどの分を含む） */
  typicalEr?: number;
  /** 安定: 爆発の 90% が足りる ER（%） */
  stableEr?: number;
  /** 確実: 全ての窓で足りる値（%。gcsim で確かめ済み） */
  certainEr?: number;
  /** 目安・安定・確実の値で、窓が足りる確率の推定（%）。試した窓での実際の割合。確実は、全窓が足りたとき N÷(N+1)（次の 1 窓が最大を超える確率が 1÷(N+1) のため） */
  typicalPct?: number;
  stablePct?: number;
  certainPct?: number;
  /** 確実の値の、仮ステータスに足す ER（割合） */
  addedEr?: number;
}

export interface RequiredErResult {
  /** 求めたときの gcsim のバージョン */
  gcsimVersion: string;
  /** 実行した日時（ミリ秒） */
  ranAt: number;
  /** 計算にかかった時間（ミリ秒） */
  elapsedMs?: number;
  /** 使った種の数 */
  seeds: number;
  /** 集計した窓の数（キャラごとの最大） */
  windows: number;
  /** 求めたときの敵の粒子の設定（古い保存には無い） */
  enemyParticles?: EnemyParticles;
  /** 精密（確かめを細かく絞った）で求めたか。古い保存・概算は無い */
  precise?: boolean;
  /** 爆発の前に待ってよいとした秒数（古い保存には無い。無いときは 0.5 秒だった） */
  burstWaitSeconds?: number;
  /** 求めたときの編成・ローテーションの指紋（今の設定文と比べて、変わっていないかを調べる） */
  fingerprint: string;
  entries: RequiredErEntry[];
}

export type RequiredErPhase = 'baseline' | 'collect' | 'verify';

export interface RequiredErProgress {
  phase: RequiredErPhase;
  /** gcsim の実行を終えた回数 */
  runsDone: number;
  /** 実行回数の見積り（残り時間の推定に使う） */
  runsExpected: number;
  /** 同時に実行する塊（Promise.all 1 回分。並列のときは 1 塊 = 並列数の実行）を終えた回数。残り時間は、塊の平均時間 × 残りの塊の数で出す */
  chunksDone: number;
  /** 残りの塊の数の見積り（最小〜最大。確かめは何回で収まるか分からないので、幅を持たせる） */
  chunksLeftLow: number;
  chunksLeftHigh: number;
}

export type RequiredErOutcome =
  | { status: 'ok'; result: RequiredErResult }
  | { status: 'cancelled' }
  | { status: 'error' | 'unreachable'; message: string };

export type BuildForEr = (extra: { ignoreBurstEnergy: boolean; added: Record<string, number>; enemyParticles?: EnemyParticles }) => GcsimConfigResult;
export type RunSample = (config: string, seed: number) => Promise<GcsimSampleResult>;

/** 設定文の短い指紋（変更の検出用。暗号用ではない） */
export function fingerprintOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${text.length}-${h.toString(16)}`;
}

/** ログの爆発の実行の並び（`キャラ@フレーム`） */
export function burstSignature(logs: GcsimLogEvent[]): string {
  return logs.filter(l => l.msg === 'executed burst').map(l => `${l.char_index}@${l.frame}`).join(',');
}

/** ログのキャラごとの ER の倍率（particle イベントの ER。最初の値）。char_index → 倍率 */
export function energyRechargeByCharIndex(logs: GcsimLogEvent[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const l of logs) {
    if (l.event !== 'energy' || l.msg !== 'particle' || l.char_index === undefined) continue;
    const er = Number(l.logs?.ER);
    if (Number.isFinite(er) && !out.has(l.char_index)) out.set(l.char_index, er);
  }
  return out;
}

/** キャラのエネルギーの出入り（ログの順）。粒子は ER 100% 換算 */
export interface EnergyTimeline {
  /** エネルギーの上限（爆発のエネルギー） */
  max: number;
  events: ({ kind: 'particle'; raw: number; frame: number } | { kind: 'flat'; amount: number; frame: number } | { kind: 'burst'; cost: number; frame: number })[];
}

/**
 * ログから、キャラごとのエネルギーの出入りを集める。
 * 粒子は `particle`（`amt` ÷ `ER` = ER 100% 換算）、固定の回復は `adding energy`（`rec'd` = 回復量。上限で切られる前の値）、
 * 爆発は `draining energy`（消費量 = `pre_drain − post_drain`。通常は上限 = 全部消費。ヴァレサの特殊爆発のように一部だけ消費する爆発もある）。
 */
export function collectEnergyTimelines(logs: GcsimLogEvent[]): Map<number, EnergyTimeline> {
  const out = new Map<number, EnergyTimeline>();
  for (const l of logs) {
    if (l.event !== 'energy' || l.char_index === undefined) continue;
    const tl = out.get(l.char_index) ?? { max: 0, events: [] };
    out.set(l.char_index, tl);
    const maxEnergy = Number(l.logs?.max_energy);
    if (Number.isFinite(maxEnergy) && maxEnergy > 0) tl.max = maxEnergy;
    const frame = Number(l.frame);
    if (l.msg === 'draining energy') {
      const pre = Number(l.logs?.pre_drain);
      const post = Number(l.logs?.post_drain);
      tl.events.push({ kind: 'burst', cost: Number.isFinite(pre) && Number.isFinite(post) ? pre - post : tl.max, frame });
    } else if (l.msg === 'particle') {
      const er = Number(l.logs?.ER);
      const amt = Number(l.logs?.amt);
      if (Number.isFinite(er) && er > 0 && Number.isFinite(amt)) tl.events.push({ kind: 'particle', raw: amt / er, frame });
    } else if (l.msg === 'adding energy') {
      const rec = Number(l.logs?.["rec'd"]);
      const pre = Number(l.logs?.pre_recovery);
      const post = Number(l.logs?.post_recovery);
      const amount = Number.isFinite(rec) ? rec : Number.isFinite(pre) && Number.isFinite(post) ? post - pre : 0;
      tl.events.push({ kind: 'flat', amount, frame });
    }
  }
  return out;
}

/**
 * ER（合計 %）のときの、爆発ごとの成否を数える（最初の爆発は、初期エネルギーが満タンなので数えない）。
 * エネルギーは、粒子 × ER + 固定の回復を足して上限で切り、爆発で消費量を引く（足りなかった爆発も、消費したものとして続ける。窓どうしを独立に数えるため）。
 */
export function passCount(timelines: EnergyTimeline[], erPercent: number, delayFrames = 0, warmupWindows = 0): { passed: number; total: number } {
  let passed = 0;
  let total = 0;
  for (const tl of timelines) {
    let energy = tl.max;
    let bursts = 0;
    const gain = (ev: EnergyTimeline['events'][number]) => ev.kind === 'particle' ? (ev.raw * erPercent) / 100 : ev.kind === 'flat' ? ev.amount : 0;
    for (let i = 0; i < tl.events.length; i++) {
      const ev = tl.events[i];
      if (ev.kind === 'particle' || ev.kind === 'flat') energy = Math.min(tl.max, energy + gain(ev));
      else {
        if (++bursts <= 1 + warmupWindows) { /* 最初の爆発と、立ち上がりの窓は数えない */ }
        else {
          total++;
          // 爆発が delayFrames 以内に遅れてもよいとして、その間に入るエネルギー（次の爆発まで）も足して判定する
          let e = energy;
          for (let j = i + 1; j < tl.events.length && tl.events[j].kind !== 'burst' && tl.events[j].frame <= ev.frame + delayFrames; j++) e = Math.min(tl.max, e + gain(tl.events[j]));
          if (e >= ev.cost - 1e-9) passed++;
        }
        energy = Math.max(0, energy - ev.cost);
      }
    }
  }
  return { passed, total };
}

/** ER の探索の上限（合計 %）。これで足りない割合は Infinity（届かない） */
const ER_SEARCH_CAP_PERCENT = (ER_MAX_ADDED + 2) * 100;

/**
 * 爆発の rate（0〜1）の割合が足りる最小の ER（合計 %）。rate = 0.7 で目安、0.9 で安定、1 で確実（全ての爆発）。
 * 爆発が無い（数える爆発が 0）ときは undefined。上限でも足りないときは Infinity
 */
export function requiredErForRate(timelines: EnergyTimeline[], rate: number, delayFrames = 0, warmupWindows = 0): number | undefined {
  const ok = (er: number) => { const { passed, total } = passCount(timelines, er, delayFrames, warmupWindows); return passed >= Math.ceil(total * rate - 1e-9); };
  if (passCount(timelines, 0, delayFrames, warmupWindows).total === 0) return undefined;
  if (ok(0)) return 0;
  if (!ok(ER_SEARCH_CAP_PERCENT)) return Infinity;
  let lo = 0;
  let hi = ER_SEARCH_CAP_PERCENT;
  while (hi - lo > 0.05) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

/** 0.1% 単位に切り上げる */
const ceil1 = (x: number): number => Math.ceil(x * 10 - 1e-9) / 10 + 0; // + 0 で -0 を 0 にする

/** 並びの違いから、最初にずれた爆発のキャラ（char_index）。同じなら undefined */
export function firstMismatchChar(baseline: string, test: string, delayFrames = 0, warmupWindows = 0): number | undefined {
  if (baseline === test) return undefined;
  const a = baseline.split(',');
  const b = test.split(',');
  const counts = new Map<number, number>();
  let offset = 0; // 立ち上がりの窓での遅れ（以降の爆発は、この分ずれた位置からの遅れで見る）
  for (let i = 0; i < a.length; i++) {
    // 立ち上がりで遅れた分だけ、最後の爆発が実行時間の外に出ることがある（その分は見ない）
    if (b[i] === undefined) return offset > delayFrames ? undefined : Number(a[i].split('@')[0]);
    const [ca, fa] = a[i].split('@').map(Number);
    const [cb, fb] = b[i].split('@').map(Number);
    if (ca !== cb) return ca;
    const n = (counts.get(ca) ?? 0) + 1;
    counts.set(ca, n);
    const d = fb - fa;
    if (n <= 1 + warmupWindows) { offset = Math.max(offset, d); if (n === 1 && d > delayFrames) return ca; continue; }
    if (d - offset > delayFrames) return ca;
  }
  return undefined;
}

/** 必要な ER を求める */
export async function computeRequiredEr(args: {
  build: BuildForEr;
  /** 敵の粒子（無ければ出さない） */
  enemyParticles?: EnemyParticles;
  /** 確かめの許容（足す分の割合）。既定は概算 */
  verifyTolerance?: number;
  /** 爆発の前に待ってよい秒数（既定 ER_DEFAULT_BURST_WAIT_SECONDS） */
  burstWaitSeconds?: number;
  /** 同時に実行する種の数（既定 1。WASM の Worker を並べるときに増やす） */
  parallel?: number;
  run: RunSample;
  gcsimVersion: string;
  onProgress?: (p: RequiredErProgress) => void;
  shouldCancel?: () => boolean;
}): Promise<RequiredErOutcome> {
  const { gcsimVersion, onProgress, shouldCancel } = args;
  const enemyParticles = args.enemyParticles;
  const verifyTolerance = args.verifyTolerance ?? ER_VERIFY_TOLERANCE_ROUGH;
  const burstWaitSeconds = Math.max(0, args.burstWaitSeconds ?? ER_DEFAULT_BURST_WAIT_SECONDS);
  const delayFrames = Math.round(burstWaitSeconds * 60);
  const parallel = Math.max(1, Math.floor(args.parallel ?? 1));
  const build: BuildForEr = extra => args.build({ ...extra, enemyParticles });
  const cancelled = () => shouldCancel?.() === true;
  const startedAt = Date.now();
  let runsDone = 0;
  let chunksDone = 0;
  let phase: RequiredErPhase = 'baseline';
  let phaseChunksDone = 0;
  /** 確かめの残りの塊の数（最小・最大）。確かめの状態ができてから、状態から求める。それまでは、事前の見積り */
  let verifyEstimate: (() => { low: number; high: number }) | null = null;
  let seedCount = ER_SEEDS;
  let inFinal = false; // 見直しの実行（最後の段）に入ったか
  const chunkCost = () => Math.ceil(seedCount / parallel);
  const priorTrials = 5 + 1.5 * Math.max(0, Math.log2(ER_VERIFY_TOLERANCE_ROUGH / verifyTolerance));
  const estimateLeft = (): { low: number; high: number } => {
    const finalChunks = inFinal ? Math.max(0, chunkCost() - phaseChunksDone) : chunkCost();
    const trialChunks = (chunkCost() + 1) / 2; // 絞りの 1 回は、通る（全種）かずれる（1 塊）かが半々
    const prior = { low: priorTrials * trialChunks * 0.6 + chunkCost(), high: priorTrials * trialChunks * 1.6 + chunkCost() };
    const v = phase === 'verify' && verifyEstimate ? verifyEstimate() : prior;
    const early = phase === 'baseline' ? Math.max(0, Math.ceil(ER_SEEDS / parallel) - phaseChunksDone) + Math.ceil(ER_SEEDS / parallel)
      : phase === 'collect' ? Math.max(0, Math.ceil(ER_SEEDS / parallel) - phaseChunksDone) : 0;
    return { low: early + v.low + finalChunks, high: early + v.high + finalChunks };
  };
  const report = () => {
    const left = estimateLeft();
    onProgress?.({ phase, runsDone, runsExpected: Math.max(RUNS_ESTIMATE, runsDone + 1), chunksDone, chunksLeftLow: left.low, chunksLeftHigh: left.high });
  };
  const run: RunSample = async (config, seed) => {
    const res = await args.run(config, seed);
    runsDone++;
    report();
    return res;
  };
  /** 種をまとめて同時に実行する（1 塊） */
  const runChunk = async (config: string, chunk: number[]) => {
    const results = await Promise.all(chunk.map(seed => run(config, seed)));
    chunksDone++;
    phaseChunksDone++;
    report();
    return results;
  };

  const base = build({ ignoreBurstEnergy: true, added: {} });
  if (!base.runnable) {
    return { status: 'error', message: base.warnings.filter(w => w.level === 'error').map(w => w.message).join('\n') };
  }
  const members = base.members;
  const memberIds = members.map(m => m.characterId);
  report();
  /** 種のリストを parallel 個ずつの塊に分ける */
  const chunksOf = (list: number[]): number[][] => {
    const out: number[][] = [];
    for (let i = 0; i < list.length; i += parallel) out.push(list.slice(i, i + parallel));
    return out;
  };
  const allSeeds = Array.from({ length: ER_SEEDS }, (_, i) => i + 1);

  // 1. 基準（種ごと）。実行の失敗はそのまま返す
  const baseline = new Map<number, string>();
  let baseEr = new Map<number, number>();
  for (const chunk of chunksOf(allSeeds)) {
    if (cancelled()) return { status: 'cancelled' };
    const results = await runChunk(base.config, chunk);
    for (let k = 0; k < chunk.length; k++) {
      const res = results[k];
      if (res.status !== 'ok') return { status: res.status, message: res.message };
      baseline.set(chunk[k], burstSignature(res.logs));
      if (chunk[k] === 1) baseEr = energyRechargeByCharIndex(res.logs);
    }
  }

  // 2. 集計: 全員を十分大きい ER にして実行し、窓ごとの必要な ER を集める。基準と一致する種だけを使う（祭礼の武器など、種で展開が変わる場合の対策）
  //    （他のキャラの ER で量が変わる回復 = 雷電将軍の爆発などは、ここでは多く出て、必要な ER が低く出る。確かめ・見直しで直す）
  phase = 'collect';
  phaseChunksDone = 0;
  report();
  const highConfig = build({ ignoreBurstEnergy: false, added: Object.fromEntries(memberIds.map(id => [id, ER_OTHERS_ADDED])) }).config;
  const seeds: number[] = [];
  const timelines = new Map<number, EnergyTimeline[]>();
  for (const chunk of chunksOf(allSeeds)) {
    if (cancelled()) return { status: 'cancelled' };
    const results = await runChunk(highConfig, chunk);
    for (let k = 0; k < chunk.length; k++) {
      const res = results[k];
      if (res.status !== 'ok') return { status: res.status, message: res.message };
      if (burstSignature(res.logs) !== baseline.get(chunk[k])) continue;
      seeds.push(chunk[k]);
      for (const [i, tl] of collectEnergyTimelines(res.logs)) timelines.set(i, [...(timelines.get(i) ?? []), tl]);
    }
  }
  if (seeds.length === 0) return { status: 'error', message: t('gcsim:er.errorMismatch') };
  seedCount = seeds.length;

  // 3. 3 段（目安 = 爆発の 70% が足りる / 安定 = 90% / 確実 = 全て）。数える爆発が無いキャラは「爆発なし」
  const entries: RequiredErEntry[] = [];
  const certainAdded = new Map<number, number>();
  const baseFraction = (idx: number) => baseEr.get(idx) ?? 1;
  let maxWindows = 0;
  members.forEach((m, idx) => {
    const list = timelines.get(idx) ?? [];
    const certain = requiredErForRate(list, 1, delayFrames, ER_WARMUP_WINDOWS);
    if (certain === undefined) {
      entries.push({ characterId: m.characterId, name: m.name, status: 'noBurst' });
      return;
    }
    maxWindows = Math.max(maxWindows, passCount(list, 0, delayFrames, ER_WARMUP_WINDOWS).total);
    const added = certain / 100 - baseFraction(idx);
    if (!Number.isFinite(certain) || added > ER_MAX_ADDED) {
      entries.push({ characterId: m.characterId, name: m.name, status: 'unreachable' });
      return;
    }
    // 足す分は 0 以上（武器・聖遺物のセットですでに足りているキャラは、確実の値がその合計 ER になる。
    // マイナスまで下げて探すと、他のキャラの回復量と絡んで確かめが収まらず、計算が長引く）
    certainAdded.set(idx, Math.max(0, added));
    entries.push({
      characterId: m.characterId,
      name: m.name,
      status: 'ok',
      typicalEr: ceil1(requiredErForRate(list, 0.7, delayFrames, ER_WARMUP_WINDOWS)!),
      stableEr: ceil1(requiredErForRate(list, 0.9, delayFrames, ER_WARMUP_WINDOWS)!),
      certainEr: ceil1(certain),
    });
  });

  // 4. 確実の値の確かめ（全員を確実の値にして、全種で爆発が基準と一致するか。ずれたら、そのキャラを上げる。
  //    上げ幅は倍々に増やし、通ったあとは、ずれた値との間を半分ずつに絞る）
  //    集計の実行は全員が十分大きい ER なので、他のキャラの ER で量が変わる回復（雷電将軍の爆発など）は、ここで初めて分かる
  phase = 'verify';
  phaseChunksDone = 0;
  report();
  const failedAt = new Map<number, number>(); // ずれた値の最大（足す分）
  const passedAt = new Map<number, number>(); // 全種が一致した値の最小（足す分）
  const stepOf = new Map<number, number>();
  let verified = false;
  let verifyRound = 0;
  // 確かめの残り: ずれた記録があるキャラは、通った値（無ければ次の上げ幅）とずれた値の間を、許容まで半分ずつ絞る回数 × 1 回の平均の塊数。
  // 最初の周回の結果が出るまでは、事前の見積り（priorTrials）
  verifyEstimate = () => {
    const trialChunks = (chunkCost() + 1) / 2;
    if (verifyRound === 0 && failedAt.size === 0) return { low: priorTrials * trialChunks * 0.6 + chunkCost(), high: priorTrials * trialChunks * 1.6 + chunkCost() };
    let trials = 0;
    for (const [idx, cur] of certainAdded) {
      const lo = failedAt.get(idx);
      if (lo === undefined) continue;
      const hi = passedAt.get(idx) ?? cur + (stepOf.get(idx) ?? VERIFY_BUMP);
      trials += Math.max(0, Math.ceil(Math.log2(Math.max(hi - lo, verifyTolerance) / verifyTolerance)));
    }
    // 他のキャラのずれが新しく見つかることもある（高い方に、あと 3 回分を足す）。
    // 全員の値が互いに影響し合い、通った値がずれ直すことが多い（精密で実測 30 周以上）ため、周回が進んだ分だけ高い方を広げる
    const recheck = Math.max(0, verifyRound - 6) * 0.4;
    return { low: trials * trialChunks * 0.8 + chunkCost(), high: (trials + 3 + recheck) * trialChunks * 1.3 + chunkCost() };
  };
  let lastFailSeed: number | undefined; // 前回ずれた種を先に実行する（ずれるときは、1 回の実行で分かる）
  const verifyConfig = () => {
    const added: Record<string, number> = {};
    members.forEach((m, idx) => { added[m.characterId] = certainAdded.get(idx) ?? ER_OTHERS_ADDED; });
    return build({ ignoreBurstEnergy: false, added }).config;
  };
  for (let round = 0; round < VERIFY_MAX_ROUNDS; round++) {
    verifyRound = round;
    const config = verifyConfig();
    let bump: number | undefined;
    const order = lastFailSeed !== undefined && seeds.includes(lastFailSeed) ? [lastFailSeed, ...seeds.filter(s => s !== lastFailSeed)] : seeds;
    for (const chunk of chunksOf(order)) {
      if (cancelled()) return { status: 'cancelled' };
      const results = await runChunk(config, chunk);
      for (let k = 0; k < chunk.length; k++) {
        const res = results[k];
        if (res.status !== 'ok') return { status: res.status, message: res.message };
        const ng = firstMismatchChar(baseline.get(chunk[k])!, burstSignature(res.logs), delayFrames, ER_WARMUP_WINDOWS);
        if (ng !== undefined) { bump = ng; lastFailSeed = chunk[k]; break; }
      }
      if (bump !== undefined) break;
    }
    if (bump === undefined) {
      // 全種が一致。ずれた値との差が大きいキャラを、間まで下げて試す
      for (const [idx, cur] of certainAdded) passedAt.set(idx, Math.min(passedAt.get(idx) ?? Infinity, cur));
      let target: number | undefined;
      let gap = verifyTolerance;
      for (const [idx, cur] of certainAdded) {
        const lo = failedAt.get(idx);
        if (lo !== undefined && cur - lo > gap) { gap = cur - lo; target = idx; }
      }
      if (target === undefined) { verified = true; break; }
      certainAdded.set(target, (failedAt.get(target)! + certainAdded.get(target)!) / 2);
      continue;
    }
    const cur = certainAdded.get(bump);
    if (cur === undefined) break; // 爆発なし・届かないキャラのずれは、ここでは直せない
    failedAt.set(bump, Math.max(failedAt.get(bump) ?? -Infinity, cur));
    let pass = passedAt.get(bump);
    if (pass !== undefined && pass <= cur) {
      // 通った値が、他のキャラの調整でずれ直した。その記録は古いので捨て、上げ幅も最初に戻す
      passedAt.delete(bump);
      stepOf.delete(bump);
      pass = undefined;
    }
    let next: number;
    if (pass !== undefined) {
      next = pass - cur <= verifyTolerance ? pass : (cur + pass) / 2;
    } else {
      const step = stepOf.get(bump) ?? VERIFY_BUMP;
      stepOf.set(bump, Math.min(step * 2, VERIFY_MAX_STEP));
      next = cur + step;
    }
    if (next > ER_MAX_ADDED) {
      certainAdded.delete(bump);
      const e = entries[bump];
      entries[bump] = { characterId: e.characterId, name: e.name, status: 'unreachable' };
    } else {
      certainAdded.set(bump, next);
    }
  }
  if (!verified && certainAdded.size > 0) return { status: 'error', message: t('gcsim:er.errorVerify') };

  // 5. 目安・安定の見直し: 確かめた値で実行し直し、そのときのエネルギーの出入りで求め直す
  //    （集計の実行では、他のキャラの ER で量が変わる回復が実際より多く、必要な ER が低く出るため）
  let finalTimelines: Map<number, EnergyTimeline[]> | undefined;
  verifyEstimate = () => ({ low: 0, high: 0 });
  if (certainAdded.size > 0) {
    phase = 'verify';
    inFinal = true;
    phaseChunksDone = 0;
    const finalConfig = verifyConfig();
    finalTimelines = new Map<number, EnergyTimeline[]>();
    for (const chunk of chunksOf(seeds)) {
      if (cancelled()) return { status: 'cancelled' };
      const results = await runChunk(finalConfig, chunk);
      for (const res of results) {
        if (res.status !== 'ok') return { status: res.status, message: res.message };
        for (const [i, tl] of collectEnergyTimelines(res.logs)) finalTimelines!.set(i, [...(finalTimelines!.get(i) ?? []), tl]);
      }
    }
    entries.forEach((e, idx) => {
      if (e.status !== 'ok') return;
      const list = finalTimelines!.get(idx) ?? [];
      const typical = requiredErForRate(list, 0.7, delayFrames, ER_WARMUP_WINDOWS);
      const stable = requiredErForRate(list, 0.9, delayFrames, ER_WARMUP_WINDOWS);
      if (typical !== undefined && Number.isFinite(typical)) e.typicalEr = ceil1(typical);
      if (stable !== undefined && Number.isFinite(stable)) e.stableEr = ceil1(stable);
    });
  }
  // 確かめた値を、確実の値として反映する（目安・安定が確実より大きくならないようにする。確かめで上がるのは確実だけ）
  entries.forEach((e, idx) => {
    const added = certainAdded.get(idx);
    if (e.status !== 'ok' || added === undefined) return;
    e.addedEr = Number(added.toFixed(4));
    e.certainEr = Math.max(e.certainEr ?? 0, ceil1((baseFraction(idx) + added) * 100));
    e.stableEr = Math.min(e.stableEr ?? e.certainEr, e.certainEr);
    e.typicalEr = Math.min(e.typicalEr ?? e.stableEr, e.stableEr);
  });
  // 足りる確率の推定（表示する値で、集計した窓のうち足りた割合。全窓が足りた確実は N÷(N+1)）
  entries.forEach((e, idx) => {
    if (e.status !== 'ok') return;
    const list = (finalTimelines ?? timelines).get(idx) ?? [];
    const pct = (er: number | undefined, lastOne: boolean): number | undefined => {
      if (er === undefined) return undefined;
      const { passed, total } = passCount(list, er, delayFrames, ER_WARMUP_WINDOWS);
      if (total === 0) return undefined;
      return Math.round((lastOne && passed === total ? total / (total + 1) : passed / total) * 100);
    };
    e.typicalPct = pct(e.typicalEr, false);
    e.stablePct = pct(e.stableEr, false);
    e.certainPct = pct(e.certainEr, true);
  });

  report();
  return {
    status: 'ok',
    result: { gcsimVersion, ranAt: Date.now(), elapsedMs: Date.now() - startedAt, seeds: seeds.length, windows: maxWindows, enemyParticles: enemyParticles ?? { minSeconds: 0, maxSeconds: 0, amount: 0 }, precise: verifyTolerance <= ER_VERIFY_TOLERANCE_PRECISE, burstWaitSeconds, fingerprint: fingerprintOf(args.build({ ignoreBurstEnergy: true, added: {} }).config), entries },
  };
}
