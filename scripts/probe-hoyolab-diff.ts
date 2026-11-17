/**
 * HoYoLAB 取り込みで、gcsim と HoYoLAB の最終ステータスに差があるキャラの原因を調べる（調査用）
 *   node scripts/probe-hoyolab-diff.ts サンドローネ 胡桃 ...
 * 構成を変えて gcsim を実行し、差の出どころ（聖遺物セット・武器・基礎値）を分ける。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const raw = JSON.parse(fs.readFileSync(path.resolve('tools/hoyolab-fetch/out/hoyolab-raw.json'), 'utf-8'));
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.resolve('src/data', f), 'utf-8'));
const characters: any[] = readJson('characters_master_data.json');
const weapons = readJson('weapons_master_data.json');
const artifacts = readJson('artifacts_master_data.json');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { convertCharacter, buildOwnedCharacterLines } = await server.ssrLoadModule('/src/utils/hoyolab/importCharacters.ts');
const num = (s: string) => (s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s));
const IDX: Record<string, number> = { DEF: 2, HP: 3, ATK: 5, ER: 7, EM: 8, CR: 9, CD: 10 };
const BASE_IDX: Record<string, number> = { HP: 23, ATK: 24, DEF: 25 };

const run = async (lines: string[], key: string) => {
  const config = [...lines, 'options iteration=1 duration=1;', 'target lvl=100 resist=0.1;', `active ${key};`, `${key} attack;`].join('\n');
  const res = await fetch('http://localhost:54321/sample/probe', { method: 'POST', body: JSON.stringify({ config, seed: 1 }) });
  return JSON.parse(await res.text()).character_details[0].snapshot as number[];
};
const fmt = (snap: number[]) => Object.entries(IDX).map(([k, i]) => `${k}=${Number(snap[i].toFixed(3))}`).join(' ');

for (const name of process.argv.slice(2)) {
  const hc = raw.list.find((c: any) => c.base.name === name);
  if (!hc) { console.log(`${name}: 見つかりません`); continue; }
  const owned = convertCharacter(hc);
  const master = characters.find(c => c.id.split('-')[0] === String(hc.base.id));
  const key = master.source.gcsimKey;
  const { lines } = buildOwnedCharacterLines(owned, key, { weapons, artifacts });
  const fin: Record<number, string> = {};
  for (const p of [...hc.selected_properties, ...hc.extra_properties]) fin[p.property_type] = p.final;
  const hoyo = `HP=${fin[2000]} ATK=${fin[2001]} DEF=${fin[2002]} EM=${fin[28]} CR=${fin[20]} CD=${fin[22]} ER=${fin[23]}`;
  const baseHoyo = Object.fromEntries(hc.base_properties.map((p: any) => [p.property_type, p.base]));
  const noSet = lines.filter(l => !l.includes(' add set='));
  // 武器無し: 同じ武器種の、効果のない 1 星武器（Lv1）に置き換える
  const plain = { gcsimKey: ({ sword: 'dullblade', claymore: 'wastergreatsword', polearm: 'beginnersprotector', bow: 'huntersbow', catalyst: 'apprenticesnotes' } as Record<string, string>)[master.weaponType] };
  const noWeapon = lines.map(l => (l.includes(' add weapon=') ? `${key} add weapon="${plain.gcsimKey}" refine=1 lvl=1/20;` : l));
  const charOnly = [lines[0], `${key} add weapon="${plain.gcsimKey}" refine=1 lvl=1/20;`];
  const [full, a, b, c] = [await run(lines, key), await run(noSet, key), await run(noWeapon, key), await run(charOnly, key)];
  console.log(`\n■ ${name}（${owned.weapon.name} R${owned.weapon.refinement} / ${owned.artifactSets.map(s => s.name + s.count).join('+')} / C${owned.constellation}）`);
  console.log(`  HoYoLAB 最終 : ${hoyo}`);
  console.log(`  gcsim 全部   : ${fmt(full)}`);
  console.log(`  セット無し   : ${fmt(a)}`);
  console.log(`  武器無し     : ${fmt(b)}`);
  console.log(`  キャラのみ   : ${fmt(c)}`);
  if (/^(aether|lumine)/.test(key)) {
    // 旅人: gcsim は、ストーリークエストの強化（既定は全て有効）を足す。パラメータで切り替えて、HoYoLAB の値に合うものを探す
    for (const params of ['', 'true_moon_story_buff=0', 'skirk_story_buff=0,true_moon_story_buff=0', 'base_atk_buff=0,skirk_story_buff=0,true_moon_story_buff=0']) {
      const v = lines.map((l, i) => (i === 0 && params ? l.replace(';', ` +params=[${params}];`) : l));
      console.log(`  旅人 params=[${params || '既定（全部あり）'}]: ${fmt(await run(v, key))}`);
    }
  }
  if (owned.ambiguousAscension) {
    const next = lines.map(l => l.replace(`lvl=${owned.level}/${owned.maxLevel} cons`, `lvl=${owned.level}/${owned.maxLevel + 10} cons`));
    const n = await run(next, key);
    console.log(`  突破後（${owned.level}/${owned.maxLevel + 10}）: ${fmt(n)} 基礎=${Object.values(BASE_IDX).map(i => Number(n[i].toFixed(1))).join('/')}`);
  }
  console.log(`  基礎値(HP/ATK/DEF) HoYoLAB=${baseHoyo[2000]}/${baseHoyo[2001]}/${baseHoyo[2002]} gcsim(全部)=${Object.entries(BASE_IDX).map(([, i]) => Number(full[i].toFixed(1))).join('/')}`);
}
await server.close();
