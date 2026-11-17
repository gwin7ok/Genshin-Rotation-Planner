/** アプリに同梱している拡張機能の版（ビルド時に、extension/hoyolab-importer/manifest.json の version を埋め込む） */
declare const __EXTENSION_VERSION__: string | undefined;
export const BUNDLED_EXTENSION_VERSION: string = typeof __EXTENSION_VERSION__ !== 'undefined' && __EXTENSION_VERSION__ ? __EXTENSION_VERSION__ : '0.0.0';

/** 版の比較（"0.1.2" のようなドット区切りの数）。a が b より古ければ true。読めない版は、古いとは判定しない */
export function isOlderVersion(a: string, b: string): boolean {
  const parse = (v: string) => v.split('.').map(n => (/^\d+$/.test(n) ? Number(n) : NaN));
  const pa = parse(a), pb = parse(b);
  if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return false;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
