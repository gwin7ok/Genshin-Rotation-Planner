/**
 * 「仮値を使う」の既定の装備（キャラごとの聖遺物メイン・サブの優先順・セット・武器）の生成。
 *
 *   npm run build:default-builds -- <wiki の取得結果の JSON>
 *
 * 入力は、tools/wiki-default-builds/extract.js（原神 Wiki のページから、おすすめの装備の事実だけを取る）の出力。
 * キャラ・武器・聖遺物セットを、マスターの名前から ID にして、src/data/default_builds.json に**統合**する（入力に無いキャラは、そのまま残す）。
 * 武器・セットは、gcsim で扱えるもの（gcsimKey がある）だけを使う。見つからないものは、そのキャラでは省く（警告に出す）。
 * 手順の全体は tools/wiki-default-builds/README.md と docs/ゲーム新キャラの取り込み手順.md。
 */
import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
if (!input) { console.error('使い方: npm run build:default-builds -- <wiki の取得結果の JSON>'); process.exit(1); }
const raw: Record<string, any> = JSON.parse(fs.readFileSync(path.resolve(input), 'utf-8'));
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join('src', 'data', f), 'utf-8'));
const characters: any[] = readJson('characters_master_data.json');
const weapons: any[] = readJson('weapons_master_data.json');
const artifacts: any[] = readJson('artifacts_master_data.json');
const OUT = path.join('src', 'data', 'default_builds.json');
const existing: Record<string, any> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf-8')) : {};

/** 名前の表記ゆれ（中点・空白・括弧）をそろえる */
const norm = (s: string) => s.replace(/[・·･\s]/g, '').replace(/[（(].*?[）)]/g, '');

const warnings: string[] = [];
let added = 0;
for (const [name, r] of Object.entries(raw)) {
  if (r.error || !r.main) { warnings.push(`${name}: 取得できていない（${r.error ?? '表なし'}）`); continue; }
  // 旅人は、元素ごとのページ（主人公/風 など）。名前は「traveler-<元素>」で渡す。空・蛍は同じ既定を使うので、キーも「traveler-<元素>」
  const travelerElement = /^traveler-(\w+)$/.exec(name)?.[1];
  const chars = travelerElement ? characters.filter(c => c.id === `10000005-${travelerElement}`) : characters.filter(c => c.name === name);
  if (chars.length === 0) { warnings.push(`${name}: マスターにいない`); continue; }
  const genshinId = travelerElement ? name : String(chars[0].id).split('-')[0];
  const weaponType = chars[0].weaponType;

  const entry: Record<string, unknown> = { name, sands: r.main.sands, goblet: r.main.goblet, circlet: r.main.circlet, sub: r.sub };

  if (r.weapon) {
    const w = weapons.find(x => norm(x.name) === norm(r.weapon) && x.weaponType === weaponType && x.gcsimKey);
    if (w) entry.weaponId = String(w.id); else warnings.push(`${name}: 武器「${r.weapon}」がマスターに無い・種類が違う・gcsim 未対応`);
  } else {
    warnings.push(`${name}: 武器を取得できていない`);
  }

  const sets: { id: string; count: number }[] = [];
  for (const s of r.sets ?? []) {
    const a = artifacts.find(x => norm(x.name) === norm(s.name) && x.gcsimKey);
    if (a && sets.length < 2) sets.push({ id: String(a.id), count: s.count === 2 ? 2 : 4 });
  }
  if (sets.length) entry.sets = sets; else warnings.push(`${name}: 聖遺物セットを決められない`);

  existing[genshinId] = entry;
  added++;
}

const sorted = Object.fromEntries(Object.entries(existing).sort(([a], [b]) => (Number(a) || Infinity) - (Number(b) || Infinity)));
fs.writeFileSync(OUT, JSON.stringify(sorted, null, 1) + '\n', 'utf-8');
console.log(`${added} キャラを ${OUT} に統合しました（全 ${Object.keys(sorted).length} キャラ）`);
for (const w of warnings) console.log('  警告: ' + w);
