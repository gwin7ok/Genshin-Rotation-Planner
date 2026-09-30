/**
 * gcsim キーの辞書（src/data/gcsim_key_catalog.json）を、gcsim のソースから作る（フェーズ5 / 5-2a）。
 *
 *   npm run build:catalog
 *
 * gcsim の最新（main）のソースを取得し、キーを登録している呼び出しを抽出して、定義場所で分類する。
 * 種類（効果 / CT / 内部）は名前からの候補。手で補う一覧での上書きは 5-2b。
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractKeyCatalog } from '../src/masterdata/gcsimKeyCatalog.ts';
import { KEY_OVERRIDES, MANUAL_PATTERN_KEYS } from '../src/masterdata/gcsimKeyCatalogOverrides.ts';
import { assignNames } from '../src/masterdata/gcsimKeyNames.ts';
import { loadNameSources } from './genshin-db-names.ts';

import { GCSIM_REPO as CONFIG_GCSIM_REPO, GCSIM_COMMIT as CONFIG_GCSIM_COMMIT } from '../src/utils/gcsim/gcsimConfig.ts';
const REPO = CONFIG_GCSIM_REPO;
const BRANCH = CONFIG_GCSIM_COMMIT; // gcsim.config.json のコミットに固定（リリースにない最新の変更を取り込まない）
const observedPath = path.join(process.cwd(), 'src/data/gcsim_key_observed.json');
const outputPath = path.join(process.cwd(), 'src/data/gcsim_key_catalog.json');

/** キーの登録を含みうるソース（キャラ・武器・聖遺物・テンプレート・シミュレーションの設定） */
const isSourceFile = (p: string) =>
  p.endsWith('.go') && !/(^|\/)zz_|_test\.go$/.test(p)
  && /^(internal\/(characters|weapons|artifacts|template)\/|pkg\/(simulation\/setup\.go$|core\/player\/|reactable\/))/.test(p);

async function fetchText(url: string, retries = 2): Promise<string> {
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.text();
      last = new Error(`HTTP ${res.status}: ${url}`);
    } catch (e) {
      last = e;
    }
    await new Promise(r => setTimeout(r, 500 * (i + 1)));
  }
  throw last instanceof Error ? last : new Error(String(last));
}

const tree = JSON.parse(await fetchText(`https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`)) as {
  sha: string;
  tree: Array<{ path: string }>;
};
const paths = tree.tree.map(t => t.path).filter(isSourceFile);
console.log(`gcsim commit ${tree.sha.slice(0, 7)}: ソース ${paths.length} ファイルを取得中...`);

const files: Record<string, string> = {};
let index = 0;
await Promise.all(Array.from({ length: 20 }, async () => {
  while (index < paths.length) {
    const p = paths[index++];
    files[p] = await fetchText(`https://raw.githubusercontent.com/${REPO}/${tree.sha}/${p}`);
  }
}));

const { catalog, report } = extractKeyCatalog(files, tree.sha, tree.tree.map(t => t.path), KEY_OVERRIDES, fs.existsSync(observedPath) ? JSON.parse(fs.readFileSync(observedPath, 'utf-8')) : undefined, MANUAL_PATTERN_KEYS);

// 表示名: 手で補う一覧が優先。無いキーは、持ち主の名前（genshin-db）＋ キー名の規則で付ける
console.log('genshin-db から名前を取得中...');
const naming = assignNames(catalog.entries, await loadNameSources());

// 前回の辞書との差分（増えたキー・消えたキー）を報告する。増えたキーは、スキル・爆発の効果の対応表（npm run check:effectkeys）で
// 「未検討」として現れ、検討する範囲になる。消えたキー（gcsim の更新での改名・削除）は、紐づけが孤立するので手で直す
{
  const previous: Array<{ key: string; category?: string; kind?: string; owner?: { gcsimKey?: string } }> =
    fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf-8')).entries ?? [] : [];
  const oldKeys = new Map(previous.map(e => [e.key, e]));
  const newKeys = new Map(catalog.entries.map(e => [e.key, e]));
  const added = catalog.entries.filter(e => !oldKeys.has(e.key));
  const removed = previous.filter(e => !newKeys.has(e.key));
  const inScope = (e: { category?: string; kind?: string }) => e.kind === 'effect' && ['skill', 'burst', 'character', 'attack'].includes(e.category ?? '');
  const fmt = (e: { key: string; category?: string; kind?: string; owner?: { gcsimKey?: string } }) => `- \`${e.key}\` [${e.category}/${e.kind}] ${e.owner?.gcsimKey ?? ''}`;
  const diffPath = path.join(process.cwd(), 'docs/gcsim-integration/phase-6-run-and-apply/catalog-diff.md');
  fs.writeFileSync(diffPath, [
    '# gcsim キーの辞書の差分（前回の作成との比較）',
    '',
    `作成: ${new Date().toISOString().slice(0, 10)} / gcsim commit ${tree.sha.slice(0, 7)}`,
    '',
    `増えたキー ${added.length} 件（うち対応表の対象 = 分類が skill / burst / character / attack の効果: ${added.filter(inScope).length} 件）/ 消えたキー ${removed.length} 件（うち対象 ${removed.filter(inScope).length} 件）`,
    '',
    '## 増えたキー（対象のもの）',
    ...(added.filter(inScope).length ? added.filter(inScope).map(fmt) : ['なし']),
    '',
    '## 消えたキー（対象のもの。紐づけ・決定が残っていれば孤立する）',
    ...(removed.filter(inScope).length ? removed.filter(inScope).map(fmt) : ['なし']),
    '',
    '## 増えたキー（その他）',
    ...(added.filter(e => !inScope(e)).length ? added.filter(e => !inScope(e)).map(fmt) : ['なし']),
    '',
    '## 消えたキー（その他）',
    ...(removed.filter(e => !inScope(e)).length ? removed.filter(e => !inScope(e)).map(fmt) : ['なし']),
    '',
  ].join('\n'));
  console.log(`辞書の差分: 増えたキー ${added.length} 件（対象 ${added.filter(inScope).length}）/ 消えたキー ${removed.length} 件（対象 ${removed.filter(inScope).length}）→ ${path.relative(process.cwd(), diffPath)}`);
}

// 1 キー 1 行（差分が読みやすく、ファイルが大きくなりすぎないように）
const lines = catalog.entries.map(e => '    ' + JSON.stringify(e));
fs.writeFileSync(
  outputPath,
  `{\n  "gcsimCommit": ${JSON.stringify(catalog.gcsimCommit)},\n  "generatedAt": ${JSON.stringify(catalog.generatedAt)},\n  "entries": [\n${lines.join(',\n')}\n  ]\n}\n`,
  'utf-8',
);

console.log('');
console.log(`キー登録の呼び出し ${report.totalCalls} 件: 解決 ${report.resolvedCalls}、パターン ${report.patternCalls}、未解決 ${report.unresolved.length}`);
console.log(`辞書のキー ${catalog.entries.length} 件（パターン ${catalog.entries.filter(e => e.isPattern).length}）`);
console.log('分類:', JSON.stringify(report.byCategory));
console.log('種類の候補:', JSON.stringify(report.byKind));
console.log(`手で補う一覧を適用: ${report.manualCount} 件`);
if (report.overridesMissing.length > 0) console.log(`  辞書に無い（gcsim の更新で消えた・書き間違い）: ${report.overridesMissing.join(', ')}`);
console.log(`実行のログで確認できたキー: 辞書にあった ${report.observedHits} 件、辞書に無く追加 ${report.observedAdded} 件（gcsim_key_observed.json）`);
console.log(`表示名: 手で補った ${naming.manual} 件、規則で付けた ${naming.rule} 件、一部が英語のまま ${naming.partial} 件、持ち主が分からず無し ${naming.unnamed} 件（表示は英語名 → キー名）`);
console.log(`定義場所が複数にまたがるキー ${report.ambiguous.length} 件:`);
for (const a of report.ambiguous) console.log(`  ${a.key} ← ${a.places.join(' / ')}`);
console.log(`未解決のキー名 ${report.unresolved.length} 件:`);
for (const u of report.unresolved) console.log(`  ${u.file}: ${u.expr}`);
console.log(`\n出力: ${outputPath}`);
