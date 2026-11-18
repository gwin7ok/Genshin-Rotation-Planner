/**
 * 編成の URL 読込（?import=…）の取得部分の確認（src/utils/rotationUrlImport.ts の fetchImportText。D349）
 *
 *   npm run check:url-import
 *
 * 偽の fetch で、本文を少しずつ読んで上限（5 MB）で打ち切ること・通常の取得・HTTP エラーを確かめる（ネットワークは使わない）。
 * あわせて、リンクの検査（https のみ・認証情報つきや javascript: などは拒否）を確かめる。
 */
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { fetchImportText, IMPORT_MAX_BYTES } = await server.ssrLoadModule('/src/utils/rotationUrlImport.ts');

let failed = 0;
const check = (ok: boolean, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failed++; };

const realFetch = globalThis.fetch;

/** 本文を、指定の大きさのかたまりで流す偽の応答（Content-Length は付けない）。読んだバイト数を記録する */
function streamResponse(totalBytes: number, chunkBytes: number, state: { pulled: number; cancelled: boolean }): Response {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) { controller.close(); return; }
      const n = Math.min(chunkBytes, totalBytes - sent);
      controller.enqueue(new Uint8Array(n).fill(0x61));
      sent += n; state.pulled += n;
    },
    cancel() { state.cancelled = true; },
  });
  return new Response(body, { status: 200 });
}

try {
  // 1. 通常の取得（小さな JSON）
  globalThis.fetch = (async () => new Response('{"a":1}', { status: 200 })) as typeof fetch;
  const ok = await fetchImportText('https://example.com/rotation.json');
  check(ok.ok === true && ok.text === '{"a":1}' && ok.fileName === 'rotation.json', '通常の取得: 本文とファイル名が取れる');

  // 2. HTTP エラー
  globalThis.fetch = (async () => new Response('x', { status: 404 })) as typeof fetch;
  const http = await fetchImportText('https://example.com/x.json');
  check(http.ok === false && http.reason === 'http' && http.status === 404, 'HTTP エラー: http（404）');

  // 3. Content-Length が上限超過 → 本文を読まずに断る
  globalThis.fetch = (async () => new Response('x', { status: 200, headers: { 'content-length': String(IMPORT_MAX_BYTES + 1) } })) as typeof fetch;
  const declared = await fetchImportText('https://example.com/big.json');
  check(declared.ok === false && declared.reason === 'tooLarge', 'Content-Length が上限超過: tooLarge');

  // 4. Content-Length が無く、本文が上限を超える → 上限を少し超えたところで読むのをやめる
  const state = { pulled: 0, cancelled: false };
  globalThis.fetch = (async () => streamResponse(IMPORT_MAX_BYTES * 4, 256 * 1024, state)) as typeof fetch;
  const big = await fetchImportText('https://example.com/stream.json');
  check(big.ok === false && big.reason === 'tooLarge', 'Content-Length なしで上限超過: tooLarge');
  check(state.cancelled && state.pulled < IMPORT_MAX_BYTES * 2, `上限を超えたら読むのをやめる（読んだ量 ${(state.pulled / 1024 / 1024).toFixed(1)} MB < ${(IMPORT_MAX_BYTES * 2 / 1024 / 1024).toFixed(0)} MB）`);

  // 5. 上限ちょうどは通る
  const okState = { pulled: 0, cancelled: false };
  globalThis.fetch = (async () => streamResponse(IMPORT_MAX_BYTES, 512 * 1024, okState)) as typeof fetch;
  const edge = await fetchImportText('https://example.com/edge.json');
  check(edge.ok === true && edge.text.length === IMPORT_MAX_BYTES, '上限ちょうど: 取得できる');

  // 6. 通信失敗
  globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;
  const net = await fetchImportText('https://example.com/n.json');
  check(net.ok === false && net.reason === 'network', '通信失敗: network');

  // 7. リンクの検査（2026-11-18 のセキュリティ確認）。この確認は開発モードで動くので、localhost の http は通る（公開サイトでは、通らない。ビルドの結果で確認済み）
  const { checkImportUrl } = await server.ssrLoadModule('/src/utils/rotationUrlImport.ts');
  check(checkImportUrl('https://example.com/a.json').ok === true, 'リンクの検査: https は通る');
  const plainHttp = checkImportUrl('http://example.com/a.json');
  check(plainHttp.ok === false && plainHttp.reason === 'insecure', 'リンクの検査: 外部の http は、insecure');
  check(checkImportUrl('http://localhost:3000/a.json').ok === true && checkImportUrl('http://127.0.0.1:8765/a.json').ok === true, 'リンクの検査: 開発中は、localhost の http が通る');
  check(checkImportUrl('http://127.0.0.2:8765/a.json').ok === false && checkImportUrl('http://192.168.0.5/a.json').ok === false, 'リンクの検査: localhost 以外のローカルアドレスの http は、通らない');
  for (const bad of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///C:/a.json', 'ftp://example.com/a.json', 'https://user:pass@example.com/a.json', 'not a url']) {
    check(checkImportUrl(bad).ok === false, `リンクの検査: 受け付けない（${bad.slice(0, 40)}）`);
  }
  const gh = checkImportUrl('https://github.com/o/r/blob/main/a.json');
  check(gh.ok === true && gh.fetchUrl === 'https://raw.githubusercontent.com/o/r/main/a.json', 'リンクの検査: GitHub の画面のリンクは、raw に直す');
} finally {
  globalThis.fetch = realFetch;
  await server.close();
}
if (failed) { console.error(`\n${failed} 件失敗`); process.exit(1); }
console.log('\nすべて合格');
