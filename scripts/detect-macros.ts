/**
 * 「ひとまとまりで使うと初めて効く並び」を、gcsim で自動検出する（sequenceRules の SEQUENCE_MACROS の候補を出す）。
 *
 * 基準の回転（--rot。探索や手組みの結果）に、各キャラの出場の先頭 / 末尾へ、並びの候補（E×2〜4・長押し→Q・E→通常×3 など）を差し込んで DPS を測る。
 * 並び全体の増分が大きく（基準の --min 割以上）、最後の 1 手を除いた形の増分が、その --ratio 倍以下（= 途中までだと効かない）なら、「ひとまとまりの並び」と判定する。
 *
 *   node scripts/detect-macros.ts ナヒーダ ニィロウ コロンビーナ ラウマ --owned=… --rot=回転.json [--seconds=60 --runs=5 --min=0.03 --ratio=0.3 --write]
 *   --write: src/masterdata/sequenceMacros.detected.json に、検出したものを足す（手書きの SEQUENCE_MACROS にあるものは足さない）
 */
import fs from 'node:fs';
import { createServer } from 'vite';
import { useNodeGcsim } from './gcsim-node.ts';

const args = process.argv.slice(2);
const str = (name: string) => args.find(x => x.startsWith(`--${name}=`))?.split('=')[1];
const num = (name: string, def: number) => { const s = str(name); return s ? Number(s) : def; };
const names = args.filter(x => !x.startsWith('--'));
const SECONDS = num('seconds', 60);
const RUNS = num('runs', 5);
const MIN = num('min', 0.03);
const RATIO = num('ratio', 0.3);
const rot = JSON.parse(fs.readFileSync(str('rot')!, 'utf8'));

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
await useNodeGcsim(server);
const cs = await server.ssrLoadModule('/src/utils/customStats.ts');
const imp = await server.ssrLoadModule('/src/utils/hoyolab/importCharacters.ts');
const { buildGcsimConfig } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');
const { computeDps } = await server.ssrLoadModule('/src/utils/gcsim/dpsCalc.ts');
const { runGcsimSample } = await server.ssrLoadModule('/src/utils/gcsim/gcsimClient.ts');
const rules = await server.ssrLoadModule('/src/masterdata/sequenceRules.ts');

const master: any[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const weapons: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const artifacts: any[] = JSON.parse(fs.readFileSync('src/data/artifacts_master_data.json', 'utf8'));
const ownedPath = str('owned');
const owned: any[] = ownedPath ? JSON.parse(fs.readFileSync(ownedPath, 'utf8')).characters : [];
const characters: any[] = [];
for (const n of names) {
  const m = master.find(c => c.name === n || c.englishName === n);
  const o = ownedPath ? owned.find(x => imp.matchMasterCharacterId(x, [m.id]) === m.id) : undefined;
  if (o) characters.push({ ...structuredClone(m), ...imp.ownedToPartyFields(o, { weapons, artifacts }).fields });
  else characters.push({ ...structuredClone(m), ...cs.defaultEquipmentFor(m.id, { weapons, artifacts }), customStats: cs.defaultCustomStatsFor(m.id) });
}

let n = 0;
const measure = async (stintsSpec: Array<{ c: string; a: string[] }>): Promise<number | undefined> => {
  const stints = stintsSpec.map((s, i) => {
    const c = characters.find(x => x.id === s.c);
    return {
      id: `s${i}`, characterId: s.c,
      actions: s.a.map(step => { const def = c.availableActions.find((a: any) => a.id === `${c.id}_${step}`); return { id: `a${++n}`, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration }; }),
    };
  });
  const pre = rules.prerequisiteViolations(stints, (id: string) => characters.find(c => c.id === id)?.element);
  if (pre.length > 0) return undefined;
  const cfg = buildGcsimConfig({ characters, stints, loopStartIndex: rot.loop ?? 0, switchDelay: 0.5, defHalt: true, weapons, artifacts, battleSeconds: SECONDS });
  if (!cfg.runnable) return undefined;
  try {
    const out = await computeDps({ config: cfg, runs: RUNS, parallel: 6, run: runGcsimSample, context: { battleSeconds: SECONDS } });
    return out.status === 'ok' ? out.result.dps.mean : undefined;
  } catch { return undefined; }
};

const VOCAB: string[][] = [
  ['e', 'e'], ['e', 'e', 'e'], ['e', 'e', 'e', 'e'], ['e_hold', 'q'], ['e', 'n', 'n', 'n'], ['e', 'ca'], ['e', 'e_recast'], ['ca', 'ca', 'ca'], ['n', 'n', 'n', 'n'], ['e', 'q'],
];
const has = (cid: string, step: string) => !!characters.find(c => c.id === cid)?.availableActions.some((a: any) => a.id === `${cid}_${step}`);
const base = await measure(rot.stints);
if (base === undefined) { console.error('基準の回転が測れません'); process.exit(1); }
console.log(`基準 ${(base / 1000).toFixed(1)}k（戦闘 ${SECONDS} 秒・${RUNS} 回）`);

const found: Array<{ characterId: string; steps: string[]; gain: number; prefixGain: number }> = [];
// その並びの種類のスキル・爆発（e / e_hold / e_recast / q）を、基準の出場から外した形を土台にして、並びを先頭 / 末尾へ差し込む（基準にすでにある E に足し算されて、回数が変わるのを避ける）
const withGram = (cid: string, gram: string[], strip: Set<string>, pos: 'start' | 'end' | 'none'): Array<{ c: string; a: string[] }> => {
  const idx = rot.stints.findIndex((s: any) => s.c === cid);
  const out: Array<{ c: string; a: string[] }> = [];
  rot.stints.forEach((s: any, i: number) => {
    if (i !== idx) { out.push(s); return; }
    const rest = s.a.filter((x: string) => !strip.has(x));
    const a = pos === 'start' ? [...gram, ...rest] : pos === 'end' ? [...rest, ...gram] : rest;
    if (a.length > 0) out.push({ c: s.c, a });
  });
  return out;
};
const gainOf = async (cid: string, gram: string[], strip: Set<string>): Promise<number> => {
  const b0 = await measure(withGram(cid, [], strip, 'none'));
  if (b0 === undefined) return -Infinity;
  let b = -Infinity;
  for (const pos of ['start', 'end'] as const) { const d = await measure(withGram(cid, gram, strip, pos)); if (d !== undefined && d - b0 > b) b = d - b0; }
  return b;
};
for (const c of characters) {
  for (const gram of VOCAB) {
    if (!gram.every(s => has(c.id, s))) continue;
    const strip = new Set<string>();
    if (gram.some(s => s === 'e' || s === 'e_hold' || s === 'e_recast')) for (const s of ['e', 'e_hold', 'e_recast']) strip.add(s);
    if (gram.includes('q')) strip.add('q');
    const full = await gainOf(c.id, gram, strip);
    const prefix = gram.length > 1 ? await gainOf(c.id, gram.slice(0, -1), strip) : -Infinity;
    // 相乗: 最後の 1 手を、この並びの途中までの後に置いたときの増分が、その 1 手を単独で使ったときの増分より、基準の MIN 割以上大きい（例: 長押し E の後の Q）
    let synergy = -Infinity;
    if (gram.length > 1 && prefix !== -Infinity && full !== -Infinity) {
      const last = gram[gram.length - 1];
      const alone = await gainOf(c.id, [last], new Set(last === 'q' ? ['q'] : ['e', 'e_hold', 'e_recast'].includes(last) ? ['e', 'e_hold', 'e_recast'] : []));
      if (alone !== -Infinity) synergy = full - prefix - alone;
    }
    const allOrNothing = full >= base * MIN && (prefix === -Infinity || prefix <= full * RATIO);
    const tag = allOrNothing ? '★ひとまとまり' : synergy >= base * MIN * 2 ? `★相乗 +${(synergy / 1000).toFixed(1)}k` : '';
    console.log(`${c.name.padEnd(8)} ${gram.join(' ').padEnd(22)} 全体 ${full === -Infinity ? '失敗' : (full / 1000).toFixed(1) + 'k'}  途中まで ${prefix === -Infinity ? '失敗' : (prefix / 1000).toFixed(1) + 'k'} ${tag}`);
    if (tag && gram.length > 1) found.push({ characterId: c.id, steps: gram, gain: full, prefixGain: prefix === -Infinity ? 0 : prefix });
  }
}
if (args.includes('--write')) {
  const p = 'src/masterdata/sequenceMacros.detected.json';
  const cur: Array<{ characterId: string; steps: string[] }> = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const f of found) {
    if ((rules.SEQUENCE_MACROS[f.characterId] ?? []).some((m: string[]) => m.join() === f.steps.join())) continue;
    if (!cur.some(x => x.characterId === f.characterId && x.steps.join() === f.steps.join())) cur.push({ characterId: f.characterId, steps: f.steps });
  }
  fs.writeFileSync(p, JSON.stringify(cur, null, 1) + '\n');
  console.log(`${p} に書きました（${cur.length} 件）`);
}
await server.close();
process.exit(0);
