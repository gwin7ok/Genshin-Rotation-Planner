/**
 * HoYoLAB に投稿した、このアプリの紹介記事・解説記事の URL（2026-11-18 投稿）。
 *
 * - 記事が非表示・削除になったときに、直す場所が 1 か所で済むよう、URL はここだけに持つ。
 * - 言語ごとに持つ。英語の記事は、まだ無いので、en も日本語の記事を指す
 *   （英語表示では、リンクの文言に「日本語の記事」と注記を付けている。locales/en の `party:importArticleNote`・`notice:source.article`・`guide:articleLink`）。
 *   英語の記事を投稿したら、`en` の URL を英語の記事に差し替え、locales/en の「in Japanese」の注記を外す。
 * - リンクを出す場所: 編成設定（importFeature。持ちキャラを取り込んでいるときは出さない）・使い方の「持ちキャラの取り込み」の節（importFeature）・画面最下部と使い方の冒頭（intro）。
 */
import { currentLanguage } from '../i18n';
import type { Language } from '../i18n/language';

export type ArticleKind = 'intro' | 'importFeature';

export const ARTICLE_URLS: Record<ArticleKind, Record<Language, string>> = {
  /** アプリ本体の紹介記事（ローテーションの CT・バフ・DPS の確かめ方） */
  intro: {
    ja: 'https://www.hoyolab.com/article/47486641',
    en: 'https://www.hoyolab.com/article/47486641',
  },
  /** 持ちキャラ取り込み機能の使い方の記事 */
  importFeature: {
    ja: 'https://www.hoyolab.com/article/47486618',
    en: 'https://www.hoyolab.com/article/47486618',
  },
};

/** 今の表示言語の記事の URL */
export const articleUrl = (kind: ArticleKind, language: Language = currentLanguage): string => ARTICLE_URLS[kind][language];
