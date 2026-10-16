import { Stint, ActiveBuffSpan, CooldownSpan, StockSpan, ValidationIssue, CharacterRuntimeState, PassiveSpan, ActionDefinition, ActionMode } from '../../types/genshin';
import { GenshinDatabase } from '../../types/database';

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
  /** externalCtWaits のうち、原因がスタミナ不足だったアクション ID（表示の理由だけが変わる。D214） */
  externalStaminaWaitIds?: string[];
}

/** モード（スキル・爆発で入る状態）の窓。calculateRotation の計算中の状態（モードの開始・終わり・ゲージなど） */
export interface ModeWindow {
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
  /** 通常攻撃で溜まったスタック（def.nStacks のモードだけ） */
  stacks?: number;
  /** ゲージ（def.gauge のモードだけ）: 現在値と、時間で数え終えた回数 */
  gauge?: { value: number; ticks: number };
  /** モードの終わりを延ばした最後の時刻（命ノ星座の repressExtend。間隔の制限に使う） */
  lastExtendAt?: number;
  /** 減る値（def.drain のモードだけ）: 残り・乗っているか・最後に数えた時刻・次の消費の時刻（降りている間） */
  drain?: { points: number; riding: boolean; at: number; nextTick: number };
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
