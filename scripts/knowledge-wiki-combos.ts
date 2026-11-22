/**
 * Wiki（wikiwiki.jp 原神Wiki）のキャラのページから、「コンボ・定番のスキルセット・立ち回り」の記述を、**漏れなく**取り出す。
 * 辞書（src/masterdata/knowledge/characters.ts）に登録する形を、人が（Claude が）全文を読んで決めるための、読み取り用の抜粋を作る。
 * （以前は、「運用」の見出しの先頭を数行だけ読んで決めていたため、ヴァレサの「基本のコンボ」の節を見落とした。その再発を防ぐ道具）
 *
 *   node scripts/knowledge-wiki-combos.ts ヴァレサ エウルア …   指定したキャラ
 *   node scripts/knowledge-wiki-combos.ts --all                辞書の全キャラ（マスターの全員）
 * 出力: .cache/knowledge-wiki/<名前>.txt（ページの本文のキャッシュ。Git に入れない）
 *       .cache/knowledge-wiki/<名前>.combo.md（読み取り用の抜粋）。標準出力には、件数の一覧
 *
 * 抜粋の中身（切り捨てなし）:
 *   1. 「運用」「立ち回り」「コンボ」を含む見出しの節の全文（次の同じ階層の見出しまで）
 *   2. ページ全体（編成例・コメントを除く）で、コンボらしい行: 「→」でつないだ操作・E/Q/A の並び・「コンボ」「ローテ」「流れ」「繰り返」「セット」を含む行
 *   3. 2 のうち、「→」でつないだ行は、アクション ID の並び（use の下書き）に機械的に直したもの。読み取れない語は ? にする
 * 下書きは、そのまま使わない。文脈（A が通常か重撃か・繰り返しの範囲）を、本文で確かめて、辞書に書く。
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const master: any[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const OVERRIDE: Record<string, string> = { 魈: 'ショウ' };
const pageOf = (n: string) => {
  const t = /^[空蛍]\((.)\)$/.exec(n);
  return t ? `主人公/${t[1]}` : (OVERRIDE[n] ?? n);
};
const names = args.includes('--all') ? [...new Set(master.map(c => c.name as string))] : args.filter(a => !a.startsWith('--'));
if (names.length === 0) { console.error('使い方: node scripts/knowledge-wiki-combos.ts <キャラ名...> | --all'); process.exit(1); }

const DIR = '.cache/knowledge-wiki';
fs.mkdirSync(DIR, { recursive: true });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const safe = (n: string) => n.replace(/[\/:*?"<>|]/g, '_');

async function fetchText(name: string): Promise<string | null> {
  const f = path.join(DIR, `${safe(name)}.txt`);
  if (fs.existsSync(f) && !args.includes('--refresh')) return fs.readFileSync(f, 'utf8');
  const url = `https://wikiwiki.jp/genshinwiki/${pageOf(name).split('/').map(encodeURIComponent).join('/')}`;
  let res: Response | undefined;
  for (let i = 0; i < 5; i++) {
    res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (knowledge-wiki-combos script)' } });
    if (res.status !== 429) break;
    await sleep(Math.max(Number(res.headers.get('retry-after')) * 1000 || 0, 10000 * 2 ** i));
  }
  if (!res || !res.ok) return null;
  const html = (await res.text()).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  const text = html
    .replace(/<h([2-6])[^>]*>/g, (_m, l) => `\n#${l} `)
    .replace(/<\/(h[2-6]|p|tr|li|div)>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<\/t[dh]>/g, ' | ')
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
  fs.writeFileSync(f, text);
  await sleep(2500); // アクセス間隔（429 を避ける）
  return text;
}

// ── 語 → アクション ID（機械的な下書き）──
const WORDS: Array<[RegExp, string]> = [
  [/長押し(?:の)?(?:元素)?スキル|元素スキル(?:\(|（)?長押し|スキル長押し|長押しE|Eホールド|ホールドE/, 'e_hold'],
  [/元素スキル|スキル|\bE\b/, 'e'],
  [/元素爆発|爆発|\bQ\b/, 'q'],
  [/低空落下|低空/, 'lp'],
  [/落下攻撃|落下/, 'hp'],
  [/重撃|狙い撃ち|チャージ攻撃|\bCA\b/, 'ca'],
  [/通常攻撃|通常|\bN\b/, 'n'],
  [/ダッシュ|ステップ/, 'dash'],
  [/ジャンプ/, 'jump'],
];
const ARROW = /[→⇒➡＞>]+/;
function translateChain(line: string): string {
  // 「(…→…→…)×2セット」: かっこ全体の繰り返し
  const grp = /^[(（](.*)[)）]\s*[×x＊*]\s*(\d+)/.exec(line.trim());
  if (grp) return Array.from({ length: Math.min(Number(grp[2]), 6) }, () => translateChain(grp[1])).join(' | ');
  const parts = line.split(ARROW).map(s => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const hit = WORDS.find(([re]) => re.test(p));
    if (!hit) { out.push(`?(${p.slice(0, 12)})`); continue; }
    const rep = /[×x＊*]\s*(\d+)|(\d+)\s*(?:回|段|発|連)/.exec(p);
    const n = rep ? Number(rep[1] ?? rep[2]) : 1;
    for (let i = 0; i < Math.min(n, 12); i++) out.push(hit[1]);
  }
  return out.join(' ');
}
const ACTION_WORD = /元素スキル|スキル|元素爆発|爆発|通常攻撃|通常|重撃|落下|ダッシュ|ジャンプ|狙い撃ち|長押し|\bE\b|\bQ\b/g;
const isChain = (l: string) => ARROW.test(l) && (l.match(ACTION_WORD)?.length ?? 0) >= 2 && l.length < 400;
const isLetters = (l: string) => /[（(]?[EQANC]{3,}[）)]?/.test(l);
const isCombo = (l: string) => isChain(l) || isLetters(l) || /コンボ|ローテ|基本の流れ|基本的な流れ|立ち回り|ルーティン|繰り返|セット|サイクル/.test(l);

const rows: string[] = [];
for (const name of names) {
  const text = await fetchText(name);
  if (text === null) { rows.push(`${name}\t取得できません`); continue; }
  const lines = text.split('\n');
  // 編成例・コメント以降は除く（他キャラの編成の文が混ざるため）
  const cut = lines.findIndex((l, i) => /^#[2-4] (?:他キャラクターとの相性|編成例|コメント|情報提供)/.test(l) && i > 60);
  const body = cut > 0 ? lines.slice(0, cut) : lines;
  // 1. 「運用」「立ち回り」「コンボ」の見出しの節（全文）
  const secs: string[] = [];
  body.forEach((l, i) => {
    const m = /^#([2-6]) (.*)$/.exec(l);
    if (!m || !/運用|立ち回|コンボ|ローテ|戦い方|使い方/.test(m[2])) return;
    let j = i + 1;
    while (j < body.length && !(/^#([2-6]) /.test(body[j]) && Number(/^#([2-6])/.exec(body[j])![1]) <= Number(m[1]))) j++;
    secs.push(`### 節: ${l.replace(/^#\d /, '')}\n${body.slice(i + 1, j).join('\n')}`);
  });
  // 2. コンボらしい行（天賦の説明の中も含む）
  const combo = body.filter(l => !l.includes(' | ') && isCombo(l)).map(l => l.trim());
  // 3. 下書き
  const drafts = [...new Set(body.filter(l => !l.includes(' | ') && isChain(l)).map(l => `${translateChain(l.trim())}    ← ${l.trim().slice(0, 90)}`))];
  fs.writeFileSync(path.join(DIR, `${safe(name)}.combo.md`), [`# ${name}（${pageOf(name)}）`, '', '## 1. 運用・立ち回り・コンボの節（全文）', ...(secs.length ? secs : ['（該当する見出しなし）']), '', '## 2. コンボらしい行', ...combo.map(l => `- ${l}`), '', '## 3. アクション ID の下書き（「→」の行）', ...drafts.map(d => `- ${d}`), ''].join('\n'));
  rows.push(`${name}\t節 ${secs.length}・コンボらしい行 ${combo.length}・下書き ${drafts.length}`);
  console.log(rows[rows.length - 1]);
}
