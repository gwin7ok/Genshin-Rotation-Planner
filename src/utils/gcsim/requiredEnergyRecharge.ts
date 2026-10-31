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
export const ER_LOOP_ITERATIONS = 5;
/** 試す乱数の種の数（1 〜 この数）。粒子の出方は種で変わる */
export const ER_SEEDS = 10;
/** 探索の上限（足す分の割合。5 = +500%）。確実の値がこれを超えれば「届かない」 */
export const ER_MAX_ADDED = 5;
/** 他のキャラの ER（足す分。エネルギー不足で止まらない十分大きい値） */
const ER_OTHERS_ADDED = 10;
/** 合計 ER の下限（割合。0.5 = 50%）。武器・聖遺物の ER が多いキャラで、足す分をマイナスにして、本当に必要な ER を求めるときの下限 */
/** 確実の値が確かめで足りなかったときに、上げる幅（足す分の割合） */
const VERIFY_BUMP = 0.05;
/** 確かめで、値を絞るのをやめる幅（足す分の割合。0.05 = 5%） */
const VERIFY_TOLERANCE = 0.05;
/** 確かめの繰り返しの上限（無限ループの防止） */
const VERIFY_MAX_ROUNDS = 60;
/** 爆発が基準より遅れてもよいフレーム数（これ以内のずれは「足りた」とみなす） */
export const ER_BURST_DELAY_FRAMES = 30;
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
export function passCount(timelines: EnergyTimeline[], erPercent: number, delayFrames = 0): { passed: number; total: number } {
  let passed = 0;
  let total = 0;
  for (const tl of timelines) {
    let energy = tl.max;
    let first = true;
    const gain = (ev: EnergyTimeline['events'][number]) => ev.kind === 'particle' ? (ev.raw * erPercent) / 100 : ev.kind === 'flat' ? ev.amount : 0;
    for (let i = 0; i < tl.events.length; i++) {
      const ev = tl.events[i];
      if (ev.kind === 'particle' || ev.kind === 'flat') energy = Math.min(tl.max, energy + gain(ev));
      else {
        if (first) first = false;
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
export function requiredErForRate(timelines: EnergyTimeline[], rate: number, delayFrames = 0): number | undefined {
  const ok = (er: number) => { const { passed, total } = passCount(timelines, er, delayFrames); return passed >= Math.ceil(total * rate - 1e-9); };
  if (passCount(timelines, 0, delayFrames).total === 0) return undefined;
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
export function firstMismatchChar(baseline: string, test: string, delayFrames = 0): number | undefined {
  if (baseline === test) return undefined;
  const a = baseline.split(',');
  const b = test.split(',');
  for (let i = 0; i < a.length; i++) {
    if (b[i] === undefined) return Number(a[i].split('@')[0]);
    const [ca, fa] = a[i].split('@').map(Number);
    const [cb, fb] = b[i].split('@').map(Number);
    if (ca !== cb || Math.abs(fa - fb) > delayFrames) return ca;
  }
  return undefined;
}

/** 必要な ER を求める */
export async function computeRequiredEr(args: {
  build: BuildForEr;
  /** 敵の粒子（無ければ出さない） */
  enemyParticles?: EnemyParticles;
  run: RunSample;
  gcsimVersion: string;
  onProgress?: (p: RequiredErProgress) => void;
  shouldCancel?: () => boolean;
}): Promise<RequiredErOutcome> {
  const { gcsimVersion, onProgress, shouldCancel } = args;
  const enemyParticles = args.enemyParticles;
  const build: BuildForEr = extra => args.build({ ...extra, enemyParticles });
  const cancelled = () => shouldCancel?.() === true;
  const startedAt = Date.now();
  let runsDone = 0;
  let phase: RequiredErPhase = 'baseline';
  const report = () => onProgress?.({ phase, runsDone, runsExpected: Math.max(RUNS_ESTIMATE, runsDone + 1) });
  const run: RunSample = async (config, seed) => {
    const res = await args.run(config, seed);
    runsDone++;
    report();
    return res;
  };

  const base = build({ ignoreBurstEnergy: true, added: {} });
  if (!base.runnable) {
    return { status: 'error', message: base.warnings.filter(w => w.level === 'error').map(w => w.message).join('\n') };
  }
  const members = base.members;
  const memberIds = members.map(m => m.characterId);
  report();

  // 1. 基準（種ごと）。実行の失敗はそのまま返す
  const baseline = new Map<number, string>();
  let baseEr = new Map<number, number>();
  for (let seed = 1; seed <= ER_SEEDS; seed++) {
    if (cancelled()) return { status: 'cancelled' };
    const res = await run(base.config, seed);
    if (res.status !== 'ok') return { status: res.status, message: res.message };
    baseline.set(seed, burstSignature(res.logs));
    if (seed === 1) baseEr = energyRechargeByCharIndex(res.logs);
  }

  // 2. 集計: 全員を十分大きい ER にして実行し、窓ごとの必要な ER を集める。基準と一致する種だけを使う（祭礼の武器など、種で展開が変わる場合の対策）
  //    （他のキャラの ER で量が変わる回復 = 雷電将軍の爆発などは、ここでは多く出て、必要な ER が低く出る。確かめ・見直しで直す）
  phase = 'collect';
  report();
  const highConfig = build({ ignoreBurstEnergy: false, added: Object.fromEntries(memberIds.map(id => [id, ER_OTHERS_ADDED])) }).config;
  const seeds: number[] = [];
  const timelines = new Map<number, EnergyTimeline[]>();
  for (let seed = 1; seed <= ER_SEEDS; seed++) {
    if (cancelled()) return { status: 'cancelled' };
    const res = await run(highConfig, seed);
    if (res.status !== 'ok') return { status: res.status, message: res.message };
    if (burstSignature(res.logs) !== baseline.get(seed)) continue;
    seeds.push(seed);
    for (const [i, tl] of collectEnergyTimelines(res.logs)) timelines.set(i, [...(timelines.get(i) ?? []), tl]);
  }
  if (seeds.length === 0) return { status: 'error', message: t('gcsim:er.errorMismatch') };

  // 3. 3 段（目安 = 爆発の 70% が足りる / 安定 = 90% / 確実 = 全て）。数える爆発が無いキャラは「爆発なし」
  const entries: RequiredErEntry[] = [];
  const certainAdded = new Map<number, number>();
  const baseFraction = (idx: number) => baseEr.get(idx) ?? 1;
  let maxWindows = 0;
  members.forEach((m, idx) => {
    const list = timelines.get(idx) ?? [];
    const certain = requiredErForRate(list, 1, ER_BURST_DELAY_FRAMES);
    if (certain === undefined) {
      entries.push({ characterId: m.characterId, name: m.name, status: 'noBurst' });
      return;
    }
    maxWindows = Math.max(maxWindows, passCount(list, 0, ER_BURST_DELAY_FRAMES).total);
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
      typicalEr: ceil1(requiredErForRate(list, 0.7, ER_BURST_DELAY_FRAMES)!),
      stableEr: ceil1(requiredErForRate(list, 0.9, ER_BURST_DELAY_FRAMES)!),
      certainEr: ceil1(certain),
    });
  });

  // 4. 確実の値の確かめ（全員を確実の値にして、全種で爆発が基準と一致するか。ずれたら、そのキャラを上げる。
  //    上げ幅は倍々に増やし、通ったあとは、ずれた値との間を半分ずつに絞る）
  //    集計の実行は全員が十分大きい ER なので、他のキャラの ER で量が変わる回復（雷電将軍の爆発など）は、ここで初めて分かる
  phase = 'verify';
  report();
  const failedAt = new Map<number, number>(); // ずれた値の最大（足す分）
  const passedAt = new Map<number, number>(); // 全種が一致した値の最小（足す分）
  const stepOf = new Map<number, number>();
  let verified = false;
  let lastFailSeed: number | undefined; // 前回ずれた種を先に実行する（ずれるときは、1 回の実行で分かる）
  const verifyConfig = () => {
    const added: Record<string, number> = {};
    members.forEach((m, idx) => { added[m.characterId] = certainAdded.get(idx) ?? ER_OTHERS_ADDED; });
    return build({ ignoreBurstEnergy: false, added }).config;
  };
  for (let round = 0; round < VERIFY_MAX_ROUNDS; round++) {
    const config = verifyConfig();
    let bump: number | undefined;
    const order = lastFailSeed !== undefined && seeds.includes(lastFailSeed) ? [lastFailSeed, ...seeds.filter(s => s !== lastFailSeed)] : seeds;
    for (const seed of order) {
      if (cancelled()) return { status: 'cancelled' };
      const res = await run(config, seed);
      if (res.status !== 'ok') return { status: res.status, message: res.message };
      const ng = firstMismatchChar(baseline.get(seed)!, burstSignature(res.logs), ER_BURST_DELAY_FRAMES);
      if (ng !== undefined) { bump = ng; lastFailSeed = seed; break; }
    }
    if (bump === undefined) {
      // 全種が一致。ずれた値との差が大きいキャラを、間まで下げて試す
      for (const [idx, cur] of certainAdded) passedAt.set(idx, Math.min(passedAt.get(idx) ?? Infinity, cur));
      let target: number | undefined;
      let gap = VERIFY_TOLERANCE;
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
    const pass = passedAt.get(bump);
    let next: number;
    if (pass !== undefined && pass > cur) {
      next = pass - cur <= VERIFY_TOLERANCE ? pass : (cur + pass) / 2;
    } else {
      const step = stepOf.get(bump) ?? VERIFY_BUMP;
      stepOf.set(bump, step * 2);
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
  if (certainAdded.size > 0) {
    phase = 'verify';
    const finalConfig = verifyConfig();
    const finalTimelines = new Map<number, EnergyTimeline[]>();
    for (const seed of seeds) {
      if (cancelled()) return { status: 'cancelled' };
      const res = await run(finalConfig, seed);
      if (res.status !== 'ok') return { status: res.status, message: res.message };
      for (const [i, tl] of collectEnergyTimelines(res.logs)) finalTimelines.set(i, [...(finalTimelines.get(i) ?? []), tl]);
    }
    entries.forEach((e, idx) => {
      if (e.status !== 'ok') return;
      const list = finalTimelines.get(idx) ?? [];
      const typical = requiredErForRate(list, 0.7, ER_BURST_DELAY_FRAMES);
      const stable = requiredErForRate(list, 0.9, ER_BURST_DELAY_FRAMES);
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

  report();
  return {
    status: 'ok',
    result: { gcsimVersion, ranAt: Date.now(), elapsedMs: Date.now() - startedAt, seeds: seeds.length, windows: maxWindows, enemyParticles: enemyParticles ?? { minSeconds: 0, maxSeconds: 0, amount: 0 }, fingerprint: fingerprintOf(args.build({ ignoreBurstEnergy: true, added: {} }).config), entries },
  };
}
