import { AppDatabase, WeaponDatabaseItem, ArtifactSetDatabaseItem } from '../types/database';
import { CharacterConfig } from '../types/genshin';
import { INITIAL_MASTER_DATABASE, DATABASE_VERSION, MASTER_WEAPONS, MASTER_ARTIFACTS } from '../data/databaseMaster';
import { migrateLegacyCharacter } from './legacyMigration';
import {
  generateCharacterMaster,
  CharacterGenerationReport,
  GenerationProgress,
} from '../masterdata/characterMasterGenerator';

const DB_LOCALSTORAGE_KEY = 'genshin_app_db_v1';

const isCustomCharacter = (c: CharacterConfig) => c.id.startsWith('custom_') || !!c.isCustom;

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

    // 旧バージョンの DB: マスター由来のキャラは同梱の最新マスターに置き換え、ユーザー作成キャラだけ残す
    if ((parsed.version ?? 0) < DATABASE_VERSION) {
      const customChars = characters.filter(isCustomCharacter);
      const upgraded: AppDatabase = {
        ...parsed,
        version: DATABASE_VERSION,
        characters: [
          ...INITIAL_MASTER_DATABASE.characters.filter(mc => !customChars.some(cc => cc.id === mc.id)),
          ...customChars,
        ],
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
 * genshin-db / gcsim から最新のキャラクターマスターをオンラインで生成し、DB に反映する。
 * ユーザーが作成したキャラ (custom_*) はマスターと ID が重ならない限り残す。
 */
export async function syncCharactersMasterOnline(
  currentDb: AppDatabase,
  onProgress?: (p: GenerationProgress) => void,
): Promise<{ db: AppDatabase; report: CharacterGenerationReport }> {
  const { characters: latestChars, report } = await generateCharacterMaster(onProgress);
  const customChars = currentDb.characters.filter(isCustomCharacter);
  const mergedCharacters = [
    ...latestChars,
    ...customChars.filter(cc => !latestChars.some(mc => mc.id === cc.id))
  ];

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
 * Syncs only Weapons master roster
 */
export function syncWeaponsMaster(currentDb: AppDatabase): AppDatabase {
  const latestWeapons = MASTER_WEAPONS;
  const customWeapons = currentDb.weapons.filter(w => w.isCustom);
  const mergedWeapons = [
    ...latestWeapons,
    ...customWeapons.filter(cw => !latestWeapons.some(mw => mw.id === cw.id))
  ];

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
 * Syncs only Artifacts master roster
 */
export function syncArtifactsMaster(currentDb: AppDatabase): AppDatabase {
  const latestArtifacts = MASTER_ARTIFACTS;
  const customArtifacts = currentDb.artifacts.filter(a => a.isCustom);
  const mergedArtifacts = [
    ...latestArtifacts,
    ...customArtifacts.filter(ca => !latestArtifacts.some(ma => ma.id === ca.id))
  ];

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
    characters: [],
  };
  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Clear All Data (Characters, Weapons, Artifacts) completely
 */
export function clearAllDatabaseData(): AppDatabase {
  const emptyDb: AppDatabase = {
    version: 1.0,
    lastSyncedAt: new Date().toLocaleString('ja-JP') + ' (全データクリア済)',
    characters: [],
    weapons: [],
    artifacts: [],
  };
  saveDatabase(emptyDb);
  return emptyDb;
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
