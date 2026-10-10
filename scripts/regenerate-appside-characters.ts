/**
 * アプリ側だけで対応している gcsim 未実装キャラ（src/masterdata/appSideCharacterSources.ts。issue #36）の項目だけを、
 * 保存済みのマスター（src/data/characters_master_data.json）に、再生成して差し替える。
 * 全キャラの再生成（npm run build:master）は、保存済みのデータとの細かい差（表記など）まで書き換えるため、その差を巻き込まずに、対象のキャラだけを更新したいときに使う。
 *
 *   npm run build:master:appside
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

const ids = new Set(APP_SIDE_SOURCES.map(s => s.genshinId));
const fresh = new Map(characters.filter(c => c.source?.genshinId !== undefined && ids.has(c.source.genshinId)).map(c => [c.id, c]));
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
