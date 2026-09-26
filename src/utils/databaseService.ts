import { AppDatabase, WeaponDatabaseItem, ArtifactSetDatabaseItem } from '../types/database';
import { CharacterConfig } from '../types/genshin';
import { INITIAL_MASTER_DATABASE, DATABASE_VERSION, MASTER_WEAPONS, MASTER_ARTIFACTS } from '../data/databaseMaster';
import { migrateLegacyCharacter } from './legacyMigration';
import {
  generateCharacterMaster,
  CharacterGenerationReport,
  GenerationProgress,
} from '../masterdata/characterMasterGenerator';
import {
  generateWeaponsMasterOnline,
  generateArtifactsMasterOnline,
  generateEquipmentMaster,
  type EquipmentGenerationProgress,
  type WeaponGenerationReport,
  type ArtifactGenerationReport,
  type EquipmentGenerationReport,
} from '../masterdata/equipmentMasterGenerator';

const DB_LOCALSTORAGE_KEY = 'genshin_app_db_v1';

const isCustomCharacter = (c: CharacterConfig) => c.id.startsWith('custom_') || !!c.isCustom;
const isLockedCharacter = (c: CharacterConfig) => !!c.isLocked;

const isCustomWeapon = (w: WeaponDatabaseItem) => w.id.startsWith('weapon_custom_') || !!w.isCustom;
const isLockedWeapon = (w: WeaponDatabaseItem) => !!w.isLocked;

const isCustomArtifact = (a: ArtifactSetDatabaseItem) => a.id.startsWith('art_custom_') || !!a.isCustom;
const isLockedArtifact = (a: ArtifactSetDatabaseItem) => !!a.isLocked;

/**
 * マスターの一覧に、現在の DB のアイテムを重ねる（IDで突き合わせ）
 * - ロック中のアイテムは、マスターより優先して残す（マスターで上書きしない）
 * - カスタム・ロック中のアイテムで、マスターに無いものは末尾に残す
 */
function mergeItemsWithProtected<T extends { id: string }>(
  masterItems: T[],
  currentItems: T[],
  isProtected: (item: T) => boolean,
  isExtraCustom: (item: T) => boolean,
): T[] {
  const protectedById = new Map(currentItems.filter(isProtected).map(item => [item.id, item]));
  const masterIds = new Set(masterItems.map(item => item.id));
  return [
    ...masterItems.map(mi => protectedById.get(mi.id) ?? mi),
    ...currentItems.filter(item => (isExtraCustom(item) || isProtected(item)) && !masterIds.has(item.id)),
  ];
}

function mergeMasterWithProtected(
  masterChars: CharacterConfig[],
  currentChars: CharacterConfig[],
  keepOverMaster: (c: CharacterConfig) => boolean,
): CharacterConfig[] {
  return mergeItemsWithProtected(masterChars, currentChars, keepOverMaster, isCustomCharacter);
}

/**
 * Loads database from LocalStorage or generates default master DB
 */
export function loadDatabase(): AppDatabase {
  try {
    const raw = localStorage.getItem(DB_LOCALSTORAGE_KEY);
    if (!raw) {
      return INITIAL_MASTER_DATABASE;
    }
    const parsed = JSON.parse(raw) as AppDatabase;
    if (!parsed || !Array.isArray(parsed.characters) || !Array.isArray(parsed.weapons) || !Array.isArray(parsed.artifacts)) {
      return INITIAL_MASTER_DATABASE;
    }

    const characters = parsed.characters.map(c => migrateLegacyCharacter(c as unknown as Record<string, unknown>));

    // 旧バージョンの DB: マスター由来のキャラは同梱の最新マスターに置き換え、ユーザー作成キャラとロック中のキャラは残す
    if ((parsed.version ?? 0) < DATABASE_VERSION) {
      const upgraded: AppDatabase = {
        ...parsed,
        version: DATABASE_VERSION,
        characters: mergeMasterWithProtected(
          INITIAL_MASTER_DATABASE.characters,
          characters,
          c => isCustomCharacter(c) || isLockedCharacter(c),
        ),
      };
      saveDatabase(upgraded);
      return upgraded;
    }

    return { ...parsed, characters };
  } catch (err) {
    console.warn('Failed to parse database from localStorage, falling back to master:', err);
    return INITIAL_MASTER_DATABASE;
  }
}

/**
 * Persists current database to LocalStorage
 */
export function saveDatabase(db: AppDatabase): void {
  try {
    localStorage.setItem(DB_LOCALSTORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Failed to save database to localStorage:', err);
  }
}

/**
 * genshin-db / gcsim から最新のキャラクターマスターをオンラインで生成し、DB に反映する（キーで突き合わせて上書き）。
 * ロック中のキャラは上書きしない。ユーザーが作成したキャラ (custom_*) はマスターとキーが重ならない限り残す。
 */
export async function syncCharactersMasterOnline(
  currentDb: AppDatabase,
  onProgress?: (p: GenerationProgress) => void,
): Promise<{ db: AppDatabase; report: CharacterGenerationReport }> {
  const { characters: latestChars, report } = await generateCharacterMaster(onProgress);
  const mergedCharacters = mergeMasterWithProtected(latestChars, currentDb.characters, isLockedCharacter);

  const nowStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedDb: AppDatabase = {
    ...currentDb,
    version: DATABASE_VERSION,
    lastSyncedAt: `${nowStr} (genshin-db + gcsim ${report.gcsimCommit.slice(0, 7)} から生成)`,
    characters: mergedCharacters
  };

  saveDatabase(updatedDb);
  return { db: updatedDb, report };
}

/**
 * genshin-db API から最新の武器マスターをオンラインで取得・解析し、DB に反映する。
 * ユーザーが追加したカスタム武器 (isCustom: true) は保護される。
 */
export async function syncWeaponsMasterOnline(
  currentDb: AppDatabase,
  onProgress?: (p: EquipmentGenerationProgress) => void,
): Promise<{ db: AppDatabase; report: WeaponGenerationReport }> {
  const { weapons: latestWeapons, report } = await generateWeaponsMasterOnline(onProgress);
  const mergedWeapons = mergeItemsWithProtected(
    latestWeapons,
    currentDb.weapons,
    isLockedWeapon,
    isCustomWeapon,
  );

  const nowStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedDb: AppDatabase = {
    ...currentDb,
    version: DATABASE_VERSION,
    lastSyncedAt: `${nowStr} (genshin-db API より武器 ${report.totalWeapons} 件をオンライン生成)`,
    weapons: mergedWeapons
  };

  saveDatabase(updatedDb);
  return { db: updatedDb, report };
}

/**
 * genshin-db API から最新の聖遺物マスターをオンラインで取得・解析し、DB に反映する。
 * ロック中およびカスタム聖遺物は保護される。
 */
export async function syncArtifactsMasterOnline(
  currentDb: AppDatabase,
  onProgress?: (p: EquipmentGenerationProgress) => void,
): Promise<{ db: AppDatabase; report: ArtifactGenerationReport }> {
  const { artifacts: latestArtifacts, report } = await generateArtifactsMasterOnline(onProgress);
  const mergedArtifacts = mergeItemsWithProtected(
    latestArtifacts,
    currentDb.artifacts,
    isLockedArtifact,
    isCustomArtifact,
  );

  const nowStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedDb: AppDatabase = {
    ...currentDb,
    version: DATABASE_VERSION,
    lastSyncedAt: `${nowStr} (genshin-db API より聖遺物 ${report.totalArtifacts} セットをオンライン生成)`,
    artifacts: mergedArtifacts
  };

  saveDatabase(updatedDb);
  return { db: updatedDb, report };
}

/**
 * genshin-db API から武器・聖遺物の両方をオンラインで取得・解析し、一括でDB に反映する。
 */
export async function syncEquipmentMasterOnline(
  currentDb: AppDatabase,
  onProgress?: (p: EquipmentGenerationProgress) => void,
): Promise<{ db: AppDatabase; report: EquipmentGenerationReport }> {
  const { weapons: latestWeapons, artifacts: latestArtifacts, report } = await generateEquipmentMaster(onProgress);
  const mergedWeapons = mergeItemsWithProtected(
    latestWeapons,
    currentDb.weapons,
    isLockedWeapon,
    isCustomWeapon,
  );
  const mergedArtifacts = mergeItemsWithProtected(
    latestArtifacts,
    currentDb.artifacts,
    isLockedArtifact,
    isCustomArtifact,
  );

  const nowStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedDb: AppDatabase = {
    ...currentDb,
    version: DATABASE_VERSION,
    lastSyncedAt: `${nowStr} (genshin-db API より武器・聖遺物をオンライン生成)`,
    weapons: mergedWeapons,
    artifacts: mergedArtifacts,
  };

  saveDatabase(updatedDb);
  return { db: updatedDb, report };
}

/**
 * Syncs only Weapons master roster (オフライン・同梱JSON使用)
 */
export function syncWeaponsMaster(currentDb: AppDatabase): AppDatabase {
  const latestWeapons = MASTER_WEAPONS;
  const mergedWeapons = mergeItemsWithProtected(
    latestWeapons,
    currentDb.weapons,
    isLockedWeapon,
    isCustomWeapon,
  );

  const nowStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedDb: AppDatabase = {
    ...currentDb,
    lastSyncedAt: `${nowStr} (同梱の武器マスターを反映)`,
    weapons: mergedWeapons
  };

  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Syncs only Artifacts master roster (オフライン・同梱JSON使用)
 */
export function syncArtifactsMaster(currentDb: AppDatabase): AppDatabase {
  const latestArtifacts = MASTER_ARTIFACTS;
  const mergedArtifacts = mergeItemsWithProtected(
    latestArtifacts,
    currentDb.artifacts,
    isLockedArtifact,
    isCustomArtifact,
  );

  const nowStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedDb: AppDatabase = {
    ...currentDb,
    lastSyncedAt: `${nowStr} (同梱の聖遺物マスターを反映)`,
    artifacts: mergedArtifacts
  };

  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Resets database completely back to initial official master
 */
export function resetDatabaseToMaster(): AppDatabase {
  const resetDb = {
    ...INITIAL_MASTER_DATABASE,
    lastSyncedAt: new Date().toLocaleString('ja-JP') + ' (初期化リセット済)',
  };
  saveDatabase(resetDb);
  return resetDb;
}

/**
 * Upsert Character in Database
 */
export function upsertCharacterInDb(db: AppDatabase, character: CharacterConfig): AppDatabase {
  const index = db.characters.findIndex(c => c.id === character.id);
  const updatedList = [...db.characters];
  const charToSave: CharacterConfig = {
    ...character,
    isCustom: true,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    updatedList[index] = charToSave;
  } else {
    updatedList.push(charToSave);
  }

  const updatedDb: AppDatabase = {
    ...db,
    characters: updatedList,
  };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * キャラのロック状態だけを切り替える（カスタム扱いや更新日時は変えない）
 */
export function setCharacterLockInDb(db: AppDatabase, characterId: string, locked: boolean): AppDatabase {
  const updatedDb: AppDatabase = {
    ...db,
    characters: db.characters.map(c => (c.id === characterId ? { ...c, isLocked: locked } : c)),
  };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Delete Single Character from Database
 */
export function deleteCharacterFromDb(db: AppDatabase, characterId: string): AppDatabase {
  const updatedDb: AppDatabase = {
    ...db,
    characters: db.characters.filter(c => c.id !== characterId),
  };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Delete All Characters from Database at once
 */
export function deleteAllCharactersFromDb(db: AppDatabase): AppDatabase {
  const updatedDb: AppDatabase = {
    ...db,
    characters: db.characters.filter(isLockedCharacter), // ロック中のキャラは残す
  };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Clear All Data (Characters, Weapons, Artifacts) completely
 * ロック中のアイテムはすべて保護されます
 */
export function clearAllDatabaseData(db: AppDatabase): AppDatabase {
  const emptyDb: AppDatabase = {
    version: 1.0,
    lastSyncedAt: new Date().toLocaleString('ja-JP') + ' (全データクリア済)',
    characters: db.characters.filter(isLockedCharacter), // ロック中のキャラは残す
    weapons: db.weapons.filter(isLockedWeapon),          // ロック中の武器は残す
    artifacts: db.artifacts.filter(isLockedArtifact),     // ロック中の聖遺物は残す
  };
  saveDatabase(emptyDb);
  return emptyDb;
}

/**
 * 武器のロック状態だけを切り替える
 */
export function setWeaponLockInDb(db: AppDatabase, weaponId: string, locked: boolean): AppDatabase {
  const updatedDb: AppDatabase = {
    ...db,
    weapons: db.weapons.map(w => (w.id === weaponId ? { ...w, isLocked: locked } : w)),
  };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * 聖遺物のロック状態だけを切り替える
 */
export function setArtifactLockInDb(db: AppDatabase, artifactId: string, locked: boolean): AppDatabase {
  const updatedDb: AppDatabase = {
    ...db,
    artifacts: db.artifacts.map(a => (a.id === artifactId ? { ...a, isLocked: locked } : a)),
  };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Delete All Weapons from Database at once
 */
export function deleteAllWeaponsFromDb(db: AppDatabase): AppDatabase {
  const updatedDb: AppDatabase = {
    ...db,
    weapons: db.weapons.filter(isLockedWeapon), // ロック中の武器は残す
  };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Delete All Artifacts from Database at once
 */
export function deleteAllArtifactsFromDb(db: AppDatabase): AppDatabase {
  const updatedDb: AppDatabase = {
    ...db,
    artifacts: db.artifacts.filter(isLockedArtifact), // ロック中の聖遺物は残す
  };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Upsert Weapon in Database
 */
export function upsertWeaponInDb(db: AppDatabase, weapon: WeaponDatabaseItem): AppDatabase {
  const index = db.weapons.findIndex(w => w.id === weapon.id);
  const updatedList = [...db.weapons];
  const weaponToSave: WeaponDatabaseItem = {
    ...weapon,
    isCustom: true,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    updatedList[index] = weaponToSave;
  } else {
    updatedList.push(weaponToSave);
  }

  const updatedDb: AppDatabase = {
    ...db,
    weapons: updatedList,
  };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Delete Weapon from Database
 */
export function deleteWeaponFromDb(db: AppDatabase, weaponId: string): AppDatabase {
  const updatedDb: AppDatabase = {
    ...db,
    weapons: db.weapons.filter(w => w.id !== weaponId),
  };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Upsert Artifact Set in Database
 */
export function upsertArtifactInDb(db: AppDatabase, artifact: ArtifactSetDatabaseItem): AppDatabase {
  const index = db.artifacts.findIndex(a => a.id === artifact.id);
  const updatedList = [...db.artifacts];
  const artifactToSave: ArtifactSetDatabaseItem = {
    ...artifact,
    isCustom: true,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    updatedList[index] = artifactToSave;
  } else {
    updatedList.push(artifactToSave);
  }

  const updatedDb: AppDatabase = {
    ...db,
    artifacts: updatedList,
  };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Delete Artifact Set from Database
 */
export function deleteArtifactFromDb(db: AppDatabase, artifactId: string): AppDatabase {
  const updatedDb: AppDatabase = {
    ...db,
    artifacts: db.artifacts.filter(a => a.id !== artifactId),
  };
  saveDatabase(updatedDb);
  return updatedDb;
}
