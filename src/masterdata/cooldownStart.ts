/**
 * CTの開始位置の読み取り（フェーズ5 / 5-4、D37・D44）
 *
 * gcsim の skill.go / burst.go の `SetCD` / `SetCDWithDelay` の遅れフレームを読み取り、
 * スキル・爆発の各アクションに「CT開始位置」（基準 + 遅れ秒）を持たせる。
 *   - `SetCD(...)`                      → 動作開始と同時（遅れ 0）
 *   - `SetCDWithDelay(..., <遅れ>)`     → 動作開始から <遅れ> フレーム後
 * 遅れが長押しの長さ（hold / duration など）に依存するもの・添字が状態で決まる配列・評価できない式は、自動では読まず、
 * 手で補う一覧（cooldownStartOverrides.ts）で補う。それでも決まらないものは未設定にして、レポートに出す。
 */
import type { CooldownStart } from '../types/genshin.ts';
import { evaluateGoExpr, type ParsedGoFile } from './gcsimParser.ts';
import { COOLDOWN_START_OVERRIDES } from './cooldownStartOverrides.ts';

export type CooldownCallKind = 'skill' | 'burst';

/** 遅れを自動で読めなかった理由 */
export type CooldownCallProblem = 'hold' | 'array' | 'local' | 'unresolved';

export interface CooldownCall {
  kind: CooldownCallKind;
  /** 呼び出しを含む関数名 */
  func: string;
  /** 遅れの式（`SetCD` は遅れなしなので null） */
  delayExpr: string | null;
  /** 遅れのフレーム数（読めなければ undefined） */
  delayFrames?: number;
  /** ホールド依存の式を、ホールド 0 として評価した値（一回押しの読み取り用） */
  delayFramesAtHold0?: number;
  problem?: CooldownCallProblem;
}

/** ホールドの長さを表す gcsim の変数名 */
const HOLD_IDENT = /\b(hold|holdTicks|duration|extraDuration|extend)\b/;

const CALL_RE = /SetCD(WithDelay)?\(\s*action\.Action(Skill|Burst)\s*,\s*(.*)\)\s*$/;
const FUNC_RE = /^func\s+(?:\([^)]*\)\s*)?(\w+)/;

/** 最後のトップレベルのカンマで、引数の列を「それまで」と「最後の引数」に分ける */
function splitLastArg(args: string): { head: string; last: string } | undefined {
  let depth = 0;
  let idx = -1;
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) idx = i;
  }
  if (idx < 0) return undefined;
  return { head: args.slice(0, idx), last: args.slice(idx + 1).trim() };
}

/** 1つの Go ソース（skill.go / burst.go）から CT を開始する呼び出しを集める */
export function parseCooldownCalls(source: string, parsed: ParsedGoFile): CooldownCall[] {
  const calls: CooldownCall[] = [];
  // 関数の中で `x := ...` と宣言されている変数（値がその場の状態で決まるため、定数として読まない）
  const locals = new Set([...source.matchAll(/^[ \t]+(\w+)\s*:=/gm)].map(m => m[1]));
  let func = '';
  for (const raw of source.split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').replace(/\r$/, '');
    const f = FUNC_RE.exec(line);
    if (f) func = f[1];
    const m = CALL_RE.exec(line);
    if (!m) continue;
    const kind: CooldownCallKind = m[2] === 'Burst' ? 'burst' : 'skill';
    if (!m[1]) {
      calls.push({ kind, func, delayExpr: null, delayFrames: 0 });
      continue;
    }
    const split = splitLastArg(m[3]);
    if (!split) continue;
    const expr = split.last;
    const call: CooldownCall = { kind, func, delayExpr: expr };
    if (HOLD_IDENT.test(expr)) {
      call.problem = 'hold';
      call.delayFramesAtHold0 = evaluateGoExpr(expr.replace(new RegExp(HOLD_IDENT, 'g'), '0'), parsed);
    } else if (/\[[^\]\d]/.test(expr)) {
      call.problem = 'array';
    } else if ((expr.match(/[A-Za-z_]\w*/g) ?? []).some(id => locals.has(id))) {
      call.problem = 'local';
    } else {
      const v = evaluateGoExpr(expr, parsed);
      if (v === undefined) call.problem = 'unresolved';
      else call.delayFrames = v;
    }
    calls.push(call);
  }
  return calls;
}

/** 呼び出しがどのアクションのものか（アクション定義 ID の末尾で決まる） */
export type CooldownRole = 'tap' | 'hold' | 'shortHold' | 'burst';

export function roleOfFunc(func: string, kind: CooldownCallKind): CooldownRole | undefined {
  if (kind === 'burst') return /burst/i.test(func) ? 'burst' : undefined;
  if (/short/i.test(func) && /hold/i.test(func)) return 'shortHold';
  if (/hold/i.test(func)) return 'hold';
  if (/^(skill|skillPress|pressSkill|skillTap|skillFirst)$/i.test(func)) return 'tap';
  return undefined;
}

/** アクション定義 ID → 呼び出しの種類と役割。0Ticks・最大ホールドなど gcsim の関数で分けにくいものは、役割なし（手で補う） */
export function roleOfAction(actionId: string): { kind: CooldownCallKind; role?: CooldownRole } | undefined {
  if (actionId.endsWith('_q')) return { kind: 'burst', role: 'burst' };
  if (actionId.endsWith('_e_shorthold')) return { kind: 'skill', role: 'shortHold' };
  if (actionId.endsWith('_e_hold')) return { kind: 'skill', role: 'hold' };
  if (/_e_shorthold0ticks$/.test(actionId)) return { kind: 'skill' };
  if (actionId.endsWith('_e')) return { kind: 'skill', role: 'tap' };
  return undefined;
}

export interface CooldownStartResolution {
  cooldownStart?: CooldownStart;
  cooldownPerHold?: number;
  /** ホールド 0 のときの CT（秒）。あればマスターの cooldown をこの値にする */
  baseCooldown?: number;
  /** frames に含まれる長押しの秒数 */
  holdInFrames?: number;
  /** 出典（dataSource.cooldownStart） */
  source?: string;
  status: 'read' | 'manual' | 'unresolved';
  /** 未設定の理由・手で補う値と自動読み取りの食い違いなど */
  reason?: string;
  /** 手で補う値と、自動で読めた値が食い違うとき */
  mismatch?: { readFrames: number; manualFrames: number };
}

export const framesToSeconds = (f: number) => Number((f / 60).toFixed(3));

/**
 * アクション1つの CT開始位置を決める。
 * @param calls そのキャラの skill.go / burst.go の呼び出し（gcsim 未実装なら undefined）
 */
export function resolveCooldownStart(actionId: string, calls: CooldownCall[] | undefined): CooldownStartResolution {
  const target = roleOfAction(actionId);
  const manual = COOLDOWN_START_OVERRIDES[actionId];

  // 自動読み取り
  let read: { frames: number; source: string } | undefined;
  let readReason: string | undefined;
  if (!calls) {
    readReason = 'gcsim 未実装';
  } else if (!target?.role) {
    readReason = 'gcsim の関数と対応付けられない派生アクション';
  } else {
    const byRole = (role: CooldownRole) => calls.filter(c => c.kind === target.kind && roleOfFunc(c.func, c.kind) === role);
    // 長押しの関数が無いキャラは、ホールドを引数（hold など）で受ける共通の Skill 関数の CT をそのまま使う
    let candidates = byRole(target.role);
    if (candidates.length === 0 && (target.role === 'hold' || target.role === 'shortHold')) candidates = byRole('tap');
    if (candidates.length === 0) {
      readReason = `gcsim に ${target.kind === 'burst' ? '爆発' : 'スキル'}のCT開始の呼び出しが見つからない`;
    } else {
      const values = new Set<number>();
      const problems: string[] = [];
      for (const c of candidates) {
        // 一回押しは、ホールドの引数が既定値 0 の場合の値を使う
        const frames = c.problem === 'hold' && target.role === 'tap' ? c.delayFramesAtHold0 : c.delayFrames;
        if (frames !== undefined) values.add(frames);
        else problems.push(`${c.func}: ${c.delayExpr}（${c.problem === 'hold' ? 'ホールド依存' : c.problem === 'array' ? '添字が状態で決まる配列' : c.problem === 'local' ? '関数内の変数で決まる' : '式を評価できない'}）`);
      }
      if (problems.length > 0) readReason = problems.join(' / ');
      else if (values.size > 1) readReason = `呼び出しごとに値が異なる（${[...values].join('f / ')}f）`;
      else {
        const c = candidates[0];
        read = { frames: [...values][0], source: `${target.kind}.go:${c.delayExpr ?? 'SetCD（遅れなし）'}` };
      }
    }
  }

  if (manual) {
    const mismatch = read && read.frames !== manual.delayFrames && manual.from === 'motionStart'
      ? { readFrames: read.frames, manualFrames: manual.delayFrames }
      : undefined;
    return {
      cooldownStart: { from: manual.from, delay: framesToSeconds(manual.delayFrames) },
      ...(manual.cooldownPerHold !== undefined ? { cooldownPerHold: manual.cooldownPerHold } : {}),
      ...(manual.baseCooldown !== undefined ? { baseCooldown: manual.baseCooldown } : {}),
      ...(manual.holdInFrames !== undefined ? { holdInFrames: framesToSeconds(manual.holdInFrames) } : {}),
      source: `manual: ${manual.note}`,
      status: 'manual',
      ...(mismatch ? { mismatch } : {}),
    };
  }
  if (read) {
    return {
      cooldownStart: { from: 'motionStart', delay: framesToSeconds(read.frames) },
      source: read.source,
      status: 'read',
    };
  }
  return { status: 'unresolved', reason: readReason };
}
