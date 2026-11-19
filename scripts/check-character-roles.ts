/**
 * キャラの役割（アタッカー・サブアタッカー・サポーター）の検査。
 *   - マスターの全キャラに、役割が 1 つ以上ある
 *   - マスターの roles が、初期値の表（src/masterdata/characterRoles.ts）と一致する
 *   - 表に、マスターに無いキャラ ID がない
 *
 *   npm run check:roles
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { CHARACTER_ROLES } from '../src/masterdata/characterRoles.ts';
import { createServer } from 'vite';

const master: { id: string; name: string; roles?: string[] }[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const VALID = new Set(['attacker', 'subAttacker', 'supporter']);
const errors: string[] = [];
const ids = new Set(master.map(c => c.id));
for (const c of master) {
  const table = CHARACTER_ROLES[c.id];
  if (!table || table.length === 0) { errors.push(`${c.name}(${c.id}): 初期値の表に役割がない`); continue; }
  if (table.some(r => !VALID.has(r)) || new Set(table).size !== table.length) errors.push(`${c.name}: 役割が不正（${table.join(',')}）`);
  if (JSON.stringify(c.roles) !== JSON.stringify(table)) errors.push(`${c.name}: マスターの roles（${JSON.stringify(c.roles)}）が表（${JSON.stringify(table)}）と違う。npm run build:master`);
}
for (const id of Object.keys(CHARACTER_ROLES)) if (!ids.has(id)) errors.push(`表のキャラ ID ${id} が、マスターにない`);
// 利用者の上書き（アプリの部品は拡張子なしで読み合うので、vite で読み込む）
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { setPersistenceBackend } = await server.ssrLoadModule('/src/utils/persistence.ts');
const { effectiveRoles, loadRoleOverrides, saveRoleOverride, sanitizeRoleOverrides } = await server.ssrLoadModule('/src/utils/characterRoleStore.ts');
// 利用者の上書き（保存・初期値に戻る・壊れた値の除去）
const mem = new Map<string, string>();
setPersistenceBackend({ getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
const c = master[0];
assert.deepEqual(effectiveRoles(c), c.roles, '上書きなし = 初期値');
saveRoleOverride(c.id, ['supporter', 'attacker'], c.roles as never);
assert.deepEqual(effectiveRoles(c), ['attacker', 'supporter'], '上書き（順序は定義の順）');
assert.deepEqual(loadRoleOverrides(), { [c.id]: ['attacker', 'supporter'] });
saveRoleOverride(c.id, c.roles as never, c.roles as never);
assert.deepEqual(effectiveRoles(c), c.roles, '初期値と同じにすると、上書きが消える');
assert.equal(mem.size, 0, '上書きが無いときは、キーごと消す');
saveRoleOverride(c.id, [], c.roles as never);
assert.equal(mem.size, 0, '空の役割は保存しない');
assert.deepEqual(sanitizeRoleOverrides({ a: ['attacker', 'x', 'attacker'], b: [], c: 'attacker', d: ['supporter'] }), { a: ['attacker'], d: ['supporter'] }, '壊れた項目を捨てる');
setPersistenceBackend(null);
await server.close();

if (errors.length > 0) { console.error(errors.join('\n')); process.exit(1); }
const n = (r: string) => master.filter(c => c.roles?.includes(r)).length;
console.log(`OK: ${master.length} キャラ（アタッカー ${n('attacker')} / サブアタッカー ${n('subAttacker')} / サポーター ${n('supporter')}）`);
