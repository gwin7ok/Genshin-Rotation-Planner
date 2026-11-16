/**
 * HoYoLAB 取り込みの変換の確認（src/utils/hoyolab/importCharacters.ts）
 *
 *   npm run check:hoyolab-import [-- <HoYoLAB の JSON のパス>]
 *
 * 既定の入力: tools/hoyolab-fetch/out/hoyolab-raw.json（拡張機能・試作スクリプトで取得。Git には入らない）。
 * 1. 変換: 全キャラを変換し、注意（突破段階が不明・天賦の数が想定外など）とマスターに無い武器・聖遺物を一覧にする。
 * 2. 突き合わせ: gcsim サーバー（http://localhost:54321）で、変換した設定を 1 キャラずつ実行し、
 *    gcsim が計算した最終ステータス（HP・攻撃・防御・熟知・会心・会心ダメ・チャージ効率・元素ダメージ）を、
 *    HoYoLAB の画面の最終値と比べる。差が大きいキャラを一覧にする。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const inputPath = process.argv[2] ?? path.resolve('tools/hoyolab-fetch/out/hoyolab-raw.json');
const raw = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.resolve('src/data', f), 'utf-8'));
const characters: any[] = readJson('characters_master_data.json');
const weapons = readJson('weapons_master_data.json');
const artifacts = readJson('artifacts_master_data.json');

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { convertCharacter, buildOwnedCharacterLines, isTravelerKey, travelerParams } = await server.ssrLoadModule('/src/utils/hoyolab/importCharacters.ts');

// gcsim の snapshot の並び（Stat の列挙）: 2=DEF 3=HP 5=ATK 7=ER 8=EM 9=CR 10=CD 11=Heal 12..18=炎水氷雷風岩草 19=物理
const SNAP: Record<string, number> = { def: 2, hp: 3, atk: 5, er: 7, em: 8, cr: 9, cd: 10 };
const ELEM_SNAP: Record<string, number> = { Pyro: 12, Hydro: 13, Cryo: 14, Electro: 15, Anemo: 16, Geo: 17, Dendro: 18 };
const num = (s: string) => (s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s));

const findMaster = (hc: any) => {
  const prefix = String(hc.base.id);
  const el = String(hc.base.element).toLowerCase();
  const list = characters.filter(c => c.id.split('-')[0] === prefix);
  return list.find(c => c.id.endsWith(`-${el}`)) ?? list[0];
};

const runSample = async (config: string) => {
  const res = await fetch('http://localhost:54321/sample/hoyolab-check', { method: 'POST', body: JSON.stringify({ config, seed: 1 }) });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(text.trim().slice(0, 300)); }
};

let converted = 0, noMaster = 0, noKey = 0, ambiguous = 0, ok = 0, ng = 0, errors = 0;
const problems: string[] = [];
for (const hc of raw.list) {
  const owned = convertCharacter(hc);
  converted++;
  if (owned.ambiguousAscension) ambiguous++;
  const master = findMaster(hc);
  if (!master) { noMaster++; problems.push(`${owned.name}: マスターに無いキャラ`); continue; }
  const key = master.source?.gcsimKey;
  if (!key) { noKey++; continue; } // gcsim 未実装のキャラ（突き合わせ不可）
  const { lines, warnings } = buildOwnedCharacterLines(owned, key, { weapons, artifacts }, isTravelerKey(key) ? travelerParams(false) /* この旅人は真月未達成 */ : []);
  for (const w of [...owned.warnings.filter(w => !w.includes('突破前か突破後か')), ...warnings]) problems.push(`${owned.name}: ${w}`);
  const config = [...lines, 'options iteration=1 duration=1;', 'target lvl=100 resist=0.1;', `active ${key};`, `${key} attack;`].join('\n');
  let snap: number[];
  try {
    const j = await runSample(config);
    snap = j.character_details[0].snapshot;
  } catch (e: any) { errors++; problems.push(`${owned.name}: gcsim エラー ${e.message}`); continue; }

  // HoYoLAB の最終値
  const fin: Record<number, string> = {};
  for (const p of [...hc.selected_properties, ...hc.element_properties, ...hc.extra_properties]) fin[p.property_type] = p.final;
  const checks: [string, number, number, number][] = [
    ['HP', num(fin[2000]), snap[SNAP.hp], 0.003],
    ['攻撃', num(fin[2001]), snap[SNAP.atk], 0.003],
    ['防御', num(fin[2002]), snap[SNAP.def], 0.003],
    ['熟知', num(fin[28]), snap[SNAP.em], 2.5],
    ['会心率', num(fin[20]), snap[SNAP.cr], 0.002],
    ['会心ダメ', num(fin[22]), snap[SNAP.cd], 0.002],
    ['ER', num(fin[23]), snap[SNAP.er], 0.002],
  ];
  const elemKey = Object.entries({ Pyro: 40, Electro: 41, Hydro: 42, Dendro: 43, Anemo: 44, Geo: 45, Cryo: 46 }).find(([e]) => e.toLowerCase() === String(hc.base.element).toLowerCase())?.[1];
  // 元素ダメージ: gcsim は、武器・天賦の元素ダメージ加算（ミストスプリッター・雷電のチャージ効率換算など）を足すので、HoYoLAB 以上なら一致とみなす
  const elemDiff = elemKey ? snap[ELEM_SNAP[hc.base.element]] - num(fin[elemKey] ?? '0%') : 0;
  if (elemKey && elemDiff < -0.002) checks.push(['元素ダメ', num(fin[elemKey] ?? '0%'), snap[ELEM_SNAP[hc.base.element]], 0.002]);
  const diffs = checks.filter(([, a, b, tol]) => {
    // 1〜3 番目（HP・攻撃・防御）は相対誤差、それ以外は絶対誤差
    const isRel = tol === 0.003;
    return isRel ? Math.abs(a - b) > Math.max(a, 1) * tol : Math.abs(a - b) > tol;
  });
  if (diffs.length === 0) ok++;
  else {
    ng++;
    problems.push(`${owned.name}（Lv.${owned.level}/${owned.maxLevel}、武器=${owned.weapon.name}、聖遺物=${owned.artifactSets.map(x => x.name + x.count).join('+')}）: ` + diffs.map(([n, a, b]) => `${n} HoYoLAB=${a} gcsim=${Number(b.toFixed(4))}`).join(' / '));
  }
}
console.log(`変換 ${converted} キャラ / マスターに無い ${noMaster} / gcsim 未実装 ${noKey}（突き合わせ対象外） / 突破段階が不明 ${ambiguous}`);
console.log(`突き合わせ: 一致 ${ok} / 差あり ${ng} / gcsim エラー ${errors}`);
for (const p of problems) console.log('  - ' + p);
await server.close();
