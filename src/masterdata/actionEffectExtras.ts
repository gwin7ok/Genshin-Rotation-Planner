/**
 * スキル・爆発に付随する副次効果の対応表（アクション定義 ID → gcsim のキーと表示名）
 *
 * アクション本体の効果時間（actionEffectKeyOverrides.ts / action_effect_keys.json）とは別に、同じアクションから繰り返し発生する
 * 継続効果を、それぞれ別のバーとして出す。gcsim の結果を書き戻すとき、アクションの開始〜同じキャラの次の同じ種類のアクションの開始までの
 * 間に起きたイベント（added / refreshed）ごとに、1本のバー（開始 = 発生、継続時間 = 終了予定 − 発生）にする。
 * キーは、ユーザーがゲーム内の説明（wiki）と照合して承認したものだけを載せる（命中のたびに更新される内部のキーを誤って拾わないため）。
 */
import type { ActionGcsimExtra } from '../types/genshin.ts';

export type ActionEffectExtra = ActionGcsimExtra;

export const ACTION_EFFECT_EXTRAS: Record<string, ActionEffectExtra[]> = {
  // ---- 命中・反応由来の効果（2026-09-30 ユーザー決定: gcsim が返したときにバーで表示できる形で登録）----
  // ディシアのスキル: ダメージを受けたときに付く 10 秒の自己ダメージ状態
  '10000079-pyro_e': [
    { key: 'dehya-redmanes-blood', label: '紅鬃の血（自己ダメージ）' },
  ],
  // ムアラニのスキル: サーフィン中の命中で敵に付く印（10 秒）
  '10000102-hydro_e': [
    { key: 'marked-as-prey', label: '獲物の印（敵）' },
  ],
  // 申鶴の爆発: 命中で敵に付く氷・物理の耐性ダウン（更新され続ける）
  '10000063-cryo_q': [
    { key: 'shenhe-burst-shred-cryo', label: '氷元素耐性ダウン（敵）', mode: 'chain' },
    { key: 'shenhe-burst-shred-phys', label: '物理耐性ダウン（敵）', mode: 'chain' },
  ],
  // エウルアの長押し: 氷潮の渦の命中で敵に付く氷・物理の耐性ダウン（グリムハートのスタックがあるときだけ。gcsim の eula/skill.go では長押しのみ。短押しには付かない）
  '10000051-cryo_e_hold': [
    { key: 'eula-icewhirl-shred-cryo', label: '氷元素耐性ダウン（敵）', mode: 'chain' },
    { key: 'eula-icewhirl-shred-phys', label: '物理耐性ダウン（敵）', mode: 'chain' },
  ],
  // シロネンのスキル: 命中で敵に付く元素別の耐性ダウン（パターンのキー）
  '10000103-geo_e': [
    { key: 'xilonen-e-shred-*', label: '耐性ダウン（敵）', mode: 'chain' },
  ],
  // コロンビーナのスキル: 月の反応が起きるたびに更新される重力の蓄積
  '10000125-hydro_e': [
    { key: 'columbina-gravity', label: '重力（月の反応）', mode: 'chain' },
  ],
  // コロンビーナの爆発: 爆発中の反応ボーナス（更新され続ける）
  '10000125-hydro_q': [
    { key: 'columbina-q-buff', label: '反応ボーナス（爆発中）', mode: 'chain' },
  ],
  // ナヒーダの爆発: 領域内の状態（更新され続ける）
  '10000073-dendro_q': [
    { key: 'nahida-q-within', label: '領域内（心景幻成）', mode: 'chain' },
  ],
  // 爆発のフィールドの命中のたびに付け直される印
  '10000121-hydro_q': [
    { key: 'aino-burst-mark', label: '印（お水ひえひえ装置）', mode: 'chain' },
  ],
  '10000037-cryo_q': [
    { key: 'ganyu-burst-mark', label: '印（降衆天華）', mode: 'chain' },
  ],
  '10000099-dendro_q': [
    { key: 'emilie-burst-mark', label: '印（アロマティック・アナライズ）', mode: 'chain' },
  ],
  // ニィロウ（ユーザー決定 2026-09-30）: スキルを4回続けると、4回目の +0.7 秒に静謐の光環（12 秒。凸1で +6 秒）。スキルの後に通常攻撃を3回続けると、3回目の +0.5 秒に月の祈り（8 秒）
  '10000070-hydro_e': [
    { key: 'tranquilityaura', label: '静謐の光環' },
  ],
  '10000070-hydro_n': [
    { key: 'lunarprayer', label: '月の祈り' },
  ],
  // リネの爆発: 変身（3 秒。本体の lyney-q）が終わった +4.7 秒に、帽子の召喚物（約 4.1 秒）
  '10000084-pyro_q': [
    { key: 'lyney-grinmalkinhat', label: 'ファニーハット（帽子の召喚物）' },
  ],
  // ヤフォダのスキル: フラスコのゲージが満ちて（命中で溜まる）排出されたときに出る猫玉（約 19.6 秒）。gcsim が返したときだけ表示（命中由来）
  '10000124-anemo_e': [
    { key: 'jahoda-meowball', label: '猫玉（フラスコ排出）' },
  ],
  // ラウマの爆発: 爆発中に月の反応が起きたときの「月の歌」（15 秒）。gcsim が返したときだけ表示（反応由来）
  '10000119-dendro_q': [
    { key: 'lauma-pale-hymn-moonsong', label: '蒼白の賛歌・月の歌' },
  ],
  // デュリンのスキル: 1回目で 6 秒の窓が開き、窓の中の 2回目のスキルで白の姿（30 秒）。窓の中の通常攻撃で黒の姿（30 秒。下の通常攻撃に登録）。ユーザー決定（2026-09-30）
  '10000123-pyro_e': [
    { key: 'confirmation-of-purity', label: '白の姿（純粋の確認）' },
  ],
  '10000123-pyro_n': [
    { key: 'denial-of-darkness', label: '黒の姿（暗黒の否認）' },
  ],
  // （オデットの独舞者の強化 `odette-dance-double-upgrade` は、特殊スキル `10000150-cryo_e_recast` の本体の効果にした。2026-10-01）
  // フリンズのスキル: 2回目のスキルで、雷鳴の交響（6 秒）
  '10000120-electro_e': [
    { key: 'thunderous-symphony', label: '雷鳴の交響' },
  ],
  // ラウマのスキル（月霜の聖域）: スキルの命中と聖域の tick ごとに敵へ付く耐性ダウン（各10秒。約0.3〜24.7秒の一続き）。gcsim は草・水を別のキーで出すので、2本に分けて登録（ユーザー決定 2026-09-30）
  '10000119-dendro_e': [
    { key: 'lauma-skill-shred-dendro', label: '草元素耐性ダウン（敵）', mode: 'chain' },
    { key: 'lauma-skill-shred-hydro', label: '水元素耐性ダウン（敵）', mode: 'chain' },
  ],
  // 胡桃のスキル（蝶導来世）: 紫煙状態中の重撃の命中で敵に付く血梅香（継続ダメージ。9.5 秒。命中のたびに延長）。ユーザー決定（2026-09-30）
  '10000046-pyro_e': [
    { key: 'blood-blossom', label: '血梅香（敵に付く継続ダメージ）', mode: 'chain' },
  ],
  // ファルザンの爆発（搏風秘道）: 烈風波を放つたびに（約4秒おき）付与される2つの効果
  '10000076-anemo_q': [
    { key: 'faruzan-q-dmg-bonus', label: '祈風の恵み（風元素ダメージアップ）' },
    { key: 'faruzan-q-shred', label: '詭風の禍つ（風元素耐性ダウン）' },
  ],
  // 閑雲の爆発: 爆発の継続中（16秒）、補助仙力があるとき出場キャラに付与される滞空の強化（ジャンプ力アップ）
  '10000093-anemo_q': [
    { key: 'xianyun-airborne-buff', label: '滞空の強化（ジャンプ力アップ）' },
  ],
  // カーヴェの爆発: 本体の持続効果（`kaveh-q`）とは別に、ダメージアップ（12秒。カーヴェの退場で終了）を別名のバーで出す
  '10000081-dendro_q': [
    { key: 'kaveh-q-dmg-bonus', label: 'ダメージアップ（退場で終了）' },
  ],
};
