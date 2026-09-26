/**
 * Types for Genshin Impact Rotation Gantt Chart Planner
 */

export type ElementType = 'pyro' | 'hydro' | 'electro' | 'dendro' | 'cryo' | 'anemo' | 'geo' | 'physical';

export type WeaponType = 'sword' | 'claymore' | 'polearm' | 'bow' | 'catalyst';

export type ActionType = 
  | 'normal'     // N1, N2, etc.
  | 'combo'      // e.g. N3C, 3N3C
  | 'charged'    // CA / Aimed shot
  | 'plunge'     // PA
  | 'skill'      // E (tap)
  | 'skill_hold' // E (hold)
  | 'skill_reset'// Sacrificial E reset
  | 'burst'      // Q
  | 'dash'       // Dash cancel
  | 'jump'       // Jump cancel
  | 'swap'       // Explicit swap buffer
  | 'wait';      // Idle/wait

/** 次アクション種別 (gcsim の action.ActionXxx に対応) */
export type CancelTarget =
  | 'attack' | 'charge' | 'aim' | 'skill' | 'burst'
  | 'dash' | 'jump' | 'walk' | 'swap' | 'lowPlunge' | 'highPlunge';

/** gcsim 由来のモーションフレーム (60 FPS) */
export interface ActionFrames {
  /** 全体フレーム (AnimationLength) */
  total: number;
  /** ヒットマーク (攻撃判定の発生フレーム) */
  hitmark?: number;
  /** 次アクション種別ごとのキャンセル可能フレーム (total と異なるもののみ) */
  cancels: Partial<Record<CancelTarget, number>>;
  /** 抽出元 (例: "skill.go:skillPressFrames") */
  source: string;
}

export interface ActionDefinition {
  id: string;
  name: string;
  shortName: string;       // 記法・ガントチャートブロックに表示する略称 (例: E, Q, N1, CA)
  buttonLabel?: string;    // アクション構築エリアの追加ボタン等に表示するボタンラベル名 (未指定時は shortName)
  type: ActionType;
  defaultDuration: number; // in seconds
  description?: string;
  startsSkillCooldown?: boolean;
  startsBurstCooldown?: boolean;
  cooldown?: number;        // このアクションが開始するCT (秒)
  effectDuration?: number;  // このアクションの効果持続時間 (秒)
  frames?: ActionFrames;    // gcsim モーションフレーム
  /** 各値の出典 (genshin-db のラベル名など) */
  dataSource?: {
    cooldown?: string;
    effectDuration?: string;
  };
}

export interface CharacterActionInstance {
  id: string; // unique instance ID
  actionTypeId: string; // reference to predefined or custom action
  name: string;
  shortName: string;
  type: ActionType;
  duration: number; // in seconds (e.g. 0.8s)
  /** このアクションが開始するCT (秒)。ユーザーが個別に変更した場合のみ保持し、未指定ならアクション定義の cooldown を使う */
  cooldown?: number;
  /** このアクションの効果継続時間 (秒)。ユーザーが個別に変更した場合のみ保持し、未指定ならアクション定義の effectDuration を使う */
  effectDuration?: number;
  note?: string;
  // Computed at runtime:
  startTime?: number;
  endTime?: number;
}

/** 固有天賦の効果（マスターデータ）。発動位置はユーザーがアクション構築・ガントチャートで決める */
export interface PassiveEffectDefinition {
  id: string;
  /** 表示名（固有天賦名。効果が複数ある場合は「名前 (30秒)」） */
  name: string;
  talentName: string;
  talentSlot: 1 | 2;
  /** 効果継続時間（秒）。説明文から読み取れない場合は未設定 */
  duration?: number;
  /** クールタイム（秒）。説明文に「○秒毎に1回」があれば設定 */
  cooldown?: number;
  description?: string;
  dataSource?: { duration?: string; cooldown?: string };
}

/** 出場ブロックに登録した発動バフ（固有天賦） */
export interface PassiveTriggerInstance {
  id: string;
  passiveEffectId: string;
  name: string;
  /** 発動位置: 出場の先頭からの秒数（出場時間の範囲内） */
  offset: number;
  /** 個別に変更した継続時間・CT（未指定なら定義の値） */
  duration?: number;
  cooldown?: number;
}

/** 計算済みの発動バフ（効果・CT のバー） */
export interface PassiveSpan {
  id: string;
  triggerId: string;
  stintId: string;
  characterId: string;
  passiveEffectId: string;
  name: string;
  category?: 'talent' | 'weapon' | 'artifact';
  startTime: number;
  duration: number;
  endTime: number;
  cooldown: number;
  cooldownEnd: number;
  /** 同じ固有天賦・武器・聖遺物バフの CT 中に発動している */
  hasCTViolation?: boolean;
  color?: string;
  description?: string;
}

export interface Stint {
  id: string;
  characterId: string;
  actions: CharacterActionInstance[];
  /** 発動バフ（固有天賦）の登録 */
  passiveTriggers?: PassiveTriggerInstance[];
  note?: string;
  // Computed at runtime:
  startTime?: number;
  endTime?: number;
  duration?: number;
}

export interface CharacterConfig {
  id: string;
  name: string;
  englishName?: string;
  element: ElementType;
  weaponType: WeaponType;
  rarity?: number;
  avatarUrl: string;
  color: string;
  accentColor: string;

  // Custom user settings in party:
  energyRecharge?: number; // % e.g. 180 = 180%
  weaponName?: string;
  weaponRefinementRank?: number; // 精錬ランク (1〜5, 未指定時は星5=1/星4以下=5)
  artifactSetName?: string;
  constellation?: number;

  // Common action presets for this character (CT・効果継続時間・フレームはアクションごとに保持):
  availableActions: ActionDefinition[];
  /** 固有天賦の効果（発動バフとして出場ブロックに登録できる） */
  passiveEffects?: PassiveEffectDefinition[];

  /** ユーザーが DB 管理画面で作成・編集したキャラ */
  isCustom?: boolean;
  /** DB管理でロックしたキャラ。最新マスターデータの同期で上書きされず、全キャラ一括削除・全データクリアでも削除されない */
  isLocked?: boolean;
  updatedAt?: string;

  /** マスターデータの出典 */
  source?: {
    genshinId?: number;
    gcsimKey?: string;
  };
}

export interface BuffDefinition {
  id: string;
  name: string;
  sourceCharacterId?: string;
  sourceType: 'talent' | 'weapon' | 'artifact';
  duration: number; // in seconds
  description: string;
  color: string;
  iconName?: string;
  statsEffect?: string;
  snapshotable?: boolean;
}

export interface ActiveBuffSpan {
  id: string;
  buffId: string;
  name: string;
  sourceCharacterId: string;
  sourceType: 'talent' | 'weapon' | 'artifact';
  startTime: number;
  endTime: number;
  duration: number;
  color: string;
  description: string;
  isSnapshot?: boolean;
  /** 'passive' = 発動バフ（固有天賦）。ガントチャートでは専用の行に表示する */
  origin?: 'action' | 'passive';
}

export interface CooldownSpan {
  id: string;
  characterId: string;
  type: 'skill' | 'burst';
  startTime: number;
  endTime: number;
  duration: number;
  actionInstanceId: string;
}

export interface CharacterRuntimeState {
  characterId: string;
  totalActiveTime: number;
  stints: Stint[];
  skillCooldowns: CooldownSpan[];
  burstCooldowns: CooldownSpan[];
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  characterId?: string;
  stintId?: string;
  actionId?: string;
  time: number;
  title: string;
  message: string;
}

export interface PartyPreset {
  id: string;
  name: string;
  description: string;
  characters: CharacterConfig[];
  stints: Stint[];
  switchDelay?: number;
  actionDelay?: number;
}

export interface SavedRotationSlot {
  id: string;
  name: string;
  description?: string;
  updatedAt: string; // ISO string
  characters: CharacterConfig[];
  stints: Stint[];
  /** 2周目ループの開始位置（何番目の出場キャラの前か。0始まり、0=基準なし） */
  loopStartIndex?: number;
  /** 旧形式のループ基準（秒）。読込時に loopStartIndex へ変換する。保存時は参考値として併記 */
  loopStartTime?: number;
  totalDuration?: number;
  switchDelay?: number;
  actionDelay?: number;
}

