# 発動バフの一覧比較: アプリ側の追加ボタン と gcsim 側の効果キー（2026-09-29 調査）

フェーズ5（キーの辞書）・フェーズ6（書き戻し）の前提となる調査。**正規表現による概算**であり、確定値ではない。

## 調査の方法と限界

- **アプリ側**: マスターデータ（`characters_master_data.json` / `weapons_master_data.json` / `artifacts_master_data.json`）の、固有天賦 `passiveEffects`、武器・聖遺物の `buffEffects`（精錬ごとの分を含む）。これが「発動バフ」の追加ボタンになる（`StintBuffTriggersSection.tsx`）。
- **gcsim 側**: gcsim ソース（`internal/characters`・`internal/weapons`・`internal/artifacts` の `.go` 1,686 ファイル）から、`AddStatus(キー, 持続)` と `modifier.NewBase(WithHitlag)(キー, 持続)` の呼び出しを抽出（1,488 件）。キー・持続が定数の場合は同じパッケージの定義から解決。持続の単位はフレーム（60fps）で、-1 は永続（常時効果）。
- 限界: キーが `fmt.Sprintf` など動的なもの 78 件、持続が式で解決できないもの 145 件は未解決。`pkg/` 配下（元素共鳴・システム・敵デバフ）は対象外。武器・聖遺物のパッケージは `zz_<キー>.dm.go` の位置で gcsim キーと対応付けたが、共有パッケージ（`weapons/common`: 黒岩・金璋君臨など）は個別の武器に割り当てられていない。CT/ICD は、キーに `icd` / `cd` を含むものだけを判定した。

## 件数

| 区分 | アプリ側の追加ボタン | gcsim 側で効果キーがあるもの |
|---|---|---|
| 固有天賦 | 260 個（127 キャラ×2）。うち時間（効果時間・CT）が無いもの 149 個 | 時間付き効果を持つ 64 キャラ、永続のみ 21 キャラ |
| 武器 | 186 個（184 武器）。すべて時間あり | 187 武器（時間付き 7 ＋ 永続のみ 37 ＋ 両方にある 143） |
| 聖遺物 | 41 個（41 セット）。すべて時間あり | 55 セット（うち gcsim のみの 16 セットは全て永続） |
| 命ノ星座 | **ボタン無し** | 時間付き効果を持つ 88 キャラ、永続のみ 14 キャラ |
| スキル・爆発の効果 | ボタンではなく、アクションの効果継続時間から自動（`effectDuration`） | 時間付き 51 / 52 キャラ |

## 差異 1: gcsim にあってアプリ側にボタンが無い

- **命ノ星座**: 時間付き効果を持つ 88 キャラ（アプリは命ノ星座の効果をボタン・バーにしていない。フェーズ3b の範囲は効果時間の延長のみ）。
- **固有天賦**: gcsim に時間付きのキーがあるが、アプリのボタンに時間が無い 13 キャラ: クレー、フィッシュル、夜蘭、アーロイ、セノ、ナヒーダ、放浪者、ミカ、カーヴェ、セトス、クロリンデ、スカーク、イルーガ。
- **武器**: gcsim にあってアプリのボタンが無い 44 件。うち**時間付き**は若水、アースシェイカー、狼の武勲詩（記載は「継続時間は○秒」の読み取り漏れ、全体計画 10 章）、ストロング・ボーン、笛の剣、裁断の6件（＋共有パッケージ）。残り 37 件は永続（常時）効果のみで、バー表示の対象にならない。
- **聖遺物**: 16 セット（狂戦士、氷風を彷徨う勇士 など）。全て永続（2セット・4セットの常時効果）で、バー表示の対象にならない。

## 差異 2: アプリ側にボタンがあり gcsim 側に効果キーが無い

- **武器 33 件**（下記）。内訳は、粒子・回復・エネルギー（西風系 5、金珀・試作）、スキルCTリセット（祭礼系 4）、CT のみの効果（蒼紋の角杯、ドラゴンスピア、鉾槍、文使い など）、共有パッケージのもの（黒岩系 5、金璋君臨系 4: 浮世の錠・斬山の刃・無工の剣・破天の槍 ＝ 実際は gcsim の `weapons/common` にキーがあり、対応付けの限界による見かけの差）。
- **聖遺物**: 差異なし（0 件）。
- **固有天賦**: アプリに時間があるが gcsim の asc 系ファイルに時間付きキーが無い 11 キャラ: 旅人(風)、ウェンティ、ノエル、ディオナ、トーマ、鹿野院平蔵、コレイ、ヨォーヨ、ムアラニ、ラウマ、ニコ（キーが別のファイルにあるか、gcsim が効果を状態として持たない）。
- **gcsim キー無しのキャラ**: 9 キャラ（アリョーシャ、カチーナ、サンドローネ、ネフェル、リンネア、ローエン、ヴェスナ、ヴォジャニーツァ、兹白）の 19 ボタンは、gcsim では実行できない。
- **時間の無いボタン**: 固有天賦 149 個（260 個中）は効果時間・CT が無い。説明の表示だけのボタンで、バーは出ない。

## 詳細（武器・聖遺物）

### 武器
- gcsim 側: 効果キーがあるもの 187 件、うち効果持続が数値で読めるもの 175 件、CT/ICD のキーと数値があるもの 74 件
- アプリ側: 追加ボタンがあるもの 176 件（gcsim キー付き）
- **gcsim にあってアプリにボタンが無い: 44 件**
  - ダークアレイの狩人 (`alleyhunter`): [('alley-hunter', -0.02)]
  - アモスの弓 (`amosbow`): [('amos', -0.02)]
  - 若水 (`aquasimulacra`): [('aquasimulacra-hp', -0.02), ('aquasimulacra-dmg', 1.2)]
  - 千夜に浮かぶ夢 (`athousandfloatingdreams`): [('?fmt.Sprintf("a-thousand-floating-dreams-', -0.02), ('a-thousand-floating-dreams', -0.02)]
  - フィヨルドの歌 (`balladofthefjords`): [('balladofthefjords', -0.02)]
  - 烏髄の孤灯 (`blackmarrowlantern`): [('blackmarrow-lantern', -0.02)]
  - 龍血を浴びた剣 (`bloodtaintedgreatsword`): [('bloodtaintedgreatsword', -0.02)]
  - 厄水の災い (`calamityofeshu`): [('calamityofeshu', -0.02)]
  - チェーンブレイカー (`chainbreaker`): [('chain-breaker-atk', -0.02), ('chain-breaker-em', -0.02)]
  - (アプリ側に該当なし) (`common`): [('?stackKey[index]', 30.0), ('blackcliff', 30.0), ('golden-majesty', 8.0)]
  - 冷刃 (`coolsteel`): [('coolsteel', -0.02)]
  - 死闘の槍 (`deathmatch`): [('deathmatch', -0.02)]
  - 匣中滅龍 (`dragonsbane`): [('dragonbane', -0.02)]
  - アースシェイカー (`earthshaker`): [('earth-shaker', 8.0)]
  - 鉄影段平 (`ferrousshadow`): [('ferrousshadow', -0.02)]
  - 腐植の剣 (`festeringdesire`): [('festering', -0.02)]
  - 花飾りの羽 (`flowerwreathedfeathers`): [('flowerwreathedfeathers', -0.02)]
  - 満悦の実 (`fruitoffulfillment`): [('fruitoffulfillment', -0.02)]
  - 狼の武勲詩 (`gestofthemightywolf`): [('gest-of-the-mighty-wolf-atkspd', -0.02), ('gest-of-the-mighty-wolf-stacks', 4.0)]
  - 破魔の弓 (`hamayumi`): [('hamayumi', -0.02)]
  - 黎明の神剣 (`harbingerofdawn`): [('harbinger', -0.02)]
  - 千鈞懸黎 (`jadevista`): [('jade-vista', -0.02)]
  - 匣中龍吟 (`lionsroar`): [('lionsroar', -0.02)]
  - 四風原典 (`lostprayertothesacredwinds`): [('lost-prayer', -0.02)]
  - 魔導緒論 (`magicguide`): [('magic-guide', -0.02)]
  - 月紡ぎの曙光 (`moonweaversdawn`): [('moonweavers-dawn', -0.02)]
  - 磐岩結緑 (`primordialjadecutter`): [('jadecutter-hp', -0.02), ('jadecutter-atk-buff', -0.02)]
  - 金掘りのシャベル (`prospectorsshovel`): [('prospectors-shovel', -0.02)]
  - 雨裁 (`rainslasher`): [('rainslasher', -0.02)]
  - 鴉羽の弓 (`ravenbow`): [('ravenbow', -0.02)]
  - 赤角石塵滅砕 (`redhornstonethresher`): [('redhorn-stonethrasher-def-boost', -0.02)]
  - 弓蔵 (`rust`): [('rust', -0.02)]
  - 螭龍の剣 (`serpentspine`): [('spine', -0.02)]
  - シャープシューターの誓い (`sharpshootersoath`): [('sharpshooter', -0.02)]
  - 弾弓 (`slingshot`): [('slingshot', -0.02)]
  - 護摩の杖 (`staffofhoma`): [('homa-hp', -0.02), ('homa-atk-buff', -0.02)]
  - ストロング・ボーン (`sturdybone`): [('sturdy-bone', 7.0)]
  - 「漁獲」 (`thecatch`): [('the-catch', -0.02)]
  - 始まりの大魔術 (`thefirstgreatmagic`): [('thefirstgreatmagic-atk', -0.02), ('thefirstgreatmagic-dmg%', -0.02)]
  - 笛の剣 (`theflute`): [('flute-stack-duration', 30.0)]
  - 絶弦 (`thestringless`): [('stringless', -0.02)]
  - 「スーパーアルティメット覇王魔剣」 (`ultimateoverlordsmegamagicsword`): [('ultimateoverlordsmegamagicsword', -0.02)]
  - 裁断 (`verdict`): [('verdict-atk', -0.02), ('verdict-skill-dmg', 15.0), ('verdict-dmg-window', 0.2)]
  - 白纓槍 (`whitetassel`): [('whitetassel', -0.02)]
- **アプリにボタンがあり gcsim に効果キーが無い: 33 件**
  - 蒼紋の角杯 (`ashgravendrinkinghorn`): アプリ側 [('蒼紋の角杯: トゥパック·グリップ', None, 15)]
  - 黒岩の緋玉 (`blackcliffagate`): アプリ側 [('黒岩の緋玉: 勝ちに乗じる', 30, None)]
  - 黒岩の長剣 (`blackclifflongsword`): アプリ側 [('黒岩の長剣: 勝ちに乗じる', 30, None)]
  - 黒岩の突槍 (`blackcliffpole`): アプリ側 [('黒岩の突槍: 勝ちに乗じる', 30, None)]
  - 黒岩の斬刀 (`blackcliffslasher`): アプリ側 [('黒岩の斬刀: 勝ちに乗じる', 30, None)]
  - 黒岩の戦弓 (`blackcliffwarbow`): アプリ側 [('黒岩の戦弓: 勝ちに乗じる', 30, None)]
  - 砂中の賢者達の問答 (`dialoguesofthedesertsages`): アプリ側 [('砂中の賢者達の問答: 均衡の原理', None, 10)]
  - ドラゴンスピア (`dragonspinespear`): アプリ側 [('ドラゴンスピア: 霜の埋葬', None, 10)]
  - 西風秘典 (`favoniuscodex`): アプリ側 [('西風秘典: 無色粒子生成', 0.1, 6)]
  - 西風大剣 (`favoniusgreatsword`): アプリ側 [('西風大剣: 無色粒子生成', 0.1, 6)]
  - 西風長槍 (`favoniuslance`): アプリ側 [('西風長槍: 無色粒子生成', 0.1, 6)]
  - 西風剣 (`favoniussword`): アプリ側 [('西風剣: 無色粒子生成', 0.1, 6)]
  - 西風猟弓 (`favoniuswarbow`): アプリ側 [('西風猟弓: 無色粒子生成', 0.1, 6)]
  - チ虎魚の刀 (`filletblade`): アプリ側 [('チ虎魚の刀: 切り捨て', None, 11)]
  - 冬忍びの実 (`frostbearer`): アプリ側 [('冬忍びの実: 霜の埋葬', None, 10)]
  - 鉾槍 (`halberd`): アプリ側 [('鉾槍: 過重', None, 10)]
  - 浮世の錠 (`memoryofdust`): アプリ側 [('浮世の錠: 金璋君臨', 8, None)]
  - 文使い (`messenger`): アプリ側 [('文使い: 矢文', None, 10)]
  - 金珀·試作 (`prototypeamber`): アプリ側 [('金珀: 回復&エネルギー再生', 6, None)]
  - 古華·試作 (`prototypearchaic`): アプリ側 [('古華·試作: 粉砕', None, 15)]
  - 正義の報酬 (`rightfulreward`): アプリ側 [('正義の報酬: 槍の穂先', None, 10)]
  - 祭礼の弓 (`sacrificialbow`): アプリ側 [('祭礼の弓: スキルCTリセット', 0.1, 16)]
  - 祭礼の断片 (`sacrificialfragments`): アプリ側 [('祭礼の断片: スキルCTリセット', 0.1, 16)]
  - 祭礼の大剣 (`sacrificialgreatsword`): アプリ側 [('祭礼の大剣: スキルCTリセット', 0.1, 16)]
  - 祭礼の剣 (`sacrificialsword`): アプリ側 [('祭礼の剣: スキルCTリセット', 0.1, 16)]
  - 冷寂の音 (`sequenceofsolitude`): アプリ側 [('冷寂の音: サイレント・トリガー', None, 15)]
  - 雪葬の星銀 (`snowtombedstarsilver`): アプリ側 [('雪葬の星銀: 霜の埋葬', None, 10)]
  - 斬山の刃 (`summitshaper`): アプリ側 [('斬山の刃: 金璋君臨', 8, None)]
  - 水仙十字の剣 (`swordofnarzissenkreuz`): アプリ側 [('水仙十字の剣: 勇者の剣', None, 12)]
  - 話死合い棒 (`talkingstick`): アプリ側 [('話死合い棒: 「口八丁」', 15, 12)]
  - 無工の剣 (`theunforged`): アプリ側 [('無工の剣: 金璋君臨', 8, None)]
  - 蒼翠の狩猟弓 (`theviridescenthunt`): アプリ側 [('蒼翠の狩猟弓: 蒼翠の風', 4, 10)]
  - 破天の槍 (`vortexvanquisher`): アプリ側 [('破天の槍: 金璋君臨', 8, None)]

### 聖遺物
- gcsim 側: 効果キーがあるもの 55 件、うち効果持続が数値で読めるもの 55 件、CT/ICD のキーと数値があるもの 5 件
- アプリ側: 追加ボタンがあるもの 39 件（gcsim キー付き）
- **gcsim にあってアプリにボタンが無い: 16 件**
  - 狂戦士 (`berserker`): [('berserker-2pc', -0.02), ('berserker-4pc', -0.02)]
  - 氷風を彷徨う勇士 (`blizzardstrayer`): [('bs-2pc', -0.02), ('bs-4pc', -0.02)]
  - 勇士の心 (`braveheart`): [('braveheart-2pc', -0.02), ('braveheart-4pc', -0.02)]
  - 守護の心 (`defenderswill`): [('defenderswill-2pc', -0.02)]
  - 影に沈む幻 (`disenchantmentindeepshadow`): [('disenchantment-2pc', -0.02), ('disenchantment-4pc-dmg', -0.02), ('disenchantment-4pc-cr', -0.02)]
  - 来歆の余響 (`echoesofanoffering`): [('echoes-2pc', -0.02)]
  - 絶縁の旗印 (`emblemofseveredfate`): [('emblem-2pc', -0.02), ('emblem-4pc', -0.02)]
  - 剣闘士のフィナーレ (`gladiatorsfinale`): [('glad-4pc', -0.02), ('glad-2pc', -0.02)]
  - 華館夢醒形骸記 (`huskofopulentdreams`): [('husk-2pc', -0.02), ('?s.stackGainICDKey', None), ('husk-4pc', -0.02)]
  - 烈火を渡る賢者 (`lavawalker`): [('lavawalker-4pc', -0.02)]
  - 旅人の心 (`resolutionofsojourner`): [('sojourner-2pc', -0.02), ('sojourner-4pc', -0.02)]
  - 逆飛びの流星 (`retracingbolide`): [('bolide-4pc', -0.02)]
  - 雷のような怒り (`thunderingfury`): [('tf-2pc', -0.02), ('tf-4pc', -0.02)]
  - 雷を鎮める尊者 (`thundersoother`): [('ts-4pc', -0.02)]
  - 遂げられなかった想い (`unfinishedreverie`): [('unfinishedreverie-2pc', -0.02), ('unfinishedreverie-4pc', -0.02)]
  - 大地を流浪する楽団 (`wandererstroupe`): [('wt-4pc', -0.02), ('wt-2pc', -0.02)]
- **アプリにボタンがあり gcsim に効果キーが無い: 0 件**
