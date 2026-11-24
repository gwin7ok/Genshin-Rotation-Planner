/**
 * 辞書の運用型から出発点を組む処理（knowledgeSeeds）の検査（gcsim は使わない）。
 *   - 続きの出場（then）: 同じキャラが、間に別のキャラを挟んで 2 回出る形が組める
 *   - 同じ slot の続きは、use に結合する
 *   - 続きのない運用型は、これまでと同じ形
 *
 *   npm run check:knowledge-seeds
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const ks = await server.ssrLoadModule('/src/utils/rotationSearch/knowledgeSeeds.ts');
const cs = await server.ssrLoadModule('/src/utils/customStats.ts');

const master: any[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const weapons: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const artifacts: any[] = JSON.parse(fs.readFileSync('src/data/artifacts_master_data.json', 'utf8'));
const mk = (n: string) => { const m = master.find(c => c.name === n); assert.ok(m, n); return { ...structuredClone(m), ...cs.defaultEquipmentFor(m.id, { weapons, artifacts }), customStats: cs.defaultCustomStatsFor(m.id) }; };
const [hutao, bennett, xiangling] = ['胡桃', 'ベネット', '香菱'].map(mk);
const party = [hutao, bennett, xiangling];
const arche = (role: string, slot: number, use: string[], extra: object = {}) => ({ name: 't', role, slot, use, evidence: 't', ...extra });
const shape = (s: any) => s.stints.map((x: any) => `${x.characterId}:${x.actions.map((a: any) => a.actionTypeId).join(',')}`).join(' | ') + `@${s.loopStartIndex}`;
const name = (id: string) => party.find(c => c.id === id)!.name;
const view = (seeds: any[]) => seeds.map(s => s.stints.map((x: any) => `${name(x.characterId)}[${x.actions.map((a: any) => String(a.actionTypeId).replace(/^\d+-[a-z]+_/, '')).join(',')}]`).join('→'));

// 続きなし: 従来どおり（ベネット E → 香菱 E → 胡桃 E,n×2）
const base = ks.knowledgeSeeds(party, {
  [hutao.id]: { archetypes: [arche('attacker', 40, ['e'], { fill: ['n'], fillRepeat: [2] })] },
  [bennett.id]: { archetypes: [arche('supporter', 10, ['e'])] },
  [xiangling.id]: { archetypes: [arche('supporter', 20, ['e'])] },
});
assert.deepEqual(view(base), ['ベネット[e]→香菱[e]→胡桃[e]→胡桃[n,n]'], '続きなしは、従来の形');

// 続きあり: ベネット（slot 10 に E、slot 30 に Q）。香菱は slot 20。→ ベネット E → 香菱 E → ベネット Q → 胡桃
const two = ks.knowledgeSeeds(party, {
  [hutao.id]: { archetypes: [arche('attacker', 40, ['e'], { fill: ['n'], fillRepeat: [1] })] },
  [bennett.id]: { archetypes: [arche('supporter', 10, ['e'], { then: [{ slot: 30, use: ['q'] }] })] },
  [xiangling.id]: { archetypes: [arche('supporter', 20, ['e'])] },
});
assert.deepEqual(view(two), ['ベネット[e]→香菱[e]→ベネット[q]→胡桃[e]→胡桃[n]'], '続きの出場は、間に別のキャラを挟んで組める');
// 出場は 4 つ（ベネットが 2 回）
assert.equal(two[0].stints.filter((s: any) => s.characterId === bennett.id).length, 2, 'ベネットは 2 回出る');

// 同じ slot の続きは、use に結合する
const merged = ks.knowledgeSeeds(party, {
  [hutao.id]: { archetypes: [arche('attacker', 40, ['e'])] },
  [bennett.id]: { archetypes: [arche('supporter', 10, ['e'], { then: [{ slot: 10, use: ['q'] }] })] },
});
assert.deepEqual(view(merged), ['ベネット[e,q]→胡桃[e]'], '同じ slot の続きは、1 つの出場に結合');

// 同じ slot に別のキャラの出場があるときは、並べ替えを全部試す
const perm = ks.knowledgeSeeds(party, {
  [hutao.id]: { archetypes: [arche('attacker', 40, ['e'])] },
  [bennett.id]: { archetypes: [arche('supporter', 10, ['e'], { then: [{ slot: 30, use: ['q'] }] })] },
  [xiangling.id]: { archetypes: [arche('supporter', 30, ['e'])] },
});
assert.deepEqual(new Set(view(perm)), new Set(['ベネット[e]→ベネット[q]→香菱[e]→胡桃[e]', 'ベネット[e]→香菱[e]→ベネット[q]→胡桃[e]']), '同じ slot の出場は、両方の順番を試す');
// 凸数の条件: 範囲の外の形は、出発点に使わない（凸数の未指定は、星 5 = 0 凸・星 4 = 6 凸）
const consBundle = {
  [hutao.id]: { archetypes: [arche('attacker', 40, ['e'], { constellation: { min: 2 } }), arche('attacker', 40, ['q'], { constellation: { max: 1 } })] },
};
const withCons = (n: number | undefined) => view(ks.knowledgeSeeds([{ ...hutao, constellation: n }], consBundle));
assert.deepEqual(withCons(0), ['胡桃[q]'], '0 凸は、max: 1 の形だけ');
assert.deepEqual(withCons(2), ['胡桃[e]'], '2 凸は、min: 2 の形だけ');
assert.deepEqual(withCons(undefined), ['胡桃[q]'], '凸数の未指定は、星 5 = 0 凸として扱う（胡桃は星 5）');
// 西風武器・元素付与の条件: requiresFavonius の形は、西風武器を装備しているか、元素付与（法器・完凸付与など）があるときだけ使う
const favBundle = {
  [bennett.id]: { archetypes: [arche('supporter', 10, ['e', 'n'], { requiresFavonius: true }), arche('supporter', 10, ['e'])] },
  [hutao.id]: { archetypes: [arche('attacker', 40, ['e'])] },
};
assert.deepEqual(view(ks.knowledgeSeeds([{ ...bennett, constellation: 5, weaponId: '11405' }, hutao], favBundle)), ['ベネット[e]→胡桃[e]'], '西風以外の武器・元素付与なし（ベネット 5 凸）では requiresFavonius の形を除外');
assert.deepEqual(view(ks.knowledgeSeeds([{ ...bennett, constellation: 5, weaponId: '11401' }, hutao], favBundle)), ['ベネット[e,n]→胡桃[e]', 'ベネット[e]→胡桃[e]'], '西風武器を装備していれば requiresFavonius の形も使う');
assert.deepEqual(view(ks.knowledgeSeeds([{ ...bennett, constellation: 6, weaponId: '11405' }, hutao], favBundle)), ['ベネット[e,n]→胡桃[e]', 'ベネット[e]→胡桃[e]'], '元素付与状態（ベネット 6 凸）なら西風以外の武器でも N の形を捨てない');
assert.equal(new Set(base.map(shape)).size, base.length, '重複なし');
console.log('OK: 続きの出場を含む出発点の組み立て');
await server.close();
