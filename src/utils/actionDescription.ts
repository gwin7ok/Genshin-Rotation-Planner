import type { ActionDefinition, ActionType } from '../types/genshin';

/**
 * アクションの説明文（ホバー表示用。追加作業 25-3b / issue #20）。
 * スキル・爆発・通常攻撃・重撃・落下攻撃は、マスターのアクション定義の説明（genshin-db の天賦の説明文。通常攻撃・重撃・落下攻撃は、3 つで 1 つの文を共通で出す）。
 * 定義に説明が無いもの（カスタムキャラなど）・ダッシュ・ジャンプ・交代・待機は、共通の説明
 */
const GENERIC: Partial<Record<ActionType, string>> = {
  normal: '通常攻撃。連続して使うと、1 段目・2 段目…と段が進みます（他のアクションを挟むと、1 段目に戻ります）。',
  charged: '重撃。スタミナを消費して放つ攻撃です（弓は狙い撃ち、法器は重撃）。',
  plunge_low: '落下攻撃（低）。低い位置から落下して、着地時に範囲ダメージを与えます。',
  plunge_high: '落下攻撃（高）。高い位置から落下して、着地時に範囲ダメージを与えます。',
  dash: 'ダッシュ（回避）。スタミナを消費します。',
  jump: 'ジャンプ。',
  swap: 'キャラ交代。交代の動作の所要時間です。',
  wait: '待機。何もせずに待つ時間です。',
};

export function actionDescription(
  act: { type: ActionType; actionTypeId?: string },
  def?: Pick<ActionDefinition, 'description'>,
): string | undefined {
  if (act.actionTypeId === 'mode_hold') return '維持。モード（状態）が最大時間まで続くように、出場を延ばす待ちです。';
  return def?.description ?? GENERIC[act.type];
}
