/**
 * 表示の言語の決定・保存・切り替え（docs/i18n/plan.md 4.2。D245〜D248・D253）。
 *
 * - 保存された設定（SETTING_KEYS.language）があれば、それを使う。
 * - 無ければ、ブラウザの優先言語の一覧を先頭から見て、最初の ja / en。どちらも無ければ英語。
 * - 自動の判定の結果は保存しない（「自動」を選ぶと、保存を消す）。
 * - 切り替えたら、ページを再読み込みする（言語は起動時に 1 回だけ決まる）。
 * - 公開サイトでも切り替えを使える（D253 のとおり、全部訳し終えたフェーズ 5 で有効にした）。
 */
import { SETTING_KEYS, readString, removeKey, writeString } from '../utils/persistence';

export const LANGUAGES = ['ja', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
/** 言語の選択肢（'auto' = 保存しない・ブラウザに従う） */
export type LanguagePreference = Language | 'auto';

function isLanguage(value: unknown): value is Language {
  return (LANGUAGES as readonly unknown[]).includes(value);
}

/** ブラウザの優先言語の一覧から、最初の ja / en を選ぶ。どちらも無ければ英語（D247） */
export function detectBrowserLanguage(languages: readonly string[] | undefined): Language {
  for (const tag of languages ?? []) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return 'en';
}

/** 保存された言語の設定（無い・不正なときは 'auto'） */
export function getLanguagePreference(): LanguagePreference {
  const saved = readString(SETTING_KEYS.language);
  return isLanguage(saved) ? saved : 'auto';
}

function browserLanguages(): readonly string[] | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

/** 「自動」のときに使う言語（ブラウザの言語から決める） */
export const autoLanguage = (): Language => detectBrowserLanguage(browserLanguages());

/** 今回の起動で使う言語 */
export function resolveLanguage(): Language {
  // ブラウザの外（検査スクリプトなど。Node にも navigator があり en-US になる）は日本語
  if (typeof window === 'undefined') return 'ja';
  const pref = getLanguagePreference();
  return pref === 'auto' ? autoLanguage() : pref;
}

/** 言語の設定を保存し、ページを再読み込みして反映する（D245） */
export function changeLanguagePreference(pref: LanguagePreference): void {
  if (pref === 'auto') removeKey(SETTING_KEYS.language);
  else writeString(SETTING_KEYS.language, pref);
  window.location.reload();
}
