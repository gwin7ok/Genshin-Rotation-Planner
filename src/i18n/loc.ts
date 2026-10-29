/**
 * ゲームデータの表示用の文を、表示の言語で選ぶ（D255。docs/i18n/plan.md 4.3.1）。
 *
 * - 英語のときは `obj.en[key]`、無ければ日本語の欄（`obj[key]`）。日本語のときは日本語の欄。
 * - 処理（数値の抽出・判定・gcsim の設定文）では使わない。日本語の欄をそのまま見る。
 */
import type { DataSourceQuote } from '../types/genshin';
import { currentLanguage } from './index';

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

/** 根拠の引用（D258。英語のときは en.dataSource、無ければ日本語の原文） */
export function locDataSource(obj: { dataSource?: DataSourceQuote; en?: { dataSource?: DataSourceQuote } } | undefined | null, key: keyof DataSourceQuote): string | undefined {
  if (!obj) return undefined;
  const ja = obj.dataSource?.[key];
  if (currentLanguage !== 'en') return ja;
  return obj.en?.dataSource?.[key] || ja;
}
