import { AppDatabase, WeaponDatabaseItem, ArtifactSetDatabaseItem } from '../types/database';
import { MASTER_CHARACTERS } from './characters';
import weaponsMasterJson from './weapons_master_data.json';
import artifactsMasterJson from './artifacts_master_data.json';
import { t } from '../i18n';

/** DB 形式のバージョン。キャラや装備のデータ構造・マスター値を更新したら上げる (loadDatabase で旧データを自動移行) */
export const DATABASE_VERSION = 86; // 86: 長押しの holdInFrames を gcsim の実測に合わせて補正（早柚 600→598f・綺良々 600→590f・リネット 150→146f。藍硯は未対応。D330）。85: gcsim v2.49.4 に更新（辞書・マスター再生成）。84: gcsim の設定文の別名対応表を追加（D326。キャラ・武器・聖遺物のデータ自体は v2.49.0 のまま）

export const MASTER_WEAPONS = weaponsMasterJson as WeaponDatabaseItem[];
export const MASTER_ARTIFACTS = artifactsMasterJson as ArtifactSetDatabaseItem[];

/** 同梱のマスター JSON から作る初期データベース (オフラインで即座に使える) */
export const INITIAL_MASTER_DATABASE: AppDatabase = {
  version: DATABASE_VERSION,
  lastSyncedAt: t('messages:db.bundled'),
  lastSync: { key: 'messages:db.bundled' },
  characters: MASTER_CHARACTERS,
  weapons: MASTER_WEAPONS,
  artifacts: MASTER_ARTIFACTS,
};
