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
 *   3. 3 段: 窓の分布の 中央値 = 目安 / 90% 点 = 安定 / 最大 = 確実（全ての窓で足りる）
 *   4. 確実の値を gcsim で確かめる（全員を確実の値にして、全種で爆発が基準と一致するか。足りなければ上げる）
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
/** 確実の値が確かめで足りなかったときに、上げる幅（足す分の割合） */
const VERIFY_BUMP = 0.02;
/** 確かめの繰り返しの上限（無限ループの防止） */
const VERIFY_MAX_ROUNDS = 40;
/** 実行回数の見積り（基準 + 集計 + 確かめ。残り時間の推定に使う） */
const RUNS_ESTIMATE = ER_SEEDS * 4 + 10;

export interface RequiredErEntry {
  characterId: string;
  name: string;
  /**
   * ok = 求まった / unreachable = 確実の値が上限を超える・粒子が無い / noBurst = 周回の中に爆発が 2 回以上ない（窓が無い）
   */
  status: 'ok' | 'unreachable' | 'noBurst';
  /** 目安: 窓の中央値（必要な ER の合計 %。武器・聖遺物のサブステなどの分を含む） */
  typicalEr?: number;
  /** 安定: 窓の 90% 点（%） */
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

export type BuildForEr = (extra: { ignoreBurstEnergy: boolean; added: Record<string, number> }) => GcsimConfigResult;
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
  events: ({ kind: 'particle'; raw: number } | { kind: 'flat'; amount: number } | { kind: 'burst'; cost: number })[];
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
    if (l.msg === 'draining energy') {
      const pre = Number(l.logs?.pre_drain);
      const post = Number(l.logs?.post_drain);
      tl.events.push({ kind: 'burst', cost: Number.isFinite(pre) && Number.isFinite(post) ? pre - post : tl.max });
    } else if (l.msg === 'particle') {
      const er = Number(l.logs?.ER);
      const amt = Number(l.logs?.amt);
      if (Number.isFinite(er) && er > 0 && Number.isFinite(amt)) tl.events.push({ kind: 'particle', raw: amt / er });
    } else if (l.msg === 'adding energy') {
      const rec = Number(l.logs?.["rec'd"]);
      const pre = Number(l.logs?.pre_recovery);
      const post = Number(l.logs?.post_recovery);
      const amount = Number.isFinite(rec) ? rec : Number.isFinite(pre) && Number.isFinite(post) ? post - pre : 0;
      tl.events.push({ kind: 'flat', amount });
    }
  }
  return out;
}

/**
 * ER（合計 %）のときの、爆発ごとの成否を数える（最初の爆発は、初期エネルギーが満タンなので数えない）。
 * エネルギーは、粒子 × ER + 固定の回復を足して上限で切り、爆発で消費量を引く（足りなかった爆発も、消費したものとして続ける。窓どうしを独立に数えるため）。
 */
export function passCount(timelines: EnergyTimeline[], erPercent: number): { passed: number; total: number } {
  let passed = 0;
  let total = 0;
  for (const tl of timelines) {
    let energy = tl.max;
    let first = true;
    for (const ev of tl.events) {
      if (ev.kind === 'particle') energy = Math.min(tl.max, energy + (ev.raw * erPercent) / 100);
      else if (ev.kind === 'flat') energy = Math.min(tl.max, energy + ev.amount);
      else {
        if (first) first = false;
        else { total++; if (energy >= ev.cost - 1e-9) passed++; }
        energy = Math.max(0, energy - ev.cost);
      }
    }
  }
  return { passed, total };
}

/** ER の探索の上限（合計 %）。これで足りない割合は Infinity（届かない） */
const ER_SEARCH_CAP_PERCENT = (ER_MAX_ADDED + 2) * 100;

/**
 * 爆発の rate（0〜1）の割合が足りる最小の ER（合計 %）。rate = 0.5 で目安、0.9 で安定、1 で確実（全ての爆発）。
 * 爆発が無い（数える爆発が 0）ときは undefined。上限でも足りないときは Infinity
 */
export function requiredErForRate(timelines: EnergyTimeline[], rate: number): number | undefined {
  const ok = (er: number) => { const { passed, total } = passCount(timelines, er); return passed >= Math.ceil(total * rate - 1e-9); };
  if (passCount(timelines, 0).total === 0) return undefined;
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
function firstMismatchChar(baseline: string, test: string): number | undefined {
  if (baseline === test) return undefined;
  const a = baseline.split(',');
  const b = test.split(',');
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return Number(a[i].split('@')[0]);
  }
  return undefined;
}

/** 必要な ER を求める */
export async function computeRequiredEr(args: {
  build: BuildForEr;
  run: RunSample;
  gcsimVersion: string;
  onProgress?: (p: RequiredErProgress) => void;
  shouldCancel?: () => boolean;
}): Promise<RequiredErOutcome> {
  const { build, gcsimVersion, onProgress, shouldCancel } = args;
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

  // 2. 集計: 全員を十分大きい ER にして、窓ごとの必要な ER を集める。基準と一致する種だけを使う（祭礼の武器など、種で展開が変わる場合の対策）
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

  // 3. 3 段（目安 = 爆発の 50% が足りる / 安定 = 90% / 確実 = 全て）。数える爆発が無いキャラは「爆発なし」
  const entries: RequiredErEntry[] = [];
  const certainAdded = new Map<number, number>();
  const baseFraction = (idx: number) => baseEr.get(idx) ?? 1;
  let maxWindows = 0;
  members.forEach((m, idx) => {
    const list = timelines.get(idx) ?? [];
    const certain = requiredErForRate(list, 1);
    if (certain === undefined) {
      entries.push({ characterId: m.characterId, name: m.name, status: 'noBurst' });
      return;
    }
    maxWindows = Math.max(maxWindows, passCount(list, 0).total);
    const added = certain / 100 - baseFraction(idx);
    if (!Number.isFinite(certain) || added > ER_MAX_ADDED) {
      entries.push({ characterId: m.characterId, name: m.name, status: 'unreachable' });
      return;
    }
    certainAdded.set(idx, Math.max(0, added));
    entries.push({
      characterId: m.characterId,
      name: m.name,
      status: 'ok',
      typicalEr: ceil1(requiredErForRate(list, 0.5)!),
      stableEr: ceil1(requiredErForRate(list, 0.9)!),
      certainEr: ceil1(certain),
    });
  });

  // 4. 確実の値の確かめ（全員を確実の値にして、全種で爆発が基準と一致するか。ずれたら、そのキャラを上げて繰り返す）
  phase = 'verify';
  report();
  for (let round = 0; round < VERIFY_MAX_ROUNDS; round++) {
    const added: Record<string, number> = {};
    members.forEach((m, idx) => { added[m.characterId] = certainAdded.get(idx) ?? ER_OTHERS_ADDED; });
    const config = build({ ignoreBurstEnergy: false, added }).config;
    let bump: number | undefined;
    for (const seed of seeds) {
      if (cancelled()) return { status: 'cancelled' };
      const res = await run(config, seed);
      if (res.status !== 'ok') return { status: res.status, message: res.message };
      const ng = firstMismatchChar(baseline.get(seed)!, burstSignature(res.logs));
      if (ng !== undefined) { bump = ng; break; }
    }
    if (bump === undefined) break;
    const cur = certainAdded.get(bump);
    if (cur === undefined) break; // 爆発なし・届かないキャラのずれは、ここでは直せない
    const next = cur + VERIFY_BUMP;
    if (next > ER_MAX_ADDED) {
      certainAdded.delete(bump);
      const e = entries[bump];
      entries[bump] = { characterId: e.characterId, name: e.name, status: 'unreachable' };
    } else {
      certainAdded.set(bump, next);
    }
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
    result: { gcsimVersion, ranAt: Date.now(), elapsedMs: Date.now() - startedAt, seeds: seeds.length, windows: maxWindows, fingerprint: fingerprintOf(base.config), entries },
  };
}
