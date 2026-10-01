import fs from 'node:fs';
import { mapAction } from '../src/utils/gcsim/actionMapping.ts';
const catalog = JSON.parse(fs.readFileSync('public/data/gcsim_key_catalog.json', 'utf8'));
const exact = new Map<string, any>(catalog.entries.filter((e: any) => !e.isPattern).map((e: any) => [e.key, e]));
const patterns = catalog.entries.filter((e: any) => e.isPattern).map((e: any) => ({ e, re: new RegExp('^' + e.key.replace(/[.+?^$()|[\]\\]/g, '\\$&').replace('{element}', '(' + (e.elements ?? []).join('|') + ')').replace(/\*/g, '.*') + '$') }));
const lookup = (k: string) => exact.get(k) ?? patterns.find((p: any) => p.re.test(k))?.e;
const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const chars: any[] = (Array.isArray(raw) ? raw : raw.characters ?? Object.values(raw)).filter((c: any) => c.source?.gcsimKey);
const table = JSON.parse(fs.readFileSync('public/data/action_effect_keys.json', 'utf8')).entries;
// 手で補う一覧（actionEffectKeyOverrides.ts）で指定済みの定義は「対応済み」として扱う（'' = 書き戻さない指定は対象外のまま）
import { ACTION_EFFECT_KEY_OVERRIDES } from '../src/masterdata/actionEffectKeyOverrides.ts';
import { GCSIM_SERVER_URL } from '../src/utils/gcsim/gcsimConfig.ts';
for (const [id, v] of Object.entries(ACTION_EFFECT_KEY_OVERRIDES)) {
  if (!table[id]) continue;
  if (v === '') table[id].status = table[id].status === 'ok' ? 'nokey' : table[id].status;
  else { table[id].status = 'ok'; table[id].keys = [{ key: typeof v === 'string' ? v : v.key }]; }
}
const weapons: Record<string, string> = { sword: 'dullblade', claymore: 'ultimateoverlordsmegamagicsword', polearm: 'beginnersprotector', bow: 'huntersbow', catalyst: 'apprenticesnotes' };

interface Row { id: string; label: string; type: string; status: string; keys: string; evidence: string[]; verdict: string }
const perChar = new Map<string, { name: string; rows: Row[] }>();

for (const c of chars) {
  const k = c.source.gcsimKey as string;
  for (const a of (c.availableActions ?? []).filter((x: any) => /skill|burst/.test(x.type))) {
    const e = table[a.id];
    if (!e) continue;
    const suffix = a.id.slice(a.id.indexOf('-') + 1);
    const row: Row = { id: a.id, label: `${a.name ?? suffix}（${suffix}）`, type: a.type, status: e.status, keys: e.keys.map((x: any) => x.key).join(', '), evidence: [], verdict: '' };
    if (e.status === 'unprobed') { row.evidence.push(`収集できなかった: ${e.reason}`); row.verdict = '未収集（手で補う）'; }
    else if (e.status === 'nokey') {
      const cmd = mapAction(a.id, c.weaponType).command!;
      const cfg = [`${k} char lvl=90/90 cons=0 talent=9,9,9;`, `${k} add weapon="${weapons[c.weaponType]}" refine=1 lvl=90/90;`, `${k} add stats cr=1;`,
        'options iteration=1 duration=60 swap_delay=12 ignore_burst_energy=true;', 'target lvl=100 resist=0.1;', `active ${k};`, `${k} ${cmd}; delay(900);`].join('\n');
      const r = await fetch(GCSIM_SERVER_URL + '/sample/rv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg, seed: 1 }) });
      const j = await r.json();
      if (j.error) { row.evidence.push(`実行エラー: ${j.error}`); row.verdict = '要確認'; }
      else {
        const L: any[] = j.logs;
        const cast = L.find(l => l.event === 'action' && l.msg.startsWith('executed'));
        const near = L.filter(l => l.frame >= cast.frame && l.frame - cast.frame <= 900);
        const statusKeys = [...new Set(near.filter(l => l.event === 'status').map(l => (l.logs?.key ?? l.logs?.status) as string))];
        const classified = statusKeys.map(key => { const en = lookup(key); return { key, cat: en?.category ?? '辞書外', kind: en?.kind ?? '-', permanent: en?.permanent, own: en?.owner?.gcsimKey === k }; });
        const candidates = classified.filter(x => x.kind === 'effect' && (x.cat === 'skill' || x.cat === 'burst' || x.cat === 'character'));
        const talents = classified.filter(x => x.cat === 'talent' || x.cat === 'constellation');
        const internals = classified.filter(x => x.kind === 'internal' || x.kind === 'cooldown');
        const constructs = [...new Set(near.filter(l => l.event === 'construct').map(l => l.msg.replace(/[0-9.]+/g, '#').slice(0, 50)))];
        const shield = near.filter(l => l.event === 'shield' || /shield/i.test(l.msg)).map(l => l.msg.slice(0, 40));
        const dmg = [...new Set(near.filter(l => l.event === 'damage').map(l => l.msg.slice(0, 30)))].slice(0, 4);
        if (constructs.length) row.evidence.push(`設置物（construct）: ${constructs.join(' / ')}`);
        if (shield.length) row.evidence.push(`シールドのイベントあり: ${[...new Set(shield)].slice(0, 2).join(' / ')}`);
        if (candidates.length) row.evidence.push(`辞書の効果キーが出たが条件を満たさなかった: ${candidates.map(x => `${x.key}[${x.cat}]`).join(', ')}`);
        if (talents.length) row.evidence.push(`天賦・命ノ星座の状態のみ: ${talents.map(x => x.key).join(', ')}`);
        if (internals.length) row.evidence.push(`内部（粒子CTなど）のみ: ${internals.map(x => x.key).join(', ')}`);
        if (classified.some(x => x.cat === '辞書外')) row.evidence.push(`辞書外のキー: ${classified.filter(x => x.cat === '辞書外').map(x => x.key).join(', ')}`);
        if (dmg.length) row.evidence.push(`ダメージのみ: ${dmg.join(' / ')}`);
        if (row.evidence.length === 0) row.evidence.push('状態・設置物・ダメージのイベントなし');
        row.verdict = candidates.length ? '要確認（効果のキー候補あり）' : constructs.length ? '設置物' : shield.length ? 'シールド' : talents.length && !dmg.length ? '天賦の状態のみ' : '状態なし（瞬間・持続ダメージ等）';
        if (candidates.length === 0 && talents.length && (constructs.length || shield.length)) row.verdict += '（天賦の状態も出る）';
      }
    } else row.evidence.push(`キー: ${row.keys}`);
    const entry = perChar.get(k) ?? { name: c.name, rows: [] };
    entry.rows.push(row);
    perChar.set(k, entry);
  }
}

const allNone = [...perChar.values()].filter(v => v.rows.every(r => r.status !== 'ok'));
const partial = [...perChar.values()].filter(v => v.rows.some(r => r.status === 'ok') && v.rows.some(r => r.status !== 'ok'));
const render = (title: string, list: typeof allNone, onlyNonOk: boolean) => {
  const out = [`## ${title}（${list.length} キャラ）`, ''];
  for (const v of list) {
    out.push(`### ${v.name}`);
    for (const r of v.rows) {
      if (onlyNonOk && r.status === 'ok') { out.push(`- ✅ ${r.label}: キーあり \`${r.keys}\``); continue; }
      out.push(`- ${r.status === 'unprobed' ? '⚠️' : '❌'} ${r.label} — **${r.verdict}**`);
      for (const ev of r.evidence) out.push(`  - ${ev}`);
    }
    out.push('');
  }
  return out;
};
const verdicts = new Map<string, number>();
for (const v of perChar.values()) for (const r of v.rows) if (r.status !== 'ok') verdicts.set(r.verdict, (verdicts.get(r.verdict) ?? 0) + 1);
const md = [
  '# スキル・爆発の効果キーが無い定義の一覧（根拠つき）',
  '',
  `作成: ${new Date().toISOString().slice(0, 10)} / gcsim v2.47.6（辞書のコミット ${String(catalog.gcsimCommit).slice(0, 8)}）/ 収集スクリプト: \`scripts/probe-effect-keys.ts\``,
  '',
  '各定義を、単独のキャラ（凸0・仮の武器）で1回実行し、発動から15秒間のログを調べた根拠を付けている。',
  '「判定」は根拠からの機械的な分類で、見落とし（本当はキーがある）が無いかを確認してもらうための一覧。',
  '',
  '判定の内訳（キー無し・未収集の定義）: ' + [...verdicts.entries()].map(([k, n]) => `${k} ${n} 件`).join(' / '),
  '',
  ...render('A. 全定義にキーが無いキャラ', allNone, false),
  ...render('B. 一部の定義だけキーが無いキャラ（キーがある定義も参考に表示）', partial, true),
];
fs.writeFileSync('docs/gcsim-integration/phase-6-run-and-apply/effect-key-review.md', md.join('\n') + '\n');
console.log(`A ${allNone.length} キャラ / B ${partial.length} キャラ`, [...verdicts.entries()]);
