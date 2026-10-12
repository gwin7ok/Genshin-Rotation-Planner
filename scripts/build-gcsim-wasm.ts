/**
 * gcsim の WebAssembly 版（public/gcsim/main.wasm・wasm_exec.js）を、gcsim.config.json のコミットのソースからビルドする。
 *
 *   npm run wasm:build                      … ソースの tarball を取得してビルド（Go が要る）
 *   npm run wasm:build -- --src <ソースのフォルダ>   … 展開済みのソース（cmd/wasm を含むフォルダ）を使う（取得しない）
 *   環境変数 GO … go の実行ファイルのパス（PATH に無いとき）
 *
 * 生成物（Git 管理外。AGPL-3.0）: public/gcsim/main.wasm・wasm_exec.js・wasm-info.json（コミット・Go のバージョン・SHA-256）
 * ソースは無改変。ビルドの条件（コミット・Go のバージョン・コマンド）は wasm-info.json と docs/gcsim-サーバー更新手順.md に残す。
 * ソースの入手先（配布版の AGPL §6）は gcsim.config.json の sourceMirror と、画面の下部・NOTICE に出す。
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import config from '../gcsim.config.json' with { type: 'json' };

const OUT_DIR = path.join('public', 'gcsim');
const args = process.argv.slice(2);
const srcArgIdx = args.indexOf('--src');
const goBin = process.env.GO || 'go';

const run = (cmd: string, argv: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) =>
  execFileSync(cmd, argv, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', ...opts });

async function obtainSource(): Promise<string> {
  if (srcArgIdx >= 0) {
    const dir = path.resolve(args[srcArgIdx + 1] ?? '');
    if (!fs.existsSync(path.join(dir, 'cmd', 'wasm', 'main.go'))) throw new Error(`${dir} に cmd/wasm/main.go がありません`);
    return dir;
  }
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gcsim-src-'));
  const url = `https://codeload.github.com/${config.repo}/tar.gz/${config.commit}`;
  console.log(`ソースを取得: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ソースを取得できませんでした（HTTP ${res.status}）`);
  const tgz = path.join(work, 'src.tgz');
  fs.writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));
  run('tar', ['-xzf', tgz, '-C', work]);
  const sub = fs.readdirSync(work).find(n => fs.statSync(path.join(work, n)).isDirectory());
  if (!sub) throw new Error('ソースの展開に失敗しました');
  return path.join(work, sub);
}

const srcDir = await obtainSource();
const wasmDir = path.join(srcDir, 'cmd', 'wasm');
const goVersion = run(goBin, ['version']).trim();
console.log(`Go: ${goVersion}`);

const env = { ...process.env, GOOS: 'js', GOARCH: 'wasm' };
const tmpWasm = path.join(wasmDir, 'main.wasm');
console.log('ビルド中…（初回は依存モジュールの取得で、数十秒かかる）');
run(goBin, ['build', '-trimpath', '-o', tmpWasm, '.'], { cwd: wasmDir, env });

const goroot = run(goBin, ['env', 'GOROOT']).trim();
const execJs = [path.join(goroot, 'lib', 'wasm', 'wasm_exec.js'), path.join(goroot, 'misc', 'wasm', 'wasm_exec.js')].find(p => fs.existsSync(p));
if (!execJs) throw new Error('GOROOT に wasm_exec.js が見つかりません');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.copyFileSync(tmpWasm, path.join(OUT_DIR, 'main.wasm'));
fs.copyFileSync(execJs, path.join(OUT_DIR, 'wasm_exec.js'));
const bytes = fs.readFileSync(path.join(OUT_DIR, 'main.wasm'));
const info = {
  gcsimVersion: config.version,
  gcsimCommit: config.commit,
  goVersion,
  command: 'GOOS=js GOARCH=wasm go build -trimpath -o main.wasm ./cmd/wasm',
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  size: bytes.length,
  builtAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(OUT_DIR, 'wasm-info.json'), JSON.stringify(info, null, 2) + '\n');
console.log(`生成: ${OUT_DIR}/main.wasm（${(bytes.length / 1e6).toFixed(1)} MB）・wasm_exec.js・wasm-info.json`);
console.log(`gcsim ${info.gcsimVersion}（${info.gcsimCommit.slice(0, 8)}）/ SHA-256 ${info.sha256}`);
