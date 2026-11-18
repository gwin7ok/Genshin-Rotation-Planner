// Enka.Network から、他のアカウントの UID の「キャラクター詳細表示」（ゲーム内の展示キャラ）を取得する。
// Enka.Network は、ゲームが公開している展示キャラの情報を API にしている、非公式のサービス（HoYoLAB とは別）。
// API のルール（https://github.com/EnkaNetwork/API-docs の「Before You Request」）に従う:
//   ・UID の総当たり・大量取得をしない（取り込みボタンを押したときの 1 UID だけ）
//   ・独自の User-Agent を付ける（background.js が、この拡張機能自身の通信だけに付ける）
//   ・レスポンスの ttl（次に更新されるまでの秒数）の間は、同じ UID を再取得しない（下のキャッシュ）
// ログイン・Cookie は使わない。

const BASE = 'https://enka.network/api/uid/';

// uid → { expires, data }。サービスワーカー（Firefox のバックグラウンドスクリプトも同じ）は、しばらく使わないと止まって、メモリ上の変数が消える。
// ttl の間は再取得しない約束（上のルール）を守るため、ブラウザを閉じるまで残る chrome.storage.session に持つ。
const CACHE_PREFIX = 'enka-cache:';
const readCache = async (uid) => {
  try {
    const got = await chrome.storage.session.get(CACHE_PREFIX + uid);
    const hit = got[CACHE_PREFIX + uid];
    return hit && hit.expires > Date.now() ? hit.data : null;
  } catch { return null; }
};
const writeCache = async (uid, expires, data) => {
  try { await chrome.storage.session.set({ [CACHE_PREFIX + uid]: { expires, data } }); } catch { /* 容量超過などは、キャッシュなしで続ける */ }
};

const fail = (message, code) => {
  const e = new Error(message);
  e.code = code;
  return e;
};

/** 展示キャラの詳細（生のレスポンス）を返す。キャラが 1 つも無いときは、avatarInfoList が無い（空）ものを返す */
export const fetchEnka = async (uid) => {
  if (!/^\d{9,10}$/.test(String(uid))) throw fail('UID は 9〜10 桁の数字です', 'bad_uid');
  const cached = await readCache(String(uid));
  if (cached) return cached;

  let res;
  try {
    res = await fetch(BASE + uid, { method: 'GET' });
  } catch {
    throw fail('Enka.Network に接続できません', 'network');
  }
  if (res.status === 404) throw fail('その UID は、Enka.Network で見つかりません（UID の間違いか、プロフィールが公開されていません）', 'not_found');
  if (res.status === 400) throw fail('UID の形式が正しくありません', 'bad_uid');
  if (res.status === 424) throw fail('ゲーム側が整備中のため、Enka.Network が取得できません。しばらくしてからやり直してください', 'maintenance');
  if (res.status === 429) throw fail('Enka.Network の回数制限にかかりました。しばらく待ってから、やり直してください', 'rate_limited');
  if (!res.ok) throw fail(`Enka.Network が ${res.status} を返しました。しばらくしてからやり直してください`, 'upstream');

  const data = await res.json();
  const ttlSec = Number(data.ttl) > 0 ? Number(data.ttl) : 60;
  await writeCache(String(uid), Date.now() + ttlSec * 1000, data);
  return data;
};
