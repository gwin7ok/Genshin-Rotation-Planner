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

/**
 * 標準の遅延（アクション遅延 0.1 秒 = 6f）。アプリは、アクションごとに `delay(6)` を足して gcsim に渡す。
 * gcsim の動きは、遅延の有無で変わるものがある（リサの重撃の windup 省略は、通常攻撃の直後に遅延が 1f でもあると、働かない）ので、
 * 標準の遅延（6f）と、遅延なし（0f）の両方で測る。
 */
const STD_DELAY = 6;

/** 命令列を実行し、実行された各命令のフレームを返す（`wait` は除く）。待ち（not ready）が出たときは undefined（CT を含む測定は無効） */
async function frames(k: string, weapon: string, defhalt: boolean, cmds: string[], delay: number, names: string[]): Promise<number[] | undefined> {
  const script = cmds.map(c => `${k} ${c};${delay > 0 ? ` delay(${delay});` : ''}`).join(' ');
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
/** `d0` = 遅延なしのときの値（標準の遅延のときと違うときだけ）。`afterNormal` = 重撃だけ、通常攻撃の直後に使うときの値（`d0` は、直前の通常攻撃の遅延がないとき） */
type Base = Pair & { d0?: Pair };
type Entry = Base & { afterNormal?: Base };
const entries: Record<string, Entry | Base[]> = {};
let tried = 0;
let failed = 0;
let dropped = 0;
const dropList: string[] = [];
/**
 * 表より短かった（負の差）ものも、そのまま記録する（gcsim の実際の動きに合わせる）。一覧に出す。
 * 例: 触媒の重撃は、通常攻撃の直後だと、窓（windup）14f 前後を省く（gcsim の charge.go: `skip CA windup if we're in NA`）。
 */
const clampList: string[] = [];
/**
 * 負の差が、窓（windup。最大でも十数 f）より大きいものは、「サンプルの最初の状態」に依存する別の仕組み
 * （夜蘭の「突破の矢」が最初から使える・タルタリヤの最初の状態の爆発など）なので、記録しない。弓の `aim` も、同じ理由で、負の差は記録しない
 */
const MAX_NEGATIVE = 20;
const same = (a: Pair, b: Pair) => a.with === b.with && a.without === b.without;

/** 命令列のうち、`index` 番目の命令の実行から、次の命令の実行までの差 − 表の値 − 遅延（防御ヒットストップありとなし） */
const deltaPair = async (k: string, weapon: string, cmds: string[], index: number, exp: number, delay: number): Promise<Pair | undefined> => {
  const names = cmds.map(c => c.replace(/\[.*\]$/, ''));
  const out: Partial<Pair> = {};
  for (const [key, defhalt] of [['with', true], ['without', false]] as const) {
    const f = await frames(k, weapon, defhalt, cmds, delay, names);
    if (!f) return undefined;
    out[key] = f[index + 1] - f[index] - exp - delay;
  }
  return out as Pair;
};

/** 標準の遅延と遅延なしの両方で測り、記録する形にまとめる。使えない値（除外）は undefined */
const measureBase = async (k: string, weapon: string, cmds: string[], index: number, exp: number, id: string, isAim = false): Promise<Base | undefined> => {
  tried += 2;
  const std = await deltaPair(k, weapon, cmds, index, exp, STD_DELAY);
  const d0 = await deltaPair(k, weapon, cmds, index, exp, 0);
  if (!std || !d0) { failed++; return undefined; }
  for (const [label, p] of [['', std], ['d0 ', d0]] as const) {
    const m = Math.min(p.with, p.without);
    if (Math.abs(p.with) > MAX_DELTA || Math.abs(p.without) > MAX_DELTA || p.with < p.without || m < -MAX_NEGATIVE || (isAim && m < 0)) {
      dropped++;
      dropList.push(`${id}: ${label}with=${p.with} without=${p.without}`);
      return undefined;
    }
    if (m < 0) clampList.push(`${id}: ${label}with=${p.with} without=${p.without}`);
  }
  return same(std, d0) ? std : { ...std, d0 };
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
    const isAim = command === 'aim';
    if (suffix === 'ca') {
      // 通常攻撃の直後（windup を省くキャラがある）と、単独（剣などは、直前の attack が要るため測れない）
      const afterN = await measureBase(k, weapon, ['attack', command, 'attack'], 1, exp, def.id, isAim);
      const alone = command === 'charge' && ['sword', 'claymore', 'polearm'].includes(c.weaponType) ? undefined : await measureBase(k, weapon, [command, 'attack'], 0, exp, def.id, isAim);
      const base = alone ?? afterN;
      if (base) entries[def.id] = afterN && alone && JSON.stringify(afterN) !== JSON.stringify(alone) ? { ...base, afterNormal: afterN } : base;
      continue;
    }
    const p = await measureBase(k, weapon, [command, 'attack'], 0, exp, def.id, isAim);
    if (p) entries[def.id] = p;
  }
  // 通常攻撃: 段ごと（attack を (段 + 2) 回。段 i の attack → 次の attack の差）
  const n = actions.find(a => a.id === `${c.id}_n`);
  const hits: any[] = n?.normalHits ?? [];
  if (hits.length > 0) {
    const arr: Base[] = [];
    for (let i = 0; i < hits.length; i++) {
      const exp = cancelAttack(hits[i].frames);
      if (exp === undefined) break;
      const p = await measureBase(k, weapon, Array.from({ length: i + 2 }, () => 'attack'), i, exp, `${c.id}_n[${i}]`);
      if (!p) break;
      arr.push(p);
    }
    if (arr.length === hits.length) entries[n.id] = arr;
  }
}

fs.writeFileSync('src/data/hitlag_frames.json', JSON.stringify({ gcsimCommit: catalog.gcsimCommit, generatedAt: new Date().toISOString(), entries }, null, 1) + '\n');
console.log(`測定 ${tried} 件 / 記録 ${Object.keys(entries).length} アクション / 測定できず ${failed} / 除外 ${dropped}`);
for (const l of dropList.slice(0, 40)) console.log('  除外:', l);
console.log(`表より短い（負の差のまま記録）: ${clampList.length} 件`);
for (const l of clampList.slice(0, 60)) console.log('  短い:', l);
