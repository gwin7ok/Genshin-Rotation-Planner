/**
 * スキル・爆発の「次の行動を受け付け始めるフレーム」（gcsim の CanQueueAfter）を、実測で作る（2026-10-09）。
 * 事前に gcsim のローカルサーバーを起動しておく（npm run gcsim:start）。
 *
 *   node scripts/probe-can-queue-after.ts
 *
 * gcsim は、アクションを実行した後、CanQueueAfter（最も早いキャンセル）まで進めてから、次の行動（`wait`・別のアクション）を受け付ける。
 * 待機（`wait(N)`）が続くとき、待機はこの時刻から始まる（run.go: queuePhase → handleWait）。アプリの「待機」の位置を gcsim に合わせるために使う。
 * 単独のキャラで、`<アクション>; wait(60);` を実行し、実行のフレームから、続く `wait` が実行されたフレームまでの差を記録する。
 * 対象: マスターの skill（CT を始める通常のスキル）・burst（特殊爆発を除く）。結果は src/data/can_queue_after.json に書く。
 */
import fs from 'node:fs';
import { mapAction } from '../src/utils/gcsim/actionMapping.ts';
import { GCSIM_SERVER_URL } from '../src/utils/gcsim/gcsimConfig.ts';

const catalog = JSON.parse(fs.readFileSync('public/data/gcsim_key_catalog.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const characters: any[] = (Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw)).filter((c: any) => c.source?.gcsimKey);
const weapons: Record<string, string> = { sword: 'dullblade', claymore: 'ultimateoverlordsmegamagicsword', polearm: 'beginnersprotector', bow: 'huntersbow', catalyst: 'apprenticesnotes' };

async function run(config: string): Promise<any[] | undefined> {
  const res = await fetch(`${GCSIM_SERVER_URL}/sample/cqa_${Date.now()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, seed: 1 }) });
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    return j.error ? undefined : j.logs;
  } catch {
    return undefined;
  }
}

const entries: Record<string, number> = {};
let tried = 0;
let failed = 0;
for (const c of characters) {
  const k = c.source.gcsimKey as string;
  const defs = (c.availableActions ?? []).filter((a: any) => (a.type === 'skill' && !a.cooldownPool && a.startsSkillCooldown === true) || (a.type === 'burst' && !a.specialBurst));
  for (const def of defs) {
    const command = mapAction(def.id, c.weaponType).command;
    if (!command) continue;
    tried++;
    const cfg = [
      `${k} char lvl=90/90 cons=0 talent=9,9,9;`,
      `${k} add weapon="${weapons[c.weaponType]}" refine=1 lvl=90/90;`,
      `${k} add stats cr=1;`,
      'options iteration=1 duration=30 swap_delay=12 ignore_burst_energy=true;',
      'target lvl=100 resist=0.1;',
      `active ${k};`,
      `wait(30); ${k} ${command}; wait(60); wait(60);`,
    ].join('\n');
    const logs = await run(cfg);
    const base = command.replace(/\[.*$/, '');
    const exec = logs?.find(l => l.event === 'action' && l.msg.startsWith(`executed ${base}`));
    const wait = exec ? logs!.find(l => l.event === 'action' && /^executed wait/.test(l.msg) && l.frame > exec.frame) : undefined;
    if (!exec || !wait) { failed++; continue; }
    entries[def.id] = wait.frame - exec.frame;
  }
}
fs.writeFileSync('src/data/can_queue_after.json', JSON.stringify({ gcsimCommit: catalog.gcsimCommit, generatedAt: new Date().toISOString(), entries }, null, 1) + '\n');
console.log(`定義 ${tried} 件 / 記録 ${Object.keys(entries).length} / 未収集 ${failed}`);
