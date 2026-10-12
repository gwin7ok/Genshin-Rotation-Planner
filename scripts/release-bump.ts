/**
 * 更新履歴の更新（VSCode: ctrl+shift+2 / タスク "Update Changelog"）。
 *
 *   npm run release:bump                    … 対話的に、次の版を選んで更新する
 *   npm run release:bump -- --version 1.2.0 … 版を指定する
 *   npm run release:bump -- --dry-run       … ファイルは変えず、内容だけを表示する
 *
 * 流れ:
 *   1. CHANGELOG.md の `[Unreleased]` が空なら、前のリリース（最新のタグ v*。無ければ CHANGELOG.md を最後に変えたコミット）以降の
 *      コミットから、変更内容を生成する（追加 / 変更 / 修正。docs・test・chore・ci・style・build は載せない）。確認してから書き込む。
 *   2. 次の版（パッチ / マイナー / メジャー、または x.y.z）を選ぶ。
 *   3. package.json の version を更新し、CHANGELOG.md の `[Unreleased]` を `[x.y.z] - 日付` に切り出す（末尾の比較リンクも更新）。
 * この後、`npm run release:tag`（VSCode: ctrl+shift+3）で、コミット → push → タグ → Actions が公開まで行う。
 * 参考: G:\Cursor_Folder\WRFFofGwin\firefox-window-resizer の tools/bump-version.ps1 と同じ流れ。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline/promises';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const vIdx = argv.indexOf('--version');
let version: string | undefined = vIdx >= 0 ? argv[vIdx + 1] : undefined;

const PKG = 'package.json';
const LOG = 'CHANGELOG.md';
const git = (...a: string[]) => {
  try {
    return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const die = (m: string, code = 1): never => {
  console.error(`\n✗ ${m}`);
  process.exit(code);
};
const ask = async (q: string): Promise<string> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(q)).trim();
  rl.close();
  return a;
};

const pkgRaw = fs.readFileSync(PKG, 'utf8');
const current = (JSON.parse(pkgRaw) as { version: string }).version;
if (!/^\d+\.\d+\.\d+$/.test(current)) die(`package.json の version が x.y.z ではありません: ${current}`, 2);

const logRaw0 = fs.readFileSync(LOG, 'utf8');
const crlf = logRaw0.includes('\r\n');
let log = logRaw0.replace(/\r\n/g, '\n');
if (!/^## \[Unreleased\]/m.test(log)) die('CHANGELOG.md に「## [Unreleased]」がありません', 4);

const cmp = (a: string, b: string) => {
  const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};
const hasSection = (v: string) => new RegExp(`^## \\[${v.replace(/\./g, '\\.')}\\]`, 'm').test(log);
const unreleasedBody = () => {
  const m = log.match(/^## \[Unreleased\][^\n]*\n([\s\S]*?)(?=^## \[|^\[[^\]]+\]: |$(?![\s\S]))/m);
  return m ? m[1] : '';
};

// --- まだリリースしていない版が、すでにある（最初のリリースなど） ---
const tags = git('tag', '--list', 'v*', '--sort=-v:refname').split('\n').filter(Boolean);
if (unreleasedBody().trim() === '' && hasSection(current) && !tags.includes(`v${current}`)) {
  console.log(`版 ${current} は、CHANGELOG.md に節があり、まだリリース（タグ v${current}）されていません。`);
  console.log('そのまま、`npm run release:tag`（VSCode: ctrl+shift+3）でリリースできます。');
  process.exit(0);
}

// --- 1. [Unreleased] が空なら、コミットから生成 ---
if (unreleasedBody().trim() === '') {
  const lastTag = tags[0] ?? '';
  const base = lastTag || git('log', '-1', '--format=%H', '--', LOG);
  const baseLabel = lastTag || (base ? `CHANGELOG.md の最終変更コミット (${base.slice(0, 7)})` : '');
  const range = base ? `${base}..HEAD` : 'HEAD';
  const subjects = git('-c', 'core.quotepath=off', 'log', '--no-merges', '--reverse', '--format=%s', range)
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const SKIP = new Set(['docs', 'test', 'chore', 'ci', 'style', 'build']);
  const SECTION_OF: Record<string, string> = { feat: '追加', fix: '修正' };
  const groups: Record<string, string[]> = { 追加: [], 変更: [], 修正: [] };
  const seen = new Set<string>();
  for (const s of subjects) {
    if (/^(Release v|Merge |readme|README)/.test(s) || /^chore\(release\)/i.test(s)) continue;
    const m = s.match(/^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/);
    const type = m ? m[1].toLowerCase() : '';
    if (SKIP.has(type)) continue;
    const body = (m ? m[4] : s).replace(/^D\d+\s+/, '').trim();
    if (seen.has(body)) continue;
    seen.add(body);
    groups[SECTION_OF[type] ?? '変更'].push(`- ${body}`);
  }
  const total = Object.values(groups).reduce((n, l) => n + l.length, 0);
  if (total === 0) {
    console.warn(`[Unreleased] が空で、起点 (${baseLabel || 'なし'}) 以降に、載せる対象のコミットもありません。`);
    console.warn('CHANGELOG.md に、変更内容を書いてから実行してください。');
    process.exit(6);
  }
  let generated = '';
  for (const k of ['追加', '変更', '修正']) if (groups[k].length) generated += `### ${k}\n${groups[k].join('\n')}\n\n`;
  generated = generated.trimEnd();

  console.log(`[Unreleased] が空です。起点 [${baseLabel || 'なし'}] 以降のコミットから生成します（${total} 件）:\n`);
  console.log(generated);
  console.log('');
  const written = log.replace(/^## \[Unreleased\][ \t]*\n/m, `## [Unreleased]\n\n${generated}\n\n`);
  if (dryRun) {
    console.log('Dry run: CHANGELOG.md は変更しません（上記が [Unreleased] に入る想定で続行します）。');
    log = written;
  } else {
    const ans = (await ask('この内容を [Unreleased] に書き込みますか? [Y=書き込んで続行 (Enter) / e=書き込んで編集 / n=中止]: ')).toLowerCase();
    if (ans === '' || ans === 'y') {
      log = written;
    } else if (ans === 'e') {
      fs.writeFileSync(LOG, crlf ? written.replace(/\n/g, '\r\n') : written);
      console.log('CHANGELOG.md に書き込みました。内容（利用者に分かる文）を編集して、もう一度実行してください。');
      process.exit(0);
    } else {
      console.log('中止しました。');
      process.exit(0);
    }
  }
}

// --- 2. 次の版 ---
if (!version) {
  const [ma, mi, pa] = current.split('.').map(Number);
  const patch = `${ma}.${mi}.${pa + 1}`;
  const minor = `${ma}.${mi + 1}.0`;
  const major = `${ma + 1}.0.0`;
  console.log(`現在のバージョン: ${current}`);
  console.log(`  1) ${patch}  (パッチ: 不具合の修正・表示の変更)`);
  console.log(`  2) ${minor}  (マイナー: 機能の追加。gcsim の版を上げたときも)`);
  console.log(`  3) ${major}  (メジャー: 保存データの互換を壊す変更)`);
  const c = await ask('番号、または x.y.z を入力 (空Enterで中止): ');
  if (c === '1') version = patch;
  else if (c === '2') version = minor;
  else if (c === '3') version = major;
  else if (/^\d+\.\d+\.\d+$/.test(c)) version = c;
  else {
    console.log('中止しました。');
    process.exit(0);
  }
}
if (!/^\d+\.\d+\.\d+$/.test(version)) die(`版は x.y.z で指定してください（指定: '${version}'）`, 1);
if (cmp(version, current) <= 0) die(`新しい版 ${version} は、現在の ${current} より大きくしてください。`, 3);
if (hasSection(version)) die(`CHANGELOG.md に、版 ${version} の節がすでにあります。`, 5);

// --- 3. 更新 ---
const d = new Date();
const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let next = log.replace(/^## \[Unreleased\][ \t]*\n/m, `## [Unreleased]\n\n## [${version}] - ${date}\n`);
const prev = tags[0] ?? `v${current}`;
const link = next.match(/^\[Unreleased\]: (.*)\/compare\/(.+?)\.\.\.HEAD$/m);
if (link) {
  next = next.replace(link[0], `[Unreleased]: ${link[1]}/compare/v${version}...HEAD\n[${version}]: ${link[1]}/compare/${prev}...v${version}`);
}
next = next.replace(/\n{3,}(## \[)/g, '\n\n$1');
const nextPkg = pkgRaw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);

console.log(`package.json : ${current} -> ${version}`);
console.log(`CHANGELOG.md : [Unreleased] -> [${version}] - ${date}`);
if (dryRun) {
  console.log('Dry run: ファイルは変更していません。');
  process.exit(0);
}
fs.writeFileSync(PKG, nextPkg);
fs.writeFileSync(LOG, crlf ? next.replace(/\n/g, '\r\n') : next);
console.log('\n更新しました。CHANGELOG.md の文を確認・編集し、`npm run release:tag`（VSCode: ctrl+shift+3）でリリースを生成してください。');
