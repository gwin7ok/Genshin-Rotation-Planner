// 試作: HoYoLAB のページ（act.hoyolab.com の「全キャラクター」ページなど）の
// 開発者ツールのコンソールに貼って実行する。ログイン済みのブラウザで動かす。
// - Cookie の値は読まない（ブラウザが自動で付ける）。表示も保存もしない。
// - 取得した全キャラの JSON を、hoyolab-raw.json としてダウンロードする。
// 仕様の出どころ: genshin.py（MIT）の DS 生成・エンドポイント・リクエスト形式。
(async () => {
  // --- MD5（DS 署名用。ブラウザの SubtleCrypto に MD5 が無いため） ---
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

  // --- DS（動的署名。genshin.py の generate_dynamic_secret と同じ） ---
  const SALT = '6s25p5ox5y14umn1p61aqyyvbvvl3lrt';
  const makeDs = () => {
    const t = Math.floor(Date.now() / 1000);
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let r = '';
    for (let i = 0; i < 6; i++) r += letters[Math.floor(Math.random() * letters.length)];
    return `${t},${r},${md5(`salt=${SALT}&t=${t}&r=${r}`)}`;
  };

  // --- UID とサーバー（ページの URL の role_id / server から。無ければ入力を求める） ---
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  let uid = q.get('role_id') || prompt('原神の UID を入力してください');
  if (!uid) return console.error('UID がありません');
  let server = q.get('server');
  if (!server) {
    const m = { 6: 'os_usa', 7: 'os_euro', 8: 'os_asia', 9: 'os_cht' };
    server = m[String(uid)[0]];
  }
  if (!server) return console.error('サーバーを判別できません');

  const BASE = 'https://sg-public-api.hoyolab.com/event/game_record/genshin/api/';
  const call = async (endpoint, body) => {
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
    if (json.retcode !== 0) throw new Error(`${endpoint}: retcode=${json.retcode} ${json.message}`);
    return json.data;
  };

  try {
    const list = await call('character/list', {});
    const ids = list.list.map((c) => c.id);
    console.log(`所持キャラ: ${ids.length} 体。詳細を取得します…`);
    const detail = await call('character/detail', { character_ids: ids });
    const blob = new Blob([JSON.stringify(detail, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hoyolab-raw.json';
    a.click();
    console.log(`完了: ${detail.list.length} キャラを hoyolab-raw.json として保存しました。`);
  } catch (e) {
    console.error('失敗:', e.message || e);
  }
})();
