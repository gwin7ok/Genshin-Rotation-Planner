/**
 * ローテーション自動探索の、候補の生成と CT 違反の除去の検査（gcsim は使わない）。
 *   - 候補ごとに、アタッカーが 1 人以上いる・出場のキャラが編成の中にいる・アクション ID がそのキャラのもの
 *   - 同じ入力は、同じ候補（乱数を使わない）
 *   - 評価（evaluateCandidates）を通った候補は、CT 違反などの警告が 0 件
 *   - 役割の割り当て: 複数の役割を持つキャラは、割り当てが増える。アタッカーのない組み合わせは出ない
 *
 *   npm run check:rotation-search
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const cand = await server.ssrLoadModule('/src/utils/rotationSearch/candidates.ts');
const ev = await server.ssrLoadModule('/src/utils/rotationSearch/evaluate.ts');
const cs = await server.ssrLoadModule('/src/utils/customStats.ts');

const master: any[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const weapons: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const artifacts: any[] = JSON.parse(fs.readFileSync('src/data/artifacts_master_data.json', 'utf8'));
const party = ['胡桃', '香菱', 'ベネット', '行秋'].map(n => {
  const m = master.find(c => c.name === n);
  assert.ok(m, `${n} がマスターにない`);
  return { ...structuredClone(m), ...cs.defaultEquipmentFor(m.id, { weapons, artifacts }), customStats: cs.defaultCustomStatsFor(m.id) };
});
const roles: Record<string, string[]> = Object.fromEntries(party.map(c => [c.id, c.roles ?? []]));

// 割り当て
const assignments = cand.roleAssignments(party, roles);
assert.ok(assignments.length >= 1, '割り当てがある');
for (const a of assignments) assert.ok(Object.values(a).includes('attacker'), 'アタッカーが 1 人以上');
const multi = cand.roleAssignments(party, { ...roles, [party[1].id]: ['attacker', 'subAttacker'] });
assert.ok(multi.length > assignments.length, '複数の役割を持つキャラがいると、割り当てが増える');
for (const a of cand.roleAssignments(party, { [party[0].id]: ['supporter'] })) assert.ok(Object.values(a).includes('attacker'), 'アタッカーの役割を持つキャラがいなくても、誰かをアタッカーにする');

// 候補
const a = cand.generateCandidates(party, roles);
const b = cand.generateCandidates(party, roles);
assert.ok(a.length > 100, `候補が十分ある（${a.length}）`);
assert.deepEqual(a.map((c: any) => c.label), b.map((c: any) => c.label), '同じ入力は同じ候補');
assert.equal(new Set(a.map((c: any) => c.label)).size, a.length, '同じ並びの候補はない');
const ids = new Set(party.map(c => c.id));
for (const c of a) {
  assert.ok(c.stints.length >= 1);
  for (const s of c.stints) {
    assert.ok(ids.has(s.characterId), '出場のキャラは編成の中');
    for (const x of s.actions) assert.ok(x.actionTypeId.startsWith(`${s.characterId}_`), 'アクションはそのキャラのもの');
  }
  assert.ok(c.stints.some((s: any) => c.assignment[s.characterId] === 'attacker'), '出場にアタッカーがいる');
}
const thinned = cand.generateCandidates(party, roles, { maxCandidates: 50 });
assert.equal(thinned.length, 50, '上限で間引く');

// 評価: 通った候補に CT 違反などがない
const r = ev.evaluateCandidates(party, a, {});
assert.ok(r.scored.length > 0, '残る候補がある');
assert.equal(r.scored.length + r.rejected, a.length);
for (let i = 1; i < r.scored.length; i++) assert.ok(r.scored[i - 1].score >= r.scored[i].score, 'スコアの高い順');
const again = ev.evaluateCandidates(party, r.scored.map((s: any) => s.candidate), {});
assert.equal(again.rejected, 0, '通った候補を、もう一度評価しても、捨てられない');

console.log(`OK: 割り当て ${assignments.length} 通り・候補 ${a.length} 個・評価を通った ${r.scored.length}/${a.length} 個`);
await server.close();
process.exit(0);
