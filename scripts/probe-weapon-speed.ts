/**
 * 武器の「常時の通常攻撃速度」（gcsim の `AtkSpd`）を、実測で作る（D216。2026-10-15）。
 * 事前に gcsim のローカルサーバーを起動しておく（npm run gcsim:start）。
 *
 *   node scripts/probe-weapon-speed.ts        … src/data/weapon_atk_spd.json を書く
 *
 * gcsim は、通常攻撃のフレームを、攻撃速度で縮める（internal/frames/frames.go）:
 *   AtkSpdAdjust(f, spd) = f - int(min(spd, 0.1 + (spd - 0.1) / 2) * f)   （spd は 0.6 で頭打ち）
 * 武器ごとに、標準の武器（攻撃速度なし）と比べて、通常攻撃 3 段の間隔（敵に当てない・遅延なし）を測り、
 * 3 段とも一致する spd を求める（精錬ランク 1〜5）。常時の効果（天空の脊 +12%・鬼蜘蛛 +10% など）だけが見つかる。
 * 条件つき（天空の刃の爆発後・スタック・状態で変わるもの）は、最初の状態では 0 なので、記録されない。
 * キー = 武器の gcsim のキー。値は 精錬ランク → spd（0 でないものがあるときだけ）。
 */
import fs from 'node:fs';
import { GCSIM_SERVER_URL } from '../src/utils/gcsim/gcsimConfig.ts';

const catalog = JSON.parse(fs.readFileSync('public/data/gcsim_key_catalog.json', 'utf8'));
const weapons: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const BASE_WEAPON: Record<string, string> = { sword: 'dullblade', claymore: 'ultimateoverlordsmegamagicsword', polearm: 'beginnersprotector', bow: 'huntersbow', catalyst: 'apprenticesnotes' };
/** 武器種ごとの測定用のキャラ（通常攻撃が標準的で、攻撃速度の固有効果を持たない） */
const CHARACTER: Record<string, string> = { sword: 'xingqiu', claymore: 'razor', polearm: 'xiangling', bow: 'amber', catalyst: 'lisa' };
/** 測る段数。長いフレームも含めて、spd を一意にする（段数が増えても一致する = 常時の効果。スタックで増えるものは一致しない） */
const HITS = 8;

const adjust = (f: number, spd: number): number => {
  const s = Math.min(spd, 0.6);
  return f - Math.trunc(Math.min(s, 0.1 + (s - 0.1) / 2) * f);
};

async function intervals(char: string, weaponKey: string, refine: number): Promise<number[] | undefined> {
  const cfg = [
    `${char} char lvl=90/90 cons=0 talent=9,9,9;`,
    `${char} add weapon="${weaponKey}" refine=${refine} lvl=90/90;`,
    `${char} add stats cr=1;`,
    'options iteration=1 duration=30 swap_delay=12 ignore_burst_energy=true;',
    // 敵を遠くに置き、命中によるヒットストップを入れない
    'target lvl=100 resist=0.1 pos=30,30;',
    `active ${char};`,
    Array.from({ length: HITS + 1 }, () => `${char} attack;`).join(' '),
  ].join('\n');
  const res = await fetch(`${GCSIM_SERVER_URL}/sample/ws_${Date.now()}_${Math.random().toString(36).slice(2)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg, seed: 1 }) });
  try {
    const j = JSON.parse(await res.text());
    if (j.error || !j.logs) return undefined;
    const f = (j.logs as any[]).filter(l => l.event === 'action' && l.msg === 'executed attack').map(l => l.frame as number);
    if (f.length < HITS + 1) return undefined;
    return f.slice(1).map((v, i) => v - f[i]).slice(0, HITS);
  } catch {
    return undefined;
  }
}

const baseline: Record<string, number[]> = {};
for (const [type, key] of Object.entries(BASE_WEAPON)) {
  const iv = await intervals(CHARACTER[type], key, 1);
  if (!iv) throw new Error(`標準の武器が測れません: ${type}`);
  baseline[type] = iv;
}

const entries: Record<string, Record<string, number>> = {};
const conditional: string[] = [];
const ranges: string[] = [];
let measured = 0;
for (const w of weapons) {
  if (!w.gcsimKey) continue;
  const base = baseline[w.weaponType];
  if (!base) continue;
  const bySpd: Record<string, number> = {};
  for (let r = 1; r <= 5; r++) {
    const iv = await intervals(CHARACTER[w.weaponType], w.gcsimKey, r);
    if (!iv) continue;
    measured++;
    if (iv.every((v, i) => v === base[i])) continue;
    // 一致する spd の範囲（式が階段状なので、範囲になる）。中央を、0.005 刻みで採る
    const ok: number[] = [];
    for (let s = 0.005; s <= 0.6001; s += 0.005) {
      const spd = Number(s.toFixed(3));
      if (base.every((b, i) => adjust(b, spd) === iv[i])) ok.push(spd);
    }
    if (ok.length === 0) conditional.push(`${w.name}(${w.gcsimKey}) 精錬${r}: ${iv.join(',')} / 標準 ${base.join(',')}`);
    else {
      // 範囲の中に 0.01 刻みの値（ゲームの表記: 12%・10% など）があれば、中央に近いものを採る。無ければ、中央
      const mid = (ok[0] + ok[ok.length - 1]) / 2;
      const round = ok.filter(v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6);
      const pick = round.length > 0 ? round.reduce((p, v) => (Math.abs(v - mid) < Math.abs(p - mid) ? v : p)) : Number((Math.round(mid / 0.005) * 0.005).toFixed(3));
      bySpd[String(r)] = pick;
      ranges.push(`${w.gcsimKey} 精錬${r}: ${ok[0]}〜${ok[ok.length - 1]}`);
    }
  }
  if (Object.keys(bySpd).length > 0) entries[w.gcsimKey] = bySpd;
}

fs.writeFileSync('src/data/weapon_atk_spd.json', JSON.stringify({ gcsimCommit: catalog.gcsimCommit, generatedAt: new Date().toISOString(), entries }, null, 1) + '\n');
console.log(`測定 ${measured} 件 / 常時の攻撃速度を持つ武器 ${Object.keys(entries).length} 種`);
for (const [k, v] of Object.entries(entries)) console.log(`  ${k}: ${JSON.stringify(v)}`);
for (const l of ranges.slice(0, 40)) console.log('  範囲:', l);
console.log(`一致する攻撃速度が見つからなかった（条件つき・別の仕組み）: ${conditional.length} 件`);
for (const l of conditional.slice(0, 30)) console.log('  ?', l);
