/**
 * gcsim の設定文 → 編成の読込の確認（src/utils/gcsim/parseGcsimConfig.ts。D326）
 *
 *   npm run check:gcsim-import
 *
 * 1. 往復: 同梱のプリセットの編成から設定文を作り（buildGcsimConfig）、読み込み直して、もう一度設定文を作ると、
 *    options の行（所要時間の見積り）を除いて同じになること。
 * 2. 外部の設定文（公式の例に近い形）: 読める部分が読めて、読めない行が一覧に出ること。
 *
 * gcsim のサーバーは使わない（設定文の文字列だけ）。マスターは src/data/*.json を使う。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { buildGcsimConfig, withConfigTitle } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');
const { parseGcsimConfig } = await server.ssrLoadModule('/src/utils/gcsim/parseGcsimConfig.ts');
const { describeIgnored } = await server.ssrLoadModule('/src/utils/gcsim/describeIgnored.ts');
const { resolvePartyCharacters } = await server.ssrLoadModule('/src/utils/party.ts');

const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const asList = (raw: any): any[] => (Array.isArray(raw) ? raw : raw.characters ?? raw.weapons ?? raw.artifacts ?? Object.values(raw));
const characters = asList(readJson('src/data/characters_master_data.json'));
const weapons = asList(readJson('src/data/weapons_master_data.json'));
const artifacts = asList(readJson('src/data/artifacts_master_data.json'));
const master = { characters, weapons, artifacts };

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

/** options の行（所要時間の見積りが入る）を除く */
const withoutOptions = (config: string) => config.split('\n').filter(l => !l.startsWith('options ')).join('\n');

// --- 1. 往復 ---
const presetDir = path.join('src', 'data', 'presets');
for (const f of fs.readdirSync(presetDir).filter(x => x.endsWith('.json'))) {
  check(`往復: ${f}`, () => {
    const preset = readJson(path.join(presetDir, f));
    const chars = resolvePartyCharacters(preset.party, characters);
    const switchDelay = preset.switchDelay ?? 0.5;
    const stints = preset.stints.filter((s: any) => chars.some((c: any) => c.id === s.characterId));
    const build = (cs: any[], ss: any[], loop: number, delay: number) =>
      buildGcsimConfig({ characters: cs, stints: ss, loopStartIndex: loop, switchDelay: delay, weapons, artifacts });
    const original = build(chars, stints, preset.loopStartIndex ?? 0, switchDelay);
    // 長押しなどの個別の所要時間は設定文に入らないので、比べる前の元の側も、設定文だけで比べる
    if (!original.runnable) { console.log('  （gcsim 未対応のキャラを含むため、往復の対象外）'); return; }
    // 編成名: 先頭のコメントに付けて（コピーと同じ）、読み込み直すと、同じ名前が戻る
    const parsed = parseGcsimConfig(withConfigTitle(original.config, preset.name), master);
    assert.equal(parsed.ok, true, parsed.error);
    const v = parsed.value;
    assert.equal(v.name, preset.name, '編成名');
    assert.equal(v.stints.length, stints.length, '出場の数');
    assert.equal(v.loopStartIndex, preset.loopStartIndex ?? 0, 'ループの開始位置');
    const chars2 = resolvePartyCharacters(v.party, characters);
    const again = build(chars2, v.stints, v.loopStartIndex, v.switchDelay ?? 0.5);
    assert.equal(withoutOptions(again.config), withoutOptions(original.config));
    // アプリの出力は、何も知らせない（天賦 9,9,9・Lv90・仮ステータス cr=1・options・target は、アプリが作り直す値）
    assert.deepEqual(v.ignored, [], '読み飛ばしの一覧が空でない');
  });
}

// --- 2. 外部の設定文 ---
const key = (name: string) => characters.find(c => c.name === name)?.source?.gcsimKey as string;
const raiden = key('雷電将軍');
const xq = key('行秋');
assert.ok(raiden && xq, 'キーが引けません');
const rawWeapon = weapons.find(w => w.gcsimKey);
const external = `# 外部の例
options iteration=1000 duration=90 workers=30;
target lvl=100 resist=0.1 pos=0,2.4 radius=2;
energy every interval=480,720 amount=1;
${raiden} char lvl=90/90 cons=2 talent=9,9,10;
${raiden} add weapon="${rawWeapon.gcsimKey}" refine=3 lvl=90/90;
${raiden} add set="${artifacts.find((a: any) => a.gcsimKey)!.gcsimKey}" count=4;
${raiden} add stats hp=4780 atk=311 er=0.518;
${xq} char lvl=80/80 cons=6 talent=9,9,9;
notakey char lvl=90/90 cons=0 talent=9,9,9;
active ${xq};
let n = 0;
for let i = 0; i < 3; i = i + 1 {
  ${xq} skill, burst, attack:3, charge;
  ${raiden} skill, burst;
  if .${raiden}.energy > 60 {
    ${raiden} attack;
  }
  ${raiden} frobnicate;
}
`;
check('外部の設定文: 読める部分と、読めない行の一覧', () => {
  const r = parseGcsimConfig(external, master);
  assert.equal(r.ok, true);
  const v = r.value;
  assert.equal(v.name, '外部の例');
  assert.equal(v.party.filter((m: any) => !m.characterId.startsWith('empty_slot_')).length, 2);
  assert.equal(v.party.length, 4);
  const rm = v.party.find((m: any) => m.characterId === characters.find(c => c.source?.gcsimKey === raiden).id);
  assert.equal(rm.constellation, 2);
  assert.equal(rm.weaponRefinementRank, 3);
  assert.equal(rm.weaponId, rawWeapon.id);
  assert.equal(rm.artifactSetMode, '4pc');
  assert.equal(v.stints.length, 2);
  assert.equal(v.loopStartIndex, 0);
  assert.equal(v.stints[0].actions.length, 6); // E Q N N N C
  const reasons = v.ignored.map((i: any) => i.reason);
  for (const r2 of ['options', 'target', 'energy', 'stats', 'talent', 'level', 'unknownCharacter', 'variable', 'loopCondition', 'conditional', 'unknownAction']) {
    assert.ok(reasons.includes(r2), `一覧に ${r2} が無い`);
  }
  assert.ok(describeIgnored(v.ignored).includes('行目'));
});
check('キャラが 1 人も読めない設定文は、エラー', () => {
  const r = parseGcsimConfig('options iteration=1;', master);
  assert.equal(r.ok, false);
});

// --- 別名（gcsim の pkg/shortcut）: raiden = raidenshogun など ---
const aliasData = readJson('src/data/gcsim_key_aliases.json');
check('別名の表が、設定の gcsim のコミットで作られている', () => {
  const config = readJson('gcsim.config.json');
  assert.equal(aliasData.gcsimCommit, config.commit, 'gcsim のバージョンを上げたら npm run build:aliases で作り直す');
  for (const k of ['characters', 'weapons', 'artifacts']) assert.ok(aliasData[k].length > 0, k);
});
check('別名で書いた設定文が、正式なキーと同じ編成になる', () => {
  // マスターのキーが、別名のある組に入っているキャラ・武器・聖遺物を、1 つずつ選ぶ
  const pick = (items: any[], groups: string[][], keyOf: (x: any) => string | undefined) => {
    for (const item of items) {
      const k = keyOf(item);
      const g = k ? groups.find(x => x.includes(k)) : undefined;
      const alias = g?.find(n => n !== k);
      if (item && alias) return { item, key: k!, alias };
    }
    throw new Error('別名のあるものが見つかりません');
  };
  const c = pick(characters.filter((x: any) => (x.availableActions ?? []).length > 0), aliasData.characters, (x: any) => x.source?.gcsimKey);
  const w = pick(weapons, aliasData.weapons, (x: any) => x.gcsimKey);
  const a = pick(artifacts, aliasData.artifacts, (x: any) => x.gcsimKey);
  const text = (ck: string, wk: string, ak: string) => [
    `${ck} char lvl=90/90 cons=1 talent=9,9,9;`,
    `${ck} add weapon="${wk}" refine=2 lvl=90/90;`,
    `${ck} add set="${ak}" count=4;`,
    `${ck} skill, burst;`,
  ].join('\n');
  const official = parseGcsimConfig(text(c.key, w.key, a.key), master);
  const aliased = parseGcsimConfig(text(c.alias, w.alias, a.alias), master);
  assert.equal(official.ok, true);
  assert.equal(aliased.ok, true);
  assert.deepEqual(aliased.value.party, official.value.party);
  assert.equal(aliased.value.party[0].weaponId, w.item.id);
  assert.equal(aliased.value.party[0].artifactSetId, a.item.id);
  assert.equal(aliased.value.stints[0].characterId, c.item.id);
  assert.equal(aliased.value.stints[0].actions.length, 2);
  assert.deepEqual(aliased.value.ignored.filter((i: any) => i.reason.startsWith('unknown')), []);
});

// --- 長押し hold=N: 所要時間を編集した長押しが、設定文の hold=N を経て、同じ長さで戻る ---
const { calculateRotation } = await server.ssrLoadModule('/src/utils/rotationCalculator.ts');
check('長押し hold=N: 往復で、同じ長押しの長さ（±2 フレーム）に戻る', () => {
  const sayu = characters.find(c => c.name === '早柚')!;
  const bennett = characters.find(c => c.name === 'ベネット')!;
  const act = (c: any, suffix: string, id: string, extra: Record<string, unknown> = {}) => {
    const def = c.availableActions.find((x: any) => x.id === `${c.id}_${suffix}`)!;
    return { id, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration, ...extra };
  };
  const party = [sayu, bennett].map(c => ({ characterId: c.id, constellation: 0 }));
  for (const holdDuration of [1.2, 2.0, 3.5]) {
    const stints = [{ id: 's1', characterId: sayu.id, note: '', actions: [act(sayu, 'e_hold', 'h1', { duration: holdDuration, durationManual: true }), act(sayu, 'n', 'n1')] }];
    const holdFramesOf = (chars: any[], ss: any[]) => {
      const res = calculateRotation(chars, ss, { switchDelay: 0.5, loopStartIndex: 0, defHalt: true, database: { characters, weapons, artifacts } as any });
      const acts = res.calculatedStints.flatMap((x: any) => x.actions);
      const built = buildGcsimConfig({
        characters: chars, stints: ss, loopStartIndex: 0, switchDelay: 0.5, weapons, artifacts,
        holdSecondsByActionId: Object.fromEntries(acts.filter((x: any) => x.holdSeconds !== undefined).map((x: any) => [x.id, x.holdSeconds])),
      });
      return Number(built.config.match(/skill\[hold=(\d+)\]/)![1]);
    };
    const chars = resolvePartyCharacters(party, characters);
    const original = holdFramesOf(chars, stints);
    const built = buildGcsimConfig({ characters: chars, stints, loopStartIndex: 0, switchDelay: 0.5, weapons, artifacts, holdSecondsByActionId: { h1: (original) / 60 } });
    const parsed = parseGcsimConfig(built.config, master);
    assert.equal(parsed.ok, true);
    const again = holdFramesOf(resolvePartyCharacters(parsed.value.party, characters), parsed.value.stints);
    assert.ok(Math.abs(again - original) <= 2, `長押し ${holdDuration}s: ${original}f → ${again}f`);
  }
});

console.log(`
${passed} 件 OK`);;
await server.close();
