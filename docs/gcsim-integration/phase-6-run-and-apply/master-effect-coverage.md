# マスター効果とgcsimキーの対応表（カバレッジ）

作成: 2026-10-01 / gcsim辞書コミット 1e6c1a86 / 生成: `npm run coverage:master-effects`

対象は固有天賦・命ノ星座・武器・聖遺物・元素共鳴。アクション効果用の `effect_key_coverage.json` とは別ファイルで管理し、将来統合できる `effects` / `targets` / `links` / `unlinked` 形式を使う。
「未確認」はマスター側の対象またはgcsimキー側の効果について、対応付け・理由付き対象外・保留のいずれも無い状態。

## gcsimキー（1111件）

| 分類 / 状態 | 件数 |
|---|---:|
| artifact / excluded | 56 |
| artifact / linked | 67 |
| artifact / pending | 15 |
| burst / linked | 9 |
| character / linked | 4 |
| constellation / excluded | 20 |
| constellation / linked | 191 |
| constellation / pending | 62 |
| constellation / unreviewed | 51 |
| skill / linked | 7 |
| system / linked | 8 |
| talent / excluded | 28 |
| talent / linked | 179 |
| talent / unreviewed | 1 |
| weapon / excluded | 36 |
| weapon / linked | 331 |
| weapon / pending | 45 |
| weapon / unreviewed | 1 |

## マスター対象（674件）

| 種別 / 状態 | 件数 |
|---|---:|
| artifact / linked | 38 |
| artifact / unsupported | 3 |
| constellation / linked | 160 |
| resonance / linked | 6 |
| resonance / unreviewed | 1 |
| talent / linked | 157 |
| talent / unsupported | 117 |
| weapon / linked | 171 |
| weapon / unsupported | 21 |

## links（828件）

| 関係 | 件数 |
|---|---:|
| cooldown | 129 |
| effect | 603 |
| extra | 89 |
| resonance | 7 |

## 保留（122件）

- effect a-thousand-floating-dreams: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect a-thousand-floating-dreams-party-*: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect alley-hunter: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect amber-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect amc-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect amos: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect ayaka-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect ayato-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect ayato-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect balladofthefjords: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect bennett-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect berserker-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect blackmarrow-lantern: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect bloodtaintedgreatsword: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect bolide-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect braveheart-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect bs-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect calamityofeshu: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect chain-breaker-atk: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect chain-breaker-em: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect chongyun-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect citlali-c2-em: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect citlali-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect clorinde-c4-burst-bonus: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect collei-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect coolsteel: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect deathmatch: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect dehya-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect dehya-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect dehya-sanctum-dot-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect diluc-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect diona-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect disenchantment-4pc-cr: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect disenchantment-4pc-dmg: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect dragonbane: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect durin-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect emblem-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect emilie-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect eula-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect ferrousshadow: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect festering: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect flins-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect flowerwreathedfeathers: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect freminet-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect fruitoffulfillment: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect furina-c2-hp: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect gaming-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect glad-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect hamayumi: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect harbinger: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect homa-atk-buff: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect homa-hp: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect husk-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect iansan-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect itto-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect jade-vista: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect jadecutter-atk-buff: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect jadecutter-hp: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect kaeya-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect kaveh-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect kinich-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect kinich-c4-dmgp: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect lauma-c2-lunarbloom-buff: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect lavawalker-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect layla-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect lionsroar: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect lithic: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect lost-prayer: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect lyney-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect magic-guide: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect mizuki-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect mizuki-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect mona-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect moonweavers-dawn: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect mualani-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect nahida-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect neuvillette-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect nilou-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect nilou-c6-cd: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect nilou-c6-cr: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect noelle-c2-dmg: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect noelle-c2-stam: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect ororon-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect prospectors-shovel: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect qiqi-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect qiqi-c2-radiance: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect rainslasher: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect ravenbow: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect razor-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect redhorn-stonethrasher-def-boost: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect royal: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect rust: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect sayu-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect sethos-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect sharpshooter: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect skirk-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect slingshot: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect sojourner-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect spine: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect stringless: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect tf-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect the-catch: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect thefirstgreatmagic-atk: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect thefirstgreatmagic-dmg%: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect tighnari-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect travelerpyro-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect travelerpyro-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect ts-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect ultimateoverlordsmegamagicsword: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect unfinishedreverie-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect varesa-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect wavebreaker: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect whitetassel: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect wriothesley-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect wt-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect xiao-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect xiao-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect xilonen-c2-buff: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect xinyan-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect yae-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect yae-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect yanfei-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装

## 未確認（54件）

- effect aino-c2-icd: アイノ 命ノ星座2「歯車差分の進数原理」: 発動間隔
- effect aino-c4-icd: アイノ 命ノ星座4「バターと猫と エネルギー供給の法則」: 発動間隔
- effect alhaitham-c1-icd: アルハイゼン 命ノ星座1「イントゥイション」: 発動間隔
- effect arlecchino-c2-icd: アルレッキーノ 命ノ星座2「「あらゆる褒賞と罰は この手によるもの…」」: 発動間隔
- effect arlecchino-c4-icd: アルレッキーノ 命ノ星座4「「これからは互いを慈しみ 手を取り合うとしよう…」」: 発動間隔
- effect baizhu-c2-icd: 白朮 命ノ星座2「脈絡明哲」: 発動間隔
- effect c4-skull-icd: シトラリ 命ノ星座4「拒死者の スピリットスカル」: skull 発動間隔
- effect candace-c6-icd: キャンディス 命ノ星座6「満溢の潮汐」: 発動間隔
- effect charlotte-c6-icd: シャルロット 命ノ星座6「好奇を以て要義と為す」: 発動間隔
- effect chev-c1-icd: シュヴルーズ 命ノ星座1「戦線維持の胆力」: 発動間隔
- effect chev-c2-icd: シュヴルーズ 命ノ星座2「誘導殉爆の狙撃」: 発動間隔
- effect chongyun-c4-icd: 重雲 命ノ星座4「浮雲霜天」: 発動間隔
- effect clorinde-c1-IcdKey: クロリンデ 命ノ星座1「「ここより、 燭影の帷を通る」」: IcdKey
- effect clorinde-c6-cd-bonus: クロリンデ 命ノ星座6「「故に—— 希望を捨ててはならない」」: 発動間隔 ボーナス
- effect clorinde-c6-cr-bonus: クロリンデ 命ノ星座6「「故に—— 希望を捨ててはならない」」: 会心率 ボーナス
- effect clorinde-c6-icd: クロリンデ 命ノ星座6「「故に—— 希望を捨ててはならない」」: 発動間隔
- effect columbina-c1-icd: コロンビーナ 命ノ星座1「花照らし峰に隠れ入る光」: 発動間隔
- effect columbina-c4-icd: コロンビーナ 命ノ星座4「花の嵐や雲と木と岩の陰」: 発動間隔
- effect dahlia-c6-icd: ダリア 命ノ星座6「あらゆる喜びが 君とあらんことを」: 発動間隔
- effect emilie-c1-attack-icd: エミリエ 命ノ星座1「淡く香るフレグランス」: attack 発動間隔
- effect flins-c1-icd: フリンズ 命ノ星座1「雪影の幕をひらく時」: 発動間隔
- effect furina-c4-icd: フリーナ 命ノ星座4「「地獄に堕ちずして いかに生の価値を知る！」」: 発動間隔
- effect gaming-c4: 嘉明 命ノ星座4「雲中越山」
- effect glimbrightIcdKey: クロリンデ: glimbrightIcdKey
- effect iansan-c1-icd: イアンサ 命ノ星座1「千里の道も一歩から」: 発動間隔
- effect illuga-c1-icd: イルーガ 命ノ星座1「危機を告げる禽」: 発動間隔
- effect ineffa-c4-icd: イネファ 命ノ星座4「訓示に至らぬ道」: 発動間隔
- effect ineffa-c6-icd: イネファ 命ノ星座6「貴方に捧げる暁」: 発動間隔
- effect kaveh-c6-icd: カーヴェ 命ノ星座6「パイリダエーザの理想」: 発動間隔
- effect keqing-c2-icd: 刻晴 命ノ星座2「苛捐」: 発動間隔
- effect kinich-c4-icd-key: キィニチ 命ノ星座4「蜂鳥の羽」: 発動間隔 key
- effect kirara-c4-icd: 綺良々 命ノ星座4「韋駄天駿足」: 発動間隔
- effect kuki-c4-icd: 久岐忍 命ノ星座4「捨て去りし閉鎖の心」: 発動間隔
- effect lanyan-c2-icd: 藍硯 命ノ星座2「「舞う袂軽く美玉光る」」: 発動間隔
- effect lauma-c4-icd: ラウマ 命ノ星座4「巨熊の力を 恋い慕うこと勿れ」: 発動間隔
- effect lyney-c1-icd: リネ 命ノ星座1「奇想天外の芸当」: 発動間隔
- effect neuvillette-c4-icd: ヌヴィレット 命ノ星座4「憐憫の玉冠」: 発動間隔
- effect neuvillette-c6-icd: ヌヴィレット 命ノ星座6「憤怒の報償」: 発動間隔
- effect nicole-c1-icd: ニコ 命ノ星座1「「大いに愛されし人の子よ、 恐るることなかれ」」: 発動間隔
- effect prune-c1-icd: プルーネ 命ノ星座1「誓いを立てたあの日から キミを救う旅が始まった」: 発動間隔
- effect prune-c2: プルーネ 命ノ星座2「元素の力を抱きしめて さあ荷物をまとめよう」
- effect qiqi-c1-icd: 七七 命ノ星座1「寒苦回向」: 発動間隔
- effect razor-hexerei-icd: レザー: hexerei 発動間隔
- effect sara-c1-icd: 九条裟羅 命ノ星座1「烏目」: 発動間隔
- effect sethos-c6-icd: セトス 命ノ星座6「巡日のパイロン」: 発動間隔
- effect shenhe-c2: 申鶴 命ノ星座2「定蒙」
- effect spine-dmgtaken-icd: 螭龍の剣（波乗り）: dmgtaken 発動間隔
- effect travelerhydro-c4-icd: 旅人 命ノ星座4「傾落の流水」: travelerhydro 発動間隔
- effect wanderer-c2-burstbonus: 放浪者 命ノ星座2「弐番·箙島廓白浪」: burstbonus
- effect wriothesley-c1-icd: リオセスリ 命ノ星座1「悪を為す者に恐れを」: 発動間隔
- effect xiangling-c6: 香菱 命ノ星座6「竜巻旋火輪」
- effect xianyun-c4-icd: 閑雲 命ノ星座4「黍珠割烹の妙」: 発動間隔
- effect xlc6: 香菱: xlc6
- target resonance:electro: 現行辞書に対応キーが無い。gcsimが別経路で扱うか、対象外かを確認する

整合性: 孤立リンク 0件
