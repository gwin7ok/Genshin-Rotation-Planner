/**
 * WASM のビルド元の確認（scripts/tarball-commit.ts。scripts/build-gcsim-wasm.ts が使う）。
 *
 *   npm run check:wasm-source
 *
 * GitHub の tarball の先頭の pax ヘッダー（comment=<コミット>）から、コミットを読んで、期待するものと照合する。
 * 偽の tarball（その場で作る）で確かめる。ネットワークは使わない。
 */
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { assertTarballCommit, readTarballCommit } from './tarball-commit.ts';

const COMMIT = '4eda9fc5f818d7a742f2a967f38fbbde6db84303';
const OTHER = '0123456789abcdef0123456789abcdef01234567';

/** tar の 1 ブロックのヘッダー（名前・サイズ・種類だけ） */
function header(name: string, size: number, typeflag: string): Buffer {
  const h = Buffer.alloc(512);
  h.write(name, 0, 'latin1');
  h.write(size.toString(8).padStart(11, '0'), 124, 'latin1');
  h.write(typeflag, 156, 'latin1');
  h.write('ustar', 257, 'latin1');
  return h;
}
const pad = (b: Buffer) => Buffer.concat([b, Buffer.alloc((512 - (b.length % 512)) % 512)]);

/** GitHub の tarball と同じ形: 先頭に pax_global_header（comment=<コミット>）、続いて、ほかのファイル */
function fakeTarball(commit: string | null, filler = 200_000): Buffer {
  const parts: Buffer[] = [];
  if (commit) {
    // pax の 1 行: `<長さ> comment=<コミット>\n`（長さは、長さの桁数・空白・改行を含む、行全体のバイト数）
    const rest = ` comment=${commit}\n`;
    let total = rest.length + 1;
    while (String(total).length + rest.length !== total) total = String(total).length + rest.length;
    const line = `${total}${rest}`;
    const data = Buffer.from(line, 'utf8');
    parts.push(header('pax_global_header', data.length, 'g'), pad(data));
  }
  const body = Buffer.alloc(filler, 0x61);
  parts.push(header('repo-abc/README.md', body.length, '0'), pad(body), Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(parts));
}

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

check('読み取り: pax ヘッダーのコミットを読める（先頭の一部だけで足りる大きなファイルでも）', () => {
  assert.equal(readTarballCommit(fakeTarball(COMMIT)), COMMIT);
  assert.equal(readTarballCommit(fakeTarball(COMMIT, 5_000_000)), COMMIT);
});
check('照合: 期待するコミットなら、通る（大文字小文字は区別しない）', () => {
  assert.doesNotThrow(() => assertTarballCommit(fakeTarball(COMMIT), COMMIT));
  assert.doesNotThrow(() => assertTarballCommit(fakeTarball(COMMIT), COMMIT.toUpperCase()));
});
check('照合: 別のコミットの tarball は、止める', () => {
  assert.throws(() => assertTarballCommit(fakeTarball(OTHER), COMMIT), /01234567.*4eda9fc5.*中止/);
});
check('照合: pax ヘッダーが無い tarball は、止める（コミットを確かめられない）', () => {
  assert.equal(readTarballCommit(fakeTarball(null)), undefined);
  assert.throws(() => assertTarballCommit(fakeTarball(null), COMMIT), /コミットの ID を読めませんでした/);
});
check('照合: gzip でないもの・壊れたもの・空は、止める（落ちない）', () => {
  for (const bad of [Buffer.alloc(0), Buffer.from('これは tarball ではない'), Buffer.alloc(100, 1), fakeTarball(COMMIT).subarray(0, 20)]) {
    assert.equal(readTarballCommit(bad), undefined);
    assert.throws(() => assertTarballCommit(bad, COMMIT), /中止/);
  }
});

console.log(`\n✓ WASM のビルド元の確認: ${passed} 項目すべて合格`);
