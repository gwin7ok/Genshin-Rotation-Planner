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
| 星電導 / 星拡散 / 星閃 | Stellar-Conduct / Stellar Swirl / Stellar Glimmer | 原神 Wiki（英語版）で確認。輝映・星電導 = Radiance: Stellar-Conduct |
| 輝映 | Radiance | 原神 Wiki で確認（魔女の諭示） |
| 草露 / 月露 | Verdant Dew / Moonridge Dew | 要確認（genshin-db で未照合） |
| 魔女の諭示 / 諭示達成 | Witch's Revelation / Revelation | 名前は原神 Wiki で確認。「諭示達成」はアプリの呼び名 |

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

原神 Wiki の日本語版・英語版の同じページ（キャラのページの天賦の説明）を突き合わせて、公式の英語を確かめた（2026-10-29）。名前を直したら `handwrittenEnglish.ts` を直して、`npm run link:actions`（キャラ）・`npm run build:equipment`（武器・聖遺物）で付け直す。

| アプリの日本語 | 公式の英語 | キャラ | 備考（日本語版 Wiki の公式の日本語） |
|---|---|---|---|
| 近接の構え | Melee Stance | タルタリヤ | 公式は「近接モード」 |
| 風の加護 | Windfavored | 放浪者 | 公式は「優風」状態 |
| 剣域熾焔 | Ranging Flame | ディシア | |
| パンチ連打モード | Blazing Lioness | ディシア | 公式は「熾炎獅子」状態 |
| 加圧 / 潜水（加圧） | Pers Timer | フレミネ | |
| 影狩り | Subnautical Hunter | フレミネ | |
| 瑞獣の舞 | Wushou Stance | 嘉明 | |
| 黄昏の祈り | Twilight Meditation | セトス | |
| 羽月の輪 | Feathermoon Ring | 藍硯 | |
| 雷霆のシンフォニー / 雷鳴の交響 | Thunderous Symphony | フリンズ | 元素スキル「古律・孤灯の秘密」= Ancient Rite: Arcane Light |
| 月相転移 / 月相の輝き / 霊駿の駆け | Lunar Phase Shift / Phase Shift Radiance / Spirit Steed's Stride | 兹白 | |
| 血の契約 | Blood-Debt Directive | アルレッキーノ | |
| 標的の印 | Marked as Prey | ムアラニ | |
| 燔天の時 | Crucible of Death and Life | マーヴィカ | 先の訳（Hour of Burning Skies）は元素爆発の名前で、誤り |
| 粛清 | Disciplinary Action | ヴェスナ | |
| 月の祈り / 静謐の光環 | Lunar Prayer / Tranquility Aura | ニィロウ | |
| 蒼白の賛歌・月の歌 | Pale Hymn / Moon Song | ラウマ | |
| 猫玉 | Fluffy Meowball | ヤフォダ | |
| 重力（月の反応） | Gravity Ripple | コロンビーナ | |
| 周天の回転 | Atmospheric Revolution | 重雲 | 命ノ星座 2 の名前 |
| 円軌道射撃 / 廻狩貫鱗砲 | Loop Shot / Scalespiker Cannon | キィニチ | |
| トニックショット | Tonicshot | イファ | 1 語 |
| 幻の戯 | Phantasm Performance | ネフェル | |
| 魂を穿つ痛み | Etched Into Bone and Soul | ローエン | |
| 猛烈パッション | Fiery Passion | ヴァレサ | |
| 印（アロマティック・アナライズ） / 印（お水ひえひえ装置） | Mark (Aromatic Explication) / Mark (Precision Hydronic Cooler) | エミリエ / アイノ | 「印」は gcsim の効果。括弧の中が公式の元素爆発の名前 |
| 魔女の諭示の追加天賦名 | Seven Sacred Treasures（七七）・Edict of Cleansing（八重神子）・There Shall Be an Unveiling for Injustice（リオセスリ）・Vast Be the Dream（瑞希）・Choice Treasures（ディオナ）・Polaris（北斗）・A Star With Which to Start the Journey（セノ） | | `revelationCharacters.ts` の `en.talentName` |
| 昔日4: 彼方の効果 | "Waves of Days Past" effect | 昔日の歌 | |
| 〜の受付 | 〜 window | | アプリの呼び名 |
| 速攻状態 | Quick Stormflight window | イアンサ | 要確認（公式の名前が無い。スキルの後 5 秒間、通常攻撃でスタミナを使わずに Swift Stormflight を出せる期間） |
| 手で書いた武器・聖遺物の発動バフ名「X: 接尾」 | 英語の装備名 + 訳した接尾 | | 例: 千岩4: 全員攻撃力+20% → Tenacity of the Millelith 4P: Party ATK +20%。接尾はアプリの要約 |
