// アプリのページと拡張機能の橋渡し。
// アプリ → { source:'grp-app', type:'ping' | 'hoyolab-fetch', uid, requestId }
// 拡張 → { source:'grp-ext', type:'pong' | 'hoyolab-result', ..., requestId }
window.addEventListener('message', (ev) => {
  if (ev.source !== window || ev.data?.source !== 'grp-app') return;
  const { type, requestId } = ev.data;
  if (type === 'ping') {
    window.postMessage({ source: 'grp-ext', type: 'pong', version: chrome.runtime.getManifest().version, requestId }, '*');
  } else if (type === 'hoyolab-fetch') {
    chrome.runtime.sendMessage({ type: 'hoyolab-fetch', uid: ev.data.uid }, (res) => {
      const err = chrome.runtime.lastError;
      window.postMessage(
        { source: 'grp-ext', type: 'hoyolab-result', requestId, ...(err ? { ok: false, error: err.message } : res) },
        '*',
      );
    });
  }
});
