/**
 * HoYoLAB 取り込みの Chrome 拡張機能（extension/hoyolab-importer）を zip にして、アプリに同梱する。
 *
 *   npm run ext:pack        → public/downloads/grp-hoyolab-importer.zip（Git には入れない。dev・build の前に自動で実行する）
 *
 * - zip の直下に manifest.json などを置く（利用者が「すべて展開」したとき、フォルダの中にフォルダができないように）。
 * - README.md は入れない（利用者向けの手順は、アプリの画面に出す）。
 * - 依存を増やさないよう、zip は Node 標準の zlib で作る（deflate）。時刻は固定（同じ内容なら同じ zip になる）。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SRC_DIR = path.resolve('extension/hoyolab-importer');
const OUT_FILE = path.resolve('public/downloads/grp-hoyolab-importer.zip');
const EXCLUDE = new Set(['README.md']);

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf: Buffer): number => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// 固定の更新日時（2020-01-01 00:00:00）。MS-DOS 形式
const DOS_TIME = 0;
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;

const files = fs.readdirSync(SRC_DIR, { withFileTypes: true })
  .filter(e => e.isFile() && !EXCLUDE.has(e.name))
  .map(e => e.name)
  .sort();
if (!files.includes('manifest.json')) throw new Error(`${SRC_DIR} に manifest.json がありません`);

const locals: Buffer[] = [];
const centrals: Buffer[] = [];
let offset = 0;
for (const name of files) {
  const data = fs.readFileSync(path.join(SRC_DIR, name));
  const comp = zlib.deflateRawSync(data, { level: 9 });
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = crc32(data);
  const flags = 0x0800; // ファイル名は UTF-8

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // 展開に必要な版
  local.writeUInt16LE(flags, 6);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  locals.push(local, nameBuf, comp);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // 作成した版
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(flags, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(0, 38); // 外部属性
  central.writeUInt32LE(offset, 42);
  centrals.push(central, nameBuf);

  offset += local.length + nameBuf.length + comp.length;
}
const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, Buffer.concat([...locals, ...centrals, end]));
const version = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'manifest.json'), 'utf8')).version;
console.log(`拡張機能 v${version} を ${path.relative(process.cwd(), OUT_FILE)} に作りました（${files.length} ファイル、${fs.statSync(OUT_FILE).size} バイト）`);
