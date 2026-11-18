/**
 * 署名済みの Firefox 用の拡張機能（.xpi）を、GitHub の Release から取得して、公開サイトに同梱するための部品。
 * 使うのは scripts/fetch-signed-extension.ts（deploy.yml が、画面のビルドの前に実行する）。確認: npm run check:extension-manifest
 *
 * 署名は、release.yml が、AMO（非公開 = unlisted）で行い、`grp-hoyolab-importer-<版>.xpi` として、Release に添付する。
 * ここでは、それらの Release から、いちばん新しい版を選び、公開サイトの downloads/ に置く:
 *   grp-hoyolab-importer-<版>.xpi        … 署名済みのファイル（更新用 JSON の update_link が指す）
 *   grp-hoyolab-importer.xpi             … 同じファイル（アプリの導入の案内が指す。固定名）
 *   grp-hoyolab-importer-updates.json    … Firefox の自動更新用（manifest の gecko.update_url が指す。ファイル名は、update_url の末尾）
 * 更新用 JSON の形式: https://extensionworkshop.com/documentation/manage/updating-your-extension/
 */
import fs from 'node:fs';
import path from 'node:path';

export interface ReleaseAsset { name: string; browser_download_url: string }
export interface ReleaseInfo { assets?: ReleaseAsset[] }

/** 署名済みの xpi のファイル名（Release の添付ファイル）。署名した版ごと */
export const signedXpiName = (version: string): string => `grp-hoyolab-importer-${version}.xpi`;
/** 公開サイトに置く、最新の版の固定名 */
export const LATEST_XPI_NAME = 'grp-hoyolab-importer.xpi';
const XPI_RE = /^grp-hoyolab-importer-(\d+\.\d+\.\d+)\.xpi$/;

/** 版（主.副.修正）の比較。a が新しければ正、同じなら 0 */
export const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

/** Release の添付ファイルのうち、署名済みの xpi を、版 → ダウンロードの URL で集める（同じ版が複数あれば、先のもの） */
export const collectSignedXpis = (releases: ReleaseInfo[]): Map<string, string> => {
  const found = new Map<string, string>();
  for (const release of releases) {
    for (const asset of release.assets ?? []) {
      const m = XPI_RE.exec(asset.name);
      if (m && !found.has(m[1])) found.set(m[1], asset.browser_download_url);
    }
  }
  return found;
};

/** いちばん新しい版。1 つも無ければ null */
export const pickLatest = (found: Map<string, string>): { version: string; url: string } | null => {
  const versions = [...found.keys()].sort(compareVersions);
  const version = versions.at(-1);
  return version === undefined ? null : { version, url: found.get(version)! };
};

/** Firefox の自動更新用の JSON（最新の版だけを載せる。Firefox は、入っている版より新しければ、update_link から取得する） */
export const buildUpdatesJson = (id: string, updateUrl: string, version: string) => ({
  addons: { [id]: { updates: [{ version, update_link: new URL(signedXpiName(version), updateUrl).href }] } },
});

/** GitHub の Release の一覧（新しい順）を、すべて取得する */
export const listReleases = async (fetchImpl: typeof fetch, repo: string, token?: string): Promise<ReleaseInfo[]> => {
  const all: ReleaseInfo[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'extension-sync-script',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`Release の一覧を取得できません（HTTP ${res.status}）`);
    const part = (await res.json()) as ReleaseInfo[];
    all.push(...part);
    if (part.length < 100) break;
  }
  return all;
};

export interface SyncOptions {
  fetchImpl: typeof fetch;
  repo: string;
  token?: string;
  /** 書き出し先（public/downloads） */
  outDir: string;
  /** manifest の gecko.id */
  id: string;
  /** manifest の gecko.update_url（更新用 JSON を置く URL。ファイル名は、この末尾） */
  updateUrl: string;
}

/** 署名済みの xpi が 1 つも無ければ null（何も書かない）。あれば、最新の版を書き出して、その版を返す */
export const syncSignedExtension = async (o: SyncOptions): Promise<{ version: string; bytes: number } | null> => {
  const latest = pickLatest(collectSignedXpis(await listReleases(o.fetchImpl, o.repo, o.token)));
  if (!latest) return null;

  const res = await o.fetchImpl(latest.url);
  if (!res.ok) throw new Error(`${signedXpiName(latest.version)} を取得できません（HTTP ${res.status}）`);
  const data = Buffer.from(await res.arrayBuffer());
  // xpi は zip（先頭が PK）。エラーのページなどを、そのまま公開しないための確認
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) throw new Error(`${signedXpiName(latest.version)} が、zip（xpi）の形ではありません`);

  fs.mkdirSync(o.outDir, { recursive: true });
  fs.writeFileSync(path.join(o.outDir, signedXpiName(latest.version)), data);
  fs.writeFileSync(path.join(o.outDir, LATEST_XPI_NAME), data);
  const jsonName = path.posix.basename(new URL(o.updateUrl).pathname);
  fs.writeFileSync(path.join(o.outDir, jsonName), `${JSON.stringify(buildUpdatesJson(o.id, o.updateUrl, latest.version), null, 2)}\n`);
  return { version: latest.version, bytes: data.length };
};
