/**
 * 必要な元素チャージ効率（ER）の算出（フェーズ7 / issue #46。D242）
 *
 * ローテーションの全キャラの爆発が、毎周エネルギー待ちなしに出るための、キャラごとの最小の ER を求める。
 * 純粋なロジック（gcsim の実行は run として受け取る）。画面は EnergyRechargeDialog、保存は appSettings.ts。
 *
 * 方式（docs/gcsim-integration/phase-7-required-er/plan.md）:
 *   - 基準: `ignore_burst_energy=true` の実行の、爆発の実行（キャラ@フレーム）の並び
 *   - 試す設定: 爆発のエネルギーを有効にし、調べるキャラだけ ER を変え、他のキャラは十分大きい ER にする
 *   - 成功: 全ての種で、爆発の並びが基準と一致する（エネルギー不足で待たされると、行動リストがそこで止まる）
 *   - 二分探索: 自分の ER は自分のエネルギーだけに効く（単調）ので、キャラごとに独立して探す
 */
import type { GcsimConfigResult } from './buildGcsimConfig';
import { t } from '../../i18n';
import type { GcsimLogEvent, GcsimSampleResult } from './gcsimClient';

/** 試す乱数の種の数（1 〜 この数）。粒子の出方は種で変わるので、全部の種で成功する値を求める */
export const ER_SEEDS = 10;
/** 探索する ER の上限（足す分の割合。5 = +500%）。ここでも失敗すれば「届かない」 */
export const ER_MAX_ADDED = 5;
/** 探索の刻み（足す分の割合。0.01 = 1%） */
export const ER_STEP = 0.01;
/** 調べていないキャラの ER（足す分。エネルギー不足で止まらない十分大きい値） */
const ER_OTHERS_ADDED = 10;

export interface RequiredErEntry {
  characterId: string;
  name: string;
  /**
   * ok = 求まった / unreachable = 上限でも爆発が間に合わない / noBurst = ローテーションに爆発が無い
   */
  status: 'ok' | 'unreachable' | 'noBurst';
  /** 仮ステータスに足す ER（割合。status = ok のとき） */
  addedEr?: number;
  /** 必要な ER の合計（%。武器・聖遺物のサブステなどの分を含む。status = ok のとき） */
  totalEr?: number;
}

export interface RequiredErResult {
  /** 求めたときの gcsim のバージョン */
  gcsimVersion: string;
  /** 実行した日時（ミリ秒） */
  ranAt: number;
  /** 使った種の数 */
  seeds: number;
  /** 求めたときの編成・ローテーションの指紋（今の設定文と比べて、変わっていないかを調べる） */
  fingerprint: string;
  entries: RequiredErEntry[];
}

export interface RequiredErProgress {
  /** 調べ終えたキャラの数 */
  done: number;
  total: number;
  /** 今調べているキャラの名前 */
  name: string;
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

/**
 * 必要な ER を求める。
 * @param fingerprintText 指紋にする設定文（通常の設定文 = `ignoreBurstEnergy: true`、ER なし）
 */
export async function computeRequiredEr(args: {
  build: BuildForEr;
  run: RunSample;
  gcsimVersion: string;
  onProgress?: (p: RequiredErProgress) => void;
  shouldCancel?: () => boolean;
}): Promise<RequiredErOutcome> {
  const { build, run, gcsimVersion, onProgress, shouldCancel } = args;
  const cancelled = () => shouldCancel?.() === true;

  const base = build({ ignoreBurstEnergy: true, added: {} });
  if (!base.runnable) {
    return { status: 'error', message: base.warnings.filter(w => w.level === 'error').map(w => w.message).join('\n') };
  }
  const members = base.members;
  const memberIds = members.map(m => m.characterId);

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

  // 2. 全員を十分大きい ER にして、基準と一致する種だけを使う（祭礼の武器など、種で展開が変わる場合の対策）
  const allHigh = Object.fromEntries(memberIds.map(id => [id, ER_OTHERS_ADDED]));
  const highConfig = build({ ignoreBurstEnergy: false, added: allHigh }).config;
  const seeds: number[] = [];
  for (let seed = 1; seed <= ER_SEEDS; seed++) {
    if (cancelled()) return { status: 'cancelled' };
    const res = await run(highConfig, seed);
    if (res.status !== 'ok') return { status: res.status, message: res.message };
    if (burstSignature(res.logs) === baseline.get(seed)) seeds.push(seed);
  }
  if (seeds.length === 0) {
    return { status: 'error', message: t('gcsim:er.errorMismatch') };
  }

  // 3. キャラごとの二分探索
  const entries: RequiredErEntry[] = [];
  let failingSeed: number | undefined;
  for (let idx = 0; idx < members.length; idx++) {
    const m = members[idx];
    onProgress?.({ done: idx, total: members.length, name: m.name });
    const hasBurst = [...baseline.values()].some(sig => sig.split(',').some(s => s.startsWith(`${idx}@`)));
    if (!hasBurst) {
      entries.push({ characterId: m.characterId, name: m.name, status: 'noBurst' });
      continue;
    }
    /** このキャラの ER（足す分）が x のとき、使う全ての種で爆発が基準と一致するか。null = 中止・実行の失敗 */
    let failure: RequiredErOutcome | undefined;
    const passes = async (x: number): Promise<boolean | null> => {
      const added = { ...Object.fromEntries(memberIds.map(id => [id, ER_OTHERS_ADDED])), [m.characterId]: x };
      const config = build({ ignoreBurstEnergy: false, added }).config;
      // 前に失敗した種を先に試す（失敗が早く分かる）
      const order = failingSeed !== undefined && seeds.includes(failingSeed) ? [failingSeed, ...seeds.filter(s => s !== failingSeed)] : seeds;
      for (const seed of order) {
        if (cancelled()) { failure = { status: 'cancelled' }; return null; }
        const res = await run(config, seed);
        if (res.status !== 'ok') { failure = { status: res.status, message: res.message }; return null; }
        if (burstSignature(res.logs) !== baseline.get(seed)) { failingSeed = seed; return false; }
      }
      return true;
    };
    const top = await passes(ER_MAX_ADDED);
    if (top === null) return failure!;
    if (!top) {
      entries.push({ characterId: m.characterId, name: m.name, status: 'unreachable' });
      continue;
    }
    let lo = 0;
    let hi = ER_MAX_ADDED;
    const zero = await passes(0);
    if (zero === null) return failure!;
    if (zero) hi = 0;
    while (hi - lo > ER_STEP + 1e-9 && hi > 0) {
      const mid = (lo + hi) / 2;
      const ok = await passes(mid);
      if (ok === null) return failure!;
      if (ok) hi = mid; else lo = mid;
    }
    // 刻みに切り上げる
    const addedEr = Math.ceil(hi / ER_STEP - 1e-9) * ER_STEP;
    const baseFraction = baseEr.get(idx) ?? 1;
    entries.push({
      characterId: m.characterId,
      name: m.name,
      status: 'ok',
      addedEr: Number(addedEr.toFixed(4)),
      totalEr: Math.round((baseFraction + addedEr) * 1000) / 10,
    });
  }
  onProgress?.({ done: members.length, total: members.length, name: '' });

  return {
    status: 'ok',
    result: { gcsimVersion, ranAt: Date.now(), seeds: seeds.length, fingerprint: fingerprintOf(base.config), entries },
  };
}
