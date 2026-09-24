/**
 * gcsim (https://github.com/genshinsim/gcsim) の Go ソースからモーションフレーム定義を抽出するパーサー。
 *
 * gcsim ではアクションごとに次のような定義が書かれている:
 *   const skillPressHitmark = 10
 *   skillPressFrames = frames.InitAbilSlice(77)          // 全体フレーム (AnimationLength)
 *   skillPressFrames[action.ActionDash] = 61             // 次アクションへのキャンセルフレーム
 *   attackFrames[0] = frames.InitNormalCancelSlice(attackHitmarks[0][0], 24)
 *
 * ここでは Go を完全に解釈せず、行単位で定数・配列・フレームテーブルを拾い、
 * 簡単な算術式 (定数参照、配列添字、+ - * /) だけを評価する。
 * 評価できなかった値は捏造せず undefined のままにする。
 */

import type { CancelTarget } from '../types/genshin.ts';

export interface FrameTable {
  /** テーブル名 (例: "skillPressFrames", "attackFrames[2]") */
  name: string;
  /** 全体フレーム (InitAbilSlice / InitNormalCancelSlice の最終引数) */
  total: number;
  /** ヒットマーク (InitNormalCancelSlice の第1引数、または同名 Hitmark 定数) */
  hitmark?: number;
  /** 次アクション種別ごとのキャンセル可能フレーム (total と異なるもののみ) */
  cancels: Partial<Record<CancelTarget, number>>;
}

/**
 * gcsim の frames.InitNormalCancelSlice は、通常攻撃のキャンセル表を
 * 「全体 = animation、ただし下記アクションへは hitmark でキャンセル可」として初期化する。
 * (internal/frames/frames.go)
 */
const NORMAL_CANCEL_AT_HITMARK: CancelTarget[] = ['aim', 'skill', 'burst', 'dash', 'jump', 'swap'];

export interface ParsedGoFile {
  consts: Map<string, number>;
  intArrays: Map<string, number[] | number[][]>;
  tables: FrameTable[];
  /** NewAttackFunc(c.Character, X) で参照されているテーブル名 */
  attackFuncTables: string[];
  /** 評価できなかった式 (レポート用) */
  unresolved: string[];
}

const ACTION_NAME_MAP: Record<string, CancelTarget> = {
  Attack: 'attack',
  Charge: 'charge',
  Aim: 'aim',
  Skill: 'skill',
  Burst: 'burst',
  Dash: 'dash',
  Jump: 'jump',
  Walk: 'walk',
  Swap: 'swap',
  LowPlunge: 'lowPlunge',
  HighPlunge: 'highPlunge',
};

// ---------------------------------------------------------------------------
// 算術式評価 (数値 / 定数 / 配列添字 / + - * / / 括弧)
// ---------------------------------------------------------------------------

type Lookup = (ident: string, indices: number[]) => number | undefined;
type ArrayLookup = (ident: string) => unknown[] | undefined;

function evalExpr(expr: string, lookup: Lookup, lookupArray: ArrayLookup): number | undefined {
  const src = expr.trim();
  let pos = 0;

  const skipWs = () => { while (pos < src.length && /\s/.test(src[pos])) pos++; };

  const parsePrimary = (): number | undefined => {
    skipWs();
    const ch = src[pos];
    if (ch === '(') {
      pos++;
      const v = parseAdd();
      skipWs();
      if (src[pos] !== ')') return undefined;
      pos++;
      return v;
    }
    if (ch === '-') {
      pos++;
      const v = parsePrimary();
      return v === undefined ? undefined : -v;
    }
    const num = /^\d+(?:\.\d+)?/.exec(src.slice(pos));
    if (num) {
      pos += num[0].length;
      return parseFloat(num[0]);
    }
    const ident = /^[A-Za-z_][\w.]*/.exec(src.slice(pos));
    if (ident) {
      pos += ident[0].length;
      // len(arr)
      if (ident[0] === 'len' && src[pos] === '(') {
        const inner = /^\(\s*(\w+)\s*\)/.exec(src.slice(pos));
        if (!inner) return undefined;
        pos += inner[0].length;
        const arr = lookupArray(inner[1]);
        return arr ? arr.length : undefined;
      }
      const indices: number[] = [];
      while (src[pos] === '[') {
        pos++;
        const idx = parseAdd();
        skipWs();
        if (src[pos] !== ']' || idx === undefined) return undefined;
        pos++;
        indices.push(idx);
      }
      // 型変換 int(x) / float64(x) はそのまま中身を評価
      if ((ident[0] === 'int' || ident[0] === 'float64') && src[pos] === '(') {
        return parsePrimary();
      }
      return lookup(ident[0], indices);
    }
    return undefined;
  };

  const parseMul = (): number | undefined => {
    let left = parsePrimary();
    for (;;) {
      skipWs();
      const op = src[pos];
      if (op !== '*' && op !== '/') return left;
      pos++;
      const right = parsePrimary();
      if (left === undefined || right === undefined) return undefined;
      left = op === '*' ? left * right : left / right;
    }
  };

  function parseAdd(): number | undefined {
    let left = parseMul();
    for (;;) {
      skipWs();
      const op = src[pos];
      if (op !== '+' && op !== '-') return left;
      pos++;
      const right = parseMul();
      if (left === undefined || right === undefined) return undefined;
      left = op === '+' ? left + right : left - right;
    }
  }

  const value = parseAdd();
  skipWs();
  if (pos !== src.length || value === undefined || !Number.isFinite(value)) return undefined;
  return value;
}

function parseIntList(body: string): number[] | number[][] | undefined {
  const trimmed = body.trim();
  if (trimmed.startsWith('{')) {
    const rows: number[][] = [];
    const re = /\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(trimmed))) {
      const row = m[1].split(',').map(s => s.trim()).filter(Boolean).map(Number);
      if (row.some(n => Number.isNaN(n))) return undefined;
      rows.push(row);
    }
    return rows;
  }
  const flat = trimmed.split(',').map(s => s.trim()).filter(Boolean).map(Number);
  if (flat.some(n => Number.isNaN(n))) return undefined;
  return flat;
}

// ---------------------------------------------------------------------------
// ファイル解析
// ---------------------------------------------------------------------------

// 行コメントを除去し、単独行の `const x = 1` / `var x = 1` の宣言キーワードを外す
const normalizeLine = (line: string) => line.replace(/\/\/.*$/, '').replace(/^(\s*)(?:const|var)\s+/, '$1');

/**
 * 1ファイル分の Go ソースを解析する。
 * sharedConsts には同じキャラの他ファイルで見つかった定数を渡す (ファイル間参照の解決用)。
 */
export function parseGoFile(source: string, sharedConsts?: Map<string, number>): ParsedGoFile {
  const lines = source.split('\n').map(normalizeLine);
  const consts = new Map<string, number>(sharedConsts ?? []);
  const intArrays = new Map<string, number[] | number[][]>();
  const unresolved: string[] = [];

  // 1st pass: 整数配列リテラル (attackHitmarks = [][]int{{14}, {9}} など)
  const joined = lines.join('\n');
  const arrRe = /(\w+)\s*(?:=|:=)\s*\[\](?:\[\])?int\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  let am: RegExpExecArray | null;
  while ((am = arrRe.exec(joined))) {
    const parsed = parseIntList(am[2]);
    if (parsed) intArrays.set(am[1], parsed);
  }

  const lookup: Lookup = (ident, indices) => {
    if (indices.length === 0) return consts.get(ident);
    const arr = intArrays.get(ident);
    if (!arr) return undefined;
    let cur: unknown = arr;
    for (const i of indices) {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[i];
    }
    return typeof cur === 'number' ? cur : undefined;
  };
  const lookupArray: ArrayLookup = ident => intArrays.get(ident);
  const evaluate = (expr: string) => evalExpr(expr, lookup, lookupArray);

  // 2nd pass: スカラー定数 (`name = expr` / `name := expr`)
  // 前方参照があるため数回繰り返す。
  const scalarRe = /^\s*([A-Za-z_]\w*)\s*(?::=|=)\s*([^=].*)$/;
  for (let iter = 0; iter < 3; iter++) {
    for (const line of lines) {
      const m = scalarRe.exec(line);
      if (!m || consts.has(m[1])) continue;
      if (/frames\.|\[\]|make\(|func|\{/.test(m[2])) continue;
      const v = evaluate(m[2]);
      if (v !== undefined) consts.set(m[1], v);
    }
  }

  // 3rd pass: フレームテーブル (添字は数値でも識別子でも可: skillFrames[ousia])
  const tables = new Map<string, FrameTable>();
  const abilRe = /^\s*(\w+(?:\[\w+\])*)\s*=\s*frames\.InitAbilSlice\((.+)\)\s*$/;
  const normalRe = /^\s*(\w+(?:\[\w+\])*)\s*=\s*frames\.InitNormalCancelSlice\((.+),\s*([^,]+)\)\s*$/;
  const cancelRe = /^\s*(\w+(?:\[\w+\])*)\[action\.Action(\w+)\]\s*=\s*(.+)$/;

  for (const line of lines) {
    let m = abilRe.exec(line);
    if (m) {
      const total = evaluate(m[2]);
      if (total === undefined) { unresolved.push(line.trim()); continue; }
      tables.set(m[1], { name: m[1], total, cancels: {} });
      continue;
    }
    m = normalRe.exec(line);
    if (m) {
      const hitmark = evaluate(m[2]);
      const total = evaluate(m[3]);
      if (total === undefined) { unresolved.push(line.trim()); continue; }
      const cancels: FrameTable['cancels'] = {};
      if (hitmark !== undefined) {
        for (const t of NORMAL_CANCEL_AT_HITMARK) cancels[t] = hitmark;
      }
      tables.set(m[1], { name: m[1], total, hitmark, cancels });
      continue;
    }
    m = cancelRe.exec(line);
    if (m) {
      const table = tables.get(m[1]);
      const target = ACTION_NAME_MAP[m[2]];
      if (!table || !target) continue;
      const v = evaluate(m[3]);
      if (v === undefined) { unresolved.push(line.trim()); continue; }
      table.cancels[target] = v;
    }
  }

  // total と同じ値のキャンセルは冗長なので落とす
  for (const table of tables.values()) {
    for (const [k, v] of Object.entries(table.cancels)) {
      if (v === table.total) delete table.cancels[k as CancelTarget];
    }
  }

  const attackFuncTables = [...joined.matchAll(/frames\.NewAttackFunc(?:WithOffset)?\(\s*c\.Character\s*,\s*(\w+)/g)].map(x => x[1]);

  return { consts, intArrays, tables: [...tables.values()], attackFuncTables, unresolved };
}

/** テーブル名から対応するヒットマーク定数を推定する (例: skillPressFrames → skillPressHitmark) */
export function findHitmark(table: FrameTable, consts: Map<string, number>): number | undefined {
  if (table.hitmark !== undefined) return table.hitmark;
  const base = table.name.replace(/\[\w+\]/g, '').replace(/Frames?$/, '');
  const candidates = [
    `${base}Hitmark`, `${base}HitMark`, `${base}Start`, `${base}StartFrame`, `${base}Release`,
  ];
  for (const c of candidates) {
    const v = consts.get(c);
    if (v !== undefined) return v;
  }
  return undefined;
}
