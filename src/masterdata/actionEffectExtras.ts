/**
 * スキル・爆発に付随する副次効果の対応表（アクション定義 ID → gcsim のキーと表示名）
 *
 * アクション本体の効果時間（actionEffectKeyOverrides.ts / action_effect_keys.json）とは別に、同じアクションから繰り返し発生する
 * 継続効果を、それぞれ別のバーとして出す。gcsim の結果を書き戻すとき、アクションの開始〜同じキャラの次の同じ種類のアクションの開始までの
 * 間に起きたイベント（added / refreshed）ごとに、1本のバー（開始 = 発生、継続時間 = 終了予定 − 発生）にする。
 * キーは、ユーザーがゲーム内の説明（wiki）と照合して承認したものだけを載せる（命中のたびに更新される内部のキーを誤って拾わないため）。
 */
export interface ActionEffectExtra {
  /** gcsim のキー（状態のキー / `construct:<名前>` / `shield:<名前>` など） */
  key: string;
  /** ガントチャートに出す名前 */
  label: string;
  /** 実行したキャラ自身のイベントだけ使う */
  self?: boolean;
  /** each = added / refreshed のイベントごとに1本（既定）/ chain = 更新・延長が続く間（前のイベントの終了予定より前に次のイベントが起きる間）を1本 */
  mode?: 'each' | 'chain';
}

export const ACTION_EFFECT_EXTRAS: Record<string, ActionEffectExtra[]> = {
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
