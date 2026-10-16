/**
 * 画面が壊れたとき（ErrorBoundary）の、保存データの書き出し。
 * 通常のバックアップ（backup.ts）は、データを読み込んで解釈するので、壊れたデータでは失敗しうる。
 * ここでは、保存先の文字列を、そのまま（解釈せずに）書き出す。あとで、手で直す・調べるときに使う。
 */
import { BACKUP_SETTING_KEYS, STORAGE_KEYS, readString } from './persistence';

export const RECOVERY_DUMP_FORMAT = 'genshin-rotation-planner-raw-dump';

export interface RecoveryDump {
  format: typeof RECOVERY_DUMP_FORMAT;
  exportedAt: string;
  /** 保存先のキー → 保存されていた文字列（無いものは null） */
  keys: Record<string, string | null>;
}

export function buildRecoveryDump(now: Date = new Date()): RecoveryDump {
  const keys: Record<string, string | null> = {};
  for (const key of [...Object.values(STORAGE_KEYS), ...BACKUP_SETTING_KEYS]) keys[key] = readString(key);
  return { format: RECOVERY_DUMP_FORMAT, exportedAt: now.toISOString(), keys };
}
