/**
 * キャラの役割（アタッカー・サブアタッカー・サポーター）の検査。
 *   - マスターの全キャラに、役割が 1 つ以上ある
 *   - マスターの roles が、初期値の表（src/masterdata/characterRoles.ts）と一致する
 *   - 表に、マスターに無いキャラ ID がない
 *
 *   npm run check:roles
 */
import fs from 'node:fs';
import { CHARACTER_ROLES } from '../src/masterdata/characterRoles.ts';

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
if (errors.length > 0) { console.error(errors.join('\n')); process.exit(1); }
const n = (r: string) => master.filter(c => c.roles?.includes(r)).length;
console.log(`OK: ${master.length} キャラ（アタッカー ${n('attacker')} / サブアタッカー ${n('subAttacker')} / サポーター ${n('supporter')}）`);
