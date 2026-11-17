/**
 * 持ちキャラの取り込み: HoYoLAB に Enka を重ねる処理の確認（D345。src/utils/hoyolab/mergeOwned.ts）
 *
 *   npm run check:owned-merge
 */
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { mergeEnkaOverHoyolab } = await server.ssrLoadModule('/src/utils/hoyolab/mergeOwned.ts');
const { isValidOwnedCharacter } = await server.ssrLoadModule('/src/utils/hoyolab/ownedStore.ts');

let failed = 0;
const check = (ok: boolean, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failed++; };

const ch = (id: number, level: number, extra: Record<string, unknown> = {}) => ({
  genshinId: id, name: `c${id}`, element: 'Pyro', level, maxLevel: 90, ambiguousAscension: false, constellation: 0, talents: [1, 1, 1],
  weapon: { genshinId: 1, name: 'w', level: 90, maxLevel: 90, refinement: 1 }, artifactSets: [], artifactStats: {}, warnings: [], ...extra,
});
const now = new Date('2026-11-17T00:00:00Z');
const hoyo = [ch(1, 80), ch(2, 80), ch(3, 80, { ambiguousAscension: true })];
const enka = [ch(2, 90), ch(3, 90), ch(9, 90), ch(1, 99, { warnings: ['noWeaponInfo'], incomplete: true })];
const r = mergeEnkaOverHoyolab(hoyo, enka, now);

check(r.characters.map((c: any) => c.genshinId).join() === '1,2,3,9', '並び: HoYoLAB の順のあとに、新しいキャラが足される');
check(r.updated === 2 && r.added === 1 && r.skipped === 1, `件数: 更新 2・追加 1・不完全で不採用 1（${r.updated}/${r.added}/${r.skipped}）`);
check(r.characters[0].level === 80 && r.characters[0].source === 'hoyolab', '不完全な Enka（武器なし）は上書きしない（HoYoLAB の値が残る）');
check(r.characters[1].level === 90 && r.characters[1].source === 'enka', 'Enka のキャラは、Enka の値で上書き（取得元 enka）');
check(r.characters[2].ambiguousAscension === false && r.characters[2].source === 'enka', '突破段階が不明だった HoYoLAB のキャラは、Enka の正確な値になる');
check(r.characters.every((c: any) => c.fetchedAt === now.toISOString()), '取得日時が付く');
check(r.characters.every(isValidOwnedCharacter), '保存の検査に通る');
check(isValidOwnedCharacter(ch(1, 90)), '古い保存（取得元・日時なし）も検査に通る');
check(!isValidOwnedCharacter(ch(1, 90, { source: 'x' })), '取得元が不正な値は、検査で除く');
const same = mergeEnkaOverHoyolab(hoyo, [], now);
check(same.updated === 0 && same.characters.length === 3 && same.characters.every((c: any) => c.source === 'hoyolab'), 'Enka が空: HoYoLAB のまま');

await server.close();
if (failed) { console.error(`\n${failed} 件失敗`); process.exit(1); }
console.log('\nすべて合格');
