// 原神 Wiki（wikiwiki.jp/genshinwiki）の各キャラのページから、おすすめの聖遺物・武器の「事実」だけを取り出す。
// 使い方は tools/wiki-default-builds/README.md。ブラウザで https://wikiwiki.jp/genshinwiki/ のページを開き、
// この全体を開発者ツールのコンソールに貼って、次のように呼ぶ（同じ origin への読み取りだけなので、CORS は要らない）:
//   const out = await wikiBuilds.run(['ナヒーダ', '魈'], { 魈: 'ショウ' });   // 名前の配列と、ページ名の例外
//   copy(JSON.stringify(out));                                              // 結果を JSON でコピー
// 取り出すのは、おすすめのメインステータス・サブステータスの優先順・セットの名前と個数・先頭の武器の名前だけ（文章は写さない）。
// 1 ページごとに 1.2 秒空ける（相手のサーバーに負担をかけない）。
(() => {
  const cellText = (td) => {
    const c = td.cloneNode(true);
    c.querySelectorAll('br').forEach((b) => b.replaceWith('/'));
    c.querySelectorAll('p,li,div').forEach((b) => b.append('/'));
    return c.textContent.replace(/\s+/g, ' ').replace(/\/+/g, '/').replace(/^\/|\/$/g, '').trim();
  };
  // rowspan / colspan を展開した表（行 × 列）にする
  const grid = (table) => {
    const g = [];
    [...table.rows].forEach((tr, r) => {
      g[r] = g[r] || [];
      let c = 0;
      [...tr.cells].forEach((td) => {
        while (g[r][c] !== undefined) c++;
        const rs = td.rowSpan || 1;
        const cs = td.colSpan || 1;
        const t = cellText(td);
        for (let i = 0; i < rs; i++) {
          g[r + i] = g[r + i] || [];
          for (let j = 0; j < cs; j++) g[r + i][c + j] = { t, origin: i === 0 && j === 0 };
        }
        c += cs;
      });
    });
    return g;
  };

  /** メインステータスの表記 → キー。elem=そのキャラの元素ダメージ */
  const MAIN = [
    ['会心ダメージ', 'cd'], ['会心率', 'cr'], ['会心', 'crit'], ['治療', 'heal'], ['物理', 'phys'],
    ['元素ダメージ', 'elem'], ['元素熟知', 'em'], ['元素チャージ', 'er'],
    ['攻撃力', 'atk%'], ['HP', 'hp%'], ['防御力', 'def%'],
  ];
  const mainOptions = (text) => {
    const out = [];
    for (const part of text.split(/[/|]/)) {
      const hit = MAIN.find(([w]) => part.includes(w));
      if (hit && !out.includes(hit[1])) out.push(hit[1]);
    }
    return out;
  };

  /** サブステータスの優先順（「会心系＞攻撃力％≧元素チャージ効率＞その他」）→ 順位ごとのキーの配列 */
  const SUB = [
    ['会心系', ['cr', 'cd']], ['会心ダメージ', ['cd']], ['会心率', ['cr']], ['元素熟知', ['em']], ['元素チャージ', ['er']],
    ['攻撃力％', ['atk%']], ['攻撃力%', ['atk%']], ['HP％', ['hp%']], ['HP%', ['hp%']], ['防御力％', ['def%']], ['防御力%', ['def%']],
    ['攻撃実数値', ['atk']], ['攻撃固定値', ['atk']], ['攻撃力固定', ['atk']], ['HP固定値', ['hp']], ['HP実数値', ['hp']], ['防御固定値', ['def']], ['防御実数値', ['def']],
  ];
  const subRanks = (text) => {
    const body = text.replace(/^[^:：]*[:：]/, '').replace(/\([^)]*\)|（[^）]*）/g, '');
    const ranks = [];
    for (const rank of body.split(/[＞>]/)) {
      if (rank.includes('その他')) break;
      const keys = [];
      let rest = rank;
      for (const [w, ks] of SUB) {
        if (rest.includes(w)) { for (const k of ks) if (!keys.includes(k)) keys.push(k); rest = rest.split(w).join(''); }
      }
      if (keys.length) ranks.push(keys);
    }
    return ranks;
  };

  /** 1 キャラのページから取り出す */
  const extractOne = async (name, page) => {
    const res = await fetch('/genshinwiki/' + (page || name).split('/').map(encodeURIComponent).join('/'));
    if (!res.ok) return { name, error: 'HTTP ' + res.status };
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const heads = [...doc.querySelectorAll('h3,h4')];
    // 武器: 見出し「武器…」の次の、最初の太字の名前
    let weapon = null;
    const wh = heads.find((e) => /^武器/.test(e.textContent.trim()));
    if (wh) {
      let el = wh.nextElementSibling;
      for (let n = 0; el && n < 8 && !weapon && !/^H[23]$/.test(el.tagName); n++, el = el.nextElementSibling) {
        const s = el.querySelector && el.querySelector('li strong');
        if (s) weapon = s.textContent.trim();
      }
    }
    // セット: 見出し「聖遺物」の節の文章に出てくる名前を、出現順に（個数「(4)」「(2)」つき）
    const ah = heads.find((e) => e.textContent.trim() === '聖遺物');
    const sets = [];
    if (ah) {
      let txt = '';
      let el = ah.nextElementSibling;
      for (let n = 0; el && n < 30 && !/^H[23]$/.test(el.tagName); n++, el = el.nextElementSibling) if (el.tagName !== 'TABLE') txt += (el.textContent || '') + '\n';
      doc.__txt = txt;
    }
    // 表: 「空の杯」「時の砂」を含む最初の表（複数のビルドがあるときは、最初のビルド）
    const tb = [...doc.querySelectorAll('table')].find((t) => t.textContent.includes('空の杯') && t.textContent.includes('時の砂'));
    let main = null;
    let subText = '';
    if (tb) {
      const g = grid(tb);
      const hr = g.findIndex((r) => r && r.some((c) => c && c.t === '空の杯'));
      const col = (k) => g[hr].findIndex((c) => c.t === k);
      const [hc, sc, cc] = [col('空の杯'), col('時の砂'), col('理の冠')];
      const o = { sands: [], goblet: [], circlet: [] };
      for (let r = hr + 1; r < g.length; r++) {
        const row = g[r];
        if (!row) continue;
        const first = row[0]?.t || '';
        if (/^サブ/.test(first)) { if (!subText) subText = first + ':' + (row[1]?.t || ''); continue; }
        if (row[hc]?.origin) o.goblet.push(row[hc].t);
        if (row[sc]?.origin) o.sands.push(row[sc].t);
        if (row[cc]?.origin) o.circlet.push(row[cc].t);
      }
      main = { sands: mainOptions(o.sands.join('/')), goblet: mainOptions(o.goblet.join('/')), circlet: mainOptions(o.circlet.join('/')) };
    }
    return { name, weapon, setsText: doc.__txt || '', main, sub: subRanks(subText), subRaw: subText.replace(/\s+/g, '') };
  };

  /** セットの名前（マスターの名前の配列）を、文章の出現順に最大 4 つ。直後の「(4)」「(2)」を個数にする（無ければ 0 = 不明） */
  const findSets = (text, setNames) => {
    const found = [];
    for (const s of setNames) {
      const i = text.indexOf(s);
      if (i < 0) continue;
      const m = text.slice(i + s.length, i + s.length + 4).replace(/[（）()\s]/g, '').match(/^([24４])/);
      found.push({ i, name: s, count: m ? (m[1] === '２' ? 2 : m[1] === '４' ? 4 : Number(m[1])) : 0 });
    }
    return found.sort((a, b) => a.i - b.i).slice(0, 4).map(({ name, count }) => ({ name, count }));
  };

  window.wikiBuilds = {
    extractOne,
    /** names: キャラ名の配列、pages: { キャラ名: ページ名 }、setNames: マスターの聖遺物セット名の配列 */
    async run(names, pages = {}, setNames = []) {
      const out = {};
      for (const n of names) {
        try {
          const r = await extractOne(n, pages[n]);
          if (!r.error) { r.sets = findSets(r.setsText, setNames); }
          delete r.setsText;
          out[n] = r;
        } catch (e) {
          out[n] = { name: n, error: String(e) };
        }
        await new Promise((s) => setTimeout(s, 1200));
      }
      return out;
    },
  };
})();
