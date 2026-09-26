import { PartyPreset } from '../types/genshin';
import { ALL_CHARACTERS_ROSTER, resolveLegacyCharacterId } from './characters';

// Helper to get character by ID（プリセットは旧キーで書いてあるので新キーに変換して探す）
const getChar = (id: string) => {
  const key = resolveLegacyCharacterId(id);
  const found = ALL_CHARACTERS_ROSTER.find(c => c.id === key);
  if (!found) throw new Error(`Character ${id} not found`);
  return { ...found };
};

const RAW_ROTATION_PRESETS: PartyPreset[] = [
  {
    id: 'raiden_national',
    name: '雷電ナショナル (Rational)',
    description: '原神を代表する黄金律ローテーション。行秋の雨すだれ、ベネットの攻撃バフ、香菱の旋火輪スナップショット、雷電の夢想の一心による高DPSと全体エネルギー還元。',
    characters: [
      getChar('raiden'),
      getChar('xingqiu'),
      getChar('bennett'),
      getChar('xiangling'),
    ],
    stints: [
      {
        id: 'stint_1',
        characterId: 'raiden',
        actions: [
          { id: 'act_1_1', actionTypeId: 'raiden_e', name: '元素スキル: 雷罰悪曜の眼', shortName: 'E', type: 'skill', duration: 0.9 },
        ]
      },
      {
        id: 'stint_2',
        characterId: 'xingqiu',
        actions: [
          { id: 'act_2_1', actionTypeId: 'xingqiu_q', name: '元素爆発: 裁雨留虹', shortName: 'Q', type: 'burst', duration: 1.4 },
          { id: 'act_2_2', actionTypeId: 'xingqiu_e', name: '元素スキル: 画雨籠山', shortName: 'E', type: 'skill', duration: 1.1 },
          { id: 'act_2_3', actionTypeId: 'xingqiu_e2', name: '元素スキル (祭礼リセット)', shortName: 'E (祭礼)', type: 'skill_reset', duration: 1.0 },
          { id: 'act_2_4', actionTypeId: 'xingqiu_n1', name: '通常攻撃 1段目 (剣雨トリガー)', shortName: 'N', type: 'normal', duration: 0.25 },
        ]
      },
      {
        id: 'stint_3',
        characterId: 'bennett',
        actions: [
          { id: 'act_3_1', actionTypeId: 'bennett_q', name: '元素爆発: 美冒険の輝き (旧貴族4)', shortName: 'Q', type: 'burst', duration: 1.3 },
          { id: 'act_3_2', actionTypeId: 'bennett_e', name: '元素スキル (炎粒子2.2個)', shortName: 'E', type: 'skill', duration: 0.8 },
        ]
      },
      {
        id: 'stint_4',
        characterId: 'xiangling',
        actions: [
          { id: 'act_4_1', actionTypeId: 'xiangling_q', name: '元素爆発: 旋火輪 (スナップショット)', shortName: 'Q', type: 'burst', duration: 1.3 },
          { id: 'act_4_2', actionTypeId: 'xiangling_e', name: '元素スキル: グゥオパァー', shortName: 'E', type: 'skill', duration: 0.9 },
        ]
      },
      {
        id: 'stint_5',
        characterId: 'raiden',
        actions: [
          { id: 'act_5_1', actionTypeId: 'raiden_q', name: '元素爆発: 奥義・夢想の一心', shortName: 'Q', type: 'burst', duration: 1.8 },
          { id: 'act_5_2', actionTypeId: 'raiden_combo', name: '夢想の一心コンボ (3N3C+N1C)', shortName: '3N3C+N1C', type: 'combo', duration: 6.8 },
        ]
      },
      {
        id: 'stint_6',
        characterId: 'bennett',
        actions: [
          { id: 'act_6_1', actionTypeId: 'bennett_e', name: '元素スキル (粒子補給)', shortName: 'E', type: 'skill', duration: 0.8 },
        ]
      }
    ]
  },
  {
    id: 'hutao_double_hydro',
    name: '胡桃往生夜行 (Hu Tao Double Hydro)',
    description: '鍾離の盤石シールド・全耐性ダウンと行秋＋夜蘭の圧倒的水付着の上から、胡桃の重撃蒸発（1.5倍）を連続で叩き込む単体最強編成。',
    characters: [
      getChar('zhongli'),
      getChar('xingqiu'),
      getChar('yelan'),
      getChar('hutao'),
    ],
    stints: [
      {
        id: 'stint_ht_1',
        characterId: 'zhongli',
        actions: [
          { id: 'act_ht_1_1', actionTypeId: 'zhongli_hold_e', name: '元素スキル長押し: 玉璋シールド', shortName: '長押しE', type: 'skill_hold', duration: 1.5 },
        ]
      },
      {
        id: 'stint_ht_2',
        characterId: 'xingqiu',
        actions: [
          { id: 'act_ht_2_1', actionTypeId: 'xingqiu_q', name: '元素爆発: 裁雨留虹', shortName: 'Q', type: 'burst', duration: 1.4 },
          { id: 'act_ht_2_2', actionTypeId: 'xingqiu_e', name: '元素スキル: 画雨籠山', shortName: 'E', type: 'skill', duration: 1.1 },
          { id: 'act_ht_2_3', actionTypeId: 'xingqiu_n1', name: '通常攻撃 1段目', shortName: 'N', type: 'normal', duration: 0.25 },
        ]
      },
      {
        id: 'stint_ht_3',
        characterId: 'yelan',
        actions: [
          { id: 'act_ht_3_1', actionTypeId: 'yelan_e', name: '元素スキル: 幽奇の絡繰り針', shortName: 'E', type: 'skill', duration: 0.9 },
          { id: 'act_ht_3_2', actionTypeId: 'yelan_q', name: '元素爆発: 淵曜の玲瓏', shortName: 'Q', type: 'burst', duration: 1.4 },
          { id: 'act_ht_3_3', actionTypeId: 'yelan_n1', name: '通常攻撃 1段目', shortName: 'N', type: 'normal', duration: 0.25 },
        ]
      },
      {
        id: 'stint_ht_4',
        characterId: 'hutao',
        actions: [
          { id: 'act_ht_4_1', actionTypeId: 'hutao_e', name: '元素スキル: 蝶導来世', shortName: 'E', type: 'skill', duration: 0.6 },
          { id: 'act_ht_4_2', actionTypeId: 'hutao_n1c_dash', name: '重撃ループ N1CD x5', shortName: '5x N1CD', type: 'combo', duration: 3.6 },
          { id: 'act_ht_4_3', actionTypeId: 'hutao_n1c_dash', name: '重撃ループ N1CD x3', shortName: '3x N1CD', type: 'combo', duration: 2.2 },
          { id: 'act_ht_4_4', actionTypeId: 'hutao_burst', name: '元素爆発: 安神秘法', shortName: 'Q', type: 'burst', duration: 1.7 },
        ]
      }
    ]
  },
  {
    id: 'international_childe',
    name: 'タルタリヤ国際 (Childe International)',
    description: '万葉による水・炎の「二重拡散」により、敵の水耐性と炎耐性を同時に-40%ダウン。香菱の全蒸発旋火輪とタルタリヤの断流追撃が爆発する広範囲制圧力No.1編成。',
    characters: [
      getChar('childe'),
      getChar('bennett'),
      getChar('kazuha'),
      getChar('xiangling'),
    ],
    stints: [
      {
        id: 'stint_intl_1',
        characterId: 'childe',
        actions: [
          { id: 'act_intl_1_1', actionTypeId: 'childe_e_entry', name: '近接モード切替 (水付着)', shortName: 'E起動', type: 'skill', duration: 0.4 },
          { id: 'act_intl_1_2', actionTypeId: 'childe_e_exit', name: '近接モード解除', shortName: 'E解除', type: 'skill', duration: 0.3 },
        ]
      },
      {
        id: 'stint_intl_2',
        characterId: 'bennett',
        actions: [
          { id: 'act_intl_2_1', actionTypeId: 'bennett_q', name: '元素爆発: 美冒険の輝き', shortName: 'Q', type: 'burst', duration: 1.3 },
        ]
      },
      {
        id: 'stint_intl_3',
        characterId: 'kazuha',
        actions: [
          { id: 'act_intl_3_1', actionTypeId: 'kazuha_hold_e_plunge', name: '長押しスキル＋乱れ嵐斬 (二重拡散)', shortName: '長E+PA', type: 'skill_hold', duration: 1.9 },
          { id: 'act_intl_3_2', actionTypeId: 'kazuha_q', name: '元素爆発: 万葉の一刀', shortName: 'Q', type: 'burst', duration: 1.6 },
        ]
      },
      {
        id: 'stint_intl_4',
        characterId: 'xiangling',
        actions: [
          { id: 'act_intl_4_1', actionTypeId: 'xiangling_q', name: '元素爆発: 旋火輪 (フルバフ)', shortName: 'Q', type: 'burst', duration: 1.3 },
          { id: 'act_intl_4_2', actionTypeId: 'xiangling_e', name: '元素スキル: グゥオパァー', shortName: 'E', type: 'skill', duration: 0.9 },
        ]
      },
      {
        id: 'stint_intl_5',
        characterId: 'childe',
        actions: [
          { id: 'act_intl_5_1', actionTypeId: 'childe_ranged_q', name: '元素爆発 (弓モード・大蒸発)', shortName: '弓Q', type: 'burst', duration: 1.3 },
          { id: 'act_intl_5_2', actionTypeId: 'childe_e_entry', name: '近接モード切替', shortName: 'E起動', type: 'skill', duration: 0.3 },
          { id: 'act_intl_5_3', actionTypeId: 'childe_n2cd', name: '近接攻撃コンボ N2C+D', shortName: '近接連撃', type: 'combo', duration: 4.8 },
          { id: 'act_intl_5_4', actionTypeId: 'childe_e_exit', name: '近接解除 (CT管理)', shortName: 'E解除', type: 'skill', duration: 0.3 },
        ]
      }
    ]
  },
  {
    id: 'neuvillette_hyper',
    name: 'ヌヴィレット・フリーナ (Neuvillette Hypercarry)',
    description: 'フリーナのテンション全体与ダメバフ＋万葉の翠緑耐性ダウン＋鍾離の耐性ダウンシールドで、ヌヴィレットの重撃ビームが敵を溶解する現環境最高峰キャリー。',
    characters: [
      getChar('furina'),
      getChar('zhongli'),
      getChar('kazuha'),
      getChar('neuvillette'),
    ],
    stints: [
      {
        id: 'stint_neuv_1',
        characterId: 'furina',
        actions: [
          { id: 'act_neuv_1_1', actionTypeId: 'furina_e', name: '元素スキル: サロンメンバー召喚', shortName: 'E', type: 'skill', duration: 0.9 },
          { id: 'act_neuv_1_2', actionTypeId: 'furina_q', name: '元素爆発: 万民の歓呼', shortName: 'Q', type: 'burst', duration: 1.3 },
        ]
      },
      {
        id: 'stint_neuv_2',
        characterId: 'zhongli',
        actions: [
          { id: 'act_neuv_2_1', actionTypeId: 'zhongli_hold_e', name: '元素スキル長押し: 玉璋シールド', shortName: '長押しE', type: 'skill_hold', duration: 1.5 },
        ]
      },
      {
        id: 'stint_neuv_3',
        characterId: 'kazuha',
        actions: [
          { id: 'act_neuv_3_1', actionTypeId: 'kazuha_tap_e_plunge', name: '一押しスキル＋乱れ嵐斬 (水拡散)', shortName: '短E+PA', type: 'skill', duration: 1.4 },
        ]
      },
      {
        id: 'stint_neuv_4',
        characterId: 'neuvillette',
        actions: [
          { id: 'act_neuv_4_1', actionTypeId: 'neuv_e', name: '元素スキル (雫3個)', shortName: 'E', type: 'skill', duration: 0.8 },
          { id: 'act_neuv_4_2', actionTypeId: 'neuv_q', name: '元素爆発 (雫6個)', shortName: 'Q', type: 'burst', duration: 1.9 },
          { id: 'act_neuv_4_3', actionTypeId: 'neuv_ca_beam', name: '重撃・衡平な裁断 (雫3個吸収ビーム①)', shortName: '重撃ビーム①', type: 'charged', duration: 3.2 },
          { id: 'act_neuv_4_4', actionTypeId: 'neuv_ca_beam', name: '重撃・衡平な裁断 (雫3個吸収ビーム②)', shortName: '重撃ビーム②', type: 'charged', duration: 3.2 },
        ]
      }
    ]
  },
  {
    id: 'alhaitham_quickbloom',
    name: 'アルハイゼン超開花 (Alhaitham Quickbloom)',
    description: 'ナヒーダの滅浄三業＋行秋の雨すだれ＋久岐忍の草輪＋アルハイゼンの琢光鏡で激化・開花・超開花を同時多発させる元素反応の極致。',
    characters: [
      getChar('nahida'),
      getChar('xingqiu'),
      getChar('shinobu'),
      getChar('alhaitham'),
    ],
    stints: [
      {
        id: 'stint_haitham_1',
        characterId: 'nahida',
        actions: [
          { id: 'act_haitham_1_1', actionTypeId: 'nahida_hold_e', name: '元素スキル長押し: 所聞遍計', shortName: '長押しE', type: 'skill_hold', duration: 1.2 },
          { id: 'act_haitham_1_2', actionTypeId: 'nahida_q', name: '元素爆発: 心景幻成', shortName: 'Q', type: 'burst', duration: 1.5 },
        ]
      },
      {
        id: 'stint_haitham_2',
        characterId: 'xingqiu',
        actions: [
          { id: 'act_haitham_2_1', actionTypeId: 'xingqiu_q', name: '元素爆発: 裁雨留虹', shortName: 'Q', type: 'burst', duration: 1.4 },
          { id: 'act_haitham_2_2', actionTypeId: 'xingqiu_e', name: '元素スキル: 画雨籠山', shortName: 'E', type: 'skill', duration: 1.1 },
        ]
      },
      {
        id: 'stint_haitham_3',
        characterId: 'shinobu',
        actions: [
          { id: 'act_haitham_3_1', actionTypeId: 'shinobu_e', name: '元素スキル: 越祓草輪', shortName: 'E', type: 'skill', duration: 0.7 },
        ]
      },
      {
        id: 'stint_haitham_4',
        characterId: 'alhaitham',
        actions: [
          { id: 'act_haitham_4_1', actionTypeId: 'alhaitham_q', name: '元素爆発: 殊境・顕象結縛', shortName: 'Q', type: 'burst', duration: 1.8 },
          { id: 'act_haitham_4_2', actionTypeId: 'alhaitham_infusion_combo', name: '琢光鏡3枚 通常連撃', shortName: '3鏡連撃', type: 'combo', duration: 4.0 },
          { id: 'act_haitham_4_3', actionTypeId: 'alhaitham_ca', name: '重撃 (琢光鏡+1枚更新)', shortName: 'CA (鏡更新)', type: 'charged', duration: 0.7 },
        ]
      }
    ]
  }
];

/** 出場ブロックのキャラ参照も新キー（公式ID-元素）に置き換えたプリセット */
export const ROTATION_PRESETS: PartyPreset[] = RAW_ROTATION_PRESETS.map(preset => ({
  ...preset,
  stints: preset.stints.map(s => ({ ...s, characterId: resolveLegacyCharacterId(s.characterId) })),
}));
