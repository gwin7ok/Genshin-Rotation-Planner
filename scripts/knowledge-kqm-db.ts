/**
 * KQM Sim Database（https://db.kqm.gg。gcsim の設定ファイルの公開データベース）から、キャラごとの「実際に使われている行動の形」を集計する。
 * 辞書（src/masterdata/knowledge/characters.ts）の、形の裏付け・追加・修正の材料を作る調査道具。
 *
 *   node scripts/knowledge-kqm-db.ts --fetch            DB の全件を .cache/kqm-db/ に取得（1 秒おき・約 60 回・約 31 MB。取得済みのページは飛ばす。--refresh で取り直す）
 *   node scripts/knowledge-kqm-db.ts イファ 魈            キャラごとの集計を表示し、.cache/kqm-db/<名前>.md に書く
 *   node scripts/knowledge-kqm-db.ts --all               全キャラ（<名前>.md だけ書く）
 *   オプション: --top=8（表示する形の数）--min=1（この件数未満の形は出さない）
 *
 * 集計の方法: 設定の行動リスト（`active` 以降）を読み、`<キャラ> 行動, 行動;` の文を、同じキャラが続くまとまり（出場）に区切る。
 * 出場ごとの行動を、辞書の行動 ID（n・ca・e・e_hold・q・dash・jump・hp・lp。それ以外は gcsim の書式のまま）に直し、形ごとに件数と DPS（平均・最大）を数える。
 * `if`・`while` の中の文は、頭に「?」を付ける（辞書には写せない条件つきの行動）。
 * 設定ファイルそのものは、取り込まない（行動の形の集計だけを使う。docs/gcsim-integration/phase-9-auto-rotation-search/外部ローテーション調査.md）。
 */
import fs from 'node:fs';

const CACHE = '.cache/kqm-db';
const args = process.argv.slice(2);
const opt = (k: string, d: number) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

if (args.includes('--fetch')) {
  fs.mkdirSync(CACHE, { recursive: true });
  for (let p = 0; p < 500; p++) {
    const f = `${CACHE}/p${p}.json`;
    if (fs.existsSync(f) && !args.includes('--refresh')) continue;
    const q = encodeURIComponent(JSON.stringify({ limit: 100, skip: p * 100 }));
    let res: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(`https://db.kqm.gg/api/db?q=${q}`, { headers: { 'User-Agent': 'Mozilla/5.0 (knowledge-kqm-db script)' } });
      if (res.status !== 429) break;
      await sleep(8000 * 2 ** attempt);
    }
    if (!res || !res.ok) { console.error(`取得できません: p${p}（${res?.status}）`); process.exit(1); }
    const text = await res.text();
    if ((JSON.parse(text).data ?? []).length === 0) { console.log(`p${p} は空: ここまでで全件`); break; }
    fs.writeFileSync(f, text);
    console.log(`p${p} 取得`);
    await sleep(1000);
  }
  process.exit(0);
}

type Entry = { config: string; description?: string; summary?: { char_names?: string[]; mean_dps_per_target?: number } };
const entries: Entry[] = fs.existsSync(CACHE)
  ? fs.readdirSync(CACHE).filter(f => /^p\d+\.json$/.test(f)).flatMap(f => JSON.parse(fs.readFileSync(`${CACHE}/${f}`, 'utf8')).data as Entry[])
  : [];
if (entries.length === 0) { console.error('データがありません。先に node scripts/knowledge-kqm-db.ts --fetch を実行してください'); process.exit(1); }

const master: any[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const keyOf = new Map<string, string>(master.filter(c => c.source?.gcsimKey).map(c => [c.name, c.source.gcsimKey]));
const nameOfKey = new Map<string, string>([...keyOf].map(([n, k]) => [k, n]));

// 行動 1 つ（`attack:2`・`skill[hold=1]` など）を、辞書の行動 ID の並びに直す
const ACTION: Record<string, string> = { attack: 'n', charge: 'ca', skill: 'e', burst: 'q', dash: 'dash', jump: 'jump', high_plunge: 'hp', low_plunge: 'lp' };
const translate = (raw: string): string[] => {
  const m = /^([a-z_]+)(\[[^\]]*\])?(?::(\d+))?$/.exec(raw.trim());
  if (!m) return [raw.trim()];
  let id = ACTION[m[1]] ?? m[1];
  if (m[1] === 'skill' && /hold\s*=\s*1/.test(m[2] ?? '')) id = 'e_hold';
  return Array(Number(m[3] ?? 1)).fill(id);
};
// 連続する同じ行動は「×N」にまとめて、読みやすくする
const compact = (ids: string[]): string => {
  const out: string[] = [];
  for (const id of ids) { const l = out[out.length - 1]; if (l && l.id === id) l.n++; else out.push({ id, n: 1 } as any); }
  return (out as any[]).map(x => (x.n > 1 ? `${x.id}×${x.n}` : x.id)).join(' ');
};

type Stint = { who: string; actions: string[] };
// 行動リスト（`active` 以降）を、出場（同じキャラが続くまとまり）に区切る
const stintsOf = (config: string, team: string[]): Stint[] => {
  // 設定の中のキャラ名は、短い別名（itto・kazuha …）のことがある。`<別名> char …` の宣言の順が、編成（char_names）の順と同じことを使って、キー（aratakiitto …）に直す
  const aliases = [...config.matchAll(/^\s*([a-z0-9_]+)\s+char(?![a-z_])/gm)].map(m => m[1]);
  const keyOfAlias = new Map<string, string>(aliases.length === team.length ? aliases.map((al, i) => [al, team[i]]) : team.map(k => [k, k]));
  const i = config.indexOf('active ');
  if (i < 0) return [];
  const text = config.slice(i).replace(/#[^\n]*/g, '');
  const stints: Stint[] = [];
  const condDepth: boolean[] = []; // いま入っているブロックが、条件つき（if・while・else）か
  let pos = 0;
  while (pos < text.length) {
    const rest = text.slice(pos);
    const ws = /^\s+/.exec(rest);
    if (ws) { pos += ws[0].length; continue; }
    if (text[pos] === '}') { condDepth.pop(); pos++; continue; }
    if (text[pos] === '{') { condDepth.push(false); pos++; continue; } // 見出しのない { }（読み飛ばさず、入れ子の深さだけ合わせる）
    if (text[pos] === ';') { pos++; continue; }
    const head = /^(for|if|else|while|let|switch|fn)\b/.exec(rest);
    if (head) {
      if (head[1] === 'let') { const e = rest.indexOf(';'); pos += e < 0 ? rest.length : e + 1; continue; }
      const e = rest.indexOf('{');
      if (e < 0) break;
      condDepth.push(head[1] === 'if' || head[1] === 'else' || head[1] === 'while');
      pos += e + 1;
      continue;
    }
    const e = rest.search(/[;{}]/);
    if (e < 0) break;
    const stmt = rest.slice(0, e).trim();
    pos += e + (rest[e] === ';' ? 1 : 0);
    const m = /^([a-z0-9_]+)\s+(.+)$/s.exec(stmt);
    if (!m || !keyOfAlias.has(m[1])) continue;
    const who = keyOfAlias.get(m[1])!;
    const cond = condDepth.some(Boolean);
    const acts = m[2].split(',').flatMap(translate).map(a => (cond ? `?${a}` : a));
    const last = stints[stints.length - 1];
    if (last && last.who === who) last.actions.push(...acts); else stints.push({ who, actions: acts });
  }
  return stints;
};

const TOP = opt('top', 8), MIN = opt('min', 1);
const wanted = args.includes('--all') ? [...keyOf.keys()] : args.filter(a => !a.startsWith('--'));
if (wanted.length === 0) { console.error('使い方: node scripts/knowledge-kqm-db.ts <キャラ名...> | --all | --fetch'); process.exit(1); }

const parsed = entries.map(e => ({ e, stints: stintsOf(e.config, e.summary?.char_names ?? []), dps: e.summary?.mean_dps_per_target ?? 0, team: e.summary?.char_names ?? [] }));
fs.mkdirSync(CACHE, { recursive: true });
for (const name of wanted) {
  const key = keyOf.get(name) ?? name;
  const mine = parsed.filter(p => p.team.includes(key));
  const lines: string[] = [];
  lines.push(`# ${name}（${key}）: KQM DB ${mine.length} 件`);
  if (mine.length === 0) { lines.push('（データなし）'); }
  // 形ごとの集計: 出場の行動の並び → 件数・DPS
  const forms = new Map<string, { n: number; dps: number[]; first: number }>();
  const perEntryCounts: number[] = [];
  for (const p of mine) {
    const st = p.stints.filter(s => s.who === key);
    perEntryCounts.push(st.length);
    const seen = new Set<string>();
    st.forEach((s, idx) => {
      const f = compact(s.actions);
      if (seen.has(f)) return; // 1 件の中で同じ形が何度出ても、1 件と数える
      seen.add(f);
      const r = forms.get(f) ?? { n: 0, dps: [], first: 0 };
      r.n++; r.dps.push(p.dps); if (idx === 0) r.first++;
      forms.set(f, r);
    });
  }
  if (mine.length > 0) {
    const avgStints = perEntryCounts.reduce((a, b) => a + b, 0) / perEntryCounts.length;
    lines.push(`1 周の出場回数: 平均 ${avgStints.toFixed(1)} 回（1 回だけの設定 ${perEntryCounts.filter(n => n === 1).length} 件 / 2 回以上 ${perEntryCounts.filter(n => n >= 2).length} 件）。? は条件つきの行動（if・while の中）`);
    lines.push('', '## 出場の形（件数順。件数は、その形が 1 回でも出た設定の数）');
    const sorted = [...forms].filter(([, r]) => r.n >= MIN).sort((a, b) => b[1].n - a[1].n).slice(0, TOP);
    for (const [f, r] of sorted) {
      const avg = r.dps.reduce((a, b) => a + b, 0) / r.dps.length;
      lines.push(`- ${r.n} 件（最初の出場 ${r.first} 件）平均 ${(avg / 1000).toFixed(1)}k・最大 ${(Math.max(...r.dps) / 1000).toFixed(1)}k: ${f}`);
    }
    // 複数回の出場の形: 出場の並び（このキャラの出場は形、ほかのキャラは名前）ごとに、件数と DPS。条件つき（?）・swap を含むものは除く
    const seqs = new Map<string, { n: number; dps: number[] }>();
    for (const p of mine) {
      if (p.stints.filter(s => s.who === key).length < 2) continue;
      if (p.stints.some(s => s.who === key && s.actions.some(a => a.startsWith('?') || a === 'swap'))) continue;
      const seq = process.env.SEQ_ONLY_SELF ? p.stints.filter(s => s.who === key).map(s => `[${compact(s.actions)}]`).join(' ') : p.stints.map(s => (s.who === key ? `[${compact(s.actions)}]` : `(${nameOfKey.get(s.who) ?? s.who})`)).join(' ');
      const r = seqs.get(seq) ?? { n: 0, dps: [] }; r.n++; r.dps.push(p.dps); seqs.set(seq, r);
    }
    if (seqs.size > 0) {
      lines.push('', '## 複数回出場の形（出場の並び。[ ] がこのキャラ、( ) がほかのキャラ。件数順）');
      for (const [q, r] of [...seqs].sort((a, b) => b[1].n - a[1].n).slice(0, TOP)) lines.push(`- ${r.n} 件 平均 ${(r.dps.reduce((a, b) => a + b, 0) / r.dps.length / 1000).toFixed(1)}k・最大 ${(Math.max(...r.dps) / 1000).toFixed(1)}k: ${q}`);
    }
    const best = [...mine].sort((a, b) => b.dps - a.dps).slice(0, 3);
    lines.push('', '## DPS が高い設定の、この人の出場（上位 3 件）');
    for (const p of best) {
      lines.push(`- ${(p.dps / 1000).toFixed(1)}k ${p.team.map(k => nameOfKey.get(k) ?? k).join('・')}: ${p.stints.filter(s => s.who === key).map(s => `[${compact(s.actions)}]`).join(' → ') || '（読み取れず）'}`);
      if (p.e.description) lines.push(`    説明: ${p.e.description.replace(/\s+/g, ' ').slice(0, 160)}`);
    }
  }
  // いまの辞書の形（比べる用）
  const kidx = JSON.parse(fs.readFileSync('public/knowledge/index.json', 'utf8')).chars;
  const id = master.find(c => c.name === name)?.id;
  if (id && kidx[id]) {
    lines.push('', '## いまの辞書の形');
    for (const a of JSON.parse(fs.readFileSync(`public/knowledge/${kidx[id]}`, 'utf8')).archetypes) lines.push(`- ${a.name}（${a.role}）: ${compact(a.use)}${a.fill ? ` + ${compact(a.fill)} を繰り返す` : ''}`);
  }
  fs.writeFileSync(`${CACHE}/${name}.md`, lines.join('\n') + '\n');
  if (!args.includes('--all')) console.log(lines.join('\n') + '\n');
}
if (args.includes('--all')) console.log(`${wanted.length} キャラ分を ${CACHE}/<名前>.md に書きました`);
