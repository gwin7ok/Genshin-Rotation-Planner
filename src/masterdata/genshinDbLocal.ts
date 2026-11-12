/**
 * 手元の npm パッケージ genshin-db から、API と同じ形の一覧を作る（Node だけ。genshinDbSource.ts が読み込む）。
 * ブラウザのバンドルに入れない（genshinDbSource.ts が、変数経由の動的 import で読む）。
 */
import { createRequire } from 'node:module';
import type { GenshinDbCategory, GenshinDbLanguage } from './genshinDbSource.ts';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const genshinDb: any = require('genshin-db');

/** API の `?query=names&matchCategories=true&verboseCategories=true&resultLanguage=…` と同じ内容。API は JSON なので、同じく JSON を通す（undefined の欄を落とす） */
export function localList(category: GenshinDbCategory, language: GenshinDbLanguage): unknown[] {
  const list = genshinDb[category]('names', { matchCategories: true, verboseCategories: true, resultLanguage: language });
  return JSON.parse(JSON.stringify(list ?? [])) as unknown[];
}

export function localVersion(): string {
  return (require('genshin-db/package.json') as { version: string }).version;
}
