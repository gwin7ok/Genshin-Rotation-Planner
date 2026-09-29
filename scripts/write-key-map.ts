/**
 * 照合表 (src/data/gcsim_key_map.json) の書き出し（フェーズ5 / 5-1）
 *
 * キャラの分は `npm run build:master`、武器・聖遺物の分は `npm run build:equipment` が作り直す。
 * 片方だけ更新するときは、もう片方の分を今のファイルから引き継ぐ。
 */
import fs from 'node:fs';
import path from 'node:path';
import type { GcsimKeyMap } from '../src/masterdata/gcsimKeyMap.ts';

export const keyMapPath = path.join(process.cwd(), 'src/data/gcsim_key_map.json');

export function updateKeyMapFile(update: Partial<GcsimKeyMap>): void {
  let current: Partial<GcsimKeyMap> = {};
  try {
    current = JSON.parse(fs.readFileSync(keyMapPath, 'utf-8')) as Partial<GcsimKeyMap>;
  } catch {
    // 初回は空から作る
  }
  const merged = { ...current, ...update };
  fs.writeFileSync(keyMapPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
}

/** 照合表の1区画の要約（対応できた件数・できなかった件数）を表示する */
export function printKeyMapSummary(label: string, section: GcsimKeyMap['characters']): void {
  const manual = section.records.filter(r => r.source === 'manual').length;
  console.log(`  照合表(${label}): 対応 ${section.records.length} 件（手で補った ${manual} 件）、genshin-db のみ ${section.genshinOnly.length} 件、gcsim のみ ${section.gcsimOnly.length} 件`);
  if (section.genshinOnly.length > 0) console.log(`    genshin-db のみ（gcsim 対象外）: ${section.genshinOnly.map(m => `${m.name}(${m.id})`).join(' / ')}`);
  if (section.gcsimOnly.length > 0) console.log(`    gcsim のみ: ${section.gcsimOnly.map(m => `${m.gcsimKey}(${m.genshinId})`).join(' / ')}`);
}
