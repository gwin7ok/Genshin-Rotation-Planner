/**
 * 知識辞書（src/masterdata/knowledge/characters.ts）を、サーバー側の配信用ファイル（public/knowledge/）に書き出す。
 *   node scripts/build-knowledge.ts          書き出す
 *   node scripts/build-knowledge.ts --check  書き出し済みのファイルが、辞書と同じか確かめる（違えば終了コード 1）
 * キャラ 1 人 1 ファイル（chars/<キャラ ID>.json）+ index.json（版・gcsim の版・キャラ → ファイル）。
 */
import fs from 'node:fs';
import { KNOWLEDGE } from '../src/masterdata/knowledge/characters.ts';

const KNOWLEDGE_VERSION = 1;
const OUT = 'public/knowledge';
const gcsimVersion: string = JSON.parse(fs.readFileSync('gcsim.config.json', 'utf8')).version ?? JSON.parse(fs.readFileSync('gcsim.config.json', 'utf8')).commit ?? '';
const ids = KNOWLEDGE.map(k => k.characterId);
if (new Set(ids).size !== ids.length) { console.error('辞書のキャラ ID が重複しています'); process.exit(1); }
const master: Array<{ id: string; name: string }> = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
for (const k of KNOWLEDGE) if (!master.some(m => m.id === k.characterId)) { console.error(`マスターに無いキャラ ID: ${k.characterId}`); process.exit(1); }

const files = new Map<string, string>();
// Wiki（wikiwiki.jp 原神Wiki）のページ名: 名前と同じ。違うものだけ書く（魈 → ショウ、旅人 空(風) → 主人公/風）
const WIKI_PAGE_OVERRIDE: Record<string, string> = { 魈: 'ショウ' };
const wikiUrlOf = (name: string): string => {
  const t = /^[空蛍]\((.)\)$/.exec(name);
  const page = t ? `主人公/${t[1]}` : (WIKI_PAGE_OVERRIDE[name] ?? name);
  return `https://wikiwiki.jp/genshinwiki/${page.split('/').map(encodeURIComponent).join('/')}`;
};
for (const k of KNOWLEDGE) {
  const name = master.find(m => m.id === k.characterId)!.name;
  files.set(`${OUT}/chars/${k.characterId}.json`, JSON.stringify({ characterId: k.characterId, wikiUrl: wikiUrlOf(name), archetypes: k.archetypes }, null, 1) + '\n');
}
files.set(`${OUT}/index.json`, JSON.stringify({ version: KNOWLEDGE_VERSION, gcsimVersion, chars: Object.fromEntries(ids.map(id => [id, `chars/${id}.json`])) }, null, 1) + '\n');

const norm = (s: string) => s.replace(/\r\n/g, '\n');
if (process.argv.includes('--check')) {
  const bad = [...files].filter(([p, c]) => !fs.existsSync(p) || norm(fs.readFileSync(p, 'utf8')) !== norm(c));
  const extra = fs.existsSync(`${OUT}/chars`) ? fs.readdirSync(`${OUT}/chars`).filter(f => !ids.includes(f.replace(/\.json$/, ''))) : [];
  if (bad.length > 0 || extra.length > 0) { console.error(`辞書の書き出しが古い: ${[...bad.map(b => b[0]), ...extra].join(', ')}。npm run build:knowledge を実行してください`); process.exit(1); }
  console.log(`OK: 辞書 ${ids.length} キャラ（版 ${KNOWLEDGE_VERSION}）`);
} else {
  fs.mkdirSync(`${OUT}/chars`, { recursive: true });
  for (const f of fs.existsSync(`${OUT}/chars`) ? fs.readdirSync(`${OUT}/chars`) : []) if (!ids.includes(f.replace(/\.json$/, ''))) fs.rmSync(`${OUT}/chars/${f}`);
  for (const [p, c] of files) fs.writeFileSync(p, c);
  console.log(`書き出しました: ${ids.length} キャラ → ${OUT}/`);
}
