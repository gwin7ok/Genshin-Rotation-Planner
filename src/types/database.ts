import { CharacterConfig, WeaponType, ElementType, BuffDefinition } from './genshin';

export interface WeaponDatabaseItem {
  id: string;
  name: string;
  weaponType: WeaponType;
  rarity: 3 | 4 | 5;
  passiveName: string;
  description: string;
  baseAttack?: number;
  subStat?: string;
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
  isCustom?: boolean;
  updatedAt?: string;
}

export interface ArtifactSetDatabaseItem {
  id: string;
  name: string;
  rarity: 4 | 5;
  effect2p: string;
  effect4p: string;
  buffEffect?: {
    id: string;
    name: string;
    duration: number; // in seconds
    statEffect: string;
    description: string;
    color: string;
    snapshotable?: boolean;
  };
  isCustom?: boolean;
  updatedAt?: string;
}

export interface AppDatabase {
  version: number;
  lastSyncedAt: string;
  characters: CharacterConfig[];
  weapons: WeaponDatabaseItem[];
  artifacts: ArtifactSetDatabaseItem[];
}
