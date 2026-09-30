# スキル・爆発の効果の対応表（カバレッジ）

作成: 2026-09-30 / gcsim の辞書のコミット 1e6c1a86 / 生成: `npm run check:effectkeys`（`scripts/build-effect-coverage.ts`）

4 つのテーブル: `effects`（gcsim の効果）/ `targets`（アプリ側の対象）/ `links`（効果 ↔ 対象の組。中間表）/ `unlinked`（紐づけない理由）。
「未検討」= 紐づけも「紐づけない」の決定（理由）も無いもの。gcsim の更新・新キャラのとき、検討する範囲。
決定は `src/masterdata/effectKeyDecisions.ts`、紐づけは `actionEffectKeyOverrides.ts` / `actionEffectExtras.ts` に書く。

## effects（gcsim の効果。分類が skill / burst / character / attack と、実行時に見つかった設置物・シールド・継続ダメージ。299 件）

| 状態 | 件数 |
|---|---|
| 紐づけ済み | 167 |
| 未検討 | 61 |
| 保留 | 25 |
| 紐づけないと決定済み | 24 |
| 本体のバーで表示済み | 13 |
| 猶予時間・短い窓（効果ではない） | 8 |
| 命中などで更新され続ける内部状態 | 1 |

設置物名（gcsim のソース）: 7 件

## targets（アプリのスキル・爆発のアクション定義。305 件）

| 状態 | 件数 |
|---|---|
| 紐づけ済み | 183 |
| gcsim が効果のイベントを出さない | 94 |
| gcsim にキャラが未登録 | 18 |
| 紐づけないと決定済み | 9 |
| 保留 | 1 |

## links（効果 ↔ 対象。196 件）

内訳: main/auto=159 / main/approved=23 / extra/approved=5 / included/approved=9
整合性: 存在しない効果・対象を指す紐づけ 0 件 / 重複 0 件

## 未検討のアクション定義（0 件）

なし

## 未検討の効果（61 件。持ち主ごと）

### (持ち主なし)
- `damage:Palm Vortex Max Cutting (Hold)` [runtime] 
- `damage:Frostbound Javelin` [runtime] 
- `damage:Wake of Earth` [runtime] 
- `damage:Dewdrop (Hold)` [runtime] 
- `damage:Blazing Threshold DMG` [runtime] 
- `damage:Starshatter` [runtime] 
- `damage:Spirit Blade: Cloud-Parting Star` [runtime] 
- `damage:Icy Paw` [runtime] 
- `damage:Mirror Reflection of Doom (Tick)` [runtime] 
- `damage:Starward Sword (Consecutive Slash)` [runtime] 
- `damage:Muji-Muji Daruma` [runtime] 
- `damage:Sesshou Sakura Tick` [runtime] 
- `damage:Tanglevine Shaft` [runtime] 
- `damage:Secondary Tanglevine Shaft` [runtime] 
- `damage:Shooting Star` [runtime] 
- `damage:Kyougen: Five Ceremonial Plays` [runtime] 
- `damage:Particular Field: Fetters of Phenomena` [runtime] 
- `damage:Universal Diagnosis` [runtime] 
- `damage:Spiritvein Damage` [runtime] 
- `damage:Darkgold Wolfbite` [runtime] 
- `damage:Still Photo: Kamera` [runtime] 
- `damage:Secondary Explosive Shell` [runtime] 
- `damage:Last Lightfall` [runtime] 
- `damage:Rings of Searing Radiance` [runtime] 
- `damage:Lustrous Moonrise` [runtime] 
- `damage:Havoc: Ruin (DoT)` [runtime] 
### aino
- `aino-burst-mark` [burst] アイノ 元素爆発「お水ひえひえ装置」: 印
### aloy
- `aloy-rushing-ice` [skill] アーロイ 元素スキル「凍てついた大地」: rushing ice
### arlecchino
- `directive-limit` [skill] アルレッキーノ 元素スキル「万象、灰に帰す」: directive limit
### columbina
- `columbina-gravity` [skill] コロンビーナ 元素スキル「万古の潮汐」: 重力
- `columbina-q-buff` [burst] コロンビーナ 元素爆発「月明かりの郷愁」: 強化
### dehya
- `dehya-burst-kick` [burst] ディシア 元素爆発「炎哮獅子咬」: kick
- `dehya-redmanes-blood` [skill] ディシア 元素スキル「熔鉄流獄」: redmanes blood
### durin
- `confirmation-of-purity` [skill] ドゥリン 元素スキル「二元術式・融合精錬」: confirmation of purity
- `denial-of-darkness` [skill] ドゥリン 元素スキル「二元術式・融合精錬」: denial of darkness
- `durin-burst-black` [burst] ドゥリン 元素爆発「純白の法則・変転する光」: black
### emilie
- `emilie-burst-mark` [burst] エミリエ 元素爆発「アロマティック·アナライズ」: 印
### eula
- `eula-icewhirl-shred-cryo` [skill] エウルア 元素スキル「氷潮の渦」: icewhirl 耐性ダウン 氷
- `eula-icewhirl-shred-phys` [skill] エウルア 元素スキル「氷潮の渦」: icewhirl 耐性ダウン phys
### flins
- `thunderous-symphony` [skill] フリンズ 元素スキル「古律・孤灯の秘密」: thunderous symphony
### gaming
- `gaming-man-chai` [burst] 嘉明 元素爆発「燦炎金猊の舞」: man chai
### ganyu
- `ganyu-burst-mark` [burst] 甘雨 元素爆発「降衆天華」: 印
### gorou
- `gorou-e-defbuff` [skill] ゴロー 元素スキル「犬坂の遠吠え方円陣」: defbuff
### illuga
- `haunted-night-oriole-song` [burst] イルーガ 元素爆発「影無き灯り」: haunted night oriole song
### jahoda
- `jahoda-meowball` [skill] ヤフォダ 元素スキル「奇策・財宝分配法」: meowball
### lauma
- `lauma-pale-hymn-moonsong` [burst] ラウマ 元素爆発「聖言のルノ・月の心」: 蒼白の賛歌・月の歌
- `lauma-skill-shred-dendro` [skill] ラウマ 元素スキル: 草元素耐性ダウン
- `lauma-skill-shred-hydro` [skill] ラウマ 元素スキル: 水元素耐性ダウン
- `lauma-spirit-envoy` [attack] ラウマ 通常攻撃: 精霊の使者
### lyney
- `lyney-grinmalkinhat` [character] リネ: grinmalkinhat
### mona
- `omen-debuff` [burst] モナ 元素爆発「星命定軌」: omen デバフ
### mualani
- `marked-as-prey` [skill] ムアラニ 元素スキル「サメサメウェーブブレイカー」: marked as prey
### nilou
- `lunarprayer` [skill] ニィロウ 元素スキル: 月の祈り
- `tranquilityaura` [skill] ニィロウ 元素爆発「浮蓮のダンス・遠夢聆泉」: 静謐の光環
### odette
- `odette-dance-double-upgrade` [skill] オデット 元素スキル「柔きファントムの夜の舞」: dance double upgrade
- `radiance-stellar-swirl` [character] オデット: radiance stellar swirl
### shenhe
- `shenhe-burst-shred-cryo` [burst] 申鶴 元素爆発「神女遣霊真訣」: 耐性ダウン 氷
- `shenhe-burst-shred-phys` [burst] 申鶴 元素爆発「神女遣霊真訣」: 耐性ダウン phys
### varesa
- `apex-drive` [attack] ヴァレサ 通常攻撃: apex drive
### xilonen
- `xilonen-e-shred-*` [skill] シロネン 元素スキル「ヨワル・スクラッチ」: 耐性ダウン
### yaemiko
- `yae-revelation` [character] 八重神子: revelation
