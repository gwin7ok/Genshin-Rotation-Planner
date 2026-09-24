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

export interface ActionDefinition {
  id: string;
  name: string;
  shortName: string;       // 記法・ガントチャートブロックに表示する略称 (例: E, Q, N1, CA)
  buttonLabel?: string;    // アクション構築エリアの追加ボタン等に表示するボタンラベル名 (未指定時は shortName)
  type: ActionType;
  defaultDuration: number; // in seconds
  description?: string;
  particlesGenerated?: number;
  energyCost?: number;
  triggersBuffIds?: string[];
  startsSkillCooldown?: boolean;
  startsBurstCooldown?: boolean;
  cooldown?: number;        // 各アクション固有のCT (秒)
  effectDuration?: number;  // 各アクション固有の効果持続時間 (秒)
  skillCooldown?: number;   // アクション固有のスキルCT (秒)
  skillDuration?: number;   // アクション固有のスキル効果/バフ継続時間 (秒)
  burstCooldown?: number;   // アクション固有の爆発CT (秒)
  burstDuration?: number;   // アクション固有の爆発効果/エリア継続時間 (秒)
  customSkillCT?: number;   // (互換用エイリアス)
  startupFrames?: number; // 60fps startup/hitmark frames
  totalFrames?: number;   // 60fps total frames
  cancelableFrames?: {
    dash?: number;
    jump?: number;
    swap?: number;
  };
}

export interface CharacterActionInstance {
  id: string; // unique instance ID
  actionTypeId: string; // reference to predefined or custom action
  name: string;
  shortName: string;
  type: ActionType;
  duration: number; // in seconds (e.g. 0.8s)
  note?: string;
  // Computed at runtime:
  startTime?: number;
  endTime?: number;
}

export interface Stint {
  id: string;
  characterId: string;
  actions: CharacterActionInstance[];
  note?: string;
  // Computed at runtime:
  startTime?: number;
  endTime?: number;
  duration?: number;
}

export interface CharacterFrameInfo {
  startupFrames?: number;
  totalFrames?: number;
  cancelableFrames?: {
    dash?: number;
    jump?: number;
    swap?: number;
  };
}

export interface CharacterConfig {
  id: string;
  name: string;
  element: ElementType;
  weaponType: WeaponType;
  avatarUrl: string;
  color: string;
  accentColor: string;
  
  // Kit parameters:
  skillCooldown: number;  // seconds (スキルCT)
  skillDuration?: number; // seconds (スキル効果継続時間)
  burstCooldown: number;  // seconds (爆発CT)
  burstDuration?: number; // seconds (爆発効果継続時間)
  burstEnergyCost: number; // 元素エネルギー
  skillParticles: number;

  // Motion Frame Data (from gcsim)
  frameData?: Record<string, CharacterFrameInfo>;
  
  // Custom user settings in party:
  energyRecharge: number; // % e.g. 180 = 180%
  weaponName?: string;
  artifactSetName?: string;
  constellation?: number;
  
  // Common action presets for this character:
  availableActions: ActionDefinition[];
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

export interface EnergyHistoryPoint {
  time: number;
  energy: number;
  eventDescription?: string;
}

export interface CharacterRuntimeState {
  characterId: string;
  totalActiveTime: number;
  stints: Stint[];
  skillCooldowns: CooldownSpan[];
  burstCooldowns: CooldownSpan[];
  energyPoints: EnergyHistoryPoint[];
  finalEnergy: number;
  energySufficiency: boolean;
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
  loopStartTime?: number;
  totalDuration?: number;
  switchDelay?: number;
  actionDelay?: number;
}

