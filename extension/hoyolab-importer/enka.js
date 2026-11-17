// Enka.Network から、他のアカウントの UID の「キャラクター詳細表示」（ゲーム内の展示キャラ）を取得する。
// Enka.Network は、ゲームが公開している展示キャラの情報を API にしている、非公式のサービス（HoYoLAB とは別）。
// API のルール（https://github.com/EnkaNetwork/API-docs の「Before You Request」）に従う:
//   ・UID の総当たり・大量取得をしない（取り込みボタンを押したときの 1 UID だけ）
//   ・独自の User-Agent を付ける（background.js が、この拡張機能自身の通信だけに付ける）
//   ・レスポンスの ttl（次に更新されるまでの秒数）の間は、同じ UID を再取得しない（下のキャッシュ）
// ログイン・Cookie は使わない。

const BASE = 'https://enka.network/api/uid/';

const cache = new Map(); // uid → { expires, data }

const fail = (message, code) => {
  const e = new Error(message);
  e.code = code;
  return e;
};

/** 展示キャラの詳細（生のレスポンス）を返す。キャラが 1 つも無いときは、avatarInfoList が無い（空）ものを返す */
export const fetchEnka = async (uid) => {
  if (!/^\d{9}$/.test(String(uid))) throw fail('UID は 9 桁の数字です', 'bad_uid');
  const hit = cache.get(uid);
  if (hit && hit.expires > Date.now()) return hit.data;

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
  cache.set(uid, { expires: Date.now() + ttlSec * 1000, data });
  return data;
};
