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
  /** 必要元素チャージ効率の最後の算出結果（JSON。「チャージ効率計算」画面） */
  requiredEnergyRecharge: 'requiredEnergyRecharge',
  /** DPS 計算の設定（JSON。周数・実行回数・敵。「DPS 計算」画面） */
  dpsSettings: 'dpsSettings',
  /** 表示の言語（'ja' | 'en'。無ければブラウザの言語に従う。D246〜D248） */
  language: 'appLanguage',
  /** HoYoLAB から取り込んだ持ちキャラ（JSON。{ importedAt, characters }。src/utils/hoyolab/ownedStore.ts） */
  ownedCharacters: 'ownedCharacters',
  /** アプリ全体のモード（'normal' | 'abyss'。既定: normal。フェーズ8 / issue #54） */
  appMode: 'appMode',
  /** 幽境モードの戦闘条件（JSON。戦闘時間・最初の爆発の待ち許容・時刻指定の粒子・敵の粒子。src/utils/battleCondition.ts） */
  abyssBattleCondition: 'abyssBattleCondition',
  /** 幽境モードの、必要元素チャージ効率の最後の算出結果（JSON。通常モードの結果は requiredEnergyRecharge に別に持つ） */
  requiredEnergyRechargeAbyss: 'requiredEnergyRechargeAbyss',
  /** 名前を付けて保存した幽境モードの戦闘条件（JSON。[{ id, name, condition }]。ボスごとの条件の呼び出し用。src/utils/battleCondition.ts） */
  abyssConditionPresets: 'abyssConditionPresets',
  /** HoYoLAB の取り込みで入力した原神の UID（文字列。入力の手間を減らすため） */
  hoyolabUid: 'hoyolabUid',
  /** 持ちキャラの取り込みで、Enka.Network の最新の値で上書きするか（'true' | 'false'。既定: true。D352） */
  ownedUseEnka: 'ownedUseEnka',
  /** 利用者が変えたキャラの役割（JSON。{ キャラ ID: ['attacker' | 'subAttacker' | 'supporter', ...] }。無いキャラはマスターの初期値。src/utils/characterRoleStore.ts） */
  characterRoleOverrides: 'characterRoleOverrides',
} as const;

/** この端末だけの設定のキー（バックアップに含めない） */
export const DEVICE_KEYS = {
  /** WASM の gcsim を同時に動かすコア（Worker）の数（整数。端末のコア数で変わるので、この端末だけ。既定: 12。上限は端末のコア数 − 1） */
  gcsimCores: 'gcsim_cores',
  /** 構築エリアのガイド（アクション凡例・操作のヒント）の表示（'false' = 非表示。既定: 表示） */
  editorGuideVisible: 'editor_guide_visible',
  /** 利用者が最後に確認した、DB（マスターデータ）のバージョン。更新の通知（versionNotice.ts）に使う */
  lastSeenDbVersion: 'app_last_seen_db_version',
  /** 利用者が最後に開いた、アプリの版（package.json の version）。更新履歴のポップアップ（changelog.ts）に使う */
  lastSeenAppVersion: 'app_last_seen_app_version',
} as const;

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

let writeFailureHandler: ((key: string) => void) | null = null;

/** 書き込みの失敗（容量超過・保存が無効）を知らせるハンドラを登録する（画面の警告用。null で解除） */
export function setWriteFailureHandler(handler: ((key: string) => void) | null): void {
  writeFailureHandler = handler;
}

function notifyWriteFailure(key: string): void {
  try {
    writeFailureHandler?.(key);
  } catch {
    // 通知の失敗で、保存の呼び出し元を落とさない
  }
}

/** 文字列を書く。書けたら true（容量超過・無効のときは false。例外は投げず、登録されたハンドラに知らせる） */
export function writeString(key: string, value: string): boolean {
  try {
    const b = backend();
    if (!b) {
      notifyWriteFailure(key);
      return false;
    }
    b.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`保存できませんでした（${key}）:`, e);
    notifyWriteFailure(key);
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
