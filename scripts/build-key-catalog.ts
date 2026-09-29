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

const REPO = 'genshinsim/gcsim';
const BRANCH = 'main';
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

const { catalog, report } = extractKeyCatalog(files, tree.sha);

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
console.log(`定義場所が複数にまたがるキー ${report.ambiguous.length} 件:`);
for (const a of report.ambiguous) console.log(`  ${a.key} ← ${a.places.join(' / ')}`);
console.log(`未解決のキー名 ${report.unresolved.length} 件:`);
for (const u of report.unresolved) console.log(`  ${u.file}: ${u.expr}`);
console.log(`\n出力: ${outputPath}`);
