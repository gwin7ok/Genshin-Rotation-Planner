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
  /**
   * 窓の中の E を使うたびに、窓の終わりを「その E の時刻 + この秒数」に更新する（ディルック・閑雲）。窓の中の何回目か（1 回目から順）ごと。足りなければ最後の値を繰り返す。
   * 未指定なら、窓の終わりは更新しない（最初の E から windowSeconds で固定）
   */
  refreshWindowSeconds?: number[];
  /** 根拠（gcsim ソース） */
  note: string;
}

export const ACTION_STATE_RULES: Record<string, ActionStateRule> = {
  // ニィロウ: E 後の pirouette 10 秒間、E がステップ・N が剣舞になる（回数の上限は未確認）
  // ニィロウ: 窓の規則ではなく、モードの定義（ACTION_MODES。剣舞。ステップ 3 段で終わる）にした（2026-10-08）
  // 刻晴: 刃(stiletto)が出ている間の E が再発動（刃を消費）
  '10000042-electro': { windowSeconds: 5 + 20 / 60, maxUses: 1,
    stageFrames: [{ total: 43, hitmark: 16, cancels: { attack: 42, dash: 16, jump: 16, swap: 42 }, source: 'skill.go:skillRecastFrames' }],
    note: 'keqing/skill.go: Status.Add(stilettoKey, 5*60+20)',
  },
  // フレミネ: 窓の規則ではなく、モードの定義（ACTION_MODES。潜水〔加圧〕。交代しても続く・E の再押しで起爆）にした（2026-10-08）
  // フリンズ: 窓の規則ではなく、特殊スキル（嵐槍。別アクション `10000120-electro_e_spearstorm`。2026-10-05）にした。
  // 嵐槍は状態を消費せず、専用の CT（6 秒）で何度も使えるため（ファルカ・オデットと同じ特殊スキルの仕組み）
  // プルーネ: 再発動の受付 364 フレームの間の E が convert（受付を消費）
  '10000132-anemo': { windowSeconds: 364 / 60, maxUses: 1,
    stageFrames: [{ total: 82, cancels: { attack: 65, charge: 76, skill: 69, burst: 67, dash: 67, jump: 66, swap: 65 }, source: 'skill.go:skillConvertFrames' }],
    note: 'prune/skill.go: AddStatus(skillRecastWindowKey, 364)',
  },
  // オデット: 特殊元素スキル（spE）は、スキルとは別のCTを持つため、別のアクション（`10000150-cryo_e_recast`）にした（2026-10-01）。窓の規則は不要
  // ドゥリン: スキル受付 6 秒の間の E が白/黒の再発動（受付を消費。白・黒でフレームが違い、どちらになるかは未確認のため stageFrames なし）
  '10000123-pyro': { windowSeconds: 6, maxUses: 1, note: 'durin/skill.go: skillWindowDur = 6*60' },
  // 千織・藍硯・ディシア（炎場）: 窓の規則ではなく、モードの定義（ACTION_MODES の「受付」型）にした（2026-10-08。窓の規則とモードの定義の統一）
  // 夢見月瑞希: 窓の規則ではなく、モードの定義（マスターの ActionDefinition.mode。characterMasterGenerator.ts の ACTION_MODES）にした（2026-10-08）。
  // 状態の間の E（解除。CT なし）は、モードを終わらせるアクションとして扱う。同じ値を 2 か所に持たない
  // ディルック: E の後 4 秒の間の E が 2 段目・3 段目（E を使うたびに 4 秒に更新。3 段目で窓が閉じる）。CT は 1 段目で始まる（10 秒）。ヒットストップによる窓の延長（約 0.12〜0.16 秒）は含めない（最短）
  '10000016-pyro': {
    windowSeconds: 4, maxUses: 2, refreshWindowSeconds: [4, 4],
    stageFrames: [
      { total: 38, hitmark: 28, cancels: { skill: 37, burst: 37, dash: 28, jump: 31, swap: 36 }, source: 'skill.go:skillFrames[1]' },
      { total: 66, hitmark: 46, cancels: { attack: 58, skill: 57, burst: 57, dash: 47, jump: 48 }, source: 'skill.go:skillFrames[2]' },
    ],
    note: 'diluc/skill.go: AddStatus(eWindowKey, 4*60, true)（E のたびに更新）、eCounter == 3 で DeleteStatus、SetCD は 1 段目（10*60）',
  },
  // 閑雲・クロリンデ: 窓の規則ではなく、モードの定義（ACTION_MODES。雲の変化・夜巡り。交代で終わる）にした（2026-10-08）
  // ファルカ: 窓の規則ではなく、モードの定義（疾風怒濤。状態の間の E は特殊スキルの動作）にした（2026-10-08）
};
