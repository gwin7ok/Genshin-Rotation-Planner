/**
 * アプリ側だけで対応している gcsim 未実装キャラ（src/masterdata/appSideCharacterSources.ts。issue #36）の項目だけを、
 * 保存済みのマスター（src/data/characters_master_data.json）に、再生成して差し替える。
 * 全キャラの再生成（npm run build:master）は、保存済みのデータとの細かい差（表記など）まで書き換えるため、その差を巻き込まずに、対象のキャラだけを更新したいときに使う。
 *
 *   npm run build:master:appside
 *   npm run build:master:appside -- 10000027-geo       … 追加で、指定したキャラ ID（マスターのキャラ ID）も差し替える（gcsim 実装済みのキャラの、生成物の変更だけを入れたいとき）
 */
import fs from 'node:fs';
import path from 'node:path';
import { generateCharacterMaster } from '../src/masterdata/characterMasterGenerator.ts';
import { APP_SIDE_SOURCES } from '../src/masterdata/appSideCharacterSources.ts';
import { linkActions, linkCharacters } from './link-buffs.ts';

const outputPath = path.join(process.cwd(), 'src/data/characters_master_data.json');
const { characters, report } = await generateCharacterMaster();
linkCharacters(characters);
linkActions(characters);

// アプリ側だけの対応の表のキャラ（フレームを gcsim の未マージ実装から読む）と、gcsim にキーが無く推定の長さを入れるキャラ（フレーム・キー無し）
const ids = new Set(APP_SIDE_SOURCES.map(s => s.genshinId));
const extraIds = new Set(process.argv.slice(2).filter(a => !a.startsWith('-')));
const fresh = new Map(
  characters
    .filter(c => extraIds.has(c.id) || (c.source?.genshinId !== undefined && ids.has(c.source.genshinId)) || (!c.source?.gcsimKey && !c.isCustom))
    .map(c => [c.id, c]),
);
const current = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as typeof characters;
let replaced = 0;
const next = current.map(c => {
  const f = fresh.get(c.id);
  if (!f) return c;
  replaced++;
  return f;
});
fs.writeFileSync(outputPath, JSON.stringify(next, null, 2) + '\n', 'utf-8');
console.log(`差し替え: ${replaced} キャラ（${[...fresh.values()].map(c => c.name).join('、')}）`);
for (const e of report.errors) console.log(`  エラー: ${e}`);
