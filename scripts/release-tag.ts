/**
 * リリースの生成（VSCode: ctrl+shift+3 / タスク "release-tag-and-push-short"）。
 *
 *   npm run release:tag                    … 確認の後、Release vX.Y.Z をコミット → push → タグ発行 → push
 *   npm run release:tag -- --dry-run       … 何も実行せず、行う内容だけを表示する
 *   npm run release:tag -- --yes           … 確認を省略する
 *   npm run release:tag -- --no-push       … コミット・タグだけ（push しない）
 *   npm run release:tag -- --skip-check    … 公開前の検査（check:release）を省略する
 *
 * タグ `vX.Y.Z` の push をきっかけに、GitHub Actions（.github/workflows/release.yml）が、
 * 版の検証 → 変更履歴の抽出 → GitHub Release の作成 → deploy（GitHub Pages への公開）の起動 を行う。
 * 既存タグの削除・再作成は行わない。
 * 参考: G:\Cursor_Folder\WRFFofGwin\firefox-window-resizer の tools/release-tag.ps1 と同じ流れ。
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline/promises';

const a = new Set(process.argv.slice(2));
const dryRun = a.has('--dry-run');
const yes = a.has('--yes');
const noPush = a.has('--no-push');
const skipCheck = a.has('--skip-check');
const REMOTE = 'origin';
const BRANCH = 'main';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (...args: string[]) => spawnSync('git', args, { stdio: 'ignore' }).status === 0;
const die = (m: string, code = 1): never => {
  console.error(`\n✗ ${m}`);
  process.exit(code);
};
/** 実行の前提の確認。--dry-run のときは、警告だけにして続ける（内容の確認ができるように） */
const need = (ok: boolean, m: string, code: number) => {
  if (ok) return;
  if (dryRun) console.log(`! ${m}（--dry-run のため、続行）`);
  else die(m, code);
};

const version = (JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version?: string }).version;
if (!version) die('package.json に version がありません', 2);
if (!/^\d+\.\d+\.\d+$/.test(version!)) die(`package.json の version が x.y.z ではありません: ${version}`, 2);
const tag = `v${version}`;
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
console.log(`Version: ${version}\nTag: ${tag}\nBranch: ${branch}`);

// CHANGELOG に、該当の節があること
const log = fs.readFileSync('CHANGELOG.md', 'utf8');
if (!new RegExp(`^## \\[${version!.replace(/\./g, '\\.')}\\]`, 'm').test(log)) {
  die(`CHANGELOG.md に、版 ${version} の節がありません。先に \`npm run release:bump\`（ctrl+shift+2）を実行してください。`, 3);
}

// タグがまだ無いこと（ローカル・リモート）
if (git('tag', '-l', tag) !== '') die(`ローカルに、タグ ${tag} がすでにあります。版を上げてください（タグの再作成はしません）。`, 5);
if (!noPush) {
  let remoteTag = '';
  try {
    remoteTag = git('ls-remote', '--tags', REMOTE, `refs/tags/${tag}`);
  } catch (e) {
    die(`${REMOTE} に接続できませんでした: ${e instanceof Error ? e.message : String(e)}`, 6);
  }
  if (remoteTag !== '') die(`${REMOTE} に、タグ ${tag} がすでにあります。版を上げてください。`, 6);
}

// ブランチ: Actions が、タグのコミットが main に含まれることを検証するため、main で行う
need(branch === BRANCH, `main ブランチではありません（今: ${branch}）。リリースは main で行います。`, 7);

// 未コミットの変更: package.json・CHANGELOG.md だけなら、Release のコミットにまとめる
const dirty = git('status', '--porcelain').split('\n').filter(Boolean);
const dirtyFiles = dirty.map(l => l.slice(3).replace(/^"|"$/g, ''));
const others = dirtyFiles.filter(f => !['package.json', 'CHANGELOG.md'].includes(f));
need(others.length === 0, `package.json・CHANGELOG.md 以外に、コミットしていない変更があります。先にコミットしてください:\n${dirty.join('\n')}`, 4);
const needCommit = dirtyFiles.some(f => ['package.json', 'CHANGELOG.md'].includes(f)) && others.length === 0;

// origin/main より遅れていないこと
if (!noPush) {
  try {
    git('fetch', REMOTE, BRANCH);
    need(gitOk('merge-base', '--is-ancestor', `${REMOTE}/${BRANCH}`, 'HEAD'), `ローカルが ${REMOTE}/${BRANCH} より遅れています（pull してください）。`, 8);
  } catch {
    console.log('! fetch できませんでした（続行）');
  }
}

const planned: string[] = [];
if (!skipCheck) planned.push('node scripts/check-release.ts   （公開前の検査）');
if (needCommit) planned.push(`git add package.json CHANGELOG.md; git commit -m "Release ${tag}"`);
if (!noPush) planned.push(`git push ${REMOTE} ${branch}`);
planned.push(`git tag -a ${tag} -m "Release ${tag}" HEAD`);
if (!noPush) planned.push(`git push ${REMOTE} refs/tags/${tag}`);
console.log('\nPlanned commands:');
for (const p of planned) console.log(`  ${p}`);

if (dryRun) {
  console.log('\nDry run: 何も実行していません。');
  process.exit(0);
}

if (!yes) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question(`\nリリース ${tag} を生成します（push すると GitHub Actions が Release の作成と公開を行います）。実行しますか? [Y/n]: `)).trim();
  rl.close();
  if (ans !== '' && !/^[yY]/.test(ans)) {
    console.log('中止しました。');
    process.exit(0);
  }
}

const run = (cmd: string, args: string[], code: number) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) die(`失敗しました: ${cmd} ${args.join(' ')}`, code);
};

if (!skipCheck) run(process.execPath, ['scripts/check-release.ts'], 13);
if (needCommit) {
  run('git', ['add', 'package.json', 'CHANGELOG.md'], 9);
  run('git', ['commit', '-m', `Release ${tag}`], 9);
}
if (!noPush) run('git', ['push', REMOTE, branch], 12);
run('git', ['tag', '-a', tag, '-m', `Release ${tag}`, 'HEAD'], 10);
if (!noPush) run('git', ['push', REMOTE, `refs/tags/${tag}`], 11);

console.log(`\n✓ タグ '${tag}' を作成${noPush ? '' : '・push'}しました。`);
if (!noPush) {
  console.log('  Actions が、Release の作成と、GitHub Pages への公開（deploy）を行います（数分）:');
  console.log('    https://github.com/gwin7ok/Genshin-Rotation-Planner/actions');
  console.log(`  公開サイト: https://gwin7ok.github.io/Genshin-Rotation-Planner/ （フッターに「バージョン v${version}」が出ます）`);
}
