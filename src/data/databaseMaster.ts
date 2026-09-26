import { AppDatabase, WeaponDatabaseItem, ArtifactSetDatabaseItem } from '../types/database';
import { MASTER_CHARACTERS } from './characters';
import weaponsMasterJson from './weapons_master_data.json';
import artifactsMasterJson from './artifacts_master_data.json';

/** DB 形式のバージョン。キャラや装備のデータ構造・マスター値を更新したら上げる (loadDatabase で旧データを自動移行) */
export const DATABASE_VERSION = 11;

export const MASTER_WEAPONS = weaponsMasterJson as WeaponDatabaseItem[];
export const MASTER_ARTIFACTS = artifactsMasterJson as ArtifactSetDatabaseItem[];

/** 同梱のマスター JSON から作る初期データベース (オフラインで即座に使える) */
export const INITIAL_MASTER_DATABASE: AppDatabase = {
  version: DATABASE_VERSION,
  lastSyncedAt: '同梱マスターデータ',
  characters: MASTER_CHARACTERS,
  weapons: MASTER_WEAPONS,
  artifacts: MASTER_ARTIFACTS,
};
