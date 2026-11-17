// アプリのページと拡張機能の橋渡し。
// アプリ → { source:'grp-app', type:'ping' | 'hoyolab-fetch' | 'enka-fetch', uid, requestId }
// 拡張 → { source:'grp-ext', type:'pong' | 'hoyolab-result' | 'enka-result', ..., requestId }
const reply = (type, requestId, body) => window.postMessage({ source: 'grp-ext', type, requestId, ...body }, '*');

const relay = (message, replyType, requestId) => {
  chrome.runtime.sendMessage(message, (res) => {
    const err = chrome.runtime.lastError;
    reply(replyType, requestId, err ? { ok: false, error: err.message } : res);
  });
};

const onMessage = (ev) => {
  if (ev.source !== window || ev.data?.source !== 'grp-app') return;
  // 拡張機能を再読み込み・更新したあと、開いたままのページに残る古い content script は、拡張機能と通信できない
  // （"Extension context invalidated"）。何もせず、自分を外す。ページを再読み込みすると、新しい content script が入る
  if (!chrome.runtime?.id) { window.removeEventListener('message', onMessage); return; }
  const { type, requestId } = ev.data;
  if (type === 'ping') reply('pong', requestId, { version: chrome.runtime.getManifest().version });
  else if (type === 'enka-fetch') relay({ type: 'enka-fetch', uid: ev.data.uid }, 'enka-result', requestId);
  else if (type === 'hoyolab-fetch') relay({ type: 'hoyolab-fetch', uid: ev.data.uid }, 'hoyolab-result', requestId);
};
window.addEventListener('message', onMessage);
