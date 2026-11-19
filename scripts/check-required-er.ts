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

// ER の時系列の補正（D371）: 時刻指定の粒子の書き足しと、ダメージ無効の間の補正（合成）
const adj = await server.ssrLoadModule('/src/utils/gcsim/erAdjust.ts');
{
  const T = (seconds: number, amount: number) => ({ seconds, amount });
  const sp = (timed: any[], periodic: boolean) => adj.splitTimedParticles(timed, periodic);
  check(sp([], true).toGcsim.length === 0 && sp([], true).injected.length === 0, '粒子の振り分け: 時刻指定の粒子が無ければ、どちらにも無い');
  check(sp([T(30, 3)], false).toGcsim.length === 1 && sp([T(30, 3)], false).injected.length === 0, '粒子の振り分け: 周期の粒子が無く、時刻指定が 1 件なら、gcsim に渡す（書き足さない）');
  check(sp([T(30, 3)], true).toGcsim.length === 0 && sp([T(30, 3)], true).injected.length === 1, '粒子の振り分け: 周期の粒子と併用なら、時刻指定は書き足す（gcsim には周期の粒子だけ）');
  check(sp([T(30, 3), T(60, 3)], false).toGcsim.length === 0 && sp([T(30, 3), T(60, 3)], false).injected.length === 2, '粒子の振り分け: 時刻指定が 2 件以上なら、全部書き足す');
  check(adj.periodicParticlesOn({ amount: 1, maxSeconds: 8 }) && !adj.periodicParticlesOn({ amount: 0, maxSeconds: 8 }) && !adj.periodicParticlesOn({ amount: 1, maxSeconds: 0 }) && !adj.periodicParticlesOn(undefined), '周期の粒子が有効か: 個数・間隔が有効なときだけ');
  check(['favonius-bennett', 'dehya', 'albedo-c1', 'klee-a4', 'rosaria-c4', 'crane', 'moonglow', 'nagamasa', 'kitain', 'lumidouceelegy-energy', 'travelercryo-c1', 'mika-c4'].every(s => adj.isDamageConditionalSource(s))
    && ['enemy', 'drop', 'xingqiu', 'bennett', 'na-ca-on-hit', 'raiden-burst', 'skirk', undefined].every(s => !adj.isDamageConditionalSource(s)), 'ダメージが条件の発生源: 確認した発生源だけが対象（敵・スキルの粒子・通常攻撃のエネルギー・命中の固定エネルギー・スカークは対象外）');
  const swapLog = (frame: number, idx: number) => ({ event: 'action', frame, char_index: idx, msg: 'executed swap', logs: {} });
  const swapLogs = [swapLog(100, 1)];
  check(adj.activeCharAt(adj.readSwaps(swapLogs), 0, 99) === 0 && adj.activeCharAt(adj.readSwaps(swapLogs), 0, 100) === 1 && adj.activeCharAt([], 2, 500) === 2, '出場キャラ: 交代のログから、そのフレームの出場キャラを求める（交代が無ければ最初のキャラ）');
  const mk = () => new Map<number, any>([
    [0, { max: 80, events: [{ kind: 'burst', cost: 80, frame: 50, exec: 50 }, { kind: 'particle', raw: 4, frame: 120, source: 'xingqiu' }] }],
    [1, { max: 60, events: [{ kind: 'burst', cost: 60, frame: 70, exec: 70 }] }],
  ]);
  const orig = mk();
  const inj = adj.adjustTimelines(orig, swapLogs, { injected: [T(1, 3), T(3, 2)], invulnerable: [], partyCount: 4, firstActive: 0 });
  const e0 = inj.get(0).events;
  const e1 = inj.get(1).events;
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  check(e0.map((e: any) => e.frame).join() === '50,61,120,181' && near(e0[1].raw, 6) && near(e0[3].raw, 2 * 2 * 0.6), '粒子の書き足し: 出場中は満額（2 × 個数）、控えは 1 − 0.1 × 人数（0.6）を掛け、フレームは interval の次（61・181）で、順に並ぶ（キャラ 0）');
  check(e1.map((e: any) => e.frame).join() === '61,70,181' && near(e1[0].raw, 2 * 3 * 0.6) && near(e1[2].raw, 2 * 2), '粒子の書き足し: 交代のあとは、出場キャラが入れ替わる（キャラ 1 は、61 で控え・181 で出場中）');
  check(orig.get(0).events.length === 2 && orig.get(1).events.length === 1, '粒子の書き足し: 元の時系列は変えない');
  // ダメージ無効の間の補正: 窓 [2 秒, 4 秒) = フレーム [120, 240)
  const src = new Map<number, any>([[0, { max: 80, events: [
    { kind: 'particle', raw: 6, frame: 150, source: 'favonius-bennett' }, // 窓の中 → 取り除く
    { kind: 'particle', raw: 2, frame: 150, source: 'xingqiu' }, // スキルの粒子 → 残す
    { kind: 'particle', raw: 6, frame: 300, source: 'favonius-bennett' }, // 窓の外 → 残す
    { kind: 'flat', amount: -3, frame: 130, source: 'nagamasa' }, // 窓の中: スキルのダメージ → これと、そのあとの回復 3 回を取り除く
    { kind: 'flat', amount: 3, frame: 250, source: 'nagamasa' },
    { kind: 'flat', amount: 3, frame: 370, source: 'nagamasa' },
    { kind: 'flat', amount: 3, frame: 490, source: 'nagamasa' },
    { kind: 'flat', amount: -3, frame: 600, source: 'nagamasa' }, // 窓の外 → 残す（そのあとの回復も残す）
    { kind: 'flat', amount: 3, frame: 720, source: 'nagamasa' },
    { kind: 'flat', amount: 1.2, frame: 160, source: 'albedo-c1' }, // 窓の中 → 取り除く
    { kind: 'flat', amount: 5, frame: 170, source: 'raiden-burst' }, // 命中の固定エネルギー → 残す
    { kind: 'flat', amount: 1, frame: 180, source: 'na-ca-on-hit' }, // 通常攻撃のエネルギー → 残す
  ] }]]);
  const dropped = adj.adjustTimelines(src, [], { injected: [], invulnerable: [{ fromSeconds: 2, toSeconds: 4 }], partyCount: 4, firstActive: 0 });
  const keptNames = dropped.get(0).events.map((e: any) => `${e.source}@${e.frame}`).sort().join();
  const wantNames = ['xingqiu@150', 'favonius-bennett@300', 'raiden-burst@170', 'na-ca-on-hit@180', 'nagamasa@600', 'nagamasa@720'].sort().join();
  check(keptNames === wantNames, `無効の間の補正: 窓の中のダメージが条件の発生源（西風・アルベド C1・桂木斬長正と、その回復）だけを取り除く（残り ${keptNames}）`);
  check(adj.adjustTimelines(src, [], { injected: [], invulnerable: [], partyCount: 4, firstActive: 0 }).get(0).events.length === 12, '無効の間の補正: 時間帯が無ければ、何も取り除かない');
  check(!adj.needsAdjust([], undefined) && !adj.needsAdjust([], []) && adj.needsAdjust([T(1, 1)], []) && adj.needsAdjust([], [{ fromSeconds: 1, toSeconds: 2 }]), '補正が要るか: 書き足す粒子か、無効の時間帯があるときだけ');
  // 書き足した粒子で、必要な ER が下がる（爆発 60・粒子 12 → 500%。書き足し 6（ER 100% 換算）で 18 → 333.3%。探索の上限は 700%）
  const base1 = new Map<number, any>([[0, { max: 60, events: [{ kind: 'burst', cost: 60, frame: 10, exec: 10 }, { kind: 'particle', raw: 12, frame: 100, source: 'x' }, { kind: 'burst', cost: 60, frame: 200, exec: 200 }] }]]);
  const without = er.requiredErForRate([base1.get(0)], 1);
  const withInj = er.requiredErForRate([adj.adjustTimelines(base1, [], { injected: [T(1, 3)], invulnerable: [], partyCount: 4, firstActive: 0 }).get(0)], 1);
  check(Math.abs(without - 500) < 0.2 && Math.abs(withInj - 333.4) < 0.2, `粒子の書き足し: 必要な ER に反映される（書き足し前 ${without}% → 後 ${withInj}%）`);
}

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
// 幽境モードの算出（開始エネルギー 0・時刻指定の粒子・戦闘時間）。実際の画面と同じ関数を通す。
// 幽境の想定の形: 初動（1 周目だけ）はスキルだけで爆発のエネルギーを貯め、ループ基準点の後（ループ）で爆発を撃つ。
// ループは、CT を守る回し方（香菱の後に 8 秒の待機）。最初の爆発の待ちは 0.5 秒（既定）
const abyssStints = [
  { id: 'o0', characterId: chars[0].id, actions: [makeAction(chars[0], 'e')] }, // 初動: ベネット E
  // 初動: 香菱 E → 30 秒待つ（敵・時刻指定の粒子が貯まるのを待つ。短いと、ベネットの爆発（60）に、ER +500% でも届かない）
  { id: 'o1', characterId: chars[1].id, actions: [makeAction(chars[1], 'e'), { id: 'w0', actionTypeId: 'wait', name: 'w', shortName: 'w', type: 'wait', duration: 30 }] },
  { id: 'l0', characterId: chars[0].id, actions: ['e', 'q'].map(s => makeAction(chars[0], s)) }, // ループ: ベネット E → Q
  { id: 'l1', characterId: chars[1].id, actions: [...['e', 'q'].map(s => makeAction(chars[1], s)), { id: 'w1', actionTypeId: 'wait', name: 'w', shortName: 'w', type: 'wait', duration: 8 }] }, // ループ: 香菱 E → Q → 待機
];
const ABYSS_LOOP_START = 2;
const abyssCond = { loops: 3, firstBurstWaitSeconds: er.ABYSS_DEFAULT_FIRST_BURST_WAIT_SECONDS, timedParticles: [{ seconds: 20, amount: 3 }] };
const enemyP = { minSeconds: 5, maxSeconds: 8, amount: 1 };
const buildAbyss = (extra: any) => buildGcsimConfig({
  characters: chars, stints: abyssStints, loopStartIndex: ABYSS_LOOP_START, switchDelay: 0.5, defHalt: true, weapons: [wB, wX], artifacts: [],
  ignoreBurstEnergy: extra.ignoreBurstEnergy, addedEnergyRechargeByCharacterId: extra.added, loopIterations: er.ER_LOOP_ITERATIONS, tightDuration: true, enemyParticles: extra.enemyParticles,
  ...(extra.abyss ? { startEnergyZero: true, timedParticles: extra.abyss.timedParticles, loopIterations: extra.abyss.loops } : {}),
});
// 検証ありの算出は、gcsim が正確に扱える粒子（敵の周期の粒子なし・時刻指定が 1 件）で行う。周期の粒子との併用・2 件以上は、アプリが書き足すので、検証はしない（下で別に確認）
const abyssOutcome = await er.computeRequiredEr({ build: buildAbyss, abyss: abyssCond, enemyParticles: undefined, run: runGcsimSample, gcsimVersion: 'check', verify: true, verifyTolerance: er.ER_VERIFY_TOLERANCE_ROUGH, seeds: 8 });
if (abyssOutcome.status !== 'ok') {
  console.log(`✗ 幽境モードの算出が成功しなかった: ${abyssOutcome.status} ${abyssOutcome.message ?? ''}`);
  failed++;
} else {
  const ar = abyssOutcome.result;
  check(ar.entries.length === 2 && ar.abyss?.loops === 3 && ar.entries.every((e: any) => e.status === 'ok'), `幽境: 算出が成功し、結果に戦闘条件が残る（${ar.seeds} 種・窓 ${ar.windows}）`);
  for (const e of ar.entries) console.log(`  [幽境] ${e.name}: ${e.status} ${e.status === 'ok' ? `目安 ${e.typicalEr}% / 安定 ${e.stableEr}% / 確実 ${e.certainEr}%（足す ${e.addedEr}）` : ''}`);
  for (const e of ar.entries.filter((x: any) => x.status === 'ok')) check(e.typicalEr <= e.stableEr && e.stableEr <= e.certainEr, `[幽境] ${e.name}: 目安 ≤ 安定 ≤ 確実`);
  const firstDelay = Math.round(abyssCond.firstBurstWaitSeconds * 60);
  const abBase = (seed: number) => runGcsimSample(buildAbyss({ ignoreBurstEnergy: true, added: {}, enemyParticles: undefined, abyss: abyssCond }).config, seed).then((r: any) => er.burstSignature(r.logs));
  const abSig = async (id: string, x: number, seed: number) => {
    const added = { ...Object.fromEntries(chars.map(c => [c.id, er.ER_MAX_ADDED])), [id]: x };
    return er.burstSignature((await runGcsimSample(buildAbyss({ ignoreBurstEnergy: false, added, enemyParticles: undefined, abyss: abyssCond }).config, seed)).logs);
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
// 粒子の書き足し・無効の間の補正（D371）: 実機の実行。いずれも、計算のみ（検証なし）になり、結果に補正の記録が残る
{
  const calc = (abyss: any, enemyParticles: any) => er.computeRequiredEr({ build: buildAbyss, abyss, enemyParticles, run: runGcsimSample, gcsimVersion: 'check', verify: false, seeds: 8 });
  const certainOf = (o: any) => o.result.entries.map((e: any) => (e.status === 'ok' ? e.certainEr : e.status));
  const two = { ...abyssCond, timedParticles: [{ seconds: 10, amount: 3 }, { seconds: 50, amount: 3 }] };
  const none = { ...abyssCond, timedParticles: [] as any[] };
  const oTwo = await calc(two, undefined);
  const oNone = await calc(none, undefined);
  const oPlain = await calc({ ...none, invulnerable: [{ fromSeconds: 20, toSeconds: 40 }] }, undefined);
  const oMix = await calc(abyssCond, enemyP);
  if ([oTwo, oNone, oPlain, oMix].some(o => o.status !== 'ok')) {
    console.log(`✗ 書き足しの算出が成功しなかった: ${[oTwo, oNone, oPlain, oMix].map(o => o.status).join(' / ')}`);
    failed++;
  } else {
    check(oTwo.result.adjusted?.timedInjected === 2 && oTwo.result.verified === false && oTwo.result.abyss?.timedParticles.length === 2, `粒子の書き足し（2 件）: 結果に書き足した件数が残り、検証はしない（検証 ${oTwo.result.verified}）`);
    check(oMix.result.adjusted?.timedInjected === 1 && oMix.result.verified === false, '粒子の書き足し（周期の粒子と併用）: 1 件を書き足し、検証はしない');
    check(oNone.result.adjusted === undefined, '粒子の書き足し: 時刻指定の粒子が無ければ、補正の記録は残らない');
    const higher = oNone.result.entries.every((e: any, i: number) => e.status !== 'ok' || oTwo.result.entries[i].status !== 'ok' || oTwo.result.entries[i].certainEr <= e.certainEr + 1e-9);
    check(higher, `粒子の書き足し: 粒子が増えると、必要な ER は上がらない（書き足しなし ${certainOf(oNone).join('/')} → 2 件 ${certainOf(oTwo).join('/')}）`);
    check(oPlain.result.adjusted?.invulnerableWindows === 1 && oPlain.result.verified === false, '無効の間の補正: 時間帯があると、補正の記録が残り、検証はしない');
    const sameVals = oPlain.result.entries.every((e: any, i: number) => e.status === oNone.result.entries[i].status && e.certainEr === oNone.result.entries[i].certainEr);
    check(sameVals, `無効の間の補正: ダメージが条件の発生源が無い編成（ベネット + 香菱）では、時間帯を入れても値が変わらない（${certainOf(oPlain).join('/')} = ${certainOf(oNone).join('/')}）`);
  }
}
// 爆発のタイミングの確認（フェーズ8 段階 2）。まず、並びの比較（合成）
const bt = await server.ssrLoadModule('/src/utils/gcsim/burstTiming.ts');
{
  const d = bt.burstDelays('0@100,1@200,0@1100,1@1300', '0@100,1@260,0@1190', Infinity);
  check(d.get(0)?.map((x: any) => `${x.planned}:${x.delay}`).join() === '100:0,1100:90' && d.get(1)?.map((x: any) => `${x.planned}:${x.delay}`).join() === '200:60,1300:null', '爆発のタイミング: 計画との差（フレーム）と、撃てなかった爆発（null）を求める');
  const lim = bt.burstDelays('0@100,0@1100,0@2100', '0@100,0@1100,0@2100', 1200);
  check(lim.get(0)?.length === 2, '爆発のタイミング: 戦闘時間（上限のフレーム）を超えて計画された爆発は数えない');
  const sum = bt.summarizeBurstTiming([lim, bt.burstDelays('0@100,0@1100', '0@130,0@1100', 1200), bt.burstDelays('0@100,0@1100', '0@100', 1200)], [{ characterId: 'x', name: 'X' }]);
  const b0 = sum[0].bursts[0];
  const b1 = sum[0].bursts[1];
  check(sum.length === 1 && b0.total === 3 && b0.onTime === 3 && b0.delayMaxSeconds === 0.5 && b1.total === 3 && b1.missed === 1 && b1.onTime === 2, '爆発のタイミング: 種ごとの結果を、爆発の順ごとにまとめる（計画どおりの数・撃てなかった数・最大の遅れ）');
  // 爆発のエネルギー待ち（ループの分だけ・1 周あたり・平均の待ち時間）
  const wl = (frame: number, extra: Record<string, unknown> = {}) => ({ event: 'sim', msg: 'could not execute burst; action not ready', frame, char_index: 0, ...extra });
  const waitLogs = [
    { event: 'user', msg: 'loop 1', frame: 100, char_index: -1 },
    ...Array.from({ length: 10 }, (_, k) => wl(200 + k)), // ループの中: 10 フレーム待ち（CT は明けている）
  ];
  const earlyLogs = [...Array.from({ length: 5 }, (_, k) => wl(50 + k)), ...waitLogs]; // 初動の待ちは数えない
  const ew = bt.summarizeEnergyWaits([{ logs: earlyLogs }, { logs: waitLogs }], [{ characterId: 'x', name: 'X' }, { characterId: 'y', name: 'Y' }], 2);
  check(Math.abs(ew.total.perLoop - 0.5) < 1e-9 && Math.abs((ew.total.avgSeconds ?? -1) - 10 / 60) < 1e-9 && ew.waits[1].perLoop === 0 && ew.waits[1].avgSeconds === null, '爆発のエネルギー待ち: 初動の分は数えず、ループ 1 周あたりの回数と、1 回あたりの平均の待ち時間を求める');
}
// 実機の実行: ベネット + 香菱の幽境の形で、ER を足さないと遅れ・撃てない爆発が出て、十分に足すと、全て計画どおりになる
{
  const allMax = Object.fromEntries(chars.map(c => [c.id, er.ER_MAX_ADDED]));
  const timingOf = (added: Record<string, number>) => bt.computeBurstTiming({ build: buildAbyss, enemyParticles: enemyP, abyss: abyssCond, loops: abyssCond.loops, added, seeds: 4, run: runGcsimSample });
  const low = await timingOf({});
  const high = await timingOf(allMax);
  if (low.status !== 'ok' || high.status !== 'ok') {
    console.log(`✗ 爆発のタイミングが求まらなかった: ${low.status} ${low.message ?? ''} / ${high.status} ${high.message ?? ''}`);
    failed++;
  } else {
    const bursts = (r: any) => r.result.entries.flatMap((e: any) => e.bursts);
    for (const e of low.result.entries) console.log(`  [タイミング・ER 足さず] ${e.name}: ${e.bursts.map((x: any) => `${x.n}回目 計画 ${x.plannedSeconds.toFixed(1)}s 遅れ ${x.delayMaxSeconds === null ? '撃てず' : x.delayMaxSeconds.toFixed(1)}`).join(' / ')}`);
    check(low.result.entries.length === 2 && bursts(low).length > 0 && bursts(low).every((x: any) => x.total === 4), `爆発のタイミング: 2 キャラ分の結果が、種の数（4）で求まる（爆発 ${bursts(low).length} 件）`);
    check(bursts(low).some((x: any) => x.onTime < x.total), '爆発のタイミング: ER を足さないと、計画どおりに撃てない爆発がある');
    check(low.result.loops === abyssCond.loops && low.result.waitsTotal.perLoop >= high.result.waitsTotal.perLoop && low.result.waits.length === 2, `爆発のエネルギー待ち: 周数が結果に残り、ER を足さないほうが待ちが多い（足さず ${low.result.waitsTotal.perLoop.toFixed(2)} 回/周・平均 ${low.result.waitsTotal.avgSeconds?.toFixed(2) ?? '-'} 秒 / +${er.ER_MAX_ADDED * 100}% で ${high.result.waitsTotal.perLoop.toFixed(2)} 回/周）`);
    check(bursts(high).every((x: any) => x.missed === 0 && x.delayMaxSeconds !== null && x.delayMaxSeconds <= abyssCond.firstBurstWaitSeconds), `爆発のタイミング: ER を十分に足すと（+${er.ER_MAX_ADDED * 100}%）、全ての爆発が計画どおり（遅れ ${abyssCond.firstBurstWaitSeconds} 秒以内）`);
  }
}
await server.close();
console.log(failed === 0 ? '\n合格' : `\n${failed} 件が不合格`);
process.exit(failed === 0 ? 0 : 1);
