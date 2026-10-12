/**
 * gcsim の WebAssembly 版を動かす Web Worker（classic worker。`public/gcsim/` から、そのまま配信する）。
 *
 * 同じフォルダの `wasm_exec.js`・`main.wasm` は、`npm run wasm:build` が gcsim のソース（gcsim.config.json のコミット）から生成する
 * （Git 管理外。AGPL-3.0。ソースの入手先は画面の下部と NOTICE を参照）。
 *
 * メッセージ: { id, t: 'sample' | 'validate', config, seed? } → { id, ok: true, out } | { id, ok: false, error }
 *   out は、gcsim の WASM が返す JSON 文字列（sample = 詳細ログ、validate = 解析結果。失敗は {"error": "..."}）
 */
importScripts('wasm_exec.js');

let ready = null;

function init() {
  const go = new Go();
  const url = new URL('main.wasm', self.location.href);
  // ストリーミングは、配信側の Content-Type が application/wasm でないと失敗する。その場合は、全体を読んで組み立てる（配信設定に依存しない）
  const load = WebAssembly.instantiateStreaming(fetch(url), go.importObject).catch(function () {
    return fetch(url).then(function (res) { return res.arrayBuffer(); }).then(function (buf) { return WebAssembly.instantiate(buf, go.importObject); });
  });
  return load.then(function (r) {
    go.run(r.instance);
    // go.run が公開する関数（sample / validateConfig）が、グローバルに現れるまで待つ
    return new Promise(function (resolve, reject) {
      let tries = 0;
      (function wait() {
        if (typeof self.sample === 'function' && typeof self.validateConfig === 'function') return resolve();
        if (++tries > 200) return reject(new Error('gcsim の WASM が関数を公開しませんでした'));
        setTimeout(wait, 25);
      })();
    });
  });
}

self.onmessage = function (e) {
  const m = e.data;
  if (!ready) ready = init();
  ready
    .then(function () {
      const out = m.t === 'sample' ? self.sample(m.config, String(m.seed)) : self.validateConfig(m.config);
      self.postMessage({ id: m.id, ok: true, out: out });
    })
    .catch(function (err) {
      // 初期化に失敗したときは、次の要求でやり直す
      ready = null;
      self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
    });
};
