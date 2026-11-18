/**
 * 拡張機能（extension/hoyolab-importer）の manifest を、Chrome 用・Firefox 用に作った結果の確認。
 *
 *   npm run check:extension-manifest
 *
 * ファイルの読み書きだけ（ネットワーク・ブラウザは使わない）。Firefox の実機での動作は、確認できない（F-0 で確認済みの内容を、守っているかを見る）。
 */
import assert from 'node:assert/strict';
import { buildManifest, isLocalPattern, readBaseManifest, stripPort, type Manifest } from './extension-manifest.ts';

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

const base = readBaseManifest();
const matchesOf = (m: Manifest) => (m.content_scripts ?? []).flatMap(cs => cs.matches);
const hasPort = (pattern: string) => /^(\*|https?):\/\/[^/]+:\d+\//.test(pattern);
const APP_URL = 'https://gwin7ok.github.io/Genshin-Rotation-Planner/*';

check('stripPort: ポートだけを外す', () => {
  assert.equal(stripPort('http://localhost:3000/*'), 'http://localhost/*');
  assert.equal(stripPort('https://gwin7ok.github.io/Genshin-Rotation-Planner/*'), 'https://gwin7ok.github.io/Genshin-Rotation-Planner/*');
  assert.equal(stripPort('*://example.com:8080/a/*'), '*://example.com/a/*');
  assert.equal(stripPort('https://enka.network/*'), 'https://enka.network/*');
});

check('isLocalPattern: localhost・127.0.0.1 だけ（ポートの有無は問わない）', () => {
  assert.ok(isLocalPattern('http://localhost:3000/*'));
  assert.ok(isLocalPattern('http://localhost/*'));
  assert.ok(isLocalPattern('http://127.0.0.1:3000/*'));
  assert.ok(!isLocalPattern(APP_URL));
  assert.ok(!isLocalPattern('https://localhost.example.com/*'));
});

check('元の manifest（Chrome 用）: Firefox 専用の項目が無く、localhost:3000 に入る（これまでどおり）', () => {
  assert.equal(base.manifest_version, 3);
  assert.equal(base.browser_specific_settings, undefined);
  assert.deepEqual(base.background, { service_worker: 'background.js', type: 'module' });
  assert.ok(matchesOf(base).includes('http://localhost:3000/*'));
  assert.ok(matchesOf(base).includes(APP_URL));
});

check('Chrome 用: 元の manifest と同じ（変えない）', () => {
  assert.deepEqual(buildManifest(base, 'chrome'), base);
  assert.deepEqual(buildManifest(base, 'chrome', { dev: true }), base);
});

for (const dev of [false, true]) {
  const label = dev ? 'Firefox 用（開発用）' : 'Firefox 用（配る版）';
  const ff = buildManifest(base, 'firefox', { dev });
  const gecko = (ff.browser_specific_settings as { gecko: Record<string, unknown> } | undefined)?.gecko;

  check(`${label}: 版・権限・アイコンは、元の manifest と同じ`, () => {
    assert.equal(ff.manifest_version, 3);
    assert.equal(ff.version, base.version);
    assert.equal(ff.name, base.name);
    assert.deepEqual(ff.permissions, base.permissions);
    assert.deepEqual(ff.action, base.action);
    assert.deepEqual(ff.icons, base.icons);
  });

  check(`${label}: gecko の ID・下限の版・更新用の URL・データ収集の申告`, () => {
    assert.ok(gecko, 'browser_specific_settings.gecko がありません');
    assert.equal(gecko.id, 'grp-hoyolab-importer@gwin7ok.github.io');
    assert.ok(Number.parseFloat(String(gecko.strict_min_version)) >= 140, 'strict_min_version は 140 以上（データ収集の同意が使える版）');
    assert.match(String(gecko.update_url), /^https:\/\/gwin7ok\.github\.io\/Genshin-Rotation-Planner\/.+\.json$/);
    assert.deepEqual(gecko.data_collection_permissions, { required: ['personallyIdentifyingInfo'] });
  });

  check(`${label}: background は、scripts と service_worker の併記（Firefox は scripts、Chrome は service_worker を使う）`, () => {
    assert.deepEqual(ff.background, { scripts: ['background.js'], service_worker: 'background.js', type: 'module' });
  });

  check(`${label}: 一致パターンにポートが無い（Firefox は、ポート付きだと、どのページにも一致しない）`, () => {
    const all = [...matchesOf(ff), ...(ff.host_permissions ?? [])];
    assert.deepEqual(all.filter(hasPort), []);
  });

  check(`${label}: ${dev ? 'localhost（ポート無し）に入る' : '利用者に配る版には、localhost を入れない'}`, () => {
    const all = [...matchesOf(ff), ...(ff.host_permissions ?? [])];
    if (dev) {
      assert.ok(matchesOf(ff).includes('http://localhost/*'));
      assert.ok((ff.host_permissions ?? []).includes('http://localhost/*'));
    } else {
      assert.deepEqual(all.filter(isLocalPattern), []);
    }
    assert.ok(matchesOf(ff).includes(APP_URL), '公開サイトに入らなくなっています');
  });

  check(`${label}: host_permissions に、元の通信先（HoYoLAB・Enka.Network）と、content_scripts の一致パターンがある`, () => {
    for (const host of base.host_permissions ?? []) assert.ok(ff.host_permissions?.includes(host), `${host} がありません`);
    for (const pattern of matchesOf(ff)) assert.ok(ff.host_permissions?.includes(pattern), `${pattern} が host_permissions にありません`);
    assert.equal(new Set(ff.host_permissions).size, ff.host_permissions?.length, 'host_permissions に重複があります');
  });

  check(`${label}: content_scripts の中身（js・run_at）は、元のまま`, () => {
    assert.equal(ff.content_scripts?.length, base.content_scripts?.length);
    for (const [i, cs] of (ff.content_scripts ?? []).entries()) {
      assert.deepEqual({ ...cs, matches: 0 }, { ...base.content_scripts?.[i], matches: 0 });
    }
  });
}

check('元の manifest を書き換えていない（Firefox 用を作ったあとも、Chrome 用が変わらない）', () => {
  assert.equal(base.browser_specific_settings, undefined);
  assert.ok(matchesOf(base).includes('http://localhost:3000/*'));
  assert.deepEqual(base.background, { service_worker: 'background.js', type: 'module' });
});

console.log(`\n${passed} 件、すべて OK`);
