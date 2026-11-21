/**
 * Wiki（wikiwiki.jp 原神Wiki）のキャラのページから、「編成例」の編成（4 人）を取り出して、編成例のファイルに書く。
 * 辞書の候補づくり（scripts/knowledge-candidates.ts）の、入力を作る。
 *
 *   node scripts/knowledge-teams.ts 胡桃
 *   node scripts/knowledge-teams.ts 魈 --page=ショウ   （Wiki のページ名が違うとき）
 *   → data/knowledge-teams/胡桃.json  { character, source, teams: [{ title, members: [名前 ×4] }] }
 *
 * 読み取りの方法: 「編成例」の見出し以下にある、「キャラ」の行の表を、編成 1 つとして読む。
 * 4 人そろわない表（自由枠など）・マスターにいない／gcsim 未対応のキャラを含む表は、飛ばして理由を表示する。
 * 出力は、そのまま使わず、中身を見て不要な編成を消してよい（ファイルは手で直せる）。
 */
import fs from 'node:fs';

const name = process.argv.slice(2).find(a => !a.startsWith('--'));
const pageName = process.argv.slice(2).find(a => a.startsWith('--page='))?.slice(7) ?? name; // Wiki のページ名が、キャラ名と違うとき（魈 → ショウ）
if (!name) { console.error('使い方: node scripts/knowledge-teams.ts <キャラ名>（例: 胡桃）'); process.exit(1); }

const url = `https://wikiwiki.jp/genshinwiki/${encodeURIComponent(pageName!)}`;
// 429（アクセス間隔が短すぎる）のときは、間を開けて、読み直す（10 秒 → 20 秒 → 40 秒 → 80 秒。Retry-After があれば、それに従う）
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let res: Response | undefined;
for (let attempt = 0; attempt < 5; attempt++) {
  res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (knowledge-teams script)' } });
  if (res.status !== 429) break;
  const wait = Math.max(Number(res.headers.get('retry-after')) * 1000 || 0, 10000 * 2 ** attempt);
  console.error(`429（アクセス制限）。${wait / 1000} 秒待って読み直します（${attempt + 1}/5）`);
  await sleep(wait);
}
if (!res || !res.ok) { console.error(`ページを取得できません: ${url}（${res?.status}）`); process.exit(1); }
const html = (await res.text()).replace(/<script[\s\S]*?<\/script>/g, '');

const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const heads = [...html.matchAll(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/g)].map(m => ({ pos: m.index!, level: Number(m[1]), text: strip(m[2]).replace(/\s*†\s*$/, '') }));
const start = heads.find(h => h.text.startsWith('編成例'));
if (!start) { console.error('「編成例」の見出しが見つかりません'); process.exit(1); }
// 終わり: 「編成」を含まない h2 の見出し（Wiki の見出しの階層は不ぞろい。たたみ表示の見出しは h3・h4 なので、h2 だけで区切る）
const end = heads.find(h => h.pos > start.pos && h.level <= 2 && !h.text.includes('編成'))
  ?? { pos: html.length };
const seg = html.slice(start.pos, end.pos);

const master: any[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const known = (n: string) => master.find(c => c.name === n && c.source?.gcsimKey);

type Team = { title: string; members: string[]; filled?: string[] };
const teams: Team[] = [];
const skipped: string[] = [];
let title = '';

// 表の枠が、キャラ名ではなく、元素名（水.svg・「炎元素キャラ」）や空欄のとき、条件に合うキャラを、どれでもよいので選ぶ
const ELEMENT: Record<string, string> = { 水: 'hydro', 炎: 'pyro', 火: 'pyro', 氷: 'cryo', 雷: 'electro', 風: 'anemo', 草: 'dendro', 岩: 'geo' };
const PREFER = ['ベネット', '鍾離', 'フリーナ', 'ナヒーダ', '行秋', '香菱', '夜蘭', 'ファルザン', 'シトラリ', 'フィッシュル', 'ジン', 'アルベド']; // 先に選ぶ（サポート向きの定番）
const pickFor = (element: string | undefined, taken: Set<string>): string | undefined => {
  const ok = (c: any) => c.source?.gcsimKey && !taken.has(c.name) && (!element || String(c.id).endsWith(`-${element}`));
  for (const n of PREFER) { const c = master.find(x => x.name === n); if (c && ok(c)) return c.name; }
  return master.find(c => ok(c) && !(c.roles ?? []).every((r: string) => r === 'attacker'))?.name ?? master.find(ok)?.name;
};
type Slot = { name?: string; element?: string; unknown?: string };
const slotOf = (cell: string): Slot => {
  const raw = [...cell.matchAll(/title="([^"]*)"/g)].map(x => x[1].replace(/^nolink\)&gt;/, '').replace(/_[0-9a-z]*\.webp$/, '')).find(t => t.length > 0);
  if (!raw) return {}; // 空欄（自由枠）
  const t = raw === pageName ? name! : raw;
  const el = /^(.)(?:[A-Z])?\.svg$/.exec(t)?.[1] ?? /^(.)元素/.exec(t)?.[1];
  if (el && ELEMENT[el]) return { element: ELEMENT[el] };
  return master.some(c => c.name === t) ? { name: t } : { unknown: t };
};

for (const m of seg.matchAll(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>|<tr><th[^>]*>キャラ<\/th>([\s\S]*?)<\/tr>(?:\s*<tr>(?!<th)([\s\S]*?)<\/tr>)?/g)) {
  if (m[1]) { title = strip(m[2]).replace(/\s*†\s*$/, ''); continue; }
  const cells = [...(m[3] + (m[4] ?? '')).matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => slotOf(x[1]));
  // 候補を並べた表（5 人以上）は、編成ではないので飛ばす
  if (cells.length > 4) { skipped.push(`${title}: ${cells.length} 枠（候補の一覧）`); continue; }
  // そのキャラのページでは、本人にリンクがない表がある（3 枠 + 本人）。本人を先頭に足す
  if (!cells.some(c => c.name === name)) cells.unshift({ name });
  while (cells.length < 4) cells.push({}); // 枠が足りない表（千織 + 鍾離 + 自由枠 …）は、自由枠で補う
  if (cells.length > 4) { skipped.push(`${title}: ${cells.length} 枠`); continue; }
  const unknown = cells.filter(c => c.unknown).map(c => c.unknown);
  const unsupported = cells.filter(c => c.name && !known(c.name)).map(c => c.name);
  if (unknown.length + unsupported.length > 0) { skipped.push(`${title}: ${[...unknown, ...unsupported].join('・')} がマスターにない／gcsim 未対応`); continue; }
  const taken = new Set(cells.filter(c => c.name).map(c => c.name!));
  const filled: string[] = [];
  const members = cells.map(c => {
    if (c.name) return c.name;
    const n = pickFor(c.element, taken);
    if (n) { taken.add(n); filled.push(n); }
    return n;
  });
  if (members.some(x => !x)) { skipped.push(`${title}: 条件に合うキャラが見つかりません`); continue; }
  teams.push({ title: filled.length ? `${title}（補完: ${filled.join('・')}）` : title, members: members as string[], ...(filled.length ? { filled } : {}) });
}

fs.mkdirSync('data/knowledge-teams', { recursive: true });
const out = `data/knowledge-teams/${name}.json`;
fs.writeFileSync(out, JSON.stringify({ character: name, source: url, fetched: new Date().toISOString().slice(0, 10), teams }, null, 1) + '\n');
console.log(`編成 ${teams.length} 件を ${out} に書きました`);
for (const t of teams) console.log(`  ${t.title}: ${t.members.join(' ')}`);
for (const s of skipped) console.log(`  （飛ばした）${s}`);
