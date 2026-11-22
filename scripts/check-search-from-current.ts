/**
 * 自動探索の「いまのローテーションから探索」（extraSeeds + seedsOnly + keepFirstSeed）の検査（gcsim を使う。少ない回数・小さい予算）。
 *   - 出発点は、渡した 1 つだけ（生成した候補・辞書の候補は使わない）: 評価した候補数 candidates = 1
 *   - 順位に、出発点と同じ並びの行が、ちょうど 1 つあり、isCurrent の印が付く（上位に入らなくても載る）
 *   - 順位は DPS の高い順で、1 位は、いまのローテーション以上
 *   - keepFirstSeed を付けないと、印は付かない
 *
 *   npm run check:search-from-current
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { useNodeGcsim } from './gcsim-node.ts';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
await useNodeGcsim(server);
const cs = await server.ssrLoadModule('/src/utils/customStats.ts');
const cand = await server.ssrLoadModule('/src/utils/rotationSearch/candidates.ts');
const { searchRotation } = await server.ssrLoadModule('/src/utils/rotationSearch/search.ts');
const { DEFAULT_ENEMY } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');

const master: any[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const weapons: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const artifacts: any[] = JSON.parse(fs.readFileSync('src/data/artifacts_master_data.json', 'utf8'));
const party = ['胡桃', '香菱', 'ベネット', '行秋'].map(n => {
  const m = master.find(c => c.name === n);
  assert.ok(m, `${n} がマスターにない`);
  return { ...structuredClone(m), ...cs.defaultEquipmentFor(m.id, { weapons, artifacts }), customStats: cs.defaultCustomStatsFor(m.id) };
});
const roles: Record<string, string[]> = Object.fromEntries(party.map(c => [c.id, c.roles ?? []]));
// 出発点: 生成した候補のうち、先頭のもの（アタッカーの割り当てつき）
const seed = cand.generateCandidates(party, roles, { maxCandidates: 50 })[0];
const base = {
  characters: party, roles, weapons, artifacts, switchDelay: 0.5, defHalt: true, cores: 4, seedsOnly: true,
  extraSeeds: [{ stints: seed.stints, loopStartIndex: seed.loopStartIndex ?? 0, assignment: seed.assignment }],
  dps: { loops: 2, energy: false, particles: { minSeconds: 5, maxSeconds: 8, amount: 1 }, enemies: [DEFAULT_ENEMY] },
  settings: { battleSeconds: 40, keep1: 1, runs1: 1, keep2: 3, runs2: 2, maxCandidates: 100, refineBudget: 12 },
};

const out = await searchRotation({ ...base, keepFirstSeed: true });
assert.equal(out.status, 'ok', `探索できた（${JSON.stringify(out)}）`);
assert.equal(out.counts.candidates, 1, '出発点は、渡した 1 つだけ（生成した候補・辞書の候補を足さない）');
const current = out.results.filter((x: any) => x.isCurrent);
assert.equal(current.length, 1, 'いまのローテーションの行が、ちょうど 1 つ');
for (let i = 1; i < out.results.length; i++) assert.ok(out.results[i - 1].dps >= out.results[i].dps, 'DPS の高い順');
assert.ok(out.results[0].dps >= current[0].dps, '1 位は、いまのローテーション以上');

const plain = await searchRotation({ ...base, keepFirstSeed: false });
assert.equal(plain.status, 'ok');
assert.ok(plain.results.every((x: any) => !x.isCurrent), 'keepFirstSeed を付けないと、印は付かない');

console.log(`OK: 出発点 1 つ・順位 ${out.results.length} 件・いまのローテーション ${Math.round(current[0].dps)}（1 位 ${Math.round(out.results[0].dps)}）`);
await server.close();
process.exit(0);
