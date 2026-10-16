import skillHitFrameData from '../../data/skill_hit_frames.json';
import canQueueAfterData from '../../data/can_queue_after.json';
import hitlagData from '../../data/hitlag_frames.json';
import { CharacterActionInstance } from '../../types/genshin';
import type { CancelTarget } from '../../types/genshin';

/**
 * スキル・爆発の「次の行動を受け付け始めるフレーム」（gcsim の CanQueueAfter。scripts/probe-can-queue-after.ts が実測で作る）。
 * 待機（`wait`）は、アクションの実行の後、この時刻から始まる（gcsim run.go: queuePhase → handleWait）
 */
export const CAN_QUEUE_AFTER = (canQueueAfterData as { entries: Record<string, number> }).entries;
/** 防御ヒットストップなしのときの値（ありのときと違うものだけ） */
export const CAN_QUEUE_AFTER_NO_DEFHALT = ((canQueueAfterData as { entriesNoDefHalt?: Record<string, number> }).entriesNoDefHalt) ?? {};

/**
 * ヒットストップで延びるフレーム（gcsim の実測。scripts/probe-hitlag.ts が作る。D215）。キー = アクション定義 ID。
 * 通常攻撃は段ごとの配列。`with` = 敵の防御ヒットストップあり（既定）、`without` = なし。
 * マスターのフレーム表（gcsim の skillFrames など）は、これを含まない。
 */
export type HitlagPair = { with: number; without: number };
/**
 * `d0` = 遅延（アクション遅延）なしのときの値（標準の遅延のときと違うときだけ）。
 * 重撃だけ `afterNormal`（通常攻撃の直後の値。触媒の重撃などは、通常攻撃の直後だと、窓（windup）を省いて短くなる。
 * gcsim の動きはキャラごとに違い、遅延が 1f でもあると省かないキャラ（リサ）がいる。`d0` は、直前の通常攻撃の遅延がないときの値）
 */
export type HitlagBase0 = HitlagPair & { d0?: HitlagPair };
/** `byNext` = 次のアクションの種類（skill・burst・dash・jump・swap）が、次が通常攻撃のときと値が違うときだけ（D219） */
export type HitlagBase = HitlagBase0 & { byNext?: Record<string, HitlagBase0> };
/** `ext` = モード（状態）の終わりが、そのヒットのヒットストップで延びるフレーム（モードの通常攻撃・重撃のキー `<opener>#n` / `#ca` だけ。gcsim の `mod extended`） */
export type HitlagEntry = HitlagBase & { afterNormal?: HitlagBase; ext?: HitlagPair; /** 通常攻撃の 1 段目だけ。重撃の直後の、通常のときとの差（構えの違い。D229） */ afterCharged?: HitlagAfter; /** 爆発の直後の差（同じ意味） */ afterBurst?: HitlagAfter; afterSkill?: HitlagAfter; afterDash?: HitlagAfter; afterJump?: HitlagAfter };
/** `byNext` = 次のアクションの種類ごとの差（次が通常攻撃のときと違うものだけ） */
export type HitlagAfter = HitlagBase0 & { byNext?: Record<string, HitlagBase0> };
export const HITLAG_FRAMES = (hitlagData as { entries: Record<string, HitlagEntry | HitlagEntry[]> }).entries;


/** 次に続くアクションの種類 → キャンセルフレームの表のキー（gcsim の action.ActionXxx）。出場の最後は次が交代。'wait' = 次が待機（CanQueueAfter） */
export type NextKey = CancelTarget | 'wait';

/**
 * 次が待機のときの、アクションの所要時間（フレーム）。gcsim は、アクションの実行の後、CanQueueAfter（最も早いキャンセル）まで進めてから待機を始める。
 * 実測の表（スキル・爆発）があればそれ、無ければキャンセルの表の最小値（実測と 374 件中 322 件が一致、349 件が 6 フレーム以内）、それも無ければ全体のフレーム
 */
export function canQueueFrames(frames: { total: number; cancels: Partial<Record<CancelTarget, number>> }, def: { id: string; frames?: unknown } | undefined, defHalt = true): number {
  const measured = def && frames === def.frames ? (!defHalt ? CAN_QUEUE_AFTER_NO_DEFHALT[def.id] : undefined) ?? CAN_QUEUE_AFTER[def.id] : undefined;
  if (measured !== undefined) return measured;
  const values = Object.values(frames.cancels).filter((v): v is number => typeof v === 'number' && v > 0);
  return values.length > 0 ? Math.min(...values) : frames.total;
}

export function cancelKeyOf(next: CharacterActionInstance | undefined, weaponType?: string): NextKey | undefined {
  if (!next) return 'swap';
  switch (next.type) {
    case 'wait': return 'wait';
    case 'normal': return 'attack';
    case 'charged': return weaponType === 'bow' ? 'aim' : 'charge';
    case 'skill':
    case 'skill_hold':
    case 'skill_reset': return 'skill';
    case 'burst': return 'burst';
    case 'dash': return 'dash';
    case 'jump': return 'jump';
    case 'plunge_low': return 'lowPlunge';
    case 'plunge_high': return 'highPlunge';
    default: return undefined; // 待機など: 全体のフレーム
  }
}

/**
 * スキルのダメージが敵に当たる時刻の表（スキルを実行したフレームからの相対。scripts/probe-skill-hits.ts が gcsim の実行で作る）。
 * 祭礼の武器効果は、このダメージが当たったときに発動する。表が無い（空の）アクションは、祭礼が発動しない
 */
export const SKILL_HITS = (skillHitFrameData as { entries: Record<string, { hits: number[]; byConstellation?: Record<string, number[]>; holdFramesMax?: number }> }).entries;

/**
 * スキルの命中のフレーム。命ノ星座で変わるもの（byConstellation: その段階以降の値）と、長押しの長さを渡すもの（holdFramesMax: 長押しの長さ − 1 フレームだけ後ろにずれる）に対応。
 * 長押しの長さ（holdSeconds）は、gcsim に渡すもの（applyHoldSeconds）と同じ丸め・上限
 */
export function skillHitFrames(actionId: string, constellation: number, holdSeconds: number | undefined): number[] {
  const e = SKILL_HITS[actionId];
  if (!e) return [];
  let hits = e.hits;
  for (const [cons, h] of Object.entries(e.byConstellation ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]))) if (constellation >= Number(cons)) hits = h;
  if (e.holdFramesMax !== undefined && holdSeconds !== undefined) {
    const shift = Math.min(e.holdFramesMax, Math.max(1, Math.round(holdSeconds * 60))) - 1;
    hits = hits.map(h => h + shift);
  }
  return hits;
}

/** 0 以上 length 未満に収めた添字（負の値も、末尾から数える） */
export const wrapIndex = (i: number, length: number): number => ((i % length) + length) % length;
