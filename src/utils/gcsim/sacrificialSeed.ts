/**
 * 祭礼系の武器（祭礼の断片・剣・大剣・弓）のスキル CT リセットの、乱数の種の探索（フェーズ 6 の 6-4。D7・D80）。
 *
 * gcsim の判定は確率（`0.3 + 0.1 × 精錬`。精錬 5 で 80%）で、発動を強制する手段が無い。種を固定して 1 回だけ実行すると、
 * たまたま発動して CT が極端に短く読まれる（夢見月瑞希 E: 15.00s → 0.42s）ことも、発動せず読まれないこともある。
 * そこで、**発動できる機会のすべてで発動する種**を探して、その種で実行した結果を使う（ユーザー決定 D80 2026-10-09。
 * 実行は 2 周で終わるので、機会は 1・2 周目に限られる）。
 *
 * 発動できる機会（gcsim internal/weapons/common/sacrificial.go）: 使用者が場にいて、使用者のスキルのダメージ（AttackTagElementalArt = 4、ダメージ 0 でない）が敵に当たり、
 * そのとき使用者のスキルが CT 中で、武器の内部 CT（精錬 4 以上は `19 − 3×(精錬−4)` 秒、それ未満は `34 − 4×精錬` 秒）が明けているとき。
 * 機会は、ログから復元する（機会で発動しなかった分は、ログに残らないため）。
 */
import type { GcsimLogEvent, GcsimSampleResult } from './gcsimClient.ts';

export const SACRIFICIAL_WEAPON_KEYS = ['sacrificialfragments', 'sacrificialsword', 'sacrificialgreatsword', 'sacrificialbow'] as const;

/** 祭礼の武器の内部 CT（秒）。精錬 4 以上は `19 − 3×(精錬−4)`、それ未満は `34 − 4×精錬`（gcsim common/sacrificial.go） */
export const sacrificialIcdSeconds = (refine: number): number => (refine >= 4 ? 19 - (refine - 4) * 3 : 34 - refine * 4);

/** gcsim の AttackTagElementalArt（長押しのスキルは別のタグで、祭礼は発動しない） */
const ATTACK_TAG_ELEMENTAL_ART = 4;

/** 探索する種の最大数（見つからなければ、最良の種を使う） */
export const MAX_SEED_SEARCH = 300;
/** 同時に実行する数（gcsim のサーバーは並列で受けられる。1 回約 0.4 秒） */
const SEARCH_BATCH = 4;

export interface SacrificialUser {
  /** gcsim のキー（設定文の先頭の語） */
  charKey: string;
  /** 設定文での順番（ログの char_index） */
  index: number;
  weaponKey: string;
  refine: number;
  /** 武器の内部 CT（フレーム） */
  icdFrames: number;
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
    const refine = Number(m[3]);
    users.push({ charKey: m[1], index, weaponKey: m[2], refine, icdFrames: sacrificialIcdSeconds(refine) * 60 });
  }
  return users;
}

export interface SacrificialCheck {
  /** 発動できる機会（フレームごとに 1 回と数える） */
  opportunities: number;
  /** そのうち、発動した数 */
  procs: number;
  /** 発動しなかった機会のフレーム */
  missed: number[];
}

/** ログから、祭礼が発動できた機会と、発動した数を数える */
export function checkSacrificialProcs(logs: GcsimLogEvent[], users: SacrificialUser[], initialIndex: number): SacrificialCheck {
  const result: SacrificialCheck = { opportunities: 0, procs: 0, missed: [] };
  for (const user of users) {
    const procFrames = new Set(logs.filter(l => l.event === 'weapon' && l.char_index === user.index && /sacrificial proc'd/.test(l.msg)).map(l => l.frame));
    let active = initialIndex;
    let skillOnCooldown = false;
    let icdUntil = -Infinity;
    let lastCountedFrame = -1;
    for (const l of logs) {
      if (l.event === 'action' && l.msg.startsWith('executed swap') && l.char_index !== undefined) active = l.char_index;
      else if (l.event === 'cooldown' && l.char_index === user.index && l.logs?.type === 'skill') skillOnCooldown = String(l.logs.cooldown_queue ?? '') !== '';
      else if (l.event === 'damage' && l.char_index === user.index && l.logs?.['attack-tag'] === ATTACK_TAG_ELEMENTAL_ART) {
        const damage = Number(l.logs['damage'] ?? 0);
        if (!(damage > 0) || active !== user.index || !skillOnCooldown || l.frame < icdUntil || l.frame === lastCountedFrame) continue;
        lastCountedFrame = l.frame;
        result.opportunities++;
        if (procFrames.has(l.frame)) {
          result.procs++;
          icdUntil = l.frame + user.icdFrames;
        } else {
          result.missed.push(l.frame);
        }
      }
    }
  }
  return result;
}

export interface SacrificialSearchInfo {
  users: SacrificialUser[];
  /** 採用した種 */
  seed: number;
  /** 試した種の数 */
  searched: number;
  opportunities: number;
  procs: number;
  /** すべての機会で発動する種が見つかったか（false なら、最良の種を使っている） */
  ok: boolean;
}

export type SacrificialRunResult = GcsimSampleResult & { sacrificial?: SacrificialSearchInfo };

/**
 * 設定文を実行する。祭礼系の武器があれば、すべての機会で発動する種を探して、その種の結果を返す（無ければ、最初の種で 1 回だけ実行）。
 * run は、種を指定して 1 回実行する関数（runGcsimSample）
 */
export async function runWithSacrificialSeed(
  config: string,
  run: (config: string, seed: number) => Promise<GcsimSampleResult>,
  firstSeed = 1,
  maxSeeds = MAX_SEED_SEARCH,
): Promise<SacrificialRunResult> {
  const users = findSacrificialUsers(config);
  if (users.length === 0) return run(config, firstSeed);

  const order: string[] = [];
  for (const m of config.matchAll(/^(\w+) char /gm)) order.push(m[1]);

  let best: { res: Extract<GcsimSampleResult, { status: 'ok' }>; check: SacrificialCheck } | undefined;
  let searched = 0;
  for (let from = firstSeed; from < firstSeed + maxSeeds; from += SEARCH_BATCH) {
    const seeds = Array.from({ length: Math.min(SEARCH_BATCH, firstSeed + maxSeeds - from) }, (_, i) => from + i);
    const results = await Promise.all(seeds.map(seed => run(config, seed)));
    for (const res of results) {
      searched++;
      // 実行できなかったとき（設定文のエラー・サーバーに接続できない）は、その結果をそのまま返す
      if (res.status !== 'ok') return res;
      const initialIndex = res.initialCharacter ? order.indexOf(res.initialCharacter) : 0;
      const check = checkSacrificialProcs(res.logs, users, initialIndex);
      const info = (ok: boolean): SacrificialSearchInfo => ({ users, seed: res.seed, searched, opportunities: check.opportunities, procs: check.procs, ok });
      if (check.procs === check.opportunities) return { ...res, sacrificial: info(true) };
      const ratio = (c: SacrificialCheck) => (c.opportunities === 0 ? 1 : c.procs / c.opportunities);
      if (!best || ratio(check) > ratio(best.check)) best = { res, check };
    }
  }
  // 見つからなかった: 発動の割合が最も高い種を使う
  const b = best!;
  return { ...b.res, sacrificial: { users, seed: b.res.seed, searched, opportunities: b.check.opportunities, procs: b.check.procs, ok: false } };
}
