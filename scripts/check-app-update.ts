/**
 * アプリの更新の通知（更新履歴のポップアップ）の判定と、CHANGELOG.md の読み取りの確認（src/utils/changelog.ts）。
 *
 *   npm run check:app-update
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const c = await server.ssrLoadModule('/src/utils/changelog.ts');
const KEY = 'app_last_seen_app_version';

let passed = 0;
const check = (name: string, fn: () => void) => {
  store.clear();
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

const sample = c.parseChangelog(`# 変更履歴

## [Unreleased]
- 未リリースの項目

## [1.2.0] - 2026-02-01

### 追加
- 機能 B
  の続きの行

### 修正
- 不具合 C を直した

## [1.1.0] - 2026-01-10

### 追加
- 機能 A

## [1.0.0] - 2026-01-01
- 最初の版

[1.2.0]: https://example.com/compare
`);

check('更新履歴: 版ごとに、種類・項目へ分ける（[Unreleased]・リンクは除く。字下げの続きは前の項目に足す）', () => {
  assert.deepEqual(sample.map((e: any) => e.version), ['1.2.0', '1.1.0', '1.0.0']);
  assert.equal(sample[0].date, '2026-02-01');
  assert.deepEqual(sample[0].sections.map((s: any) => s.title), ['追加', '修正']);
  assert.equal(sample[0].sections[0].items[0], '機能 B の続きの行');
  assert.equal(sample[2].sections[0].title, '変更');
});

check('版の比較: 数で比べる（1.10.0 は 1.9.0 より新しい）。読めない版は最も古い', () => {
  assert.ok(c.compareVersions('1.10.0', '1.9.0') > 0);
  assert.ok(c.compareVersions('1.2.0', '1.2.0') === 0);
  assert.ok(c.compareVersions('x', '0.0.1') < 0);
});

check('記録あり・今の版が新しい: 通知し、記録より新しく今の版以下の節を、新しい順に出す', () => {
  store.set(KEY, '1.0.0');
  const n = c.evaluateAppUpdate('1.2.0', sample, true);
  assert.equal(n.show, true);
  assert.equal(n.previous, '1.0.0');
  assert.deepEqual(n.entries.map((e: any) => e.version), ['1.2.0', '1.1.0']);
});
check('記録あり・今の版が、まだ記録より先のとき（履歴にない版）: 通知するが、今の版より新しい節は出さない', () => {
  store.set(KEY, '1.1.0');
  const n = c.evaluateAppUpdate('1.1.5', sample, true);
  assert.equal(n.show, true);
  assert.deepEqual(n.entries.map((e: any) => e.version), []);
});
check('記録あり・同じ版: 通知しない', () => {
  store.set(KEY, '1.2.0');
  assert.equal(c.evaluateAppUpdate('1.2.0', sample, true).show, false);
});
check('記録あり・今の版が古い（古い版を開いた）: 通知せず、記録も進めない', () => {
  store.set(KEY, '1.2.0');
  assert.equal(c.evaluateAppUpdate('1.1.0', sample, true).show, false);
  c.markAppVersionSeen('1.1.0');
  assert.equal(store.get(KEY), '1.2.0');
});
check('記録なし・保存データなし（初めての利用者）: 通知しない', () => {
  assert.equal(c.evaluateAppUpdate('1.2.0', sample, false).show, false);
});
check('記録なし・保存データあり（導入前からの利用者）: 前の版が不明なので、今の版以下の全ての節を出す', () => {
  const n = c.evaluateAppUpdate('1.2.0', sample, true);
  assert.equal(n.show, true);
  assert.equal(n.previous, null);
  assert.deepEqual(n.entries.map((e: any) => e.version), ['1.2.0', '1.1.0', '1.0.0']);
  assert.deepEqual(c.evaluateAppUpdate('1.1.0', sample, true).entries.map((e: any) => e.version), ['1.1.0', '1.0.0']);
});
check('開発中の版（0.0.0-dev）: 通知せず、記録もしない', () => {
  store.set(KEY, '1.0.0');
  assert.equal(c.evaluateAppUpdate('0.0.0-dev', sample, true).show, false);
  c.markAppVersionSeen('0.0.0-dev');
  assert.equal(store.get(KEY), '1.0.0');
});
check('記録: 確認済みにすると、今の版が残る', () => {
  c.markAppVersionSeen('1.2.0');
  assert.equal(store.get(KEY), '1.2.0');
});
check('保存データの有無: 編成・保存編成・DB のどれかがあれば、あり', () => {
  assert.equal(c.hasAnyStoredData(), false);
  store.set('genshin_rotation_saved_slots_v2', '[]');
  assert.equal(c.hasAnyStoredData(), true);
});

// 実際の CHANGELOG.md: 今の版の節が、あること
const real = c.parseChangelog(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'));
const pkgVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
check('実際の CHANGELOG.md: 読めて、package.json の版の節がある（版を上げた直後は、リリース前の検査が見る）', () => {
  assert.ok(real.length > 5);
  assert.ok(real.every((e: any) => e.sections.length > 0), '項目の無い版がある');
  assert.ok(real.some((e: any) => e.version === pkgVersion), `CHANGELOG.md に ${pkgVersion} の節がない`);
});

await server.close();
console.log(`\n合格（${passed} 件）`);
