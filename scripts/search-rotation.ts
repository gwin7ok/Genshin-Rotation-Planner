/**
 * ローテーションの自動探索（第 1 段。画面なし。設計: docs/gcsim-integration/phase-9-auto-rotation-search/設計.md）。
 * 編成（4 人）を入れると、候補を作り → CT 違反を除き → 簡易スコアで絞り → gcsim（少ない回数）で絞り → gcsim（多い回数）で順位をつける。
 *
 *   node scripts/search-rotation.ts ナヒーダ 胡桃 香菱 ベネット
 *   node scripts/search-rotation.ts 胡桃 香菱 ナヒーダ 行秋 --owned=tools/hoyolab-fetch/out/owned-characters.json
 *   オプション: --seconds=40（戦闘時間）--keep1=200（簡易スコアで残す数）--runs1=3 --keep2=30（少ない回数の gcsim で残す数）--runs2=10 --top=10 --max=20000（候補の上限）--out=結果.json
 *
 * 役割は、マスターの初期値（roles）を使う。--owned を付けると、持ちキャラの実際の装備・凸・天賦を使う（付けないと、アプリの「仮値」）。
 * 爆発のエネルギーは無視する（アプリの通常の計算と同じ）。
 */
import fs from 'node:fs';
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
const KEEP1 = num('keep1', 200);
const RUNS1 = num('runs1', 3);
const KEEP2 = num('keep2', 30);
const RUNS2 = num('runs2', 10);
const TOP = num('top', 10);
const MAX = num('max', 20000);
const CONCURRENT = num('concurrent', 4);
const ownedPath = str('owned');
const outPath = str('out');
if (names.length < 1 || names.length > 4) {
  console.error('編成のキャラ名を 1〜4 人、指定してください（例: node scripts/search-rotation.ts ナヒーダ 胡桃 香菱 ベネット）');
  process.exit(1);
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
await useNodeGcsim(server);
const { buildGcsimConfig } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');
const { runGcsimSample } = await server.ssrLoadModule('/src/utils/gcsim/gcsimClient.ts');
const dps = await server.ssrLoadModule('/src/utils/gcsim/dpsCalc.ts');
const cs = await server.ssrLoadModule('/src/utils/customStats.ts');
const imp = await server.ssrLoadModule('/src/utils/hoyolab/importCharacters.ts');
const { generateCandidates } = await server.ssrLoadModule('/src/utils/rotationSearch/candidates.ts');
const { evaluateCandidates } = await server.ssrLoadModule('/src/utils/rotationSearch/evaluate.ts');

const master: any[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const weapons: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const artifacts: any[] = JSON.parse(fs.readFileSync('src/data/artifacts_master_data.json', 'utf8'));
const owned: any[] = ownedPath ? JSON.parse(fs.readFileSync(ownedPath, 'utf8')).characters : [];

// 編成のキャラを作る
const characters: any[] = [];
for (const n of names) {
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
const roles: Record<string, string[]> = Object.fromEntries(characters.map(c => [c.id, c.roles ?? []]));
console.log(`編成: ${characters.map(c => `${c.name}(${(c.roles ?? []).join('+') || '役割なし'})`).join(' / ')}`);

const lap = (label: string, t0: number) => console.log(`  ${label}: ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);

// ① 候補の生成
let t = Date.now();
const candidates = generateCandidates(characters, roles, { maxCandidates: MAX });
console.log(`① 候補 ${candidates.length} 個`);
lap('生成', t);

// ②③ CT 違反の除去と簡易スコア
t = Date.now();
const ev = evaluateCandidates(characters, candidates, {});
console.log(`② CT 違反などで捨てた ${ev.rejected} 個 → 残り ${ev.scored.length} 個`);
const topReasons = Object.entries(ev.rejectedBy).sort((a, b) => b[1] - a[1]).slice(0, 5);
for (const [k, v] of topReasons) console.log(`     ${v} 個: ${k}`);
lap('CT 違反の除去と簡易スコア', t);
const stage1 = ev.scored.slice(0, KEEP1);
console.log(`③ 簡易スコアの上位 ${stage1.length} 個を gcsim へ（スコアの範囲 ${stage1[0]?.score.toFixed(3)}〜${stage1[stage1.length - 1]?.score.toFixed(3)}）`);

// gcsim の実行（同時に数個ずつ）
interface Run { sc: any; dps?: number; sd?: number; error?: string }
const runOne = async (sc: any, runs: number): Promise<Run> => {
  const cfg = buildGcsimConfig({ characters, stints: sc.candidate.stints, loopStartIndex: 0, switchDelay: 0.5, defHalt: true, weapons, artifacts, battleSeconds: SECONDS });
  if (!cfg.runnable) return { sc, error: `設定文を作れない: ${(cfg.warnings.find((w: any) => w.level === 'error')?.message ?? '').slice(0, 70)}` };
  try {
    const out = await dps.computeDps({ config: cfg, runs, parallel: Math.max(1, Math.ceil(6 / CONCURRENT)), run: runGcsimSample, context: { battleSeconds: SECONDS, enemies: undefined } });
    if (out.status !== 'ok') return { sc, error: String(out.message ?? out.status).slice(0, 80) };
    return { sc, dps: out.result.dps.mean, sd: out.result.dps.sd };
  } catch (e) {
    return { sc, error: String((e as Error).message).slice(0, 80) };
  }
};
const mapLimit = async (items: any[], runs: number): Promise<Run[]> => {
  const out: Run[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENT }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await runOne(items[i], runs);
      if ((i + 1) % 25 === 0) process.stdout.write(`    ${i + 1}/${items.length}\r`);
    }
  }));
  return out;
};

// ④ 少ない回数の gcsim
t = Date.now();
const r1 = await mapLimit(stage1, RUNS1);
const ok1 = r1.filter(r => r.dps !== undefined);
const ng1 = r1.filter(r => r.dps === undefined);
console.log(`④ gcsim ${RUNS1} 回ずつ: 成功 ${ok1.length} 個 / 失敗 ${ng1.length} 個`);
const ngReasons = new Map<string, number>();
for (const r of ng1) ngReasons.set(r.error!, (ngReasons.get(r.error!) ?? 0) + 1);
for (const [k, v] of [...ngReasons].sort((a, b) => b[1] - a[1]).slice(0, 5)) console.log(`     ${v} 個: ${k}`);
lap('gcsim（少ない回数）', t);

// 簡易スコアと gcsim の DPS の順位相関（スピアマン）
const rank = (xs: number[]) => {
  const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  idx.forEach(([, i], k) => { r[i] = k; });
  return r;
};
if (ok1.length >= 3) {
  const a = rank(ok1.map(r => r.sc.score));
  const b = rank(ok1.map(r => r.dps!));
  const n = ok1.length;
  const d2 = a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0);
  console.log(`   簡易スコアと gcsim DPS の順位相関（スピアマン）: ${(1 - (6 * d2) / (n * (n * n - 1))).toFixed(2)}`);
  const best = ok1.reduce((x, y) => (y.dps! > x.dps! ? y : x));
  console.log(`   gcsim 最良の候補の、簡易スコアの順位: ${ev.scored.indexOf(best.sc) + 1} 位 / ${ev.scored.length} 個中`);
}

// ⑤ 多い回数の gcsim
const stage2 = ok1.sort((x, y) => y.dps! - x.dps!).slice(0, KEEP2).map(r => r.sc);
t = Date.now();
const r2 = (await mapLimit(stage2, RUNS2)).filter(r => r.dps !== undefined).sort((x, y) => y.dps! - x.dps!);
lap(`⑤ gcsim ${RUNS2} 回ずつ（${stage2.length} 個）`, t);

console.log(`\n=== 順位（戦闘 ${SECONDS} 秒・gcsim ${RUNS2} 回。DPS の単位は千）===`);
for (const [i, r] of r2.slice(0, TOP).entries()) {
  console.log(`${String(i + 1).padStart(2)}. ${(r.dps! / 1000).toFixed(1).padStart(6)} ±${(r.sd! / 1000).toFixed(1)}  長さ ${r.sc.totalSeconds.toFixed(1)}s  スコア ${r.sc.score.toFixed(3)}  ${r.sc.candidate.label}`);
}
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify({ party: names, seconds: SECONDS, counts: { candidates: candidates.length, rejected: ev.rejected, stage1: stage1.length, stage1ok: ok1.length }, results: r2.map(r => ({ dps: r.dps, sd: r.sd, totalSeconds: r.sc.totalSeconds, score: r.sc.score, label: r.sc.candidate.label })) }, null, 1));
}
await server.close();
process.exit(0);
