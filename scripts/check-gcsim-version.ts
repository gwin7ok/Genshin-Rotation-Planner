/**
 * gcsim のバージョンの整合性の検査（gcsim.config.json のコミットと、辞書・対応表・WebAssembly 版の食い違いを見つける）
 *
 *   npm run gcsim:check
 *
 * - 辞書・対応表などのデータが、設定（gcsim.config.json）のコミットで作られていること
 * - public/gcsim/wasm-info.json（WebAssembly 版のビルドの記録）が、設定のコミットと一致すること（まだビルドしていなければ、飛ばす）
 * 食い違いがあれば、終了コード 1。gcsim のバージョンを上げる手順は docs/gcsim-サーバー更新手順.md。
 */
import fs from 'node:fs';
import path from 'node:path';
import { GCSIM_CONFIG as cfg } from '../src/utils/gcsim/gcsimConfig.ts';

const ROOT = process.cwd();
let bad = 0;
const line = (ok: boolean, msg: string) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) bad++; };

const DATA_FILES: Array<[dir: string, file: string]> = [
  ['public/data', 'gcsim_key_catalog.json'],
  ['src/data', 'gcsim_key_map.json'],
  ['public/data', 'action_effect_keys.json'],
  ['src/data', 'action_effect_links_by_duration.json'],
  ['src/data', 'effect_key_coverage.json'],
  ['src/data', 'master_effect_coverage.json'],
  ['src/data', 'skill_hit_frames.json'],
  ['src/data', 'can_queue_after.json'],
];
for (const [dir, file] of DATA_FILES) {
  const p = path.join(ROOT, dir, file);
  const commit = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').match(/"gcsimCommit":\s*"([0-9a-f]+)"/)?.[1] : undefined;
  line(commit === cfg.commit, `${file} のコミット ${commit?.slice(0, 8) ?? '無し'} = 設定 ${cfg.commit.slice(0, 8)}`);
}

const infoPath = path.join(ROOT, 'public/gcsim/wasm-info.json');
if (fs.existsSync(infoPath)) {
  const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
  line(info.gcsimCommit === cfg.commit, `WebAssembly 版（wasm-info.json）のコミット ${String(info.gcsimCommit ?? '無し').slice(0, 8)} = 設定 ${cfg.commit.slice(0, 8)}`);
  line(info.gcsimVersion === cfg.version, `WebAssembly 版のバージョン ${info.gcsimVersion ?? '無し'} = 設定 ${cfg.version}`);
} else {
  console.log('- WebAssembly 版は未ビルド（npm run wasm:build。Go が要る）');
}

if (bad > 0) { console.error(`\n不整合が ${bad} 件あります。docs/gcsim-サーバー更新手順.md を確認してください`); process.exit(1); }
console.log('\n整合性の検査: OK');
