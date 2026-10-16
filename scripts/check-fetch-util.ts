/**
 * マスターデータ生成の通信（src/masterdata/fetchUtil.ts）の確認。
 *
 *   npm run check:fetch-util
 *
 * 偽の fetch で、再試行・タイムアウト・GitHub トークンの扱いを確かめる（ネットワークは使わない）。
 */
import assert from 'node:assert/strict';
import { assertGitTreeComplete, fetchJson, fetchText, fetchWithRetry } from '../src/masterdata/fetchUtil.ts';

const realFetch = globalThis.fetch;
const calls: Array<{ url: string; headers: Record<string, string>; hasSignal: boolean }> = [];

/** 偽の fetch を差し替える。handler が、呼び出しの番号（0 始まり）ごとに、応答を返す・投げる */
function mockFetch(handler: (n: number, init: RequestInit) => Promise<Response> | Response) {
  calls.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const n = calls.length;
    calls.push({ url: String(input), headers: { ...(init.headers as Record<string, string> | undefined) }, hasSignal: !!init.signal });
    return handler(n, init);
  }) as typeof fetch;
}
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number) => new Response('x', { status: code, statusText: `S${code}` });

let passed = 0;
const check = async (name: string, fn: () => Promise<void>) => {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
};

const savedToken = { GITHUB_TOKEN: process.env.GITHUB_TOKEN, GH_TOKEN: process.env.GH_TOKEN };
delete process.env.GITHUB_TOKEN;
delete process.env.GH_TOKEN;

try {
  await check('成功: 1 回で返る。タイムアウトの signal を付ける', async () => {
    mockFetch(() => ok({ a: 1 }));
    assert.deepEqual(await fetchJson('https://example.com/x'), { a: 1 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].hasSignal, true);
  });

  await check('再試行: サーバーのエラー（500）は、間隔を空けて再試行し、成功すれば返す', async () => {
    mockFetch(n => (n === 0 ? status(500) : ok({ b: 2 })));
    assert.deepEqual(await fetchJson('https://example.com/x'), { b: 2 });
    assert.equal(calls.length, 2);
  });

  await check('再試行: 通信の失敗（ネットワークエラー）も、再試行する', async () => {
    mockFetch(n => {
      if (n === 0) throw new TypeError('fetch failed');
      return ok({ c: 3 });
    });
    assert.deepEqual(await fetchJson('https://example.com/x'), { c: 3 });
    assert.equal(calls.length, 2);
  });

  await check('再試行しない: 403（回数制限）・404（存在しない）は、1 回で失敗する', async () => {
    for (const code of [403, 404]) {
      mockFetch(() => status(code));
      await assert.rejects(() => fetchJson('https://example.com/x'), new RegExp(`HTTP ${code}`));
      assert.equal(calls.length, 1, `${code} は再試行しない`);
    }
  });

  await check('再試行の回数: 失敗が続くと、retries + 1 回で諦めて、最後のエラーを投げる', async () => {
    mockFetch(() => status(502));
    await assert.rejects(() => fetchWithRetry('https://example.com/x', undefined, 1), /HTTP 502/);
    assert.equal(calls.length, 2);
  });

  await check('タイムアウト: 応答が来ないときは、打ち切って、「タイムアウト」のエラーにする（いつまでも待たない）', async () => {
    mockFetch((_n, init) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    }));
    const t0 = Date.now();
    // AbortSignal.timeout のタイマーは、Node のプロセスを生かさない（本物の通信は、接続が生かす）。偽の fetch の間だけ、生かしておく
    const keepAlive = setInterval(() => {}, 1000);
    try {
      await assert.rejects(() => fetchWithRetry('https://example.com/slow', undefined, 0, 80), /タイムアウト/);
    } finally {
      clearInterval(keepAlive);
    }
    assert.ok(Date.now() - t0 < 3000, `待ちすぎ: ${Date.now() - t0}ms`);
  });

  await check('呼び出し元が中断したとき（signal）は、再試行しない', async () => {
    const ac = new AbortController();
    mockFetch((_n, init) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      ac.abort();
    }));
    await assert.rejects(() => fetchWithRetry('https://example.com/x', { signal: ac.signal }, 2, 5000));
    assert.equal(calls.length, 1);
  });

  await check('トークン: GitHub API（api.github.com）にだけ付ける。ほかのサーバーには付けない', async () => {
    process.env.GITHUB_TOKEN = 'ghp_TESTTOKEN_VALUE';
    try {
      mockFetch(() => ok({}));
      await fetchJson('https://api.github.com/repos/o/r/commits/main', { headers: { Accept: 'application/vnd.github+json' } });
      await fetchJson('https://raw.githubusercontent.com/o/r/sha/file.json');
      await fetchJson('https://genshin-db-api.vercel.app/api/v5/weapons');
      await fetchJson('https://api.github.com.evil.example/x');
      assert.equal(calls[0].headers.Authorization, 'Bearer ghp_TESTTOKEN_VALUE');
      assert.equal(calls[0].headers.Accept, 'application/vnd.github+json', '呼び出し元のヘッダーは残す');
      for (const c of calls.slice(1)) assert.equal(c.headers.Authorization, undefined, `${c.url} に付けてはいけない`);
    } finally {
      delete process.env.GITHUB_TOKEN;
    }
  });

  await check('トークン: GITHUB_TOKEN が無ければ GH_TOKEN を使う。どちらも無ければ付けない', async () => {
    process.env.GH_TOKEN = 'gh_ALT';
    try {
      mockFetch(() => ok({}));
      await fetchJson('https://api.github.com/x');
      assert.equal(calls[0].headers.Authorization, 'Bearer gh_ALT');
    } finally {
      delete process.env.GH_TOKEN;
    }
    mockFetch(() => ok({}));
    await fetchJson('https://api.github.com/x');
    assert.equal(calls[0].headers.Authorization, undefined);
  });

  await check('トークン: エラー文に、トークンの値を出さない', async () => {
    process.env.GITHUB_TOKEN = 'ghp_SECRET_SHOULD_NOT_LEAK';
    try {
      mockFetch(() => status(404));
      await assert.rejects(
        () => fetchJson('https://api.github.com/repos/o/r'),
        (e: Error) => !e.message.includes('ghp_SECRET') && /HTTP 404/.test(e.message),
      );
    } finally {
      delete process.env.GITHUB_TOKEN;
    }
  });

  await check('ツリー API: 切り詰められた応答は、中止する（黙って欠けさせない）。完全な応答は通す', async () => {
    assert.doesNotThrow(() => assertGitTreeComplete({ truncated: false, tree: [1, 2] }, 'x'));
    assert.doesNotThrow(() => assertGitTreeComplete({ tree: [] }, 'x'), 'truncated が無い応答は、完全として扱う');
    assert.throws(() => assertGitTreeComplete({ truncated: true, tree: new Array(3).fill(0) }, 'gcsim のファイル'), /gcsim のファイルの一覧が.*切り詰められ.*3 件.*中止/);
  });

  await check('fetchText: 本文の文字列を返す', async () => {
    mockFetch(() => new Response('package x', { status: 200 }));
    assert.equal(await fetchText('https://example.com/a.go'), 'package x');
  });
} finally {
  globalThis.fetch = realFetch;
  if (savedToken.GITHUB_TOKEN !== undefined) process.env.GITHUB_TOKEN = savedToken.GITHUB_TOKEN;
  if (savedToken.GH_TOKEN !== undefined) process.env.GH_TOKEN = savedToken.GH_TOKEN;
}

console.log(`\n✓ 通信の確認: ${passed} 項目すべて合格`);
process.exit(0);
