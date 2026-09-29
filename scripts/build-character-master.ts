/**
 * キャラクターマスターデータ (src/data/characters_master_data.json) を最新の genshin-db / gcsim から再生成する。
 * アプリ内の「最新マスターデータの動的生成(キャラ)」ボタンと同じ生成ロジックを使う。
 *
 *   npm run build:master
 */
import fs from 'node:fs';
import path from 'node:path';
import { generateCharacterMaster } from '../src/masterdata/characterMasterGenerator.ts';
import { updateKeyMapFile, printKeyMapSummary, keyMapPath } from './write-key-map.ts';

const outputPath = path.join(process.cwd(), 'src/data/characters_master_data.json');

const { characters, report, keyMap } = await generateCharacterMaster(p => {
  if (p.done === p.total || p.done % 20 === 0) console.log(`[${p.phase}] ${p.done}/${p.total}`);
});

fs.writeFileSync(outputPath, JSON.stringify(characters, null, 2) + '\n', 'utf-8');
updateKeyMapFile({ characters: keyMap });

console.log('');
console.log(`生成: ${report.totalCharacters} キャラ (gcsim フレームあり: ${report.charactersWithFrames})  gcsim commit ${report.gcsimCommit.slice(0, 7)}`);
for (const s of report.skipped) console.log(`  対象外: ${s.name} (${s.reason})`);
for (const p of report.placeholderDurations) console.log(`  仮の秒数: ${p.name} [${p.actions.join(', ')}] (${p.reason})`);
for (const m of report.missingCooldowns) console.log(`  CT未取得: ${m.name} ${m.actionId}`);
for (const u of report.unresolvedGoLines) console.log(`  gcsim 未解決行: ${u.characterId}/${u.file} x${u.count}`);
printKeyMapSummary('キャラ', keyMap);
const cs = report.cooldownStart;
console.log(`CT開始位置: 自動 ${cs.read} 件、手で補った ${cs.manual} 件、未設定 ${cs.unresolved.length} 件`);
for (const u of cs.unresolved) console.log(`  CT開始位置 未設定: ${u.name} ${u.actionId} … ${u.reason}`);
for (const m of cs.mismatches) console.log(`  CT開始位置 食い違い: ${m.name} ${m.actionId} 手で補った ${m.manualFrames}f / gcsim 自動 ${m.readFrames}f`);
console.log(`凸データ: ${report.constellations.charactersWithConstellations} キャラ`);
for (const a of report.constellations.added) console.log(`  凸の効果時間延長: ${a.name} ${a.constellation}凸 ${a.actionId} (${a.from}s → ${a.to}s)`);
for (const u of report.constellations.unreviewed) console.log(`  凸延長 未確認: ${u.name} ${u.constellation}凸「${u.description.slice(0, 60)}」 → src/masterdata/constellationEffects.ts で確認して一覧に追加`);
for (const e of report.constellations.errors) console.log(`  凸延長 エラー: ${e}`);
for (const e of report.errors) console.log(`  エラー: ${e}`);
console.log(`\n出力: ${outputPath}\n      ${keyMapPath}`);
