/**
 * 武器・聖遺物発動バフの確認・補正辞書
 *
 * 自動抽出のみでは長くなりすぎる名称や、複雑なスタック条件・発動効果を持つ装備について、
 * ユーザーがガントチャートやアクション構築で一目で理解できる簡潔な表示名、要約、カラーを定義します。
 */

export interface EquipmentBuffOverride {
  /** ガントチャート・パレット表示名 (例: "蒼古: 抗争の歌") */
  name: string;
  /** 効果継続時間 (秒)。未指定ならテキストから自動抽出された値を使用 */
  duration?: number;
  /** クールタイム (秒)。未指定ならテキストから自動抽出された値を使用 */
  cooldown?: number;
  /** ツールチップやサマリー用の効果要約 */
  statEffectSummary: string;
  /** ガントチャート描画カラー (Tailwind HEX) */
  color: string;
}

/**
 * 武器の補正辞書
 * キー: 武器の公式ID（DB の id）
 */
export const WEAPON_BUFF_OVERRIDES: Record<string, EquipmentBuffOverride> = {
  // 蒼古なる自由への誓い
  '11503': {
    name: '蒼古: 抗争の歌',
    duration: 12,
    cooldown: 20,
    statEffectSummary: '全員攻撃+20% / 通常・重撃・落下ダメ+16%',
    color: '#38bdf8',
  },
  // 終焉を嘆く詩
  '15503': {
    name: '終焉: 別れの歌',
    duration: 12,
    cooldown: 20,
    statEffectSummary: '全員元素熟知+100 / 攻撃力+20%',
    color: '#34d399',
  },
  // 聖顕の鍵
  '11511': {
    name: '聖顕の鍵: 全員熟知バフ',
    duration: 20,
    statEffectSummary: 'HP上限に応じてチーム全員の元素熟知加算',
    color: '#fbbf24',
  },
  // 原木刀
  '11417': {
    name: '原木刀: 唯空の葉',
    duration: 12,
    cooldown: 20,
    statEffectSummary: '拾ったキャラの元素熟知+60〜120',
    color: '#10b981',
  },
  // 龍殺しの英傑譚
  '14302': {
    name: '龍殺し: 交代先攻撃力UP',
    duration: 10,
    cooldown: 20,
    statEffectSummary: '次に出場するキャラの攻撃力+48%',
    color: '#f87171',
  },
  // サーンドルの渡し守
  '11426': {
    name: 'サーンドル: スキル後チャージUP',
    duration: 5,
    statEffectSummary: '元素スキル発動後、元素チャージ効率+32%',
    color: '#c084fc',
  },
  // 西風剣
  '11401': {
    name: '西風剣: 無色粒子生成',
    duration: 0.1,
    cooldown: 6,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  // 西風長槍
  '13407': {
    name: '西風長槍: 無色粒子生成',
    duration: 0.1,
    cooldown: 6,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  // 西風大剣
  '12401': {
    name: '西風大剣: 無色粒子生成',
    duration: 0.1,
    cooldown: 6,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  // 西風猟弓
  '15401': {
    name: '西風猟弓: 無色粒子生成',
    duration: 0.1,
    cooldown: 6,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  // 西風秘典
  '14401': {
    name: '西風秘典: 無色粒子生成',
    duration: 0.1,
    cooldown: 6,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  // 祭礼の剣
  '11403': {
    name: '祭礼の剣: スキルCTリセット',
    duration: 0.1,
    cooldown: 16,
    statEffectSummary: 'スキル命中で80%の確率でスキルCTリセット(CT16s)',
    color: '#60a5fa',
  },
  // 祭礼の大剣
  '12403': {
    name: '祭礼の大剣: スキルCTリセット',
    duration: 0.1,
    cooldown: 16,
    statEffectSummary: 'スキル命中で80%の確率でスキルCTリセット(CT16s)',
    color: '#60a5fa',
  },
  // 祭礼の断片
  '14403': {
    name: '祭礼の断片: スキルCTリセット',
    duration: 0.1,
    cooldown: 16,
    statEffectSummary: 'スキル命中で80%の確率でスキルCTリセット(CT16s)',
    color: '#60a5fa',
  },
  // 祭礼の弓
  '15403': {
    name: '祭礼の弓: スキルCTリセット',
    duration: 0.1,
    cooldown: 16,
    statEffectSummary: 'スキル命中で80%の確率でスキルCTリセット(CT16s)',
    color: '#60a5fa',
  },
  // 狼の末路
  '12502': {
    name: '狼の末路: 全員攻撃力+40%',
    duration: 12,
    cooldown: 30,
    statEffectSummary: 'HP30%以下の敵に命中でチーム全員攻撃力+40%',
    color: '#f87171',
  },
  // 流浪楽章
  '14402': {
    name: '流浪楽章: 主題曲バフ',
    duration: 10,
    cooldown: 30,
    statEffectSummary: '登場時ランダムバフ (攻撃+120% / 全ダメ+96% / 熟知+480)',
    color: '#ec4899',
  },
  // 白辰の輪
  '14414': {
    name: '白辰: 元素ダメ+10〜20%',
    duration: 6,
    statEffectSummary: '雷関連反応後、反応元素ダメ+10〜20%',
    color: '#c084fc',
  },
  // 金珀·試作
  '14406': {
    name: '金珀: 回復&エネルギー再生',
    duration: 6,
    statEffectSummary: '爆発発動後6秒間、全員HP回復&エネルギー回復',
    color: '#34d399',
  },
};

/**
 * 聖遺物セットの補正辞書
 * キー: 聖遺物セットの公式ID（DB の id）
 */
export const ARTIFACT_BUFF_OVERRIDES: Record<string, EquipmentBuffOverride> = {
  // 旧貴族のしつけ
  '15007': {
    name: '旧貴族4: 全員攻撃力+20%',
    duration: 12,
    statEffectSummary: '元素爆発発動後、チーム全員の攻撃力+20%',
    color: '#f87171',
  },
  // 翠緑の影
  '15002': {
    name: '翠緑4: 拡散耐性-40%',
    duration: 10,
    statEffectSummary: '拡散された元素の敵耐性-40%',
    color: '#34d399',
  },
  // 深林の記憶
  '15025': {
    name: '深林4: 草元素耐性-30%',
    duration: 8,
    statEffectSummary: 'スキルまたは爆発命中で敵の草元素耐性-30%',
    color: '#10b981',
  },
  // 千岩牢固
  '15017': {
    name: '千岩4: 全員攻撃力+20%',
    duration: 3,
    statEffectSummary: 'スキル命中でチーム全員攻撃力+20% / シールド強化+30%',
    color: '#f59e0b',
  },
  // 灰燼の都に立つ英雄の絵巻
  '15037': {
    name: '絵巻4: 該当元素ダメバフ+40%',
    duration: 15,
    statEffectSummary: '夜魂性質反応後、関連元素ダメバフ+12%〜40%',
    color: '#fbbf24',
  },
  // 教官
  '10007': {
    name: '教官4: 全員元素熟知+120',
    duration: 8,
    statEffectSummary: '元素反応を起こすとチーム全員の元素熟知+120',
    color: '#38bdf8',
  },
  // 悠久の磐岩
  '15014': {
    name: '悠久4: 該当元素ダメ+35%',
    duration: 10,
    statEffectSummary: '結晶反応の欠片を拾うと、該当元素ダメ+35%',
    color: '#f59e0b',
  },
  // 黄金の劇団
  '15032': {
    name: '劇団4: 待機時スキルダメ+25%',
    duration: 2,
    statEffectSummary: '待機時、元素スキルダメージさらに+25%',
    color: '#fbbf24',
  },
  // ファントムハンター
  '15031': {
    name: 'ファントム4: 会心率UP',
    duration: 5,
    statEffectSummary: 'HP増減時、会心率+12% (最大3層=+36%)',
    color: '#60a5fa',
  },
  // 黒曜の秘典
  '15038': {
    name: '黒曜4: 会心率+40%',
    duration: 6,
    statEffectSummary: '夜魂値消費時、会心率+40%',
    color: '#a855f7',
  },
  // 追憶のしめ縄
  '15019': {
    name: '追憶4: 通常・重撃・落下ダメ+50%',
    duration: 10,
    statEffectSummary: 'スキル時エネルギー15消費し通常重撃落下ダメ+50%',
    color: '#f87171',
  },
  // 辰砂往生録
  '15023': {
    name: '辰砂4: 潜光(攻撃力UP)',
    duration: 16,
    statEffectSummary: '爆発後HP減少で攻撃力最大+66%',
    color: '#34d399',
  },
  // 海染硨磲
  '15022': {
    name: '海染4: 泡ダメージ',
    duration: 3,
    cooldown: 3.5,
    statEffectSummary: '回復量を記録し3秒後に物理ダメージ発生',
    color: '#38bdf8',
  },
  // 在りし日の歌
  '15033': {
    name: '昔日4: 彼方の効果',
    duration: 6,
    cooldown: 6,
    statEffectSummary: '回復記録後、通常重撃スキル爆発の基礎ダメ加算',
    color: '#fb7185',
  },
  // 亡命者
  '10009': {
    name: '亡命者4: チームエネルギー回復',
    duration: 6,
    statEffectSummary: '爆発発動後6秒間、他キャラのエネルギーを計6回復',
    color: '#818cf8',
  },
};
