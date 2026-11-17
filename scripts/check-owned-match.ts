/**
 * 持ちキャラの装備（build）と、取り込み済みのデータの一致判定の確認（D344。src/utils/hoyolab/ownedMatch.ts）
 *
 *   npm run check:owned-match
 */
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { buildMatchesOwned } = await server.ssrLoadModule('/src/utils/hoyolab/ownedMatch.ts');

let failed = 0;
const check = (ok: boolean, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failed++; };

const build = () => ({ level: 90, maxLevel: 90, talents: [9, 9, 9], weaponLevel: 90, weaponMaxLevel: 90, artifactStats: { hp: 4780, cr: 0.311, cd: 0.6220000001 }, artifactSets: [{ id: 'b', count: 2 }, { id: 'a', count: 2 }] });
const owned = () => ({ characterId: 'x', constellation: 2, weaponId: 'w1', weaponRefinementRank: 5, artifactSetId: 'a', artifactSetMode: '2+2', build: build() });
const member = (over: Record<string, unknown> = {}) => ({ ...owned(), ...over });

check(buildMatchesOwned(member(), owned()), '同じ値: 一致');
check(buildMatchesOwned(member({ build: { ...build(), artifactStats: { cd: 0.622, cr: 0.311, hp: 4780 }, artifactSets: [{ id: 'a', count: 2 }, { id: 'b', count: 2 }] } }), owned()), '並び順・小数の誤差（4 桁より下）は、一致');
check(!buildMatchesOwned(member({ constellation: 3 }), owned()), '凸が違う: 相違');
check(!buildMatchesOwned(member({ weaponId: 'w2' }), owned()), '武器が違う: 相違');
check(!buildMatchesOwned(member({ weaponRefinementRank: 1 }), owned()), '精錬が違う: 相違');
check(!buildMatchesOwned(member({ build: { ...build(), talents: [9, 9, 10] } }), owned()), '天賦が違う: 相違');
check(!buildMatchesOwned(member({ build: { ...build(), artifactStats: { hp: 4780, cr: 0.3, cd: 0.622 } } }), owned()), '聖遺物ステータスが違う: 相違');
check(!buildMatchesOwned(member({ build: undefined }), owned()), 'build が無い: 一致ではない');
check(!buildMatchesOwned(member(), { ...owned(), build: undefined }), '取り込み側に build が無い: 一致ではない');

await server.close();
if (failed) { console.error(`\n${failed} 件失敗`); process.exit(1); }
console.log('\nすべて合格');
