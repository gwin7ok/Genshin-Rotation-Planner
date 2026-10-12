/**
 * マスターデータ（DB）の更新の通知（D196・D198）。
 *
 * DB のバージョン（DATABASE_VERSION。同梱マスターを変えたら上げる番号）で判定する。
 * ブラウザ（localStorage）に、利用者が最後に確認した DB のバージョンを記録しておき、
 * ページを読み込んだときに、今の DB のバージョンのほうが新しければ、
 * 「DB管理で、キャラ・武器・聖遺物のマスターデータを、全削除 → 動的生成してください」と促す。
 *
 * 判定:
 *   - 記録がある: 今の DB のバージョンが、記録より新しい → 通知する
 *   - 記録がない かつ 保存 DB がある（この機能の導入前から使っている利用者）:
 *       保存 DB の version が今より古い → 通知する（同じなら通知しない）
 *   - 記録がない かつ 保存 DB もない（初めての利用者。同梱の最新のマスターが使われる）→ 通知しない（記録だけする）
 *   - 今の DB のバージョンが記録と同じ・古い → 通知しない（古いアプリを開いたときに、記録は進めない）
 *
 * 保存 DB の version は、読み込み時の自動置き換え（databaseService.loadDatabase）で書き換わるので、
 * 置き換えの前に noteStoredDbVersion で、記録として残しておく。
 */
import { DEVICE_KEYS, STORAGE_KEYS, readString, writeString } from './persistence';

export interface VersionNotice {
  /** 通知するか */
  show: boolean;
  /** 利用者が最後に確認した（または、保存 DB の）DB のバージョン。分からなければ null */
  previous: number | null;
  /** 今の DB のバージョン（DATABASE_VERSION） */
  current: number;
}

function parseVersion(s: string | null): number | null {
  if (s === null) return null;
  const n = Number(s.trim());
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** 保存 DB の version（DB が無い・読めないときは undefined。version が無い旧 DB は 0） */
function storedDbVersion(): number | undefined {
  const raw = readString(STORAGE_KEYS.database);
  if (raw === null) return undefined;
  try {
    const parsed = JSON.parse(raw) as { version?: unknown } | null;
    if (!parsed || typeof parsed !== 'object') return undefined;
    return typeof parsed.version === 'number' ? parsed.version : 0;
  } catch {
    return undefined;
  }
}

/**
 * 保存 DB の version（自動置き換えの前の値）を、記録が無いときだけ、記録として残す。
 * loadDatabase が、置き換えの前に呼ぶ。
 */
export function noteStoredDbVersion(storedVersion: number): void {
  if (readString(DEVICE_KEYS.lastSeenDbVersion) !== null) return;
  writeString(DEVICE_KEYS.lastSeenDbVersion, String(storedVersion));
}

/** 通知の要否を判定する（記録は変えない） */
export function evaluateVersionNotice(currentDbVersion: number): VersionNotice {
  const recorded = parseVersion(readString(DEVICE_KEYS.lastSeenDbVersion));
  if (recorded !== null) {
    return { show: currentDbVersion > recorded, previous: recorded, current: currentDbVersion };
  }
  // 記録なし（壊れた値も含む）: 保存 DB の version で判定する
  const stored = storedDbVersion();
  if (stored === undefined) return { show: false, previous: null, current: currentDbVersion };
  return { show: currentDbVersion > stored, previous: stored, current: currentDbVersion };
}

/**
 * 今の DB のバージョンを、確認済みとして記録する。
 * 記録より古いときは、記録を進めない（新しい版の記録を保つ）
 */
export function markVersionSeen(currentDbVersion: number): void {
  const recorded = parseVersion(readString(DEVICE_KEYS.lastSeenDbVersion));
  if (recorded !== null && currentDbVersion <= recorded) return;
  writeString(DEVICE_KEYS.lastSeenDbVersion, String(currentDbVersion));
}
