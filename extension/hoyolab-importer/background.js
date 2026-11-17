import { fetchCharacters } from './hoyolab.js';
import { fetchEnka } from './enka.js';

// Enka.Network の API ルール（独自の User-Agent を付ける）に従うため、この拡張機能自身の通信（タブからではない通信）にだけ、User-Agent を付ける。
// タブの条件（tabIds）は、実行時に登録するルール（セッションルール）でしか使えない。サービスワーカーが起動するたびに登録し直す。
const version = chrome.runtime.getManifest().version;
chrome.declarativeNetRequest.updateSessionRules({
  removeRuleIds: [1],
  addRules: [{
    id: 1,
    priority: 1,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'User-Agent', operation: 'set', value: `Genshin-Rotation-Planner-Extension/${version} (+https://github.com/gwin7ok/Genshin-Rotation-Planner)` }] },
    condition: { urlFilter: '||enka.network/api/', resourceTypes: ['xmlhttprequest'], tabIds: [-1] },
  }],
}).catch((e) => console.warn('User-Agent の設定に失敗しました', e));

// content.js（アプリのページ）・popup.js からのメッセージを受ける。
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'hoyolab-fetch') {
    fetchCharacters(msg.uid)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e), retcode: e.retcode }));
    return true; // 非同期で応答する
  }
  if (msg?.type === 'enka-fetch') {
    fetchEnka(String(msg.uid))
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e), code: e.code }));
    return true;
  }
  return false;
});
