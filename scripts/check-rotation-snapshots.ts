/**
 * ローテーションの計算結果のスナップショット（2026-10-08。特殊スキル・特殊爆発の受付をモードの定義に統一する作業の P0。ユーザー決定: リポジトリに残す）
 *
 * 決めた並び（オデット・ファルカ・フリンズ・ヴァレサの受付と CT、モードを持つキャラ）を、アプリの計算（calculateRotation）と
 * gcsim の設定文（buildGcsimConfig）で処理し、結果を scripts/snapshots/rotation.json と比べる。作り直しで動きが変わっていないことを確かめる。
 *
 *   npm run check:snapshots            … 保存した結果と比べる（差があれば、並びごとに差を出して終了コード 1）
 *   npm run check:snapshots -- --update … 今の結果で保存し直す（動きを意図して変えたときだけ）
 *
 * gcsim のサーバーは使わない（アプリの計算と、設定文の文字列だけ）。マスターは src/data/characters_master_data.json を使う。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const SNAPSHOT_FILE = path.join('scripts', 'snapshots', 'rotation.json');
const update = process.argv.includes('--update');

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { calculateRotation } = await server.ssrLoadModule('/src/utils/rotationCalculator.ts');
const { buildGcsimConfig } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');

const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const all: any[] = Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw);
const byName = (name: string, extra: Record<string, unknown> = {}) => {
  const c = all.find(x => x.name === name);
  if (!c) throw new Error(`キャラが見つかりません: ${name}`);
  return { ...structuredClone(c), ...extra };
};

/** 並びの書き方: アクション定義 ID の末尾（`e` / `q` / `n` / `ca` / `hp` / `e_recast` ...）、`w<秒>` = 待機。`<末尾>@<秒>` = 所要時間を編集（durationManual）、`<末尾>#<秒>` = gcsim から書き戻した所要時間（gcsimBaseDuration も付く） */
type Step = string;
interface Scenario { name: string; chars: [string, Record<string, unknown>?][]; stints: [number, Step[], Record<string, unknown>?][]; defHalt?: boolean; loopStartIndex?: number }

let seq = 0;
const makeAction = (char: any, step: Step) => {
  const id = `a${++seq}`;
  if (/^w[\d.]+$/.test(step)) return { id, actionTypeId: 'wait', name: '待機', shortName: 'W', type: 'wait', duration: Number(step.slice(1)) };
  const m = step.match(/^([\w]+)(?:([@#])([\d.]+))?$/);
  if (!m) throw new Error(`並びの書き方が違います: ${step}`);
  const def = char.availableActions.find((a: any) => a.id === `${char.id}_${m[1]}`);
  if (!def) throw new Error(`${char.name} にアクションがありません: ${m[1]}`);
  const base = { id, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration };
  if (m[2] === '@') return { ...base, duration: Number(m[3]), durationManual: true };
  if (m[2] === '#') return { ...base, duration: Number(m[3]), durationManual: true, gcsimBaseDuration: Number(m[3]) };
  return base;
};

const S = (name: string, chars: Scenario['chars'], stints: Scenario['stints'], opts: Partial<Scenario> = {}): Scenario => ({ name, chars, stints, ...opts });
const B: [string] = ['ベネット'];
const SCENARIOS: Scenario[] = [
  // --- オデット（受付: E 394f・Q 361f。spE 1 回で閉じる。通常攻撃のヒットストップで延びる） ---
  S('オデット E → spE', [['オデット'], B], [[0, ['e', 'e_recast']], [1, ['e']]]),
  S('オデット E → N N N → spE', [['オデット'], B], [[0, ['e', 'n', 'n', 'n', 'e_recast']], [1, ['e']]]),
  S('オデット E → 7 秒 → spE（受付の外）', [['オデット'], B], [[0, ['e', 'w7', 'e_recast']], [1, ['e']]]),
  S('オデット Q → spE（爆発の受付）', [['オデット'], B], [[0, ['q', 'e_recast']], [1, ['e']]]),
  S('オデット E → spE → spE（閉じた後）', [['オデット'], B], [[0, ['e', 'e_recast', 'e_recast']], [1, ['e']]]),
  S('オデット E → N×5（gcsim の所要時間）→ 5.5 秒 → spE（ヒットストップの延長）', [['オデット'], B], [[0, ['e', 'n#0.4', 'n#0.4', 'n#0.4', 'n#0.4', 'n#0.4', 'w4.4', 'e_recast']], [1, ['e']]]),
  S('オデット spE だけ（受付なし）', [['オデット'], B], [[0, ['e_recast']], [1, ['e']]]),
  S('オデット E → 交代 → オデット spE', [['オデット'], B], [[0, ['e']], [1, ['e']], [0, ['e_recast']]]),
  // --- ファルカ（受付: E の 39f 後から 12 秒。2 回分の CT。N で短縮。爆発で +2.3 秒。特殊重撃） ---
  S('ファルカ E → spE → spE', [['ファルカ'], B], [[0, ['e', 'e_specialskill', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ E → N×5 → spE → N×5 → spE → spE', [['ファルカ'], B], [[0, ['e', 'n', 'n', 'n', 'n', 'n', 'e_specialskill', 'n', 'n', 'n', 'n', 'n', 'e_specialskill', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ E → Q → N×5 → spE ×3', [['ファルカ'], B], [[0, ['e', 'q', 'n', 'n', 'n', 'n', 'n', 'e_specialskill', 'e_specialskill', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ E → 13 秒 → spE（受付の外）', [['ファルカ'], B], [[0, ['e', 'w13', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ E → N → CA → CA → spE（特殊重撃）', [['ファルカ'], B], [[0, ['e', 'n', 'ca', 'n', 'ca', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ E → N×5（gcsim の所要時間）→ 11 秒 → spE（ヒットストップの延長）', [['ファルカ'], B], [[0, ['e#0.9', 'n#0.5', 'n#0.5', 'n#0.5', 'n#0.5', 'n#0.5', 'w9.5', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ 同上（防御ヒットストップ無効）', [['ファルカ'], B], [[0, ['e#0.9', 'n#0.5', 'n#0.5', 'n#0.5', 'n#0.5', 'n#0.5', 'w9.5', 'e_specialskill']], [1, ['e']]], { defHalt: false }),
  S('ファルカ ヘクセレイ 2 人（フィッシュル）E → N×5 → spE → spE', [['ファルカ'], ['フィッシュル']], [[0, ['e', 'n', 'n', 'n', 'n', 'n', 'e_specialskill', 'e_specialskill']], [1, ['e']]]),
  S('ファルカ spE だけ（受付なし）', [['ファルカ'], B], [[0, ['e_specialskill']], [1, ['e']]]),
  S('ファルカ E → 交代 → ファルカ spE（交代で受付が消える）', [['ファルカ'], B], [[0, ['e']], [1, ['e']], [0, ['e_specialskill']]]),
  S('ファルカ E → E（状態の間の E）', [['ファルカ'], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  // --- フリンズ（受付 ①: E の 10.3 秒・嵐槍は何度でも。受付 ②: 嵐槍の後 6 秒・spQ 1 回） ---
  S('フリンズ E → 嵐槍 → spQ', [['フリンズ'], B], [[0, ['e', 'e_spearstorm', 'q_special']], [1, ['e']]]),
  S('フリンズ E → spQ（嵐槍なし）', [['フリンズ'], B], [[0, ['e', 'q_special']], [1, ['e']]]),
  S('フリンズ E → 嵐槍 → 4.5 秒 → 嵐槍（凸 0）', [['フリンズ'], B], [[0, ['e', 'e_spearstorm', 'w4.5', 'e_spearstorm']], [1, ['e']]]),
  S('フリンズ E → 嵐槍 → 4.5 秒 → 嵐槍（凸 1）', [['フリンズ', { constellation: 1 }], B], [[0, ['e', 'e_spearstorm', 'w4.5', 'e_spearstorm']], [1, ['e']]]),
  S('フリンズ E → 10.5 秒 → 嵐槍（受付の外）', [['フリンズ'], B], [[0, ['e', 'w10.5', 'e_spearstorm']], [1, ['e']]]),
  S('フリンズ E → 嵐槍 → spQ → spQ', [['フリンズ'], B], [[0, ['e', 'e_spearstorm', 'q_special', 'q_special']], [1, ['e']]]),
  S('フリンズ E → 嵐槍 → 7 秒 → spQ（受付 ② の外）', [['フリンズ'], B], [[0, ['e', 'e_spearstorm', 'w7', 'q_special']], [1, ['e']]]),
  S('フリンズ 嵐槍だけ（受付なし）', [['フリンズ'], B], [[0, ['e_spearstorm']], [1, ['e']]]),
  // --- ヴァレサ（受付: 落下攻撃〔凸 2 以上 / 猛烈パッション中〕で 140f。スキル・spQ で閉じる。受付の中の CT 1 秒） ---
  S('ヴァレサ 凸 0 E → CA → HP → CA → HP → spQ', [['ヴァレサ', { constellation: 0 }], B], [[0, ['e', 'ca', 'hp', 'ca', 'hp', 'q_special']], [1, ['e']]]),
  S('ヴァレサ 凸 0 基本コンボ ×2', [['ヴァレサ', { constellation: 0 }], B], [[0, ['e', 'ca', 'hp', 'e', 'ca', 'hp', 'q_special', 'e', 'ca', 'hp', 'e', 'ca', 'hp', 'q_special']], [1, ['e']]]),
  S('ヴァレサ 凸 0 Q → E → CA → HP → spQ（爆発の CT 中）', [['ヴァレサ', { constellation: 0 }], B], [[0, ['q', 'e', 'ca', 'hp', 'q_special']], [1, ['e']]]),
  S('ヴァレサ 凸 2 E → CA → HP → spQ', [['ヴァレサ', { constellation: 2 }], B], [[0, ['e', 'ca', 'hp', 'q_special']], [1, ['e']]]),
  S('ヴァレサ 凸 2 E → CA → HP → E → spQ（スキルで閉じる）', [['ヴァレサ', { constellation: 2 }], B], [[0, ['e', 'ca', 'hp', 'e', 'q_special']], [1, ['e']]]),
  S('ヴァレサ 凸 2 E → CA → HP → 3 秒 → spQ（受付の外）', [['ヴァレサ', { constellation: 2 }], B], [[0, ['e', 'ca', 'hp', 'w3', 'q_special']], [1, ['e']]]),
  S('ヴァレサ spQ だけ', [['ヴァレサ', { constellation: 0 }], B], [[0, ['q_special']], [1, ['e']]]),
  // --- モードを持つキャラ（今日の実装。統一の作業で変わらないことの確認） ---
  S('夢見月瑞希 E → 交代 / E → E', [['夢見月瑞希'], B], [[0, ['e']], [1, ['e']], [0, ['e', 'w2', 'e']]]),
  S('ディシア E → Q → N N → E → ジャンプ → E', [['ディシア'], B], [[0, ['e', 'q', 'n', 'n', 'e', 'jump', 'e']], [1, ['e']]]),
  S('タルタリヤ E → N N → E / 維持オン', [['タルタリヤ', { constellation: 0 }], B], [[0, ['e', 'n', 'n', 'e']], [1, ['e']], [0, ['e'], { holdMode: true }]]),
  S('胡桃 E → 交代 / 維持オフ', [['胡桃'], B], [[0, ['e']], [1, ['e']], [0, ['e'], { holdMode: false }]]),
  S('藍硯 hE（2 秒）→ E', [['藍硯'], B], [[0, ['e_hold@2', 'e']], [1, ['e']]]),
  S('ディルック E E E → E', [['ディルック'], B], [[0, ['e', 'e', 'e', 'e']], [1, ['e']]]),
  // --- モードの間に置けない操作（段階 ④） ---
  S('夢見月瑞希 E → N（待つ）/ E → E → N（解除の後は置ける）', [['夢見月瑞希'], B], [[0, ['e', 'n']], [1, ['e']], [0, ['e', 'e', 'n']]]),
  S('閑雲 E → N（待つ）/ E → 低空落下 → N', [['閑雲'], B], [[0, ['e', 'n']], [1, ['e']], [0, ['e', 'lp', 'n']]]),
  S('スカーク E → E（エラー）', [['スカーク'], B], [[0, ['e', 'e']], [1, ['e']]]),
  // --- 凸で使用可能回数が増えるスキル（2026-10-09。gcsim で、CT の並びが一致することを確認） ---
  S('アンバー 凸 4 E E E（回数 2・CT 12 秒）', [['アンバー', { constellation: 4 }], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  S('アンバー 凸 3 E E（回数 1・CT 15 秒）', [['アンバー', { constellation: 3 }], B], [[0, ['e', 'e']], [1, ['e']]]),
  S('申鶴 凸 1 tE hE tE（一回押し 10 秒・長押し 15 秒が同じ枠）', [['申鶴', { constellation: 1 }], B], [[0, ['e', 'e_hold', 'e']], [1, ['e']]]),
  S('藍硯 凸 6 tE hE tE（一回押し・長押しが同じ枠）', [['藍硯', { constellation: 6 }], B], [[0, ['e', 'e_hold', 'e']], [1, ['e']]]),
  S('藍硯 凸 5 hE → E（回数 1）', [['藍硯', { constellation: 5 }], B], [[0, ['e_hold@2', 'e']], [1, ['e']]]),
  S('リネット 凸 4 tE tE tE', [['リネット', { constellation: 4 }], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  S('白朮 凸 1 E E E', [['白朮', { constellation: 1 }], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  S('甘雨 凸 2 E E E', [['甘雨', { constellation: 2 }], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  S('スクロース 凸 1 E E E', [['スクロース', { constellation: 1 }], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  S('夜蘭 凸 1 E E E', [['夜蘭', { constellation: 1 }], B], [[0, ['e', 'e', 'e']], [1, ['e']]]),
  // --- 閑雲（雲の変化が時間切れで終わると、スキルの CT が 3 秒短くなる。落下攻撃で終えると短縮なし） ---
  S('閑雲 E → 5 秒 → E（時間切れで 3 秒短縮）', [['閑雲'], B], [[0, ['e', 'w5', 'e']], [1, ['e']]]),
  S('閑雲 E → 落下攻撃 → 13 秒 → E（短縮なし）', [['閑雲'], B], [[0, ['e', 'lp', 'w13', 'e']], [1, ['e']]]),
  S('閑雲 E E E → 5 秒 → E（3 回目の跳躍の後の時間切れ）', [['閑雲'], B], [[0, ['e', 'e', 'e', 'w5', 'e']], [1, ['e']]]),
  S('閑雲 E → 交代 → 閑雲 E（交代しても、本来の終わりで短縮）', [['閑雲'], B], [[0, ['e']], [1, ['e', 'w3']], [0, ['e']]]),
  S('閑雲 凸 1 E → 5 秒 → E → E', [['閑雲', { constellation: 1 }], B], [[0, ['e', 'w5', 'e', 'w5', 'e']], [1, ['e']]]),
  // --- 八重神子の殺生桜（D81。寿命は効果継続時間 14 秒、論示で +10 秒。桜は E の 34f 後に現れる。4 つ目で最古を押し出す。爆発で、場の桜 1 つにつき E の CT を 1 回分戻す。論示なしは、爆発で全部壊れる） ---
  S('八重神子 E E E → 5 秒 → E（押し出し。論示あり）', [['八重神子'], B], [[0, ['e', 'e', 'e', 'w5', 'e']], [1, ['e', 'w30']]]),
  S('八重神子 E E Q（論示あり。桜は残り、CT が戻る）', [['八重神子'], B], [[0, ['e', 'e', 'q']], [1, ['e', 'w30']]]),
  S('八重神子 E E Q（論示なし。桜が全部壊れる）', [['八重神子', { revelation: false }], B], [[0, ['e', 'e', 'q']], [1, ['e', 'w30']]]),
  S('八重神子 E（論示なし。14 秒）', [['八重神子', { revelation: false }], B], [[0, ['e']], [1, ['e', 'w30']]]),
  S('八重神子 E（論示あり。24 秒）', [['八重神子'], B], [[0, ['e']], [1, ['e', 'w30']]]),
];

const r3 = (v: number | undefined) => (v === undefined ? undefined : Number(v.toFixed(3)));

function runScenario(sc: Scenario) {
  seq = 0;
  const chars = sc.chars.map(([name, extra]) => byName(name, extra));
  const stints = sc.stints.map(([ci, steps, extra], i) => ({ id: `s${i}`, characterId: chars[ci].id, actions: steps.map(s => makeAction(chars[ci], s)), ...(extra ?? {}) }));
  const res = calculateRotation(chars, stints, { switchDelay: 0.5, loopStartIndex: sc.loopStartIndex ?? 0, defHalt: sc.defHalt ?? true });
  const actions = res.calculatedStints.flatMap((s: any) => s.actions);
  const built = buildGcsimConfig({
    characters: chars, stints, loopStartIndex: sc.loopStartIndex ?? 0, switchDelay: 0.5, defHalt: sc.defHalt ?? true, weapons: [], artifacts: [],
    extraWaitByActionId: Object.fromEntries(actions.filter((a: any) => a.type !== 'swap').map((a: any) => {
      const manual = a.durationManual && a.holdSeconds === undefined && a.naturalDuration !== undefined && a.type !== 'wait' ? Math.max(0, a.duration - a.naturalDuration) : 0;
      return [a.id, Number(((manual >= 0.005 ? manual : 0) + (a.modeHoldSeconds ?? 0)).toFixed(3))];
    }).filter(([, v]: [string, number]) => v > 0)),
    modeHoldByActionId: Object.fromEntries(actions.filter((a: any) => a.modeHoldSeconds).map((a: any) => [a.id, a.modeHoldSeconds])),
    holdSecondsByActionId: Object.fromEntries(actions.filter((a: any) => a.holdSeconds !== undefined).map((a: any) => [a.id, a.holdSeconds])),
  });
  return {
    stints: res.calculatedStints.map((s: any) => ({
      char: chars.find(c => c.id === s.characterId)?.name, start: r3(s.startTime), end: r3(s.endTime), modeHold: s.modeHold,
      actions: s.actions.filter((a: any) => a.type !== 'swap').map((a: any) => [a.shortName, r3(a.startTime), r3(a.duration), a.inStateWindow ? 'window' : '', a.hasCTCollision ? `CT違反${a.collisionRemainingCT}` : '', a.specialWindowWarning ?? '', a.modeHoldSeconds ? `hold${a.modeHoldSeconds}` : ''].filter(v => v !== '')),
    })),
    bars: res.activeBuffs.filter((b: any) => !b.isCarryOver).map((b: any) => [b.name, r3(b.startTime), r3(b.endTime), b.noSynergy ? 'noSynergy' : '']).sort((a: any, b: any) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0]))),
    cooldowns: [...res.skillCooldowns, ...res.burstCooldowns].filter((c: any) => !c.isCarryOver).map((c: any) => [chars.find(x => x.id === c.characterId)?.name, c.type, r3(c.startTime), r3(c.endTime)]).sort((a: any, b: any) => a[2] - b[2] || String(a[1]).localeCompare(String(b[1]))),
    issues: res.validationIssues.map((v: any) => [v.severity, v.title, v.message]).sort((a: any, b: any) => (a[1] + a[2]).localeCompare(b[1] + b[2])),
    gcsim: built.config.split('\n').filter((l: string) => !/^\S+ (char|add) |^options|^target|^energy|^#/.test(l)).join('\n'),
    gcsimMessages: [...(built.errors ?? []), ...(built.warnings ?? [])].map((w: any) => (typeof w === 'string' ? w : w.message)),
  };
}

const current: Record<string, unknown> = {};
for (const sc of SCENARIOS) current[sc.name] = runScenario(sc);
await server.close();

if (update || !fs.existsSync(SNAPSHOT_FILE)) {
  fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(current, null, 1) + '\n');
  console.log(`保存しました: ${SNAPSHOT_FILE}（${SCENARIOS.length} 並び）`);
  process.exit(0);
}

const saved = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
let diffCount = 0;
const show = (v: unknown) => JSON.stringify(v);
for (const name of new Set([...Object.keys(saved), ...Object.keys(current)])) {
  const a = saved[name], b = current[name] as any;
  if (show(a) === show(b)) continue;
  diffCount++;
  console.log(`\n✗ ${name}`);
  if (!a || !b) { console.log(a ? '  （並びが無くなった）' : '  （新しい並び。--update で保存）'); continue; }
  for (const key of Object.keys(b)) {
    if (show(a[key]) === show(b[key])) continue;
    const before = Array.isArray(a[key]) ? a[key] : [a[key]];
    const after = Array.isArray(b[key]) ? b[key] : [b[key]];
    const beforeSet = new Set(before.map(show)), afterSet = new Set(after.map(show));
    for (const x of before) if (!afterSet.has(show(x))) console.log(`  - ${key}: ${show(x)}`);
    for (const x of after) if (!beforeSet.has(show(x))) console.log(`  + ${key}: ${show(x)}`);
  }
}
console.log(diffCount === 0 ? `\n✓ 全 ${SCENARIOS.length} 並びが、保存した結果と同じ` : `\n${diffCount} 並びに差があります（意図した変更なら --update で保存し直す）`);
process.exit(diffCount === 0 ? 0 : 1);
