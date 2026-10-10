/**
 * キャラクターマスターデータ生成器 (ブラウザ / Node 共通)
 *
 * データソース (すべてネットから最新を取得する):
 *   - genshin-db API … キャラ基本データ (名前・元素・武器種・レア度)、スキル/爆発の CT・効果継続時間、アイコンのファイル名
 *       https://genshin-db-api.vercel.app/api/v5
 *   - enka.network … ゲーム内アイコン画像 (genshin-db の filename_icon から URL を組み立てる)
 *   - gcsim (GitHub) … 各アクションのモーションフレーム (60 FPS)
 *       https://github.com/genshinsim/gcsim/tree/main/internal/characters
 *
 * キャラの突き合わせは gcsim の ui/packages/ui/src/data/character.dm.json にある
 * 公式キャラID (例: 胡桃 = 10000046) で行う。名前の表記ゆれ (raidenshogun / raiden 等) に依存しない。
 *
 * 取得できなかった値は仮の数値で埋めずに未設定のままにし、レポートに記録する。
 */
import type { ActionDefinition, ActionFrames, ActionType, CharacterConfig, ElementType, WeaponType } from '../types/genshin.ts';
import { parseGoFile, findHitmark, type FrameTable, type ParsedGoFile } from './gcsimParser.ts';
import { buildConstellations, emptyConstellationReport, type ConstellationReport, type GenshinDbConstellation } from './constellationEffects.ts';
import { characterKey } from '../data/characterKeys.ts';
import { buildPassiveEffects, type GenshinDbPassive } from './passiveEffects.ts';
import { EFFECT_DURATION_OVERRIDES, EFFECT_DURATION_SUPPRESSED } from './effectDurationOverrides.ts';
import { parseCooldownCalls, resolveCooldownStart, type CooldownCall, type CooldownStartResolution } from './cooldownStart.ts';
import { buildKeyMapSection, keyMapLookup, type KeyMapItem, type KeyMapSection, type ManualKeyMapping } from './gcsimKeyMap.ts';

export const GENSHIN_DB_API = 'https://genshin-db-api.vercel.app/api/v5';
/** genshin-db の mihoyo_icon は新しいキャラほどリンク切れが多いため、ゲーム内ファイル名から enka の画像を使う */
const ICON_BASE_URL = 'https://enka.network/ui';
import { appSideSourceByGenshinId, type AppSideSource } from './appSideCharacterSources.ts';
import { GCSIM_REPO as CONFIG_GCSIM_REPO, GCSIM_COMMIT as CONFIG_GCSIM_COMMIT } from '../utils/gcsim/gcsimConfig.ts';
const GCSIM_REPO = CONFIG_GCSIM_REPO;
const GCSIM_BRANCH = CONFIG_GCSIM_COMMIT; // gcsim.config.json のコミットに固定（リリースにない最新の変更を取り込まない）
const GCSIM_CHAR_DM_PATH = 'ui/packages/ui/src/data/character.dm.json';

/**
 * 別アクションとして残す派生スキル（gcsim へのパラメータ指定が必要なもの。B）。キー: キャラ ID、値: 派生の名前（小文字）。
 *   フィッシュル `recast=1`、早柚・綺良々 `short_hold=1`、旅人(水) `hold=1`/`hold_ticks`、マーヴィカ `recast=1`
 * これ以外の派生は、状態で gcsim が自動的に切り替える（A）ため、E のボタンにまとめる。
 */
const PARAMETER_DERIVED_SKILLS: Record<string, string[]> = {
  '10000031-electro': ['recast'],
  '10000150-cryo': ['recast'], // オデットの特殊スキル（SPECIAL_SKILLS）
  '10000128-anemo': ['specialskill'], // ファルカの特殊スキル（SPECIAL_SKILLS）
  '10000120-electro': ['spearstorm'], // フリンズの特殊スキル（SPECIAL_SKILLS）
  '10000053-anemo': ['shorthold'],
  '10000061-dendro': ['shorthold'],
  '10000005-hydro': ['shorthold', 'shorthold0ticks'],
  '10000007-hydro': ['shorthold', 'shorthold0ticks'],
  '10000106-pyro': ['recastframestobike', 'recastframestoring'],
};

/**
 * 特殊元素スキル（2026-10-01）。gcsim では、スキルの後の一定時間だけ使える特殊スキルを、同じ `skill` 命令で自動的に切り替えるが、
 * **スキルとは別のCT**（`ActionSpecialSkill`）を持つため、別のアクション（別ボタン）にする。通常のスキルのCTは開始しない。
 * キー: キャラ ID、値: 派生の名前（小文字。PARAMETER_DERIVED_SKILLS と同じ）と、gcsim の値（根拠つき）
 */
const SPECIAL_SKILLS: Record<string, {
  slug: string; label: string; name: string; cooldown: number; effectDuration: number; source: string;
  /** CTの開始位置（動作開始からの秒数。既定 0） */
  cooldownDelay?: number;
  /** チャージ数（既定 1） */
  charges?: number;
  /** 受付の間の通常攻撃 1 ヒットあたりの CT 短縮（秒）、通常攻撃の段ごとのヒット数、最大ヒット数 */
  reducePerHit?: number; reducePerHitHexerei?: number; hitsPerNormal?: number[]; maxReductions?: number;
  /** スキル（E・長押し E）を使うと、全チャージ分のCTが同時に始まる（ファルカ。オデット・フリンズは windowOnly で CT は始まらない） */
  startedBySkill?: boolean;
  /** スキルは特殊スキルの CT を始めない（CT は特殊スキルを使ったときに始まる）。特殊スキルは受付の中でしか使えない（requiresWindow） */
  windowOnly?: boolean;
  /** 特殊スキルの効果バーの名前（genshin-db のスキル名から） */
  effectLabel?: string;
  /** CT が元素共鳴などの影響を受けない（フリンズ） */
  cdUnscaled?: boolean;
}> = {
  '10000128-anemo': {
    slug: 'specialskill',
    label: 'spE',
    name: '特殊元素スキル',
    cooldown: 11,
    effectDuration: 0,
    charges: 2,
    startedBySkill: true,
    cooldownDelay: 39 / 60,
    // 受付（疾風怒濤）は、モードの定義（ACTION_MODES）
    reducePerHitHexerei: 1.0, // varka/asc.go hexSkillCDReduction: ヘクセレイ：秘儀（ヘクセレイのキャラが 2 人以上）のとき 1 秒（ゲーム内の説明: ヘクセレイ「魔術：秘密の儀式」で 1 秒短縮）
    reducePerHit: 0.5, // varka/skill.go: fourWindsCDRedCB → ReduceActionCooldown（hexSkillCDReduction = 30 フレーム）。ゲーム内の説明: 通常攻撃を与えると 0.5 秒短縮、最大 15 回
    hitsPerNormal: [1, 2, 2, 2, 2], // varka/attack.go の attackHitmarks（1〜5 段目のヒット数。ヒットごとに短縮の判定）
    maxReductions: 15,
    source: 'varka/skill.go: SetCD(action.ActionSpecialSkill, fourWindsCD = 11*60)。スキルを使うと全チャージ分のCTが始まり（convertToFourWinds のとき）、スキルの後 12 秒（skillKey）の間だけ使える。SetNumCharges(ActionSpecialSkill, 2)',
  },
  '10000120-electro': {
    slug: 'spearstorm',
    label: 'spE',
    name: '特殊元素スキル「北国の嵐槍」',
    effectLabel: '北国の嵐槍',
    cooldown: 6,
    effectDuration: 0,
    windowOnly: true,
    cdUnscaled: true,
    startedBySkill: true,
    // 受付（幽炎の露顕）は、モードの定義（ACTION_MODES）
    source: 'flins/skill.go: spearStorm の AddStatus(spearStormCDKey, c1SkillCD(), false)（6 秒。命ノ星座 1 で 4 秒 → 未対応）。ActionReady: 幽炎の露顕の間、CT（spearStormCDKey）が明けていれば使える。状態が終わる（10*60+19f）か交代で CT は消える。説明文「基本クールタイムは 6 秒であり、他の効果の影響を受けない」',
  },
  '10000150-cryo': {
    slug: 'recast',
    label: 'spE',
    name: '特殊元素スキル',
    cooldown: 15,
    effectDuration: 20,
    windowOnly: true,
    effectLabel: '柔き払暁のコーダ後の強化', // danceDoubleUpgradeKey（20 秒）
    startedBySkill: true,
    // 受付（柔き払暁のコーダの受付。スキル・爆発で開く）は、モードの定義（ACTION_MODES）
    source: 'odette/skill.go: SetCD(action.ActionSpecialSkill, 15*60)、AddStatus(danceDoubleUpgradeKey, 20*60)。スキルの後 394 フレーム（約 6.6 秒）の間だけ使える（AddStatus(skillRecastKey, 394)）',
  },
};

/**
 * 特殊元素爆発（2026-10-05）。状態中のスキル（2 回目の E）の後の一定時間だけ、爆発が特殊爆発に切り替わる。
 * 特殊爆発は、爆発の CT を始めない（CT 中でも使える）。使うと受付が閉じる。受付の外で使うと、通常の爆発（CT が始まる）。
 * キー: キャラ ID
 */
const SPECIAL_BURSTS: Record<string, {
  tableName: string; name: string; label: string; source: string;
  /** 受付の中の爆発の CT（秒）。外では、通常の爆発の CT。受付は、モードの定義（ACTION_MODES） */
  cooldownInWindow: number;
  /** 受付の中でも、爆発の CT が明けていることを求める（gcsim のヴァレサ） */
  checkInWindow: boolean;
  /** 受付の外で使ったときの警告に出す、必要な条件 */
  hint: string;
}> = {
  '10000120-electro': {
    tableName: 'symphonyFrames',
    name: '特殊元素爆発（嵐槍の後）',
    label: 'spQ',
    cooldownInWindow: 0,
    checkInWindow: false,
    hint: '同じ出場の中で、状態中のスキル（北国の嵐槍）を使った後でないと使えません',
    source: 'flins/skill.go: spearStorm の AddStatus(thunderousSymphonyKey, 6*60, true)。flins/burst.go: thunderousSymphony は SetCD せず（爆発の CT を始めない）、ConsumeEnergyPartial(3, 30)（エネルギー 30 で発動）、DeleteStatus(thunderousSymphonyKey)（1 回で閉じる）',
  },
  // ヴァレサ: マキシマムドライブ（落下攻撃の開始時に、命ノ星座 2 以上、または猛烈パッション中。140f）の間の爆発が、大火山おろしになる
  '10000111-electro': {
    tableName: 'volcanicFrames',
    name: '特殊元素爆発（マキシマムドライブ）',
    label: 'spQ',
    cooldownInWindow: 1,
    checkInWindow: true,
    hint: '直前の落下攻撃（命ノ星座 2 以上、または猛烈パッション中）の後 2.3 秒以内で、その間にスキルを使っていないことが必要です',
    source: 'varesa/plunge.go: getApexDrive（落下攻撃の開始時に、Cons >= 2 または猛烈パッション中なら AddStatus(apexState, 140, true)）。varesa/burst.go: volcanicKablam（エネルギー 30、命中 42f、SetCD(ActionBurst, 1*60)、状態を消す）。varesa/varesa.go: ActionReady は、通常の爆発の CT が明けていること（AvailableCDCharge > 0）を求める。skill.go: スキルで状態が消える',
  },
};

/**
 * スキルの回数（2026-10-05）。gcsim の `SetNumCharges(action.ActionSkill, n)` が、キャラの生成時に凸に関係なく設定されるもの。
 * 凸で増えるもの（魈 1 凸で 3 など）は、凸の変更（constellationEffects.ts の CHARGE_CHANGES）で扱う。
 * CT は順番に回復する（gcsim の cdQueue）。キー: キャラ ID
 */
const SKILL_CHARGES: Record<string, number> = {
  '10000026-anemo': 2, // 魈（xiao/xiao.go: SetNumCharges(ActionSkill, 2)）
  '10000029-pyro': 2, // クレー（klee/klee.go）
  '10000058-electro': 3, // 八重神子（yaemiko/yaemiko.go）
  '10000091-geo': 2, // ナヴィア（navia/navia.go）
  '10000111-electro': 2, // ヴァレサ（varesa/varesa.go）
};

/**
 * 八重神子: スキルが殺生桜を出し（上限 3）、爆発が場の桜 1 つにつきスキルの CT を 1 回分戻す（固有天賦 1）。
 * 寿命は、スキルの効果継続時間（14 秒）、論示で +10 秒（24 秒。ユーザー決定 D81）。桜は、スキルの 34f 後に現れる（skill.go: skillStart）。
 * gcsim は、スキルの発動から 900f（論示で 1500f）で消える（kitsune.go: kitsuneDur + revelationBonusSkillDur）。出現から数えると 14.4 秒／24.4 秒で、アプリの 14／24 秒とは 0.4 秒ずれる
 */
const TOTEM_SKILLS: Record<string, { max: number; revelationBonusSeconds: number; startDelayFrames: number }> = {
  '10000058-electro': { max: 3, revelationBonusSeconds: 10, startDelayFrames: 34 },
};

/** ヴァレサ: 夜魂値で無料のスキル（varesa.go: MaxPoints = 40、skill.go: +20、plunge.go: +25、EnterTimedBlessing 15 秒） */
const NIGHTSOUL_FREE_SKILLS: Record<string, { skillGain: number; plungeGain: number; max: number; blessingSeconds: number }> = {
  '10000111-electro': { skillGain: 20, plungeGain: 25, max: 40, blessingSeconds: 15 },
};

/**
 * 炎場の置き始めと置き直し（ディシア。2026-10-05）。gcsim dehya/skill.go。キー: キャラ ID。スキルの `_e` に付く
 */
const FIELD_RECASTS: Record<string, NonNullable<ActionDefinition['fieldRecast']>> = {
  '10000079-pyro': {
    startDelayFrames: 21, // skillHitmark(20) + 1: addField(dehyaFieldDuration)
    recastPlaceFrames: 41, // skillRecastHitmark(40) + 1: addField(c.sanctumSavedDur)
    pickupExtensionFrames: 24, // sanctumPickupExtension: 拾うと、残り時間に 0.4 秒を足す
    c2Constellation: 2,
    c2ExtensionFrames: 360, // cons.go c2IncreaseDur: sanctumSavedDur += 360（置き直しのとき）
    source: 'dehya/skill.go: Skill()（炎場は skillHitmark + 1 で 12 秒）、skillRecast()（pickUpField で残り時間 + 24f を保存し、skillRecastHitmark + 1 で置き直す。炎場は拾っている間、時間が進まない）、cons.go: c2IncreaseDur',
  },
};

/**
 * 領域が続く間、操作中のキャラに効果を付け直すスキル（重雲。2026-10-10）。gcsim chongyun/skill.go。キー: キャラ ID。スキルの `_e` に付く
 */
const FIELD_EFFECTS: Record<string, NonNullable<ActionDefinition['fieldEffect']>> = {
  '10000036-cryo': {
    startDelayFrames: 36,
    fieldFrames: 600,
    ctReduction: {
      minConstellation: 2,
      rate: 0.15,
      label: '周天の回転（CT −15%）',
      description: '霊刃·重華積霜の領域の間、操作中のキャラのスキル・爆発・特殊スキルのクールタイム −15%（命ノ星座 2。gcsim は、1 秒ごと・交代のたびに付け直す）'
    },
    source: 'chongyun/skill.go: skillHitmark(36) で領域（600f）を作り、1 秒ごとに操作中のキャラへ氷付与（infuseDur 秒）と、命ノ星座 2 以上は CT −15%（chongyun-c2）を付ける。交代したときも付ける'
  },
};

/**
 * 爆発の後のモード（ディシアのパンチ連打モード。2026-10-05）。gcsim dehya/burst.go・dash.go・jump.go。キー: キャラ ID
 * 爆発のアクションの長さは、gcsim では 105f（burstPunch1Hitmark。frames は全部この値）。フレーム表の最初（kickFrames）を取るのは誤りなので、置き換える
 */
const BURST_MODES: Record<string, NonNullable<ActionDefinition['burstMode']> & { burstFrames: number }> = {
  '10000079-pyro': {
    burstFrames: 105,
    // punchHitmarks: 入力の長さ（1・2 発目 30f、3 発目 28f、4 発目以降 27f）
    inputFrames: [30, 30, 28, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27],
    // 状態が切れた後、最後の自動のパンチ（最大 50f 後）と蹴り（46f 後）まで
    finisherWindowFrames: 50 + 46,
    finisher: { total: 76, cancels: { skill: 71, dash: 73, jump: 73, swap: 46 } },
    dashToJumpFrames: 7,
    dashJumpKickFrames: 17,
    // 爆発が拾った炎場（pickUpField）の置き直し: 蹴りの命中の 1f 後（burstKickFunc）、交代の 46f 後（onExitField）、ジャンプの時点（jump.go）
    autoPunchFrames: 50,
    kickHitFrames: 46,
    fieldPlaceAfterKickFrames: 1,
    fieldPlaceAfterExitFrames: 46,
    source: 'dehya/burst.go: burstDuration = 4.1*60、burstPunchSlowHitmark = 50（自動のパンチ）、punchHitmarks（入力のパンチ）、kickFrames（蹴り）。UseBurstAction: 状態の間の attack・skill はパンチ（ActionReady は CT を見ない）。dash.go: 状態の間の dash は、ジャンプへ 7f でキャンセルでき、17f 以内のジャンプは蹴り。jump.go: それ以外のジャンプは状態を終わらせる',
  },
};

/**
 * スキル・爆発で入るモード（状態）の、共通の定義（2026-10-08。mode-hold-plan.md）。キー: キャラ ID（1 人に複数のモード）。action = モードを開くアクション（e = `_e`、q = 元素爆発）
 * 交代での扱い・終わらせるアクション・既定で維持するかを、データで持つ（計算は、キャラごとの分岐を書かない）。
 * 交代での扱いは、ゲームでの動き（ユーザーの確認。D73・D76）。gcsim と違うもの（閑雲・クロリンデは、gcsim では交代しても続く）は、各行に書く。
 * keepEffectDuration: マスターの効果継続時間（genshin-db）を残す（アクションごとの個別の値で、モードを長くできる）。無ければ 0 にする（バーはモードのバーだけ）
 */
/** action = モードを開くアクション（e = 一回押しの `_e`、e_hold = 長押しの `_e_hold`、q = 元素爆発）。複数のときは配列（同じモードを、どれで開いても同じに扱う） */
type ActionModeEntry = { action: string | string[]; keepEffectDuration?: boolean; mode: NonNullable<ActionDefinition['mode']> };
/**
 * 窓の規則から移した「受付」型のモード（2026-10-08。窓の規則とモードの定義の統一）。E の後の短い期間、E が別の動作になる（CT なし）。
 * バーは出さない（効果バーはそのまま）・延長しない・バフ重複に数えない。交代での扱いは、受付が交代 CT（1 秒）より短いキャラは影響しない
 */
const windowMode = (label: string, startDelayFrames: number, durationFrames: number, swap: 'ends' | 'persists', repress: NonNullable<NonNullable<ActionDefinition['mode']>['repress']>, source: string, extra: Partial<NonNullable<ActionDefinition['mode']>> = {}): NonNullable<ActionDefinition['mode']> => ({
  label,
  description: `${label}（受付）。この間の元素スキル（E）は別の動作になり、CT を使わない`,
  startDelayFrames,
  durationFrames,
  swap,
  enders: [],
  holdByDefault: false,
  noHold: true,
  noBar: true,
  noSynergy: true,
  repress,
  source,
  ...extra,
});
/**
 * 入力がなければ最大時間まで続き、ボタン操作では終わらず、交代で終わるモード（A-2・D-2）の行。開始の遅れ・最大時間は、gcsim の実行で確認したフレーム
 * （2026-10-08。入力なしで `skill` / `burst; wait(1300)` を実行し、状態が付いたフレームと期限）。既定は維持する。効果継続時間（genshin-db）は残す
 */
const stateMode = (action: 'e' | 'q', label: string, startDelayFrames: number, durationFrames: number, source: string, extra: Partial<NonNullable<ActionDefinition['mode']>> = {}): ActionModeEntry => ({
  action,
  keepEffectDuration: true,
  mode: {
    label,
    description: `${label}の状態。入力がなければ ${(durationFrames / 60).toFixed(1)} 秒続く。キャラ交代で終わる`,
    startDelayFrames,
    durationFrames,
    swap: 'ends',
    enders: [],
    holdByDefault: true,
    source,
    ...extra,
  },
});

/**
 * 特殊スキル・特殊爆発の受付（オデット・フリンズの特殊爆発・ヴァレサ）の行（2026-10-08。D78）。受付のバー（名前 =「受付の名前（開いたもの）」・バフ重複に数えない）、
 * 延長なし、交代で終わる。モードを開くアクションの効果バーは別に出す
 */
const specialWindowMode = (label: string, barNote: string, durationFrames: number, description: string, special: NonNullable<NonNullable<ActionDefinition['mode']>['special']>, source: string): NonNullable<ActionDefinition['mode']> => ({
  label,
  description,
  startDelayFrames: 0,
  durationFrames,
  swap: 'ends',
  enders: [],
  holdByDefault: false,
  noHold: true,
  noSynergy: true,
  barNote,
  keepEffectBar: true,
  special,
  source,
});

const ACTION_MODES: Record<string, ActionModeEntry[]> = {
  // 夢見月瑞希: 夢浮かみ（5 秒。固有天賦 1 の延長は反応が条件なので含めない）。状態の間の E で解除（CT なし）。交代で解除（実行で確認: 交代の時点で「DreamDrifter effect cancelled」）
  '10000109-anemo': [{
    action: 'e',
    keepEffectDuration: true,
    mode: {
      label: '夢浮かみ',
      description: '夢浮かみ状態。状態の間の元素スキル（E）で解除する（CT は始まらない）。キャラ交代でも終わる',
      // mizuki.go: ActionReady が、夢浮かみの間はスキル（解除）・ダッシュ・爆発・交代以外を false にする（実行で確認: E → N の N は、状態の期限 301f まで待つ）
      blocked: { types: ['normal', 'charged', 'jump', 'plunge_low', 'plunge_high'], result: 'wait', hint: '先に E（解除）を置いてください' },
      startDelayFrames: 0,
      durationFrames: 5 * 60,
      swap: 'ends',
      enders: [{ by: 'self', cooldown: 'none', frames: { total: 50, cancels: { burst: 34, swap: 30 }, source: 'skill.go:skillFrames（状態の解除）' } }],
      holdByDefault: true,
      source: 'mizuki/skill.go: dreamDrifterBaseDuration = 5*60、AddStatus(dreamDrifterStateKey, …, true)。状態の間の E は cancelDreamDrifterState。交代で解除（OnCharacterSwap）',
    },
  }],
  // ディシア: 爆発の 105f 後から 4.1 秒のパンチ連打モード。ジャンプで終わる（ダッシュ → ジャンプは蹴り）。交代で終わる。固有の項目は BURST_MODES
  '10000079-pyro': [{
    // 炎場（12 秒。E の命中の 1f 後から）の間の E は置き直し（剣域熾焔。CT なし・1 回）。炎場は設置物なので交代しても続く（gcsim も、交代して戻った後の E が置き直し。2026-10-08 に実行で確認）。
    // 爆発が炎場を拾って置き直すと、受付は新しい炎場の終わりまで延びる（計算側。モードを開いたアクションが fieldRecast を持つ）
    action: 'e',
    keepEffectDuration: true,
    mode: windowMode('剣域熾焔', 0, 20 + 1 + 12 * 60, 'persists', {
      frames: [{ total: 74, cancels: { skill: 45, burst: 45, dash: 45, jump: 49, swap: 44 }, source: 'skill.go:skillRecastFrames' }],
      maxUses: 1,
      endsOnLast: true,
    }, 'dehya/skill.go: skillHitmark=20 の 1f 後に addField(12*60)。hasRecastSkill で再発動は 1 回（窓の規則から移した）'),
  }, {
    action: 'q',
    mode: {
      label: 'パンチ連打モード',
      description: '通常攻撃（N）・元素スキル（E）がパンチになるモード。モードの間の N・E はスキルの CT を使わない。モードの間のジャンプ、キャラ交代で終わる。終わった後の最初の N・E は、フィニッシュの蹴り',
      startDelayFrames: 105,
      durationFrames: Math.round(4.1 * 60),
      swap: 'ends',
      enders: [{ by: 'jump', cooldown: 'none' }],
      holdByDefault: true,
      noSynergy: true,
      source: 'dehya/burst.go: burstDuration = 4.1*60（爆発の 105f 後から）。jump.go: 状態の間のジャンプは状態を終わらせる。onExitField: 交代で終わる',
    },
  }],
  // タルタリヤ: 近接の構え（30 秒）。構えの間の E で遠距離に戻る。交代で終わる。CT は構えの終わりから始まり、長さは構えに居た時間で決まる。既定は維持しない（D75）
  '10000033-hydro': [{
    action: 'e',
    keepEffectDuration: true,
    mode: {
      label: '近接の構え',
      description: '近接の構え（魔王の武装）。構えの間の元素スキル（E）で遠距離に戻る。キャラ交代でも終わる。CT は構えの終わりから始まり、長さは構えに居た時間で決まる（30 秒の時間切れは 45 秒）',
      startDelayFrames: 0,
      durationFrames: 30 * 60,
      swap: 'ends',
      enders: [{ by: 'self', cooldown: 'start', frames: { total: 18, cancels: { attack: 17, burst: 18, dash: 17, jump: 17, swap: 16 }, source: 'skill.go:skillMeleeFrames' } }],
      holdByDefault: false,
      cooldownAtEnd: {
        delayFrames: { ender: 11, swap: 0, timeout: 0 },
        entry: { seconds: 1, delayFrames: 14 },
        byStay: [
          { below: 2, seconds: 7 },
          { below: 4, seconds: 8 },
          { below: 5, seconds: 9 },
          { below: 8, seconds: 5, plusStay: true },
          { below: 30, seconds: 6, plusStay: true },
          { seconds: 45 },
        ],
        consScale: { minConstellation: 1, scale: 0.8 },
      },
      source: 'tartaglia/skill.go: AddStatus(meleeKey, 30*60)、入る E は SetCDWithDelay(ActionSkill, 60, 14)。onExitMeleeStance: 構えに居た時間で CT（<2 秒 7 秒・<4 秒 8 秒・<5 秒 9 秒・<8 秒 5 秒 + 時間・<30 秒 6 秒 + 時間・以上 45 秒。C1 ×0.8）。E の再押しは 11f 後、交代（onExitField）・時間切れは遅れ 0。2026-10-08 に実行で確認',
    },
  }],
  // 放浪者: 風の加護（飛行。10 秒）。E の再押しで終わる。終わらせないと交代できない（ゲーム・gcsim とも）。CT（6 秒）は状態の終わりから。
  // 維持の延長は出さない（gcsim は `wait` だけでは時間切れの処理をせず、交代が約 546 秒待ちになる。D76）
  '10000075-anemo': [{
    action: 'e',
    keepEffectDuration: true,
    mode: {
      label: '風の加護',
      description: '風の加護（飛行）。状態の間の元素スキル（E）で終わる。終わらせないと交代できない。CT は状態の終わりから始まる',
      startDelayFrames: 0,
      durationFrames: 100 * 6,
      swap: 'blocks',
      enders: [{ by: 'self', cooldown: 'start' }],
      holdByDefault: false,
      noHold: true,
      cooldownAtEnd: { delayFrames: { ender: 0, swap: 0, timeout: 0 } },
      source: 'wanderer/skill.go: skillActivate（SwapCD = MaxInt16、空居点 100 × 6f）、skillEndRoutine（SwapCD = 26、SetCD(ActionSkill, 360)）。2026-10-08 に実行で確認（E の再押しの時点で CT 6 秒）',
    },
  }],
  // フレミネ: 潜水（加圧。10 秒）。状態の間の E で起爆（CT は最初の E で始まっている）。交代しても続く（ゲーム・gcsim とも）
  '10000085-cryo': [{
    action: 'e',
    keepEffectDuration: true,
    mode: {
      label: '潜水（加圧）',
      description: '加圧の状態。状態の間の元素スキル（E）で起爆する（CT は始まらない）。キャラ交代しても続く',
      startDelayFrames: 0,
      durationFrames: 10 * 60,
      swap: 'persists',
      enders: [{ by: 'self', cooldown: 'none', frames: { total: 55, cancels: { attack: 53, skill: 47, burst: 47, dash: 47, jump: 47, swap: 51 }, source: 'skill.go:skillPressureFrames[0]' } }],
      holdByDefault: false,
      // N のたびにスタックが溜まり（影狩りの間は 2）、4 になった後の N（と E）は、起爆のフレームになる（2026-10-10）
      nStacks: {perUse:1,boostedBy:'影狩り',boostedPerUse:2,max:4,detonate:{total:59,cancels:{attack:53,skill:42,burst:42,dash:43,jump:41,swap:51},source:'skill.go:skillPressureFrames[1]（スタック 4 の起爆。N・E どちらでも）'},source:'freminet/attack.go: skillStacks >= 4 の N は detonateSkill。persTimeKey の間の N で skillStacks +1（影狩りの間は +2。最大 4）'},
      source: 'freminet/skill.go: AddStatus(persTimeKey, 10*60)。状態の間の E は detonateSkill。2026-10-08 に実行で確認（交代して戻った後の E も起爆）',
    },
  },
  // フレミネの爆発: 影狩り（10 秒）
  stateMode('q', '影狩り', 0, 600, 'freminet/burst.go: freminet-stalking（実行: 爆発と同時に 600f）')],
  // --- A-2: スキルで入る、ボタン操作で終わらないモード（2026-10-08） ---
  // スカーク: 七相一閃（E の 19f 後から 754f）。蛇の秘計は gcsim の既定で 100 点から始まり（毎秒 7 点減る）、上限の 754f まで続く（実効。D74）。
  // 状態中の E は使えない。CT（8 秒）は状態の終わりから（skill.go: exitSkillState）
  '10000114-cryo': [stateMode('e', '七相一閃', 19, 754, 'skirk/skill.go: skillDur = 754、enterSkillState（実行: E の 19f 後に seven-phase-flash、774f に exit skirk skill と CT 480f）。onExitField: 交代で終わる', {
    cooldownAtEnd: { delayFrames: { ender: 0, swap: 0, timeout: 0 } },
    // skirk.go: NextQueueItemIsValid が、七相一閃の間のスキルをエラーにする（実行で確認: 「skirk: cannot use skill in seven-phase flash」）
    blocked: { types: ['skill', 'skill_hold'], result: 'error', hint: '七相一閃が終わってから置いてください' },
  })],
  // 胡桃: 蝶導来世（554f。実行で、交代して戻ると状態が消えていることを確認）
  '10000046-pyro': [stateMode('e', '蝶導来世', 0, 554, 'hutao/skill.go: paramita（実行: E と同時に 554f）。交代で解除')],
  // 宵宮: 庭火焔硝（611f）
  '10000049-pyro': [stateMode('e', '庭火焔硝', 0, 611, 'yoimiya/skill.go: yoimiyaskill（実行: E と同時に 611f）。交代で解除')],
  // 神里綾人: 瞬水剣（360f）
  // 瞬水剣の間の通常攻撃は、全段 23f（取り消しは 5f）の瞬水剣。重撃は gcsim が実行エラーにする（2026-10-10）
  '10000066-hydro': [stateMode('e', '瞬水剣', 0, 360, 'kamisatoayato/skill.go: soukaikanka（実行: E と同時に 360f）。交代で解除', {
    normalFrames: [{total:23,hitmark:5,cancels:{skill:5,burst:5,dash:5,jump:5,swap:5},source:'attack.go:shunsuikenFrames（InitNormalCancelSlice(5, 23)。全段同じ。攻撃速度の補正は未対応）'}],
    blocked: {types:['charged'],result:'error',hint:'瞬水剣の間は重撃を使えません（gcsim は実行エラー）。瞬水剣が終わってから置いてください'},
  })],
  // --- 特殊スキル・特殊爆発の受付（2026-10-08。受付をモードの定義に統一。D78）。special.kind = skill は特殊スキル（spE）、burst は特殊爆発（spQ）を使える期間 ---
  // フリンズ: 幽炎の露顕（E の 619f）。この間、特殊スキル「北国の嵐槍」を何度でも使える。交代で消える。既定は維持する
  '10000120-electro': [{
    ...stateMode('e', '幽炎の露顕', 0, 619, 'flins/skill.go: AddStatus(skillKey, 10*60+skillHitmark, true)（manifest-flame。実行: E と同時に 619f）。嵐槍を使っても消えず、交代で消える', {
      description: '幽炎の露顕の状態。この間、特殊スキル「北国の嵐槍」（spE）を使える。キャラ交代で終わる',
      special: { kind: 'skill' },
    }),
    action: ['e', 'e_hold'],
  }, {
    // 雷霆のシンフォニーの受付（幽炎の露顕の間に使った嵐槍の後 6 秒）。特殊爆発（spQ）を 1 回使うと閉じる。使うたびに新しくなる
    action: 'e_spearstorm',
    keepEffectDuration: true,
    mode: specialWindowMode('雷霆のシンフォニーの受付', '嵐槍', 6 * 60, '特殊爆発を使える期間（受付）。使うと閉じる。受付の外では、gcsim では通常の爆発（CT が始まる）になる',
      { kind: 'burst', singleUse: true, openCondition: { requiresOpen: 'skill' } },
      'flins/skill.go: spearStorm の AddStatus(thunderousSymphonyKey, 6*60, true)。flins/burst.go: thunderousSymphony は DeleteStatus(thunderousSymphonyKey)（1 回で閉じる）'),
  }],
  // ファルカ: 疾風怒濤（E の 39f 後から 720f。ヒットストップ・自分の爆発〔+2.3 秒〕で延びる）。この間、特殊スキル（2 回分の CT）を使える。交代で消える。既定は維持する。
  // 状態の間の E は特殊スキルの動作（specialSkillFrames 68f。CT は特殊スキルの枠で、別のボタン spE と同じ）。
  // ヒットストップ: AddStatus の第3引数 true = ヒットストップで延びる。ヒット 1 回あたりの止まるフレーム数 = ceil((HitlagHaltFrames + 3.6 × [防御ヒットストップ]) × (1 − 0.01))
  //   （pkg/core/combat/attack.go: DefHalt が有効〔既定〕で CanBeDefenseHalted の攻撃は +3.6 フレーム。pkg/core/player/character/hitlag.go: ApplyHitlag の frozenFrames）。全ヒットが敵に当たった最大の場合（2026-10-01 に gcsim の実行ログで確認）:
  //   通常攻撃 N1〜N5 = 6/8/8/9/10f、重撃 = 9f（特殊重撃〔蒼牙〕は 2 回 × 9f = 18f。重撃が特殊スキルの回数を使うかは後で決まるので、最大の 18f で見積もる）、特殊スキル = 9f、スキルの初撃 = 9f。
  //   防御ヒットストップ無効（defhalt=false）: 通常攻撃 2/4/4/6/6f、重撃 12f、特殊スキル 6f、スキルの初撃 6f
  '10000128-anemo': [{
    ...stateMode('e', '疾風怒濤', 39, 720, 'varka/skill.go: QueueCharTask(…, skillHitmark-1) で AddStatus(skillKey, 12*60, true)（sturm-und-drang。実行: E の 39f 後に 720f）。varka/burst.go: ExtendStatus(skillKey, 2.3*60)。交代で解除。状態の間の E は specialSkill', {
      description: '疾風怒濤の状態。この間、特殊スキル（spE）を使える。ヒットストップ・自分の元素爆発で延びる。キャラ交代で終わる',
      repress: { frames: [{ total: 68, cancels: { attack: 55, charge: 64, skill: 56, burst: 55, dash: 56, jump: 55, walk: 65 }, source: 'skill.go:specialSkillFrames' }], actions: ['e'] },
      special: {
        kind: 'skill',
        extendOnBurst: 2.3,
        hitlag: { normal: [6, 8, 8, 9, 10].map(f => f / 60), charged: 18 / 60, special: 9 / 60, skill: 9 / 60 },
        hitlagNoDefHalt: { normal: [2, 4, 4, 6, 6].map(f => f / 60), charged: 12 / 60, special: 6 / 60, skill: 6 / 60 },
      },
    }),
    action: ['e', 'e_hold'],
  }],
  // オデット: 柔き払暁のコーダの受付（スキル 394f。ヒットストップで延びる／爆発 361f）。特殊スキル（spE）を 1 回使うと閉じる。スキル・爆発の効果バーは別に出す。
  // 通常攻撃のヒットストップ（odette/attack.go: attackHitlagHaltFrame {1.8}{1.8}{0,1.8}{3}{0}、attackDefHalt {true}{true}{false,false}{false}{true}。HitlagFactor 0.01）
  '10000150-cryo': [{
    action: ['e', 'e_hold'],
    keepEffectDuration: true,
    mode: specialWindowMode('柔き払暁のコーダの受付', 'スキル', 394, '特殊スキルを使える期間（受付）。通常攻撃のヒットストップで延びる。受付の外では、gcsim では通常のスキルになる',
      { kind: 'skill', singleUse: true, hitlag: { normal: [6, 6, 2, 3, 0].map(f => f / 60) }, hitlagNoDefHalt: { normal: [2, 2, 2, 3, 0].map(f => f / 60) } },
      'odette/skill.go: AddStatus(skillRecastKey, 394, true)（スキルの発動と同時。ヒットストップで延びる）。特殊スキルを使うと DeleteStatus'),
  }, {
    action: 'q',
    keepEffectDuration: true,
    mode: specialWindowMode('柔き払暁のコーダの受付', '爆発', 6 * 60 + 1, '特殊スキルを使える期間（受付）。通常攻撃のヒットストップで延びる。受付の外では、gcsim では通常のスキルになる',
      { kind: 'skill', singleUse: true, hitlag: { normal: [6, 6, 2, 3, 0].map(f => f / 60) }, hitlagNoDefHalt: { normal: [2, 2, 2, 3, 0].map(f => f / 60) } },
      'odette/burst.go: AddStatus(skillRecastKey, 6*60+burstSummonFrame, false)（爆発でも受付が開く）'),
  }],
  // ヴァレサ: マキシマムドライブ（落下攻撃の開始時に、命ノ星座 2 以上、または猛烈パッション中なら 140f）。特殊爆発（spQ。大火山おろし）を 1 回使うか、スキルを使うと閉じる
  '10000111-electro': [{
    action: ['lp', 'hp'],
    keepEffectDuration: true,
    mode: specialWindowMode('マキシマムドライブ', '落下攻撃', 140, '特殊爆発を使える期間（受付）。使うと閉じる。受付の外では、gcsim では通常の爆発（CT が始まる）になる',
      { kind: 'burst', singleUse: true, closedBySkill: true, openCondition: { minConstellation: 2, orBlessing: true } },
      'varesa/plunge.go: getApexDrive（落下攻撃の開始時に、Cons >= 2 または猛烈パッション中なら AddStatus(apexState, 140, true)）。burst.go: volcanicKablam で状態を消す。skill.go: スキルで状態が消える'),
  }],
  // 刻晴・プルーネ・ドゥリン・ディルック: 窓の規則から移した受付型（2026-10-08）。4 人とも、交代しても続く（ゲームでの確認: ユーザー。gcsim も、交代して戻った後の E が再発動）
  // 刻晴: 雷楔（5 秒 + 20f）の間の E が再発動（雷楔を消費）
  '10000042-electro': [{
    action: 'e',
    keepEffectDuration: true,
    mode: windowMode('雷楔', 0, 5 * 60 + 20, 'persists', {
      frames: [{ total: 43, hitmark: 16, cancels: { attack: 42, dash: 16, jump: 16, swap: 42 }, source: 'skill.go:skillRecastFrames' }],
      maxUses: 1,
      endsOnLast: true,
    }, 'keqing/skill.go: Status.Add(stilettoKey, 5*60+20)。雷楔がある間の E は再発動'),
  }],
  // プルーネ: 再発動の受付（364f）の間の E が変換（受付を消費）。実際の受付は拡散で開く（必ず開く前提）
  '10000132-anemo': [{
    action: 'e',
    keepEffectDuration: true,
    mode: windowMode('変換の受付', 0, 364, 'persists', {
      frames: [{ total: 82, cancels: { attack: 65, charge: 76, skill: 69, burst: 67, dash: 67, jump: 66, swap: 65 }, source: 'skill.go:skillConvertFrames' }],
      maxUses: 1,
      endsOnLast: true,
    }, 'prune/skill.go: AddStatus(skillRecastWindowKey, 364)。拡散で受付が開く', { noBar: false, keepEffectBar: true, description: '変換の受付（受付）。この間の元素スキル（E）は別の動作になり、CT を使わない。実際は、E のダメージが敵に拡散を起こしたときだけ開く（アプリは、拡散が起きる前提で、必ず開く）' }),
  }],
  // ドゥリン: スキルの受付（6 秒）の間の E が白／黒の再発動（受付を消費。どちらになるかでフレームが違い、未確認のため、E の通常のフレーム）
  '10000123-pyro': [{
    action: 'e',
    keepEffectDuration: true,
    // 受付の間の E は白（純白の正の状態）、N は黒（漆黒の否の状態）に入る。状態は 30 秒（2026-10-10）
    mode: windowMode('再発動の受付', 0, 6 * 60, 'persists', {
      followUps: { e: {label:'純白の正',description:'純白の正の状態（30 秒）。元素爆発は「純白の法則・変転する光」（白焔の龍）になる。漆黒の否の状態に置き換わる',startDelayFrames:0,durationFrames:1800,swap:'persists',enders:[],holdByDefault:false,noHold:true,replaces:['漆黒の否'],source:'durin/skill.go: skillRecastWhite（AddStatus(whiteKey, 30*60)・DeleteStatus(blackKey)）。burst.go: blackKey が無ければ burstWhite'}, n: {label:'漆黒の否',description:'漆黒の否の状態（30 秒）。元素爆発は「漆黒の法則・燻る星」（黒蝕の龍）になる。純白の正の状態に置き換わる',startDelayFrames:0,durationFrames:1800,swap:'persists',enders:[],holdByDefault:false,noHold:true,replaces:['純白の正'],burstVariant:{name:'元素爆発: 漆黒の法則・燻る星',effectLabel:'黒蝕の龍'},source:'durin/skill.go: skillRecastBlack（AddStatus(blackKey, 30*60)・DeleteStatus(whiteKey)）。burst.go: blackKey の間は burstBlack'} },
      frames: [{ total: 83, cancels: {attack:62,skill:53,burst:50,dash:46,jump:47,swap:48}, source: 'durin/skill.go: skillRecastWhiteFrames（受付の間の E = 白の再発動）' }],
      framesByAction: { n: { total: 67, cancels: {attack:64,skill:48,burst:45,dash:42,jump:41,swap:43}, source: 'durin/skill.go: skillRecastBlackFrames（attack.go: 受付の間の通常攻撃 = 黒の再発動）' } },
      actions: ['e', 'n'],
      maxUses: 1,
      endsOnLast: true,
    }, 'durin/skill.go: skillWindowDur = 6*60（受付の間の E = skillRecastWhite、attack.go: 受付の間の N = skillRecastBlack。どちらも受付を消す）', { noBar: false, keepEffectBar: true, description: '再発動の受付（受付）。この間の元素スキル（E）は白、通常攻撃（N）は黒の再発動になり、CT を使わない。どちらを使っても受付は閉じる' }),
  }],
  // ディルック: E の後 4 秒の間の E が 2・3 段目（E のたびに 4 秒に更新。3 段目で閉じる）。CT は 1 段目で始まる（10 秒）。ヒットストップによる延長は含めない
  '10000016-pyro': [{
    action: 'e',
    keepEffectDuration: true,
    mode: windowMode('連撃の受付', 0, 4 * 60, 'persists', {
      frames: [
        { total: 38, hitmark: 28, cancels: { skill: 37, burst: 37, dash: 28, jump: 31, swap: 36 }, source: 'skill.go:skillFrames[1]' },
        { total: 66, hitmark: 46, cancels: { attack: 58, skill: 57, burst: 57, dash: 47, jump: 48 }, source: 'skill.go:skillFrames[2]' },
      ],
      maxUses: 2,
      refreshFrames: [4 * 60, 4 * 60],
      barPerUse: true,
      endsOnLast: true,
    }, 'diluc/skill.go: AddStatus(eWindowKey, 4*60, true)（E のたびに更新）、eCounter == 3 で DeleteStatus、SetCD は 1 段目（10*60）', { noBar: false, keepEffectBar: true }),
  }],
  // 千織（一回押しの E）: 傘の一振りの後（26f）から 78f の間の E が再発動（次のキャラへ強制交代。交代の遅れは 1f）。長押し E は対象外。窓の規則から移した
  '10000094-geo': [{
    action: 'e',
    keepEffectDuration: true,
    mode: windowMode('再発動の受付', 26, 78, 'ends', {
      frames: [{ total: 1, cancels: {}, source: 'skill.go:skillRecast（強制交代。アプリの交代遅延 1f）' }],
      maxUses: 1,
      endsOnLast: true,
      // 窓の間は、E も長押し E も再発動になる（gcsim: a1WindowKey が有効なら hold に関係なく skillRecast）
      actions: ['e', 'e_hold'],
    }, 'chiori/skill.go: skillA1WindowStarts[0]=26, skillA1WindowDurations[0]=78 → activateA1Window（AddStatus(a1WindowKey, 78, true)）', { noBar: false, keepEffectBar: true }),
  }, {
    // 長押し（hold=1）: 窓は skillA1WindowStarts[1]=42 から skillA1WindowDurations[1]=77f（2026-10-10）
    action: 'e_hold',
    keepEffectDuration: true,
    mode: windowMode('再発動の受付', 42, 77, 'ends', {
      frames: [{ total: 1, cancels: {}, source: 'skill.go:skillRecast（強制交代。アプリの交代遅延 1f）' }],
      maxUses: 1,
      endsOnLast: true,
      // 窓の間は、E も長押し E も再発動になる（gcsim: a1WindowKey が有効なら hold に関係なく skillRecast）
      actions: ['e', 'e_hold'],
    }, 'chiori/skill.go: skillA1WindowStarts[1]=42, skillA1WindowDurations[1]=77 → activateA1Window', { noBar: false, keepEffectBar: true }),
  }],
  // 藍硯: 探知が命中した 7f 後から 66f の間の E が羽月の輪（CT なし）。一回押しでも長押しでも開く（長押しは、長押しの終わりから）。命中する前提。窓の規則から移した
  '10000108-anemo': [{
    action: ['e', 'e_hold'],
    keepEffectDuration: true,
    mode: windowMode('羽月の輪の受付', 7, 66, 'ends', {
      frames: [{ total: 41, cancels: { attack: 37, burst: 39, dash: 38, jump: 39 }, source: 'attack.go:ringsFrames' }],
      maxUses: 1,
      endsOnLast: true,
      actions: ['e'],
    }, 'lanyan/skill.go: detectHitmark = 7（長押しは 7 + hold）、leapBack で AddStatus(leapBackStatus, 66, true)。状態の間の E は reathermoonRings', { startAfterHold: true, noBar: false, keepEffectBar: true, blocked: { types: ['skill_hold'], result: 'none', hint: 'ゲームでは、受付の間の長押し E は何も起きません（CT も使いません。回数 1 のとき。6 凸の回数 2 は未確認）。受付が終わってから置いてください' } }),
  }],
  // ニィロウ: 剣舞（600f）。状態の間の E はステップ（3 段。CT なし）で、3 段目で剣舞が終わる（実行: 3 段目の 40f 後に tranquilityaura）
  '10000070-hydro': [stateMode('e', '剣舞', 0, 600, 'nilou/skill.go: AddStatus(pirouetteStatus, 10*60)、whirlingStepsFrames。3 段目で pirouette が終わる。交代で解除', {
    repress: {
      frames: [
        { total: 33, cancels: { attack: 27, skill: 27, dash: 26, jump: 27, swap: 31 }, source: 'skill.go:whirlingStepsFrames[0]' },
        { total: 62, cancels: { attack: 40, skill: 32, burst: 40, dash: 36, jump: 37 }, source: 'skill.go:whirlingStepsFrames[1]' },
        { total: 63, cancels: { dash: 57, jump: 57, swap: 61 }, source: 'skill.go:whirlingStepsFrames[2]' },
      ],
      // 状態の間の N は剣舞の N（歩みと同じ 3 段の数え方。2026-10-10）。N で 3 段目を終えると、8 秒の月の祈りに入る（その間の N も剣舞の N）
      actions: ['e', 'n'],
      framesByAction: { n: [{total:20,hitmark:14,cancels:{attack:18,skill:14,burst:14,dash:14,jump:14,swap:14},source:'skill.go:swordDanceFrames[0]（剣舞の N 1 段。InitNormalCancelSlice(hitmark, 20)）'},{total:23,hitmark:12,cancels:{skill:12,burst:12,dash:12,jump:12,swap:12},source:'skill.go:swordDanceFrames[1]'},{total:60,hitmark:35,cancels:{attack:55,skill:35,burst:35,dash:35,jump:35,swap:35},source:'skill.go:swordDanceFrames[2]'}] },
      followUps: { n: {label:'月の祈り',description:'月の祈りの状態（8 秒）。通常攻撃が剣舞の N になる。キャラ交代で終わる',startDelayFrames:30,durationFrames:480,swap:'ends',enders:[],holdByDefault:false,noHold:true,noBar:true,normalFrames:[{total:20,hitmark:14,cancels:{attack:18,skill:14,burst:14,dash:14,jump:14,swap:14},source:'skill.go:swordDanceFrames[0]（剣舞の N 1 段。InitNormalCancelSlice(hitmark, 20)）'},{total:23,hitmark:12,cancels:{skill:12,burst:12,dash:12,jump:12,swap:12},source:'skill.go:swordDanceFrames[1]'},{total:60,hitmark:35,cancels:{attack:55,skill:35,burst:35,dash:35,jump:35,swap:35},source:'skill.go:swordDanceFrames[2]'}],source:'nilou/skill.go: Pirouette（N で 3 段目を終えると AddStatus(lunarPrayerStatus, 8*60)。delayDance = 30）、attack.go: lunarPrayerStatus の間の N は SwordDance。バーは gcsim の副次効果（lunarprayer）'} },
      maxUses: 3,
      endsOnLast: true,
    },
  })],
  // キィニチ: 夜魂の加護（E の 9f 後。長押しなら長押しの終わりから。610f）。加護の中は、N が円軌道射撃（2 種が交互）、E は夜魂値が満タン（20）のとき廻狩貫鱗砲（CT なし。加護は続く）。
  // 夜魂値: 時間で 0.5 秒ごとに +1、N で +3（A1 の燃焼・烈開花で +7、盲点で +4 は、アプリは数えない）。交代で終わる（gcsim: OnCharacterSwap の cancelNightsoul。ゲームでの確認は未）。
  // 廻狩貫鱗砲の長押しは、既定は最短の照準（hold=1。発射 17f）。長押しの長さは所要時間で変える（上限 181）。加護の中では、重撃・落下攻撃は使えない（gcsim は実行エラー）
  '10000101-dendro': [{
    action: ['e', 'e_hold'],
    keepEffectDuration: true,
    mode: {
      label: '夜魂の加護',
      description: '夜魂の加護の状態（10 秒）。通常攻撃は円軌道射撃になり、元素スキル（E）は夜魂値が満タン（20）のとき廻狩貫鱗砲になる（CT なし）。キャラ交代で終わる',
      startDelayFrames: 9,
      durationFrames: 610,
      startAfterHold: true,
      swap: 'ends',
      enders: [],
      holdByDefault: true,
      normalFrames: [
        { total: 53, hitmark: 38, cancels: { attack: 40, skill: 33, burst: 35, dash: 26, jump: 32, walk: 50, swap: 38 }, source: 'attack.go:skillAttackFrames[0]（N1(E)。InitNormalCancelSlice(38, 53)）' },
        { total: 53, hitmark: 38, cancels: { attack: 40, skill: 33, burst: 32, dash: 21, jump: 34, walk: 51, swap: 38 }, source: 'attack.go:skillAttackFrames[1]（N2(E)）' },
      ],
      repress: {
        // 一回押し: 発射 35f の後の scalespikerFrames（既定 100・N/Q 24・ダッシュ/ジャンプ 32・歩き 36・交代 65）
        frames: [{ total: 135, cancels: { attack: 59, burst: 59, dash: 67, jump: 67, walk: 71, swap: 100 }, source: 'skill.go:ScalespikerCannon（releaseFrame 35 + scalespikerFrames）' }],
        actions: ['e', 'e_hold'],
        framesByAction: {
          e: { total: 135, cancels: { attack: 59, burst: 59, dash: 67, jump: 67, walk: 71, swap: 100 }, source: 'skill.go:ScalespikerCannon（releaseFrame 35 + scalespikerFrames）' },
          // 長押し（hold=1: 発射 17f。hold が 1 増えるごとに +1f）
          e_hold: { total: 117, cancels: { attack: 41, burst: 41, dash: 49, jump: 49, walk: 53, swap: 82 }, source: 'skill.go:ScalespikerCannon（releaseFrame 17 + scalespikerFrames。hold=1）' },
        },
      },
      gauge: {
        label: '夜魂値',
        max: 20,
        timeGain: { everyFrames: 30, amount: 1 },
        gainByType: { normal: 3 },
        hint: 'A1（燃焼・烈開花で +7）・盲点（+4）による増加は数えていません。gcsim では、満タンでないと実行エラーになります。通常攻撃を足すか、時間を空けてください',
      },
      blocked: { types: ['charged', 'plunge_low', 'plunge_high'], result: 'error', hint: '夜魂の加護の間は、重撃・落下攻撃は使えません' },
      source: 'kinich/skill.go: EnterTimedBlessing(0, 10*60+10)（skillStart 9 + hold の後）、timePassGenerateNSPoints（30f ごと +1）。attack.go: 加護の間の N は skillAttack（loopShotGenerateNSPoints +3）。Skill: 夜魂値が MaxPoints(20) のとき ScalespikerCannon。kinich.go: NextQueueItemIsValid（加護の間の CA・LP・HP はエラー）、OnCharacterSwap で cancelNightsoul',
    },
  }],
  // --- D-2: 爆発で入る、ボタン操作で終わらないモード（2026-10-08） ---
  '10000026-anemo': [stateMode('q', '靖妖儺舞', 0, 957, 'xiao/burst.go: xiaoburst（実行: 爆発と同時に 957f）。交代で終わる')],
  '10000071-electro': [stateMode('q', '冥祭', 0, 712, 'cyno/burst.go: cyno-q（実行: 爆発と同時に 712f）。交代で終わる')],
  '10000092-pyro': [stateMode('q', '瑞獣の舞', 36, 720, 'gaming/burst.go: gaming-q（実行: 爆発の 36f 後から 720f）。交代で終わる')],
  '10000057-geo': [stateMode('q', '怒目鬼王', 0, 795, 'itto/burst.go: itto-q（実行: 爆発と同時に 795f）。交代で終わる')],
  '10000054-hydro': [stateMode('q', '儀来羽衣', 0, 600, 'kokomi/burst.go: kokomiburst（実行: 爆発と同時に 600f）。交代で終わる')],
  '10000106-pyro': [stateMode('q', '燔天の時', 105, 420, 'mavuika/burst.go: mavuika-burst（実行: 爆発の 105f 後から 420f）。交代で終わる')],
  // 夢想の一心の間の通常攻撃は刀の 5 段、重撃は刀の重撃（2 回ヒット 56f）（2026-10-10）
  '10000052-electro': [stateMode('q', '夢想の一心', 0, 518, 'raiden/burst.go: raidenburst（実行: 爆発と同時に 518f）。交代で終わる', {
    normalFrames: [{total:21,hitmark:12,cancels:{attack:19,skill:12,burst:12,dash:12,jump:12,swap:12},source:'attack.go:swordFrames[0]'},{total:26,hitmark:13,cancels:{attack:16,skill:13,burst:13,dash:13,jump:13,swap:13},source:'attack.go:swordFrames[1]'},{total:34,hitmark:11,cancels:{attack:16,skill:11,burst:11,dash:11,jump:11,swap:11},source:'attack.go:swordFrames[2]'},{total:67,hitmark:33,cancels:{attack:44,skill:33,burst:33,dash:33,jump:33,swap:33},source:'attack.go:swordFrames[3]'},{total:59,hitmark:33,cancels:{skill:33,burst:33,dash:33,jump:33,swap:33},source:'attack.go:swordFrames[4]'}],
    chargedFrames: {total:56,hitmark:32,cancels:{dash:32,jump:32},source:'charge.go:swordCAFrames（2 回ヒット。24f・32f）'},
  })],
  '10000020-electro': [stateMode('q', '雷牙', 32, 900, 'razor/burst.go: razor-q（実行: 爆発の 32f 後から 900f）。交代で終わる')],
  '10000097-electro': [stateMode('q', '黄昏の祈り', 0, 480, 'sethos/burst.go: sethos-burst（実行: 爆発と同時に 480f）。交代で終わる')],
  // クロリンデ: 夜巡り（E の 6f 後から 7.5 秒）。状態の間の E は突き（CT なし・回数の制限なし・状態は延びない）、通常攻撃は狩りの N、爆発は別のフレーム。
  // 交代で終わる（ゲーム。ユーザーの確認 D76）。gcsim は交代しても続く（交代のフックなし）
  '10000098-electro': [{
    action: 'e',
    keepEffectDuration: true,
    mode: {
      label: '夜巡り',
      description: '夜巡りの状態。状態の間の元素スキル（E）は突き（CT なし）、通常攻撃は狩りの N になる。キャラ交代で終わる',
      startDelayFrames: 6,
      durationFrames: 7.5 * 60,
      swap: 'ends',
      enders: [],
      holdByDefault: true,
      repress: { frames: [{ total: 43, cancels: { attack: 24, skill: 24, burst: 24, dash: 25, jump: 25, swap: 42 }, source: 'skill.go:skillDashFrames' }] },
      normalFrames: [
        { total: 18, hitmark: 8, cancels: { skill: 11, burst: 10, dash: 8, jump: 8, swap: 8 }, source: 'attack.go:skillAttackFrames[0]（InitNormalCancelSlice は skill 以外へ hitmark でキャンセル）' },
        { total: 17, hitmark: 8, cancels: { skill: 10, burst: 10, dash: 8, jump: 8, swap: 8 }, source: 'attack.go:skillAttackFrames[1]' },
        { total: 20, hitmark: 9, cancels: { skill: 9, burst: 9, dash: 9, jump: 9, swap: 9 }, source: 'attack.go:skillAttackFrames[2]' },
      ],
      burstFrames: { total: 128, cancels: { attack: 127, skill: 127, dash: 127, swap: 127 }, source: 'burst.go:burstSkillStateFrames' },
      source: 'clorinde/skill.go: AddStatus(skillStateKey, skillStart(6)+skillStateDuration(7.5)*60, true)。状態の間の E は skillDash（SetCD なし）。攻撃は attack.go の skillAttack、爆発は burstSkillStateFrames',
    },
  }],
  // 閑雲: 雲の変化（1 段目の跳躍から 220f）。状態の間の E は 2・3 段目の跳躍（状態が 238f・179f に更新）。落下攻撃で終わる。
  // 交代で終わる（ゲーム: 交代して戻ると 2 回目の E が CT。ユーザーの確認 D76）。gcsim は交代しても続く（交代のフックなし）。
  // 時間切れで終わったとき（落下攻撃を使わなかったとき）は、スキルの CT が 3 秒短くなる（cooldownReduceOnExpire。xianyun/skill.go cooldownReduce）。凸 6 の CT なし跳躍は含めない
  '10000093-anemo': [{
    action: 'e',
    mode: {
      label: '雲の変化',
      description: '雲の変化の状態。状態の間の元素スキル（E）は 2・3 段目の跳躍（状態が更新される）。落下攻撃、キャラ交代で終わる',
      // xianyun.go: ActionReady が、雲の変化の間の通常攻撃・重撃を false にする（実行で確認: E → N の N は、状態の期限 222f まで待つ）
      blocked: { types: ['normal', 'charged'], result: 'wait', hint: '先に落下攻撃を置いて、雲の変化を終わらせてください' },
      startDelayFrames: 0,
      durationFrames: 220,
      swap: 'ends',
      enders: [{ by: 'plunge_low', cooldown: 'none' }, { by: 'plunge_high', cooldown: 'none' }],
      holdByDefault: true,
      // xianyun/skill.go: QueueCharTask(cooldownReduce(src), skillStateDur[counter]) → 最後の跳躍から状態の長さの後に ReduceActionCooldown(skill, 3*60)。plunge.go driftcloudWave が skillSrc を無効にして取り消す。交代では取り消されない
      cooldownReduceOnExpire: { seconds: 3, afterSwap: true },
      repress: {
        frames: [
          { total: 243, cancels: { skill: 15, burst: 60, dash: 60, jump: 60, walk: 66, swap: 59, lowPlunge: 15, highPlunge: 15 }, source: 'skill.go:skillLeapFrames[1]' },
          { total: 178, cancels: { skill: 128, burst: 126, dash: 130, jump: 129, walk: 125, swap: 126, lowPlunge: 18, highPlunge: 18 }, source: 'skill.go:skillLeapFrames[2]' },
        ],
        maxUses: 2,
        refreshFrames: [238, 179],
      },
      source: 'xianyun/skill.go: skillStateDur = {220, 238, 179}、AddStatus(skillStateKey, skillStateDur[counter], true)。3 回使うと次は新しい E。plunge.go: 落下攻撃で状態が消える',
    },
  }],
};

/**
 * 長押しの長さを gcsim の `hold=<フレーム数>` で渡すスキル（モード維持の段階 ③。2026-10-08）。キー: キャラ ID。
 * genshin-db に長押しの CT が無く、gcsim のフレーム表が長押しの後の部分だけ（名前に End を含むなど）で、長押しのアクションが生成されないキャラ。
 * - table: 長押しの後の部分のフレーム表、offsetFrames: `hold` に足される固定の長さ、maxHoldFrames: `hold` の上限
 * - CT開始位置・frames に含まれる長押し（holdInFrames）は、cooldownStartOverrides.ts
 */
const PARAM_HOLD_SKILLS: Record<string, { table: string; offsetFrames: number; maxHoldFrames: number; note: string }> = {
  // リネット: hold は 1〜150。長押しの状態は hold + 34f（skillHold(hold + 34)）、その後に skillHoldEndFrames
  '10000083-anemo': { table: 'skillHoldEndFrames', offsetFrames: 34, maxHoldFrames: 150, note: 'lynette/skill.go: Skill（hold > 150 は 150）、skillHold: Frames = duration + skillHoldEndFrames[next]' },
  // ジン: hold は 0〜300（min(hold, 300)）。フレームは skillFrames[next] + hold（hitmark = 21 + hold）。CT は hitmark − 2 から（holdEnd + 19f）
  '10000003-anemo': { table: 'skillFrames', offsetFrames: 0, maxHoldFrames: 300, note: 'jean/skill.go: Skill（hold = min(hold, 300)）、Frames = skillFrames[next] + hold、SetCDWithDelay(…, 360, hitmark-2)' },
  // ナヴィア: hold は 1〜241（hold > 0 で長押し。長押しの長さは hold − 1）。フレームは skillFrames[1][結晶の数が 3 以上なら 1][next] + hold − 1。CT は firingTime = 41 + hold − 1 から。結晶の数はアプリで持たないので、3 未満の表 [1][0] を使う
  '10000091-geo': { table: 'skillFrames[1][0]', offsetFrames: -1, maxHoldFrames: 241, note: 'navia/skill.go: Skill（hold > 241 は 241、hold -= 1）、firingTime = skillHoldCDStart(41) + hold、Frames = skillFrames[holdIndex][shrapnelIndex][next] + hold' },
  // 鹿野院平蔵: 長押し（hold != 0）は、変格が 4 層になるまで溜める（1 層ごとに 45f。層が 4 なら 17f）。長さは hold ではなく、持っている層で決まる。
  // アプリは層を持たないので、0 層から 4 層まで溜める長さ（180f）を、最大の長押しとする（層があるときは gcsim の結果の反映で短くなる）。
  // フレームは delay + skillEndFrames[next] + skillHitmark(20)。CT は skillCDStart(18) + delay（motionStart から）
  '10000059-anemo': { table: 'skillEndFrames', offsetFrames: 20, maxHoldFrames: 180, note: 'heizou/skill.go: skillHold（decStack 0 のとき skillHoldDuration(4) = 180f。4 層なら holdAtFullStacksPenalty 17f）、Frames = delay + skillEndFrames[next] + skillHitmark' },
  // アンバー: hold に上限はない（gcsim は丸めない。ゲームも、人形を投げる距離が上限で固定されるだけで、長押しは続けられる。ユーザー確認 2026-10-10）。
  // フレームは skillFrames[next] + hold、人形が着地・CT が始まるのは hold の後。既定は 1 秒（60f。仮の値）で、所要時間を編集して長さを変える
  '10000021-pyro': { table: 'skillFrames', offsetFrames: 0, maxHoldFrames: 60, note: 'amber/skill.go: hold = p["hold"]（丸めなし）、Frames = skillFrames[next] + hold、SetCDWithDelay(…, skillStart + hold)' },
  // キィニチ: 加護に入る E の hold は 0〜301（hold > 0 で、長押しの長さは hold − 1。照準モード）。フレームは skillFrames[next] + hold − 1、加護に入る・CT が始まるのは skillStart(9) + hold − 1。
  // 加護の中の E（廻狩貫鱗砲）の hold は 0〜181（モードの定義 repress）
  '10000101-dendro': { table: 'skillFrames', offsetFrames: -1, maxHoldFrames: 301, note: 'kinich/skill.go: Skill（hold > 301 は 301、hold > 0 なら hold -= 1）、Frames = skillFrames[next] + hold、Tasks.Add(…, skillStart + hold)' },
  // 藍硯: hold は 0〜610。フレームは skillHitFrames（探知が命中した場合。窓の規則と同じく命中する前提。gcsim の実行でも命中のフレーム）+ hold
  '10000108-anemo': { table: 'skillHitFrames', offsetFrames: 0, maxHoldFrames: 610, note: 'lanyan/skill.go: Skill（hold > 610 は 610）、Frames = getCurrentSkillFrames()[next] + hold（命中すると leap-back の状態で skillHitFrames）' },
};

/** 一回押しの E のフレーム表が、名前に「End」を含むために除外されるキャラ（キー: キャラ ID）。table = 表の名前、offsetFrames = 表に足すフレーム（命中など） */
const TAP_END_FRAMES: Record<string, { table: string; offsetFrames: number }> = {
  '10000059-anemo': { table: 'skillEndFrames', offsetFrames: 20 },
};

/**
 * 長押しの E が、フレーム表の添字（一回押し [0]・長押し [1]）で分かれているが、genshin-db に長押しの CT が無く、自動では見つからないキャラ
 * （キー: キャラ ID、値: 長押しの表の添字）。gcsim は `skill[hold=1]`。CT・効果時間は一回押しと同じ（追加作業 17。2026-10-10）
 * ラウマ: skillFrames[1]（露を 1 つ以上持っているときだけ使える。無いと gcsim は実行エラー）／モナ: skillFrames[1]（水中の幻願）
 */
const FORCED_INDEXED_HOLD: Record<string, number> = {
  '10000119-dendro': 1,
  '10000041-hydro': 1,
  // 千織: 長押し = skillFrames[1]（88f。CT は 34f から。再発動の受付は 42f から 77f）
  '10000094-geo': 1,
};

/**
 * 長押しが、段（hold = 1・2 など）で別のフレーム表になっているキャラ（キー: キャラ ID）。
 * shortHoldIndex = 低い段（hold=1）の表の添字 → `_e_shorthold`、holdIndex = 高い段（hold=2）の表の添字 → `_e_hold`。CT・効果時間は一回押しと同じ（追加作業 17。2026-10-10）
 * 雲菫: skillFrames[1]（溜め Lv.1）・[2]（Lv.2）／シグウィン: skillFrames[1]（短押し長押し）・[2]（長押し）
 */
const FORCED_INDEXED_VARIANTS: Record<string, { shortHoldIndex: number; holdIndex: number }> = {
  '10000064-geo': { shortHoldIndex: 1, holdIndex: 2 },
  '10000095-hydro': { shortHoldIndex: 1, holdIndex: 2 },
};

/**
 * 一回押しの E のフレーム表を、表の並び順の最初ではなく、名前で選ぶキャラ（キー: キャラ ID、値: 表の名前）。
 * タルタリヤ: skill.go の最初の表は近接の構えを終わらせる E（skillMeleeFrames。モードの終わらせるアクションのフレームに入れた）で、構えに入る E は skillRangedFrames
 */
const SKILL_TAP_TABLES: Record<string, string> = {
  '10000033-hydro': 'skillRangedFrames',
  // 藍硯: 探知が命中した場合のフレーム（窓の規則〔羽月の輪〕と同じく命中する前提。2026-10-08 の実行で、交代は命中のフレーム〔80f〕）
  '10000108-anemo': 'skillHitFrames',
};

/**
 * 長押しの元素スキルを持たないキャラ。genshin-db のクールタイムのラベルに 2 値ある（タルタリヤは「6.0~36.0秒」＝近接モードの継続時間で変わる）ため、
 * 長押し（hE）と誤って生成されるのを防ぐ。
 */
const NO_HOLD_SKILL = new Set(['10000033-hydro']);

/** 旅人 (空 / 蛍)。genshin-db ではキャラとしては元素なし、天賦は元素ごとに別エントリ。空・蛍は別キャラとして元素ごとに登録する (D35) */
const AETHER_ID = 10000005;
const LUMINE_ID = 10000007;
const TRAVELER_IDS = new Set([AETHER_ID, LUMINE_ID]);

/** genshin-db の旅人天賦名 "旅人 (風元素)" の元素文字 → 元素 */
const TRAVELER_ELEMENT_JA: Record<string, ElementType> = {
  炎: 'pyro', 水: 'hydro', 風: 'anemo', 雷: 'electro', 草: 'dendro', 氷: 'cryo', 岩: 'geo',
};

/** gcsim の旅人フレームは先頭添字が性別 (0 = 空, 1 = 蛍)。gcsim のキーは `aether<元素>` / `lumine<元素>` */
const TRAVELERS = [
  { genshinId: AETHER_ID, genderIndex: 0, label: '空', englishLabel: 'Aether', gcsimPrefix: 'aether' },
  { genshinId: LUMINE_ID, genderIndex: 1, label: '蛍', englishLabel: 'Lumine', gcsimPrefix: 'lumine' },
] as const;

/**
 * 元素スキルの記法（D36）: 長押し派生が無いキャラのスキル = E、長押し系があるキャラの一回押し = tE、長押し系 = hE、再発動 = rE。
 * 別ボタンの派生の表記（キー: 派生名（小文字））。長押しの秒数は、フェーズ5・6 でスキル全体の所要時間からの逆算として、表示側で「hE(?s)」と付ける。
 */
const DERIVED_SKILL_NOTATION: Record<string, { label: string; type: ActionType; startsCooldown: boolean }> = {
  shorthold: { label: 'hE(short)', type: 'skill_hold', startsCooldown: true },
  shorthold0ticks: { label: 'hE(0Ticks)', type: 'skill_hold', startsCooldown: true },
  recast: { label: 'rE', type: 'skill', startsCooldown: false },
  recastframestobike: { label: 'rE(bike)', type: 'skill', startsCooldown: false },
  recastframestoring: { label: 'rE(ring)', type: 'skill', startsCooldown: false },
};

/**
 * 旅人(水)の最大ホールド (`skill[hold=1]` = 22 ティック)。gcsim は shortHold(1 ティック) のフレームに 15 フレーム × 21 を足して計算する
 * (traveler/common/hydro/skill.go: skillHold の extend)。ホールドのテーブル自体は無いので、shortHold から合成する。
 */
const TRAVELER_HYDRO_IDS = new Set([characterKey(AETHER_ID, 'hydro'), characterKey(LUMINE_ID, 'hydro')]);
const TRAVELER_HYDRO_MAX_HOLD_EXTEND = 15 * (22 - 1);

/** フレームが取得できなかった場合にタイムライン表示用として使う秒数 (レポートで「仮値」として明示) */
const PLACEHOLDER_DURATION: Partial<Record<ActionType, number>> = {
  normal: 0.4,
  charged: 0.8,
  skill: 0.8,
  skill_hold: 1.2,
  burst: 1.5,
  dash: 0.2,
  jump: 0.55, // gcsim の Jump は体型・直前のアクションで 31〜37f（stam.go の JumpLength）。gcsim の結果の反映で、実測の値になる
};

const ELEMENT_MAP: Record<string, ElementType> = {
  ELEMENT_PYRO: 'pyro',
  ELEMENT_HYDRO: 'hydro',
  ELEMENT_ELECTRO: 'electro',
  ELEMENT_DENDRO: 'dendro',
  ELEMENT_CRYO: 'cryo',
  ELEMENT_ANEMO: 'anemo',
  ELEMENT_GEO: 'geo',
};

const ELEMENT_HEX: Record<ElementType, string> = {
  pyro: '#ef4444',
  hydro: '#0ea5e9',
  electro: '#a855f7',
  dendro: '#10b981',
  cryo: '#06b6d4',
  anemo: '#14b8a6',
  geo: '#f59e0b',
  physical: '#94a3b8',
};

const WEAPON_MAP: Record<string, WeaponType> = {
  WEAPON_SWORD_ONE_HAND: 'sword',
  WEAPON_CLAYMORE: 'claymore',
  WEAPON_POLE: 'polearm',
  WEAPON_BOW: 'bow',
  WEAPON_CATALYST: 'catalyst',
};

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export interface GenerationProgress {
  phase: string;
  done: number;
  total: number;
}

export interface CharacterGenerationReport {
  generatedAt: string;
  gcsimCommit: string;
  /** 発動バフの結び付けに使った辞書の gcsim のコミット（画面から生成したとき） */
  catalogCommit?: string;
  totalCharacters: number;
  charactersWithFrames: number;
  /** 生成対象外にしたキャラ */
  skipped: Array<{ name: string; reason: string }>;
  /** フレームが取れず仮の秒数を使ったアクション */
  placeholderDurations: Array<{ characterId: string; name: string; actions: string[]; reason: string }>;
  /** CT が genshin-db から取れなかったスキル/爆発 */
  missingCooldowns: Array<{ characterId: string; name: string; actionId: string }>;
  /** gcsim の式を評価できなかった行数 */
  unresolvedGoLines: Array<{ characterId: string; file: string; count: number }>;
  /** 落下攻撃 LP / HP（D48）: 生成した件数と、plunge.go はあるのにフレーム表を選べなかったキャラ */
  plunge: { lowCount: number; highCount: number; unresolved: Array<{ characterId: string; name: string }> };
  /** 効果継続時間の gcsim による補完（D33 / 5-3）: 補った件数・genshin-db の値との食い違い（genshin-db を優先） */
  effectDuration: {
    supplemented: Array<{ characterId: string; name: string; actionId: string; seconds: number; source: string }>;
    mismatches: Array<{ characterId: string; name: string; actionId: string; genshinDb: number; gcsim: number }>;
    /** 一覧にあるのに、対応するアクションが無い（キャラ・アクションの ID の変更・削除） */
    orphans: string[];
    /** 「効果時間なし」にした（バーに出さない。ユーザー決定）アクション */
    suppressed: Array<{ characterId: string; name: string; actionId: string; genshinDb: number; reason: string }>;
  };
  /** CT開始位置（D37 / D44）: 自動で読めた件数・手で補った件数・未設定の一覧・手で補う値との食い違い */
  cooldownStart: {
    read: number;
    manual: number;
    unresolved: Array<{ characterId: string; name: string; actionId: string; reason: string }>;
    mismatches: Array<{ characterId: string; name: string; actionId: string; readFrames: number; manualFrames: number }>;
  };
  /** 命ノ星座で効果継続時間が延びる「(n凸)」アクションの生成結果 */
  constellations: ConstellationReport;
  errors: string[];
}

export interface CharacterMasterResult {
  characters: CharacterConfig[];
  report: CharacterGenerationReport;
  /** 照合表（キャラの分）。生成のたびに作り直す */
  keyMap: KeyMapSection;
}

interface GenshinDbCharacter {
  id: number;
  name: string;
  elementType: string;
  weaponType: string;
  rarity: number;
  images?: Record<string, string>;
}

interface GenshinDbTalentCombat {
  name: string;
  /** 天賦の説明文（装飾の無い文） */
  description?: string;
  attributes?: { labels?: string[]; parameters?: Record<string, number[]> };
}

interface GenshinDbTalent {
  id: number;
  name: string;
  /** 通常攻撃・重撃・落下攻撃（1 つの説明文に 3 つがまとまっている） */
  combat1?: GenshinDbTalentCombat;
  combat2?: GenshinDbTalentCombat;
  combat3?: GenshinDbTalentCombat;
  passive1?: GenshinDbPassive;
  passive2?: GenshinDbPassive;
}

// ---------------------------------------------------------------------------
// 取得ヘルパー
// ---------------------------------------------------------------------------

async function fetchWithRetry(url: string, init?: RequestInit, retries = 2): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
      if (res.status === 403 || res.status === 404) break; // レート制限・存在しないものは再試行しない
    } catch (e) {
      lastError = e;
    }
    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => (await fetchWithRetry(url, init)).json() as Promise<T>;
const fetchText = async (url: string): Promise<string> => (await fetchWithRetry(url)).text();

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

// ---------------------------------------------------------------------------
// genshin-db: CT・効果継続時間の抽出
// ---------------------------------------------------------------------------

interface LabeledValue {
  value: number;
  label: string;
}

/** ラベル "クールタイム|{param6:F1}秒" から数値を取り出す (天賦 Lv1 の値)。複数 param があれば全て返す */
function labelValues(label: string, params: Record<string, number[]>): number[] {
  const formula = label.split('|')[1] ?? '';
  return [...formula.matchAll(/\{(param\d+):[^}]*\}/g)]
    .map(m => params[m[1]]?.[0])
    .filter((v): v is number => typeof v === 'number');
}

function findLabel(
  combat: GenshinDbTalentCombat | undefined,
  titles: string[],
  pick: 'first' | 'last' = 'first',
): LabeledValue | undefined {
  const labels = combat?.attributes?.labels ?? [];
  const params = combat?.attributes?.parameters ?? {};
  for (const title of titles) {
    const label = labels.find(l => l.split('|')[0].trim() === title);
    if (!label) continue;
    const values = labelValues(label, params);
    if (values.length === 0) continue;
    return { value: pick === 'first' ? values[0] : values[values.length - 1], label: title };
  }
  return undefined;
}

/** "〜継続時間" / "〜存在時間" / "〜石化時間" / "〜アクティブ時間" で終わるラベルのうち最初のもの (延長・長押し・CT 系は除外) */
function findAnyDuration(combat: GenshinDbTalentCombat | undefined, exclude: RegExp): LabeledValue | undefined {
  const labels = combat?.attributes?.labels ?? [];
  const params = combat?.attributes?.parameters ?? {};
  for (const label of labels) {
    const title = label.split('|')[0].trim();
    if (!/(継続時間|存在時間|石化時間|アクティブ時間)$/.test(title) || exclude.test(title)) continue;
    const values = labelValues(label, params);
    if (values.length > 0) return { value: values[0], label: title };
  }
  return undefined;
}

interface TalentTimings {
  skillTapCooldown?: LabeledValue;
  skillHoldCooldown?: LabeledValue;
  skillTapDuration?: LabeledValue;
  skillHoldDuration?: LabeledValue;
  burstCooldown?: LabeledValue;
  burstDuration?: LabeledValue;
}

function extractTalentTimings(talent: GenshinDbTalent | undefined): TalentTimings {
  const skill = talent?.combat2;
  const burst = talent?.combat3;

  const tapCdTitles = ['一回押しクールタイム', 'クールタイム', 'スキルクールタイム', 'スキルのクールタイム', '基本クールタイム'];
  let skillTapCooldown = findLabel(skill, tapCdTitles);
  let skillHoldCooldown = findLabel(skill, ['長押しクールタイム', '最大チャージクールタイム']);
  // "クールタイム|{一回押し}/{長押し}秒" のように1ラベルに2値ある場合
  if (!skillHoldCooldown) {
    const both = findLabel(skill, ['クールタイム'], 'last');
    if (both && skillTapCooldown && both.value !== skillTapCooldown.value) {
      skillHoldCooldown = { value: both.value, label: 'クールタイム (2値目)' };
    }
  }

  const tapDurTitles = ['継続時間', '一回押し/長押し継続時間', '基礎継続時間', '最大継続時間'];
  const skillTapDuration = findLabel(skill, tapDurTitles) ?? findAnyDuration(skill, /延長|長押し|クールタイム/);
  const skillHoldDuration = findLabel(skill, ['長押し最大継続時間', '長押しの継続時間', '一回押し/長押し継続時間']) ?? skillTapDuration;

  const burstCooldown = findLabel(burst, ['クールタイム']);
  const burstDuration = findLabel(burst, ['継続時間', '基礎継続時間']) ?? findAnyDuration(burst, /延長|クールタイム/);

  return { skillTapCooldown, skillHoldCooldown, skillTapDuration, skillHoldDuration, burstCooldown, burstDuration };
}

// ---------------------------------------------------------------------------
// gcsim: フレームテーブルの選択
// ---------------------------------------------------------------------------

interface ParsedCharacterFiles {
  /** ファイル名 (拡張子なし) → 解析結果 */
  files: Record<string, ParsedGoFile>;
  /** skill.go / burst.go の CT を開始する呼び出し（CT開始位置の読み取り用） */
  cooldownCalls: CooldownCall[];
}

/** "skillFrames[1]" → { base: "skillFrames", index: "1" } */
function splitTableName(name: string): { base: string; index?: string } {
  const m = /^(\w+?)((?:\[\w+\])*)$/.exec(name);
  if (!m || !m[2]) return { base: name };
  return { base: m[1], index: m[2] };
}

/** 同じ配列 (base 名) のうち最初に定義されたテーブルだけを残す */
function firstOfEachFamily(tables: FrameTable[]): FrameTable[] {
  const seen = new Set<string>();
  return tables.filter(t => {
    const { base } = splitTableName(t.name);
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  });
}

function toActionFrames(table: FrameTable, file: string, consts: Map<string, number>): ActionFrames {
  const hitmark = findHitmark(table, consts);
  return {
    total: table.total,
    ...(hitmark !== undefined ? { hitmark } : {}),
    cancels: { ...table.cancels },
    source: `${file}.go:${table.name}`,
  };
}

const framesToSec = (f: number) => Number((f / 60).toFixed(3));

/**
 * plunge.go から低・高の落下攻撃のフレーム表を選ぶ。名前が lowPlungeFrames / highPlungeFrames のものを優先し、
 * 無ければ lowPlungeFramesC のような接尾辞つき、それも無ければ名前に low / high と plunge を含むもの（バイク・炎など特殊形態は除く）。
 * 全体フレームが 1000 以上のものは、gcsim 側が未実装の仮置き（旅人(空)の 5000）なので使わない
 */
function findPlungeTable(tables: FrameTable[], kind: 'low' | 'high'): FrameTable | undefined {
  const usable = firstOfEachFamily(tables).filter(t => t.total < 1000);
  const base = (t: FrameTable) => splitTableName(t.name).base;
  const exact = `${kind}PlungeFrames`;
  return usable.find(t => base(t) === exact)
    ?? usable.find(t => base(t).startsWith(exact))
    ?? usable.find(t => new RegExp(`${kind}.*plunge|plunge.*${kind}`, 'i').test(base(t)) && !/bike|fiery|special/i.test(base(t)));
}

// ---------------------------------------------------------------------------
// アクション定義の組み立て
// ---------------------------------------------------------------------------

interface BuildContext {
  id: string;
  weaponType: WeaponType;
  timings: TalentTimings;
  talent?: GenshinDbTalent;
  parsed?: ParsedCharacterFiles;
}

interface BuildResult {
  actions: ActionDefinition[];
  placeholderActions: string[];
}

function buildActions(ctx: BuildContext): BuildResult {
  const { id, timings, talent, parsed } = ctx;
  const actions: ActionDefinition[] = [];
  const placeholderActions: string[] = [];

  const withDuration = (action: Omit<ActionDefinition, 'defaultDuration'>, durationSec?: number): ActionDefinition => {
    if (durationSec === undefined) {
      placeholderActions.push(action.id);
      return { ...action, defaultDuration: PLACEHOLDER_DURATION[action.type] ?? 0.5 };
    }
    return { ...action, defaultDuration: durationSec };
  };

  const file = (name: string) => parsed?.files[name];

  // --- 通常攻撃 N1..Nn ---------------------------------------------------
  const attack = file('attack');
  let normalTables: FrameTable[] = [];
  if (attack) {
    // 段ごとのテーブルを「最後の添字を除いた名前」でグループ化する
    // (attackFrames[0..4] / attackFrames[attack0Stacks][0..3] / attackFrames[attackTypeLeft] など)
    const groups = new Map<string, FrameTable[]>();
    for (const t of attack.tables) {
      const m = /^(.*)\[\w+\]$/.exec(t.name);
      if (!m) continue;
      if (!groups.has(m[1])) groups.set(m[1], []);
      groups.get(m[1])!.push(t);
    }
    const groupKeys = [...groups.keys()];
    const baseOf = (key: string) => splitTableName(key).base;
    // NewAttackFunc で実際に使われている配列を優先し、無ければ attack* で始まる最初の配列
    const key = attack.attackFuncTables.map(af => groupKeys.find(k => baseOf(k) === af)).find(Boolean)
      ?? groupKeys.find(k => /^attack/i.test(baseOf(k)));
    if (key) normalTables = groups.get(key)!;
  }
  if (attack && normalTables.length > 0) {
    // ボタンは「N」1つ（フェーズ3d / D26）。段ごとの値は normalHits に持ち、連続した N の何段目かは計算時に決める。
    // gcsim の attackFrames[i] は「i+1段目を単体で振った」ときのフレーム (合計ではない)。
    // 次段へ繋ぐ前提: 最終段以外は「次の通常攻撃へのキャンセル」フレーム、最終段は全体フレーム
    const normalHits = normalTables.map((table, i) => {
      const isLast = i === normalTables.length - 1;
      const toNext = isLast ? table.total : (table.cancels.attack ?? table.total);
      return { duration: framesToSec(toNext), frames: toActionFrames(table, 'attack', attack.consts) };
    });
    actions.push({
      id: `${id}_n`,
      name: '通常攻撃',
      shortName: 'N',
      type: 'normal',
      defaultDuration: normalHits[0].duration,
      frames: normalHits[0].frames,
      normalHits,
    });
  } else {
    actions.push(withDuration({ id: `${id}_n`, name: '通常攻撃', shortName: 'N', type: 'normal' }));
  }

  // --- 重撃 / 狙い撃ち -----------------------------------------------------
  const aimed = file('aimed') ?? file('aim');
  // 重撃のフレーム表が attack.go にあるキャラ（カチーナの PR など）もある
  const charge = file('charge') ?? (attack?.tables.some(t => t.name === 'chargeFrames') ? attack : undefined);
  if (aimed && aimed.tables.length > 0) {
    // aimedFrames[0] = 非チャージ, 最終添字 = フルチャージ
    const family = splitTableName(aimed.tables[0].name).base;
    const levels = aimed.tables.filter(t => splitTableName(t.name).base === family);
    const full = levels[levels.length - 1];
    actions.push(withDuration({
      id: `${id}_ca`,
      name: '狙い撃ち (フルチャージ)',
      shortName: 'C',
      type: 'charged',
      frames: toActionFrames(full, 'aimed', aimed.consts),
    }, framesToSec(full.total)));
  } else if (charge && charge.tables.length > 0) {
    const table = charge.tables.find(t => t.name === 'chargeFrames')
      ?? charge.tables.find(t => /^charge/i.test(t.name))
      ?? charge.tables[0];
    actions.push(withDuration({
      id: `${id}_ca`,
      name: '重撃',
      shortName: 'C',
      type: 'charged',
      frames: toActionFrames(table, 'charge', charge.consts),
    }, framesToSec(table.total)));
  } else {
    actions.push(withDuration({ id: `${id}_ca`, name: '重撃', shortName: 'C', type: 'charged' }));
  }

  // gcsim が重撃・狙い撃ちを実装していない（メソッド ChargeAttack / Aimed が無い）キャラ: 実行すると「action charge not implemented」のエラーになる（ディシアなど）。
  // gcsim のキャラが無い（解析できていない）場合は、全部が対象なので、印は付けない
  if (parsed && !Object.values(parsed.files).some(f => f.methods.includes('ChargeAttack') || f.methods.includes('Aimed'))) {
    const ca = actions.find(a => a.id === `${id}_ca`);
    if (ca) ca.gcsimUnsupported = true;
  }

  // --- 落下攻撃 LP / HP（フェーズ3f / D48）: gcsim の plunge.go にフレーム表があるものだけ ------------
  const plungeFile = file('plunge');
  if (plungeFile) {
    for (const kind of [
      { key: 'low' as const, suffix: 'lp', label: 'lP', name: '落下攻撃(低)', type: 'plunge_low' as const },
      { key: 'high' as const, suffix: 'hp', label: 'hP', name: '落下攻撃(高)', type: 'plunge_high' as const },
    ]) {
      const table = findPlungeTable(plungeFile.tables, kind.key);
      if (!table) continue;
      actions.push({
        id: `${id}_${kind.suffix}`,
        name: kind.name,
        shortName: kind.label,
        type: kind.type,
        defaultDuration: framesToSec(table.total),
        frames: toActionFrames(table, 'plunge', plungeFile.consts),
      });
    }
  }

  // --- 元素スキル (一回押し / 長押し / その他派生) ------------------------------
  const skillName = talent?.combat2?.name;
  const skill = file('skill');
  const skillTables = skill ? skill.tables.filter(t => !/Walk|Dash|Cancel|End|Lag|Delay/i.test(splitTableName(t.name).base)) : [];
  const families = firstOfEachFamily(skillTables);
  // 一回押しのフレーム表が「End」を含む名前で除外されるキャラ（平蔵: skillEndFrames + 命中 20f）。表の名前と、足すフレーム
  const tapEndTable = TAP_END_FRAMES[id] && !firstOfEachFamily(skillTables).find(t => !/hold/i.test(t.name)) && skill
    ? skill.tables.find(t => t.name === TAP_END_FRAMES[id].table) : undefined;
  const holdTable = families.find(t => /hold/i.test(t.name) && !/short/i.test(t.name));
  const tapOverride = SKILL_TAP_TABLES[id];
  const tapTable = tapOverride ? families.find(t => splitTableName(t.name).base === tapOverride) : families.find(t => !/hold/i.test(t.name));
  let resolvedHoldTable = holdTable;
  // 明示的な Hold テーブルが無く、genshin-db に長押しCTがあり、一回押しが添字付き配列なら [1] を長押しとみなす
  if (!resolvedHoldTable && timings.skillHoldCooldown && tapTable) {
    const { base } = splitTableName(tapTable.name);
    resolvedHoldTable = skillTables.find(t => t.name === `${base}[1]`);
  }
  // 長押しの CT が genshin-db に無いが、gcsim の表に長押しがあるキャラ（FORCED_INDEXED_HOLD）
  if (!resolvedHoldTable && FORCED_INDEXED_HOLD[id] !== undefined && tapTable) {
    const { base } = splitTableName(tapTable.name);
    resolvedHoldTable = skillTables.find(t => t.name === `${base}[${FORCED_INDEXED_HOLD[id]}]`);
  }

  actions.push(withDuration({
    id: `${id}_e`,
    name: skillName ? `元素スキル: ${skillName}` : '元素スキル',
    shortName: 'E',
    type: 'skill',
    startsSkillCooldown: true,
    cooldown: timings.skillTapCooldown?.value,
    effectDuration: timings.skillTapDuration?.value ?? 0,
    frames: tapTable && skill ? toActionFrames(tapTable, 'skill', skill.consts) : tapEndTable && skill ? { ...toActionFrames(tapEndTable, 'skill', skill.consts), total: tapEndTable.total + TAP_END_FRAMES[id].offsetFrames } : undefined,
    dataSource: {
      cooldown: timings.skillTapCooldown?.label,
      effectDuration: timings.skillTapDuration?.label,
    },
  }, tapTable ? framesToSec(tapTable.total) : tapEndTable ? framesToSec(tapEndTable.total + TAP_END_FRAMES[id].offsetFrames) : undefined));

  if (!NO_HOLD_SKILL.has(id) && (timings.skillHoldCooldown || resolvedHoldTable)) {
    const holdCd = timings.skillHoldCooldown ?? timings.skillTapCooldown;
    actions.push(withDuration({
      id: `${id}_e_hold`,
      name: skillName ? `元素スキル(長押し): ${skillName}` : '元素スキル(長押し)',
      shortName: 'hE',
      type: 'skill_hold',
      startsSkillCooldown: true,
      cooldown: holdCd?.value,
      effectDuration: timings.skillHoldDuration?.value ?? 0,
      frames: resolvedHoldTable && skill ? toActionFrames(resolvedHoldTable, 'skill', skill.consts) : undefined,
      dataSource: {
        cooldown: holdCd?.label,
        effectDuration: timings.skillHoldDuration?.label,
      },
    }, resolvedHoldTable ? framesToSec(resolvedHoldTable.total) : undefined));
  }

  // 長押しの長さを gcsim の `hold=<フレーム数>` で渡すスキル（リネット・藍硯。モード維持の段階 ③）。
  // gcsim のフレーム表は長押しの後の部分だけなので、最大の長押しを足した長さで作る（既定の所要時間 = 最大の長押し。短くするときは所要時間を編集する）
  const paramHold = PARAM_HOLD_SKILLS[id];
  if (paramHold && skill && !actions.some(a => a.id === `${id}_e_hold`)) {
    const table = skill.tables.find(t => t.name === paramHold.table);
    if (table) {
      const add = paramHold.offsetFrames + paramHold.maxHoldFrames;
      const base = toActionFrames(table, 'skill', skill.consts);
      const cancels = Object.fromEntries(Object.entries(base.cancels).map(([k, v]) => [k, (v as number) + add]));
      actions.push(withDuration({
        id: `${id}_e_hold`,
        name: skillName ? `元素スキル(長押し): ${skillName}` : '元素スキル(長押し)',
        shortName: 'hE',
        type: 'skill_hold',
        startsSkillCooldown: true,
        cooldown: timings.skillTapCooldown?.value,
        effectDuration: timings.skillTapDuration?.value ?? 0,
        frames: { total: base.total + add, cancels, source: `skill.go:${table.name}（+ 長押し ${paramHold.offsetFrames} + 最大 ${paramHold.maxHoldFrames}f）` },
        dataSource: {
          cooldown: timings.skillTapCooldown?.label,
          effectDuration: timings.skillTapDuration?.label,
        },
      }, framesToSec(base.total + add)));
    }
  }

  // 長押しが段で別の表になっているキャラ（FORCED_INDEXED_VARIANTS）: 低い段 = `_e_shorthold`・高い段 = `_e_hold`
  const variants = FORCED_INDEXED_VARIANTS[id];
  if (variants && tapTable && skill) {
    const { base } = splitTableName(tapTable.name);
    for (const v of [
      { suffix: 'e_shorthold', index: variants.shortHoldIndex, shortName: 'hE(short)', label: '長押し（低い段）' },
      { suffix: 'e_hold', index: variants.holdIndex, shortName: 'hE', label: '長押し' },
    ]) {
      const table = skillTables.find(t => t.name === `${base}[${v.index}]`);
      if (!table || actions.some(a => a.id === `${id}_${v.suffix}`)) continue;
      actions.push(withDuration({
        id: `${id}_${v.suffix}`,
        name: skillName ? `元素スキル(${v.label}): ${skillName}` : `元素スキル(${v.label})`,
        shortName: v.shortName,
        type: 'skill_hold',
        startsSkillCooldown: true,
        cooldown: timings.skillTapCooldown?.value,
        effectDuration: timings.skillTapDuration?.value ?? 0,
        frames: toActionFrames(table, 'skill', skill.consts),
        dataSource: {
          cooldown: timings.skillTapCooldown?.label,
          effectDuration: timings.skillTapDuration?.label,
        },
      }, framesToSec(table.total)));
    }
  }

  // 派生スキル: gcsim へのパラメータ指定が必要なもの（B）だけを別アクションにする（フェーズ3d / D25・D26）。
  // 状態で gcsim が自動的に切り替えるもの（A: 再発動・ステップなど）は、E のボタンにまとめるため生成しない
  if (skill) {
    for (const table of families) {
      if (table === tapTable || table === holdTable) continue;
      const suffix = splitTableName(table.name).base.replace(/^skill/i, '').replace(/Frames?$/i, '') || 'alt';
      const slug = suffix.charAt(0).toLowerCase() + suffix.slice(1);
      if (!PARAMETER_DERIVED_SKILLS[id]?.includes(slug.toLowerCase())) continue;
      const notation = DERIVED_SKILL_NOTATION[slug.toLowerCase()];
      const special = SPECIAL_SKILLS[id]?.slug === slug.toLowerCase() ? SPECIAL_SKILLS[id] : undefined;
      if (special) {
        // 特殊元素スキル: スキルとは別のCT・効果（スキルのCTは開始しない）
        actions.push({
          id: `${id}_e_${slug.toLowerCase()}`,
          name: `${special.name}${skillName ? `（${skillName}の後）` : ''}`,
          shortName: special.label,
          type: 'skill',
          startsSkillCooldown: false,
          cooldownPool: 'special',
          ...(special.charges ? { charges: special.charges } : {}),
          ...(special.windowOnly ? { requiresWindow: true } : {}),
          ...(special.cdUnscaled ? { ignoresCdScale: true } : {}),
          ...(special.cooldownDelay ? { cooldownStart: { from: 'motionStart' as const, delay: Number(special.cooldownDelay.toFixed(3)) } } : {}),
          cooldown: special.cooldown,
          effectDuration: special.effectDuration,
          defaultDuration: framesToSec(table.total),
          frames: toActionFrames(table, 'skill', skill.consts),
          ...(special.effectLabel ? { effectLabel: special.effectLabel } : {}),
          dataSource: { cooldown: `gcsim: ${special.source}`, effectDuration: `gcsim: ${special.source}` },
        });
        continue;
      }
      // 長押し系の派生（旅人(水)・早柚・綺良々の shortHold など）は、gcsim では通常のEと同じCTが始まる (D36)
      const startsCooldown = notation.startsCooldown;
      actions.push({
        id: `${id}_e_${slug.toLowerCase()}`,
        name: `元素スキル派生: ${slug}`,
        shortName: notation.label,
        type: notation.type,
        startsSkillCooldown: startsCooldown,
        ...(startsCooldown ? { cooldown: timings.skillTapCooldown?.value, dataSource: { cooldown: timings.skillTapCooldown?.label } } : {}),
        defaultDuration: framesToSec(table.total),
        frames: toActionFrames(table, 'skill', skill.consts),
      });
    }
  }

  // 特殊スキルのCTをスキルが開始するキャラ（ファルカ）: スキル・長押しスキルに、特殊枠のCTの開始を持たせる
  if (SPECIAL_SKILLS[id]?.startedBySkill) {
    const sp = SPECIAL_SKILLS[id];
    for (const a of actions) {
      if (a.type === 'skill' && !a.cooldownPool || a.type === 'skill_hold') a.startsSpecialPool = {
        cooldown: sp.cooldown,
        charges: sp.charges ?? 1,
        ...(sp.windowOnly ? { windowOnly: true } : {}),
        ...(sp.reducePerHit ? { reducePerHit: sp.reducePerHit, ...(sp.reducePerHitHexerei ? { reducePerHitHexerei: sp.reducePerHitHexerei } : {}), hitsPerNormal: sp.hitsPerNormal ?? [1], maxReductions: sp.maxReductions ?? 15 } : {}),
      };
    }
  }

  // 旅人(水): 最大ホールドは gcsim では shortHold のフレーム + 延長で表す。長押しの CT は一回押しと同じ
  if (skill && TRAVELER_HYDRO_IDS.has(id)) {
    const shortHold = families.find(t => splitTableName(t.name).base === 'skillShortHoldFrames');
    if (shortHold) {
      const base = toActionFrames(shortHold, 'skill', skill.consts);
      const extend = (n: number) => n + TRAVELER_HYDRO_MAX_HOLD_EXTEND;
      const frames: ActionFrames = {
        total: extend(base.total),
        ...(base.hitmark !== undefined ? { hitmark: extend(base.hitmark) } : {}),
        cancels: Object.fromEntries(Object.entries(base.cancels).map(([k, v]) => [k, extend(v)])) as ActionFrames['cancels'],
        source: 'skill.go:skillShortHoldFrames + 15 × (22 − 1) (skillHold, hold=1)',
      };
      actions.push({
        id: `${id}_e_hold`,
        name: skillName ? `元素スキル(最大ホールド): ${skillName}` : '元素スキル(最大ホールド)',
        shortName: 'hE',
        type: 'skill_hold',
        startsSkillCooldown: true,
        cooldown: timings.skillTapCooldown?.value,
        effectDuration: 0,
        defaultDuration: framesToSec(frames.total),
        frames,
        dataSource: { cooldown: timings.skillTapCooldown?.label },
      });
    }
  }

  // 長押し系（hE）が存在するキャラの一回押しは tE、存在しないキャラのスキルは E (D36)
  if (actions.some(a => a.type === 'skill_hold')) {
    const tap = actions.find(a => a.id === `${id}_e`);
    if (tap) tap.shortName = 'tE';
  }

  // --- 元素爆発 -------------------------------------------------------------
  const burstFile = file('burst');
  const burstTable = burstFile?.tables.find(t => /^burst/i.test(t.name)) ?? burstFile?.tables[0];
  const burstName = talent?.combat3?.name;
  actions.push(withDuration({
    id: `${id}_q`,
    name: burstName ? `元素爆発: ${burstName}` : '元素爆発',
    shortName: 'Q',
    type: 'burst',
    startsBurstCooldown: true,
    cooldown: timings.burstCooldown?.value,
    effectDuration: timings.burstDuration?.value ?? 0,
    frames: burstTable && burstFile ? toActionFrames(burstTable, 'burst', burstFile.consts) : undefined,
    dataSource: {
      cooldown: timings.burstCooldown?.label,
      effectDuration: timings.burstDuration?.label,
    },
  }, burstTable ? framesToSec(burstTable.total) : undefined));


  // 特殊爆発（フリンズ）: 受付の間だけ使える別アクション。受付の間に使った特殊スキル（嵐槍）が受付を開く
  if (SPECIAL_BURSTS[id]) {
    const sb = SPECIAL_BURSTS[id];
    const table = burstFile?.tables.find(t => splitTableName(t.name).base === sb.tableName);
    if (table && burstFile) {
      actions.push(withDuration({
        id: `${id}_q_special`,
        name: sb.name,
        shortName: sb.label,
        type: 'burst',
        startsBurstCooldown: true,
        specialBurst: true,
        requiresWindow: true,
        specialBurstHint: sb.hint,
        cooldown: sb.cooldownInWindow,
        effectDuration: 0,
        frames: toActionFrames(table, 'burst', burstFile.consts),
        dataSource: { cooldown: `gcsim: ${sb.source}` },
      }, framesToSec(table.total)));
      // 受付の外で使うと、通常の爆発になり、通常の CT が始まる
      const sbAction = actions[actions.length - 1];
      sbAction.specialBurstCooldown = { inWindow: sb.cooldownInWindow, outOfWindow: actions.find(a => a.id === `${id}_q`)?.cooldown ?? 0, checkInWindow: sb.checkInWindow };
    }
  }

  // 炎場の置き始めと置き直し（ディシア）
  const fieldRecast = FIELD_RECASTS[id];
  if (fieldRecast) {
    for (const a of actions) {
      if (a.id === `${id}_e`) a.fieldRecast = fieldRecast;
    }
  }

  // 領域が続く間、操作中のキャラに効果を付け直すスキル（重雲）
  const fieldEffect = FIELD_EFFECTS[id];
  if (fieldEffect) {
    for (const a of actions) {
      if (a.id === `${id}_e`) a.fieldEffect = fieldEffect;
    }
  }

  // 爆発の後のモード（ディシア）
  const mode = BURST_MODES[id];
  if (mode) {
    const { burstFrames, ...burstMode } = mode;
    for (const a of actions) {
      if (a.type !== 'burst') continue;
      a.burstMode = burstMode;
      a.frames = { total: burstFrames, cancels: {}, source: 'burst.go:burstPunch1Hitmark（爆発の長さ。全部の次のアクションで同じ）' };
      a.defaultDuration = framesToSec(burstFrames);
    }
  }

  // スキル・爆発で入るモード（共通の定義）。効果バーは、計算側がモードのバーとして出す
  for (const actionMode of ACTION_MODES[id] ?? []) {
    for (const a of actions) {
      const suffixes = Array.isArray(actionMode.action) ? actionMode.action : [actionMode.action];
      const matches = suffixes.some(s => (s === 'q' ? a.type === 'burst' && !a.specialBurst : a.id === `${id}_${s}`));
      if (!matches) continue;
      a.mode = actionMode.mode;
      if (!actionMode.keepEffectDuration) a.effectDuration = 0;
    }
  }

  // スキルの回数（CT は順番に回復する）
  const stock = SKILL_CHARGES[id];
  if (stock) {
    for (const a of actions) {
      if ((a.type === 'skill' || a.type === 'skill_hold') && !a.cooldownPool && a.startsSkillCooldown === true) a.charges = stock;
    }
  }
  const totem = TOTEM_SKILLS[id];
  if (totem) {
    for (const a of actions) {
      if (a.type === 'skill' && !a.cooldownPool && a.startsSkillCooldown === true) a.spawnsTotem = totem;
      if (a.type === 'burst' && !a.specialBurst) a.releasesSkillPerTotem = true;
    }
  }
  const ns = NIGHTSOUL_FREE_SKILLS[id];
  if (ns) {
    for (const a of actions) {
      if (a.type === 'skill' && !a.cooldownPool && a.startsSkillCooldown === true) a.nightsoul = { role: 'skill', gain: ns.skillGain, max: ns.max, blessingSeconds: ns.blessingSeconds };
      else if (a.type === 'plunge_low' || a.type === 'plunge_high') a.nightsoul = { role: 'plunge', gain: ns.plungeGain, max: ns.max, blessingSeconds: ns.blessingSeconds };
      else if (a.type === 'burst' && !a.specialBurst) a.nightsoul = { role: 'burst', gain: ns.plungeGain, max: ns.max, blessingSeconds: ns.blessingSeconds };
    }
  }

  // --- ダッシュ (キャラ固有フレームは gcsim 側で共通処理のため仮値) --------------
  actions.push({ id: `${id}_dash`, name: 'ダッシュ', shortName: 'D', type: 'dash', defaultDuration: PLACEHOLDER_DURATION.dash! });
  actions.push({ id: `${id}_jump`, name: 'ジャンプ', shortName: 'J', type: 'jump', defaultDuration: PLACEHOLDER_DURATION.jump! });

  // 説明文（ホバー表示。スキル・爆発・通常攻撃・重撃・落下攻撃。ダッシュ・ジャンプなどは、表示側の共通の説明）
  const skillDescription = talent?.combat2?.description;
  const burstDescription = talent?.combat3?.description;
  // 通常攻撃・重撃・落下攻撃は、genshin-db では 1 つの説明文（combat1）。3 つで共通で出す（ユーザー決定）
  const normalDescription = talent?.combat1?.description;
  for (const a of actions) {
    if (skillDescription && (a.type === 'skill' || a.type === 'skill_hold' || a.type === 'skill_reset')) a.description = skillDescription;
    else if (burstDescription && a.type === 'burst') a.description = burstDescription;
    else if (normalDescription && (a.type === 'normal' || a.type === 'charged' || a.type === 'plunge_low' || a.type === 'plunge_high')) a.description = normalDescription;
  }

  return { actions, placeholderActions };
}

// ---------------------------------------------------------------------------
// 旅人: 性別ごとのフレーム（空・蛍それぞれの別ユニットとして切り出す）
// ---------------------------------------------------------------------------

/** "a[1][0]" → ["1", "0"] */
const tableIndices = (name: string) => [...name.matchAll(/\[(\w+)\]/g)].map(m => m[1]);

/**
 * 性別の添字の位置を決める。X[..][c.gender] の参照があればその位置、
 * 無ければ (ローカル変数経由で参照される場合など) 先頭の添字がちょうど 0 と 1 の配列を性別とみなす。
 */
function genderPosition(file: ParsedGoFile, base: string): number | undefined {
  const explicit = file.genderIndexPositions[base];
  if (explicit !== undefined) return explicit;
  const firsts = new Set(file.tables.filter(t => splitTableName(t.name).base === base).map(t => tableIndices(t.name)[0]));
  return firsts.size === 2 && firsts.has('0') && firsts.has('1') ? 0 : undefined;
}

/** 性別で分かれたテーブルから指定性別の分だけを取り出し、性別の添字を外した見え方にする */
function genderView(parsed: ParsedCharacterFiles, gender: number): ParsedCharacterFiles {
  const files: Record<string, ParsedGoFile> = {};
  for (const [name, file] of Object.entries(parsed.files)) {
    const tables = file.tables.flatMap(t => {
      const { base } = splitTableName(t.name);
      const position = genderPosition(file, base);
      if (position === undefined) return [t];
      const indices = tableIndices(t.name);
      if (indices[position] !== String(gender)) return [];
      indices.splice(position, 1);
      return [{ ...t, name: `${base}${indices.map(i => `[${i}]`).join('')}` }];
    });
    files[name] = { ...file, tables };
  }
  return { ...parsed, files };
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------


const GCSIM_FILES = ['attack', 'charge', 'aimed', 'aim', 'skill', 'burst', 'plunge'];

export async function generateCharacterMaster(
  onProgress?: (p: GenerationProgress) => void,
): Promise<CharacterMasterResult> {
  const errors: string[] = [];
  const report: CharacterGenerationReport = {
    generatedAt: new Date().toISOString(),
    gcsimCommit: '',
    totalCharacters: 0,
    charactersWithFrames: 0,
    skipped: [],
    placeholderDurations: [],
    missingCooldowns: [],
    unresolvedGoLines: [],
    plunge: { lowCount: 0, highCount: 0, unresolved: [] },
    effectDuration: { supplemented: [], mismatches: [], orphans: [], suppressed: [] },
    cooldownStart: { read: 0, manual: 0, unresolved: [], mismatches: [] },
    constellations: emptyConstellationReport(),
    errors,
  };

  // 1. genshin-db + gcsim のインデックスを並列取得
  onProgress?.({ phase: 'genshin-db / gcsim の一覧を取得中', done: 0, total: 1 });
  const verbose = 'query=names&matchCategories=true&verboseCategories=true';
  const [charsJa, charsEn, talentsJa, constellationsJa, tree, charDm] = await Promise.all([
    fetchJson<GenshinDbCharacter[]>(`${GENSHIN_DB_API}/characters?${verbose}&resultLanguage=Japanese`),
    fetchJson<GenshinDbCharacter[]>(`${GENSHIN_DB_API}/characters?${verbose}&resultLanguage=English`),
    fetchJson<GenshinDbTalent[]>(`${GENSHIN_DB_API}/talents?${verbose}&resultLanguage=Japanese`),
    fetchJson<GenshinDbConstellation[]>(`${GENSHIN_DB_API}/constellations?${verbose}&resultLanguage=Japanese`),
    fetchJson<{ sha: string; truncated: boolean; tree: Array<{ path: string; type: string }> }>(
      `https://api.github.com/repos/${GCSIM_REPO}/git/trees/${GCSIM_BRANCH}?recursive=1`,
      { headers: { Accept: 'application/vnd.github+json' } },
    ),
    fetchJson<{ data: Record<string, { id: number; key: string }> }>(
      `https://raw.githubusercontent.com/${GCSIM_REPO}/${GCSIM_BRANCH}/${GCSIM_CHAR_DM_PATH}`,
    ),
  ]);
  report.gcsimCommit = tree.sha;
  const rawBase = `https://raw.githubusercontent.com/${GCSIM_REPO}/${tree.sha}/`;

  // 2. gcsim: 公式キャラID → キー → ディレクトリ
  const dirByKey = new Map<string, string>();
  const filesByDir = new Map<string, Set<string>>();
  for (const { path } of tree.tree) {
    const dm = /^internal\/characters\/(.+)\/zz_(\w+)\.dm\.go$/.exec(path);
    if (dm) dirByKey.set(dm[2], dm[1]);
    const go = /^internal\/characters\/(.+)\/(\w+)\.go$/.exec(path);
    if (go) {
      if (!filesByDir.has(go[1])) filesByDir.set(go[1], new Set());
      filesByDir.get(go[1])!.add(go[2]);
    }
  }
  // 照合表（D34）: 公式キャラID（旅人は 空・蛍 × 元素）↔ gcsim キー。名前では突き合わせない。gcsimKey はこの表から引く
  const keyMapItems: KeyMapItem[] = [];
  for (const c of charsJa) {
    if (TRAVELER_IDS.has(c.id) || !ELEMENT_MAP[c.elementType]) continue;
    keyMapItems.push({ id: characterKey(c.id, ELEMENT_MAP[c.elementType]), genshinId: c.id, name: c.name });
  }
  // 旅人は公式IDが元素に関わらず共通（空 / 蛍）なので、dm.json では引けない。gcsim のキー（aether<元素> / lumine<元素>）を手で補う
  const travelerManual: ManualKeyMapping[] = [];
  for (const traveler of TRAVELERS) {
    for (const element of Object.values(TRAVELER_ELEMENT_JA)) {
      const id = characterKey(traveler.genshinId, element);
      keyMapItems.push({ id, genshinId: traveler.genshinId, name: `${traveler.label}(${element})` });
      travelerManual.push({ id, gcsimKey: `${traveler.gcsimPrefix}${element}` });
    }
  }
  const keyMap = buildKeyMapSection(keyMapItems, charDm.data, tree.sha, travelerManual);
  const gcsimKeyById = keyMapLookup(keyMap);

  const englishById = new Map(charsEn.map(c => [c.id, c.name]));
  const talentByName = new Map(talentsJa.map(t => [t.name, t]));
  const talentById = new Map(talentsJa.map(t => [t.id, t]));
  // 凸データの id は天賦と同じ規則（公式キャラID - 10000000）× 100 + 1。旅人は元素ごとに別エントリ（名前 "旅人 (風元素)" で判別）
  const constellationById = new Map(constellationsJa.map(c => [c.id, c]));
  const travelerConstellationByElement = new Map<ElementType, GenshinDbConstellation>();
  for (const c of constellationsJa) {
    const m = /^旅人\s*\((.)元素\)$/.exec(c.name);
    const element = m ? TRAVELER_ELEMENT_JA[m[1]] : undefined;
    if (element) travelerConstellationByElement.set(element, c);
  }
  const iconUrl = (c?: GenshinDbCharacter) =>
    c?.images?.filename_icon ? `${ICON_BASE_URL}/${c.images.filename_icon}.png` : (c?.images?.mihoyo_icon ?? '');

  // 生成単位 (通常キャラ + 元素ごとの旅人)
  interface BuildUnit {
    id: string;
    name: string;
    englishName: string;
    element: ElementType;
    weaponType: WeaponType;
    rarity: number;
    avatarUrl: string;
    genshinId: number;
    talent?: GenshinDbTalent;
    constellation?: GenshinDbConstellation;
    gcsimKey?: string;
    gcsimDir?: string;
    /** gcsim 未実装のキャラの、アプリ側だけの対応: フレームを読む別のコミット（appSideCharacterSources.ts） */
    appSide?: AppSideSource;
    /** 旅人: gcsim のフレームの性別の添字 (0 = 空, 1 = 蛍)。この性別の分だけ切り出して組み立てる */
    genderIndex?: number;
  }
  const units: BuildUnit[] = [];

  for (const c of charsJa) {
    if (TRAVELER_IDS.has(c.id)) continue;
    if (!ELEMENT_MAP[c.elementType]) {
      report.skipped.push({ name: c.name, reason: `元素 ${c.elementType} が未対応` });
      continue;
    }
    const englishName = englishById.get(c.id) ?? c.name;
    // キャラのキーは「公式キャラID-元素」（英語名の変更に左右されない）
    const id = characterKey(c.id, ELEMENT_MAP[c.elementType]);
    const talent = talentByName.get(c.name) ?? talentById.get((c.id - 10000000) * 100 + 1);
    if (!talent) errors.push(`genshin-db: ${c.name} の天賦データが見つかりません`);
    const gcsimKey = gcsimKeyById.get(id);
    units.push({
      id,
      name: c.name,
      englishName,
      element: ELEMENT_MAP[c.elementType],
      weaponType: WEAPON_MAP[c.weaponType] ?? 'sword',
      rarity: c.rarity,
      avatarUrl: iconUrl(c),
      genshinId: c.id,
      talent,
      constellation: constellationById.get((c.id - 10000000) * 100 + 1),
      gcsimKey,
      gcsimDir: gcsimKey ? dirByKey.get(gcsimKey) : undefined,
      appSide: gcsimKey ? undefined : appSideSourceByGenshinId(c.id),
    });
  }

  // 旅人: genshin-db の元素別天賦 "旅人 (風元素)" ごとに、空・蛍の2キャラ。gcsim のフレームは traveler/common/<元素>（空・蛍共通で性別の添字で分かれる）
  // 天賦・命ノ星座は元素ごとに空・蛍で共通なので、同じ内容を両方に複写する
  for (const t of talentsJa) {
    const m = /^旅人\s*\((.)元素\)$/.exec(t.name);
    const element = m ? TRAVELER_ELEMENT_JA[m[1]] : undefined;
    if (!m || !element) continue;
    const gcsimDir = `traveler/common/${element}`;
    for (const traveler of TRAVELERS) {
      const gcsimKey = `${traveler.gcsimPrefix}${element}`;
      units.push({
        id: characterKey(traveler.genshinId, element), // 旅人は公式IDが空・蛍の2つ、元素と組にして一意にする
        name: `${traveler.label}(${m[1]})`,
        // 「旅人」「Traveler」でも検索できるよう別名を持たせる
        englishName: `${traveler.englishLabel} (${element.charAt(0).toUpperCase()}${element.slice(1)}) Traveler 旅人`,
        element,
        weaponType: 'sword',
        rarity: 5,
        avatarUrl: iconUrl(charsJa.find(c => c.id === traveler.genshinId)),
        genshinId: traveler.genshinId,
        talent: t,
        constellation: travelerConstellationByElement.get(element),
        gcsimKey: gcsimKeyById.get(characterKey(traveler.genshinId, element)),
        gcsimDir: filesByDir.has(gcsimDir) ? gcsimDir : undefined,
        genderIndex: traveler.genderIndex,
      });
    }
  }

  // 3. gcsim の Go ソースを取得・解析
  const parsedById = new Map<string, ParsedCharacterFiles>();
  let done = 0;
  await runPool(units, 12, async u => {
    if (u.gcsimDir || u.appSide) {
      try {
        // リリースのキャラ: 取得済みの一覧と固定コミット。アプリ側だけの対応のキャラ: そのコミットのディレクトリの一覧を取る
        const dir = u.gcsimDir ?? u.appSide!.dir;
        const base = u.appSide && !u.gcsimDir ? `https://raw.githubusercontent.com/${GCSIM_REPO}/${u.appSide.ref}/` : rawBase;
        let available = filesByDir.get(dir) ?? new Set<string>();
        if (u.appSide && !u.gcsimDir) {
          const list = await fetchJson<Array<{ name: string }>>(
            `https://api.github.com/repos/${GCSIM_REPO}/contents/internal/characters/${dir}?ref=${u.appSide.ref}`,
            { headers: { Accept: 'application/vnd.github+json' } },
          );
          available = new Set(list.map(f => f.name.replace(/\.go$/, '')));
        }
        const names = GCSIM_FILES.filter(f => available.has(f));
        const texts = await Promise.all(names.map(f => fetchText(`${base}internal/characters/${dir}/${f}.go`)));
        // ファイル間で定数を共有するため、先に全ファイルの定数を集めてから解析する
        const shared = new Map<string, number>();
        texts.forEach(t => parseGoFile(t).consts.forEach((v, k) => shared.set(k, v)));
        const files: Record<string, ParsedGoFile> = {};
        names.forEach((f, i) => {
          files[f] = parseGoFile(texts[i], shared);
        });
        const cooldownCalls = names.flatMap((f, i) => (f === 'skill' || f === 'burst') ? parseCooldownCalls(texts[i], files[f]) : []);
        parsedById.set(u.id, { files, cooldownCalls });
      } catch (e) {
        errors.push(`gcsim ${u.gcsimDir ?? u.appSide?.dir}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    done++;
    onProgress?.({ phase: 'gcsim のモーションフレームを解析中', done, total: units.length });
  });

  // 4. キャラクター組み立て
  const characters: CharacterConfig[] = [];
  for (const u of units) {
    const timings = extractTalentTimings(u.talent);
    const parsed = parsedById.get(u.id);
    const ctx = { id: u.id, weaponType: u.weaponType, timings, talent: u.talent };

    const { actions, placeholderActions } = buildActions({
      ...ctx,
      parsed: parsed && u.genderIndex !== undefined ? genderView(parsed, u.genderIndex) : parsed,
    });

    if (actions.some(a => a.type === 'plunge_low')) report.plunge.lowCount++;
    if (actions.some(a => a.type === 'plunge_high')) report.plunge.highCount++;
    if (parsed?.files.plunge && !actions.some(a => a.type === 'plunge_low' || a.type === 'plunge_high')) {
      report.plunge.unresolved.push({ characterId: u.id, name: u.name });
    }

    // 効果継続時間の補完（D33 / 5-3）: genshin-db に値が無いものだけ、gcsim の値（手で補う一覧）を入れる。genshin-db に値があれば、それを優先し、食い違いだけ記録する
    for (const a of actions) {
      const o = EFFECT_DURATION_OVERRIDES[a.id];
      if (!o) continue;
      const seconds = framesToSec(o.frames);
      if (a.effectDuration && a.effectDuration > 0) {
        if (Math.abs(a.effectDuration - seconds) > 0.05) report.effectDuration.mismatches.push({ characterId: u.id, name: u.name, actionId: a.id, genshinDb: a.effectDuration, gcsim: seconds });
        continue;
      }
      a.effectDuration = seconds;
      a.effectLabel = o.label;
      a.dataSource = { ...a.dataSource, effectDuration: `gcsim: ${o.source}` };
      report.effectDuration.supplemented.push({ characterId: u.id, name: u.name, actionId: a.id, seconds, source: o.source });
    }

    // 効果継続時間なし（バーに出さない）: 手で決めた一覧のアクションは 0 にする
    for (const a of actions) {
      const reason = EFFECT_DURATION_SUPPRESSED[a.id];
      if (!reason) continue;
      if (a.effectDuration && a.effectDuration > 0) report.effectDuration.suppressed.push({ characterId: u.id, name: u.name, actionId: a.id, genshinDb: a.effectDuration, reason });
      a.effectDuration = 0;
      a.dataSource = { ...a.dataSource, effectDuration: `効果時間なし: ${reason}` };
    }

    // CT開始位置（D37 / D44）: スキル・爆発のアクションに、gcsim の遅れ（または手で補った値）を持たせる
    for (const a of actions) {
      if (!a.startsSkillCooldown && !a.startsBurstCooldown) continue;
      const r: CooldownStartResolution = resolveCooldownStart(a.id, parsed?.cooldownCalls);
      if (r.cooldownStart) {
        a.cooldownStart = r.cooldownStart;
        a.dataSource = { ...a.dataSource, cooldownStart: r.source };
        if (r.cooldownPerHold !== undefined) a.cooldownPerHold = r.cooldownPerHold;
        if (r.baseCooldown !== undefined) a.cooldown = r.baseCooldown;
        if (r.holdInFrames !== undefined) a.holdInFrames = r.holdInFrames;
        report.cooldownStart[r.status === 'manual' ? 'manual' : 'read']++;
      } else {
        report.cooldownStart.unresolved.push({ characterId: u.id, name: u.name, actionId: a.id, reason: u.gcsimKey || parsed ? (r.reason ?? '') : 'gcsim 未実装' });
      }
      if (r.mismatch) report.cooldownStart.mismatches.push({ characterId: u.id, name: u.name, actionId: a.id, ...r.mismatch });
    }

    if (parsed) {
      report.charactersWithFrames++;
      for (const [f, p] of Object.entries(parsed.files)) {
        if (p.unresolved.length > 0) report.unresolvedGoLines.push({ characterId: u.id, file: `${f}.go`, count: p.unresolved.length });
      }
    }
    if (placeholderActions.length > 0) {
      report.placeholderDurations.push({
        characterId: u.id,
        name: u.name,
        actions: placeholderActions,
        reason: !u.gcsimKey && !u.appSide ? 'gcsim 未実装キャラ' : !parsed ? 'gcsim ソース取得失敗' : 'gcsim にフレーム定義が見つからない',
      });
    }
    for (const a of actions) {
      if ((a.startsSkillCooldown || a.startsBurstCooldown) && a.cooldown === undefined) {
        report.missingCooldowns.push({ characterId: u.id, name: u.name, actionId: a.id });
      }
    }

    const character: CharacterConfig = {
      id: u.id,
      name: u.name,
      englishName: u.englishName,
      element: u.element,
      weaponType: u.weaponType,
      rarity: u.rarity,
      avatarUrl: u.avatarUrl,
      color: ELEMENT_HEX[u.element],
      accentColor: ELEMENT_HEX[u.element],
      availableActions: actions,
      passiveEffects: buildPassiveEffects(u.id, [u.talent?.passive1, u.talent?.passive2]),
      source: {
        genshinId: u.genshinId,
        ...(u.gcsimKey ? { gcsimKey: u.gcsimKey } : {}),
        ...(u.appSide && parsed ? { frameSource: u.appSide.label } : {}),
      },
    };
    // 命ノ星座（1〜6凸）の段階データ。確認済みの効果継続時間の延長を含む
    if (u.constellation) character.constellations = buildConstellations(character, u.constellation, report.constellations);
    characters.push(character);
  }

  const allActionIds = new Set(characters.flatMap(c => c.availableActions.map(a => a.id)));
  report.effectDuration.orphans = [...Object.keys(EFFECT_DURATION_OVERRIDES), ...Object.keys(EFFECT_DURATION_SUPPRESSED)].filter(id => !allActionIds.has(id));

  characters.sort((a, b) => a.id.localeCompare(b.id));
  report.totalCharacters = characters.length;
  return { characters, report, keyMap };
}
