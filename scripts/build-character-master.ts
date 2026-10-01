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
import { linkCharacters } from './link-buffs.ts';

/**
 * 効果継続時間が空のスキル・爆発について、gcsim の辞書（public/data/gcsim_key_catalog.json）にある「そのキャラのスキル / 爆発の、時間つきの効果」の候補を表示する。
 * 新キャラの追加時など、src/masterdata/effectDurationOverrides.ts に足すかを判断する材料（自動では採用しない: 命ノ星座・内部の猶予・複数のキーが混ざるため）。
 */
function printEffectCandidates(chars: Array<{ id: string; name: string; source?: { gcsimKey?: string }; availableActions: Array<{ id: string; type: string; shortName: string; effectDuration?: number }> }>): void {
  let catalog: { entries: Array<{ key: string; category: string; kind: string; permanent?: boolean; durationFrames?: number; isPattern?: boolean; owner: { gcsimKey: string; gcsimKeys?: string[] } }> };
  try {
    catalog = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/gcsim_key_catalog.json'), 'utf-8'));
  } catch {
    return;
  }
  const lines: string[] = [];
  for (const c of chars) {
    const key = c.source?.gcsimKey;
    if (!key) continue;
    for (const a of c.availableActions) {
      if (!['skill', 'skill_hold', 'burst'].includes(a.type) || (a.effectDuration ?? 0) > 0) continue;
      const category = a.type === 'burst' ? 'burst' : 'skill';
      const candidates = catalog.entries.filter(e => (e.owner.gcsimKeys ?? [e.owner.gcsimKey]).includes(key)
        && e.category === category && e.kind === 'effect' && !e.permanent && !e.isPattern && (e.durationFrames ?? 0) > 60);
      if (candidates.length > 0) lines.push(`  ${c.name} ${a.shortName} (${a.id}) → ${candidates.map(e => `${e.key}:${e.durationFrames}f`).join(' ')}`);
    }
  }
  console.log(`効果継続時間が空で、gcsim の辞書に時間つきの効果がある候補: ${lines.length} 件（足すかは gcsim のソースで確認）`);
  for (const l of lines) console.log(l);
}

const outputPath = path.join(process.cwd(), 'src/data/characters_master_data.json');

const { characters, report, keyMap } = await generateCharacterMaster(p => {
  if (p.done === p.total || p.done % 20 === 0) console.log(`[${p.phase}] ${p.done}/${p.total}`);
});

linkCharacters(characters); // 発動バフと gcsim の辞書の結び付け（5-6）
fs.writeFileSync(outputPath, JSON.stringify(characters, null, 2) + '\n', 'utf-8');
updateKeyMapFile({ characters: keyMap });

console.log('');
console.log(`生成: ${report.totalCharacters} キャラ (gcsim フレームあり: ${report.charactersWithFrames})  gcsim commit ${report.gcsimCommit.slice(0, 7)}`);
for (const s of report.skipped) console.log(`  対象外: ${s.name} (${s.reason})`);
for (const p of report.placeholderDurations) console.log(`  仮の秒数: ${p.name} [${p.actions.join(', ')}] (${p.reason})`);
for (const m of report.missingCooldowns) console.log(`  CT未取得: ${m.name} ${m.actionId}`);
for (const u of report.unresolvedGoLines) console.log(`  gcsim 未解決行: ${u.characterId}/${u.file} x${u.count}`);
printKeyMapSummary('キャラ', keyMap);
console.log(`落下攻撃: 低 ${report.plunge.lowCount} キャラ、高 ${report.plunge.highCount} キャラ`);
for (const u of report.plunge.unresolved) console.log(`  落下攻撃 フレーム表なし（gcsim が未実装の仮置きなど）: ${u.name} (${u.characterId})`);
const ed = report.effectDuration;
console.log(`効果継続時間の gcsim 補完: ${ed.supplemented.length} 件`);
for (const e of ed.supplemented) console.log(`  補完: ${e.name} ${e.actionId} = ${e.seconds}s (${e.source})`);
for (const m of ed.mismatches) console.log(`  食い違い（genshin-db を優先）: ${m.name} ${m.actionId} genshin-db ${m.genshinDb}s / gcsim ${m.gcsim}s`);
for (const o of ed.orphans) console.log(`  一覧にあるがアクションが無い: ${o}`);
printEffectCandidates(characters);
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
