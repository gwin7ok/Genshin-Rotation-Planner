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
 * キャラの効果のうち、敵への命中・被ダメージ・回復・粒子などが引き金のもの、チーム全体に付くもの。
 * 持ち主の状態の中の通常攻撃（サイノの爆発中・放浪者の風の加護の間）は、マスターのモードの通常攻撃のフレーム（`mode.normalFrames`）を使う。
 */

/** いつ有効か */
export type AttackSpeedCondition =
  /** 常に有効 */
  | { kind: 'always' }
  /**
   * 元素爆発を使ってから `seconds` 秒の間（同じキャラが使った爆発。gcsim の OnBurst で付く状態）。
   * `sameStint`: 爆発を使った出場の中だけ（控えに下がると外れる効果。カヴェ・一斗・レイザー）。
   * `hitlag`: ヒットストップの分だけ延びる効果（gcsim の NewBaseWithHitlag）。キャラ自身のヒットストップの合計を、経過から引く
   */
  | { kind: 'afterBurst'; seconds: number; sameStint?: boolean; hitlag?: boolean }
  /** 元素スキルを使ってから `seconds` 秒の間（同じキャラが使ったスキル）。`hitlag`: 上と同じ */
  | { kind: 'afterSkill'; seconds: number; hitlag?: boolean }
  /** 最後のスキルの後の、通常攻撃の回数が `count` 回未満のとき（その攻撃を数えない。ディルック C6 の「次の 2 回」= 2） */
  | { kind: 'normalAttacksSinceSkillBelow'; count: number }
  /**
   * 交代で出場してから `seconds` 秒の間（先頭の出場は、交代ではないので、含まない）。
   * `icdSeconds`: 発動の内部 CT（効果が付いた交代から、この秒数が経つまで、次の交代では付かない）。
   * `hitlag`: 上と同じ（出場してからの、キャラ自身のヒットストップの合計を、経過から引く）
   */
  | { kind: 'afterEnterField'; seconds: number; icdSeconds: number; hitlag?: boolean }
  /** 重撃を使ってから `seconds` 秒の間（重撃が敵に当たると付く状態。当たる前提。ヒットストップによる延長は、見ない） */
  | { kind: 'afterChargedAttack'; seconds: number }
  /**
   * 直前のアクションが通常攻撃のとき（gcsim の `CurrentState() == NormalAttackState` で付く効果）。
   * `endsAtCancel`: 通常攻撃の状態が、次の通常攻撃へのキャンセルのフレームで終わる（アニメーションの長さが、そのキャンセルと同じ）とき。
   * 遅延（待ち）が 1f でもあると、外れる。荒瀧一斗の爆発中（スタックの状態の表では、全体 = 次の通常攻撃へのキャンセル）
   */
  | { kind: 'afterNormalAttack'; endsAtCancel?: boolean };

export interface AttackSpeedEffect {
  /**
   * 効果の持ち主（武器・聖遺物セット・キャラの gcsim のキー）。聖遺物は 4 セットの効果。
   * キャラは、`minConstellation`（命ノ星座がこれ以上のとき）。天賦レベルは、gcsim の設定と同じ 9 で決める
   */
  source: { type: 'weapon' | 'artifact' | 'character'; gcsimKey: string; minConstellation?: number };
  /** 速度（0.12 = +12%）。精錬ランク（1〜5。武器）と命ノ星座（0〜6。キャラ）で決まる */
  amount: (refine: number, constellation: number) => number;
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

  // ---- キャラ（自分のアクションだけで決まる効果。D223）。持続は、効果が付く時刻（フレーム）から数える ----
  {
    source: { type: 'character', gcsimKey: 'sangonomiyakokomi', minConstellation: 4 },
    amount: () => 0.1,
    when: { kind: 'afterBurst', seconds: 10 },
    evidence: 'internal/characters/kokomi/burst.go: Cons >= 4 → kokomi-c4 AtkSpd 0.1・10*60（NewBase。ヒットストップで延びない。常時・交代しても残る）',
  },
  {
    source: { type: 'character', gcsimKey: 'kaveh', minConstellation: 2 },
    amount: () => 0.15,
    // 爆発のヒット判定（36f）から 720f。控えに下がると外れる（addBurstExitHandler）
    when: { kind: 'afterBurst', seconds: (36 + 720) / 60, sameStint: true, hitlag: true },
    evidence: 'internal/characters/kaveh/cons.go c2: AtkSpd 0.15・burstDuration(720f)。burst.go: burstHitmark(36f) に付く。交代で DeleteStatus(c2Key)',
  },
  {
    source: { type: 'character', gcsimKey: 'razor' },
    amount: (_r, cons) => (cons >= 3 ? 0.4 : 0.39),
    // 爆発のヒット判定（32f）から 15 秒。控えに下がると外れる（onSwapClearBurst）
    when: { kind: 'afterBurst', seconds: (32 + 15 * 60) / 60, sameStint: true, hitlag: true },
    evidence: 'internal/characters/razor/burst.go: burstHitmark(32f) に AtkSpd burstATKSpeed[TalentLvlBurst()]・15*60（Lv9 = 0.39。命ノ星座 3 で +3 レベル → 上限 0.40）。交代で DeleteStatus(burstBuffKey)',
  },
  {
    source: { type: 'character', gcsimKey: 'aratakiitto' },
    amount: () => 0.1,
    // 爆発の使用時に付く 795f（660 + 90 + 45）。控えに下がると外れる（itto-exit）
    when: [{ kind: 'afterBurst', seconds: 795 / 60, sameStint: true, hitlag: true }, { kind: 'afterNormalAttack', endsAtCancel: true }],
    evidence: 'internal/characters/itto/burst.go: itto-q-atkspd AtkSpd 0.10・burstDuration(795f)、CurrentState() == NormalAttackState のときだけ。交代で DeleteStatMod。爆発中の通常攻撃は、スタック（1 以上）の表（attack.go attackFrames[attack1PlusStacks]）を使い、全体 = 次の通常攻撃へのキャンセル（33・36・43）なので、遅延があると外れる（gcsim の実測。遅延 0f のときだけ付く）',
  },
  {
    source: { type: 'character', gcsimKey: 'diluc', minConstellation: 6 },
    amount: () => 0.3,
    // スキルの使用時に付く 360f。最初の 2 回の通常攻撃（c6Count が 0・1 のとき）。スキルの直後の通常攻撃は、スキルの状態なので付かない（afterNormalAttack）
    when: [{ kind: 'afterSkill', seconds: 6, hitlag: true }, { kind: 'normalAttacksSinceSkillBelow', count: 2 }, { kind: 'afterNormalAttack' }],
    evidence: 'internal/characters/diluc/skill.go: Cons >= 6 → diluc-c6-speed AtkSpd 0.3・360f、CurrentState() == NormalAttackState かつ c6Count <= 1（通常攻撃のヒットのたびに c6Count++）',
  },
  {
    source: { type: 'character', gcsimKey: 'shikanoinheizou', minConstellation: 1 },
    amount: () => 0.15,
    when: { kind: 'afterEnterField', seconds: 5, icdSeconds: 10, hitlag: true },
    evidence: 'internal/characters/heizou/cons.go c1 + heizou.go: 交代で出場すると heizou-c1 AtkSpd 0.15・300f（内部 CT 600f）。最初の出場（交代なし）では付かない',
  },
  {
    source: { type: 'character', gcsimKey: 'cyno', minConstellation: 1 },
    amount: () => 0.2,
    when: [{ kind: 'afterBurst', seconds: 10, hitlag: true }, { kind: 'afterNormalAttack' }],
    evidence: 'internal/characters/cyno/cons.go c1: AtkSpd 0.2・600f、CurrentState() == NormalAttackState のときだけ。burst.go: 爆発の使用時に付く。固有天賦 1（審判: 爆発中にスキルを、エンシーアの間に使う）による更新は、未対応',
  },
  {
    source: { type: 'character', gcsimKey: 'wanderer', minConstellation: 1 },
    amount: () => 0.1,
    // スキルの使用時に付く 1200f（風の加護の状態と同じ 20 秒）。状態が終わると外れる（checkForSkillEnd）が、アプリの状態の長さは、空居点 100 × 6f（10 秒）。
    // 通常攻撃は、風の加護の間のフレーム（attackFramesE。マスターのモードの通常攻撃）に掛かる
    when: { kind: 'afterSkill', seconds: 20, hitlag: true },
    evidence: 'internal/characters/wanderer/cons.go c1: wanderer-c1-atkspd AtkSpd 0.1・1200f。skill.go: スキルの使用時に付く。風の加護が終わる（checkForSkillEnd）と DeleteStatus。attack.go: WindfavoredAttack が AtkSpdAdjust(attackFramesE)',
  },
];

/** 効果が有効かを決める、アクションの開始時点の状態 */
export interface AttackSpeedContext {
  /** 装備の武器の gcsim のキー（無ければ undefined） */
  weaponKey?: string;
  /** 装備の聖遺物セットの gcsim のキー（4 セットの効果が有効なときだけ。無ければ undefined） */
  artifactKey?: string;
  /** キャラの gcsim のキー（無ければ undefined） */
  characterKey?: string;
  /** 命ノ星座（0〜6） */
  constellation: number;
  /** 精錬ランク（1〜5） */
  refine: number;
  /** 同じキャラの、最後の元素爆発の開始から、このアクションの開始までの秒数（爆発を使っていなければ undefined） */
  secondsSinceBurst?: number;
  /** その爆発が、今の出場の中で使ったものか */
  burstInSameStint?: boolean;
  /** その爆発・スキルの後の、キャラ自身のヒットストップの合計（秒。ヒットストップで延びる効果の経過から引く） */
  hitlagSinceBurst?: number;
  hitlagSinceSkill?: number;
  /** 同じキャラの、最後の元素スキルの開始から、このアクションの開始までの秒数（スキルを使っていなければ undefined） */
  secondsSinceSkill?: number;
  /** 最後のスキルの後の、通常攻撃（このアクションを除く）の回数 */
  normalAttacksSinceSkill?: number;
  /** このキャラが、交代で出場した時刻（秒。先頭の出場を除く）の一覧と、このアクションの開始時刻 */
  enterFieldTimes?: { t: number; hitlag: number }[];
  /** このアクションの開始時刻（秒）と、そこまでのキャラ自身のヒットストップの合計（秒） */
  now?: number;
  hitlagNow?: number;
  /** 同じキャラの、最後の重撃の開始から、このアクションの開始までの秒数（重撃を使っていなければ undefined） */
  secondsSinceChargedAttack?: number;
  /**
   * 直前のアクション（同じ出場の中）が通常攻撃のとき、その全体のフレーム（アニメーションの長さ）と、開始から今までの経過フレーム。
   * 通常攻撃の状態は、そのアニメーションが終わると外れる（遅延が長くて、次の攻撃が、アニメーションの終わり以降になると、効果は付かない）。
   * cancelFrames: 次の通常攻撃へのキャンセルのフレーム（ヒットストップを含む。表に無いときは animationFrames と同じ）
   */
  previousNormalAttack?: { animationFrames: number; cancelFrames: number; elapsedFrames: number };
}

/** 有効な効果の速度の合計（無ければ 0。0.6 で頭打ちにするのは、frames.AtkSpdAdjust の側） */
export function attackSpeedFor(ctx: AttackSpeedContext): number {
  let total = 0;
  for (const e of ATTACK_SPEED_EFFECTS) {
    const owned = e.source.type === 'weapon' ? ctx.weaponKey : e.source.type === 'artifact' ? ctx.artifactKey : ctx.characterKey;
    if (!owned || e.source.gcsimKey !== owned) continue;
    if (e.source.minConstellation !== undefined && ctx.constellation < e.source.minConstellation) continue;
    const conditions = Array.isArray(e.when) ? e.when : [e.when];
    if (conditions.every(w => conditionHolds(w, ctx))) total += e.amount(ctx.refine, ctx.constellation);
  }
  return total;
}

function conditionHolds(w: AttackSpeedCondition, ctx: AttackSpeedContext): boolean {
  switch (w.kind) {
    case 'always': return true;
    case 'afterBurst':
      return ctx.secondsSinceBurst !== undefined && ctx.secondsSinceBurst - (w.hitlag ? ctx.hitlagSinceBurst ?? 0 : 0) <= w.seconds + 1e-9 && (!w.sameStint || !!ctx.burstInSameStint);
    case 'afterSkill':
      return ctx.secondsSinceSkill !== undefined && ctx.secondsSinceSkill - (w.hitlag ? ctx.hitlagSinceSkill ?? 0 : 0) <= w.seconds + 1e-9;
    case 'normalAttacksSinceSkillBelow': return (ctx.normalAttacksSinceSkill ?? Infinity) < w.count;
    case 'afterEnterField': {
      // 内部 CT を見て、効果が付いた交代だけを数える。今の時刻が、その後 `seconds` 秒以内か
      let triggered: { t: number; hitlag: number } | undefined;
      for (const e of ctx.enterFieldTimes ?? []) {
        if (ctx.now !== undefined && e.t > ctx.now) break;
        if (triggered === undefined || e.t - triggered.t >= w.icdSeconds) triggered = e;
      }
      if (triggered === undefined || ctx.now === undefined) return false;
      const lag = w.hitlag ? (ctx.hitlagNow ?? 0) - triggered.hitlag : 0;
      return ctx.now - triggered.t - lag <= w.seconds + 1e-9;
    }
    case 'afterChargedAttack': return ctx.secondsSinceChargedAttack !== undefined && ctx.secondsSinceChargedAttack <= w.seconds;
    case 'afterNormalAttack': {
      const p = ctx.previousNormalAttack;
      return !!p && p.elapsedFrames <= (w.endsAtCancel ? p.cancelFrames : p.animationFrames);
    }
  }
}

/** gcsim の `frames.AtkSpdAdjust`: 通常攻撃のフレームを、攻撃速度で縮める（速度は 0.6 で頭打ち） */
export function atkSpdAdjust(frames: number, spd: number): number {
  const s = Math.min(spd, 0.6);
  return frames - Math.trunc(Math.min(s, 0.1 + (s - 0.1) / 2) * frames);
}
