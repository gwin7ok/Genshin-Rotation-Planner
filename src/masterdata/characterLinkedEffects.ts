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

/**
 * 星拡散反応の状態（光輝）。gcsim は「星」の反応（星電導・星拡散）を、固有天賦の「星の光輝」を持つキャラが有効にする（`stellar.go`）。
 *   - 星拡散 = 氷元素への拡散（氷拡散）が、星拡散に置き換わる。有効にするのはオデット・旅人(氷)（`StellarSwirlEnableKey`）。月兆（月反応）とは別の仕組み
 *   - 星拡散が起きると、オデット・七七・旅人(氷)は、8 秒の状態（同じキー `radiance-stellar-swirl`）を、自分自身に付ける（`OnStellarSwirl`）
 * 月兆（月感電・月開花・月結晶。コロンビーナ・ラウマなどのナド・クライのキャラ）の反応は、別のキー・別の仕組み。
 */
const STELLAR_SWIRL: CharacterLinkedEffectDef = { key: 'radiance-stellar-swirl', label: '星拡散反応の状態（光輝）', mode: 'chain' };

export const CHARACTER_LINKED_EFFECTS: Record<string, CharacterLinkedEffectDef[]> = {
  odette: [STELLAR_SWIRL],
  qiqi: [STELLAR_SWIRL],
  aethercryo: [STELLAR_SWIRL],
  luminecryo: [STELLAR_SWIRL],
  yaemiko: [
    { key: 'yae-revelation', label: '超電導・星電導反応の状態（天啓）', mode: 'chain' },
  ],
};
