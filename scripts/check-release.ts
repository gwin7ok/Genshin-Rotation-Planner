/**
 * 公開（デプロイ）の前の検査（docs/公開サーバー構築の実装計画.md の 3-A）。
 *
 *   npm run check:release             … 検査（フォークのタグの確認に、GitHub の API を使う）
 *   npm run check:release -- --offline … ネットワークを使う検査（フォークのタグ）を省略する
 *
 * 検査する項目:
 *   1. public/gcsim/ に worker.js・wasm_exec.js・main.wasm・wasm-info.json がある
 *   2. main.wasm の SHA-256・大きさが、wasm-info.json と一致する
 *   3. wasm-info.json の gcsimCommit・gcsimVersion が、gcsim.config.json と一致する（WASM の作り直し忘れの検出）
 *   4. dist/gcsim/main.wasm があれば、public/ のものと同一（ビルドが古くないか）
 *   5. LICENSE・NOTICE がある
 *   6. gcsim.config.json の sourceMirror のタグ（<tagPrefix><version>）が、フォークに存在し、commit を指す（AGPL のソースの控え）
 * 1 つでも失敗したら、終了コード 1。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import config from '../gcsim.config.json' with { type: 'json' };

const offline = process.argv.includes('--offline');
const failures: string[] = [];
const ok = (m: string) => console.log(`✓ ${m}`);
const ng = (m: string) => {
  failures.push(m);
  console.log(`✗ ${m}`);
};
const sha256 = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const dir = path.join('public', 'gcsim');
const required = ['worker.js', 'wasm_exec.js', 'main.wasm', 'wasm-info.json'];
const missing = required.filter(n => !fs.existsSync(path.join(dir, n)));
if (missing.length > 0) {
  ng(`public/gcsim/ に、${missing.join('・')} がありません（npm run wasm:build を実行してください）`);
} else {
  ok(`public/gcsim/ に ${required.join('・')} がある`);
  const info = JSON.parse(fs.readFileSync(path.join(dir, 'wasm-info.json'), 'utf8')) as {
    gcsimVersion: string;
    gcsimCommit: string;
    sha256: string;
    size: number;
  };
  const wasm = path.join(dir, 'main.wasm');
  const actual = sha256(wasm);
  if (actual === info.sha256 && fs.statSync(wasm).size === info.size) ok(`main.wasm の SHA-256・大きさが wasm-info.json と一致（${actual.slice(0, 12)}…）`);
  else ng('main.wasm が wasm-info.json と一致しません（作り直しの途中で止まった・差し替えた可能性。npm run wasm:build をやり直してください）');

  if (info.gcsimCommit === config.commit && info.gcsimVersion === config.version) ok(`WASM の gcsim が設定と一致（${config.version}・${config.commit.slice(0, 8)}）`);
  else ng(`WASM の gcsim（${info.gcsimVersion}・${info.gcsimCommit.slice(0, 8)}）が、gcsim.config.json（${config.version}・${config.commit.slice(0, 8)}）と違います。npm run wasm:build をやり直してください`);

  const built = path.join('dist', 'gcsim', 'main.wasm');
  if (fs.existsSync(built)) {
    if (sha256(built) === actual) ok('dist/gcsim/main.wasm が public/ のものと同一');
    else ng('dist/gcsim/main.wasm が public/ のものと違います（npm run build をやり直してください）');
  } else {
    console.log('- dist/ はまだ無い（npm run build の後に、もう一度実行すると、dist の検査もする）');
  }
}

for (const f of ['LICENSE', 'NOTICE']) {
  if (fs.existsSync(f)) ok(`${f} がある`);
  else ng(`${f} がありません`);
}

const mirror = (config as { sourceMirror?: { url: string; tagPrefix: string } }).sourceMirror;
if (!mirror) {
  ng('gcsim.config.json に sourceMirror がありません（配布する WASM のソースの控えの入手先。AGPL）');
} else if (offline) {
  console.log('- フォークのタグの確認は省略（--offline）');
} else {
  const m = mirror.url.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/);
  const tag = `${mirror.tagPrefix}${config.version}`;
  if (!m) {
    ng(`sourceMirror の URL を解釈できません: ${mirror.url}`);
  } else {
    try {
      const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'check-release' };
      const res = await fetch(`https://api.github.com/repos/${m[1]}/git/ref/tags/${tag}`, { headers });
      if (res.status === 404) {
        ng(`フォーク ${m[1]} に、タグ ${tag} がありません（docs/gcsim-サーバー更新手順.md の 6-B）`);
      } else if (!res.ok) {
        ng(`フォークのタグを確認できませんでした（HTTP ${res.status}）。ネットワークが無いときは --offline`);
      } else {
        const ref = (await res.json()) as { object: { sha: string; type: string; url: string } };
        let sha = ref.object.sha;
        if (ref.object.type === 'tag') {
          const t = await fetch(ref.object.url, { headers });
          if (t.ok) sha = ((await t.json()) as { object: { sha: string } }).object.sha;
        }
        if (sha === config.commit) ok(`フォーク ${m[1]} のタグ ${tag} が、配布版のコミットを指している`);
        else ng(`タグ ${tag} が指すコミット（${sha.slice(0, 8)}）が、配布版（${config.commit.slice(0, 8)}）と違います`);
      }
    } catch (e) {
      ng(`フォークのタグを確認できませんでした（${e instanceof Error ? e.message : String(e)}）。ネットワークが無いときは --offline`);
    }
  }
}

console.log(failures.length === 0 ? '\n✓ 公開前の検査: すべて合格' : `\n✗ 公開前の検査: ${failures.length} 件の不合格`);
process.exit(failures.length === 0 ? 0 : 1);
