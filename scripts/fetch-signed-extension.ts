/**
 * 署名済みの Firefox 用の拡張機能（.xpi）を、GitHub の Release から取得して、公開サイト（public/downloads/）に置く。
 *
 *   npm run ext:fetch-signed     （deploy.yml が、画面のビルドの前に実行する。出力は Git に入れない）
 *
 * 署名済みの xpi がまだ無ければ（最初の署名の前・Secrets が未登録で署名を飛ばしたとき）、何も置かずに、正常に終わる。
 * Release の一覧の取得に失敗したときは、失敗にする（xpi を置き忘れたまま公開しないため）。
 * 仕組み・出力するファイル: scripts/extension-updates.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { syncSignedExtension } from './extension-updates.ts';
import { FIREFOX_OVERRIDES_FILE } from './extension-manifest.ts';

const gecko = JSON.parse(fs.readFileSync(FIREFOX_OVERRIDES_FILE, 'utf8')).browser_specific_settings.gecko as { id: string; update_url: string };
const repo = process.env.GITHUB_REPOSITORY || 'gwin7ok/Genshin-Rotation-Planner';
const outDir = path.resolve('public/downloads');

const result = await syncSignedExtension({ fetchImpl: fetch, repo, token: process.env.GITHUB_TOKEN, outDir, id: gecko.id, updateUrl: gecko.update_url });
if (result) console.log(`署名済みの拡張機能 v${result.version}（${result.bytes} バイト）を ${path.relative(process.cwd(), outDir)} に置きました（更新用の JSON も作りました）`);
else console.log('署名済みの Firefox 用の拡張機能（grp-hoyolab-importer-<版>.xpi）が、Release に、まだありません。何も置きません');
