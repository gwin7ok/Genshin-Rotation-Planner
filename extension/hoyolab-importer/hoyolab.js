// HoYoLAB の戦績 API から、所持キャラの詳細を取得する。
// 署名（DS）・エンドポイント・リクエスト形式は genshin.py（MIT）の実装による。
// Cookie の値は読まない（ブラウザが自動で付ける）。

const md5 = (str) => {
  const rl = (x, c) => (x << c) | (x >>> (32 - c));
  const bytes = new TextEncoder().encode(str);
  const n = bytes.length;
  const words = [];
  for (let i = 0; i < n; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  words[n >> 2] |= 0x80 << ((n % 4) * 8);
  const len = (((n + 8) >> 6) + 1) * 16;
  for (let i = 0; i < len; i++) if (words[i] === undefined) words[i] = 0;
  words[len - 2] = n * 8;
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
  for (let o = 0; o < len; o += 16) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      const tmp = D; D = C; C = B;
      B = (B + rl((A + F + K[i] + words[o + g]) | 0, S[(i >> 4) * 4 + (i % 4)])) | 0;
      A = tmp;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  return [a0, b0, c0, d0].map((v) => [0, 8, 16, 24].map((s) => ((v >>> s) & 255).toString(16).padStart(2, '0')).join('')).join('');
};

const SALT = '6s25p5ox5y14umn1p61aqyyvbvvl3lrt';
const makeDs = () => {
  const t = Math.floor(Date.now() / 1000);
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let r = '';
  for (let i = 0; i < 6; i++) r += letters[Math.floor(Math.random() * letters.length)];
  return `${t},${r},${md5(`salt=${SALT}&t=${t}&r=${r}`)}`;
};

const SERVERS = { 6: 'os_usa', 7: 'os_euro', 8: 'os_asia', 9: 'os_cht' };
const BASE = 'https://sg-public-api.hoyolab.com/event/game_record/genshin/api/';

const call = async (endpoint, uid, server, body) => {
  const res = await fetch(BASE + endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'x-rpc-app_version': '1.5.0',
      'x-rpc-client_type': '5',
      'x-rpc-language': 'ja-jp',
      'x-rpc-lang': 'ja-jp',
      ds: makeDs(),
    },
    body: JSON.stringify({ role_id: String(uid), server, ...body }),
  });
  const json = await res.json();
  if (json.retcode !== 0) {
    const e = new Error(`${endpoint}: retcode=${json.retcode} ${json.message}`);
    e.retcode = json.retcode;
    throw e;
  }
  return json.data;
};

/** プレイヤー名（index の role.nickname）。取れなくても、取り込みは続ける（undefined を返す） */
const fetchNickname = async (uid, server) => {
  try {
    const res = await fetch(`${BASE}index?${new URLSearchParams({ role_id: String(uid), server })}`, {
      credentials: 'include',
      headers: { 'x-rpc-app_version': '1.5.0', 'x-rpc-client_type': '5', 'x-rpc-language': 'ja-jp', 'x-rpc-lang': 'ja-jp', ds: makeDs() },
    });
    const json = await res.json();
    return json.retcode === 0 && typeof json.data?.role?.nickname === 'string' ? json.data.role.nickname : undefined;
  } catch {
    return undefined;
  }
};

/** 他のアカウントの UID: 詳細の一括取得は許可されない（retcode 10104）。1 キャラずつ取得し、取得できたものだけ集める */
const NOT_ALLOWED = 10104;
const MAX_CONSECUTIVE_DENIED = 20; // 1 つも取得できないまま、これだけ続けて拒否されたら、あきらめる
const fetchOneByOne = async (uid, server, ids, firstError) => {
  const merged = { list: [] };
  let denied = 0;
  for (const id of ids) {
    try {
      const part = await call('character/detail', uid, server, { character_ids: [id] });
      merged.list.push(...(part.list ?? []));
      for (const [k, v] of Object.entries(part)) {
        if (k !== 'list' && v && typeof v === 'object') merged[k] = { ...(merged[k] ?? {}), ...v };
      }
      denied = 0;
    } catch (e) {
      if (e.retcode !== NOT_ALLOWED) {
        if (merged.list.length === 0) throw e; // 1 つも取れていなければ、そのエラーを返す
        break; // 取れた分だけ返す（回数制限など）
      }
      denied++;
      if (merged.list.length === 0 && denied >= MAX_CONSECUTIVE_DENIED) break;
    }
  }
  if (merged.list.length === 0) throw firstError;
  merged.skipped = ids.length - merged.list.length;
  return merged;
};

/** 所持キャラの詳細（生のレスポンス）を返す。 */
export const fetchCharacters = async (uid) => {
  const server = SERVERS[String(uid)[0]];
  if (!server) throw new Error('UID からサーバーを判別できません');
  const list = await call('character/list', uid, server, {});
  const ids = list.list.map((c) => c.id);
  const nickname = await fetchNickname(uid, server);
  const withNickname = (data) => (nickname ? { ...data, nickname } : data);
  try {
    return withNickname(await call('character/detail', uid, server, { character_ids: ids }));
  } catch (e) {
    if (e.retcode !== NOT_ALLOWED) throw e;
    return withNickname(await fetchOneByOne(uid, server, ids, e));
  }
};
