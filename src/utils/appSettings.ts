/**
 * アプリ全体の設定（回転ごとではなく、利用者ごとの設定）の読み書き。D175。
 * 保存先は persistence.ts（キーは SETTING_KEYS）。画面の初期値の読み込みと、変更の保存に使う。
 */
import { DEFAULT_HURT, DEFAULT_ENEMY, ENEMY_RESIST_KEYS, type HurtSetting, type EnemySetting } from './gcsim/buildGcsimConfig';
import { DPS_DEFAULT_LOOPS, DPS_DEFAULT_RUNS, DPS_MAX_ENEMIES, DPS_MAX_LOOPS, DPS_MAX_RUNS, type DpsSettings } from './gcsim/dpsCalc';
import { ER_DEFAULT_ENEMY_PARTICLES, type RequiredErResult } from './gcsim/requiredEnergyRecharge';
import { sanitizeBattleCondition, type AppMode, type BattleCondition } from './battleCondition';
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

/** アプリ全体のモード（既定: 通常） */
export function loadAppMode(): AppMode {
  return readString(SETTING_KEYS.appMode) === 'abyss' ? 'abyss' : 'normal';
}

export function saveAppMode(mode: AppMode): void {
  writeString(SETTING_KEYS.appMode, mode);
}

/** 幽境モードの戦闘条件（無い・壊れた項目は既定に戻す） */
export function loadBattleCondition(): BattleCondition {
  return sanitizeBattleCondition(readJson<unknown>(SETTING_KEYS.abyssBattleCondition));
}

export function saveBattleCondition(value: BattleCondition): void {
  writeJson(SETTING_KEYS.abyssBattleCondition, sanitizeBattleCondition(value));
}

const requiredErKey = (mode: AppMode) => (mode === 'abyss' ? SETTING_KEYS.requiredEnergyRechargeAbyss : SETTING_KEYS.requiredEnergyRecharge);

/** 必要元素チャージ効率の最後の算出結果（モードごとに別に持つ。無い・形が違うときは null） */
export function loadRequiredEr(mode: AppMode = 'normal'): RequiredErResult | null {
  const v = readJson<Partial<RequiredErResult>>(requiredErKey(mode));
  if (!v || typeof v !== 'object' || !Array.isArray(v.entries) || typeof v.fingerprint !== 'string' || v.entries.some(e => !e || typeof e.status !== 'string' || (e.status === 'ok' && !Number.isFinite(e.certainEr))) || typeof v.gcsimVersion !== 'string' || !Number.isFinite(v.ranAt)) return null;
  return v as RequiredErResult;
}

/** 算出結果を保存する（そのモードの前の結果は上書き） */
export function saveRequiredEr(value: RequiredErResult, mode: AppMode = 'normal'): void {
  writeJson(requiredErKey(mode), value);
}

/** 記法のモード（既定: 略号） */
export function loadNotationMode(): NotationMode {
  return readString(SETTING_KEYS.rotationNotationMode) === 'name' ? 'name' : 'short';
}

export function saveNotationMode(mode: NotationMode): void {
  writeString(SETTING_KEYS.rotationNotationMode, mode);
}

/** DPS 計算の設定の既定 */
export const defaultDpsSettings = (): DpsSettings => ({ loops: DPS_DEFAULT_LOOPS, runs: DPS_DEFAULT_RUNS, enemies: [structuredClone(DEFAULT_ENEMY)], energy: true, particles: { ...ER_DEFAULT_ENEMY_PARTICLES } });

/** DPS 計算の設定（無い・壊れた項目は既定に戻す） */
export function loadDpsSettings(): DpsSettings {
  const d = defaultDpsSettings();
  const v = readJson<Partial<DpsSettings>>(SETTING_KEYS.dpsSettings);
  if (!v || typeof v !== 'object') return d;
  const int = (x: unknown, lo: number, hi: number, fb: number) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.floor(x as number))) : fb);
  const enemies: EnemySetting[] = Array.isArray(v.enemies)
    ? v.enemies.slice(0, DPS_MAX_ENEMIES).filter(e => e && typeof e === 'object').map(e => ({
      level: int((e as EnemySetting).level, 1, 200, DEFAULT_ENEMY.level),
      resist: Object.fromEntries(ENEMY_RESIST_KEYS.map(k => [k, Number.isFinite((e as EnemySetting).resist?.[k]) ? (e as EnemySetting).resist[k] : DEFAULT_ENEMY.resist[k]])) as EnemySetting['resist'],
    }))
    : [];
  const pv = v.particles as Partial<DpsSettings['particles']> | undefined;
  const nn = (x: unknown, fb: number) => (Number.isFinite(x) && (x as number) >= 0 ? (x as number) : fb);
  const particles = { minSeconds: nn(pv?.minSeconds, d.particles.minSeconds), maxSeconds: nn(pv?.maxSeconds, d.particles.maxSeconds), amount: nn(pv?.amount, d.particles.amount) };
  return { loops: int(v.loops, 1, DPS_MAX_LOOPS, d.loops), runs: int(v.runs, 1, DPS_MAX_RUNS, d.runs), enemies: enemies.length ? enemies : d.enemies, energy: v.energy !== false, particles };
}

export function saveDpsSettings(value: DpsSettings): void {
  writeJson(SETTING_KEYS.dpsSettings, value);
}
