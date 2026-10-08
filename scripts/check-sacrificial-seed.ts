/**
 * 祭礼の武器の、種の探索の確認（フェーズ 6 / 6-4・D86。2026-10-09）。gcsim のサーバーが要る（npm run gcsim:start）。
 *
 *   npm run check:sacrificial-seed
 *
 * 固定した並びで、アプリの計算（calculateRotation）の祭礼の発動と、gcsim の発動（種を探して選んだもの）が一致するかを確認する。
 * 実際の画面と同じ関数（buildGcsimConfig・runWithSacrificialSeed）を使う。祭礼 R5。
 *   - すべての並びで、アプリの発動がすべて gcsim でも発動し、余分な発動が無い種が見つかること
 *   - 検証できない（アプリが CT 違反）ものは、数えない
 * 見つからなければ、終了コード 1。
 */
import fs from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { calculateRotation } = await server.ssrLoadModule('/src/utils/rotationCalculator.ts');
const { buildGcsimConfig } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');
const { runGcsimSample } = await server.ssrLoadModule('/src/utils/gcsim/gcsimClient.ts');
const { runWithSacrificialSeed } = await server.ssrLoadModule('/src/utils/gcsim/sacrificialSeed.ts');

const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const all: any[] = Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw);
const MASTER_WEAPONS: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const SAC_IDS: Record<string, string> = { sword: '11403', claymore: '12403', bow: '15403', catalyst: '14403' };
// ベネットの武器: gcsim が受け付ける、祭礼でない片手剣（マスターの先頭のもの）
const dull = MASTER_WEAPONS.find(w => w.weaponType === 'sword' && w.gcsimKey && w.gcsimKey !== 'sacrificialsword');
if (!dull) throw new Error('祭礼でない片手剣がマスターに無い');
const weaponDb = [...Object.values(SAC_IDS).map(id => MASTER_WEAPONS.find(w => w.id === id)), dull].filter(Boolean);

let seq = 0;
const byName = (name: string, extra: Record<string, unknown> = {}) => {
  const c = all.find(x => x.name === name);
  if (!c) throw new Error(`キャラが見つかりません: ${name}`);
  return { ...structuredClone(c), ...extra };
};
const makeAction = (char: any, step: string) => {
  const id = `a${++seq}`;
  if (/^w[\d.]+$/.test(step)) return { id, actionTypeId: 'wait', name: '待機', shortName: 'W', type: 'wait', duration: Number(step.slice(1)) };
  const def = char.availableActions.find((a: any) => a.id === `${char.id}_${step}`);
  if (!def) throw new Error(`${char.name} にアクションがありません: ${step}`);
  return { id, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration };
};

// 並び: [キャラ, [アクション...]]（その後に、ベネットが E → 80 秒待機）
// [キャラ, アクション, 凸（省略は 0）]
const CASES: Array<[string, string[], number?]> = [
  ['甘雨', ['e', 'w1', 'e']],
  ['甘雨', ['e', 'w20', 'e', 'w1', 'e']],
  ['久岐忍', ['e', 'w1', 'e', 'w15', 'e']],
  ['夢見月瑞希', ['e', 'w1', 'e']],
  ['クレー', ['e', 'e', 'e']],
  ['八重神子', ['e', 'e', 'e', 'w5', 'e']],
  ['ティナリ', ['e', 'w1', 'e', 'w14', 'e']],
  ['ヌヴィレット', ['e', 'w1', 'e', 'w14', 'e']],
  ['神里綾人', ['e', 'w1', 'e', 'w14', 'e']],
  ['フィッシュル', ['e', 'w13', 'e', 'w27', 'e']],
  // 命ノ星座・長押しで命中が変わるもの（2026-10-09）
  ['久岐忍', ['e', 'w1', 'e', 'w15', 'e'], 2],
  ['九条裟羅', ['e', 'w3', 'e', 'w11', 'e'], 2],
  ['ノエル', ['e', 'w1', 'e', 'w25', 'e'], 4],
  ['レイラ', ['e', 'w1', 'e', 'w14', 'e'], 6],
  ['シトラリ', ['e', 'w17', 'e', 'w17', 'e'], 0],
  ['シトラリ', ['e', 'w21', 'e', 'w21', 'e'], 6],
  ['早柚', ['e_hold', 'w1', 'e', 'w16', 'e_hold']],
];

let failed = 0;
let checked = 0;
for (const [name, steps, cons = 0] of CASES) {
  seq = 0;
  const c0 = all.find((x: any) => x.name === name);
  const chars = [byName(name, { weaponId: SAC_IDS[c0.weaponType], weaponRefinementRank: 5, constellation: cons }), byName('ベネット', { weaponId: dull.id, weaponRefinementRank: 1 })];
  const stints = [
    { id: 's0', characterId: chars[0].id, actions: steps.map(s => makeAction(chars[0], s)) },
    { id: 's1', characterId: chars[1].id, actions: ['e', 'w80'].map(s => makeAction(chars[1], s)) },
  ];
  const res = calculateRotation(chars, stints, { switchDelay: 0.5, loopStartIndex: 0, defHalt: true, database: { weapons: weaponDb } });
  const acts = res.calculatedStints.flatMap((st: any) => st.actions);
  if (acts.some((a: any) => a.hasCTCollision)) { console.log(`- ${name} ${steps.join(' ')}: アプリで CT 違反（画面は gcsim の実行を止める）。数えない`); continue; }
  const built = buildGcsimConfig({
    characters: chars, stints, loopStartIndex: 0, switchDelay: 0.5, defHalt: true, weapons: weaponDb, artifacts: [],
    extraWaitByActionId: Object.fromEntries(acts.filter((x: any) => x.type !== 'swap').map((x: any) => { const manual = x.durationManual && x.holdSeconds === undefined && x.naturalDuration !== undefined && x.type !== 'wait' ? Math.max(0, x.duration - x.naturalDuration) : 0; return [x.id, Number(((manual >= 0.005 ? manual : 0) + (x.modeHoldSeconds ?? 0)).toFixed(3))]; }).filter(([, v]: [string, number]) => v > 0)),
    modeHoldByActionId: Object.fromEntries(acts.filter((x: any) => x.modeHoldSeconds).map((x: any) => [x.id, x.modeHoldSeconds])),
    holdSecondsByActionId: Object.fromEntries(acts.filter((x: any) => x.holdSeconds !== undefined).map((x: any) => [x.id, x.holdSeconds])),
  });
  const out = await runWithSacrificialSeed(built.config, runGcsimSample, { appProcs: res.sacrificialProcs, refs: built.actionRefs }, 1);
  checked++;
  if (out.status !== 'ok' || !out.sacrificial) { failed++; console.log(`✗ ${name} ${steps.join(' ')}: gcsim を実行できなかった / 祭礼の探索が働かなかった（${out.status}）`); continue; }
  const s = out.sacrificial;
  const autoBars = res.passiveSpans.filter((p: any) => p.auto && p.characterId === chars[0].id).length;
  if (s.ok) console.log(`✓ ${name}${cons ? ` 凸${cons}` : ''} ${steps.join(' ')}: アプリの発動 ${s.expected} 箇所（武器効果のバー ${autoBars} 本）がすべて gcsim でも発動、余分なし（種 ${s.seed}・探索 ${s.searched} 個）`);
  else {
    failed++;
    if (process.env.DEBUG) {
      const frames = (re: RegExp, ev: string) => JSON.stringify(out.logs.filter((l: any) => l.event === ev && re.test(l.msg)).map((l: any) => l.frame));
      console.log('  アプリの発動', JSON.stringify(res.sacrificialProcs.map((x: any) => [x.cycle, x.time, x.hitFrame])));
      console.log('  gcsim の発動', frames(/sacrificial proc/, 'weapon'), ' gcsim の E', frames(/executed skill/, 'action'));
      console.log('  アプリの E', JSON.stringify(acts.filter((x: any) => x.type === 'skill').map((x: any) => x.startTime)));
    }
    console.log(`✗ ${name} ${steps.join(' ')}: 一致する種が見つからない（アプリ ${s.expected} / 一致 ${s.matched} / 不足 ${s.missing} / 余分 ${s.extras}。探索 ${s.searched} 個）`); }
}
await server.close();
console.log(failed === 0 ? `\n全 ${checked} 並びで、アプリの発動と gcsim の発動が一致する種が見つかった` : `\n${failed} / ${checked} 並びで、一致する種が見つからなかった`);
process.exit(failed === 0 ? 0 : 1);
