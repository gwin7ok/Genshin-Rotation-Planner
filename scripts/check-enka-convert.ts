/**
 * Enka.Network 取り込みの変換の確認（src/utils/hoyolab/enkaConvert.ts）
 *
 *   npm run check:enka-convert -- <Enka の JSON のパス>     （例: https://enka.network/api/uid/<UID> の応答を保存したもの）
 *
 * 1. 変換: 全キャラを変換し、マスターに無いキャラ・武器・聖遺物セットと、変換の注意を一覧にする。
 * 2. 突き合わせ: gcsim（WebAssembly 版。scripts/gcsim-node.ts）で、変換した設定を 1 キャラずつ実行し、
 *    gcsim が計算した最終ステータスを、Enka の fightPropMap（ゲームの画面の最終値）と比べる。
 *    gcsim は、武器・天賦の戦闘中の効果を開始時に足すため、その分の差は出る（HoYoLAB の確認と同じ）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { gcsimSample } from './gcsim-node.ts';

const inputPath = process.argv[2];
if (!inputPath) { console.error('使い方: npm run check:enka-convert -- <Enka の JSON のパス>'); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf-8'));
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.resolve('src/data', f), 'utf-8'));
const characters: any[] = readJson('characters_master_data.json');
const weapons = readJson('weapons_master_data.json');
const artifacts = readJson('artifacts_master_data.json');

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { convertEnkaAvatar } = await server.ssrLoadModule('/src/utils/hoyolab/enkaConvert.ts');
const { buildOwnedCharacterLines, matchMasterCharacterId } = await server.ssrLoadModule('/src/utils/hoyolab/importCharacters.ts');
const { isValidOwnedCharacter } = await server.ssrLoadModule('/src/utils/hoyolab/ownedStore.ts');

const SNAP: Record<string, number> = { def: 2, hp: 3, atk: 5, er: 7, em: 8, cr: 9, cd: 10 };
const masters = {
  characters: characters.map(c => ({ id: c.id, name: c.name, element: c.element })),
  weapons: weapons.map((w: any) => ({ id: w.id, name: w.name, gcsimKey: w.gcsimKey })),
  artifacts: artifacts.map((a: any) => ({ id: a.id, name: a.name, gcsimKey: a.gcsimKey })),
};

const runSample = async (config: string) => {
  const text = await gcsimSample(config, 1);
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(text.trim().slice(0, 300)); }
  if (json?.error) throw new Error(String(json.error).trim().slice(0, 300)); // WebAssembly 版は、エラーも JSON（{"error": "..."}）で返す
  return json;
};

const avatars: any[] = raw.avatarInfoList ?? [];
console.log(`Enka: ${avatars.length} キャラ`);
let ok = 0, ng = 0, noKey = 0, errors = 0;
const problems: string[] = [];
for (const a of avatars) {
  const owned = convertEnkaAvatar(a, masters);
  const label = `${owned.name}（Lv.${owned.level}/${owned.maxLevel} 凸${owned.constellation} 天賦${owned.talents.join('/')} 武器=${owned.weapon.name} Lv.${owned.weapon.level}/${owned.weapon.maxLevel} R${owned.weapon.refinement} 聖遺物=${owned.artifactSets.map(x => x.name + x.count).join('+') || 'なし'}）`;
  console.log('  ' + label);
  if (!isValidOwnedCharacter(owned)) problems.push(`${owned.name}: 持ちキャラの検査に通りません`);
  for (const w of owned.warnings) problems.push(`${owned.name}: ${w}`);
  const id = matchMasterCharacterId(owned, characters.map(c => c.id));
  const master = characters.find(c => c.id === id);
  if (!master) { problems.push(`${owned.name}: マスターに対応するキャラが無い`); continue; }
  if (!weapons.some((w: any) => w.id === String(owned.weapon.genshinId))) problems.push(`${owned.name}: 武器 ${owned.weapon.genshinId} がマスターに無い`);
  for (const s of owned.artifactSets) if (!artifacts.some((x: any) => x.name === s.name)) problems.push(`${owned.name}: 聖遺物セット「${s.name}」がマスターに無い`);
  const key = master.source?.gcsimKey;
  if (!key) { noKey++; continue; }
  const { lines, warnings } = buildOwnedCharacterLines(owned, key, { weapons, artifacts });
  for (const w of warnings) problems.push(`${owned.name}: ${w}`);
  const config = [...lines, 'options iteration=1 duration=1;', 'target lvl=100 resist=0.1;', `active ${key};`, `${key} attack;`].join('\n');
  let snap: number[];
  try { snap = (await runSample(config)).character_details[0].snapshot; }
  catch (e: any) { errors++; problems.push(`${owned.name}: gcsim エラー ${e.message}`); continue; }
  const f = a.fightPropMap as Record<string, number>;
  const checks: [string, number, number, number][] = [
    ['HP', f['2000'], snap[SNAP.hp], 0.003],
    ['攻撃', f['2001'], snap[SNAP.atk], 0.003],
    ['防御', f['2002'], snap[SNAP.def], 0.003],
    ['熟知', f['28'], snap[SNAP.em], 2.5],
    ['会心率', f['20'], snap[SNAP.cr], 0.002],
    ['会心ダメ', f['22'], snap[SNAP.cd], 0.002],
    ['ER', f['23'], snap[SNAP.er], 0.002],
  ];
  const diffs = checks.filter(([, x, y, tol]) => (tol === 0.003 ? Math.abs(x - y) > Math.max(x, 1) * tol : Math.abs(x - y) > tol));
  if (diffs.length === 0) ok++;
  else { ng++; problems.push(`${owned.name}: ` + diffs.map(([n, x, y]) => `${n} Enka=${Number(x.toFixed(4))} gcsim=${Number(y.toFixed(4))}`).join(' / ')); }
}
console.log(`突き合わせ: 一致 ${ok} / 差あり ${ng} / gcsim 未実装 ${noKey} / gcsim エラー ${errors}`);
for (const p of problems) console.log('  - ' + p);
await server.close();
