import { CharacterConfig, Stint, CharacterActionInstance } from '../../types/genshin';
import type { ActionDefinition, ActionFrames, ActionMode, CooldownStart, ModeEnder } from '../../types/genshin';
import { type ModeWindow } from './types';

/**
 * calculateRotation の、出場ごと・アクションごとの作業の入れ物。
 * 段階ごとの関数（modePhases.ts など）が、これと RotationState を受け取って、読む・更新する。
 *   StintContext … 1 つの出場の間、変わらない値（キャラ・アクション定義・特殊スキルの受付）と、出場の間に更新する値
 *   ActionContext … 1 つのアクションの計算の間、段階から次の段階へ渡す値
 */
export interface StintContext {
  rawStint: Stint;
  char: CharacterConfig;
  charActions: ActionDefinition[];
  burstModeAction: ActionDefinition;
  /** 爆発の後のモードに、固有の項目（パンチ・蹴り・炎場の拾い）を持つキャラ（ディシア）の定義 */
  burstModeDef: ActionDefinition['burstMode'];
  /** この出場で計算済みのアクション（先頭は交代のアクション） */
  computedActions: CharacterActionInstance[];
  /** スキルの CT が、マスターの値から何倍に変わっているか（gcsim の書き戻し）。特殊スキルの CT にも同じ割合を掛ける */
  specialCdScale: number;
  /** 特殊スキル・特殊爆発の受付（モードの定義の special。D78）: この出場で、種類ごとに最後に開いた受付（交代で消える） */
  specialModes: { skill?: ModeWindow; burst?: ModeWindow };
  /** この出場で開いた受付（新しい受付に置き換わったものも含む）。出場の終わりで、CT の待機の終わり（ctWindow）を決める */
  stintSpecialModes: ModeWindow[];
  specialOpenAt: (kind: "skill" | "burst", t: number) => boolean;
  windowOpenAt: (t: number) => boolean;
  extendSpecial: (m: ModeWindow, seconds: number) => void;
  closeSpecial: (m: ModeWindow, t: number, by?: string) => void;
  specialConditionOk: (md: ActionMode, t: number) => boolean;
  /** 連続した通常攻撃の段（gcsim と同じく、他のアクションを挟むと1段目に戻る） */
  normalStreak: number;
  /** 直前のアクションが通常攻撃のとき、その開始時刻と全体のフレーム（通常攻撃速度の効果の判定用） */
  previousNormal: { start: number; total: number; cancel: number } | undefined;
  /** 計算前のアクション（交代のアクションを除く） */
  rawActions: CharacterActionInstance[];
  holdRemainingAt: (t: number) => number;
  sIdx: number;
  /** 並びの中に「維持」のアクション（D114）があるか */
  hasHoldAction: boolean;
  /** 入力がなければ、状態が切れた後の最初の自動のパンチの後に、蹴りが命中する時刻（ディシア。入力があるときは、最も遅い場合） */
  autoKickAt: (m: ModeWindow) => number;
  /** この出場の開始時刻 */
  stintStartTime: number;
}

export interface ActionContext {
  act: CharacterActionInstance;
  actionStartTime: number;
  actionDef: ActionDefinition;
  inStateWindow: boolean;
  modeEnder: { window: ModeWindow; ender: ModeEnder } | undefined;
  modeRepress: { window: ModeWindow; index: number } | undefined;
  repressGcsimCommand: string | undefined;
  stackDetonation: { window: ModeWindow; frames: ActionFrames } | undefined;
  mw: ModeWindow;
  modeKind: 'punch' | 'kick' | 'dash' | undefined;
  blockedMessage: string;
  opensMode: boolean;
  pendingCtWindow: { until: number; effectiveEnd?: number } | undefined;
  gaugeMessage: string | undefined;
  frames: ActionFrames;
  hitFallbackDuration: number | undefined;
  normalHitIndex: number;
  normalHitFrames: ActionFrames | undefined;
  modeHit: { key: string; index: number; window: ModeWindow } | undefined;
  repressHit: { key: string; index: number; frames: ActionFrames } | undefined;
  hitlagFrames: number;
  naturalDuration: number;
  duration: number;
  actionEndTime: number;
  cooldownStart: CooldownStart;
  holdSeconds: number | undefined;
  burstVariantMode: ModeWindow;
  computedAction: CharacterActionInstance;
  isSkill: boolean;
  writtenCooldown: number;
  cooldown: number;
  effectSeconds: number;
  ctOffset: number;
  ctStartTime: number;
  isSpecialBurst: boolean;
  aIdx: number;
}
