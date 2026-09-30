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
  'yae_oldest_totem_expiry': { reason: 'deferred', note: '八重神子: 最初に置いた殺生櫻の残り存在時間。ストックできるスキルの扱いを決めるまで保留' },
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
  "albedo-c2": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "amber-c6": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "ayato-c4": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "beidouc6": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "chongyun-c2": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "diluc-c6-dmg": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "diluc-c6-speed": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "eula-c1": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "ganyu-c6": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "klee-c6": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "kokomi-c4": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "layla-c4": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "lisa-c2": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "mona-c2-hexerei-post-burst-ca": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "thoma-c6": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "xingqiu-c2": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "yelan_c6": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "yelan-c4": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "yelanc4": { reason: "deferred", note: "命ノ星座の効果。命ノ星座の扱い（6-A2）で決める" },
  "collei-a1": { reason: "deferred", note: "固有天賦の効果。固有天賦の扱いで決める" },
  "shenhe-a1": { reason: "deferred", note: "固有天賦の効果。固有天賦の扱いで決める" },
  "thoma-a1": { reason: "deferred", note: "固有天賦の効果。固有天賦の扱いで決める" },
  "yaoyao-a4": { reason: "deferred", note: "固有天賦の効果。固有天賦の扱いで決める" },
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
  "center-of-attention": { reason: "deferred", note: "フリーナ: 命ノ星座6の効果（10秒）。命ノ星座の扱い（6-A2）で決める" },
  // 実測（2026-09-30）
  'nahida-q-within': { reason: 'hit-driven', note: 'ナヒーダの爆発の領域内: 0.5 秒ごとに更新され続ける。効果本体は nahida-q' },
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
  '10000058-electro_e': { reason: 'deferred', note: '八重神子のスキル: ストックできるスキルの扱いを決めるまで保留（継続ダメージの一致は取れている）' },
  // 反撃用の短いシールド（継続 1 秒未満）: バーにしない
  '10000024-electro_e': { reason: 'decided-not-linked', note: '北斗のスキル: 反撃用の短いシールド（0.38 秒）でバーにしない' },
  '10000064-geo_e': { reason: 'decided-not-linked', note: '雲菫のスキル: 反撃用の短いシールド（0.22 秒）でバーにしない' },
  '10000072-hydro_e': { reason: 'decided-not-linked', note: 'キャンディスのスキル: 短いシールド（0.27 秒）でバーにしない' },
  '10000072-hydro_e_hold': { reason: 'decided-not-linked', note: 'キャンディスの長押し: 短いシールド（1.5 秒）でバーにしない' },
};
