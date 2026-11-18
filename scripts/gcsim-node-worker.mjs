/**
 * gcsim の WebAssembly 版（public/gcsim/main.wasm）を、Node の worker_threads で動かす（検査・調査のスクリプト用）。
 * 画面（ブラウザ）の public/gcsim/worker.js の、Node 版。呼び出し側は scripts/gcsim-node.ts。
 *
 * メッセージ: { id, t: 'sample' | 'validate', config, seed? } → { id, ok: true, out } | { id, ok: false, error }
 *   out は、gcsim の WASM が返す文字列（JSON か、平文のエラー文）。ブラウザの worker.js と同じ。
 * workerData: { module: コンパイル済みの WebAssembly.Module, wasmExecPath: wasm_exec.js の絶対パス }
 */
import { createRequire } from 'node:module';
import { parentPort, workerData } from 'node:worker_threads';

const require = createRequire(import.meta.url);
require(workerData.wasmExecPath); // globalThis.Go を定義する

let ready = null;

function init() {
  const go = new globalThis.Go();
  return WebAssembly.instantiate(workerData.module, go.importObject).then((instance) => {
    go.run(instance); // プログラムが終わるまで解決しない Promise を返す。待たない
    // go.run が公開する関数（sample / validateConfig）が、グローバルに現れるまで待つ
    return new Promise((resolve, reject) => {
      let tries = 0;
      (function wait() {
        if (typeof globalThis.sample === 'function' && typeof globalThis.validateConfig === 'function') return resolve();
        if (++tries > 400) return reject(new Error('gcsim の WASM が関数を公開しませんでした'));
        setTimeout(wait, 25);
      })();
    });
  });
}

parentPort.on('message', (m) => {
  if (!ready) ready = init();
  ready
    .then(() => {
      const out = m.t === 'sample' ? globalThis.sample(m.config, String(m.seed)) : globalThis.validateConfig(m.config);
      parentPort.postMessage({ id: m.id, ok: true, out });
    })
    .catch((err) => {
      ready = null; // 初期化に失敗したときは、次の要求でやり直す
      parentPort.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
    });
});
