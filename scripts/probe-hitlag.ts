/**
 * アクションの「ヒットストップで延びるフレーム」を、実測で作る（D215 第 2 段。2026-10-15）。
 * 事前に gcsim のローカルサーバーを起動しておく（npm run gcsim:start）。
 *
 *   node scripts/probe-hitlag.ts            … src/data/hitlag_frames.json を書く
 *
 * gcsim は、攻撃が敵に当たると、ヒットストップで、アクションを延ばす（ログの `skill from N ended, time passed: 67 (actual: 77)`）。
 * マスターのフレーム表（`skillFrames` など）は、これを含まない。そこで、単独のキャラ（敵が範囲内・遅延なし）で
 * 「A → 次の attack」の実行フレームの差を測り、表の値（`cancels.attack`、無ければ `total`）との差を記録する。
 * 防御ヒットストップありの既定（with）と、`defhalt=false`（without）の 2 通りを測る。
 *   対象: 通常攻撃（段ごと。`attack` を続けて、段ごとの差）・元素スキル `_e`・元素爆発 `_q`・重撃 `_ca`（直前に attack）。
 *   対象外: 長押し・派生・特殊スキル・モードの動作・落下攻撃（表に無い = 延びを足さない）。
 * 結果: キー = アクション定義 ID。通常攻撃は、段ごとの配列（normalHits と同じ順）。値は { with, without }（フレーム）。
 * 延びは「敵に当たる」前提。命ノ星座・状態で当たる数が変わるものは、命ノ星座 0・標準の状態の値（書き戻しが補正する）。
 */
import fs from 'node:fs';
import { mapAction } from '../src/utils/gcsim/actionMapping.ts';
import { GCSIM_SERVER_URL } from '../src/utils/gcsim/gcsimConfig.ts';

const catalog = JSON.parse(fs.readFileSync('public/data/gcsim_key_catalog.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const characters: any[] = (Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw)).filter((c: any) => c.source?.gcsimKey);
const weapons: Record<string, string> = { sword: 'dullblade', claymore: 'ultimateoverlordsmegamagicsword', polearm: 'beginnersprotector', bow: 'huntersbow', catalyst: 'apprenticesnotes' };
/** 表との差がこれを超えるものは、別の仕組み（モード・状態）の可能性があるので記録しない（フレーム） */
const MAX_DELTA = 90;

async function run(config: string): Promise<any[] | undefined> {
  const res = await fetch(`${GCSIM_SERVER_URL}/sample/hl_${Date.now()}_${Math.random().toString(36).slice(2)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, seed: 1 }) });
  try {
    const j = JSON.parse(await res.text());
    return j.error ? undefined : j.logs;
  } catch {
    return undefined;
  }
}

/** 命令列を実行し、実行された各命令のフレームを返す（`wait` は除く）。待ち（not ready）が出たときは undefined（CT を含む測定は無効） */
async function frames(k: string, weapon: string, defhalt: boolean, script: string, names: string[]): Promise<number[] | undefined> {
  const cfg = [
    `${k} char lvl=90/90 cons=0 talent=9,9,9;`,
    `${k} add weapon="${weapon}" refine=1 lvl=90/90;`,
    `${k} add stats cr=1;`,
    `options iteration=1 duration=30 swap_delay=12 ignore_burst_energy=true${defhalt ? '' : ' defhalt=false'};`,
    'target lvl=100 resist=0.1;',
    `active ${k};`,
    script,
  ].join('\n');
  const logs = await run(cfg);
  if (!logs) return undefined;
  if (logs.some(l => l.event === 'sim' && /not ready/.test(l.msg))) return undefined;
  const out: number[] = [];
  const used = new Set<number>();
  for (const name of names) {
    const idx = logs.findIndex((l, i) => !used.has(i) && l.event === 'action' && l.msg.replace(/\[.*\]$/, '') === `executed ${name}` && (out.length === 0 || l.frame > out[out.length - 1]));
    if (idx < 0) return undefined;
    used.add(idx);
    out.push(logs[idx].frame);
  }
  return out;
}

const cancelAttack = (f: any): number | undefined => (f ? f.cancels?.attack ?? f.total : undefined);

type Pair = { with: number; without: number };
const entries: Record<string, Pair | Pair[]> = {};
let tried = 0;
let failed = 0;
let dropped = 0;
const dropList: string[] = [];
/** 表より短かった（負の差）ものは、0 にして記録する（延びを足さない。gcsim の動きの違いなので、一覧に出す） */
const clampList: string[] = [];
const clamp = (p: Pair, id: string): Pair => {
  if (p.with >= 0 && p.without >= 0) return p;
  clampList.push(`${id}: with=${p.with} without=${p.without}`);
  return { with: Math.max(0, p.with), without: Math.max(0, p.without) };
};

const measure = async (k: string, weapon: string, prefix: string, cmd: string, exp: number, id: string): Promise<Pair | undefined> => {
  tried++;
  const names = [...(prefix ? [prefix] : []), cmd.replace(/\[.*\]$/, ''), 'attack'];
  const script = [...(prefix ? [prefix] : []), cmd, 'attack'].map(c => `${k} ${c};`).join(' ');
  const out: Partial<Pair> = {};
  for (const [key, defhalt] of [['with', true], ['without', false]] as const) {
    const f = await frames(k, weapon, defhalt, script, names);
    if (!f) { failed++; return undefined; }
    const interval = f[f.length - 1] - f[f.length - 2];
    out[key] = interval - exp;
  }
  const p = out as Pair;
  if (Math.abs(p.with) > MAX_DELTA || Math.abs(p.without) > MAX_DELTA || p.with < p.without - 0) {
    dropped++;
    dropList.push(`${id}: with=${p.with} without=${p.without}`);
    return undefined;
  }
  return clamp(p, id);
};

for (const c of characters) {
  const k = c.source.gcsimKey as string;
  const weapon = weapons[c.weaponType];
  const actions: any[] = c.availableActions ?? [];
  // 元素スキル・元素爆発・重撃
  for (const suffix of ['e', 'q', 'ca'] as const) {
    const def = actions.find(a => a.id === `${c.id}_${suffix}`);
    if (!def?.frames || def.cooldownPool || def.specialBurst || def.mode || def.gcsimUnsupported) continue;
    const command = mapAction(def.id, c.weaponType).command;
    if (!command) continue;
    const exp = cancelAttack(def.frames);
    if (exp === undefined) continue;
    const p = await measure(k, weapon, suffix === 'ca' && command === 'charge' ? 'attack' : '', command, exp, def.id);
    if (p) entries[def.id] = p;
  }
  // 通常攻撃: 段ごと（attack を (段 + 2) 回。段 i の attack → 次の attack の差）
  const n = actions.find(a => a.id === `${c.id}_n`);
  const hits: any[] = n?.normalHits ?? [];
  if (hits.length > 0) {
    const arr: Pair[] = [];
    for (let i = 0; i < hits.length; i++) {
      const exp = cancelAttack(hits[i].frames);
      if (exp === undefined) break;
      tried++;
      const names = Array.from({ length: i + 2 }, () => 'attack');
      const script = names.map(() => `${k} attack;`).join(' ');
      const out: Partial<Pair> = {};
      let ok = true;
      for (const [key, defhalt] of [['with', true], ['without', false]] as const) {
        const f = await frames(k, weapon, defhalt, script, names);
        if (!f) { ok = false; break; }
        out[key] = f[i + 1] - f[i] - exp;
      }
      if (!ok) { failed++; break; }
      const p = out as Pair;
      if (Math.abs(p.with) > MAX_DELTA || p.with < p.without) { dropped++; dropList.push(`${c.id}_n[${i}]: with=${p.with} without=${p.without}`); break; }
      arr.push(clamp(p, `${c.id}_n[${i}]`));
    }
    if (arr.length === hits.length) entries[n.id] = arr;
  }
}

fs.writeFileSync('src/data/hitlag_frames.json', JSON.stringify({ gcsimCommit: catalog.gcsimCommit, generatedAt: new Date().toISOString(), entries }, null, 1) + '\n');
console.log(`測定 ${tried} 件 / 記録 ${Object.keys(entries).length} アクション / 測定できず ${failed} / 除外 ${dropped}`);
for (const l of dropList.slice(0, 40)) console.log('  除外:', l);
console.log(`表より短い（0 にして記録）: ${clampList.length} 件`);
for (const l of clampList.slice(0, 60)) console.log('  短い:', l);
