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
    ...(extra ? { ignoreBurstEnergy: extra.ignoreBurstEnergy, addedEnergyRechargeByCharacterId: extra.added } : {}),
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

const outcome = await er.computeRequiredEr({ build, run: runGcsimSample, gcsimVersion: 'check' });
if (outcome.status !== 'ok') {
  console.log(`✗ 算出が成功しなかった: ${outcome.status} ${outcome.message ?? ''}`);
  await server.close();
  process.exit(1);
}
const result = outcome.result;
check(result.entries.length === 2, `結果が 2 キャラ分（${result.seeds} 種）`);
for (const e of result.entries) console.log(`  ${e.name}: ${e.status} ${e.status === 'ok' ? `足す ${e.addedEr}（合計 ${e.totalEr}%）` : ''}`);

// 検証: 求めた値で全種が一致し、小さくすると外れる
const baselineSig = async (seed: number) => er.burstSignature((await runGcsimSample(build().config, seed)).logs);
const sigAt = async (id: string, x: number, seed: number) => {
  const added = { ...Object.fromEntries(chars.map(c => [c.id, er.ER_MAX_ADDED])), [id]: x };
  return er.burstSignature((await runGcsimSample(build({ ignoreBurstEnergy: false, added }).config, seed)).logs);
};
for (const e of result.entries.filter((x: any) => x.status === 'ok')) {
  let allMatch = true;
  for (let seed = 1; seed <= result.seeds; seed++) if ((await sigAt(e.characterId, e.addedEr, seed)) !== (await baselineSig(seed))) allMatch = false;
  check(allMatch, `${e.name}: 求めた値（+${e.addedEr}）で、全種の爆発が基準と一致`);
  if (e.addedEr > 0.03) {
    let anyMismatch = false;
    for (let seed = 1; seed <= result.seeds && !anyMismatch; seed++) if ((await sigAt(e.characterId, e.addedEr - 0.03, seed)) !== (await baselineSig(seed))) anyMismatch = true;
    check(anyMismatch, `${e.name}: 3 刻み分小さくすると、どれかの種で爆発がずれる`);
  }
}
await server.close();
console.log(failed === 0 ? '\n合格' : `\n${failed} 件が不合格`);
process.exit(failed === 0 ? 0 : 1);
