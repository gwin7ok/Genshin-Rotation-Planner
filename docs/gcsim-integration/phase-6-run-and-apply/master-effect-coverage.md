# マスター効果とgcsimキーの対応表（カバレッジ）

作成: 2026-10-08 / gcsim辞書コミット 1f9c1f2e / 生成: `npm run coverage:master-effects`

対象は固有天賦・命ノ星座・武器・聖遺物・元素共鳴。アクション効果用の `effect_key_coverage.json` とは別ファイルで管理し、将来統合できる `effects` / `targets` / `links` / `unlinked` 形式を使う。
「未確認」はマスター側の対象またはgcsimキー側の効果について、対応付け・理由付き対象外・保留のいずれも無い状態。

## gcsimキー（1113件）

| 分類 / 状態 | 件数 |
|---|---:|
| artifact / excluded | 56 |
| artifact / linked | 67 |
| artifact / pending | 15 |
| burst / linked | 9 |
| character / linked | 4 |
| constellation / excluded | 32 |
| constellation / linked | 191 |
| constellation / pending | 101 |
| skill / linked | 7 |
| system / linked | 8 |
| talent / excluded | 30 |
| talent / linked | 178 |
| weapon / excluded | 38 |
| weapon / linked | 332 |
| weapon / pending | 45 |

## マスター対象（673件）

| 種別 / 状態 | 件数 |
|---|---:|
| artifact / linked | 38 |
| artifact / unsupported | 3 |
| constellation / linked | 160 |
| resonance / linked | 6 |
| resonance / unreviewed | 1 |
| talent / linked | 154 |
| talent / unsupported | 119 |
| weapon / linked | 172 |
| weapon / unsupported | 20 |

## links（825件）

| 関係 | 件数 |
|---|---:|
| cooldown | 128 |
| effect | 601 |
| extra | 89 |
| resonance | 7 |

## 保留（161件）

- effect a-thousand-floating-dreams: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect a-thousand-floating-dreams-party-*: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect aino-c2-icd: 6-A2: 付け先の定義が無い（追加攻撃（間隔 5 秒））
- effect aino-c4-icd: 6-A2: 付け先の定義が無い（エネルギー回復（間隔 10 秒））
- effect alley-hunter: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect amber-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect amc-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect amos: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect arlecchino-c2-icd: 6-A2: 付け先の定義が無い（追加攻撃（間隔 10 秒））
- effect arlecchino-c4-icd: 6-A2: 付け先の定義が無い（優先: スキル（昇りゆく凶月）の CT を 2 秒短縮する効果の間隔）
- effect ayaka-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect ayato-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect ayato-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect baizhu-c2-icd: 6-A2: 付け先の定義が無い（HP回復（間隔 5 秒））
- effect balladofthefjords: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect bennett-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect berserker-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect blackmarrow-lantern: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect bloodtaintedgreatsword: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect bolide-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect braveheart-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect bs-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect c4-skull-icd: 6-A2: 付け先の定義が無い（エネルギー回復（間隔 8 秒））
- effect calamityofeshu: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect chain-breaker-atk: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect chain-breaker-em: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect charlotte-c6-icd: 6-A2: 付け先の定義が無い（HP回復（間隔 6 秒））
- effect chev-c1-icd: 6-A2: 付け先の定義が無い（エネルギー回復（間隔 10 秒））
- effect chev-c2-icd: 6-A2: 付け先の定義が無い（追加攻撃（間隔 10 秒））
- effect chongyun-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect citlali-c2-em: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect citlali-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect clorinde-c1-IcdKey: 6-A2: 付け先の定義が無い（追加攻撃）
- effect clorinde-c4-burst-bonus: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect clorinde-c6-cd-bonus: 6-A2: 付け先の定義が無い（追加攻撃）
- effect clorinde-c6-cr-bonus: 6-A2: 付け先の定義が無い（追加攻撃）
- effect clorinde-c6-icd: 6-A2: 付け先の定義が無い（追加攻撃）
- effect collei-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect columbina-c1-icd: 6-A2: 付け先の定義が無い（エネルギー回復（間隔 15 秒））
- effect columbina-c4-icd: 6-A2: 付け先の定義が無い（エネルギー回復（間隔 15 秒））
- effect coolsteel: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect dahlia-c6-icd: 6-A2: 付け先の定義が無い（HP回復（間隔 900 秒））
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
- effect flins-c1-icd: 6-A2: 付け先の定義が無い（エネルギー回復（間隔 5.5 秒））
- effect flins-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect flowerwreathedfeathers: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect freminet-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect fruitoffulfillment: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect furina-c2-hp: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect furina-c4-icd: 6-A2: 付け先の定義が無い（エネルギー回復（間隔 5 秒））
- effect gaming-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect glad-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect hamayumi: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect harbinger: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect homa-atk-buff: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect homa-hp: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect husk-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect iansan-c1-icd: 6-A2: 付け先の定義が無い（エネルギー回復（間隔 18 秒））
- effect iansan-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect illuga-c1-icd: 6-A2: 付け先の定義が無い（エネルギー回復（間隔 15 秒））
- effect ineffa-c4-icd: 6-A2: 付け先の定義が無い（エネルギー回復（間隔 4 秒））
- effect ineffa-c6-icd: 6-A2: 付け先の定義が無い（追加攻撃（間隔 3.5 秒））
- effect itto-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect jade-vista: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect jadecutter-atk-buff: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect jadecutter-hp: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect kaeya-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect kaveh-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect kaveh-c6-icd: 6-A2: 付け先の定義が無い（追加攻撃（間隔 3 秒））
- effect keqing-c2-icd: 6-A2: 付け先の定義が無い（その他（間隔 5 秒））
- effect kinich-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect kinich-c4-dmgp: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect kirara-c4-icd: 6-A2: 付け先の定義が無い（追加攻撃（間隔 3.8 秒））
- effect kuki-c4-icd: 6-A2: 付け先の定義が無い（追加攻撃（間隔 5 秒））
- effect lauma-c2-lunarbloom-buff: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect lauma-c4-icd: 6-A2: 付け先の定義が無い（エネルギー回復（間隔 5 秒））
- effect lavawalker-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect layla-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect lionsroar: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect lithic: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect lost-prayer: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect lyney-c1-icd: 6-A2: 付け先の定義が無い（その他（間隔 15 秒））
- effect lyney-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect magic-guide: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect mizuki-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect mizuki-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect mona-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect moonweavers-dawn: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect mualani-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect nahida-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect neuvillette-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect neuvillette-c4-icd: 6-A2: 付け先の定義が無い（その他（間隔 4 秒））
- effect nicole-c1-icd: 6-A2: 付け先の定義が無い（追加攻撃（間隔 6 秒））
- effect nilou-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect nilou-c6-cd: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect nilou-c6-cr: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect noelle-c2-dmg: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect noelle-c2-stam: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect ororon-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect prospectors-shovel: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect prune-c2: 6-A2: 付け先の定義が無い（その他）
- effect qiqi-c1-icd: 6-A2: 付け先の定義が無い（エネルギー回復（間隔 6 秒））
- effect qiqi-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect qiqi-c2-radiance: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect rainslasher: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect ravenbow: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect razor-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect redhorn-stonethrasher-def-boost: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect royal: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect rust: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect sara-c1-icd: 6-A2: 付け先の定義が無い（優先: 爆発（烏天狗雷霆召呪）の CT を 1 秒短縮する効果の間隔）
- effect sayu-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect sethos-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect sethos-c6-icd: 6-A2: 付け先の定義が無い（その他（間隔 15 秒））
- effect sharpshooter: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect shenhe-c2: 6-A2: 付け先の定義が無い（優先: 領域内の氷ダメージの会心ダメージ+15%）
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
- effect wanderer-c2-burstbonus: 6-A2: 付け先の定義が無い（その他）
- effect wavebreaker: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect whitetassel: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect wriothesley-c1: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect wt-4pc: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect xiangling-c6: 6-A2: 付け先の定義が無い（優先: 旋火輪の間、チーム全員の炎ダメージ+15%（xlc6 と同じ効果））
- effect xianyun-c4-icd: 6-A2: 付け先の定義が無い（HP回復（間隔 5 秒））
- effect xiao-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect xiao-c4: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect xilonen-c2-buff: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect xinyan-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect xlc6: 6-A2: 付け先の定義が無い（優先: 旋火輪の間、チーム全員の炎ダメージ+15%（xiangling-c6 と同じ効果））
- effect yae-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect yae-c6: 6-A2: 定義を持たない常時効果の扱い・表示が未実装
- effect yanfei-c2: 6-A2: 定義を持たない常時効果の扱い・表示が未実装

## 未確認（1件）

- target resonance:electro: 現行辞書に対応キーが無い。gcsimが別経路で扱うか、対象外かを確認する

整合性: 孤立リンク 0件
