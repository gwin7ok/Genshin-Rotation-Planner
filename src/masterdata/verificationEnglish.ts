/**
 * 検証データ（網羅状況の JSON・docs の確認用の文書）の英語（D252。docs/i18n/progress.md の 4-7）。
 *
 * 使うのはスクリプトだけ（アプリには入らない）。文書は、日本語（`〜.md`）と英語（`〜.en.md`）を両方書く。
 * - 名前（キャラ・効果・武器・聖遺物）は、マスター・辞書の英語の欄を使う（`nameEnOf`）
 * - 手で書いた理由・メモは、下の VERIFICATION_TEXTS（日本語の文 → 英語）。アプリの文の辞書（handwrittenEnglish.ts）も引く
 * - 辞書に無い文は、英語の文書でも日本語のまま出し、スクリプトの最後に一覧を出す（`reportMissingEnglish`）
 */
import fs from 'node:fs';
import { handwrittenEnglish } from './handwrittenEnglish.ts';

export type DocLanguage = 'ja' | 'en';
export const DOC_LANGUAGES: DocLanguage[] = ['ja', 'en'];

/** 文書のファイル名（英語は `.en.md`） */
export const docPath = (jaPath: string, lang: DocLanguage): string => (lang === 'en' ? jaPath.replace(/\.md$/, '.en.md') : jaPath);

const JAPANESE = /[぀-ヿ一-鿿]/;

/** 手で書いた理由・メモの英語（日本語の文そのものがキー） */
const VERIFICATION_TEXTS: Record<string, string> = {
  // 理由・方針（決まった言い回し）
  'D5: 2セット効果は発動バフのバーにしない': 'D5: 2-piece set effects get no buff bar',
  'gcsim にキャラが未登録': 'Character not registered in gcsim',
  'gcsim辞書で内部キーに分類されている': 'Classified as an internal key in the gcsim dictionary',
  'gcsim にあるが、アプリのマスターにキャラが無い': 'In gcsim, but the character is not in the app master',
  '手で補う一覧で「書き戻さない」と指定': 'Marked "do not write back" in the hand-written list',
  'マスターのキー配列が参照するgcsimキーが辞書に無い': 'A gcsim key referenced by a master key array is not in the dictionary',
  'マスターが参照するgcsimキーが辞書に無い': 'A gcsim key referenced by the master is not in the dictionary',
  '辞書キーに対応するマスター効果定義または対象外理由が無い': 'No master effect definition or exclusion reason for this dictionary key',
  '現行辞書に対応キーが無い。gcsimが別経路で扱うか、対象外かを確認する': 'No matching key in the current dictionary. Check whether gcsim handles it another way or it is out of scope',
  'gcsimTarget とキー配列の整合を確認する': 'Check that gcsimTarget and the key arrays agree',
  'gcsim 対象外。理由は未記載': 'Not a gcsim target; no reason given',
  '6-A2: 定義を持たない常時効果の扱い・表示が未実装': '6-A2: handling and display of permanent effects without a definition is not implemented',
  '継続時間延長で、独立した効果定義にしない': 'Duration extension; not a separate effect definition',
  '内部（デバウンス・ロックアウト・アニメーション・確認用・短い状態）で、効果のバーにしない': 'Internal (debounce, lockout, animation, check-only, short state); no effect bar',
  '再発動・発動条件の猶予の短い窓（効果ではない）': 'Short grace window for recast / trigger conditions (not an effect)',
  '反応で生じる設置物で、アクションの効果ではない': 'A construct created by a reaction, not an effect of the action',
  '反撃用の短いシールドでバーにしない（対象側の決定に合わせる）': 'Short counterattack shield; no bar (matches the decision on the target side)',
  '同じ効果・同じ持続期間のものが、本体のバー（別のキー）で紐づけ済み': 'The same effect with the same duration is already linked through the main bar (another key)',
  '命ノ星座の効果。マスター側の命ノ星座の定義（constellationEffects）に結び付け済み（6-A2。D91。2026-10-09）': 'Constellation effect. Already linked to the constellation definition in the master (constellationEffects) (6-A2; D91; 2026-10-09)',
  '固有天賦の効果。発動バフ（固有天賦）として扱う（6-3c。ユーザー決定 2026-09-30）': 'Passive talent effect. Handled as a buff (passive talent) (6-3c; user decision 2026-09-30)',
  '継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）': 'Damage over time is a short single burst (0.08–2.4s) inside the attack animation. No bar (user decision 2026-09-30)',
  '枠が読めない固有天賦（関数名 passive）': 'Passive talent whose slot cannot be read (function name passive)',
  '風元素共鳴のCT短縮。アプリでは計算ロジックに実装済み': 'Anemo resonance CD reduction. Already implemented in the app calculation logic',
  'gcsim は、雷共鳴を元素粒子の生成だけで実装している（setup.go: 感電・過負荷・超電導・開花系の反応で、5 秒に 1 回、雷元素粒子 1 個を配る。状態・CT のキーは無い）。アプリの定義に時間・CT が無いので、結び付けるキーは無く、gcsim の結果の書き戻しの対象外（2026-10-09 確認）':
    'gcsim implements Electro resonance only as particle generation (setup.go: Electro-Charged, Overloaded, Superconduct and Bloom-type reactions give 1 Electro particle once every 5s; no status or CD keys). The app definition has no duration or CD, so there is no key to link and it is not written back from gcsim results (checked 2026-10-09)',
  'ヘクセライの追加の固有天賦（アプリに定義が無い）': 'Hexerei bonus passive talent (no definition in the app)',
  'イアンサ 6凸: 運動量メーターの延長（EXCLUDED_CONSTELLATIONS）': 'Iansan C6: Kinetic Energy Scale extension (EXCLUDED_CONSTELLATIONS)',
  '旅人: ストーリークエスト報酬の基礎ステータス': 'Traveler: base stats from story quest rewards',
  // 含まれる効果・副次効果の名前
  'スキル中の拡散反応ダメージ増': 'Swirl DMG increase during the skill',
  '熱狂による与ダメージ増': 'DMG increase from Fanfare',
  '熱狂による回復量増': 'Healing increase from Fanfare',
  '爆発中のダメージ加算': 'DMG bonus during the burst',
  '爆発中の攻撃力増': 'ATK increase during the burst',
  '爆発中の通常攻撃ダメージ加算': 'Normal Attack DMG bonus during the burst',
  '命ノ星座4「西狩」。領域内の敵への氷ダメージ増': 'Constellation 4 "Westward Sojourn": Cryo DMG increase against opponents in the field',
  '星命定軌（敵の被ダメージ増）。本体の持続は mona-bubble': 'Omen (opponents take more DMG). The main duration is mona-bubble',
  '通常攻撃の強化（血の債務の状態に依存）': 'Normal Attack enhancement (depends on the Bond of Life state)',
  '鍾離のシールドに付随する元素別の内部状態（各1秒）でバーにしない': 'Per-element internal states attached to Zhongli\'s shield (1s each); no bar',
  // キャラ別のメモ（決まった形でないもの）
  'アルレッキーノ: 血の債務の上限を決める 35 秒の内部の窓。効果本体は directive（30 秒）': 'Arlecchino: a 35s internal window that sets the Bond of Life cap. The effect itself is directive (30s)',
  'アンバーの長押し: 一回押しと同じ（固有天賦 amber-a1 だけ）': "Amber's Hold Skill: same as the tap (only the passive talent amber-a1)",
  'アーロイ: コイルの蓄積数（内部の数え）': 'Aloy: Coil stack count (internal counter)',
  'アーロイ: 本体 rushingice と同じ関数で登録する、同じ 10 秒の攻撃付与': 'Aloy: the same 10s attack infusion, registered by the same function as the main rushingice',
  'イファ: 落下攻撃ができる短い窓（約 0.4 秒）。夜魂の状態（nightsoul-blessing）を効果時間にしている': "Ifa: a short window for a plunging attack (about 0.4s). The Nightsoul's Blessing state (nightsoul-blessing) is used as the effect duration",
  'イルーガのスキル: gcsim v2.48.0 で実行でき、ダメージ（Dawnbearing Songbird (Tap)）のみで、バーにする状態・設置物・シールドが出ない（ソース illuga/skill.go で確認。ユーザー確認済み 2026-09-30）':
    "Illuga's Skill: runs in gcsim v2.48.0 with damage only (Dawnbearing Songbird (Tap)); no status, construct or shield for a bar (checked in illuga/skill.go; confirmed by the user 2026-09-30)",
  'イルーガの長押し: 同上（Dawnbearing Songbird (Hold) のダメージのみ。ユーザー確認済み 2026-09-30）': "Illuga's Hold Skill: same as above (damage of Dawnbearing Songbird (Hold) only; confirmed by the user 2026-09-30)",
  'エスコフィエの長押し: gcsim は長押しの指定（hold）を拒否して実行できず、効果も出ない。紐づけず、マスターの効果時間（20 秒）でバーを表示する（ユーザー決定 2026-09-30）':
    "Escoffier's Hold Skill: gcsim rejects the hold option, so it cannot run and reports no effect. Not linked; the bar uses the master effect duration (20s) (user decision 2026-09-30)",
  'エミリエ: 芳香を集められない状態が 8 秒続くとランク 1 に戻る猶予時間。効果本体は lumidouce-case': 'Emilie: the grace period after which the case returns to level 1 if no Scents are collected for 8s. The effect itself is lumidouce-case',
  'オデット: スキルを再発動できる猶予時間（約 6 秒）。効果本体は odette-dance-double': 'Odette: the grace period for recasting the skill (about 6s). The effect itself is odette-dance-double',
  'キャンディスのスキル: gcsim は短いシールド（0.27 秒）を出すが、効果として短すぎるので、紐づけず・バーも出さない': "Candace's Skill: gcsim reports a short shield (0.27s), but it is too short to be an effect; not linked and no bar",
  'キャンディスの長押し: gcsim は短いシールド（1.5 秒）を出すが、効果として短すぎるので、紐づけず・バーも出さない': "Candace's Hold Skill: gcsim reports a short shield (1.5s), but it is too short to be an effect; not linked and no bar",
  'クレーのスキル: ゲーム内に持続する効果があるが、gcsim は地雷はダメージのみ。紐づけず、マスターの効果時間（15 秒（ブービートラップ））でバーを表示する（ユーザー決定 2026-09-30）':
    "Klee's Skill: there is a lasting effect in the game, but gcsim only reports damage for the mines. Not linked; the bar uses the master effect duration (15s, Boom-Bombs) (user decision 2026-09-30)",
  'ゴロー: スキルの旗の領域内で更新される防御バフ。本体 gorou-e-warbanner で表示済み': "Gorou: a DEF buff refreshed inside the skill's banner field. Already shown by the main gorou-e-warbanner",
  'シグウィン: 泡の段階（蓄積状態）': 'Sigewinne: bubble stage (stack state)',
  'シロネンの爆発: ゲーム内に持続する効果があるが、gcsim は爆発本体の状態を出さない。紐づけず、マスターの効果時間（12 秒（歓喜リズム））でバーを表示する（ユーザー決定 2026-09-30）':
    "Xilonen's Burst: there is a lasting effect in the game, but gcsim reports no status for the burst itself. Not linked; the bar uses the master effect duration (12s, Joyful Rhythm) (user decision 2026-09-30)",
  'ジンのスキル: マスターの 5 秒は溜めの最大時間（動作の長さ）で、効果ではない。gcsim も状態を出さない': "Jean's Skill: the master's 5s is the maximum charging time (the length of the action), not an effect. gcsim reports no status either",
  'ジンの長押し: 一回押しと同じ（マスターの 5 秒は溜めの最大時間で、効果ではない。gcsim も状態を出さない）': "Jean's Hold Skill: same as the tap (the master's 5s is the maximum charging time, not an effect; gcsim reports no status either)",
  'スカークの長押し: gcsim は skirk-hold-e-anim（0 秒。動作の目印）しか出さない。紐づけず、マスターの効果時間（12.5 秒）でバーを表示する（ユーザー決定 2026-09-30）':
    "Skirk's Hold Skill: gcsim only reports skirk-hold-e-anim (0s; an action marker). Not linked; the bar uses the master effect duration (12.5s) (user decision 2026-09-30)",
  'チャスカ: 同上': 'Chasca: same as above',
  'チャスカの爆発: 出るのは固有天賦の状態（chasca-a1）だけで、スキル・爆発の効果ではない。6-3c で扱う（ユーザー決定 2026-09-30）。自動収集の chasca-plunge-available は 0.43 秒の落下攻撃の窓で誤り':
    "Chasca's Burst: only the passive talent status (chasca-a1) appears, not a Skill / Burst effect. Handled in 6-3c (user decision 2026-09-30). The automatically collected chasca-plunge-available is a 0.43s plunging attack window and is wrong",
  'ディシア: 爆発中のキックまでの 0.77 秒の窓': 'Dehya: a 0.77s window until the kick during the burst',
  'ナヴィアのスキル: gcsim は個数で管理し、状態を出さない。紐づけず、バーに出さない方針（マスターの効果時間 300 秒（裂晶の欠片。ゲームの値は正しいが、ローテーション全体を覆う長さになる））（ユーザー決定 2026-09-30）':
    "Navia's Skill: gcsim tracks it as a count and reports no status. Not linked and not shown as a bar (master effect duration 300s, Crystal Shrapnel; the game value is correct, but it would cover the whole rotation) (user decision 2026-09-30)",
  'ナヴィアの長押し: 一回押しと同じ（gcsim は個数で管理し、状態を出さない。バーに出さない）': "Navia's Hold Skill: same as the tap (gcsim tracks it as a count and reports no status; no bar)",
  'ヌヴィレットのスキル: ゲーム内に持続する効果があるが、gcsim は状態を出さない（攻撃時の回復のみ）。紐づけず、マスターの効果時間（15 秒（源水の雫））でバーを表示する（ユーザー決定 2026-09-30）':
    "Neuvillette's Skill: there is a lasting effect in the game, but gcsim reports no status (only healing on attack). Not linked; the bar uses the master effect duration (15s, Sourcewater Droplet) (user decision 2026-09-30)",
  'ファルカの特殊スキル（spE。2026-10-01 に別アクションにした）: gcsim が出すのはダメージ（Four Winds Ascension）と CT（special_skill 11 秒・2 チャージ）だけで、バーにする状態は出ない（スキルの状態 sturm-und-drang は、スキル本体で表示）':
    "Varka's special skill (spE; made a separate action on 2026-10-01): gcsim only reports damage (Four Winds Ascension) and the CD (special_skill, 11s, 2 uses); no status for a bar (the skill state sturm-und-drang is shown by the skill itself)",
  'フリンズの特殊爆発（嵐槍の後）: ダメージのみで、持続する効果は無い。爆発が使える 6 秒の窓（thunderous-symphony）は、嵐槍の側のモードの定義（special）のバー。ユーザー確認済み 2026-10-09':
    "Flins's special burst (after the storm spear): damage only, no lasting effect. The 6s window in which the burst can be used (thunderous-symphony) is the bar of the mode definition (special) on the storm spear side. Confirmed by the user 2026-10-09",
  'フリーナ: 命ノ星座6の効果「万民のまなざし」（10秒）。マスター側の命ノ星座の定義に結び付け済み（6-A2。D92。2026-10-09）': 'Furina: Constellation 6 effect "Center of Attention" (10s). Already linked to the constellation definition in the master (6-A2; D92; 2026-10-09)',
  'マーヴィカのスキル: 夜魂の状態（nightsoul-blessing）で登録済み': "Mavuika's Skill: already registered as the Nightsoul's Blessing state (nightsoul-blessing)",
  'マーヴィカの再発動: gcsim に新しい継続時間のイベントが出ない。バーを表示できないため登録しない': "Mavuika's recast: gcsim reports no new duration event. Not registered because no bar can be shown",
  'マーヴィカの再発動: 同上': "Mavuika's recast: same as above",
  'モナの爆発: 星命定軌は mona-omen（含まれる）と mona-bubble（本体）で紐づけ済み': "Mona's Burst: Omen is already linked through mona-omen (included) and mona-bubble (main)",
  'ラウマ: 重撃（長押し）で入る鹿の状態（攻撃の分類）': 'Lauma: the deer state entered by a Charged Attack (hold) (an attack category)',
  'リネの爆発: ファニーハット・キャット変身 3 秒は本体（lyney-q）のバーで表示': "Lyney's Burst: the 3s Grin-Malkin Cat transformation is shown by the main bar (lyney-q)",
  'リネットの長押し: 敵に付く影の印は長押しの間だけ（gcsim は状態のキーを出さない）で、動作の長さのバーに含まれる。出るのはダメージと粒子・並び替えの内部の間隔だけ。ユーザー確認済み 2026-10-09':
    "Lynette's Hold Skill: the Shadowsign on the opponent only lasts while holding (gcsim reports no status key) and is included in the action-length bar. Only damage and the internal particle / reordering intervals appear. Confirmed by the user 2026-10-09",
  'レザーの長押し: マスターの 18 秒（雷の印）は短押しの効果。長押しは印を作らず消費する動作で、gcsim も印の状態を出さない（短押しは razor-sigil で紐づけ済み）':
    "Razor's Hold Skill: the master's 18s (Electro Sigil) is the tap effect. The hold consumes Sigils instead of creating one, and gcsim reports no Sigil state either (the tap is linked through razor-sigil)",
  'ヴァレサ: 落下攻撃のあとに付く 2.3 秒の状態（攻撃の分類。スキル・爆発の効果ではない）': 'Varesa: a 2.3s state after a plunging attack (an attack category, not a Skill / Burst effect)',
  'ヴァレサの特殊爆発（大火山おろし）: ダメージのみで、持続する効果は無い。特殊爆発の受付（マキシマムドライブ）は、モードの定義（special）のバー。ユーザー確認済み 2026-10-09':
    "Varesa's special burst (Volcano Kablam): damage only, no lasting effect. The special burst window (Maximum Drive) is the bar of the mode definition (special). Confirmed by the user 2026-10-09",
  '七七: 啓示（内部の状態）': 'Qiqi: Revelation (internal state)',
  '八重神子: 最も古い殺生桜の期限（最古が消えるたびに更新される）。桜の寿命・押し出し・爆発での消滅は、アプリ側の数え方（totemTracker.ts）で管理する。gcsim の状態は、最後の 1 つが消えるときにログが出ず、2 つ目以降の更新後の期限は gcsim の計算の誤りで実際より遅いため、使わない（ユーザー決定 D81 2026-10-09）':
    "Yae Miko: the expiry of the oldest Sesshou Sakura (refreshed each time the oldest disappears). Sakura lifetime, pushing out and removal by the burst are managed by the app's own counting (totemTracker.ts). The gcsim status is not used because no log appears when the last one disappears, and the refreshed expiry from the second one onward is later than the real one due to a gcsim calculation error (user decision D81 2026-10-09)",
  '八重神子のスキル: 殺生桜のバーは、アプリ側で E ごとに出す（寿命 14 秒、諭示で 24 秒。押し出し・爆発〔諭示なし〕で切る）。gcsim の結果の反映で置き換えない。反映されるのは E の発動位置だけ（ユーザー決定 D81 2026-10-09）':
    "Yae Miko's Skill: the Sesshou Sakura bars are created by the app for each E (lifetime 14s, 24s with the Witch's Eve Rite; cut by pushing out or by the burst [without the Rite]). They are not replaced when applying gcsim results; only the E cast positions are applied (user decision D81 2026-10-09)",
  '八重神子のスキルの継続ダメージ。すべての桜の合算で、E 1 回の分に分けられないため、バーにしない。桜のバーは、アプリ側の数え方で出す（ユーザー決定 D81 2026-10-09）':
    "Damage over time of Yae Miko's Skill. It is the total of all Sakura and cannot be split per E, so it gets no bar. The Sakura bars come from the app's own counting (user decision D81 2026-10-09)",
  '北斗のスキル: gcsim は反撃用の短いシールド（0.38 秒）を出すが、効果として短すぎるので、紐づけず・バーも出さない': "Beidou's Skill: gcsim reports a short counterattack shield (0.38s), but it is too short to be an effect; not linked and no bar",
  '千織のスキル: ゲーム内に持続する効果があるが、gcsim は内部のタイマー（17.5 秒）でイベントを出さない。紐づけず、マスターの効果時間（17 秒（たもと））でバーを表示する（ユーザー決定 2026-09-30）':
    "Chiori's Skill: there is a lasting effect in the game, but gcsim uses an internal timer (17.5s) and reports no event. Not linked; the bar uses the master effect duration (17s, Tamoto) (user decision 2026-09-30)",
  '千織の長押し: 一回押しと同じ（「たもと」の存在時間はアプリ側のバー）': "Chiori's Hold Skill: same as the tap (the Tamoto lifetime is the app's own bar)",
  '嘉明: 爆発中の万歳の獅子が歩いて戻る間の内部状態（1.7 秒）': 'Gaming: an internal state while Wushou the lion walks back during the burst (1.7s)',
  '放浪者: 落下攻撃ができる短い窓（約 0.4 秒）。効果本体は windfavored-state': 'Wanderer: a short window for a plunging attack (about 0.4s). The effect itself is windfavored-state',
  '早柚の長押し: マスターの 10 秒は長押しの最大時間（動作の長さ）で、効果ではない。gcsim も状態を出さない': "Sayu's Hold Skill: the master's 10s is the maximum hold time (the length of the action), not an effect. gcsim reports no status either",
  '甘雨のスキル: ゲーム内に持続する効果があるが、gcsim は氷蓮はダメージのみ。紐づけず、マスターの効果時間（6 秒（氷蓮））でバーを表示する（ユーザー決定 2026-09-30）':
    "Ganyu's Skill: there is a lasting effect in the game, but gcsim only reports damage for the Ice Lotus. Not linked; the bar uses the master effect duration (6s, Ice Lotus) (user decision 2026-09-30)",
  '白朮の爆発: シールド（Baizhu Seamless shield）で登録済み': "Baizhu's Burst: already registered as a shield (Baizhu Seamless shield)",
  '神里綾人の爆発: 18 秒の持続は本体（ayato-burst）のバーで表示': "Kamisato Ayato's Burst: the 18s duration is shown by the main bar (ayato-burst)",
  '空(水)の爆発: ゲーム内に持続する効果があるが、gcsim はダメージのみ。紐づけず、マスターの効果時間（4 秒（昇流統水。命ノ星座で 7 秒に延びるが、アプリの値は凸数を反映しない））でバーを表示する（ユーザー決定 2026-09-30）':
    "Aether (Hydro)'s Burst: there is a lasting effect in the game, but gcsim only reports damage. Not linked; the bar uses the master effect duration (4s, Rising Waters; a constellation extends it to 7s, but the app value does not reflect constellations) (user decision 2026-09-30)",
  '蛍(水)の爆発: ゲーム内に持続する効果があるが、gcsim はダメージのみ。紐づけず、マスターの効果時間（4 秒（昇流統水。命ノ星座で 7 秒に延びるが、アプリの値は凸数を反映しない））でバーを表示する（ユーザー決定 2026-09-30）':
    "Lumine (Hydro)'s Burst: there is a lasting effect in the game, but gcsim only reports damage. Not linked; the bar uses the master effect duration (4s, Rising Waters; a constellation extends it to 7s, but the app value does not reflect constellations) (user decision 2026-09-30)",
  '空・蛍(水)の長押し: ソース（traveler/common/hydro/skill.go）で、長押しの動作で放つ露雫の弾（弾道の到達まで）と確認。効果ではなくアクション自身の動作なのでバーにしない':
    "Aether / Lumine (Hydro)'s Hold Skill: confirmed in the source (traveler/common/hydro/skill.go) as the Dewdrop projectiles fired by the hold action (until they land). It is the action itself, not an effect, so no bar",
  '空・蛍(炎)のスキル: ソース（traveler/common/pyro/skill.go）で、夜魂の状態が続く間 1.1 秒ごとに出る炎門のダメージと確認。夜魂の状態（nightsoul-blessing）で登録済み':
    "Aether / Lumine (Pyro)'s Skill: confirmed in the source (traveler/common/pyro/skill.go) as damage dealt every 1.1s while the Nightsoul state lasts. Already registered as the Nightsoul's Blessing state (nightsoul-blessing)",
  '荒瀧一斗の爆発: 爆発モードの持続は本体（itto-q）のバーで表示': "Arataki Itto's Burst: the burst mode duration is shown by the main bar (itto-q)",
  '重雲の領域（10 秒）。氷付与の効果バーと、命ノ星座 2 の CT 短縮のバーは、アプリの fieldEffect（命中 + 領域 + 付与の長さ）で作る（D106）。書き戻さない':
    "Chongyun's field (10s). The Cryo infusion bar and the Constellation 2 CD reduction bar are built from the app's fieldEffect (hit + field + infusion length) (D106). Not written back",
  '鍾離の爆発: ゲーム内に持続する効果があるが、gcsim は石化の状態を出さない。紐づけず、マスターの効果時間（3.1 秒（石化））でバーを表示する（ユーザー決定 2026-09-30）':
    "Zhongli's Burst: there is a lasting effect in the game, but gcsim reports no Petrification status. Not linked; the bar uses the master effect duration (3.1s, Petrification) (user decision 2026-09-30)",
  '雲菫のスキル: gcsim は反撃用の短いシールド（0.22 秒）を出すが、効果として短すぎるので、紐づけず・バーも出さない': "Yun Jin's Skill: gcsim reports a short counterattack shield (0.22s), but it is too short to be an effect; not linked and no bar",
  '雲菫の長押し Lv.1: 一回押しと同じ（gcsim は反撃用の短いシールドを出すが、効果としてバーにしない）': "Yun Jin's Hold Skill Lv.1: same as the tap (gcsim reports a short counterattack shield, but it gets no bar as an effect)",
  '雲菫の長押し Lv.2: 一回押しと同じ（gcsim は反撃用の短いシールドを出すが、効果としてバーにしない）': "Yun Jin's Hold Skill Lv.2: same as the tap (gcsim reports a short counterattack shield, but it gets no bar as an effect)",
  '鹿野院平蔵のスキル: gcsim は内部の数で管理し、状態を出さない。紐づけず、バーに出さない方針（マスターの効果時間 60 秒（変格。ゲームの値は正しいが、ローテーション全体を覆う長さになる））（ユーザー決定 2026-09-30）':
    "Shikanoin Heizou's Skill: gcsim tracks it as an internal count and reports no status. Not linked and not shown as a bar (master effect duration 60s, Declension; the game value is correct, but it would cover the whole rotation) (user decision 2026-09-30)",
  '鹿野院平蔵の長押し: 一回押しと同じ（gcsim は内部の数で管理し、状態を出さない）': "Shikanoin Heizou's Hold Skill: same as the tap (gcsim tracks it as an internal count and reports no status)",
};

/** キャラ名（日本語 → 英語）。スクリプトだけが使うので、マスターの JSON を必要になったときに読む */
let charNames: Map<string, string> | undefined;
function charNameEn(ja: string): string | undefined {
  if (!charNames) {
    charNames = new Map();
    try {
      const chars = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8')) as { name: string; englishName?: string; en?: { name?: string } }[];
      for (const c of chars) charNames.set(c.name, c.en?.name || c.englishName || c.name);
    } catch {
      // 読めないとき（作業フォルダが違う）は、名前を英語にしない
    }
  }
  return charNames.get(ja);
}

/** 「<キャラ>の<アクション>」の英語 */
const ACTIONS: Record<string, string> = { 'スキル': 'Skill', '爆発': 'Burst', '長押し': 'Hold Skill', '再発動': 'recast' };
function subjectEn(ja: string): string | undefined {
  const m = /^(.+)の(スキル|爆発|長押し|再発動)$/.exec(ja);
  const name = m && charNameEn(m[1]);
  return name ? `${name}'s ${ACTIONS[m[2]]}` : undefined;
}

/** 効果の性質（effectNature.ts の NATURE_LABEL）の英語 */
const NATURES: Record<string, string> = { 'HP 回復': 'HP recovery', 'その他': 'other', 'エネルギー回復': 'Energy recovery', '追加攻撃': 'additional attack' };

/** 決まった形の文 */
const PATTERNS: [RegExp, (m: RegExpExecArray) => string | undefined][] = [
  [/^(.+?): 瞬間の効果。複数回・組み合わせの実測（(\d{4}-\d{2}-\d{2})）でも、ダメージ以外のイベント（状態・設置物・シールド・回復）が出ない。ユーザー確認済み$/,
    m => { const s = subjectEn(m[1]); return s && `${s}: instant effect. Even measured with multiple casts and combinations (${m[2]}), no events other than damage (status, construct, shield, heal) appear. Confirmed by the user`; }],
  [/^(.+?): gcsim が出すのは固有天賦の状態（(.+?)）だけで、スキル・爆発の効果ではない。6-3c（固有天賦の発動バフ）で扱う（ユーザー決定 (\d{4}-\d{2}-\d{2})）$/,
    m => { const s = subjectEn(m[1]); return s && `${s}: gcsim only reports the passive talent status (${m[2].replace(/・/g, ', ')}), not a Skill / Burst effect. Handled in 6-3c (passive talent buffs) (user decision ${m[3]})`; }],
  [/^(.+?): gcsim（(v[\d.]+)）にキャラ自体が未実装（マスターに gcsim のキーが無い）。gcsim が対応したら、マスターと対応表を再生成して扱いを決める（gcsim の更新待ち）$/,
    m => { const s = subjectEn(m[1]); return s && `${s}: the character itself is not implemented in gcsim (${m[2]}) (no gcsim key in the master). Once gcsim supports it, regenerate the master and the coverage table and decide how to handle it (waiting for a gcsim update)`; }],
  [/^(.+?): 回復のイベント（(.+?)）だけで、バーにする状態・設置物・シールド・継続ダメージが無い。複数回・組み合わせの実測（(\d{4}-\d{2}-\d{2})）でも同じ。ユーザー確認済み（回復は1回ごとの瞬間の出来事）$/,
    m => { const s = subjectEn(m[1]); return s && `${s}: only a heal event (${m[2]}); no status, construct, shield or damage over time for a bar. The same with multiple casts and combinations (${m[3]}). Confirmed by the user (each heal is an instant event)`; }],
  [/^内部の重複防止の間隔（([\d.]+) 秒）。ユーザーに見せる発動制限ではない$/,
    m => `Internal anti-duplication interval (${m[1]}s). Not a trigger limit shown to the user`],
  [/^効果の性質が「(.+?)」で、画面に出す価値が低い（(D\d+)）$/,
    m => NATURES[m[1]] && `The effect is of the "${NATURES[m[1]]}" kind and is not worth showing on screen (${m[2]})`],
];

const missing = new Set<string>();

/** 検証データの文の英語。日本語を含まなければそのまま。辞書に無ければ日本語のまま返し、一覧に記録する */
export function verificationEnglish(ja: string): string;
export function verificationEnglish(ja: string | undefined): string | undefined;
export function verificationEnglish(ja: string | undefined): string | undefined {
  if (!ja || !JAPANESE.test(ja)) return ja;
  const exact = VERIFICATION_TEXTS[ja] ?? handwrittenEnglish(ja);
  if (exact) return exact;
  for (const [re, f] of PATTERNS) {
    const m = re.exec(ja);
    const en = m && f(m);
    if (en) return en;
  }
  missing.add(ja);
  return ja;
}

/** 文書の言語で選ぶ（日本語の文書は ja、英語の文書は en） */
export const pick = (lang: DocLanguage, ja: string, en: string): string => (lang === 'en' ? en : ja);

/** 英語の名前（マスター・辞書の英語の欄。無ければ日本語の名前） */
export function nameEnOf(item: { name?: string; englishName?: string; nameEn?: string; en?: { name?: string } } | undefined | null): string | undefined {
  if (!item) return undefined;
  return item.en?.name || item.nameEn || item.englishName || item.name;
}

/** 英語の欄（JSON の行に足す `en`）。値が日本語と同じ・空のものは省く */
export function enFields<T extends Record<string, string | undefined>>(ja: Record<keyof T, string | undefined>, en: T): Partial<T> | undefined {
  const out: Partial<T> = {};
  for (const k of Object.keys(en) as (keyof T)[]) {
    const v = en[k];
    if (v && v !== ja[k]) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** 辞書に無かった文の一覧を出す（無ければ何も出さない） */
export function reportMissingEnglish(): void {
  if (missing.size === 0) return;
  console.log(`英語が無い文 ${missing.size} 件（src/masterdata/verificationEnglish.ts に足すと英語の文書が英語になる）:`);
  for (const s of [...missing].slice(0, 30)) console.log(`  - ${s}`);
  if (missing.size > 30) console.log(`  …ほか ${missing.size - 30} 件`);
  // 全件を見るとき: 環境変数 VERIFICATION_MISSING_OUT にファイル名を指定すると、1 行 1 文で追記する
  const out = process.env.VERIFICATION_MISSING_OUT;
  if (out) fs.appendFileSync(out, [...missing].map(s => s.replace(/\n/g, ' ') + '\n').join(''));
}

/** 辞書に無かった文（スクリプトの検査用） */
export const missingEnglish = (): string[] => [...missing];
