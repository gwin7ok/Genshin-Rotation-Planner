/**
 * 時間指定のない効果の「全体 / 自分だけ」の判定の一覧を、確認用の文書に書く（追加作業 23 / issue #29）。
 *
 *   npm run review:buff-scopes
 *
 * 判定が違うものは、src/masterdata/buffScopeOverrides.ts に書く（効果の ID → 'team' | 'self'）。
 */
import fs from 'node:fs';
import { classifyBuffScope } from '../src/utils/buffScope.ts';
import { BUFF_SCOPE_OVERRIDES } from '../src/masterdata/buffScopeOverrides.ts';

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const characters: any[] = readJson('src/data/characters_master_data.json');
const weapons: any[] = readJson('src/data/weapons_master_data.json');
const artifacts: any[] = readJson('src/data/artifacts_master_data.json');

interface Row { kind: string; owner: string; id: string; name: string; description: string; scope: 'team' | 'self' }
const rows: Row[] = [];
const timeless = (e: any) => e.timing === 'always' || !(e.duration > 0);

for (const c of characters) {
  for (const p of c.passiveEffects ?? []) {
    if (!timeless(p)) continue;
    rows.push({ kind: '固有天賦', owner: c.name, id: p.id, name: p.name, description: p.description ?? '', scope: classifyBuffScope({ ...p, category: 'talent' }) });
  }
  for (const e of c.constellationEffects ?? []) {
    if (!timeless(e)) continue;
    rows.push({ kind: `${e.level}凸`, owner: c.name, id: e.id, name: e.name, description: e.description ?? '', scope: classifyBuffScope({ ...e, category: 'constellation' }) });
  }
}
// 武器・聖遺物: 常時の効果（timing = always）だけが、時間指定のない効果として出る
const equipEffects = (x: any): any[] => x.buffEffects?.length ? x.buffEffects : x.buffEffect ? [x.buffEffect] : x.buffEffectsByRefinement ?? [];
for (const w of weapons) for (const b of equipEffects(w)) {
  if (b.timing !== 'always') continue;
  rows.push({ kind: '武器', owner: w.name, id: b.id, name: b.name, description: b.description ?? '', scope: classifyBuffScope({ ...b, category: 'weapon' }) });
}
for (const a of artifacts) for (const b of equipEffects(a)) {
  if (b.timing !== 'always') continue;
  rows.push({ kind: '聖遺物', owner: a.name, id: b.id, name: b.name, description: b.description ?? '', scope: classifyBuffScope({ ...b, category: 'artifact' }) });
}

const esc = (s: string) => s.replace(/\|/g, '/').replace(/\s+/g, ' ');
const count = (k: Row['kind'] | null, s: Row['scope']) => rows.filter(r => (k === null || r.kind === k) && r.scope === s).length;
const lines: string[] = [
  '# 時間指定のない効果の「全体 / 自分だけ」の判定（確認用）',
  '',
  '`npm run review:buff-scopes` で生成。判定は、説明文の「効果が適用される対象」の部分（`src/utils/buffScope.ts`）。違うものは、`src/masterdata/buffScopeOverrides.ts` に書く（★上書き = 上書きの表で決めているもの）。',
  '「フィールド上にいるキャラだけ」の効果は、全体（最下行）の扱い（ユーザー決定）。',
  '',
  `合計 ${rows.length} 件: 全体 ${count(null, 'team')} 件 / 自分だけ ${count(null, 'self')} 件`,
  '',
  '## 全体（最下行）',
  '',
  '| 種別 | 持ち主 | ID | 名前 | 説明 |',
  '|---|---|---|---|---|',
  ...rows.filter(r => r.scope === 'team').map(r => `| ${r.kind} | ${esc(r.owner)} | \`${r.id}\` | ${esc(r.name)} | ${esc(r.description)} |`),
  '',
  '## 自分だけ（キャラ名の横）',
  '',
  '| 種別 | 持ち主 | ID | 名前 | 説明 |',
  '|---|---|---|---|---|',
  ...rows.filter(r => r.scope === 'self').map(r => `| ${r.kind} | ${esc(r.owner)} | \`${r.id}\` | ${esc(r.name)} | ${esc(r.description)} |`),
  '',
];
fs.writeFileSync('docs/gcsim-integration/phase-6-run-and-apply/buff-scope-review.md', lines.join('\n'));
console.log(`書きました: ${rows.length} 件（全体 ${count(null, 'team')} / 自分だけ ${count(null, 'self')}）`);
for (const k of ['固有天賦', '武器', '聖遺物']) console.log(`  ${k}: 全体 ${count(k, 'team')} / 自分だけ ${count(k, 'self')}`);
console.log(`  命ノ星座: 全体 ${rows.filter(r => /凸$/.test(r.kind) && r.scope === 'team').length} / 自分だけ ${rows.filter(r => /凸$/.test(r.kind) && r.scope === 'self').length}`);
