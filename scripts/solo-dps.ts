/**
 * 単独 DPS の測定（ローテーション自動探索の第 1 歩。2026-11-20）。
 * 各キャラを、1 人だけで出し続けたときの DPS を、gcsim の WebAssembly 版（Node で動かす。scripts/gcsim-node.ts）で測る。
 * 「アタッカー性能が高いキャラ」を、実測で決めるための表を作るのが目的。
 *
 *   node scripts/solo-dps.ts                       全キャラ（gcsim のキーがあり、既定の装備が決まるもの）
 *   node scripts/solo-dps.ts ナヒーダ ニィロウ    名前を指定
 *   node scripts/solo-dps.ts --runs=30 --seconds=30 --filler=4 --top=20
 *
 * 装備は、アプリの「仮値を使う」と同じ（Wiki のおすすめの武器・聖遺物セット・ステータス。src/utils/customStats.ts）。凸は、アプリの既定（星 5 = 0 凸・星 4 = 6 凸）。
 * ローテーションは、E → Q → 通常攻撃 N 回 を繰り返す（出場は 1 人だけなので交代なし）。爆発のエネルギーは無視する（アプリの通常の計算と同じ）。
 * 結果は、標準出力の表と、--out=<ファイル> の JSON。
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
const names = args.filter(x => !x.startsWith('--'));
const RUNS = opt('runs', 20);
const SECONDS = opt('seconds', 30);
const FILLER = opt('filler', 4);
const TOP = opt('top', 0);

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
await useNodeGcsim(server);
const { buildGcsimConfig } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');
const { runGcsimSample } = await server.ssrLoadModule('/src/utils/gcsim/gcsimClient.ts');
const dps = await server.ssrLoadModule('/src/utils/gcsim/dpsCalc.ts');
const cs = await server.ssrLoadModule('/src/utils/customStats.ts');

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

interface Row { name: string; element: string; weaponType: string; dps?: number; sd?: number; seconds?: number; total?: number; note?: string }
const rows: Row[] = [];

const targets = names.length > 0 ? names.map(n => all.find(c => c.name === n || c.englishName === n)).filter(Boolean) : all;
for (const master of targets) {
  const row: Row = { name: master.name, element: master.element, weaponType: master.weaponType };
  rows.push(row);
  if (!master.source?.gcsimKey) { row.note = 'gcsim 未対応'; continue; }
  const eq = cs.defaultEquipmentFor(master.id, { weapons, artifacts });
  const weapon = weapons.find(w => w.id === eq.weaponId);
  if (!weapon?.gcsimKey) { row.note = '既定の武器なし'; continue; }
  const char = { ...structuredClone(master), ...eq, customStats: cs.defaultCustomStatsFor(master.id) };
  const steps = ['e', 'q', ...Array.from({ length: FILLER }, () => 'n')];
  const actions = steps.map(s => makeAction(char, s));
  if (actions.some(a => a === null)) { row.note = `アクション不足（${steps.filter((_, i) => actions[i] === null).join(',')}）`; continue; }
  const stints = [{ id: 's0', characterId: char.id, actions }];
  const cfg = buildGcsimConfig({ characters: [char], stints, loopStartIndex: 0, switchDelay: 0.5, defHalt: true, weapons, artifacts, battleSeconds: SECONDS });
  if (!cfg.runnable) { row.note = `設定文を作れない: ${cfg.warnings.map((w: any) => w.message ?? w).join(' / ').slice(0, 80)}`; continue; }
  const out = await dps.computeDps({ config: cfg, runs: RUNS, parallel: 6, run: runGcsimSample, context: { battleSeconds: SECONDS, enemies: undefined } });
  if (out.status !== 'ok') { row.note = `実行失敗: ${String(out.message ?? out.status).slice(0, 80)}`; continue; }
  row.dps = out.result.dps.mean;
  row.sd = out.result.dps.sd;
  row.seconds = out.result.seconds;
  row.total = out.result.total.mean;
  if (out.result.shortRuns) row.note = `戦闘時間に届かない実行 ${out.result.shortRuns} 回`;
  console.log(`${master.name.padEnd(10, '　')} DPS ${row.dps.toFixed(0).padStart(7)} ±${row.sd.toFixed(0)}${row.note ? '  ' + row.note : ''}`);
}

const ok = rows.filter(r => r.dps !== undefined).sort((a, b) => b.dps! - a.dps!);
console.log(`\n=== 単独 DPS（${SECONDS} 秒・${RUNS} 回・E→Q→通常攻撃×${FILLER}）===`);
for (const [i, r] of (TOP > 0 ? ok.slice(0, TOP) : ok).entries()) console.log(`${String(i + 1).padStart(3)}. ${r.name.padEnd(10, '　')} ${r.element.padEnd(7)} ${r.weaponType.padEnd(9)} ${r.dps!.toFixed(0).padStart(7)} ±${r.sd!.toFixed(0)}`);
const ng = rows.filter(r => r.dps === undefined);
if (ng.length > 0) console.log(`\n測れなかったもの ${ng.length} 件:\n${ng.map(r => `  ${r.name}: ${r.note}`).join('\n')}`);
if (outPath) fs.writeFileSync(outPath, JSON.stringify({ seconds: SECONDS, runs: RUNS, filler: FILLER, rows: ok }, null, 1));
await server.close();
process.exit(0);
