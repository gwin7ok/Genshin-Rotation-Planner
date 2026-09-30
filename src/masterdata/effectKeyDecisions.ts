/**
 * スキル・爆発の効果を「紐づけない」と決めたものと、その理由（手で決める一覧）
 *
 * 対応表（src/data/effect_key_coverage.json）で、紐づけの無いキー・アクション定義のうち、ここに載っているものは
 * 理由つきの「決定済み」として扱う。載っていないもの（かつ自動で理由が付かないもの）は「未検討」になる。
 * 決めた日と決めた人（ユーザー / 実測）をメモに残す。
 */
import type { UnlinkedReason } from './effectKeyCoverage.ts';

export interface Decision {
  reason: UnlinkedReason;
  note: string;
}

/** gcsim のキー → 理由 */
export const KEY_DECISIONS: Record<string, Decision> = {
  // ユーザー決定（2026-09-30）
  'lyney-q-mark': { reason: 'covered-by-main', note: 'リネの爆発: ファニーハット・キャット変身 3 秒は本体（lyney-q）のバーで表示' },
  'itto-q-atkspd': { reason: 'covered-by-main', note: '荒瀧一斗の爆発: 爆発モードの持続は本体（itto-q）のバーで表示' },
  'ayato-burst-mark': { reason: 'covered-by-main', note: '神里綾人の爆発: 18 秒の持続は本体（ayato-burst）のバーで表示' },
  'lumidouce-scent-reset': { reason: 'grace-window', note: 'エミリエ: 芳香を集められない状態が 8 秒続くとランク 1 に戻る猶予時間。効果本体は lumidouce-case' },
  'odette-skill-recast': { reason: 'grace-window', note: 'オデット: スキルを再発動できる猶予時間（約 6 秒）。効果本体は odette-dance-double' },
  'yae_oldest_totem_expiry': { reason: 'deferred', note: "八重神子: 最初に置いた殺生櫻の残り存在時間。6-6「ストックできるスキルへの対応」で扱う（ユーザー決定 2026-09-30）" },
  'ifa-plunge-available': { reason: 'grace-window', note: 'イファ: 落下攻撃ができる短い窓（約 0.4 秒）。夜魂の状態（nightsoul-blessing）を効果時間にしている' },
  'chasca-plunge-available': { reason: 'grace-window', note: 'チャスカ: 同上' },
  'wanderer-plunge-available': { reason: 'grace-window', note: '放浪者: 落下攻撃ができる短い窓（約 0.4 秒）。効果本体は windfavored-state' },
  // ユーザー決定（2026-09-30）: 常時で登録された内部の蓄積・数え。ゲーム画面の効果ではなく、判断に使う情報ではない
  'aloy-coil-stacks': { reason: 'decided-not-linked', note: 'アーロイ: コイルの蓄積数（内部の数え）' },
  'qiqi-revelation-ssc': { reason: 'decided-not-linked', note: '七七: 啓示（内部の状態）' },
  'qiqi-revelation-ssw': { reason: 'decided-not-linked', note: '七七: 啓示（内部の状態）' },
  'sigewinne-bubble-tier': { reason: 'decided-not-linked', note: 'シグウィン: 泡の段階（蓄積状態）' },
  'traveler-story-quest-buffs': { reason: 'decided-not-linked', note: '旅人: ストーリークエスト報酬の基礎ステータス' },
  // ---- 未検討 118 件の整理（2026-09-30 ユーザー決定: D・G・H・J 以外は推奨の扱い）----
  "albedo-c2": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "amber-c6": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "ayato-c4": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "beidouc6": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "chongyun-c2": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "diluc-c6-dmg": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "diluc-c6-speed": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "eula-c1": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "ganyu-c6": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "klee-c6": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "kokomi-c4": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "layla-c4": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "lisa-c2": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "mona-c2-hexerei-post-burst-ca": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "thoma-c6": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "xingqiu-c2": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "yelan_c6": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "yelan-c4": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "yelanc4": { reason: "deferred", note: "命ノ星座の効果。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  "collei-a1": { reason: "deferred", note: "固有天賦の効果。6-3c の発動バフの配置に含める（ユーザー決定 2026-09-30）" },
  "shenhe-a1": { reason: "deferred", note: "固有天賦の効果。6-3c の発動バフの配置に含める（ユーザー決定 2026-09-30）" },
  "thoma-a1": { reason: "deferred", note: "固有天賦の効果。6-3c の発動バフの配置に含める（ユーザー決定 2026-09-30）" },
  "yaoyao-a4": { reason: "deferred", note: "固有天賦の効果。6-3c の発動バフの配置に含める（ユーザー決定 2026-09-30）" },
  "dehya-jump-kick-window": { reason: "grace-window", note: "再発動・発動条件の猶予の短い窓（効果ではない）" },
  "prune-skill-recast-window": { reason: "grace-window", note: "再発動・発動条件の猶予の短い窓（効果ではない）" },
  "xianyun-a4-window": { reason: "grace-window", note: "再発動・発動条件の猶予の短い窓（効果ではない）" },
  "furina-fanfare-debounce": { reason: "decided-not-linked", note: "内部（デバウンス・ロックアウト・アニメーション・確認用・短い状態）で、効果のバーにしない" },
  "leap-back": { reason: "decided-not-linked", note: "内部（デバウンス・ロックアウト・アニメーション・確認用・短い状態）で、効果のバーにしない" },
  "mavuika-cdc-lockout": { reason: "decided-not-linked", note: "内部（デバウンス・ロックアウト・アニメーション・確認用・短い状態）で、効果のバーにしない" },
  "skirk-burst-extinction": { reason: "decided-not-linked", note: "内部（デバウンス・ロックアウト・アニメーション・確認用・短い状態）で、効果のバーにしない" },
  "skirk-burst-extinction-anim": { reason: "decided-not-linked", note: "内部（デバウンス・ロックアウト・アニメーション・確認用・短い状態）で、効果のバーにしない" },
  "skirk-hold-e-anim": { reason: "decided-not-linked", note: "内部（デバウンス・ロックアウト・アニメーション・確認用・短い状態）で、効果のバーにしない" },
  "collei-a4-modcheck": { reason: "decided-not-linked", note: "内部（デバウンス・ロックアウト・アニメーション・確認用・短い状態）で、効果のバーにしない" },
  "shield:Tidecaller (Shield)": { reason: "decided-not-linked", note: "反撃用の短いシールドでバーにしない（対象側の決定に合わせる）" },
  "shield:Opening Flourish (Shield)": { reason: "decided-not-linked", note: "反撃用の短いシールドでバーにしない（対象側の決定に合わせる）" },
  "shield:Sacred Rite: Heron's Sanctum (Shield)": { reason: "decided-not-linked", note: "反撃用の短いシールドでバーにしない（対象側の決定に合わせる）" },
  "construct:LunarCrystallize": { reason: "decided-not-linked", note: "反応で生じる設置物で、アクションの効果ではない" },
  "zhongli-anemo": { reason: "decided-not-linked", note: "鍾離のシールドに付随する元素別の内部状態（各1秒）でバーにしない" },
  "zhongli-cryo": { reason: "decided-not-linked", note: "鍾離のシールドに付随する元素別の内部状態（各1秒）でバーにしない" },
  "zhongli-dendro": { reason: "decided-not-linked", note: "鍾離のシールドに付随する元素別の内部状態（各1秒）でバーにしない" },
  "zhongli-electro": { reason: "decided-not-linked", note: "鍾離のシールドに付随する元素別の内部状態（各1秒）でバーにしない" },
  "zhongli-geo": { reason: "decided-not-linked", note: "鍾離のシールドに付随する元素別の内部状態（各1秒）でバーにしない" },
  "zhongli-hydro": { reason: "decided-not-linked", note: "鍾離のシールドに付随する元素別の内部状態（各1秒）でバーにしない" },
  "zhongli-physical": { reason: "decided-not-linked", note: "鍾離のシールドに付随する元素別の内部状態（各1秒）でバーにしない" },
  "zhongli-pyro": { reason: "decided-not-linked", note: "鍾離のシールドに付随する元素別の内部状態（各1秒）でバーにしない" },
  // ---- 同じ効果・同じ持続期間のものが別で紐づけ済み（2026-09-30 ユーザー決定）----
  "bennett-field": { reason: "covered-by-main", note: "同じ効果・同じ持続期間のものが、本体のバー（別のキー）で紐づけ済み" },
  "chongyun-field": { reason: "covered-by-main", note: "同じ効果・同じ持続期間のものが、本体のバー（別のキー）で紐づけ済み" },
  "ganyu-field": { reason: "covered-by-main", note: "同じ効果・同じ持続期間のものが、本体のバー（別のキー）で紐づけ済み" },
  "lauma-burst": { reason: "covered-by-main", note: "同じ効果・同じ持続期間のものが、本体のバー（別のキー）で紐づけ済み" },
  "damage:Xingqiu Orbital": { reason: "covered-by-main", note: "同じ効果・同じ持続期間のものが、本体のバー（別のキー）で紐づけ済み" },
  "damage:Lea Lotus Lamp": { reason: "covered-by-main", note: "同じ効果・同じ持続期間のものが、本体のバー（別のキー）で紐づけ済み" },
  "damage:Bake-Kurage": { reason: "covered-by-main", note: "同じ効果・同じ持続期間のものが、本体のバー（別のキー）で紐づけ済み" },
  "damage:Kamisato Art: Suiyuu": { reason: "covered-by-main", note: "同じ効果・同じ持続期間のものが、本体のバー（別のキー）で紐づけ済み" },
  "damage:Bogglecat Box": { reason: "covered-by-main", note: "同じ効果・同じ持続期間のものが、本体のバー（別のキー）で紐づけ済み" },
  "damage:Stone Stele (Tick)": { reason: "covered-by-main", note: "同じ効果・同じ持続期間のものが、本体のバー（別のキー）で紐づけ済み" },
  // フリーナ: ソース（furina/cons.go）で命ノ星座6の効果（c6Key）と確認。スキル本体の効果ではない（ユーザー決定: 命ノ星座のグループ）
  "center-of-attention": { reason: "deferred", note: "フリーナ: 命ノ星座6の効果（10秒）。6-A2（命ノ星座の扱い）の実装時に扱いを決める（ユーザー決定 2026-09-30）" },
  // ---- G（耐性ダウン・被ダメ増）は推奨どおりに決定、J・D は一旦保留（2026-09-30 ユーザー決定）----
  "omen-debuff": { reason: "covered-by-main", note: "モナの爆発: 星命定軌は mona-omen（含まれる）と mona-bubble（本体）で紐づけ済み" },
  "damage:Sesshou Sakura Tick": { reason: "deferred", note: "八重神子のスキルの継続ダメージ。6-6「ストックできるスキルへの対応」で扱う（ユーザー決定 2026-09-30）" },
  // ---- H（印）は「命中で更新される内部状態」に決定（2026-09-30 ユーザー決定）----
  // ---- J の個別確認（2026-09-30 ユーザー決定: 反応・命中・被ダメージ由来と、別のキーで表示済みのものは紐づけない）----
  "radiance-stellar-swirl": { reason: "deferred", note: "オデット: 星拡散反応が起きたときの 8 秒の状態（反応由来）。「キャラクターに紐づく効果」の分類を 6-3c で実装するときに登録する（保留）" },
  "yae-revelation": { reason: "deferred", note: "八重神子: 超電導・星電導反応が起きたときの 8 秒の状態（反応由来）。「キャラクターに紐づく効果」の分類を 6-3c で実装するときに登録する（保留）" },
  "apex-drive": { reason: "decided-not-linked", note: "ヴァレサ: 落下攻撃のあとに付く 2.3 秒の状態（攻撃の分類。スキル・爆発の効果ではない）" },
  "lauma-spirit-envoy": { reason: "decided-not-linked", note: "ラウマ: 重撃（長押し）で入る鹿の状態（攻撃の分類）" },
  "gorou-e-defbuff": { reason: "covered-by-main", note: "ゴロー: スキルの旗の領域内で更新される防御バフ。本体 gorou-e-warbanner で表示済み" },
  "aloy-rushing-ice": { reason: "covered-by-main", note: "アーロイ: 本体 rushingice と同じ関数で登録する、同じ 10 秒の攻撃付与" },
  "dehya-burst-kick": { reason: "grace-window", note: "ディシア: 爆発中のキックまでの 0.77 秒の窓" },
  "gaming-man-chai": { reason: "grace-window", note: "嘉明: 爆発中の万歳の獅子が歩いて戻る間の内部状態（1.7 秒）" },
  "directive-limit": { reason: "decided-not-linked", note: "アルレッキーノ: 血の債務の上限を決める 35 秒の内部の窓。効果本体は directive（30 秒）" },
  "haunted-night-oriole-song": { reason: "decided-not-linked", note: "イルーガ: 登録しないと決定済み（イルーガは gcsim が認識しない）" },
  // ---- E（継続ダメージ）の整理（2026-09-30 ユーザー決定）----
  "damage:Palm Vortex Max Cutting (Hold)": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Frostbound Javelin": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Wake of Earth": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Starshatter": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Spirit Blade: Cloud-Parting Star": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Icy Paw": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Starward Sword (Consecutive Slash)": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Tanglevine Shaft": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Secondary Tanglevine Shaft": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Kyougen: Five Ceremonial Plays": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Particular Field: Fetters of Phenomena": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Darkgold Wolfbite": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Secondary Explosive Shell": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Last Lightfall": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Lustrous Moonrise": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Havoc: Ruin (DoT)": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Shooting Star": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Universal Diagnosis": { reason: "decided-not-linked", note: "継続ダメージが短い単発（0.08〜2.4 秒）で、攻撃の動作時間の内側。バーにしない（ユーザー決定 2026-09-30）" },
  "damage:Rings of Searing Radiance": { reason: "covered-by-main", note: "マーヴィカのスキル: 夜魂の状態（nightsoul-blessing）で登録済み" },
  "damage:Spiritvein Damage": { reason: "covered-by-main", note: "白朮の爆発: シールド（Baizhu Seamless shield）で登録済み" },
  "damage:Blazing Threshold DMG": { reason: "covered-by-main", note: "空・蛍(炎)のスキル: ソース（traveler/common/pyro/skill.go）で、夜魂の状態が続く間 1.1 秒ごとに出る炎門のダメージと確認。夜魂の状態（nightsoul-blessing）で登録済み" },
  "damage:Dewdrop (Hold)": { reason: "decided-not-linked", note: "空・蛍(水)の長押し: ソース（traveler/common/hydro/skill.go）で、長押しの動作で放つ露雫の弾（弾道の到達まで）と確認。効果ではなくアクション自身の動作なのでバーにしない" },
  // 実測（2026-09-30）
};

/** アクション定義 ID → 理由 */
export const DEF_DECISIONS: Record<string, Decision> = {
  // ユーザー決定（2026-09-30）
  '10000112-cryo_e_hold': { reason: 'decided-not-linked', note: 'エスコフィエの長押し: 料理を作る動作で戦闘に使わない（gcsim も長押しの指定を拒否）' },
  '10000114-cryo_e_hold': { reason: 'decided-not-linked', note: 'スカークの長押し: 登録しない' },
  '10000127-geo_e': { reason: 'decided-not-linked', note: 'イルーガ: この gcsim が認識しない（キーが illuga で一致しない）。登録しない' },
  '10000127-geo_e_hold': { reason: 'decided-not-linked', note: 'イルーガ: 同上' },
  '10000127-geo_q': { reason: 'decided-not-linked', note: 'イルーガ: 同上' },
  '10000104-anemo_q': { reason: 'no-event', note: 'チャスカの爆発: 継続する効果のイベントが無い（自動収集の chasca-plunge-available は 0.43 秒の落下攻撃の窓で誤り）' },
  '10000106-pyro_e_recastframestobike': { reason: 'no-event', note: 'マーヴィカの再発動: gcsim に新しい継続時間のイベントが出ない。バーを表示できないため登録しない' },
  '10000106-pyro_e_recastframestoring': { reason: 'no-event', note: 'マーヴィカの再発動: 同上' },
  '10000058-electro_e': { reason: 'deferred', note: "八重神子のスキル: 6-6「ストックできるスキルへの対応」で扱う（継続ダメージの一致は取れている）" },
  // 反撃用の短いシールド（継続 1 秒未満）: バーにしない
  '10000024-electro_e': { reason: 'decided-not-linked', note: '北斗のスキル: 反撃用の短いシールド（0.38 秒）でバーにしない' },
  '10000064-geo_e': { reason: 'decided-not-linked', note: '雲菫のスキル: 反撃用の短いシールド（0.22 秒）でバーにしない' },
  '10000072-hydro_e': { reason: 'decided-not-linked', note: 'キャンディスのスキル: 短いシールド（0.27 秒）でバーにしない' },
  '10000072-hydro_e_hold': { reason: 'decided-not-linked', note: 'キャンディスの長押し: 短いシールド（1.5 秒）でバーにしない' },
};
