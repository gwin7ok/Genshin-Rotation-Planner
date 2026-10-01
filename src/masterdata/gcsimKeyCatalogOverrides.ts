/**
 * gcsim キーの辞書の「手で補う一覧」（フェーズ5 / 5-2b、D10）
 *
 * 自動生成（gcsimKeyCatalog.ts）で決まらないもの・誤るものを、ここで上書きする。
 *   - name: 日本語の表示名（必須）
 *   - kind: 種類の確定（effect = 効果 / cooldown = ユーザーに見せる発動制限 / internal = 内部。名前からの候補を変えるときだけ）
 *   - category: 分類の確定（複数の定義場所にまたがるキーなど。変えるときだけ）
 *   - cooldownOf: CT のとき、どの効果（キー）の CT か
 * キーは gcsim のログに出る名前そのまま（パターンは辞書の表記。例: `a-thousand-floating-dreams-party-*`）。
 * gcsim の更新でキーが無くなったら、`npm run build:catalog` のレポートに出る。
 *
 * 現在の対象: ナヒーダ・ニィロウ・コロンビーナ・ラウマと、その編成の武器・聖遺物・元素共鳴など（5-2b の最初の対象。順次広げる）。
 * 名前は、マスターデータのアクション名・固有天賦名・命ノ星座名・武器名・聖遺物名に合わせた。
 */
import type { KeyOverride } from './gcsimKeyCatalog.ts';

const o = (name: string, extra: Partial<Omit<KeyOverride, 'name'>> = {}): KeyOverride => ({ name, ...extra });

export const KEY_OVERRIDES: Record<string, KeyOverride> = {
  // --- ナヒーダ ---------------------------------------------------------------
  'nahida-e': o('ナヒーダ 元素スキル「所聞遍計」: 蘊種印'),
  'nahida-e-icd': o('ナヒーダ 元素スキル: 三業の因の発動間隔', { kind: 'internal', note: 'skill.go: triKarmaInterval（ダメージの間隔）' }),
  'nahida-e-particle-icd': o('ナヒーダ 元素スキル: 元素粒子の発生間隔'),
  'nahida-q': o('ナヒーダ 元素爆発「心景幻成」'),
  'nahida-q-within': o('ナヒーダ 元素爆発「心景幻成」: 領域内'),
  'nahida-a1': o('ナヒーダ 固有天賦1「浄善摂受明論」'),
  'nahida-a4': o('ナヒーダ 固有天賦2「慧明縁覚智論」'),
  'nahida-c2': o('ナヒーダ 命ノ星座2「正覚善見の根」'),
  'nahida-c2-lunarbloom': o('ナヒーダ 命ノ星座2「正覚善見の根」: 月開花'),
  'nahida-c4': o('ナヒーダ 命ノ星座4「比量現行の茎」'),
  'nahida-c6': o('ナヒーダ 命ノ星座6「大辯円成の実」', { category: 'constellation', note: 'burst.go で登録（元素爆発に付随する効果）' }),
  'nahida-c6-icd': o('ナヒーダ 命ノ星座6「大辯円成の実」: 発動間隔', { kind: 'internal', cooldownOf: 'nahida-c6' }),

  // --- ニィロウ ---------------------------------------------------------------
  'pirouette': o('ニィロウ 元素スキル「七域のダンス」: 旋舞（剣舞・ステップ）状態'),
  'lunarprayer': o('ニィロウ 元素スキル: 月の祈り'),
  'tranquilityaura': o('ニィロウ 元素爆発「浮蓮のダンス・遠夢聆泉」: 静謐の光環'),
  'lingeringaeon': o('ニィロウ 元素爆発「浮蓮のダンス・遠夢聆泉」: 遠夢'),
  'nilou-initial-particle-icd': o('ニィロウ 元素スキル: 元素粒子の発生間隔（初撃）'),
  'nilou-pirouette-particle-icd': o('ニィロウ 元素スキル: 元素粒子の発生間隔（旋舞）'),
  'nilou-a1': o('ニィロウ 固有天賦1「落花廻旋の庭」(30秒)'),
  'nilou-a1-em': o('ニィロウ 固有天賦1「落花廻旋の庭」(10秒): 元素熟知'),
  'nilou-a4': o('ニィロウ 固有天賦2「軽やかに舞う永世の夢」'),
  'nilou-c1': o('ニィロウ 命ノ星座1「却月の舞踊」'),
  'nilou-c2-dendro': o('ニィロウ 命ノ星座2「星天の花雨」: 草元素耐性ダウン'),
  'nilou-c2-hydro': o('ニィロウ 命ノ星座2「星天の花雨」: 水元素耐性ダウン'),
  'nilou-c4': o('ニィロウ 命ノ星座4「清漣の音節」'),
  'nilou-c6-cd': o('ニィロウ 命ノ星座6「霜絶の弦歌」: 会心ダメージ', { kind: 'effect', note: 'cd = crit dmg（クールダウンではない）' }),
  'nilou-c6-cr': o('ニィロウ 命ノ星座6「霜絶の弦歌」: 会心率'),

  // --- コロンビーナ -----------------------------------------------------------
  'columbina-skill': o('コロンビーナ 元素スキル「万古の潮汐」'),
  'columbina-gravity': o('コロンビーナ 元素スキル「万古の潮汐」: 重力'),
  'columbina-particle-icd': o('コロンビーナ 元素スキル: 元素粒子の発生間隔'),
  'columbina-q': o('コロンビーナ 元素爆発「月明かりの郷愁」'),
  'columbina-q-buff': o('コロンビーナ 元素爆発「月明かりの郷愁」: 強化'),
  'columbina-a1': o('コロンビーナ 固有天賦1「月が呼んだ狂気」'),
  'moonridge-dew-icd': o('コロンビーナ 固有天賦: 月露の蓄積の間隔', { kind: 'internal', cooldownOf: 'moonridge-dew-timer' }),
  'moonridge-dew-timer': o('コロンビーナ 固有天賦: 月露'),
  'columbina-c1-icd': o('コロンビーナ 命ノ星座1「花照らし峰に隠れ入る光」: 発動間隔', { cooldownOf: 'columbina-c1' }),
  'columbina-c2': o('コロンビーナ 命ノ星座2「夜輝かす君と共に在る光」'),
  'columbina-c2-lb': o('コロンビーナ 命ノ星座2: 月開花'),
  'columbina-c2-lc': o('コロンビーナ 命ノ星座2: 月感電'),
  'columbina-c2-lcr': o('コロンビーナ 命ノ星座2: 月結晶'),
  'columbina-c4-icd': o('コロンビーナ 命ノ星座4「花の嵐や雲と木と岩の陰」: 発動間隔', { cooldownOf: 'columbina-c4' }),
  'columbina-c6-lb': o('コロンビーナ 命ノ星座6「暗き夜の月と共に往く道」: 月開花'),
  'columbina-c6-lc': o('コロンビーナ 命ノ星座6「暗き夜の月と共に往く道」: 月感電'),
  'columbina-c6-lcr': o('コロンビーナ 命ノ星座6「暗き夜の月と共に往く道」: 月結晶'),

  // --- ラウマ -----------------------------------------------------------------
  'lauma-a1-ascendant': o('ラウマ 固有天賦1「霜夜に捧ぐ光」: 月兆'),
  'light-for-the-frosty-night': o('ラウマ 固有天賦1「霜夜に捧ぐ光」', { category: 'talent', note: 'skill.go で登録' }),
  'lauma-a4': o('ラウマ 固有天賦2「甘泉に捧ぐ禊」'),
  'lauma-frostgrove-sanctuary': o('ラウマ 元素スキル「聖言のルノ・永夜の眠り」: 霜林の聖域'),
  'lauma-frostgrove-sanctuary-particle-icd': o('ラウマ 元素スキル: 元素粒子の発生間隔'),
  'lauma-skill-shred-dendro': o('ラウマ 元素スキル: 草元素耐性ダウン'),
  'lauma-skill-shred-hydro': o('ラウマ 元素スキル: 水元素耐性ダウン'),
  'moonsong-icd': o('ラウマ 元素スキル: 月の歌の発動間隔', { kind: 'internal' }),
  'lauma-spirit-envoy': o('ラウマ 通常攻撃: 精霊の使者'),
  'lauma-burst': o('ラウマ 元素爆発「聖言のルノ・月の心」'),
  'lauma-pale-hymn-burst': o('ラウマ 元素爆発「聖言のルノ・月の心」: 蒼白の賛歌'),
  'lauma-pale-hymn-moonsong': o('ラウマ 元素爆発「聖言のルノ・月の心」: 蒼白の賛歌・月の歌'),
  'lauma-pale-hymn-c6': o('ラウマ 命ノ星座6「我が血と涙を 月に捧げ奉らん」: 蒼白の賛歌', { category: 'constellation', note: 'burst.go で登録' }),
  'lauma-c1': o('ラウマ 命ノ星座1「唇よ歌を紡ぎて 詩を織りなせ」', { category: 'constellation', note: 'cons.go と skill.go の両方で登録' }),
  'lauma-c1-icd': o('ラウマ 命ノ星座1: 発動間隔', { cooldownOf: 'lauma-c1' }),
  'lauma-c2-lunarbloom-buff': o('ラウマ 命ノ星座2「北の戒めを綴りて 伝承を語れ」: 月開花'),
  'lauma-c4-icd': o('ラウマ 命ノ星座4「巨熊の力を 恋い慕うこと勿れ」: 発動間隔', { cooldownOf: 'lauma-c4' }),

  // --- 武器 -------------------------------------------------------------------
  'a-thousand-floating-dreams': o('千夜に浮かぶ夢: 元素熟知（自身）'),
  'a-thousand-floating-dreams-party-*': o('千夜に浮かぶ夢: パーティの元素バフ'),
  'khaj-nisut': o('聖顕の鍵: HP'),
  'khaj-nisut-buff': o('聖顕の鍵: 元素熟知（自身）'),
  'khaj-nisut-team-buff': o('聖顕の鍵: 元素熟知（チーム）'),
  'khaj-nisut-icd': o('聖顕の鍵: 発動間隔', { kind: 'internal', cooldownOf: 'khaj-nisut-buff', note: '0.3 秒（効果を重ねる間隔）' }),
  'nocturnes-curtain-call-hp': o('帳の夜曲: HP'),
  'nocturnes-curtain-call-icd': o('帳の夜曲: 発動間隔（18秒）', { cooldownOf: 'nocturnes-curtain-call-buff-hp' }),
  'nocturnes-curtain-call-buff-hp': o('帳の夜曲: HP（12秒）'),
  'nocturnes-curtain-call-buff-cd': o('帳の夜曲: 会心ダメージ（12秒）', { kind: 'effect', note: 'cd = crit dmg（クールダウンではない）' }),
  'skyward-atlas': o('天空の巻: 元素ダメージ'),
  'skyward-atlas-icd': o('天空の巻: 発動間隔（30秒）'),

  // --- 聖遺物 -----------------------------------------------------------------
  'dm-2pc': o('深林の記憶 2セット'),
  'dm-4pc': o('深林の記憶 4セット: 草元素耐性ダウン'),
  'tom-2pc': o('千岩牢固 2セット'),
  'tom-4pc': o('千岩牢固 4セット'),
  'tom-4pc-icd': o('千岩牢固 4セット: 発動間隔', { kind: 'internal', cooldownOf: 'tom-4pc', note: '0.5 秒' }),
  'silken-moon-2pc': o('月を紡ぐ夜の歌 2セット'),
  'gleaming-moon-devotion-em': o('月を紡ぐ夜の歌 4セット: 元素熟知'),
  'gleaming-moon-devotion-reaction': o('月を紡ぐ夜の歌 4セット: 月兆反応ボーナス'),
  'gd-2pc': o('金メッキの夢 2セット'),
  'gd-4pc': o('金メッキの夢 4セット'),
  'gd-4pc-icd': o('金メッキの夢 4セット: 発動間隔（8秒）', { cooldownOf: 'gd-4pc' }),

  // --- 元素共鳴・システム -----------------------------------------------------
  'hydro-res-hpp': o('元素共鳴（水）: HP'),
  'dendro-res-50': o('元素共鳴（草）: 元素熟知（常時）'),
  'dendro-res-30': o('元素共鳴（草）: 元素熟知（反応時）'),
  'ascendant-gleam': o('月兆: 反応ボーナス（月兆・満輝）'),
};

/**
 * 手で補うパターンのキー（gcsim のソースから自動で読めないもの）。自動抽出で同じキーが見つかれば無視する。
 * 翠緑の影4セットの拡散耐性ダウン: `viridescent.go` が `key := "vv" + ele.String()` で組み立て、変数 `key` 経由で登録するため、自動では読めない
 * （接頭辞 `vv` は 2 文字で、パターンの 3 文字以上の条件にも満たない）。
 */
export interface ManualPatternKey {
  key: string;
  elements: string[];
  /** 定義場所のファイル（分類・持ち主を決める） */
  file: string;
  name: string;
  durationFrames?: number;
  note?: string;
}

export const MANUAL_PATTERN_KEYS: ManualPatternKey[] = [
  {
    key: 'vv{element}',
    elements: ['cryo', 'electro', 'hydro', 'pyro'],
    file: 'internal/artifacts/viridescent/viridescent.go',
    name: '翠緑の影 4セット: 拡散した元素の耐性ダウン',
    durationFrames: 600,
    note: 'viridescent.go: key := "vv" + ele.String()。拡散した元素（氷・雷・水・炎）の耐性を 40% 下げる（10 秒）',
  },
];

MANUAL_PATTERN_KEYS.push({
  key: 'kazuha-a4-{element}',
  elements: ['cryo', 'electro', 'hydro', 'pyro'],
  file: 'internal/characters/kazuha/asc.go',
  name: '楓原万葉 固有天賦2「風物の詩吟」: 拡散した元素の元素ダメージ+',
  durationFrames: 480,
  note: 'asc.go: swirlfunc が "kazuha-a4-"+key（元素名。変数経由）で登録する。拡散した元素（氷・雷・水・炎）の元素ダメージ+（8 秒）',
});
