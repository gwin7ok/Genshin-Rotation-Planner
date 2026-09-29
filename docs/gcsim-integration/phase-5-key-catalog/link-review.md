# 発動バフの結び付けの全件確認（固有天賦・命ノ星座）

生成: 2026-09-29。マスター（DB バージョン 26）の、固有天賦 274 定義・命ノ星座の効果 153 定義と、gcsim の辞書のキーの結び付けの一覧。

## 確認の方法と結果

- 枠の決め方: 辞書のキーの**登録している関数名**（asc.go の `a1` / `a4Init` / `makeA4`、cons.go の `c2` など）と、**キー名**（`a1` / `c2`）の 2 つで独立に決め、一致を確認した。
- 固有天賦（a1 / a4）: 両方が分かるキー 162 件は**すべて一致**（食い違い 0）。関数名だけで分かるキー 23 件（例: 刻晴 `keqinginfuse`、珊瑚宮心海 `kokomiskill`、ミカ `detector-buff`、コロンビーナ `moonridge-dew-timer`）を新しく対応付けた。
- 命ノ星座（c1〜c6）: 両方が分かるキー 300 件は一致。食い違い 1 件（フレミネ `freminet-c6`: 関数名 `c4c6` が 2 つの凸を含む）はキー名を採用。関数名だけで分かるキー 5 件を対応付けた。
- 固有天賦のファイル（asc.go）のキーは固有天賦に、命ノ星座のファイル（cons.go）のキーは命ノ星座にだけ対応付ける（例: シロネンの `xilonen-c2` は asc.go で登録されているので固有天賦）。
- 実行での確認: 全キャラ・全武器・全聖遺物を gcsim で実行し、出たキーの持ち主を照合（1,058 件中 1,050 件一致、不一致 2 件は共有キー）。

## 1. gcsim 対象外の固有天賦の理由（131 定義）

- asc.go に a1 / a4 の関数が無い（gcsim が別の場所で実装している、または実装していない）: 28 定義
- 関数はあるが、状態のキーの登録が無い（ステータス加算など。gcsim が効果を状態として持たない）: 74 定義
- asc.go が取得できない（旅人の共通ディレクトリなど）: 10 定義
- 未実装（gcsim にキャラが無い）: 19 定義

- 「関数が無い」の定義は、gcsim がその効果を別のファイル（skill.go など）で実装している可能性がある。該当があれば辞書・結び付けの規則を直す（下の一覧の「理由」列）。

## 2. 固有天賦（274 定義）

| キャラ | 枠 | 名前 | 分類 | 継続時間（出典） | 対応するキー | 理由・備考 |
|---|---|---|---|---|---|---|
| 神里綾華 | a1 | 天つ罪·国つ罪の鎮詞 | gcsim 計算 | 6s | ayaka-a1 |  |
| 神里綾華 | a4 | 寒空の宣命祝詞 | gcsim 計算 | 10s | ayaka-a4 |  |
| ジン | a1 | 風の赴くままに | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| ジン | a4 | 風の導くままに | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 空(風) | a1 | 空を裂く風 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 空(風) | a4 | 蘇生の風 | gcsim 対象外 | 5s | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 空(氷) | a1 | 鋭き凛氷 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 空(氷) | a4 | 透明なる冷氷 | 常時 | — | travelercryo-a4 |  |
| 空(草) | a1 | 蔓生の埜草 | gcsim 計算 | — | dmc-a1 |  |
| 空(草) | a4 | 生い茂る草叢 | 常時 | — | dmc-a4 |  |
| 空(雷) | a1 | 転瞬の迅雷 | gcsim 対象外 | — | — | asc.go が取得できない（旅人の共通ディレクトリなど） |
| 空(雷) | a4 | 轟く雷鳴 | gcsim 対象外 | — | — | asc.go が取得できない（旅人の共通ディレクトリなど） |
| 空(岩) | a1 | 破れた断崖 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 空(岩) | a4 | 狂乱の岩崩れ | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 空(水) | a1 | 無染の清水 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 空(水) | a4 | 澄明の浄水 | gcsim 対象外 | — | — | asc.go に a4 の関数が無い（gcsim が実装していない or 別の書き方） |
| 空(炎) | a1 | 燃え立つ真火 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| 空(炎) | a4 | 燻る残火 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| リサ | a1 | 感電余震 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| リサ | a4 | 静電気フィールド | gcsim 計算 | 10s | lisa-a4 |  |
| 蛍(風) | a1 | 空を裂く風 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 蛍(風) | a4 | 蘇生の風 | gcsim 対象外 | 5s | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 蛍(氷) | a1 | 鋭き凛氷 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 蛍(氷) | a4 | 透明なる冷氷 | 常時 | — | travelercryo-a4 |  |
| 蛍(草) | a1 | 蔓生の埜草 | gcsim 計算 | — | dmc-a1 |  |
| 蛍(草) | a4 | 生い茂る草叢 | 常時 | — | dmc-a4 |  |
| 蛍(雷) | a1 | 転瞬の迅雷 | gcsim 対象外 | — | — | asc.go が取得できない（旅人の共通ディレクトリなど） |
| 蛍(雷) | a4 | 轟く雷鳴 | gcsim 対象外 | — | — | asc.go が取得できない（旅人の共通ディレクトリなど） |
| 蛍(岩) | a1 | 破れた断崖 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 蛍(岩) | a4 | 狂乱の岩崩れ | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 蛍(水) | a1 | 無染の清水 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 蛍(水) | a4 | 澄明の浄水 | gcsim 対象外 | — | — | asc.go に a4 の関数が無い（gcsim が実装していない or 別の書き方） |
| 蛍(炎) | a1 | 燃え立つ真火 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| 蛍(炎) | a4 | 燻る残火 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| バーバラ | a1 | 輝く季節 | gcsim 計算 | 15.017s（gcsim） | barb-a1-stam |  |
| バーバラ | a4 | アンコール | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ガイア | a1 | 冷血の剣 | gcsim 対象外 | — | — | asc.go が取得できない（旅人の共通ディレクトリなど） |
| ガイア | a4 | 氷淵の心 | gcsim 対象外 | — | — | asc.go が取得できない（旅人の共通ディレクトリなど） |
| ディルック | a1 | ノンストップ | gcsim 対象外 | — | — | asc.go が取得できない（旅人の共通ディレクトリなど） |
| ディルック | a4 | 溶融の翼 | gcsim 対象外 | — | — | asc.go が取得できない（旅人の共通ディレクトリなど） |
| レザー | a1 | 覚醒 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| レザー | a4 | 飢餓 | 常時 | — | razor-a4 |  |
| アンバー | a1 | 百発百中！ | 常時 | — | amber-a1 |  |
| アンバー | a4 | 制圧射撃 | gcsim 計算 | 10s | amber-a4 |  |
| ウェンティ | a1 | 余風の抱擁 | gcsim 対象外 | 20s | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| ウェンティ | a4 | 暴風の目 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 香菱 | a1 | 交差する炎 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 香菱 | a4 | 激辛唐辛子 | gcsim 計算 | 10s | xiangling-a4 |  |
| 北斗 | a1 | 完全なる霊光 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| 北斗 | a4 | 満天の霹靂 | gcsim 計算 | 10s | beidou-a4-atkspd, beidou-a4-dmg |  |
| 行秋 | a1 | 水生みの要訣 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| 行秋 | a4 | 虚実の筆 | 常時 | — | xingqiu-a4 |  |
| 魈 | a1 | 降魔·平妖大聖 | gcsim 計算 | 15.95s（gcsim） | xiao-a1 |  |
| 魈 | a4 | 壊劫·国土砕き (7秒) | gcsim 計算 | 7s | xiao-a4 |  |
| 魈 | a4 | 壊劫·国土砕き (7秒) | gcsim 計算 | 7s | xiao-a4 |  |
| 凝光 | a1 | 物換星移 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| 凝光 | a4 | 備えあれば憂いなし | gcsim 計算 | 10s | ning-screen |  |
| クレー | a1 | こんこんプレゼント | 条件付き | — | a1-spark |  |
| クレー | a4 | 無限花火 | gcsim 対象外 | — | — | asc.go に a4 の関数が無い（gcsim が実装していない or 別の書き方） |
| 鍾離 | a1 | 岩の宸断 | 常時 | — | zhongli-a1 |  |
| 鍾離 | a4 | 贅沢な食饌 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| フィッシュル | a1 | 星喰いの鴉 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| フィッシュル | a4 | 断罪の雷影 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ベネット | a1 | 情熱復活 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ベネット | a4 | 恐れなき熱血 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| タルタリヤ | a1 | 無尽蔵 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| タルタリヤ | a4 | 水形剣 | gcsim 対象外 | — | — | asc.go に a4 の関数が無い（gcsim が実装していない or 別の書き方） |
| ノエル | a1 | 誠心誠意 | gcsim 対象外 | 20s | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ノエル | a4 | きれいさっぱり | gcsim 対象外 | — | — | asc.go に a4 の関数が無い（gcsim が実装していない or 別の書き方） |
| 七七 | a1 | 延命妙法 | gcsim 計算 | 8s | qiqi-a1 |  |
| 七七 | a4 | 玉籤偶開 | gcsim 計算 | 6s | qiqi-talisman |  |
| 重雲 | a1 | 吐納真定 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| 重雲 | a4 | 追氷剣訣 | gcsim 計算 | 8s | chongyun-a4 |  |
| 甘雨 | a1 | 唯一の心 | gcsim 対象外 | — | — | asc.go が取得できない（旅人の共通ディレクトリなど） |
| 甘雨 | a4 | 天地安泰 | gcsim 対象外 | — | — | asc.go が取得できない（旅人の共通ディレクトリなど） |
| アルベド | a1 | 白亜色の気迫 | 常時 | — | albedo-a1 |  |
| アルベド | a4 | ホムンクルスの天智 | gcsim 計算 | 10s | albedo-a4 |  |
| ディオナ | a1 | キャッツテールの裏メニュー | 常時 | — | diona-a1 |  |
| ディオナ | a4 | 滑稽な酔態 | gcsim 対象外 | 15s | — | asc.go に a4 の関数が無い（gcsim が実装していない or 別の書き方） |
| モナ | a1 | 「おばば、私を捕まえられますか～」 | gcsim 対象外 | 2s | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| モナ | a4 | 「運命の流れに任せましょう！」 | 常時 | — | mona-a4 |  |
| 刻晴 | a1 | 抵天の雷罰 | gcsim 計算 | 5s | keqinginfuse |  |
| 刻晴 | a4 | 玉衡の貴 | gcsim 計算 | 8s | keqing-a4 |  |
| スクロース | a1 | 触媒置換術 | gcsim 計算 | 8s | sucrose-a1 |  |
| スクロース | a4 | 小さな恵風 | gcsim 計算 | 8s | sucrose-a4 |  |
| 辛炎 | a1 | 「観客いなくても演奏するのだ…」 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 辛炎 | a4 | 「…これこそがロックだ！」 | 常時 | — | xinyan-a4 |  |
| ロサリア | a1 | 懺悔に耳を傾ける幻影 | gcsim 計算 | 5s | rosaria-a1 |  |
| ロサリア | a4 | 陰から支える暗色 | gcsim 計算 | 10s | rosaria-a4 |  |
| 胡桃 | a1 | 蝶隠の時 | gcsim 計算 | 8s | hutao-a1 |  |
| 胡桃 | a4 | 血のかまど | 常時 | — | hutao-a4 |  |
| 楓原万葉 | a1 | 相聞剣法 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| 楓原万葉 | a4 | 風物の詩吟 | gcsim 対象外 | 8s | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 煙緋 | a1 | 関連条約 | gcsim 計算 | 6s | yanfei-a1 |  |
| 煙緋 | a4 | 法獣の灼眼 | gcsim 対象外 | — | — | asc.go に a4 の関数が無い（gcsim が実装していない or 別の書き方） |
| 宵宮 | a1 | 袖火百景図 | gcsim 計算 | 3s | yoimiya-a1 |  |
| 宵宮 | a4 | 炎昼の風物詩 | gcsim 計算 | 15s（gcsim） | yoimiya-a4 |  |
| トーマ | a1 | 重装甲胄 | gcsim 計算 | 6s | thoma-a1 |  |
| トーマ | a4 | 進撃の烈炎 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| エウルア | a1 | 氷の残剣 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| エウルア | a4 | 戦意の表れ | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 雷電将軍 | a1 | 千万の願望 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 雷電将軍 | a4 | 殊勝な御体 | 常時 | — | raiden-a4 |  |
| 早柚 | a1 | 適任の人を探そう | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 早柚 | a4 | 仕事をサボるのだ | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 珊瑚宮心海 | a1 | 葛籠の中の玉櫛 | gcsim 計算 | 12.017s（gcsim） | kokomiskill |  |
| 珊瑚宮心海 | a4 | 真珠の御唄 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ゴロー | a1 | 風雨を恐れず | gcsim 計算 | 12s | gorou-a1 |  |
| ゴロー | a4 | 報恩の守護 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 九条裟羅 | a1 | 不動心 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| 九条裟羅 | a4 | 御公儀 | gcsim 対象外 | — | — | asc.go に a4 の関数が無い（gcsim が実装していない or 別の書き方） |
| 荒瀧一斗 | a1 | 荒瀧第一 | 常時 | — | itto-a1 |  |
| 荒瀧一斗 | a4 | 赤鬼の血 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 八重神子 | a1 | 神籬之御蔭 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 八重神子 | a4 | 啓蟄之祝詞 | 常時 | — | yaemiko-a4 |  |
| 鹿野院平蔵 | a1 | 反論稽古 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 鹿野院平蔵 | a4 | 因由勘破 | gcsim 計算 | 10s | heizou-a4 |  |
| 夜蘭 | a1 | 先後の決め手 | 常時 | — | yelan-a1 |  |
| 夜蘭 | a4 | 気随気儘 | gcsim 計算 | 15s（gcsim） | yelan-a4 |  |
| 綺良々 | a1 | 妖説岐尾の変 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 綺良々 | a4 | ネコのぐるぐる目時計 | 常時 | — | kirara-a4-burst, kirara-a4-skill |  |
| アーロイ | a1 | 戦闘オーバーライド | gcsim 計算 | 10s（gcsim） | aloy-a1 |  |
| アーロイ | a4 | 強打 | gcsim 計算 | 10s（gcsim） | aloy-strong-strike |  |
| 申鶴 | a1 | 大洞弥羅尊法 | gcsim 計算 | — | shenhe-a1 |  |
| 申鶴 | a4 | 縛霊通真法印 (10秒) | gcsim 計算 | 10s | shenhe-a4-press |  |
| 申鶴 | a4 | 縛霊通真法印 (15秒) | gcsim 計算 | 15s | shenhe-a4-hold |  |
| 雲菫 | a1 | 自我堅守 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| 雲菫 | a4 | 独立嶄然 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 久岐忍 | a1 | 檻を破る志 | 常時 | — | kuki-a1 |  |
| 久岐忍 | a4 | 安心の処 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 神里綾人 | a1 | 神里流·峰を纏いし清滝 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 神里綾人 | a4 | 神里流·満ちゆく破月 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| コレイ | a1 | フライリーフワインダー | gcsim 計算 | 3s | collei-a1 |  |
| コレイ | a4 | 徐かなること森の如く | gcsim 計算 | — | collei-a4-modcheck |  |
| ドリー | a1 | ゴールドマイニング | 条件付き | — | dori-a1 |  |
| ドリー | a4 | 砂だるま式利子 | gcsim 対象外 | — | — | asc.go に a4 の関数が無い（gcsim が実装していない or 別の書き方） |
| ティナリ | a1 | 深き眼識 | gcsim 計算 | 4s | tighnari-a1 |  |
| ティナリ | a4 | 草樹精通 | 常時 | — | tighnari-a4 |  |
| ニィロウ | a1 | 落花廻旋の庭 (30秒) | gcsim 計算 | 30s | nilou-a1 |  |
| ニィロウ | a1 | 落花廻旋の庭 (10秒) | gcsim 計算 | 10s | nilou-a1-em |  |
| ニィロウ | a4 | 軽やかに舞う永世の夢 | 条件付き | — | nilou-a4 |  |
| セノ | a1 | 落羽の裁決 | gcsim 計算 | — | cyno-a1, cyno-a1-dmg |  |
| セノ | a4 | 九弓の権能 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| キャンディス | a1 | 流羽の守り | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| キャンディス | a4 | 砂の円蓋 | 常時 | — | candace-a4 |  |
| ナヒーダ | a1 | 浄善摂受明論 | 条件付き | — | nahida-a1 |  |
| ナヒーダ | a4 | 慧明縁覚智論 | 常時 | — | nahida-a4 |  |
| レイラ | a1 | 降って湧いた光のように | 常時 | — | layla-a1 |  |
| レイラ | a4 | 熟睡妨害禁止！ | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 放浪者 | a1 | 拾玉得花 | 条件付き | — | wanderer-a1-cryo, wanderer-a1-electro, wanderer-a1-pyro |  |
| 放浪者 | a4 | 夢跡一風 | 条件付き | — | wanderer-a4 |  |
| ファルザン | a1 | 迅速流風 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| ファルザン | a4 | 七窟遺智 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ヨォーヨ | a1 | 天星零落 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ヨォーヨ | a4 | 先意承問 | gcsim 計算 | 5s | yaoyao-a4 |  |
| アルハイゼン | a1 | 四因是正 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| アルハイゼン | a4 | 謎林説破 | 常時 | — | alhaitham-a4 |  |
| ディシア | a1 | 惜しみなき扶翼 (6秒) | gcsim 計算 | 6s | dehya-a1-reduction |  |
| ディシア | a1 | 惜しみなき扶翼 (9秒) | gcsim 計算 | 9s | dehya-a1-reduction |  |
| ディシア | a4 | 至誠の尊崇 | gcsim 対象外 | 10s | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ミカ | a1 | 速射牽制 | gcsim 計算 | 12s（gcsim） | detector-buff |  |
| ミカ | a4 | 地形測量 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| カーヴェ | a1 | 創造者の役目 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| カーヴェ | a4 | 芸術家の奇想 | gcsim 計算 | 12s（gcsim） | kaveh-a4 |  |
| 白朮 | a1 | 五運終天 | 常時 | — | baizhu-a1-dendro-dmg, baizhu-a1-heal-bonus |  |
| 白朮 | a4 | 地に在りて形を成す | gcsim 計算 | 6s | baizhu-a4 |  |
| リネット | a1 | 巧妙なコンビネーション | gcsim 計算 | 10s | lynette-a1 |  |
| リネット | a4 | プロップは完備 | 条件付き | — | lynette-a4 |  |
| リネ | a1 | 息を呑むパフォーマンス | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| リネ | a4 | フィナーレの喝采 | 常時 | — | lyney-a4 |  |
| フレミネ | a1 | 飽和潜水 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| フレミネ | a4 | 並流式冷却装置 | gcsim 計算 | 5s | freminet-a4-buff |  |
| リオセスリ | a1 | やがて公義は弁ぜらる | 常時 | — | wriothesley-a1 |  |
| リオセスリ | a4 | いずれ罪業は贖わる | 条件付き | — | wriothesley-a4 |  |
| ヌヴィレット | a1 | 古海継嗣の権威 | gcsim 対象外 | 30s | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ヌヴィレット | a4 | 至高なる審理の紀律 | 常時 | — | neuvillette-a4 |  |
| シャルロット | a1 | 衝撃的モーメント | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| シャルロット | a4 | 多様性リサーチ | 常時 | — | charlotte-a4 |  |
| フリーナ | a1 | 終わりなき円舞 | gcsim 計算 | 4s | furina-a1 |  |
| フリーナ | a4 | 聴き手なき独白 | 常時 | — | furina-a4 |  |
| シュヴルーズ | a1 | 尖兵協同戦術 | gcsim 計算 | 6s | chev-a1-electro, chev-a1-pyro |  |
| シュヴルーズ | a4 | 縦陣戦力統括 | gcsim 計算 | 30s | chev-a4 |  |
| ナヴィア | a1 | 未知の流通ルート | gcsim 計算 | 4s | navia-a1-dmg |  |
| ナヴィア | a4 | 相互連携ネットワーク | 常時 | — | navia-a4 |  |
| 嘉明 | a1 | 泰平の舞 | gcsim 計算 | 0.8s | gaming-a1 |  |
| 嘉明 | a4 | 祥煙の瑞気 | 常時 | — | gaming-a4-dmg-bonus, gaming-a4-heal-bonus |  |
| 閑雲 | a1 | 白羽高くして祥風を追う | gcsim 計算 | 20s | xianyun-a1 |  |
| 閑雲 | a4 | かの姿、洞府の仙人を彷彿す | 条件付き | — | xianyun-a4-window |  |
| 千織 | a1 | 量体裁衣 | gcsim 計算 | 5s | chiori-seize-the-moment |  |
| 千織 | a4 | 錦上添花 | gcsim 計算 | 20s | chiori-a4 |  |
| シグウィン | a1 | 休息は適度に取るのよ | gcsim 計算 | 18s | sigewinne-a1, sigewinne-convalescence |  |
| シグウィン | a4 | 丁寧な診療 | 常時 | — | sigewinne-a4 |  |
| アルレッキーノ | a1 | 償えるものは苦痛のみ | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| アルレッキーノ | a4 | 護れるものは力のみ | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| セトス | a1 | 黒鳶の謎掛 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| セトス | a4 | 砂王からの賜物 | 常時 | — | sethos-a4 |  |
| クロリンデ | a1 | 夜を裂く紫焔 | 条件付き | — | clorinde-a1-buff |  |
| クロリンデ | a4 | 契約の報償 | 条件付き | — | clorinde-a4-buff |  |
| エミリエ | a1 | 余香 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| エミリエ | a4 | 精留 | 常時 | — | emilie-a4 |  |
| カチーナ | a1 | 山のこだま | gcsim 対象外 | 12s | — | 未実装（gcsim にキャラが無い） |
| カチーナ | a4 | 磐岩の重み | gcsim 対象外 | — | — | 未実装（gcsim にキャラが無い） |
| キィニチ | a1 | 厄地の代償 | gcsim 計算 | 12s（gcsim） | desolation |  |
| キィニチ | a4 | 焔霊の契約 | gcsim 計算 | 15s | hunters-experience |  |
| ムアラニ | a1 | 耐熱型淡水プクフグ | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ムアラニ | a4 | ナタのナンバーワンガイド | gcsim 対象外 | 20s | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| シロネン | a1 | ネトティリズトリの残響 | gcsim 計算 | 15s（gcsim） | xilonen-c2, xilonen-samplers-activated |  |
| シロネン | a4 | ポータブル・アーマー | gcsim 計算 | 15s | xilonen-a4 |  |
| チャスカ | a1 | 弾丸トリック | 常時 | — | chasca-a1 |  |
| チャスカ | a4 | 援護の気持ち | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| オロルン | a1 | 夜陰のシナスタジア | gcsim 計算 | 15s | ororon-a1 |  |
| オロルン | a4 | 霊相のカタリスト | gcsim 計算 | 15s | ororon-a4 |  |
| マーヴィカ | a1 | 炎花の貢物 | gcsim 計算 | 10s | mavuika-a1 |  |
| マーヴィカ | a4 | 「キオンゴズィ」 | gcsim 計算 | 20s | mavuika-a4 |  |
| シトラリ | a1 | 五重天の寒雨 | gcsim 計算 | 12s | citlali-a1-hydro, citlali-a1-pyro |  |
| シトラリ | a4 | 白燧蝶の星衣 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 藍硯 | a1 | 四方封刀の霊占 | gcsim 対象外 | — | — | asc.go に a1 の関数が無い（gcsim が実装していない or 別の書き方） |
| 藍硯 | a4 | 蒼羽鎮邪の勅符 | gcsim 対象外 | — | — | asc.go に a4 の関数が無い（gcsim が実装していない or 別の書き方） |
| 夢見月瑞希 | a1 | 名月浮声 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| 夢見月瑞希 | a4 | 昼想夜夢 | gcsim 計算 | 4s | mizuki-a4 |  |
| イアンサ | a1 | 高負荷トレーニング・強化版 | gcsim 計算 | 15s | precise-movement |  |
| イアンサ | a4 | 運動量グラジエント分析 | gcsim 計算 | 10s | warming-up |  |
| ヴァレサ | a1 | 連翔、三段跳び！ | gcsim 計算 | 5s | rainbow-crash |  |
| ヴァレサ | a4 | ヒーロー、二度目の見参！ | 常時 | 12s | varesa-a4 |  |
| エスコフィエ | a1 | 美食は良薬に勝る | 条件付き | 9s | escoffier-a1 |  |
| エスコフィエ | a4 | シーズニングの中の閃き | gcsim 計算 | 12s | escoffier-a4-shred-cryo, escoffier-a4-shred-hydro |  |
| イファ | a1 | 臨床医の大局観 | 常時 | — | ifa-a1 |  |
| イファ | a4 | 相互救援協定 | gcsim 計算 | 10s | ifa-a4 |  |
| スカーク | a1 | 理の超越 | 常時 | — | skirk-a1-ss-pause |  |
| スカーク | a4 | 万流帰寂 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ダリア | a1 | 優しき風の寵愛 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ダリア | a4 | 遊び心に満ちた祈り | 常時 | — | dahlia-a4-atk-speed |  |
| イネファ | a1 | オーバークロック | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| イネファ | a4 | 再構築プロトコル | gcsim 計算 | 20s | ineffa-a4 |  |
| ラウマ | a1 | 霜夜に捧ぐ光 | 常時 | 20s | lauma-a1-ascendant |  |
| ラウマ | a4 | 甘泉に捧ぐ禊 | 常時 | — | lauma-a4 |  |
| フリンズ | a1 | 厳冬の響き | 常時 | — | flins-a1 |  |
| フリンズ | a4 | 幽炎の囁き | 常時 | — | flins-a4 |  |
| アイノ | a1 | 効率運用プロトコル | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| アイノ | a4 | 構造的パワーアップ | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ネフェル | a1 | 月下の賭け (15秒) | gcsim 対象外 | 15s | — | 未実装（gcsim にキャラが無い） |
| ネフェル | a1 | 月下の賭け (8秒) | gcsim 対象外 | 8s | — | 未実装（gcsim にキャラが無い） |
| ネフェル | a4 | 砂塵の娘 | gcsim 対象外 | 5s | — | 未実装（gcsim にキャラが無い） |
| ドゥリン | a1 | 顕現せし光霊 | gcsim 計算 | 6s | durin-a1-black |  |
| ドゥリン | a4 | 混沌を創りし闇夜 | gcsim 対象外 | 20s | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ヤフォダ | a1 | 報酬ゲットの妙案 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ヤフォダ | a4 | ベリーの褒賞 | gcsim 計算 | 6s | jahoda-a4 |  |
| コロンビーナ | a1 | 月が呼んだ狂気 | gcsim 計算 | 10s | columbina-a1 |  |
| コロンビーナ | a4 | 新月の法則 | gcsim 計算 | 18s（gcsim） | moonridge-dew-timer |  |
| 兹白 | a1 | 月下に舞い降りる天女 | gcsim 対象外 | 4s | — | 未実装（gcsim にキャラが無い） |
| 兹白 | a4 | 雲間に連なる山々 | gcsim 対象外 | — | — | 未実装（gcsim にキャラが無い） |
| イルーガ | a1 | ライトブリンガーの盟約 | gcsim 計算 | 20s（gcsim） | illuga-a1-crit, illuga-a1-em |  |
| イルーガ | a4 | 魔を狩る者の黄昏 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| ファルカ | a1 | 暁の風の行軍 | 常時 | — | varka-a1-anemo, varka-a1-physical |  |
| ファルカ | a4 | 風の御旗の導き | gcsim 計算 | 8s | varka-a4-stacks |  |
| ローエン | a1 | 絶対服従の訓戒 | gcsim 対象外 | — | — | 未実装（gcsim にキャラが無い） |
| ローエン | a4 | 秀逸なる戯言 | gcsim 対象外 | 8s | — | 未実装（gcsim にキャラが無い） |
| リンネア | a1 | 野外観察日誌 | gcsim 対象外 | — | — | 未実装（gcsim にキャラが無い） |
| リンネア | a4 | 博物分類図鑑 | gcsim 対象外 | — | — | 未実装（gcsim にキャラが無い） |
| ニコ | a1 | 分かち合い (20秒) | 条件付き | 20s | guidance-of-theosis |  |
| ニコ | a1 | 分かち合い (3秒) | 条件付き | 3s | guidance-of-theosis |  |
| ニコ | a4 | 美への愛 | gcsim 対象外 | 8s | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| プルーネ | a1 | さらなる懲罰 | gcsim 対象外 | — | — | a1 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |
| プルーネ | a4 | 鈴の音とともに | gcsim 計算 | 5s | prune-tolling-rally |  |
| サンドローネ | a1 | 悠久の演算機関 | gcsim 対象外 | 60s | — | 未実装（gcsim にキャラが無い） |
| サンドローネ | a4 | 淑女の礼儀作法 | gcsim 対象外 | — | — | 未実装（gcsim にキャラが無い） |
| ヴォジャニーツァ | a1 | 最後の詩詠者 | gcsim 対象外 | 6s | — | 未実装（gcsim にキャラが無い） |
| ヴォジャニーツァ | a4 | 十二弦の涙唄 | gcsim 対象外 | 30s | — | 未実装（gcsim にキャラが無い） |
| ヴェスナ | a1 | 儀典「春の行列」 | gcsim 対象外 | 20s | — | 未実装（gcsim にキャラが無い） |
| ヴェスナ | a4 | 法典「冬の凱旋」 | gcsim 対象外 | — | — | 未実装（gcsim にキャラが無い） |
| アリョーシャ | a1 | 微睡む林の目覚め | gcsim 対象外 | — | — | 未実装（gcsim にキャラが無い） |
| アリョーシャ | a4 | 冬の麦と落ち葉に告げる別れ | gcsim 対象外 | — | — | 未実装（gcsim にキャラが無い） |
| オデット | a1 | 選ばれし者の祝祭 | 常時 | — | odette-a1-buff |  |
| オデット | a4 | 誠実なる者の悲しき歌 | gcsim 対象外 | — | — | a4 の関数はあるが、状態のキー（AddStatus / mod）の登録が無い（ステータス加算など。gcsim が効果を状態として持たない） |

## 3. 命ノ星座の効果（153 定義。時間つきの効果のある凸のみ）

| キャラ | 凸 | 名前 | 分類 | 継続時間（出典） | 対応するキー |
|---|---|---|---|---|---|
| 神里綾華 | 4 | 栄枯盛衰 | gcsim 計算 | 6s（説明文） | ayaka-c4 |
| ジン | 2 | 人々を守る盾 | gcsim 計算 | 15s（説明文） | jean-c2 |
| ジン | 4 | 蒲公英の国土 | 条件付き | — | jean-c4 |
| 空(氷) | 2 | 唸る隕氷 | gcsim 計算 | 5s（説明文） | travelercryo-c2, travelercryo-upgrade-c2 |
| 空(氷) | 6 | 殺める輝氷 | gcsim 計算 | 15s（説明文） | travelercryo-c6 |
| 空(草) | 6 | 蘊思の霜草 | 条件付き | — | dmc-c6 |
| 空(雷) | 2 | 激怒の蒼雷 | gcsim 計算 | 8s（説明文） | travelerelectro-c2 |
| 空(岩) | 1 | 巍然たる青岩 | 条件付き | — | geo-traveler-c1 |
| 空(炎) | 2 | 常明の燭火 | gcsim 計算 | 12s（説明文） | travelerpyro-c2 |
| 空(炎) | 4 | 灼熱の烈火 | gcsim 計算 | 9s（説明文） | travelerpyro-c4 |
| リサ | 2 | 空間電位の結界 | 条件付き | — | lisa-c2 |
| 蛍(氷) | 2 | 唸る隕氷 | gcsim 計算 | 5s（説明文） | travelercryo-c2, travelercryo-upgrade-c2 |
| 蛍(氷) | 6 | 殺める輝氷 | gcsim 計算 | 15s（説明文） | travelercryo-c6 |
| 蛍(草) | 6 | 蘊思の霜草 | 条件付き | — | dmc-c6 |
| 蛍(雷) | 2 | 激怒の蒼雷 | gcsim 計算 | 8s（説明文） | travelerelectro-c2 |
| 蛍(岩) | 1 | 巍然たる青岩 | 条件付き | — | geo-traveler-c1 |
| 蛍(炎) | 2 | 常明の燭火 | gcsim 計算 | 12s（説明文） | travelerpyro-c2 |
| 蛍(炎) | 4 | 灼熱の烈火 | gcsim 計算 | 9s（説明文） | travelerpyro-c4 |
| バーバラ | 2 | 元気溌剌 | gcsim 計算 | 15.017s（gcsim） | barbara-c2 |
| ディルック | 2 | 灼熱余燼 | gcsim 計算 | 10s（説明文） | diluc-c2 |
| ディルック | 4 | 流火焼灼 | gcsim 計算 | 2s（説明文） | diluc-c4 |
| ディルック | 6 | 闇を清算する炎の剣 | gcsim 計算 | 6s（gcsim） | diluc-c6-dmg, diluc-c6-speed |
| レザー | 1 | 狼の性 | gcsim 計算 | 8s（説明文） | razor-c1 |
| レザー | 4 | 噛みつく | gcsim 計算 | 7s（説明文） | razor-c4 |
| レザー | 6 | 天狼 | gcsim 計算 | 15s（gcsim） | razor-hexerei-c6-buff |
| アンバー | 6 | 野火の如く | gcsim 計算 | 10s（説明文） | amber-c6 |
| ウェンティ | 2 | 恋い焦がれるそよ風 | gcsim 計算 | 10s（説明文） | venti-c2-anemo, venti-c2-phys |
| ウェンティ | 4 | 自由の凛風 | gcsim 計算 | 10s（説明文） | venti-c4 |
| 香菱 | 1 | 外カリ中フワ | gcsim 計算 | 6s（説明文） | xiangling-c1 |
| 香菱 | 2 | 強火と油 | gcsim 計算 | 2s（gcsim） | xiangling-c2 |
| 北斗 | 4 | 星に導かれた岸線 | gcsim 計算 | 10s（説明文） | beidou-c4 |
| 行秋 | 2 | 青空の虹 | gcsim 計算 | 4s（説明文） | xingqiu-c2 |
| 魈 | 6 | 降魔·護法夜叉 | gcsim 計算 | 1s（説明文） | xiao-c6 |
| クレー | 2 | 弾丸の破片 | gcsim 計算 | 10s（説明文） | kleec2 |
| クレー | 6 | 火力全開 | gcsim 計算 | 25s（説明文） | klee-c6 |
| フィッシュル | 6 | 永夜の禽 | gcsim 計算 | 10s（gcsim） | fischl-c6-hexerei |
| 七七 | 6 | 起死回骸 | 条件付き | — | qiqi-c6 |
| 甘雨 | 1 | 飲露 | gcsim 計算 | 6s（説明文） | ganyu-c1 |
| 甘雨 | 6 | 履虫 | gcsim 計算 | 30s（gcsim） | ganyu-c6 |
| アルベド | 2 | 顕生の宇宙 | gcsim 計算 | 30s（説明文） | albedo-c2 |
| アルベド | 4 | 聖なる堕落 | 条件付き | — | albedo-c4 |
| アルベド | 6 | 無垢なる土 | 条件付き | — | albedo-c6 |
| ディオナ | 6 | キャッツテールが閉店の時 | 条件付き | — | diona-c6, diona-c6-healbonus |
| モナ | 1 | 沈没の預言 | gcsim 計算 | 8s（説明文） | mona-c1 |
| モナ | 2 | 星月の連珠 | gcsim 計算 | 12s（gcsim） | mona-c2-hexerei-post-burst-ca, mona-hexerei-c2-em |
| モナ | 6 | 災厄の修辞 | gcsim 計算 | 8s（説明文） | mona-c6 |
| 刻晴 | 4 | 調律 | gcsim 計算 | 10s（説明文） | keqing-c4 |
| 刻晴 | 6 | 廉貞 | gcsim 計算 | 8s（説明文） | keqing-c6-attack, keqing-c6-burst, keqing-c6-charge, keqing-c6-skill |
| スクロース | 6 | 混元熵増論 | gcsim 計算 | 10s（gcsim） | sucrose-c6 |
| 辛炎 | 1 | 絶命の加速 | gcsim 計算 | 5s（説明文） | xinyan-c1 |
| 辛炎 | 4 | リズムの伝染 | gcsim 計算 | 12s（説明文） | xinyan-c4 |
| ロサリア | 1 | 罪の導き | gcsim 計算 | 4s（説明文） | rosaria-c1-dmg, rosaria-c1-speed |
| ロサリア | 6 | 代行裁判 | gcsim 計算 | 10s（説明文） | rosaria-c6 |
| 胡桃 | 4 | 花室の添い寝 | gcsim 計算 | 15s（説明文） | hutao-c4 |
| 胡桃 | 6 | 冥蝶の抱擁 | gcsim 計算 | 10s（説明文） | hutao-c6 |
| 楓原万葉 | 2 | 山嵐残心 | 条件付き | — | kazuha-c2 |
| 楓原万葉 | 6 | 血赤の紅葉 | gcsim 計算 | 5s（説明文） | kazuha-c6-dmgup |
| 宵宮 | 1 | 紅玉の琉金 | gcsim 計算 | 20s（説明文） | yoimiya-c1 |
| 宵宮 | 2 | 万燈の火 | gcsim 計算 | 6s（説明文） | yoimiya-c2 |
| トーマ | 6 | 燃え立つ誠心 | gcsim 計算 | 6s（説明文） | thoma-c6 |
| 雷電将軍 | 4 | 常道への誓い | gcsim 計算 | 10s（gcsim） | raiden-c4 |
| 珊瑚宮心海 | 4 | 月に摂す千の川 | gcsim 計算 | 10s（gcsim） | kokomi-c4 |
| 珊瑚宮心海 | 6 | 珊瑚一心 | gcsim 計算 | 4s（説明文） | kokomi-c6 |
| ゴロー | 6 | 犬勇·忠に厚きこと山の如く | gcsim 計算 | 12s（説明文） | gorou-c6 |
| 九条裟羅 | 6 | 我界 | gcsim 計算 | 6s（gcsim） | sara-c6 |
| 荒瀧一斗 | 4 | 奉行牢獄、御食事処 | gcsim 計算 | 10s（説明文） | itto-c4 |
| 八重神子 | 1 | 野狐供真編 | 条件付き | — | yae-c1-electro, yae-c1-ssc |
| 八重神子 | 4 | 緋櫻誘雷章 | gcsim 計算 | 5s（説明文） | yaemiko-c4 |
| 鹿野院平蔵 | 1 | 通称少年事件簿 | gcsim 計算 | 5s（説明文） | heizou-c1 |
| 夜蘭 | 4 | 騙し取る者、移花接木 | gcsim 計算 | 25s（説明文） | yelan-c4 |
| 綺良々 | 6 | 道中百景心得たり | gcsim 計算 | 15s（説明文） | kirara-c6 |
| 申鶴 | 4 | 洞観 | gcsim 計算 | 60s（説明文） | shenhe-c4 |
| 雲菫 | 2 | 諸般切末 | gcsim 計算 | 12s（説明文） | yunjin-c2 |
| 雲菫 | 4 | 昇堂吊雲 | gcsim 計算 | 12s（説明文） | yunjin-c4 |
| 雲菫 | 6 | 荘諧併持 | gcsim 計算 | 12s（gcsim） | yunjin-c6 |
| 久岐忍 | 6 | 捨て去りし軟弱な心 | gcsim 計算 | 15s（説明文） | kuki-c6 |
| 神里綾人 | 4 | 細流厭わず | gcsim 計算 | 15s（説明文） | ayato-c4 |
| コレイ | 4 | ギフトオブフォレスト | gcsim 計算 | 12s（説明文） | collei-c4 |
| ドリー | 4 | 益をとって損を補う | 条件付き | — | dori-c4-er-bonus, dori-c4-healbonus |
| ティナリ | 2 | 茎から分析する由来 | gcsim 計算 | 6s（説明文） | tighnari-c2 |
| ティナリ | 4 | 葉から垣間見る盛衰 | gcsim 計算 | 8s（説明文） | tighnari-c4 |
| ニィロウ | 2 | 星天の花雨 | gcsim 計算 | 10s（説明文） | nilou-c2-dendro, nilou-c2-hydro |
| ニィロウ | 4 | 清漣の音節 | gcsim 計算 | 8s（説明文） | nilou-c4 |
| セノ | 1 | 立儀·俯瞰晦冥 | gcsim 計算 | 10s（説明文） | cyno-c1 |
| セノ | 2 | 令儀·拝謁返霊 | gcsim 計算 | 4s（説明文） | cyno-c2 |
| セノ | 6 | 羽儀·裁落鈞衡 | gcsim 計算 | 8s（gcsim） | cyno-c6 |
| キャンディス | 2 | 貫月の鋒芒 | gcsim 計算 | 15s（説明文） | candace-c2 |
| ナヒーダ | 2 | 正覚善見の根 | gcsim 計算 | 8s（説明文） | nahida-c2 |
| ナヒーダ | 6 | 大辯円成の実 | gcsim 計算 | 10s（説明文） | nahida-c6 |
| レイラ | 4 | 啓示を照らす星芒 | gcsim 計算 | 3s（説明文） | layla-c4 |
| 放浪者 | 1 | 初番·茂風流羽行 | gcsim 計算 | 20s（gcsim） | wanderer-c1-atkspd |
| ファルザン | 6 | 妙道合一 | gcsim 計算 | 4s（gcsim） | faruzan-c6 |
| ヨォーヨ | 1 | 瑶閣賜物 | gcsim 計算 | 8s（説明文） | yaoyao-c1 |
| ヨォーヨ | 4 | 愛嬌悠々 | gcsim 計算 | 8s（説明文） | yaoyao-c4 |
| アルハイゼン | 2 | ディベート | gcsim 計算 | 8s（説明文） | alhaitham-c2-1-stack, alhaitham-c2-2-stack, alhaitham-c2-3-stack, alhaitham-c2-4-stack |
| アルハイゼン | 4 | エルシデーション | gcsim 計算 | 15s（説明文） | alhaitham-c4-gain, alhaitham-c4-loss |
| アルハイゼン | 6 | ストラクタレーション | gcsim 計算 | 6s（説明文） | alhaitham-c6 |
| ミカ | 6 | 臨機の策応 | gcsim 計算 | 12s（gcsim） | mika-c6 |
| カーヴェ | 1 | イーワーンにて謁見 | gcsim 計算 | 3s（説明文） | kaveh-c1 |
| カーヴェ | 2 | キャラバンサライの轍 | gcsim 計算 | 12s（gcsim） | kaveh-c2 |
| 白朮 | 4 | 古法故視 | gcsim 計算 | 15s（説明文） | baizhu-c4 |
| リネット | 6 | 真意看破の双眸 | gcsim 計算 | 6s（説明文） | lynette-c6-buff |
| リネ | 4 | 熟知熟練の方策 | gcsim 計算 | 6s（説明文） | lyney-c4 |
| フレミネ | 4 | 雪の月とあし笛の舞 | gcsim 計算 | 6s（説明文） | freminet-c4 |
| フレミネ | 6 | 目覚めと決意の刻 | gcsim 計算 | 6s（説明文） | freminet-c6 |
| リオセスリ | 4 | 苦に喘ぐ者に救いを | gcsim 計算 | 4s（gcsim） | wriothesley-c4-spd |
| シャルロット | 1 | 検証を以て制約と為す | gcsim 計算 | 6s（gcsim） | charlotte-c1 |
| シャルロット | 2 | 求真を以て職責と為す | gcsim 計算 | 12s（説明文） | charlotte-c2 |
| フリーナ | 6 | 「僕の歌を聴きたまえ—— さあ 愛の杯を掲げよう！」 | gcsim 計算 | 2.9s（gcsim） | furina-c6-ousia-heal |
| シュヴルーズ | 4 | 多重速射の秘訣 | gcsim 計算 | 6s（説明文） | chev-c4 |
| ナヴィア | 4 | 誓約者の非妥協 | gcsim 計算 | 8s（説明文） | navia-c4-shred |
| 嘉明 | 2 | 梅花踏歩 | gcsim 計算 | 5s（説明文） | gaming-c2 |
| 閑雲 | 2 | 俗世を離れた鶴鳴 | gcsim 計算 | 15s（説明文） | xianyun-c2 |
| 閑雲 | 6 | 留雲を仙と覚る | gcsim 計算 | 16s（説明文） | xianyun-c6 |
| 千織 | 4 | 衣裁三礼 | gcsim 計算 | 8s（説明文） | chiori-c4, chiori-c4-lockout |
| シグウィン | 2 | 「誰よりも優しい精霊なら 恨みを消し去れるのかしら」 | gcsim 計算 | 8s（説明文） | sigewinne-c2 |
| シグウィン | 6 | 「誰よりも輝く精霊なら 私に祈ってくれるのかしら」 | gcsim 計算 | 15s（説明文） | sigewinne-c6 |
| アルレッキーノ | 6 | 「この先、我々は ——新しき生に興じる」 | gcsim 計算 | 20s（説明文） | arlecchino-c6 |
| セトス | 2 | 寂秘のパピルス | gcsim 計算 | 10s（説明文） | sethos-c2-burst |
| セトス | 4 | 真実のプリュマージュ | gcsim 計算 | 10s（説明文） | sethos-c4 |
| エミリエ | 2 | 湖光のトップノート | gcsim 計算 | 10s（説明文） | emilie-c2 |
| エミリエ | 6 | マルコットの残香 | gcsim 計算 | 5s（説明文） | emilie-c6 |
| キィニチ | 2 | 星虎の掌 | gcsim 計算 | 6s（説明文） | kinich-c2 |
| シロネン | 4 | 午睡トランス | gcsim 計算 | 15s（説明文） | xilonen-c4 |
| シロネン | 6 | 永夜カーニバル | gcsim 計算 | 5s（説明文） | xilonen-c6 |
| チャスカ | 6 | 対決・闘争のグローリー | gcsim 計算 | 3s（説明文） | chasca-c6 |
| オロルン | 2 | 蜜酒を隠す王蜂 | gcsim 計算 | 9s（説明文） | ororon-c2 |
| オロルン | 6 | 深泉に贈る礼讃 | gcsim 計算 | 9s（説明文） | ororon-c6 |
| マーヴィカ | 1 | 夜の主の授記 | gcsim 計算 | 8s（説明文） | mavuika-c1 |
| マーヴィカ | 2 | 灰燼の代償 | 条件付き | — | mavuika-c2 |
| 藍硯 | 4 | 「龍鷹集いて血珠を成す」 | gcsim 計算 | 12s（説明文） | lanyan-c4 |
| 夢見月瑞希 | 1 | 瑞枝さす | gcsim 計算 | 3s（gcsim） | mizuki-c1 |
| ヴァレサ | 4 | 突き進む勇気 | gcsim 計算 | 15s（説明文） | diligent-refinement |
| エスコフィエ | 1 | 味覚咲かす オードブルの円舞 | gcsim 計算 | 15s（説明文） | escoffier-c1 |
| エスコフィエ | 2 | 濃厚ポトフの芸術 | gcsim 計算 | 15s（説明文） | escoffier-c2 |
| イファ | 4 | 朽ちた肉体への移植 | gcsim 計算 | 15s（説明文） | ifa-c4 |
| スカーク | 2 | 落淵 | gcsim 計算 | 12.5s（説明文） | skirk-c2 |
| イネファ | 1 | 循環整流器 | gcsim 計算 | 20s（gcsim） | ineffa-c1 |
| ラウマ | 1 | 「唇よ歌を紡ぎて 詩を織りなせ」 | gcsim 計算 | 20s（説明文） | lauma-c1 |
| ラウマ | 6 | 「我が血と涙を 月に捧げ奉らん」 | gcsim 計算 | 15s（gcsim） | lauma-pale-hymn-c6 |
| フリンズ | 2 | 邪悪の壁を超える者 | gcsim 計算 | 6s（gcsim） | flins-c2 |
| アイノ | 1 | 灰と力場のバランス理論 | gcsim 計算 | 15s（説明文） | aino-c1 |
| アイノ | 6 | 天才なりの構築責任 | gcsim 計算 | 15s（説明文） | aino-c6 |
| ドゥリン | 6 | 二重の誕生 | gcsim 計算 | 6s（説明文） | durin-c6 |
| ヤフォダ | 6 | ほんの小さな幸運 | gcsim 計算 | 20s（説明文） | jahoda-c6 |
| コロンビーナ | 2 | 夜輝かす君と共に在る光 | gcsim 計算 | 8s（説明文） | columbina-c2, columbina-c2-lb, columbina-c2-lc, columbina-c2-lcr |
| コロンビーナ | 6 | 暗き夜の月と共に往く道 | gcsim 計算 | 8s（説明文） | columbina-c6-lb, columbina-c6-lc, columbina-c6-lcr |
| イルーガ | 4 | 日逐いの狼 | 条件付き | — | illuga-c4 |
| ファルカ | 6 | 「愛しきモンドよ、変わらぬ姿で」 | 条件付き | — | varka-c6-free-charge, varka-c6-free-skill |
| ニコ | 2 | 「汝に汝の 行くべき道を示さん」 | gcsim 計算 | 20s（gcsim） | nicole-c2 |
| ニコ | 4 | 「たとえ汝が 何処へ赴こうとも」 | gcsim 計算 | 20s（説明文） | nicole-c4 |
| プルーネ | 6 | 物語はこれでおしまい みんなに話してあげて | gcsim 計算 | 5.5s（gcsim） | prune-c6-self-buff, prune-c6-window |
| オデット | 4 | 「燃ゆる青空の中へ 恍惚と堕ちていく」 | gcsim 計算 | 20s（gcsim） | odette-snow-swans-dream |

## 4. 対応付けされなかった固有天賦・命ノ星座のキー（36 件）

定義に対応付けなかった理由の内訳: 永続・時間不明のキー（時間つきのキーがある枠では、時間つきだけを対応付ける）、ハクスレイ系（`hexInit` など。枠 a1 / a4 に属さない追加の固有天賦）、`passive`（枠の無い固有天賦）、関数名・キー名に枠が読めないもの。

- 空(風) [命ノ星座] amc-c6-* (600f) 関数:c6cb
- 蛍(風) [命ノ星座] amc-c6-* (600f) 関数:c6cb
- ウェンティ [命ノ星座] venti-c6-{element} (600f) 関数:c6
- 香菱 [命ノ星座] xiangling-c6 (時間不明) 関数:c6
- 香菱 [命ノ星座] xlc6 (時間不明) 関数:c6
- フィッシュル [固有天賦] fischl-hexerei-atkp (永続) 関数:hexInit
- フィッシュル [固有天賦] fischl-hexerei-em (永続) 関数:hexInit
- モナ [固有天賦] mona-astral-glow (480f) 関数:astralGlowGainCB
- モナ [固有天賦] mona-hexerei-astral-glow-vaporize (永続) 関数:hexInit
- モナ [固有天賦] omen-debuff (時間不明) 関数:triggerBubbleBurst/triggerOmenRefresh
- スクロース [固有天賦] sucrose-hexerei-burst (1200f) 関数:hexOnBurst
- スクロース [固有天賦] sucrose-hexerei-skill (900f) 関数:hexOnSkill
- 珊瑚宮心海 [固有天賦] kokomi-passive (永続) 関数:passive
- 申鶴 [命ノ星座] shenhe-c2 (時間不明) 関数:c2
- 放浪者 [固有天賦] wanderer-a4-prevent (20f) 関数:a4
- 放浪者 [命ノ星座] wanderer-c2-burstbonus (時間不明) 関数:c2
- シュヴルーズ [命ノ星座] chev-c6-*-stack (480f) 関数:c6
- 嘉明 [命ノ星座] gaming-c4 (12f) 関数:makeC4CB
- 閑雲 [固有天賦] xianyun-a1-buff (永続) 関数:a1
- 千織 [固有天賦] chiori-a1-window (時間不明) 関数:activateA1Window
- アルレッキーノ [固有天賦] arlecchino-passive (永続) 関数:passive
- クロリンデ [命ノ星座] clorinde-c6-cr-bonus (時間不明) 関数:c6skill
- シロネン [固有天賦] xilonen-a1 (永続) 関数:a1
- マーヴィカ [固有天賦] mavuika-a4-buff (永続) 関数:a4Init
- イアンサ [命ノ星座] iansan-c6 (180f) 関数:c6OnOverflow
- イネファ [固有天賦] ineffa-a4-buff (永続) 関数:a4Init
- ドゥリン [固有天賦] durin-a1-{element} (360f) 関数:a1Init/a1MakeResShred
- ドゥリン [命ノ星座] durin-c2-{element} (360f) 関数:c2MakeBuff
- ファルカ [固有天賦] varka-a1-{element} (永続) 関数:a1Init
- ファルカ [固有天賦] varka-a4 (永続) 関数:a4Init
- ファルカ [命ノ星座] varka-c4-{element} (600f) 関数:makeC4CB
- ニコ [命ノ星座] nicole-c2-* (60f) 関数:c2Ticker
- プルーネ [命ノ星座] prune-c2 (時間不明) 関数:c2OnBurst
- プルーネ [固有天賦] prune-hex-self-buff (300f) 関数:hexInit
- プルーネ [固有天賦] prune-hex-team-buff (300f) 関数:hexInit
- オデット [命ノ星座] odette-c2-{element} (120f) 関数:c2Ticker
