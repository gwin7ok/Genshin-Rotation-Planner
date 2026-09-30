/**
 * スキル・爆発の効果の対応表（カバレッジ）を作り、「未検討」を報告する（フェーズ6 / 6-3b'）。
 *
 *   npm run check:effectkeys
 *
 * リレーショナルデータベースの形の 4 つのテーブルにする（src/masterdata/effectKeyCoverage.ts）:
 *   effects（gcsim の効果）/ targets（アプリ側の対象）/ links（効果 ↔ 対象の組。中間表）/ unlinked（紐づけない理由）
 *
 * 入力:
 *   - gcsim のキーの辞書（src/data/gcsim_key_catalog.json）… 分類が skill / burst / character / attack の効果のキー
 *   - gcsim のソースの設置物名（pkg/core/construct/construct.go の ConstructString）… ネットワークに繋がらないときは省略
 *   - キー表（src/data/action_effect_keys.json）と、実行時に見つかった設置物・シールド・継続ダメージ（action_effect_links_by_duration.json）
 *   - 手で補う一覧（actionEffectKeyOverrides.ts / actionEffectExtras.ts）、承認済みの一覧（actionEffectApproved.ts）
 *   - 紐づけない決定（effectKeyDecisions.ts）
 *   - マスター（characters_master_data.json）のスキル・爆発のアクション定義
 * 出力: src/data/effect_key_coverage.json と docs/gcsim-integration/phase-6-run-and-apply/effect-key-coverage.md
 *
 * 読み方: 「紐づけた」でも「紐づけないと決めた（理由つき）」でもない行が「未検討」= gcsim の更新や新キャラのとき検討する範囲。
 * 整合性の検査（エラーがあれば終了コード 1）:
 *   - 存在しない効果・対象を指す紐づけ（孤立）、重複した紐づけ
 *   - links と unlinked の両方に同じ ID が入っている（紐づけたのに、古い「紐づけない」決定が残っている）
 *   - 決定（effectKeyDecisions.ts）が、紐づけ済みの効果・対象を指している（同上）→ エラー / 存在しない ID を指している → 警告
 * `--check` を付けると、ネットワークに繋がず、ファイルも書かずに、検査だけを行う（変更のたびに素早く確かめる用）。
 */
import fs from 'node:fs';
import { ACTION_EFFECT_KEY_OVERRIDES } from '../src/masterdata/actionEffectKeyOverrides.ts';
import { ACTION_EFFECT_EXTRAS } from '../src/masterdata/actionEffectExtras.ts';
import { ACTION_EFFECT_INCLUDED } from '../src/masterdata/actionEffectIncluded.ts';
import { APPROVED_STATUS_LINKS } from '../src/masterdata/actionEffectApproved.ts';
import { KEY_DECISIONS, DEF_DECISIONS } from '../src/masterdata/effectKeyDecisions.ts';
import {
  UNLINKED_REASON_LABELS,
  type EffectKeyCoverage, type EffectRow, type LinkRow, type TargetRow, type UnlinkedReason, type UnlinkedRow,
} from '../src/masterdata/effectKeyCoverage.ts';

const SCOPE_CATEGORIES = new Set(['skill', 'burst', 'character', 'attack']);
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

const catalog = readJson('src/data/gcsim_key_catalog.json');
const table: Record<string, any> = readJson('src/data/action_effect_keys.json').entries;
const runtimeLinks: Record<string, any> = fs.existsSync('src/data/action_effect_links_by_duration.json') ? readJson('src/data/action_effect_links_by_duration.json').entries : {};
const rawChars = readJson('src/data/characters_master_data.json');
const chars: any[] = Array.isArray(rawChars) ? rawChars : rawChars.characters ?? Object.values(rawChars);
const gcsimCharKeys = new Set<string>(chars.map(c => c.source?.gcsimKey).filter(Boolean));

// ---- links（効果 ↔ 対象）----
const links: LinkRow[] = [];
const overrideSkipped = new Set<string>();
for (const [defId, e] of Object.entries(table)) {
  const ov = ACTION_EFFECT_KEY_OVERRIDES[defId];
  const targetId = `action:${defId}`;
  if (ov === '') { overrideSkipped.add(defId); continue; }
  if (ov !== undefined) {
    const o = typeof ov === 'string' ? { key: ov } : ov;
    for (const alt of ('alt' in o ? o.alt ?? [] : [])) links.push({ effectId: alt, targetId, role: 'main', ...(o.mode && o.mode !== 'expiry' ? { mode: o.mode } : {}), ...(o.self ? { self: true } : {}), approval: 'approved' });
    links.push({ effectId: o.key, targetId, role: 'main', ...(o.mode && o.mode !== 'expiry' ? { mode: o.mode } : {}), ...(o.self ? { self: true } : {}), approval: 'approved' });
  } else if (e.status === 'ok' && e.primary) {
    links.push({
      effectId: e.primary, targetId, role: 'main',
      ...(e.mode && e.mode !== 'expiry' ? { mode: e.mode } : {}), ...(e.self ? { self: true } : {}),
      approval: e.via === 'duration-match' ? (APPROVED_STATUS_LINKS.has(e.primary) ? 'approved' : 'auto') : 'auto',
    });
  }
}
for (const [defId, extras] of Object.entries(ACTION_EFFECT_EXTRAS)) {
  for (const x of extras) links.push({ effectId: x.key, targetId: `action:${defId}`, role: 'extra', label: x.label, ...(x.self ? { self: true } : {}), approval: 'approved' });
}

for (const [defId, list] of Object.entries(ACTION_EFFECT_INCLUDED)) {
  for (const x of list) links.push({ effectId: x.key, targetId: `action:${defId}`, role: 'included', label: x.note, approval: 'approved' });
}

// ---- gcsim のソースの設置物名 ----
const CHECK_ONLY = process.argv.includes('--check');
let constructNames: string[] = [];
try {
  if (CHECK_ONLY) throw new Error('--check のため取得しない');
  const res = await fetch('https://raw.githubusercontent.com/genshinsim/gcsim/main/pkg/core/construct/construct.go');
  if (res.ok) {
    const text = await res.text();
    const arr = /ConstructString\s*=\s*\[\.\.\.\]string\{([\s\S]*?)\}/.exec(text)?.[1] ?? '';
    constructNames = [...arr.matchAll(/"([^"]+)"/g)].map(m => m[1]).filter(n => n !== 'Invalid');
  } else console.log(`設置物名の取得に失敗: HTTP ${res.status}`);
} catch (e) {
  if (!CHECK_ONLY) console.log(`設置物名の取得に失敗（省略）: ${(e as Error).message}`);
}

// ---- effects（gcsim の効果）----
const sourceOf = (id: string): EffectRow['source'] =>
  id.startsWith('construct:') ? 'construct' : id.startsWith('shield:') ? 'shield' : id.startsWith('damage:') ? 'damage' : 'status';
const effects = new Map<string, EffectRow>();
for (const e of catalog.entries) {
  if (e.kind !== 'effect' || !SCOPE_CATEGORIES.has(e.category)) continue;
  effects.set(e.key, { id: e.key, source: 'status', category: e.category, owner: e.owner?.gcsimKey, name: e.name ?? e.nameEn, ...(e.permanent ? { permanent: true } : {}) });
}
const ensureRuntimeRow = (id: string) => {
  if (!effects.has(id)) effects.set(id, { id, source: sourceOf(id), category: 'runtime' });
};
for (const name of constructNames) ensureRuntimeRow(`construct:${name}`);
for (const v of Object.values(runtimeLinks)) for (const c of v.candidates ?? []) if (/^(construct|shield|damage):/.test(c.key)) ensureRuntimeRow(c.key);
for (const l of links) {
  if (effects.has(l.effectId)) continue;
  const en = catalog.entries.find((x: any) => x.key === l.effectId);
  effects.set(l.effectId, { id: l.effectId, source: sourceOf(l.effectId), category: en?.category ?? 'runtime', owner: en?.owner?.gcsimKey, name: en?.name ?? en?.nameEn });
}

// ---- unlinked（紐づけない理由）と targets（アプリ側の対象）----
const linkedEffects = new Set(links.map(l => l.effectId));
const linkedTargets = new Set(links.map(l => l.targetId));
const unlinked: UnlinkedRow[] = [];
for (const row of effects.values()) {
  if (linkedEffects.has(row.id)) continue;
  const d = KEY_DECISIONS[row.id];
  if (d) unlinked.push({ side: 'effect', id: row.id, reason: d.reason, note: d.note });
  else if (row.permanent) unlinked.push({ side: 'effect', id: row.id, reason: 'permanent' });
  else if (row.owner && row.category !== 'runtime' && !gcsimCharKeys.has(row.owner)) unlinked.push({ side: 'effect', id: row.id, reason: 'not-in-app', note: 'gcsim にあるが、アプリのマスターにキャラが無い' });
  else unlinked.push({ side: 'effect', id: row.id, reason: 'unreviewed' });
}
const targets: TargetRow[] = [];
// スキル・爆発に加えて、紐づけが参照するアクション定義（デュリンの通常攻撃など）も対象にする
const referencedDefs = new Set(links.map(l => l.targetId.replace(/^action:/, '')));
for (const c of chars) {
  for (const a of (c.availableActions ?? []).filter((x: any) => /skill|burst/.test(x.type) || referencedDefs.has(x.id))) {
    const id = `action:${a.id}`;
    targets.push({ id, type: 'action', char: c.name, actionType: a.type });
    if (linkedTargets.has(id)) continue;
    const d = DEF_DECISIONS[a.id];
    const entry = table[a.id];
    if (!c.source?.gcsimKey) unlinked.push({ side: 'target', id, reason: 'not-in-gcsim', note: 'gcsim にキャラが未登録' });
    else if (d) unlinked.push({ side: 'target', id, reason: d.reason, note: d.note });
    else if (overrideSkipped.has(a.id)) unlinked.push({ side: 'target', id, reason: 'deferred', note: '手で補う一覧で「書き戻さない」と指定' });
    else if (entry?.status === 'unprobed') unlinked.push({ side: 'target', id, reason: 'unprobable', note: entry.reason });
    else if (entry?.status === 'nokey') unlinked.push({ side: 'target', id, reason: 'no-event' });
    else unlinked.push({ side: 'target', id, reason: 'unreviewed' });
  }
}

// ---- 整合性の検査（紐づけが、存在しない効果・対象を指していないか。重複がないか）----
const targetIds = new Set(targets.map(t => t.id));
const orphanLinks = links.filter(l => !effects.has(l.effectId) || !targetIds.has(l.targetId));
const duplicateLinks = links.filter((l, i) => links.findIndex(x => x.effectId === l.effectId && x.targetId === l.targetId && x.role === l.role) !== i);

// links と unlinked に同じ ID が入っていないか / 決定が古くなっていないか
const errors: string[] = [];
const warnings: string[] = [];
const linkedEffectIds = new Set(links.map(l => l.effectId));
const linkedTargetIds = new Set(links.map(l => l.targetId));
for (const u of unlinked) {
  if ((u.side === 'effect' && linkedEffectIds.has(u.id)) || (u.side === 'target' && linkedTargetIds.has(u.id))) errors.push(`links と unlinked の両方に入っている: ${u.side} ${u.id}`);
}
for (const id of Object.keys(KEY_DECISIONS)) {
  if (linkedEffectIds.has(id)) errors.push(`決定（effectKeyDecisions.ts）が紐づけ済みの効果を指している（古い決定を消してください）: ${id}`);
  else if (!effects.has(id)) warnings.push(`決定が存在しない効果を指している（gcsim の更新で消えた・書き間違い）: ${id}`);
}
for (const id of Object.keys(DEF_DECISIONS)) {
  if (linkedTargetIds.has(`action:${id}`)) errors.push(`決定（effectKeyDecisions.ts）が紐づけ済みのアクション定義を指している（古い決定を消してください）: ${id}`);
  else if (!targetIds.has(`action:${id}`)) warnings.push(`決定が存在しないアクション定義を指している: ${id}`);
}

const coverage: EffectKeyCoverage = { gcsimCommit: catalog.gcsimCommit, generatedAt: new Date().toISOString(), effects: [...effects.values()], targets, links, unlinked };
if (!CHECK_ONLY) fs.writeFileSync('src/data/effect_key_coverage.json', JSON.stringify(coverage));

// ---- 報告 ----
const count = <T>(list: T[], f: (x: T) => string) => list.reduce<Record<string, number>>((m, x) => { const k = f(x); m[k] = (m[k] ?? 0) + 1; return m; }, {});
const label = (r: string) => (r === 'linked' ? '紐づけ済み' : UNLINKED_REASON_LABELS[r as UnlinkedReason]);
const fmtCounts = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${label(k)} | ${v} |`).join('\n');
const stateOf = (side: 'effect' | 'target') => new Map(unlinked.filter(u => u.side === side).map(u => [u.id, u]));
const effState = stateOf('effect');
const tgtState = stateOf('target');
const effectCounts = count(coverage.effects, e => effState.get(e.id)?.reason ?? 'linked');
const targetCounts = count(coverage.targets, t => tgtState.get(t.id)?.reason ?? 'linked');
const approvalCounts = count(links, l => `${l.role}/${l.approval}`);

const unreviewedEffects = coverage.effects.filter(e => effState.get(e.id)?.reason === 'unreviewed');
const unreviewedTargets = coverage.targets.filter(t => tgtState.get(t.id)?.reason === 'unreviewed');
const byOwner = new Map<string, EffectRow[]>();
for (const e of unreviewedEffects) {
  const o = e.owner ?? '(持ち主なし)';
  byOwner.set(o, [...(byOwner.get(o) ?? []), e]);
}

const md = [
  '# スキル・爆発の効果の対応表（カバレッジ）',
  '',
  `作成: ${new Date().toISOString().slice(0, 10)} / gcsim の辞書のコミット ${String(catalog.gcsimCommit).slice(0, 8)} / 生成: \`npm run check:effectkeys\`（\`scripts/build-effect-coverage.ts\`）`,
  '',
  '4 つのテーブル: `effects`（gcsim の効果）/ `targets`（アプリ側の対象）/ `links`（効果 ↔ 対象の組。中間表）/ `unlinked`（紐づけない理由）。',
  '「未検討」= 紐づけも「紐づけない」の決定（理由）も無いもの。gcsim の更新・新キャラのとき、検討する範囲。',
  '決定は `src/masterdata/effectKeyDecisions.ts`、紐づけは `actionEffectKeyOverrides.ts` / `actionEffectExtras.ts` に書く。',
  '',
  `## effects（gcsim の効果。分類が skill / burst / character / attack と、実行時に見つかった設置物・シールド・継続ダメージ。${coverage.effects.length} 件）`,
  '',
  '| 状態 | 件数 |', '|---|---|', fmtCounts(effectCounts), '',
  `設置物名（gcsim のソース）: ${constructNames.length} 件${constructNames.length === 0 ? '（取得できなかった）' : ''}`,
  '',
  `## targets（アプリのスキル・爆発のアクション定義。${coverage.targets.length} 件）`,
  '',
  '| 状態 | 件数 |', '|---|---|', fmtCounts(targetCounts), '',
  `## links（効果 ↔ 対象。${links.length} 件）`,
  '',
  `内訳: ${Object.entries(approvalCounts).map(([k, v]) => `${k}=${v}`).join(' / ')}`,
  `整合性: 存在しない効果・対象を指す紐づけ ${orphanLinks.length} 件 / 重複 ${duplicateLinks.length} 件`,
  ...orphanLinks.map(l => `- 孤立: ${l.effectId} ↔ ${l.targetId}`),
  '',
  `## 未検討のアクション定義（${unreviewedTargets.length} 件）`,
  '',
  ...(unreviewedTargets.length === 0 ? ['なし'] : unreviewedTargets.map(t => `- ${t.char} \`${t.id}\``)),
  '',
  `## 未検討の効果（${unreviewedEffects.length} 件。持ち主ごと）`,
  '',
  ...[...byOwner.entries()].sort((a, b) => a[0].localeCompare(b[0])).flatMap(([owner, rows]) => [
    `### ${owner}`,
    ...rows.map(r => `- \`${r.id}\` [${r.category}] ${r.name ?? ''}`),
  ]),
  '',
];
if (!CHECK_ONLY) fs.writeFileSync('docs/gcsim-integration/phase-6-run-and-apply/effect-key-coverage.md', md.join('\n'));

console.log(`effects ${coverage.effects.length} 件:`, JSON.stringify(Object.fromEntries(Object.entries(effectCounts).map(([k, v]) => [label(k), v]))));
console.log(`targets ${coverage.targets.length} 件:`, JSON.stringify(Object.fromEntries(Object.entries(targetCounts).map(([k, v]) => [label(k), v]))));
console.log(`links ${links.length} 件:`, JSON.stringify(approvalCounts), `/ 孤立 ${orphanLinks.length} / 重複 ${duplicateLinks.length}`);
console.log(`未検討: 効果 ${unreviewedEffects.length} 件 / 対象 ${unreviewedTargets.length} 件`);
for (const l of orphanLinks) errors.push(`孤立した紐づけ: ${l.effectId} ↔ ${l.targetId}`);
for (const l of duplicateLinks) errors.push(`重複した紐づけ: ${l.effectId} ↔ ${l.targetId} (${l.role})`);
for (const w of warnings) console.log(`警告: ${w}`);
for (const e of errors) console.log(`エラー: ${e}`);
console.log(errors.length === 0 ? '整合性の検査: OK' : `整合性の検査: エラー ${errors.length} 件`);
if (errors.length > 0) process.exitCode = 1;
