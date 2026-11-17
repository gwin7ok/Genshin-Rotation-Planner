import { fetchCharacters } from './hoyolab.js';
import { fetchEnka } from './enka.js';

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
