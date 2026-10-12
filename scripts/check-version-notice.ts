/**
 * マスターデータ（DB）の更新の通知の判定の確認（src/utils/versionNotice.ts。D196・D198）。
 *
 *   npm run check:version-notice
 */
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const v = await server.ssrLoadModule('/src/utils/versionNotice.ts');
const KEY_SEEN = 'app_last_seen_db_version';
const KEY_DB = 'genshin_app_db_v1';

let passed = 0;
const check = (name: string, fn: () => void) => {
  store.clear();
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

check('記録なし・DB なし（初めての利用者）: 通知しない', () => {
  const n = v.evaluateVersionNotice(72);
  assert.equal(n.show, false);
  assert.equal(n.previous, null);
});
check('記録なし・保存 DB が古い（導入前からの利用者）: 通知する', () => {
  store.set(KEY_DB, JSON.stringify({ version: 70, characters: [] }));
  const n = v.evaluateVersionNotice(72);
  assert.equal(n.show, true);
  assert.equal(n.previous, 70);
});
check('記録なし・保存 DB が最新: 通知しない', () => {
  store.set(KEY_DB, JSON.stringify({ version: 72 }));
  assert.equal(v.evaluateVersionNotice(72).show, false);
});
check('記録なし・version の無い旧 DB: 通知する', () => {
  store.set(KEY_DB, JSON.stringify({ characters: [] }));
  const n = v.evaluateVersionNotice(72);
  assert.equal(n.show, true);
  assert.equal(n.previous, 0);
});
check('記録なし・DB が壊れている: 通知しない（落ちない）', () => {
  store.set(KEY_DB, '{not json');
  assert.equal(v.evaluateVersionNotice(72).show, false);
});
check('置き換え前の version の記録: 記録が無いときだけ残す（loadDatabase が先に走った場合）', () => {
  v.noteStoredDbVersion(70);
  assert.equal(store.get(KEY_SEEN), '70');
  v.noteStoredDbVersion(72); // 2 回目は上書きしない
  assert.equal(store.get(KEY_SEEN), '70');
  // 置き換えで DB の version が最新に書き換わっても、記録から通知できる
  store.set(KEY_DB, JSON.stringify({ version: 72 }));
  const n = v.evaluateVersionNotice(72);
  assert.equal(n.show, true);
  assert.equal(n.previous, 70);
});
check('記録が古い: 通知する', () => {
  store.set(KEY_SEEN, '71');
  const n = v.evaluateVersionNotice(72);
  assert.equal(n.show, true);
  assert.equal(n.previous, 71);
});
check('記録と同じ: 通知しない', () => {
  store.set(KEY_SEEN, '72');
  assert.equal(v.evaluateVersionNotice(72).show, false);
});
check('記録より古い DB のアプリを開いた: 通知しない・記録を進めない', () => {
  store.set(KEY_SEEN, '73');
  assert.equal(v.evaluateVersionNotice(72).show, false);
  v.markVersionSeen(72);
  assert.equal(store.get(KEY_SEEN), '73');
});
check('記録: 通知後に記録し、次の読み込みでは通知しない', () => {
  store.set(KEY_SEEN, '71');
  assert.equal(v.evaluateVersionNotice(72).show, true);
  v.markVersionSeen(72);
  assert.equal(store.get(KEY_SEEN), '72');
  assert.equal(v.evaluateVersionNotice(72).show, false);
});
check('記録: 初めての利用でも、DB のバージョンが記録される', () => {
  v.markVersionSeen(72);
  assert.equal(store.get(KEY_SEEN), '72');
});
check('記録の値が壊れていても、落ちない（保存 DB で判定する）', () => {
  store.set(KEY_SEEN, 'xyz');
  assert.equal(v.evaluateVersionNotice(72).show, false);
  store.set(KEY_DB, JSON.stringify({ version: 60 }));
  assert.equal(v.evaluateVersionNotice(72).show, true);
});

await server.close();
console.log(`\n✓ 更新の通知: ${passed} 項目すべて合格`);
process.exit(0);
