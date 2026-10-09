import { isHexerei, hexereiCount } from '../masterdata/hexereiCharacters';
import { isRevelation } from '../masterdata/revelationCharacters';
import { checkPlungePrerequisites } from './plungePrerequisites';
import { NightsoulTracker } from './nightsoulTracker';
import { TotemTracker, totemTiming } from './totemTracker';
import { SACRIFICIAL_WEAPON_KEYS, sacrificialIcdSeconds } from './gcsim/sacrificialSeed';
import skillHitFrameData from '../data/skill_hit_frames.json';
import canQueueAfterData from '../data/can_queue_after.json';
import { actionDelayOf } from './actionDelay';

import { 
  CharacterConfig, 
  Stint, 
  CharacterActionInstance, 
  ActiveBuffSpan, 
  CooldownSpan, StockSpan, 
  ValidationIssue, 
  CharacterRuntimeState,
  PassiveSpan,
  ActionDefinition,
} from '../types/genshin';
import { GenshinDatabase } from '../types/database';
import type { ActionMode, ActionModeSpecial, CancelTarget, ModeEnder } from '../types/genshin';
import { passiveGroupOf } from '../types/genshin';
import { buildActionEffectSpan, countDistinctActiveBuffs } from './characterActions';
import { CooldownQueue, type QueueHead } from './cooldownQueue';
import { getAvailableBuffsForCharacter, BuffCategory, type TriggerableBuffDefinition } from './buffUtils';
import { CharacterModel } from '../models/CharacterModel';

/** バフ重複行の1区間（この区間の間はバフ数が変わらない） */
export interface BuffOverlapSegment {
  start: number;
  end: number;
  count: number;
  activeBuffs: string[];
}

/** 祭礼の武器の発動（アプリの計算の結果。gcsim の種の探索で、gcsim も同じ箇所で発動する種を探すのに使う） */
export interface SacrificialProc {
  charId: string;
  /** 発動のきっかけになったスキルのアクション（命中の表の元） */
  actionId: string;
  /** スキルを実行したフレームからの命中のフレーム（命中時刻の表） */
  hitFrame: number;
  /** 0 = 1 周目、1 = 2 周目（ループの区間のアクションだけ） */
  cycle: number;
  /** 発動の時刻（その周の時間軸）。cycle 1 は 1 周目の時間軸に ループ 1 周の長さを足した値 */
  time: number;
  /** 武器の内部 CT（秒） */
  icdSeconds: number;
}

export interface CalculatedRotation {
  /** スキルのストック数の区間（回数が 2 以上のスキルを持つキャラ。1 周目・2 周目） */
  stockSpans: StockSpan[];
  /** 祭礼の武器の発動の一覧（確率 100%・内部 CT だけ考慮した、アプリの計算） */
  sacrificialProcs: SacrificialProc[];
  /** 祭礼の武器を持つキャラ ID。スキルの CT は、アプリの計算（発動による CT のリセット）が持つので、gcsim の結果の反映で書き戻さない */
  sacrificialCharIds: string[];
  /** 風元素共鳴による CT の倍率（0.95 または 1）。gcsim の書き戻しに記録する */
  cdResonanceScale: number;
  totalDuration: number;
  calculatedStints: Stint[];
  activeBuffs: ActiveBuffSpan[];
  skillCooldowns: CooldownSpan[];
  burstCooldowns: CooldownSpan[];
  characterStates: Record<string, CharacterRuntimeState>;
  validationIssues: ValidationIssue[];
  /** バフ重複行（1周目: 折り返し部分を含まない / 2周目以降: 含む） */
  buffOverlapSegments: BuffOverlapSegment[];
  loopedBuffOverlapSegments: BuffOverlapSegment[];
  /** 発動バフ（固有天賦・武器・聖遺物）の効果・CT */
  passiveSpans: PassiveSpan[];
  /** 2周目折り返し（Carry-Over）情報 */
  carryOverCooldowns: CooldownSpan[];
  carryOverBuffs: ActiveBuffSpan[];
  carryOverPassives: PassiveSpan[];
  loopStartTime: number;
  loopPeriod: number;
}

export interface RotationOptions {
  switchDelay?: number;
  database?: GenshinDatabase;
  loopStartIndex?: number;
  /** 敵の防御ヒットストップ（gcsim の defhalt）。既定 true。false のとき、受付の延長のヒットストップは短い値を使う */
  defHalt?: boolean;
  /** gcsim の結果でCT待ちが生じたアクション（アクション ID → 待った秒数）。CT違反と同じ印を付ける（フェーズ6 / D21） */
  externalCtWaits?: Record<string, number>;
}

/**
 * スキル・爆発の「次の行動を受け付け始めるフレーム」（gcsim の CanQueueAfter。scripts/probe-can-queue-after.ts が実測で作る）。
 * 待機（`wait`）は、アクションの実行の後、この時刻から始まる（gcsim run.go: queuePhase → handleWait）
 */
const CAN_QUEUE_AFTER = (canQueueAfterData as { entries: Record<string, number> }).entries;

/** 次に続くアクションの種類 → キャンセルフレームの表のキー（gcsim の action.ActionXxx）。出場の最後は次が交代。'wait' = 次が待機（CanQueueAfter） */
type NextKey = CancelTarget | 'wait';

/**
 * 次が待機のときの、アクションの所要時間（フレーム）。gcsim は、アクションの実行の後、CanQueueAfter（最も早いキャンセル）まで進めてから待機を始める。
 * 実測の表（スキル・爆発）があればそれ、無ければキャンセルの表の最小値（実測と 374 件中 322 件が一致、349 件が 6 フレーム以内）、それも無ければ全体のフレーム
 */
function canQueueFrames(frames: { total: number; cancels: Partial<Record<CancelTarget, number>> }, def: { id: string; frames?: unknown } | undefined): number {
  const measured = def && frames === def.frames ? CAN_QUEUE_AFTER[def.id] : undefined;
  if (measured !== undefined) return measured;
  const values = Object.values(frames.cancels).filter((v): v is number => typeof v === 'number' && v > 0);
  return values.length > 0 ? Math.min(...values) : frames.total;
}

function cancelKeyOf(next: CharacterActionInstance | undefined, weaponType?: string): NextKey | undefined {
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
const SKILL_HITS = (skillHitFrameData as { entries: Record<string, { hits: number[]; byConstellation?: Record<string, number[]>; holdFramesMax?: number }> }).entries;

/**
 * スキルの命中のフレーム。命ノ星座で変わるもの（byConstellation: その段階以降の値）と、長押しの長さを渡すもの（holdFramesMax: 長押しの長さ − 1 フレームだけ後ろにずれる）に対応。
 * 長押しの長さ（holdSeconds）は、gcsim に渡すもの（applyHoldSeconds）と同じ丸め・上限
 */
function skillHitFrames(actionId: string, constellation: number, holdSeconds: number | undefined): number[] {
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

export function calculateRotation(
  characters: CharacterConfig[],
  rawStints: Stint[],
  options?: RotationOptions
): CalculatedRotation {
  const switchDelay = typeof options?.switchDelay === 'number' ? Math.max(0, options.switchDelay) : 0.50;
  const loopStartIndex = typeof options?.loopStartIndex === 'number' ? Math.max(0, options.loopStartIndex) : 0;
  const characterMap = new Map<string, CharacterConfig>();
  characters.forEach(c => characterMap.set(c.id, c));

  let currentTime = 0;
  const calculatedStints: Stint[] = [];
  const activeBuffs: ActiveBuffSpan[] = [];
  const skillCooldowns: CooldownSpan[] = [];
  // 風元素共鳴（風元素のキャラが 2 人以上）: 全キャラのスキル・爆発・特殊スキルの CT が 5% 短くなる（gcsim の anemo-res-cd。ゲームの動画でも、特殊スキルの CT 10.4 秒表示を確認）。
  // 倍率を掛けるのは、マスターの値から計算する CT だけ（個別に変更した値・gcsim から書き戻した値は、すでにこの短縮を含む）
  // 受付の延長のヒットストップの値（敵の防御ヒットストップが無効なら短い値）
  const hitlagOf = (sp: ActionModeSpecial) =>
    options?.defHalt === false ? sp.hitlagNoDefHalt ?? sp.hitlag : sp.hitlag;
  // このアクションの所要時間に、ヒットストップで止まった分が含まれているか（gcsim から書き戻した所要時間だけ）。
  // 受付（疾風怒濤）のヒットストップ延長は、所要時間に止まった分が含まれるときだけ足す（両方足すか、両方足さないか）
  const durationHasHitlag = (a: { gcsimBaseDuration?: number }) => a.gcsimBaseDuration !== undefined;
  const cdResonanceScale = characters.filter(c => c.element === 'anemo').length >= 2 ? 0.95 : 1;
  // 祭礼の武器（祭礼の断片・剣・大剣・弓）を持つキャラ: 武器の内部 CT（秒）。確率は 100% として扱う（発動の条件は、CT の判定の中で見る）
  const sacrificialOf = (c: CharacterConfig): { icdSeconds: number } | undefined => {
    const w = options?.database?.weapons.find(x => x.id === c.weaponId);
    if (!w?.gcsimKey || !(SACRIFICIAL_WEAPON_KEYS as readonly string[]).includes(w.gcsimKey)) return undefined;
    const refine = c.weaponRefinementRank ?? w.refinementRank ?? (w.rarity >= 5 ? 1 : 5);
    return { icdSeconds: sacrificialIcdSeconds(refine) };
  };
  const burstCooldowns: CooldownSpan[] = [];
  const validationIssues: ValidationIssue[] = [];
  const passiveSpans: PassiveSpan[] = [];

  // 炎場（ディシアの熔鉄流獄）の効果バー（置き直しで、拾った時点で切って、新しいバーを出す）
  const fieldSpans = new Map<string, ActiveBuffSpan>();
  // スキル・爆発で入るモード（夢見月瑞希の夢浮かみ・ディシアのパンチ連打モードなど）の窓（1 周目の線形の計算）。キー: モードを開くアクションの定義 ID。
  // モードの計算の結果は、end（終わりの時刻）と endedBy（どう終わったか: 終わらせるアクション・交代・時間切れ）。CT などは、これを受け取るだけにする。
  // inputs・finished・pending は、ディシアの固有の項目（burstMode）用
  interface ModeWindow {
    /** モードのキー（キャラ ID + モードの名前。一回押し・長押しの両方で開くモード〔藍硯〕は同じキー） */
    key: string;
    charId: string;
    actionDefId: string;
    /** モードを開いたアクションが炎場を出す（ディシア。炎場の置き直しで、モードの終わりが延びる） */
    hasField?: boolean;
    def: ActionMode;
    sIdx: number;
    start: number;
    end: number;
    endedBy?: 'ender' | 'swap' | 'timeout';
    /** 終わらせるアクション・交代で切る前の、本来の終わりの時刻（時間切れで CT を短縮するモード〔cooldownReduceOnExpire〕に使う） */
    naturalEnd?: number;
    span: ActiveBuffSpan;
    /** モードの間に、開いたアクションをもう一度使った回数（repress） */
    repressUsed: number;
    /** モードを開いたアクション（モードの終わりから始まる CT〔cooldownAtEnd〕に使う） */
    opener: { actionId: string; name: string; start: number; cooldown: number; cdScale: number; constellation: number };
    inputs: number;
    finished: boolean;
    pending?: { savedFrames: number; template: ActiveBuffSpan };
    // --- 特殊スキル・特殊爆発の受付（def.special）だけ ---
    /** 受付が閉じた（特殊スキル・特殊爆発を 1 回使った、スキルを使った）。closedBy = 閉じたもの（警告の文に使う） */
    closed?: boolean;
    closedBy?: string;
    /** 受付の間の通常攻撃で、特殊スキルの CT を短縮した回数（ファルカ） */
    reductions: number;
    /** 特殊スキルの CT の仕組み（スキルの startsSpecialPool） */
    pool?: NonNullable<ActionDefinition['startsSpecialPool']>;
    /** スキルが全回数分の CT を積むとき（ファルカ）の、受付の終わり。出場の終わりで決める（それより後に始まる待機中の CT は積まない） */
    ctWindow?: { until: number; effectiveEnd?: number };
  }
  // モードの間か（交代で終わるモードは、同じ出場の中だけ）
  const isModeActive = (m: ModeWindow, charId: string, sIdx: number, t: number) =>
    m.charId === charId && !m.endedBy && t < m.end - 0.001 && (m.sIdx === sIdx || m.def.swap === 'persists');
  const modeWindows = new Map<string, ModeWindow>();
  // 同じモードを開き直して置き換えられた、前の窓（終わった後の計算に使う）
  const retiredModes: ModeWindow[] = [];
  // 八重神子の殺生桜（キャラ ID → 桜の数え方。効果バーを、押し出し・爆発で壊れた時刻で切る）。CT の判定と同じ数え方（totemTracker.ts）
  const barTotems = new Map<string, TotemTracker<ActiveBuffSpan>>();
  // 殺生桜のバーの、本来の寿命（押し出し・爆発で切る前）、上限、爆発の時刻（2 周目の再現に使う）
  const totemLifetime = new Map<ActiveBuffSpan, number>();
  const totemMax = new Map<string, number>();
  const totemBursts = new Map<string, Array<{ time: number; destroy: boolean }>>();
  const cutBar = (span: ActiveBuffSpan, at: number) => {
    span.endTime = Number(Math.max(span.startTime, at).toFixed(3));
    span.duration = Number((span.endTime - span.startTime).toFixed(3));
  };
  const modeKeyOf = (charId: string, md: ActionMode) => `${charId}:${md.label}`;
  const endMode = (m: ModeWindow, at: number, by: NonNullable<ModeWindow['endedBy']>) => {
    m.naturalEnd ??= m.end;
    m.end = Number(Math.max(m.start, Math.min(m.end, at)).toFixed(3));
    m.endedBy = by;
    m.span.endTime = m.end;
    m.span.duration = Number((m.end - m.span.startTime).toFixed(3));
  };
  // 爆発が拾った炎場（ディシア）を、時刻 at に置き直す（残り時間 + 拾いの延長のバーを出す。まだ置き直していない回の再生成の窓は、新しい炎場の終わりまで延ばす）
  const placePickedField = (charId: string, mw: { pending?: { savedFrames: number; template: ActiveBuffSpan } }, at: number) => {
    if (!mw.pending) return;
    const { savedFrames, template } = mw.pending;
    mw.pending = undefined;
    const startTime = Number(at.toFixed(3));
    const placed: ActiveBuffSpan = {
      ...template,
      id: `${template.id}_burst_${startTime}`,
      startTime,
      endTime: Number((startTime + savedFrames / 60).toFixed(3)),
      duration: Number((savedFrames / 60).toFixed(3)),
    };
    activeBuffs.push(placed);
    fieldSpans.set(charId, placed);
    // 置き直しの受付（剣域熾焔）が未使用なら、新しい炎場の終わりまで延ばす
    for (const m of modeWindows.values()) {
      if (m.charId === charId && m.hasField && !m.endedBy) m.end = Math.max(m.end, placed.endTime);
    }
  };
  // 夜魂値で無料のスキルが出るキャラ（ヴァレサ）の状態（1 周目の線形の計算。マキシマムドライブの受付を開く条件に使う）
  const nightsoulTrackers = new Map<string, NightsoulTracker>();

  // CT を持つ発動（スキル・爆発・発動バフ）。CT違反の判定はすべて計算後にまとめて行う（checkCooldownViolations）
  const ctEvents: CooldownEvent[] = [];
  // 特殊スキルの CT の短縮（通常攻撃のヒットごと。表示の CT バーを短くするために記録する）

  // Track runtime status for each character:
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

  // CT違反の検証メッセージ（同じアクションは1件にまとめ、残り秒数は最大値）
  const violationRemaining = new Map<string, number>();
  const addViolationIssue = (
    id: string,
    char: CharacterConfig,
    stintId: string,
    actionId: string | undefined,
    time: number,
    severity: 'error' | 'warning',
    title: string,
    what: string,
    remaining: number,
    cycle: number,
  ) => {
    const where = cycle === 0 ? '' : `（ループ${cycle + 1}周目の発動時）`;
    const message = `${what}の発動時点で CT がまだ ${remaining} 秒残っています${where}`;
    const prev = violationRemaining.get(id);
    if (prev !== undefined) {
      if (remaining > prev) {
        violationRemaining.set(id, remaining);
        const existing = validationIssues.find(v => v.id === id);
        if (existing) existing.message = message;
      }
      return;
    }
    violationRemaining.set(id, remaining);
    validationIssues.push({ id, severity, characterId: char.id, stintId, actionId, time, title, message });
  };


  // 1. Process Stints and Actions in strict chronological order
  for (let sIdx = 0; sIdx < rawStints.length; sIdx++) {
    const rawStint = rawStints[sIdx];
    const char = characterMap.get(rawStint.characterId);
    if (!char) continue;
    const charActions = CharacterModel.fromConfig(char).actions;
    // 爆発の後のモードに、固有の項目（パンチ・蹴り・炎場の拾い）を持つキャラ（ディシア）
    const burstModeAction = charActions.find(a => a.burstMode && a.mode);
    const burstModeDef = burstModeAction?.burstMode;
    // 入力がなければ、状態が切れた後の最初の自動のパンチ（autoPunchFrames ごと）の後に、蹴りが命中する。その時刻（入力があるときは、最も遅い場合）
    const autoKickAt = (m: ModeWindow) => {
      if (!burstModeDef) return m.end;
      const punchAt = m.inputs === 0
        ? m.start + Math.ceil((m.end - m.start) * 60 / burstModeDef.autoPunchFrames - 0.001) * burstModeDef.autoPunchFrames / 60
        : m.end + burstModeDef.autoPunchFrames / 60;
      return punchAt + (burstModeDef.kickHitFrames + burstModeDef.fieldPlaceAfterKickFrames) / 60;
    };

    const stintStartTime = currentTime;
    const computedActions: CharacterActionInstance[] = [];
    // スキルの CT が、マスターの値から何倍に変わっているか（gcsim の書き戻し）。特殊スキルの CT にも同じ割合を掛ける
    let specialCdScale = cdResonanceScale;
    // 特殊スキル・特殊爆発の受付（モードの定義の special。D78）: この出場で、種類ごとに最後に開いた受付（交代で消える）
    const specialModes: { skill?: ModeWindow; burst?: ModeWindow } = {};
    // この出場で開いた受付（新しい受付に置き換わったものも含む）。出場の終わりで、CT の待機の終わり（ctWindow）を決める
    const stintSpecialModes: ModeWindow[] = [];
    // 時刻 t に、特殊スキル（skill）・特殊爆発（burst）の受付が開いているか（閉じた受付は開いていない）
    const specialOpenAt = (kind: 'skill' | 'burst', t: number) => {
      const m = specialModes[kind];
      return !!m && !m.closed && t <= m.end + 0.001;
    };
    const windowOpenAt = (t: number) => specialOpenAt('skill', t);
    // 受付を延ばす（ヒットストップ・爆発）／閉じる（モードのバーの終わりも動かす）
    const extendSpecial = (m: ModeWindow, seconds: number) => {
      if (!(seconds > 0)) return;
      m.end = Number((m.end + seconds).toFixed(3));
      m.span.endTime = m.end;
      m.span.duration = Number((m.end - m.start).toFixed(3));
    };
    const closeSpecial = (m: ModeWindow, t: number, by?: string) => {
      endMode(m, t, 'ender');
      m.closed = true;
      if (by) m.closedBy = by;
    };
    // 受付の開く条件（ヴァレサの落下攻撃: 命ノ星座・猛烈パッション、フリンズの嵐槍: 幽炎の露顕の間）
    const specialConditionOk = (md: ActionMode, t: number) => {
      const cond = md.special?.openCondition;
      if (!cond) return true;
      if (cond.requiresOpen && !specialOpenAt(cond.requiresOpen, t)) return false;
      if (cond.minConstellation !== undefined || cond.orBlessing) {
        const consOk = cond.minConstellation !== undefined && CharacterModel.fromConfig(char).constellation >= cond.minConstellation;
        const blessingOk = !!cond.orBlessing && !!nightsoulTrackers.get(char.id)?.inBlessing(t);
        if (!consOk && !blessingOk) return false;
      }
      return true;
    };
    // 連続した通常攻撃の段（gcsim と同じく、他のアクションを挟むと1段目に戻る）
    let normalStreak = 0;

    // 2-C: 先頭キャラも含め、全出場に交代時間を設ける（switchDelay > 0の場合）
    // これにより先頭キャラの例外処理が不要になり、ループ開始位置へ戻った時も自然に交代時間が入る
    if (switchDelay > 0) {
      const switchActionStartTime = currentTime;
      const switchActionEndTime = Number((currentTime + switchDelay).toFixed(3));
      const switchAction: CharacterActionInstance = {
        id: `switch_stint_${rawStint.id}`,
        actionTypeId: 'action_switch_char',
        name: 'キャラ交代',
        shortName: '交代',
        type: 'swap',
        duration: switchDelay,
        startTime: switchActionStartTime,
        endTime: switchActionEndTime,
      };
      computedActions.push(switchAction);
      currentTime = switchActionEndTime;
    }

    // Filter out any runtime-generated swap actions in raw actions to avoid duplicates
    const rawActions = rawStint.actions.filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char');

    for (let aIdx = 0; aIdx < rawActions.length; aIdx++) {
      const act = rawActions[aIdx];
      const actionStartTime = currentTime;
      // CT・効果継続時間はアクション定義ごとに持つ（凸の変更を適用済み）
      const actionDef = charActions.find(a => a.id === act.actionTypeId);

      // モードの中の E（終わらせる E・別の動作になる E。CT・効果バーを持たない）
      let inStateWindow = false;

      // モード（スキル・爆発で入る状態）: このアクションが、続いているモードを終わらせるアクションか（モードの定義の enders）。
      // 「交代しても続く」モードは、後の出場のアクションでも終わらせられる
      let modeEnder: { window: ModeWindow; ender: ModeEnder } | undefined;
      // モードの間に、開いたアクションをもう一度使った（終わらせない別の動作。クロリンデの突き・閑雲の 2・3 段目の跳躍）
      let modeRepress: { window: ModeWindow; index: number } | undefined;
      for (const m of modeWindows.values()) {
        if (!isModeActive(m, char.id, sIdx, actionStartTime)) continue;
        const ender = m.def.enders.find(e => (e.by === 'self' ? act.actionTypeId === m.actionDefId : act.type === e.by));
        if (ender) {
          modeEnder = { window: m, ender };
          break;
        }
        const rp = m.def.repress;
        const repressMatches = rp && (rp.actions ? rp.actions.some(s => act.actionTypeId === `${char.id}_${s}`) : act.actionTypeId === m.actionDefId);
        if (rp && repressMatches && (rp.maxUses === undefined || m.repressUsed < rp.maxUses)) {
          modeRepress = { window: m, index: m.repressUsed };
          break;
        }
      }

      // 爆発の後のモード（ディシア）の固有の扱い: モードの間の N・E はパンチ、ダッシュは短く（ジャンプへ）、ジャンプは蹴りかモードの終わり、終わった後の最初の N・E は蹴り
      const mw = burstModeAction?.mode ? modeWindows.get(modeKeyOf(char.id, burstModeAction.mode)) : undefined;
      let modeKind: 'punch' | 'kick' | 'dash' | undefined;
      if (burstModeDef && mw && mw.sIdx === sIdx) {
        const isInput = act.type === 'normal' || (act.type === 'skill' && act.actionTypeId === `${char.id}_e`);
        if (!mw.endedBy && actionStartTime < mw.end - 0.001) {
          if (isInput) modeKind = 'punch';
          else if (act.type === 'dash') modeKind = 'dash';
          else if (modeEnder?.window === mw) {
            const prevAct = computedActions[computedActions.length - 1];
            const dashJump = prevAct?.type === 'dash' && actionStartTime - (prevAct.startTime ?? 0) <= burstModeDef.dashJumpKickFrames / 60 + 0.001;
            mw.finished = true;
            if (dashJump) modeKind = 'kick';
            else placePickedField(char.id, mw, actionStartTime); // ジャンプで状態が終わると、拾った炎場がその場に置かれる
          }
        } else if (!mw.finished && isInput && actionStartTime < mw.end + burstModeDef.finisherWindowFrames / 60) {
          modeKind = 'kick';
        }
      }
      // パンチ・蹴りになった E（ディシアの爆発の後）は、炎場の置き直しにならず、新しいモードも開かない
      if (modeKind === 'punch' || modeKind === 'kick') modeRepress = undefined;
      // このアクションが、新しいモードを開くか（続いているモードの、終わらせるアクション・もう一度使った動作・パンチではない）
      // モードの間に置けない操作（夢見月瑞希の夢浮かみの間の通常攻撃など）: 黄色の警告（アプリの時間は変えない）
      const blockingMode = [...modeWindows.values()].find(m => isModeActive(m, char.id, sIdx, actionStartTime) && actionStartTime >= m.start - 0.001 && !!m.def.blocked?.types.includes(act.type));
      const blockedMessage = blockingMode?.def.blocked
        ? `「${blockingMode.def.label}」の間は「${act.name}」を置けません。${blockingMode.def.blocked.result === 'wait'
          ? `gcsim では${blockingMode.def.label}が終わるまで（あと ${(blockingMode.end - actionStartTime).toFixed(1)} 秒）待ちます`
          : blockingMode.def.blocked.result === 'none' ? 'ゲームでは何も起きません。gcsim では別の動作として実行されます' : 'gcsim では実行エラーになります'}。${blockingMode.def.blocked.hint}`
        : undefined;
      // gcsim で実行エラーになる操作（スカークの七相一閃の間の E）は、自分の CT・効果バーを持たない
      if ((blockingMode?.def.blocked?.result === 'error' || blockingMode?.def.blocked?.result === 'none') && (act.type === 'skill' || act.type === 'skill_hold')) inStateWindow = true;
      const opensMode = !!actionDef?.mode && !(modeEnder && modeEnder.window.key === modeKeyOf(char.id, actionDef.mode)) && !modeRepress
        && modeKind !== 'punch' && modeKind !== 'kick' && specialConditionOk(actionDef.mode, actionStartTime)
        // モードの間に置けない操作（スカークの七相一閃の間の E）は、新しいモードを開かない
        && !blockedMessage;
      // スキルが全回数分の特殊スキルの CT を積むとき（ファルカ）の、受付の終わり（このアクションが開く受付に付ける）
      let pendingCtWindow: { until: number; effectiveEnd?: number } | undefined;
      if (modeEnder) {
        endMode(modeEnder.window, actionStartTime, 'ender');
        // 終わらせる E（夢見月瑞希の解除・タルタリヤの遠距離への戻り）は、自分の CT・効果バーを持たない（CT は、モードを開いたアクションの分。cooldownAtEnd）
        if (act.type === 'skill') inStateWindow = true;
      }
      if (modeRepress) {
        const { window: m, index } = modeRepress;
        m.repressUsed += 1;
        inStateWindow = true;
        // 使うたびに、モードの終わりを更新する（閑雲の跳躍）
        const rp = m.def.repress!;
        const rf = rp.refreshFrames;
        if (rf?.length) {
          const newEnd = Number((actionStartTime + rf[Math.min(index, rf.length - 1)] / 60).toFixed(3));
          if (rp.barPerUse) {
            // 使うたびに、前のバーをここで終わらせ、新しいバーを同じ行に置く（ディルックの連撃の受付）。最後の 1 回の後は、新しいバーを置かない
            m.span.endTime = Number(Math.min(m.span.endTime, actionStartTime).toFixed(3));
            m.span.duration = Number((m.span.endTime - m.span.startTime).toFixed(3));
            m.end = newEnd;
            const last = rp.endsOnLast && rp.maxUses !== undefined && m.repressUsed >= rp.maxUses;
            if (!last) {
              const next: ActiveBuffSpan = { ...m.span, id: `${m.span.id}_u${m.repressUsed}`, startTime: actionStartTime, endTime: newEnd, duration: Number((newEnd - actionStartTime).toFixed(3)) };
              if (!m.def.noBar) activeBuffs.push(next);
              m.span = next;
            }
          } else {
            m.end = newEnd;
            m.span.endTime = m.end;
            m.span.duration = Number((m.end - m.start).toFixed(3));
          }
        }
        // 使い切るとモードが終わる（ニィロウのステップ 3 段目）
        if (rp.endsOnLast && rp.maxUses !== undefined && m.repressUsed >= rp.maxUses) endMode(m, actionStartTime, 'ender');
      }
      if (modeKind === 'punch' || modeKind === 'kick') {
        if (act.type === 'skill') inStateWindow = true; // スキルの CT・効果・窓の規則は使わない
        if (modeKind === 'kick') {
          mw!.finished = true;
          placePickedField(char.id, mw!, actionStartTime + (burstModeDef!.kickHitFrames + burstModeDef!.fieldPlaceAfterKickFrames) / 60);
        }
      }


      // 通常攻撃: 連続した N の段（gcsim と同じく、他のアクションを挟むと1段目に戻り、最大段数を超えたら1段目に戻る）
      let frames = actionDef?.frames;
      let hitFallbackDuration: number | undefined;
      // モードの間だけ、通常攻撃・元素爆発が別の動作になるキャラ（クロリンデの夜巡り）
      const frameMode = [...modeWindows.values()].find(m => isModeActive(m, char.id, sIdx, actionStartTime) && actionStartTime >= m.start - 0.001 && (m.def.normalFrames || m.def.burstFrames));
      if (act.type === 'normal') {
        const hits = actionDef?.normalHits;
        if (hits && hits.length > 0) {
          const hit = hits[normalStreak % hits.length];
          frames = hit.frames ?? frames;
          hitFallbackDuration = hit.duration;
        }
        const modeNormal = frameMode?.def.normalFrames;
        if (modeNormal?.length) frames = modeNormal[normalStreak % modeNormal.length];
        normalStreak += 1;
      } else {
        normalStreak = 0;
      }
      if (act.type === 'burst' && frameMode?.def.burstFrames) frames = frameMode.def.burstFrames;
      // モードを終わらせる動作・もう一度使った動作のフレーム（夢見月瑞希の状態の解除・クロリンデの突き・閑雲の跳躍）
      if (modeEnder?.ender.frames) frames = modeEnder.ender.frames;
      if (modeRepress) {
        const rpFrames = modeRepress.window.def.repress!.frames;
        if (rpFrames.length) frames = rpFrames[Math.min(modeRepress.index, rpFrames.length - 1)];
      }
      if (modeKind && burstModeDef && mw) {
        if (modeKind === 'punch') {
          const h = burstModeDef.inputFrames[Math.min(mw.inputs, burstModeDef.inputFrames.length - 1)];
          mw.inputs += 1;
          frames = { total: h, cancels: {}, source: 'burst.go:punchHitmarks（入力のパンチ）' };
          hitFallbackDuration = undefined;
          normalStreak = 0;
        } else if (modeKind === 'kick') {
          frames = { total: burstModeDef.finisher.total, cancels: burstModeDef.finisher.cancels, source: 'burst.go:kickFrames（フィニッシュの蹴り）' };
          hitFallbackDuration = undefined;
          if (act.type === 'normal') normalStreak = 0;
        } else {
          frames = { total: Math.round((actionDef?.defaultDuration ?? 0.2) * 60), cancels: { jump: burstModeDef.dashToJumpFrames }, source: 'dash.go:burstDashDuration（ジャンプへ）' };
        }
      }


      // 所要時間: 編集済み（durationManual）ならその値。未編集なら、次に続くアクションに応じたキャンセルフレーム
      // （出場の最後は次が交代）。フレームが無いアクションは、登録時の値を使う
      let autoDuration: number | undefined;
      {
        if (frames) {
          const nextKey = cancelKeyOf(rawActions[aIdx + 1], char.weaponType);
          const motion = nextKey === 'wait' ? canQueueFrames(frames, actionDef) : (nextKey ? frames.cancels[nextKey] : undefined) ?? frames.total;
          autoDuration = Number((motion / 60).toFixed(3));
        } else {
          autoDuration = hitFallbackDuration;
        }
      }
      // gcsim 自身の標準の所要時間（編集済みでも）。ユーザーが標準より長くした分を gcsim に渡すために使う
      const naturalDuration = act.gcsimBaseDuration ?? autoDuration;
      if (act.durationManual) autoDuration = undefined;
      const duration = Math.max(0.05, autoDuration ?? (act.duration || 0.5));
      const actionEndTime = Number((actionStartTime + duration).toFixed(3));

      // 長押しの秒数（CT開始位置が「長押し終了」のアクション）: 所要時間 −（ホールド 0 のときのモーション）。
      // モーション = 次に続くアクションに応じたキャンセルフレーム。frames に長押しが含まれる分（holdInFrames）は差し引く
      const cooldownStart = actionDef?.cooldownStart;
      let holdSeconds: number | undefined;
      if (cooldownStart?.from === 'holdEnd') {
        const nextKey = cancelKeyOf(rawActions[aIdx + 1], char.weaponType);
        const motionFrames = frames ? (nextKey === 'wait' ? canQueueFrames(frames, actionDef) : (nextKey ? frames.cancels[nextKey] : undefined) ?? frames.total) : undefined;
        holdSeconds = motionFrames === undefined
          ? 0
          : Number(Math.max(0, duration - (motionFrames / 60 - (actionDef?.holdInFrames ?? 0))).toFixed(3));
      }

      const computedAction: CharacterActionInstance = {
        ...act,
        hasCTCollision: false,
        collisionRemainingCT: undefined,
        ...(holdSeconds !== undefined ? { holdSeconds } : {}),
        ...(naturalDuration !== undefined ? { naturalDuration } : {}),
        ...(actionDef?.cooldownPool ? { cooldownPool: actionDef.cooldownPool } : {}),
        modeHoldSeconds: undefined,
        duration,
        startTime: actionStartTime,
        endTime: actionEndTime,
      };
      computedActions.push(computedAction);
      if (blockedMessage) {
        computedAction.specialWindowWarning = blockedMessage;
        validationIssues.push({
          id: `mode_blocked_${act.id}`,
          severity: 'warning',
          characterId: char.id,
          stintId: rawStint.id,
          actionId: act.id,
          time: actionStartTime,
          title: `${char.name}: モードの間に置けない操作`,
          message: blockedMessage,
        });
      }

      // gcsim の結果でCT待ちが生じたアクション: アプリのCT違反と同じ印を付ける
      const externalWait = options?.externalCtWaits?.[act.id];
      if (externalWait !== undefined) {
        computedAction.hasCTCollision = true;
        computedAction.collisionRemainingCT = externalWait;
        addViolationIssue(`skill_ct_gcsim_${act.id}`, char, rawStint.id, act.id, actionStartTime, 'error', `${char.name}: gcsim でCT待ち`, `「${act.name}」`, externalWait, 0);
      }

      const isSkill = act.type === 'skill' || act.type === 'skill_hold' || act.type === 'skill_reset';
      // 個別に変更された CT があれば優先
      // （長押しで長さが変わるものは、ホールド 0 のときの値 + 長押し 1 秒あたりの増分 × ホールド秒数）
      const isCdAction = act.type === 'skill' || act.type === 'skill_hold' || act.type === 'skill_reset' || act.type === 'burst';
      // gcsim から書き戻した CT は、書き戻したときの共鳴の倍率を含む。編成の共鳴が変わっていたら、その比で直す
      const writtenCooldown = act.cooldown !== undefined && act.gcsimCdResonance !== undefined && act.gcsimCdResonance !== cdResonanceScale
        ? Number((act.cooldown * cdResonanceScale / act.gcsimCdResonance).toFixed(3))
        : act.cooldown;
      const baseCooldown = writtenCooldown ?? Number((((actionDef?.cooldown ?? 0) + (actionDef?.cooldownPerHold ?? 0) * (holdSeconds ?? 0)) * (isCdAction && !actionDef?.ignoresCdScale ? cdResonanceScale : 1)).toFixed(3));
      // 風元素共鳴が無く、スキルの CT が書き戻しで変わっている（重雲の命ノ星座2など）ときは、特殊スキルの CT も同じ割合で短くする（gcsim のログで 660f → 627f を確認）
      const cooldown = writtenCooldown === undefined && actionDef?.cooldownPool === 'special' && !actionDef.ignoresCdScale && specialCdScale !== 1 && cdResonanceScale === 1
        ? Number((baseCooldown * specialCdScale).toFixed(3))
        : baseCooldown;
      // CTの開始位置（動作開始からの遅れ）。マスターの値。未設定は動作開始と同時
      // 動作開始から / 長押し終了から / 状態の終了から（状態の長さは効果継続時間。無ければアクションの終了）
      const effectSeconds = act.effectDuration ?? actionDef?.effectDuration ?? 0;
      const computedCtOffset = Number((cooldownStart
        ? cooldownStart.delay + (cooldownStart.from === 'holdEnd' ? holdSeconds ?? 0 : cooldownStart.from === 'stateEnd' ? (effectSeconds > 0 ? effectSeconds : duration) : 0)
        : 0).toFixed(3));
      // gcsim から書き戻した値があれば優先（D37）
      const ctOffset = act.gcsimCtOffset ?? computedCtOffset;
      const ctStartTime = Number((actionStartTime + ctOffset).toFixed(3));

      // CT に関わるスキル・爆発なのにアクション定義が見つからない（旧データの編成など）: CT を判定できないことを知らせる
      if (!actionDef && (isSkill || act.type === 'burst') && act.cooldown === undefined) {
        validationIssues.push({
          id: `missing_def_${act.id}`,
          severity: 'warning',
          characterId: char.id,
          stintId: rawStint.id,
          actionId: act.id,
          time: actionStartTime,
          title: `${char.name}: アクション定義が見つかりません`,
          message: `「${act.name}」の定義がキャラデータにないため、CT を判定できません（DB 管理で、そのキャラのアクションを確認してください）`,
        });
      }

      if (isSkill) {
        computedAction.inStateWindow = inStateWindow || undefined;
        // CTを開始しない派生技は、CTと無関係。祭礼リセットはCT中でも発動できる（CTは開始する）
        // 特殊元素スキル（cooldownPool = 'special'）は、スキルとは別のCT枠（スキルのCTは開始しない）
        const isSpecial = actionDef?.cooldownPool === 'special';
        // 受付の間だけ使える特殊スキル（ファルカ・オデット）。受付が無い出場では、スキルを使った後でないと使えない
        const needsWindow = isSpecial && ((actionDef?.charges ?? 1) > 1 || !!actionDef?.requiresWindow);
        // 受付の外で使った特殊スキル（ファルカ）は、gcsim では通常のスキルになり、特殊スキルの CT は積まれない（受付の警告は、下で出す）
        const specialOutOfWindow = isSpecial && needsWindow && !inStateWindow && !windowOpenAt(actionStartTime);
        const isTriggeringAction = isSpecial ? !inStateWindow && !specialOutOfWindow : actionDef?.startsSkillCooldown !== false && !inStateWindow;
        // モードの終わりから CT が始まるスキル（タルタリヤ・放浪者）: ここでは、入ったときの短い CT（タルタリヤ 1 秒）だけ。本来の CT は、計算の最後に足す
        const atEnd = opensMode ? actionDef?.mode?.cooldownAtEnd : undefined;
        const evCooldown = atEnd ? Number(((atEnd.entry?.seconds ?? 0) * (actionDef?.ignoresCdScale ? 1 : cdResonanceScale)).toFixed(3)) : cooldown;
        const evOffset = atEnd ? (atEnd.entry ? Number((atEnd.entry.delayFrames / 60).toFixed(3)) : 0) : ctOffset;
        const evCtStart = Number((actionStartTime + evOffset).toFixed(3));
        // 祭礼の武器: スキルのダメージが当たる時刻（命中時刻の表）。スキルを使ったときだけ（モードの間の 2 回目以降の E は、CT を始めないので対象外）
        const sacrificial = sacrificialOf(char);
        const sacrificialHits: number[] = isTriggeringAction && !isSpecial && sacrificial && actionDef ? skillHitFrames(actionDef.id, CharacterModel.fromConfig(char).constellation, holdSeconds) : [];
        if (isTriggeringAction) {
          ctEvents.push({
            key: `${char.id}:${isSpecial ? 'special' : 'skill'}`,
            time: actionStartTime,
            ctOffset: evOffset,
            cooldown: evCooldown,
            ...((actionDef?.charges ?? 1) > 1 ? { charges: actionDef!.charges } : {}),
            ...(!isSpecial && (actionDef?.mode?.cooldownReduceOnExpire || sacrificialHits.length > 0) ? { forceQueue: true } : {}),
            ...(!isSpecial && actionDef?.spawnsTotem ? { spawnsTotem: { max: actionDef.spawnsTotem.max, ...totemTiming(actionDef.spawnsTotem, act.effectDuration ?? actionDef.effectDuration ?? 0, isRevelation(char)) } } : {}),
            ...(!isSpecial && actionDef?.nightsoul?.role === 'skill' ? { nightsoul: actionDef.nightsoul } : {}),
            checked: act.type !== 'skill_reset',
            actionId: act.id,
            stintIndex: sIdx,
            name: act.name,
            onViolation: (remaining, cycle) => {
              computedAction.hasCTCollision = true;
              computedAction.collisionRemainingCT = Math.max(computedAction.collisionRemainingCT ?? 0, remaining);
              addViolationIssue(`skill_ct_${act.id}`, char, rawStint.id, act.id, actionStartTime, 'error', `${char.name}: ${isSpecial ? '特殊スキルCT違反' : 'スキルCT違反'}`, `${isSpecial ? '特殊スキル' : 'スキル'}「${act.name}」`, remaining, cycle);
            },
          });
        }
        for (const h of sacrificialHits) {
          ctEvents.push({
            key: `${char.id}:skill`,
            time: Number((actionStartTime + h / 60).toFixed(3)),
            ctOffset: 0,
            cooldown: 0,
            checked: false,
            sacrificial: { icdSeconds: sacrificial!.icdSeconds, hitFrame: h },
            actionId: act.id,
            stintIndex: sIdx,
            name: act.name,
            onViolation: () => {},
          });
        }
        // モードを終わらせて CT を始める E（タルタリヤ）: 自分の CT は持たないが、CT 中（入ったときの 1 秒）なら使えない
        if (modeEnder?.ender.cooldown === 'start') {
          ctEvents.push({
            key: `${char.id}:skill`,
            time: actionStartTime,
            ctOffset: 0,
            cooldown: 0,
            checked: true,
            actionId: act.id,
            stintIndex: sIdx,
            name: act.name,
            onViolation: (remaining, cycle) => {
              computedAction.hasCTCollision = true;
              computedAction.collisionRemainingCT = Math.max(computedAction.collisionRemainingCT ?? 0, remaining);
              addViolationIssue(`skill_ct_${act.id}`, char, rawStint.id, act.id, actionStartTime, 'error', `${char.name}: スキルCT違反`, `スキル「${act.name}」`, remaining, cycle);
            },
          });
        }

        // スキルが、特殊スキルの別枠のCTを、全チャージ分まとめて開始する（ファルカ）
        if (!isSpecial && !inStateWindow && actionDef?.startsSpecialPool) {
          const pool = actionDef.startsSpecialPool;
          const baseSkillCd = actionDef.cooldown ?? 0;
          specialCdScale = baseSkillCd > 0 && writtenCooldown !== undefined ? writtenCooldown / baseSkillCd : cdResonanceScale;
          const poolCooldown = Number((pool.cooldown * specialCdScale).toFixed(3));
          // 受付（モード）は、下のモードを開く処理で開く。受付の終わりは、出場の終わりで決める
          pendingCtWindow = { until: Infinity };
          if (!pool.windowOnly) ctEvents.push({
            key: `${char.id}:special`,
            time: actionStartTime,
            ctOffset,
            cooldown: poolCooldown,
            charges: pool.charges,
            startsAll: true,
            actionId: act.id,
            window: pendingCtWindow,
            checked: false,
            stintIndex: sIdx,
            name: act.name,
            onViolation: () => {},
          });
        }

        // 2 回分の CT を持つ特殊スキル（ファルカ）のバーは、使った時点では置かない。CT のキューで、前の CT が 0 になって始まった時点に、判定の関数が作る
        // 複数回分の通常のスキル（クレー・魈など）も同じ: バーは、CT のキューで始まった時点に作る
        const isQueuedSpecial = (actionDef?.charges ?? 1) > 1 || !!actionDef?.mode?.cooldownReduceOnExpire || (!isSpecial && sacrificialHits.length > 0);
        if (isTriggeringAction && evCooldown > 0 && !isQueuedSpecial) {
          const cdSpan: CooldownSpan = {
            id: `cd_${isSpecial ? 'special' : 'skill'}_${char.id}_${actionStartTime}`,
            characterId: char.id,
            type: isSpecial ? 'special' : 'skill',
            startTime: evCtStart,
            endTime: Number((evCtStart + evCooldown).toFixed(3)),
            duration: evCooldown,
            actionInstanceId: act.id,
          };
          skillCooldowns.push(cdSpan);
          charStates[char.id].skillCooldowns.push(cdSpan);
        }
      }

      // 八重神子: 爆発が、場の殺生桜 1 つにつき、スキルの CT を 1 回分戻す（固有天賦 1）
      if (act.type === 'burst' && actionDef?.releasesSkillPerTotem) {
        // 効果バー: 論示が未達成なら、爆発で桜が全部壊れる（バーをここで切る）
        const barTracker = barTotems.get(char.id);
        if (barTracker) {
          const present = barTracker.burst(actionStartTime, !isRevelation(char));
          const burstLog = totemBursts.get(char.id) ?? [];
          burstLog.push({ time: actionStartTime, destroy: !isRevelation(char) });
          totemBursts.set(char.id, burstLog);
          if (!isRevelation(char)) for (const x of present) cutBar(x.tag, x.end);
        }
        ctEvents.push({
          key: `${char.id}:skill`,
          time: actionStartTime,
          ctOffset: 0,
          cooldown: 0,
          checked: false,
          releasesPerTotem: { revelation: isRevelation(char) },
          stintIndex: sIdx,
          name: act.name,
          onViolation: () => {},
        });
      }
      // ヴァレサ: 落下攻撃・爆発が夜魂値を増やし、満タンで猛烈パッションに入る（次のスキルが無料）
      if (actionDef?.nightsoul && actionDef.nightsoul.role !== 'skill') {
        ctEvents.push({
          key: `${char.id}:nightsoul`,
          time: actionStartTime,
          ctOffset: 0,
          cooldown: 0,
          checked: false,
          nightsoul: actionDef.nightsoul,
          stintIndex: sIdx,
          name: act.name,
          onViolation: () => {},
        });
      }

      // モードを開く（続いているモードを終わらせる E の再押しは、開かない）。モードは、アクションの開始から startDelayFrames 後に始まる
      if (opensMode && actionDef?.mode) {
        const md = actionDef.mode;
        // 使い切った後の、新しいモード（閑雲の 4 回目の E）: 続いている前のモードは、ここで終わる
        const key = modeKeyOf(char.id, md);
        const prevMode = modeWindows.get(key);
        if (prevMode && !prevMode.endedBy && prevMode.end > actionStartTime) endMode(prevMode, actionStartTime, 'timeout');
        // 長押しの終わりから始まるモード（藍硯の長押し）は、長押しの秒数（所要時間からの逆算）を足す
        const start = Number((actionStartTime + (md.startAfterHold ? holdSeconds ?? 0 : 0) + md.startDelayFrames / 60).toFixed(3));
        // 最大時間: モードの定義の値。アクションごとの効果継続時間（個別に変更した値・gcsim の結果）のほうが長ければ、その値。
        // 受付（special）は、受付の長さそのもの（効果継続時間は別のもの）。受付を開いたスキルの初撃のヒットストップで延びる（ファルカ。状態は命中の 1 フレーム前に付く）
        const baseSeconds = md.special ? md.durationFrames / 60 + (durationHasHitlag(act) ? hitlagOf(md.special)?.skill ?? 0 : 0) : Math.max(md.durationFrames / 60, act.effectDuration ?? 0);
        const end = Number((start + baseSeconds).toFixed(3));
        const span: ActiveBuffSpan = {
          id: `mode_${actionDef.id}_${act.id}`,
          buffId: `mode_${actionDef.id}`,
          name: `${char.name} ${md.label}${md.barNote ? `（${md.barNote}）` : ''}`,
          sourceCharacterId: char.id,
          sourceType: 'talent',
          startTime: start,
          endTime: end,
          duration: Number((end - start).toFixed(3)),
          color: char.color,
          description: md.description,
          // モードを開くアクションの効果バーの代わりなので、既定はバフ重複に数える
          ...(md.noSynergy ? { noSynergy: true } : {}),
          // スキルの後の受付のバー（ガントチャートで、スキルストックとスキル CT の間の行に出す）
          ...(md.description.includes('受付') ? { windowBar: true, standardDuration: Number((md.durationFrames / 60).toFixed(3)) } : {}),
        };
        // バーを出さないモード（受付型）は、効果バーが兼ねる
        if (!md.noBar) activeBuffs.push(span);
        const opened: ModeWindow = {
          key, charId: char.id, actionDefId: actionDef.id, def: md, sIdx, start, end, span, repressUsed: 0, inputs: 0, finished: false, reductions: 0,
          ...(actionDef.fieldRecast ? { hasField: true } : {}),
          opener: {
            actionId: act.id, name: act.name, start: actionStartTime, cooldown,
            cdScale: actionDef.ignoresCdScale ? 1 : cdResonanceScale,
            constellation: CharacterModel.fromConfig(char).constellation,
          },
        };
        // ディシア: 爆発の開始で、炎場を拾う（炎場が出ていれば。バーをここで切り、残り時間 + 拾いの延長を保存する）
        const fieldDef = actionDef.burstMode ? charActions.find(a => a.fieldRecast)?.fieldRecast : undefined;
        const field = fieldSpans.get(char.id);
        if (fieldDef && field && actionStartTime < field.endTime) {
          opened.pending = { savedFrames: Math.round((field.endTime - actionStartTime) * 60) + fieldDef.pickupExtensionFrames, template: { ...field } };
          field.endTime = Number((actionStartTime + 1 / 60).toFixed(3));
          field.duration = Number(Math.max(0, field.endTime - field.startTime).toFixed(3));
        }
        if (prevMode) retiredModes.push(prevMode);
        modeWindows.set(key, opened);
        // 特殊スキル・特殊爆発の受付: この出場の、種類ごとの受付にする。特殊スキルの CT の仕組みは、スキルの startsSpecialPool（爆発で開いた受付〔オデット〕も同じ）
        if (md.special) {
          specialModes[md.special.kind] = opened;
          stintSpecialModes.push(opened);
          opened.pool = actionDef.startsSpecialPool ?? charActions.find(a => a.startsSpecialPool)?.startsSpecialPool;
          if (md.special.kind === 'skill' && pendingCtWindow) opened.ctWindow = pendingCtWindow;
        }
      }

      // ヴァレサ: 夜魂値（猛烈パッション）と、マキシマムドライブ（落下攻撃の開始時に、命ノ星座 2 以上、または猛烈パッション中なら、短い間だけ特殊爆発の受付が開く）
      if (actionDef?.nightsoul) {
        const ns = actionDef.nightsoul;
        const tracker = nightsoulTrackers.get(char.id) ?? new NightsoulTracker();
        nightsoulTrackers.set(char.id, tracker);
        if (ns.role === 'skill') {
          tracker.useSkill(actionStartTime, ns.gain, ns.max);
        } else if (ns.role === 'plunge') {
          tracker.plunge(actionStartTime, ns.gain, ns.max, ns.blessingSeconds);
        } else {
          tracker.burst(actionStartTime, ns.gain, ns.max, ns.blessingSeconds);
        }
      }

      // スキルを使うと閉じる受付（ヴァレサのマキシマムドライブ）
      const burstMode = specialModes.burst;
      if ((act.type === 'skill' || act.type === 'skill_hold') && !actionDef?.cooldownPool && burstMode?.def.special?.closedBySkill && !burstMode.closed) closeSpecial(burstMode, actionStartTime, 'スキル');

      if (act.type === 'burst') {
        // 特殊爆発（フリンズ・ヴァレサ）: 受付の中は、短い CT（ヴァレサ 1 秒・フリンズ なし）。外では通常の爆発になり、通常の CT が始まる
        const sbc = actionDef?.specialBurst ? actionDef.specialBurstCooldown : undefined;
        const sbInWindow = !!sbc && specialOpenAt('burst', actionStartTime);
        const burstCooldown = sbc ? (writtenCooldown ?? (sbInWindow ? sbc.inWindow : sbc.outOfWindow)) : cooldown;
        const isTriggeringBurst = sbc
          ? (sbInWindow ? sbc.inWindow > 0 || sbc.checkInWindow : sbc.outOfWindow > 0)
          : actionDef?.startsBurstCooldown !== false;
        if (isTriggeringBurst) {
          ctEvents.push({
            key: `${char.id}:burst`,
            time: actionStartTime,
            ctOffset,
            cooldown: burstCooldown,
            checked: sbc && sbInWindow ? sbc.checkInWindow : true,
            stintIndex: sIdx,
            name: act.name,
            onViolation: (remaining, cycle) => {
              computedAction.hasCTCollision = true;
              computedAction.collisionRemainingCT = Math.max(computedAction.collisionRemainingCT ?? 0, remaining);
              addViolationIssue(`burst_ct_${act.id}`, char, rawStint.id, act.id, actionStartTime, 'error', `${char.name}: 元素爆発CT違反`, `元素爆発「${act.name}」`, remaining, cycle);
            },
          });
        }

        if (isTriggeringBurst && burstCooldown > 0) {
          const burstCDSpan: CooldownSpan = {
            id: `cd_burst_${char.id}_${actionStartTime}`,
            characterId: char.id,
            type: 'burst',
            startTime: ctStartTime,
            endTime: Number((ctStartTime + burstCooldown).toFixed(3)),
            duration: burstCooldown,
            actionInstanceId: act.id,
          };
          burstCooldowns.push(burstCDSpan);
          charStates[char.id].burstCooldowns.push(burstCDSpan);
        }
      }

      // 特殊スキル・特殊爆発の受付の確認（ファルカ・オデット・フリンズ）: 受付の外（ヒットストップ・爆発の延長を最大に見ても）で使うと、gcsim では通常のスキル・爆発になる（警告）
      const isSpecialBurst = act.type === 'burst' && !!actionDef?.specialBurst;
      if ((actionDef?.cooldownPool === 'special' && ((actionDef.charges ?? 1) > 1 || actionDef.requiresWindow) || isSpecialBurst) && !inStateWindow) {
        const winFor = specialModes[isSpecialBurst ? 'burst' : 'skill'];
        if (!specialOpenAt(isSpecialBurst ? 'burst' : 'skill', actionStartTime)) {
          const windowClosed = !!winFor?.closed;
          const kindName = isSpecialBurst ? '特殊爆発' : '特殊スキル';
          const normalName = isSpecialBurst ? '通常の爆発（CT が始まる）' : '通常のスキル';
          const noWindowHint = isSpecialBurst ? (actionDef?.specialBurstHint ?? '受付の中でないと使えません') : '同じ出場の中でスキルを使った後でないと使えません';
          const windowMessage = windowClosed && winFor?.closedBy ? `${kindName}の受付は、${winFor.closedBy}を使ったため閉じています。gcsim では${normalName}として扱われます` : windowClosed ? `${kindName}の受付は、すでに${kindName}を使って閉じています（受付の間に 1 回だけ使えます）。gcsim では${normalName}として扱われます` : winFor
            ? `${kindName}の受付時間外: 受付（${(winFor.end - winFor.opener.start).toFixed(1)} 秒。ヒットストップ・爆発の延長を含む最大）を ${(actionStartTime - winFor.end).toFixed(1)} 秒過ぎています。gcsim では${normalName}として扱われます`
            : `${kindName}の受付時間外: ${noWindowHint}。gcsim では${normalName}として扱われます`;
          computedAction.specialWindowWarning = windowMessage;
          validationIssues.push({
            id: `special_window_${act.id}`,
            severity: 'warning',
            characterId: char.id,
            stintId: rawStint.id,
            actionId: act.id,
            time: actionStartTime,
            title: `${char.name}: ${kindName}の受付時間外`,
            message: `${kindName}「${act.name}」: ${windowMessage}`,
          });
        }
      }
      // 受付の延長: ヒットストップ（通常攻撃は段ごと、重撃・特殊スキルは 1 回あたり）、自分の元素爆発（ファルカ）
      const skillWindow = specialModes.skill;
      if (skillWindow && windowOpenAt(actionStartTime)) {
        const sp = skillWindow.def.special!;
        const pool = skillWindow.pool;
        if (act.type === 'burst') extendSpecial(skillWindow, sp.extendOnBurst ?? 0);
        else if (act.type === 'normal') {
          const steps = durationHasHitlag(act) ? hitlagOf(sp)?.normal ?? [] : [];
          extendSpecial(skillWindow, steps.length ? steps[(normalStreak - 1 + steps.length * 8) % steps.length] ?? 0 : 0);
        }
        else if (act.type === 'charged' && pool) {
          extendSpecial(skillWindow, durationHasHitlag(act) ? hitlagOf(sp)?.charged ?? 0 : 0);
          // 受付の間の重撃は、特殊スキルの CT（回数）が空いていれば、特殊重撃「蒼牙」になり、特殊スキルと同じ CT を 1 回分使う（空いていなければ普通の重撃）。
          // 空いているかは、CT の判定と、バーの表示の両方で決める（ここでは「使うかもしれない」発動として記録する）
          ctEvents.push({
            key: `${char.id}:special`,
            time: actionStartTime,
            ctOffset: 0,
            cooldown: Number((pool.cooldown * specialCdScale).toFixed(3)),
            charges: pool.charges,
            optional: true,
            actionId: act.id,
            checked: false,
            stintIndex: sIdx,
            name: act.name,
            onViolation: () => {},
          });
        }
        else if (actionDef?.cooldownPool === 'special') extendSpecial(skillWindow, durationHasHitlag(act) ? hitlagOf(sp)?.special ?? 0 : 0);
        // 受付の間に特殊スキルを使うと、受付が閉じる（オデット）
        if (actionDef?.cooldownPool === 'special' && sp.singleUse) closeSpecial(skillWindow, actionStartTime);
      }
      // 特殊爆発を使うと、特殊爆発の受付が閉じる（フリンズ・ヴァレサ）
      const burstWindowMode = specialModes.burst;
      if (isSpecialBurst && burstWindowMode && specialOpenAt('burst', actionStartTime) && burstWindowMode.def.special?.singleUse) closeSpecial(burstWindowMode, actionStartTime);

      // 特殊スキルの受付の間の通常攻撃（N）: 特殊スキルの CT を短縮する（ファルカ。N が敵に当たるたびに 0.5 秒、最大 15 回）
      const reducePool = skillWindow?.pool;
      if (act.type === 'normal' && skillWindow && reducePool?.reducePerHit && actionStartTime <= skillWindow.end && skillWindow.reductions < (reducePool.maxReductions ?? 15)) {
        // 連続した N の何段目か（上で normalStreak を進めたあと）。ヒット数は段ごと
        const stepHits = reducePool.hitsPerNormal ?? [1];
        const hits = Math.min(stepHits[(normalStreak - 1 + stepHits.length * 8) % stepHits.length] ?? 1, (reducePool.maxReductions ?? 15) - skillWindow.reductions);
        skillWindow.reductions += hits;
        // ヘクセレイ：秘儀（ヘクセレイのキャラが 2 人以上で、本人もヘクセレイ）のとき、1 ヒットあたりの短縮が増える
        const perHit = reducePool.reducePerHitHexerei !== undefined && isHexerei(char) && hexereiCount(characters) >= 2
          ? reducePool.reducePerHitHexerei
          : reducePool.reducePerHit;
        // 1 ヒットごとに別の短縮として記録する（先頭の CT がこのヒットの途中で明けると、残りのヒットは次の CT に効くため）
        for (let h = 0; h < hits; h++) {
          ctEvents.push({
            key: `${char.id}:special`,
            time: actionStartTime,
            ctOffset: 0,
            cooldown: 0,
            reduceBy: perHit,
            checked: false,
            stintIndex: sIdx,
            name: act.name,
            onViolation: () => {},
          });
        }
      }

      // 効果継続時間（アクション定義 or 個別変更値）から効果バーを作る
      // モードを開くアクションの効果バーは、モードのバーが兼ねる（終わらせるアクション・出場の終わりで切れる）
      const effectSpan = inStateWindow || (actionDef?.mode && !actionDef.mode.noBar && !actionDef.mode.keepEffectBar) ? null : buildActionEffectSpan(char, act, actionDef, actionStartTime);
      // 殺生桜（八重神子）: バーは、桜が現れる位置から始まり、寿命（効果継続時間 + 論示で +10 秒）で終わる。4 つ目が出ると最古が消え、バーをそこで切る
      if (effectSpan && isSkill && actionDef?.spawnsTotem) {
        const tt = totemTiming(actionDef.spawnsTotem, effectSpan.duration, isRevelation(char));
        effectSpan.startTime = Number((actionStartTime + tt.delay).toFixed(3));
        effectSpan.endTime = Number((effectSpan.startTime + tt.lifetime).toFixed(3));
        effectSpan.duration = tt.lifetime;
        effectSpan.stackable = true;
        const tracker = barTotems.get(char.id) ?? new TotemTracker<ActiveBuffSpan>();
        barTotems.set(char.id, tracker);
        const { popped, lane } = tracker.spawn(effectSpan.startTime, tt.lifetime, actionDef.spawnsTotem.max, effectSpan);
        effectSpan.lane = lane;
        totemLifetime.set(effectSpan, tt.lifetime);
        totemMax.set(effectSpan.buffId, actionDef.spawnsTotem.max);
        if (popped) cutBar(popped.tag, popped.end);
      }
      // 炎場（ディシア）: バーは、スキルの startDelayFrames 後（炎場が置かれる位置）から始まる
      if (effectSpan && actionDef?.fieldRecast) {
        const delay = actionDef.fieldRecast.startDelayFrames / 60;
        effectSpan.startTime = Number((effectSpan.startTime + delay).toFixed(3));
        effectSpan.endTime = Number((effectSpan.endTime + delay).toFixed(3));
        fieldSpans.set(char.id, effectSpan);
      }
      // 置き直し（窓の中の E）: 炎場を拾う（バーをここで切る）。命中の recastPlaceFrames 後に、残り時間 + 拾いの延長（命ノ星座 2 以上はさらに延長）で置き直す
      if (inStateWindow && !modeKind && actionDef?.fieldRecast) {
        const fr = actionDef.fieldRecast;
        const field = fieldSpans.get(char.id);
        if (field && actionStartTime < field.endTime) {
          const remaining = field.endTime - actionStartTime;
          const savedFrames = Math.round(remaining * 60) + fr.pickupExtensionFrames + (CharacterModel.fromConfig(char).constellation >= fr.c2Constellation ? fr.c2ExtensionFrames : 0);
          field.endTime = Number((actionStartTime + 1 / 60).toFixed(3));
          field.duration = Number(Math.max(0, field.endTime - field.startTime).toFixed(3));
          const placedAt = Number((actionStartTime + fr.recastPlaceFrames / 60).toFixed(3));
          const placed: ActiveBuffSpan = {
            ...field,
            id: `${field.id}_recast_${act.id}`,
            startTime: placedAt,
            endTime: Number((placedAt + savedFrames / 60).toFixed(3)),
            duration: Number((savedFrames / 60).toFixed(3)),
          };
          activeBuffs.push(placed);
          fieldSpans.set(char.id, placed);
        }
      }
      if (effectSpan) activeBuffs.push(effectSpan);

      // gcsim から書き戻した副次効果（アクションの開始からの位置・継続時間つき）
      (act.extraEffects ?? []).forEach((ex, exIdx) => {
        if (!(ex.duration > 0) || inStateWindow) return;
        const exStart = Number((actionStartTime + Math.max(0, ex.offset)).toFixed(3));
        activeBuffs.push({
          id: `effect_extra_${char.id}_${act.id}_${exIdx}`,
          buffId: `effect_extra_${char.id}_${act.actionTypeId}_${ex.key}`,
          name: `${char.name} ${act.shortName}: ${ex.name}`,
          sourceCharacterId: char.id,
          sourceType: 'talent',
          startTime: exStart,
          endTime: Number((exStart + ex.duration).toFixed(3)),
          duration: ex.duration,
          color: char.color,
          description: `${act.name}（副次効果: ${ex.name}）`,
          ownerStintId: rawStint.id,
        });
      });

      // アクションごとの遅延は、そのアクションの終了後に入れる（出場の最後なら次の交代が遅れる）
      // 待機の後には、遅延を入れない（gcsim の設定文は、待機の後に delay を出さない。アクションの後の遅延は、待機の後の次のアクションの直前に入る）
      currentTime = Number((actionEndTime + (act.type === 'wait' ? 0 : actionDelayOf(act))).toFixed(3));
    }

    // モードの維持: 維持が有効なら、出場を、モードの終わりまで延ばす（出場の最後のアクションの後の、自動の待ち。秒数は保存しない）。
    // 延ばすのは、「交代で終わる」「終わらせないと交代できない」モードだけ。「交代しても続く」モードは延ばさず、バーだけ交代の後も続く。
    // 出場ごとの切り替え（holdMode）は、延長を足すかどうかだけに効く（モードの終わりの計算には関わらない）
    const stintModes = [...modeWindows.values()].filter(m => m.charId === char.id && m.sIdx === sIdx && m.def.swap !== 'persists');
    // 維持の延長を出さないモード（放浪者）は、切り替えも出さない
    const holdableModes = stintModes.filter(m => !m.def.noHold);
    const holdOn = (m: ModeWindow) => !m.def.noHold && (rawStint.holdMode ?? m.def.holdByDefault);

    // 維持の目標の時刻: モードの終わり。ディシアは、状態が切れた後の自動の蹴りが命中するまで
    const holdTargetOf = (m: ModeWindow) => (m.actionDefId === burstModeAction?.id && !m.finished ? autoKickAt(m) : m.end);
    const lastAction = [...computedActions].reverse().find(a => a.type !== 'swap');
    let modeHoldSeconds = 0;
    if (lastAction) {
      const target = Math.max(0, ...stintModes.filter(m => !m.endedBy && holdOn(m)).map(holdTargetOf));
      const extra = Number((target - currentTime).toFixed(3));
      if (extra >= 0.005) {
        modeHoldSeconds = extra;
        lastAction.modeHoldSeconds = extra;
        currentTime = Number((currentTime + extra).toFixed(3));
      }
    }

    const stintEndTime = currentTime;
    // ディシア: 拾った炎場は、交代の fieldPlaceAfterExitFrames 後、または自動の蹴りの命中の後に置き直される（早いほう）
    const burstModeAtEnd = burstModeAction?.mode ? modeWindows.get(modeKeyOf(char.id, burstModeAction.mode)) : undefined;
    if (burstModeDef && burstModeAtEnd && burstModeAtEnd.sIdx === sIdx && burstModeAtEnd.pending) {
      placePickedField(char.id, burstModeAtEnd, Math.min(stintEndTime + burstModeDef.fieldPlaceAfterExitFrames / 60, autoKickAt(burstModeAtEnd)));
    }
    // 出場の終わりでの、モードの終わり方: 時間切れ／交代で終わる／終わらせないと交代できない（警告）。「交代しても続く」モードは、そのまま続く
    for (const m of stintModes) {
      if (m.endedBy) continue;
      if (m.end <= stintEndTime + 0.001) m.endedBy = 'timeout';
      else if (m.def.swap === 'ends') endMode(m, stintEndTime, 'swap');
      else {
        validationIssues.push({
          id: `mode_blocks_${rawStint.id}_${m.actionDefId}`,
          severity: 'warning',
          characterId: char.id,
          stintId: rawStint.id,
          actionId: lastAction?.id,
          time: stintEndTime,
          title: `${char.name}: モードを終わらせずに交代`,
          message: m.def.noHold
            ? `「${m.def.label}」は、終わらせないと交代できません（残り ${(m.end - stintEndTime).toFixed(1)} 秒）。交代の前に、終わらせるアクション（E の再押しなど）を置いてください（gcsim では交代できず、実行が止まります）`
            : `「${m.def.label}」は、終わらせないと交代できません（残り ${(m.end - stintEndTime).toFixed(1)} 秒）。終わらせるアクションを置くか、この出場の「モード維持」をオンにしてください`,
        });
      }
    }
    // 受付の有効な終わり（モードの終わり = 受付の終わり〔延長を含む〕・出場の終わり〔交代で消える〕・次の受付の始まりの早いもの）。
    // 特殊スキルの CT は、この時刻より後に始まる待機中のものを積まない
    for (const m of stintSpecialModes) {
      if (m.ctWindow) m.ctWindow.until = m.ctWindow.effectiveEnd = m.end;
    }
    const stintDuration = stintEndTime - stintStartTime;

    // Check swap internal cooldown (1.0s)
    if (sIdx < rawStints.length - 1) {
      const nextStint = rawStints[sIdx + 1];
      if (nextStint.characterId !== rawStint.characterId && stintDuration < 1.0) {
        validationIssues.push({
          id: `swap_cd_${rawStint.id}`,
          severity: 'info',
          characterId: char.id,
          stintId: rawStint.id,
          time: stintStartTime,
          title: 'キャラ交代CT近接 (Swap CD)',
          message: `出場時間が ${stintDuration.toFixed(2)}秒です。原神の交代内部CT(約1.0秒)に近い素早い交代です。`
        });
      }
    }

    // 連動・発動バフ（固有天賦・武器・聖遺物）: 発動位置は出場の先頭からの秒数（退場後も自由移動可能）
    const availableBuffs = getAvailableBuffsForCharacter(char, options?.database);

    for (const trigger of rawStint.passiveTriggers ?? []) {
      const def = availableBuffs.find(b => b.id === trigger.passiveEffectId);
      const category: BuffCategory = def?.category || (trigger.passiveEffectId.startsWith('wbuff_') ? 'weapon' : trigger.passiveEffectId.startsWith('abuff_') ? 'artifact' : 'talent');
      const duration = trigger.duration ?? def?.duration ?? 0;
      // 個別に変更した CT を優先（継続時間と同じ優先順）
      const cooldown = trigger.cooldown ?? def?.cooldown ?? 0;
      // 発動位置は出場の前にも置ける（下限は時間 0）
      const startTime = Number(Math.max(0, stintStartTime + trigger.offset).toFixed(3));

      const buffColor = def?.color || (category === 'weapon' ? '#0284c7' : category === 'artifact' ? '#c084fc' : char.color);

      passiveSpans.push({
        id: `passive_${trigger.id}`,
        triggerId: trigger.id,
        stintId: rawStint.id,
        characterId: char.id,
        passiveEffectId: trigger.passiveEffectId,
        gcsimKey: trigger.gcsimKey,
        effectGroup: passiveGroupOf(trigger.passiveEffectId, trigger.gcsimKey),
        gcsimMissed: trigger.gcsimMissed,
        name: trigger.gcsimMissed ? `${trigger.name}（gcsim では発動せず）` : trigger.name,
        category,
        startTime,
        duration,
        endTime: startTime + duration,
        cooldown,
        cooldownEnd: startTime + cooldown,
        hasCTViolation: false,
        collisionRemainingCT: undefined,
        color: buffColor,
        description: def?.description ?? trigger.name,
      });
      const passiveSpan = passiveSpans[passiveSpans.length - 1];
      const catLabel = category === 'weapon' ? '武器バフ' : category === 'artifact' ? '聖遺物バフ' : category === 'constellation' ? '命ノ星座の効果' : '固有天賦バフ';
      ctEvents.push({
        key: `${char.id}:passive:${passiveGroupOf(trigger.passiveEffectId, trigger.gcsimKey)}`,
        time: startTime,
        ctOffset: 0,
        cooldown,
        checked: true,
        stintIndex: sIdx,
        name: trigger.name,
        onViolation: (remaining, cycle) => {
          passiveSpan.hasCTViolation = true;
          passiveSpan.collisionRemainingCT = Math.max(passiveSpan.collisionRemainingCT ?? 0, remaining);
          addViolationIssue(`passive_ct_${trigger.id}`, char, rawStint.id, undefined, startTime, 'warning', `${char.name}: ${catLabel}CT警告`, `「${trigger.name}」`, remaining, cycle);
        },
      });

      if (duration > 0) {
        activeBuffs.push({
          id: `passive_buff_${trigger.id}`,
          buffId: `buff_${char.id}_${passiveGroupOf(trigger.passiveEffectId, trigger.gcsimKey)}`, // 同じバフ（キー単位）は重複集計で1つとして数える
          name: `${char.name}: ${trigger.name}`,
          sourceCharacterId: char.id,
          sourceType: category,
          startTime,
          endTime: startTime + duration,
          duration,
          color: buffColor,
          description: def?.description ?? trigger.name,
          origin: 'passive',
        });
      }
    }

    // gcsim から書き込んだ、キャラクターに紐づく効果（D57）。出場の先頭からの位置（出場より前は負。時間 0 より前には出さない）
    (rawStint.extraEffects ?? []).forEach((ex, exIdx) => {
      if (!(ex.duration > 0)) return;
      const exStart = Number(Math.max(0, stintStartTime + ex.offset).toFixed(3));
      activeBuffs.push({
        id: `effect_char_${char.id}_${rawStint.id}_${exIdx}`,
        buffId: `effect_char_${char.id}_${ex.key}`,
        name: `${char.name}: ${ex.name}`,
        sourceCharacterId: char.id,
        sourceType: 'talent',
        startTime: exStart,
        endTime: Number((exStart + ex.duration).toFixed(3)),
        duration: ex.duration,
        color: char.color,
        description: `キャラクターに紐づく効果: ${ex.name}`,
        ownerStintId: rawStint.id,
      });
    });

    const calculatedStint: Stint = {
      ...rawStint,
      startTime: stintStartTime,
      endTime: stintEndTime,
      duration: stintDuration,
      actions: computedActions,
      modeHold: holdableModes.length > 0
        ? { on: holdableModes.some(holdOn), seconds: modeHoldSeconds, label: [...new Set(holdableModes.map(m => m.def.label))].join('・') }
        : undefined,
    };

    calculatedStints.push(calculatedStint);
    charStates[char.id].stints.push(calculatedStint);
    charStates[char.id].totalActiveTime += stintDuration;
  }

  // 時間切れで終わったモードが、スキルの CT を短縮する（閑雲）。終わらせるアクション（落下攻撃）で終わったものと、同じアクションの使い直しで切れたものは、短縮しない。
  // 交代で終わったものは、afterSwap なら、本来の終わりの時刻に短縮する
  for (const m of [...retiredModes, ...modeWindows.values()]) {
    const red = m.def.cooldownReduceOnExpire;
    if (!red || m.def.special) continue;
    const natural = m.naturalEnd ?? m.end;
    // 'timeout' は、出場の終わりまでに自然に切れた（naturalEnd が無い）ものと、同じモードを開き直して切られた（naturalEnd がある）ものがある。後者は短縮しない
    if (m.endedBy === 'ender' || (m.endedBy === 'timeout' && m.naturalEnd !== undefined) || (m.endedBy === 'swap' && !red.afterSwap)) continue;
    ctEvents.push({ key: `${m.charId}:skill`, time: Number(natural.toFixed(3)), ctOffset: 0, cooldown: 0, reduceBy: red.seconds, checked: false, stintIndex: m.sIdx, name: m.opener.name, onViolation: () => {} });
  }

  // モードの終わりから始まる CT（タルタリヤ・放浪者）: モードの計算の結果（終わりの時刻・終わり方）を受け取って、CT の発動を足す。
  // 長さは、滞在時間（モードを開いたアクションの開始〜モードの終わり）の表、無ければアクションの CT。交代で終わったときは、交代の動作の後から
  for (const m of modeWindows.values()) {
    const cae = m.def.cooldownAtEnd;
    if (!cae) continue;
    const by = m.endedBy ?? 'timeout';
    const at = Number((m.end + (by === 'swap' ? switchDelay : 0) + cae.delayFrames[by] / 60).toFixed(3));
    let length = m.opener.cooldown;
    if (cae.byStay?.length) {
      const stay = m.end - m.opener.start;
      const row = cae.byStay.find(r => r.below === undefined || stay < r.below - 0.0001) ?? cae.byStay[cae.byStay.length - 1];
      length = (row.seconds + (row.plusStay ? stay : 0)) * m.opener.cdScale;
      if (cae.consScale && m.opener.constellation >= cae.consScale.minConstellation) length *= cae.consScale.scale;
    }
    length = Number(length.toFixed(3));
    if (!(length > 0)) continue;
    ctEvents.push({ key: `${m.charId}:skill`, time: at, ctOffset: 0, cooldown: length, checked: false, actionId: m.opener.actionId, stintIndex: m.sIdx, name: m.opener.name, onViolation: () => {} });
    const span: CooldownSpan = {
      id: `cd_skill_${m.charId}_${m.opener.actionId}_end`,
      characterId: m.charId,
      type: 'skill',
      startTime: at,
      endTime: Number((at + length).toFixed(3)),
      duration: length,
      actionInstanceId: m.opener.actionId,
    };
    skillCooldowns.push(span);
    charStates[m.charId]?.skillCooldowns.push(span);
  }

  const totalDuration = Number(currentTime.toFixed(2));
  // gcsim が実装していないアクション（大剣の重撃など）: 実行すると「action ... not implemented」のエラーになる（警告）
  for (const st of calculatedStints) {
    const stChar = characters.find(c => c.id === st.characterId);
    if (!stChar) continue;
    for (const a of st.actions) {
      if (!stChar.availableActions.find(d => d.id === a.actionTypeId)?.gcsimUnsupported) continue;
      const message = 'gcsim が未実装のアクションです。gcsim で実行するとエラーになり、設定文には入れられません';
      a.specialWindowWarning = message;
      validationIssues.push({
        id: `gcsim_unsupported_${a.id}`,
        severity: 'warning',
        characterId: st.characterId,
        stintId: st.id,
        actionId: a.id,
        time: a.startTime ?? 0,
        title: `${stChar.name}: gcsim 未実装のアクション`,
        message: `「${a.name}」: ${message}`,
      });
    }
  }

  // 落下攻撃が、gcsim で実行できる前提（直前のアクション・閑雲の爆発バフなど。data/plungeRules.ts）を満たしているか。満たさないと、gcsim は実行エラーになる（警告）
  for (const w of checkPlungePrerequisites(characters, calculatedStints)) {
    const action = calculatedStints.find(s => s.id === w.stintId)?.actions.find(a => a.id === w.actionId);
    if (action) action.specialWindowWarning = w.message;
    const charName = characters.find(c => c.id === w.characterId)?.name ?? '';
    validationIssues.push({
      id: `plunge_prereq_${w.actionId}`,
      severity: 'warning',
      characterId: w.characterId,
      stintId: w.stintId,
      actionId: w.actionId,
      time: w.time,
      title: `${charName}: 落下攻撃の前提`,
      message: `「${w.actionName}」: ${w.message}`,
    });
  }

  const safeLoopStartIndex = Math.min(loopStartIndex, Math.max(0, calculatedStints.length - 1));
  const loopStartTime = calculatedStints[safeLoopStartIndex]?.startTime ?? 0;
  const loopPeriod = Math.max(0, totalDuration - loopStartTime);

  // CT違反の判定（1周目・2周目を区別せず、ループを必要な周数だけ並べた時間軸で時刻順に判定）
  // 2 回分の CT を持つ特殊スキル（ファルカ）のバーは、判定のキューで CT が始まった時点に作られる
  // 使用者が場にいるか（祭礼の発動の条件）。時刻 t が 1 周目の終わりを過ぎたら、ループの区間に折り返して見る
  const stintIntervals = new Map<string, Array<[number, number]>>();
  for (const st of calculatedStints) {
    const list = stintIntervals.get(st.characterId) ?? [];
    list.push([st.startTime, st.endTime]);
    stintIntervals.set(st.characterId, list);
  }
  const isActiveAt = (charId: string, t: number): boolean => {
    let tt = t;
    if (loopPeriod > 0.05) while (tt >= totalDuration - 1e-6 && tt - loopPeriod >= loopStartTime - 1e-6) tt -= loopPeriod;
    return (stintIntervals.get(charId) ?? []).some(([s0, e0]) => tt >= s0 - 1e-6 && tt < e0 - 1e-6);
  };
  const sacrificialProcs: SacrificialProc[] = [];
  const stockLogs: StockLog[] = [];
  for (const span of checkCooldownViolations(ctEvents, safeLoopStartIndex, loopPeriod, isActiveAt, sacrificialProcs, stockLogs)) {
    skillCooldowns.push(span);
    charStates[span.characterId]?.skillCooldowns.push(span);
  }

  const stockSpans = buildStockSpans(stockLogs, totalDuration, loopStartTime, loopPeriod);

  // 祭礼の武器効果（確率 100%）の発動を、発動バフのバー（効果と、武器の内部 CT。長さは精錬で決まる）として自動で出す。
  // 出すのは 1 周目の発動だけ（2 周目折り返しは、既存の持ち越しの仕組み）。手で置く発動バフ（triggerId）ではない（auto）
  const sacrificialDefs = new Map<string, TriggerableBuffDefinition | undefined>();
  for (const p of sacrificialProcs) {
    if (p.cycle !== 0) continue;
    const owner = characterMap.get(p.charId);
    if (!owner) continue;
    if (!sacrificialDefs.has(p.charId)) sacrificialDefs.set(p.charId, getAvailableBuffsForCharacter(owner, options?.database).find(b => b.autoApplied));
    const def = sacrificialDefs.get(p.charId);
    const stint = calculatedStints.find(st => st.characterId === p.charId && p.time >= st.startTime - 1e-6 && p.time < st.endTime + 1e-6);
    if (!def || !stint) continue;
    const duration = def.duration ?? 0.1;
    passiveSpans.push({
      id: `passive_auto_sac_${p.actionId}_${p.hitFrame}`,
      triggerId: `auto_sac_${p.actionId}_${p.hitFrame}`,
      auto: true,
      stintId: stint.id,
      characterId: p.charId,
      passiveEffectId: def.id,
      effectGroup: passiveGroupOf(def.id),
      name: def.name,
      category: 'weapon',
      startTime: p.time,
      duration,
      endTime: Number((p.time + duration).toFixed(3)),
      cooldown: p.icdSeconds,
      cooldownEnd: Number((p.time + p.icdSeconds).toFixed(3)),
      hasCTViolation: false,
      color: def.color,
      description: def.description,
    });
  }

  // 同じ効果を再発動したら、前の発動の効果はそこで終わる（残りは上書きされる）
  endAtNextStart(activeBuffs, b => (b.stackable ? `${b.buffId}#${b.id}` : b.buffId));
  endAtNextStart(passiveSpans, p => `${p.characterId}:${p.effectGroup}`);

  const carryOverCooldowns: CooldownSpan[] = [];
  const carryOverBuffs: ActiveBuffSpan[] = [];
  const carryOverPassives: PassiveSpan[] = [];

  // 効果の折り返し部分: ループ先頭から残り時間分。ループ区間で同じ効果を再発動したらそこで終わる。
  // 本体の終了時刻も、折り返し後の実際の終了（totalDuration + 折り返し部分の長さ）に合わせる。
  // 開始が周の終端以降の発動（2周目の発動。D39）は、ループ先頭 + (開始 − 総時間) の位置から始まる
  const wrapEffect = (span: { id: string; startTime: number; endTime: number }, sameEffect: { id?: string; startTime: number }[]) => {
    const wrapDelay = Math.max(0, span.startTime - totalDuration);
    const wrapStart = loopStartTime + wrapDelay;
    const toLapTwo = (t: number) => (t >= totalDuration ? loopStartTime + (t - totalDuration) : t);
    const nextStart = Math.min(
      ...sameEffect
        .filter(s => (wrapDelay > 0 ? (s as { id?: string }).id !== span.id && toLapTwo(s.startTime) > wrapStart : s.startTime >= loopStartTime))
        .map(s => toLapTwo(s.startTime)),
    );
    const end = Number(Math.min(totalDuration, loopStartTime + (span.endTime - totalDuration), nextStart).toFixed(3));
    span.endTime = totalDuration + Math.max(0, end - loopStartTime);
    if (end <= wrapStart + 0.02) return null;
    return {
      startTime: Number(wrapStart.toFixed(3)),
      endTime: end,
      duration: end - wrapStart,
      isCarryOver: true,
      originalStartTime: span.startTime,
      sourceId: span.id,
    };
  };

  if (loopPeriod > 0.05) {
    // 1. スキルCTの2周目折り返し
    for (const cd of skillCooldowns) {
      if (cd.endTime > totalDuration + 0.02) {
        // CTの開始が周の終端より後（CT開始位置の遅れ）なら、折り返し後もその分だけ遅れて始まる
        const wrapDelay = Math.max(0, cd.startTime - totalDuration);
        const overflow = Number((cd.endTime - totalDuration - wrapDelay).toFixed(3));
        const wrapStart = Number((loopStartTime + wrapDelay).toFixed(3));
        const wrapEnd = Math.min(totalDuration, Number((wrapStart + overflow).toFixed(3)));
        carryOverCooldowns.push({
          id: `wrap_cd_${cd.type === 'special' ? 'special' : 'skill'}_${cd.id}`,
          characterId: cd.characterId,
          type: cd.type,
          startTime: wrapStart,
          endTime: wrapEnd,
          duration: overflow,
          actionInstanceId: cd.actionInstanceId,
          isCarryOver: true,
          originalStartTime: cd.startTime,
          originalEndTime: cd.endTime,
        });
      }
    }

    // 2. 元素爆発CTの2周目折り返し
    for (const cd of burstCooldowns) {
      if (cd.endTime > totalDuration + 0.02) {
        // CTの開始が周の終端より後（CT開始位置の遅れ）なら、折り返し後もその分だけ遅れて始まる
        const wrapDelay = Math.max(0, cd.startTime - totalDuration);
        const overflow = Number((cd.endTime - totalDuration - wrapDelay).toFixed(3));
        const wrapStart = Number((loopStartTime + wrapDelay).toFixed(3));
        const wrapEnd = Math.min(totalDuration, Number((wrapStart + overflow).toFixed(3)));
        carryOverCooldowns.push({
          id: `wrap_cd_burst_${cd.id}`,
          characterId: cd.characterId,
          type: 'burst',
          startTime: wrapStart,
          endTime: wrapEnd,
          duration: overflow,
          actionInstanceId: cd.actionInstanceId,
          isCarryOver: true,
          originalStartTime: cd.startTime,
          originalEndTime: cd.endTime,
        });
      }
    }

    // 3. 効果バフの2周目折り返し（発動バフ分はバフ数の集計用。バーは carryOverPassives で表示する）
    // 殺生桜（行を持つバー）は、2 周目の動きを再現して持ち越す（別に処理する）
    carryOverBuffs.push(...wrapTotems(activeBuffs.filter(b => b.stackable && b.lane !== undefined), totalDuration, loopStartTime, totemLifetime, totemMax, totemBursts));
    for (const b of activeBuffs) {
      if (b.stackable && b.lane !== undefined) continue;
      if (b.endTime <= totalDuration + 0.02) continue;
      const carry = wrapEffect(b, activeBuffs.filter(x => x.buffId === b.buffId));
      if (carry) carryOverBuffs.push({ ...b, ...carry, id: `wrap_buff_${b.id}` });
    }

    // 4. 発動バフ（固有天賦・武器・聖遺物）の2周目折り返し
    for (const p of passiveSpans) {
      if (p.duration <= 0 || p.endTime <= totalDuration + 0.02) continue;
      const carry = wrapEffect(p, passiveSpans.filter(x => x.characterId === p.characterId && x.effectGroup === p.effectGroup));
      if (carry) {
        // CTも折り返した位置に合わせる（本体のCT終了は元の時刻のまま）
        const cooldownEnd = p.cooldownEnd > totalDuration ? Number((loopStartTime + (p.cooldownEnd - totalDuration)).toFixed(3)) : carry.startTime;
        carryOverPassives.push({ ...p, ...carry, cooldownEnd, id: `wrap_passive_buff_${p.id}` });
      }
    }
  }

  // バフ重複行: 1周目は折り返し部分をまだ数えず、2周目以降は数える
  const buffOverlapSegments = buildBuffOverlapSegments(activeBuffs, totalDuration);
  const loopedBuffOverlapSegments = buildBuffOverlapSegments([...activeBuffs, ...carryOverBuffs], totalDuration);

  return {
    stockSpans,
    sacrificialProcs,
    sacrificialCharIds: characters.filter(c => sacrificialOf(c)).map(c => c.id),
    cdResonanceScale,
    totalDuration,
    calculatedStints,
    activeBuffs,
    skillCooldowns,
    burstCooldowns,
    characterStates: charStates,
    validationIssues,
    buffOverlapSegments,
    loopedBuffOverlapSegments,
    passiveSpans,
    carryOverCooldowns,
    carryOverBuffs,
    carryOverPassives,
    loopStartTime,
    loopPeriod,
  };
}

/** スキルのストック（積まれている CT の数 = size の変化）の記録。時刻順（2 周分の時間軸） */
interface StockLog {
  charId: string;
  max: number;
  points: Array<[number, number]>;
}

/**
 * ストックの記録 → 区間（StockSpan）。ストック = 最大回数 − 積まれている CT の数（0 未満にはしない）。
 * 1 周目: 時間 0〜1 周目の終わり（出場しているかに関わらず決まる数。最初は満タン）。
 * 2 周目: 1 周目の終わりの状態から続けて、ループ 1 周分（表示位置は、ループ先頭 + (時刻 − 1 周目の終わり)）。ループの無い編成は 1 周目だけ。
 * 数が同じ区間は 1 本にまとめ、0 の区間・長さ 0 の区間は出さない
 */
function buildStockSpans(logs: StockLog[], totalDuration: number, loopStartTime: number, loopPeriod: number): StockSpan[] {
  const out: StockSpan[] = [];
  const hasLoop = loopPeriod > 0.05;
  for (const log of logs) {
    const pts = [...log.points].sort((a, b) => a[0] - b[0]);
    const countAt = (size: number) => Math.max(0, log.max - size);
    // 区間の列（[開始, 終了, 数]）。最初は満タン
    const steps: Array<[number, number, number]> = [];
    let from = -Infinity;
    let count = log.max;
    for (const [t, size] of pts) {
      steps.push([from, t, count]);
      from = t;
      count = countAt(size);
    }
    steps.push([from, Infinity, count]);
    const lapSpans = (lap: 1 | 2, w0: number, w1: number, shift: number) => {
      const spans: StockSpan[] = [];
      for (const [s0, s1, c] of steps) {
        const a = Math.max(s0, w0);
        const b = Math.min(s1, w1);
        if (c <= 0 || b - a < 0.001) continue;
        const last = spans[spans.length - 1];
        if (last && last.count === c && Math.abs(last.endTime - (a + shift)) < 0.001) last.endTime = Number((b + shift).toFixed(3));
        else spans.push({ id: '', characterId: log.charId, lap, startTime: Number((a + shift).toFixed(3)), endTime: Number((b + shift).toFixed(3)), count: c, max: log.max });
      }
      return spans;
    };
    // ストックは、出場しているかに関わらず決まる数なので、1 周目の先頭（時間 0）から出す
    const lap1 = lapSpans(1, 0, totalDuration, 0);
    // 2 周目: ループの区間の発動があるキャラだけ（記録が 1 周目の終わりを過ぎている）
    const lap2 = hasLoop && pts.some(([t]) => t >= totalDuration - 1e-6) ? lapSpans(2, totalDuration, totalDuration + loopPeriod, loopStartTime - totalDuration) : [];
    [...lap1, ...lap2].forEach((s, i) => out.push({ ...s, id: `stock_${log.charId}_${s.lap}_${i}` }));
  }
  return out;
}

/** CT を持つ1回の発動 */
interface CooldownEvent {
  /** CT の共有単位（キャラ + スキル / 爆発 / 発動バフ） */
  key: string;
  /** 1周目の時間軸での発動時刻 */
  time: number;
  /** 発動時刻から CT の開始までの秒数（CT開始位置。発動バフは 0） */
  ctOffset: number;
  /** この発動が開始する CT（0 なら CT を開始しない） */
  cooldown: number;
  /** CT 中の発動を違反として扱うか（祭礼リセットなど CT 中でも撃てるものは false） */
  checked: boolean;
  /** この枠のチャージ数（同時に溜められる回数。無ければ 1）。どのチャージもCT中なら違反 */
  charges?: number;
  /** 祭礼の武器: スキルのダメージが敵に当たる時刻の判定（確率 100%）。使用者が場にいて、スキルが CT 中で、武器の内部 CT が明けていれば、スキルの先頭の CT を捨てる */
  sacrificial?: { icdSeconds: number; hitFrame: number };
  /** true のとき、回数が 1 でも CT のキューで持つ（CT を後から短縮されるスキル。閑雲。バーの終わりが短縮で動く） */
  forceQueue?: boolean;
  /** true のとき、この発動が全回数分のCTをキューに積む（1 つ目はこの時刻から、2 つ目は 1 つ目が明けてから。検査はしない。ファルカのスキルが特殊スキルのCTを開始する）。この枠は、短縮が先頭だけに効く */
  startsAll?: boolean;
  /** この発動のアクション ID（特殊スキルの CT のバーが、どの発動の分かを示す） */
  actionId?: string;
  /** startsAll の発動の受付（疾風怒濤）。有効な終わりより後に始まる待機中の CT は積まない */
  window?: { until: number; effectiveEnd?: number };
  /** true のとき、特殊スキルの CT が空いていれば 1 回分使い、空いていなければ何もしない（ファルカの受付の間の重撃 = 特殊重撃「蒼牙」） */
  optional?: boolean;
  /** 0 より大きいとき、この発動は CT を始めず、CT 中のチャージの CT を、この秒数だけ短縮する（ファルカの通常攻撃） */
  reduceBy?: number;
  /** 設置物（八重神子の殺生桜）を 1 つ出す発動。寿命（秒）と上限。上限を超えると最古が消える */
  spawnsTotem?: { max: number; delay: number; lifetime: number };
  /** 爆発: 場の設置物 1 つにつき、この枠（スキル）の先頭の CT を解放する（八重神子）。revelation が false なら、爆発のあと設置物が全部壊れる。検査はしない */
  releasesPerTotem?: { revelation: boolean };
  /** 夜魂値（ヴァレサ）。skill = スキル（無料のスキルなら、回数も CT も使わない）、plunge = 落下攻撃、burst = 爆発 */
  nightsoul?: { role: 'skill' | 'plunge' | 'burst'; gain: number; max: number; blessingSeconds: number };
  stintIndex: number;
  name: string;
  /** 違反時: remaining = 残り CT 秒、cycle = 何周目の発動で違反したか（0 = 1周目） */
  onViolation: (remaining: number, cycle: number) => void;
}

const CT_TOLERANCE_SEC = 0.05;

/** バフ数が変わる時刻（各バフの開始・終了）で区切り、区間ごとに数える（同じ buffId は1つ） */
function buildBuffOverlapSegments(buffs: ActiveBuffSpan[], totalDuration: number): BuffOverlapSegment[] {
  const cuts = [...new Set([0, totalDuration, ...buffs.flatMap(b => [b.startTime, b.endTime])])]
    .filter(t => t >= 0 && t <= totalDuration)
    .sort((a, b) => a - b);
  const segments: BuffOverlapSegment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i];
    const end = cuts[i + 1];
    if (end - start < 0.001) continue;
    const { count, names } = countDistinctActiveBuffs(buffs, (start + end) / 2);
    const prev = segments[segments.length - 1];
    if (prev && prev.count === count && prev.activeBuffs.join() === names.join()) prev.end = end;
    else segments.push({ start, end, count, activeBuffs: names });
  }
  return segments;
}

/**
 * 殺生桜（行を持つバー）の 2 周目折り返し。1 周目の終わりに残る桜を初期状態にして、ループの区間の桜の設置・爆発を時刻順に流す（2 周目の動きの再現）。
 *   - 置き換えられた（最古として押し出された）持ち越しの桜は、その時刻で切る。置き換えた新しい桜のバーの行を、持ち越しバーの行にする（同じ行で、持ち越しが終わる時刻 = 新しいバーが始まる時刻）
 *   - 爆発で壊れた桜（論示未達成）は、その時刻で切る
 *   - 置き換えられずに寿命で終わる桜は、1 周目のバーが使っていない行に置く（全部埋まるときは、元の行）
 */
function wrapTotems(
  bars: ActiveBuffSpan[],
  totalDuration: number,
  loopStartTime: number,
  lifetimes: Map<ActiveBuffSpan, number>,
  maxByBuff: Map<string, number>,
  burstsByChar: Map<string, Array<{ time: number; destroy: boolean }>>,
): ActiveBuffSpan[] {
  const out: ActiveBuffSpan[] = [];
  if (totalDuration - loopStartTime <= 0.05) return out;
  const byBuff = new Map<string, ActiveBuffSpan[]>();
  for (const b of bars) byBuff.set(b.buffId, [...(byBuff.get(b.buffId) ?? []), b]);
  for (const [buffId, group] of byBuff) {
    const max = maxByBuff.get(buffId) ?? 3;
    type Tag = { carry?: ActiveBuffSpan };
    // 持ち越し: 1 周目の終わりより後まで残る桜（開始が 1 周目の終わり以降の設置を含む）
    const carried = group.filter(b => b.endTime > totalDuration + 0.02).sort((a, b) => a.startTime - b.startTime).map(b => {
      const start = b.startTime >= totalDuration ? loopStartTime + (b.startTime - totalDuration) : loopStartTime;
      const fullEnd = loopStartTime + (b.endTime - totalDuration);
      const carry: ActiveBuffSpan = {
        ...b,
        id: `wrap_buff_${b.id}`,
        startTime: Number(start.toFixed(3)),
        endTime: Number(Math.min(totalDuration, fullEnd).toFixed(3)),
        isCarryOver: true,
        originalStartTime: b.startTime,
        sourceId: b.id,
      };
      carry.duration = Number((carry.endTime - carry.startTime).toFixed(3));
      return { src: b, carry, fullEnd };
    });
    // ループの区間の設置（2 周目にも同じ時刻に起きる）と、爆発
    const spawns = group.filter(b => b.startTime >= loopStartTime - 1e-6 && b.startTime < totalDuration).sort((a, b) => a.startTime - b.startTime);
    const charId = group[0].sourceCharacterId;
    const bursts = (burstsByChar.get(charId) ?? []).filter(x => x.time >= loopStartTime - 1e-6 && x.time < totalDuration);
    type Ev = { t: number; order: number; kind: 'carry' | 'spawn' | 'burst'; i: number };
    const events: Ev[] = [
      ...carried.map((c, i): Ev => ({ t: c.carry.startTime, order: 0, kind: 'carry', i })),
      ...spawns.map((s, i): Ev => ({ t: s.startTime, order: 1, kind: 'spawn', i })),
      ...bursts.map((x, i): Ev => ({ t: x.time, order: 1, kind: 'burst', i })),
    ].sort((a, b) => a.t - b.t || a.order - b.order);
    const tracker = new TotemTracker<Tag>();
    const assigned = new Set<ActiveBuffSpan>();
    for (const ev of events) {
      if (ev.kind === 'carry') {
        const c = carried[ev.i];
        tracker.spawn(ev.t, c.fullEnd - ev.t, max, { carry: c.carry }, c.src.lane);
      } else if (ev.kind === 'spawn') {
        const s = spawns[ev.i];
        const { popped } = tracker.spawn(ev.t, lifetimes.get(s) ?? s.duration, max, {});
        const cb = popped?.tag.carry;
        if (cb) {
          cb.endTime = Number(Math.max(cb.startTime, Math.min(cb.endTime, popped!.end)).toFixed(3));
          cb.lane = s.lane;
          assigned.add(cb);
        }
      } else {
        for (const x of tracker.burst(ev.t, bursts[ev.i].destroy)) {
          const cb = x.tag.carry;
          if (cb) cb.endTime = Number(Math.max(cb.startTime, Math.min(cb.endTime, x.end)).toFixed(3));
        }
      }
    }
    // 置き換えられずに終わる桜: 1 周目のバーが使っていない行へ
    const placed: ActiveBuffSpan[] = [];
    for (const c of carried) {
      c.carry.duration = Number((c.carry.endTime - c.carry.startTime).toFixed(3));
      if (c.carry.duration <= 0.02) continue;
      if (!assigned.has(c.carry)) {
        const busy = new Set<number>();
        for (const o of [...group, ...placed]) {
          if (o !== c.src && o.lane !== undefined && o.startTime < c.carry.endTime - 1e-6 && Math.min(o.endTime, totalDuration) > c.carry.startTime + 1e-6) busy.add(o.lane);
        }
        let lane = 0;
        while (lane < max && busy.has(lane)) lane++;
        if (lane < max) c.carry.lane = lane;
      }
      placed.push(c.carry);
    }
    out.push(...placed);
  }
  return out;
}

function endAtNextStart<T extends { startTime: number; endTime: number }>(spans: T[], effectKey: (s: T) => string): void {
  const byKey = new Map<string, T[]>();
  for (const s of spans) byKey.set(effectKey(s), [...(byKey.get(effectKey(s)) ?? []), s]);
  for (const list of byKey.values()) {
    list.sort((a, b) => a.startTime - b.startTime);
    list.forEach((s, i) => {
      const next = list[i + 1];
      if (next && next.startTime < s.endTime) s.endTime = next.startTime;
    });
  }
}

/**
 * CT違反をまとめて判定する（1周目と2周目を1本の時間軸に並べ、同じ CT を共有する発動を時刻順に見ていく）。
 * - ループ区間（loopStartIndex 番目以降の出場）の発動は、1周目と、loopPeriod ずらした2周目に並べる
 * - 初動部分（ループ区間より前）の発動は1回だけ
 * 3周目以降は、各発動の直前にある同じ CT の発動が2周目と同じ（1周前の同じ位置）になるため、2周分の判定で足りる。
 * どちらの周で違反しても、元の発動に違反の印を付ける。
 */
function checkCooldownViolations(events: CooldownEvent[], loopStartIndex: number, loopPeriod: number, isActiveAt: (charId: string, t: number) => boolean, procsOut?: SacrificialProc[], stockOut?: StockLog[]): CooldownSpan[] {
  const extraCycles = loopPeriod > 0.05 ? 1 : 0;

  const timeline: Array<{ event: CooldownEvent; time: number; cycle: number; order: number }> = [];
  events.forEach((event, order) => {
    const repeats = event.stintIndex >= loopStartIndex ? extraCycles : 0;
    for (let cycle = 0; cycle <= repeats; cycle++) {
      timeline.push({ event, time: event.time + cycle * loopPeriod, cycle, order });
    }
  });
  timeline.sort((a, b) => a.time - b.time || a.order - b.order);

  // CT枠ごとの、チャージごとの CT の終わり（チャージが 1 つの枠は、要素 1 つ）。チャージは順番に回復する（gcsim の cooldown_queue）
  // ファルカの特殊スキル（startsAll の発動を見た枠）は、gcsim と同じキュー（CooldownQueue）で持つ
  interface QueueTag { actionId: string; cycle: number }
  const queues = new Map<string, CooldownQueue<QueueTag>>();
  // 八重神子の殺生桜（枠のキー → 消える時刻の一覧）、ヴァレサの夜魂値（キャラ ID → 状態）
  const totems = new Map<string, TotemTracker>();
  // 祭礼の武器の内部 CT が明ける時刻（キャラ ID → 時刻）
  const sacrificialIcdUntil = new Map<string, number>();
  const nightsouls = new Map<string, NightsoulTracker>();
  // キューで CT が始まった（先頭になった）1 周目の発動の分は、その時点でバーを作る。終わりは、後の短縮で動くので、最後に確定する
  const queuedSpans: Array<{ span: CooldownSpan; head: QueueHead<QueueTag> }> = [];
  const stockLogs = new Map<string, StockLog>();
  const cooldownEnd = new Map<string, number[]>();
  // CT のキューを作る。キューで CT が始まった時点に、バー（1 周目の分だけ）を作る。バーの種類は、枠のキー（`キャラ:special` / `キャラ:skill`）で決まる
  const makeQueue = (ev: CooldownEvent, charges: number) => {
    // 回数が 2 以上の通常のスキルは、ストック数の変化（積まれている CT の数）を記録する
    const [stockCharId, stockKind] = ev.key.split(':');
    let log: StockLog | undefined;
    if (stockOut && stockKind === 'skill' && charges > 1) {
      log = { charId: stockCharId, max: charges, points: [] };
      stockOut.push(log);
      stockLogs.set(ev.key, log);
    }
    return new CooldownQueue<QueueTag>(charges, startedHead => onQueueStart(ev, startedHead), 0.001, log ? (t, size) => log!.points.push([t, size]) : undefined);
  };
  const onQueueStart = (ev: CooldownEvent, head: QueueHead<QueueTag>) => {
    if (!head.tag || head.tag.cycle !== 0) return;
    const [barCharId, kind] = ev.key.split(':');
    const type = kind === 'special' ? 'special' : 'skill';
    const span: CooldownSpan = {
      id: `cd_${type}_${barCharId}_${head.tag.actionId}_${queuedSpans.length}`,
      characterId: barCharId,
      type,
      startTime: head.start,
      endTime: head.end,
      duration: head.end - head.start,
      baseDuration: head.end - head.start,
      actionInstanceId: head.tag.actionId,
    };
    queuedSpans.push({ span, head });
  };
  for (const item of timeline) {
    const slots = cooldownEnd.get(item.event.key) ?? [];
    const charges = Math.max(1, item.event.charges ?? 1);
    while (slots.length < charges) slots.push(-Infinity);
    cooldownEnd.set(item.event.key, slots);
    const ev = item.event;
    let queue = queues.get(item.event.key);
    queue?.advance(item.time);
    const charId = ev.key.split(':')[0];
    // 祭礼の武器: スキルのダメージが当たった。使用者が場にいて、スキルが CT 中（先頭の CT がもう始まっている）で、武器の内部 CT が明けていれば、先頭の CT を捨てる（gcsim の ResetActionCooldown）。
    // スキルを使った時点で CT は積んであるが、CT が始まるのは少し後（CT 開始位置）。始まる前の命中では、gcsim の Cooldown が 0 なので、発動しない
    if (ev.sacrificial) {
      if (queue?.head && item.time >= queue.head.start - 1e-6 && isActiveAt(charId, ev.time) && item.time >= (sacrificialIcdUntil.get(charId) ?? -Infinity) - 1e-9) {
        queue.release(item.time);
        sacrificialIcdUntil.set(charId, item.time + ev.sacrificial.icdSeconds);
        procsOut?.push({ charId, actionId: ev.actionId ?? '', hitFrame: ev.sacrificial.hitFrame, cycle: item.cycle, time: Number(item.time.toFixed(3)), icdSeconds: ev.sacrificial.icdSeconds });
      }
      continue;
    }
    // 夜魂値（ヴァレサ）: 落下攻撃・爆発（nightsoulTracker.ts）。猛烈パッション中の落下攻撃は夜魂を使い切って終わる。満タンなら猛烈パッションに入り、次のスキルが無料になる
    if (ev.nightsoul && ev.nightsoul.role !== 'skill') {
      const tracker = nightsouls.get(charId) ?? new NightsoulTracker();
      nightsouls.set(charId, tracker);
      if (ev.nightsoul.role === 'plunge') tracker.plunge(item.time, ev.nightsoul.gain, ev.nightsoul.max, ev.nightsoul.blessingSeconds);
      else tracker.burst(item.time, ev.nightsoul.gain, ev.nightsoul.max, ev.nightsoul.blessingSeconds);
      continue;
    }
    // 八重神子の爆発: 場の殺生桜 1 つにつき、スキルの先頭の CT を解放する
    if (ev.releasesPerTotem) {
      const present = totems.get(ev.key)?.burst(item.time, !ev.releasesPerTotem.revelation) ?? [];
      for (let i = 0; i < present.length; i++) queue?.release(item.time);
      continue;
    }
    // 八重神子のスキル: 殺生桜が 1 つ増える（上限を超えたら最古が消える）
    if (ev.spawnsTotem) {
      const tracker = totems.get(ev.key) ?? new TotemTracker();
      totems.set(ev.key, tracker);
      tracker.spawn(item.time + ev.spawnsTotem.delay, ev.spawnsTotem.lifetime, ev.spawnsTotem.max, undefined);
    }
    // ヴァレサのスキル: 夜魂 +20。猛烈パッション中の最初のスキルは無料（回数も CT も使わない）
    if (ev.nightsoul?.role === 'skill') {
      const tracker = nightsouls.get(charId) ?? new NightsoulTracker();
      nightsouls.set(charId, tracker);
      if (tracker.useSkill(item.time, ev.nightsoul.gain, ev.nightsoul.max)) continue;
    }
    if (ev.reduceBy && ev.reduceBy > 0) {
      if (queue) {
        queue.reduce(item.time, ev.reduceBy);
      } else {
        // キュー方式: CT 中のものの終わりを、短縮する（後ろの回の CT も同じだけ早まる）
        for (let i = 0; i < slots.length; i++) if (slots[i] > item.time) slots[i] = Math.max(item.time, slots[i] - ev.reduceBy);
      }
      continue;
    }
    const startAt = item.time + ev.ctOffset;
    if (ev.startsAll) {
      // スキルを使うと、全回数分の CT が積まれる（1 つ目はスキルの時刻から、2 つ目以降は前の CT が明けてから）。それまでの CT は捨てる
      const q = queue ?? makeQueue(ev, charges);
      const tag: QueueTag = { actionId: ev.actionId ?? '', cycle: item.cycle };
      q.reset(startAt, ev.cooldown > 0 ? Array.from({ length: charges }, () => ({ duration: ev.cooldown, tag })) : [], ev.window ? ev.window.effectiveEnd ?? ev.window.until : Infinity);
      queues.set(item.event.key, q);
      continue;
    }
    // 複数回分の通常のスキル（クレー・魈・八重神子など）も、gcsim と同じキューで持つ
    if (!queue && (charges > 1 || ev.forceQueue) && !ev.optional && ev.cooldown > 0) {
      queue = makeQueue(ev, charges);
      queues.set(item.event.key, queue);
    }
    if (queue) {
      if (ev.optional) {
        // 受付の間の重撃: 回数に空きがあれば特殊重撃になって 1 回分使う。空いていなければ普通の重撃（違反ではない）
        if (!queue.hasFree) continue;
      } else if (ev.checked && !queue.hasFree && queue.head) {
        ev.onViolation(Number((queue.head.end - item.time).toFixed(1)), item.cycle);
      }
      // 使うと、新しい CT がキューの末尾に積まれる（キューが空なら、すぐ始まる）
      queue.push(startAt, ev.cooldown, { actionId: ev.actionId ?? '', cycle: item.cycle });
      stockLogs.get(item.event.key)?.points.push([item.time, queue.size]);
      continue;
    }
    // キューの無い枠（スキルより前など）の、受付の間の重撃は、何もしない
    if (ev.optional) continue;
    // 一番早く明けるチャージを使う。どのチャージも CT 中なら違反
    let idx = 0;
    for (let i = 1; i < slots.length; i++) if (slots[i] < slots[idx]) idx = i;
    if (ev.checked && slots[idx] > item.time + CT_TOLERANCE_SEC) {
      ev.onViolation(Number((slots[idx] - item.time).toFixed(1)), item.cycle);
    }
    if (ev.cooldown > 0) {
      // 回復の開始 = 使った時刻と、他のチャージの回復の終わり（キューの末尾）の遅いほう
      const tail = slots.reduce((m, e, i) => (i !== idx && e > item.time ? Math.max(m, e) : m), -Infinity);
      slots[idx] = Math.max(startAt, tail) + ev.cooldown;
    }
  }

  // 待機中のまま残った CT を、始まる位置まで進めてから、バーの位置を確定する
  for (const q of queues.values()) q.drain();
  // 解放（八重神子の爆発）で、始まった直後に捨てられた CT（長さ 0）のバーは出さない
  return queuedSpans.filter(({ head }) => head.end - head.start > 0.001).map(({ span, head }) => ({
    ...span,
    startTime: Number(head.start.toFixed(3)),
    endTime: Number(head.end.toFixed(3)),
    duration: Number((head.end - head.start).toFixed(3)),
  }));
}
