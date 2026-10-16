/**
 * GitHub の tarball（codeload.github.com/<repo>/tar.gz/<コミット>）が、指定したコミットのものかの確認（scripts/build-gcsim-wasm.ts が使う）。
 *
 * GitHub が作る tarball の先頭には、pax のグローバルヘッダー（`pax_global_header`）があり、その `comment=` に、
 * 元になったコミットの ID（40 桁）が入っている。これを、gcsim.config.json のコミットと照合して、
 * 別のコミット・取得途中の応答・差し替えられたファイルを、ビルドの前に止める。
 * （コミットの ID は、中身から決まるので、ソースの内容そのものの固定になる。Go の依存モジュールは、go.sum が検証する）
 */
import zlib from 'node:zlib';

const BLOCK = 512;

/** tarball（gzip）の先頭の pax ヘッダーから、コミットの ID を読む。読めなければ undefined */
export function readTarballCommit(gz: Buffer): string | undefined {
  let tar: Buffer;
  try {
    // 先頭の一部だけを展開する（全体は、数十 MB。途中で切れていても、読めた分だけ使う）
    tar = zlib.gunzipSync(gz.subarray(0, 8192), { finishFlush: zlib.constants.Z_SYNC_FLUSH });
  } catch {
    return undefined;
  }
  if (tar.length < BLOCK * 2) return undefined;
  const name = tar.subarray(0, 100).toString('latin1').replace(/\0.*$/s, '');
  const typeflag = String.fromCharCode(tar[156]);
  if (name !== 'pax_global_header' || typeflag !== 'g') return undefined;
  const size = parseInt(tar.subarray(124, 136).toString('latin1').replace(/\0.*$/s, '').trim() || '0', 8);
  if (!Number.isFinite(size) || size <= 0 || BLOCK + size > tar.length) return undefined;
  const data = tar.subarray(BLOCK, BLOCK + size).toString('utf8');
  // 各行: `<長さ> <キー>=<値>\n`
  return /^\d+ comment=([0-9a-f]{40})$/m.exec(data)?.[1];
}

/** tarball が、期待するコミットのものでなければ、投げる */
export function assertTarballCommit(gz: Buffer, expected: string): void {
  const actual = readTarballCommit(gz);
  if (!actual) throw new Error('ソースの tarball から、コミットの ID を読めませんでした（GitHub の tarball ではない・壊れている可能性）。ビルドを中止します');
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`ソースの tarball のコミット（${actual.slice(0, 8)}）が、gcsim.config.json のコミット（${expected.slice(0, 8)}）と違います。ビルドを中止します`);
  }
}
