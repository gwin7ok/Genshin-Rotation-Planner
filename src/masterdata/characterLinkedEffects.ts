/**
 * 「キャラクターに紐づく効果」の対応表（フェーズ6 / 6-3c、D57）
 *
 * スキル・爆発・攻撃の発動に連動しない、命中・反応由来の効果を、アクションではなくキャラクターに紐づける。
 * gcsim の結果の書き戻しでは、そのキャラの出場ブロックの `Stint.extraEffects` に書く
 * （効果が起きた時刻より前で一番近い出場ブロック。無ければ将来方向で一番近い出場ブロック）。
 * 反応のたびに更新される状態は mode: 'chain'（更新が続く間を1本のバーにする）。
 * キー = gcsim のキャラのキー（`gcsim_key_map.json` の gcsimKey）。1つの効果のキーは、アクションかキャラクターのどちらか一方にだけ紐づける。
 * 対応表（effect_key_coverage.json）では、紐づけ先は `character:<キャラ ID>`（scripts/build-effect-coverage.ts が生成）。
 */
import type { CharacterLinkedEffectDef } from '../utils/gcsim/applyBuffEffects.ts';

export const CHARACTER_LINKED_EFFECTS: Record<string, CharacterLinkedEffectDef[]> = {
  odette: [
    { key: 'radiance-stellar-swirl', label: '星拡散反応の状態（光輝）', mode: 'chain' },
  ],
  yaemiko: [
    { key: 'yae-revelation', label: '超電導・星電導反応の状態（天啓）', mode: 'chain' },
  ],
};
