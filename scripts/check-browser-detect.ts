/**
 * 拡張機能の案内を出し分けるためのブラウザ判定（src/utils/hoyolab/browser.ts）の確認。
 *
 *   npm run check:browser-detect
 *
 * 代表的な User-Agent の文字列で、Chrome 系・Firefox・対象外に分かれることを確かめる（ネットワークは使わない）。
 */
import assert from 'node:assert/strict';
import { detectBrowser, FIREFOX_MIN_MAJOR } from '../src/utils/hoyolab/browser.ts';
import { readFileSync } from 'node:fs';

const CASES: Array<{ name: string; ua: string; kind: 'chromium' | 'firefox' | 'unsupported'; major?: number }> = [
  { name: 'Chrome（Windows）', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', kind: 'chromium' },
  { name: 'Edge（Windows）', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0', kind: 'chromium' },
  { name: 'Opera', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/112.0.0.0', kind: 'chromium' },
  { name: 'Chrome（macOS）', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', kind: 'chromium' },
  { name: 'Firefox（Windows。160）', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:160.0) Gecko/20100101 Firefox/160.0', kind: 'firefox', major: 160 },
  { name: 'Firefox（Linux。128）', ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0', kind: 'firefox', major: 128 },
  { name: 'Safari（macOS）', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', kind: 'unsupported' },
  { name: 'Safari（iPhone）', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', kind: 'unsupported' },
  { name: 'Chrome（iPhone）', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1', kind: 'unsupported' },
  { name: 'Firefox（iPhone）', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15', kind: 'unsupported' },
  { name: 'Chrome（Android）', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', kind: 'unsupported' },
  { name: 'Firefox（Android）', ua: 'Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0', kind: 'unsupported' },
  { name: 'Samsung Internet', ua: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36', kind: 'unsupported' },
  { name: 'iPad（デスクトップ表示の Safari）', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', kind: 'unsupported' },
  { name: '空の UA', ua: '', kind: 'unsupported' },
];

let passed = 0;
for (const c of CASES) {
  const got = detectBrowser(c.ua);
  assert.equal(got.kind, c.kind, `${c.name}: ${got.kind}（期待: ${c.kind}）`);
  assert.equal(got.firefoxMajor, c.major ?? null, `${c.name}: Firefox の版`);
  passed++;
  console.log(`✓ ${c.name} → ${got.kind}${got.firefoxMajor === null ? '' : ` ${got.firefoxMajor}`}`);
}

// Firefox の下限の版は、Firefox 用 manifest（strict_min_version）と同じでなければならない
const gecko = JSON.parse(readFileSync('extension/firefox-manifest-overrides.json', 'utf8')).browser_specific_settings.gecko;
assert.equal(Number.parseFloat(gecko.strict_min_version), FIREFOX_MIN_MAJOR, 'FIREFOX_MIN_MAJOR が、strict_min_version と違います');
passed++;
console.log(`✓ FIREFOX_MIN_MAJOR（${FIREFOX_MIN_MAJOR}）は、strict_min_version（${gecko.strict_min_version}）と同じ`);

console.log(`\n${passed} 件、すべて OK`);
