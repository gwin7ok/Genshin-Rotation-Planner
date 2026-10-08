/**
 * 設置物（八重神子の殺生桜）の数え方（2026-10-09。D81）。
 *
 * gcsim（yaemiko/kitsune.go）の動き:
 *   - スキルを使うと、skillStart（34f）後に桜が 1 つ出る。寿命は決まった長さ（論示を達成していると +10 秒）
 *   - 場に 3 つあるときに出ると、最古の桜が消える（押し出し）
 *   - 爆発は、場にある桜 1 つにつき、スキルの CT を 1 回分戻す。論示が未達成なら、そのあと桜が全部壊れる
 *
 * CT の判定（rotationCalculator の checkCooldownViolations）と、効果バーの計算（1 周目の線形の計算）の両方で、同じ数え方を使う。
 * 桜の寿命は、スキルの効果継続時間（act.effectDuration ?? def.effectDuration）が 1 か所だけの元になる。
 */
import type { ActionDefinition } from '../types/genshin.ts';

export interface Totem<T = undefined> {
  /** 出た時刻（桜が現れた時刻） */
  start: number;
  /** 消える時刻（寿命の終わり。押し出し・爆発で壊れたときは、その時刻に更新する） */
  end: number;
  /** 行（バーを出す行。0 始まり）。新しい桜は、場にある桜が使っていない一番上の行。上限なら、押し出した最古の桜の行 */
  lane: number;
  tag: T;
}

/** 桜が現れるまでの遅れ（スキルの発動から）と、現れてから消えるまでの長さ（秒）。effectSeconds = スキルの効果継続時間 */
export function totemTiming(
  spec: NonNullable<ActionDefinition['spawnsTotem']>,
  effectSeconds: number,
  revelation: boolean,
): { delay: number; lifetime: number } {
  return {
    delay: Number((spec.startDelayFrames / 60).toFixed(3)),
    lifetime: Number((effectSeconds + (revelation ? spec.revelationBonusSeconds : 0)).toFixed(3)),
  };
}

export class TotemTracker<T = undefined> {
  private list: Totem<T>[] = [];

  /** 時刻 t に、まだ消えていない桜 */
  alive(t: number): Totem<T>[] {
    return this.list.filter(x => x.end > t);
  }

  /**
   * 時刻 appearAt に、桜を 1 つ出す（寿命 lifetime 秒）。上限を超えたら、最古が押し出されて、その時刻で消える。
   * 押し出された桜（バーをその時刻で切るために使う）と、新しい桜の行を返す。
   * fixedLane を渡すと、その行に置く（2 周目の再現で、1 周目の終わりに残っている桜を、元の行で置くとき）
   */
  spawn(appearAt: number, lifetime: number, max: number, tag: T, fixedLane?: number): { popped: Totem<T> | undefined; lane: number } {
    this.list = this.list.filter(x => x.end > appearAt);
    let popped: Totem<T> | undefined;
    if (this.list.length >= max) {
      popped = this.list.shift();
      if (popped) popped.end = Math.min(popped.end, appearAt);
    }
    const used = new Set(this.list.map(x => x.lane));
    let lane = fixedLane ?? popped?.lane;
    if (lane === undefined) {
      lane = 0;
      while (used.has(lane)) lane++;
    }
    this.list.push({ start: appearAt, end: Number((appearAt + lifetime).toFixed(3)), lane, tag });
    return { popped, lane };
  }

  /**
   * 時刻 t の爆発。場にある桜を返す（1 つにつき CT を 1 回分戻す）。論示が未達成（destroy）なら、桜は全部、その時刻で壊れる
   */
  burst(t: number, destroy: boolean): Totem<T>[] {
    const present = this.alive(t);
    if (destroy) {
      for (const x of present) x.end = Math.min(x.end, t);
      this.list = [];
    }
    return present;
  }
}
