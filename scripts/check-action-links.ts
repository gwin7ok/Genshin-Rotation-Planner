/**
 * スキル・爆発の紐付け（アクション定義の gcsimEffect / gcsimExtras / gcsimIncluded）が、入力（中間データ・手で補う一覧）と食い違っていないかの検査（D95）。
 *
 *   npm run check:action-links
 *
 * 比較の基準は、取り込みに移す前の「旧経路」の選び方（実行時に表と手で補う一覧から決めていた処理。applyActionEffectDurations の中の規則）を、ここに写したもの:
 *   候補のキー = 手で補う一覧（'' なら書き戻さない）→ 表の primary → 表のキー全部 / 求め方・自分限定 = 手で補う一覧 → 表
 * 食い違い（マスターを再生成していない・中間データだけを更新した、など）があれば、終了コード 1。
 */
import fs from 'node:fs';
import { ACTION_EFFECT_KEY_OVERRIDES } from '../src/masterdata/actionEffectKeyOverrides.ts';
import { ACTION_EFFECT_EXTRAS } from '../src/masterdata/actionEffectExtras.ts';
import { ACTION_EFFECT_INCLUDED } from '../src/masterdata/actionEffectIncluded.ts';

const table = JSON.parse(fs.readFileSync('public/data/action_effect_keys.json', 'utf8')).entries as Record<string, any>;
const raw = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const characters: any[] = Array.isArray(raw) ? raw : raw.characters;
const defs = new Map<string, any>();
for (const c of characters) for (const a of c.availableActions ?? []) defs.set(a.id, a);

/** 旧経路: { missing } | { skip } | { keys, mode, self } */
function oldResolve(defId: string): any {
  const override: any = (ACTION_EFFECT_KEY_OVERRIDES as any)[defId];
  if (override === '') return { skip: true };
  const entry = table[defId];
  if (!entry && override === undefined) return { missing: true };
  const ov = typeof override === 'string' ? (override ? { key: override } : undefined) : override;
  const keys = ov ? [ov.key, ...(ov.alt ?? [])] : entry?.primary ? [entry.primary] : (entry?.keys ?? []).map((c: any) => c.key);
  const mode = ov ? ov.mode ?? 'expiry' : entry?.mode ?? 'expiry';
  const self = ov ? ov.self === true : entry?.self === true;
  return { keys, mode, self };
}
function newResolve(defId: string): any {
  const d = defs.get(defId);
  const l = d?.gcsimEffect;
  if (!l) return { missing: true };
  if (l.skip) return { skip: true };
  return { keys: l.keys, mode: l.mode ?? 'expiry', self: l.self === true };
}

const problems: string[] = [];
const ids = new Set<string>([...Object.keys(table), ...Object.keys(ACTION_EFFECT_KEY_OVERRIDES), ...defs.keys()]);
let compared = 0;
for (const id of ids) {
  if (!defs.has(id)) {
    if (table[id] || (ACTION_EFFECT_KEY_OVERRIDES as any)[id] !== undefined) problems.push(`マスターのアクション定義に無い ID: ${id}`);
    continue;
  }
  const a = JSON.stringify(oldResolve(id));
  const b = JSON.stringify(newResolve(id));
  compared++;
  if (a !== b) problems.push(`本体の紐付けが食い違う: ${id}\n    入力から: ${a}\n    マスター: ${b}`);
}
for (const [src, field, name] of [[ACTION_EFFECT_EXTRAS, 'gcsimExtras', '副次効果'], [ACTION_EFFECT_INCLUDED, 'gcsimIncluded', '含まれる効果']] as const) {
  for (const id of new Set([...Object.keys(src), ...[...defs.values()].filter(d => d[field]?.length).map(d => d.id)])) {
    const a = JSON.stringify((src as any)[id] ?? []);
    const b = JSON.stringify(defs.get(id)?.[field] ?? []);
    if (a !== b) problems.push(`${name}が食い違う: ${id}`);
  }
}
console.log(`本体の紐付け: ${compared} 件のアクション定義を、入力と比べた`);
if (problems.length === 0) console.log('✓ アクション定義の紐付けは、入力（中間データ・手で補う一覧）と一致している');
else {
  console.log(`✗ 食い違い ${problems.length} 件（npm run link:actions で取り込み直す）`);
  for (const p of problems.slice(0, 30)) console.log('  ' + p);
}
process.exit(problems.length === 0 ? 0 : 1);
