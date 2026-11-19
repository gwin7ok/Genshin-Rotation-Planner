/**
 * 戦闘条件（フェーズ8 / issue #54。通常モード・幽境モードの切り替えと、幽境モードの条件）。
 *
 * - アプリ全体のモード（AppMode）: 通常（従来どおり）/ 幽境（開始エネルギー 0・時刻指定の粒子・戦闘時間）。
 * - 幽境モードの戦闘条件（BattleCondition）は、ER 計算と DPS 計算で共通の設定（D364）。
 *   DPS 計算だけが使う分（敵・敵の状態の時間帯。段階 4）も、同じ条件に入れる（ボスごとの条件の保存に含めるため。D368）。
 * - 保存は appSettings.ts。ここは、型・既定値・読み込み時の検査だけ（純粋なロジック）。
 * 決定: docs/gcsim-integration/phase-8-abyss-mode/plan.md
 */
import {
  ABYSS_DEFAULT_BATTLE_SECONDS,
  ABYSS_DEFAULT_FIRST_BURST_WAIT_SECONDS,
  ABYSS_MAX_BATTLE_SECONDS,
  ABYSS_MAX_TIMED_PARTICLES,
  ER_DEFAULT_ENEMY_PARTICLES,
  type AbyssRunCondition,
  type EnemyParticles,
  type TimedParticle,
} from './gcsim/requiredEnergyRecharge';
import { DEFAULT_ENEMY, type EnemySetting } from './gcsim/buildGcsimConfig';
import { DPS_MAX_ENEMIES } from './gcsim/dpsCalc';
import { sanitizeEnemies, sanitizeEnemyStates, type EnemyStateWindow } from './gcsim/enemyStates';

/** アプリ全体のモード */
export type AppMode = 'normal' | 'abyss';

/** 時刻指定の粒子の秒の上限（戦闘時間の上限と同じ） */
const TIMED_MAX_SECONDS = ABYSS_MAX_BATTLE_SECONDS;
/** 時刻指定の粒子の 1 件の個数の上限 */
const TIMED_MAX_AMOUNT = 99;

/** 幽境モードの戦闘条件 */
export interface BattleCondition extends AbyssRunCondition {
  /** 敵から出る周期の粒子（通常モードの敵の粒子とは別に、幽境モードの値として持つ） */
  enemyParticles: EnemyParticles;
  /** 敵（レベル・耐性。DPS 計算が使う。通常モードの DPS 計算の敵とは別に、幽境モードの値として持つ。ボスごとの条件に含める） */
  enemies: EnemySetting[];
  /** 敵の状態の時間帯（ダメージ無効・敵耐性の変化。DPS 計算が、ダメージの補正に使う。D368） */
  enemyStates: EnemyStateWindow[];
}

export const defaultBattleCondition = (): BattleCondition => ({
  battleSeconds: ABYSS_DEFAULT_BATTLE_SECONDS,
  firstBurstWaitSeconds: ABYSS_DEFAULT_FIRST_BURST_WAIT_SECONDS,
  timedParticles: [],
  enemyParticles: { ...ER_DEFAULT_ENEMY_PARTICLES },
  enemies: [structuredClone(DEFAULT_ENEMY)],
  enemyStates: [],
});

const finiteOr = (x: unknown, fallback: number, lo: number, hi: number): number => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fallback);

/** 時刻指定の粒子の一覧を、正しい範囲に直す（不正な項目は捨てる。上限の件数まで。時刻の早い順） */
export function sanitizeTimedParticles(list: unknown): TimedParticle[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((p): p is { seconds: unknown; amount: unknown } => !!p && typeof p === 'object')
    .map(p => ({ seconds: finiteOr(p.seconds, NaN, 0, TIMED_MAX_SECONDS), amount: Math.round(finiteOr(p.amount, NaN, 0, TIMED_MAX_AMOUNT)) }))
    .filter(p => Number.isFinite(p.seconds) && p.amount >= 1)
    .map(p => ({ seconds: Math.round(p.seconds * 10) / 10, amount: p.amount }))
    .sort((a, b) => a.seconds - b.seconds)
    .slice(0, ABYSS_MAX_TIMED_PARTICLES);
}

/** 保存された戦闘条件を、正しい形に直す（無い・壊れた項目は既定。保存の読み込み・画面の入力の確定に使う） */
export function sanitizeBattleCondition(v: unknown): BattleCondition {
  const d = defaultBattleCondition();
  if (!v || typeof v !== 'object') return d;
  const o = v as Partial<Record<keyof BattleCondition, unknown>>;
  const ep = (o.enemyParticles && typeof o.enemyParticles === 'object' ? o.enemyParticles : {}) as Partial<EnemyParticles>;
  const minSeconds = finiteOr(ep.minSeconds, d.enemyParticles.minSeconds, 0, 600);
  const maxSeconds = finiteOr(ep.maxSeconds, d.enemyParticles.maxSeconds, 0, 600);
  return {
    battleSeconds: Math.round(finiteOr(o.battleSeconds, d.battleSeconds, 10, ABYSS_MAX_BATTLE_SECONDS)),
    firstBurstWaitSeconds: Math.round(finiteOr(o.firstBurstWaitSeconds, d.firstBurstWaitSeconds, 0, 60) * 10) / 10,
    timedParticles: sanitizeTimedParticles(o.timedParticles),
    enemyParticles: { minSeconds: Math.min(minSeconds, maxSeconds), maxSeconds: Math.max(minSeconds, maxSeconds), amount: finiteOr(ep.amount, d.enemyParticles.amount, 0, 99) },
    // 敵・時間帯が無い古い保存は、既定（敵 1 体・時間帯なし）
    enemies: (() => { const e = sanitizeEnemies(o.enemies, DPS_MAX_ENEMIES); return e.length > 0 ? e : d.enemies; })(),
    enemyStates: sanitizeEnemyStates(o.enemyStates),
  };
}

/** 名前を付けて保存した戦闘条件（ボスごとの条件の呼び出し用。D367）。キーは名前ではなく id */
export interface BattleConditionPreset {
  id: string;
  name: string;
  condition: BattleCondition;
}

/** 保存できる件数・名前の長さの上限 */
export const BATTLE_PRESET_MAX = 30;
export const BATTLE_PRESET_NAME_MAX = 40;

/** 保存された戦闘条件の一覧を、正しい形に直す（壊れた項目・id の重複・名前の無いものは捨てる。上限の件数まで） */
export function sanitizeBattlePresets(v: unknown): BattleConditionPreset[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: BattleConditionPreset[] = [];
  for (const p of v) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Partial<Record<keyof BattleConditionPreset, unknown>>;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, BATTLE_PRESET_NAME_MAX) : '';
    if (typeof o.id !== 'string' || o.id === '' || seen.has(o.id) || name === '') continue;
    seen.add(o.id);
    out.push({ id: o.id, name, condition: sanitizeBattleCondition(o.condition) });
    if (out.length >= BATTLE_PRESET_MAX) break;
  }
  return out;
}

/**
 * 名前を付けて保存する。同じ名前（前後の空白を除いて比べる）があれば、その条件を上書きする（id は変えない）。
 * 名前が空のとき・上限に達していて新しく足せないときは、変えずに reason を返す
 */
export function savePreset(
  list: BattleConditionPreset[],
  name: string,
  condition: BattleCondition,
  newId: () => string,
): { list: BattleConditionPreset[]; id?: string; overwritten?: boolean; reason?: 'empty' | 'full' } {
  const trimmed = name.trim().slice(0, BATTLE_PRESET_NAME_MAX);
  if (trimmed === '') return { list, reason: 'empty' };
  const cond = sanitizeBattleCondition(condition);
  const existing = list.find(p => p.name === trimmed);
  if (existing) return { list: list.map(p => (p.id === existing.id ? { ...p, condition: cond } : p)), id: existing.id, overwritten: true };
  if (list.length >= BATTLE_PRESET_MAX) return { list, reason: 'full' };
  const id = newId();
  return { list: [...list, { id, name: trimmed, condition: cond }], id, overwritten: false };
}

/** 一覧から消す */
export const removePreset = (list: BattleConditionPreset[], id: string): BattleConditionPreset[] => list.filter(p => p.id !== id);

/**
 * gcsim の粒子の設定（`energy` の行）の制限。**gcsim は、`energy` の行を、最後の 1 行しか使わない**（種類を問わず。2026-11-19 の実測。D369）。
 * 設定文は、敵の周期の粒子（`energy every`）の次に、時刻指定の粒子（`energy once`。時刻の早い順）を出すので、実際に効くのは次のとおり:
 * - 時刻指定の粒子が 1 件以上ある: いちばん遅い 1 件だけ。ほかの時刻指定の粒子と、敵の周期の粒子は、効かない
 * - 時刻指定の粒子が無い: 敵の周期の粒子（個数・間隔が有効なとき）
 * 戻り値: ignoredTimed = 効かない時刻指定の粒子の件数・usedTimedSeconds = 効く 1 件の時刻（無ければ undefined）・periodicIgnored = 敵の周期の粒子が効かない
 *
 * これは、**gcsim の実行だけ**に当てはまる制限（DPS 計算・爆発のタイミングの確認）。**ER 計算は、gcsim に渡せない時刻指定の粒子を、アプリが時系列に書き足す**ので、
 * 制限を受けない（D371。`splitTimedParticles`）
 */
export function particleLimits(c: Pick<BattleCondition, 'timedParticles' | 'enemyParticles'>): { ignoredTimed: number; usedTimedSeconds?: number; periodicIgnored: boolean } {
  const timed = [...c.timedParticles].sort((a, b) => a.seconds - b.seconds);
  const periodicOn = c.enemyParticles.amount > 0 && c.enemyParticles.maxSeconds > 0;
  if (timed.length === 0) return { ignoredTimed: 0, periodicIgnored: false };
  return { ignoredTimed: timed.length - 1, usedTimedSeconds: timed[timed.length - 1].seconds, periodicIgnored: periodicOn };
}

/** 戦闘条件のうち、ER の計算に渡す分（ダメージ無効の時間帯は、あるときだけ入れる） */
export const toAbyssRunCondition = (c: BattleCondition): AbyssRunCondition => {
  const invulnerable = c.enemyStates.filter(s => s.kind === 'invulnerable').map(s => ({ fromSeconds: s.fromSeconds, toSeconds: s.toSeconds }));
  return {
    battleSeconds: c.battleSeconds,
    firstBurstWaitSeconds: c.firstBurstWaitSeconds,
    timedParticles: c.timedParticles.map(p => ({ ...p })),
    ...(invulnerable.length > 0 ? { invulnerable } : {}),
  };
};

/** 2 つの戦闘条件が同じか（結果が、いまの条件で求めたものかの判定に使う） */
export const sameAbyssRunCondition = (a: AbyssRunCondition | undefined, b: AbyssRunCondition | undefined): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
