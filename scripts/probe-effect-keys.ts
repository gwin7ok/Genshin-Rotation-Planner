/**
 * スキル・爆発の「アクション定義 ID → 効果の gcsim キー」の対応表を、実測で作る（フェーズ6 / 6-3b'）。
 * 事前に gcsim のローカルサーバー（localhost:54321）を起動しておく。
 *
 *   node scripts/probe-effect-keys.ts
 *
 * マスターのスキル・爆発のアクション定義（skill / skill_hold / burst）すべてについて、アプリと同じ変換（mapAction）で
 * gcsim の命令にして、単独のキャラで実行する。
 *   1. 命令を 10 秒あけて 2 回実行する
 *   2. 実行できなかったとき（再発動・バイク更新など、先に別のアクションが要る派生）は、先に通常のスキルを実行してから、その命令を 2 回
 *   3. それでも実行できなければ「未収集」（理由つき）として残す。手で補う
 * 辞書（src/data/gcsim_key_catalog.json）で「そのキャラの skill / burst 分類の効果」のキーのうち、次を満たすものをその定義のキーにする。
 *   - その命令の発動から 6 秒以内に、イベント（added / refreshed / extended）が起きる
 *   - そのキーのすべてのイベントが、そのキャラの何らかのスキル・爆発の発動から 6 秒以内に起きる（命中のたびに更新されるキーを除く）
 *   - 1回の発動あたり 4 イベント以下
 * 結果は src/data/action_effect_keys.json に書く。
 */
import fs from 'node:fs';
import { mapAction } from '../src/utils/gcsim/actionMapping.ts';

const SERVER = 'http://localhost:54321';
const MAX_LAG_FRAMES = 6 * 60;
const MAX_EVENTS_PER_CAST = 4;

const catalog = JSON.parse(fs.readFileSync('src/data/gcsim_key_catalog.json', 'utf8'));
const exact = new Map<string, any>(catalog.entries.filter((e: any) => !e.isPattern).map((e: any) => [e.key, e]));
const patterns = catalog.entries.filter((e: any) => e.isPattern).map((e: any) => ({
  e,
  re: new RegExp('^' + e.key.replace(/[.+?^$()|[\]\\]/g, '\\$&').replace('{element}', '(' + (e.elements ?? []).join('|') + ')').replace(/\*/g, '.*') + '$'),
}));
const lookup = (k: string) => exact.get(k) ?? patterns.find((p: any) => p.re.test(k))?.e;

const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const characters: any[] = (Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw)).filter((c: any) => c.source?.gcsimKey);
const weapons: Record<string, string> = { sword: 'dullblade', claymore: 'ultimateoverlordsmegamagicsword', polearm: 'beginnersprotector', bow: 'huntersbow', catalyst: 'apprenticesnotes' };

async function run(config: string): Promise<{ logs?: any[]; error?: string }> {
  const res = await fetch(`${SERVER}/sample/probe_${Date.now()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, seed: 1 }) });
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    return j.error ? { error: String(j.error) } : { logs: j.logs };
  } catch {
    return { error: text.trim().slice(0, 140) };
  }
}

const header = (k: string, wt: string) => [
  `${k} char lvl=90/90 cons=0 talent=9,9,9;`,
  `${k} add weapon="${weapons[wt]}" refine=1 lvl=90/90;`,
  `${k} add stats cr=1;`,
  'options iteration=1 duration=150 swap_delay=12 ignore_burst_energy=true;',
  'target lvl=100 resist=0.1;',
  `active ${k};`,
];

interface Found { key: string; events: number; casts: number; seconds: number[] }

function analyze(logs: any[], command: string): { casts: number; keys: Found[] } {
  const base = command.replace(/\[.*$/, '');
  // その命令の発動（同じ種類の命令の発動をすべて数える。パラメータの違いはログに出ない）
  const castFrames = logs.filter(l => l.event === 'action' && (l.msg === `executed ${base}` || l.msg.startsWith(`executed ${base}[`))).map(l => l.frame);
  const anyCasts = logs.filter(l => l.event === 'action' && /^executed (skill|burst)(\[.*\])?$/.test(l.msg)).map(l => l.frame);
  const events = new Map<string, { frame: number; expiry: number }[]>();
  for (const l of logs) {
    if (l.event !== 'status' || !/(mod|status) (added|refreshed|extended)$/.test(l.msg)) continue;
    const key = l.logs?.key ?? l.logs?.status;
    if (!key) continue;
    const entry = lookup(key);
    if (!entry || entry.kind !== 'effect' || (entry.category !== 'skill' && entry.category !== 'burst') || entry.owner.type !== 'character') continue;
    const arr = events.get(key) ?? [];
    if (!arr.some(e => e.frame === l.frame)) arr.push({ frame: l.frame, expiry: typeof l.logs?.expiry === 'number' ? l.logs.expiry : -1 });
    events.set(key, arr);
  }
  const keys: Found[] = [];
  for (const [key, evs] of events) {
    const afterThis = evs.filter(e => castFrames.some(t => e.frame >= t && e.frame - t <= MAX_LAG_FRAMES));
    const explainedByAny = evs.every(e => anyCasts.some(t => e.frame >= t && e.frame - t <= MAX_LAG_FRAMES));
    if (afterThis.length > 0 && explainedByAny && evs.length / Math.max(1, anyCasts.length) <= MAX_EVENTS_PER_CAST) {
      keys.push({ key, events: evs.length, casts: castFrames.length, seconds: afterThis.filter(e => e.expiry > 0).map(e => Number(((e.expiry - e.frame) / 60).toFixed(2))) });
    }
  }
  return { casts: castFrames.length, keys };
}

interface Entry {
  char: string; command: string; status: 'ok' | 'nokey' | 'unprobed'; via?: string; keys: Found[]; reason?: string;
  /** マスターの効果時間（秒）。候補が複数のとき、これに最も近いキーを primary にする */
  master?: number;
  /** 効果時間の本体のキー。候補が1つならそのキー。複数なら、マスターの効果時間に最も近いキー（マスターが無ければ最も長いキー。同じなら先頭） */
  primary?: string;
}
const table: Record<string, Entry> = {};
let n = 0;
for (const c of characters) {
  const k = c.source.gcsimKey as string;
  const defs = (c.availableActions ?? []).filter((a: any) => a.type === 'skill' || a.type === 'skill_hold' || a.type === 'burst');
  for (const def of defs) {
    n++;
    const command = mapAction(def.id, c.weaponType).command;
    if (!command) {
      table[def.id] = { char: c.name, command: '', status: 'unprobed', keys: [], reason: '変換規則なし（mapAction）' };
      continue;
    }
    const attempts: { via: string; body: string }[] = [
      { via: 'plain', body: `${k} ${command}; delay(600); ${k} ${command}; delay(600);` },
      { via: 'prelude:skill', body: `${k} skill; delay(600); ${k} ${command}; delay(600); ${k} ${command}; delay(600);` },
    ];
    let last = '';
    let done = false;
    for (const at of attempts) {
      const out = await run([...header(k, c.weaponType), at.body].join('\n'));
      if (out.error) { last = out.error; continue; }
      const { casts, keys } = analyze(out.logs!, command);
      if (casts === 0) { last = '実行されなかった'; continue; }
      const master = typeof def.effectDuration === 'number' && def.effectDuration > 0 ? def.effectDuration : undefined;
      const scored = keys.map(kf => ({ key: kf.key, s: kf.seconds[0] ?? 0 }));
      const primary = scored.length === 0 ? undefined
        : [...scored].sort((a, b) => master !== undefined ? Math.abs(a.s - master) - Math.abs(b.s - master) : b.s - a.s)[0].key;
      table[def.id] = { char: c.name, command, status: keys.length > 0 ? 'ok' : 'nokey', via: at.via, keys, ...(master !== undefined ? { master } : {}), ...(primary ? { primary } : {}) };
      done = true;
      break;
    }
    if (!done) table[def.id] = { char: c.name, command, status: 'unprobed', keys: [], reason: last };
    if (n % 40 === 0) console.log(`${n} 件`);
  }
}

fs.writeFileSync('src/data/action_effect_keys.json', JSON.stringify({ gcsimCommit: catalog.gcsimCommit, generatedAt: new Date().toISOString(), entries: table }, null, 1));
const all = Object.entries(table);
const count = (s: string) => all.filter(([, e]) => e.status === s).length;
console.log(`定義 ${all.length} 件 / キーあり ${count('ok')} / キー無し ${count('nokey')} / 未収集 ${count('unprobed')}`);
console.log('  先にスキルが要った定義:', all.filter(([, e]) => e.via === 'prelude:skill').length);
for (const [id, e] of all.filter(([, e]) => e.keys.length > 1)) console.log('  複数候補', e.char, id, e.keys.map(x => x.key + '=' + x.seconds.join('/')).join('  '));
for (const [id, e] of all.filter(([, e]) => e.status === 'unprobed')) console.log('  未収集', e.char, id, e.command, '|', e.reason);
