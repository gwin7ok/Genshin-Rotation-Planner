/**
 * 文言のキーの型（日本語の言語ファイルから作る。t() のキーの打ち間違いを tsc（npm run lint）で検出する。D243）。
 *
 * i18next の型の宣言（CustomTypeOptions）は strictNullChecks が前提で、このプロジェクト（無効）では使えないため、自前で型を付ける。
 * 既定の名前空間（common）は `language.auto`、それ以外は `header:menu.help` のように名前空間をつけて書く。
 */
import { DEFAULT_NS, resources } from './resources';

type Resources = (typeof resources)['ja'];
type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
/** 複数形のキー（`items_one` / `items_other`）は、接尾辞を除いた `items` で引く */
type StripPlural<K extends string> = K extends `${infer Base}_${PluralSuffix}` ? Base : K;

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? StripPlural<`${Prefix}${K}`> : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type Namespace = keyof Resources & string;
export type TranslationKey = {
  [NS in Namespace]: NS extends typeof DEFAULT_NS ? Leaves<Resources[NS]> | `${NS}:${Leaves<Resources[NS]>}` : `${NS}:${Leaves<Resources[NS]>}`;
}[Namespace];
