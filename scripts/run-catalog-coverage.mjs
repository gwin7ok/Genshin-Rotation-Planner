/**
 * gcsim の実行で出るキーの網羅確認（フェーズ5 / 5-2b の続き）
 *
 * 全キャラ・全武器・全聖遺物を、1 つずつ gcsim のローカルサーバー（npm run gcsim:start。ポートは gcsim.config.json）で実行し、
 * 詳細ログの status イベント（バフ・状態・内部CTのキー）を集める。辞書（public/data/gcsim_key_catalog.json）で引けるかを確かめ、
 * 実行で確認できたキーを src/data/gcsim_key_observed.json に書き出す（npm run build:catalog が辞書に合成する）。
 *
 *   node scripts/run-catalog-coverage.mjs            全件（数分）
 *   node scripts/run-catalog-coverage.mjs nahida     キーが一致するキャラ・武器・聖遺物だけ（動作確認用）
 *
 * 事前に gcsim のローカルサーバーを起動しておく。
 *  - キャラ: 1 人で、凸 0 と凸 6 を実行（スキル・爆発・通常攻撃・重撃・長押しスキル。実行できないアクションは外して再試行）
 *  - 武器: 武器種ごとの汎用キャラに持たせて実行（精錬 1 と 5）。武器なしの実行に出るキーは除く
 *  - 聖遺物: 汎用キャラに 4 セットで実行。聖遺物なしの実行に出るキーは除く
 * 1 人・1 対象での実行なので、チームバフ・反応・命ノ星座の条件付きの効果など、出ないキーがある。
 */
import fs from 'node:fs';
import { GCSIM_SERVER_URL } from '../src/utils/gcsim/gcsimConfig.ts';

const SERVER = GCSIM_SERVER_URL + '/sample/coverage';
const root = process.cwd();
const read = p => JSON.parse(fs.readFileSync(`${root}/${p}`, 'utf8'));
const catalog = read('public/data/gcsim_key_catalog.json');
const characters = read('src/data/characters_master_data.json').filter(c => c.source?.gcsimKey);
const weapons = read('src/data/weapons_master_data.json').filter(w => w.gcsimKey);
const artifacts = read('src/data/artifacts_master_data.json').filter(a => a.gcsimKey);
const filter = process.argv[2];

// ---- 辞書の引き当て（完全一致 → パターン） ---------------------------------
const exact = new Map(catalog.entries.filter(e => !e.isPattern).map(e => [e.key, e]));
const patterns = catalog.entries.filter(e => e.isPattern).map(e => {
  const escaped = e.key.replace(/[.+?^$()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + escaped.replace('{element}', `(${(e.elements ?? []).join('|')})`).replace(/\*/g, '.*') + '$');
  return { e, re };
});
const lookup = key => exact.get(key) ?? patterns.find(p => p.re.test(key))?.e;

// ---- gcsim の実行 -------------------------------------------------------------
async function sample(config) {
  const res = await fetch(SERVER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, seed: 1 }) });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return { logs: json.logs ?? [], error: json.error };
  } catch {
    return { logs: [], error: text.slice(0, 200) };
  }
}

const OPTIONS = 'options iteration=1 duration=40 swap_delay=12 ignore_burst_energy=true;\ntarget lvl=100 resist=0.1;';
// gcsim は武器が必須。効果の無い初期武器（dullblade）を、武器種に関係なく使う
const NEUTRAL_WEAPON = 'dullblade';
const charLines = (key, { cons = 0, weapon = NEUTRAL_WEAPON, refine = 1, set } = {}) => [
  `${key} char lvl=90/90 cons=${cons} talent=9,9,9;`,
  `${key} add weapon="${weapon}" refine=${refine} lvl=90/90;`,
  ...(set ? [`${key} add set="${set}" count=4;`] : []),
  `${key} add stats cr=1;`,
];

/** アクション列を実行し、実行できないアクションがあれば外して再試行する。status イベントのキーを返す */
async function run(lines, key, actions, weaponType) {
  let list = [...actions];
  for (let attempt = 0; attempt < 8; attempt++) {
    const body = list.map(a => `${key} ${a};`).join('\n');
    const { logs, error } = await sample(`${lines.join('\n')}\n${OPTIONS}\nactive ${key};\n${body}\n`);
    if (!error) return { logs, dropped: actions.filter(a => !list.includes(a)) };
    // 実行時のエラー（executing <action>）か、設定の検証のエラー（key <param> is invalid for action <action>）
    const m = /executing ([\w\[\]=,]+)|for action (\w+)/.exec(error);
    const failed = m?.[1] ?? m?.[2];
    let idx = failed ? list.findIndex(a => a === failed || a.split('[')[0] === failed.split('[')[0]) : -1;
    if (idx < 0 && /invalid for action/.test(error)) idx = list.findIndex(a => a.includes('['));
    // 「attack の直後でないと charge できない」「夜魂中は charge できない」「状態中は skill できない」など
    if (idx < 0) {
      const name = /charge/.test(error) ? 'charge|aim' : /cannot use (\w+)/.exec(error)?.[1];
      if (name) idx = list.findIndex(a => new RegExp(`^(${name})(\\[|$)`).test(a));
    }
    if (idx < 0) return { logs: [], error };
    list.splice(idx, 1);
  }
  return { logs: [], error: 'リトライ上限' };
}

/** ログの status イベントから、キーごとの情報を集める */
function statusKeys(logs) {
  const keys = new Map();
  for (const l of logs) {
    if (l.event !== 'status') continue;
    const key = l.logs?.key ?? l.logs?.status;
    if (typeof key !== 'string') continue;
    const cur = keys.get(key) ?? { api: /mod/.test(l.msg) ? 'mod' : 'status', duration: undefined };
    const expiry = l.logs?.expiry;
    if (typeof expiry === 'number') cur.duration = expiry === -1 ? -1 : (cur.duration === undefined || cur.duration === -1 ? expiry - l.frame : cur.duration);
    keys.set(key, cur);
  }
  return keys;
}

const GENERIC_CHAR = { sword: 'kaeya', claymore: 'diluc', polearm: 'xiangling', bow: 'amber', catalyst: 'klee' };
const ATTACKS = ['skill', 'burst', 'attack', 'attack', 'attack', 'charge', 'attack', 'skill[hold=1]', 'attack', 'skill', 'attack', 'attack'];

const observed = new Map(); // key → { api, duration, subjects: Set }
const problems = [];
const note = (keys, subject, exclude = new Set()) => {
  for (const [key, info] of keys) {
    if (exclude.has(key)) continue;
    const cur = observed.get(key) ?? { api: info.api, duration: info.duration, subjects: new Set() };
    if (cur.duration === undefined) cur.duration = info.duration;
    cur.subjects.add(subject);
    observed.set(key, cur);
  }
};

const matches = (...names) => !filter || names.some(n => n && n.toLowerCase().includes(filter.toLowerCase()));
let count = 0;

// ---- キャラ -----------------------------------------------------------------
for (const c of characters) {
  const key = c.source.gcsimKey;
  if (!matches(key, c.name)) continue;
  const chargeAction = c.weaponType === 'bow' ? 'aim' : 'charge';
  const actions = ATTACKS.map(a => (a === 'charge' ? chargeAction : a));
  for (const cons of [0, 6]) {
    const r = await run(charLines(key, { cons }), key, actions);
    count++;
    if (r.error) { problems.push(`キャラ ${key} 凸${cons}: ${r.error}`); continue; }
    note(statusKeys(r.logs), `character:${key}`);
  }
}

// ---- 武器 -------------------------------------------------------------------
const baseline = new Map(); // 武器種 → 武器なしの実行に出るキー
async function baselineOf(type, extra = {}) {
  const cacheKey = type + JSON.stringify(extra);
  if (!baseline.has(cacheKey)) {
    const key = GENERIC_CHAR[type];
    const r = await run(charLines(key, extra), key, ATTACKS.map(a => (a === 'charge' && type === 'bow' ? 'aim' : a)), type);
    baseline.set(cacheKey, new Set(r.error ? [] : statusKeys(r.logs).keys()));
  }
  return baseline.get(cacheKey);
}
for (const w of weapons) {
  if (!matches(w.gcsimKey, w.name)) continue;
  const key = GENERIC_CHAR[w.weaponType];
  if (!key) continue;
  const exclude = await baselineOf(w.weaponType);
  for (const refine of [1, 5]) {
    const r = await run(charLines(key, { weapon: w.gcsimKey, refine }), key, ATTACKS.map(a => (a === 'charge' && w.weaponType === 'bow' ? 'aim' : a)));
    count++;
    if (r.error) { problems.push(`武器 ${w.gcsimKey} 精錬${refine}: ${r.error}`); continue; }
    note(statusKeys(r.logs), `weapon:${w.gcsimKey}`, exclude);
  }
}

// ---- 聖遺物 -----------------------------------------------------------------
for (const a of artifacts) {
  if (!matches(a.gcsimKey, a.name)) continue;
  for (const type of ['sword', 'catalyst']) {
    const key = GENERIC_CHAR[type];
    const exclude = await baselineOf(type);
    const r = await run(charLines(key, { set: a.gcsimKey }), key, ATTACKS);
    count++;
    if (r.error) { problems.push(`聖遺物 ${a.gcsimKey} (${key}): ${r.error}`); continue; }
    note(statusKeys(r.logs), `artifact:${a.gcsimKey}`, exclude);
  }
}

// ---- 集計 -------------------------------------------------------------------
const hit = [], miss = [];
for (const [key, info] of observed) (lookup(key) ? hit : miss).push([key, info]);
console.log(`実行 ${count} 回。実行で出たキー ${observed.size} 件: 辞書で引けた ${hit.length}、引けない ${miss.length}`);
for (const [key, info] of miss) console.log(`  引けない: ${key} (${info.api}, ${info.duration ?? '?'}f) ← ${[...info.subjects].join(', ')}`);
if (problems.length > 0) {
  console.log(`実行できなかった ${problems.length} 件:`);
  for (const p of problems.slice(0, 40)) console.log(`  ${p}`);
}

if (!filter) {
  const entries = [...observed].sort((a, b) => a[0].localeCompare(b[0])).map(([key, info]) => ({
    key,
    api: info.api,
    ...(info.duration !== undefined ? (info.duration === -1 ? { permanent: true } : { durationFrames: info.duration }) : {}),
    subjects: [...info.subjects].slice(0, 6),
    inCatalog: Boolean(lookup(key)),
  }));
  const lines = entries.map(e => '    ' + JSON.stringify(e));
  fs.writeFileSync(`${root}/src/data/gcsim_key_observed.json`,
    `{\n  "generatedAt": ${JSON.stringify(new Date().toISOString())},\n  "catalogCommit": ${JSON.stringify(catalog.gcsimCommit)},\n  "entries": [\n${lines.join(',\n')}\n  ]\n}\n`);
  console.log('出力: src/data/gcsim_key_observed.json');
} else {
  console.log('（絞り込み実行のため、ファイルは書き出しません）');
}
