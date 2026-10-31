/**
 * 必要元素チャージ効率の算出の確認（フェーズ7 / issue #46。D242）。gcsim のサーバーが要る（npm run gcsim:start）。
 *
 *   npm run check:required-er
 *
 * 固定した小さな編成（ベネット + 香菱。E → Q を繰り返す）で、実際の画面と同じ関数（buildGcsimConfig・computeRequiredEr）を使い、次を確かめる。
 *   - 算出が成功し、爆発のあるキャラの必要 ER が求まること
 *   - 求めた値（足す分）で、全ての種で爆発が基準と一致すること
 *   - 求めた値より小さく（2 刻み分）すると、どれかの種で爆発がずれること（境界が正しいこと）
 *   - 通常の設定文（ER・爆発のエネルギーの指定なし）に `ignore_burst_energy=true` が残り、ER の行が出ないこと
 * 合わなければ、終了コード 1。
 */
import fs from 'node:fs';
import { createServer } from 'vite';
import './require-gcsim-server.ts';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
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
    ...(extra ? { ignoreBurstEnergy: extra.ignoreBurstEnergy, addedEnergyRechargeByCharacterId: extra.added, loopIterations: er.ER_LOOP_ITERATIONS } : {}),
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

const outcome = await er.computeRequiredEr({ build, run: runGcsimSample, gcsimVersion: 'check' });
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
const sigAt = async (id: string, x: number, seed: number) => {
  const added = { ...Object.fromEntries(chars.map(c => [c.id, er.ER_MAX_ADDED])), [id]: x };
  return er.burstSignature((await runGcsimSample(build({ ignoreBurstEnergy: false, added }).config, seed)).logs);
};
for (const e of result.entries.filter((x: any) => x.status === 'ok')) {
  let allMatch = true;
  for (let seed = 1; seed <= result.seeds; seed++) if ((await sigAt(e.characterId, e.addedEr, seed)) !== (await baselineSig(seed))) allMatch = false;
  check(allMatch, `${e.name}: 確実の値（+${e.addedEr}）で、全種の爆発が基準と一致`);
  if (e.addedEr > 0.03) {
    let anyMismatch = false;
    for (let seed = 1; seed <= result.seeds && !anyMismatch; seed++) if ((await sigAt(e.characterId, e.addedEr - 0.03, seed)) !== (await baselineSig(seed))) anyMismatch = true;
    check(anyMismatch, `${e.name}: 3 刻み分小さくすると、どれかの種で爆発がずれる`);
  }
}
await server.close();
console.log(failed === 0 ? '\n合格' : `\n${failed} 件が不合格`);
process.exit(failed === 0 ? 0 : 1);
