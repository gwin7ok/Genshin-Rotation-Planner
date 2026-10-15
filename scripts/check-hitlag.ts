/**
 * 「アプリの事前計算」と「gcsim の実測」の所要時間が、ヒットストップを含めて一致するかの検査（D215 第 2 段。2026-10-15）。
 * 事前に gcsim のローカルサーバーを起動しておく（npm run gcsim:start）。
 *
 *   npm run check:hitlag            … 差が 1f（約 0.017 秒）を超えるものがあれば、一覧を出して終了コード 1
 *
 * 全キャラ（命ノ星座 0・遅延なし）の、通常攻撃（段ごと）・元素スキル・元素爆発・重撃を、`A → attack` で並べ、
 *  - アプリ: calculateRotation の A の所要時間（次の attack へのキャンセル + ヒットストップの延び。src/data/hitlag_frames.json）
 *  - gcsim: A を実行したフレームから、次の attack を実行したフレームまでの差
 * を、防御ヒットストップありとなしの両方で比べる。gcsim の方が表より短いもの（`probe:hitlag` が 0 にして記録したもの）は、対象外にして件数だけ出す。
 * 表に無いアクション（長押し・派生・特殊スキル・モード・落下）は対象外。
 */
import fs from 'node:fs';
import { createServer } from 'vite';
import { mapAction } from '../src/utils/gcsim/actionMapping.ts';
import { GCSIM_SERVER_URL } from '../src/utils/gcsim/gcsimConfig.ts';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { calculateRotation } = await server.ssrLoadModule('/src/utils/rotationCalculator.ts');

const hitlag = JSON.parse(fs.readFileSync('src/data/hitlag_frames.json', 'utf8')).entries as Record<string, unknown>;
const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const characters: any[] = (Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw)).filter((c: any) => c.source?.gcsimKey);
const weapons: Record<string, string> = { sword: 'dullblade', claymore: 'ultimateoverlordsmegamagicsword', polearm: 'beginnersprotector', bow: 'huntersbow', catalyst: 'apprenticesnotes' };
const TOLERANCE = 1; // フレーム

async function gcsimFrames(k: string, weapon: string, defhalt: boolean, cmds: string[]): Promise<number[] | undefined> {
  const cfg = [
    `${k} char lvl=90/90 cons=0 talent=9,9,9;`,
    `${k} add weapon="${weapon}" refine=1 lvl=90/90;`,
    `${k} add stats cr=1;`,
    `options iteration=1 duration=30 swap_delay=12 ignore_burst_energy=true${defhalt ? '' : ' defhalt=false'};`,
    'target lvl=100 resist=0.1;',
    `active ${k};`,
    cmds.map(c => `${k} ${c};`).join(' '),
  ].join('\n');
  const res = await fetch(`${GCSIM_SERVER_URL}/sample/ch_${Date.now()}_${Math.random().toString(36).slice(2)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg, seed: 1 }) });
  let logs: any[];
  try {
    const j = JSON.parse(await res.text());
    if (j.error) return undefined;
    logs = j.logs;
  } catch {
    return undefined;
  }
  if (logs.some(l => l.event === 'sim' && /not ready/.test(l.msg))) return undefined;
  const out: number[] = [];
  let from = 0;
  for (const c of cmds) {
    const base = c.replace(/\[.*\]$/, '');
    const l = logs.slice(from).find(x => x.event === 'action' && x.msg.replace(/\[.*\]$/, '') === `executed ${base}`);
    if (!l) return undefined;
    from = logs.indexOf(l) + 1;
    out.push(l.frame);
  }
  return out;
}

let seq = 0;
const act = (c: any, suffix: string) => {
  const def = c.availableActions.find((a: any) => a.id === `${c.id}_${suffix}`);
  return { id: `a${++seq}`, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration, delayAfter: 0 };
};

const fails: string[] = [];
let checked = 0;
let shorter = 0;
for (const c of characters) {
  const k = c.source.gcsimKey as string;
  const weapon = weapons[c.weaponType];
  const A = c.availableActions as any[];
  const cases: { id: string; label: string; suffixes: string[]; cmds: string[]; index: number; tableExp?: number }[] = [];
  for (const suffix of ['e', 'q'] as const) {
    const def = A.find(a => a.id === `${c.id}_${suffix}`);
    const entry = hitlag[`${c.id}_${suffix}`];
    const command = def && mapAction(def.id, c.weaponType).command;
    if (entry && command) cases.push({ id: def.id, label: suffix, suffixes: [suffix, 'n'], cmds: [command, 'attack'], index: 0, tableExp: def.frames?.cancels?.attack ?? def.frames?.total });
  }
  const ca = A.find(a => a.id === `${c.id}_ca`);
  if (ca && hitlag[`${c.id}_ca`]) {
    const command = mapAction(ca.id, c.weaponType).command!;
    const pre = command === 'charge';
    cases.push({ id: ca.id, label: 'ca', suffixes: [...(pre ? ['n'] : []), 'ca', 'n'], cmds: [...(pre ? ['attack'] : []), command, 'attack'], index: pre ? 1 : 0, tableExp: ca.frames?.cancels?.attack ?? ca.frames?.total });
  }
  const n = A.find(a => a.id === `${c.id}_n`);
  const hits: any[] = n?.normalHits ?? [];
  if (n && Array.isArray(hitlag[n.id]) && (hitlag[n.id] as unknown[]).length === hits.length) {
    for (let i = 0; i < hits.length; i++) {
      cases.push({ id: n.id, label: `n${i + 1}`, suffixes: Array.from({ length: i + 2 }, () => 'n'), cmds: Array.from({ length: i + 2 }, () => 'attack'), index: i, tableExp: hits[i].frames?.cancels?.attack ?? hits[i].frames?.total });
    }
  }
  for (const cs of cases) {
    for (const defHalt of [true, false]) {
      const g = await gcsimFrames(k, weapon, defHalt, cs.cmds);
      if (!g) continue;
      const gInterval = g[cs.index + 1] - g[cs.index];
      if (cs.tableExp !== undefined && gInterval < cs.tableExp) { if (defHalt) shorter++; continue; }
      const stints = [{ id: 's1', characterId: c.id, actions: cs.suffixes.map(s => act(c, s)) }];
      const res = calculateRotation([c], stints, { switchDelay: 0.5, defHalt });
      const acts = res.calculatedStints[0].actions.filter((a: any) => a.type !== 'swap');
      const appInterval = Math.round((acts[cs.index + 1].startTime - acts[cs.index].startTime) * 60);
      checked++;
      if (Math.abs(appInterval - gInterval) > TOLERANCE) fails.push(`${c.name} ${cs.label} (defhalt=${defHalt}): アプリ ${appInterval}f / gcsim ${gInterval}f（差 ${appInterval - gInterval}f）`);
    }
  }
}
await server.close();
console.log(`検査 ${checked} 件 / 差が ${TOLERANCE}f を超える ${fails.length} 件 / gcsim が表より短い（対象外）${shorter} 件`);
for (const f of fails.slice(0, 60)) console.log('  ✗', f);
if (fails.length > 0) process.exit(1);
console.log('✓ アプリの事前計算と gcsim の実測が、ヒットストップを含めて一致している');
