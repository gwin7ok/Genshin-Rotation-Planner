/**
 * Wiki（wikiwiki.jp 原神Wiki）のキャラのページから、「編成例」の編成（4 人）を取り出して、編成例のファイルに書く。
 * 辞書の候補づくり（scripts/knowledge-candidates.ts）の、入力を作る。
 *
 *   node scripts/knowledge-teams.ts 胡桃
 *   → data/knowledge-teams/胡桃.json  { character, source, teams: [{ title, members: [名前 ×4] }] }
 *
 * 読み取りの方法: 「編成例」の見出し以下にある、「キャラ」の行の表を、編成 1 つとして読む。
 * 4 人そろわない表（自由枠など）・マスターにいない／gcsim 未対応のキャラを含む表は、飛ばして理由を表示する。
 * 出力は、そのまま使わず、中身を見て不要な編成を消してよい（ファイルは手で直せる）。
 */
import fs from 'node:fs';

const name = process.argv[2];
if (!name) { console.error('使い方: node scripts/knowledge-teams.ts <キャラ名>（例: 胡桃）'); process.exit(1); }

const url = `https://wikiwiki.jp/genshinwiki/${encodeURIComponent(name)}`;
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (knowledge-teams script)' } });
if (!res.ok) { console.error(`ページを取得できません: ${url}（${res.status}）`); process.exit(1); }
const html = (await res.text()).replace(/<script[\s\S]*?<\/script>/g, '');

const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const heads = [...html.matchAll(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/g)].map(m => ({ pos: m.index!, level: Number(m[1]), text: strip(m[2]).replace(/\s*†\s*$/, '') }));
const start = heads.find(h => h.text.startsWith('編成例'));
if (!start) { console.error('「編成例」の見出しが見つかりません'); process.exit(1); }
// 終わり: 「編成」を含まない、同じかそれより上の見出し（Wiki の見出しの階層は不ぞろいなので、文字で判断する）
const end = heads.find(h => h.pos > start.pos && h.level <= 3 && !h.text.includes('編成') && !h.text.startsWith('その他の'))
  ?? { pos: html.length };
const seg = html.slice(start.pos, end.pos);

const master: any[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const known = (n: string) => master.find(c => c.name === n && c.source?.gcsimKey);

type Team = { title: string; members: string[] };
const teams: Team[] = [];
const skipped: string[] = [];
let title = '';
for (const m of seg.matchAll(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>|<tr><th[^>]*>キャラ<\/th>([\s\S]*?)<\/tr>/g)) {
  if (m[1]) { title = strip(m[2]).replace(/\s*†\s*$/, ''); continue; }
  // 画像（*.webp）・nolink の指定を除き、キャラのページへのリンクの title だけを、順に拾う
  const members = [...new Set([...m[3].matchAll(/title="([^"]*)"/g)].map(x => x[1]).filter(t => !/\.webp$|nolink/.test(t)))];
  if (members.length !== 4) { skipped.push(`${title}: ${members.length} 人（${members.join('・') || '読み取れず'}）`); continue; }
  const bad = members.filter(n => !known(n));
  if (bad.length > 0) { skipped.push(`${title}: ${bad.join('・')} がマスターにない／gcsim 未対応`); continue; }
  if (!members.includes(name)) { skipped.push(`${title}: ${name} を含まない`); continue; }
  teams.push({ title, members });
}

fs.mkdirSync('data/knowledge-teams', { recursive: true });
const out = `data/knowledge-teams/${name}.json`;
fs.writeFileSync(out, JSON.stringify({ character: name, source: url, fetched: new Date().toISOString().slice(0, 10), teams }, null, 1) + '\n');
console.log(`編成 ${teams.length} 件を ${out} に書きました`);
for (const t of teams) console.log(`  ${t.title}: ${t.members.join(' ')}`);
for (const s of skipped) console.log(`  （飛ばした）${s}`);
