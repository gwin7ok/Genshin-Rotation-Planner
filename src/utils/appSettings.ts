/**
 * アプリ全体の設定（回転ごとではなく、利用者ごとの設定）の読み書き。D175。
 * 保存先は persistence.ts（キーは SETTING_KEYS）。画面の初期値の読み込みと、変更の保存に使う。
 */
import { DEFAULT_HURT, type HurtSetting } from './gcsim/buildGcsimConfig';
import type { RequiredErResult } from './gcsim/requiredEnergyRecharge';
import type { NotationMode } from './rotationNotation';
import { SETTING_KEYS, readJson, readString, writeJson, writeString } from './persistence';

/** 敵の防御ヒットストップ（既定: 有効） */
export function loadDefHalt(): boolean {
  return readString(SETTING_KEYS.gcsimDefHalt) !== 'false';
}

export function saveDefHalt(value: boolean): void {
  writeString(SETTING_KEYS.gcsimDefHalt, String(value));
}

/** 敵から受けるダメージ（既定: 無効。保存された値は、既定の項目の上に重ねる） */
export function loadHurt(): HurtSetting {
  const v = readJson<unknown>(SETTING_KEYS.gcsimHurt);
  if (v && typeof v === 'object') return { ...DEFAULT_HURT, ...(v as Partial<HurtSetting>) };
  return DEFAULT_HURT;
}

export function saveHurt(value: HurtSetting): void {
  writeJson(SETTING_KEYS.gcsimHurt, value);
}

/** 必要元素チャージ効率の最後の算出結果（無い・形が違うときは null） */
export function loadRequiredEr(): RequiredErResult | null {
  const v = readJson<Partial<RequiredErResult>>(SETTING_KEYS.requiredEnergyRecharge);
  if (!v || typeof v !== 'object' || !Array.isArray(v.entries) || typeof v.fingerprint !== 'string' || v.entries.some(e => !e || typeof e.status !== 'string' || (e.status === 'ok' && !Number.isFinite(e.certainEr))) || typeof v.gcsimVersion !== 'string' || !Number.isFinite(v.ranAt)) return null;
  return v as RequiredErResult;
}

/** 算出結果を保存する（前の結果は上書き） */
export function saveRequiredEr(value: RequiredErResult): void {
  writeJson(SETTING_KEYS.requiredEnergyRecharge, value);
}

/** 記法のモード（既定: 略号） */
export function loadNotationMode(): NotationMode {
  return readString(SETTING_KEYS.rotationNotationMode) === 'name' ? 'name' : 'short';
}

export function saveNotationMode(mode: NotationMode): void {
  writeString(SETTING_KEYS.rotationNotationMode, mode);
}
