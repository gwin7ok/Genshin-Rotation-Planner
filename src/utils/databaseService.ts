import { AppDatabase, WeaponDatabaseItem, ArtifactSetDatabaseItem } from '../types/database';
import { CharacterConfig } from '../types/genshin';
import { INITIAL_MASTER_DATABASE } from '../data/databaseMaster';
import { 
  generateLatestMasterDatabase, 
  generateLatestCharacterMaster, 
  generateLatestWeaponsMaster, 
  generateLatestArtifactsMaster 
} from './genshinDbMasterGenerator';
import { fetchOnlineGenshinData, OnlineSyncOptions } from '../services/genshinApiService';

const DB_LOCALSTORAGE_KEY = 'genshin_app_db_v1';

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
    return parsed;
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
 * Syncs only Character master roster
 */
export function syncCharactersMaster(currentDb: AppDatabase): AppDatabase {
  const latestChars = generateLatestCharacterMaster();
  const customChars = currentDb.characters.filter(c => c.id.startsWith('custom_') || (c as any).isCustom);
  const mergedCharacters = [
    ...latestChars,
    ...customChars.filter(cc => !latestChars.some(mc => mc.id === cc.id))
  ];

  const nowStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedDb: AppDatabase = {
    ...currentDb,
    lastSyncedAt: `${nowStr} (キャラマスター動的生成完了)`,
    characters: mergedCharacters
  };

  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Syncs only Weapons master roster
 */
export function syncWeaponsMaster(currentDb: AppDatabase): AppDatabase {
  const latestWeapons = generateLatestWeaponsMaster();
  const customWeapons = currentDb.weapons.filter(w => w.isCustom);
  const mergedWeapons = [
    ...latestWeapons,
    ...customWeapons.filter(cw => !latestWeapons.some(mw => mw.id === cw.id))
  ];

  const nowStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedDb: AppDatabase = {
    ...currentDb,
    lastSyncedAt: `${nowStr} (武器マスター動的生成完了)`,
    weapons: mergedWeapons
  };

  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Syncs only Artifacts master roster
 */
export function syncArtifactsMaster(currentDb: AppDatabase): AppDatabase {
  const latestArtifacts = generateLatestArtifactsMaster();
  const customArtifacts = currentDb.artifacts.filter(a => a.isCustom);
  const mergedArtifacts = [
    ...latestArtifacts,
    ...customArtifacts.filter(ca => !latestArtifacts.some(ma => ma.id === ca.id))
  ];

  const nowStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedDb: AppDatabase = {
    ...currentDb,
    lastSyncedAt: `${nowStr} (聖遺物マスター動的生成完了)`,
    artifacts: mergedArtifacts
  };

  saveDatabase(updatedDb);
  return updatedDb;
}

/**
 * Dynamically generates and syncs active local DB with latest genshin-db + gcsim Master Database
 */
export function syncWithLatestMasterDB(currentDb?: AppDatabase): AppDatabase {
  const master = generateLatestMasterDatabase();

  if (!currentDb) {
    saveDatabase(master);
    return master;
  }

  // Preserve user created custom items
  const customChars = currentDb.characters.filter(c => c.id.startsWith('custom_') || (c as any).isCustom);
  const customWeapons = currentDb.weapons.filter(w => w.isCustom);
  const customArtifacts = currentDb.artifacts.filter(a => a.isCustom);

  const mergedCharacters = [
    ...master.characters,
    ...customChars.filter(cc => !master.characters.some(mc => mc.id === cc.id))
  ];

  const mergedWeapons = [
    ...master.weapons,
    ...customWeapons.filter(cw => !master.weapons.some(mw => mw.id === cw.id))
  ];

  const mergedArtifacts = [
    ...master.artifacts,
    ...customArtifacts.filter(ca => !master.artifacts.some(ma => ma.id === ca.id))
  ];

  const syncedDb: AppDatabase = {
    ...master,
    characters: mergedCharacters,
    weapons: mergedWeapons,
    artifacts: mergedArtifacts,
  };

  saveDatabase(syncedDb);
  return syncedDb;
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
  const charToSave = {
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

/**
 * Syncs database with live online API (Genshin Dev API / Fandom Wiki mapping)
 */
export async function syncWithOnlineGenshinApi(
  currentDb: AppDatabase,
  options: OnlineSyncOptions = { useOnlineApi: true, useWiki: true }
): Promise<AppDatabase> {
  const onlineChars = await fetchOnlineGenshinData(options);

  // Merge existing custom characters and detailed local characters
  const existingMap = new Map(currentDb.characters.map(c => [c.id, c]));
  
  const mergedChars = onlineChars.map(online => {
    const existing = existingMap.get(online.id);
    if (existing) {
      // Preserve local actions if existing has richer configuration
      return {
        ...online,
        ...existing,
        // Update stats if needed while preserving custom actions
        availableActions: (existing.availableActions && existing.availableActions.length > online.availableActions.length)
          ? existing.availableActions
          : online.availableActions,
      };
    }
    return online;
  });

  // Keep any local-only or custom characters
  for (const localChar of currentDb.characters) {
    if (!mergedChars.some(m => m.id === localChar.id)) {
      mergedChars.push(localChar);
    }
  }

  const sourcesList = [];
  if (options.useOnlineApi) sourcesList.push('オンラインAPI');
  if (options.useWiki) sourcesList.push('Fandom Wiki');
  const sourceLabel = sourcesList.length > 0 ? sourcesList.join(' + ') : '選択ソース';

  const nowStr = new Date().toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }) + ` (${sourceLabel}と同期完了)`;

  const updatedDb: AppDatabase = {
    ...currentDb,
    version: (currentDb.version || 1.0) + 0.1,
    lastSyncedAt: nowStr,
    characters: mergedChars,
  };

  saveDatabase(updatedDb);
  return updatedDb;
}
