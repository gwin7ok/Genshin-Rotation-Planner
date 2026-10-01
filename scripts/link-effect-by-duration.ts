/**
 * 効果キーが見つからなかった定義（キー無し・未収集）を、genshin-db の効果継続時間（マスターの effectDuration）を基準に、
 * gcsim のログの「継続時間を持つイベント」に紐づけられないか調べる（フェーズ6 / 6-3b'）。
 * 事前に gcsim のローカルサーバーを起動しておく（npm run gcsim:start。バージョン・ポートは gcsim.config.json）。
 *
 *   node scripts/link-effect-by-duration.ts
 *
 * 各定義を単独で1回実行し（発動から 60 秒間）、発動から 15 秒以内に始まる次のイベントを候補にする:
 *   - status … 状態（辞書の分類を問わない）。継続時間 = expiry − 発生
 *   - construct … 設置物。継続時間 = created 〜 destroyed
 *   - shield … シールド。継続時間 = added 〜 expired（または expiry）
 * マスターの効果継続時間に最も近い候補が、許容差（1 秒または 10%）以内なら「一致」とする。
 * 結果は src/data/action_effect_links_by_duration.json に書き、キー表への追加（probe-effect-keys.ts）が読む。
 */
import fs from 'node:fs';
import { mapAction } from '../src/utils/gcsim/actionMapping.ts';
import { APPROVED_STATUS_LINKS } from '../src/masterdata/actionEffectApproved.ts';
import { GCSIM_SERVER_URL } from '../src/utils/gcsim/gcsimConfig.ts';

const catalog = JSON.parse(fs.readFileSync('public/data/gcsim_key_catalog.json', 'utf8'));
const exact = new Map<string, any>(catalog.entries.filter((e: any) => !e.isPattern).map((e: any) => [e.key, e]));
const patterns = catalog.entries.filter((e: any) => e.isPattern).map((e: any) => ({ e, re: new RegExp('^' + e.key.replace(/[.+?^$()|[\]\\]/g, '\\$&').replace('{element}', '(' + (e.elements ?? []).join('|') + ')').replace(/\*/g, '.*') + '$') }));
const lookup = (k: string) => exact.get(k) ?? patterns.find((p: any) => p.re.test(k))?.e;

const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const chars: any[] = (Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw)).filter((c: any) => c.source?.gcsimKey);
const table = JSON.parse(fs.readFileSync('public/data/action_effect_keys.json', 'utf8')).entries;
const weapons: Record<string, string> = { sword: 'dullblade', claymore: 'ultimateoverlordsmegamagicsword', polearm: 'beginnersprotector', bow: 'huntersbow', catalyst: 'apprenticesnotes' };

const WINDOW_FRAMES = 15 * 60;
const tolerance = (master: number) => Math.max(1.0, master * 0.1);

export interface Candidate {
  source: 'status' | 'construct' | 'shield' | 'damage';
  key: string;
  seconds: number;
  /** 継続時間の求め方（action_effect_keys の mode。expiry = 終了予定 / ended = 実際の終了 / span = 更新が続く間） */
  mode?: 'expiry' | 'ended' | 'span';
  category?: string;
  kind?: string;
}
const out: Record<string, { char: string; type: string; master?: number; candidates: Candidate[]; match?: Candidate; note?: string }> = {};

for (const c of chars) {
  const k = c.source.gcsimKey as string;
  for (const a of (c.availableActions ?? []).filter((x: any) => /skill|burst/.test(x.type))) {
    const e = table[a.id];
    if (!e || e.status === 'ok') continue;
    const cmd = mapAction(a.id, c.weaponType).command;
    const master = typeof a.effectDuration === 'number' && a.effectDuration > 0 ? a.effectDuration : undefined;
    if (!cmd) { out[a.id] = { char: c.name, type: a.type, master, candidates: [], note: '変換規則なし' }; continue; }
    const cfg = [`${k} char lvl=90/90 cons=0 talent=9,9,9;`, `${k} add weapon="${weapons[c.weaponType]}" refine=1 lvl=90/90;`, `${k} add stats cr=1;`,
      'options iteration=1 duration=90 swap_delay=12 ignore_burst_energy=true;', 'target lvl=100 resist=0.1;', `active ${k};`, `${k} ${cmd}; delay(4200);`].join('\n');
    const res = await fetch(GCSIM_SERVER_URL + '/sample/lk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg, seed: 1 }) });
    const text = await res.text();
    let j: any;
    try { j = JSON.parse(text); } catch { j = { error: text.trim().slice(0, 100) }; }
    if (j.error) { out[a.id] = { char: c.name, type: a.type, master, candidates: [], note: `実行エラー: ${j.error}` }; continue; }
    const L: any[] = j.logs;
    const cast = L.find(l => l.event === 'action' && l.msg.startsWith('executed'));
    const inWindow = (l: any) => l.frame >= cast.frame && l.frame - cast.frame <= WINDOW_FRAMES;
    const candidates: Candidate[] = [];

    // status: 発動から 15 秒以内のイベントをキーごとにまとめる。
    //   終了予定があれば expiry（終了予定 − 発生）/ 終了予定が無く、実際の終了があれば ended（夜魂の状態など）/
    //   イベントが 3 回以上続くなら span（最後 − 最初。効果の間ずっと更新される状態）も候補にする
    const statusByKey = new Map<string, any[]>();
    for (const l of L.filter(l => l.event === 'status' && inWindow(l))) {
      const key = (l.logs?.key ?? l.logs?.status) as string | undefined;
      if (!key) continue;
      (statusByKey.get(key) ?? statusByKey.set(key, []).get(key)!).push(l);
    }
    for (const [key, evs] of statusByKey) {
      const en = lookup(key);
      if (en && en.kind === 'internal') continue;
      const first = evs[0];
      const info = { category: en?.category ?? '辞書外', kind: en?.kind };
      if (typeof first.logs?.expiry === 'number' && first.logs.expiry > 0) {
        candidates.push({ source: 'status', key, mode: 'expiry', seconds: Number(((first.logs.expiry - first.frame) / 60).toFixed(2)), ...info });
      } else if (typeof first.ended === 'number' && first.ended > first.frame + 30) {
        candidates.push({ source: 'status', key, mode: 'ended', seconds: Number(((first.ended - first.frame) / 60).toFixed(2)), ...info });
      }
      // 更新が続く間（イベントの間隔が 5 秒以内）の最後まで。15 秒の窓の外まで続く効果も測る
      const chain: any[] = [];
      for (const l of L.filter(x => x.event === 'status' && (x.logs?.key ?? x.logs?.status) === key && x.frame >= first.frame)) {
        if (chain.length > 0 && l.frame - chain[chain.length - 1].frame > 300) break;
        chain.push(l);
      }
      if (chain.length >= 3) {
        candidates.push({ source: 'status', key, mode: 'span', seconds: Number(((chain[chain.length - 1].frame - first.frame) / 60).toFixed(2)), ...info });
      }
    }
    // damage: 同じ名前のダメージが 3 回以上、3 秒以内の間隔で続くまとまり（継続ダメージ）。継続時間 = 最後 − 最初 + 命中間隔の中央値
    {
      const groups = new Map<string, number[]>();
      for (const l of L.filter(l => l.event === 'damage' && l.char_index === 0 && inWindow(l))) (groups.get(l.msg) ?? groups.set(l.msg, []).get(l.msg)!).push(l.frame);
      for (const [abil, frames] of groups) {
        frames.sort((x, y) => x - y);
        let cluster: number[] = [];
        const flush = () => {
          if (cluster.length >= 3 && !candidates.some(x => x.key === `damage:${abil}`)) {
            const gaps = cluster.slice(1).map((f, idx) => f - cluster[idx]).sort((x, y) => x - y);
            const median = gaps[Math.floor(gaps.length / 2)];
            candidates.push({ source: 'damage', key: `damage:${abil}`, mode: 'expiry', seconds: Number(((cluster[cluster.length - 1] - cluster[0] + median) / 60).toFixed(2)) });
          }
          cluster = [];
        };
        for (const f of frames) {
          if (cluster.length > 0 && f - cluster[cluster.length - 1] > 180) flush();
          cluster.push(f);
        }
        flush();
      }
    }
    // construct: created 〜 destroyed（同じ key の最初の destroyed）
    for (const l of L.filter(l => l.event === 'construct' && /construct created/.test(l.msg) && inWindow(l))) {
      const name = l.msg.replace('construct created: ', '');
      const dest = L.find(d => d.event === 'construct' && d.frame > l.frame && /construct destroyed/.test(d.msg) && d.logs?.key === l.logs?.key);
      if (dest && !candidates.some(x => x.key === `construct:${name}`)) candidates.push({ source: 'construct', key: `construct:${name}`, seconds: Number(((dest.frame - l.frame) / 60).toFixed(2)) });
    }
    // shield: added 〜 expired（無ければ expiry）
    for (const l of L.filter(l => l.event === 'shield' && l.msg === 'shield added' && inWindow(l))) {
      const name = l.logs?.name as string;
      const exp = L.find(d => d.event === 'shield' && d.frame > l.frame && /shield (expired|removed|broken)/.test(d.msg) && d.logs?.name === name);
      const endFrame = exp?.frame ?? l.logs?.expiry;
      if (typeof endFrame === 'number' && !candidates.some(x => x.key === `shield:${name}`)) candidates.push({ source: 'shield', key: `shield:${name}`, seconds: Number(((endFrame - l.frame) / 60).toFixed(2)) });
    }
    let match: Candidate | undefined;
    if (master !== undefined) {
      const best = [...candidates].sort((x, y) => Math.abs(x.seconds - master) - Math.abs(y.seconds - master))[0];
      if (best && Math.abs(best.seconds - master) <= tolerance(master)) match = best;
    }
    out[a.id] = { char: c.name, type: a.type, master, candidates, ...(match ? { match } : {}) };
  }
}

fs.writeFileSync('src/data/action_effect_links_by_duration.json', JSON.stringify({ gcsimCommit: catalog.gcsimCommit, generatedAt: new Date().toISOString(), entries: out }, null, 1));
const all = Object.entries(out);
const withMaster = all.filter(([, v]) => v.master !== undefined);
const matched = all.filter(([, v]) => v.match);
console.log(`調査 ${all.length} 定義 / マスターの効果時間あり ${withMaster.length} / 一致 ${matched.length}`);
const bySource = (s: string) => matched.filter(([, v]) => v.match!.source === s).length;
console.log(`  一致の内訳: status ${bySource('status')} / construct ${bySource('construct')} / shield ${bySource('shield')}`);
for (const [id, v] of matched) console.log(`  一致 ${v.char} ${id.split('-')[1]} master=${v.master}s ← ${v.match!.source}:${v.match!.key} ${v.match!.seconds}s${v.match!.category ? ` [${v.match!.category}/${v.match!.kind}]` : ''}`);
console.log('--- マスターの効果時間があるのに一致しなかった定義（候補あり）');
for (const [id, v] of withMaster.filter(([, x]) => !x.match && x.candidates.length)) console.log(`  ${v.char} ${id.split('-')[1]} master=${v.master}s | ${v.candidates.map(x => `${x.source}:${x.key}=${x.seconds}s`).join(', ')}`);
console.log('--- マスターの効果時間が無い定義で、設置物・シールドの候補があるもの');
for (const [id, v] of all.filter(([, x]) => x.master === undefined && x.candidates.some(y => y.source !== 'status'))) console.log(`  ${v.char} ${id.split('-')[1]} | ${v.candidates.filter(y => y.source !== 'status').map(x => `${x.source}:${x.key}=${x.seconds}s`).join(', ')}`);

// ---- キー表（action_effect_keys.json）へ追加する ----
// 一致した定義に加えて、マスターの効果時間が無い定義でも、同じキャラ・同じ種類の別の定義が同じ設置物・シールドに一致していれば、
// 同じキーを使う（例: 綺良々の短押し長押しは、通常・長押しと同じシールド）。
// 継続時間が 1 秒未満の短いシールド（反撃の受け流し用）と、一致しなかったもの（例: 鍾離の柱 31 秒 / マスター 20 秒）は追加しない。
const patchFile = JSON.parse(fs.readFileSync('public/data/action_effect_keys.json', 'utf8'));
let added = 0;
for (const [id, v] of all) {
  let pick = v.match;
  if (!pick && v.master === undefined) {
    const siblings = all.filter(([sid, sv]) => sid !== id && sv.char === v.char && sv.type === v.type && sv.match && sv.match.source !== 'status');
    pick = v.candidates.find(cnd => cnd.source !== 'status' && cnd.seconds >= 1 && siblings.some(([, sv]) => sv.match!.key === cnd.key));
  }
  if (!pick) continue;
  const entry = patchFile.entries[id];
  entry.status = 'ok';
  entry.via = 'duration-match';
  entry.keys = [{ key: pick.key, events: 1, casts: 1, seconds: [pick.seconds] }];
  entry.primary = pick.key;
  if (pick.mode && pick.mode !== 'expiry') entry.mode = pick.mode; else delete entry.mode;
  if (pick.key === 'nightsoul-blessing') entry.self = true;
  if (v.master !== undefined) entry.master = v.master;
  // 分類が天賦/キャラの状態のキーを継続時間の一致だけで対応付けたもの: 確認済み（2026-09-30 ユーザーがゲーム内の説明と照合して承認）でなければ要確認の印を付ける
  if (pick.source === 'status' && (pick.category === 'talent' || pick.category === 'character') && !APPROVED_STATUS_LINKS.has(pick.key)) entry.review = '分類が天賦/キャラの状態のキーを、継続時間の一致だけで対応付けた（要確認）';
  delete entry.reason;
  added++;
}
fs.writeFileSync('public/data/action_effect_keys.json', JSON.stringify(patchFile, null, 1));
console.log(`キー表に ${added} 定義を追加`);
