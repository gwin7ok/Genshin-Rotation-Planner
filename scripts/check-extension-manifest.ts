/**
 * 拡張機能（extension/hoyolab-importer）の manifest を、Chrome 用・Firefox 用に作った結果と、
 * 署名済みの xpi の取得・更新用 JSON の作成（scripts/extension-updates.ts）の確認。
 *
 *   npm run check:extension-manifest
 *
 * ファイルの読み書きだけ（ネットワーク・ブラウザは使わない）。Firefox の実機での動作は、確認できない（F-0 で確認済みの内容を、守っているかを見る）。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildManifest, isLocalPattern, readBaseManifest, stripPort, type Manifest } from './extension-manifest.ts';
import { buildUpdatesJson, collectSignedXpis, compareVersions, LATEST_XPI_NAME, pickLatest, syncSignedExtension } from './extension-updates.ts';

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

// ---- 署名済みの xpi の取得・更新用 JSON（scripts/extension-updates.ts）----
const asset = (name: string) => ({ name, browser_download_url: `https://example.test/dl/${name}` });
const checkAsync = async (name: string, fn: () => Promise<void>) => {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
};
const XPI_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]);
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'grp-ext-'));
const gecko = (buildManifest(base, 'firefox').browser_specific_settings as { gecko: { id: string; update_url: string } }).gecko;
/** 偽の fetch: Release の一覧 → releases、xpi のダウンロード → body */
const fakeFetch = (releases: unknown, body: Buffer = XPI_BYTES, apiStatus = 200): typeof fetch =>
  (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('https://api.github.com/')) return new Response(JSON.stringify(releases), { status: apiStatus });
    return new Response(body, { status: 200 });
  }) as typeof fetch;
const syncWith = (fetchImpl: typeof fetch, outDir: string) =>
  syncSignedExtension({ fetchImpl, repo: 'owner/repo', outDir, id: gecko.id, updateUrl: gecko.update_url });

check('compareVersions: 数として比べる（0.10.0 は 0.9.0 より新しい）', () => {
  assert.ok(compareVersions('0.10.0', '0.9.0') > 0);
  assert.ok(compareVersions('0.2.5', '0.2.10') < 0);
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
});

check('collectSignedXpis・pickLatest: 署名済みの xpi だけを拾い、いちばん新しい版を選ぶ', () => {
  const found = collectSignedXpis([
    { assets: [asset('grp-hoyolab-importer-0.2.5.zip'), asset('grp-hoyolab-importer-0.2.5.xpi'), asset('grp-hoyolab-importer.xpi'), asset('grp-hoyolab-importer-0.3.0-beta.xpi')] },
    { assets: [asset('grp-hoyolab-importer-0.10.0.xpi'), asset('grp-hoyolab-importer-0.9.0.xpi')] },
    {},
  ]);
  assert.deepEqual([...found.keys()].sort(), ['0.10.0', '0.2.5', '0.9.0']);
  assert.deepEqual(pickLatest(found), { version: '0.10.0', url: 'https://example.test/dl/grp-hoyolab-importer-0.10.0.xpi' });
  assert.equal(pickLatest(new Map()), null);
});

check('buildUpdatesJson: Firefox の更新用 JSON の形（update_link は、update_url と同じ場所の xpi）', () => {
  assert.deepEqual(buildUpdatesJson('a@b.example', 'https://host.example/site/downloads/updates.json', '1.2.3'), {
    addons: { 'a@b.example': { updates: [{ version: '1.2.3', update_link: 'https://host.example/site/downloads/grp-hoyolab-importer-1.2.3.xpi' }] } },
  });
});

check('アプリの導入の案内の xpi のリンク先は、公開サイトに置く固定名と同じ（downloads/）', () => {
  const modal = fs.readFileSync('src/components/OwnedCharactersModal.tsx', 'utf8');
  assert.ok(modal.includes(`downloads/${LATEST_XPI_NAME}`), `OwnedCharactersModal.tsx が downloads/${LATEST_XPI_NAME} を指していません`);
  const updateUrl = new URL(gecko.update_url);
  assert.equal(updateUrl.protocol, 'https:');
  assert.ok(updateUrl.pathname.endsWith('/downloads/grp-hoyolab-importer-updates.json'), 'update_url が、downloads/ の下の更新用 JSON を指していません');
});

await checkAsync('syncSignedExtension: 最新の版の xpi（版つき・固定名）と更新用 JSON を書き出す', async () => {
  const dir = tmpDir();
  const releases = [{ assets: [asset('grp-hoyolab-importer-0.2.5.xpi'), asset('grp-hoyolab-importer-0.10.0.xpi'), asset('grp-hoyolab-importer-0.2.5.zip')] }];
  assert.deepEqual(await syncWith(fakeFetch(releases), dir), { version: '0.10.0', bytes: XPI_BYTES.length });
  assert.deepEqual(fs.readdirSync(dir).sort(), ['grp-hoyolab-importer-0.10.0.xpi', 'grp-hoyolab-importer-updates.json', 'grp-hoyolab-importer.xpi']);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'grp-hoyolab-importer.xpi')), XPI_BYTES);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'grp-hoyolab-importer-updates.json'), 'utf8')), buildUpdatesJson(gecko.id, gecko.update_url, '0.10.0'));
  fs.rmSync(dir, { recursive: true, force: true });
});

await checkAsync('syncSignedExtension: 署名済みの xpi が無ければ、何も書かない（null）', async () => {
  const dir = path.join(tmpDir(), 'none');
  assert.equal(await syncWith(fakeFetch([{ assets: [asset('grp-hoyolab-importer-0.2.5.zip')] }]), dir), null);
  assert.equal(fs.existsSync(dir), false);
});

await checkAsync('syncSignedExtension: zip でないファイル・Release の取得の失敗は、エラー（何も書かない）', async () => {
  const dir = path.join(tmpDir(), 'bad');
  const releases = [{ assets: [asset('grp-hoyolab-importer-0.2.5.xpi')] }];
  await assert.rejects(syncWith(fakeFetch(releases, Buffer.from('<html>error</html>')), dir), /zip/);
  await assert.rejects(syncWith(fakeFetch([], XPI_BYTES, 403), dir), /HTTP 403/);
  assert.equal(fs.existsSync(dir), false);
});

console.log(`\n${passed} 件、すべて OK`);
