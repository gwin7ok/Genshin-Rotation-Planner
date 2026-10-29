import type { ActionDefinition, ActionType } from '../types/genshin';
import { t } from '../i18n';
import { loc } from '../i18n/loc';

/**
 * アクションの説明文（ホバー表示用。追加作業 25-3b / issue #20）。
 * スキル・爆発・通常攻撃・重撃・落下攻撃は、マスターのアクション定義の説明（genshin-db の天賦の説明文。通常攻撃・重撃・落下攻撃は、3 つで 1 つの文を共通で出す）。
 * 定義に説明が無いもの（カスタムキャラなど）・ダッシュ・ジャンプ・交代・待機は、共通の説明
 */
const GENERIC: Partial<Record<ActionType, string>> = {
  normal: t('messages:action.normal'),
  charged: t('messages:action.charged'),
  plunge_low: t('messages:action.plunge_low'),
  plunge_high: t('messages:action.plunge_high'),
  dash: t('messages:action.dash'),
  jump: t('messages:action.jump'),
  swap: t('messages:action.swap'),
  wait: t('messages:action.wait'),
};

export function actionDescription(
  act: { type: ActionType; actionTypeId?: string },
  def?: Pick<ActionDefinition, 'description' | 'en'>,
): string | undefined {
  if (act.actionTypeId === 'mode_hold') return t('messages:action.modeHold');
  return (def?.description ? loc(def, 'description') : undefined) ?? GENERIC[act.type];
}
