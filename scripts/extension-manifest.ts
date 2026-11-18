/**
 * HoYoLAB 取り込みの拡張機能（extension/hoyolab-importer）の manifest を、ブラウザごとに作る。
 *
 *   ・Chrome 系: extension/hoyolab-importer/manifest.json を、そのまま使う（拡張機能の版の出どころは、これ 1 つ）
 *   ・Firefox 系: 上の manifest に、extension/firefox-manifest-overrides.json（Firefox だけの項目。
 *     background の scripts・gecko の ID / 下限の版 / 更新用の URL / データ収集の申告）を重ね、さらに次を直す
 *       - 一致パターンのポート指定を外す。Firefox は、ポートを含む一致パターンに対応せず、どのページにも一致しなくなる
 *         （Firefox の不具合票 1362809・1468162。2026-11-18 の実機確認 F-0 で確認）
 *       - 利用者に配る版は、localhost を入れない。開発用（dev: true）のときだけ入れる
 *         （ポートを外すため、ローカルのどのポートのページにも入る。配る版には、広すぎる）
 *       - content_scripts の一致パターンを、host_permissions にも重ねる（不具合票 1766752 の回避策。
 *         重ねなくても動くかは、未確認。署名した版で確かめる）
 *
 * 作るのは manifest の中身だけ（zip・フォルダへの書き出しは、pack-extension.ts）。
 * 確認: npm run check:extension-manifest
 */
import fs from 'node:fs';
import path from 'node:path';

export type ExtensionTarget = 'chrome' | 'firefox';
export interface BuildOptions {
  /** Firefox だけ。true なら、localhost（ポート無し）の一致パターンを残す（開発用） */
  dev?: boolean;
}
export interface ContentScript { matches: string[]; [key: string]: unknown }
export interface Manifest {
  version: string;
  host_permissions?: string[];
  content_scripts?: ContentScript[];
  [key: string]: unknown;
}

export const EXTENSION_SRC_DIR = path.resolve('extension/hoyolab-importer');
export const FIREFOX_OVERRIDES_FILE = path.resolve('extension/firefox-manifest-overrides.json');

export const readBaseManifest = (): Manifest => JSON.parse(fs.readFileSync(path.join(EXTENSION_SRC_DIR, 'manifest.json'), 'utf8'));

/** 一致パターンから、ポート指定を外す（http://localhost:3000/* → http://localhost/*）。ポートの無いものは、そのまま */
export const stripPort = (pattern: string): string => pattern.replace(/^(\*|https?):\/\/([^/:]+):\d+(\/.*)$/, '$1://$2$3');

/** ローカル（localhost・127.0.0.1）を指す一致パターンか（ポートの有無は問わない） */
export const isLocalPattern = (pattern: string): boolean => /^(\*|https?):\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(pattern);

export const buildManifest = (base: Manifest, target: ExtensionTarget, opts: BuildOptions = {}): Manifest => {
  const manifest: Manifest = structuredClone(base);
  if (target === 'chrome') return manifest;

  Object.assign(manifest, JSON.parse(fs.readFileSync(FIREFOX_OVERRIDES_FILE, 'utf8')));
  const keep = (pattern: string) => opts.dev === true || !isLocalPattern(pattern);

  const contentScripts = (manifest.content_scripts ?? [])
    .map(cs => ({ ...cs, matches: cs.matches.filter(keep).map(stripPort) }))
    .filter(cs => cs.matches.length > 0);
  manifest.content_scripts = contentScripts;
  manifest.host_permissions = [...new Set([
    ...(manifest.host_permissions ?? []).filter(keep).map(stripPort),
    ...contentScripts.flatMap(cs => cs.matches),
  ])];
  return manifest;
};
