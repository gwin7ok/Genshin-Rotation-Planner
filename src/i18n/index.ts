/**
 * i18next の初期化と、文言を引く t()（docs/i18n/plan.md）。
 *
 * main.tsx の最初で読み込み、ほかのモジュールより先に初期化する。言語は起動時に 1 回だけ決まり（D245）、
 * 実行中は変わらないため、React のコンポーネントでも React の外（src/utils/・src/masterdata/）でも、同じ t() で引ける。
 */
import i18n, { TOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resolveLanguage } from './language';
import { DEFAULT_NS, resources } from './resources';
import type { TranslationKey } from './keys';

export type { TranslationKey } from './keys';

export const currentLanguage = resolveLanguage();

/** 日付・数値の整形に使うロケール（表示の言語に合わせる。タイムゾーンは利用者の端末のまま） */
export const dateLocale = currentLanguage === 'ja' ? 'ja-JP' : 'en-US';

void i18n.use(initReactI18next).init({
  resources,
  lng: currentLanguage,
  fallbackLng: 'ja',
  defaultNS: DEFAULT_NS,
  ns: Object.keys(resources.ja),
  // 言語ファイルは同梱なので、同期で初期化する（最初の描画の前に文言が揃う）
  initAsync: false,
  interpolation: { escapeValue: false }, // React がエスケープする
});

/** 文言を引く。差し込み値は options で渡す（例: t('language.autoTitle', { language: '日本語' })） */
export function t(key: TranslationKey, options?: TOptions): string {
  return i18n.t(key as string, options as TOptions) as unknown as string;
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = currentLanguage;
  document.title = t('app.title');
}

export default i18n;
