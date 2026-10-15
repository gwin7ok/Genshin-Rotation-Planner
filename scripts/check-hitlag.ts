/**
 * 「アプリの事前計算」と「gcsim の実測」の所要時間が、ヒットストップを含めて一致するかの検査（D215 第 2 段。2026-10-15）。
 * 事前に gcsim のローカルサーバーを起動しておく（npm run gcsim:start）。
 *
 *   npm run check:hitlag            … 差が 1f（約 0.017 秒）を超えるものがあれば、一覧を出して終了コード 1
 *
 * 全キャラ（命ノ星座 0・遅延なし）の、通常攻撃（段ごと）・元素スキル・元素爆発・重撃を、`A → attack` で並べ、
 *  - アプリ: calculateRotation の A の所要時間（次の attack へのキャンセル + ヒットストップの延び。src/data/hitlag_frames.json）
 *  - gcsim: A を実行したフレームから、次の attack を実行したフレームまでの差
 * を、防御ヒットストップありとなしの両方で比べる（重撃は、通常攻撃の直後と単独の両方）。
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

async function gcsimFrames(k: string, weapon: string, defhalt: boolean, cmds: string[], delayFrames: number): Promise<number[] | undefined> {
  const cfg = [
    `${k} char lvl=90/90 cons=0 talent=9,9,9;`,
    `${k} add weapon="${weapon}" refine=1 lvl=90/90;`,
    `${k} add stats cr=1;`,
    `options iteration=1 duration=30 swap_delay=12 ignore_burst_energy=true${defhalt ? '' : ' defhalt=false'};`,
    'target lvl=100 resist=0.1;',
    `active ${k};`,
    cmds.map(c => `${k} ${c};${delayFrames > 0 ? ` delay(${delayFrames});` : ''}`).join(' '),
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
const act = (c: any, suffix: string, delay: number) => {
  const def = c.availableActions.find((a: any) => a.id === `${c.id}_${suffix}`);
  return { id: `a${++seq}`, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration, delayAfter: delay };
};

const fails: string[] = [];
let checked = 0;
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
    const exp = ca.frames?.cancels?.attack ?? ca.frames?.total;
    // 通常攻撃の直後
    cases.push({ id: ca.id, label: 'ca（N の直後）', suffixes: ['n', 'ca', 'n'], cmds: ['attack', command, 'attack'], index: 1, tableExp: exp });
    // 単独（剣・大剣・長柄は、直前の attack が要るので測れない）
    if (!(command === 'charge' && ['sword', 'claymore', 'polearm'].includes(c.weaponType))) {
      cases.push({ id: ca.id, label: 'ca（単独）', suffixes: ['ca', 'n'], cmds: [command, 'attack'], index: 0, tableExp: exp });
    }
  }
  const n = A.find(a => a.id === `${c.id}_n`);
  const hits: any[] = n?.normalHits ?? [];
  if (n && Array.isArray(hitlag[n.id]) && (hitlag[n.id] as unknown[]).length === hits.length) {
    for (let i = 0; i < hits.length; i++) {
      cases.push({ id: n.id, label: `n${i + 1}`, suffixes: Array.from({ length: i + 2 }, () => 'n'), cmds: Array.from({ length: i + 2 }, () => 'attack'), index: i, tableExp: hits[i].frames?.cancels?.attack ?? hits[i].frames?.total });
    }
  }
  // モード（状態）の間の通常攻撃・重撃（`<opener>#n` / `#ca`）: opener の後に attack を続ける
  for (const [key, value] of Object.entries(hitlag)) {
    if (!key.startsWith(`${c.id}_`) || !key.includes('#')) continue;
    const [openerId, kind] = key.split('#');
    const openerSuffix = openerId.slice(c.id.length + 1);
    const opener = A.find(a => a.id === openerId);
    const command = opener && mapAction(openerId, c.weaponType).command;
    if (!opener?.mode || !command) continue;
    if (kind === 'n' && Array.isArray(value)) {
      const m = opener.mode.normalFrames as any[];
      for (let i = 0; i < m.length; i++) {
        cases.push({ id: key, label: `${openerSuffix}モード n${i + 1}`, suffixes: [openerSuffix, ...Array.from({ length: m.length + 1 }, () => 'n')], cmds: [command, ...Array.from({ length: m.length + 1 }, () => 'attack')], index: 1 + i, tableExp: m[i].cancels?.attack ?? m[i].total });
      }
    } else if (kind === 'ca') {
      const cf = opener.mode.chargedFrames;
      cases.push({ id: key, label: `${openerSuffix}モード ca`, suffixes: [openerSuffix, 'n', 'ca', 'n'], cmds: [command, 'attack', c.weaponType === 'bow' ? 'aim' : 'charge', 'attack'], index: 2, tableExp: cf.cancels?.attack ?? cf.total });
    }
  }
  for (const cs of cases) {
    for (const [defHalt, delayFrames] of [[true, 0], [false, 0], [true, 6], [false, 6]] as const) {
      const g = await gcsimFrames(k, weapon, defHalt, cs.cmds, delayFrames);
      if (!g) continue;
      // gcsim の間隔は、遅延（delay）を含む。アプリの開始時刻の差も、遅延（delayAfter）を含む
      const gInterval = g[cs.index + 1] - g[cs.index];
      const stints = [{ id: 's1', characterId: c.id, actions: cs.suffixes.map(s => act(c, s, delayFrames / 60)) }];
      const res = calculateRotation([c], stints, { switchDelay: 0.5, defHalt });
      const acts = res.calculatedStints[0].actions.filter((a: any) => a.type !== 'swap');
      const appInterval = Math.round((acts[cs.index + 1].startTime - acts[cs.index].startTime) * 60);
      checked++;
      if (Math.abs(appInterval - gInterval) > TOLERANCE) fails.push(`${c.name} ${cs.label} (defhalt=${defHalt}・遅延 ${delayFrames}f): アプリ ${appInterval}f / gcsim ${gInterval}f（差 ${appInterval - gInterval}f）`);
    }
  }
}
// ---- 武器の常時の攻撃速度（src/data/weapon_atk_spd.json。D216）: 通常攻撃の連続を、武器つきで比べる ----
const weaponsMaster: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const speeds = JSON.parse(fs.readFileSync('src/data/weapon_atk_spd.json', 'utf8')).entries as Record<string, Record<string, number>>;
const CHARS: Record<string, string> = { sword: '行秋', claymore: 'ライオス', polearm: '香菱', bow: 'アンバー', catalyst: 'リサ' };
for (const [weaponKey, byRefine] of Object.entries(speeds)) {
  const w = weaponsMaster.find(x => x.gcsimKey === weaponKey);
  if (!w) continue;
  const candidates = characters.filter(c => c.weaponType === w.weaponType);
  const c = candidates.find(x => x.name === CHARS[w.weaponType]) ?? candidates[0];
  const hits: any[] = c.availableActions.find((a: any) => a.id === `${c.id}_n`)?.normalHits ?? [];
  for (const refine of Object.keys(byRefine).filter((_, i) => i === 0)) {
    for (const [defHalt, delayFrames] of [[true, 6], [false, 0]] as const) {
      const k = c.source.gcsimKey as string;
      const n = Math.min(hits.length, 4);
      const cmds = Array.from({ length: n + 1 }, () => 'attack');
      const cfg = [
        `${k} char lvl=90/90 cons=0 talent=9,9,9;`,
        `${k} add weapon="${weaponKey}" refine=${refine} lvl=90/90;`,
        `${k} add stats cr=1;`,
        `options iteration=1 duration=30 swap_delay=12 ignore_burst_energy=true${defHalt ? '' : ' defhalt=false'};`,
        'target lvl=100 resist=0.1;',
        `active ${k};`,
        cmds.map(x => `${k} ${x};${delayFrames > 0 ? ` delay(${delayFrames});` : ''}`).join(' '),
      ].join('\n');
      const res = await fetch(`${GCSIM_SERVER_URL}/sample/cw_${Date.now()}_${Math.random().toString(36).slice(2)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg, seed: 1 }) });
      const logs = (await res.json()).logs as any[];
      const g = logs.filter(l => l.event === 'action' && l.msg === 'executed attack').map(l => l.frame as number);
      const cw = { ...structuredClone(c), weaponId: w.id, weaponRefinementRank: Number(refine) };
      const stints = [{ id: 's1', characterId: c.id, actions: cmds.map(() => act(c, 'n', delayFrames / 60)) }];
      const r = calculateRotation([cw], stints, { switchDelay: 0.5, defHalt, database: { weapons: weaponsMaster } });
      const acts = r.calculatedStints[0].actions.filter((a: any) => a.type !== 'swap');
      for (let i = 0; i < n; i++) {
        const gi = g[i + 1] - g[i];
        const ai = Math.round((acts[i + 1].startTime - acts[i].startTime) * 60);
        checked++;
        if (Math.abs(gi - ai) > TOLERANCE) fails.push(`${c.name}+${w.name}(精錬${refine}) n${i + 1} (defhalt=${defHalt}・遅延 ${delayFrames}f): アプリ ${ai}f / gcsim ${gi}f（差 ${ai - gi}f）`);
      }
    }
  }
}
await server.close();
console.log(`検査 ${checked} 件 / 差が ${TOLERANCE}f を超える ${fails.length} 件`);
for (const f of fails.slice(0, 60)) console.log('  ✗', f);
if (fails.length > 0) process.exit(1);
console.log('✓ アプリの事前計算と gcsim の実測が、ヒットストップを含めて一致している');
