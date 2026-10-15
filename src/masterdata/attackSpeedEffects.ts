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
  | { kind: 'afterSkill'; seconds: number; hitlag?: boolean; /** スキルの使用から、効果が付くまでのフレーム（ミカ: 16f）。終わりも、その分後ろにずれる */ delayFrames?: number }
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
   * 自分の攻撃（通常攻撃・スキル・爆発）の命中の後 `seconds` 秒の間（gcsim の「会心のヒット」が引き金の効果。ロザリア・辛炎）。
   * 会心は、gcsim の設定（`cr=1`）と同じく、必ず起きる前提。命中は、攻撃のヒット判定のフレーム。
   * `icdSeconds`: 発動の内部 CT（効果が付いてから、この秒数が経つまで、次の命中では付かない。0 = 命中のたびに付け直す）。
   * `hitlag`: ヒットストップで延びる効果（上と同じ）
   */
  | { kind: 'afterCritHit'; seconds: number; icdSeconds: number; hitlag?: boolean }
  /**
   * 命中のたびに積むスタック（武器: 複合弓）。通常攻撃・重撃の命中が `tags`、内部 CT `icdSeconds`、最大 `maxStacks`、
   * 最後に積んでから `seconds` 秒で全て消える。効果の `perStack: true` のとき、速度 = 1 スタックの値 × スタック数
   */
  | { kind: 'hitStacks'; tags: string[]; icdSeconds: number; maxStacks: number; seconds: number }
  /**
   * 命中を `stacksNeeded` 回数えて発動する効果（武器: 松韻の響く頃）。命中が `tags`、内部 CT `icdSeconds`（スタックは消えない）、
   * 発動したら `cooldownSeconds` の間は数えない。発動から `seconds` 秒の間が有効
   */
  | { kind: 'stackProc'; tags: string[]; icdSeconds: number; stacksNeeded: number; cooldownSeconds: number; seconds: number }
  /** 効果を受けるキャラの武器の種類（重雲の固有天賦 1: 片手剣・両手剣・長柄武器） */
  | { kind: 'weaponType'; types: string[] }
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
  /** true: 速度 = amount × `hitStacks` のスタック数 */
  perStack?: boolean;
  source: {
    type: 'weapon' | 'artifact' | 'character';
    gcsimKey: string;
    minConstellation?: number;
    /** 効果が付く範囲。`team`: 編成の全員（持ち主を含む。綾人 C4・ミカ）。省略: 持ち主だけ */
    scope?: 'team';
  };
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

  // ---- 命中でスタックする武器（D231）。命中は、攻撃のヒット判定のフレーム（矢の飛行時間は見ない）----
  {
    source: { type: 'weapon', gcsimKey: 'compoundbow' },
    amount: refine => 0.009 + refine * 0.003,
    perStack: true,
    when: { kind: 'hitStacks', tags: ['normal', 'charged'], icdSeconds: 0.3, maxStacks: 4, seconds: 6 },
    evidence: 'internal/weapons/bow/compound/compound.go: 通常攻撃・重撃（AttackTagNormal / AttackTagExtra）の命中で、内部 CT 18f、最大 4 スタック、最後から 360f（NewBaseWithHitlag）。AtkSpd = (0.009 + r × 0.003) × スタック',
  },
  {
    source: { type: 'weapon', gcsimKey: 'songofbrokenpines', scope: 'team' },
    amount: refine => 0.09 + refine * 0.03,
    when: [
      { kind: 'stackProc', tags: ['normal', 'charged'], icdSeconds: 0.3, stacksNeeded: 4, cooldownSeconds: 20, seconds: 12 },
      { kind: 'afterNormalAttack' },
    ],
    evidence: 'internal/weapons/claymore/pines/pines.go: 通常攻撃・重撃の命中を、内部 CT 18f で数え、4 回で発動 → 編成の全員に 12 秒（pines-proc。NormalAttackState のときだけ AtkSpd 0.09 + r × 0.03）、発動後 20 秒は数えない',
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
  // ---- チーム全体に付く効果（持ち主の爆発・スキルの時刻から、編成の全員の通常攻撃に掛かる。D226）。ヒットストップは、受け取るキャラ自身の分を引く ----
  {
    source: { type: 'character', gcsimKey: 'kamisatoayato', minConstellation: 4, scope: 'team' },
    amount: () => 0.15,
    when: { kind: 'afterBurst', seconds: 15, hitlag: true },
    evidence: 'internal/characters/ayato/burst.go: Cons >= 4 → 編成の全員に ayato-c4 AtkSpd 0.15・15*60（NewBaseWithHitlag。爆発の使用時に付く）',
  },
  {
    source: { type: 'character', gcsimKey: 'mika', scope: 'team' },
    // 天賦レベル 9 = 0.21。スキルの天賦 +3（命ノ星座 5）で Lv12 = 0.25
    amount: (_r, cons) => (cons >= 5 ? 0.25 : 0.21),
    // 押し: 16f 後に付く（長押しは 12f 後。押しの値で近似）。12 秒
    when: { kind: 'afterSkill', seconds: 12, hitlag: true, delayFrames: 16 },
    evidence: 'internal/characters/mika/skill.go: applyBuffs（QueueCharTask(skillPressCDStart 16f / skillHoldCDStart + 1)）→ 編成の全員に soulwind AtkSpd atkSpdBuff[TalentLvlSkill()]・12*60（NewBaseWithHitlag）。mika.go: SkillCon = 5',
  },
  {
    source: { type: 'character', gcsimKey: 'yunjin', minConstellation: 6, scope: 'team' },
    amount: () => 0.12,
    // 爆発のヒット判定（35f）から 12 秒（旗の効果 = 720f と同じ長さ）。旗の回数（30 回。通常攻撃のヒットごとに 1 減る）が尽きると外れるが、それは見ていない
    when: { kind: 'afterBurst', seconds: (35 + 12 * 60) / 60, hitlag: true },
    evidence: 'internal/characters/yunjin/cons.go c6: Cons >= 6 → 編成の全員に c6Key AtkSpd 0.12・12*60（NewBaseWithHitlag）、Tags[yunjin-q] > 0 のときだけ。burst.go: burstHitmark(35f) に付く（旗は 30 回・720f）',
  },
  {
    source: { type: 'character', gcsimKey: 'chongyun', scope: 'team' },
    amount: () => 0.08,
    // 領域は、ヒット判定（36f）から 600f（1 秒ごとに、操作中のキャラへ付け直す。持続は天賦 Lv9 = 2.8 秒）。命ノ星座 5（Lv12）は 3.0 秒だが、見ていない。
    // 領域の中の位置（IsWithinArea）は、中にいる前提
    when: [{ kind: 'afterSkill', seconds: 600 / 60 + 2.8, delayFrames: 36 }, { kind: 'weaponType', types: ['sword', 'claymore', 'polearm'] }],
    evidence: 'internal/characters/chongyun/skill.go: 領域（chongyunfield 600f。ヒット判定 36f から）の間、1 秒ごと・交代のたびに、操作中のキャラへ infuse → 片手剣・両手剣・長柄武器なら chongyun-field AtkSpd 0.08・infuseDur[TalentLvlSkill()] 秒（Lv9 = 2.8）',
  },
  // ---- 会心のヒットが引き金の効果（会心は必ず起きる前提。gcsim の設定 cr=1 と同じ。D227）----
  {
    source: { type: 'character', gcsimKey: 'rosaria', minConstellation: 1 },
    amount: () => 0.1,
    when: [{ kind: 'afterCritHit', seconds: 4, icdSeconds: 0, hitlag: true }, { kind: 'afterNormalAttack' }],
    evidence: 'internal/characters/rosaria/cons.go c1: 会心のヒット（通常攻撃・スキル・爆発）で rosaria-c1-speed AtkSpd 0.1・240f（命中のたびに付け直す。内部 CT なし）、CurrentState() == NormalAttackState のときだけ',
  },
  {
    source: { type: 'character', gcsimKey: 'xinyan', minConstellation: 1 },
    amount: () => 0.12,
    // 通常攻撃の状態と重撃の状態のとき（重撃の速度は、まだ見ていない）
    when: [{ kind: 'afterCritHit', seconds: 5, icdSeconds: 5, hitlag: true }, { kind: 'afterNormalAttack' }],
    evidence: 'internal/characters/xinyan/cons.go c1: 会心のヒット（通常攻撃・スキル・爆発）で xinyan-c1 AtkSpd 0.12・5*60（内部 CT 5 秒）、NormalAttackState または ChargeAttackState のとき',
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
  /** 効果を受けるキャラの武器の種類（sword・claymore・polearm・bow・catalyst） */
  weaponType?: string;
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
  /**
   * 編成のキャラ（受け取るキャラ自身を含む）の、爆発・スキルの使用の状態。`scope: 'team'` の効果が使う。
   * hitlagSince〜: 受け取るキャラ自身のヒットストップの合計（その爆発・スキルの使用から）
   */
  teamOwners?: {
    characterKey: string;
    /** 持ち主の武器（gcsim のキー・精錬）と、攻撃の命中（武器の効果が、編成の全員に付くとき） */
    weaponKey?: string;
    refine: number;
    hitTimes?: { t: number; hitlag: number; tag: 'normal' | 'charged' | 'skill' | 'burst' }[];
    constellation: number;
    secondsSinceBurst?: number;
    hitlagSinceBurst?: number;
    secondsSinceSkill?: number;
    hitlagSinceSkill?: number;
  }[];
  /** このキャラの攻撃の命中の時刻（秒。昇順）と、そのときのキャラ自身のヒットストップの合計（秒） */
  hitTimes?: { t: number; hitlag: number; tag: 'normal' | 'charged' | 'skill' | 'burst' }[];
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
    const conditions = Array.isArray(e.when) ? e.when : [e.when];
    if (e.source.scope === 'team') {
      // 編成の持ち主の状態で判定する（受け取るキャラの、通常攻撃の状態などは、そのまま使う）
      for (const o of ctx.teamOwners ?? []) {
        if ((e.source.type === 'weapon' ? o.weaponKey : o.characterKey) !== e.source.gcsimKey) continue;
        if (e.source.minConstellation !== undefined && o.constellation < e.source.minConstellation) continue;
        const oc: AttackSpeedContext = {
          ...ctx,
          hitTimes: o.hitTimes,
          secondsSinceBurst: o.secondsSinceBurst,
          hitlagSinceBurst: o.hitlagSinceBurst,
          secondsSinceSkill: o.secondsSinceSkill,
          hitlagSinceSkill: o.hitlagSinceSkill,
          burstInSameStint: false,
        };
        if (conditions.every(w => conditionHolds(w, oc))) total += e.amount(o.refine, o.constellation) * (e.perStack ? stackCount(conditions, oc) : 1);
      }
      continue;
    }
    const owned = e.source.type === 'weapon' ? ctx.weaponKey : e.source.type === 'artifact' ? ctx.artifactKey : ctx.characterKey;
    if (!owned || e.source.gcsimKey !== owned) continue;
    if (e.source.minConstellation !== undefined && ctx.constellation < e.source.minConstellation) continue;
    if (conditions.every(w => conditionHolds(w, ctx))) total += e.amount(ctx.refine, ctx.constellation) * (e.perStack ? stackCount(conditions, ctx) : 1);
  }
  return total;
}

/** 命中のスタック数（`hitStacks`）。命中を時刻の順に見て、内部 CT・最後に積んでからの持続で数える */
function stackCount(conditions: AttackSpeedCondition[], ctx: AttackSpeedContext): number {
  const w = conditions.find((x): x is Extract<AttackSpeedCondition, { kind: 'hitStacks' }> => x.kind === 'hitStacks');
  if (!w || ctx.now === undefined) return 0;
  let stacks = 0;
  let lastGain = -Infinity;
  for (const e of ctx.hitTimes ?? []) {
    if (e.t > ctx.now + 1e-9) break;
    if (!w.tags.includes(e.tag)) continue;
    if (e.t - lastGain < w.icdSeconds - 1e-9) continue;
    if (e.t - lastGain > w.seconds + 1e-9) stacks = 0;
    stacks = Math.min(stacks + 1, w.maxStacks);
    lastGain = e.t;
  }
  return ctx.now - lastGain > w.seconds + 1e-9 ? 0 : stacks;
}

function conditionHolds(w: AttackSpeedCondition, ctx: AttackSpeedContext): boolean {
  switch (w.kind) {
    case 'always': return true;
    case 'afterBurst':
      return ctx.secondsSinceBurst !== undefined && ctx.secondsSinceBurst - (w.hitlag ? ctx.hitlagSinceBurst ?? 0 : 0) <= w.seconds + 1e-9 && (!w.sameStint || !!ctx.burstInSameStint);
    case 'hitStacks': return stackCount([w], ctx) > 0;
    case 'stackProc': {
      let count = 0;
      let lastStack = -Infinity;
      let cooldownUntil = -Infinity;
      let proc: number | undefined;
      for (const e of ctx.hitTimes ?? []) {
        if (ctx.now !== undefined && e.t > ctx.now + 1e-9) break;
        if (!w.tags.includes(e.tag)) continue;
        if (e.t < cooldownUntil - 1e-9) continue;
        if (e.t - lastStack < w.icdSeconds - 1e-9) continue;
        lastStack = e.t;
        count++;
        if (count >= w.stacksNeeded) { count = 0; proc = e.t; cooldownUntil = e.t + w.cooldownSeconds; }
      }
      return proc !== undefined && ctx.now !== undefined && ctx.now - proc <= w.seconds + 1e-9;
    }
    case 'afterCritHit': {
      let triggered: { t: number; hitlag: number } | undefined;
      for (const e of ctx.hitTimes ?? []) {
        if (ctx.now !== undefined && e.t > ctx.now + 1e-9) break;
        if (e.tag === 'charged') continue;
        if (triggered === undefined || e.t - triggered.t >= w.icdSeconds - 1e-9) triggered = e;
      }
      if (triggered === undefined || ctx.now === undefined) return false;
      const lag = w.hitlag ? (ctx.hitlagNow ?? 0) - triggered.hitlag : 0;
      return ctx.now - triggered.t - lag <= w.seconds + 1e-9;
    }
    case 'weaponType': return !!ctx.weaponType && w.types.includes(ctx.weaponType);
    case 'afterSkill':
      return ctx.secondsSinceSkill !== undefined
        && ctx.secondsSinceSkill - (w.hitlag ? ctx.hitlagSinceSkill ?? 0 : 0) - (w.delayFrames ?? 0) / 60 <= w.seconds + 1e-9;
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

/**
 * 重撃のフレームにも、攻撃速度（`Stat(AtkSpd)`）を掛けるキャラ（gcsim の `charge.go` が AtkSpdAdjust を呼ぶもの。D228）。
 * 放浪者（通常・風の加護の重撃）・イファ。荒瀧一斗・ノエルの重撃も AtkSpdAdjust を呼ぶが、フレームが状態（スタック・構え）で大きく変わり、
 * アプリの事前計算の対象外なので、入れない。多くのキャラの重撃は、攻撃速度の影響を受けない
 */
export const CHARGED_ATTACK_SPEED_KEYS: ReadonlySet<string> = new Set(['wanderer', 'ifa']);

/** gcsim の `frames.AtkSpdAdjust`: 通常攻撃のフレームを、攻撃速度で縮める（速度は 0.6 で頭打ち） */
export function atkSpdAdjust(frames: number, spd: number): number {
  const s = Math.min(spd, 0.6);
  return frames - Math.trunc(Math.min(s, 0.1 + (s - 0.1) / 2) * frames);
}
