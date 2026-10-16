/**
 * 編成の中身の検査の確認（src/utils/rotationValidation.ts・storage.ts・backup.ts・recoveryDump.ts・rotationFile.ts）。
 *
 *   npm run check:rotation-validation
 *
 * 壊れたデータ（null の混入・型の違い）で、落ちずに、壊れた部分だけ除外されること。
 * 正しいデータ（同梱のプリセット 5 編成）は、1 つも変わらないこと。
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
const v = await server.ssrLoadModule('/src/utils/rotationValidation.ts');
const storage = await server.ssrLoadModule('/src/utils/storage.ts');
const backup = await server.ssrLoadModule('/src/utils/backup.ts');
const presets = await server.ssrLoadModule('/src/utils/presets.ts');
const rotationFile = await server.ssrLoadModule('/src/utils/rotationFile.ts');
const recovery = await server.ssrLoadModule('/src/utils/recoveryDump.ts');
const dbValidation = await server.ssrLoadModule('/src/utils/databaseValidation.ts');
const dbImport = await server.ssrLoadModule('/src/utils/databaseImport.ts');

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

const member = (id: string) => ({ characterId: id, constellation: 0 });
const act = (id: string, over: Record<string, unknown> = {}) => ({ id, actionTypeId: `x_${id}`, name: id, shortName: id, type: 'skill', duration: 1, ...over });
const stint = (id: string, actions: unknown[], over: Record<string, unknown> = {}) => ({ id, characterId: 'c1', note: '', actions, ...over });

// --- 同梱のプリセット: 1 つも変わらない ---
const presetDir = path.join('src', 'data', 'presets');
const presetFiles = fs.readdirSync(presetDir).filter(f => f.endsWith('.json'));
check(`プリセット ${presetFiles.length} 編成: 検査を通り、除外が 0 件で、内容が変わらない`, () => {
  assert.equal(presetFiles.length, 5);
  for (const f of presetFiles) {
    const raw = JSON.parse(fs.readFileSync(path.join(presetDir, f), 'utf8'));
    const r = v.parseRotationPayload(raw);
    assert.equal(r.ok, true, f);
    assert.equal(v.totalSkipped(r.skipped), 0, `${f}: 除外が出た`);
    assert.deepEqual(r.value.stints, raw.stints, `${f}: 出場が変わった`);
    assert.deepEqual(r.value.party, raw.party, `${f}: 編成が変わった`);
  }
});
check('保存編成の形（プリセットから作ったもの）: 検査を通り、内容が変わらない', () => {
  for (const slot of presets.buildPresetSlots()) {
    const r = v.sanitizeSlot(slot);
    assert.ok(r, slot.id);
    assert.equal(v.totalSkipped(r.skipped), 0);
    assert.deepEqual(r.slot, slot);
  }
});

// --- 壊れた JSON の取り込み ---
check('取り込み: 全体の形が違うものは、拒否する', () => {
  for (const bad of [null, 5, 'x', [], {}, { party: [] }, { stints: [] }, { party: {}, stints: [] }]) {
    assert.equal(v.parseRotationPayload(bad).ok, false);
  }
});
check('取り込み: 編成（party）の枠が壊れていたら、全体を拒否する（位置が意味を持つため）', () => {
  assert.equal(v.parseRotationPayload({ party: [member('a'), null], stints: [] }).ok, false);
  assert.equal(v.parseRotationPayload({ party: [member('a'), { constellation: 1 }], stints: [] }).ok, false);
  assert.equal(v.parseRotationPayload({ party: [member('a'), { characterId: '' }], stints: [] }).ok, false);
});
check('取り込み: 壊れた出場・アクションだけ除外して、数を返す（落ちない）', () => {
  const raw = {
    party: [member('c1')],
    stints: [
      null,
      { id: 's0' },
      stint('s1', [act('a1'), null, act('a2', { duration: '1' }), act('a3', { id: '' }), act('a6', { name: {} }), act('a7', { shortName: 5 }), { id: 'a4', actionTypeId: 'x', type: 'normal', duration: NaN }, act('a5')]),
      stint('s2', [act('b1')], { groups: [{ id: 'g1', repeat: 2 }, { id: 'g2' }, null], passiveTriggers: [{ id: 'p1', passiveEffectId: 'e', offset: 1 }, { id: 'p2' }], extraEffects: 'x' }),
    ],
  };
  const r = v.parseRotationPayload(raw);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.stints.map((s: any) => s.id), ['s1', 's2']);
  assert.deepEqual(r.value.stints[0].actions.map((a: any) => a.id), ['a1', 'a5']);
  assert.deepEqual(r.value.stints[1].groups, [{ id: 'g1', repeat: 2 }]);
  assert.deepEqual(r.value.stints[1].passiveTriggers.map((p: any) => p.id), ['p1']);
  assert.equal('extraEffects' in r.value.stints[1], false);
  assert.deepEqual({ ...r.skipped }, { stints: 2, actions: 6, others: 4 });
  assert.match(v.describeSkipped(r.skipped), /出場 2 件・アクション 6 件・グループ・発動バフなど 4 件/);
});
check('取り込み: 数値の項目が不正なら、既定に任せる（undefined）', () => {
  const r = v.parseRotationPayload({ party: [member('c1')], stints: [], switchDelay: 'x', loopStartIndex: -1, loopStartTime: NaN, totalDuration: null, name: 5 });
  assert.equal(r.ok, true);
  assert.deepEqual({ ...r.value, party: undefined, stints: undefined }, { party: undefined, stints: undefined, loopStartIndex: undefined, loopStartTime: undefined, totalDuration: undefined, switchDelay: undefined, reactions: undefined, name: undefined, description: undefined });
  const ok = v.parseRotationPayload({ party: [member('c1')], stints: [], switchDelay: 0.3, loopStartIndex: 2.7, name: 'n' });
  assert.equal(ok.value.switchDelay, 0.3);
  assert.equal(ok.value.loopStartIndex, 2);
  assert.equal(ok.value.name, 'n');
});

// --- 保存データの読み込み（storage.ts） ---
check('自動保存の読み込み: 壊れた出場・アクションを除いて読む／編成の枠が壊れていたら、読まない（null）', () => {
  store.set('genshin_rotation_current_state_v2', JSON.stringify({ party: [member('c1')], stints: [null, stint('s1', [act('a1'), null])], lastSavedAt: 'x' }));
  const s = storage.loadActiveState();
  assert.deepEqual(s.stints.map((x: any) => x.id), ['s1']);
  assert.deepEqual(s.stints[0].actions.map((a: any) => a.id), ['a1']);
  store.set('genshin_rotation_current_state_v2', JSON.stringify({ party: [null], stints: [], lastSavedAt: 'x' }));
  assert.equal(storage.loadActiveState(), null);
});
check('保存編成の読み込み: 壊れたものを除き、使えるものは壊れた部分だけ除く（落ちない）', () => {
  const good = { id: 'g', name: '良い', updatedAt: '2026-10-01T00:00:00.000Z', party: [member('c1')], stints: [stint('s1', [act('a1'), 5])] };
  store.set('genshin_rotation_saved_slots_v2', JSON.stringify([null, 7, { id: 'x' }, { id: 'y', party: [null], stints: [] }, good, { id: 'noname', party: [], stints: null }]));
  const slots = storage.getSavedSlots();
  assert.deepEqual(slots.map((s: any) => s.id), ['g', 'noname']);
  assert.deepEqual(slots[0].stints[0].actions.map((a: any) => a.id), ['a1']);
  assert.deepEqual(slots[1].stints, []);
  assert.equal(typeof slots[1].name, 'string');
});

// --- バックアップ ---
check('バックアップの読み込み: 保存編成・現在の編成の中の壊れた部分も除外して、数を返す', () => {
  const file = {
    format: backup.BACKUP_FORMAT,
    version: 1,
    exportedAt: '',
    app: { version: '', gcsimVersion: '' },
    currentState: { party: [member('c1')], stints: [null, stint('cur', [act('a1'), null])] },
    savedSlots: [
      { id: 's_ok', name: 'ok', updatedAt: '2026-10-01T00:00:00.000Z', party: [member('c1')], stints: [stint('s1', [act('a1'), null])] },
      { id: 's_bad', party: [null], stints: [] },
    ],
    settings: {},
    database: { characters: [], weapons: [], artifacts: [] },
  };
  const r = backup.parseBackup(JSON.stringify(file));
  assert.equal(r.ok, true);
  assert.equal(r.skipped.slots, 1);
  assert.equal(r.skipped.rotationParts, 3, '現在の編成の出場 1 + アクション 1、保存編成のアクション 1');
  assert.deepEqual(r.backup.currentState.stints.map((s: any) => s.id), ['cur']);
  assert.deepEqual(r.backup.savedSlots[0].stints[0].actions.map((a: any) => a.id), ['a1']);
  const bad = backup.parseBackup(JSON.stringify({ ...file, currentState: { party: [null], stints: [] } }));
  assert.equal(bad.ok, false);
});

// --- ファイル名・復旧用の書き出し ---
check('ファイル名: 書き出したファイル名から、編成名を戻せる（JSON に name が無いときの推定）', () => {
  assert.equal(rotationFile.nameFromFileName(rotationFile.rotationFileName('雷電ナショナル')), '雷電ナショナル');
  assert.equal(rotationFile.nameFromFileName(rotationFile.rotationFileName('雷電 ナショナル')), '雷電 ナショナル');
  assert.equal(rotationFile.nameFromFileName('勝手な名前.json'), '勝手な名前');
});
check('書き出し・コピー: 内容が同じで、読み込みの検査が読む項目（交代遅延・ループ・反応など）を、すべて含む（往復で変わらない）', () => {
  const src = {
    name: '往復テスト',
    description: 'メモ',
    party: [member('c1')],
    stints: [stint('s1', [act('a1')])],
    loopStartIndex: 1,
    loopStartTime: 2.5,
    totalDuration: 12.3,
    switchDelay: 0.35,
    reactions: { gcsimVersion: 'v0', rows: [] },
  };
  const out = rotationFile.buildRotationExport(src, new Date('2026-10-17T00:00:00Z'));
  assert.equal(out.switchDelay, 0.35);
  assert.equal(out.exportedAt, '2026-10-17T00:00:00.000Z');
  const r = v.parseRotationPayload(JSON.parse(JSON.stringify(out)));
  assert.equal(r.ok, true);
  assert.deepEqual({ ...r.value }, { ...src, reactions: src.reactions });
  assert.equal(v.totalSkipped(r.skipped), 0);
  // 項目の無い編成（交代遅延・反応なし）も、読み込める（loopStartTime は 0 になる）
  const bare = v.parseRotationPayload(JSON.parse(JSON.stringify(rotationFile.buildRotationExport({ name: 'n', party: [member('c1')], stints: [] }))));
  assert.equal(bare.ok, true);
  assert.equal(bare.value.switchDelay, undefined);
  assert.equal(bare.value.loopStartTime, 0);
});
check('復旧用の書き出し: 保存先の文字列を、解釈せずに、そのまま出す（壊れた JSON でも失敗しない）', () => {
  store.clear();
  store.set('genshin_rotation_current_state_v2', '{これは壊れた JSON');
  store.set('gcsimDefHalt', 'false');
  const d = recovery.buildRecoveryDump(new Date('2026-10-16T00:00:00Z'));
  assert.equal(d.format, 'genshin-rotation-planner-raw-dump');
  assert.equal(d.keys['genshin_rotation_current_state_v2'], '{これは壊れた JSON');
  assert.equal(d.keys['gcsimDefHalt'], 'false');
  assert.equal(d.keys['genshin_app_db_v1'], null);
  assert.ok('genshin_rotation_saved_slots_v2' in d.keys);
});

check('型の検査: メモ・名前など画面に出す項目が、文字列でなければ除外する（オブジェクトのままでは、描画で落ちる）', () => {
  const bad = { x: 1 };
  // 出場のメモ・モード維持: その項目だけ外し、出場は残す
  const r1 = v.sanitizeStints([stint('s1', [act('a1')], { note: bad, holdMode: 'yes' }), stint('s2', [act('a2')], { note: 'ok', holdMode: true })]);
  assert.equal(r1.stints.length, 2);
  assert.equal('note' in r1.stints[0], false);
  assert.equal('holdMode' in r1.stints[0], false);
  assert.equal(r1.skipped.others, 2);
  assert.equal(r1.stints[1].note, 'ok');
  // アクション: メモ・数値の項目が別の型なら、そのアクションを除外する
  const r2 = v.sanitizeStints([stint('s1', [act('a1', { note: bad }), act('a2', { cooldown: '3' }), act('a3', { inStateWindow: 1 }), act('a4', { extraEffects: [{ key: 'k', name: bad, offset: 0, duration: 1 }] }), act('ok', { note: 'メモ', cooldown: 3 })])]);
  assert.deepEqual(r2.stints[0].actions.map((a: any) => a.id), ['ok']);
  assert.equal(r2.skipped.actions, 4);
  // 発動バフ・副次効果
  const r3 = v.sanitizeStints([stint('s1', [act('a1')], {
    passiveTriggers: [{ id: 't1', passiveEffectId: 'p', offset: 0, name: bad }, { id: 't2', passiveEffectId: 'p', offset: 0, name: 'ok', duration: 5 }],
    extraEffects: [{ key: 'k', name: bad, offset: 0, duration: 1 }],
  })]);
  assert.deepEqual(r3.stints[0].passiveTriggers.map((t: any) => t.id), ['t2']);
  assert.equal(r3.stints[0].extraEffects.length, 0);
  // 編成: 任意の項目が別の型なら、編成ごと受け付けない
  for (const m of [{ weaponId: bad }, { constellation: '6' }, { hexerei: 'true' }, { artifactSetId: 5 }]) {
    assert.equal(v.isValidParty([{ characterId: 'c1', ...m }]), false);
  }
  assert.equal(v.isValidParty([{ characterId: 'c1', weaponId: 'w', constellation: 2, hexerei: false }]), true);
  // 保存編成の説明が文字列でなければ外す
  const slot = v.sanitizeSlot({ id: 'x', name: 'n', description: bad, updatedAt: '', party: [member('c1')], stints: [] });
  assert.equal('description' in slot.slot, false);
});

check('DB 項目の検査: 同梱のマスター（キャラ・武器・聖遺物の全件）は、すべて通る', () => {
  const dbv = dbValidation;
  const chars = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
  const list = Array.isArray(chars) ? chars : chars.characters ?? Object.values(chars);
  const weapons = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
  const artifacts = JSON.parse(fs.readFileSync('src/data/artifacts_master_data.json', 'utf8'));
  assert.equal(dbv.sanitizeDbItems(list, dbv.isValidCharacterItem).skipped, 0);
  assert.equal(dbv.sanitizeDbItems(weapons, dbv.isValidWeaponItem).skipped, 0);
  assert.equal(dbv.sanitizeDbItems(artifacts, dbv.isValidArtifactItem).skipped, 0);
});
check('DB 項目の検査: 画面が使う項目の型が違う項目は、取り込み・復元の前に除外する', () => {
  const dbv = dbValidation;
  const baseChar = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
  const c0 = (Array.isArray(baseChar) ? baseChar : baseChar.characters ?? Object.values(baseChar))[0];
  const w0 = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'))[0];
  const a0 = JSON.parse(fs.readFileSync('src/data/artifacts_master_data.json', 'utf8'))[0];
  const badChars = [{ ...c0, id: 'c1', availableActions: null }, { ...c0, id: 'c2', availableActions: [{ id: 'x', name: 1 }] }, { ...c0, id: 'c3', element: undefined }, { ...c0, id: 'c4', passiveEffects: {} }, { ...c0, id: 'c5', color: { a: 1 } }];
  for (const b of badChars) assert.equal(dbv.isValidCharacterItem(b), false, JSON.stringify(b).slice(0, 80));
  const badWeapons = [{ ...w0, id: 'w1', passiveName: undefined }, { ...w0, id: 'w2', rarity: '5' }, { ...w0, id: 'w3', refinements: 'x' }];
  for (const b of badWeapons) assert.equal(dbv.isValidWeaponItem(b), false);
  const badArtifacts = [{ ...a0, id: 'a1', effect2p: null }, { ...a0, id: 'a2', effect4p: 4 }];
  for (const b of badArtifacts) assert.equal(dbv.isValidArtifactItem(b), false);
  // DB 管理の JSON 取り込み
  const imp = dbImport.parseDatabaseFile(JSON.stringify({ version: 1, characters: [c0, ...badChars], weapons: [w0, ...badWeapons], artifacts: [a0, ...badArtifacts] }));
  assert.equal(imp.ok, true);
  assert.equal(imp.counts.characters + imp.counts.weapons + imp.counts.artifacts, 3);
  assert.equal(imp.skipped, badChars.length + badWeapons.length + badArtifacts.length);
  // バックアップの復元
  const file = JSON.parse(JSON.stringify(backup.buildBackup()));
  file.database = { characters: [c0, ...badChars], weapons: [w0, ...badWeapons], artifacts: [a0, ...badArtifacts] };
  const parsedBackup = backup.parseBackup(JSON.stringify(file));
  assert.equal(parsedBackup.ok, true);
  assert.equal(parsedBackup.skipped.items, badChars.length + badWeapons.length + badArtifacts.length);
});

check('検査の補強: グループの複製の所要時間（copyDurations）の各値・グループの回数（1〜99 の整数）', () => {
  const cd = (o: Record<string, unknown>) => ({ '1': { base: 1, duration: 1, gcsimBaseDuration: 1, ...o } });
  const r = v.sanitizeStints([stint('s1', [act('a1', { copyDurations: cd({ duration: 'bad' }) }), act('a2', { copyDurations: cd({ gcsimBaseDuration: NaN }) }), act('ok', { copyDurations: cd({}) })])]);
  assert.deepEqual(r.stints[0].actions.map((a: any) => a.id), ['ok']);
  assert.equal(r.skipped.actions, 2);
  for (const repeat of [0, 100, 1e20, 2.5, -3, '3']) {
    const g = v.sanitizeStints([stint('s1', [act('a1', { groupId: 'g' })], { groups: [{ id: 'g', repeat }] })]);
    assert.equal(g.stints[0].groups.length, 0, `repeat=${String(repeat)} は除外`);
  }
  for (const repeat of [1, 3, 99]) {
    const g = v.sanitizeStints([stint('s1', [act('a1', { groupId: 'g' })], { groups: [{ id: 'g', repeat }] })]);
    assert.equal(g.stints[0].groups.length, 1);
  }
});
check('検査の補強: 保存編成・自動保存・バックアップの数値項目（総時間・交代遅延など）が文字列なら取り除く', () => {
  const bad = { totalDuration: 'broken', switchDelay: 'bad', loopStartIndex: -1, loopStartTime: NaN };
  const slot = v.sanitizeSlot({ id: 'x', name: 'n', updatedAt: '', party: [member('c1')], stints: [], ...bad, totalDuration: 'broken' });
  for (const k of Object.keys(bad)) assert.equal(k in slot.slot, false, `${k} を取り除く`);
  const ok = v.sanitizeSlot({ id: 'x', name: 'n', updatedAt: '', party: [member('c1')], stints: [], totalDuration: 10, switchDelay: 0.5, loopStartIndex: 1, loopStartTime: 2 });
  assert.equal(ok.slot.switchDelay, 0.5);
  // 自動保存（起動時に読む）
  store.clear();
  store.set('genshin_rotation_current_state_v2', JSON.stringify({ party: [member('c1')], stints: [], switchDelay: 'bad', loopStartIndex: 0, lastSavedAt: '' }));
  const active = storage.loadActiveState();
  assert.equal('switchDelay' in active, false);
  // バックアップの現在の編成
  const file = JSON.parse(JSON.stringify(backup.buildBackup()));
  file.currentState = { party: [member('c1')], stints: [], switchDelay: 'bad' };
  const parsedBackup = backup.parseBackup(JSON.stringify(file));
  assert.equal(parsedBackup.ok, true);
  assert.equal('switchDelay' in parsedBackup.backup.currentState, false);
});

console.log(`\n✓ 編成の検査: ${passed} 項目すべて合格`);
await server.close();
process.exit(0);
