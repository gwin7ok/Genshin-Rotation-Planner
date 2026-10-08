/**
 * gcsim ローカルサーバーの取得・起動・停止・検査（gcsim.config.json のバージョンに固定）
 *
 *   npm run gcsim:install   公式リリースから取得し、SHA-256 を検証する（.gcsim/<バージョン>/ に保存。Git 管理外）
 *   npm run gcsim:start     取得（未取得なら）→ 起動（バックグラウンド）
 *   npm run gcsim:stop      このコマンドで起動したサーバーを停止する
 *   npm run gcsim:status    起動状態・バージョン
 *   npm run gcsim:check     設定・実行ファイル・辞書/対応表のコミットの整合性を検査する
 *
 * 方針: 実行ファイルは Git に入れない（AGPL の配布義務・容量・OS ごとの違いのため）。取得元は公式リリースだけで、
 * 設定ファイルの SHA-256 と一致したものだけを使う。サーバーは改変しない。自動更新（-update）は使わない。
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import { GCSIM_CONFIG as cfg } from '../src/utils/gcsim/gcsimConfig.ts';

const ROOT = process.cwd();
const platformKey = `${process.platform}-${process.arch}`;
const asset = cfg.assets[platformKey];
const dir = path.join(ROOT, '.gcsim', cfg.version);
const exePath = asset ? path.join(dir, asset.name) : '';
const pidFile = path.join(ROOT, '.gcsim', 'server.pid');
const { host, port } = cfg.server;

const fail = (msg: string): never => { console.error('エラー: ' + msg); process.exit(1); };

function sha256Of(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function portOpen(): Promise<boolean> {
  return new Promise(resolve => {
    const s = net.connect({ host, port });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
    s.setTimeout(1500, () => { s.destroy(); resolve(false); });
  });
}

function readPid(): number | undefined {
  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
    if (!Number.isInteger(pid) || pid <= 0) return undefined;
    process.kill(pid, 0); // 生きているか
    return pid;
  } catch { return undefined; }
}

function installedVersion(): string | undefined {
  try {
    const out = cp.execFileSync(exePath, ['-version'], { encoding: 'utf8', timeout: 15000 });
    return out.match(/v\d+\.\d+\.\d+\S*/)?.[0];
  } catch { return undefined; }
}

async function install(): Promise<void> {
  if (!asset) fail(`この環境（${platformKey}）用の実行ファイルが gcsim.config.json にありません`);
  if (fs.existsSync(exePath) && sha256Of(exePath) === asset.sha256) {
    console.log(`取得済み: ${path.relative(ROOT, exePath)}（SHA-256 一致）`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  console.log(`取得: ${asset.url}（${(asset.size / 1024 / 1024).toFixed(1)} MB）`);
  const res = await fetch(asset.url, { redirect: 'follow' });
  if (!res.ok) fail(`取得に失敗しました（HTTP ${res.status}）`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = crypto.createHash('sha256').update(buf).digest('hex');
  if (got !== asset.sha256) fail(`SHA-256 が一致しません（設定 ${asset.sha256} / 取得 ${got}）。保存しません`);
  const tmp = exePath + '.download';
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, exePath);
  if (process.platform !== 'win32') fs.chmodSync(exePath, 0o755);
  console.log(`保存: ${path.relative(ROOT, exePath)}（SHA-256 一致）`);
}

async function start(): Promise<void> {
  await install();
  const ver = installedVersion();
  if (ver !== cfg.version) fail(`実行ファイルのバージョン（${ver ?? '不明'}）が設定（${cfg.version}）と一致しません`);
  const pid = readPid();
  if (await portOpen()) {
    if (pid) { console.log(`すでに起動中です（PID ${pid}、${host}:${port}）`); return; }
    fail(`${host}:${port} は別のプロセスが使っています（このコマンドで起動したものではありません）。停止するか、gcsim.config.json の port を変えてください`);
  }
  const child = cp.spawn(exePath, ['-host', host, '-port', String(port)], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(child.pid));
  for (let i = 0; i < 30; i++) {
    if (await portOpen()) { console.log(`起動しました（PID ${child.pid}、${cfg.version}、http://${host}:${port}）`); return; }
    await new Promise(r => setTimeout(r, 500));
  }
  fail('起動を確認できませんでした（15 秒待ちました）');
}

async function stop(): Promise<void> {
  const pid = readPid();
  if (!pid) {
    console.log('このコマンドで起動したサーバーはありません');
    if (await portOpen()) console.log(`注意: ${host}:${port} は別のプロセスが使っています（停止しません）`);
    return;
  }
  process.kill(pid);
  fs.rmSync(pidFile, { force: true });
  console.log(`停止しました（PID ${pid}）`);
}

async function status(): Promise<void> {
  const pid = readPid();
  const open = await portOpen();
  console.log(`設定: ${cfg.version}（コミット ${cfg.commit.slice(0, 8)}）/ ${platformKey}`);
  console.log(`実行ファイル: ${asset && fs.existsSync(exePath) ? path.relative(ROOT, exePath) + (sha256Of(exePath) === asset.sha256 ? '（SHA-256 一致）' : '（SHA-256 不一致）') : '未取得'}`);
  console.log(`サーバー: ${pid ? `起動中（PID ${pid}）` : open ? '別のプロセスが ' + port + ' 番を使用中' : '停止中'}（http://${host}:${port}）`);
}

/** 設定・実行ファイル・辞書/対応表のコミットの整合性 */
async function check(): Promise<void> {
  let bad = 0;
  const line = (ok: boolean, msg: string) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) bad++; };
  line(!!asset, `この環境（${platformKey}）用の実行ファイルの設定がある`);
  if (asset && fs.existsSync(exePath)) {
    line(sha256Of(exePath) === asset.sha256, `実行ファイルの SHA-256 が設定と一致`);
    const v = installedVersion();
    line(v === cfg.version, `実行ファイルのバージョン ${v ?? '不明'} = 設定 ${cfg.version}`);
  } else {
    console.log('- 実行ファイルは未取得（npm run gcsim:install）');
  }
  for (const f of ['gcsim_key_catalog.json', 'gcsim_key_map.json', 'action_effect_keys.json', 'action_effect_links_by_duration.json', 'effect_key_coverage.json', 'master_effect_coverage.json', 'skill_hit_frames.json']) {
    const p = path.join(ROOT, ['gcsim_key_catalog.json', 'action_effect_keys.json'].includes(f) ? 'public/data' : 'src/data', f);
    const commit = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').match(/"gcsimCommit":\s*"([0-9a-f]+)"/)?.[1] : undefined;
    line(commit === cfg.commit, `${f} のコミット ${commit?.slice(0, 8) ?? '無し'} = 設定 ${cfg.commit.slice(0, 8)}`);
  }
  if (await portOpen()) console.log(`- ${host}:${port} でサーバーが応答中`);
  if (bad > 0) { console.error(`\n不整合が ${bad} 件あります。docs/gcsim-サーバー更新手順.md を確認してください`); process.exit(1); }
  console.log('\n整合性の検査: OK');
}

const cmd = process.argv[2];
const commands: Record<string, () => Promise<void>> = { install, start, stop, status, check };
if (!cmd || !commands[cmd]) fail(`使い方: node scripts/gcsim-server.ts <${Object.keys(commands).join('|')}>`);
await commands[cmd]();
