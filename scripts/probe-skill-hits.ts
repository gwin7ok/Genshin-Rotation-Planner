/**
 * スキルの命中時刻の表を、実測で作る（フェーズ 6 / 6-4 の続き。祭礼の武器効果をアプリの計算に入れるためのデータ。2026-10-09）。
 * 事前に gcsim のローカルサーバーを起動しておく（npm run gcsim:start）。
 *
 *   node scripts/probe-skill-hits.ts
 *
 * マスターのスキルのアクション（skill / skill_hold。CT を始めるもの）それぞれを、単独のキャラで 1 回実行し、
 * 「スキルのダメージ（gcsim の AttackTagElementalArt = 4。ダメージが 0 より大きいもの）」が敵に当たったフレームを、スキルを実行したフレームからの相対で記録する。
 * 祭礼の武器の効果は、このダメージが敵に当たったときに（スキルが CT 中なら）発動するので、命中時刻の表が要る。
 *   - hits が空 = スキル扱いのダメージが無い（祭礼の効果は発動しない）。例: 宵宮・放浪者
 *   - 継続ダメージ（召喚物・場など）も含める。表の長さは MAX_FRAMES（40 秒）まで
 * 結果は src/data/skill_hit_frames.json に書く。
 */
import fs from 'node:fs';
import { HOLD_FRAMES_ACTIONS, mapAction } from '../src/utils/gcsim/actionMapping.ts';
import { GCSIM_SERVER_URL } from '../src/utils/gcsim/gcsimConfig.ts';

const SERVER = GCSIM_SERVER_URL;
/** 記録する長さ（フレーム）。祭礼の内部 CT（最長 16 秒）とスキルの CT（最長 30 秒台）を覆う */
const MAX_FRAMES = 40 * 60;
const ATTACK_TAG_ELEMENTAL_ART = 4;

const catalog = JSON.parse(fs.readFileSync('public/data/gcsim_key_catalog.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const characters: any[] = (Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw)).filter((c: any) => c.source?.gcsimKey);
const weapons: Record<string, string> = { sword: 'dullblade', claymore: 'ultimateoverlordsmegamagicsword', polearm: 'beginnersprotector', bow: 'huntersbow', catalyst: 'apprenticesnotes' };

const headerOf = (c: any, k: string, cons: number) => [
  `${k} char lvl=90/90 cons=${cons} talent=9,9,9;`,
  `${k} add weapon="${weapons[c.weaponType]}" refine=1 lvl=90/90;`,
  `${k} add stats cr=1;`,
  'options iteration=1 duration=90 swap_delay=12 ignore_burst_energy=true;',
  'target lvl=100 resist=0.1;',
  `active ${k};`,
];

async function run(config: string): Promise<{ logs?: any[]; error?: string }> {
  const res = await fetch(`${SERVER}/sample/hits_${Date.now()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, seed: 1 }) });
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    return j.error ? { error: String(j.error) } : { logs: j.logs };
  } catch {
    return { error: text.trim().slice(0, 140) };
  }
}

/** byConstellation: 命ノ星座で命中が変わるアクションの、その段階以降の命中（hits は 0 凸）。holdFramesMax: 長押しの長さを渡すアクション（命中は長押し − 1 フレームだけ後ろにずれる） */
interface Entry { char: string; command: string; status: 'ok' | 'unprobed'; hits: number[]; byConstellation?: Record<string, number[]>; holdFramesMax?: number; reason?: string }
const entries: Record<string, Entry> = {};
let n = 0;
for (const c of characters) {
  const k = c.source.gcsimKey as string;
  const defs = (c.availableActions ?? []).filter((a: any) => (a.type === 'skill' || a.type === 'skill_hold') && !a.cooldownPool && a.startsSkillCooldown === true);
  for (const def of defs) {
    n++;
    const command = mapAction(def.id, c.weaponType).command;
    if (!command) { entries[def.id] = { char: c.name, command: '', status: 'unprobed', hits: [], reason: '変換規則なし（mapAction）' }; continue; }
    // 先に別のスキルが要る派生（再発動など）は、通常のスキルを先に実行してから、その命令を 1 回
    const probe = async (cons: number, cmd: string): Promise<{ hits?: number[]; error?: string }> => {
      const header = headerOf(c, k, cons);
      const bare = cmd.replace(/\[.*$/, '');
      const attempts = [
        { via: 'plain', body: `wait(30); ${k} ${cmd}; delay(${MAX_FRAMES + 60});` },
        { via: 'prelude', body: `wait(30); ${k} skill; delay(600); ${k} ${cmd}; delay(${MAX_FRAMES + 60});` },
      ];
      let last = '';
      for (const at of attempts) {
        const out = await run([...header, at.body].join('\n'));
        if (out.error) { last = out.error; continue; }
        const execs = out.logs!.filter(l => l.event === 'action' && l.msg.startsWith(`executed ${bare}`));
        const exec = (at.via === 'plain' ? execs[0] : execs[execs.length - 1])?.frame;
        if (exec === undefined) { last = '実行されなかった'; continue; }
        const hits = [...new Set<number>(
          out.logs!.filter(l => l.event === 'damage' && l.char_index === 0 && l.logs?.['attack-tag'] === ATTACK_TAG_ELEMENTAL_ART && Number(l.logs?.damage ?? 0) > 0 && l.frame >= exec && l.frame - exec <= MAX_FRAMES)
            .map(l => l.frame - exec),
        )].sort((x, y) => x - y);
        return { hits };
      }
      return { error: last };
    };
    const base = await probe(0, command);
    const last = base.error ?? '';
    let done = false;
    if (base.hits) {
      const entry: Entry = { char: c.name, command, status: 'ok', hits: base.hits };
      // 命ノ星座で命中が変わるか（1〜6 凸。変わった段階だけ記録）
      let prev = JSON.stringify(base.hits);
      for (let cons = 1; cons <= 6; cons++) {
        const r = await probe(cons, command);
        if (!r.hits || JSON.stringify(r.hits) === prev) continue;
        prev = JSON.stringify(r.hits);
        (entry.byConstellation ??= {})[String(cons)] = r.hits;
      }
      // 長押しの長さ（フレーム）を渡すアクション: 命中は、長押しの長さ − 1 フレームだけ後ろにずれる（hold=1 が基準）。上限で確かめる
      const holdMax = HOLD_FRAMES_ACTIONS.get(def.id);
      if (holdMax !== undefined && base.hits.length > 0) {
        const r = await probe(0, `${command.replace(/\[.*$/, '')}[hold=${holdMax}]`);
        if (r.hits && JSON.stringify(r.hits) === JSON.stringify(base.hits.map(h => h + holdMax - 1))) entry.holdFramesMax = holdMax;
        else console.log('  長押しで命中が単純にずれない', c.name, def.id, JSON.stringify(r.hits));
      }
      entries[def.id] = entry;
      done = true;
    }
    if (!done) entries[def.id] = { char: c.name, command, status: 'unprobed', hits: [], reason: last };
    if (n % 40 === 0) console.log(`${n} 件`);
  }
}

fs.writeFileSync('src/data/skill_hit_frames.json', JSON.stringify({ gcsimCommit: catalog.gcsimCommit, generatedAt: new Date().toISOString(), maxFrames: MAX_FRAMES, entries }, null, 1) + '\n');
const all = Object.entries(entries);
console.log(`定義 ${all.length} 件 / 命中あり ${all.filter(([, e]) => e.status === 'ok' && e.hits.length > 0).length} / 命中なし（スキルのダメージが無い） ${all.filter(([, e]) => e.status === 'ok' && e.hits.length === 0).length} / 未収集 ${all.filter(([, e]) => e.status === 'unprobed').length}`);
for (const [id, e] of all.filter(([, e]) => e.status === 'unprobed')) console.log('  未収集', e.char, id, e.command, '|', e.reason);
console.log('命中なし:', all.filter(([, e]) => e.status === 'ok' && e.hits.length === 0).map(([, e]) => e.char).join('、'));
