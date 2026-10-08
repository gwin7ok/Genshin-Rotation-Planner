/**
 * 祭礼系の武器（祭礼の断片・剣・大剣・弓）のスキル CT リセットの、乱数の種の探索（フェーズ 6 の 6-4。D7・D80・D86）。
 *
 * gcsim の判定は確率（`0.3 + 0.1 × 精錬`。精錬 5 で 80%）で、発動を強制する手段が無い。確率と内部 CT は、gcsim が設定文の `refine=N` から決める
 * （別に渡す手段は無い。アプリが渡す `refine` は、アプリの精錬と同じ）。
 * 一方、アプリでは、発動確率はどの精錬でも 100%（スキルのダメージが当たった時点で、使用者が場にいて・スキルが CT 中で・武器の内部 CT が明けていれば発動。
 * 内部 CT の長さだけが精錬で変わる）。そこで、**アプリで発動している箇所がすべて gcsim でも発動し、アプリで発動しない箇所で gcsim が発動しない種**を探して、
 * その種で実行した結果を使う（ユーザー決定 D86 2026-10-09）。そうすると、gcsim のスキルの CT の結果が、アプリの CT バー・武器効果のバーと一致する。
 *
 * アプリの発動（`SacrificialProc`: アクション ID・命中のフレーム・周）→ gcsim の予想時刻 =
 *   「そのアクションの gcsim での実行のフレーム（設定文のアクション `GcsimActionRef` と、gcsim のログの `executed ...` を、先頭から順に対応づける）+ 命中のフレーム」。
 * この時刻の前後 ±3 フレームに、同じキャラの `sacrificial proc'd` があれば、発動が一致。
 */
import type { GcsimLogEvent, GcsimSampleResult } from './gcsimClient.ts';
import type { GcsimActionRef } from './buildGcsimConfig.ts';
import type { SacrificialProc } from '../rotationCalculator.ts';

export const SACRIFICIAL_WEAPON_KEYS = ['sacrificialfragments', 'sacrificialsword', 'sacrificialgreatsword', 'sacrificialbow'] as const;

/** 祭礼の武器の内部 CT（秒）。精錬 4 以上は `19 − 3×(精錬−4)`、それ未満は `34 − 4×精錬`（gcsim common/sacrificial.go） */
export const sacrificialIcdSeconds = (refine: number): number => (refine >= 4 ? 19 - (refine - 4) * 3 : 34 - refine * 4);

/** 探索する種の最大数（見つからなければ、最良の種を使う） */
export const MAX_SEED_SEARCH = 300;
/** 同時に実行する数（gcsim のサーバーは並列で受けられる。1 回約 0.1〜0.4 秒） */
const SEARCH_BATCH = 4;
/** 発動の時刻の一致の許容（フレーム） */
const MATCH_TOLERANCE_FRAMES = 3;

export interface SacrificialUser {
  /** gcsim のキー（設定文の先頭の語） */
  charKey: string;
  /** 設定文での順番（ログの char_index） */
  index: number;
  weaponKey: string;
  refine: number;
}

/** 設定文から、祭礼系の武器を持つキャラを探す */
export function findSacrificialUsers(config: string): SacrificialUser[] {
  const order: string[] = [];
  for (const m of config.matchAll(/^(\w+) char /gm)) order.push(m[1]);
  const users: SacrificialUser[] = [];
  for (const m of config.matchAll(/^(\w+) add weapon="(\w+)"\s+refine=(\d+)/gm)) {
    if (!(SACRIFICIAL_WEAPON_KEYS as readonly string[]).includes(m[2])) continue;
    const index = order.indexOf(m[1]);
    if (index < 0) continue;
    users.push({ charKey: m[1], index, weaponKey: m[2], refine: Number(m[3]) });
  }
  return users;
}

export interface SacrificialMatch {
  /** アプリの発動の数 */
  expected: number;
  /** そのうち、gcsim でも同じ箇所で発動した数 */
  matched: number;
  /** アプリでは発動するのに、gcsim で発動しなかった数 */
  missing: number;
  /** アプリでは発動しないのに、gcsim で発動した数 */
  extras: number;
  /** gcsim のログのアクションを、設定文のアクションに対応づけられなかった（途中で止まったなど）。その場合、対応づけられない発動は missing に数える */
  unaligned: boolean;
}

const isLapMatch = (ref: GcsimActionRef, cycle: number): boolean =>
  cycle === 0 ? ref.phase === 'initial' || ref.loopIteration === 1 : ref.phase === 'loop' && ref.loopIteration === cycle + 1;

/** gcsim のログのうち、設定文のアクション（`GcsimActionRef`）に当たるもの（交代・待機を除く実行の順） */
function executedActions(logs: GcsimLogEvent[]): GcsimLogEvent[] {
  return logs.filter(l => {
    if (l.event !== 'action') return false;
    const m = l.msg.match(/^executed (\w+)/);
    return !!m && !['swap', 'wait', 'noop', 'delay'].includes(m[1]);
  });
}

/** アプリの発動と、gcsim のログの発動を照合する */
export function matchAppProcs(logs: GcsimLogEvent[], refs: GcsimActionRef[], appProcs: SacrificialProc[]): SacrificialMatch {
  const executed = executedActions(logs);
  const procEvents = logs.filter(l => l.event === 'weapon' && /sacrificial proc/.test(l.msg));
  const used = new Set<number>();
  let matched = 0;
  let unaligned = executed.length < refs.length;
  for (const p of appProcs) {
    const refIndex = refs.findIndex(r => r.actionId === p.actionId && isLapMatch(r, p.cycle));
    const exec = refIndex >= 0 ? executed[refIndex] : undefined;
    if (!exec || !exec.msg.includes(refs[refIndex].command)) {
      if (refIndex >= 0) unaligned = true;
      continue;
    }
    const expectFrame = exec.frame + p.hitFrame;
    const i = procEvents.findIndex((e, k) => !used.has(k) && e.char_index === exec.char_index && Math.abs(e.frame - expectFrame) <= MATCH_TOLERANCE_FRAMES);
    if (i >= 0) {
      used.add(i);
      matched++;
    }
  }
  return { expected: appProcs.length, matched, missing: appProcs.length - matched, extras: procEvents.length - used.size, unaligned };
}

export interface SacrificialSearchInfo {
  users: SacrificialUser[];
  /** 採用した種 */
  seed: number;
  /** 試した種の数 */
  searched: number;
  expected: number;
  matched: number;
  missing: number;
  extras: number;
  /** アプリの発動がすべて発動し、余分な発動も無い種が見つかったか（false なら、最も近い種を使っている） */
  ok: boolean;
}

export type SacrificialRunResult = GcsimSampleResult & { sacrificial?: SacrificialSearchInfo };

export interface SacrificialSearchInput {
  /** アプリの計算の、祭礼の武器の発動（`calculateRotation` の `sacrificialProcs`） */
  appProcs: SacrificialProc[];
  /** 設定文のアクション（`buildGcsimConfig` の `actionRefs`） */
  refs: GcsimActionRef[];
}

/** 種の良さ（大きいほど良い）: 発動の不足・余分が少ない */
const score = (m: SacrificialMatch) => -(m.missing * 2 + m.extras) - (m.unaligned ? 0.5 : 0);

/**
 * 設定文を実行する。祭礼系の武器があれば、アプリの発動に合う種（アプリの発動がすべて発動し、余分な発動が無い）を探して、その種の結果を返す
 * （無ければ、最初の種で 1 回だけ実行）。見つからなければ、最も近い種（不足・余分が最も少ない。同じなら小さい種）を使う。
 * run は、種を指定して 1 回実行する関数（runGcsimSample）
 */
export async function runWithSacrificialSeed(
  config: string,
  run: (config: string, seed: number) => Promise<GcsimSampleResult>,
  input: SacrificialSearchInput,
  firstSeed = 1,
  maxSeeds = MAX_SEED_SEARCH,
): Promise<SacrificialRunResult> {
  const users = findSacrificialUsers(config);
  if (users.length === 0) return run(config, firstSeed);

  let best: { res: Extract<GcsimSampleResult, { status: 'ok' }>; match: SacrificialMatch } | undefined;
  let searched = 0;
  for (let from = firstSeed; from < firstSeed + maxSeeds; from += SEARCH_BATCH) {
    const seeds = Array.from({ length: Math.min(SEARCH_BATCH, firstSeed + maxSeeds - from) }, (_, i) => from + i);
    const results = await Promise.all(seeds.map(seed => run(config, seed)));
    for (const res of results) {
      searched++;
      // 実行できなかったとき（設定文のエラー・サーバーに接続できない）は、その結果をそのまま返す
      if (res.status !== 'ok') return res;
      const match = matchAppProcs(res.logs, input.refs, input.appProcs);
      if (match.missing === 0 && match.extras === 0 && !match.unaligned) {
        return { ...res, sacrificial: { users, seed: res.seed, searched, ...pick(match), ok: true } };
      }
      if (!best || score(match) > score(best.match)) best = { res, match };
    }
  }
  const b = best!;
  return { ...b.res, sacrificial: { users, seed: b.res.seed, searched, ...pick(b.match), ok: false } };
}

const pick = (m: SacrificialMatch) => ({ expected: m.expected, matched: m.matched, missing: m.missing, extras: m.extras });
