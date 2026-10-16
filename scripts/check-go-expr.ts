/**
 * gcsim のソースの算術式の評価（src/masterdata/gcsimParser.ts の evaluateGoExpr）の確認。
 *
 *   npm run check:go-expr
 *
 * Go では、整数同士の割り算は切り捨てになる（7 / 2 = 3）。小数・float64 を含む式は、そのまま割る。
 */
import assert from 'node:assert/strict';
import { evaluateGoExpr, parseGoFile } from '../src/masterdata/gcsimParser.ts';

const parsed = parseGoFile('');
const ev = (e: string) => evaluateGoExpr(e, parsed);

assert.equal(ev('7 / 2'), 3, '整数同士は切り捨て');
assert.equal(ev('-7 / 2'), -3, '負の数は 0 に向かって切り捨て（Go と同じ）');
assert.equal(ev('(10 + 5) / 4 * 4'), 12, '左から順に評価（切り捨て後に掛ける）');
assert.equal(ev('float64(7) / 2'), 3.5, 'float64 を含む式は切り捨てない');
assert.equal(ev('7 / 2.0'), 3.5, '小数を含む式は切り捨てない');
assert.equal(ev('6 / 3'), 2);
assert.equal(ev('1 / 0'), undefined, '0 での割り算は評価しない');
assert.equal(ev('2 + 3 * 4'), 14);

// 定数の型: 小数（7.0）で定義した定数は、整数として扱わない（Go の型の規則）
const typed = parseGoFile(['t = 7.0', 'n = 7', 'u := 7.5', 'w = t * 2'].join('\n'));
const evt = (e: string) => evaluateGoExpr(e, typed);
assert.equal(evt('t / 2'), 3.5, '7.0 で定義した定数は小数（切り捨てない）');
assert.equal(evt('n / 2'), 3, '7 で定義した定数は整数（切り捨てる）');
assert.equal(evt('u / 2'), 3.75);
assert.equal(evt('w / 3'), 14 / 3, '小数の定数から作った定数も、小数');
assert.equal(evt('7 / 2 * 1.5'), 4.5, '左から順に、整数同士の割り算（切り捨て）の後で、小数を掛ける');
assert.equal(evt('int(7.5) / 2'), 3, 'int() は整数にする');
assert.equal(evt('float64(n) / 2'), 3.5);
// ファイル間で共有する定数（小数の情報も共有する）
const shared = parseGoFile('v = 9 / t', typed.consts, typed.floats);
assert.ok(shared.floats.has('t') && shared.consts.get('v') === 9 / 7);

console.log('✓ Go の算術式の評価: 16 項目すべて合格');
