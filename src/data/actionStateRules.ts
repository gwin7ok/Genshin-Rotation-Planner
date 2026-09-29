/**
 * アクション状態の規則辞書（フェーズ3d / D27・D30）
 *
 * gcsim が状態で自動的に別モーションへ切り替える元素スキル（E）は、アプリでは E のボタン1つにまとめている（D25）。
 * そのままだと、ニィロウのステップのような「窓の中の E」もCTを開始する扱いになり、CT違反の判定を誤る。
 * この辞書は、実行前の概算（アプリの時間計算）で、窓の中の E を「CTを開始しない・効果バーを出さない」扱いにするための規則。
 * gcsim を実行した後は、書き戻し（D20）で E ごとのCTが gcsim の結果で上書きされる。
 *
 * - キー: キャラ ID。窓を開くのは、そのキャラの E（アクション定義 `<キャラID>_e`）。
 * - 窓の起点: 窓を開く E の発動時刻（D30）。上書きする値: CT だけ（窓の中の E はCTを開始しない）（D30）。
 * - 静的な秒数で表せない状態（爆発中・炎場・夜魂・近接姿勢など）は「規則なし」（D30）。
 *   規則なし: セノ・ライネ（爆発中）、ディシア（炎場）、タルタリヤ（近接姿勢）、ヴァレサ・キィニチ・マーヴィカ（夜魂）、藍硯 ほか
 * - 出典: gcsim ソースの各キャラの skill.go（2026-09-29 時点）
 */
import type { ActionFrames } from '../types/genshin';

export interface ActionStateRule {
  /** 窓の長さ（秒） */
  windowSeconds: number;
  /** 窓の中で E を押せる回数（窓を使い切る）。未指定は制限なし */
  maxUses?: number;
  /**
   * 窓の中の E の、何回目か（窓の中の1回目から順）ごとのフレーム。所要時間の概算に使う（次の行動別のキャンセルフレーム）。
   * 回数が足りない場合は、最後の段の値を繰り返す。未指定なら E の通常のフレームを使う。
   */
  stageFrames?: ActionFrames[];
  /** 根拠（gcsim ソース） */
  note: string;
}

export const ACTION_STATE_RULES: Record<string, ActionStateRule> = {
  // ニィロウ: E 後の pirouette 10 秒間、E がステップ・N が剣舞になる（回数の上限は未確認）
  '10000070-hydro': {
    windowSeconds: 10,
    // ステップ 1〜3 段（whirlingStepsFrames[0..2]）。各段の全体 33 / 62 / 63、Skill(次のE) 27 / 32 / 63、Swap 31 / 62 / 61
    stageFrames: [
      { total: 33, cancels: { attack: 27, skill: 27, dash: 26, jump: 27, swap: 31 }, source: 'skill.go:whirlingStepsFrames[0]' },
      { total: 62, cancels: { attack: 40, skill: 32, burst: 40, dash: 36, jump: 37 }, source: 'skill.go:whirlingStepsFrames[1]' },
      { total: 63, cancels: { dash: 57, jump: 57, swap: 61 }, source: 'skill.go:whirlingStepsFrames[2]' },
    ],
    note: 'nilou/skill.go: AddStatus(pirouetteStatus, 10*60)',
  },
  // キーティング: 刃(stiletto)が出ている間の E が再発動（刃を消費）
  '10000042-electro': { windowSeconds: 5 + 20 / 60, maxUses: 1,
    stageFrames: [{ total: 43, hitmark: 16, cancels: { attack: 42, dash: 16, jump: 16, swap: 42 }, source: 'skill.go:skillRecastFrames' }],
    note: 'keqing/skill.go: Status.Add(stilettoKey, 5*60+20)',
  },
  // フレミネ: 加圧(persTime) 10 秒間の E が解放（加圧を消費）
  '10000085-cryo': { windowSeconds: 10, maxUses: 1,
    stageFrames: [{ total: 55, cancels: { attack: 53, skill: 47, burst: 47, dash: 47, jump: 47, swap: 51 }, source: 'skill.go:skillPressureFrames[0]' }],
    note: 'freminet/skill.go: AddStatus(persTimeKey, 10*60)',
  },
  // フリンズ: スキル状態 10 秒＋ヒットマークの間の E が spearStorm（状態を消費）
  '10000120-electro': { windowSeconds: 10 + 19 / 60, maxUses: 1,
    stageFrames: [{ total: 42, hitmark: 23, cancels: { attack: 28, burst: 28, dash: 26, jump: 26, walk: 32 }, source: 'skill.go:spearStormFrames' }],
    note: 'flins/skill.go: AddStatus(skillKey, 10*60+skillHitmark)',
  },
  // プルーネ: 再発動の受付 364 フレームの間の E が convert（受付を消費）
  '10000132-anemo': { windowSeconds: 364 / 60, maxUses: 1,
    stageFrames: [{ total: 82, cancels: { attack: 65, charge: 76, skill: 69, burst: 67, dash: 67, jump: 66, swap: 65 }, source: 'skill.go:skillConvertFrames' }],
    note: 'prune/skill.go: AddStatus(skillRecastWindowKey, 364)',
  },
  // オデット: 再発動の受付 394 フレームの間の E が recast（受付を消費）
  '10000150-cryo': { windowSeconds: 394 / 60, maxUses: 1,
    stageFrames: [{ total: 76, cancels: { attack: 75, dash: 74, jump: 75, walk: 75, swap: 74 }, source: 'skill.go:skillRecastFrames' }],
    note: 'odette/skill.go: AddStatus(skillRecastKey, 394)',
  },
  // ドゥリン: スキル受付 6 秒の間の E が白/黒の再発動（受付を消費。白・黒でフレームが違い、どちらになるかは未確認のため stageFrames なし）
  '10000123-pyro': { windowSeconds: 6, maxUses: 1, note: 'durin/skill.go: skillWindowDur = 6*60' },
  // ヴァルカ: スキル状態 12 秒の間の E が specialSkill（回数の上限は未確認）
  '10000128-anemo': {
    windowSeconds: 12,
    stageFrames: [{ total: 68, cancels: { attack: 55, charge: 64, skill: 56, burst: 55, dash: 56, jump: 55, walk: 65 }, source: 'skill.go:specialSkillFrames' }],
    note: 'varka/skill.go: AddStatus(skillKey, 12*60)',
  },
};
