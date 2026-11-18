/**
 * 拡張機能の導入・更新の案内を出し分けるための、ブラウザの判定（navigator.userAgent）。
 *
 *   ・chromium    … Chrome・Edge など（Chrome の案内。パソコン版のみ）
 *   ・firefox     … Firefox（パソコン版。major は、UA に書かれた版の整数部）
 *   ・unsupported … 上のどちらでもない（Safari・スマートフォン・タブレット・不明）。拡張機能の対象外
 *
 * UA は、偽装・省略されることがある。ここでの判定は案内の出し分けだけに使い、取り込みの可否は、拡張機能の検知（ping）で決める。
 */
export type BrowserKind = 'chromium' | 'firefox' | 'unsupported';

export interface DetectedBrowser {
  kind: BrowserKind;
  /** Firefox のとき、UA の版（整数部）。読めないときは null */
  firefoxMajor: number | null;
}

/** Firefox の拡張機能（署名版）が要る、最低の版（extension/firefox-manifest-overrides.json の strict_min_version と同じ） */
export const FIREFOX_MIN_MAJOR = 140;

export function detectBrowser(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): DetectedBrowser {
  // スマートフォン・タブレットは対象外（Firefox for Android・iOS の各ブラウザを含む）
  if (/Android|iPhone|iPad|iPod|Mobile|FxiOS|CriOS/.test(ua)) return { kind: 'unsupported', firefoxMajor: null };
  const firefox = /\bFirefox\/(\d+)/.exec(ua);
  if (firefox) return { kind: 'firefox', firefoxMajor: Number(firefox[1]) };
  if (/\b(Chrome|Chromium|Edg|OPR)\/\d+/.test(ua)) return { kind: 'chromium', firefoxMajor: null };
  return { kind: 'unsupported', firefoxMajor: null };
}
