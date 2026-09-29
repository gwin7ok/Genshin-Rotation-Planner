/**
 * Types for Genshin Impact Rotation Gantt Chart Planner
 */

export type ElementType = 'pyro' | 'hydro' | 'electro' | 'dendro' | 'cryo' | 'anemo' | 'geo' | 'physical';

export type WeaponType = 'sword' | 'claymore' | 'polearm' | 'bow' | 'catalyst';

export type ArtifactSetMode = '4pc' | '2+2';

export type ActionType = 
  | 'normal'     // N（連続した N の段は計算時に自動で数える）
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

/**
 * CTの開始位置（D37 / D44）。動作開始からの位置か、長押し終了からの位置か。
 * スキルと爆発で同じ形。delay は秒（gcsim の SetCD / SetCDWithDelay の遅れフレームを 60fps で換算）。
 */
export interface CooldownStart {
  from: 'motionStart' | 'holdEnd';
  delay: number;
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
  cooldown?: number;        // このアクションが開始するCT (秒)。ホールドで長さが変わるものは、ホールド 0 のときの値
  /** CTの開始位置（マスターから自動設定。未設定は「動作開始と同時」として扱う） */
  cooldownStart?: CooldownStart;
  /** 長押し 1 秒あたりの CT の増分（秒）。CT の長さ = cooldown + cooldownPerHold × ホールド秒数（早柚・綺良々） */
  cooldownPerHold?: number;
  effectDuration?: number;  // このアクションの効果持続時間 (秒)
  frames?: ActionFrames;    // gcsim モーションフレーム
  /**
   * 通常攻撃（type: 'normal'）の段ごとの値（1段目から順）。ボタンは「N」1つで、連続した N の何段目かは計算時に自動で決める（gcsim と同じ）。
   * duration は「次の通常攻撃へのキャンセル」までの秒数（最終段は全体）。
   */
  normalHits?: { duration: number; frames?: ActionFrames }[];
  /** 各値の出典 (genshin-db のラベル名など) */
  dataSource?: {
    cooldown?: string;
    effectDuration?: string;
    /** CT開始位置の出典（例: "skill.go:skillPressCDStart" / "manual: ..."） */
    cooldownStart?: string;
  };
}

export interface CharacterActionInstance {
  id: string; // unique instance ID
  actionTypeId: string; // reference to predefined or custom action
  name: string;
  shortName: string;
  type: ActionType;
  duration: number; // in seconds (e.g. 0.8s)
  /** true のとき duration はユーザーの編集値（または gcsim の結果）。未指定の通常攻撃は、連続した N の段ごとの値を自動で使う */
  durationManual?: boolean;
  /** このアクションが開始するCT (秒)。ユーザーが個別に変更した場合のみ保持し、未指定ならアクション定義の cooldown を使う */
  cooldown?: number;
  /** このアクションの効果継続時間 (秒)。ユーザーが個別に変更した場合のみ保持し、未指定ならアクション定義の effectDuration を使う */
  effectDuration?: number;
  /** このアクションの終了後、次のアクション（出場の最後なら次の交代）を遅らせる秒数。未設定は既定値 0.10 秒 */
  delayAfter?: number;
  note?: string;
  // Computed at runtime:
  startTime?: number;
  endTime?: number;
  /** アクション状態の窓の中の E（CT・効果バーを持たない）。計算時にだけ付く */
  inStateWindow?: boolean;
  /** CT未回復（CT衝突）フラグ */
  hasCTCollision?: boolean;
  /** CT衝突時の残り秒数 */
  collisionRemainingCT?: number;
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

export type ConstellationLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** 命ノ星座の1段階（マスターデータ） */
export interface CharacterConstellationData {
  level: ConstellationLevel;
  name: string;
  description: string;
  /** この段階で変わるアクションの値（今は効果継続時間の延長のみ） */
  actionChanges?: ConstellationActionChange[];
}

export interface ConstellationActionChange {
  /** 変わるアクションの定義 ID（例: "10000023-pyro_q"） */
  actionId: string;
  /** 変更後の効果継続時間（秒） */
  effectDuration?: number;
  /** 根拠の説明文の抜粋 */
  source?: string;
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
  /** CT衝突時の残り秒数 */
  collisionRemainingCT?: number;
  /** 2周目折り返し持ち越しフラグ */
  isCarryOver?: boolean;
  /** 持ち越しバーの元の発動時刻 */
  originalStartTime?: number;
  /** 持ち越しバーの元の本体のID */
  sourceId?: string;
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

/**
 * 編成の1枠（保存データ）。キャラは DB の ID で参照し、編成ごとの設定だけを持つ。
 * キャラのデータは表示・計算のたびに DB から引く（resolvePartyCharacters）。
 */
export interface PartyMember {
  /** DB のキャラ ID（未設定枠は empty_slot_<n>） */
  characterId: string;
  /** 凸数（0〜6。未指定時は星4=6/星5=0） */
  constellation?: number;
  /** 装備武器（DB の武器 id） */
  weaponId?: string;
  /** 精錬ランク (1〜5, 未指定時は星5=1/星4以下=5) */
  weaponRefinementRank?: number;
  /** 装備聖遺物セット（DB の聖遺物セット id） */
  artifactSetId?: string;
  /** 聖遺物の組み合わせ。'2+2' は聖遺物の発動バフなし（未指定は '4pc'） */
  artifactSetMode?: ArtifactSetMode;
  /** 元素チャージ効率 (% e.g. 180 = 180%) */
  energyRecharge?: number;
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

  // 編成ごとの設定（PartyMember から解決して入る。DB のキャラ自身は持たない）:
  energyRecharge?: number; // % e.g. 180 = 180%
  /** 装備武器（DB の武器 id） */
  weaponId?: string;
  weaponRefinementRank?: number; // 精錬ランク (1〜5, 未指定時は星5=1/星4以下=5)
  /** 装備聖遺物セット（DB の聖遺物セット id） */
  artifactSetId?: string;
  /** 聖遺物の組み合わせ。'2+2' は聖遺物の発動バフなし（未指定は '4pc'） */
  artifactSetMode?: ArtifactSetMode;
  /** 凸数（0〜6。未指定時は星4=6/星5=0） */
  constellation?: number;

  // Common action presets for this character (CT・効果継続時間・フレームはアクションごとに保持):
  availableActions: ActionDefinition[];
  /** 固有天賦の効果（発動バフとして出場ブロックに登録できる） */
  passiveEffects?: PassiveEffectDefinition[];
  /** 命ノ星座（1〜6凸）の段階データ。凸数以下の段階を累積で適用する */
  constellations?: CharacterConstellationData[];

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
  /** 2周目折り返し持ち越しフラグ */
  isCarryOver?: boolean;
  /** 持ち越しバーの元の発動時刻 */
  originalStartTime?: number;
  /** 持ち越しバーの元の本体のID */
  sourceId?: string;
}

export interface CooldownSpan {
  id: string;
  characterId: string;
  type: 'skill' | 'burst';
  startTime: number;
  endTime: number;
  duration: number;
  actionInstanceId: string;
  /** 2周目折り返し持ち越しフラグ */
  isCarryOver?: boolean;
  originalStartTime?: number;
  originalEndTime?: number;
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

export interface SavedRotationSlot {
  id: string;
  name: string;
  description?: string;
  updatedAt: string; // ISO string
  /** 編成（キャラの ID と編成ごとの設定） */
  party: PartyMember[];
  stints: Stint[];
  /** 2周目ループの開始位置（何番目の出場キャラの前か。0始まり、0=基準なし） */
  loopStartIndex?: number;
  /** 旧形式のループ基準（秒）。読込時に loopStartIndex へ変換する。保存時は参考値として併記 */
  loopStartTime?: number;
  totalDuration?: number;
  switchDelay?: number;
}

