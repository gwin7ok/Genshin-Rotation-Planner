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

const hitlagJson = JSON.parse(fs.readFileSync('src/data/hitlag_frames.json', 'utf8'));
const hitlag = hitlagJson.entries as Record<string, unknown>;
/** `probe:hitlag` が、次のアクションの種類ごとの測定で除外した組（`<id>|<次の種類>`）。表の読み取りの違い（凝光の通常攻撃など）で、対象外 */
const excludedNext = new Set<string>(hitlagJson.excludedNext ?? []);
let skippedNext = 0;
/** probe が、直前のアクションごとの 1 段目の差を、測れなかった・使えないとしたもの（`<通常攻撃の ID>|<afterXxx>`）。対象外 */
const excludedAfter = new Set<string>(hitlagJson.excludedAfter ?? []);
const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const characters: any[] = (Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw)).filter((c: any) => c.source?.gcsimKey);
// gcsim の設定は cons=0。アプリの既定（星 4 のキャラは 6 凸）の命ノ星座の効果が入らないように、0 凸にそろえる
for (const c of characters) c.constellation = 0;
const weapons: Record<string, string> = { sword: 'dullblade', claymore: 'ultimateoverlordsmegamagicsword', polearm: 'beginnersprotector', bow: 'huntersbow', catalyst: 'apprenticesnotes' };
const TOLERANCE = 1; // フレーム

/** 次のアクションが交代のとき、交代先にするキャラ */
const swapTarget = (k: string) => (k === 'xiangling' ? 'bennett' : 'xiangling');

async function gcsimFrames(k: string, weapon: string, defhalt: boolean, cmds: string[], delayFrames: number): Promise<number[] | undefined> {
  const other = swapTarget(k);
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
    cmds.map(c => (c === 'swap' ? `${other} swap;` : `${k} ${c};`) + (delayFrames > 0 ? ` delay(${delayFrames});` : '')).join(' '),
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
    const l = base === 'swap'
      ? logs.slice(from).find(x => x.event === 'action' && x.msg.startsWith('swapping '))
      : logs.slice(from).find(x => x.event === 'action' && x.msg.replace(/\[.*\]$/, '') === `executed ${base}`);
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
// `--speed-only`: 通常攻撃速度の効果の表の検査だけを行う（速い）
const speedOnly = process.argv.includes('--speed-only');
for (const c of speedOnly ? [] : characters) {
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
  // 重撃の直後の通常攻撃の 1 段目（構え = windup の違い。D229）
  if (ca && hitlag[ca.id] && n && Array.isArray(hitlag[n.id]) && hits.length > 0) {
    const caCommand = mapAction(ca.id, c.weaponType).command;
    if (caCommand && caCommand !== 'aim' && !excludedAfter.has(`${n.id}|afterCharged`)) {
      cases.push({ id: n.id, label: 'ca の後の n1', suffixes: ['n', 'ca', 'n', 'n'], cmds: ['attack', caCommand, 'attack', 'attack'], index: 2, tableExp: hits[0].frames?.cancels?.attack ?? hits[0].frames?.total });
    }
  }
  // スキル・ダッシュ・ジャンプの直後の通常攻撃の 1 段目（同じ。D230）
  if (n && Array.isArray(hitlag[n.id]) && hits.length > 0) {
    const e = A.find(x => x.id === `${c.id}_e`);
    const prefixes: [string, string | undefined][] = [
      ['e', e && !e.mode && !e.specialBurst && !e.cooldownPool && !e.gcsimUnsupported ? mapAction(e.id, c.weaponType).command : undefined],
      ['dash', A.some(x => x.id === `${c.id}_dash`) ? 'dash' : undefined],
      ['jump', A.some(x => x.id === `${c.id}_jump`) ? 'jump' : undefined],
    ];
    for (const [suffix, command] of prefixes) {
      const afterLabel = { e: 'afterSkill', dash: 'afterDash', jump: 'afterJump' }[suffix] as string;
      if (command && !excludedAfter.has(`${n.id}|${afterLabel}`)) cases.push({ id: n.id, label: `${suffix} の後の n1`, suffixes: [suffix, 'n', 'n'], cmds: [command, 'attack', 'attack'], index: 1, tableExp: hits[0].frames?.cancels?.attack ?? hits[0].frames?.total });
    }
  }
  // 爆発の直後の通常攻撃の 1 段目（同じ。D229）
  {
    const q = A.find(x => x.id === `${c.id}_q`);
    // 測る対象は、probe と同じ（モードを開く爆発・特殊爆発・複数回の爆発は、別の仕組み）
    if (q && !q.mode && !q.specialBurst && !q.cooldownPool && !q.gcsimUnsupported && n && Array.isArray(hitlag[n.id]) && hits.length > 0 && hitlag[q.id]) {
      const qCommand = mapAction(q.id, c.weaponType).command;
      if (qCommand && !excludedAfter.has(`${n.id}|afterBurst`)) cases.push({ id: n.id, label: 'q の後の n1', suffixes: ['q', 'n', 'n'], cmds: [qCommand, 'attack', 'attack'], index: 1, tableExp: hits[0].frames?.cancels?.attack ?? hits[0].frames?.total });
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
  // 次のアクションの種類（skill・burst・dash・jump・swap）ごとの値: 次が通常攻撃のケースを、次を入れ替えて検査する（D219）
  const nextVariants: typeof cases = [];
  const NEXTS: [string, string | undefined, string][] = [['skill', 'e', 'skill'], ['burst', 'q', 'burst'], ['dash', 'dash', 'dash'], ['jump', 'jump', 'jump'], ['swap', undefined, 'swap']];
  for (const cs of cases) {
    for (const [label, suffix, command] of NEXTS) {
      if (suffix !== undefined && !A.some(a => a.id === `${c.id}_${suffix}`)) continue;
      // 次の行は、最後の（次の通常攻撃の）要素を置き換える。交代は、出場の最後（次の要素なし）
      const suffixes = suffix === undefined ? cs.suffixes.slice(0, -1) : [...cs.suffixes.slice(0, -1), suffix];
      // 除外の組（probe の id）: 通常攻撃 `<id>_n[段]`・モードの通常攻撃 `<opener>#n[段]`・それ以外は id
      const m = /^n(\d+)$/.exec(cs.label) ?? /モード n(\d+)$/.exec(cs.label) ?? /^[a-z]+ の後の n(\d+)$/.exec(cs.label);
      const exId = m ? `${cs.id}[${Number(m[1]) - 1}]` : cs.id;
      if (excludedNext.has(`${exId}|${label}`)) { skippedNext++; continue; }
      nextVariants.push({ ...cs, label: `${cs.label} → ${label}`, suffixes, cmds: [...cs.cmds.slice(0, -1), command], tableExp: undefined });
    }
  }
  cases.push(...nextVariants);
  for (const cs of cases) {
    for (const [defHalt, delayFrames] of [[true, 0], [false, 0], [true, 6], [false, 6]] as const) {
      const g = await gcsimFrames(k, weapon, defHalt, cs.cmds, delayFrames);
      if (!g) continue;
      // gcsim の間隔は、遅延（delay）を含む。アプリの開始時刻の差も、遅延（delayAfter）を含む
      const gInterval = g[cs.index + 1] - g[cs.index];
      const stints = [{ id: 's1', characterId: c.id, actions: cs.suffixes.map(s => act(c, s, delayFrames / 60)) }];
      const res = calculateRotation([c], stints, { switchDelay: 0.5, defHalt });
      const acts = res.calculatedStints[0].actions.filter((a: any) => a.type !== 'swap');
      // 交代は、アクションの終わり（所要時間 + 遅延）まで
      const appInterval = acts[cs.index + 1]
        ? Math.round((acts[cs.index + 1].startTime - acts[cs.index].startTime) * 60)
        : Math.round((acts[cs.index].duration + delayFrames / 60) * 60);
      checked++;
      if (Math.abs(appInterval - gInterval) > TOLERANCE) fails.push(`${c.name} ${cs.label} (defhalt=${defHalt}・遅延 ${delayFrames}f): アプリ ${appInterval}f / gcsim ${gInterval}f（差 ${appInterval - gInterval}f）`);
    }
  }
}
// ---- 通常攻撃速度の効果の表（src/masterdata/attackSpeedEffects.ts。D221）: 表の行ごとに、シナリオを gcsim で実行して比べる ----
const { ATTACK_SPEED_EFFECTS } = await server.ssrLoadModule('/src/masterdata/attackSpeedEffects.ts');
const weaponsMaster: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const artifactsMaster: any[] = JSON.parse(fs.readFileSync('src/data/artifacts_master_data.json', 'utf8'));
const CHARS: Record<string, string> = { sword: '行秋', claymore: 'ライオス', polearm: '香菱', bow: 'アンバー', catalyst: 'リサ' };
for (const effect of ATTACK_SPEED_EFFECTS as any[]) {
  if (effect.source.type === 'character') continue;
  const isArtifact = effect.source.type === 'artifact';
  const art = isArtifact ? artifactsMaster.find(x => x.gcsimKey === effect.source.gcsimKey) : undefined;
  // 聖遺物の効果は、剣のキャラ（行秋）と標準の剣で測る。武器の効果は、その武器の持ち主
  const w = isArtifact ? { name: '標準の剣', weaponType: 'sword', gcsimKey: 'dullblade', id: undefined } : weaponsMaster.find(x => x.gcsimKey === effect.source.gcsimKey);
  if (!w || (isArtifact && !art)) { fails.push(`表の持ち主が、マスターに見つかりません: ${effect.source.gcsimKey}`); continue; }
  const candidates = characters.filter(c => c.weaponType === w.weaponType);
  const c = candidates.find(x => x.name === CHARS[w.weaponType]) ?? candidates[0];
  const hits: any[] = c.availableActions.find((a: any) => a.id === `${c.id}_n`)?.normalHits ?? [];
  const k = c.source.gcsimKey as string;
  // 命中でスタックする効果（複合弓・松韻の響く頃）は、効果が付くまで・上限まで、通常攻撃を続ける
  const stackish = (Array.isArray(effect.when) ? effect.when : [effect.when]).some((x: any) => x.kind === 'hitStacks' || x.kind === 'stackProc');
  const n = stackish ? 8 : Math.min(hits.length, 4);
  // シナリオ: 爆発の後なら、爆発 → 通常攻撃 ×(n + 1)。重撃の後なら、通常攻撃 → 重撃 → 通常攻撃 ×(n + 1)。それ以外は、通常攻撃 ×(n + 1)
  const kinds: string[] = (Array.isArray(effect.when) ? effect.when : [effect.when]).map((x: any) => x.kind);
  const prefix: string[] = kinds.includes('afterBurst') ? ['burst'] : kinds.includes('afterChargedAttack') ? ['attack', 'charge'] : [];
  for (const refine of isArtifact ? [1] : [1, 5]) {
    for (const [defHalt, delayFrames] of [[true, 6], [false, 0]] as const) {
      for (const nextCmd of ['attack', 'skill']) {
        const cmds = [...prefix, ...Array.from({ length: n }, () => 'attack'), nextCmd];
        const cfg = [
          `${k} char lvl=90/90 cons=0 talent=9,9,9;`,
          `${k} add weapon="${isArtifact ? w.gcsimKey : effect.source.gcsimKey}" refine=${refine} lvl=90/90;`,
          ...(isArtifact ? [`${k} add set="${effect.source.gcsimKey}" count=4;`] : []),
          `${k} add stats cr=1;`,
          `options iteration=1 duration=30 swap_delay=12 ignore_burst_energy=true${defHalt ? '' : ' defhalt=false'};`,
          'target lvl=100 resist=0.1;',
          `active ${k};`,
          cmds.map(x => `${k} ${x};${delayFrames > 0 ? ` delay(${delayFrames});` : ''}`).join(' '),
        ].join('\n');
        const res = await fetch(`${GCSIM_SERVER_URL}/sample/cw_${Date.now()}_${Math.random().toString(36).slice(2)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg, seed: 1 }) });
        const logs = (await res.json()).logs as any[];
        // 前置き（爆発・重撃）の後の、通常攻撃 n 段 + 次の実行フレーム
        const g = logs.filter(l => l.event === 'action' && /^executed (attack|charge|burst|skill)/.test(l.msg)).map(l => l.frame as number).slice(prefix.length);
        const cw: any = { ...structuredClone(c), weaponId: w.id ?? c.weaponId, weaponRefinementRank: refine, ...(isArtifact ? { artifactSetId: art.id, artifactSetMode: '4pc' } : {}) };
        const suffixOf = (x: string, i: number) => (x === 'burst' ? 'q' : x === 'charge' ? 'ca' : i === cmds.length - 1 && x === 'skill' ? 'e' : 'n');
        const stints = [{
          id: 's1', characterId: c.id,
          actions: cmds.map((x, i) => act(c, suffixOf(x, i), delayFrames / 60)),
        }];
        const r = calculateRotation([cw], stints, { switchDelay: 0.5, defHalt, database: { weapons: weaponsMaster, artifacts: artifactsMaster } });
        const acts = r.calculatedStints[0].actions.filter((a: any) => a.type !== 'swap');
        const offset = prefix.length;
        for (let i = 0; i < n; i++) {
          const gi = g[i + 1] - g[i];
          const ai = Math.round((acts[offset + i + 1].startTime - acts[offset + i].startTime) * 60);
          checked++;
          if (Math.abs(gi - ai) > TOLERANCE) fails.push(`${c.name}+${w.name}(精錬${refine}・${kinds.join('+')}) n${i + 1} → ${nextCmd} (defhalt=${defHalt}・遅延 ${delayFrames}f): アプリ ${ai}f / gcsim ${gi}f（差 ${ai - gi}f）`);
        }
      }
    }
  }
}
// ---- キャラの効果（D223）: 自分のアクションの列（と、交代の出入り）を gcsim と同じに並べて、通常攻撃の間隔を比べる ----
{
  const other = characters.find(x => x.name === CHARS.sword)!;
  type Step = { who: 'self' | 'other'; cmd: 'attack' | 'skill' | 'burst'; delay: number };
  const SUFFIX = { attack: 'n', skill: 'e', burst: 'q' } as const;
  for (const effect of (ATTACK_SPEED_EFFECTS as any[]).filter(e => e.source.type === 'character')) {
    const c = characters.find(x => x.source.gcsimKey === effect.source.gcsimKey);
    if (!c) { fails.push(`表のキャラが、マスターに見つかりません: ${effect.source.gcsimKey}`); continue; }
    const k = c.source.gcsimKey as string;
    if (process.env.HL_ONLY && process.env.HL_ONLY !== k) continue;
    const ok = other.source.gcsimKey as string;
    const kinds: string[] = (Array.isArray(effect.when) ? effect.when : [effect.when]).map((x: any) => x.kind);
    const conds: any[] = Array.isArray(effect.when) ? effect.when : [effect.when];
    const minCons = effect.source.minConstellation ?? 0;
    const A = (n: number, who: Step['who'] = 'self'): Step[] => Array.from({ length: n }, () => ({ who, cmd: 'attack', delay: 0 }));
    // シナリオ（名前・手順）
    const scenarios: { name: string; steps: Step[] }[] = [];
    const lead = kinds.includes('afterBurst') ? 'burst' : kinds.includes('afterSkill') ? 'skill' : undefined;
    const isTeam = effect.source.scope === 'team';
    // 会心のヒットが引き金: 通常攻撃の連続・スキルの後・内部 CT の前後（待機）
    if (kinds.includes('afterCritHit')) {
      const cond = conds.find(x => x.kind === 'afterCritHit');
      const wait = Math.round((cond.seconds + 0.5) * 60);
      scenarios.push({ name: '通常攻撃 ×6', steps: A(6) });
      scenarios.push({ name: 'スキル → 通常攻撃 ×4', steps: [{ who: 'self', cmd: 'skill', delay: 0 }, ...A(4)] });
      scenarios.push({ name: `通常攻撃 ×2 → 待機 ${wait}f → 通常攻撃 ×4`, steps: [...A(1), { who: 'self', cmd: 'attack', delay: wait }, ...A(4)] });
      scenarios.push({ name: '爆発 → 通常攻撃 ×4', steps: [{ who: 'self', cmd: 'burst', delay: 0 }, ...A(4)] });
    }
    if (lead && isTeam) {
      // 編成の全員に付く効果: 持ち主が使って、交代した相手（行秋）の通常攻撃で比べる
      const cond = conds.find(x => x.kind === (lead === 'burst' ? 'afterBurst' : 'afterSkill'));
      const gap = Math.max(0, Math.round((cond.seconds + (cond.delayFrames ?? 0) / 60) * 60) - 130);
      const leadStep: Step = { who: 'self', cmd: lead as any, delay: 0 };
      scenarios.push({ name: `${lead} → 交代して通常攻撃`, steps: [leadStep, ...A(4, 'other')] });
      scenarios.push({ name: `${lead} → 待機 ${gap}f → 交代して通常攻撃`, steps: [{ ...leadStep, delay: gap }, ...A(4, 'other')] });
      // 効果が切れたあと
      scenarios.push({ name: `${lead} → 待機 ${gap + 120}f → 交代して通常攻撃`, steps: [{ ...leadStep, delay: gap + 120 }, ...A(4, 'other')] });
      scenarios.push({ name: `${lead} → 持ち主も通常攻撃 → 交代して通常攻撃`, steps: [leadStep, ...A(2), ...A(4, 'other')] });
    } else if (lead) {
      const window = conds.find(x => x.kind === (lead === 'burst' ? 'afterBurst' : 'afterSkill')).seconds as number;
      const gap = Math.max(0, Math.round(window * 60) - 130);
      scenarios.push({ name: `${lead} → 通常攻撃`, steps: [{ who: 'self', cmd: lead as any, delay: 0 }, ...A(4)] });
      // 効果の終わりの近く（途中で切れる）
      scenarios.push({ name: `${lead} → 待機 ${gap}f → 通常攻撃`, steps: [{ who: 'self', cmd: lead as any, delay: gap }, ...A(4)] });
      // 控えに下がって戻る
      scenarios.push({ name: `${lead} → 通常攻撃 → 交代して戻る`, steps: [{ who: 'self', cmd: lead as any, delay: 0 }, ...A(2), ...A(1, 'other'), ...A(4)] });
    } else if (kinds.includes('afterEnterField')) {
      const icd = conds.find(x => x.kind === 'afterEnterField').icdSeconds as number;
      // 先頭 → 交代で出場（付く）→ すぐ交代して戻る（内部 CT で付かない）
      scenarios.push({ name: '出場 → 戻る（内部 CT）', steps: [...A(2), ...A(1, 'other'), ...A(3), ...A(1, 'other'), ...A(3)] });
      // 内部 CT が明けたあとに、また出場
      scenarios.push({ name: `出場 → ${icd} 秒後に戻る`, steps: [...A(2), ...A(1, 'other'), ...A(3), { who: 'other', cmd: 'attack', delay: icd * 60 }, ...A(3)] });
    }
    // 命ノ星座で値が変わる効果（レイザーの爆発は、命ノ星座 3 で天賦レベル +3）だけ、別の凸も測る
    // 放浪者: 風の加護の間は、gcsim は交代できない（実行が止まる）。アプリの状態は 10 秒（gcsim は 20 秒）なので、効果の終わり近くは比べられない
    if (k === 'wanderer') scenarios.splice(1);
    const cons = k === 'razor' ? [0, 3] : k === 'mika' ? [0, 5] : [minCons];
    for (const cn of cons) {
      for (const sc of scenarios) {
        for (const [defHalt, delayFrames] of [[true, 6], [false, 0]] as const) {
          const cfg = [
            `${k} char lvl=90/90 cons=${cn} talent=9,9,9;`,
            `${k} add weapon="${weapons[c.weaponType]}" refine=1 lvl=90/90;`,
            `${k} add stats cr=1;`,
            `${ok} char lvl=90/90 cons=0 talent=9,9,9;`,
            `${ok} add weapon="dullblade" refine=1 lvl=90/90;`,
            `${ok} add stats cr=1;`,
            `options iteration=1 duration=90 swap_delay=12 ignore_burst_energy=true${defHalt ? '' : ' defhalt=false'};`,
            'target lvl=100 resist=0.1;',
            `active ${k};`,
            sc.steps.map(st => `${st.who === 'self' ? k : ok} ${st.cmd};${st.delay + delayFrames > 0 ? ` delay(${st.delay + delayFrames});` : ''}`).join(' '),
          ].join('\n');
          const res = await fetch(`${GCSIM_SERVER_URL}/sample/cc_${Date.now()}_${Math.random().toString(36).slice(2)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg, seed: 1 }) });
          const logs = ((await res.json()).logs as any[]).filter(l => l.event === 'action' && /^executed (attack|skill|burst)/.test(l.msg));
          const g = logs.map(l => l.frame as number);
          if (g.length !== sc.steps.length) { fails.push(`${c.name}(C${cn}) ${sc.name}: gcsim の実行数が合いません（${g.length} / ${sc.steps.length}）`); continue; }
          const cw = { ...structuredClone(c), constellation: cn };
          const ow = structuredClone(other);
          // 連続する同じキャラの手順を、1 つの出場にまとめる
          const stints: any[] = [];
          for (const st of sc.steps) {
            const who = st.who === 'self' ? cw : ow;
            const last = stints[stints.length - 1];
            const a = act(who, SUFFIX[st.cmd], (st.delay + delayFrames) / 60);
            if (last && last.characterId === who.id) last.actions.push(a);
            else stints.push({ id: `s${stints.length + 1}`, characterId: who.id, actions: [a], holdMode: false });
          }
          const r = calculateRotation([cw, ow], stints, { switchDelay: 0.5, defHalt, database: { weapons: weaponsMaster } });
          const acts = r.calculatedStints.flatMap((s: any) => s.actions.filter((a: any) => a.type !== 'swap'));
          if (acts.length !== sc.steps.length) { fails.push(`${c.name}(C${cn}) ${sc.name}: アプリの行数が合いません（${acts.length} / ${sc.steps.length}）`); continue; }
          if (process.env.HL_DEBUG && defHalt) {
            console.log(`${c.name}(C${cn}) ${sc.name}`);
            console.log('  gcsim', g.slice(1).map((x, i) => x - g[i]).join(' '));
            console.log('  app  ', acts.slice(1).map((x: any, i: number) => Math.round((x.startTime - acts[i].startTime) * 60)).join(' '));
          }
          for (let i = 0; i + 1 < sc.steps.length; i++) {
            // 同じ出場の中の、通常攻撃の間隔だけ比べる（交代をまたぐ間隔は、交代の長さが違うので比べない）
            const subject = isTeam ? 'other' : 'self';
            if (sc.steps[i].who !== subject || sc.steps[i + 1].who !== subject || sc.steps[i].cmd !== 'attack') continue;
            const gi = g[i + 1] - g[i];
            const ai = Math.round((acts[i + 1].startTime - acts[i].startTime) * 60);
            checked++;
            // 効果の終わりの境目（待機の後）は、ヒットストップの延びの見積り（表の値）の誤差で、前後 2f ずれることがあるので、3f まで許す
            const tol = sc.name.includes('待機') ? 3 : TOLERANCE;
            if (Math.abs(gi - ai) > tol) fails.push(`${c.name}(C${cn}) ${sc.name} #${i + 1} (defhalt=${defHalt}・遅延 ${delayFrames}f): アプリ ${ai}f / gcsim ${gi}f（差 ${ai - gi}f）`);
          }
        }
      }
    }
  }
}
// ---- 重撃にも攻撃速度が掛かるキャラ（放浪者。D228）: ミカのスキル（編成の全員 +21%・12 秒）を受けた放浪者の、通常攻撃 → 重撃 → 通常攻撃 ----
{
  const owner = characters.find(x => x.source.gcsimKey === 'mika')!;
  const wan = characters.find(x => x.source.gcsimKey === 'wanderer')!;
  const ok = owner.source.gcsimKey as string, wk = wan.source.gcsimKey as string;
  const seqs: { name: string; wanSteps: string[] }[] = [
    { name: 'N → CA → N → CA → N', wanSteps: ['attack', 'charge', 'attack', 'charge', 'attack'] },
    { name: 'N N → CA → N', wanSteps: ['attack', 'attack', 'charge', 'attack'] },
    { name: 'CA（単独）→ N → CA', wanSteps: ['charge', 'attack', 'charge'] },
  ];
  for (const withBuff of [true, false]) {
    for (const sq of seqs) {
      for (const [defHalt, delayFrames] of [[true, 6], [false, 0]] as const) {
        const cfg = [
          `${ok} char lvl=90/90 cons=0 talent=9,9,9;`, `${ok} add weapon="${weapons[owner.weaponType]}" refine=1 lvl=90/90;`, `${ok} add stats cr=1;`,
          `${wk} char lvl=90/90 cons=0 talent=9,9,9;`, `${wk} add weapon="${weapons[wan.weaponType]}" refine=1 lvl=90/90;`, `${wk} add stats cr=1;`,
          `options iteration=1 duration=60 swap_delay=12 ignore_burst_energy=true${defHalt ? '' : ' defhalt=false'};`,
          'target lvl=100 resist=0.1;', `active ${ok};`,
          [...(withBuff ? [`${ok} skill;`] : [`${ok} attack;`]), ...sq.wanSteps.map(x => `${wk} ${x};${delayFrames > 0 ? ` delay(${delayFrames});` : ''}`)].join(' '),
        ].join('\n');
        const res = await fetch(`${GCSIM_SERVER_URL}/sample/wc_${Date.now()}_${Math.random().toString(36).slice(2)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg, seed: 1 }) });
        const logs = ((await res.json()).logs as any[]).filter(l => l.event === 'action' && /^executed (attack|charge|skill)/.test(l.msg));
        const g = logs.map(l => l.frame as number).slice(1);
        const cw = structuredClone(wan);
        const ow = structuredClone(owner);
        ow.constellation = 0;
        const sfx = (x: string) => (x === 'attack' ? 'n' : 'ca');
        const stints = [
          { id: 'o', characterId: ow.id, actions: [act(ow, withBuff ? 'e' : 'n', 0)], holdMode: false },
          { id: 'w', characterId: cw.id, actions: sq.wanSteps.map(x => act(cw, sfx(x), delayFrames / 60)), holdMode: false },
        ];
        const r = calculateRotation([ow, cw], stints, { switchDelay: 0.5, defHalt, database: { weapons: weaponsMaster } });
        const acts = r.calculatedStints[1].actions.filter((a: any) => a.type !== 'swap');
        for (let i = 0; i + 1 < sq.wanSteps.length; i++) {
          // 重撃の直後の通常攻撃は、構え（windup）が −2f になる（gcsim の attackWindupNormal）。アプリは、通常攻撃のこの違いを持っていない（攻撃速度とは別の、前からの差）ので、比べない
          if (sq.wanSteps[i] === 'attack' && sq.wanSteps[i - 1] === 'charge') continue;
          const gi = g[i + 1] - g[i];
          const ai = Math.round((acts[i + 1].startTime - acts[i].startTime) * 60);
          checked++;
          if (Math.abs(gi - ai) > TOLERANCE) fails.push(`放浪者（ミカのスキル${withBuff ? 'あり' : 'なし'}）${sq.name} #${i + 1} (defhalt=${defHalt}・遅延 ${delayFrames}f): アプリ ${ai}f / gcsim ${gi}f（差 ${ai - gi}f）`);
        }
      }
    }
  }
}
await server.close();
console.log(`検査 ${checked} 件 / 差が ${TOLERANCE}f を超える ${fails.length} 件 / 次の種類の測定で除外（対象外）${skippedNext} 組`);
for (const f of fails.slice(0, 60)) console.log('  ✗', f);
if (fails.length > 0) process.exit(1);
console.log('✓ アプリの事前計算と gcsim の実測が、ヒットストップを含めて一致している');
