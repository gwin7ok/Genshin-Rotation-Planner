/**
 * 拡張機能の案内を出し分けるためのブラウザ判定（src/utils/hoyolab/browser.ts）の確認。
 *
 *   npm run check:browser-detect
 *
 * 代表的な User-Agent の文字列で、Chrome 系・Firefox・対象外に分かれること、導入の案内で「取り込みはできません」を出す理由
 * （対象外のブラウザ・古い Firefox・古い Chrome 系）が合うことを確かめる（ネットワークは使わない）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHROMIUM_MIN_MAJOR, detectBrowser, FIREFOX_MIN_MAJOR, installBlock, type InstallBlock } from '../src/utils/hoyolab/browser.ts';

const win = (chrome: number, extra = '') => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome}.0.0.0 Safari/537.36${extra}`;
const firefoxWin = (v: number) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`;

const CASES: Array<{ name: string; ua: string; kind: 'chromium' | 'firefox' | 'unsupported'; firefox?: number; chromium?: number; block: InstallBlock | null }> = [
  { name: 'Chrome（Windows。126）', ua: win(126), kind: 'chromium', chromium: 126, block: null },
  { name: 'Chrome（最低の版 102）', ua: win(102), kind: 'chromium', chromium: 102, block: null },
  { name: 'Chrome（101。古い）', ua: win(101), kind: 'chromium', chromium: 101, block: 'oldChromium' },
  { name: 'Edge（126）', ua: win(126, ' Edg/126.0.0.0'), kind: 'chromium', chromium: 126, block: null },
  { name: 'Edge（基盤が 100。古い）', ua: win(100, ' Edg/100.0.1185.50'), kind: 'chromium', chromium: 100, block: 'oldChromium' },
  { name: 'Opera', ua: win(126, ' OPR/112.0.0.0'), kind: 'chromium', chromium: 126, block: null },
  { name: 'Chrome（macOS）', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', kind: 'chromium', chromium: 126, block: null },
  { name: 'Chrome 系だが、版が読めない（Edg だけ）', ua: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Edg/126.0.0.0', kind: 'chromium', block: null },
  { name: 'Firefox（Windows。160）', ua: firefoxWin(160), kind: 'firefox', firefox: 160, block: null },
  { name: 'Firefox（最低の版 140）', ua: firefoxWin(140), kind: 'firefox', firefox: 140, block: null },
  { name: 'Firefox（139。古い）', ua: firefoxWin(139), kind: 'firefox', firefox: 139, block: 'oldFirefox' },
  { name: 'Firefox（Linux。128。古い）', ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0', kind: 'firefox', firefox: 128, block: 'oldFirefox' },
  { name: 'Safari（macOS）', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', kind: 'unsupported', block: 'other' },
  { name: 'Safari（iPhone）', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', kind: 'unsupported', block: 'other' },
  { name: 'Chrome（iPhone）', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1', kind: 'unsupported', block: 'other' },
  { name: 'Firefox（iPhone）', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15', kind: 'unsupported', block: 'other' },
  { name: 'Chrome（Android）', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', kind: 'unsupported', block: 'other' },
  { name: 'Firefox（Android）', ua: 'Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0', kind: 'unsupported', block: 'other' },
  { name: 'Samsung Internet', ua: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36', kind: 'unsupported', block: 'other' },
  { name: 'iPad（デスクトップ表示の Safari）', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', kind: 'unsupported', block: 'other' },
  { name: '空の UA', ua: '', kind: 'unsupported', block: 'other' },
];

let passed = 0;
for (const c of CASES) {
  const got = detectBrowser(c.ua);
  assert.equal(got.kind, c.kind, `${c.name}: ${got.kind}（期待: ${c.kind}）`);
  assert.equal(got.firefoxMajor, c.firefox ?? null, `${c.name}: Firefox の版`);
  assert.equal(got.chromiumMajor, c.chromium ?? null, `${c.name}: Chrome 系の版`);
  assert.equal(installBlock(got), c.block, `${c.name}: 取り込みはできません、の理由`);
  passed++;
  console.log(`✓ ${c.name} → ${got.kind}${got.firefoxMajor ?? got.chromiumMajor ?? ''}${c.block ? `（${c.block}）` : ''}`);
}

// Firefox の下限の版は、Firefox 用 manifest（strict_min_version）と同じでなければならない
const gecko = JSON.parse(readFileSync('extension/firefox-manifest-overrides.json', 'utf8')).browser_specific_settings.gecko;
assert.equal(Number.parseFloat(gecko.strict_min_version), FIREFOX_MIN_MAJOR, 'FIREFOX_MIN_MAJOR が、strict_min_version と違います');
passed++;
console.log(`✓ FIREFOX_MIN_MAJOR（${FIREFOX_MIN_MAJOR}）は、strict_min_version（${gecko.strict_min_version}）と同じ`);
assert.equal(CHROMIUM_MIN_MAJOR, 102);
passed++;
console.log(`✓ CHROMIUM_MIN_MAJOR は ${CHROMIUM_MIN_MAJOR}（chrome.storage.session の最低の版）`);

console.log(`\n${passed} 件、すべて OK`);
