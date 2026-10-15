/**
 * 通常攻撃速度（gcsim の `AtkSpd`）を上げる効果の表（D221。2026-10-16）。
 *
 * gcsim は、通常攻撃のフレームを、攻撃速度で縮める（internal/frames/frames.go）:
 *   AtkSpdAdjust(f, spd) = f - int(min(spd, 0.1 + (spd - 0.1) / 2) * f)   （spd は 0.6 で頭打ち）
 * 速度は、攻撃の開始の時点の `Stat(AtkSpd)`（有効な効果の合計）。
 *
 * この表は「効果 1 つ = 1 行」で、いつ有効か（`when`）と、いくつか（`amount`）だけを持つ。計算（rotationCalculator.ts）は、
 * 通常攻撃の開始時に `attackSpeedFor` を 1 回呼ぶだけで、武器・キャラごとの分岐を持たない。
 * 行を足したら、`scripts/check-hitlag.ts`（表の行ごとのシナリオを gcsim で実行して、アプリの予測と比べる）に、シナリオを足す。
 *
 * 対象は、通常攻撃のフレームだけ（重撃・スキルは、キャラごとに gcsim の扱いが違うため、対象外）。
 * まだ入れていない効果: スタック系（リングボウ・パインズ・キャッシュフロー。ヒット回数のモデルが要る）、
 * キャラの固有天賦・命ノ星座・爆発の効果。
 */

/** いつ有効か */
export type AttackSpeedCondition =
  /** 常に有効 */
  | { kind: 'always' }
  /** 元素爆発を使ってから `seconds` 秒の間（同じキャラが使った爆発。gcsim の OnBurst で付く状態） */
  | { kind: 'afterBurst'; seconds: number }
  /** 重撃を使ってから `seconds` 秒の間（重撃が敵に当たると付く状態。当たる前提。ヒットストップによる延長は、見ない） */
  | { kind: 'afterChargedAttack'; seconds: number }
  /** 直前のアクションが通常攻撃のとき（gcsim の `CurrentState() == NormalAttackState` で付く効果） */
  | { kind: 'afterNormalAttack' };

export interface AttackSpeedEffect {
  /** 効果の持ち主（武器・聖遺物セットの gcsim のキー。キャラは、後で足す）。聖遺物は 4 セットの効果 */
  source: { type: 'weapon' | 'artifact'; gcsimKey: string };
  /** 速度（0.12 = +12%）。精錬ランク（1〜5）で決まる（聖遺物は決まらない） */
  amount: (refine: number) => number;
  /** いつ有効か。配列のときは、すべてを満たすとき（AND） */
  when: AttackSpeedCondition | AttackSpeedCondition[];
  /** 根拠（gcsim のソース） */
  evidence: string;
}

export const ATTACK_SPEED_EFFECTS: readonly AttackSpeedEffect[] = [
  {
    source: { type: 'weapon', gcsimKey: 'skywardspine' },
    amount: () => 0.12,
    when: { kind: 'always' },
    evidence: 'internal/weapons/spear/skyward/skyward.go: m[attributes.AtkSpd] = 0.12（常時）',
  },
  {
    source: { type: 'weapon', gcsimKey: 'gestofthemightywolf' },
    amount: () => 0.1,
    when: { kind: 'always' },
    evidence: 'internal/weapons/claymore/gestofthemightywolf/gestofthemightywolf.go: m[attributes.AtkSpd] = 0.1（常時）',
  },
  {
    source: { type: 'weapon', gcsimKey: 'skywardblade' },
    amount: () => 0.1,
    when: { kind: 'afterBurst', seconds: 12 },
    evidence: 'internal/weapons/sword/skyward/skyward.go: OnBurst → atkspdBuff[AtkSpd] = 0.1・720f',
  },
  {
    source: { type: 'weapon', gcsimKey: 'tulaytullahsremembrance' },
    amount: refine => 0.075 + refine * 0.025,
    when: { kind: 'afterNormalAttack' },
    evidence: 'internal/weapons/catalyst/tulaytullahsremembrance/tulaytullahsremembrance.go: mAtkSpd[AtkSpd] = 0.075 + r*0.025（CurrentState() == NormalAttackState のときだけ）',
  },
  {
    source: { type: 'artifact', gcsimKey: 'desertpavilionchronicle' },
    amount: () => 0.1,
    when: [{ kind: 'afterChargedAttack', seconds: 15 }, { kind: 'afterNormalAttack' }],
    evidence: 'internal/artifacts/desertpavilionchronicle/desertpavilionchronicle.go: 4pc。重撃（AttackTagExtra）が命中すると 15 秒（desert-4pc-spd。ヒットストップで延びる）、CurrentState() == NormalAttackState のときだけ AtkSpd + 0.1',
  },
];

/** 効果が有効かを決める、アクションの開始時点の状態 */
export interface AttackSpeedContext {
  /** 装備の武器の gcsim のキー（無ければ undefined） */
  weaponKey?: string;
  /** 装備の聖遺物セットの gcsim のキー（4 セットの効果が有効なときだけ。無ければ undefined） */
  artifactKey?: string;
  /** 精錬ランク（1〜5） */
  refine: number;
  /** 同じキャラの、最後の元素爆発の開始から、このアクションの開始までの秒数（爆発を使っていなければ undefined） */
  secondsSinceBurst?: number;
  /** 同じキャラの、最後の重撃の開始から、このアクションの開始までの秒数（重撃を使っていなければ undefined） */
  secondsSinceChargedAttack?: number;
  /**
   * 直前のアクション（同じ出場の中）が通常攻撃のとき、その全体のフレーム（アニメーションの長さ）と、開始から今までの経過フレーム。
   * 通常攻撃の状態は、そのアニメーションが終わると外れる（遅延が長くて、次の攻撃が、アニメーションの終わり以降になると、効果は付かない）
   */
  previousNormalAttack?: { animationFrames: number; elapsedFrames: number };
}

/** 有効な効果の速度の合計（無ければ 0。0.6 で頭打ちにするのは、frames.AtkSpdAdjust の側） */
export function attackSpeedFor(ctx: AttackSpeedContext): number {
  let total = 0;
  for (const e of ATTACK_SPEED_EFFECTS) {
    const owned = e.source.type === 'weapon' ? ctx.weaponKey : ctx.artifactKey;
    if (!owned || e.source.gcsimKey !== owned) continue;
    const conditions = Array.isArray(e.when) ? e.when : [e.when];
    if (conditions.every(w => conditionHolds(w, ctx))) total += e.amount(ctx.refine);
  }
  return total;
}

function conditionHolds(w: AttackSpeedCondition, ctx: AttackSpeedContext): boolean {
  switch (w.kind) {
    case 'always': return true;
    case 'afterBurst': return ctx.secondsSinceBurst !== undefined && ctx.secondsSinceBurst <= w.seconds;
    case 'afterChargedAttack': return ctx.secondsSinceChargedAttack !== undefined && ctx.secondsSinceChargedAttack <= w.seconds;
    case 'afterNormalAttack': return !!ctx.previousNormalAttack && ctx.previousNormalAttack.elapsedFrames <= ctx.previousNormalAttack.animationFrames;
  }
}

/** gcsim の `frames.AtkSpdAdjust`: 通常攻撃のフレームを、攻撃速度で縮める（速度は 0.6 で頭打ち） */
export function atkSpdAdjust(frames: number, spd: number): number {
  const s = Math.min(spd, 0.6);
  return frames - Math.trunc(Math.min(s, 0.1 + (s - 0.1) / 2) * frames);
}
