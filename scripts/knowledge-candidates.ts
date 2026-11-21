/**
 * 編成例（data/knowledge-teams/<名前>.json。scripts/knowledge-teams.ts が Wiki から作る）の編成を、辞書なしで探索し、
 * 上位の結果から、キャラごとの運用型（Archetype）の候補を書き出す。
 *
 *   node scripts/knowledge-candidates.ts 胡桃
 *   オプション: --light（探索の絞りを強めて速くする。複数編成を探索するとき用。候補の質は少し粗くなる）--teams=1（探索する編成の数。Wiki の上から数える）--force（探索済みの編成も、やり直す）--aggregate-only（探索せず、保存済みの結果から候補だけを作り直す）
 *             --near=0.97（各編成の 1 位の DPS に対する、この割合以上の結果を、根拠に使う）--top=6
 *
 * 出力: data/knowledge-teams/results/<名前>/<番号>.json（編成ごとの探索結果）、
 *       data/knowledge-teams/<名前>.candidates.md（候補の一覧。辞書（src/masterdata/knowledge/characters.ts）に写す下書き付き）
 * 候補は、辞書に入れる前に、必ず「辞書ありで再探索して、効果を確かめる」こと（plan.md の胡桃の試験を参照）。
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const name = args.find(a => !a.startsWith('--'));
if (!name) { console.error('使い方: node scripts/knowledge-candidates.ts <キャラ名>（先に scripts/knowledge-teams.ts で編成例を作る）'); process.exit(1); }
const num = (k: string, d: number) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const NEAR = num('near', 0.97);
const TOP = num('top', 6);
const force = args.includes('--force');
const aggregateOnly = args.includes('--aggregate-only');

const file = `data/knowledge-teams/${name}.json`;
if (!fs.existsSync(file)) { console.error(`${file} がありません。先に node scripts/knowledge-teams.ts ${name} を実行してください`); process.exit(1); }
// 辞書なしの探索は時間がかかる（1 編成 5 分前後）ので、既定では、編成例の先頭（Wiki で一番上）の 1 件だけ。--teams=N で、先頭から N 件にする
const allTeams = (JSON.parse(fs.readFileSync(file, 'utf8')) as { teams: Array<{ title: string; members: string[] }> }).teams;
const teams = allTeams.slice(0, num('teams', 1));
const dir = `data/knowledge-teams/results/${name}`;
fs.mkdirSync(dir, { recursive: true });

// ── 1. 編成ごとに、辞書なしで探索する（画面の DPS 計算と同じ条件）──
if (!aggregateOnly) {
  for (const [i, t] of teams.entries()) {
    const out = `${dir}/${i + 1}.json`;
    if (fs.existsSync(out) && !force) { console.log(`[${i + 1}/${teams.length}] ${t.members.join(' ')}: 探索済み（飛ばす）`); continue; }
    console.log(`[${i + 1}/${teams.length}] ${t.title}: ${t.members.join(' ')} を探索中…`);
    const t0 = Date.now();
    try {
      execFileSync('node', ['scripts/search-rotation.ts', ...t.members, '--screen', ...(args.includes('--light') ? ['--runs1=2', '--keep1=150', '--keep2=4', '--runs2=10'] : ['--runs1=3', '--keep1=400', '--keep2=6', '--runs2=20']), `--top=${TOP}`, `--out=${out}`], { stdio: 'pipe', maxBuffer: 1 << 28 });
      console.log(`   完了（${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
    } catch (e: any) {
      console.log(`   失敗: ${String(e.stdout ?? e.message).split('\n').slice(-3).join(' / ').slice(0, 200)}`);
    }
  }
}

// ── 2. 結果から、キャラごとの使い方を取り出す ──
const master: any[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const byName = (n: string) => master.find(c => c.name === n);
const idOf = (n: string) => byName(n)?.id as string;
const nameOf = (id: string) => master.find(c => c.id === id)?.name ?? id;

interface Result { dps: number; rot: { loop: number; stints: Array<{ c: string; a: string[] }> } }
interface Use { use: string[]; fill: string[]; fillRepeat?: number; lead: string[]; slot: number }

/** 末尾が周期的な並び（E N C N C N C …）を、先頭（E）+ 繰り返しの単位（N C）+ 回数に分ける。周期が見つからなければ null */
function splitFill(actions: string[]): { prefix: string[]; unit: string[]; reps: number } | null {
  for (let k = 0; k <= Math.min(3, actions.length - 4); k++) {
    const rest = actions.slice(k);
    for (let p = 1; p <= Math.floor(rest.length / 2); p++) {
      if (rest.every((a, i) => a === rest[i % p])) {
        // 単位が 1 種類の動作だけ（N N N N…）は、通常攻撃などの連打として、そのまま単位にする
        return { prefix: actions.slice(0, k), unit: rest.slice(0, p), reps: Math.round(rest.length / p) };
      }
    }
  }
  return null;
}

function usesOf(r: Result, characterId: string): Use | null {
  const { loop, stints } = r.rot;
  const idx = stints.map((s, i) => ({ s, i })).filter(x => x.s.c === characterId);
  const lead = idx.filter(x => x.i < loop).flatMap(x => x.s.a);
  const inLoop = idx.filter(x => x.i >= loop);
  if (inLoop.length === 0) return null;
  // 周期の形が見つかる最後の出場を、アタッカーの「繰り返し」にする。それ以前の出場は、先置き（use）
  const last = inLoop[inLoop.length - 1];
  const sp = last.s.a.length >= 6 ? splitFill(last.s.a) : null;
  const before = inLoop.slice(0, -1);
  if (before.length > 1 || (before.length === 1 && !sp && last.s.a.length > 0 && inLoop.length > 2)) return null; // 3 回以上に分かれる出場は、候補にしない
  const use = [...before.flatMap(x => x.s.a), ...(sp ? sp.prefix : last.s.a)];
  // 出場の順番: 周回の中で、先置き（use のある出場）が何番目か
  const setupIdx = stints.slice(loop).map((s, i) => ({ s, i: i + loop })).filter(x => !(x.s === last.s && sp && sp.prefix.length === 0));
  const rank = Math.max(0, setupIdx.findIndex(x => x.s === (before[0]?.s ?? last.s)));
  return { use, fill: sp ? sp.unit : [], fillRepeat: sp?.reps, lead, slot: rank };
}

// ── 3. 編成をまたいで集計する ──
interface Agg { sig: Use; teams: Array<{ title: string; members: string[]; dps: number; rank: number }>; reps: Set<number>; slots: number[] }
const perChar = new Map<string, Map<string, Agg>>();
let used = 0;
for (const [i, t] of teams.entries()) {
  const f = `${dir}/${i + 1}.json`;
  if (!fs.existsSync(f)) continue;
  const results: Result[] = JSON.parse(fs.readFileSync(f, 'utf8')).results;
  if (results.length === 0) continue;
  const best = results[0].dps;
  for (const [rank, r] of results.entries()) {
    if (r.dps < best * NEAR) continue;
    used++;
    for (const m of t.members) {
      const id = idOf(m);
      const u = usesOf(r, id);
      if (!u) continue;
      const key = JSON.stringify([u.use, u.fill, u.lead]);
      const map = perChar.get(id) ?? new Map<string, Agg>();
      perChar.set(id, map);
      const a = map.get(key) ?? { sig: u, teams: [], reps: new Set<number>(), slots: [] };
      map.set(key, a);
      if (!a.teams.some(x => x.title === t.title && x.members.join() === t.members.join() && x.rank === rank)) a.teams.push({ title: t.title, members: t.members, dps: r.dps, rank: rank + 1 });
      if (u.fillRepeat) a.reps.add(u.fillRepeat);
      a.slots.push(u.slot);
    }
  }
}

// ── 4. 候補を書き出す ──
const existing = (id: string): any[] => {
  const f = `public/knowledge/chars/${id}.json`;
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).archetypes : [];
};
const q = (xs: string[]) => `[${xs.map(x => `'${x}'`).join(', ')}]`;
const lines: string[] = [];
lines.push(`# ${name} の編成例から作った辞書の候補`, '', `編成 ${teams.length} 件・根拠に使った結果 ${used} 件（各編成の 1 位の ${(NEAR * 100).toFixed(0)}% 以上）。**辞書に入れる前に、辞書ありで再探索して効果を確かめる**。`, '');
for (const [id, map] of perChar) {
  const m = master.find(c => c.id === id);
  const roles: string[] = m?.roles ?? [];
  lines.push(`## ${nameOf(id)}（${id}）`, '');
  const entries = [...map.values()].sort((a, b) => b.teams.length - a.teams.length || Math.max(...b.teams.map(t => t.dps)) - Math.max(...a.teams.map(t => t.dps)));
  const same = (a: any, b: Use) => JSON.stringify([a.use ?? [], a.fill ?? [], a.lead ?? []]) === JSON.stringify([b.use, b.fill, b.lead]);
  for (const a of entries) {
    const s = a.sig;
    const role = s.fill.length > 0 || roles.includes('attacker') ? 'attacker' : roles.includes('subAttacker') ? 'subAttacker' : 'supporter';
    const slotMedian = [...a.slots].sort((x, y) => x - y)[Math.floor(a.slots.length / 2)];
    const slot = role === 'attacker' && s.use.length === 0 ? 40 : (slotMedian + 1) * 10;
    const titles = [...new Set(a.teams.map(t => t.title.replace(/\s*\(.*$/, '')))];
    // 編成の条件: 出た編成の全部に共通する、ほかのキャラ（出た編成が全編成の一部のときだけ）
    const memberSets = [...new Set(a.teams.map(t => t.members.join()))].map(k => k.split(',').filter(x => x !== nameOf(id)));
    const common = memberSets.reduce((acc, xs) => acc.filter(x => xs.includes(x)), memberSets[0] ?? []);
    const allTeams = new Set(a.teams.map(t => t.members.join())).size === teams.length;
    const withC = allTeams ? [] : common.map(idOf);
    const best = Math.max(...a.teams.map(t => t.dps));
    const reps = [...a.reps].sort((x, y) => x - y);
    const dup = existing(id).some(e => same(e, s));
    const tag = dup ? '（辞書に既にある形）' : s.fill.length === 0 && s.use.length > 8 ? '（長く周期がないので、項目にしない・参考）' : '';
    lines.push(`- ${tag}**${[s.lead.length ? `先頭 ${s.lead.join(' ')} → ` : '', s.use.join(' '), s.fill.length ? ` → ${s.fill.join(' ')}×${reps.join('/') || '?'}` : ''].join('') || '（出場だけ）'}**  — 出た編成 ${titles.length} 種（${titles.join('・')}）、最高 ${(best / 1000).toFixed(1)}k`);
    const noisy = s.fill.length === 0 && s.use.length > 8; // 長いのに周期がない並びは、辞書の項目にしない（参考として載せるだけ）
    if (!dup && !noisy) {
      const ev = `編成例の探索（${titles.slice(0, 3).join('・')}）の上位に出る形。最高 ${(best / 1000).toFixed(1)}k。実測（辞書ありの再探索）: 未`;
      const parts = [`name: '${[s.lead.length ? `先頭 ${s.lead.join(' ')}・` : '', s.use.join(' '), s.fill.length ? ` のあと ${s.fill.join(' ')} を繰り返す` : ''].join('')}'`, `role: '${role}'`, `slot: ${slot}`, `use: ${q(s.use)}`];
      if (s.fill.length) parts.push(`fill: ${q(s.fill)}`, `fillRepeat: [${reps.join(', ')}]`);
      if (s.lead.length) parts.push(`lead: ${q(s.lead)}`);
      if (withC.length) parts.push(`withCharacters: ${q(withC)}`);
      parts.push(`evidence: '${ev}'`);
      lines.push('  ```ts', `  { ${parts.join(', ')} },`, '  ```');
    }
  }
  lines.push('');
}
const outMd = `data/knowledge-teams/${name}.candidates.md`;
fs.writeFileSync(outMd, lines.join('\n'));
console.log(`候補を ${outMd} に書きました（${perChar.size} キャラ・結果 ${used} 件を使用）`);
