import { CharacterConfig, WeaponType } from './genshin';

/** 武器・聖遺物の発動バフ定義 */
export interface EquipmentBuffDefinition {
  id: string;                      // 例: "wbuff_freedom_sworn", "abuff_noblesse_4p"
  name: string;                    // 表示名 例: "蒼古: 抗争の歌" / "旧貴族4: 全員攻撃力+20%"
  sourceType: 'weapon' | 'artifact';
  sourceId: string;                // 武器ID または 聖遺物ID
  duration?: number;               // 効果継続時間 (秒) 例: 12.0
  cooldown?: number;               // クールタイム (秒) 例: 20.0
  description: string;             // バフの元となった効果説明文
  color?: string;                  // ガントチャート描画色
  statEffectSummary?: string;      // ツールチップ要約 例: "全員攻撃+20% / 通常重撃ダメ+16%"
  dataSource?: {
    duration?: string;             // 抽出元の文言 例: "12秒間"
    cooldown?: string;             // 抽出元の文言 例: "20秒に1回"
  };
}

export interface WeaponDatabaseItem {
  id: string;
  name: string;
  englishName?: string;
  weaponType: WeaponType;
  rarity: number; // 1 | 2 | 3 | 4 | 5
  passiveName: string;
  description: string;
  baseAttack?: number;
  avatarUrl?: string;
  buffEffects?: EquipmentBuffDefinition[];
  // 旧形式互換用
  buffEffect?: {
    id: string;
    name: string;
    duration: number; // in seconds
    cooldown?: number; // in seconds
    statEffect: string;
    description: string;
    color: string;
    snapshotable?: boolean;
  };
  isLocked?: boolean;
  isCustom?: boolean;
  updatedAt?: string;
}

export type WeaponMasterItem = WeaponDatabaseItem;

export interface ArtifactSetDatabaseItem {
  id: string;
  name: string;
  englishName?: string;
  rarity: number; // 1 | 2 | 3 | 4 | 5 (代表レアリティ、基本は最大値)
  rarityList?: number[];
  avatarUrl?: string;
  effect2p: string;
  effect4p: string;
  buffEffects?: EquipmentBuffDefinition[];
  // 旧形式互換用
  buffEffect?: {
    id: string;
    name: string;
    duration: number; // in seconds
    cooldown?: number; // in seconds
    statEffect: string;
    description: string;
    color: string;
    snapshotable?: boolean;
  };
  isLocked?: boolean;
  isCustom?: boolean;
  updatedAt?: string;
}

export type ArtifactSetMasterItem = ArtifactSetDatabaseItem;

export interface AppDatabase {
  version: number;
  lastSyncedAt: string;
  characters: CharacterConfig[];
  weapons: WeaponDatabaseItem[];
  artifacts: ArtifactSetDatabaseItem[];
}

export type GenshinDatabase = AppDatabase;

