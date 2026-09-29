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
  source: string;
}

export const EFFECT_DURATION_OVERRIDES: Record<string, EffectDurationOverride> = {
  // フィッシュル: オズ 10 秒（skill.go の `oz-active`。爆発のオズも同じ長さ）
  '10000031-electro_e': { frames: 600, source: 'fischl/skill.go: oz-active' },
  '10000031-electro_q': { frames: 600, source: 'fischl/burst.go: オズ（skill.go の oz-active と同じ）' },
  // フレミネ: 加圧 10 秒
  '10000085-cryo_e': { frames: 600, source: 'freminet/skill.go: freminet-pers-time' },
  // ムアラニ: 標的の印 10 秒
  '10000102-hydro_e': { frames: 600, source: 'mualani/skill.go: marked-as-prey' },
  // 煙緋: 丹火の印 10 秒（付与は元素スキル。キーは burst.go で登録）
  '10000048-pyro_e': { frames: 600, source: 'yanfei/burst.go: yanfei-seal（印は元素スキルで付与）' },
  // 放浪者: 風の加護 20 秒
  '10000075-anemo_e': { frames: 1200, source: 'wanderer/skill.go: windfavored-state' },
  // 刻晴: 雷楔 5 秒 + 20 フレーム
  '10000042-electro_e': { frames: 320, source: 'keqing/skill.go: keqingstiletto' },
  // イアンサ: 速攻状態 5 秒
  '10000110-electro_e': { frames: 300, source: 'iansan/skill.go: fast-skill' },
  // アルレッキーノ: 血の契約 30 秒
  '10000096-pyro_e': { frames: 1800, source: 'arlecchino/skill.go: directive' },
  // ジン: 蒲公英の風 10 秒 + 40 フレーム（発動の遅れを含む）
  '10000003-anemo_q': { frames: 640, source: 'jean/burst.go: jean-q' },
};
