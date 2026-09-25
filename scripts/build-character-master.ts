/**
 * キャラクターマスターデータ (src/data/characters_master_data.json) を最新の genshin-db / gcsim から再生成する。
 * アプリ内の「最新マスターデータの動的生成(キャラ)」ボタンと同じ生成ロジックを使う。
 *
 *   npm run build:master
 */
import fs from 'node:fs';
import path from 'node:path';
import { generateCharacterMaster } from '../src/masterdata/characterMasterGenerator.ts';

const outputPath = path.join(process.cwd(), 'src/data/characters_master_data.json');

const { characters, report } = await generateCharacterMaster(p => {
  if (p.done === p.total || p.done % 20 === 0) console.log(`[${p.phase}] ${p.done}/${p.total}`);
});

fs.writeFileSync(outputPath, JSON.stringify(characters, null, 2) + '\n', 'utf-8');

console.log('');
console.log(`生成: ${report.totalCharacters} キャラ (gcsim フレームあり: ${report.charactersWithFrames})  gcsim commit ${report.gcsimCommit.slice(0, 7)}`);
for (const s of report.skipped) console.log(`  対象外: ${s.name} (${s.reason})`);
for (const p of report.placeholderDurations) console.log(`  仮の秒数: ${p.name} [${p.actions.join(', ')}] (${p.reason})`);
for (const m of report.missingCooldowns) console.log(`  CT未取得: ${m.name} ${m.actionId}`);
for (const u of report.unresolvedGoLines) console.log(`  gcsim 未解決行: ${u.characterId}/${u.file} x${u.count}`);
for (const a of report.constellationVariants.added) console.log(`  凸アクション追加: ${a.name} ${a.actionId} (${a.from}s → ${a.to}s)`);
for (const u of report.constellationVariants.unreviewed) console.log(`  凸延長 未確認: ${u.name} ${u.constellation}凸「${u.description.slice(0, 60)}」 → src/masterdata/constellationEffects.ts で確認して一覧に追加`);
for (const e of report.constellationVariants.errors) console.log(`  凸延長 エラー: ${e}`);
for (const e of report.errors) console.log(`  エラー: ${e}`);
console.log(`\n出力: ${outputPath}`);
