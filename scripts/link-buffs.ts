/**
 * マスター生成（build-character-master.ts / build-equipment-master.ts）で、発動バフを gcsim の辞書と結び付ける（フェーズ5 / 5-6）。
 * 辞書（public/data/gcsim_key_catalog.json）は npm run build:catalog で作る。無ければ結び付けを行わない。
 */
import fs from 'node:fs';
import path from 'node:path';
import { indexCatalog, linkCharacterBuffs, linkEquipmentBuffs, type BuffLinkReport } from '../src/masterdata/buffGcsimLink.ts';
import type { CharacterConfig } from '../src/types/genshin.ts';
import type { ArtifactSetDatabaseItem, WeaponDatabaseItem } from '../src/types/database.ts';

const catalogPath = path.join(process.cwd(), 'public/data/gcsim_key_catalog.json');

function loadIndex() {
  if (!fs.existsSync(catalogPath)) {
    console.log('（辞書 public/data/gcsim_key_catalog.json が無いため、発動バフと gcsim の結び付けは行っていません。npm run build:catalog で作ってください）');
    return undefined;
  }
  return indexCatalog(JSON.parse(fs.readFileSync(catalogPath, 'utf-8')));
}

function printCounts(report: BuffLinkReport): void {
  console.log('発動バフと gcsim の辞書の結び付け（分類: always = 常時 / computed = gcsim が計算 / conditional = 条件付き / unsupported = gcsim 対象外）:');
  for (const [kind, c] of Object.entries(report.counts)) console.log(`  ${kind}: ${JSON.stringify(c)}`);
}

/** キャラの固有天賦・命ノ星座の発動バフを結び付ける（characters を書き換える） */
export function linkCharacters(characters: CharacterConfig[]): void {
  const index = loadIndex();
  if (!index) return;
  const report = linkCharacterBuffs(characters, index);
  printCounts(report);
  console.log(`  gcsim の時間で補った固有天賦の効果時間: ${report.durationFilled.length} 件`);
  for (const d of report.durationFilled) console.log(`    ${d.name} (${d.id}) = ${d.duration}s (${d.source})`);
  console.log(`  命ノ星座の継続時間を説明文の値にした（gcsim の値と食い違うもの）: ${report.constellationDurationFromText.length} 件`);
  for (const c of report.constellationDurationFromText) console.log(`    ${c.name} = ${c.text}s（gcsim ${c.gcsim}s）`);
  console.log(`  未確認のキー（定義に対応付けておらず、確認済みの一覧にも無い）: ${report.unreviewedKeys.length} 件`);
  for (const k of report.unreviewedKeys) console.log(`    ${k}`);
  const s = report.constellationSkipped;
  console.log(`  命ノ星座の効果の定義を追加: ${report.added.length} 件（永続のみで定義にしなかった凸 ${s.permanentOnly}、時間が分からず定義にしなかった凸 ${s.unknownDuration}、凸の番号が分からないキー ${s.noLevel}）`);
}

/** 武器・聖遺物の発動バフを結び付ける（weapons / artifacts を書き換える） */
export function linkEquipment(weapons: WeaponDatabaseItem[], artifacts: ArtifactSetDatabaseItem[]): void {
  const index = loadIndex();
  if (!index) return;
  const report = linkEquipmentBuffs(weapons, artifacts, index);
  printCounts(report);
  console.log(`  武器の発動バフの定義を追加: ${report.added.length} 件`);
  for (const a of report.added) console.log(`    ${a.name} = ${a.duration}s (${a.keys.join(', ')})`);
}
