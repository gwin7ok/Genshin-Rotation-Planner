/**
 * gcsim の効果キーの紐付けに関する「決定」の一覧と、その置き場の案内（D95。2026-10-09）。
 *
 * 紐付けは、A（スキル・爆発。アクション定義の gcsimEffect など）と B（固有天賦・命ノ星座・武器・聖遺物。定義の gcsimKeys など）で、
 * 保存先はマスターの定義に一本化したが、生成の入力（手で補う一覧・決定）は、生成する処理の近くにある。
 * 新キャラ・gcsim の更新のとき、決定を書く場所を探さなくて済むよう、ここに全部を再エクスポートして、場所を案内する。
 * （決めた後の確認は `npm run coverage:links` の 1 本）
 *
 * ┌ A: スキル・爆発 ───────────────────────────────────────────────────────────────┐
 *   ACTION_EFFECT_KEY_OVERRIDES … 本体の効果のキーを手で指定（actionEffectKeyOverrides.ts）。'' = 書き戻さない
 *   ACTION_EFFECT_EXTRAS        … 副次効果（別のバーにする継続効果）（actionEffectExtras.ts）
 *   ACTION_EFFECT_INCLUDED      … 含まれる効果（別のバーにしない）（actionEffectIncluded.ts）
 *   CHARACTER_LINKED_EFFECTS    … キャラクターに紐づく効果（命中・反応由来）（characterLinkedEffects.ts）
 *   KEY_DECISIONS / DEF_DECISIONS … 「紐づけない」と決めた効果のキー / アクション定義と理由（effectKeyDecisions.ts）
 * ├ B: 固有天賦・命ノ星座・武器・聖遺物 ─────────────────────────────────────────────┤
 *   INTERNAL_INTERVAL_KEYS      … 内部の重複防止の間隔のキー（対象外）（buffGcsimLink.ts）
 *   IGNORED_KEYS                … 定義にしないと確認したキー（buffGcsimLink.ts）
 *   EXCLUDED_CONSTELLATIONS     … 定義にしない命ノ星座（延長など）（buffGcsimLink.ts）
 *   NO_DURATION_TALENTS / NO_DURATION_CONSTELLATIONS … 継続時間を持たない定義（buffGcsimLink.ts）
 *   CONSTELLATION_KEYS_IN_ACTION_FILES … skill.go・burst.go で登録された命ノ星座の効果のキー（buffGcsimLink.ts）
 *   NATURE_EXCEPTIONS           … 効果の性質（画面に出す価値）の個別の例外（effectNature.ts）
 * └──────────────────────────────────────────────────────────────────────────────┘
 */
export { ACTION_EFFECT_KEY_OVERRIDES } from './actionEffectKeyOverrides.ts';
export { ACTION_EFFECT_EXTRAS } from './actionEffectExtras.ts';
export { ACTION_EFFECT_INCLUDED } from './actionEffectIncluded.ts';
export { CHARACTER_LINKED_EFFECTS } from './characterLinkedEffects.ts';
export { KEY_DECISIONS, DEF_DECISIONS } from './effectKeyDecisions.ts';
export {
  INTERNAL_INTERVAL_KEYS, IGNORED_KEYS, EXCLUDED_CONSTELLATIONS, NO_DURATION_TALENTS, NO_DURATION_CONSTELLATIONS, CONSTELLATION_KEYS_IN_ACTION_FILES,
} from './buffGcsimLink.ts';
export { NATURE_EXCEPTIONS } from './effectNature.ts';
