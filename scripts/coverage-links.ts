/**
 * gcsim の効果キーの紐付けの検査とレポートを、1 つの入口にまとめる（D95。2026-10-09）。
 *
 *   npm run coverage:links
 *
 * 順に行う:
 *   1. check:action-links … アクション定義の紐付け（スキル・爆発）が、入力（中間データ・手で補う一覧）と一致しているか
 *   2. check:effectkeys   … スキル・爆発側のカバレッジ（effect_key_coverage.json）
 *   3. coverage:master-effects … 固有天賦・命ノ星座・武器・聖遺物・元素共鳴側のカバレッジ（master_effect_coverage.json）
 * そのあと、2 本の結果を 1 枚にまとめた文書を書く: docs/gcsim-integration/phase-6-run-and-apply/key-link-coverage.md
 * 新キャラ・gcsim の更新のときは、この 1 つの文書の「未検討」だけを見ればよい。どれかが失敗したら、終了コード 1。
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const run = (script: string) => {
  console.log(`\n=== npm run ${script} ===`);
  execSync(`npm run ${script}`, { stdio: 'inherit' });
};
let failed = false;
for (const s of ['check:action-links', 'check:effectkeys', 'coverage:master-effects']) {
  try { run(s); } catch { failed = true; console.log(`✗ ${s} が失敗しました`); }
}

const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const a = read('src/data/effect_key_coverage.json');
const b = read('src/data/master_effect_coverage.json');

// A: unlinked は { side, id, reason }。紐づけ済み = links に載っている
const aLinkedEff = new Set(a.links.map((l: any) => l.effectId));
const aLinkedTgt = new Set(a.links.map((l: any) => l.targetId));
const aUn = new Map<string, any>(a.unlinked.map((u: any) => [`${u.side}:${u.id}`, u]));
const aState = (side: string, id: string, linked: Set<string>) => (linked.has(id) ? 'linked' : aUn.get(`${side}:${id}`)?.reason ?? 'unreviewed');
const bLinkedEff = new Set(b.links.map((l: any) => l.effectId));
const bLinkedTgt = new Set(b.links.map((l: any) => l.targetId));
const bUn = new Map<string, any>(b.unlinked.map((u: any) => [`${u.side}:${u.id}`, u]));
const bState = (side: string, id: string, linked: Set<string>) => (linked.has(id) ? 'linked' : bUn.get(`${side}:${id}`)?.state === 'unreviewed' ? 'unreviewed' : bUn.get(`${side}:${id}`)?.state === 'pending' ? 'pending' : bUn.get(`${side}:${id}`) ? `excluded` : 'unreviewed');

const count = (xs: string[]) => xs.reduce<Record<string, number>>((m, k) => { m[k] = (m[k] ?? 0) + 1; return m; }, {});
const aEff = count(a.effects.map((e: any) => aState('effect', e.id, aLinkedEff)));
const aTgt = count(a.targets.map((t: any) => aState('target', t.id, aLinkedTgt)));
const bEff = count(b.effects.map((e: any) => bState('effect', e.id, bLinkedEff)));
const bTgt = count(b.targets.map((t: any) => bState('target', t.id, bLinkedTgt)));
const fmt = (m: Record<string, number>) => Object.entries(m).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(' / ');

const unreviewed = [
  ...a.effects.filter((e: any) => aState('effect', e.id, aLinkedEff) === 'unreviewed').map((e: any) => `A 効果 \`${e.id}\``),
  ...a.targets.filter((t: any) => aState('target', t.id, aLinkedTgt) === 'unreviewed').map((t: any) => `A 対象 \`${t.id}\``),
  ...b.effects.filter((e: any) => bState('effect', e.id, bLinkedEff) !== 'linked' && bState('effect', e.id, bLinkedEff) === 'unreviewed').map((e: any) => `B 効果 \`${e.id}\``),
  ...b.targets.filter((t: any) => bState('target', t.id, bLinkedTgt) === 'unreviewed').map((t: any) => `B 対象 \`${t.id}\``),
];
const pending = b.unlinked.filter((u: any) => u.state === 'pending').length + a.unlinked.filter((u: any) => u.reason === 'deferred').length;

const md = [
  '# gcsim の効果キーの紐付け: 全体のカバレッジ',
  '',
  `作成: ${new Date().toISOString().slice(0, 10)} / gcsim の辞書のコミット ${String(b.gcsimCommit).slice(0, 8)} / 生成: \`npm run coverage:links\`（\`scripts/coverage-links.ts\`）`,
  '',
  '新キャラ・gcsim の更新のときは、この文書の「未検討」だけを見る。詳しい内訳は、A（スキル・爆発）= `effect-key-coverage.md`、B（固有天賦・命ノ星座・武器・聖遺物・元素共鳴）= `master-effect-coverage.md`。',
  '決定（紐づけない理由・個別の例外）の置き場は、`src/masterdata/keyLinkDecisions.ts`（一覧と、実際の場所の案内）。',
  '',
  `## 未検討・保留`,
  '',
  `- 未検討: **${unreviewed.length} 件**${unreviewed.length ? '' : '（なし）'}`,
  ...unreviewed.map(u => `  - ${u}`),
  `- 保留: ${pending} 件`,
  `- アクション定義の紐付けと入力の食い違い（check:action-links）: ${failed ? '**エラーあり。上の出力を確認**' : 'なし'}`,
  '',
  '## A: スキル・爆発（アクション定義の gcsimEffect・gcsimExtras・gcsimIncluded。中間データ ＋ 手で補う一覧から取り込む）',
  '',
  `- gcsim の効果 ${a.effects.length} 件: ${fmt(aEff)}`,
  `- アプリの対象（アクション定義）${a.targets.length} 件: ${fmt(aTgt)}`,
  '',
  '## B: 固有天賦・命ノ星座・武器・聖遺物・元素共鳴（定義の gcsimKeys など。辞書から自動で結び付ける）',
  '',
  `- gcsim の効果 ${b.effects.length} 件: ${fmt(bEff)}`,
  `- アプリの対象（定義）${b.targets.length} 件: ${fmt(bTgt)}`,
  '',
].join('\n');
fs.writeFileSync('docs/gcsim-integration/phase-6-run-and-apply/key-link-coverage.md', md);
console.log(`\n全体の文書を書きました: docs/gcsim-integration/phase-6-run-and-apply/key-link-coverage.md（未検討 ${unreviewed.length} 件・保留 ${pending} 件）`);
process.exit(failed || unreviewed.length > 0 ? 1 : 0);
