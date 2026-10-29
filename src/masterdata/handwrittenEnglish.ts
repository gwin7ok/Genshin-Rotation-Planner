/**
 * アプリが手で書いた名前・説明の英語（D249・D255。docs/i18n/plan.md 4.3.2 の 3-3）。
 *
 * - 対象: モードの名前・説明・ヒント、副次効果の名前、効果名、gcsimNote、フレームの出典、手で書いた発動バフ名など（画面に出るもの）。
 *   開発者向けのメモ（dataSource・source の根拠など）は対象外（D252。画面に出ない）。
 * - 生成・結び付けがすべて終わった後に呼ぶ（genshin-db の英語を付けた後。すでに英語がある欄は変えない）。
 * - 公式の英語が見つからなかった語は、docs/i18n/glossary.md に「要確認」で載せている。
 * - 処理（判定・照合・gcsim）は日本語の欄だけを見る。ここで足すのは表示用の `en` の欄だけ。
 */
import type { CharacterConfig } from '../types/genshin';
import type { ArtifactSetDatabaseItem, WeaponDatabaseItem } from '../types/database';

const JAPANESE = /[぀-ヿ一-鿿]/;

/** 状態・受付・効果などの名前（完全一致。説明文の型の中の名前にも使う） */
const TERMS: Record<string, string> = {
  // 公式の英語（genshin-db の英語の説明文で確認）
  'オズ': 'Oz',
  '雷楔': 'Lightning Stiletto',
  '夢想の一心': 'Musou Isshin',
  '儀来羽衣': 'Ceremonial Garment',
  '瞬水剣': 'Shunsuiken',
  '剣舞': 'Sword Dance',
  '冥祭': 'Mortuary Rite',
  '夜巡り': 'Night Vigil',
  'ぐるぐるコマちゃん': 'Turbo Twirly',
  '夜魂の加護': "Nightsoul's Blessing",
  '夜魂値': 'Nightsoul points',
  '夢浮かみ': 'Dreamdrifter',
  'マキシマムドライブ': 'Apex Drive',
  '七相一閃': 'Seven-Phase Flash',
  '幽炎の露顕': 'Manifest Flame',
  '北国の嵐槍': 'Northland Spearstorm',
  '影の舞': 'Shadow Dance',
  '疾風怒濤': 'Sturm und Drang',
  '奇策': 'Masterstroke',
  '愉悦': 'Joy',
  '風巡りの臨戦': 'Armed for Action',
  '剣気': 'Sword Essence',
  '狩人の照準': "Hunter's Precision",
  '柔き払暁のコーダ': "Adagio: Coda at Dawn's Tolling",
  '蒲公英の風': 'Dandelion Breeze',
  '璇璣屏': 'Jade Screen',
  '丹火の印': 'Scarlet Seal',
  '北国の嵐槍の後': 'after Northland Spearstorm',
  '純白の正': 'Confirmation of Purity',
  '漆黒の否': 'Denial of Darkness',
  '雷牙': 'Lightning Fang',
  '靖妖儺舞': 'Bane of All Evil',
  '蝶導来世': 'Guide to Afterlife',
  '雲の変化': 'Cloud Transmogrification',
  '怒目鬼王': 'Raging Oni King',
  '燔天の時': 'Hour of Burning Skies',
  '庭火焔硝': 'Niwabi Fire-Dance',
  // 公式の英語が見つからなかったもの（glossary.md の「要確認」）
  '近接の構え': 'Melee Stance',
  '風の加護': "Wind's Blessing",
  '剣域熾焔': 'Blazing Sword Domain',
  'パンチ連打モード': 'Rapid Punch Mode',
  '加圧': 'Pressurized',
  '潜水（加圧）': 'Diving (Pressurized)',
  '影狩り': 'Shadowhunt',
  '瑞獣の舞': 'Auspicious Beast Dance',
  '黄昏の祈り': 'Twilight Prayer',
  '羽月の輪': 'Feathermoon Ring',
  '雷霆のシンフォニー': 'Thunderous Symphony',
  '月相転移': 'Lunar Phase Shift',
  '月相の輝き': 'Lunar Radiance',
  '血の契約': 'Blood Pact',
  '標的の印': 'Target Mark',
  '速攻状態': 'Rapid Assault',
  '粛清': 'Purge',
  '月の祈り': "Moon's Prayer",
  '連撃の受付': 'Combo window',
  '再発動の受付': 'Recast window',
  'ルミの再発動の受付': 'Lumi recast window',
  '変換の受付': 'Conversion window',
  '羽月の輪の受付': 'Feathermoon Ring window',
  '雷霆のシンフォニーの受付': 'Thunderous Symphony window',
  '柔き払暁のコーダの受付': "Adagio: Coda at Dawn's Tolling window",
  '柔き払暁のコーダ後の強化': "Buff after Adagio: Coda at Dawn's Tolling",
  '黒蝕の龍': 'Dragon of Dark Decay',
  '元素爆発: 漆黒の法則・燻る星': 'Elemental Burst: Principle of Darkness: As the Stars Smolder',
  // アクション名
  '特殊元素爆発（マキシマムドライブ）': 'Special Elemental Burst (Apex Drive)',
  '特殊元素スキル「北国の嵐槍」（古律・孤灯の秘密の後）': 'Special Elemental Skill "Northland Spearstorm" (after Ancient Law: Lone Lamp\'s Secret)',
  '特殊元素爆発（嵐槍の後）': 'Special Elemental Burst (after Spearstorm)',
  // 状態バーの短い名前
  '落下攻撃': 'Plunge',
  '嵐槍': 'Spearstorm',
  'スキル': 'Skill',
  '爆発': 'Burst',
  // 副次効果（gcsimExtras）の名前
  '印（降衆天華）': 'Sigil (Celestial Shower)',
  '血梅香（敵に付く継続ダメージ）': 'Blood Blossom (DoT on enemy)',
  '静謐の光環': 'Serene Halo',
  '領域内（心景幻成）': 'In field (Illusory Heart)',
  '祈風の恵み（風元素ダメージアップ）': "Prayerful Wind's Benefit (Anemo DMG Up)",
  '詭風の禍つ（風元素耐性ダウン）': "Perfidious Wind's Bale (Anemo RES Down)",
  '紅鬃の血（自己ダメージ）': "Redmane's Blood (self-damage)",
  'ダメージアップ（退場で終了）': 'DMG Up (ends on switch-out)',
  'ファニーハット（帽子の召喚物）': 'Grin-Malkin Hat (hat summon)',
  '滞空の強化（ジャンプ力アップ）': 'Airborne boost (higher jumps)',
  '印（アロマティック・アナライズ）': 'Mark (Aromatic Analysis)',
  '獲物の印（敵）': 'Prey Mark (enemy)',
  '耐性ダウン（敵）': 'RES Down (enemy)',
  '物理耐性ダウン（敵）': 'Physical RES Down (enemy)',
  '氷元素耐性ダウン（敵）': 'Cryo RES Down (enemy)',
  '草元素耐性ダウン（敵）': 'Dendro RES Down (enemy)',
  '水元素耐性ダウン（敵）': 'Hydro RES Down (enemy)',
  '蒼白の賛歌・月の歌': 'Pale Hymn / Moon Song',
  '雷鳴の交響': 'Thunder Symphony',
  '印（お水ひえひえ装置）': 'Mark (Chilly Water Device)',
  '黒の姿（暗黒の否認）': 'Dark form (Denial of Darkness)',
  '白の姿（純粋の確認）': 'Light form (Confirmation of Purity)',
  '猫玉（フラスコ排出）': 'Cat Ball (flask ejection)',
  '重力（月の反応）': 'Gravity (Lunar reaction)',
  '反応ボーナス（爆発中）': 'Reaction Bonus (during Burst)',
  // CT の短縮・層の効果
  '周天の回転（CT −15%）': 'Celestial Rotation (CD −15%)',
  '粛清（最大層）攻撃力 +40%': 'Purge (max stacks) ATK +40%',
};

/** 説明文・ヒント・注記（完全一致） */
const SENTENCES: Record<string, string> = {
  // モードの説明
  'オズがいる間（効果時間は、夜巡りの翼・夜の幻現の効果継続時間）。この間の元素スキル（E）は再発動になり、CT を使わない（オズを呼び寄せる）':
    "While Oz is on the field (duration of Nightrider / Midnight Phantasmagoria). Elemental Skill (E) becomes a recast during this time and doesn't use CD (summons Oz back)",
  '近接の構え（魔王の武装）。構えの間の元素スキル（E）で遠距離に戻る。キャラ交代でも終わる。CT は構えの終わりから始まり、長さは構えに居た時間で決まる（30 秒の時間切れは 45 秒）':
    'Melee Stance (Foul Legacy: Raging Tide). Elemental Skill (E) during the stance returns to ranged. Also ends on character switch. CD starts when the stance ends, and its length depends on time spent in the stance (45s after the 30s timeout)',
  '風の加護（飛行）。状態の間の元素スキル（E）で終わる。終わらせないと交代できない。CT は状態の終わりから始まる':
    "Wind's Blessing (flight). Ends with Elemental Skill (E) during the state. You can't switch until it ends. CD starts when the state ends",
  '通常攻撃（N）・元素スキル（E）がパンチになるモード。モードの間の N・E はスキルの CT を使わない。モードの間のジャンプ、キャラ交代で終わる。終わった後の最初の N・E は、フィニッシュの蹴り':
    "A mode where Normal Attack (N) and Elemental Skill (E) become punches. N and E during the mode don't use the Skill CD. Ends on jump or character switch. The first N or E after it ends is the finishing kick",
  '加圧の状態。状態の間の元素スキル（E）で起爆する（CT は始まらない）。キャラ交代しても続く':
    "Pressurized state. Elemental Skill (E) during the state detonates it (CD doesn't start). Continues after character switch",
  '雲の変化の状態。状態の間の元素スキル（E）は 2・3 段目の跳躍（状態が更新される）。落下攻撃、キャラ交代で終わる':
    'Cloud Transmogrification state. Elemental Skill (E) during the state is the 2nd/3rd leap (refreshes the state). Ends on Plunging Attack or character switch',
  '夜巡りの状態。状態の間の元素スキル（E）は突き（CT なし）、通常攻撃は狩りの N になる。キャラ交代で終わる':
    'Night Vigil state. Elemental Skill (E) becomes a thrust (no CD) and Normal Attacks become hunting N during the state. Ends on character switch',
  'ぐるぐるコマちゃんが存在する状態。夜魂値（60）は、降りている間は 2 秒ごとの攻撃で 10 ずつ、乗っている間は 1 秒ごとと、通常攻撃 1 回ごとに 10 ずつ減り、0 になると終わる。続いている間の元素スキル（E）は乗り降りになる（CT なし）。交代しても残る':
    'Turbo Twirly is on the field. Nightsoul points (60) drop by 10 per attack every 2s while dismounted, and by 10 every 1s and per Normal Attack while mounted; it ends at 0. Elemental Skill (E) mounts/dismounts while it lasts (no CD). Remains after switching',
  '夜魂の加護の状態（10 秒）。通常攻撃は円軌道射撃になり、元素スキル（E）は夜魂値が満タン（20）のとき廻狩貫鱗砲になる（CT なし）。キャラ交代で終わる':
    "Nightsoul's Blessing state (10s). Normal Attacks become orbital shots, and Elemental Skill (E) becomes the special shot when Nightsoul points are full (20) (no CD). Ends on character switch",
  '夢浮かみ状態。状態の間の元素スキル（E）で解除する（CT は始まらない）。キャラ交代でも終わる':
    "Dreamdrifter state. Elemental Skill (E) during the state cancels it (CD doesn't start). Also ends on character switch",
  '特殊爆発を使える期間（受付）。使うと閉じる。受付の外では、gcsim では通常の爆発（CT が始まる）になる':
    'Window in which the special Burst can be used. Closes once used. Outside the window, gcsim uses the normal Burst (CD starts)',
  '夜魂の加護（トニックショット）。状態の間の通常攻撃は、トニックショット（約 0.9 秒ごと）になる。元素スキル（E）の再押しで終わる。終わらせないと交代できない。CT は状態の終わりから始まる':
    "Nightsoul's Blessing (Tonic Shot). Normal Attacks during the state become Tonic Shots (about every 0.9s). Ends by pressing Elemental Skill (E) again. You can't switch until it ends. CD starts when the state ends",
  '幽炎の露顕の状態。この間、特殊スキル「北国の嵐槍」（spE）を使える。キャラ交代で終わる':
    'Manifest Flame state. The special Skill "Northland Spearstorm" (spE) can be used during it. Ends on character switch',
  '影の舞の状態（9 秒）。草露を 1 滴以上持つとき、重撃が幻の戯（スタミナを消費しない特殊な重撃）になる（E 1 回につき 3 回まで。草露の数は数えていません）。キャラ交代で終わる':
    "Shadow Dance state (9s). With at least 1 Verdant Dew, Charged Attacks become a special Charged Attack that doesn't use Stamina (up to 3 per E; Verdant Dew is not counted). Ends on character switch",
  '再発動の受付（受付）。この間の元素スキル（E）は白、通常攻撃（N）は黒の再発動になり、CT を使わない。どちらを使っても受付は閉じる':
    "Recast window. During it, Elemental Skill (E) becomes the light recast and Normal Attack (N) the dark recast, without using CD. Using either closes the window",
  '月相転移の状態（15 秒）。通常攻撃・重撃は岩元素ダメージになり、元素スキル（E）は月相の輝きを 70 消費して霊駿の駆けになる（CT なし。4 回使うと終わる）。元素爆発で 1.7 秒延びる。キャラ交代で終わる':
    'Lunar Phase Shift state (15s). Normal and Charged Attacks deal Geo DMG, and Elemental Skill (E) consumes 70 Lunar Radiance for a special dash (no CD; ends after 4 uses). Extended by 1.7s by Elemental Burst. Ends on character switch',
  '疾風怒濤の状態。この間、特殊スキル（spE）を使える。ヒットストップ・自分の元素爆発で延びる。キャラ交代で終わる':
    'Sturm und Drang state. The special Skill (spE) can be used during it. Extended by hitlag and by her own Elemental Burst. Ends on character switch',
  '奇策の状態（13 秒）。通常攻撃・重撃が命中すると愉悦が溜まり、100 になると元素スキル（E）が魂を穿つ痛み（特殊元素スキル）になる（CT なし。1 回の奇策で 3 回まで）。元素爆発で 1.65 秒延びる。キャラ交代で終わる':
    'Masterstroke state (13s). Normal and Charged Attack hits build Joy; at 100, Elemental Skill (E) becomes a Special Elemental Skill (no CD; up to 3 per Masterstroke). Extended by 1.65s by Elemental Burst. Ends on character switch',
  '変換の受付（受付）。この間の元素スキル（E）は別の動作になり、CT を使わない。実際は、E のダメージが敵に拡散を起こしたときだけ開く（アプリは、拡散が起きる前提で、必ず開く）':
    "Conversion window. Elemental Skill (E) becomes a different action during it and doesn't use CD. In game it only opens when E's damage triggers Swirl (the app assumes Swirl and always opens it)",
  '風巡りの臨戦の状態（15 秒）。通常攻撃・重撃・落下攻撃・元素爆発で剣気が溜まり、元素スキル（E）が飛翔の剣（特殊元素スキル。剣気 1 枚を消費。CT なし）になる。5 回使うと終わる。キャラ交代で終わる':
    'Armed for Action state (15s). Normal, Charged and Plunging Attacks and Elemental Burst build Sword Essence, and Elemental Skill (E) becomes Windborne Sword (Special Elemental Skill; consumes 1 Sword Essence; no CD). Ends after 5 uses. Ends on character switch',
  '特殊スキルを使える期間（受付）。通常攻撃のヒットストップで延びる。受付の外では、gcsim では通常のスキルになる':
    'Window in which the special Skill can be used. Extended by Normal Attack hitlag. Outside the window, gcsim uses the normal Skill',
  '月の祈りの状態（8 秒）。通常攻撃が剣舞の N になる。キャラ交代で終わる':
    "Moon's Prayer state (8s). Normal Attacks become Sword Dance N. Ends on character switch",
  '漆黒の否の状態（30 秒）。元素爆発は「漆黒の法則・燻る星」（黒蝕の龍）になる。純白の正の状態に置き換わる':
    'Denial of Darkness state (30s). Elemental Burst becomes "Principle of Darkness: As the Stars Smolder" (Dragon of Dark Decay). Replaced by the Confirmation of Purity state',
  '純白の正の状態（30 秒）。元素爆発は「純白の法則・変転する光」（白焔の龍）になる。漆黒の否の状態に置き換わる':
    'Confirmation of Purity state (30s). Elemental Burst becomes "Principle of Purity: As the Light Shifts" (Dragon of White Flame). Replaced by the Denial of Darkness state',
  // CT の短縮・層の効果
  '霊刃·重華積霜の領域の間、操作中のキャラのスキル・爆発・特殊スキルのクールタイム −15%（命ノ星座 2。gcsim は、1 秒ごと・交代のたびに付け直す）':
    "While the Layered Frost field is active, the active character's Skill, Burst and special Skill CD −15% (C2. gcsim reapplies it every 1s and on each switch)",
  '粛清（20 秒。層ごとに独立。最大 6 層）。飛翔の剣・元素爆発で 1 層増える。霊剣のダメージが、層数 × 10% アップする。元素スキルを発動または退場でクリアされる':
    'Purge (20s, each stack independent, max 6 stacks). Windborne Sword and Elemental Burst add 1 stack. Spirit blade DMG +10% per stack. Cleared on Elemental Skill or switching out',
  '命ノ星座 2: 最大層の「粛清」を持っている間、ヴェスナの攻撃力 +40%':
    'C2: While at max Purge stacks, ATK +40%',
  // 置けないときのヒント
  '瞬水剣の間は重撃を使えません（gcsim は実行エラー）。瞬水剣が終わってから置いてください':
    "Charged Attacks can't be used during Shunsuiken (gcsim errors). Place it after Shunsuiken ends",
  '先に落下攻撃を置いて、雲の変化を終わらせてください':
    'Place a Plunging Attack first to end Cloud Transmogrification',
  '夜魂の加護の間は、重撃・落下攻撃は使えません':
    "Charged and Plunging Attacks can't be used during Nightsoul's Blessing",
  'ゲームでは、受付の間の長押し E は何も起きません（CT も使いません。回数 1 のとき。6 凸の回数 2 は未確認）。受付が終わってから置いてください':
    "In game, Hold E does nothing during the window (no CD used; with 1 use. 2 uses at C6 unverified). Place it after the window ends",
  '先に E（解除）を置いてください': 'Place E (cancel) first',
  '七相一閃が終わってから置いてください': 'Place it after Seven-Phase Flash ends',
  // ゲージの説明
  'A1（燃焼・烈開花で +7）・盲点（+4）による増加は数えていません。gcsim では、満タンでないと実行エラーになります。通常攻撃を足すか、時間を空けてください':
    "Gains from A1 (+7 on Burning/Burgeon) and blind spot (+4) aren't counted. gcsim errors unless it's full. Add Normal Attacks or leave more time",
  '月の結晶反応（+35）は数えていません。gcsim では、足りないと実行エラー（InsufficientStamina）になります。通常攻撃を足すか、時間を空けてください':
    "Lunar-Crystallize (+35) isn't counted. gcsim errors (InsufficientStamina) if there isn't enough. Add Normal Attacks or leave more time",
  '通常攻撃・重撃の命中数は wiki の記述からの推定です。闘争心・命ノ星座の効果は数えていません。足りないと特殊元素スキルは使えません':
    "Normal/Charged Attack hit counts are estimated from the wiki. Fighting Spirit and Constellation effects aren't counted. The Special Elemental Skill can't be used without enough",
  '剣気は 100 = 1 枚として数えています（wiki の記述による。実測ではありません）。足りないと飛翔の剣は使えません':
    "Sword Essence is counted as 100 = 1 (per the wiki, not measured). Windborne Sword can't be used without enough",
  // 特殊爆発の受付の説明
  '直前の落下攻撃（命ノ星座 2 以上、または猛烈パッション中）の後 2.3 秒以内で、その間にスキルを使っていないことが必要です':
    'Requires being within 2.3s after a Plunging Attack (C2+ or during the passion state) with no Skill used in between',
  '同じ出場の中で、状態中のスキル（北国の嵐槍）を使った後でないと使えません':
    'Only usable after using the in-state Skill (Northland Spearstorm) in the same time on field',
  // gcsimNote
  'gcsim が未実装': 'Not implemented in gcsim',
  'gcsim に、この効果の状態のキーが無い（即時の効果・ステータス加算・回復・エネルギー回復など）。gcsim の結果では上書きされない':
    "gcsim has no status key for this effect (instant effects, stat bonuses, healing, Energy, etc.). Not overwritten by gcsim results",
  'ディルック: 黎明の炎元素付与の延長と炎ダメージ+20% は、gcsim では元素爆発の効果（diluc-q）の中で処理される。元素爆発の効果バーに反映される':
    "Diluc: Dawn's Pyro infusion extension and Pyro DMG +20% are handled inside the Burst effect (diluc-q) in gcsim. Shown on the Burst effect bar",
  '甘雨: 降衆天華のエリア内の氷ダメージ+20% は、gcsim では元素爆発の効果（ganyu-field）の中で処理される。元素爆発の効果バーに反映される':
    "Ganyu: Cryo DMG +20% inside Celestial Shower's AoE is handled inside the Burst effect (ganyu-field) in gcsim. Shown on the Burst effect bar",
  'ディシア: 熔金の躰（浄焔怒涛の 9 秒後、チーム全員の炎場の中の中断耐性）は、gcsim が未実装（dehya/asc.go のコメント「interrupt res part of a1 is not implemented」。実行でも、状態が付かないことを確認）':
    'Dehya: the interruption resistance part of A1 is not implemented in gcsim (dehya/asc.go comment "interrupt res part of a1 is not implemented"; confirmed by running that no status is applied)',
  'ニコ: 3 秒は、観測の対象が出場してから聖祝の導きに昇格するまでの滞在時間（条件）で、効果の継続時間ではない。昇格した聖祝の導き（gcsim: guidance-of-theosis）は、20 秒の観測の定義（p1_1）に結び付ける':
    'The 3s is the time on field (a condition) before the observed target is promoted, not the effect duration. The promoted effect (gcsim: guidance-of-theosis) is linked to the 20s definition (p1_1)',
  // 聖遺物・武器の既定の文
  '2セット効果なし': 'No 2-piece effect',
  '4セット効果なし': 'No 4-piece effect',
  '常時発動または特殊効果なし': 'Always active or no special effect',
  'バフ効果': 'Buff',
  '4セット効果バフ': '4-piece buff',
};

/** 手で書いた武器・聖遺物の発動バフ名の、「X: 接尾」の接尾（X は英語の装備名にする） */
const BUFF_SUFFIXES: Record<string, string> = {
  '別れの歌': 'Farewell Song',
  '全員熟知バフ': 'Party EM buff',
  '抗争の歌': 'Banner-Hymn',
  '全員攻撃力+40%': 'Party ATK +40%',
  'スキル後チャージUP': 'Energy Recharge up after Skill',
  '回復&エネルギー再生': 'Healing & Energy regen',
  '唯空の葉': 'Leaf of Consciousness',
  'スキルCTリセット': 'Skill CD reset',
  '無色粒子生成': 'Energy particles',
  '元素ダメ+10〜20%': 'Elemental DMG +10–20%',
  '主題曲バフ': 'Theme song buff',
  '交代先攻撃力UP': 'ATK up for next character',
  '会心率UP': 'CRIT Rate up',
  '待機時スキルダメ+25%': 'Off-field Skill DMG +25%',
  '泡ダメージ': 'Bubble DMG',
  '該当元素ダメバフ+40%': 'Elemental DMG +40%',
  '全員攻撃力+20%': 'Party ATK +20%',
  '会心率+40%': 'CRIT Rate +40%',
  '彼方の効果': 'Waves of Days Past',
  '草元素耐性-30%': 'Dendro RES -30%',
  '拡散耐性-40%': 'Swirled element RES -40%',
  '潜光(攻撃力UP)': 'Nascent Light (ATK up)',
  '通常・重撃・落下ダメ+50%': 'Normal/Charged/Plunging DMG +50%',
  '該当元素ダメ+35%': 'Elemental DMG +35%',
  '全員元素熟知+120': 'Party EM +120',
  'チームエネルギー回復': 'Party Energy regen',
};

/** 決まった形の文（X は TERMS で訳す） */
const PATTERNS: [RegExp, (m: RegExpExecArray, term: (s: string) => string | undefined) => string | undefined][] = [
  [/^(.+?)の状態。入力がなければ ([\d.]+) 秒続く。キャラ交代で終わる$/,
    (m, term) => { const x = term(m[1]); return x && `${x} state. Lasts ${m[2]}s without input. Ends on character switch`; }],
  [/^(.+?)（受付）。この間の元素スキル（E）は別の動作になり、CT を使わない$/,
    (m, term) => { const x = term(m[1]); return x && `${x}. Elemental Skill (E) becomes a different action during it and doesn't use CD`; }],
  [/^gcsim PR #(\d+)（未マージ・未検証。(\d{4}-\d{2}-\d{2}) 時点）$/,
    m => `gcsim PR #${m[1]} (unmerged, unverified, as of ${m[2]})`],
  [/^推定（同じ武器種の (\d+) キャラの中央値。実測ではありません）$/,
    m => `Estimated (median of ${m[1]} characters with the same weapon type; not measured)`],
];

/** 手で書いた日本語の文の英語。無ければ undefined（表示は日本語のまま） */
export function handwrittenEnglish(ja: string | undefined): string | undefined {
  if (!ja || !JAPANESE.test(ja)) return undefined;
  const exact = TERMS[ja] ?? SENTENCES[ja];
  if (exact) return exact;
  for (const [re, f] of PATTERNS) {
    const m = re.exec(ja);
    if (m) {
      const en = f(m, s => TERMS[s]);
      if (en) return en;
    }
  }
  return undefined;
}

/** 表示用の文の欄（この名前の欄に日本語があり、en に無ければ足す） */
const TEXT_FIELDS = ['name', 'label', 'description', 'barNote', 'hint', 'effectLabel', 'specialBurstHint', 'gcsimNote', 'buttonLabel', 'statEffectSummary', 'statEffect', 'effect2p', 'effect4p'];
/** 中を見ない欄（開発者向けのメモ・英語そのもの） */
const SKIP_KEYS = new Set(['en', 'dataSource', 'source']);

/** オブジェクトの木をたどって、表示用の文の欄に英語を足す（すでにある英語は変えない） */
function fillTree(node: unknown): void {
  if (Array.isArray(node)) { for (const x of node) fillTree(x); return; }
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown> & { en?: Record<string, unknown> };
  for (const f of TEXT_FIELDS) {
    const v = o[f];
    if (typeof v !== 'string' || o.en?.[f]) continue;
    const en = handwrittenEnglish(v);
    if (en) o.en = { ...o.en, [f]: en };
  }
  for (const [k, v] of Object.entries(o)) if (!SKIP_KEYS.has(k) && v && typeof v === 'object') fillTree(v);
}

/** キャラのマスターに、手で書いた名前・説明の英語を付ける（その場で書き換える） */
export function attachHandwrittenCharacterEnglish(characters: CharacterConfig[]): void {
  for (const c of characters) {
    fillTree(c);
    const fs = handwrittenEnglish(c.source?.frameSource);
    if (fs) c.en = { ...c.en, frameSource: fs };
  }
}

type EquipmentBuff = { name: string; en?: { name?: string } };

/** 手で書いた発動バフ名「X: 接尾」「X4: 接尾」を、英語の装備名 + 訳した接尾にする */
function fillBuffNames(buffs: EquipmentBuff[] | undefined, prefix: string | undefined): void {
  if (!prefix) return;
  for (const b of buffs ?? []) {
    if (b.en?.name || !JAPANESE.test(b.name)) continue;
    const suffix = /^[^:]+: (.+)$/.exec(b.name)?.[1];
    const en = suffix && BUFF_SUFFIXES[suffix];
    if (en) b.en = { ...b.en, name: `${prefix}: ${en}` };
  }
}

/** 旧形式の buffEffect に、最初の発動バフの英語を写す（中身は最初の発動バフと同じ） */
function fillLegacy(item: WeaponDatabaseItem | ArtifactSetDatabaseItem): void {
  const legacy = item.buffEffect;
  const first = item.buffEffects?.[0];
  if (!legacy || !first?.en) return;
  const en = {
    ...(first.en.name ? { name: first.en.name } : {}),
    ...(first.en.description ? { description: first.en.description } : {}),
    ...(first.en.statEffectSummary ? { statEffect: first.en.statEffectSummary } : {}),
  };
  if (Object.keys(en).length > 0) legacy.en = { ...en, ...legacy.en };
}

/** 武器・聖遺物のマスターに、手で書いた名前・説明の英語を付ける（その場で書き換える） */
export function attachHandwrittenEquipmentEnglish(weapons: WeaponDatabaseItem[], artifacts: ArtifactSetDatabaseItem[]): void {
  for (const w of weapons) {
    fillBuffNames(w.buffEffects, w.en?.name);
    for (const r of w.refinements ?? []) fillBuffNames(r.buffEffects, w.en?.name);
    fillLegacy(w);
    fillTree(w);
  }
  for (const a of artifacts) {
    fillBuffNames(a.buffEffects, a.en?.name ? `${a.en.name} 4P` : undefined);
    fillLegacy(a);
    fillTree(a);
  }
}
