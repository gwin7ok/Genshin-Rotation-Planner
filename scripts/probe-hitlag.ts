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
/** 次のアクションが交代のとき、交代先にするキャラ（測定のキャラと別の、標準的なキャラ） */
const swapTarget = (k: string) => (k === 'xiangling' ? 'bennett' : 'xiangling');

async function frames(k: string, weapon: string, defhalt: boolean, cmds: string[], delay: number, names: string[]): Promise<number[] | undefined> {
  const other = swapTarget(k);
  const script = cmds.map(c => (c === 'swap' ? `${other} swap;` : `${k} ${c};`) + (delay > 0 ? ` delay(${delay});` : '')).join(' ');
  const cfg = [
    `${k} char lvl=90/90 cons=0 talent=9,9,9;`,
    `${k} add weapon="${weapon}" refine=1 lvl=90/90;`,
    `${k} add stats cr=1;`,
    `${other} char lvl=90/90 cons=0 talent=9,9,9;`,
    `${other} add weapon="${other === 'bennett' ? 'favoniussword' : 'beginnersprotector'}" refine=1 lvl=90/90;`,
    `${other} add stats cr=1;`,
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
    // 交代は、交代の要求（`swapping A to B`）のフレーム（出場の終わり）
    const idx = name === 'swap'
      ? logs.findIndex((l, i) => !used.has(i) && l.event === 'action' && l.msg.startsWith('swapping ') && (out.length === 0 || l.frame > out[out.length - 1]))
      : logs.findIndex((l, i) => !used.has(i) && l.event === 'action' && l.msg.replace(/\[.*\]$/, '') === `executed ${name}` && (out.length === 0 || l.frame > out[out.length - 1]));
    if (idx < 0) return undefined;
    used.add(idx);
    out.push(logs[idx].frame);
  }
  return out;
}

const cancelAttack = (f: any): number | undefined => (f ? f.cancels?.attack ?? f.total : undefined);

type Pair = { with: number; without: number };
/**
 * `d0` = 遅延なしのときの値（標準の遅延のときと違うときだけ）。`afterNormal` = 重撃だけ、通常攻撃の直後に使うときの値（`d0` は、直前の通常攻撃の遅延がないとき） */
type Base0 = Pair & { d0?: Pair };
/**
 * `byNext` = 次のアクションの種類（skill・burst・dash・jump・swap）が、次が通常攻撃（既定）のときと、値が違うときだけ。
 * 次が通常攻撃のときより、キャンセルが早いと、ヒットストップの延びが、大きく効くことがある（雷電の 5 段目 → E で +3f。D219）
 */
type Base = Base0 & { byNext?: Record<string, Base0> };
/**
 * `afterCharged` = 通常攻撃の 1 段目だけ、重撃の直後に使うときの、通常のときとの差（構え = windup が変わる。放浪者は −2f。gcsim の attackWindupNormal）。
 * 次のアクションの種類によらず同じなので、差として記録する（`d0` は、直前の重撃の遅延がないとき）。差が 0 のキャラは記録しない
 */
type AfterBase = Base0 & { /** 次のアクションの種類ごとの差（次が通常攻撃のときと違うものだけ） */ byNext?: Record<string, Base0> };
type NormalBase = Base & { afterCharged?: AfterBase; /** 爆発の直後の、通常のときとの差（同じ意味） */ afterBurst?: AfterBase };
/** `ext` = モード（状態）の終わりが、そのヒットのヒットストップで延びるフレーム（gcsim の `mod extended`。モードの通常攻撃・重撃だけ） */
type Entry = Base & { afterNormal?: Base; ext?: Pair };
const entries: Record<string, Entry | NormalBase[]> = {};
let tried = 0;
let failed = 0;
let dropped = 0;
const dropList: string[] = [];
/** 次のアクションの種類ごとの測定で、除外した組（`<id>|<次の種類>`）。`check:hitlag` が、対象外にする（表の読み取りの違い・別の仕組み） */
const excludedNext: string[] = [];
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
/** 次のアクションの種類 → gcsim の命令 */
const NEXT_COMMANDS: [string, string][] = [['skill', 'skill'], ['burst', 'burst'], ['dash', 'dash'], ['jump', 'jump'], ['swap', 'swap']];

/** 次が通常攻撃のとき（base）と値が違う、次の種類ごとの値を測る。`prefix` の最後が測るアクション。`expOf` = 次の種類ごとの表の値 */
const measureByNext = async (k: string, weapon: string, prefix: string[], expOf: (key: string) => number | undefined, base: Base0, id: string, isAim = false): Promise<Record<string, Base0> | undefined> => {
  const out: Record<string, Base0> = {};
  for (const [key, command] of NEXT_COMMANDS) {
    const exp = expOf(key);
    if (exp === undefined) continue;
    const cmds = [...prefix, command];
    tried += 2;
    const std = await deltaPair(k, weapon, cmds, prefix.length - 1, exp, STD_DELAY);
    const d0 = await deltaPair(k, weapon, cmds, prefix.length - 1, exp, 0);
    if (!std || !d0) continue;
    const m = Math.min(std.with, std.without, d0.with, d0.without);
    const bad = [std, d0].some(p => Math.abs(p.with) > MAX_DELTA || Math.abs(p.without) > MAX_DELTA || p.with < p.without) || m < -MAX_NEGATIVE || (isAim && m < 0);
    if (bad) { dropped++; excludedNext.push(`${id}|${key}`); dropList.push(`${id} 次=${key}: std=${JSON.stringify(std)} d0=${JSON.stringify(d0)}`); continue; }
    const baseD0 = base.d0 ?? base;
    if (same(std, base) && same(d0, baseD0)) continue;
    out[key] = same(std, d0) ? { ...std } : { ...std, d0 };
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

/** 表の次の種類ごとの値（`cancels[次]`、無ければ `total`）。キーは、アプリの次の種類（skill・burst・dash・jump・swap） */
const expOfFrames = (f: any) => (key: string): number | undefined => (f ? f.cancels?.[key] ?? f.total : undefined);

const measureBase = async (k: string, weapon: string, cmds: string[], index: number, exp: number, id: string, isAim = false, framesForNext?: any): Promise<Base | undefined> => {
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
  const base: Base = same(std, d0) ? std : { ...std, d0 };
  if (framesForNext) {
    // cmds の最後（次の attack）を除いたものが prefix
    const byNext = await measureByNext(k, weapon, cmds.slice(0, -1), expOfFrames(framesForNext), base, id, isAim);
    if (byNext) base.byNext = byNext;
  }
  return base;
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
      const afterN = await measureBase(k, weapon, ['attack', command, 'attack'], 1, exp, def.id, isAim, def.frames);
      const alone = command === 'charge' && ['sword', 'claymore', 'polearm'].includes(c.weaponType) ? undefined : await measureBase(k, weapon, [command, 'attack'], 0, exp, def.id, isAim, def.frames);
      const base = alone ?? afterN;
      if (base) entries[def.id] = afterN && alone && JSON.stringify(afterN) !== JSON.stringify(alone) ? { ...base, afterNormal: afterN } : base;
      continue;
    }
    const p = await measureBase(k, weapon, [command, 'attack'], 0, exp, def.id, isAim, def.frames);
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
      const p = await measureBase(k, weapon, Array.from({ length: i + 2 }, () => 'attack'), i, exp, `${c.id}_n[${i}]`, false, hits[i].frames);
      if (!p) break;
      arr.push(p);
    }
    if (arr.length === hits.length) {
      entries[n.id] = arr;
      // 1 段目を、重撃の直後に使うとき（重撃のあとは、1 段目に戻る）
      const ca = actions.find(a => a.id === `${c.id}_ca`);
      const caCommand = ca && !ca.gcsimUnsupported ? mapAction(ca.id, c.weaponType).command : undefined;
      const q = actions.find(a => a.id === `${c.id}_q`);
      // モードを開く爆発（状態の中の通常攻撃は、別の仕組み。爆発自身の攻撃速度の効果も、表で別に足すので、差に混ぜない）は測らない
      const qCommand = q && !q.gcsimUnsupported && !q.cooldownPool && !q.specialBurst && !q.mode ? mapAction(q.id, c.weaponType).command : undefined;
      const diff = (x: Pair, y: Pair): Pair => ({ with: x.with - y.with, without: x.without - y.without });
      const exp = cancelAttack(hits[0].frames)!;
      // 重撃（単独で使えない剣・大剣・長柄は、直前に通常攻撃を入れる。重撃で 1 段目に戻る）と爆発の直後の 1 段目を測る
      for (const [label, prefix] of [['afterCharged', caCommand && caCommand !== 'aim' ? ['attack', caCommand] : undefined], ['afterBurst', qCommand ? [qCommand] : undefined]] as const) {
        if (!prefix) continue;
        // 1 段目の次の n1 → attack の測定が、次の種類の測定で除外されているキャラ（凝光: 通常攻撃の種類が毎回変わる）は、測らない
        if (excludedNext.some(x => x.startsWith(`${n.id}[0]|`))) continue;
        const af = await measureBase(k, weapon, [...prefix, 'attack', 'attack'], prefix.length, exp, `${n.id}[0]+${label}`, false, undefined);
        if (!af) continue;
        const b = arr[0];
        const std = diff(af, b);
        const d0 = diff(af.d0 ?? af, b.d0 ?? b);
        {
          // 次のアクションの種類（skill・burst・dash・jump・swap）ごとの差。通常のときの値との差で、次が通常攻撃のときと違うものだけ記録する
          const byNext: Record<string, Pair & { d0?: Pair }> = {};
          for (const [key, command] of NEXT_COMMANDS) {
            const expKey = hits[0].frames?.cancels?.[key] ?? hits[0].frames?.total;
            if (expKey === undefined) continue;
            const cmds = [...prefix, 'attack', command];
            tried += 2;
            const a1 = await deltaPair(k, weapon, cmds, prefix.length, expKey, STD_DELAY);
            const a0 = await deltaPair(k, weapon, cmds, prefix.length, expKey, 0);
            if (!a1 || !a0) continue;
            const bk: Base0 = (b.byNext?.[key] as Base0 | undefined) ?? b;
            const ds = diff(a1, bk);
            const dz = diff(a0, bk.d0 ?? bk);
            if (Math.abs(ds.with) > MAX_NEGATIVE || Math.abs(dz.with) > MAX_NEGATIVE) continue;
            if (same(ds, std) && same(dz, d0)) continue;
            byNext[key] = same(ds, dz) ? ds : { ...ds, d0: dz };
          }
          const nonZero = std.with !== 0 || std.without !== 0 || d0.with !== 0 || d0.without !== 0;
          if (nonZero || Object.keys(byNext).length > 0) (arr[0] as NormalBase)[label] = { ...(same(std, d0) ? std : { ...std, d0 }), ...(Object.keys(byNext).length > 0 ? { byNext } : {}) };
        }
      }
    }
  }
}

// ---- モード（状態）の間の通常攻撃・重撃: マスターの `mode.normalFrames` / `mode.chargedFrames` を使う動作（雷電の爆発・綾人のスキルなど） ----
// 開いたアクション（opener）を実行した後の attack を続けて測る。キー = `<opener のアクション定義 ID>#n`（段ごとの配列）・`#ca`（重撃）。
// ヒットストップの延びに加え、モードの状態の終わりが延びたフレーム（`ext`）も記録する。
const modeRun = async (k: string, weapon: string, defhalt: boolean, cmds: string[], delay: number) => {
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
  if (!logs || logs.some(l => l.event === 'sim' && /not ready/.test(l.msg))) return undefined;
  const execs = logs.filter(l => l.event === 'action' && /^executed /.test(l.msg) && !/^executed (wait|swap)/.test(l.msg));
  if (execs.length < cmds.length) return undefined;
  const fr = execs.slice(0, cmds.length).map(l => l.frame as number);
  // モードの状態: 開いたアクションの実行の直後（5f 以内）に付き、ヒットストップで延びた（`mod extended`）状態のキー
  const added = logs.filter(l => l.event === 'status' && l.msg.endsWith('added') && l.logs?.key && l.frame >= fr[0] && l.frame <= fr[0] + 5 + 60);
  const extendedKeys = new Set(logs.filter(l => l.event === 'status' && /extended$/.test(l.msg) && l.logs?.amt !== undefined).map(l => l.logs.key));
  const key = added.map(l => l.logs.key).find(kk => extendedKeys.has(kk));
  const ext: number[] = Array(cmds.length).fill(0);
  if (key) {
    for (const l of logs) {
      if (l.event !== 'status' || !/extended$/.test(l.msg) || l.logs?.key !== key) continue;
      let idx = -1;
      for (let i = 0; i < fr.length; i++) if (fr[i] <= l.frame) idx = i;
      if (idx >= 0) ext[idx] += Number(l.logs.amt) || 0;
    }
  }
  return { fr, ext };
};

for (const c of characters) {
  const k = c.source.gcsimKey as string;
  const weapon = weapons[c.weaponType];
  for (const opener of (c.availableActions ?? []) as any[]) {
    const mode = opener.mode;
    if (!mode || (!mode.normalFrames && !mode.chargedFrames)) continue;
    const command = mapAction(opener.id, c.weaponType).command;
    if (!command) continue;
    const jobs: { key: string; index: number; exp: number }[] = [];
    (mode.normalFrames ?? []).forEach((f: any, i: number) => jobs.push({ key: `${opener.id}#n`, index: i, exp: cancelAttack(f) as number }));
    const nHits = (mode.normalFrames ?? []).length;
    if (nHits > 0) {
      const res: Record<string, Entry[]> = {};
      let ok = true;
      const cmds = [command, ...Array.from({ length: nHits + 1 }, () => 'attack')];
      const got: Record<string, { fr: number[]; ext: number[] }> = {};
      for (const [dk, delay] of [['s', STD_DELAY], ['0', 0]] as const) {
        for (const [hk, defhalt] of [['w', true], ['o', false]] as const) {
          tried++;
          const r = await modeRun(k, weapon, defhalt, cmds, delay);
          if (!r) { ok = false; failed++; break; }
          got[dk + hk] = r;
        }
        if (!ok) break;
      }
      if (ok) {
        const arr: Entry[] = [];
        for (let i = 0; i < nHits; i++) {
          const exp = jobs[i].exp;
          const at = (dk: 's' | '0', hk: 'w' | 'o') => {
            const g = got[dk + hk];
            const delay = dk === 's' ? STD_DELAY : 0;
            // cmds[0] = opener、cmds[1 + i] = i 段目の attack。次の attack との差
            return { delta: g.fr[i + 2] - g.fr[i + 1] - exp - delay, ext: g.ext[i + 1] };
          };
          const std: Pair = { with: at('s', 'w').delta, without: at('s', 'o').delta };
          const d0: Pair = { with: at('0', 'w').delta, without: at('0', 'o').delta };
          const ext: Pair = { with: at('s', 'w').ext, without: at('s', 'o').ext };
          const bad = [std, d0].some(p => Math.abs(p.with) > MAX_DELTA || Math.abs(p.without) > MAX_DELTA || p.with < p.without || Math.min(p.with, p.without) < -MAX_NEGATIVE);
          if (bad) { dropped++; dropList.push(`${opener.id}#n[${i}]: std=${JSON.stringify(std)} d0=${JSON.stringify(d0)}`); ok = false; break; }
          if (Math.min(std.with, std.without, d0.with, d0.without) < 0) clampList.push(`${opener.id}#n[${i}]: std=${JSON.stringify(std)} d0=${JSON.stringify(d0)}`);
          const e: Entry = same(std, d0) ? { ...std } : { ...std, d0 };
          if (ext.with !== 0 || ext.without !== 0) e.ext = ext;
          // 次のアクションの種類ごとの値（opener → attack × (i + 1) → 次）
          const byNext = await measureByNext(k, weapon, [command, ...Array.from({ length: i + 1 }, () => 'attack')], expOfFrames(mode.normalFrames[i]), e, `${opener.id}#n[${i}]`);
          if (byNext) e.byNext = byNext;
          arr.push(e);
        }
        if (ok) entries[`${opener.id}#n`] = arr;
      }
      void res;
    }
    // 重撃（モードの重撃のフレーム）: opener → attack → charge → attack。charge の次の attack との差
    if (mode.chargedFrames) {
      const exp = cancelAttack(mode.chargedFrames) as number;
      const cmds = [command, 'attack', c.weaponType === 'bow' ? 'aim' : 'charge', 'attack'];
      const got: Record<string, { fr: number[]; ext: number[] }> = {};
      let ok = true;
      for (const [dk, delay] of [['s', STD_DELAY], ['0', 0]] as const) {
        for (const [hk, defhalt] of [['w', true], ['o', false]] as const) {
          tried++;
          const r = await modeRun(k, weapon, defhalt, cmds, delay);
          if (!r) { ok = false; failed++; break; }
          got[dk + hk] = r;
        }
        if (!ok) break;
      }
      if (ok) {
        const g = (dk: 's' | '0', hk: 'w' | 'o') => ({ delta: got[dk + hk].fr[3] - got[dk + hk].fr[2] - exp - (dk === 's' ? STD_DELAY : 0), ext: got[dk + hk].ext[2] });
        const std: Pair = { with: g('s', 'w').delta, without: g('s', 'o').delta };
        const d0: Pair = { with: g('0', 'w').delta, without: g('0', 'o').delta };
        const ext: Pair = { with: g('s', 'w').ext, without: g('s', 'o').ext };
        const bad = [std, d0].some(p => Math.abs(p.with) > MAX_DELTA || Math.abs(p.without) > MAX_DELTA || p.with < p.without || Math.min(p.with, p.without) < -MAX_NEGATIVE);
        if (bad) { dropped++; dropList.push(`${opener.id}#ca: std=${JSON.stringify(std)} d0=${JSON.stringify(d0)}`); }
        else {
          const e: Entry = same(std, d0) ? { ...std } : { ...std, d0 };
          if (ext.with !== 0 || ext.without !== 0) e.ext = ext;
          const byNext = await measureByNext(k, weapon, [command, 'attack', c.weaponType === 'bow' ? 'aim' : 'charge'], expOfFrames(mode.chargedFrames), e, `${opener.id}#ca`);
          if (byNext) e.byNext = byNext;
          entries[`${opener.id}#ca`] = e;
        }
      }
    }
  }
}

fs.writeFileSync('src/data/hitlag_frames.json', JSON.stringify({ gcsimCommit: catalog.gcsimCommit, generatedAt: new Date().toISOString(), excludedNext, entries }, null, 1) + '\n');
console.log(`測定 ${tried} 件 / 記録 ${Object.keys(entries).length} アクション / 測定できず ${failed} / 除外 ${dropped}`);
for (const l of dropList.slice(0, 40)) console.log('  除外:', l);
console.log(`表より短い（負の差のまま記録）: ${clampList.length} 件`);
for (const l of clampList.slice(0, 60)) console.log('  短い:', l);
