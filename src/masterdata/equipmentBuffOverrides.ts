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
 * キー: 武器名(日本語) または 英語名、または正規化ID
 */
export const WEAPON_BUFF_OVERRIDES: Record<string, EquipmentBuffOverride> = {
  // --- 仕様書記載の主要サポーター / バフ武器 ---
  '蒼古なる自由への誓い': {
    name: '蒼古: 抗争の歌',
    duration: 12.0,
    cooldown: 20.0,
    statEffectSummary: '全員攻撃+20% / 通常・重撃・落下ダメ+16%',
    color: '#38bdf8', // スカイブルー (風/自由)
  },
  'Freedom-Sworn': {
    name: '蒼古: 抗争の歌',
    duration: 12.0,
    cooldown: 20.0,
    statEffectSummary: '全員攻撃+20% / 通常・重撃・落下ダメ+16%',
    color: '#38bdf8',
  },
  '終焉を嘆く詩': {
    name: '終焉: 別れの歌',
    duration: 12.0,
    cooldown: 20.0,
    statEffectSummary: '全員元素熟知+100 / 攻撃力+20%',
    color: '#34d399', // エメラルドグリーン
  },
  'Elegy for the End': {
    name: '終焉: 別れの歌',
    duration: 12.0,
    cooldown: 20.0,
    statEffectSummary: '全員元素熟知+100 / 攻撃力+20%',
    color: '#34d399',
  },
  '聖顕の鍵': {
    name: '聖顕の鍵: 全員熟知バフ',
    duration: 20.0,
    statEffectSummary: 'HP上限に応じてチーム全員の元素熟知加算',
    color: '#fbbf24', // アンバー
  },
  'Key of Khaj-Nisut': {
    name: '聖顕の鍵: 全員熟知バフ',
    duration: 20.0,
    statEffectSummary: 'HP上限に応じてチーム全員の元素熟知加算',
    color: '#fbbf24',
  },
  '原木刀': {
    name: '原木刀: 唯空の葉',
    duration: 12.0,
    cooldown: 20.0,
    statEffectSummary: '拾ったキャラの元素熟知+60〜120',
    color: '#10b981', // グリーン
  },
  'Sapwood Blade': {
    name: '原木刀: 唯空の葉',
    duration: 12.0,
    cooldown: 20.0,
    statEffectSummary: '拾ったキャラの元素熟知+60〜120',
    color: '#10b981',
  },
  '龍殺しの英傑譚': {
    name: '龍殺し: 交代先攻撃力UP',
    duration: 10.0,
    cooldown: 20.0,
    statEffectSummary: '次に出場するキャラの攻撃力+48%',
    color: '#f87171', // レッド
  },
  'Thrilling Tales of Dragon Slayers': {
    name: '龍殺し: 交代先攻撃力UP',
    duration: 10.0,
    cooldown: 20.0,
    statEffectSummary: '次に出場するキャラの攻撃力+48%',
    color: '#f87171',
  },
  'サーンドルの渡守': {
    name: 'サーンドル: スキル後チャージUP',
    duration: 5.0,
    statEffectSummary: '元素スキル発動後、元素チャージ効率+32%',
    color: '#c084fc', // パープル
  },
  "Fleuve Cendre Ferryman": {
    name: 'サーンドル: スキル後チャージUP',
    duration: 5.0,
    statEffectSummary: '元素スキル発動後、元素チャージ効率+32%',
    color: '#c084fc',
  },

  // --- 西風シリーズ (Favonius - ★4: R5基準 CT6s/100%) ---
  '西風剣': {
    name: '西風剣: 無色粒子生成',
    duration: 0.1,
    cooldown: 6.0,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  'Favonius Sword': {
    name: '西風剣: 無色粒子生成',
    duration: 0.1,
    cooldown: 6.0,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  '西風長槍': {
    name: '西風長槍: 無色粒子生成',
    duration: 0.1,
    cooldown: 6.0,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  'Favonius Lance': {
    name: '西風長槍: 無色粒子生成',
    duration: 0.1,
    cooldown: 6.0,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  '西風大剣': {
    name: '西風大剣: 無色粒子生成',
    duration: 0.1,
    cooldown: 6.0,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  'Favonius Greatsword': {
    name: '西風大剣: 無色粒子生成',
    duration: 0.1,
    cooldown: 6.0,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  '西風猟弓': {
    name: '西風猟弓: 無色粒子生成',
    duration: 0.1,
    cooldown: 6.0,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  'Favonius Warbow': {
    name: '西風猟弓: 無色粒子生成',
    duration: 0.1,
    cooldown: 6.0,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  '西風秘典': {
    name: '西風秘典: 無色粒子生成',
    duration: 0.1,
    cooldown: 6.0,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },
  'Favonius Codex': {
    name: '西風秘典: 無色粒子生成',
    duration: 0.1,
    cooldown: 6.0,
    statEffectSummary: '会心時に100%の確率で無色元素粒子生成(CT6s)',
    color: '#94a3b8',
  },

  // --- 祭礼シリーズ (Sacrificial - ★4: R5基準 CT16s/80%) ---
  '祭礼の剣': {
    name: '祭礼の剣: スキルCTリセット',
    duration: 0.1,
    cooldown: 16.0,
    statEffectSummary: 'スキル命中で80%の確率でスキルCTリセット(CT16s)',
    color: '#60a5fa',
  },
  'Sacrificial Sword': {
    name: '祭礼の剣: スキルCTリセット',
    duration: 0.1,
    cooldown: 16.0,
    statEffectSummary: 'スキル命中で80%の確率でスキルCTリセット(CT16s)',
    color: '#60a5fa',
  },
  '祭礼の大剣': {
    name: '祭礼の大剣: スキルCTリセット',
    duration: 0.1,
    cooldown: 16.0,
    statEffectSummary: 'スキル命中で80%の確率でスキルCTリセット(CT16s)',
    color: '#60a5fa',
  },
  'Sacrificial Greatsword': {
    name: '祭礼の大剣: スキルCTリセット',
    duration: 0.1,
    cooldown: 16.0,
    statEffectSummary: 'スキル命中で80%の確率でスキルCTリセット(CT16s)',
    color: '#60a5fa',
  },
  '祭礼の断片': {
    name: '祭礼の断片: スキルCTリセット',
    duration: 0.1,
    cooldown: 16.0,
    statEffectSummary: 'スキル命中で80%の確率でスキルCTリセット(CT16s)',
    color: '#60a5fa',
  },
  'Sacrificial Fragments': {
    name: '祭礼の断片: スキルCTリセット',
    duration: 0.1,
    cooldown: 16.0,
    statEffectSummary: 'スキル命中で80%の確率でスキルCTリセット(CT16s)',
    color: '#60a5fa',
  },
  '祭礼の弓': {
    name: '祭礼の弓: スキルCTリセット',
    duration: 0.1,
    cooldown: 16.0,
    statEffectSummary: 'スキル命中で80%の確率でスキルCTリセット(CT16s)',
    color: '#60a5fa',
  },
  'Sacrificial Bow': {
    name: '祭礼の弓: スキルCTリセット',
    duration: 0.1,
    cooldown: 16.0,
    statEffectSummary: 'スキル命中で80%の確率でスキルCTリセット(CT16s)',
    color: '#60a5fa',
  },

  // --- 他のポピュラーなバフ武器 ---
  '狼の末路': {
    name: '狼の末路: 全員攻撃力+40%',
    duration: 12.0,
    cooldown: 30.0,
    statEffectSummary: 'HP30%以下の敵に命中でチーム全員攻撃力+40%',
    color: '#f87171',
  },
  'Wolf\'s Gravestone': {
    name: '狼の末路: 全員攻撃力+40%',
    duration: 12.0,
    cooldown: 30.0,
    statEffectSummary: 'HP30%以下の敵に命中でチーム全員攻撃力+40%',
    color: '#f87171',
  },
  '流浪楽章': {
    name: '流浪楽章: 主題曲バフ',
    duration: 10.0,
    cooldown: 30.0,
    statEffectSummary: '登場時ランダムバフ (攻撃+120% / 全ダメ+96% / 熟知+480)',
    color: '#ec4899', // ピンク
  },
  'The Widsith': {
    name: '流浪楽章: 主題曲バフ',
    duration: 10.0,
    cooldown: 30.0,
    statEffectSummary: '登場時ランダムバフ (攻撃+120% / 全ダメ+96% / 熟知+480)',
    color: '#ec4899',
  },
  '白辰の輪': {
    name: '白辰: 元素ダメ+10〜20%',
    duration: 6.0,
    statEffectSummary: '雷関連反応後、反応元素ダメ+10〜20%',
    color: '#c084fc',
  },
  'Hakushin Ring': {
    name: '白辰: 元素ダメ+10〜20%',
    duration: 6.0,
    statEffectSummary: '雷関連反応後、反応元素ダメ+10〜20%',
    color: '#c084fc',
  },
  '金珀・試作': {
    name: '金珀: 回復&エネルギー再生',
    duration: 6.0,
    statEffectSummary: '爆発発動後6秒間、全員HP回復&エネルギー回復',
    color: '#34d399',
  },
  'Prototype Amber': {
    name: '金珀: 回復&エネルギー再生',
    duration: 6.0,
    statEffectSummary: '爆発発動後6秒間、全員HP回復&エネルギー回復',
    color: '#34d399',
  },
};

/**
 * 聖遺物セットの補正辞書
 * キー: 聖遺物名(日本語) または 英語名、または正規化ID
 */
export const ARTIFACT_BUFF_OVERRIDES: Record<string, EquipmentBuffOverride> = {
  // --- 仕様書記載の主要聖遺物 ---
  '旧貴族のしつけ': {
    name: '旧貴族4: 全員攻撃力+20%',
    duration: 12.0,
    statEffectSummary: '元素爆発発動後、チーム全員の攻撃力+20%',
    color: '#f87171', // レッド
  },
  'Noblesse Oblige': {
    name: '旧貴族4: 全員攻撃力+20%',
    duration: 12.0,
    statEffectSummary: '元素爆発発動後、チーム全員の攻撃力+20%',
    color: '#f87171',
  },
  '翠緑の影': {
    name: '翠緑4: 拡散耐性-40%',
    duration: 10.0,
    statEffectSummary: '拡散された元素の敵耐性-40%',
    color: '#34d399', // エメラルドグリーン
  },
  'Viridescent Venerer': {
    name: '翠緑4: 拡散耐性-40%',
    duration: 10.0,
    statEffectSummary: '拡散された元素の敵耐性-40%',
    color: '#34d399',
  },
  '深林の記憶': {
    name: '深林4: 草元素耐性-30%',
    duration: 8.0,
    statEffectSummary: 'スキルまたは爆発命中で敵の草元素耐性-30%',
    color: '#10b981', // グリーン
  },
  'Deepwood Memories': {
    name: '深林4: 草元素耐性-30%',
    duration: 8.0,
    statEffectSummary: 'スキルまたは爆発命中で敵の草元素耐性-30%',
    color: '#10b981',
  },
  '千岩牢固': {
    name: '千岩4: 全員攻撃力+20%',
    duration: 3.0,
    statEffectSummary: 'スキル命中でチーム全員攻撃力+20% / シールド強化+30%',
    color: '#f59e0b', // アンバー
  },
  'Tenacity of the Millelith': {
    name: '千岩4: 全員攻撃力+20%',
    duration: 3.0,
    statEffectSummary: 'スキル命中でチーム全員攻撃力+20% / シールド強化+30%',
    color: '#f59e0b',
  },
  '灰燼の街に響く英雄の絵巻': {
    name: '絵巻4: 該当元素ダメバフ+40%',
    duration: 15.0,
    statEffectSummary: '夜魂性質反応後、関連元素ダメバフ+12%〜40%',
    color: '#fbbf24', // ゴールド
  },
  'Scroll of the Hero of Cinder City': {
    name: '絵巻4: 該当元素ダメバフ+40%',
    duration: 15.0,
    statEffectSummary: '夜魂性質反応後、関連元素ダメバフ+12%〜40%',
    color: '#fbbf24',
  },
  '教官': {
    name: '教官4: 全員元素熟知+120',
    duration: 8.0,
    statEffectSummary: '元素反応を起こすとチーム全員の元素熟知+120',
    color: '#38bdf8', // スカイブルー
  },
  'Instructor': {
    name: '教官4: 全員元素熟知+120',
    duration: 8.0,
    statEffectSummary: '元素反応を起こすとチーム全員の元素熟知+120',
    color: '#38bdf8',
  },

  // --- 他の主要セット ---
  '悠久の磐岩': {
    name: '悠久4: 該当元素ダメ+35%',
    duration: 10.0,
    statEffectSummary: '結晶反応の欠片を拾うと、該当元素ダメ+35%',
    color: '#f59e0b',
  },
  'Archaic Petra': {
    name: '悠久4: 該当元素ダメ+35%',
    duration: 10.0,
    statEffectSummary: '結晶反応の欠片を拾うと、該当元素ダメ+35%',
    color: '#f59e0b',
  },
  '黄金の劇団': {
    name: '劇団4: 待機時スキルダメ+25%',
    duration: 2.0,
    statEffectSummary: '待機時、元素スキルダメージさらに+25%',
    color: '#fbbf24',
  },
  'Golden Troupe': {
    name: '劇団4: 待機時スキルダメ+25%',
    duration: 2.0,
    statEffectSummary: '待機時、元素スキルダメージさらに+25%',
    color: '#fbbf24',
  },
  'ファントムハンター': {
    name: 'ファントム4: 会心率UP',
    duration: 5.0,
    statEffectSummary: 'HP増減時、会心率+12% (最大3層=+36%)',
    color: '#60a5fa',
  },
  'Marechaussee Hunter': {
    name: 'ファントム4: 会心率UP',
    duration: 5.0,
    statEffectSummary: 'HP増減時、会心率+12% (最大3層=+36%)',
    color: '#60a5fa',
  },
  '黒曜の秘典': {
    name: '黒曜4: 会心率+40%',
    duration: 6.0,
    statEffectSummary: '夜魂値消費時、会心率+40%',
    color: '#a855f7',
  },
  'Obsidian Codex': {
    name: '黒曜4: 会心率+40%',
    duration: 6.0,
    statEffectSummary: '夜魂値消費時、会心率+40%',
    color: '#a855f7',
  },
  '追憶のしめ縄': {
    name: '追憶4: 通常・重撃・落下ダメ+50%',
    duration: 10.0,
    statEffectSummary: 'スキル時エネルギー15消費し通常重撃落下ダメ+50%',
    color: '#f87171',
  },
  'Shimenawa\'s Reminiscence': {
    name: '追憶4: 通常・重撃・落下ダメ+50%',
    duration: 10.0,
    statEffectSummary: 'スキル時エネルギー15消費し通常重撃落下ダメ+50%',
    color: '#f87171',
  },
  '辰砂往生録': {
    name: '辰砂4: 潜光(攻撃力UP)',
    duration: 16.0,
    statEffectSummary: '爆発後HP減少で攻撃力最大+66%',
    color: '#34d399',
  },
  'Vermillion Hereafter': {
    name: '辰砂4: 潜光(攻撃力UP)',
    duration: 16.0,
    statEffectSummary: '爆発後HP減少で攻撃力最大+66%',
    color: '#34d399',
  },
  '海染硨磲': {
    name: '海染4: 泡ダメージ',
    duration: 3.0,
    cooldown: 3.5,
    statEffectSummary: '回復量を記録し3秒後に物理ダメージ発生',
    color: '#38bdf8',
  },
  'Ocean-Hued Clam': {
    name: '海染4: 泡ダメージ',
    duration: 3.0,
    cooldown: 3.5,
    statEffectSummary: '回復量を記録し3秒後に物理ダメージ発生',
    color: '#38bdf8',
  },
  '昔日の歌': {
    name: '昔日4: 彼方の効果',
    duration: 6.0,
    cooldown: 6.0,
    statEffectSummary: '回復記録後、通常重撃スキル爆発の基礎ダメ加算',
    color: '#fb7185',
  },
  'Song of Days Past': {
    name: '昔日4: 彼方の効果',
    duration: 6.0,
    cooldown: 6.0,
    statEffectSummary: '回復記録後、通常重撃スキル爆発の基礎ダメ加算',
    color: '#fb7185',
  },
  '亡命者': {
    name: '亡命者4: チームエネルギー回復',
    duration: 6.0,
    statEffectSummary: '爆発発動後6秒間、他キャラのエネルギーを計6回復',
    color: '#818cf8',
  },
  'The Exile': {
    name: '亡命者4: チームエネルギー回復',
    duration: 6.0,
    statEffectSummary: '爆発発動後6秒間、他キャラのエネルギーを計6回復',
    color: '#818cf8',
  },
};
