/**
 * 同梱のマスターデータの実体（3 つの JSON）。大きいので、masterBundle.ts の loadMasterData から、動的に読み込む（D354）。
 * ほかのファイルから、直接は読み込まない（読み込むと、画面の最初のコードに、また含まれてしまう）。
 */
import type { ArtifactSetDatabaseItem, WeaponDatabaseItem } from '../types/database';
import type { CharacterConfig } from '../types/genshin';
import charactersMasterJson from './characters_master_data.json';
import weaponsMasterJson from './weapons_master_data.json';
import artifactsMasterJson from './artifacts_master_data.json';
import { DATABASE_VERSION } from './databaseMaster';
import type { MasterBundle } from './masterBundle';
import { t } from '../i18n';

/** 同梱のマスターから、初期データベースを含む入れ物を作る */
export function buildMasterBundle(): MasterBundle {
  const characters = charactersMasterJson as CharacterConfig[];
  const weapons = weaponsMasterJson as WeaponDatabaseItem[];
  const artifacts = artifactsMasterJson as ArtifactSetDatabaseItem[];
  return {
    characters,
    weapons,
    artifacts,
    initialDatabase: {
      version: DATABASE_VERSION,
      lastSyncedAt: t('messages:db.bundled'),
      lastSync: { key: 'messages:db.bundled' },
      characters,
      weapons,
      artifacts,
    },
  };
}
