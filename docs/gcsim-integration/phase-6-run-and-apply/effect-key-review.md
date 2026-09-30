# スキル・爆発の効果キーが無い定義の一覧（根拠つき）

作成: 2026-09-30 / gcsim v2.47.6（辞書のコミット 1e6c1a86）/ 収集スクリプト: `scripts/probe-effect-keys.ts`

各定義を、単独のキャラ（凸0・仮の武器）で1回実行し、発動から15秒間のログを調べた根拠を付けている。
「判定」は根拠からの機械的な分類で、見落とし（本当はキーがある）が無いかを確認してもらうための一覧。

判定の内訳（キー無し・未収集の定義）: 状態なし（瞬間・持続ダメージ等） 96 件 / シールド 4 件 / 要確認（効果のキー候補あり） 1 件 / 未収集（手で補う） 6 件

## A. 全定義にキーが無いキャラ（9 キャラ）

### 空(水)
- ❌ 元素スキル: 水紋の剣（hydro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: travelerhydro-spiritbreath-icd, travelerhydro-particle-icd
  - ダメージのみ: Torrent Surge / Spiritbreath Thorn
- ❌ 元素スキル派生: shortHold0Ticks（hydro_e_shorthold0ticks） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: sourcewater-droplet-icd
  - 内部（粒子CTなど）のみ: travelerhydro-spiritbreath-icd, travelerhydro-losing-hp-icd, sourcewater-droplet-icd, travelerhydro-particle-icd
  - ダメージのみ: Dewdrop (Hold) / Torrent Surge / Spiritbreath Thorn
- ❌ 元素スキル派生: shortHold（hydro_e_shorthold） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: sourcewater-droplet-icd
  - 内部（粒子CTなど）のみ: travelerhydro-spiritbreath-icd, travelerhydro-losing-hp-icd, sourcewater-droplet-icd, travelerhydro-particle-icd
  - ダメージのみ: Dewdrop (Hold) / Torrent Surge / Spiritbreath Thorn
- ❌ 元素スキル(最大ホールド): 水紋の剣（hydro_e_hold） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: sourcewater-droplet-icd
  - 内部（粒子CTなど）のみ: travelerhydro-spiritbreath-icd, travelerhydro-losing-hp-icd, sourcewater-droplet-icd, travelerhydro-particle-icd
  - ダメージのみ: Dewdrop (Hold) / Torrent Surge / Spiritbreath Thorn
- ❌ 元素爆発: 昇流統水（hydro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Rising Waters

### 蛍(水)
- ❌ 元素スキル: 水紋の剣（hydro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: travelerhydro-spiritbreath-icd, travelerhydro-particle-icd
  - ダメージのみ: Torrent Surge / Spiritbreath Thorn
- ❌ 元素スキル派生: shortHold0Ticks（hydro_e_shorthold0ticks） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: sourcewater-droplet-icd
  - 内部（粒子CTなど）のみ: travelerhydro-spiritbreath-icd, travelerhydro-losing-hp-icd, sourcewater-droplet-icd, travelerhydro-particle-icd
  - ダメージのみ: Dewdrop (Hold) / Torrent Surge / Spiritbreath Thorn
- ❌ 元素スキル派生: shortHold（hydro_e_shorthold） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: sourcewater-droplet-icd
  - 内部（粒子CTなど）のみ: travelerhydro-spiritbreath-icd, travelerhydro-losing-hp-icd, sourcewater-droplet-icd, travelerhydro-particle-icd
  - ダメージのみ: Dewdrop (Hold) / Torrent Surge / Spiritbreath Thorn
- ❌ 元素スキル(最大ホールド): 水紋の剣（hydro_e_hold） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: sourcewater-droplet-icd
  - 内部（粒子CTなど）のみ: travelerhydro-spiritbreath-icd, travelerhydro-losing-hp-icd, sourcewater-droplet-icd, travelerhydro-particle-icd
  - ダメージのみ: Dewdrop (Hold) / Torrent Surge / Spiritbreath Thorn
- ❌ 元素爆発: 昇流統水（hydro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Rising Waters

### 早柚
- ❌ 元素スキル: 嗚呼流·風隠急進（anemo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: sayu-kick-particle-icd
  - ダメージのみ: Fuufuu Windwheel (DoT Press) / Fuufuu Whirlwind (Kick Press)
- ❌ 元素スキル(長押し): 嗚呼流·風隠急進（anemo_e_hold） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: sayu-roll-particle-icd, sayu-kick-particle-icd
  - ダメージのみ: Fuufuu Windwheel (DoT Hold) / Fuufuu Whirlwind (Kick Hold)
- ❌ 元素スキル派生: shortHold（anemo_e_shorthold） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: sayu-roll-particle-icd, sayu-kick-particle-icd
  - ダメージのみ: Fuufuu Windwheel (DoT Hold) / Fuufuu Whirlwind (Kick Hold)
- ❌ 元素爆発: 嗚呼流·影貉繚乱（anemo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Yoohoo Art: Mujina Flurry / Muji-Muji Daruma

### 八重神子
- ❌ 元素スキル: 野干役呪·殺生櫻（electro_e） — **要確認（効果のキー候補あり）**
  - 辞書の効果キーが出たが条件を満たさなかった: yae_oldest_totem_expiry[character]
  - 内部（粒子CTなど）のみ: yaemiko-particle-icd
  - ダメージのみ: Sesshou Sakura Tick
- ❌ 元素爆発: 大密法·天狐顕現（electro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Great Secret Art: Tenko Kenshi

### 鹿野院平蔵
- ❌ 元素スキル: 戮心拳（anemo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: heizou-particle-icd
  - ダメージのみ: Heartstopper Strike
- ❌ 元素爆発: 廻風蹴（anemo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Windmuster Iris (Aura check) / Fudou Style Vacuum Slugger

### アルハイゼン
- ❌ 元素スキル: 共相·イデア模写（dendro_e） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Universality: An Elaboration o
- ❌ 元素スキル(長押し): 共相·イデア模写（dendro_e_hold） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Universality: An Elaboration o
- ❌ 元素爆発: 殊境·顕象結縛（dendro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Particular Field: Fetters of P

### ヌヴィレット
- ❌ 元素スキル: 涙よ、私は必ずや償おう（hydro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: neuvillette-aligned-icd, neuvillette-particle-icd
  - ダメージのみ: O Tears, I Shall Repay / Spiritbreath Thorn (neuvillett
- ❌ 元素爆発: 海よ、私は帰ってきた（hydro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: O Tides, I Have Returned: Skil / O Tides, I Have Returned: Wate

### 千織
- ❌ 元素スキル: 羽袖一触（geo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: chiori-a1-window
  - 内部（粒子CTなど）のみ: chiori-particle-icd
  - ダメージのみ: Fluttering Hasode (Upward Swee / Fluttering Hasode (Tamato)
- ❌ 元素爆発: 二刀の型·比翼（geo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Hiyoku: Twin Blades

### イルーガ
- ⚠️ 元素スキル: 暁を破る夜鳴鶯（geo_e） — **未収集（手で補う）**
  - 収集できなかった: ln1:8: expecting ; at end of  statement, got char
- ⚠️ 元素スキル(長押し): 暁を破る夜鳴鶯（geo_e_hold） — **未収集（手で補う）**
  - 収集できなかった: ln1:8: expecting ; at end of  statement, got char
- ⚠️ 元素爆発: 影無き灯り（geo_q） — **未収集（手で補う）**
  - 収集できなかった: ln1:8: expecting ; at end of  statement, got char

## B. 一部の定義だけキーが無いキャラ（キーがある定義も参考に表示）（68 キャラ）

### 神里綾華
- ❌ 元素スキル: 神里流·氷華（cryo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: ayaka-a1
  - 内部（粒子CTなど）のみ: ayaka-particle-icd
  - ダメージのみ: Hyouka
- ✅ 元素爆発: 神里流·霜滅（cryo_q）: キーあり `damage:Soumetsu (Cutting)`

### ジン
- ❌ 元素スキル: 風圧剣（anemo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: jean-base-particle-icd, jean-extra-particle-icd
  - ダメージのみ: Gale Blade
- ✅ 元素爆発: 蒲公英の風（anemo_q）: キーあり `jean-q`

### 空(風)
- ❌ 元素スキル: 旋風の剣（anemo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: traveleranemo-press-particle-icd
  - ダメージのみ: Palm Vortex (Tap)
- ❌ 元素スキル(長押し): 旋風の剣（anemo_e_hold） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: traveleranemo-hold-particle-icd
  - ダメージのみ: Palm Vortex Initial Cutting (H / Palm Vortex Max Cutting (Hold) / Palm Vortex Max Storm (Hold)
- ✅ 元素爆発: 激風の息（anemo_q）: キーあり `amcburst`

### 空(氷)
- ✅ 元素スキル: 霧氷の剣（cryo_e）: キーあり `travelercryo-e`
- ❌ 元素爆発: 飛氷の鉾（cryo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Frostbound Javelin

### 空(草)
- ❌ 元素スキル: 草縁剣（dendro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: travelerdendro-particle-icd
  - ダメージのみ: Razorgrass Blade
- ✅ 元素爆発: 臥草若化（dendro_q）: キーあり `travelerdendro-q`

### 空(炎)
- ❌ 元素スキル: 流火の剣（pyro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: travelerpyro-particle-icd
  - ダメージのみ: Blazing Threshold DMG
- ✅ 元素スキル(長押し): 流火の剣（pyro_e_hold）: キーあり `travelerpyro-e`
- ❌ 元素爆発: 燎原の灼炎（pyro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Plains Scorcher

### リサ
- ❌ 元素スキル: 蒼雷（electro_e） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Violet Arc (Press)
- ❌ 元素スキル(長押し): 蒼雷（electro_e_hold） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: lisa-particle-icd
  - ダメージのみ: Violet Arc (Hold)
- ✅ 元素爆発: 薔薇の雷光（electro_q）: キーあり `lisaburst`

### 蛍(風)
- ❌ 元素スキル: 旋風の剣（anemo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: traveleranemo-press-particle-icd
  - ダメージのみ: Palm Vortex (Tap)
- ❌ 元素スキル(長押し): 旋風の剣（anemo_e_hold） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: traveleranemo-hold-particle-icd
  - ダメージのみ: Palm Vortex Initial Cutting (H / Palm Vortex Max Cutting (Hold) / Palm Vortex Max Storm (Hold)
- ✅ 元素爆発: 激風の息（anemo_q）: キーあり `amcburst`

### 蛍(氷)
- ✅ 元素スキル: 霧氷の剣（cryo_e）: キーあり `travelercryo-e`
- ❌ 元素爆発: 飛氷の鉾（cryo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Frostbound Javelin

### 蛍(草)
- ❌ 元素スキル: 草縁剣（dendro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: travelerdendro-particle-icd
  - ダメージのみ: Razorgrass Blade
- ✅ 元素爆発: 臥草若化（dendro_q）: キーあり `travelerdendro-q`

### 蛍(炎)
- ❌ 元素スキル: 流火の剣（pyro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: travelerpyro-particle-icd
  - ダメージのみ: Blazing Threshold DMG
- ✅ 元素スキル(長押し): 流火の剣（pyro_e_hold）: キーあり `travelerpyro-e`
- ❌ 元素爆発: 燎原の灼炎（pyro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Plains Scorcher

### バーバラ
- ✅ 元素スキル: 公演、開始♪（hydro_e）: キーあり `barbara-e`
- ❌ 元素爆発: シャイニングミラクル♪（hydro_q） — **状態なし（瞬間・持続ダメージ等）**
  - 状態・設置物・ダメージのイベントなし

### ガイア
- ❌ 元素スキル: 霜の襲撃（cryo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: kaeya-particle-icd
  - ダメージのみ: Frostgnaw
- ✅ 元素爆発: 凛冽なる輪舞（cryo_q）: キーあり `kaeya-q`

### レザー
- ✅ 元素スキル: 鋭い爪と蒼雷（electro_e）: キーあり `razor-sigil`
- ❌ 元素スキル(長押し): 鋭い爪と蒼雷（electro_e_hold） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: razor-hold-particle-icd
  - ダメージのみ: Claw and Thunder (Hold)
- ✅ 元素爆発: 雷牙（electro_q）: キーあり `razor-q`

### アンバー
- ❌ 元素スキル: 爆弾人形（pyro_e） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Baron Bunny
- ✅ 元素爆発: 矢の雨（pyro_q）: キーあり `damage:Fiery Rain`

### ウェンティ
- ❌ 元素スキル: 高天の歌（anemo_e） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Skyward Sonnett (Press)
- ❌ 元素スキル(長押し): 高天の歌（anemo_e_hold） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Skyward Sonnett (Hold)
- ✅ 元素爆発: 風神の詩（anemo_q）: キーあり `damage:Wind's Grand Ode`

### 北斗
- ❌ 元素スキル: 浪追い（electro_e） — **シールド**
  - シールドのイベントあり: shield added / shield expired
  - 内部（粒子CTなど）のみ: beidou-particle-icd
  - ダメージのみ: Tidecaller
- ✅ 元素爆発: 雷斫り（electro_q）: キーあり `beidouburst`

### 魈
- ❌ 元素スキル: 風輪両立（anemo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: xiao-a4
  - ダメージのみ: Lemniscatic Wind Cycling
- ✅ 元素爆発: 靖妖儺舞（anemo_q）: キーあり `xiaoburst`

### 凝光
- ✅ 元素スキル: 璇璣屏（geo_e）: キーあり `construct:NingSkill`
- ❌ 元素爆発: 天権崩玉（geo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Starshatter

### クレー
- ❌ 元素スキル: ボンボン爆弾（pyro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: a1-icd, a1-spark
  - 内部（粒子CTなど）のみ: a1-icd
  - ダメージのみ: Jumpy Dumpty (Bounce) / Jumpy Dumpty (Mine)
- ✅ 元素爆発: ドッカン花火（pyro_q）: キーあり `kleeq`

### 鍾離
- ✅ 元素スキル: 地心（geo_e）: キーあり `construct:ZhongliSkill`
- ✅ 元素スキル(長押し): 地心（geo_e_hold）: キーあり `shield:Zhongli Skill`
- ❌ 元素爆発: 天星（geo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Planet Befall

### ベネット
- ❌ 元素スキル: 溢れる情熱（pyro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: bennett-press-particle-icd
  - ダメージのみ: Passion Overload (Press)
- ❌ 元素スキル(長押し): 溢れる情熱（pyro_e_hold） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: bennett-hold-particle-icd
  - ダメージのみ: Passion Overload (Level 1)
- ✅ 元素爆発: 素晴らしい旅（pyro_q）: キーあり `bennettburst`

### 重雲
- ✅ 元素スキル: 霊刃·重華積霜（cryo_e）: キーあり `chongyunfield`
- ❌ 元素爆発: 霊刃·雲開星落（cryo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Spirit Blade: Cloud-Parting St

### 甘雨
- ❌ 元素スキル: 山沢麟跡（cryo_e） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Ice Lotus
- ✅ 元素爆発: 降衆天華（cryo_q）: キーあり `ganyuburst`

### アルベド
- ✅ 元素スキル: 創生術·擬似陽華（geo_e）: キーあり `construct:AlbedoSkill`
- ❌ 元素爆発: 誕生式·大地の潮（geo_q） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: albedo-a4
  - ダメージのみ: Rite of Progeniture: Tectonic 

### モナ
- ❌ 元素スキル: 水中幻願（hydro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: mona-particle-icd
  - ダメージのみ: Mirror Reflection of Doom (Tic / Mirror Reflection of Doom (Exp
- ✅ 元素爆発: 星命定軌（hydro_q）: キーあり `mona-c2-hexerei-post-burst-ca, mona-bubble`

### 刻晴
- ✅ 元素スキル: 星辰帰位（electro_e）: キーあり `keqingstiletto`
- ❌ 元素爆発: 天街巡遊（electro_q） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: keqing-a4
  - ダメージのみ: Starward Sword (Initial) / Starward Sword (Consecutive Sl / Starward Sword (Last Attack)

### スクロース
- ❌ 元素スキル: 風霊作成·六三〇八（anemo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: sucrose-particle-icd
  - ダメージのみ: Astable Anemohypostasis Creati
- ✅ 元素爆発: 禁·風霊作成·七五同構弐型（anemo_q）: キーあり `sucroseburst`

### ロサリア
- ❌ 元素スキル: 罪喰いの懺悔（cryo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: rosaria-a1
  - 内部（粒子CTなど）のみ: rosaria-particle-icd
  - ダメージのみ: Ravaging Confession (Hit 1) / Ravaging Confession (Hit 2)
- ✅ 元素爆発: 臨終の聖礼（cryo_q）: キーあり `rosariaburst`

### 胡桃
- ✅ 元素スキル: 蝶導来世（pyro_e）: キーあり `paramita`
- ❌ 元素爆発: 安神秘法（pyro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Spirit Soother

### 楓原万葉
- ❌ 元素スキル: 千早振る（anemo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: kazuha-particle-icd
  - ダメージのみ: Chihayaburu (Press)
- ❌ 元素スキル(長押し): 千早振る（anemo_e_hold） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: kazuha-particle-icd
  - ダメージのみ: Chihayaburu (Hold)
- ✅ 元素爆発: 万葉の一刀（anemo_q）: キーあり `kazuha-q`

### エウルア
- ✅ 元素スキル: 氷潮の渦（cryo_e）: キーあり `eula-grimheart-duration`
- ❌ 元素スキル(長押し): 氷潮の渦（cryo_e_hold） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: eula-hold-particle-icd
  - ダメージのみ: Icetide Vortex (Hold)
- ✅ 元素爆発: 氷浪の光剣（cryo_q）: キーあり `eula-q`

### 夜蘭
- ❌ 元素スキル: 絡み合う命の糸（hydro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: yelan-particle-icd
  - ダメージのみ: Lingering Lifeline
- ✅ 元素爆発: 深謀玲瓏賽（hydro_q）: キーあり `yelanburst`

### アーロイ
- ✅ 元素スキル: 凍てついた大地（cryo_e）: キーあり `rushingice, aloy-rushing-ice`
- ❌ 元素爆発: ドーンプロフェシー（cryo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Prophecies of Dawn

### 雲菫
- ❌ 元素スキル: 旋雲開相（geo_e） — **シールド**
  - シールドのイベントあり: shield added / shield expired
  - 内部（粒子CTなど）のみ: yunjin-particle-icd
  - ダメージのみ: Opening Flourish (Press)
- ✅ 元素爆発: 破嶂の旌儀（geo_q）: キーあり `yunjin-q`

### ドリー
- ❌ 元素スキル: ジンニーランプ·トラブルシューター（electro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: dori-particle-icd
  - ダメージのみ: Troubleshooter Shot / After-Sales Service Round
- ✅ 元素爆発: アルカサルザライの極上サービス（electro_q）: キーあり `damage:Alcazarzaray's Exactitude: Connector DMG`

### ティナリ
- ✅ 元素スキル: 識果榴弾（dendro_e）: キーあり `vijnanasuffusion`
- ❌ 元素爆発: 造生·蔓纏いの矢（dendro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Tanglevine Shaft / Secondary Tanglevine Shaft

### セノ
- ❌ 元素スキル: 秘儀·律淵渡魂（electro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: cyno-particle-icd
  - ダメージのみ: Secret Rite: Chasmic Soulfarer
- ✅ 元素爆発: 聖儀·狼駆憑走（electro_q）: キーあり `cyno-q`

### キャンディス
- ❌ 元素スキル: 聖儀·蒼鷺による庇護（hydro_e） — **シールド**
  - シールドのイベントあり: shield added / shield expired
  - 内部（粒子CTなど）のみ: candace-particle-icd
  - ダメージのみ: Sacred Rite: Heron's Sanctum
- ❌ 元素スキル(長押し): 聖儀·蒼鷺による庇護（hydro_e_hold） — **シールド**
  - シールドのイベントあり: shield added / shield expired
  - 内部（粒子CTなど）のみ: candace-particle-icd
  - ダメージのみ: Sacred Rite: Heron's Sanctum (
- ✅ 元素爆発: 聖儀·灰鴒の呼び潮（hydro_q）: キーあり `candace-q`

### 放浪者
- ✅ 元素スキル: 羽画·風姿華歌（anemo_e）: キーあり `windfavored-state, wanderer-plunge-available`
- ❌ 元素爆発: 狂言·式楽伍番（anemo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Kyougen: Five Ceremonial Plays

### カーヴェ
- ❌ 元素スキル: 精緻なる絵図（dendro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: kaveh-particle-icd
  - ダメージのみ: Artistic Ingenuity
- ✅ 元素爆発: ムカルナスの描像（dendro_q）: キーあり `kaveh-q, kaveh-q-dmg-bonus`

### 白朮
- ❌ 元素スキル: 太素診要（dendro_e） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Universal Diagnosis
- ✅ 元素爆発: 癒気全形論（dendro_q）: キーあり `shield:Baizhu Seamless shield`

### リネット
- ❌ 元素スキル: エニグマティック·フェイント（anemo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: lynette-aligned-icd, lynette-particle-icd
  - ダメージのみ: Enigmatic Feint / Surging Blade (lynette)
- ✅ 元素爆発: 魔術·アストニシングシフト（anemo_q）: キーあり `lynette-q`

### リネ
- ❌ 元素スキル: ビウィルダー·ライト（pyro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: lyney-particle-icd
  - ダメージのみ: Bewildering Lights
- ✅ 元素爆発: 大魔術·ミラクルパレード（pyro_q）: キーあり `lyney-q, lyney-q-mark`

### リオセスリ
- ✅ 元素スキル: アイスファング·ラッシュ（cryo_e）: キーあり `wriothesley-e`
- ❌ 元素爆発: ガンメタル·ウルフバイト（cryo_q） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: wriothesley-ousia-icd
  - ダメージのみ: Darkgold Wolfbite / Surging Blade

### シャルロット
- ✅ 元素スキル: フレーミング·氷点法（cryo_e）: キーあり `charlotte-e`
- ✅ 元素スキル(長押し): フレーミング·氷点法（cryo_e_hold）: キーあり `charlotte-hold-e`
- ❌ 元素爆発: スチルフォト·多角的立証（cryo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Still Photo: Comprehensive Con / Still Photo: Kamera

### シュヴルーズ
- ✅ 元素スキル: 近迫阻止射撃·速（pyro_e）: キーあり `chev-skill-heal`
- ✅ 元素スキル(長押し): 近迫阻止射撃·速（pyro_e_hold）: キーあり `chev-skill-heal`
- ❌ 元素爆発: 円形爆撃戦術·轟（pyro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Explosive Grenade / Secondary Explosive Shell

### ナヴィア
- ❌ 元素スキル: セレモニアル·クリスタルショット（geo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: navia-a1-dmg
  - 内部（粒子CTなど）のみ: navia-particle-icd, navia-arkhe-icd
  - ダメージのみ: Rosula Shardshot / Surging Blade
- ✅ 元素爆発: 晴天を衝く霰弾のサルート（geo_q）: キーあり `navia-artillery`

### 嘉明
- ❌ 元素スキル: 瑞獣登楼（pyro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 状態・設置物・ダメージのイベントなし
- ✅ 元素爆発: 燦炎金猊の舞（pyro_q）: キーあり `gaming-q, gaming-man-chai`

### アルレッキーノ
- ✅ 元素スキル: 万象、灰に帰す（pyro_e）: キーあり `directive, directive-limit`
- ❌ 元素爆発: 昇りゆく凶月（pyro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Balemoon Rising

### セトス
- ❌ 元素スキル: 古儀·鳴砂牽雷（electro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: sethos-particle-icd
  - ダメージのみ: Ancient Rite: Thunderous Roar 
- ✅ 元素爆発: 秘儀·瞑光貫影（electro_q）: キーあり `sethos-burst`

### クロリンデ
- ✅ 元素スキル: 夜狩の巡回（electro_e）: キーあり `clorinde-night-watch`
- ❌ 元素爆発: 消えゆく残光（electro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Last Lightfall

### キィニチ
- ❌ 元素スキル: 懸狩り·宙の遊猟（dendro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 状態・設置物・ダメージのイベントなし
- ✅ 元素爆発: 偉大なる聖龍を崇拝せよ（dendro_q）: キーあり `ajaw`

### ムアラニ
- ✅ 元素スキル: サメサメウェーブブレイカー（hydro_e）: キーあり `mualani-surfing`
- ❌ 元素爆発: 爆瀑ロケット（hydro_q） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: nightsoul-burst-icd
  - ダメージのみ: Boomsharka-laka

### シロネン
- ✅ 元素スキル: ヨワル・スクラッチ（geo_e）: キーあり `xilonen-a4`
- ❌ 元素爆発: オセロット・キューポイント！（geo_q） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: xilonen-a4
  - 内部（粒子CTなど）のみ: nightsoul-burst-icd
  - ダメージのみ: Ocelotlicue Point! / Follow-Up Beat

### オロルン
- ❌ 元素スキル: 冥色のタイトロープ（electro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: ororon-a1, ororon-a4
  - 内部（粒子CTなど）のみ: nightsoul-burst-icd
  - ダメージのみ: Spirit Orb DMG
- ✅ 元素爆発: 闇声の残響（electro_q）: キーあり `supersonic-oculus`

### マーヴィカ
- ✅ 元素スキル: 名を称える刻（pyro_e）: キーあり `nightsoul-blessing`
- ✅ 元素スキル(長押し): 名を称える刻（pyro_e_hold）: キーあり `nightsoul-blessing`
- ⚠️ 元素スキル派生: recastFramesToBike（pyro_e_recastframestobike） — **未収集（手で補う）**
  - 収集できなかった: error encountered on mavuika executing skill: cannot recast E while not in nightsoul blessing
- ⚠️ 元素スキル派生: recastFramesToRing（pyro_e_recastframestoring） — **未収集（手で補う）**
  - 収集できなかった: error encountered on mavuika executing skill: cannot recast E while not in nightsoul blessing
- ✅ 元素爆発: 天を焦がす刻（pyro_q）: キーあり `mavuika-burst`

### シトラリ
- ✅ 元素スキル: 霜暁の黒星（cryo_e）: キーあり `opal-fire-state`
- ❌ 元素爆発: 諸曜の令（cryo_q） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: nightsoul-burst-icd
  - ダメージのみ: Ice Storm DMG / Spiritvessel Skull DMG

### 藍硯
- ✅ 元素スキル: 鳳跡随翦舞（anemo_e）: キーあり `leap-back`
- ❌ 元素爆発: 月踏む鶴弦（anemo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Lustrous Moonrise

### ヴァレサ
- ✅ 元素スキル: ホッピング・ナイトレインボー（electro_e）: キーあり `follow-up`
- ❌ 元素爆発: シャイニングヴェント！（electro_q） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: nightsoul-burst-icd
  - ダメージのみ: Flying Kick

### エスコフィエ
- ✅ 元素スキル: ミ・キュイ（cryo_e）: キーあり `escoffier-skill`
- ⚠️ 元素スキル(長押し): ミ・キュイ（cryo_e_hold） — **未収集（手で補う）**
  - 収集できなかった: ln7: character escoffier: key hold is invalid for action skill
- ❌ 元素爆発: デコ・デコパージュ（cryo_q） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: escoffier-a1, escoffier-a4-shred-cryo, escoffier-a4-shred-hydro
  - ダメージのみ: Scoring Cuts

### イファ
- ✅ 元素スキル: 天翔ける守護（anemo_e）: キーあり `nightsoul-blessing`
- ❌ 元素爆発: 複合鎮静フィールド（anemo_q） — **状態なし（瞬間・持続ダメージ等）**
  - 天賦・命ノ星座の状態のみ: ifa-a4
  - 内部（粒子CTなど）のみ: nightsoul-burst-icd
  - ダメージのみ: Compound Sedation Field

### スカーク
- ✅ 元素スキル: 極悪技・閃（cryo_e）: キーあり `seven-phase-flash`
- ✅ 元素スキル(長押し): 極悪技・閃（cryo_e_hold）: キーあり `skirk-hold-e-anim`
- ❌ 元素爆発: 極悪技・滅（cryo_q） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: skirk-particle-icd
  - ダメージのみ: Havoc: Ruin (DoT) / Havoc: Ruin (Final)

### ダリア
- ❌ 元素スキル: 受洗の礼典（hydro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: dahlia-particle-icd
  - ダメージのみ: Immersive Ordinance
- ✅ 元素爆発: 純光の祈り（hydro_q）: キーあり `dahlia-favonian-favor`

### フリンズ
- ✅ 元素スキル: 古律・孤灯の秘密（electro_e）: キーあり `manifest-flame`
- ❌ 元素爆発: 旧儀・夜の賓客（electro_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Cometh the Night (Initial) / Cometh the Night (Mid) / Cometh the Night (Final)

### アイノ
- ❌ 元素スキル: アイデアキャッチャー（hydro_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: aino-particle-icd
  - ダメージのみ: Musecatcher 0 / Musecatcher 1
- ✅ 元素爆発: お水ひえひえ装置（hydro_q）: キーあり `aino-q`

### ファルカ
- ✅ 元素スキル: 堕ちる烈風（anemo_e）: キーあり `sturm-und-drang`
- ✅ 元素スキル(長押し): 堕ちる烈風（anemo_e_hold）: キーあり `sturm-und-drang`
- ❌ 元素爆発: 我こそ朔風（anemo_q） — **状態なし（瞬間・持続ダメージ等）**
  - ダメージのみ: Northwind Avatar

### プルーネ
- ❌ 元素スキル: リンリン！魔女を狩る音（anemo_e） — **状態なし（瞬間・持続ダメージ等）**
  - 内部（粒子CTなど）のみ: prune-particle-icd
  - ダメージのみ: Ring-A-Ding-Ding! Hexhunter Ch
- ✅ 元素爆発: 魔女狩りの時間なのだ！（anemo_q）: キーあり `prune-burst`

