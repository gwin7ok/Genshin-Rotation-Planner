import { AppDatabase, WeaponDatabaseItem, ArtifactSetDatabaseItem } from '../types/database';
import { generateLatestMasterDatabase } from '../utils/genshinDbMasterGenerator';

export const MASTER_WEAPONS: WeaponDatabaseItem[] = [
  // Polearms (長柄武器)
  {
    id: 'engulfing_lightning',
    name: '草薙の稲光',
    weaponType: 'polearm',
    rarity: 5,
    baseAttack: 608,
    subStat: '元素チャージ効率 55.1%',
    passiveName: '非滅の陣・夢山一心',
    description: '100%を超えたチャージ効率の28%分攻撃力UP(最大80%)。元素爆発発動後、チャージ効率+30%(12秒)。',
    buffEffect: {
      id: 'engulfing_buff',
      name: '草薙の稲光: 爆発後チャージ+30%',
      duration: 12.0,
      statEffect: 'チャージ効率 +30%',
      description: '元素爆発発動後12秒間、元素チャージ効率+30%',
      color: '#c084fc'
    }
  },
  {
    id: 'staff_of_homa',
    name: '護摩の杖',
    weaponType: 'polearm',
    rarity: 5,
    baseAttack: 608,
    subStat: '会心ダメージ 66.2%',
    passiveName: '朱砂の蝶',
    description: 'HP+20%。HP上限の0.8%分攻撃力UP。HP50%未満の時さらにHP上限の1%分攻撃力UP。',
    buffEffect: {
      id: 'homa_buff',
      name: '護摩の杖: HP50%未満時攻撃力UP',
      duration: 99.0,
      statEffect: '攻撃力大幅加算 (HP50%未満)',
      description: 'HP50%未満時、攻撃力がさらに追加加算',
      color: '#ef4444'
    }
  },
  {
    id: 'the_catch',
    name: '「漁獲」',
    weaponType: 'polearm',
    rarity: 4,
    baseAttack: 510,
    subStat: '元素チャージ効率 45.9%',
    passiveName: '捕舟',
    description: '元素爆発のダメージ+32%、元素爆発の会心率+12%。'
  },
  {
    id: 'favonius_lance',
    name: '西風長槍',
    weaponType: 'polearm',
    rarity: 4,
    baseAttack: 565,
    subStat: '元素チャージ効率 30.6%',
    passiveName: '風の赴くまま',
    description: '会心攻撃発生時、100%の確率で無色無属性粒子を3個生成(CT:6秒)。'
  },

  // Swords (片手剣)
  {
    id: 'mistsplitter_reforged',
    name: '霧切の回光',
    weaponType: 'sword',
    rarity: 5,
    baseAttack: 674,
    subStat: '会心ダメージ 44.1%',
    passiveName: '霧切の巴',
    description: '全元素ダメージ+12%。「霧切の巴紋」1/2/3層獲得時、自身の元素ダメージ+8/16/28%。'
  },
  {
    id: 'freedom_sworn',
    name: '蒼古なる自由への誓い',
    weaponType: 'sword',
    rarity: 5,
    baseAttack: 608,
    subStat: '元素熟知 198',
    passiveName: '千年の大楽・抗争の歌',
    description: '与えるダメージ+10%。元素反応トリガー時、チーム全員の通常・重撃・落下ダメージ+16%、攻撃力+20%(12秒)。',
    buffEffect: {
      id: 'freedom_sworn_buff',
      name: '蒼古: 抗争の歌 (全員攻撃+20% & 通常・重撃ダメ+16%)',
      duration: 12.0,
      cooldown: 20.0,
      statEffect: '全員攻撃力+20% / 通常重撃ダメ+16%',
      description: 'チーム全員の通常・重撃・落下攻撃ダメージ+16%、攻撃力+20%',
      color: '#10b981'
    }
  },
  {
    id: 'key_of_khaj_nisut',
    name: '聖顕の鍵',
    weaponType: 'sword',
    rarity: 5,
    baseAttack: 542,
    subStat: 'HP 66.2%',
    passiveName: '砂海の沈黙',
    description: 'HP+20%。スキル命中時HPの0.2%分熟知加算(3層まで)。3層到達時チーム全員の熟知+HPの0.2%(20秒)。',
    buffEffect: {
      id: 'key_buff',
      name: '聖顕の鍵: 全員元素熟知バフ',
      duration: 20.0,
      statEffect: 'チーム全員の元素熟知加算',
      description: 'チーム全員の元素熟知をHP上限に応じて上昇(20秒)',
      color: '#f59e0b'
    }
  },
  {
    id: 'sacrificial_sword',
    name: '祭礼の剣',
    weaponType: 'sword',
    rarity: 4,
    baseAttack: 454,
    subStat: '元素チャージ効率 61.3%',
    passiveName: '重厚',
    description: '元素スキルが敵にダメージを与えた時80%の確率でCTリセット(CT:16秒)。'
  },
  {
    id: 'favonius_sword',
    name: '西風剣',
    weaponType: 'sword',
    rarity: 4,
    baseAttack: 454,
    subStat: '元素チャージ効率 61.3%',
    passiveName: '風の赴くまま',
    description: '会心攻撃発生時100%の確率で無色粒子3個生成(CT:6秒)。'
  },
  {
    id: 'fleuve_cendre_ferryman',
    name: 'サーンドルの渡守 (鉄パイプ)',
    weaponType: 'sword',
    rarity: 4,
    baseAttack: 510,
    subStat: '元素チャージ効率 45.9%',
    passiveName: 'フレヴ・ヴァンドル',
    description: '元素スキルの会心率+16%。元素スキル発動後5秒間、元素チャージ効率+32%。',
    buffEffect: {
      id: 'pipe_buff',
      name: 'サーンドル: スキル後チャージ+32%',
      duration: 5.0,
      statEffect: 'チャージ効率 +32%',
      description: '元素スキル発動後5秒間、元素チャージ効率+32%',
      color: '#38bdf8'
    }
  },
  {
    id: 'sapwood_blade',
    name: '原木刀',
    weaponType: 'sword',
    rarity: 4,
    baseAttack: 565,
    subStat: '元素チャージ効率 30.6%',
    passiveName: 'フォレスト・サンクチュアリ',
    description: '草元素反応トリガー時「種」生成。拾ったキャラの元素熟知+120(12秒)。',
    buffEffect: {
      id: 'sapwood_buff',
      name: '原木刀: 唯空の葉 (熟知+120)',
      duration: 12.0,
      cooldown: 20.0,
      statEffect: '拾ったキャラの元素熟知 +120',
      description: '種を拾ったキャラクターの元素熟知+120',
      color: '#10b981'
    }
  },

  // Bows (弓)
  {
    id: 'aqua_simulacra',
    name: '若水',
    weaponType: 'bow',
    rarity: 5,
    baseAttack: 542,
    subStat: '会心ダメージ 88.2%',
    passiveName: '洗われし浄水',
    description: 'HP+16%。周囲に敵がいる時与えるダメージ+20%(控えでも発動)。'
  },
  {
    id: 'elegy_for_the_end',
    name: '終焉を嘆く詩',
    weaponType: 'bow',
    rarity: 5,
    baseAttack: 608,
    subStat: '元素チャージ効率 55.1%',
    passiveName: '千年の大楽・別れの歌',
    description: '元素熟知+60。スキル/爆発4回命中時、全員の元素熟知+100、攻撃力+20%(12秒)。',
    buffEffect: {
      id: 'elegy_buff',
      name: '終焉: 別れの歌 (全員熟知+100 & 攻撃+20%)',
      duration: 12.0,
      cooldown: 20.0,
      statEffect: '全員元素熟知+100 / 攻撃力+20%',
      description: 'チーム全員の元素熟知+100、攻撃力+20%(12秒)',
      color: '#38bdf8'
    }
  },
  {
    id: 'favonius_warbow',
    name: '西風猟弓',
    weaponType: 'bow',
    rarity: 4,
    baseAttack: 454,
    subStat: '元素チャージ効率 61.3%',
    passiveName: '風の赴くまま',
    description: '会心発生時、100%の確率で無色粒子3個生成(CT:6秒)。'
  },

  // Catalysts (法器)
  {
    id: 'splendor_of_tranquil_waters',
    name: '静水流転の輝き',
    weaponType: 'catalyst',
    rarity: 5,
    baseAttack: 542,
    subStat: '会心ダメージ 88.2%',
    passiveName: '湖光の純真',
    description: 'HP増減時スキルダメ+8%(最大3層)。味方HP増減時HP上限+14%(最大2層)。'
  },
  {
    id: 'a_thousand_floating_dreams',
    name: '千夜に浮かぶ夢',
    weaponType: 'catalyst',
    rarity: 5,
    baseAttack: 542,
    subStat: '元素熟知 265',
    passiveName: '千夜の千夢',
    description: '同属性キャラごとに装備者熟知+32、異属性ごとに全元素ダメ+10%。全員の熟知+40。',
    buffEffect: {
      id: 'floating_dreams_buff',
      name: '千夜に浮かぶ夢: 全員熟知+40',
      duration: 99.0,
      statEffect: 'チーム全員の元素熟知 +40',
      description: '装備者以外のチーム全員の元素熟知+40',
      color: '#34d399'
    }
  },
  {
    id: 'thrilling_tales',
    name: '龍殺しの英傑譚',
    weaponType: 'catalyst',
    rarity: 3,
    baseAttack: 401,
    subStat: 'HP 35.2%',
    passiveName: '伝承',
    description: 'キャラチェンジ時、次に出場するキャラの攻撃力+48%(10秒、CT:20秒)。',
    buffEffect: {
      id: 'ttds_buff',
      name: '龍殺し: 次の出場キャラ攻撃力+48%',
      duration: 10.0,
      cooldown: 20.0,
      statEffect: '交代先キャラ攻撃力 +48%',
      description: 'キャラチェンジ時、次に出場するキャラクターの攻撃力+48%',
      color: '#f59e0b'
    }
  },
  {
    id: 'sacrificial_fragments',
    name: '祭礼の断片',
    weaponType: 'catalyst',
    rarity: 4,
    baseAttack: 454,
    subStat: '元素熟知 221',
    passiveName: '重厚',
    description: '元素スキルダメージ時80%の確率でCTリセット(CT:16秒)。'
  },

  // Claymores (両手剣)
  {
    id: 'serpent_spine',
    name: '螭骨の剣',
    weaponType: 'claymore',
    rarity: 4,
    baseAttack: 510,
    subStat: '会心率 27.6%',
    passiveName: '波破り',
    description: 'フィールド上にいる時4秒ごとに与ダメ+10%(最大5層)。被弾で1層失う。'
  },
  {
    id: 'favonius_greatsword',
    name: '西風大剣',
    weaponType: 'claymore',
    rarity: 4,
    baseAttack: 454,
    subStat: '元素チャージ効率 61.3%',
    passiveName: '風の赴くまま',
    description: '会心攻撃発生時無色粒子3個生成(CT:6秒)。'
  }
];

export const MASTER_ARTIFACTS: ArtifactSetDatabaseItem[] = [
  {
    id: 'emblem_4p',
    name: '絶縁の旗印 4セット',
    rarity: 5,
    effect2p: '元素チャージ効率 +20%',
    effect4p: '元素チャージ効率の25%分、元素爆発のダメージUP（最大75%まで）。'
  },
  {
    id: 'noblesse_4p',
    name: '旧貴族のしつけ 4セット',
    rarity: 5,
    effect2p: '元素爆発のダメージ +20%',
    effect4p: '元素爆発を発動すると、チーム全員の攻撃力+20%（12秒、重複不可）。',
    buffEffect: {
      id: 'noblesse_4p_buff',
      name: '旧貴族4: 全員攻撃力+20%',
      duration: 12.0,
      statEffect: 'チーム全員の攻撃力 +20%',
      description: '元素爆発発動時、12秒間チーム全員の攻撃力+20%',
      color: '#f87171'
    }
  },
  {
    id: 'viridescent_4p',
    name: '翠緑の影 4セット',
    rarity: 5,
    effect2p: '風元素ダメージ +15%',
    effect4p: '拡散反応のダメージ+60%。拡散された元素の敵耐性-40%（10秒、装備者が表にいる時のみ）。',
    buffEffect: {
      id: 'viridescent_4p_buff',
      name: '翠緑4: 拡散元素耐性-40%',
      duration: 10.0,
      statEffect: '該当元素耐性 -40%',
      description: '拡散反応を起こした元素の敵耐性-40%',
      color: '#14b8a6'
    }
  },
  {
    id: 'deepwood_4p',
    name: '深林の記憶 4セット',
    rarity: 5,
    effect2p: '草元素ダメージ +15%',
    effect4p: '元素スキルまたは元素爆発が命中すると、敵の草元素耐性-30%（8秒、控えでも発動）。',
    buffEffect: {
      id: 'deepwood_4p_buff',
      name: '深林4: 敵の草元素耐性-30%',
      duration: 8.0,
      statEffect: '草元素耐性 -30%',
      description: 'スキル/爆発命中時、敵の草元素耐性-30%',
      color: '#059669'
    }
  },
  {
    id: 'golden_troupe_4p',
    name: '黄金の劇団 4セット',
    rarity: 5,
    effect2p: '元素スキルダメージ +20%',
    effect4p: '元素スキルダメージ+25%。さらに控えにいる時元素スキルダメージ+25%。'
  },
  {
    id: 'marechaussee_4p',
    name: 'ファントムハンター 4セット',
    rarity: 5,
    effect2p: '通常攻撃および重撃ダメージ +15%',
    effect4p: 'HPが増加または減少時、会心率+12%（5秒、最大3層）。'
  },
  {
    id: 'tenacity_4p',
    name: '千岩牢固 4セット',
    rarity: 5,
    effect2p: 'HP +20%',
    effect4p: '元素スキルが命中で全員の攻撃力+20%、シールド強化+30%（3秒、控えでも発動）。',
    buffEffect: {
      id: 'tenacity_4p_buff',
      name: '千岩4: 全員攻撃力+20% & シールド強化+30%',
      duration: 3.0,
      statEffect: '全員攻撃力+20% / シールド強化+30%',
      description: '元素スキル命中時、3秒間全員の攻撃力+20%',
      color: '#f59e0b'
    }
  },
  {
    id: 'scroll_hero_4p',
    name: '灰燼の街に響く英雄の絵巻 4セット',
    rarity: 5,
    effect2p: '夜魂性質反応トリガー時エネルギー回復',
    effect4p: '元素反応を起こすと該当元素ダメバフ+12%(15s)。夜魂バースト時+28%追加(全15s)。',
    buffEffect: {
      id: 'scroll_hero_buff',
      name: '絵巻4: 該当元素ダメバフ+40%',
      duration: 15.0,
      statEffect: '関連元素ダメバフ +40%',
      description: '元素反応・夜魂時にチーム全員へ該当元素ダメバフ付与',
      color: '#ec4899'
    }
  },
  {
    id: 'instructor_4p',
    name: '教官 4セット',
    rarity: 4,
    effect2p: '元素熟知 +80',
    effect4p: '元素反応を引き起こした後、チーム全員の元素熟知+120（8秒）。',
    buffEffect: {
      id: 'instructor_4p_buff',
      name: '教官4: 全員元素熟知+120',
      duration: 8.0,
      statEffect: 'チーム全員の元素熟知 +120',
      description: '元素反応トリガー後、8秒間チーム全員の元素熟知+120',
      color: '#fb923c'
    }
  },
  {
    id: 'crimson_witch_4p',
    name: '炎の魔女 4セット',
    rarity: 5,
    effect2p: '炎元素ダメージ +15%',
    effect4p: '過負荷、燃焼、烈開花ダメージ+40%。蒸発、溶解の反応加算+15%。スキル使用時2P効果+50%(最大3層)。'
  }
];

export const INITIAL_MASTER_DATABASE: AppDatabase = generateLatestMasterDatabase();
