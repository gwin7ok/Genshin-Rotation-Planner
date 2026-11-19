/**
 * 必要元素チャージ効率の算出の確認（フェーズ7 / issue #46。D242）。gcsim は、WebAssembly 版（public/gcsim/main.wasm。Node で動かす。scripts/gcsim-node.ts）を使う。
 *
 *   npm run check:required-er
 *
 * 固定した小さな編成（ベネット + 香菱。E → Q を繰り返す）で、実際の画面と同じ関数（buildGcsimConfig・computeRequiredEr）を使い、次を検証する。
 *   - 算出が成功し、爆発のあるキャラの必要 ER が求まること
 *   - 求めた値（足す分）で、全ての種で爆発が基準と一致すること
 *   - 求めた値より小さく（2 刻み分）すると、どれかの種で爆発がずれること（境界が正しいこと）
 *   - 通常の設定文（ER・爆発のエネルギーの指定なし）に `ignore_burst_energy=true` が残り、ER の行が出ないこと
 * 合わなければ、終了コード 1。
 */
import fs from 'node:fs';
import { createServer } from 'vite';
import { useNodeGcsim } from './gcsim-node.ts';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
await useNodeGcsim(server);
const { buildGcsimConfig } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');
const { runGcsimSample } = await server.ssrLoadModule('/src/utils/gcsim/gcsimClient.ts');
const er = await server.ssrLoadModule('/src/utils/gcsim/requiredEnergyRecharge.ts');

const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const all: any[] = Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw);
const weapons: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const weaponOf = (type: string) => {
  const w = weapons.find(x => x.weaponType === type && x.gcsimKey && x.rarity === 4);
  if (!w) throw new Error(`武器が無い: ${type}`);
  return w;
};

let seq = 0;
const byName = (name: string, extra: Record<string, unknown> = {}) => {
  const c = all.find(x => x.name === name);
  if (!c) throw new Error(`キャラが見つかりません: ${name}`);
  return { ...structuredClone(c), ...extra };
};
const makeAction = (char: any, step: string) => {
  const id = `a${++seq}`;
  const def = char.availableActions.find((a: any) => a.id === `${char.id}_${step}`);
  if (!def) throw new Error(`${char.name} にアクションがありません: ${step}`);
  return { id, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration };
};

const bennettBase = byName('ベネット');
const xianglingBase = byName('香菱');
const wB = weaponOf(bennettBase.weaponType);
const wX = weaponOf(xianglingBase.weaponType);
const chars = [byName('ベネット', { weaponId: wB.id, weaponRefinementRank: 1 }), byName('香菱', { weaponId: wX.id, weaponRefinementRank: 1 })];
const stints = [
  { id: 's0', characterId: chars[0].id, actions: ['e', 'q'].map(s => makeAction(chars[0], s)) },
  { id: 's1', characterId: chars[1].id, actions: ['e', 'q'].map(s => makeAction(chars[1], s)) },
];
const build = (extra?: { ignoreBurstEnergy: boolean; added: Record<string, number> }) =>
  buildGcsimConfig({
    characters: chars, stints, loopStartIndex: 0, switchDelay: 0.5, defHalt: true, weapons: [wB, wX], artifacts: [],
    ...(extra ? { ignoreBurstEnergy: extra.ignoreBurstEnergy, addedEnergyRechargeByCharacterId: extra.added, loopIterations: er.ER_LOOP_ITERATIONS, tightDuration: true } : {}),
  });

let failed = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed++;
};

const plain = build();
check(plain.config.includes('ignore_burst_energy=true') && !/ er=/.test(plain.config), '通常の設定文: ignore_burst_energy=true が残り、ER の指定が出ない');
const withEr = build({ ignoreBurstEnergy: false, added: { [chars[1].id]: 1.5 } });
check(!withEr.config.includes('ignore_burst_energy') && withEr.config.includes('add stats cr=1 er=1.5;'), '算出用の設定文: ignore_burst_energy が無く、ER の行が出る');
const withParticles = buildGcsimConfig({ characters: chars, stints, loopStartIndex: 0, switchDelay: 0.5, defHalt: true, weapons: [wB, wX], artifacts: [], enemyParticles: { minSeconds: 8, maxSeconds: 12, amount: 1 } });
check(withParticles.config.includes('energy every interval=480,720 amount=1;') && !plain.config.includes('energy every'), '敵の粒子: 指定したときだけ `energy every` の行が出る（8〜12 秒 = 480〜720 フレーム）');

// 幽境モード（フェーズ8 / issue #54）: 設定文の組み立て
const abyssBase = { characters: chars, stints, loopStartIndex: 0, switchDelay: 0.5, defHalt: true, weapons: [wB, wX], artifacts: [] };
const zeroCfg = buildGcsimConfig({ ...abyssBase, startEnergyZero: true, ignoreBurstEnergy: false });
check((zeroCfg.config.match(/\+params=\[start_energy=0\]/g) ?? []).length === 2 && !plain.config.includes('start_energy'), '幽境: startEnergyZero で全キャラ（2 人）に start_energy=0 が付き、指定なしの設定文には出ない');
const timedCfg = buildGcsimConfig({ ...abyssBase, timedParticles: [{ seconds: 30, amount: 3 }, { seconds: 10, amount: 1 }, { seconds: 5, amount: 0 }, { seconds: -1, amount: 2 }] });
check(timedCfg.config.includes('energy once interval=600 amount=1;\nenergy once interval=1800 amount=3;') && (timedCfg.config.match(/energy once/g) ?? []).length === 2, '幽境: 時刻指定の粒子は、時刻の早い順に `energy once` の行になり、個数 0・負の時刻は出さない');
const loopsOf = (cfg: { config: string }) => Number(/while i <= (\d+)/.exec(cfg.config)?.[1]);
const n60 = loopsOf(buildGcsimConfig({ ...abyssBase, battleSeconds: 60 }));
const n120 = loopsOf(buildGcsimConfig({ ...abyssBase, battleSeconds: 120 }));
const nHuge = loopsOf(buildGcsimConfig({ ...abyssBase, battleSeconds: 1e6 }));
check(n60 >= 1 && n120 > n60 && nHuge === 30, `幽境: 戦闘時間から周数が自動で決まり、上限（30）で止まる（60 秒 = ${n60} 周 / 120 秒 = ${n120} 周 / 極端に長い = ${nHuge} 周）`);

// 幽境モード: 判定（合成のタイムライン）。0 スタートで最初の爆発も数え、計画の時刻（planned）から待ち許容までの粒子だけを足す
const tlz = { max: 50, events: [
  { kind: 'particle', raw: 10, frame: 100 },
  { kind: 'burst', cost: 40, frame: 305, exec: 300, planned: 200 },
  { kind: 'particle', raw: 10, frame: 330 },
] };
const tlzNoPlan = { max: 50, events: tlz.events.map((e: any) => ({ ...e, planned: undefined })) };
const zs = { firstDelayFrames: 120 };
const zr = er.requiredErForRate([tlz], 1, 0, 0, zs);
const zrNoPlan = er.requiredErForRate([tlzNoPlan], 1, 0, 0, zs);
check(er.requiredErForRate([tlz], 1, 0, 0) === undefined && Math.abs(zr - 400) < 0.1 && Math.abs(zrNoPlan - 200) < 0.1, `幽境: 0 スタートは最初の爆発も数え（満タン開始は数えない）、計画の時刻 + 許容までの粒子だけを足す（${zr} / 計画なしは実行の時刻から ${zrNoPlan}）`);
check(er.firstMismatchChar('0@88,1@220,0@1028', '0@133,1@452,0@1073', 0, 0) === 0
  && er.firstMismatchChar('0@88,1@220,0@1028', '0@133,1@452,0@1073', 0, 0, 200) === 1
  && er.firstMismatchChar('0@88,1@220,0@1028', '0@133,1@452,0@1073', 0, 0, 600) === undefined, '幽境: 最初の爆発だけに、別の待ち許容を使える（不一致の判定）');
const plannedMap = er.plannedBurstFrames('0@88,1@220,0@1028');
check(plannedMap.get(0)?.join() === '88,1028' && plannedMap.get(1)?.join() === '220', '幽境: 基準の並びから、キャラごとの爆発の計画した時刻を取り出せる');

// 必要 ER の計算（合成ログ）: 爆発 4 回。最初は数えない。
//   2 回目 = 粒子 (10÷2)+(6÷2) = 8（ER 100% 換算）・固定 10 → (50−10)÷8 = 500% で足りる / 3 回目 = 粒子なし → 届かない / 4 回目 = 固定 60 → 0 でも足りる
const ev = (frame: number, msg: string, logs: Record<string, number>) => ({ event: 'energy', frame, char_index: 0, msg, logs });
const synthetic = [
  ev(10, 'particle', { amt: 99, ER: 1, max_energy: 50 }), // 最初の爆発より前
  ev(20, 'draining energy', { max_energy: 50 }),
  ev(30, 'particle', { amt: 10, ER: 2, max_energy: 50 }),
  ev(40, 'adding energy', { "rec'd": 10, pre_recovery: 0, post_recovery: 5, max_energy: 50 }),
  ev(50, 'particle', { amt: 6, ER: 2, max_energy: 50 }),
  ev(60, 'draining energy', { max_energy: 50 }),
  ev(70, 'draining energy', { max_energy: 50 }),
  ev(80, 'adding energy', { "rec'd": 60, max_energy: 50 }),
  ev(90, 'draining energy', { max_energy: 50 }),
];
const tl0 = [er.collectEnergyTimelines(synthetic).get(0)];
const r = (rate: number) => er.requiredErForRate(tl0, rate);
check(r(1 / 3) === 0 && Math.abs(r(2 / 3) - 500) < 0.1 && r(1) === Infinity, `必要 ERの計算: 割合ごとに 0 / 500 / 届かない（${r(1 / 3)} / ${r(2 / 3)} / ${r(1)}）`);
// 一部だけ消費する爆発（ヴァレサの特殊爆発: 70 のうち 30 を消費して 40 残る）。通常爆発の次に特殊爆発を撃つ繰り返し
const ev1 = (frame: number, msg: string, logs: Record<string, number>) => ({ event: 'energy', frame, char_index: 1, msg, logs });
const partial = [er.collectEnergyTimelines([
  ev1(10, 'draining energy', { max_energy: 70, pre_drain: 70, post_drain: 40 }), // 最初（数えない）。40 残る
  ev1(20, 'particle', { amt: 10, ER: 2, max_energy: 70 }), // 5（ER 100% 換算）
  ev1(30, 'draining energy', { max_energy: 70, pre_drain: 70, post_drain: 0 }), // 70 必要。40 + 5×ER/100 ≥ 70 → ER 600%
]).get(1)];
const pr = er.requiredErForRate(partial, 1);
check(Math.abs(pr - 600) < 0.1, `必要 ERの計算: 一部だけ消費した残りのエネルギーを引き継ぐ（${pr}）`);

const outcome = await er.computeRequiredEr({ build, run: runGcsimSample, gcsimVersion: "check", verify: true, verifyTolerance: er.ER_VERIFY_TOLERANCE_ROUGH });
if (outcome.status !== 'ok') {
  console.log(`✗ 算出が成功しなかった: ${outcome.status} ${outcome.message ?? ''}`);
  await server.close();
  process.exit(1);
}
const result = outcome.result;
check(result.entries.length === 2, `結果が 2 キャラ分（${result.seeds} 種）`);
for (const e of result.entries) console.log(`  ${e.name}: ${e.status} ${e.status === 'ok' ? `目安 ${e.typicalEr}% / 安定 ${e.stableEr}% / 確実 ${e.certainEr}%（足す ${e.addedEr}）` : ''}`);

for (const e of result.entries.filter((x: any) => x.status === 'ok')) check(e.typicalEr <= e.stableEr && e.stableEr <= e.certainEr, `${e.name}: 目安 ≤ 安定 ≤ 確実`);

// 検証: 確実の値で全種が一致し、小さくすると外れる
const baselineSig = async (seed: number) => er.burstSignature((await runGcsimSample(build({ ignoreBurstEnergy: true, added: {} }).config, seed)).logs);
const differs = (a: string, b: string) => er.firstMismatchChar(a, b, er.ER_BURST_DELAY_FRAMES, 0) !== undefined;
const sigAt = async (id: string, x: number, seed: number) => {
  const added = { ...Object.fromEntries(chars.map(c => [c.id, er.ER_MAX_ADDED])), [id]: x };
  return er.burstSignature((await runGcsimSample(build({ ignoreBurstEnergy: false, added }).config, seed)).logs);
};
for (const e of result.entries.filter((x: any) => x.status === 'ok')) {
  let allMatch = true;
  for (let seed = 1; seed <= result.seeds; seed++) if (differs(await baselineSig(seed), await sigAt(e.characterId, e.addedEr, seed))) allMatch = false;
  check(allMatch, `${e.name}: 確実の値（+${e.addedEr}）で、全種の爆発が基準と一致（30 フレームまでの遅れは許す）`);
  if (e.addedEr > 0.03) {
    let anyMismatch = false;
    for (let seed = 1; seed <= result.seeds && !anyMismatch; seed++) if (differs(await baselineSig(seed), await sigAt(e.characterId, e.addedEr - 0.03, seed))) anyMismatch = true;
    check(anyMismatch, `${e.name}: 3 刻み分小さくすると、どれかの種で爆発がずれる`);
  }
}
// 幽境モードの算出（開始エネルギー 0・時刻指定の粒子・戦闘時間）。CT を守る回し方（香菱の後に 8 秒の待機）で、実際の画面と同じ関数を通す
const abyssStints = [
  stints[0],
  { ...stints[1], actions: [...stints[1].actions, { id: 'w1', actionTypeId: 'wait', name: 'w', shortName: 'w', type: 'wait', duration: 8 }] },
];
const abyssCond = { battleSeconds: 60, firstBurstWaitSeconds: 30, timedParticles: [{ seconds: 20, amount: 3 }] };
const enemyP = { minSeconds: 5, maxSeconds: 8, amount: 1 };
const buildAbyss = (extra: any) => buildGcsimConfig({
  characters: chars, stints: abyssStints, loopStartIndex: 0, switchDelay: 0.5, defHalt: true, weapons: [wB, wX], artifacts: [],
  ignoreBurstEnergy: extra.ignoreBurstEnergy, addedEnergyRechargeByCharacterId: extra.added, loopIterations: er.ER_LOOP_ITERATIONS, tightDuration: true, enemyParticles: extra.enemyParticles,
  ...(extra.abyss ? { startEnergyZero: true, timedParticles: extra.abyss.timedParticles, battleSeconds: extra.abyss.battleSeconds } : {}),
});
const abyssOutcome = await er.computeRequiredEr({ build: buildAbyss, abyss: abyssCond, enemyParticles: enemyP, run: runGcsimSample, gcsimVersion: 'check', verify: true, verifyTolerance: er.ER_VERIFY_TOLERANCE_ROUGH, seeds: 8 });
if (abyssOutcome.status !== 'ok') {
  console.log(`✗ 幽境モードの算出が成功しなかった: ${abyssOutcome.status} ${abyssOutcome.message ?? ''}`);
  failed++;
} else {
  const ar = abyssOutcome.result;
  check(ar.entries.length === 2 && ar.abyss?.battleSeconds === 60 && ar.entries.every((e: any) => e.status === 'ok'), `幽境: 算出が成功し、結果に戦闘条件が残る（${ar.seeds} 種・窓 ${ar.windows}）`);
  for (const e of ar.entries) console.log(`  [幽境] ${e.name}: ${e.status} ${e.status === 'ok' ? `目安 ${e.typicalEr}% / 安定 ${e.stableEr}% / 確実 ${e.certainEr}%（足す ${e.addedEr}）` : ''}`);
  for (const e of ar.entries.filter((x: any) => x.status === 'ok')) check(e.typicalEr <= e.stableEr && e.stableEr <= e.certainEr, `[幽境] ${e.name}: 目安 ≤ 安定 ≤ 確実`);
  const firstDelay = Math.round(abyssCond.firstBurstWaitSeconds * 60);
  const abBase = (seed: number) => runGcsimSample(buildAbyss({ ignoreBurstEnergy: true, added: {}, enemyParticles: enemyP, abyss: abyssCond }).config, seed).then((r: any) => er.burstSignature(r.logs));
  const abSig = async (id: string, x: number, seed: number) => {
    const added = { ...Object.fromEntries(chars.map(c => [c.id, er.ER_MAX_ADDED])), [id]: x };
    return er.burstSignature((await runGcsimSample(buildAbyss({ ignoreBurstEnergy: false, added, enemyParticles: enemyP, abyss: abyssCond }).config, seed)).logs);
  };
  const abDiffers = (a: string, b: string) => er.firstMismatchChar(a, b, er.ER_BURST_DELAY_FRAMES, 0, firstDelay) !== undefined;
  for (const e of ar.entries.filter((x: any) => x.status === 'ok')) {
    let allMatch = true;
    for (let seed = 1; seed <= ar.seeds; seed++) if (abDiffers(await abBase(seed), await abSig(e.characterId, e.addedEr, seed))) allMatch = false;
    check(allMatch, `[幽境] ${e.name}: 確実の値（+${e.addedEr}）で、全種の爆発が基準と一致（最初の爆発は ${abyssCond.firstBurstWaitSeconds} 秒まで遅れてよい）`);
    // 検証の刻み（概算 = 0.1）より大きく下げると、どれかの種でずれる（下限 = 足す分 0 に近いときは調べない）
    if (e.addedEr > 0.15) {
      let anyMismatch = false;
      for (let seed = 1; seed <= ar.seeds && !anyMismatch; seed++) if (abDiffers(await abBase(seed), await abSig(e.characterId, e.addedEr - 0.15, seed))) anyMismatch = true;
      check(anyMismatch, `[幽境] ${e.name}: 0.15 刻み分小さくすると、どれかの種で爆発がずれる`);
    }
  }
}
await server.close();
console.log(failed === 0 ? '\n合格' : `\n${failed} 件が不合格`);
process.exit(failed === 0 ? 0 : 1);
