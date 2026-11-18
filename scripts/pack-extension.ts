/**
 * HoYoLAB 取り込みの拡張機能（extension/hoyolab-importer）を、Chrome 用・Firefox 用に作る。
 *
 *   npm run ext:pack        （dev・build の前に自動で実行する。出力は、どれも Git に入れない）
 *
 *   ・Chrome 用の zip      → public/downloads/grp-hoyolab-importer.zip（アプリに同梱。利用者が展開して読み込む）
 *   ・Firefox 用（配る版）  → build/extension/firefox/（署名の入力。署名は AMO。署名前の zip は、Firefox の正式版には入れられないので、公開しない）
 *   ・Firefox 用（開発用）  → build/extension/firefox-dev/（about:debugging で、一時的に読み込む。localhost に入る）
 *
 * - Firefox 用の manifest は、manifest.json に extension/firefox-manifest-overrides.json を重ねて作る（scripts/extension-manifest.ts）。
 *   manifest.json 以外のファイルは、Chrome 用と同じ。
 * - zip の直下に manifest.json などを置く（利用者が「すべて展開」したとき、フォルダの中にフォルダができないように）。
 * - README.md は入れない（利用者向けの手順は、アプリの画面に出す）。
 * - 依存を増やさないよう、zip は Node 標準の zlib で作る（deflate）。時刻は固定（同じ内容なら同じ zip になる）。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildManifest, EXTENSION_SRC_DIR, readBaseManifest } from './extension-manifest.ts';

const SRC_DIR = EXTENSION_SRC_DIR;
const CHROME_ZIP = path.resolve('public/downloads/grp-hoyolab-importer.zip');
const BUILD_ROOT = path.resolve('build/extension');
const FIREFOX_DIR = path.join(BUILD_ROOT, 'firefox');
const FIREFOX_DEV_DIR = path.join(BUILD_ROOT, 'firefox-dev');
const EXCLUDE = new Set(['README.md']);

interface Entry { name: string; data: Buffer }

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

/** SRC_DIR の下のファイルを、zip の中のパス（/ 区切り）で並べる（icons/ などの下のフォルダも含む） */
const listFiles = (dir: string, prefix = ''): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? listFiles(path.join(dir, e.name), `${prefix}${e.name}/`)
      : e.isFile() && !EXCLUDE.has(e.name) ? [`${prefix}${e.name}`] : []);

const makeZip = (entries: Entry[]): Buffer => {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
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
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
};

/** フォルダを作り直して、ファイルを書き出す（書き出し先は、build/extension の下だけ） */
const writeDir = (dir: string, entries: Entry[]) => {
  if (!dir.startsWith(BUILD_ROOT + path.sep)) throw new Error(`書き出し先が想定外です: ${dir}`);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const { name, data } of entries) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
  }
};

const chromeEntries: Entry[] = listFiles(SRC_DIR).sort().map(name => ({ name, data: fs.readFileSync(path.join(SRC_DIR, name)) }));
if (!chromeEntries.some(e => e.name === 'manifest.json')) throw new Error(`${SRC_DIR} に manifest.json がありません`);

/** Chrome 用のファイルのうち、manifest.json だけを Firefox 用に差し替える */
const base = readBaseManifest();
const firefoxEntries = (dev: boolean): Entry[] => {
  const manifest = Buffer.from(`${JSON.stringify(buildManifest(base, 'firefox', { dev }), null, 2)}\n`);
  return chromeEntries.map(e => (e.name === 'manifest.json' ? { name: e.name, data: manifest } : e));
};

fs.mkdirSync(path.dirname(CHROME_ZIP), { recursive: true });
fs.writeFileSync(CHROME_ZIP, makeZip(chromeEntries));
writeDir(FIREFOX_DIR, firefoxEntries(false));
writeDir(FIREFOX_DEV_DIR, firefoxEntries(true));

const rel = (p: string) => path.relative(process.cwd(), p);
console.log(`拡張機能 v${base.version} を作りました（${chromeEntries.length} ファイル）`);
console.log(`  Chrome 用の zip      : ${rel(CHROME_ZIP)}（${fs.statSync(CHROME_ZIP).size} バイト）`);
console.log(`  Firefox 用（配る版）  : ${rel(FIREFOX_DIR)}${path.sep}`);
console.log(`  Firefox 用（開発用）  : ${rel(FIREFOX_DEV_DIR)}${path.sep}`);
