/**
 * スキル・爆発に「含まれる」効果（アクション定義 ID → gcsim のキー）
 *
 * gcsim が、そのスキル・爆発の効果として登録しているが、別のバーにはしないもの。対応表（effect_key_coverage.json）では、
 * 紐づけ（role = included）として持つ。ガントチャートには出さず、書き戻しにも使わない。理由:
 *   - 「常時」で登録されている（シミュレーションの開始時に一度だけ登録され、終了しない）ため、時刻の情報が無い
 *   - 効果の内容が、そのスキル・爆発の持続バー（本体・副次効果）と同じ期間の内部の加算で、別のバーにすると二重の表示になる
 * ユーザーが、ゲーム内の説明と照合して決定（2026-09-30）。
 */
import type { ActionGcsimIncluded } from '../types/genshin.ts';

export type IncludedEffect = ActionGcsimIncluded;

export const ACTION_EFFECT_INCLUDED: Record<string, IncludedEffect[]> = {
  // キャンディスの爆発: 爆発中の通常攻撃ダメージ加算
  '10000072-hydro_q': [{ key: 'candace-q-dmg', note: '爆発中の通常攻撃ダメージ加算' }],
  // フリーナの爆発: 熱狂による与ダメージ増・回復量増
  '10000089-hydro_q': [
    { key: 'furina-burst-damage-buff', note: '熱狂による与ダメージ増' },
    { key: 'furina-burst-heal-buff', note: '熱狂による回復量増' },
  ],
  // イアンサの爆発: 爆発中の攻撃力増
  '10000110-electro_q': [{ key: 'iansan-burst-buff', note: '爆発中の攻撃力増' }],
  // 夢見月瑞希のスキル: スキル中の拡散反応ダメージ増
  '10000109-anemo_e': [{ key: 'mizuki-swirl-buff', note: 'スキル中の拡散反応ダメージ増' }],
  // モナの爆発: 星命定軌（本体の持続は mona-bubble）
  '10000041-hydro_q': [{ key: 'mona-omen', note: '星命定軌（敵の被ダメージ増）。本体の持続は mona-bubble' }],
  // スカークの爆発: 爆発中のダメージ加算
  '10000114-cryo_q': [{ key: 'skirk-burst-extinction-dmg', note: '爆発中のダメージ加算' }],
  // 甘雨の爆発: 命ノ星座4「西狩」（領域内の敵への氷ダメージ増）。実行では 5 秒の状態が 0.3 秒ごとに更新され続ける（バーにする場合は、更新が続く間 = span）
  '10000037-cryo_q': [{ key: 'ganyu-c4', note: '命ノ星座4「西狩」。領域内の敵への氷ダメージ増' }],
  // アルレッキーノのスキル: 通常攻撃の強化（この実行では、スキルだけではイベントが出なかった）
  '10000096-pyro_e': [{ key: 'masque-of-the-red-death', note: '通常攻撃の強化（血の債務の状態に依存）' }],
};
