# スキル・爆発の効果の対応表（カバレッジ）

作成: 2026-09-30 / gcsim の辞書のコミット 1e6c1a86 / 生成: `npm run check:effectkeys`（`scripts/build-effect-coverage.ts`）

4 つのテーブル: `effects`（gcsim の効果）/ `targets`（アプリ側の対象）/ `links`（効果 ↔ 対象の組。中間表）/ `unlinked`（紐づけない理由）。
「未検討」= 紐づけも「紐づけない」の決定（理由）も無いもの。gcsim の更新・新キャラのとき、検討する範囲。
決定は `src/masterdata/effectKeyDecisions.ts`、紐づけは `actionEffectKeyOverrides.ts` / `actionEffectExtras.ts` に書く。

## effects（gcsim の効果。分類が skill / burst / character / attack と、実行時に見つかった設置物・シールド・継続ダメージ。299 件）

| 状態 | 件数 |
|---|---|
| 紐づけ済み | 157 |
| 未検討 | 118 |
| 常時の効果 | 14 |
| 猶予時間・短い窓（効果ではない） | 5 |
| 本体のバーで表示済み | 3 |
| 命中などで更新され続ける内部状態 | 1 |
| 保留 | 1 |

設置物名（gcsim のソース）: 7 件

## targets（アプリのスキル・爆発のアクション定義。305 件）

| 状態 | 件数 |
|---|---|
| 紐づけ済み | 182 |
| gcsim が効果のイベントを出さない | 95 |
| gcsim にキャラが未登録 | 18 |
| 紐づけないと決定済み | 9 |
| 保留 | 1 |

## links（効果 ↔ 対象。186 件）

内訳: main/auto=159 / main/approved=23 / extra/approved=4
整合性: 存在しない効果・対象を指す紐づけ 0 件 / 重複 0 件

## 未検討のアクション定義（0 件）

なし

## 未検討の効果（118 件。持ち主ごと）

### (持ち主なし)
- `construct:LunarCrystallize` [runtime] 
- `damage:Palm Vortex Max Cutting (Hold)` [runtime] 
- `damage:Frostbound Javelin` [runtime] 
- `damage:Lea Lotus Lamp` [runtime] 
- `damage:Wake of Earth` [runtime] 
- `damage:Dewdrop (Hold)` [runtime] 
- `damage:Blazing Threshold DMG` [runtime] 
- `shield:Tidecaller (Shield)` [runtime] 
- `damage:Xingqiu Orbital` [runtime] 
- `damage:Starshatter` [runtime] 
- `damage:Stone Stele (Tick)` [runtime] 
- `damage:Spirit Blade: Cloud-Parting Star` [runtime] 
- `damage:Icy Paw` [runtime] 
- `damage:Mirror Reflection of Doom (Tick)` [runtime] 
- `damage:Starward Sword (Consecutive Slash)` [runtime] 
- `damage:Muji-Muji Daruma` [runtime] 
- `damage:Bake-Kurage` [runtime] 
- `damage:Sesshou Sakura Tick` [runtime] 
- `shield:Opening Flourish (Shield)` [runtime] 
- `damage:Kamisato Art: Suiyuu` [runtime] 
- `damage:Tanglevine Shaft` [runtime] 
- `damage:Secondary Tanglevine Shaft` [runtime] 
- `shield:Sacred Rite: Heron's Sanctum (Shield)` [runtime] 
- `damage:Shooting Star` [runtime] 
- `damage:Kyougen: Five Ceremonial Plays` [runtime] 
- `damage:Particular Field: Fetters of Phenomena` [runtime] 
- `damage:Universal Diagnosis` [runtime] 
- `damage:Spiritvein Damage` [runtime] 
- `damage:Bogglecat Box` [runtime] 
- `damage:Darkgold Wolfbite` [runtime] 
- `damage:Still Photo: Kamera` [runtime] 
- `damage:Secondary Explosive Shell` [runtime] 
- `damage:Last Lightfall` [runtime] 
- `damage:Rings of Searing Radiance` [runtime] 
- `damage:Lustrous Moonrise` [runtime] 
- `damage:Havoc: Ruin (DoT)` [runtime] 
### aino
- `aino-burst-mark` [burst] アイノ 元素爆発「お水ひえひえ装置」: 印
### albedo
- `albedo-c2` [skill] アルベド 命ノ星座2「顕生の宇宙」
### aloy
- `aloy-rushing-ice` [skill] アーロイ 元素スキル「凍てついた大地」: rushing ice
### amber
- `amber-c6` [burst] アンバー 命ノ星座6「野火の如く」
### arlecchino
- `directive-limit` [skill] アルレッキーノ 元素スキル「万象、灰に帰す」: directive limit
### beidou
- `beidouc6` [burst] 北斗 元素爆発「雷斫り」: beidouc6
### bennett
- `bennett-field` [burst] ベネット 元素爆発「素晴らしい旅」: 領域
### chongyun
- `chongyun-c2` [skill] 重雲 命ノ星座2「周天の回転」
- `chongyun-field` [skill] 重雲 元素スキル「霊刃·重華積霜」: 領域
### collei
- `collei-a1` [skill] コレイ 固有天賦1「フライリーフワインダー」
- `collei-a4-modcheck` [burst] コレイ 固有天賦2「徐かなること森の如く」: modcheck
### columbina
- `columbina-gravity` [skill] コロンビーナ 元素スキル「万古の潮汐」: 重力
- `columbina-q-buff` [burst] コロンビーナ 元素爆発「月明かりの郷愁」: 強化
### dehya
- `dehya-burst-kick` [burst] ディシア 元素爆発「炎哮獅子咬」: kick
- `dehya-jump-kick-window` [character] ディシア: jump kick 猶予
- `dehya-redmanes-blood` [skill] ディシア 元素スキル「熔鉄流獄」: redmanes blood
### diluc
- `diluc-c6-dmg` [skill] ディルック 命ノ星座6「闇を清算する炎の剣」: ダメージ
- `diluc-c6-speed` [skill] ディルック 命ノ星座6「闇を清算する炎の剣」: speed
### durin
- `confirmation-of-purity` [skill] ドゥリン 元素スキル「二元術式・融合精錬」: confirmation of purity
- `denial-of-darkness` [skill] ドゥリン 元素スキル「二元術式・融合精錬」: denial of darkness
- `durin-burst-black` [burst] ドゥリン 元素爆発「純白の法則・変転する光」: black
### emilie
- `emilie-burst-mark` [burst] エミリエ 元素爆発「アロマティック·アナライズ」: 印
### eula
- `eula-c1` [skill] エウルア 命ノ星座1「潮の幻像」
- `eula-icewhirl-shred-cryo` [skill] エウルア 元素スキル「氷潮の渦」: icewhirl 耐性ダウン 氷
- `eula-icewhirl-shred-phys` [skill] エウルア 元素スキル「氷潮の渦」: icewhirl 耐性ダウン phys
### flins
- `thunderous-symphony` [skill] フリンズ 元素スキル「古律・孤灯の秘密」: thunderous symphony
### furina
- `center-of-attention` [skill] フリーナ 元素スキル「サロン·ソリティア」: center of attention
- `furina-fanfare-debounce` [burst] フリーナ 元素爆発「万民のカルナバル」: fanfare debounce
### gaming
- `gaming-man-chai` [burst] 嘉明 元素爆発「燦炎金猊の舞」: man chai
### ganyu
- `ganyu-burst-mark` [burst] 甘雨 元素爆発「降衆天華」: 印
- `ganyu-c6` [skill] 甘雨 命ノ星座6「履虫」
- `ganyu-field` [burst] 甘雨 元素爆発「降衆天華」: 領域
### gorou
- `gorou-e-defbuff` [skill] ゴロー 元素スキル「犬坂の遠吠え方円陣」: defbuff
### hutao
- `blood-blossom` [skill] 胡桃 元素スキル「蝶導来世」: blood blossom
### illuga
- `haunted-night-oriole-song` [burst] イルーガ 元素爆発「影無き灯り」: haunted night oriole song
### jahoda
- `jahoda-meowball` [skill] ヤフォダ 元素スキル「奇策・財宝分配法」: meowball
### kamisatoayato
- `ayato-c4` [burst] 神里綾人 命ノ星座4「細流厭わず」
### klee
- `klee-c6` [burst] クレー 命ノ星座6「火力全開」
### lanyan
- `leap-back` [skill] 藍硯 元素スキル「鳳跡随翦舞」: leap back
### lauma
- `lauma-burst` [burst] ラウマ 元素爆発「聖言のルノ・月の心」
- `lauma-pale-hymn-moonsong` [burst] ラウマ 元素爆発「聖言のルノ・月の心」: 蒼白の賛歌・月の歌
- `lauma-skill-shred-dendro` [skill] ラウマ 元素スキル: 草元素耐性ダウン
- `lauma-skill-shred-hydro` [skill] ラウマ 元素スキル: 水元素耐性ダウン
- `lauma-spirit-envoy` [attack] ラウマ 通常攻撃: 精霊の使者
### layla
- `layla-c4` [character] レイラ 命ノ星座4「啓示を照らす星芒」
### lisa
- `lisa-c2` [skill] リサ 命ノ星座2「空間電位の結界」
### lyney
- `lyney-grinmalkinhat` [character] リネ: grinmalkinhat
### mavuika
- `mavuika-cdc-lockout` [attack] マーヴィカ 通常攻撃: cdc lockout
### mona
- `mona-c2-hexerei-post-burst-ca` [burst] モナ 命ノ星座2「星月の連珠」: hexerei post 爆発 重撃
- `omen-debuff` [burst] モナ 元素爆発「星命定軌」: omen デバフ
### mualani
- `marked-as-prey` [skill] ムアラニ 元素スキル「サメサメウェーブブレイカー」: marked as prey
### nilou
- `lunarprayer` [skill] ニィロウ 元素スキル: 月の祈り
- `tranquilityaura` [skill] ニィロウ 元素爆発「浮蓮のダンス・遠夢聆泉」: 静謐の光環
### odette
- `odette-dance-double-upgrade` [skill] オデット 元素スキル「柔きファントムの夜の舞」: dance double upgrade
- `radiance-stellar-swirl` [character] オデット: radiance stellar swirl
### prune
- `prune-skill-recast-window` [skill] プルーネ 元素スキル「リンリン！魔女を狩る音」: 再発動 猶予
### sangonomiyakokomi
- `kokomi-c4` [burst] 珊瑚宮心海 命ノ星座4「月に摂す千の川」
### shenhe
- `shenhe-a1` [burst] 申鶴 固有天賦1「大洞弥羅尊法」
- `shenhe-burst-shred-cryo` [burst] 申鶴 元素爆発「神女遣霊真訣」: 耐性ダウン 氷
- `shenhe-burst-shred-phys` [burst] 申鶴 元素爆発「神女遣霊真訣」: 耐性ダウン phys
### skirk
- `skirk-burst-extinction` [burst] スカーク 元素爆発「極悪技・滅」: extinction
- `skirk-burst-extinction-anim` [burst] スカーク 元素爆発「極悪技・滅」: extinction anim
- `skirk-hold-e-anim` [skill] スカーク 元素スキル「極悪技・閃」: 長押し anim
### thoma
- `thoma-a1` [character] トーマ 固有天賦1「重装甲胄」
- `thoma-c6` [character] トーマ 命ノ星座6「燃え立つ誠心」
### varesa
- `apex-drive` [attack] ヴァレサ 通常攻撃: apex drive
### xianyun
- `xianyun-a4-window` [burst] 閑雲 固有天賦2「かの姿、洞府の仙人を彷彿す」: 猶予
### xilonen
- `xilonen-e-shred-*` [skill] シロネン 元素スキル「ヨワル・スクラッチ」: 耐性ダウン
### xingqiu
- `xingqiu-c2` [burst] 行秋 命ノ星座2「青空の虹」
### yaemiko
- `yae-revelation` [character] 八重神子: revelation
### yaoyao
- `yaoyao-a4` [character] ヨォーヨ 固有天賦2「先意承問」
### yelan
- `yelan_c6` [burst] 夜蘭 元素爆発「深謀玲瓏賽」: yelan_c6
- `yelan-c4` [skill] 夜蘭 命ノ星座4「騙し取る者、移花接木」
- `yelanc4` [skill] 夜蘭 元素スキル「絡み合う命の糸」: yelanc4
### zhongli
- `zhongli-anemo` [character] 鍾離: 風
- `zhongli-cryo` [character] 鍾離: 氷
- `zhongli-dendro` [character] 鍾離: 草
- `zhongli-electro` [character] 鍾離: 雷
- `zhongli-geo` [character] 鍾離: 岩
- `zhongli-hydro` [character] 鍾離: 水
- `zhongli-physical` [character] 鍾離: 物理
- `zhongli-pyro` [character] 鍾離: 炎
