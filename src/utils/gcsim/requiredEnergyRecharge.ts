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
 *   4. 確実の値を gcsim で検証する（全員を確実の値にして、全種で爆発が基準と一致するか。足りなければ、上げ幅を倍々に増やして上げ、通ったあとは半分ずつに絞る）
 *   5. 検証した値で実行し直し、そのときのエネルギーの出入りで、目安・安定を求め直す（他のキャラの ER で量が変わる回復 = 雷電将軍の爆発などへの対策）
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
/** 立ち上がりとして数えない窓の数。0 = 最初の窓（最初の爆発から 2 回目の爆発まで）も、遅れの許容の設定にしたがって数える（1 周目は粒子が少なく、ここで遅れると次の窓の粒子が捨てられて連鎖するため。D308・D309） */
export const ER_WARMUP_WINDOWS = 0;
/** 試す乱数の種の数の既定（1 〜 この数）。粒子の出方は種で変わる。画面で変えられる */
export const ER_DEFAULT_SEEDS = 20;
export const ER_MAX_SEEDS = 100;
/** 探索の上限（足す分の割合。5 = +500%）。確実の値がこれを超えれば「届かない」 */
export const ER_MAX_ADDED = 5;
/** 求める合計 ER の下限（100% = 元素チャージ効率の補正なし）。武器・聖遺物の ER は考慮せず、ここから探す */
export const ER_FLOOR_FRACTION = 1;
/** 他のキャラの ER（足す分。エネルギー不足で止まらない十分大きい値） */
const ER_OTHERS_ADDED = 10;
/** 確実の値が検証で足りなかったときに、上げる幅（足す分の割合） */
const VERIFY_BUMP = 0.05;
/** 上げ幅の上限（倍々に増やしても、ここまで） */
const VERIFY_MAX_STEP = 0.4;
/**
 * 確実の値を gcsim で検証するキャラ（gcsim のキー）。提供者自身の ER で、他のキャラへの回復量が決まるため、
 * 集計の実行（全員の ER が約 1100%）の記録からは、回復量を正しく求められない（docs/gcsim-integration/phase-7-required-er/検証で値が変わる効果.md の区分 A）。
 * 雷電将軍・九条裟羅（サラ）・ドリー
 */
export const ER_VERIFY_CHARACTER_KEYS = ['raidenshogun', 'kujousara', 'dori'] as const;
/** 編成のメンバーのうち、検証が要るキャラ */
export const verifyCharacters = <T extends { gcsimKey: string }>(members: T[]): T[] => members.filter(m => (ER_VERIFY_CHARACTER_KEYS as readonly string[]).includes(m.gcsimKey));

/** 目安・安定の求め直し（その値で動かし直す）の最大回数 */
const REFINE_MAX_ROUNDS = 6;
/** 検証で、値を絞るのをやめる幅（足す分の割合）。概算 = 0.1（ER 10%）、精密 = 0.01（ER 1%。細かいほど時間が延びる） */
export const ER_VERIFY_TOLERANCE_ROUGH = 0.1;
export const ER_VERIFY_TOLERANCE_PRECISE = 0.01;
/** 検証の繰り返しの上限（無限ループの防止） */
const VERIFY_MAX_ROUNDS = 100;
/** 爆発の前に、エネルギーが貯まるのを待ってよい秒数の既定値（これ以内の遅れは「足りた」とみなす） */
export const ER_DEFAULT_BURST_WAIT_SECONDS = 0;
/** 同、フレーム数（60 フレーム = 1 秒） */
export const ER_BURST_DELAY_FRAMES = ER_DEFAULT_BURST_WAIT_SECONDS * 60;
/** 実行回数の見積り（基準 + 集計 + 検証。残り時間の推定に使う） */

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
  /** 確実: 全ての窓で足りる値（%。gcsim で検証済み） */
  certainEr?: number;
  /** 目安・安定・確実の値で、窓が足りる確率の推定（%）。試した窓での実際の割合。確実は、全窓が足りたとき N÷(N+1)（次の 1 窓が最大を超える確率が 1÷(N+1) のため） */
  typicalPct?: number;
  stablePct?: number;
  certainPct?: number;
  /**
   * 目安・安定の、種の数による誤差の範囲（信頼度 80%（ER_INTERVAL_CONFIDENCE）で、真の値がこの間に入る。%）。
   * 種を取り直す（ブートストラップ）区間。窓のデータだけから求める（追加の実行なし）。
   * 下・上の片方が無いとき（窓が少なすぎて決まらないとき）は、その側を出さない。雷電将軍・九条裟羅・ドリーがいる編成（検証で値が決まる）には、出さない
   */
  typicalErLow?: number;
  typicalErHigh?: number;
  stableErLow?: number;
  stableErHigh?: number;
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
  /** 精密（検証を細かく絞った）で求めたか。古い保存・概算は無い */
  precise?: boolean;
  /** 確実の値を gcsim で検証したか。false = 計算のみ。古い保存は無い（検証した扱い） */
  verified?: boolean;
  /** 目安・安定も gcsim で検証したか（雷電将軍・九条裟羅・ドリーがいる編成）。古い保存は無い */
  levelsVerified?: boolean;
  /** 爆発の前に待ってよいとした秒数（古い保存には無い。無いときは 0.5 秒だった） */
  burstWaitSeconds?: number;
  /** 求めたときの編成・ローテーションの指紋（今の設定文と比べて、変わっていないかを調べる） */
  fingerprint: string;
  entries: RequiredErEntry[];
}

export type RequiredErPhase = 'baseline' | 'collect' | 'verify' | 'refine';

export interface RequiredErProgress {
  phase: RequiredErPhase;
  /** gcsim の実行を終えた回数 */
  runsDone: number;
  /** 実行回数の見積り（残り時間の推定に使う） */
  runsExpected: number;
  /** 同時に実行する塊（Promise.all 1 回分。並列のときは 1 塊 = 並列数の実行）を終えた回数。残り時間は、塊の平均時間 × 残りの塊の数で出す */
  chunksDone: number;
  /** 残りの塊の数の見積り（最小〜最大。検証は何回で収まるか分からないので、幅を持たせる） */
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
  events: ({ kind: 'particle'; raw: number; frame: number } | { kind: 'flat'; amount: number; frame: number } | { kind: 'burst'; cost: number; frame: number; exec: number })[];
}

/**
 * ログから、キャラごとのエネルギーの出入りを集める。
 * 粒子は `particle`（`amt` ÷ `ER` = ER 100% 換算）、固定の回復は `adding energy`（`rec'd` = 回復量。上限で切られる前の値）、
 * 爆発は `draining energy`（消費量 = `pre_drain − post_drain`。通常は上限 = 全部消費。ヴァレサの特殊爆発のように一部だけ消費する爆発もある）。
 */
export function collectEnergyTimelines(logs: GcsimLogEvent[]): Map<number, EnergyTimeline> {
  const out = new Map<number, EnergyTimeline>();
  const lastExec = new Map<number, number>(); // キャラごとの、直近の爆発の実行（executed burst）のフレーム
  // キャラごとの、爆発の実行のフレーム（全部）。ヴァレサなどは、エネルギーの消費ログが「実行」のログより先に出る（同じフレーム）ため、
  // 直近の実行だけを使うと 1 つ前の爆発のフレームになってしまう。同じフレームの実行があれば、それを使う
  const execFrames = new Map<number, Set<number>>();
  for (const l of logs) {
    if (l.msg === 'executed burst' && l.char_index !== undefined) {
      const set = execFrames.get(l.char_index) ?? new Set<number>();
      set.add(Number(l.frame));
      execFrames.set(l.char_index, set);
    }
  }
  for (const l of logs) {
    if (l.msg === 'executed burst' && l.char_index !== undefined) { lastExec.set(l.char_index, Number(l.frame)); continue; }
    if (l.event !== 'energy' || l.char_index === undefined) continue;
    const tl = out.get(l.char_index) ?? { max: 0, events: [] };
    out.set(l.char_index, tl);
    const maxEnergy = Number(l.logs?.max_energy);
    if (Number.isFinite(maxEnergy) && maxEnergy > 0) tl.max = maxEnergy;
    const frame = Number(l.frame);
    if (l.msg === 'draining energy') {
      const pre = Number(l.logs?.pre_drain);
      const post = Number(l.logs?.post_drain);
      tl.events.push({ kind: 'burst', cost: Number.isFinite(pre) && Number.isFinite(post) ? pre - post : tl.max, frame, exec: execFrames.get(l.char_index)?.has(frame) ? frame : lastExec.get(l.char_index) ?? frame });
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
 * 爆発を基準のタイミングで出す実行（ignore_burst_energy）では、エネルギーが足りないまま爆発するので、ログの消費量が実際より小さい。
 * 消費量は、通常の実行（同じ種）の、同じ順の爆発の値に置き換える（無ければ上限）
 */
function withReferenceCosts(tl: EnergyTimeline, ref: EnergyTimeline | undefined): EnergyTimeline {
  const refCosts = (ref?.events ?? []).flatMap(ev => ev.kind === 'burst' ? [ev.cost] : []);
  let n = 0;
  return { max: tl.max, events: tl.events.map(ev => ev.kind === 'burst' ? { ...ev, cost: refCosts[n++] ?? tl.max } : ev) };
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
    let windowStart = 0; // 直前の爆発の次のイベント
    const before: number[] = []; // イベントごとの、足す前のエネルギー（窓の中）
    for (let i = 0; i < tl.events.length; i++) {
      const ev = tl.events[i];
      if (ev.kind === 'particle' || ev.kind === 'flat') {
        before[i] = energy;
        energy = Math.min(tl.max, energy + gain(ev));
      } else {
        if (++bursts <= 1 + warmupWindows) { /* 最初の爆発と、立ち上がりの窓は数えない */ }
        else {
          total++;
          // 爆発は、実行（executed burst）の時点のエネルギーで判定される（エネルギーを消費するログは、実行の少し後）。
          // 実行から消費までに入った分は数えない。爆発が delayFrames 以内に遅れてもよいとして、その間に入る分は足す
          const limit = ev.exec + delayFrames;
          let k = windowStart;
          while (k < i && tl.events[k].frame <= limit) k++;
          let e = k < i ? before[k] : energy;
          for (let j = i + 1; j < tl.events.length && tl.events[j].kind !== 'burst' && tl.events[j].frame <= limit; j++) e = Math.min(tl.max, e + gain(tl.events[j]));
          if (e >= ev.cost - 1e-9) passed++;
        }
        energy = Math.max(0, energy - ev.cost);
        windowStart = i + 1;
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

/** 信頼区間の信頼度（目安・安定の、種の数による誤差の範囲） */
export const ER_INTERVAL_CONFIDENCE = 0.8;
/** 範囲を求める再標本化の回数 */
export const ER_INTERVAL_RESAMPLES = 1000;

/**
 * 目安・安定の、種の数による誤差の範囲（ブートストラップ）。種を、種ごとのまとまりのまま、重複を許して取り直し（同じ数）、その値を求め直す。
 * これを繰り返した値の分布の、両端（信頼度 80% なら 10%・90% の位置）を範囲にする。同じ種の窓どうしの相関も含まれる。
 * 乱数は固定の種から出すので、同じデータなら毎回同じ結果になる。決まらない側（取り直した値が上限に届かないなど）は undefined
 */
export function requiredErInterval(timelines: EnergyTimeline[], rate: number, delayFrames = 0, warmupWindows = 0, confidence = ER_INTERVAL_CONFIDENCE, resamples = ER_INTERVAL_RESAMPLES): { low?: number; high?: number } | undefined {
  if (timelines.length < 2 || passCount(timelines, 0, delayFrames, warmupWindows).total < 1) return undefined;
  let state = 0x9e3779b9;
  const rnd = (): number => { state = (state + 0x6d2b79f5) | 0; let x = Math.imul(state ^ (state >>> 15), 1 | state); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const values: number[] = [];
  for (let b = 0; b < resamples; b++) {
    const list = Array.from({ length: timelines.length }, () => timelines[Math.floor(rnd() * timelines.length)]);
    const v = requiredErForRate(list, rate, delayFrames, warmupWindows);
    values.push(v === undefined ? Infinity : v);
  }
  values.sort((a, c) => a - c);
  const alpha = 1 - confidence;
  const at = (q: number): number | undefined => { const v = values[Math.min(values.length - 1, Math.max(0, Math.round(q * (values.length - 1))))]; return Number.isFinite(v) ? v : undefined; };
  return { low: at(alpha / 2), high: at(1 - alpha / 2) };
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
    // （ただし、見ない爆発は、キャラの数まで。エネルギーが足りずに爆発が出なくなった場合は、残りが多いので、ずれとして数える）
    if (b[i] === undefined) return offset > delayFrames && a.length - i <= new Set(a.map(x => x.split('@')[0])).size ? undefined : Number(a[i].split('@')[0]);
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
  /** 検証の許容（足す分の割合）。既定は概算 */
  verifyTolerance?: number;
  /** 確実の値を gcsim で検証するか（既定 true）。false は、記録した窓から計算するだけで、検証と見直しの実行をしない */
  verify?: boolean;
  /** 目安・安定も gcsim で検証するか（その値で動かし直して求め直す）。省略すると、編成に ER_VERIFY_CHARACTER_KEYS のキャラがいるときだけ検証する。verify が false のときは検証しない */
  verifyLevels?: boolean;
  /** 試す種の数（既定 ER_DEFAULT_SEEDS） */
  seeds?: number;
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
  const verifyTolerance = args.verifyTolerance ?? ER_VERIFY_TOLERANCE_PRECISE;
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
  /** 検証の残りの塊の数（最小・最大）。検証の状態ができてから、状態から求める。それまでは、事前の見積り */
  let verifyEstimate: (() => { low: number; high: number }) | null = null;
  const seedTotal = Math.min(ER_MAX_SEEDS, Math.max(1, Math.floor(args.seeds ?? ER_DEFAULT_SEEDS)));
  const runsEstimate = seedTotal * 6;
  let seedCount = seedTotal;
  let inFinal = false; // 見直しの実行（最後の段）に入ったか
  let refineChunksDone = 0; // 目安・安定の求め直しで実行した塊の数（求め直しは 2 段 × 2〜5 回の見込み）
  const chunkCost = () => Math.ceil(seedCount / parallel);
  const priorTrials = 5 + 1.5 * Math.max(0, Math.log2(0.2 / verifyTolerance));
  const estimateLeft = (): { low: number; high: number } => {
    if (!verify) return { low: phase === 'baseline' ? Math.max(0, Math.ceil(seedTotal / parallel) - phaseChunksDone) + Math.ceil(seedTotal / parallel) : Math.max(0, Math.ceil(seedTotal / parallel) - phaseChunksDone), high: phase === 'baseline' ? Math.max(0, Math.ceil(seedTotal / parallel) - phaseChunksDone) + Math.ceil(seedTotal / parallel) : Math.max(0, Math.ceil(seedTotal / parallel) - phaseChunksDone) };
    const finalChunks = 0;
    const refine = levelsVerify ? { low: Math.max(0, 6 * chunkCost() - refineChunksDone), high: Math.max(chunkCost(), 15 * chunkCost() - refineChunksDone) } : { low: 0, high: 0 };
    const trialChunks = (chunkCost() + 1) / 2; // 絞りの 1 回は、通る（全種）かずれる（1 塊）かが半々
    // 見直しをする編成は、検証は見直しの値の確認（ふつうは 1 周で通る）
    const prior = levelsVerify ? { low: chunkCost(), high: 4 * chunkCost() } : { low: priorTrials * trialChunks * 0.6 + chunkCost(), high: priorTrials * trialChunks * 1.6 + chunkCost() };
    const v = phase === 'verify' && verifyEstimate ? verifyEstimate() : prior;
    const early = phase === 'baseline' ? Math.max(0, Math.ceil(seedTotal / parallel) - phaseChunksDone) + Math.ceil(seedTotal / parallel)
      : phase === 'collect' ? Math.max(0, Math.ceil(seedTotal / parallel) - phaseChunksDone) : 0;
    return { low: early + v.low + finalChunks + refine.low, high: early + v.high + finalChunks + refine.high };
  };
  const report = () => {
    const left = estimateLeft();
    onProgress?.({ phase, runsDone, runsExpected: Math.max(runsEstimate, runsDone + 1), chunksDone, chunksLeftLow: left.low, chunksLeftHigh: left.high });
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
    if (phase === 'refine') refineChunksDone++;
    report();
    return results;
  };

  const base = build({ ignoreBurstEnergy: true, added: {} });
  if (!base.runnable) {
    return { status: 'error', message: base.warnings.filter(w => w.level === 'error').map(w => w.message).join('\n') };
  }
  const members = base.members;
  const verify = args.verify !== false;
  const levelsVerify = verify && (args.verifyLevels ?? verifyCharacters(members).length > 0);
  const memberIds = members.map(m => m.characterId);
  report();
  /** 種のリストを parallel 個ずつの塊に分ける */
  const chunksOf = (list: number[]): number[][] => {
    const out: number[][] = [];
    for (let i = 0; i < list.length; i += parallel) out.push(list.slice(i, i + parallel));
    return out;
  };
  const allSeeds = Array.from({ length: seedTotal }, (_, i) => i + 1);

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
  //    （他のキャラの ER で量が変わる回復 = 雷電将軍の爆発などは、ここでは多く出て、必要な ER が低く出る。検証・見直しで直す）
  phase = 'collect';
  phaseChunksDone = 0;
  report();
  const highConfig = build({ ignoreBurstEnergy: false, added: Object.fromEntries(memberIds.map(id => [id, ER_OTHERS_ADDED])) }).config;
  const seeds: number[] = [];
  const timelines = new Map<number, EnergyTimeline[]>();
  const referenceBySeed = new Map<number, Map<number, EnergyTimeline>>(); // 種ごとの集計の実行（爆発の消費量の基準）
  for (const chunk of chunksOf(allSeeds)) {
    if (cancelled()) return { status: 'cancelled' };
    const results = await runChunk(highConfig, chunk);
    for (let k = 0; k < chunk.length; k++) {
      const res = results[k];
      if (res.status !== 'ok') return { status: res.status, message: res.message };
      if (burstSignature(res.logs) !== baseline.get(chunk[k])) continue;
      seeds.push(chunk[k]);
      const collected = collectEnergyTimelines(res.logs);
      referenceBySeed.set(chunk[k], collected);
      for (const [i, tl] of collected) timelines.set(i, [...(timelines.get(i) ?? []), tl]);
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
    // 装備（武器・聖遺物）の ER は考慮しない。合計 ER が 100% 未満にはならないとして、そこから探す（足す分は、装備の ER との差で、マイナスもある）
    const added = Math.max(certain / 100, ER_FLOOR_FRACTION) - baseFraction(idx);
    if (!Number.isFinite(certain) || added > ER_MAX_ADDED) {
      entries.push({ characterId: m.characterId, name: m.name, status: 'unreachable' });
      return;
    }
    // 検証は、装備の ER（足す分 0）から上げる。マイナスから探すと、他のキャラの回復量と絡んで検証が収まらない。
    // 装備の ER より低くてよいキャラは、検証が通ったあとの下げ直しで、合計 ER 100% を下限に下げる
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

  // 3-B. 目安・安定・確実の見直し（雷電将軍・サラ・ドリーがいる編成）: 3 段とも同じ方法で求める。
  //      全員をその段の値にして動かし（爆発は基準のタイミングで出す = ignore_burst_energy）、そのときのエネルギーの出入りで、窓ごとの必要量から段の割合（70%・90%・100%）の値を求め直す。
  //      値が許容の中で動かなくなるまで繰り返す（他のキャラの ER で量が変わる回復は、その水準の ER で見積もられる）。
  //      順序: 回復量が自分の ER で決まるキャラ（雷電将軍・サラ・ドリー）の値を先に確定し、その値を前提に、他のキャラの値を確定する（段ごと）。
  //      雷電などの値が高いと、他のキャラの値が、下の段より低くなることがあるが、そのまま表示する（修正しない）
  const levelTimelines = new Map<'typicalEr' | 'stableEr' | 'certainEr', Map<number, EnergyTimeline[]>>();
  const isProviderIdx = (idx: number) => (ER_VERIFY_CHARACTER_KEYS as readonly string[]).includes(members[idx].gcsimKey);
  if (levelsVerify && entries.some(e => e.status === 'ok')) {
    phase = 'refine';
    for (const [pick, rate] of [['stableEr', 0.9], ['typicalEr', 0.7], ['certainEr', 1]] as const) {
      let tls = new Map<number, EnergyTimeline[]>();
      /** movable のキャラだけを動かして、値が動かなくなるまで繰り返す（それ以外は、いまの値のまま） */
      const iterate = async (movable: (idx: number) => boolean): Promise<RequiredErOutcome | undefined> => {
        for (let round = 0; round < REFINE_MAX_ROUNDS; round++) {
          const added: Record<string, number> = {};
          members.forEach((m, idx) => {
            const e = entries[idx];
            const er = e.status === 'ok' ? e[pick] : undefined;
            added[m.characterId] = er !== undefined ? Math.max(ER_FLOOR_FRACTION, er / 100) - baseFraction(idx) : ER_OTHERS_ADDED;
          });
          const config = build({ ignoreBurstEnergy: true, added }).config;
          tls = new Map<number, EnergyTimeline[]>();
          for (const chunk of chunksOf(seeds)) {
            if (cancelled()) return { status: 'cancelled' };
            const results = await runChunk(config, chunk);
            for (let k = 0; k < chunk.length; k++) {
              const res = results[k];
              if (res.status !== 'ok') return { status: res.status, message: res.message };
              for (const [i, tl] of collectEnergyTimelines(res.logs)) tls.set(i, [...(tls.get(i) ?? []), withReferenceCosts(tl, referenceBySeed.get(chunk[k])?.get(i))]);
            }
          }
          let moved = false;
          entries.forEach((e, idx) => {
            if (e.status !== 'ok' || e[pick] === undefined || !movable(idx)) return;
            const v = requiredErForRate(tls.get(idx) ?? [], rate, delayFrames, ER_WARMUP_WINDOWS);
            if (v === undefined || !Number.isFinite(v)) return;
            const next = ceil1(v);
            if (Math.abs(next - e[pick]!) > verifyTolerance * 100) moved = true;
            e[pick] = next;
          });
          if (!moved) break;
        }
        return undefined;
      };
      const hasOthers = entries.some((e, idx) => e.status === 'ok' && !isProviderIdx(idx));
      const first = await iterate(idx => isProviderIdx(idx));
      if (first) return first;
      if (hasOthers) {
        const second = await iterate(idx => !isProviderIdx(idx));
        if (second) return second;
      }
      levelTimelines.set(pick, tls);
    }
    entries.forEach((e, idx) => {
      if (e.status !== 'ok') return;
      if (isProviderIdx(idx)) {
        // 雷電などは、確実 ≥ 安定 ≥ 目安に揃える（他のキャラは、揃えずそのまま）
        e.stableEr = Math.max(e.stableEr ?? 0, e.typicalEr ?? 0);
        e.certainEr = Math.max(e.certainEr ?? 0, e.stableEr);
      }
      certainAdded.set(idx, Math.max(ER_FLOOR_FRACTION, (e.certainEr ?? 0) / 100) - baseFraction(idx));
    });
  }

  // 4. 確実の値の検証（全員を確実の値にして、全種で爆発が基準と一致するか。ずれたら、そのキャラを上げる。
  //    上げ幅は倍々に増やし、通ったあとは、ずれた値との間を半分ずつに絞る）
  //    集計の実行は全員が十分大きい ER なので、他のキャラの ER で量が変わる回復（雷電将軍の爆発など）は、ここで初めて分かる
  if (verify) phase = 'verify';
  phaseChunksDone = 0;
  report();
  const failedAt = new Map<number, number>(); // ずれた値の最大（足す分）
  const passedAt = new Map<number, number>(); // 全種が一致した値の最小（足す分）
  const stepOf = new Map<number, number>();
  let verified = false;
  let verifyRound = 0;
  // 検証の残り: ずれた記録があるキャラは、通った値（無ければ次の上げ幅）とずれた値の間を、許容まで半分ずつ絞る回数 × 1 回の平均の塊数。
  // 最初の周回の結果が出るまでは、事前の見積り（priorTrials）
  verifyEstimate = () => {
    const trialChunks = (chunkCost() + 1) / 2;
    if (verifyRound === 0 && failedAt.size === 0 && levelsVerify) return { low: chunkCost(), high: 4 * chunkCost() };
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
  for (let round = 0; verify && round < VERIFY_MAX_ROUNDS; round++) {
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
        // 検証は、立ち上がりの窓（数えない窓）も含め、全ての窓に遅れの許容（delayFrames）を適用する（立ち上がりの窓で遅れると、次の窓の粒子がエネルギーの上限で捨てられ、以降が連鎖して遅れるため）
        const ng = firstMismatchChar(baseline.get(chunk[k])!, burstSignature(res.logs), delayFrames, 0);
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
  if (verify && !verified && certainAdded.size > 0) return { status: 'error', message: t('gcsim:er.errorVerify') };

  // 4-B. 下げ直し: 検証は「最初にずれた爆発のキャラ」を上げるが、足りないのが別のキャラ（雷電将軍など）のとき、
  //      その回復を受けるキャラの爆発が先にずれて見え、足りているキャラまで上がる。通ったあとに、他を固定して 1 キャラずつ下げ直す
  //      （検証・下げ直しとも、立ち上がりの窓にも遅れの許容を適用する。通らない値には下げないので、最終の組み合わせは必ず全種で通る）
  if (verify && verified && !levelsVerify && certainAdded.size > 1) {
    const allMatch = async (): Promise<{ ok: boolean } | { error: RequiredErOutcome }> => {
      const config = verifyConfig();
      const order = lastFailSeed !== undefined && seeds.includes(lastFailSeed) ? [lastFailSeed, ...seeds.filter(s => s !== lastFailSeed)] : seeds;
      for (const chunk of chunksOf(order)) {
        if (cancelled()) return { error: { status: 'cancelled' } };
        const results = await runChunk(config, chunk);
        for (let k = 0; k < chunk.length; k++) {
          const res = results[k];
          if (res.status !== 'ok') return { error: { status: res.status, message: res.message } };
          if (firstMismatchChar(baseline.get(chunk[k])!, burstSignature(res.logs), delayFrames, 0) !== undefined) { lastFailSeed = chunk[k]; return { ok: false }; }
        }
      }
      return { ok: true };
    };
    // 下限: 足す分 0（武器・聖遺物の合計 ER）。これより下は、爆発が大きく遅れても「立ち上がりの遅れ」として許されて通ってしまうため探さない
    const lowerOf = (idx: number) => Math.min(certainAdded.get(idx)!, ER_FLOOR_FRACTION - baseFraction(idx));
    const isProvider = (idx: number) => (ER_VERIFY_CHARACTER_KEYS as readonly string[]).includes(members[idx].gcsimKey);
    const order = [...certainAdded.keys()]
      .filter(idx => certainAdded.get(idx)! - lowerOf(idx) > 1e-6) // 上げ幅が許容以内でも、下限で通るかを試す（概算の最初の上げ幅は許容と同じ大きさ）
      .sort((a, b) => Number(isProvider(a)) - Number(isProvider(b)) || (certainAdded.get(b)! - lowerOf(b)) - (certainAdded.get(a)! - lowerOf(a)));
    const shrinkTrials = (idx: number) => Math.max(1, Math.ceil(Math.log2(Math.max(certainAdded.get(idx)! - lowerOf(idx), verifyTolerance) / verifyTolerance))) + 1;
    let shrinkLeft = order.reduce((sum, idx) => sum + shrinkTrials(idx), 0);
    verifyEstimate = () => ({ low: shrinkLeft * 0.4 * ((chunkCost() + 1) / 2), high: shrinkLeft * 1.2 * ((chunkCost() + 1) / 2) });
    phaseChunksDone = 0;
    report();
    for (const idx of order) {
      let lo = lowerOf(idx);
      let hi = certainAdded.get(idx)!;
      certainAdded.set(idx, lo);
      const first = await allMatch();
      shrinkLeft = Math.max(0, shrinkLeft - 1);
      if ('error' in first) return first.error;
      if (first.ok) continue;
      while (hi - lo > verifyTolerance) {
        const mid = (lo + hi) / 2;
        certainAdded.set(idx, mid);
        const r = await allMatch();
        shrinkLeft = Math.max(0, shrinkLeft - 1);
        if ('error' in r) return r.error;
        if (r.ok) hi = mid; else lo = mid;
      }
      certainAdded.set(idx, hi);
    }
    verifyEstimate = () => ({ low: 0, high: 0 });
  }

  // 検証した値を、確実の値として反映する（検証で上がるのは確実だけ）
  entries.forEach((e, idx) => {
    const added = certainAdded.get(idx);
    if (e.status !== 'ok' || added === undefined) return;
    e.addedEr = Number(added.toFixed(4));
    // 検証した値を採る（計算のみの値は、記録した窓の最大。連鎖した遅れで高く出ることがあるので、検証して下げ直した値のほうが正確）。
    // 雷電などの回復を与えるキャラは、安定より低くしない。ほかのキャラは、そのまま（雷電などの値が高いために、下の段より低くなることがある）
    const verifiedEr = verify ? ceil1((baseFraction(idx) + added) * 100) : Math.max(e.certainEr ?? 0, ceil1((baseFraction(idx) + added) * 100));
    e.certainEr = levelsVerify && !isProviderIdx(idx) ? verifiedEr : Math.max(verifiedEr, e.stableEr ?? 0);
    e.stableEr = e.stableEr ?? e.certainEr;
    if (!levelsVerify || isProviderIdx(idx)) e.typicalEr = Math.min(e.typicalEr ?? e.stableEr, e.stableEr);
    e.typicalEr = e.typicalEr ?? e.stableEr;
  });
  // 足りる確率の推定（表示する値で、集計した窓のうち足りた割合。全窓が足りた確実は N÷(N+1)）
  entries.forEach((e, idx) => {
    if (e.status !== 'ok') return;
    const pct = (er: number | undefined, lastOne: boolean, list: EnergyTimeline[]): number | undefined => {
      if (er === undefined) return undefined;
      const { passed, total } = passCount(list, er, delayFrames, ER_WARMUP_WINDOWS);
      if (total === 0) return undefined;
      return Math.round((lastOne && passed === total ? total / (total + 1) : passed / total) * 100);
    };
    e.typicalPct = pct(e.typicalEr, false, (levelTimelines.get('typicalEr') ?? timelines).get(idx) ?? []);
    e.stablePct = pct(e.stableEr, false, (levelTimelines.get('stableEr') ?? timelines).get(idx) ?? []);
    e.certainPct = pct(e.certainEr, true, (levelTimelines.get('certainEr') ?? timelines).get(idx) ?? []);
    // 目安・安定の、種の数による誤差の範囲（検証で値が決まる編成は、窓の集計だけでは求まらないので出さない）
    if (!levelsVerify) {
      const list = timelines.get(idx) ?? [];
      const floor1 = (x: number | undefined) => x === undefined ? undefined : Math.floor(x * 10 + 1e-9) / 10;
      const ceil1o = (x: number | undefined) => x === undefined ? undefined : ceil1(x);
      const ti = requiredErInterval(list, 0.7, delayFrames, ER_WARMUP_WINDOWS);
      const si = requiredErInterval(list, 0.9, delayFrames, ER_WARMUP_WINDOWS);
      e.typicalErLow = floor1(ti?.low);
      e.typicalErHigh = ceil1o(ti?.high);
      e.stableErLow = floor1(si?.low);
      e.stableErHigh = ceil1o(si?.high);
    }
  });

  report();
  return {
    status: 'ok',
    result: { gcsimVersion, ranAt: Date.now(), elapsedMs: Date.now() - startedAt, seeds: seeds.length, windows: maxWindows, enemyParticles: enemyParticles ?? { minSeconds: 0, maxSeconds: 0, amount: 0 }, precise: verify && verifyTolerance <= ER_VERIFY_TOLERANCE_PRECISE, verified: verify, levelsVerified: levelsVerify, burstWaitSeconds, fingerprint: fingerprintOf(args.build({ ignoreBurstEnergy: true, added: {} }).config), entries },
  };
}
