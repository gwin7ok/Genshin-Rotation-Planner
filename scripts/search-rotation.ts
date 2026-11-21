/**
 * ローテーションの自動探索（第 1 段。画面なし。設計: docs/gcsim-integration/phase-9-auto-rotation-search/設計.md）。
 * 編成（4 人）を入れると、候補を作り → CT 違反を除き → 簡易スコアで絞り → gcsim（少ない回数）で絞り → gcsim（多い回数）で順位をつける。
 *
 *   node scripts/search-rotation.ts ナヒーダ 胡桃 香菱 ベネット
 *   node scripts/search-rotation.ts 胡桃 香菱 ナヒーダ 行秋 --owned=tools/hoyolab-fetch/out/owned-characters.json
 *   オプション: --seconds=40（戦闘時間）--keep1=200（簡易スコアで残す数）--runs1=3 --keep2=30（少ない回数の gcsim で残す数）--runs2=10 --top=10 --max=20000（候補の上限）--out=結果.json --attacker=コロンビーナ（役割にアタッカーを足す）
 *
 * 役割は、マスターの初期値（roles）を使う。--owned を付けると、持ちキャラの実際の装備・凸・天賦を使う（付けないと、アプリの「仮値」）。
 * 爆発のエネルギーは無視する（アプリの通常の計算と同じ）。
 */
import fs from 'node:fs';
import os from 'node:os';
import { createServer } from 'vite';
import { useNodeGcsim } from './gcsim-node.ts';

const args = process.argv.slice(2);
const num = (name: string, def: number) => {
  const a = args.find(x => x.startsWith(`--${name}=`));
  return a ? Number(a.split('=')[1]) : def;
};
const str = (name: string) => args.find(x => x.startsWith(`--${name}=`))?.split('=')[1];
const names = args.filter(x => !x.startsWith('--'));
const SECONDS = num('seconds', 40);
const KEEP1 = num('keep1', 900);
const RUNS1 = num('runs1', 1);
const KEEP2 = num('keep2', 12);
const RUNS2 = num('runs2', 10);
const TOP = num('top', 10);
const MAX = num('max', 20000);
const ownedPath = str('owned');
const outPath = str('out');
if (!str('preset') && (names.length < 1 || names.length > 4)) {
  console.error('編成のキャラ名を 1〜4 人、指定してください（例: node scripts/search-rotation.ts ナヒーダ 胡桃 香菱 ベネット）');
  process.exit(1);
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
await useNodeGcsim(server);
const cs = await server.ssrLoadModule('/src/utils/customStats.ts');
const imp = await server.ssrLoadModule('/src/utils/hoyolab/importCharacters.ts');

const master: any[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const weapons: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const artifacts: any[] = JSON.parse(fs.readFileSync('src/data/artifacts_master_data.json', 'utf8'));
const owned: any[] = ownedPath ? JSON.parse(fs.readFileSync(ownedPath, 'utf8')).characters : [];

// 編成のキャラを作る
const characters: any[] = [];
// --preset=keqing-intensify: 手組みプリセットの編成・装備（凸・武器・聖遺物・ビルド）をそのまま使う（手組みとの比較用。名前は要らない）
const presetName = str('preset');
const preset = presetName ? JSON.parse(fs.readFileSync((presetName.endsWith(".json") ? presetName : `src/data/presets/${presetName}.json`), 'utf8')) : undefined;
if (preset) for (const pc of preset.party) { const { characterId, ...fields } = pc; const m = master.find(c => c.id === characterId); characters.push({ ...structuredClone(m), ...fields }); }
for (const n of preset ? [] : names) {
  const m = master.find(c => c.name === n || c.englishName === n);
  if (!m) { console.error(`キャラが見つかりません: ${n}`); process.exit(1); }
  if (!m.source?.gcsimKey) { console.error(`gcsim 未対応のキャラです: ${n}`); process.exit(1); }
  const o = ownedPath ? owned.find(x => imp.matchMasterCharacterId(x, [m.id]) === m.id) : undefined;
  if (ownedPath && !o) console.error(`（${n} は持ちキャラにないので、仮値の装備を使います）`);
  if (o) {
    const { fields } = imp.ownedToPartyFields(o, { weapons, artifacts });
    characters.push({ ...structuredClone(m), ...fields });
  } else {
    const eq = cs.defaultEquipmentFor(m.id, { weapons, artifacts });
    characters.push({ ...structuredClone(m), ...eq, customStats: cs.defaultCustomStatsFor(m.id) });
  }
}
const roles: Record<string, string[]> = Object.fromEntries(characters.map(c => [c.id, [...(c.roles ?? [])]]));
// --attacker=名前,名前: その人にアタッカーの役割を足す（役割の上書きの代わり）
for (const n of (str('attacker') ?? '').split(',').filter(Boolean)) {
  const c = characters.find(x => x.name === n || x.englishName === n);
  if (c && !roles[c.id].includes('attacker')) roles[c.id].push('attacker');
}
// --only-attacker=名前: その人だけをアタッカーにする（ほかの人のアタッカーの役割は外す。外して空になる人は、サポーター）
const only = str('only-attacker');
if (only) for (const c of characters) { const isOnly = c.name === only || c.englishName === only; roles[c.id] = roles[c.id].filter(r => r !== 'attacker'); if (isOnly) roles[c.id].push('attacker'); else if (roles[c.id].length === 0) roles[c.id].push('supporter'); }
console.log(`編成: ${characters.map(c => `${c.name}(${(c.roles ?? []).join('+') || '役割なし'})`).join(' / ')}`);

// 探索の本体は、画面と共通（src/utils/rotationSearch/search.ts）
const { searchRotation } = await server.ssrLoadModule('/src/utils/rotationSearch/search.ts');
const { DEFAULT_ENEMY } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');
const cores = Math.max(1, Math.min(30, Number(process.env.GCSIM_NODE_WORKERS) || Math.max(6, os.availableParallelism() - 4)));
process.env.GCSIM_NODE_WORKERS ??= String(cores); // gcsim-node の worker の上限（既定 6）を、探索のコア数に合わせる
// --seed-hand: 手組み（--preset の出場）を、出発点に足す（--seeds-only: 手組みだけから登る。辞書で作った少数の候補だけから登る場合の、効果と時間の測定用）
const { expandGroupedStints } = await server.ssrLoadModule('/src/utils/actionGroups.ts');
const extraSeeds = preset && (args.includes('--seed-hand') || args.includes('--seeds-only')) ? [{ stints: expandGroupedStints(structuredClone(preset.stints)), loopStartIndex: preset.loopStartIndex ?? 0 }] : [];
let lastPhase = '';
const T0 = Date.now();
const phaseName: Record<string, string> = { generate: '① 候補の生成', quick: `④ gcsim ${RUNS1} 回ずつ`, refine: '④b 山登り', verify: `⑤ gcsim ${RUNS2} 回ずつ` };
const out = await searchRotation({
  characters, roles, weapons, artifacts, switchDelay: 0.5, defHalt: true, cores, extraSeeds, seedsOnly: args.includes('--seeds-only'), energy: args.includes('--energy'),
  // --screen: 画面の「DPS 計算」と同じ条件で評価する（初動 + ループ --loops=5 周・開始エネルギー満タン・敵の粒子 5〜8 秒に 1 個・敵は Lv100 全耐性 10%）。--no-energy でエネルギー無視
  ...(args.includes('--screen') ? { dps: { loops: Number(str('loops') ?? 5), energy: !args.includes('--no-energy'), particles: { minSeconds: 5, maxSeconds: 8, amount: 1 }, enemies: [DEFAULT_ENEMY] } } : {}),
  settings: { battleSeconds: SECONDS, keep1: KEEP1, runs1: RUNS1, keep2: KEEP2, runs2: RUNS2, maxCandidates: MAX },
  onProgress: (p: any) => {
    if (p.phase !== lastPhase) { process.stdout.write(`
[経過 ${((Date.now() - T0) / 1000).toFixed(0)} 秒]`); lastPhase = p.phase; process.stdout.write(`\n${phaseName[p.phase]}（${p.total} 個）…`); }
    else if (p.done % 25 === 0) process.stdout.write(` ${p.done}`);
  },
});
console.log('');
if (out.status !== 'ok') { console.error(`探索できませんでした: ${out.status === 'error' ? out.message : out.status}`); await server.close(); process.exit(1); }
const c = out.counts;
console.log(`候補 ${c.candidates} 個 → CT 違反などで ${c.rejected} 個を捨て → ${c.scored} 個 → 簡易スコア上位 ${c.quick} 個を gcsim → 成功 ${c.quickOk} 個`);
for (const [k, v] of Object.entries(c.rejectedBy).sort((a, b) => b[1] - a[1]).slice(0, 5)) console.log(`   捨てた ${v} 個: ${k}`);
for (const [k, v] of Object.entries(c.quickFailed)) console.log(`   gcsim で失敗 ${v} 個: ${k.slice(0, 80)}`);
if (out.spearman !== undefined) console.log(`簡易スコアと gcsim DPS の順位相関（スピアマン）: ${out.spearman.toFixed(2)} / gcsim 最良の候補の、簡易スコアの順位: ${out.bestQuickScoreRank} 位（${c.scored} 個中）`);
for (const g of (out.groupBest ?? []).sort((a: any, b: any) => b.dps - a.dps)) console.log(`   アタッカー ${g.key.split('+').map((id: string) => characters.find((c: any) => c.id === id)?.name).join('+')}: 探索中の最良 ${(g.dps / 1000).toFixed(1)}k ${g.label.slice(0, 120)}`);
console.log(`所要時間 ${(out.elapsedMs / 1000).toFixed(1)} 秒`);
console.log(`\n=== 順位（戦闘 ${SECONDS} 秒・gcsim ${RUNS2} 回。DPS の単位は千）===`);
for (const [i, r] of out.results.slice(0, TOP).entries()) {
  console.log(`${String(i + 1).padStart(2)}. ${(r.dps / 1000).toFixed(1).padStart(6)} ±${(r.sd / 1000).toFixed(1)}  長さ ${r.totalSeconds.toFixed(1)}s  スコア ${r.score.toFixed(3)}  ${r.candidate.label}${r.particles ? `  粒子E ${r.particles.energyPerMember10s.toFixed(1)}/人/10秒（粒子 敵 ${r.particles.enemy.toFixed(0)}・全体 ${r.particles.total.toFixed(0)}）` : ''}`);
}
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify({ party: names, seconds: SECONDS, counts: c, results: out.results.map((r: any) => ({ dps: r.dps, sd: r.sd, totalSeconds: r.totalSeconds, score: r.score, particles: r.particles, label: r.candidate.label, rot: { loop: r.candidate.loopStartIndex ?? 0, stints: r.candidate.stints.map((x: any) => ({ c: x.characterId, a: x.actions.map((y: any) => y.actionTypeId.slice(x.characterId.length + 1)) })) } })) }, null, 1));
}
await server.close();
process.exit(0);
