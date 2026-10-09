/**
 * 時間の無い効果（常時・条件つき・CT だけ）を、定義にして画面に出すかの判定（6-A2。D91。2026-10-09）。
 *
 * 画面に出す価値があるのは、ローテーションの組み立てに効くもの:
 *   - ステータス・ダメージの増減（攻撃力・会心・ダメージ+N% など）
 *   - CT の短縮・リセット
 * 出さない（理由つきで対象外にする）もの: エネルギー回復だけ・追加攻撃だけ・HP 回復だけの効果。
 * 説明文（genshin-db のゲーム内の説明）のキーワードから決める目安。決定済みの個別の例外は、下の表に書く。
 */

export type EffectNature = 'cooldown' | 'stat' | 'energy' | 'heal' | 'attack' | 'other';

const RE_COOLDOWN = /クールタイム[-−ー]|クールタイムをリセット|クールタイム.{0,6}(減少|短縮)/;
const RE_STAT = /(ダメージ|会心|攻撃力|防御力|元素熟知|元素チャージ|耐性|攻撃速度|与える|アップ|\+\s*\d|%)/;
const RE_ENERGY = /元素エネルギー[^。]{0,12}(回復|ポイント)|エネルギー.{0,4}回復/;
const RE_HEAL = /HP.{0,6}回復|回復量/;
const RE_ATTACK = /攻撃力\d+|ダメージを与え|ダメージ.{0,10}(放|追撃|発動)|元素ダメージ/;

/** 説明文から、効果の性質を決める（CT 短縮 > ステータス増減 > エネルギー > 回復 > 追加攻撃 の順） */
export function natureOfText(text: string): EffectNature {
  if (RE_COOLDOWN.test(text)) return 'cooldown';
  // 「ダメージ+N%」のような増減が、エネルギー回復・追加攻撃の文と一緒にあるときは、増減を優先する
  if (/(ダメージ|会心率|会心ダメージ|攻撃力|防御力|元素熟知|元素チャージ効率|耐性|攻撃速度)[^。]{0,16}[+＋-]\s*\d|\d+%[^。]{0,8}(アップ|増加|上昇)|アップする/.test(text)) return 'stat';
  if (RE_ENERGY.test(text)) return 'energy';
  if (RE_HEAL.test(text)) return 'heal';
  if (RE_ATTACK.test(text)) return 'attack';
  return RE_STAT.test(text) ? 'stat' : 'other';
}

/** 画面に出す価値があるか（ステータス・ダメージの増減、CT 短縮） */
export const isDisplayWorthyNature = (n: EffectNature): boolean => n === 'stat' || n === 'cooldown';

/** 性質の日本語名（理由の文言に使う） */
export const NATURE_LABEL: Record<EffectNature, string> = {
  cooldown: 'CT 短縮',
  stat: 'ステータス・ダメージの増減',
  energy: 'エネルギー回復',
  heal: 'HP 回復',
  attack: '追加攻撃',
  other: 'その他',
};

/**
 * 決定済みの個別の例外（キー → 出すか）。説明文の判定と違う扱いにしたいとき（ユーザー決定）
 *   - 香菱 6 凸・申鶴 2 凸・放浪者 2 凸・プルーネ 2 凸・クロリンデ 6 凸: 時間つきバフ・条件つきの強化として、出す（D90 の優先）
 *   - 九条裟羅 1 凸・アルレッキーノ 4 凸: CT 短縮として、出す（D90 の優先）
 */
export const NATURE_EXCEPTIONS: Record<string, boolean> = {
  'xiangling-c6': true,
  'xlc6': true,
  'shenhe-c2': true,
  'wanderer-c2-burstbonus': true,
  'prune-c2': true,
  'clorinde-c6-cr-bonus': true,
  'sara-c1-icd': true,
  'arlecchino-c4-icd': true,
};
