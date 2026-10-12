/**
 * 保存層（ブラウザの localStorage の読み書きを、ここ 1 か所に集める。D175）。
 *
 * - アプリのどこからも、`localStorage` を直接呼ばない（`npm run check:backup` が、この規則を検査する）。
 * - 保存先のキーは、ここで一元管理する（キーの文字列は、既存の利用者のデータを読むため、変えない）。
 * - 読み書きの失敗（容量超過・プライベートモード・無効化）は、投げずに、戻り値で返す（アプリは保存できなくても動く）。
 * - 保存先（バックエンド）を差し替えられる（テスト・将来の Google Drive 保存・IndexedDB への移行用）。
 *
 * 保存の内容を、まとめて書き出す・戻すのは `backup.ts`。
 */

/** 保存先のキー（文字列は、公開済みのデータとの互換のため、変えない） */
export const STORAGE_KEYS = {
  /** 現在編集中の編成（自動保存） */
  activeRotation: 'genshin_rotation_current_state_v2',
  /** 保存編成（スロット）の一覧 */
  savedSlots: 'genshin_rotation_saved_slots_v2',
  /** データベース（キャラ・武器・聖遺物。マスター + 利用者のデータ） */
  database: 'genshin_app_db_v1',
} as const;

/**
 * 利用者の設定のキー。バックアップに含める（別の端末・サイトへ移す設定）。
 * 設定を足したら、ここに足す（バックアップ・復元が、この一覧を使う）。
 */
export const SETTING_KEYS = {
  /** 敵の防御ヒットストップ（'true' | 'false'。既定: 有効） */
  gcsimDefHalt: 'gcsimDefHalt',
  /** 敵から受けるダメージの設定（JSON） */
  gcsimHurt: 'gcsimHurt',
  /** 記法の表示（'short' | 'name'。既定: short） */
  rotationNotationMode: 'rotationNotationMode',
} as const;

/** この端末だけの設定のキー（バックアップに含めない） */
export const DEVICE_KEYS = {
  /** gcsim の実行エンジンの選択（'auto' | 'wasm' | 'server'。開発・検証用） */
  gcsimEngine: 'gcsim_engine',
  /** 構築エリアのガイド（アクション凡例・操作のヒント）の表示（'false' = 非表示。既定: 表示） */
  editorGuideVisible: 'editor_guide_visible',
  /** 利用者が最後に確認した、DB（マスターデータ）のバージョン。更新の通知（versionNotice.ts）に使う */
  lastSeenDbVersion: 'app_last_seen_db_version',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/** バックアップに含める設定のキーの一覧 */
export const BACKUP_SETTING_KEYS: readonly string[] = Object.values(SETTING_KEYS);

/** 保存先の最小の形（localStorage と同じ） */
export interface KeyValueBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let override: KeyValueBackend | null = null;

/** 保存先を差し替える（null で、ブラウザの localStorage に戻す） */
export function setPersistenceBackend(backend: KeyValueBackend | null): void {
  override = backend;
}

function backend(): KeyValueBackend | null {
  if (override) return override;
  try {
    const ls = (globalThis as { localStorage?: KeyValueBackend }).localStorage;
    return ls ?? null;
  } catch {
    // localStorage へのアクセス自体が例外になる環境（無効化・サンドボックス）
    return null;
  }
}

/** 文字列を読む。無い・読めないときは null */
export function readString(key: string): string | null {
  try {
    return backend()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** 文字列を書く。書けたら true（容量超過・無効のときは false。例外は投げない） */
export function writeString(key: string, value: string): boolean {
  try {
    const b = backend();
    if (!b) return false;
    b.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`保存できませんでした（${key}）:`, e);
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    backend()?.removeItem(key);
  } catch {
    // 消せなくても、アプリは動く
  }
}

/** JSON を読む。無い・壊れている・読めないときは null（呼び出し側が、形を検査する） */
export function readJson<T = unknown>(key: string): T | null {
  const raw = readString(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`保存データを読めませんでした（${key}）:`, e);
    return null;
  }
}

/** JSON を書く。書けたら true */
export function writeJson(key: string, value: unknown): boolean {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch (e) {
    console.warn(`保存データを JSON にできませんでした（${key}）:`, e);
    return false;
  }
  return writeString(key, text);
}
