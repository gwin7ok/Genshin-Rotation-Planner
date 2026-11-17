/**
 * 同じアカウントの、HoYoLAB と Enka.Network の取り込み結果が、同じになるかの確認
 *
 *   npm run check:enka-vs-hoyolab -- <HoYoLAB の JSON のパス> <Enka の JSON のパス>
 *
 * 両方を、アプリの変換（importCharacters.ts・enkaConvert.ts）で持ちキャラにし、Enka にいるキャラについて、
 * レベル・突破・凸・天賦・武器・聖遺物セット・聖遺物ステータスを比べる。
 * HoYoLAB は、突破段階が分からないキャラ（20・40…80 ちょうど）だけ、突破の比較を除く。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const [hPath, ePath] = [process.argv[2], process.argv[3]];
if (!hPath || !ePath) { console.error('使い方: npm run check:enka-vs-hoyolab -- <HoYoLAB の JSON> <Enka の JSON>'); process.exit(1); }
const hoyolab = JSON.parse(fs.readFileSync(path.resolve(hPath), 'utf-8'));
const enka = JSON.parse(fs.readFileSync(path.resolve(ePath), 'utf-8'));
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.resolve('src/data', f), 'utf-8'));
const characters: any[] = readJson('characters_master_data.json');
const weapons = readJson('weapons_master_data.json');
const artifacts = readJson('artifacts_master_data.json');

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { convertCharacter } = await server.ssrLoadModule('/src/utils/hoyolab/importCharacters.ts');
const { convertEnkaAvatar } = await server.ssrLoadModule('/src/utils/hoyolab/enkaConvert.ts');
const masters = {
  characters: characters.map(c => ({ id: c.id, name: c.name, element: c.element })),
  weapons: weapons.map((w: any) => ({ id: w.id, name: w.name })),
  artifacts: artifacts.map((a: any) => ({ id: a.id, name: a.name })),
};

const hoyoById = new Map<number, any>(hoyolab.list.map((c: any) => [c.base.id, c]));
let same = 0, diff = 0;
const lines: string[] = [];
for (const a of enka.avatarInfoList ?? []) {
  const e = convertEnkaAvatar(a, masters);
  const hc = hoyoById.get(a.avatarId);
  if (!hc) { lines.push(`${e.name}: HoYoLAB に居ない`); diff++; continue; }
  const h = convertCharacter(hc);
  const d: string[] = [];
  const cmp = (label: string, x: unknown, y: unknown) => { if (JSON.stringify(x) !== JSON.stringify(y)) d.push(`${label}: HoYoLAB=${JSON.stringify(x)} Enka=${JSON.stringify(y)}`); };
  cmp('レベル', h.level, e.level);
  if (!h.ambiguousAscension) cmp('突破', h.maxLevel, e.maxLevel);
  cmp('凸', h.constellation, e.constellation);
  cmp('天賦', h.talents, e.talents);
  cmp('武器ID', h.weapon.genshinId, e.weapon.genshinId);
  cmp('武器Lv', h.weapon.level, e.weapon.level);
  cmp('武器突破', h.weapon.maxLevel, e.weapon.maxLevel);
  cmp('精錬', h.weapon.refinement, e.weapon.refinement);
  const sets = (o: any) => [...o.artifactSets].sort((x: any, y: any) => x.name.localeCompare(y.name));
  cmp('聖遺物セット', sets(h), sets(e));
  const keys = new Set([...Object.keys(h.artifactStats), ...Object.keys(e.artifactStats)]);
  for (const k of keys) {
    const x = h.artifactStats[k] ?? 0, y = e.artifactStats[k] ?? 0;
    if (Math.abs(x - y) > 1e-6) d.push(`聖遺物 ${k}: HoYoLAB=${x} Enka=${y}`);
  }
  if (h.ambiguousAscension) lines.push(`  （${h.name}: HoYoLAB は突破が不明。Enka の突破=${e.maxLevel}）`);
  if (d.length === 0) { same++; lines.push(`${e.name}: 一致（Lv.${e.level}/${e.maxLevel} 凸${e.constellation} 天賦${e.talents.join('/')} 武器 Lv.${e.weapon.level} R${e.weapon.refinement}）`); }
  else { diff++; lines.push(`${e.name}: 差あり`); for (const x of d) lines.push('     ' + x); }
}
console.log(`Enka ${enka.avatarInfoList?.length ?? 0} キャラ: 一致 ${same} / 差あり ${diff}`);
for (const l of lines) console.log('  ' + l);
await server.close();
