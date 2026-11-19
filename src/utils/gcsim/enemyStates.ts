/**
 * 敵の状態の時間帯（フェーズ8 / issue #54 の段階 4。幽境モードの DPS 計算）。
 *
 * - 「ダメージ無効」: その時間帯に当たったダメージを 0 にする。
 * - 「敵耐性の変化」: その時間帯の、元素別の耐性（元素ごとに、指定したものだけ）。ダメージを、
 *   （変化後の耐性の倍率 ÷ 元の耐性の倍率）倍する。
 * gcsim には渡せない（設定文に、敵の状態を時間で変える命令が無い）ので、アプリ側で、ダメージのログを補正する。
 * 補正は近似: ログには、その時点の敵の耐性が入らないので、耐性ダウンの効果（聖遺物・武器・キャラ）は、元の耐性に含めて考えない
 * （ログの `ele` = ダメージの元素、`target` = 当てた敵の番号で補正する）。
 * 粒子は補正しない（gcsim の動きのまま）。
 * 決定: docs/gcsim-integration/phase-8-abyss-mode/plan.md（Q4・Q4b・Q4c）
 */
import { DEFAULT_ENEMY, ENEMY_RESIST_KEYS, type EnemyResistKey, type EnemySetting } from './buildGcsimConfig';

/**
 * 保存された敵の設定の一覧を、正しい形に直す（壊れた項目は既定の値。上限の体数まで）。1 体も無ければ、空の一覧（呼び出し側が既定にする）。
 * DPS 計算の設定（通常モード）と、幽境モードの戦闘条件の、どちらの保存の読み込みにも使う
 */
export function sanitizeEnemies(v: unknown, max: number): EnemySetting[] {
  if (!Array.isArray(v)) return [];
  const int = (x: unknown, lo: number, hi: number, fb: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.floor(x))) : fb);
  return v.slice(0, max).filter(e => e && typeof e === 'object').map(e => {
    const o = e as Partial<EnemySetting>;
    return {
      level: int(o.level, 1, 200, DEFAULT_ENEMY.level),
      resist: Object.fromEntries(ENEMY_RESIST_KEYS.map(k => [k, typeof o.resist?.[k] === 'number' && Number.isFinite(o.resist[k]) ? o.resist[k] : DEFAULT_ENEMY.resist[k]])) as EnemySetting['resist'],
    };
  });
}

/** 時間帯の種類: ダメージ無効 / 敵耐性の変化 */
export type EnemyStateKind = 'invulnerable' | 'resist';

/** 敵の状態の時間帯 1 件（戦闘開始からの秒。開始以上・終了未満） */
export interface EnemyStateWindow {
  fromSeconds: number;
  toSeconds: number;
  kind: EnemyStateKind;
  /** kind = resist のとき、変化させる元素の耐性（割合: 0.1 = 10%、マイナスも可）。書いていない元素は、元のまま */
  resist?: Partial<Record<EnemyResistKey, number>>;
}

/** 件数・秒の上限（戦闘時間の上限と同じ） */
export const ENEMY_STATE_MAX = 20;
export const ENEMY_STATE_MAX_SECONDS = 600;
/** 耐性の範囲（割合） */
const RESIST_MIN = -1;
const RESIST_MAX = 2;

/** 耐性（割合）から、ダメージの倍率（gcsim・ゲームと同じ式） */
export const resistMultiplier = (r: number): number => (r < 0 ? 1 - r / 2 : r < 0.75 ? 1 - r : 1 / (1 + 4 * r));

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** 保存された時間帯の一覧を、正しい形に直す（壊れた項目・終了が開始以前のもの・耐性の指定が無い耐性変化は捨てる。開始の早い順・上限の件数まで） */
export function sanitizeEnemyStates(list: unknown): EnemyStateWindow[] {
  if (!Array.isArray(list)) return [];
  const out: EnemyStateWindow[] = [];
  for (const w of list) {
    if (!w || typeof w !== 'object') continue;
    const o = w as Partial<Record<keyof EnemyStateWindow, unknown>>;
    if (o.kind !== 'invulnerable' && o.kind !== 'resist') continue;
    if (!finite(o.fromSeconds) || !finite(o.toSeconds)) continue;
    const fromSeconds = Math.round(Math.min(ENEMY_STATE_MAX_SECONDS, Math.max(0, o.fromSeconds)) * 10) / 10;
    const toSeconds = Math.round(Math.min(ENEMY_STATE_MAX_SECONDS, Math.max(0, o.toSeconds)) * 10) / 10;
    if (toSeconds <= fromSeconds) continue;
    if (o.kind === 'invulnerable') { out.push({ fromSeconds, toSeconds, kind: 'invulnerable' }); continue; }
    const src = (o.resist && typeof o.resist === 'object' ? o.resist : {}) as Record<string, unknown>;
    const resist: Partial<Record<EnemyResistKey, number>> = {};
    for (const k of ENEMY_RESIST_KEYS) {
      const v = src[k];
      if (finite(v)) resist[k] = Math.round(Math.min(RESIST_MAX, Math.max(RESIST_MIN, v)) * 1000) / 1000;
    }
    if (Object.keys(resist).length === 0) continue;
    out.push({ fromSeconds, toSeconds, kind: 'resist', resist });
  }
  return out.sort((a, b) => a.fromSeconds - b.fromSeconds || a.toSeconds - b.toSeconds).slice(0, ENEMY_STATE_MAX);
}

/**
 * ダメージ 1 件の補正の倍率を返す関数を作る。
 * - `frame` を含む「ダメージ無効」の時間帯があれば 0
 * - 「耐性の変化」の時間帯があり、その元素の耐性を指定していれば、（変化後の倍率 ÷ 元の倍率）。時間帯が重なるときは、開始の遅い（一覧の後ろの）ものを優先
 * - ほかは 1（時間帯なし・元素が不明・耐性を指定していない元素）
 * 元の耐性は、`target`（1 始まりの敵の番号。無ければ 1 体目）の設定から
 */
export function makeDamageFactor(windows: EnemyStateWindow[] | undefined, enemies: EnemySetting[] | undefined): (frame: number, ele: unknown, target: unknown) => number {
  const list = (windows ?? []).map(w => ({ ...w, from: Math.round(w.fromSeconds * 60), to: Math.round(w.toSeconds * 60) }));
  if (list.length === 0) return () => 1;
  const baseOf = (target: unknown, key: EnemyResistKey): number => {
    const i = finite(target) && target >= 1 ? Math.floor(target) - 1 : 0;
    const e = enemies?.[i] ?? enemies?.[0];
    const r = e?.resist?.[key];
    return finite(r) ? r : 0.1;
  };
  return (frame, ele, target) => {
    let factor = 1;
    let byElement: number | undefined;
    for (const w of list) {
      if (frame < w.from || frame >= w.to) continue;
      if (w.kind === 'invulnerable') return 0;
      const key = ENEMY_RESIST_KEYS.find(k => k === ele);
      const next = key ? w.resist?.[key] : undefined;
      if (key && next !== undefined) byElement = resistMultiplier(next) / resistMultiplier(baseOf(target, key));
    }
    if (byElement !== undefined) factor = byElement;
    return factor;
  };
}
