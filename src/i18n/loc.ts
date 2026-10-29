/**
 * ゲームデータの表示用の文を、表示の言語で選ぶ（D255。docs/i18n/plan.md 4.3.1）。
 *
 * - 英語のときは `obj.en[key]`、無ければ日本語の欄（`obj[key]`）。日本語のときは日本語の欄。
 * - 処理（数値の抽出・判定・gcsim の設定文）では使わない。日本語の欄をそのまま見る。
 */
import type { DataSourceQuote } from '../types/genshin';
import { currentLanguage, t } from './index';

type Localizable<K extends string> = { [P in K]?: string } & { en?: { [P in K]?: string } };

/** 表示の言語の文（無い・空のときは日本語の欄。両方無ければ空文字） */
export function loc<K extends string>(obj: Localizable<K> | undefined | null, key: K): string {
  if (!obj) return '';
  const ja = obj[key] ?? '';
  if (currentLanguage !== 'en') return ja;
  return obj.en?.[key] || ja;
}

/** キャラの表示名（英語のときは en.name → englishName → 日本語の名前） */
export function charName(c: { name: string; englishName?: string; en?: { name?: string } } | undefined | null): string {
  if (!c) return '';
  if (currentLanguage !== 'en') return c.name;
  return c.en?.name || c.englishName || c.name;
}

/**
 * 編成の中のアクションの表示名（D250・3-6）。保存されている名前は、追加したときの言語の文字列なので、
 * キャラのアクション定義（actionTypeId）から表示の言語で引く。定義が無いもの（削除済み・カスタム）は保存されている名前。
 * 待機・維持・キャラ交代は、アプリの文言
 */
export function actionName(
  char: { availableActions?: Array<{ id: string; name: string; en?: { name?: string } }> } | undefined | null,
  act: { actionTypeId?: string; name: string; type?: string },
): string {
  if (act.actionTypeId === 'wait') return t('editor:waitName');
  if (act.actionTypeId === 'mode_hold') return t('messages:rotation.modeHoldName');
  if (act.actionTypeId === 'action_switch_char') return t('messages:rotation.swapName');
  const def = act.actionTypeId ? char?.availableActions?.find(d => d.id === act.actionTypeId) : undefined;
  return def ? loc(def, 'name') : act.name;
}

/** 根拠の引用（D258。英語のときは en.dataSource、無ければ日本語の原文） */
export function locDataSource(obj: { dataSource?: DataSourceQuote; en?: { dataSource?: DataSourceQuote } } | undefined | null, key: keyof DataSourceQuote): string | undefined {
  if (!obj) return undefined;
  const ja = obj.dataSource?.[key];
  if (currentLanguage !== 'en') return ja;
  return obj.en?.dataSource?.[key] || ja;
}
