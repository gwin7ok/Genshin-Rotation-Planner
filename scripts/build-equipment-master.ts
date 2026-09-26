/**
 * 武器・聖遺物マスターデータ (src/data/weapons_master_data.json, src/data/artifacts_master_data.json)
 * を最新の genshin-db / enka から動的に生成・保存する。
 *
 *   npm run build:equipment
 */
import fs from 'node:fs';
import path from 'node:path';
import { generateEquipmentMaster } from '../src/masterdata/equipmentMasterGenerator.ts';

const weaponsOutputPath = path.join(process.cwd(), 'src/data/weapons_master_data.json');
const artifactsOutputPath = path.join(process.cwd(), 'src/data/artifacts_master_data.json');

console.log('⚡ 武器・聖遺物マスターデータの動的生成を開始します...');

const { weapons, artifacts, report } = await generateEquipmentMaster(p => {
  console.log(`[${p.phase}] ${p.done}/${p.total}`);
});

fs.writeFileSync(weaponsOutputPath, JSON.stringify(weapons, null, 2) + '\n', 'utf-8');
fs.writeFileSync(artifactsOutputPath, JSON.stringify(artifacts, null, 2) + '\n', 'utf-8');

console.log('');
console.log(`⚔️ 武器マスターデータ生成完了: 全 ${report.totalWeapons} 件 (発動バフあり: ${report.weaponsWithBuffs} 件)`);
console.log(`🏺 聖遺物マスターデータ生成完了: 全 ${report.totalArtifacts} 件 (発動バフあり: ${report.artifactsWithBuffs} 件)`);
console.log('');
console.log('--- 抽出・登録された主要発動バフ一覧 (抜粋) ---');
for (const b of report.extractedBuffsList.slice(0, 25)) {
  const durStr = b.duration ? `${b.duration}s` : '即時';
  const cdStr = b.cooldown ? ` / CT ${b.cooldown}s` : '';
  console.log(`  [${b.sourceType === 'weapon' ? '武器' : '聖遺物'}] ${b.sourceName} -> ${b.buffName} (${durStr}${cdStr})`);
}
if (report.extractedBuffsList.length > 25) {
  console.log(`  ... 他 ${report.extractedBuffsList.length - 25} 件`);
}

if (report.errors.length > 0) {
  console.log('\n⚠️ エラー / 警告:');
  for (const e of report.errors) console.log(`  ${e}`);
}

console.log(`\n出力先:\n  - ${weaponsOutputPath}\n  - ${artifactsOutputPath}`);
