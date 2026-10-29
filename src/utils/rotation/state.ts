/**
 * calculateRotation の計算中の状態（出場・アクションを順に処理するあいだ、更新していく入れ物）。
 * 補助の関数（modeHelpers.ts など）と、計算の各段階が、これを受け取って読む・更新する。
 * 配列・Map は、作った後に中身だけを更新する（入れ替えない）。入れ替わる値は currentTime だけ。
 */
import { expandGroupedStints } from '../actionGroups';
import { NightsoulTracker } from '../nightsoulTracker';
import { TotemTracker } from '../totemTracker';
import type { LayerBuffRule, LayerEvent } from '../stateBars';
import { SACRIFICIAL_WEAPON_KEYS, sacrificialIcdSeconds } from '../gcsim/sacrificialSeed';
import type { ActionModeSpecial, ActiveBuffSpan, CharacterConfig, CharacterRuntimeState, CooldownSpan, PassiveSpan, Stint, ValidationIssue } from '../../types/genshin';
import { attackSpeedOfIn } from './attackSpeed';
import { placePickedFieldIn } from './modeHelpers';
import { addViolationIssueIn } from './violations';
import type { CooldownEvent } from './cooldownCheck';
import type { ModeWindow, RotationOptions } from './types';

export interface RotationState {
  characters: CharacterConfig[];
  options: RotationOptions | undefined;
  /** グループの回数を、続けて置いたものとして展開した出場（追加作業 20-A） */
  rawStints: Stint[];
  switchDelay: number;
  loopStartIndex: number;
  characterMap: Map<string, CharacterConfig>;

  /** 今の時刻（秒）。アクションの終わりごとに進む */
  currentTime: number;
  calculatedStints: Stint[];
  activeBuffs: ActiveBuffSpan[];
  skillCooldowns: CooldownSpan[];
  burstCooldowns: CooldownSpan[];
  validationIssues: ValidationIssue[];
  passiveSpans: PassiveSpan[];
  /** CT を持つ発動（スキル・爆発・発動バフ）。CT違反の判定はすべて計算後にまとめて行う（checkCooldownViolations） */
  ctEvents: CooldownEvent[];
  /** キャラごとの、実行中の状態 */
  charStates: Record<string, CharacterRuntimeState>;
  /** CT違反の検証メッセージの、同じ id ごとの残り秒数の最大値 */
  violationRemaining: Map<string, number>;

  /** このアクションの所要時間に、表（hitlag_frames.json）の延びを足したアクション ID（受付の延長の判定で、書き戻した値と同じ扱い） */
  hitlagIncluded: Set<string>;
  /** 風元素共鳴（風元素のキャラが 2 人以上）: 全キャラのスキル・爆発・特殊スキルの CT が 5% 短くなる（0.95）。そうでなければ 1 */
  cdResonanceScale: number;
  /** 領域が操作中のキャラに付ける CT 短縮の期間（重雲の命ノ星座 2。マスターの値から計算する CT にだけ掛ける） */
  ctReductionWindows: { start: number; end: number; rate: number }[];

  // --- 通常攻撃速度（gcsim の AtkSpd）の判定用: キャラごとの記録 ---
  burstStartByChar: Map<string, { t: number; sIdx: number; hitlag: number }>;
  /** 編成の全員に付く効果（綾人 C4・ミカ）用: 爆発・スキルの使用時の、全員のヒットストップの合計（受け取るキャラ自身の分を引くため） */
  burstSnapshotByChar: Map<string, Map<string, number>>;
  skillSnapshotByChar: Map<string, Map<string, number>>;
  /** キャラ自身のヒットストップの合計（秒。ヒットストップで延びる効果の経過から引く） */
  hitlagTotalByChar: Map<string, number>;
  chargedStartByChar: Map<string, number>;
  skillStartByChar: Map<string, { t: number; hitlag: number }>;
  normalsSinceSkillByChar: Map<string, number>;
  /** 交代で出場した時刻（先頭の出場を除く。交代アクションの開始 = gcsim の OnCharacterSwap） */
  enterFieldByChar: Map<string, { t: number; hitlag: number }[]>;
  /** 自分の攻撃（通常攻撃・スキル・爆発）の命中の時刻（会心が引き金の効果用） */
  hitTimesByChar: Map<string, { t: number; hitlag: number; tag: 'normal' | 'charged' | 'skill' | 'burst' }[]>;

  // --- モード・設置物・状態のバー ---
  /** 炎場（ディシアの熔鉄流獄）の効果バー（置き直しで、拾った時点で切って、新しいバーを出す） */
  fieldSpans: Map<string, ActiveBuffSpan>;
  /** スキル・爆発で入るモードの窓（1 周目の線形の計算）。キー: モードを開くアクションの定義 ID。結果は end（終わりの時刻）と endedBy（どう終わったか） */
  modeWindows: Map<string, ModeWindow>;
  /** 同じモードを開き直して置き換えられた、前の窓（終わった後の計算に使う） */
  retiredModes: ModeWindow[];
  /** 層が溜まる効果（ヴェスナの粛正）の引き金の記録（キャラ ID → ）。計算の最後に、期間（バー）にする */
  layerEventsByChar: Map<string, { rule: LayerBuffRule; events: LayerEvent[] }>;
  /** 八重神子の殺生桜（キャラ ID → 桜の数え方。効果バーを、押し出し・爆発で壊れた時刻で切る）。CT の判定と同じ数え方（totemTracker.ts） */
  barTotems: Map<string, TotemTracker<ActiveBuffSpan>>;
  /** 殺生桜のバーの、本来の寿命（押し出し・爆発で切る前）、上限、爆発の時刻（2 周目の再現に使う） */
  totemLifetime: Map<ActiveBuffSpan, number>;
  totemMax: Map<string, number>;
  totemBursts: Map<string, Array<{ time: number; destroy: boolean }>>;
  /** 夜魂値で無料のスキルが出るキャラ（ヴァレサ）の状態（マキシマムドライブの受付を開く条件に使う） */
  nightsoulTrackers: Map<string, NightsoulTracker>;

  // --- 状態を使う補助の関数（作るときに、この状態と options を取り込む） ---
  /** 受付の延長のヒットストップの値（敵の防御ヒットストップが無効なら短い値） */
  hitlagOf: (sp: ActionModeSpecial) => ActionModeSpecial['hitlag'];
  /** このアクションの所要時間に、ヒットストップで止まった分が含まれているか（gcsim から書き戻した所要時間 = gcsimBaseDuration か、表の延びを足したもの）。受付（疾風怒濤）のヒットストップ延長は、含まれるときだけ足す */
  durationHasHitlag: (a: { id?: string; gcsimBaseDuration?: number }) => boolean;
  /** 時刻 t の、領域による CT 短縮の倍率（マスターの値から計算する CT にだけ掛ける） */
  ctReductionScaleAt: (t: number) => number;
  /** 祭礼の武器（祭礼の断片・剣・大剣・弓）を持つキャラ: 武器の内部 CT（秒）。確率は 100% として扱う（発動の条件は、CT の判定の中で見る） */
  sacrificialOf: (c: CharacterConfig) => { icdSeconds: number } | undefined;
  attackSpeedOf: (c: CharacterConfig, start: number, sIdx: number, previousNormal: { start: number; total: number; cancel: number } | undefined) => number;
  placePickedField: (charId: string, mw: { pending?: { savedFrames: number; template: ActiveBuffSpan } }, at: number) => void;
  addViolationIssue: (id: string, char: CharacterConfig, stintId: string, actionId: string | undefined, time: number, severity: 'error' | 'warning', title: string, what: string, remaining: number, cycle: number) => void;
}

export function createRotationState(characters: CharacterConfig[], inputStints: Stint[], options?: RotationOptions): RotationState {
  const characterMap = new Map<string, CharacterConfig>();
  characters.forEach(c => characterMap.set(c.id, c));
  const charStates: Record<string, CharacterRuntimeState> = {};
  characters.forEach(c => {
    charStates[c.id] = {
      characterId: c.id,
      totalActiveTime: 0,
      stints: [],
      skillCooldowns: [],
      burstCooldowns: [],
    };
  });
  const state: RotationState = {
    characters,
    options,
    rawStints: expandGroupedStints(inputStints),
    switchDelay: typeof options?.switchDelay === 'number' ? Math.max(0, options.switchDelay) : 0.50,
    loopStartIndex: typeof options?.loopStartIndex === 'number' ? Math.max(0, options.loopStartIndex) : 0,
    characterMap,
    currentTime: 0,
    calculatedStints: [],
    activeBuffs: [],
    skillCooldowns: [],
    burstCooldowns: [],
    validationIssues: [],
    passiveSpans: [],
    ctEvents: [],
    charStates,
    violationRemaining: new Map(),
    hitlagIncluded: new Set(),
    cdResonanceScale: characters.filter(c => c.element === 'anemo').length >= 2 ? 0.95 : 1,
    ctReductionWindows: [],
    burstStartByChar: new Map(),
    burstSnapshotByChar: new Map(),
    skillSnapshotByChar: new Map(),
    hitlagTotalByChar: new Map(),
    chargedStartByChar: new Map(),
    skillStartByChar: new Map(),
    normalsSinceSkillByChar: new Map(),
    enterFieldByChar: new Map(),
    hitTimesByChar: new Map(),
    fieldSpans: new Map(),
    modeWindows: new Map(),
    retiredModes: [],
    layerEventsByChar: new Map(),
    barTotems: new Map(),
    totemLifetime: new Map(),
    totemMax: new Map(),
    totemBursts: new Map(),
    nightsoulTrackers: new Map(),
    hitlagOf: sp => (options?.defHalt === false ? sp.hitlagNoDefHalt ?? sp.hitlag : sp.hitlag),
    durationHasHitlag: a => a.gcsimBaseDuration !== undefined || (a.id !== undefined && state.hitlagIncluded.has(a.id)),
    ctReductionScaleAt: t => state.ctReductionWindows.reduce((acc, w) => (t >= w.start - 1e-9 && t < w.end - 1e-9 ? acc * (1 - w.rate) : acc), 1),
    sacrificialOf: c => {
      const w = options?.database?.weapons.find(x => x.id === c.weaponId);
      if (!w?.gcsimKey || !(SACRIFICIAL_WEAPON_KEYS as readonly string[]).includes(w.gcsimKey)) return undefined;
      const refine = c.weaponRefinementRank ?? w.refinementRank ?? (w.rarity >= 5 ? 1 : 5);
      return { icdSeconds: sacrificialIcdSeconds(refine) };
    },
    attackSpeedOf: (c, start, sIdx, previousNormal) => attackSpeedOfIn(state, options, c, start, sIdx, previousNormal),
    placePickedField: (charId, mw, at) => placePickedFieldIn(state, charId, mw, at),
    addViolationIssue: (id, char, stintId, actionId, time, severity, title, what, remaining, cycle) =>
      addViolationIssueIn(state, id, char, stintId, actionId, time, severity, title, what, remaining, cycle),
  };
  return state;
}
