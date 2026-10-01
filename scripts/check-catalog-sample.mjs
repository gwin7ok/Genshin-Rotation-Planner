/**
 * 辞書の確認（フェーズ5 / 5-2b）: 4 キャラ（ナヒーダ・ニィロウ・コロンビーナ・ラウマ）の編成を gcsim ローカルサーバーで実行し、
 * 詳細ログの status イベントの全キーが、辞書（public/data/gcsim_key_catalog.json）で引けるかを確かめる。
 * 事前に gcsim のローカルサーバーを起動しておく（npm run gcsim:start。バージョン・ポートは gcsim.config.json）。
 *
 *   node scripts/check-catalog-sample.mjs
 */
import fs from 'node:fs';
import { GCSIM_SERVER_URL } from '../src/utils/gcsim/gcsimConfig.ts';
const catalog = JSON.parse(fs.readFileSync('public/data/gcsim_key_catalog.json', 'utf8'));
const exact = new Map(catalog.entries.filter(e => !e.isPattern).map(e => [e.key, e]));
const patterns = catalog.entries.filter(e => e.isPattern).map(e => {
  const re = new RegExp('^' + e.key.replace(/[.+?^${}()|[\]\\]/g, m => (m === '{' || m === '}') ? m : '\\' + m)
    .replace('{element}', '(' + (e.elements ?? []).join('|') + ')').replace(/\*/g, '.*') + '$');
  return { e, re };
});
const lookup = k => exact.get(k) ?? patterns.find(p => p.re.test(k))?.e;

const chars = `
nahida char lvl=90/90 cons=0 talent=9,9,9;
nahida add weapon="athousandfloatingdreams" refine=1 lvl=90/90;
nahida add set="deepwoodmemories" count=4;
nahida add stats cr=1;
nilou char lvl=90/90 cons=0 talent=9,9,9;
nilou add weapon="keyofkhajnisut" refine=1 lvl=90/90;
nilou add set="tenacityofthemillelith" count=4;
nilou add stats cr=1;
columbina char lvl=90/90 cons=0 talent=9,9,9;
columbina add weapon="nocturnescurtaincall" refine=1 lvl=90/90;
columbina add set="silkenmoonsserenade" count=4;
columbina add stats cr=1;
lauma char lvl=90/90 cons=0 talent=9,9,9;
lauma add weapon="skywardatlas" refine=1 lvl=90/90;
lauma add set="gildeddreams" count=4;
lauma add stats cr=1;
`;
const body = `
options iteration=1 duration=60 swap_delay=12 ignore_burst_energy=true;
target lvl=100 resist=0.1;
active nahida;
nahida skill, burst;
let i = 1;
while i <= 2 {
  print("loop ", i);
  nilou skill, attack, attack, attack;
  columbina skill, burst;
  lauma skill, burst;
  columbina attack, attack, charge;
  nahida skill;
  i = i + 1;
}
`;
const res = await fetch(GCSIM_SERVER_URL + '/sample/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: chars + body, seed: 1 }) });
const j = await res.json();
if (j.error) { console.log('ERR', j.error); }
const logs = j.logs ?? [];
console.log('logs', logs.length);
const keys = new Map();
for (const l of logs) {
  if (l.event !== 'status') continue;
  const k = l.logs?.key ?? l.logs?.status ?? l.msg;
  if (!keys.has(k)) keys.set(k, { count: 0, msg: l.msg, sample: JSON.stringify(l.logs).slice(0, 120) });
  keys.get(k).count++;
}
console.log('status keys', keys.size);
const miss = [], hit = [];
for (const [k, v] of keys) {
  const e = lookup(k);
  (e ? hit : miss).push({ k, v, e });
}
console.log('辞書で引けた', hit.length, '引けない', miss.length);
for (const h of hit) console.log('  OK ', h.k, '=>', h.e.category, h.e.owner.gcsimKey, h.e.kind, h.e.ambiguous ? '(複数)' : '');
for (const m of miss) console.log('  NG ', m.k, '|', m.v.msg, '|', m.v.sample);

