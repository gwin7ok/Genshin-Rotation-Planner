/**
 * 固有天賦・命ノ星座・武器・聖遺物・元素共鳴について、マスター定義と
 * gcsim キーの両方向カバレッジを生成する。
 *
 *   npm run coverage:master-effects
 *   npm run verify:master-effects
 *
 * アクション効果用の effect_key_coverage.json は変更せず、将来統合しやすい
 * effects / targets / links / unlinked の構造で別レポートを出力する。
 */
import fs from 'node:fs';
import { IGNORED_KEYS, INTERNAL_INTERVAL_KEYS, slotOfEntry } from '../src/masterdata/buffGcsimLink.ts';
import { NATURE_EXCEPTIONS, NATURE_LABEL, isDisplayWorthyNature, natureOfText } from '../src/masterdata/effectNature.ts';
import type {
  MasterEffectCoverage, MasterEffectDisposition, MasterEffectKeyRow,
  MasterEffectLinkRow, MasterEffectTargetRow, MasterEffectTargetType,
} from '../src/masterdata/masterEffectCoverage.ts';

const CHECK_ONLY = process.argv.includes('--check');
const readJson = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const catalog = readJson('public/data/gcsim_key_catalog.json');
const characters: any[] = readJson('src/data/characters_master_data.json');
const weapons: any[] = readJson('src/data/weapons_master_data.json');
const artifacts: any[] = readJson('src/data/artifacts_master_data.json');

const characterByGcsimKey = new Map(characters.filter(c => c.source?.gcsimKey).map(c => [c.source.gcsimKey, c]));
const weaponByGcsimKey = new Map(weapons.filter(w => w.gcsimKey).map(w => [w.gcsimKey, w]));
const artifactByGcsimKey = new Map(artifacts.filter(a => a.gcsimKey).map(a => [a.gcsimKey, a]));

// These are the elemental resonance statuses present in the catalog. Electro has no
// separate key in this catalog; the resonance target remains visible as unreviewed.
const RESONANCE_KEY_TO_ELEMENT: Record<string, string> = {
  'pyro-res': 'pyro',
  'hydro-res-hpp': 'hydro',
  'electro-res': 'electro',
  'cryo-res': 'cryo',
  'anemo-res-cd': 'anemo',
  'geo-res': 'geo',
  'dendro-res-20': 'dendro',
  'dendro-res-30': 'dendro',
  'dendro-res-50': 'dendro',
};
/** 辞書に状態のキーが無い元素共鳴と、その理由（gcsim のソースで確認済み） */
const RESONANCE_WITHOUT_KEY: Record<string, string> = {
  electro: 'gcsim は、雷共鳴を元素粒子の生成だけで実装している（setup.go: 感電・過負荷・超電導・開花系の反応で、5 秒に 1 回、雷元素粒子 1 個を配る。状態・CT のキーは無い）。アプリの定義に時間・CT が無いので、結び付けるキーは無く、gcsim の結果の書き戻しの対象外（2026-10-09 確認）',
};
const RESONANCE_ELEMENTS = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];

const effectsById = new Map<string, MasterEffectKeyRow>();
const targetsById = new Map<string, MasterEffectTargetRow>();
const links: MasterEffectLinkRow[] = [];
const unlinked: MasterEffectDisposition[] = [];

const referencedMasterKeys = new Set<string>();
for (const c of characters) for (const definition of [...(c.passiveEffects ?? []), ...(c.constellationEffects ?? [])]) {
  for (const keys of [definition.gcsimKeys, definition.gcsimExtraKeys, definition.gcsimCooldownKeys]) for (const key of keys ?? []) referencedMasterKeys.add(key);
}
for (const item of [...weapons, ...artifacts]) for (const definition of item.buffEffects ?? []) {
  for (const keys of [definition.gcsimKeys, definition.gcsimExtraKeys, definition.gcsimCooldownKeys]) for (const key of keys ?? []) referencedMasterKeys.add(key);
}

for (const entry of catalog.entries as any[]) {
  const isResonanceKey = entry.owner?.type === 'system' && RESONANCE_KEY_TO_ELEMENT[entry.key] !== undefined;
  if (!['talent', 'constellation', 'weapon', 'artifact'].includes(entry.category) && !isResonanceKey && !referencedMasterKeys.has(entry.key)) continue;
  const ownerType = entry.owner?.type ?? 'unknown';
  const ownerKey = entry.owner?.gcsimKey ?? '(unknown)';
  const owner = ownerType === 'character' ? characterByGcsimKey.get(ownerKey)
    : ownerType === 'weapon' ? weaponByGcsimKey.get(ownerKey)
      : ownerType === 'artifact' ? artifactByGcsimKey.get(ownerKey) : undefined;
  effectsById.set(entry.key, {
    id: entry.key,
    category: entry.category,
    kind: entry.kind,
    ownerType,
    ownerKey,
    ...(owner?.name ? { ownerName: owner.name } : {}),
    ...(entry.name ?? entry.nameEn ? { name: entry.name ?? entry.nameEn } : {}),
    ...(entry.durationFrames !== undefined ? { durationFrames: entry.durationFrames } : {}),
    ...(entry.permanent ? { permanent: true } : {}),
    ...(entry.isPattern ? { isPattern: true } : {}),
    ...(entry.observed ? { observed: true } : {}),
  });
}

function addTarget(target: MasterEffectTargetRow): void {
  targetsById.set(target.id, target);
}

function addMasterTarget(
  type: Exclude<MasterEffectTargetType, 'resonance'>,
  ownerId: string,
  ownerName: string,
  definition: any,
  prefix = type,
): void {
  const id = `${prefix}:${definition.id}`;
  addTarget({
    id, type, ownerId, ownerName,
    name: definition.name ?? definition.talentName ?? definition.id,
    ...(definition.timing ? { timing: definition.timing } : {}),
    ...(definition.gcsimTarget !== undefined ? { gcsimTarget: definition.gcsimTarget } : {}),
    ...(definition.duration !== undefined ? { duration: definition.duration } : {}),
    ...(definition.gcsimNote ? { gcsimNote: definition.gcsimNote } : {}),
  });
  const arrays: Array<[string | undefined, MasterEffectLinkRow['role']]> = [
    [definition.gcsimKeys, 'effect'],
    [definition.gcsimExtraKeys, 'extra'],
    [definition.gcsimCooldownKeys, 'cooldown'],
  ];
  for (const [keys, role] of arrays) {
    for (const key of keys ?? []) {
      links.push({ effectId: key, targetId: id, role, approval: 'generated' });
    }
  }
}

for (const c of characters) {
  for (const definition of c.passiveEffects ?? []) addMasterTarget('talent', c.id, c.name, definition);
  for (const definition of c.constellationEffects ?? []) addMasterTarget('constellation', c.id, c.name, definition);
}
for (const w of weapons) for (const definition of w.buffEffects ?? []) addMasterTarget('weapon', w.id, w.name, definition, `weapon:${w.id}`);
for (const a of artifacts) for (const definition of a.buffEffects ?? []) addMasterTarget('artifact', a.id, a.name, definition, `artifact:${a.id}`);

// Keep master references to keys omitted from the catalog in the report so they are
// visible as a broken reverse lookup instead of disappearing from the coverage.
for (const key of referencedMasterKeys) if (!effectsById.has(key)) {
  effectsById.set(key, { id: key, category: 'missing-from-catalog', kind: 'effect', ownerType: 'unknown', ownerKey: '(unknown)' });
}

for (const element of RESONANCE_ELEMENTS) addTarget({
  id: `resonance:${element}`,
  type: 'resonance',
  ownerId: element,
  ownerName: '元素共鳴',
  name: `${element}元素共鳴`,
});
for (const [key, element] of Object.entries(RESONANCE_KEY_TO_ELEMENT)) {
  if (!effectsById.has(key)) continue;
  links.push({
    effectId: key,
    targetId: `resonance:${element}`,
    role: catalog.entries.find((e: any) => e.key === key)?.kind === 'cooldown' ? 'cooldown' : 'resonance',
    approval: 'generated',
    note: key === 'anemo-res-cd' ? '風元素共鳴のCT短縮。アプリでは計算ロジックに実装済み' : undefined,
  });
}

const linkedKeyIds = new Set(links.map(link => link.effectId));
const linkedTargetIds = new Set(links.map(link => link.targetId));
const unreviewed = (side: MasterEffectDisposition['side'], id: string, reason: string, note: string) =>
  unlinked.push({ side, id, state: 'unreviewed', reason, note });

for (const target of targetsById.values()) {
  const targetLinks = links.filter(link => link.targetId === target.id);
  if (targetLinks.some(link => effectsById.get(link.effectId)?.category !== 'missing-from-catalog')) continue;
  if (targetLinks.length > 0) {
    unreviewed('target', target.id, 'key-missing-from-catalog', 'マスターが参照するgcsimキーが辞書に無い');
    continue;
  }
  if (target.type !== 'resonance' && target.gcsimTarget === false) {
    unlinked.push({ side: 'target', id: target.id, state: 'unsupported', reason: 'gcsim-target-false', note: target.gcsimNote ?? 'gcsim 対象外。理由は未記載' });
  } else if (target.type === 'resonance' && RESONANCE_WITHOUT_KEY[target.ownerId]) {
    unlinked.push({ side: 'target', id: target.id, state: 'unsupported', reason: 'resonance-has-no-key', note: RESONANCE_WITHOUT_KEY[target.ownerId] });
  } else if (target.type === 'resonance') {
    unreviewed('target', target.id, 'no-resonance-key', '現行辞書に対応キーが無い。gcsimが別経路で扱うか、対象外かを確認する');
  } else {
    unreviewed('target', target.id, 'target-has-no-key', 'gcsimTarget とキー配列の整合を確認する');
  }
}

const catalogByKey = new Map<string, any>((catalog.entries as any[]).map(e => [e.key, e]));
/** 効果のキーに対応するゲーム内の説明文（命ノ星座はその凸の説明、武器は説明、聖遺物は 4 セット効果）。分からなければ undefined */
function descriptionOf(key: string): string | undefined {
  const e = catalogByKey.get(key);
  if (!e) return undefined;
  if (e.category === 'constellation' && e.owner?.type === 'character') {
    const level = slotOfEntry(e, 'c');
    const c = characterByGcsimKey.get(e.owner.gcsimKey);
    return level !== undefined ? c?.constellations?.find((x: any) => x.level === level)?.description : undefined;
  }
  if (e.category === 'weapon' && e.owner?.type === 'weapon') return weaponByGcsimKey.get(e.owner.gcsimKey)?.description;
  if (e.category === 'artifact' && e.owner?.type === 'artifact') return artifactByGcsimKey.get(e.owner.gcsimKey)?.effect4p;
  return undefined;
}

for (const effect of effectsById.values()) {
  if (effect.category === 'missing-from-catalog') {
    unreviewed('effect', effect.id, 'key-not-in-catalog', 'マスターのキー配列が参照するgcsimキーが辞書に無い');
    continue;
  }
  if (linkedKeyIds.has(effect.id)) continue;
  if (effect.kind === 'internal') {
    unlinked.push({ side: 'effect', id: effect.id, state: 'excluded', reason: 'internal-key', note: 'gcsim辞書で内部キーに分類されている' });
    continue;
  }
  if (effect.category === 'talent' && IGNORED_KEYS[effect.id]) {
    unlinked.push({ side: 'effect', id: effect.id, state: 'excluded', reason: 'known-talent-exclusion', note: IGNORED_KEYS[effect.id] });
    continue;
  }
  if (INTERNAL_INTERVAL_KEYS[effect.id]) {
    unlinked.push({ side: 'effect', id: effect.id, state: 'excluded', reason: 'internal-interval', note: INTERNAL_INTERVAL_KEYS[effect.id] });
    continue;
  }
  // 時間の無い効果で、画面に出す価値が低いもの（エネルギー回復・追加攻撃・HP 回復など）は、定義にしないで対象外（6-A2。D91）
  if (['constellation', 'weapon', 'artifact'].includes(effect.category)) {
    const text = descriptionOf(effect.id);
    if (text !== undefined && !NATURE_EXCEPTIONS[effect.id]) {
      const nature = natureOfText(text);
      if (!isDisplayWorthyNature(nature)) {
        unlinked.push({ side: 'effect', id: effect.id, state: 'excluded', reason: 'low-value-nature', note: `効果の性質が「${NATURE_LABEL[nature]}」で、画面に出す価値が低い（D91）` });
        continue;
      }
    }
  }
  if (effect.category === 'artifact' && /(?:^|-)2pc(?:-|$)/.test(effect.id)) {
    unlinked.push({ side: 'effect', id: effect.id, state: 'excluded', reason: 'two-piece-effect', note: 'D5: 2セット効果は発動バフのバーにしない' });
    continue;
  }
  if (effect.permanent && ['weapon', 'artifact', 'constellation'].includes(effect.category)) {
    unlinked.push({ side: 'effect', id: effect.id, state: 'pending', reason: 'permanent-effect-display', note: '6-A2: 定義を持たない常時効果の扱い・表示が未実装' });
    continue;
  }
  if (effect.category === 'constellation' && effect.id === 'iansan-c6') {
    unlinked.push({ side: 'effect', id: effect.id, state: 'excluded', reason: 'excluded-constellation', note: IGNORED_KEYS[effect.id] ?? '継続時間延長で、独立した効果定義にしない' });
    continue;
  }
  unreviewed('effect', effect.id, 'key-has-no-master-link', effect.name ?? '辞書キーに対応するマスター効果定義または対象外理由が無い');
}

const errors: string[] = [];
const uniqueLinks = new Set<string>();
for (const link of links) {
  if (!effectsById.has(link.effectId)) errors.push(`存在しないキーを参照: ${link.effectId}`);
  if (!targetsById.has(link.targetId)) errors.push(`存在しない対象を参照: ${link.targetId}`);
  const token = `${link.effectId}\0${link.targetId}\0${link.role}`;
  if (uniqueLinks.has(token)) errors.push(`重複リンク: ${link.effectId} -> ${link.targetId} (${link.role})`);
  uniqueLinks.add(token);
}
for (const row of unlinked) {
  const brokenReference = row.reason === 'key-not-in-catalog' || row.reason === 'key-missing-from-catalog';
  if (!brokenReference && ((row.side === 'effect' && linkedKeyIds.has(row.id)) || (row.side === 'target' && linkedTargetIds.has(row.id)))) {
    errors.push(`紐付け済みなのに disposition が残っている: ${row.side}:${row.id}`);
  }
}

const coverage: MasterEffectCoverage = {
  schemaVersion: 1,
  gcsimCommit: catalog.gcsimCommit,
  generatedAt: catalog.generatedAt,
  effects: [...effectsById.values()].sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id)),
  targets: [...targetsById.values()].sort((a, b) => a.type.localeCompare(b.type) || a.ownerName.localeCompare(b.ownerName) || a.name.localeCompare(b.name)),
  links: links.sort((a, b) => a.effectId.localeCompare(b.effectId) || a.targetId.localeCompare(b.targetId) || a.role.localeCompare(b.role)),
  unlinked: unlinked.sort((a, b) => a.side.localeCompare(b.side) || a.state.localeCompare(b.state) || a.id.localeCompare(b.id)),
};

const jsonPath = 'src/data/master_effect_coverage.json';
const mdPath = 'docs/gcsim-integration/phase-6-run-and-apply/master-effect-coverage.md';
const generatedJson = JSON.stringify(coverage, null, 2) + '\n';
const counts = <T>(items: T[], keyOf: (item: T) => string) => items.reduce<Record<string, number>>((acc, item) => {
  const key = keyOf(item); acc[key] = (acc[key] ?? 0) + 1; return acc;
}, {});
const dispositionFor = (side: 'effect' | 'target') => new Map(unlinked.filter(row => row.side === side).map(row => [row.id, row]));
const effectDisposition = dispositionFor('effect');
const targetDisposition = dispositionFor('target');
const effectState = (row: MasterEffectKeyRow) => effectDisposition.get(row.id)?.state ?? 'linked';
const targetState = (row: MasterEffectTargetRow) => targetDisposition.get(row.id)?.state ?? 'linked';
const effectCounts = counts(coverage.effects, effectState);
const targetCounts = counts(coverage.targets, targetState);
const groupCounts = (items: any[], group: (item: any) => string, state: (item: any) => string) =>
  Object.entries(counts(items, item => `${group(item)} / ${state(item)}`)).sort(([a], [b]) => a.localeCompare(b));
const unreviewedRows = coverage.unlinked.filter(row => row.state === 'unreviewed');
const pendingRows = coverage.unlinked.filter(row => row.state === 'pending');
const md = [
  '# マスター効果とgcsimキーの対応表（カバレッジ）', '',
  `作成: ${String(catalog.generatedAt).slice(0, 10)} / gcsim辞書コミット ${String(catalog.gcsimCommit).slice(0, 8)} / 生成: \`npm run coverage:master-effects\``, '',
  '対象は固有天賦・命ノ星座・武器・聖遺物・元素共鳴。アクション効果用の `effect_key_coverage.json` とは別ファイルで管理し、将来統合できる `effects` / `targets` / `links` / `unlinked` 形式を使う。',
  '「未確認」はマスター側の対象またはgcsimキー側の効果について、対応付け・理由付き対象外・保留のいずれも無い状態。', '',
  `## gcsimキー（${coverage.effects.length}件）`, '', '| 分類 / 状態 | 件数 |', '|---|---:|', ...groupCounts(coverage.effects, e => e.category, effectState).map(([label, count]) => `| ${label} | ${count} |`), '',
  `## マスター対象（${coverage.targets.length}件）`, '', '| 種別 / 状態 | 件数 |', '|---|---:|', ...groupCounts(coverage.targets, t => t.type, targetState).map(([label, count]) => `| ${label} | ${count} |`), '',
  `## links（${coverage.links.length}件）`, '', '| 関係 | 件数 |', '|---|---:|', ...Object.entries(counts(coverage.links, row => row.role)).sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => `| ${label} | ${count} |`), '',
  `## 保留（${pendingRows.length}件）`, '', ...(pendingRows.length ? pendingRows.map(row => `- ${row.side} ${row.id}: ${row.note}`) : ['なし']), '',
  `## 未確認（${unreviewedRows.length}件）`, '', ...(unreviewedRows.length ? unreviewedRows.map(row => `- ${row.side} ${row.id}: ${row.note}`) : ['なし']), '',
  `整合性: 孤立リンク ${errors.length}件${errors.length ? `（${errors.join(' / ')}）` : ''}`, '',
];

if (!CHECK_ONLY) {
  fs.writeFileSync(jsonPath, generatedJson);
  fs.writeFileSync(mdPath, md.join('\n'));
} else {
  for (const [path, expected] of [[jsonPath, generatedJson], [mdPath, md.join('\n')]] as const) {
    if (!fs.existsSync(path) || fs.readFileSync(path, 'utf8') !== expected) errors.push(`${path} が生成結果と異なる`);
  }
}

console.log(`effects ${coverage.effects.length}件:`, JSON.stringify(effectCounts));
console.log(`targets ${coverage.targets.length}件:`, JSON.stringify(targetCounts));
console.log(`links ${coverage.links.length}件 / 保留 ${pendingRows.length}件 / 未確認 ${unreviewedRows.length}件 / 整合性エラー ${errors.length}件`);
for (const error of errors) console.error(`エラー: ${error}`);
if (errors.length) process.exitCode = 1;
