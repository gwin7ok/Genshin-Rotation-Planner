/**
 * スキル・爆発の効果継続時間の、gcsim による補完の一覧（フェーズ5 / 5-3、D33）
 *
 * genshin-db のラベルに効果の時間が無い（または読み取れない）スキル・爆発の効果時間を、gcsim のソースで確認した値で補う。
 *   - genshin-db に値があるアクションには使わない（genshin-db を優先。食い違いはマスター生成のレポートに出る）
 *   - キー: アクション定義 ID（`<キャラID>_e` / `_q` など。D13）
 *   - frames: gcsim の継続時間（60fps のフレーム。アクションの開始からの時間で、gcsim のソースと照合しやすいようフレームで書く）
 *   - source: 根拠（gcsim のキーとファイル）
 *
 * 新しいキャラが実装されたときの手順は docs/新キャラ実装時の作業.md を参照。
 */
export interface EffectDurationOverride {
  frames: number;
  /** 効果バーの名前（日本語。ゲーム内の効果の名前）。出典（source）とは分けて持つ（2026-10-08。出典の文字列がバーの名前に出ていた） */
  label: string;
  source: string;
}

export const EFFECT_DURATION_OVERRIDES: Record<string, EffectDurationOverride> = {
  // フィッシュル: オズ 10 秒（skill.go の `oz-active`。爆発のオズも同じ長さ）
  '10000031-electro_e': { frames: 600, label: 'オズ', source: 'fischl/skill.go: oz-active' },
  '10000031-electro_q': { frames: 600, label: 'オズ', source: 'fischl/burst.go: オズ（skill.go の oz-active と同じ）' },
  // フレミネ: 加圧 10 秒
  '10000085-cryo_e': { frames: 600, label: '加圧', source: 'freminet/skill.go: freminet-pers-time' },
  // ムアラニ: 標的の印 10 秒
  '10000102-hydro_e': { frames: 600, label: '標的の印', source: 'mualani/skill.go: marked-as-prey' },
  // 煙緋: 丹火の印 10 秒（付与は元素スキル。キーは burst.go で登録）
  '10000048-pyro_e': { frames: 600, label: '丹火の印', source: 'yanfei/burst.go: yanfei-seal（印は元素スキルで付与）' },
  // 放浪者: 風の加護 20 秒
  '10000075-anemo_e': { frames: 1200, label: '風の加護', source: 'wanderer/skill.go: windfavored-state' },
  // 刻晴: 雷楔 5 秒 + 20 フレーム
  '10000042-electro_e': { frames: 320, label: '雷楔', source: 'keqing/skill.go: keqingstiletto' },
  // イアンサ: 速攻状態 5 秒
  '10000110-electro_e': { frames: 300, label: '速攻状態', source: 'iansan/skill.go: fast-skill' },
  // アルレッキーノ: 血の契約 30 秒
  '10000096-pyro_e': { frames: 1800, label: '血の契約', source: 'arlecchino/skill.go: directive' },
  // ジン: 蒲公英の風 10 秒 + 40 フレーム（発動の遅れを含む）
  '10000003-anemo_q': { frames: 640, label: '蒲公英の風', source: 'jean/burst.go: jean-q' },
};

/**
 * 効果継続時間を「無し」にするアクション（ユーザー決定 2026-09-30。バーに出さない）
 *
 * genshin-db のラベルに時間があっても、次のどちらかで、効果のバーにしないものを 0 にする。
 *   - 効果ではなくアクション自身の動作の長さ（溜め・長押しの最大時間）
 *   - 効果は正しいが、ローテーション全体を覆うほど長く、バーにしても判断に使えない
 * 対応表の「紐づけない」台帳（effectKeyDecisions.ts の DEF_DECISIONS）にも同じ理由で登録してある。
 * キー: アクション定義 ID、値: 理由。
 */
export const EFFECT_DURATION_SUPPRESSED: Record<string, string> = {
  '10000003-anemo_e': 'ジン: 5 秒は溜めの最大時間（動作の長さ）で、効果ではない',
  '10000053-anemo_e_hold': '早柚: 10 秒は長押しの最大時間（動作の長さ）で、効果ではない',
  '10000020-electro_e_hold': 'レザー: 18 秒（雷の印）は短押しの効果。長押しは印を作らず消費する動作',
  '10000091-geo_e': 'ナヴィア: 裂晶の欠片 300 秒はローテーション全体を覆う長さでバーにしない',
  '10000059-anemo_e': '鹿野院平蔵: 変格 60 秒はローテーション全体を覆う長さでバーにしない',
};
