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

console.log('✓ Go の算術式の評価: 8 項目すべて合格');
