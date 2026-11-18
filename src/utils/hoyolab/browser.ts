/**
 * 拡張機能の導入・更新の案内を出し分けるための、ブラウザの判定（navigator.userAgent）。
 *
 *   ・chromium    … Chrome・Edge など（Chrome の案内。パソコン版のみ。chromiumMajor は、UA の Chrome/<版> の整数部）
 *   ・firefox     … Firefox（パソコン版。firefoxMajor は、UA に書かれた版の整数部）
 *   ・unsupported … 上のどちらでもない（Safari・スマートフォン・タブレット・不明）。拡張機能の対象外
 *
 * UA は、偽装・省略されることがある。ここでの判定は案内の出し分けだけに使い、取り込みの可否は、拡張機能の検知（ping）で決める。
 * 拡張機能が入っている（検知できた）ときは、UA が対象外・古くても、そのまま使えるようにする（installBlock は、導入の案内にだけ使う）。
 */
export type BrowserKind = 'chromium' | 'firefox' | 'unsupported';

export interface DetectedBrowser {
  kind: BrowserKind;
  /** Firefox のとき、UA の版（整数部）。読めないときは null */
  firefoxMajor: number | null;
  /** Chrome 系のとき、UA の Chrome/<版>（整数部）。Edge・Opera も、基盤の Chromium の版が入る。読めないときは null */
  chromiumMajor: number | null;
}

/** Firefox の拡張機能（署名版）が要る、最低の版（extension/firefox-manifest-overrides.json の strict_min_version と同じ） */
export const FIREFOX_MIN_MAJOR = 140;
/**
 * Chrome 系で、拡張機能が使える最低の版。拡張機能は、chrome.storage.session（Chrome 102 以降。Chrome の公式文書に明記）・
 * declarativeNetRequest のセッションルール（90 以降。tabIds は 92 以降）・Manifest V3（88 以降）を使う。そのうち、いちばん新しい 102。
 * （declarativeNetRequestWithHostAccess・modifyHeaders の版は、文書の該当ページに書かれていないが、102 より前に入った機能）
 */
export const CHROMIUM_MIN_MAJOR = 102;

export function detectBrowser(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): DetectedBrowser {
  // スマートフォン・タブレットは対象外（Firefox for Android・iOS の各ブラウザを含む）
  if (/Android|iPhone|iPad|iPod|Mobile|FxiOS|CriOS/.test(ua)) return { kind: 'unsupported', firefoxMajor: null, chromiumMajor: null };
  const firefox = /\bFirefox\/(\d+)/.exec(ua);
  if (firefox) return { kind: 'firefox', firefoxMajor: Number(firefox[1]), chromiumMajor: null };
  if (/\b(Chrome|Chromium|Edg|OPR)\/\d+/.test(ua)) {
    const chrome = /\b(?:Chrome|Chromium)\/(\d+)/.exec(ua);
    return { kind: 'chromium', firefoxMajor: null, chromiumMajor: chrome ? Number(chrome[1]) : null };
  }
  return { kind: 'unsupported', firefoxMajor: null, chromiumMajor: null };
}

/** 拡張機能を入れられないブラウザの理由（other = 対象外のブラウザ・oldFirefox / oldChromium = 版が古い） */
export type InstallBlock = 'other' | 'oldFirefox' | 'oldChromium';

/** 導入の案内で、手順のかわりに「取り込みはできません」を出す理由。入れられる（または、判定できない）ときは null */
export function installBlock(browser: DetectedBrowser): InstallBlock | null {
  if (browser.kind === 'unsupported') return 'other';
  if (browser.kind === 'firefox' && browser.firefoxMajor !== null && browser.firefoxMajor < FIREFOX_MIN_MAJOR) return 'oldFirefox';
  if (browser.kind === 'chromium' && browser.chromiumMajor !== null && browser.chromiumMajor < CHROMIUM_MIN_MAJOR) return 'oldChromium';
  return null;
}
