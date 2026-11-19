/**
 * DPS 計算の確認（D343）。gcsim の WebAssembly 版（public/gcsim/main.wasm。Node で動かす。scripts/gcsim-node.ts）を使う。
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
import { useNodeGcsim } from './gcsim-node.ts';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
await useNodeGcsim(server);
const { buildGcsimConfig, targetStatements, DEFAULT_ENEMY } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');
const { runGcsimSample } = await server.ssrLoadModule('/src/utils/gcsim/gcsimClient.ts');
const dps = await server.ssrLoadModule('/src/utils/gcsim/dpsCalc.ts');
const es = await server.ssrLoadModule('/src/utils/gcsim/enemyStates.ts');
const battle = await server.ssrLoadModule('/src/utils/battleCondition.ts');

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
// 待ち時間: エネルギー待ちの間の、CT が明けているフレームだけを数える（CT 待ちの部分は含めない）
check(wr.energyWaitFrames[0] === 2 && wr.energyWaitFrames[1] === 2, '爆発のエネルギー待ちの時間: 待ち（フレーム 20〜23）のうち、CT 明け（22・23）の 2 フレームだけ。もう 1 人は 1 フレームの待ちが 2 回で 2 フレーム');
const ctOnly = dps.summarizeDamage([
  { event: 'cooldown', frame: 10, msg: 'burst cooldown triggered', char_index: 0 },
  { event: 'sim', frame: 20, msg: 'could not execute burst; action not ready', char_index: 0 },
  { event: 'sim', frame: 21, msg: 'could not execute burst; action not ready', char_index: 0 },
  { event: 'cooldown', frame: 22, msg: 'burst cooldown ready', char_index: 0 },
], 1);
check(ctOnly.energyWaits[0] === 0 && ctOnly.energyWaitFrames[0] === 0, '爆発のエネルギー待ちの時間: CT 待ちだけの場合は、回数も時間も 0');
const dup = dps.summarizeDamage([
  { event: 'sim', frame: 100, msg: 'could not execute burst; action not ready', char_index: 0 },
  { event: 'sim', frame: 100, msg: 'could not execute burst; action not ready', char_index: 0 },
  { event: 'sim', frame: 101, msg: 'could not execute burst; action not ready', char_index: 0 },
], 1);
check(dup.energyWaits[0] === 1 && dup.energyWaitFrames[0] === 2, '爆発のエネルギー待ちの時間: 同じフレームの重複ログは 1 フレームと数える（2 フレーム）');
// 平均は、全実行を合算して割る（実行ごとの平均の平均にしない）。待ちが 1 回も無ければ null
const waitAgg = dps.aggregateDps([
  { total: 10, seconds: 5, byChar: [10, 0], energyWaits: [1, 0], energyWaitFrames: [60, 0] },
  { total: 10, seconds: 5, byChar: [10, 0], energyWaits: [3, 0], energyWaitFrames: [30, 0] },
], 2);
check(Math.abs(waitAgg.byChar[0].energyWaitSeconds - 0.375) < 1e-9 && waitAgg.byChar[1].energyWaitSeconds === null && Math.abs(waitAgg.energyWaitSeconds - 0.375) < 1e-9, '平均の待ち時間: 全実行の合計 90 フレーム ÷ 60 ÷ 4 回 = 0.375 秒（実行ごとの平均の平均 0.583 ではない）。待ちが無いキャラは null');
check(dps.aggregateDps([{ total: 10, seconds: 5, byChar: [10, 0] }], 2).energyWaitSeconds === null, '平均の待ち時間: 待ちの記録が無い実行だけなら null');
const agg = dps.aggregateDps([{ total: 300, seconds: 3, byChar: [200, 100] }, { total: 500, seconds: 5, byChar: [400, 100] }], 2);
check(agg.dps.mean === 100 && agg.dps.sd === 0 && agg.runs === 2 && Math.abs(agg.byChar[0].share - 0.75) < 1e-9, '統計: DPS 平均・標準偏差・割合');
// 周数の打ち切り（M-3）: 設定文の print("loop ", i) の数を数え、設定の周数より少ない実行を知らせる
const lp = dps.summarizeDamage([{ event: 'user', frame: 1, msg: 'loop 1' }, { event: 'user', frame: 400, msg: 'loop 2' }, { event: 'user', frame: 500, msg: 'loop x' }, { event: 'damage', frame: 600, msg: 'a', char_index: 0, logs: { damage: 10 } }], 2);
check(lp.loopsStarted === 2, '周数: print の「loop N」だけ数える（始まった周数 2）');
const mk = (loopsStarted: number) => ({ total: 10, seconds: 5, byChar: [10, 0], energyWaits: [0, 0], energyWaitFrames: [0, 0], loopsStarted });
const cut = dps.aggregateDps([mk(3), mk(5), mk(4)], 2, 5);
check(cut.truncated?.count === 2 && cut.truncated?.worst === 3, '周数: 設定（5 周）より少ない実行の数（2 回）と、最も短い周数（3 周）');
check(dps.aggregateDps([mk(5), mk(5)], 2, 5).truncated === undefined && dps.aggregateDps([mk(1)], 2).truncated === undefined, '周数: すべて終わっている・周数を渡さないときは、知らせない');

// 2b. 幽境モード（段階 4）: 戦闘時間での打ち切りと、敵の状態の時間帯の補正
check(Math.abs(es.resistMultiplier(0.1) - 0.9) < 1e-12 && Math.abs(es.resistMultiplier(-0.2) - 1.1) < 1e-12 && Math.abs(es.resistMultiplier(0.8) - 1 / 4.2) < 1e-12 && Math.abs(es.resistMultiplier(0) - 1) < 1e-12, '耐性の倍率: 10% → 0.9・−20% → 1.1・80% → 1/4.2（ゲームと同じ式）');
const sw = es.sanitizeEnemyStates([
  { fromSeconds: 50, toSeconds: 60, kind: 'invulnerable' },
  { fromSeconds: 10, toSeconds: 20, kind: 'resist', resist: { pyro: 0.7, hydro: 'x', foo: 1 } },
  { fromSeconds: 30, toSeconds: 30, kind: 'invulnerable' },
  { fromSeconds: 30, toSeconds: 20, kind: 'invulnerable' },
  { fromSeconds: 5, toSeconds: 9, kind: 'resist', resist: {} },
  { fromSeconds: 'a', toSeconds: 9, kind: 'invulnerable' },
  { fromSeconds: 0, toSeconds: 9, kind: 'unknown' },
  null,
]);
check(sw.length === 2 && sw[0].kind === 'resist' && sw[0].fromSeconds === 10 && sw[0].resist.pyro === 0.7 && Object.keys(sw[0].resist).length === 1 && sw[1].kind === 'invulnerable' && sw[1].fromSeconds === 50, '時間帯の検査: 終了が開始以前・耐性が空・種類が不明・数でないものは捨て、開始の早い順にそろえる');
check(es.sanitizeEnemyStates('x').length === 0 && es.sanitizeEnemyStates(Array.from({ length: 30 }, (_, i) => ({ fromSeconds: i, toSeconds: i + 1, kind: 'invulnerable' }))).length === es.ENEMY_STATE_MAX, '時間帯の検査: 配列でなければ空・件数の上限');
const dmg = (frame: number, damage: number, ele: string, target = 1, char_index = 0) => ({ event: 'damage', frame, msg: 'x', char_index, logs: { damage, ele, target } });
const base = [dmg(60, 100, 'pyro'), dmg(1200, 100, 'pyro'), dmg(1300, 100, 'hydro'), dmg(3700, 100, 'pyro')];
const none = dps.summarizeDamage(base, 1);
check(none.total === 400 && none.stateAdjust === 0 && none.short === false, '補正なし: 合計も補正量も従来どおり（400・0）');
const wins = es.sanitizeEnemyStates([
  { fromSeconds: 10, toSeconds: 15, kind: 'invulnerable' },
  { fromSeconds: 20, toSeconds: 30, kind: 'resist', resist: { pyro: 0.7 } },
]);
const adj = dps.summarizeDamage(base, 1, { enemyStates: wins, enemies: [DEFAULT_ENEMY] });
// 60f(1 秒): 時間帯の外 → 100。1200f(20 秒): 炎の耐性 70% → 100 × 0.3 / 0.9。1300f(21.7 秒): 水は指定なし → 100。3700f(61.7 秒): 時間帯の外 → 100
const expectedAdj = 100 + 100 * 0.3 / 0.9 + 100 + 100;
check(Math.abs(adj.total - expectedAdj) < 1e-9 && Math.abs(adj.stateAdjust - (expectedAdj - 400)) < 1e-9, `耐性の変化: 炎だけ（変化後 70%・元 10%）→ ダメージ × 0.3 ÷ 0.9。ほかの元素・時間帯の外は変えない（合計 ${adj.total.toFixed(2)}）`);
const inv = dps.summarizeDamage([dmg(600, 100, 'pyro'), dmg(899, 50, 'pyro'), dmg(900, 25, 'pyro'), dmg(1000, 10, 'geo', 1, 1)], 2, { enemyStates: es.sanitizeEnemyStates([{ fromSeconds: 10, toSeconds: 15, kind: 'invulnerable' }]), enemies: [DEFAULT_ENEMY] });
check(inv.total === 35 && inv.byChar[0] === 25 && inv.byChar[1] === 10 && inv.stateAdjust === -150, 'ダメージ無効: 開始以上（10 秒 = 600f・899f）のダメージが 0、終了（15 秒 = 900f）以降は数える。キャラ別も同じ。補正量 −150');
const both = dps.summarizeDamage([dmg(630, 100, 'pyro')], 1, { enemyStates: es.sanitizeEnemyStates([{ fromSeconds: 10, toSeconds: 20, kind: 'resist', resist: { pyro: 0.7 } }, { fromSeconds: 10, toSeconds: 20, kind: 'invulnerable' }]), enemies: [DEFAULT_ENEMY] });
check(both.total === 0, '時間帯が重なる: ダメージ無効が、耐性の変化より優先');
const tg = dps.summarizeDamage([dmg(630, 100, 'pyro', 2)], 1, { enemyStates: es.sanitizeEnemyStates([{ fromSeconds: 10, toSeconds: 20, kind: 'resist', resist: { pyro: 0.7 } }]), enemies: [DEFAULT_ENEMY, { level: 100, resist: { ...DEFAULT_ENEMY.resist, pyro: -0.2 } }] });
check(Math.abs(tg.total - 100 * 0.3 / 1.1) < 1e-9, '敵が複数: ログの target（1 始まり）の敵の元の耐性（−20%）で補正する');
const unk = dps.summarizeDamage([{ event: 'damage', frame: 630, msg: 'x', char_index: 0, logs: { damage: 100 } }], 1, { enemyStates: es.sanitizeEnemyStates([{ fromSeconds: 10, toSeconds: 20, kind: 'resist', resist: { pyro: 0.7 } }]), enemies: [DEFAULT_ENEMY] });
check(unk.total === 100, '元素のログが無いダメージは、耐性の変化の補正をしない');
// 戦闘時間: それより後のダメージ・爆発待ちは数えない。時間 = 戦闘時間（終わるのが早ければ、終わった時刻）
const cutLogs = [dmg(60, 100, 'pyro'), dmg(1800, 100, 'pyro'), dmg(1801, 100, 'pyro'), { event: 'action', frame: 2400, msg: 'executed attack', char_index: 0 }, { event: 'sim', frame: 2000, msg: 'could not execute burst; action not ready', char_index: 0 }];
const bc = dps.summarizeDamage(cutLogs, 1, { battleSeconds: 30 });
check(bc.total === 200 && bc.seconds === 30 && bc.short === false && bc.energyWaits[0] === 0, '戦闘時間 30 秒: 1800f までのダメージだけ数える。時間は 30 秒。戦闘後の爆発待ちは数えない');
const sh = dps.summarizeDamage([dmg(60, 100, 'pyro'), dmg(600, 100, 'pyro')], 1, { battleSeconds: 30 });
check(sh.short === true && sh.seconds === 10 && sh.total === 200, '戦闘時間より早く終わった実行: 終わった時刻（10 秒）で計算し、short = true');
const aggShort = dps.aggregateDps([{ ...mk(1), stateAdjust: -10, short: true }, { ...mk(1), stateAdjust: -30, short: false }], 2);
check(aggShort.shortRuns === 1 && aggShort.stateAdjust === -20 && dps.aggregateDps([mk(1)], 2).shortRuns === undefined, '集計: 戦闘時間に届かなかった実行の数と、補正量の平均（未指定なら無し・0）');

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
  // 幽境モード（段階 4）: 戦闘時間から周数を決め、開始エネルギー 0・時刻指定の粒子で回す。ダメージ無効の時間帯は、同じログを補正するだけ
  const abyssCfg = buildGcsimConfig({ characters: chars, stints, loopStartIndex: 0, switchDelay: 0.5, defHalt: true, weapons: [wB, wX], artifacts: [], ignoreBurstEnergy: false, startEnergyZero: true, battleSeconds: 40, enemyParticles: { minSeconds: 1, maxSeconds: 2, amount: 10 } }); // 粒子を多くして、0 スタートでも爆発が撃てる（この確認は、爆発が撃てることが目的ではない）
  check(Number.isInteger(abyssCfg.loopIterations) && abyssCfg.loopIterations >= 2, `設定文の結果に、周数（loopIterations）が入る（戦闘 40 秒 → ${abyssCfg.loopIterations} 周）`);
  check(abyssCfg.config.includes('start_energy=0') && abyssCfg.config.includes('energy every interval=60,120 amount=10;') && abyssCfg.config.includes(`while i <= ${abyssCfg.loopIterations} {`), '幽境モードの設定文: 開始エネルギー 0・敵の周期の粒子・自動の周数');
  // gcsim の粒子の設定（energy の行）は、最後の 1 行しか使われない（D369）。この制限が変わったら（gcsim を更新したときなど）、ここが落ちるので、画面の制限の知らせ（particleLimits）を見直す
  const withEnergyLines = (lines: string[]) => abyssCfg.config.split('\n').filter(l => !l.startsWith('energy ')).join('\n').replace('active bennett;', [...lines, 'active bennett;'].join('\n'));
  const enemyDrops = async (lines: string[]) => {
    const r = await runGcsimSample(withEnergyLines(lines), 1);
    if (r.status !== 'ok') return `error: ${r.message}`;
    const frames = [...new Set(r.logs.filter((x: any) => x.event === 'energy' && x.msg === 'particle' && x.logs?.is_active && x.logs?.source !== 'bennett' && x.logs?.source !== 'xiangling').map((x: any) => x.frame))];
    return frames.length > 3 ? 'every' : frames.join(',');
  };
  const O1 = 'energy once interval=120 amount=3;';
  const O2 = 'energy once interval=600 amount=2;';
  const EV = 'energy every interval=300,480 amount=1;';
  check(await enemyDrops([O1]) === '121' && await enemyDrops([O1, O2]) === '601' && await enemyDrops([EV, O1]) === '121' && await enemyDrops([O1, EV]) === 'every', 'gcsim の粒子の設定は、最後の 1 行だけ有効（once 2 行 → 後ろだけ。every と once → 後ろだけ）');
  const bc = (timed: { seconds: number; amount: number }[], amount = 1, maxSeconds = 8) => ({ timedParticles: timed, enemyParticles: { minSeconds: 5, maxSeconds, amount } });
  const lim0 = battle.particleLimits(bc([]));
  const lim1 = battle.particleLimits(bc([{ seconds: 30, amount: 3 }]));
  const lim3 = battle.particleLimits(bc([{ seconds: 60, amount: 3 }, { seconds: 10, amount: 1 }, { seconds: 30, amount: 2 }]));
  check(lim0.ignoredTimed === 0 && !lim0.periodicIgnored && lim1.ignoredTimed === 0 && lim1.periodicIgnored && lim1.usedTimedSeconds === 30 && lim3.ignoredTimed === 2 && lim3.usedTimedSeconds === 60, '粒子の制限の判定: 時刻指定なし → 制限なし。1 件 → 周期の粒子が効かない。3 件 → いちばん遅い 1 件（60 秒）だけが効き、2 件が無視される');
  check(!battle.particleLimits(bc([{ seconds: 30, amount: 3 }], 0)).periodicIgnored && !battle.particleLimits(bc([{ seconds: 30, amount: 3 }], 1, 0)).periodicIgnored, '粒子の制限の判定: 敵の周期の粒子が個数 0・間隔の最大 0（出さない設定）なら、効かないものは無い');
  check(c2.loopIterations === 2 && c5.loopIterations === 5, '通常モードの周数: 指定した周数のまま（結果にも入る）');
  const ctx = { battleSeconds: 40, enemies: [DEFAULT_ENEMY] };
  const plain = await dps.computeDps({ config: abyssCfg, runs: 4, parallel: 4, run: runGcsimSample, context: ctx });
  const stateWins = es.sanitizeEnemyStates([{ fromSeconds: 5, toSeconds: 15, kind: 'invulnerable' }, { fromSeconds: 20, toSeconds: 30, kind: 'resist', resist: { pyro: 0.7 } }]);
  const withWin = await dps.computeDps({ config: abyssCfg, runs: 4, parallel: 4, run: runGcsimSample, context: { ...ctx, enemyStates: stateWins } });
  check(plain.status === 'ok' && withWin.status === 'ok', '幽境モードの設定文が実行できる');
  if (plain.status === 'ok' && withWin.status === 'ok') {
    const p = plain.result;
    const w = withWin.result;
    console.log(`  幽境 40 秒: DPS ${p.dps.mean.toFixed(0)}（時間 ${p.seconds.toFixed(1)} 秒）→ 時間帯あり ${w.dps.mean.toFixed(0)}（補正 ${w.stateAdjust.toFixed(0)}）`);
    check(p.stateAdjust === 0 && w.stateAdjust < 0, '時間帯なしは補正 0・ダメージ無効と耐性変化ありは、ダメージが減る');
    check(Math.abs(w.total.mean - (p.total.mean + w.stateAdjust)) < 1e-6 * p.total.mean, '補正後の総ダメージ = 補正前の総ダメージ + 補正量（同じ種・同じログから補正するだけ）');
    check(p.seconds <= 40 + 1e-9 && p.total.mean > 0 && p.runs === 4, '戦闘時間 40 秒までで数える（時間が 40 秒を超えない）');
  }
  const seen: { done: number; mean?: number }[] = [];
  await dps.computeDps({ config: c2, runs: 4, parallel: 2, run: runGcsimSample, onProgress: (pr: any) => seen.push({ done: pr.done, mean: pr.partial?.dps.mean }) });
  check(seen.length === 3 && seen[0].mean === undefined && seen[1].done === 2 && (seen[1].mean ?? 0) > 0 && seen[2].done === 4, '途中経過: 実行を終えるごとに、ここまでの平均 DPS が渡る');
}
await server.close();
if (failed) { console.error(`\n${failed} 件失敗`); process.exit(1); }
console.log('\nすべて合格');
