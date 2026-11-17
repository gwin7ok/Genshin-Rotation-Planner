/**
 * DPS 計算の確認（D343）。gcsim のサーバーが要る（npm run gcsim:start）。
 *
 *   npm run check:dps
 *
 * - 敵の設定: 指定なしは従来の `target lvl=100 resist=0.1;`、指定ありは耐性・体数が設定文に出る
 * - 集計: 合成したログで、総ダメージ・キャラ別・時間・統計が正しいこと
 * - 実機: ベネット + 香菱の編成を gcsim で 6 回実行し、DPS が正の値で、キャラ別の合計が総ダメージと一致し、周数が多いほど時間が延びること
 * 合わなければ、終了コード 1。
 */
import fs from 'node:fs';
import { createServer } from 'vite';
import './require-gcsim-server.ts';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { buildGcsimConfig, targetStatements, DEFAULT_ENEMY } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');
const { runGcsimSample } = await server.ssrLoadModule('/src/utils/gcsim/gcsimClient.ts');
const dps = await server.ssrLoadModule('/src/utils/gcsim/dpsCalc.ts');

let failed = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed++;
};

// 1. 敵の設定
check(targetStatements(undefined).join() === 'target lvl=100 resist=0.1;', '敵の指定なし: 従来と同じ `target lvl=100 resist=0.1;`');
const e2 = [DEFAULT_ENEMY, { level: 90, resist: { ...DEFAULT_ENEMY.resist, hydro: -0.2 } }];
const t2 = targetStatements(e2);
check(t2.length === 2 && t2[0] === 'target lvl=100 resist=0.1;' && t2[1].startsWith('target lvl=90 ') && t2[1].includes('hydro=-0.2') && t2[1].includes('pyro=0.1'), '敵 2 体: 体数ぶんの行が出て、耐性が個別に出る');

// 2. 集計（合成ログ）
const logs = [
  { event: 'action', frame: 0, msg: 'executed skill', char_index: 0 },
  { event: 'damage', frame: 60, msg: 'a', char_index: 0, logs: { damage: 100 } },
  { event: 'damage', frame: 120, msg: 'b', char_index: 1, logs: { damage: 50.5 } },
  { event: 'damage', frame: 120, msg: 'c', char_index: 1, logs: { damage: 'x' } },
  { event: 'action', frame: 180, msg: 'executed attack', char_index: 1 },
  { event: 'status', frame: 600, msg: 'ignored' },
];
const run = dps.summarizeDamage(logs, 2);
check(run.total === 150.5 && run.byChar[0] === 100 && run.byChar[1] === 50.5 && run.seconds === 3, '合成ログ: 総ダメージ・キャラ別・時間（最後のアクション 3 秒）');
const wl = [
  { event: 'cooldown', frame: 10, msg: 'burst cooldown triggered', char_index: 0 },
  { event: 'sim', frame: 20, msg: 'could not execute burst; action not ready', char_index: 0 },
  { event: 'sim', frame: 21, msg: 'could not execute burst; action not ready', char_index: 0 },
  { event: 'cooldown', frame: 22, msg: 'burst cooldown ready', char_index: 0 },
  { event: 'sim', frame: 22, msg: 'could not execute burst; action not ready', char_index: 0 },
  { event: 'sim', frame: 23, msg: 'could not execute burst; action not ready', char_index: 0 },
  { event: 'sim', frame: 100, msg: 'could not execute burst; action not ready', char_index: 1 },
  { event: 'sim', frame: 150, msg: 'could not execute burst; action not ready', char_index: 1 },
];
const wr = dps.summarizeDamage(wl, 2);
check(wr.energyWaits[0] === 1 && wr.energyWaits[1] === 2, '爆発のエネルギー待ち: CT 待ちは数えず、CT 明けの待ちを 1 かたまり 1 回と数える');
const agg = dps.aggregateDps([{ total: 300, seconds: 3, byChar: [200, 100] }, { total: 500, seconds: 5, byChar: [400, 100] }], 2);
check(agg.dps.mean === 100 && agg.dps.sd === 0 && agg.runs === 2 && Math.abs(agg.byChar[0].share - 0.75) < 1e-9, '統計: DPS 平均・標準偏差・割合');
// 周数の打ち切り（M-3）: 設定文の print("loop ", i) の数を数え、設定の周数より少ない実行を知らせる
const lp = dps.summarizeDamage([{ event: 'user', frame: 1, msg: 'loop 1' }, { event: 'user', frame: 400, msg: 'loop 2' }, { event: 'user', frame: 500, msg: 'loop x' }, { event: 'damage', frame: 600, msg: 'a', char_index: 0, logs: { damage: 10 } }], 2);
check(lp.loopsStarted === 2, '周数: print の「loop N」だけ数える（始まった周数 2）');
const mk = (loopsStarted: number) => ({ total: 10, seconds: 5, byChar: [10, 0], energyWaits: [0, 0], loopsStarted });
const cut = dps.aggregateDps([mk(3), mk(5), mk(4)], 2, 5);
check(cut.truncated?.count === 2 && cut.truncated?.worst === 3, '周数: 設定（5 周）より少ない実行の数（2 回）と、最も短い周数（3 周）');
check(dps.aggregateDps([mk(5), mk(5)], 2, 5).truncated === undefined && dps.aggregateDps([mk(1)], 2).truncated === undefined, '周数: すべて終わっている・周数を渡さないときは、知らせない');

// 3. 実機（ベネット + 香菱）
const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const all: any[] = Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw);
const weapons: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const weaponOf = (type: string) => weapons.find(x => x.weaponType === type && x.gcsimKey && x.rarity === 4);
let seq = 0;
const byName = (name: string, extra: Record<string, unknown> = {}) => ({ ...structuredClone(all.find(x => x.name === name)), ...extra });
const makeAction = (char: any, step: string) => {
  const def = char.availableActions.find((a: any) => a.id === `${char.id}_${step}`);
  return { id: `a${++seq}`, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration };
};
const wB = weaponOf(byName('ベネット').weaponType);
const wX = weaponOf(byName('香菱').weaponType);
const chars = [byName('ベネット', { weaponId: wB.id, weaponRefinementRank: 1 }), byName('香菱', { weaponId: wX.id, weaponRefinementRank: 1 })];
const stints = [
  { id: 's0', characterId: chars[0].id, actions: ['e', 'q'].map(s => makeAction(chars[0], s)) },
  { id: 's1', characterId: chars[1].id, actions: ['e', 'q'].map(s => makeAction(chars[1], s)) },
];
const build = (loops: number, enemies?: unknown) => buildGcsimConfig({ characters: chars, stints, loopStartIndex: 0, switchDelay: 0.5, defHalt: true, weapons: [wB, wX], artifacts: [], loopIterations: loops, enemies });
const c2 = build(2);
const c5 = build(5);
const o2 = await dps.computeDps({ config: c2, runs: 6, parallel: 3, run: runGcsimSample });
const o5 = await dps.computeDps({ config: c5, runs: 6, parallel: 3, run: runGcsimSample });
check(o2.status === 'ok' && o5.status === 'ok', `実行が成功する（${o2.status}/${o5.status}${o2.message ? ' ' + o2.message : ''}）`);
if (o2.status === 'ok' && o5.status === 'ok') {
  const r = o2.result;
  console.log(`  2 周: DPS ${r.dps.mean.toFixed(0)} ±${r.dps.sd.toFixed(0)}・総ダメージ ${r.total.mean.toFixed(0)}・${r.seconds.toFixed(1)} 秒`);
  console.log(`  5 周: DPS ${o5.result.dps.mean.toFixed(0)}・${o5.result.seconds.toFixed(1)} 秒`);
  check(r.runs === 6 && r.dps.mean > 0 && r.byChar.length === 2, 'DPS が正の値で、キャラ別が編成の人数ぶん');
  check(Math.abs(r.byChar.reduce((a: number, b: any) => a + b.damage, 0) - r.total.mean) < 1e-6 * r.total.mean, 'キャラ別の合計 = 総ダメージ');
  check(o5.result.seconds > r.seconds, '周数が多いほど、時間が延びる');
  const two = await dps.computeDps({ config: build(2, [DEFAULT_ENEMY, DEFAULT_ENEMY]), runs: 3, parallel: 3, run: runGcsimSample });
  check(two.status === 'ok', '敵 2 体の設定文が実行できる');
  const withEnergy = buildGcsimConfig({ characters: chars, stints, loopStartIndex: 0, switchDelay: 0.5, defHalt: true, weapons: [wB, wX], artifacts: [], loopIterations: 2, ignoreBurstEnergy: false, enemyParticles: { minSeconds: 5, maxSeconds: 8, amount: 1 } });
  const zeroMax = buildGcsimConfig({ characters: chars, stints, loopStartIndex: 0, switchDelay: 0.5, defHalt: true, weapons: [wB, wX], artifacts: [], loopIterations: 2, ignoreBurstEnergy: false, enemyParticles: { minSeconds: 0, maxSeconds: 0, amount: 1 } });
  check(!zeroMax.config.includes('energy every'), '粒子の間隔の最大が 0: 粒子の行を出さない（1 フレームごとの粒子で止まらなくなるのを防ぐ）');
  check(!withEnergy.config.includes('ignore_burst_energy') && withEnergy.config.includes('energy every interval=300,480 amount=1;') && c2.config.includes('ignore_burst_energy=true') && !c2.config.includes('energy every'), 'エネルギーを考慮: ignore_burst_energy が無く、敵の粒子の行が出る（考慮しない場合は、従来どおり）');
  const oe = await dps.computeDps({ config: withEnergy, runs: 3, parallel: 3, run: runGcsimSample });
  check(oe.status === 'ok' && oe.result.dps.mean > 0, 'エネルギーを考慮した設定文が実行できる');
  const seen: { done: number; mean?: number }[] = [];
  await dps.computeDps({ config: c2, runs: 4, parallel: 2, run: runGcsimSample, onProgress: (pr: any) => seen.push({ done: pr.done, mean: pr.partial?.dps.mean }) });
  check(seen.length === 3 && seen[0].mean === undefined && seen[1].done === 2 && (seen[1].mean ?? 0) > 0 && seen[2].done === 4, '途中経過: 実行を終えるごとに、ここまでの平均 DPS が渡る');
}
await server.close();
if (failed) { console.error(`\n${failed} 件失敗`); process.exit(1); }
console.log('\nすべて合格');
