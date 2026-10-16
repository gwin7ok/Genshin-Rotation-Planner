/**
 * ダッシュ・ジャンプの所要時間を、実測で作る（D215。2026-10-15）。
 * 事前に gcsim のローカルサーバーを起動しておく（npm run gcsim:start）。
 *
 *   node scripts/probe-dash-jump.ts            … src/data/dash_jump_frames.json を書き、マスター（characters_master_data.json）のダッシュ・ジャンプの defaultDuration を差し替える
 *
 * gcsim の dash / jump は、フレーム表ではなくスタミナ処理（stam.go）で長さが決まる。仮の値（0.2 / 0.55 秒）ではなく、
 * 単独のキャラで `<dash|jump>; attack;` を実行し、`attack` が実行されたフレームの差を、キャラごとに記録する（遅延なし・敵なし）。
 * 生成（characterMasterGenerator）は、この JSON があれば、その値を使う。
 */
import fs from 'node:fs';
import { GCSIM_SERVER_URL } from '../src/utils/gcsim/gcsimConfig.ts';
import './require-gcsim-server.ts';

const catalog = JSON.parse(fs.readFileSync('public/data/gcsim_key_catalog.json', 'utf8'));
const masterPath = 'src/data/characters_master_data.json';
const raw = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
const characters: any[] = Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw);
const weapons: Record<string, string> = { sword: 'dullblade', claymore: 'ultimateoverlordsmegamagicsword', polearm: 'beginnersprotector', bow: 'huntersbow', catalyst: 'apprenticesnotes' };

async function run(config: string): Promise<any[] | undefined> {
  const res = await fetch(`${GCSIM_SERVER_URL}/sample/dj_${Date.now()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, seed: 1 }) });
  try {
    const j = JSON.parse(await res.text());
    return j.error ? undefined : j.logs;
  } catch {
    return undefined;
  }
}

const entries: Record<string, { dash?: number; jump?: number }> = {};
let failed = 0;
for (const c of characters) {
  const k = c.source?.gcsimKey as string | undefined;
  if (!k) continue;
  for (const kind of ['dash', 'jump'] as const) {
    if (!(c.availableActions ?? []).some((a: any) => a.id === `${c.id}_${kind}`)) continue;
    const cfg = [
      `${k} char lvl=90/90 cons=0 talent=9,9,9;`,
      `${k} add weapon="${weapons[c.weaponType]}" refine=1 lvl=90/90;`,
      `${k} add stats cr=1;`,
      'options iteration=1 duration=30 swap_delay=12 ignore_burst_energy=true;',
      'target lvl=100 resist=0.1;',
      `active ${k};`,
      `${k} ${kind}; ${k} attack;`,
    ].join('\n');
    const logs = await run(cfg);
    const a = logs?.find(l => l.event === 'action' && l.msg === `executed ${kind}`);
    const b = a ? logs!.find(l => l.event === 'action' && l.msg === 'executed attack' && l.frame >= a.frame) : undefined;
    if (!a || !b || b.frame === a.frame) { failed++; continue; }
    (entries[c.id] ??= {})[kind] = b.frame - a.frame;
  }
}
fs.writeFileSync('src/data/dash_jump_frames.json', JSON.stringify({ gcsimCommit: catalog.gcsimCommit, generatedAt: new Date().toISOString(), entries }, null, 1) + '\n');

// マスターの defaultDuration を差し替える（再生成で巻き込む差を避けるため、ダッシュ・ジャンプだけ）
let changed = 0;
for (const c of characters) {
  const e = entries[c.id];
  if (!e) continue;
  for (const kind of ['dash', 'jump'] as const) {
    const a = (c.availableActions ?? []).find((x: any) => x.id === `${c.id}_${kind}`);
    const f = e[kind];
    if (!a || f === undefined) continue;
    const sec = Number((f / 60).toFixed(3));
    if (a.defaultDuration !== sec) { a.defaultDuration = sec; changed++; }
  }
}
fs.writeFileSync(masterPath, JSON.stringify(raw, null, 2) + '\n');
const vals = (kind: 'dash' | 'jump') => [...new Set(Object.values(entries).map(e => e[kind]).filter(Boolean))].sort((x, y) => (x as number) - (y as number));
console.log(`記録 ${Object.keys(entries).length} キャラ / 未収集 ${failed} / マスターの差し替え ${changed} 件`);
console.log('dash(f):', vals('dash').join(','), ' jump(f):', vals('jump').join(','));
