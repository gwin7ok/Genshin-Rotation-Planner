/**
 * gcsim が返す効果のうち、紐づけも「紐づけない」決定も無いものを、自動で副次効果（別のバー）にする（D213 案 1。2026-10-15）
 *
 * 方針: gcsim が返す効果は、基本的に実行前から表示する。除外は、理由つきの一覧（effectKeyDecisions.ts の KEY_DECISIONS・常時・
 * 持ち主のキャラがアプリに無い）だけ。それ以外のキーは、gcsim のキー・持ち主・分類から、持ち主キャラのアクション定義の副次効果にする。
 *   - 辞書（gcsim_key_catalog.json）の効果で、分類が skill → 持ち主のスキル（skill・skill_hold）、burst → 爆発
 *   - 実行時に見つかった設置物・シールド（construct: / shield:）→ 見つかったアクション定義
 * 手で補う一覧（ACTION_EFFECT_EXTRAS）が先。同じキーが既に紐づいていれば作らない。
 * 入力だけで決まる（ネットワーク・実行結果を使わない）ので、取り込み（link:actions）・検査（check:action-links）・対応表で同じ結果になる。
 */
import type { ActionGcsimExtra } from '../types/genshin.ts';
import { KEY_DECISIONS } from './effectKeyDecisions.ts';

export interface AutoExtraInput {
  catalogEntries: any[];
  characters: { source?: { gcsimKey?: string }; availableActions?: { id: string; type: string }[] }[];
  /** probe の表（アクション定義 ID → { primary, status, ... }）*/
  table: Record<string, any>;
  overrides: Record<string, any>;
  extras: Record<string, ActionGcsimExtra[]>;
  included: Record<string, { key: string }[]>;
  characterLinked: Record<string, { key: string }[]>;
  /** 実行時に見つかった効果（action_effect_links_by_duration.json の entries） */
  runtimeLinks: Record<string, any>;
}

/** 手で決めた・表から決まった紐づけで、すでに使われているキー（build-effect-coverage.ts の links と同じ規則） */
export function manuallyLinkedKeys(input: AutoExtraInput): Set<string> {
  const keys = new Set<string>();
  for (const [defId, e] of Object.entries(input.table)) {
    const ov = input.overrides[defId];
    if (ov === '') continue;
    if (ov !== undefined) continue;
    if (e.status === 'ok' && e.primary) keys.add(e.primary);
  }
  for (const ov of Object.values(input.overrides)) {
    if (ov === '' || ov === undefined) continue;
    const o = typeof ov === 'string' ? { key: ov } : ov;
    keys.add(o.key);
    for (const a of o.alt ?? []) keys.add(a);
  }
  for (const list of Object.values(input.extras)) for (const x of list) keys.add(x.key);
  for (const list of Object.values(input.included)) for (const x of list) keys.add(x.key);
  for (const list of Object.values(input.characterLinked)) for (const x of list) keys.add(x.key);
  return keys;
}

/** 自動の副次効果（アクション定義 ID → 副次効果）。手で補う一覧とは別に返す */
export function deriveAutoExtras(input: AutoExtraInput): Record<string, ActionGcsimExtra[]> {
  const linked = manuallyLinkedKeys(input);
  const byOwner = new Map<string, { id: string; type: string }[]>();
  for (const c of input.characters) {
    const k = c.source?.gcsimKey;
    if (k) byOwner.set(k, [...(byOwner.get(k) ?? []), ...(c.availableActions ?? [])]);
  }
  const out: Record<string, ActionGcsimExtra[]> = {};
  const add = (defId: string, key: string, label: string) => {
    linked.add(key);
    (out[defId] ??= []).push({ key, label });
  };
  const eligible = (key: string) => !linked.has(key) && !KEY_DECISIONS[key];

  // 辞書の効果（状態）: 持ち主のスキル・爆発へ
  for (const e of input.catalogEntries) {
    if (e.kind !== 'effect' || (e.category !== 'skill' && e.category !== 'burst') || e.permanent) continue;
    if (!eligible(e.key)) continue;
    const defs = byOwner.get(e.owner?.gcsimKey);
    if (!defs) continue;
    const want = e.category === 'burst' ? ['burst'] : ['skill', 'skill_hold'];
    const targets = defs.filter(d => want.includes(d.type));
    if (targets.length === 0) continue;
    const label = e.name ?? e.nameEn ?? e.key;
    linked.add(e.key);
    for (const d of targets) (out[d.id] ??= []).push({ key: e.key, label });
  }
  // 実行時に見つかった設置物・シールド: 見つかったアクション定義へ（ダメージは継続時間を持たないので対象外）
  for (const [defId, v] of Object.entries(input.runtimeLinks)) {
    for (const c of v.candidates ?? []) {
      if (!/^(construct|shield):/.test(c.key) || !eligible(c.key)) continue;
      add(defId, c.key, c.key.replace(/^(construct|shield):/, ''));
    }
  }
  return out;
}

/** 手で補う一覧に、自動の副次効果を足した一覧（手で補う一覧が先） */
export function mergeExtras(
  manual: Record<string, ActionGcsimExtra[]>,
  auto: Record<string, ActionGcsimExtra[]>,
): Record<string, ActionGcsimExtra[]> {
  const out: Record<string, ActionGcsimExtra[]> = {};
  for (const [id, list] of Object.entries(manual)) out[id] = list.map(x => ({ ...x }));
  for (const [id, list] of Object.entries(auto)) out[id] = [...(out[id] ?? []), ...list.map(x => ({ ...x }))];
  return out;
}

/**
 * 実行前に出すバーの継続時間を、辞書の durationFrames から副次効果に付ける（D213 案 2。extras を書き換える）。
 * `preRun: true` の副次効果だけ（独自計算を廃止して置き換えたもの）。`*` を含むキー・常時の効果・辞書に時間が無いものには付けない。取り込み（link:actions）と検査（check:action-links）で同じ規則を使う
 */
export function attachDurations(extras: Record<string, ActionGcsimExtra[]>, catalogEntries: any[]): void {
  const frameByKey = new Map<string, number>();
  for (const e of catalogEntries) {
    if (e.kind === 'effect' && !e.permanent && typeof e.durationFrames === 'number' && e.durationFrames > 0) frameByKey.set(e.key, e.durationFrames);
  }
  for (const list of Object.values(extras)) {
    for (const x of list) {
      const f = !x.preRun || x.key.includes('*') ? undefined : frameByKey.get(x.key);
      if (f !== undefined) x.durationFrames = f;
    }
  }
}
