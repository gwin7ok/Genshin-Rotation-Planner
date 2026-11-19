/**
 * 単独 DPS の測定（ローテーション自動探索の第 1 歩。2026-11-20）。
 * 各キャラを、1 人だけで出し続けたときの DPS を、gcsim の WebAssembly 版（Node で動かす。scripts/gcsim-node.ts）で測る。
 * 「アタッカー性能が高いキャラ」を、実測で決めるための表を作るのが目的。
 *
 *   node scripts/solo-dps.ts                       全キャラ（gcsim のキーがあり、既定の装備が決まるもの）
 *   node scripts/solo-dps.ts ナヒーダ ニィロウ    名前を指定
 *   node scripts/solo-dps.ts --owned=tools/hoyolab-fetch/out/owned-characters.json   持ちキャラの実際の装備・凸・天賦で、持っているキャラだけ測る
 *   node scripts/solo-dps.ts --runs=10 --seconds=30 --filler=4 --top=20 --out=結果.json
 *
 * 装備は、アプリの「仮値を使う」と同じ（Wiki のおすすめの武器・聖遺物セット・ステータス。src/utils/customStats.ts）。凸は、アプリの既定（星 5 = 0 凸・星 4 = 6 凸）。
 * ローテーションは、TEMPLATES の数種類（通常攻撃・重撃・落下・長押し E など）を試して、最大の DPS を採る（出場は 1 人だけなので交代なし）。
 * 爆発のエネルギーは無視する（アプリの通常の計算と同じ）。
 */
import fs from 'node:fs';
import { createServer } from 'vite';
import { useNodeGcsim } from './gcsim-node.ts';

const args = process.argv.slice(2);
const opt = (name: string, def: number) => {
  const a = args.find(x => x.startsWith(`--${name}=`));
  return a ? Number(a.split('=')[1]) : def;
};
const outPath = args.find(x => x.startsWith('--out='))?.split('=')[1];
const ownedPath = args.find(x => x.startsWith('--owned='))?.split('=')[1];
const names = args.filter(x => !x.startsWith('--'));
const RUNS = opt('runs', 10);
const SECONDS = opt('seconds', 30);
const FILLER = opt('filler', 4);
const TOP = opt('top', 0);

/** 測るローテーション（出場は 1 人。必要なアクションが無いキャラは、そのローテーションを飛ばす） */
const rep = (step: string, n: number) => Array.from({ length: n }, () => step);
const TEMPLATES: { name: string; steps: string[] }[] = [
  { name: '通常攻撃', steps: ['e', 'q', ...rep('n', FILLER)] },
  { name: '通常攻撃長め', steps: ['e', 'q', ...rep('n', FILLER * 2)] },
  { name: '通常+重撃', steps: ['e', 'q', 'n', 'n', 'ca', 'n', 'n', 'ca'] },
  { name: '重撃のみ', steps: ['e', 'q', ...rep('ca', 4)] },
  { name: '落下', steps: ['e', 'q', 'jump', 'lp', 'jump', 'lp', 'jump', 'lp'] },
  { name: '高落下', steps: ['e', 'q', 'jump', 'hp', 'jump', 'hp', 'jump', 'hp'] },
  { name: '長押しE', steps: ['e_hold', 'q', ...rep('n', FILLER)] },
];

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
await useNodeGcsim(server);
const { buildGcsimConfig } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');
const { runGcsimSample } = await server.ssrLoadModule('/src/utils/gcsim/gcsimClient.ts');
const dps = await server.ssrLoadModule('/src/utils/gcsim/dpsCalc.ts');
const cs = await server.ssrLoadModule('/src/utils/customStats.ts');
const imp = await server.ssrLoadModule('/src/utils/hoyolab/importCharacters.ts');

const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const all: any[] = Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw);
const weapons: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const artifacts: any[] = JSON.parse(fs.readFileSync('src/data/artifacts_master_data.json', 'utf8'));

let seq = 0;
const makeAction = (char: any, step: string) => {
  const def = char.availableActions.find((a: any) => a.id === `${char.id}_${step}`);
  if (!def) return null;
  return { id: `a${++seq}`, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration };
};

interface Trial { template: string; dps: number; sd: number; seconds: number; total: number; note?: string }
interface Row { name: string; element: string; weaponType: string; best?: Trial; trials: Trial[]; note?: string }
const rows: Row[] = [];

// --owned=<持ちキャラの JSON>: 持ちキャラ（アプリの localStorage の ownedCharacters.characters を書き出したもの）の装備で測る。持っているキャラだけが対象
const owned: any[] = ownedPath ? JSON.parse(fs.readFileSync(ownedPath, 'utf8')).characters : [];
const ownedOf = (master: any) => owned.find(o => imp.matchMasterCharacterId(o, [master.id]) === master.id);
const pool = ownedPath ? all.filter(c => ownedOf(c)) : all;
const targets = names.length > 0 ? names.map(n => pool.find(c => c.name === n || c.englishName === n)).filter(Boolean) : pool;
for (const master of targets) {
  const row: Row = { name: master.name, element: master.element, weaponType: master.weaponType, trials: [] };
  rows.push(row);
  if (!master.source?.gcsimKey) { row.note = 'gcsim 未対応'; continue; }
  const o = ownedPath ? ownedOf(master) : undefined;
  let char: any;
  if (o) {
    const { fields, warnings } = imp.ownedToPartyFields(o, { weapons, artifacts });
    char = { ...structuredClone(master), ...fields };
    if (!weapons.find(w => w.id === fields.weaponId)?.gcsimKey) { row.note = `持ちキャラの武器が gcsim 未対応（${warnings.join(' ')}）`; continue; }
  } else {
    const eq = cs.defaultEquipmentFor(master.id, { weapons, artifacts });
    if (!weapons.find(w => w.id === eq.weaponId)?.gcsimKey) { row.note = '既定の武器なし'; continue; }
    char = { ...structuredClone(master), ...eq, customStats: cs.defaultCustomStatsFor(master.id) };
  }
  const errors: string[] = [];
  for (const tpl of TEMPLATES) {
    const actions = tpl.steps.map(s => makeAction(char, s));
    if (actions.some(a => a === null)) continue; // そのキャラに無いアクション
    const stints = [{ id: 's0', characterId: char.id, actions }];
    const cfg = buildGcsimConfig({ characters: [char], stints, loopStartIndex: 0, switchDelay: 0.5, defHalt: true, weapons, artifacts, battleSeconds: SECONDS });
    if (!cfg.runnable) { errors.push(`${tpl.name}: 設定文を作れない`); continue; }
    const out = await dps.computeDps({ config: cfg, runs: RUNS, parallel: 6, run: runGcsimSample, context: { battleSeconds: SECONDS, enemies: undefined } });
    if (out.status !== 'ok') { errors.push(`${tpl.name}: ${String(out.message ?? out.status).slice(0, 60)}`); continue; }
    row.trials.push({ template: tpl.name, dps: out.result.dps.mean, sd: out.result.dps.sd, seconds: out.result.seconds, total: out.result.total.mean, ...(out.result.shortRuns ? { note: `戦闘時間に届かない実行 ${out.result.shortRuns} 回` } : {}) });
  }
  if (row.trials.length === 0) { row.note = errors.join(' / ') || 'アクション不足'; continue; }
  row.best = row.trials.reduce((a, b) => (b.dps > a.dps ? b : a));
  console.log(`${master.name.padEnd(10, '　')} 最大 ${row.best.dps.toFixed(0).padStart(7)} (${row.best.template})  ${row.trials.map(t => `${t.template}=${t.dps.toFixed(0)}`).join(' ')}${errors.length ? '  [失敗: ' + errors.join(' / ') + ']' : ''}`);
}

const ok = rows.filter(r => r.best).sort((a, b) => b.best!.dps - a.best!.dps);
console.log(`\n=== 単独 DPS（${SECONDS} 秒・${RUNS} 回・ローテーション ${TEMPLATES.length} 種の最大）===`);
for (const [i, r] of (TOP > 0 ? ok.slice(0, TOP) : ok).entries()) console.log(`${String(i + 1).padStart(3)}. ${r.name.padEnd(10, '　')} ${r.element.padEnd(7)} ${r.weaponType.padEnd(9)} ${r.best!.dps.toFixed(0).padStart(7)} ±${r.best!.sd.toFixed(0)}  ${r.best!.template}`);
const ng = rows.filter(r => !r.best);
if (ng.length > 0) console.log(`\n測れなかったもの ${ng.length} 件:\n${ng.map(r => `  ${r.name}: ${r.note}`).join('\n')}`);
if (outPath) fs.writeFileSync(outPath, JSON.stringify({ seconds: SECONDS, runs: RUNS, templates: TEMPLATES, rows: ok }, null, 1));
await server.close();
process.exit(0);
