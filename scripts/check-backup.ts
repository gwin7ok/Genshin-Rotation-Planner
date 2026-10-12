/**
 * 「全データのバックアップ」の往復の確認（src/utils/backup.ts。D174）。
 *
 *   npm run check:backup
 *
 * 偽の localStorage に、現在の編成・保存編成・設定・利用者のデータを入れ、書き出し → 全消去 → 復元して、同じになることを確かめる。
 * あわせて、復元の規則（古い保存編成で上書きしない）と、読み込めないファイルの扱いを確かめる。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

// 偽の localStorage（アプリのモジュールを読む前に用意する）
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const backup = await server.ssrLoadModule('/src/utils/backup.ts');
const storage = await server.ssrLoadModule('/src/utils/storage.ts');
const dbService = await server.ssrLoadModule('/src/utils/databaseService.ts');

const results: string[] = [];
const check = (name: string, fn: () => void) => {
  fn();
  results.push(name);
  console.log(`✓ ${name}`);
};

const member = (id: string) => ({ characterId: id, constellation: 0, energyRecharge: 100 });
const slot = (id: string, name: string, updatedAt: string) => ({
  id, name, description: `${name} の説明`, updatedAt,
  party: [member('10000032-pyro')], stints: [{ id: `st_${id}`, characterId: '10000032-pyro', note: '', actions: [] }],
  loopStartIndex: 0, loopStartTime: 0, totalDuration: 12.5, switchDelay: 0.7,
});

// --- 元のデータを入れる ---
const SLOTS = [slot('slot_1', '編成A', '2026-10-01T00:00:00.000Z'), slot('slot_2', '編成B', '2026-10-02T00:00:00.000Z')];
store.set('genshin_rotation_saved_slots_v2', JSON.stringify(SLOTS));
storage.saveActiveState({ party: [member('10000025-hydro')], stints: [{ id: 'cur', characterId: '10000025-hydro', note: 'メモ', actions: [] }], loopStartIndex: 0, switchDelay: 0.6, activeSlotId: 'slot_2' });
store.set('gcsimDefHalt', 'false');
store.set('gcsimHurt', JSON.stringify({ enabled: true, interval: 3 }));
store.set('rotationNotationMode', 'name');

const masterDb = dbService.loadDatabase();
const someChar = masterDb.characters[0];
const customChar = { ...structuredClone(someChar), id: 'custom_test_char', name: 'テスト用キャラ', isCustom: true };
const lockedWeapon = { ...structuredClone(masterDb.weapons[0]), isLocked: true, description: '利用者が編集した説明' };
dbService.saveDatabase({ ...masterDb, characters: [...masterDb.characters, customChar], weapons: [lockedWeapon, ...masterDb.weapons.slice(1)] });

// --- 書き出し ---
const file = backup.buildBackup(new Date('2026-10-12T00:00:00Z'));
const text = JSON.stringify(file, null, 2);

check('書き出し: 内容の数', () => {
  const s = backup.summarizeBackup(file);
  assert.equal(s.slots, 2);
  assert.equal(s.hasCurrentState, true);
  assert.equal(s.settings, 3);
  assert.equal(s.characters, 1);
  assert.equal(s.weapons, 1);
  assert.equal(s.artifacts, 0);
});
check('書き出し: アプリの版と gcsim の版を記録する', () => {
  assert.equal(typeof file.app.version, 'string');
  assert.ok(file.app.version.length > 0);
  assert.match(file.app.gcsimVersion, /^v\d+\.\d+\.\d+/);
});
check('書き出し: マスターの項目を含めない（利用者のものだけ）', () => {
  assert.ok(file.database.characters.every((c: any) => c.isCustom || c.isLocked || c.id.startsWith('custom_')));
  assert.ok(text.length < 200_000, `大きすぎる: ${text.length}`);
});

// --- 全消去 → 復元 ---
store.clear();
const parsed = backup.parseBackup(text);
check('読み込み: 形式の検査に通る', () => assert.equal(parsed.ok, true));
const restored = backup.restoreBackup(parsed.backup);

check('復元: 保存編成が、全件・同じ内容で戻る', () => {
  assert.equal(restored.slotsAdded, 2);
  assert.deepEqual(storage.getSavedSlots(), SLOTS);
});
check('復元: 現在の編成が戻る', () => {
  const s = storage.loadActiveState();
  assert.equal(s.stints[0].note, 'メモ');
  assert.equal(s.switchDelay, 0.6);
  assert.equal(s.activeSlotId, 'slot_2');
});
check('復元: 設定が戻る', () => {
  assert.equal(store.get('gcsimDefHalt'), 'false');
  assert.equal(store.get('gcsimHurt'), JSON.stringify({ enabled: true, interval: 3 }));
  assert.equal(store.get('rotationNotationMode'), 'name');
});
check('復元: 利用者のデータベースの項目が戻る（マスターの上に重なる）', () => {
  const db = dbService.loadDatabase();
  const c = db.characters.find((x: any) => x.id === 'custom_test_char');
  assert.equal(c?.name, 'テスト用キャラ');
  const w = db.weapons.find((x: any) => x.id === lockedWeapon.id);
  assert.equal(w?.description, '利用者が編集した説明');
  assert.equal(w?.isLocked, true);
});

// --- 規則 ---
check('規則: 今のブラウザの保存編成のほうが新しいときは、上書きしない', () => {
  const newer = { ...SLOTS[0], name: '新しい編成A', updatedAt: '2026-11-01T00:00:00.000Z' };
  storage.replaceSavedSlots([newer, SLOTS[1]]);
  const r = backup.restoreBackup(parsed.backup, { restoreCurrent: false });
  assert.equal(r.slotsKept, 2);
  assert.equal(r.slotsAdded + r.slotsUpdated, 0);
  assert.equal(storage.getSavedSlots()[0].name, '新しい編成A');
});
check('規則: バックアップのほうが新しいときは置き換え、無い編成は足す', () => {
  storage.replaceSavedSlots([{ ...SLOTS[0], name: '古い編成A', updatedAt: '2026-09-01T00:00:00.000Z' }]);
  const r = backup.restoreBackup(parsed.backup, { restoreCurrent: false });
  assert.equal(r.slotsUpdated, 1);
  assert.equal(r.slotsAdded, 1);
  const slots = storage.getSavedSlots();
  assert.equal(slots.length, 2);
  assert.equal(slots.find((s: any) => s.id === 'slot_1').name, '編成A');
});
check('規則: 現在の編成を戻さない指定（restoreCurrent: false）', () => {
  storage.saveActiveState({ party: [member('x')], stints: [], loopStartIndex: 0 });
  const r = backup.restoreBackup(parsed.backup, { restoreCurrent: false });
  assert.equal(r.currentStateRestored, false);
  assert.equal(storage.loadActiveState().party[0].characterId, 'x');
});

// --- 読み込めないファイル ---
check('拒否: JSON でないもの', () => assert.equal(backup.parseBackup('これはJSONではない').ok, false));
check('拒否: 1 つの編成の JSON（別の形式）', () => {
  const r = backup.parseBackup(JSON.stringify({ name: 'x', party: [], stints: [] }));
  assert.equal(r.ok, false);
  assert.match(r.error, /全データのバックアップ/);
});
check('拒否: 新しい版の形式', () => {
  const r = backup.parseBackup(JSON.stringify({ ...file, version: 999 }));
  assert.equal(r.ok, false);
  assert.match(r.error, /新しい版/);
});
check('拒否: 項目が欠けている', () => {
  const { savedSlots: _s, ...rest } = file;
  void _s;
  assert.equal(backup.parseBackup(JSON.stringify(rest)).ok, false);
});
check('設定: 未知のキーは取り込まない', () => {
  const r = backup.parseBackup(JSON.stringify({ ...file, settings: { ...file.settings, evilKey: 'x' } }));
  assert.equal(r.ok, true);
  assert.equal('evilKey' in r.backup.settings, false);
});

// --- 保存層（persistence.ts。D175） ---
const persistence = await server.ssrLoadModule('/src/utils/persistence.ts');
const settings = await server.ssrLoadModule('/src/utils/appSettings.ts');

check('保存層: キーの文字列が、公開済みのデータと同じ（変えると、利用者のデータが読めなくなる）', () => {
  assert.deepEqual({ ...persistence.STORAGE_KEYS }, {
    activeRotation: 'genshin_rotation_current_state_v2',
    savedSlots: 'genshin_rotation_saved_slots_v2',
    database: 'genshin_app_db_v1',
  });
  assert.deepEqual({ ...persistence.SETTING_KEYS }, { gcsimDefHalt: 'gcsimDefHalt', gcsimHurt: 'gcsimHurt', rotationNotationMode: 'rotationNotationMode' });
  assert.equal(persistence.DEVICE_KEYS.gcsimEngine, 'gcsim_engine');
  assert.ok(!persistence.BACKUP_SETTING_KEYS.includes('gcsim_engine'), '端末だけの設定は、バックアップに含めない');
});
check('保存層: 書き込みが失敗しても例外を投げない（容量超過）', () => {
  persistence.setPersistenceBackend({
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {
      throw new Error('x');
    },
  });
  try {
    assert.equal(persistence.writeString('k', 'v'), false);
    assert.equal(persistence.writeJson('k', { a: 1 }), false);
    persistence.removeKey('k');
    assert.equal(storage.getSavedSlots().length, 0);
  } finally {
    persistence.setPersistenceBackend(null);
  }
});
check('保存層: 壊れた JSON は null（例外にしない）', () => {
  store.set('broken', '{not json');
  assert.equal(persistence.readJson('broken'), null);
  assert.equal(persistence.readJson('nothing'), null);
});
check('設定: 既定値と、保存・読み込みの往復', () => {
  store.clear();
  assert.equal(settings.loadDefHalt(), true);
  assert.equal(settings.loadNotationMode(), 'short');
  const defaults = settings.loadHurt();
  settings.saveDefHalt(false);
  settings.saveNotationMode('name');
  settings.saveHurt({ ...defaults, enabled: true });
  assert.equal(settings.loadDefHalt(), false);
  assert.equal(settings.loadNotationMode(), 'name');
  assert.equal(settings.loadHurt().enabled, true);
});

// --- 規則: localStorage を、persistence.ts 以外から直接呼ばない ---
check('規則: src/ の localStorage の直接呼び出しは persistence.ts だけ', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p);
      } else if (/\.(ts|tsx)$/.test(e.name) && !p.split(path.sep).join('/').endsWith('src/utils/persistence.ts')) {
        if (/\b(localStorage|sessionStorage)\s*[.[]/.test(fs.readFileSync(p, 'utf8'))) offenders.push(p);
      }
    }
  };
  walk('src');
  assert.deepEqual(offenders, [], `persistence.ts を通してください: ${offenders.join(', ')}`);
});

await server.close();
console.log(`\n✓ バックアップの往復: ${results.length} 項目すべて合格`);
process.exit(0);
