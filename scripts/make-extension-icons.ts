/**
 * 拡張機能（extension/hoyolab-importer）のアイコンを作る。アプリのヘッダー左上のロゴ
 * （黄色のグラデーションの角丸の四角に、黒い四角い星 ✦）と同じ絵を、PNG（16・32・48・128 px）にする。
 *
 *   node scripts/make-extension-icons.ts   → extension/hoyolab-importer/icons/icon-<サイズ>.png
 *
 * 絵を変えたいときだけ実行する（生成した PNG は、Git に入れる）。依存を増やさないよう、PNG は Node 標準の zlib で書く。
 * ロゴの値は、src/components/Header.tsx の「Logo & Title」と合わせる:
 *   角丸 12/32、グラデーション（右上へ）amber-500 #f59e0b → yellow-400 #facc15 → amber-200 #fde68a、星 slate-950 #020617
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_DIR = path.resolve('extension/hoyolab-importer/icons');
const SIZES = [16, 32, 48, 128];
const SS = 8; // 1 ピクセルあたり SS×SS のサンプル（縁をなめらかにする）

const hex = (s: string): [number, number, number] => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const STOPS = [hex('#f59e0b'), hex('#facc15'), hex('#fde68a')];
const STAR_COLOR = hex('#020617');
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const gradient = (t: number) => (t < 0.5 ? mix(STOPS[0], STOPS[1], t / 0.5) : mix(STOPS[1], STOPS[2], (t - 0.5) / 0.5));

/** 四角い星 ✦（0〜1 の座標。中心 0.5）。外側の頂点 4 つと、その間のくぼみの頂点 4 つ */
const STAR = (() => {
  const outer = 0.3, inner = 0.075;
  const pts: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    pts.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]);
  }
  return pts;
})();
const inPolygon = (x: number, y: number, poly: [number, number][]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inRoundedSquare = (x: number, y: number, radius: number) => {
  const cx = Math.min(Math.max(x, radius), 1 - radius);
  const cy = Math.min(Math.max(y, radius), 1 - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
};

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const render = (size: number): Buffer => {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // フィルターなし
    for (let px = 0; px < size; px++) {
      let cover = 0, starCover = 0, r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size, y = (py + (sy + 0.5) / SS) / size;
          if (!inRoundedSquare(x, y, 0.375)) continue;
          cover++;
          const star = inPolygon(x, y, STAR);
          if (star) starCover++;
          const c = star ? STAR_COLOR : gradient((x + (1 - y)) / 2);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      if (cover > 0) { raw[o] = Math.round(r / cover); raw[o + 1] = Math.round(g / cover); raw[o + 2] = Math.round(b / cover); }
      raw[o + 3] = Math.round((cover / (SS * SS)) * 255);
      void starCover;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 ビット・RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(file, render(size));
  console.log(`${path.relative(process.cwd(), file)}`);
}
