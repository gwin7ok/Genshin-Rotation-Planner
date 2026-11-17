# 「仮値を使う」の既定の装備（原神 Wiki のおすすめ）の取得

編成設定の「仮値を使う」で入れる、キャラごとの**聖遺物メイン・サブステータスの優先順・聖遺物セット・武器**は、
原神 Wiki（https://wikiwiki.jp/genshinwiki/）の各キャラのページの「ビルド」の記述を元にしている。
結果は `src/data/default_builds.json`（キャラのゲーム ID がキー）。コードは `src/utils/customStats.ts` の `defaultCustomStatsFor` / `defaultEquipmentFor`。

## 取り出すもの（事実だけ）
- 聖遺物の表（`#artifact`）の、時計・杯・冠のおすすめメイン（候補の並び。先頭を使う）と、サブステータスの優先順
- 聖遺物の節に出てくるセットの名前（出現順）と、「(4)」「(2)」の個数
- 武器の節（`#weapon`）の、先頭の武器の名前
- 文章・画像は写さない。ページごとに 1.2 秒空ける（相手のサーバーに負担をかけない）。

## 新キャラを足す・更新する手順
1. ブラウザで https://wikiwiki.jp/genshinwiki/ のどれかのページを開き、開発者ツールのコンソールに、`tools/wiki-default-builds/extract.js` の全体を貼る。
2. 新キャラの名前（マスターの `name`）の配列と、聖遺物セットの名前の配列（`src/data/artifacts_master_data.json` の `name`）を渡して実行する。
   ページ名がキャラ名と違うキャラは、第 2 引数で指定する（例: 魈は `{ 魈: 'ショウ' }`。旅人の「主人公」のページには表が無いので対象外）。
   ```js
   const sets = [/* 聖遺物セット名の配列 */];
   const out = await wikiBuilds.run(['新キャラ名'], {}, sets);
   copy(JSON.stringify(out));
   ```
3. コピーした JSON をファイルに保存し、リポジトリで取り込む（入力に無いキャラは、そのまま残る）:
   ```bash
   npm run build:default-builds -- <保存した JSON のパス>
   ```
   警告（武器・セットがマスターに無い、gcsim 未対応など）が出たキャラは、そのキャラだけ、武器・セットを入れない（聖遺物ステータスは入る）。
4. 数字（サブステータスの強化回数・メインの値）の規則は、`src/utils/customStats.ts` の `ROLL_BUDGET` / `ROLL_VALUE` / `MAIN_VALUE`。
5. データが無いキャラ（新キャラの追加が間に合わないとき・旅人）は、型の目安（攻撃・HP・防御・熟知。`ARTIFACT_PROFILE_BY_GENSHIN_ID`）で入る。

## 注意
- Wiki のページの構成が変わると、取り出せなくなることがある（表の見出し「空の杯」「時の砂」、節の見出し「聖遺物」「武器」に頼っている）。
  取り込み後の警告と、`defaultCustomStatsFor` の出力（全キャラで会心率・会心ダメージなどが妥当か）を確認する。
- 複数のビルドが載っているページは、最初の表（最初のビルド）を使う。
- 取り出した内容は、Wiki の「おすすめ」であり、正解ではない。気づいたキャラは、`default_builds.json` を手で直してよい（次の取り込みで、そのキャラが入力に含まれると上書きされる）。
