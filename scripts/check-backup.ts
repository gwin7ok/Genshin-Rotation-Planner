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

// --- 壊れたバックアップ・保存の失敗（レビュー後の修正） ---
const pers = await server.ssrLoadModule('/src/utils/persistence.ts');
const idSort = await server.ssrLoadModule('/src/utils/idSort.ts');
const dbImport = await server.ssrLoadModule('/src/utils/databaseImport.ts');

check('拒否ではなく除外: database に壊れた要素・ID の重複があっても読める（落ちない）', () => {
  const dirty = {
    ...file,
    database: {
      // 有効な項目（マスターの複製）と、壊れた項目（ID なし・ID の重複・画面が使う項目の型が違う）
      characters: [null, 5, { name: 'ID なし' }, { ...structuredClone(someChar), id: 'custom_a', name: 'A' }, { ...structuredClone(someChar), id: 'custom_a', name: 'A 重複' }, { id: 'custom_b' }],
      weapons: [{ ...structuredClone(masterDb.weapons[0]), id: 'weapon_custom_1', name: 'W' }],
      artifacts: [],
    },
    savedSlots: [null, { id: 'ok', party: [], name: 'n', updatedAt: '2026-10-01T00:00:00.000Z' }, { id: 'no_party' }],
  };
  const r = backup.parseBackup(JSON.stringify(dirty));
  assert.equal(r.ok, true);
  assert.deepEqual(r.backup.database.characters.map((c: any) => c.id), ['custom_a']);
  assert.equal(r.backup.database.characters[0].name, 'A');
  assert.equal(r.skipped.items, 5);
  assert.equal(r.skipped.slots, 2);
  store.clear();
  const res = backup.restoreBackup(r.backup, { restoreCurrent: false });
  assert.equal(res.ok, true);
  assert.equal(res.items, 2);
});
check('拒否: 現在の編成の party に null が混ざっているもの', () => {
  const r = backup.parseBackup(JSON.stringify({ ...file, currentState: { party: [null], stints: [] } }));
  assert.equal(r.ok, false);
});
check('規則: 更新日時が読めないときの扱い（今のものが読めない→置き換え／バックアップが読めない→今のものを残す）', () => {
  store.clear();
  storage.replaceSavedSlots([{ ...SLOTS[0], updatedAt: 'ふ明' }, { ...SLOTS[1] }]);
  const r1 = backup.restoreBackup({ ...parsed.backup, savedSlots: [{ ...SLOTS[0], name: '置換される' }, { ...SLOTS[1], updatedAt: 'ふ明', name: '残される' }] }, { restoreCurrent: false });
  assert.equal(r1.slotsUpdated, 1);
  assert.equal(r1.slotsKept, 1);
  const slots = storage.getSavedSlots();
  assert.equal(slots.find((s: any) => s.id === 'slot_1').name, '置換される');
  assert.equal(slots.find((s: any) => s.id === 'slot_2').name, '編成B');
});
check('保存の失敗: 復元の途中で書き込みが失敗したら、元の状態に戻し、ok: false を返す', () => {
  store.clear();
  const originalSlots = [slot('slot_x', '元の編成', '2026-10-01T00:00:00.000Z')];
  store.set('genshin_rotation_saved_slots_v2', JSON.stringify(originalSlots));
  store.set('gcsimDefHalt', 'true');
  const ls = (globalThis as any).localStorage;
  const realSet = ls.setItem;
  const failures: string[] = [];
  pers.setWriteFailureHandler((k: string) => failures.push(k));
  // データベースの保存で容量超過にする（保存編成・設定は、すでに書き込まれたあと）
  ls.setItem = (k: string, v: string) => {
    if (k === 'genshin_app_db_v1') throw new Error('QuotaExceededError');
    realSet(k, v);
  };
  try {
    const r = backup.restoreBackup(parsed.backup, { restoreCurrent: true });
    assert.equal(r.ok, false);
    assert.match(r.error, /保存できませんでした/);
    assert.equal(r.slotsAdded + r.items + r.settings, 0);
  } finally {
    ls.setItem = realSet;
    pers.setWriteFailureHandler(null);
  }
  assert.deepEqual(storage.getSavedSlots(), originalSlots, '保存編成が元に戻っている');
  assert.equal(store.get('gcsimDefHalt'), 'true', '設定が元に戻っている');
  assert.equal(store.has('genshin_app_db_v1'), false);
  assert.equal(storage.loadActiveState(), null);
  assert.ok(failures.includes('genshin_app_db_v1'), '書き込みの失敗がハンドラに伝わる');
});
check('保存の失敗: 保存先が無い環境でもハンドラに知らせる（例外にしない）', () => {
  let called = 0;
  pers.setWriteFailureHandler(() => called++);
  pers.setPersistenceBackend({ getItem: () => null, setItem: () => { throw new Error('x'); }, removeItem: () => {} });
  try {
    assert.equal(storage.saveActiveState({ party: [], stints: [] }), false);
    assert.equal(storage.replaceSavedSlots([]), false);
    assert.equal(dbService.saveDatabase(dbService.loadDatabase()), false);
  } finally {
    pers.setPersistenceBackend(null);
    pers.setWriteFailureHandler(null);
  }
  assert.equal(called, 3);
});
check('保存編成: 一覧に null が混ざっていても読める', () => {
  store.set('genshin_rotation_saved_slots_v2', JSON.stringify([null, SLOTS[0]]));
  assert.equal(storage.getSavedSlots().length, 1);
});
check('並び: 武器・聖遺物の ID（利用者の作成が先・新しい順 → マスターは数値の降順）', () => {
  const ids = ['11101', 'weapon_custom_100', '15502', 'art_custom_200', 'weapon_custom_300', 'zzz', '11201'];
  assert.deepEqual([...ids].sort(idSort.compareIdDesc), ['weapon_custom_300', 'art_custom_200', 'weapon_custom_100', '15502', '11201', '11101', 'zzz']);
});
check('DB 取り込み: 形の検査・壊れた要素の除外・ID の重複', () => {
  assert.equal(dbImport.parseDatabaseFile('x').ok, false);
  assert.equal(dbImport.parseDatabaseFile(JSON.stringify({ characters: [], weapons: [] })).ok, false);
  const r = dbImport.parseDatabaseFile(JSON.stringify({
    characters: [{ ...structuredClone(someChar), id: 'a', name: 'A' }, { ...structuredClone(someChar), id: 'a', name: 'A2' }, null, { id: 3 }],
    weapons: [{ ...structuredClone(masterDb.weapons[0]), id: 'w', name: 'W' }],
    artifacts: [],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 3);
  assert.deepEqual(r.counts, { characters: 1, weapons: 1, artifacts: 0 });
  assert.equal(r.db.version, 0);
});

const presetsForFailure = await server.ssrLoadModule('/src/utils/presets.ts');
check('保存の失敗: 容量がぎりぎりのときも、書いた順の逆に戻して、元の状態に戻せる（戻す順が悪いと、戻す書き込みも容量超過になる）', () => {
  store.clear();
  const bigSlot = slot('slot_x', 'あ'.repeat(600), '2026-10-01T00:00:00.000Z');
  store.set('genshin_rotation_saved_slots_v2', JSON.stringify([bigSlot]));
  store.set('gcsimDefHalt', 'true');
  const total = () => [...store.entries()].reduce((n, [k, v]) => n + k.length + v.length, 0);
  const CAP = total() + 60;
  const ls = (globalThis as any).localStorage;
  const realSet = ls.setItem;
  pers.setWriteFailureHandler(() => {});
  ls.setItem = (k: string, v: string) => {
    if (k === 'genshin_app_db_v1') throw new Error('QuotaExceededError');
    const others = [...store.entries()].reduce((n, [kk, vv]) => (kk === k ? n : n + kk.length + vv.length), 0);
    if (others + k.length + v.length > CAP) throw new Error('QuotaExceededError');
    realSet(k, v);
  };
  try {
    // 保存編成は、新しい（小さい）ものに置き換わって容量が空き、その容量を、大きな設定が使う。そのあと、データベースの保存で失敗する
    const small = slot('slot_x', '小', '2026-10-05T00:00:00.000Z');
    const r = backup.restoreBackup({ ...parsed.backup, savedSlots: [small], settings: { gcsimDefHalt: 'x'.repeat(500) } }, { restoreCurrent: false });
    assert.equal(r.ok, false);
    assert.match(r.error, /今のデータは、変更していません/, '元に戻せたことを、正しく伝える');
  } finally {
    ls.setItem = realSet;
    pers.setWriteFailureHandler(null);
  }
  assert.deepEqual(storage.getSavedSlots(), [bigSlot], '保存編成が、元の大きな内容に戻っている');
  assert.equal(store.get('gcsimDefHalt'), 'true', '設定が元に戻っている');
});
check('保存の失敗: 元に戻すことにも失敗したときは、そう伝える（「変更していません」と言わない）', () => {
  store.clear();
  store.set('genshin_rotation_saved_slots_v2', JSON.stringify([slot('slot_x', '元', '2026-10-01T00:00:00.000Z')]));
  const ls = (globalThis as any).localStorage;
  const realSet = ls.setItem;
  pers.setWriteFailureHandler(() => {});
  // 保存編成の書き込みだけ成功し、そのあとは、すべて失敗する（巻き戻しの書き込みも失敗）
  let writes = 0;
  ls.setItem = (k: string, v: string) => {
    writes++;
    if (writes > 1) throw new Error('QuotaExceededError');
    realSet(k, v);
  };
  try {
    const r = backup.restoreBackup({ ...parsed.backup, savedSlots: [slot('slot_y', '新', '2026-10-05T00:00:00.000Z')], settings: { gcsimDefHalt: 'false' } }, { restoreCurrent: false });
    assert.equal(r.ok, false);
    assert.match(r.error, /元の状態に戻すことにも失敗/);
    assert.doesNotMatch(r.error, /今のデータは、変更していません/);
  } finally {
    ls.setItem = realSet;
    pers.setWriteFailureHandler(null);
  }
});
check('保存編成の保存・削除: 容量超過のときは ok: false で、保存済みの内容を返す（成功にしない）', () => {
  store.clear();
  const base = slot('slot_keep', '残す編成', '2026-10-01T00:00:00.000Z');
  assert.equal(storage.trySaveSlot(base).ok, true);
  const ls = (globalThis as any).localStorage;
  const realSet = ls.setItem;
  const failures: string[] = [];
  pers.setWriteFailureHandler((k: string) => failures.push(k));
  ls.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  try {
    const added = storage.trySaveSlot(slot('slot_new', '新しい編成', '2026-10-02T00:00:00.000Z'));
    assert.equal(added.ok, false);
    assert.deepEqual(added.slots.map((s: any) => s.id), ['slot_keep'], '保存されている内容を返す');
    const removed = storage.tryDeleteSlot('slot_keep');
    assert.equal(removed.ok, false);
    assert.deepEqual(removed.slots.map((s: any) => s.id), ['slot_keep'], '削除できていない');
    const restored = presetsForFailure.restorePresets();
    assert.equal(restored.ok, false);
    assert.equal(restored.added + restored.overwritten, 0);
  } finally {
    ls.setItem = realSet;
    pers.setWriteFailureHandler(null);
  }
  assert.ok(failures.length >= 3, '書き込みの失敗が、通知される');
  assert.deepEqual(storage.getSavedSlots().map((s: any) => s.id), ['slot_keep'], '保存先は、変わっていない');
  const ok = storage.trySaveSlot(slot('slot_new', '新しい編成', '2026-10-02T00:00:00.000Z'));
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.slots.map((s: any) => s.id), ['slot_new', 'slot_keep']);
  assert.equal(storage.tryDeleteSlot('slot_new').ok, true);
  assert.equal(storage.saveSlot(slot('slot_x', 'x', '2026-10-03T00:00:00.000Z'))[0].id, 'slot_x', '従来の saveSlot も、一覧を返す');
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
  assert.deepEqual({ ...persistence.SETTING_KEYS }, { gcsimDefHalt: 'gcsimDefHalt', gcsimHurt: 'gcsimHurt', rotationNotationMode: 'rotationNotationMode', language: 'appLanguage' });
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

// --- 反応の行（gcsim の結果）の保存: gcsim のバージョンつき。古いバージョンのものは出さない（D205） ---
const savedReactions = await server.ssrLoadModule('/src/utils/gcsim/savedReactions.ts');
const gcsimConfig = await server.ssrLoadModule('/src/utils/gcsim/gcsimConfig.ts');
const sampleRows = [
  { kind: 'verdantdew', lap: 1, max: 3, segments: [{ start: { actionId: 'a1', offset: 0.5 }, end: { actionId: 'a2', offset: 0 }, count: 2 }] },
  { kind: 'lunarcharged', lap: 2, segments: [{ start: { actionId: 'a3', offset: 0 }, end: { actionId: 'a3', offset: 5.5 } }] },
];

check('反応の行: 保存 → 読み込みで、同じ内容に戻る（gcsim のバージョンつき）', () => {
  const packed = savedReactions.packReactions(sampleRows);
  assert.equal(packed.gcsimVersion, gcsimConfig.GCSIM_VERSION);
  assert.deepEqual(savedReactions.unpackReactions(JSON.parse(JSON.stringify(packed))), sampleRows);
});
check('反応の行: 無い・空は、保存しない', () => {
  assert.equal(savedReactions.packReactions(null), undefined);
  assert.equal(savedReactions.packReactions([]), undefined);
  assert.equal(savedReactions.unpackReactions(undefined), null);
});
check('反応の行: gcsim のバージョンが違う（古い計算結果）は、出さない', () => {
  assert.equal(savedReactions.unpackReactions({ gcsimVersion: 'v0.0.0', rows: sampleRows }), null);
  assert.equal(savedReactions.unpackReactions({ rows: sampleRows }), null);
  assert.deepEqual(savedReactions.unpackReactions({ gcsimVersion: 'v9.9.9', rows: sampleRows }, 'v9.9.9'), sampleRows);
});
check('反応の行: 状態の判定（none / ok / stale / invalid。旧バージョンの案内・印に使う）', () => {
  const v = gcsimConfig.GCSIM_VERSION;
  assert.equal(savedReactions.reactionsStatus(undefined).status, 'none');
  assert.equal(savedReactions.reactionsStatus({ gcsimVersion: v, rows: [] }).status, 'none');
  assert.equal(savedReactions.reactionsStatus({ gcsimVersion: v, rows: sampleRows }).status, 'ok');
  const stale = savedReactions.reactionsStatus({ gcsimVersion: 'v0.0.0', rows: sampleRows });
  assert.equal(stale.status, 'stale');
  assert.equal(stale.savedVersion, 'v0.0.0');
  assert.equal(savedReactions.reactionsStatus({ gcsimVersion: 'v0.0.0', rows: [{ kind: 'unknown', lap: 1, segments: [] }] }).status, 'invalid');
  assert.equal(savedReactions.reactionsStatus({ gcsimVersion: v, rows: [{ kind: 'unknown', lap: 1, segments: [] }] }).status, 'invalid');
});
check('反応の行: 形が壊れているものは、出さない（落ちない）', () => {
  const v = gcsimConfig.GCSIM_VERSION;
  assert.equal(savedReactions.unpackReactions({ gcsimVersion: v, rows: [{ kind: 'unknown', lap: 1, segments: [] }] }), null);
  assert.equal(savedReactions.unpackReactions({ gcsimVersion: v, rows: [{ kind: 'verdantdew', lap: 3, segments: [] }] }), null);
  assert.equal(savedReactions.unpackReactions({ gcsimVersion: v, rows: [{ kind: 'verdantdew', lap: 1, segments: [{ start: {}, end: {} }] }] }), null);
  assert.equal(savedReactions.unpackReactions('x'), null);
});
check('反応の行: 保存編成・現在の編成・バックアップの往復で、残る', () => {
  const packed = savedReactions.packReactions(sampleRows);
  storage.saveSlot({ ...slot('slot_r', '反応つき', '2026-10-03T00:00:00.000Z'), reactions: packed });
  storage.saveActiveState({ party: [member('10000025-hydro')], stints: [{ id: 'cur2', characterId: '10000025-hydro', note: '', actions: [] }], loopStartIndex: 0, switchDelay: 0.5, activeSlotId: null, reactions: packed });
  const text2 = JSON.stringify(backup.buildBackup(new Date('2026-10-12T00:00:00Z')));
  const parsed = backup.parseBackup(text2);
  assert.equal(parsed.ok, true);
  const s = parsed.backup.savedSlots.find((x: any) => x.id === 'slot_r');
  assert.deepEqual(savedReactions.unpackReactions(s.reactions), sampleRows);
  assert.deepEqual(savedReactions.unpackReactions(parsed.backup.currentState.reactions), sampleRows);
});

// --- プリセット編成（同梱の 5 編成。D207） ---
const presets = await server.ssrLoadModule('/src/utils/presets.ts');
const SLOTS_KEY = 'genshin_rotation_saved_slots_v2';
const masterRaw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const masterIds = new Set<string>((Array.isArray(masterRaw) ? masterRaw : masterRaw.characters ?? Object.values(masterRaw)).map((c: any) => c.id));

check('プリセット: 5 編成・名前の先頭は「[プリセット]」・ID は重ならない・キャラはマスターにある', () => {
  const list = presets.buildPresetSlots(new Date('2026-10-12T00:00:00Z'));
  assert.equal(list.length, 5);
  assert.equal(presets.PRESET_COUNT, 5);
  assert.ok(list.every((s: any) => s.name.startsWith('[プリセット]')));
  assert.equal(new Set(list.map((s: any) => s.id)).size, 5);
  for (const s of list) {
    assert.ok(s.party.length === 4 && s.stints.length > 0, s.name);
    for (const m of s.party) assert.ok(masterIds.has(m.characterId), `${s.name}: ${m.characterId} がマスターにありません`);
    for (const st of s.stints) assert.ok(s.party.some((m: any) => m.characterId === st.characterId), `${s.name}: 出場のキャラが編成にいません`);
  }
});
check('プリセット: 初めて使うとき（保存先が無い）だけ、入れる', () => {
  const backupSlots = store.get(SLOTS_KEY);
  store.delete(SLOTS_KEY);
  assert.equal(presets.seedPresetsOnFirstRun(), true);
  assert.equal(JSON.parse(store.get(SLOTS_KEY)!).length, 5);
  // 保存先があるときは、何もしない（全部消した利用者に、勝手に足さない）
  store.set(SLOTS_KEY, '[]');
  assert.equal(presets.seedPresetsOnFirstRun(), false);
  assert.equal(JSON.parse(store.get(SLOTS_KEY)!).length, 0);
  if (backupSlots !== undefined) store.set(SLOTS_KEY, backupSlots);
});
check('プリセット: 復元は、同じ名前を上書き（ID を引き継ぐ）・ほかの保存編成は残す', () => {
  const backupSlots = store.get(SLOTS_KEY);
  const base = presets.buildPresetSlots();
  const edited = { ...structuredClone(base[0]), id: 'slot_user_copy', description: '利用者が編集した説明', stints: [] };
  const other = slot('slot_other', '自分の編成', '2026-10-01T00:00:00.000Z');
  store.set(SLOTS_KEY, JSON.stringify([other, edited]));
  const r = presets.restorePresets(new Date('2026-10-12T01:00:00Z'));
  assert.equal(r.overwritten, 1);
  assert.equal(r.added, 4);
  assert.equal(r.slots.length, 6);
  const back = r.slots.find((s: any) => s.id === 'slot_user_copy');
  assert.equal(back.name, base[0].name);
  assert.equal(back.description, base[0].description);
  assert.ok(back.stints.length > 0, '同梱の内容で上書きされていません');
  assert.ok(r.slots.some((s: any) => s.id === 'slot_other'));
  // もう一度復元しても、増えない（すべて上書き）
  const r2 = presets.restorePresets();
  assert.equal(r2.slots.length, 6);
  assert.equal(r2.added, 0);
  assert.equal(r2.overwritten, 5);
  if (backupSlots !== undefined) store.set(SLOTS_KEY, backupSlots);
});
check('プリセット: 豊穣月開花の反応の行は、今の gcsim のバージョンで読める', () => {
  const lb = presets.buildPresetSlots().find((s: any) => s.id === 'preset_lunar-bloom');
  assert.ok(lb.reactions, '反応の行がありません');
  assert.ok(savedReactions.unpackReactions(lb.reactions), 'gcsim のバージョンが違います（プリセットを作り直してください）');
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

// --- 自動保存の待ち（debounce）---
{
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
  const ACTIVE = 'genshin_rotation_current_state_v2';
  const st = (id: string) => ({ party: [member('10000025-hydro')], stints: [{ id, characterId: '10000025-hydro', note: '', actions: [] }], loopStartIndex: 0 });
  const stored = () => (store.has(ACTIVE) ? JSON.parse(store.get(ACTIVE)!).stints[0].id : null);
  const run = async (name: string, fn: () => Promise<void>) => {
    store.clear();
    await fn();
    results.push(name);
    console.log(`✓ ${name}`);
  };

  await run('自動保存の待ち: 連続した変更は、待った後に 1 回だけ、最後の内容で書く', async () => {
    let writes = 0;
    const ls = (globalThis as any).localStorage;
    const realSet = ls.setItem;
    ls.setItem = (k: string, v: string) => { if (k === ACTIVE) writes++; realSet(k, v); };
    try {
      for (const id of ['a', 'b', 'c']) storage.saveActiveStateDebounced(st(id));
      assert.equal(stored(), null, '待っている間は、まだ書かない');
      await wait(storage.ACTIVE_STATE_SAVE_DELAY_MS + 150);
      assert.equal(stored(), 'c');
      assert.equal(writes, 1);
    } finally {
      ls.setItem = realSet;
    }
  });
  await run('自動保存の待ち: flush で、待たずに書く（画面を閉じる前）。待っていなければ、何もしない', async () => {
    storage.saveActiveStateDebounced(st('f1'));
    storage.flushActiveState();
    assert.equal(stored(), 'f1');
    storage.flushActiveState();
    assert.equal(stored(), 'f1');
  });
  await run('自動保存の待ち: 保存先を読む前（読み込み・バックアップ作成）に、先に書く', async () => {
    storage.saveActiveStateDebounced(st('r1'));
    assert.equal(storage.loadActiveState().stints[0].id, 'r1');
    storage.saveActiveStateDebounced(st('r2'));
    assert.equal(backup.buildBackup().currentState.stints[0].id, 'r2');
  });
  await run('自動保存の待ち: 保存を消したあとに、待っていた古い内容を書き戻さない', async () => {
    storage.saveActiveStateDebounced(st('x1'));
    storage.clearActiveState();
    await wait(storage.ACTIVE_STATE_SAVE_DELAY_MS + 150);
    assert.equal(stored(), null);
  });
  await run('自動保存の待ち: 復元の前に、待っている保存を先に書く（巻き戻しの対象に含める）', async () => {
    storage.saveActiveStateDebounced(st('b1'));
    const file = backup.parseBackup(JSON.stringify(backup.buildBackup()));
    assert.equal(file.ok, true);
    storage.saveActiveStateDebounced(st('b2'));
    const r = backup.restoreBackup(file.backup);
    assert.equal(r.ok, true);
    await wait(storage.ACTIVE_STATE_SAVE_DELAY_MS + 150);
    assert.equal(stored(), 'b1', '復元した内容が、待っていた保存で、上書きされない');
  });
}

await server.close();
console.log(`\n✓ バックアップの往復: ${results.length} 項目すべて合格`);
process.exit(0);
