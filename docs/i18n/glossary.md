# 用語集（日本語 → 英語）

英訳は、この表に合わせる（D254）。ゲーム用語は、ゲームの公式英語（genshin-db の English）に合わせる。
新しい用語が出たら、訳す前にここへ足す。「確認」欄が `要確認` のものは、ユーザーの確認を待つ。

## ゲーム用語（公式英語）

| 日本語 | 英語 | 備考 |
|---|---|---|
| 通常攻撃 | Normal Attack | |
| 重撃 | Charged Attack | |
| 落下攻撃 | Plunging Attack | 低空 / 高空は Low / High Plunge |
| 元素スキル | Elemental Skill | 画面の短い表記は Skill |
| 元素爆発 | Elemental Burst | 画面の短い表記は Burst |
| 一回押し / 長押し | Press（Tap）/ Hold | 公式は Press と Tap の両方を使う。アプリは Tap に統一（要確認） |
| ダッシュ | Sprint | 公式の英語は Sprint。gcsim の命令は dash |
| ジャンプ | Jump | |
| 交代 | Switch | gcsim の命令は swap |
| 天賦 | Talent | |
| 固有天賦 | Passive Talent | |
| 命ノ星座 | Constellation | 凸数は C0〜C6 |
| 精錬ランク | Refinement Rank | R1〜R5 |
| 武器 | Weapon | 片手剣 Sword / 両手剣 Claymore / 長柄武器 Polearm / 法器 Catalyst / 弓 Bow |
| 聖遺物 | Artifact | 2セット / 4セット = 2-Piece / 4-Piece |
| 炎 / 水 / 風 / 雷 / 草 / 氷 / 岩 | Pyro / Hydro / Anemo / Electro / Dendro / Cryo / Geo | |
| 攻撃力 / 防御力 / HP上限 | ATK / DEF / Max HP | |
| 元素熟知 | Elemental Mastery | 短い表記は EM |
| 元素チャージ効率 | Energy Recharge | 短い表記は ER |
| 会心率 / 会心ダメージ | CRIT Rate / CRIT DMG | |
| 元素エネルギー | Elemental Energy | |
| 元素粒子 / 元素オーブ | Elemental Particle / Elemental Orb | |
| 夜魂 | Nightsoul | |
| 月兆 | Moonsign | |
| 魔女の課業（ヘクセライ） | Hexerei | |
| 蒸発 / 溶解 | Vaporize / Melt | |
| 過負荷 / 超電導 / 感電 / 凍結 | Overloaded / Superconduct / Electro-Charged / Frozen | |
| 拡散 / 結晶 / 燃焼 | Swirl / Crystallize / Burning | |
| 開花 / 超開花 / 烈開花 | Bloom / Hyperbloom / Burgeon | |
| 原激化 / 超激化 / 草激化 | Quicken / Aggravate / Spread | |
| 月感電 / 月開花 / 月結晶 | Lunar-Charged / Lunar-Bloom / Lunar-Crystallize | |
| 星電導 / 星拡散 | Stellar Conduct / Stellar Swirl | 要確認（genshin-db で未照合） |
| 草露 / 月露 | Verdant Dew / Moonridge Dew | 要確認（genshin-db で未照合） |
| 魔女の諭示 / 諭示達成 | Witch's Revelation / Revelation | 要確認 |

## アプリの用語

| 日本語 | 英語 | 備考 |
|---|---|---|
| ローテーション | Rotation | |
| 編成（パーティ） | Team | 「編成設定」= Team Setup |
| 保存した編成（スロット） | Saved rotation | 要確認 |
| 出場（キャラが場に出ている区間） | On-field stint | 要確認。「出場カード」= Stint card |
| 初動 / ループ | Opener / Loop | |
| ガントチャート | Gantt chart | |
| 所要時間（アクションの） | Action time | |
| 効果時間（効果継続時間） | Duration | |
| クールタイム（CT） | Cooldown（CD） | 「CT 違反」= Cooldown conflict（要確認） |
| 使用可能回数 | Charges | 日本語の画面では「チャージ」と書かない（元素チャージと紛れるため）が、英語は公式も Charges |
| 発動バフ | Triggered buff | |
| ヒットストップ | Hitlag | gcsim の用語 |
| 記法（略号 / 名称） | Notation（Short / Names） | |
| DB 管理 | Database | |
| マスター（データ） | Master data | |

## アプリが手で書いた名前（3-3。`src/masterdata/handwrittenEnglish.ts`）

genshin-db の英語の説明文で、公式の英語が見つからなかったもの。Claude が訳した（要確認）。公式名が分かったら、`handwrittenEnglish.ts` の `TERMS` を直して、`npm run link:actions`（キャラ）・`npm run build:equipment`（武器・聖遺物）で付け直す。

| 日本語 | 英語 | 備考 |
|---|---|---|
| 近接の構え | Melee Stance | 要確認（タルタリヤ） |
| 風の加護 | Wind's Blessing | 要確認 |
| 剣域熾焔 | Blazing Sword Domain | 要確認 |
| パンチ連打モード | Rapid Punch Mode | 要確認 |
| 加圧 / 潜水（加圧） | Pressurized / Diving (Pressurized) | 要確認 |
| 影狩り | Shadowhunt | 要確認 |
| 瑞獣の舞 | Auspicious Beast Dance | 要確認 |
| 黄昏の祈り | Twilight Prayer | 要確認 |
| 羽月の輪 | Feathermoon Ring | 要確認 |
| 雷霆のシンフォニー / 雷鳴の交響 | Thunderous Symphony / Thunder Symphony | 要確認（前者は公式名と一致の可能性が高い） |
| 月相転移 / 月相の輝き | Lunar Phase Shift / Lunar Radiance | 要確認 |
| 血の契約 / 標的の印 / 速攻状態 | Blood Pact / Target Mark / Rapid Assault | 要確認 |
| 粛清 | Purge | 要確認（ヴェスナ） |
| 月の祈り | Moon's Prayer | 要確認 |
| 静謐の光環 | Serene Halo | 要確認 |
| 蒼白の賛歌・月の歌 | Pale Hymn / Moon Song | 要確認 |
| 印（アロマティック・アナライズ） / 印（お水ひえひえ装置） | Mark (Aromatic Analysis) / Mark (Chilly Water Device) | 要確認 |
| 猫玉（フラスコ排出） | Cat Ball (flask ejection) | 要確認 |
| 重力（月の反応） | Gravity (Lunar reaction) | 要確認 |
| 周天の回転 | Celestial Rotation | 要確認 |
| 〜の受付 | 〜 window | 例: 再発動の受付 = Recast window |
| 輝映 | boosted | 要確認（魔女の諭示の説明） |
| 魔女の諭示の追加天賦名（七宝奉真・大祓之宣託 など 7 件） | Seven Treasures of Truth など | 要確認（`src/masterdata/revelationCharacters.ts` の `en.talentName`） |
| 昔日4: 彼方の効果 | Waves of Days Past | 要確認 |
| 手で書いた武器・聖遺物の発動バフ名「X: 接尾」 | 英語の装備名 + 訳した接尾 | 例: 千岩4: 全員攻撃力+20% → Tenacity of the Millelith 4P: Party ATK +20% |
