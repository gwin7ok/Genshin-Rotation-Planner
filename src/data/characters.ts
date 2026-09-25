import { ActionDefinition, CharacterConfig, ElementType, WeaponType } from '../types/genshin';
import masterDataJson from './characters_master_data.json';
import { isOfficialCharacterKey, legacyCharacterSlug } from './characterKeys';

export const ELEMENT_COLORS: Record<ElementType, { bg: string; border: string; text: string; light: string; hex: string }> = {
  pyro: { bg: 'bg-red-950/70', border: 'border-red-500', text: 'text-red-400', light: 'bg-red-500/20', hex: '#ef4444' },
  hydro: { bg: 'bg-sky-950/70', border: 'border-sky-500', text: 'text-sky-400', light: 'bg-sky-500/20', hex: '#0ea5e9' },
  electro: { bg: 'bg-purple-950/70', border: 'border-purple-500', text: 'text-purple-400', light: 'bg-purple-500/20', hex: '#a855f7' },
  dendro: { bg: 'bg-emerald-950/70', border: 'border-emerald-500', text: 'text-emerald-400', light: 'bg-emerald-500/20', hex: '#10b981' },
  cryo: { bg: 'bg-cyan-950/70', border: 'border-cyan-400', text: 'text-cyan-300', light: 'bg-cyan-500/20', hex: '#06b6d4' },
  anemo: { bg: 'bg-teal-950/70', border: 'border-teal-400', text: 'text-teal-300', light: 'bg-teal-500/20', hex: '#14b8a6' },
  geo: { bg: 'bg-amber-950/70', border: 'border-amber-500', text: 'text-amber-400', light: 'bg-amber-500/20', hex: '#f59e0b' },
  physical: { bg: 'bg-slate-900', border: 'border-slate-400', text: 'text-slate-300', light: 'bg-slate-500/20', hex: '#94a3b8' },
};

/** 編成クリア後の「未設定」スロット用プレースホルダーID接頭辞 */
export const EMPTY_SLOT_ID_PREFIX = 'empty_slot_';

export const isEmptySlotCharacter = (c: Pick<CharacterConfig, 'id'>): boolean =>
  c.id.startsWith(EMPTY_SLOT_ID_PREFIX);

export const createEmptySlotCharacter = (slotIndex: number): CharacterConfig => ({
  id: `${EMPTY_SLOT_ID_PREFIX}${slotIndex + 1}`,
  name: '未設定',
  element: 'physical',
  weaponType: 'sword',
  avatarUrl: '',
  color: '#475569',
  accentColor: '#94a3b8',
  energyRecharge: 100,
  availableActions: [],
});

export const ELEMENT_NAMES_JA: Record<ElementType, string> = {
  pyro: '炎元素',
  hydro: '水元素',
  electro: '雷元素',
  dendro: '草元素',
  cryo: '氷元素',
  anemo: '風元素',
  geo: '岩元素',
  physical: '物理',
};

export const WEAPON_TYPE_NAMES_JA: Record<WeaponType, string> = {
  sword: '片手剣',
  claymore: '両手剣',
  polearm: '長柄武器',
  bow: '弓',
  catalyst: '法器',
};

const RAW_CURATED_ROSTER: CharacterConfig[] = [
  {
    id: 'raiden',
    name: '雷電将軍',
    element: 'electro',
    weaponType: 'polearm',
    avatarUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80',
    color: '#a855f7',
    accentColor: '#c084fc',
    energyRecharge: 250,
    weaponName: '草薙の稲光',
    artifactSetName: '絶縁の旗印 4セット',
    constellation: 0,
    availableActions: [
      { id: 'raiden_e', name: '元素スキル: 神悪憑き・雷罰悪曜の眼', shortName: 'E', type: 'skill', defaultDuration: 0.9, startsSkillCooldown: true, description: '雷罰悪曜の眼を展開。味方の爆発ダメUP & 追撃' },
      { id: 'raiden_q', name: '元素爆発: 奥義・夢想の一心', shortName: 'Q', type: 'burst', defaultDuration: 1.8, startsBurstCooldown: true, description: '無想の一太刀を発動し夢想の一心状態に入る(7秒)' },
      { id: 'raiden_combo', name: '爆発中コンボ: 3N3C + N1C', shortName: '3N3C+N1C', type: 'combo', defaultDuration: 6.8, description: '夢想の一心中の最高DPSコンボ。味方全員に粒子/エネルギーを大量供給' },
      { id: 'raiden_n1', name: '通常攻撃 1段目', shortName: 'N', buttonLabel: 'N(1段目)', type: 'normal', defaultDuration: 0.3 },
      { id: 'raiden_ca', name: '重撃', shortName: 'C', type: 'charged', defaultDuration: 0.9 },
      { id: 'raiden_dash', name: 'ダッシュキャンセル', shortName: 'D', type: 'dash', defaultDuration: 0.2 },
    ]
  },
  {
    id: 'bennett',
    name: 'ベネット',
    element: 'pyro',
    weaponType: 'sword',
    avatarUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
    color: '#ef4444',
    accentColor: '#f87171',
    energyRecharge: 220,
    weaponName: '天空の刃 / 原木刀',
    artifactSetName: '旧貴族のしつけ 4セット',
    constellation: 5,
    availableActions: [
      { id: 'bennett_e', name: '元素スキル: 情熱過剰久遠 (一押し)', shortName: 'E', type: 'skill', defaultDuration: 0.8, startsSkillCooldown: true, description: '炎粒子を2〜3個生成 (CT:4.0s)' },
      { id: 'bennett_q', name: '元素爆発: 美冒険の輝き', shortName: 'Q', type: 'burst', defaultDuration: 1.3, startsBurstCooldown: true, description: '鼓舞エリア生成(12s): 自身の基礎攻撃力参照の特大攻撃力加算+高頻度回復' },
      { id: 'bennett_e_burst', name: '元素スキル (爆発エリア内CT短縮)', shortName: 'E (短縮)', type: 'skill', defaultDuration: 0.8, startsSkillCooldown: true, cooldown: 2, description: '鼓舞エリア内ではCTが2秒に半減' },
      { id: 'bennett_n1', name: '通常攻撃 1段目', shortName: 'N', buttonLabel: 'N(1段目)', type: 'normal', defaultDuration: 0.3 },
      { id: 'bennett_dash', name: 'ダッシュ', shortName: 'D', type: 'dash', defaultDuration: 0.2 },
    ]
  },
  {
    id: 'xiangling',
    name: '香菱',
    element: 'pyro',
    weaponType: 'polearm',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    color: '#f97316',
    accentColor: '#fb923c',
    energyRecharge: 210,
    weaponName: '漁獲 / 草薙の稲光',
    artifactSetName: '絶縁の旗印 4セット',
    constellation: 4,
    availableActions: [
      { id: 'xiangling_q', name: '元素爆発: 旋火輪 (4凸14秒)', shortName: 'Q', type: 'burst', defaultDuration: 1.3, startsBurstCooldown: true, description: '超強力な持続炎追撃。発動時の攻撃力・ダメバフをスナップショット(14s)' },
      { id: 'xiangling_e', name: '元素スキル: グゥオパァー出撃', shortName: 'E', type: 'skill', defaultDuration: 0.9, startsSkillCooldown: true, description: 'グゥオパァー召喚(7.5s)。炎ブレス4回、唐辛子で攻撃+10%(10s)' },
      { id: 'xiangling_n1', name: '通常攻撃 1段目', shortName: 'N', buttonLabel: 'N(1段目)', type: 'normal', defaultDuration: 0.25 },
      { id: 'xiangling_dash', name: 'ダッシュ', shortName: 'D', type: 'dash', defaultDuration: 0.2 },
    ]
  },
  {
    id: 'xingqiu',
    name: '行秋',
    element: 'hydro',
    weaponType: 'sword',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    color: '#0284c7',
    accentColor: '#38bdf8',
    energyRecharge: 200,
    weaponName: '祭礼の剣',
    artifactSetName: '旧貴族 / 絶縁の旗印',
    constellation: 6,
    availableActions: [
      { id: 'xingqiu_q', name: '元素爆発: 古華剣・裁雨留虹', shortName: 'Q', type: 'burst', defaultDuration: 1.4, startsBurstCooldown: true, description: '剣雨による追撃(15〜18s)。高頻度水付着と中断耐性・被ダメ軽減' },
      { id: 'xingqiu_e', name: '元素スキル: 古華剣・画雨籠山', shortName: 'E', type: 'skill', defaultDuration: 1.1, startsSkillCooldown: true, description: '2連撃水ダメージ＋水粒子5個生成 (CT: 21.0s)' },
      { id: 'xingqiu_e2', name: '元素スキル (祭礼リセット2回目)', shortName: 'E (祭礼)', type: 'skill_reset', defaultDuration: 1, startsSkillCooldown: true, description: '祭礼の剣効果で即座にもう一度Eを撃ち合計水粒子10個を回収' },
      { id: 'xingqiu_n1', name: '通常攻撃 1段目 (雨すだれ誘発)', shortName: 'N', buttonLabel: 'N(1段目)', type: 'normal', defaultDuration: 0.25, description: '剣雨追撃を1回誘発' },
      { id: 'xingqiu_dash', name: 'ダッシュ', shortName: 'D', type: 'dash', defaultDuration: 0.2 },
    ]
  },
  {
    id: 'yelan',
    name: '夜蘭',
    element: 'hydro',
    weaponType: 'bow',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    color: '#0369a1',
    accentColor: '#38bdf8',
    energyRecharge: 200,
    weaponName: '西風猟弓 / 若水',
    artifactSetName: '絶縁の旗印 4セット',
    constellation: 0,
    availableActions: [
      { id: 'yelan_q', name: '元素爆発: 淵曜の玲瓏', shortName: 'Q', type: 'burst', defaultDuration: 1.4, startsBurstCooldown: true, description: '玄擲玲瓏展開(15s): 通常攻撃に連動して水追撃。時間経過で出場キャラの与ダメ最大+50%UP' },
      { id: 'yelan_e', name: '元素スキル: 幽奇の絡繰り針', shortName: 'E', type: 'skill', defaultDuration: 0.9, startsSkillCooldown: true, description: '疾走して敵を縛り水ダメージ＋水粒子4個生成 (CT: 10.0s)' },
      { id: 'yelan_n1', name: '通常攻撃 1段目', shortName: 'N', buttonLabel: 'N(1段目)', type: 'normal', defaultDuration: 0.25 },
      { id: 'yelan_breakthrough', name: '打破の矢 (重撃)', shortName: '打破', type: 'charged', defaultDuration: 0.6 },
    ]
  },
  {
    id: 'hutao',
    name: '胡桃',
    element: 'pyro',
    weaponType: 'polearm',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    color: '#dc2626',
    accentColor: '#f87171',
    energyRecharge: 110,
    weaponName: '護摩の杖',
    artifactSetName: '燃え盛る炎の魔女 4セット',
    constellation: 1,
    availableActions: [
      { id: 'hutao_e', name: '元素スキル: 蝶導来世', shortName: 'E', type: 'skill', defaultDuration: 0.6, startsSkillCooldown: true, description: '冥蝶の舞状態(9s)突入。HPを消費し攻撃力大幅上昇＋炎元素付与' },
      { id: 'hutao_n1c_jump', name: '重撃ループ: N1C + ジャンプキャンセル', shortName: 'N1CJ', type: 'combo', defaultDuration: 0.85, description: '無凸基本コンボ' },
      { id: 'hutao_n1c_dash', name: '重撃ループ: N1C + ダッシュキャンセル (1凸)', shortName: 'N1CD', type: 'combo', defaultDuration: 0.72, description: '1凸でスタミナ無消費の最高速蒸発コンボ' },
      { id: 'hutao_burst', name: '元素爆発: 安神秘法', shortName: 'Q', type: 'burst', defaultDuration: 1.7, startsBurstCooldown: true, description: '広範囲に強力な炎超大ダメージ＋自己回復' },
    ]
  },
  {
    id: 'zhongli',
    name: '鍾離',
    element: 'geo',
    weaponType: 'polearm',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    color: '#d97706',
    accentColor: '#fbbf24',
    energyRecharge: 130,
    weaponName: '西風長槍 / 黒纓槍',
    artifactSetName: '千岩牢固 4セット',
    constellation: 0,
    availableActions: [
      { id: 'zhongli_hold_e', name: '元素スキル: 長押し (玉璋シールド)', shortName: '長押しE', type: 'skill_hold', defaultDuration: 1.5, startsSkillCooldown: true, description: '全元素・物理20%耐性ダウン付き最強シールド(20s) (CT: 12.0s)' },
      { id: 'zhongli_q', name: '元素爆発: 天星', shortName: 'Q', type: 'burst', defaultDuration: 2.1, startsBurstCooldown: true, description: '巨大隕石落下で石化(3.5s〜4s)付与 (CT: 12.0s)' },
    ]
  },
  {
    id: 'kazuha',
    name: '楓原万葉',
    element: 'anemo',
    weaponType: 'sword',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    color: '#0d9488',
    accentColor: '#2dd4bf',
    energyRecharge: 160,
    weaponName: '蒼古なる自由への誓い / 西風剣 / 鉄蜂の刺し',
    artifactSetName: '翠緑の影 4セット',
    constellation: 0,
    availableActions: [
      { id: 'kazuha_hold_e_plunge', name: '長押しスキル＋乱れ嵐斬 (落下)', shortName: '長E+PA', type: 'skill_hold', defaultDuration: 1.9, startsSkillCooldown: true, cooldown: 9, description: '広範囲集敵＋拡散による元素ダメバフ(8s)＋翠緑耐性-40%(10s)' },
      { id: 'kazuha_tap_e_plunge', name: '一押しスキル＋乱れ嵐斬 (落下)', shortName: '短E+PA', type: 'skill', defaultDuration: 1.4, startsSkillCooldown: true, cooldown: 6, description: '素早い集敵＋拡散バフ・デバフ付与' },
      { id: 'kazuha_q', name: '元素爆発: 万葉の一刀', shortName: 'Q', type: 'burst', defaultDuration: 1.6, startsBurstCooldown: true, description: '流風秋野を展開(8s)。定期的に拡散を起こし継続バフ更新' },
    ]
  },
  {
    id: 'childe',
    name: 'タルタリヤ',
    element: 'hydro',
    weaponType: 'bow',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    color: '#0284c7',
    accentColor: '#38bdf8',
    energyRecharge: 120,
    weaponName: '冬の極 / 飛雷の鳴弦',
    artifactSetName: '沈淪 / 水仙 4セット',
    constellation: 0,
    availableActions: [
      { id: 'childe_ranged_q', name: '元素爆発 (弓モード・魔弾一閃)', shortName: '弓Q', type: 'burst', defaultDuration: 1.3, startsBurstCooldown: true, description: '発動時エネルギーが20還元されるため実質40コストで高火力蒸発' },
      { id: 'childe_e_entry', name: '近接モード切替 (E起動)', shortName: 'E切替', type: 'skill', defaultDuration: 0.3, description: '近接モードへシフト' },
      { id: 'childe_n2cd', name: '近接攻撃: N2C + ダッシュ', shortName: 'N2C+D', type: 'combo', defaultDuration: 0.9, description: '高速水付着で香菱の旋火輪に全蒸発を起こさせる' },
      { id: 'childe_melee_burst', name: '元素爆発 (近接・尽滅閃)', shortName: '近Q', type: 'burst', defaultDuration: 1.8, startsBurstCooldown: true, description: '近接超特大倍率水ダメージ' },
      { id: 'childe_e_exit', name: '近接解除 (CT開始)', shortName: 'E解除', type: 'skill', defaultDuration: 0.2, startsSkillCooldown: true, description: '使用時間+6秒のCTが発生' },
    ]
  },
  {
    id: 'furina',
    name: 'フリーナ',
    element: 'hydro',
    weaponType: 'sword',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    color: '#0284c7',
    accentColor: '#67e8f9',
    energyRecharge: 180,
    weaponName: '静水流転の輝き / 腐植の剣 / 西風剣',
    artifactSetName: '黄金の劇団 4セット',
    constellation: 0,
    availableActions: [
      { id: 'furina_e', name: '元素スキル: サロン・ソリティア', shortName: 'E', type: 'skill', defaultDuration: 0.9, startsSkillCooldown: true, description: 'サロンメンバー召喚(30s)。自動攻撃と味方HP消費 (CT: 20.0s)' },
      { id: 'furina_q', name: '元素爆発: 万民の歓呼', shortName: 'Q', type: 'burst', defaultDuration: 1.3, startsBurstCooldown: true, description: 'もろびとこぞりて(18s)。テンション蓄積に応じて味方全員に最大+75%の全ダメバフ' },
      { id: 'furina_n1', name: '通常攻撃 1段目', shortName: 'N', buttonLabel: 'N(1段目)', type: 'normal', defaultDuration: 0.3 },
    ]
  },
  {
    id: 'neuvillette',
    name: 'ヌヴィレット',
    element: 'hydro',
    weaponType: 'catalyst',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    color: '#0369a1',
    accentColor: '#38bdf8',
    energyRecharge: 120,
    weaponName: '久遠流転の大典 / 金珀・試作',
    artifactSetName: 'ファントムハンター 4セット',
    constellation: 1,
    availableActions: [
      { id: 'neuv_q', name: '元素爆発: 潮よ、我が帰還を祝え', shortName: 'Q', type: 'burst', defaultDuration: 1.9, startsBurstCooldown: true, description: '大ダメージ＋源水の雫6個生成' },
      { id: 'neuv_e', name: '元素スキル: 涙よ、我が清算を濯げ', shortName: 'E', type: 'skill', defaultDuration: 0.8, startsSkillCooldown: true, description: '水ダメ＋源水の雫3個生成 (CT: 12.0s)' },
      { id: 'neuv_ca_beam', name: '重撃・衡平な裁断 (ハイドロポンプ)', shortName: '重撃ビーム', type: 'charged', defaultDuration: 3.2, description: '源水の雫を3個瞬時に吸収して放つ超強力3秒ビーム' },
    ]
  },
  {
    id: 'nahida',
    name: 'ナヒーダ',
    element: 'dendro',
    weaponType: 'catalyst',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    color: '#059669',
    accentColor: '#34d399',
    energyRecharge: 130,
    weaponName: '千夜に浮かぶ夢 / 祭礼の断片',
    artifactSetName: '深林の記憶 4セット',
    constellation: 2,
    availableActions: [
      { id: 'nahida_hold_e', name: '元素スキル: 所聞遍計 (長押しスキャン)', shortName: '長押しE', type: 'skill_hold', defaultDuration: 1.2, startsSkillCooldown: true, cooldown: 6, description: '敵8体に滅浄三業マーク付与(25s)。草元素反応に連動して追撃＋草耐性-30%' },
      { id: 'nahida_q', name: '元素爆発: 心景幻成 (摩耶の宮殿)', shortName: 'Q', type: 'burst', defaultDuration: 1.5, startsBurstCooldown: true, description: '摩耶の宮殿展開(15s): 出場キャラの元素熟知最大+250UP' },
      { id: 'nahida_n1', name: '通常攻撃 1段目', shortName: 'N', buttonLabel: 'N(1段目)', type: 'normal', defaultDuration: 0.3 },
    ]
  },
  {
    id: 'alhaitham',
    name: 'アルハイゼン',
    element: 'dendro',
    weaponType: 'sword',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    color: '#047857',
    accentColor: '#10b981',
    energyRecharge: 130,
    weaponName: '萃光の裁葉 / 黎明の神剣',
    artifactSetName: '金メッキの夢 4セット',
    constellation: 0,
    availableActions: [
      { id: 'alhaitham_q', name: '元素爆発: 殊境・顕象結縛', shortName: 'Q', type: 'burst', defaultDuration: 1.8, startsBurstCooldown: true, description: '琢光鏡0枚時発動で2秒後に鏡3枚獲得' },
      { id: 'alhaitham_hold_e_plunge', name: '空打ち長押しE＋落下攻撃', shortName: '空E+PA', type: 'skill_hold', defaultDuration: 1.2, startsSkillCooldown: true, description: '即座に琢光鏡2枚獲得' },
      { id: 'alhaitham_infusion_combo', name: '3鏡コンボ (通常攻撃+追撃)', shortName: '3鏡コンボ', type: 'combo', defaultDuration: 4, description: '琢光鏡3枚状態での高頻度草追撃' },
      { id: 'alhaitham_ca', name: '重撃 (琢光鏡+1枚更新)', shortName: 'C', type: 'charged', defaultDuration: 0.7, description: '固有天賦で琢光鏡を1枚追加' },
    ]
  },
  {
    id: 'shinobu',
    name: '久岐忍',
    element: 'electro',
    weaponType: 'sword',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    color: '#9333ea',
    accentColor: '#c084fc',
    energyRecharge: 110,
    weaponName: '東花坊時雨 / 鉄蜂の刺し',
    artifactSetName: '楽園の絶花 / 金メッキ',
    constellation: 2,
    availableActions: [
      { id: 'shinobu_e', name: '元素スキル: 越祓雷草の輪 (2凸15s)', shortName: 'E', type: 'skill', defaultDuration: 0.7, startsSkillCooldown: true, description: '草輪展開(15s): 1.5秒ごとに自傷と周囲回復＆雷範囲攻撃。超開花の最強起爆役' },
      { id: 'shinobu_q', name: '元素爆発: 御詠鳴神刈山祭', shortName: 'Q', type: 'burst', defaultDuration: 1.4, startsBurstCooldown: true, description: '雷範囲結界生成' },
    ]
  },
  {
    id: 'arlecchino',
    name: 'アルレッキーノ',
    element: 'pyro',
    weaponType: 'polearm',
    avatarUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80',
    color: '#ef4444',
    accentColor: '#f87171',
    energyRecharge: 110,
    weaponName: '赤月のシルエット / 和璞鳶',
    artifactSetName: '想いの始まる場所 4セット',
    constellation: 0,
    availableActions: [
      { id: 'arlecchino_e', name: '元素スキル: 万象の灰燼', shortName: 'E', type: 'skill', defaultDuration: 0.8, startsSkillCooldown: true, description: '突進して血償の勒を付与 (CT: 30.0s)' },
      { id: 'arlecchino_ca', name: '重撃 (血償回収・命の契約獲得)', shortName: 'CA回収', type: 'charged', defaultDuration: 0.9, description: '血償の勒を回収して命の契約を獲得・炎付与状態突入' },
      { id: 'arlecchino_combo', name: '通常攻撃 5段ループ (赤月の影)', shortName: '5Nコンボ', type: 'combo', defaultDuration: 2.2, description: '命の契約消費による超高火力炎通常攻撃' },
      { id: 'arlecchino_q', name: '元素爆発: 昇りゆく厄月', shortName: 'Q', type: 'burst', defaultDuration: 1.6, startsBurstCooldown: true, description: '範囲炎ダメージ＋スキルCTリセット＋自己回復' },
    ]
  },
  {
    id: 'clorinde',
    name: 'クロリンデ',
    element: 'electro',
    weaponType: 'sword',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    color: '#a855f7',
    accentColor: '#c084fc',
    energyRecharge: 120,
    weaponName: '赦罪 / 霧切の回光',
    artifactSetName: '調和の奇想 4セット',
    constellation: 0,
    availableActions: [
      { id: 'clorinde_e', name: '元素スキル: 狩りの夜 (銃撃構え)', shortName: 'E突入', type: 'skill', defaultDuration: 0.5, startsSkillCooldown: true, description: '銃撃・突き連動モード突入 (7.5秒)' },
      { id: 'clorinde_combo', name: '銃撃・突きコンボ: 3N1E x4', shortName: '3N1E連射', type: 'combo', defaultDuration: 6.5, description: '命の契約100%超で突きの範囲火力最大化' },
      { id: 'clorinde_q', name: '元素爆発: 残光を刈り取る夜', shortName: 'Q', type: 'burst', defaultDuration: 1.5, startsBurstCooldown: true, description: '5連雷撃＋命の契約大量獲得' },
    ]
  },
  {
    id: 'navia',
    name: 'ナヴィア',
    element: 'geo',
    weaponType: 'claymore',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    color: '#f59e0b',
    accentColor: '#fbbf24',
    energyRecharge: 130,
    weaponName: '裁断 / 螭骨の剣',
    artifactSetName: '残響の森で囁く夜 4セット',
    constellation: 0,
    availableActions: [
      { id: 'navia_e', name: '元素スキル: セレモニアル・クリスタルショット', shortName: 'E射撃', type: 'skill', defaultDuration: 0.8, startsSkillCooldown: true, description: '結晶破片を消費して超絶散弾大ダメージ' },
      { id: 'navia_q', name: '元素爆発: 金のバラに捧げる祝砲', shortName: 'Q祝砲', type: 'burst', defaultDuration: 1.5, startsBurstCooldown: true, description: '砲撃陣展開(12s): 定期的に結晶破片自動充填' },
      { id: 'navia_n3', name: '通常攻撃 3段 (岩付与)', shortName: 'N3', type: 'normal', defaultDuration: 1.4, description: 'スキル発動後の岩元素付与通常撃' },
    ]
  },
  {
    id: 'xianyun',
    name: '閑雲',
    element: 'anemo',
    weaponType: 'catalyst',
    avatarUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
    color: '#14b8a6',
    accentColor: '#2dd4bf',
    energyRecharge: 160,
    weaponName: '鶴鳴の余韻 / 誓いの明瞳',
    artifactSetName: '翠緑の影 4セット / 昔日',
    constellation: 0,
    availableActions: [
      { id: 'xianyun_e_plunge', name: '元素スキル: 朝鶴の舞 (3段跳躍＋波浪)', shortName: 'EEE+PA', type: 'skill', defaultDuration: 1.5, startsSkillCooldown: true, description: '広範囲風ダメージ＋翠緑拡散' },
      { id: 'xianyun_q', name: '元素爆発: 夕鶴の導き', shortName: 'Q', type: 'burst', defaultDuration: 1.4, startsBurstCooldown: true, description: '竹星召喚: 全体回復＋ジャンプ力大幅UP(落下攻撃補助8回)' },
    ]
  },
  {
    id: 'fischl',
    name: 'フィッシュル',
    element: 'electro',
    weaponType: 'bow',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    color: '#a855f7',
    accentColor: '#c084fc',
    energyRecharge: 120,
    weaponName: '絶弦 / 幽夜のワルツ',
    artifactSetName: '黄金の劇団 4セット',
    constellation: 6,
    availableActions: [
      { id: 'fischl_e', name: '元素スキル: 夜巡の翼 (オズ召喚)', shortName: 'Eオズ', type: 'skill', defaultDuration: 0.7, startsSkillCooldown: true, description: 'オズ召喚(10s〜12s): 高頻度控え雷追撃＋固有天賦雷落' },
      { id: 'fischl_q', name: '元素爆発: 漆黒の翼 (オズ更新)', shortName: 'Qオズ', type: 'burst', defaultDuration: 1, startsBurstCooldown: true, description: 'オズの滞留時間を更新・再配置' },
    ]
  },
  {
    id: 'sucrose',
    name: 'スクロース',
    element: 'anemo',
    weaponType: 'catalyst',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    color: '#14b8a6',
    accentColor: '#2dd4bf',
    energyRecharge: 160,
    weaponName: '祭礼の断片',
    artifactSetName: '翠緑の影 4セット',
    constellation: 6,
    availableActions: [
      { id: 'sucrose_e', name: '元素スキル: 風霊作成・陸参〇八', shortName: 'E', type: 'skill', defaultDuration: 0.9, startsSkillCooldown: true, description: '集敵風ダメージ＋味方に元素熟知バフ＋翠緑耐性ダウン' },
      { id: 'sucrose_q', name: '元素爆発: 禁術・風霊作成・伍〇八', shortName: 'Q', type: 'burst', defaultDuration: 1.5, startsBurstCooldown: true, description: '巨大風霊召喚(6s): 継続集敵＆元素変化ダメバフ' },
    ]
  },
  {
    id: 'ganyu',
    name: '甘雨',
    element: 'cryo',
    weaponType: 'bow',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    color: '#06b6d4',
    accentColor: '#67e8f9',
    energyRecharge: 120,
    weaponName: 'アモスの弓 / 大人の選択',
    artifactSetName: '氷風を彷徨う勇士 / 楽団 4セット',
    constellation: 0,
    availableActions: [
      { id: 'ganyu_ca', name: '二段チャージ重撃 (霜華の矢)', shortName: '霜華の矢', type: 'charged', defaultDuration: 1.8, description: '超強力氷範囲二段ダメージ' },
      { id: 'ganyu_q', name: '元素爆発: 降魔の氷蓮', shortName: 'Q', type: 'burst', defaultDuration: 1.5, startsBurstCooldown: true, description: '降魔の氷蓮展開(15s): 氷柱継続落下＋氷ダメバフ+20%' },
      { id: 'ganyu_e', name: '元素スキル: 麒麟の道', shortName: 'E', type: 'skill', defaultDuration: 0.7, startsSkillCooldown: true, description: '後方後退＋デコイ氷蓮設置' },
    ]
  },
  {
    id: 'ayaka',
    name: '神里綾華',
    element: 'cryo',
    weaponType: 'sword',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    color: '#06b6d4',
    accentColor: '#67e8f9',
    energyRecharge: 140,
    weaponName: '霧切の回光 / 天目影打',
    artifactSetName: '氷風を彷徨う勇士 4セット',
    constellation: 0,
    availableActions: [
      { id: 'ayaka_dash', name: '特殊ダッシュ: 神里流・霰歩', shortName: '霰歩', type: 'dash', defaultDuration: 0.4, description: '水上移動可能＋自己氷エンチャント＋氷ダメバフ+18%' },
      { id: 'ayaka_q', name: '元素爆発: 神里流・霜滅', shortName: 'Q', type: 'burst', defaultDuration: 1.8, startsBurstCooldown: true, description: '前進する猛烈な氷竜巻(5s20ヒット)超高火力' },
      { id: 'ayaka_e', name: '元素スキル: 神里流・氷華', shortName: 'E', type: 'skill', defaultDuration: 0.8, startsSkillCooldown: true, description: '周囲氷咲き出し＋通常重撃バフ' },
      { id: 'ayaka_n3c', name: '通常重撃: N3C', shortName: 'N3C', type: 'combo', defaultDuration: 1.2, description: '多段次元斬り重撃' },
    ]
  },
  {
    id: 'mualani',
    name: 'ムアラニ',
    element: 'hydro',
    weaponType: 'catalyst',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    color: '#0284c7',
    accentColor: '#38bdf8',
    energyRecharge: 110,
    weaponName: 'サーフィンサメ / 僕の宝物',
    artifactSetName: '黒曜の秘典 4セット',
    constellation: 0,
    availableActions: [
      { id: 'mualani_e', name: '元素スキル: サメサメスライディング', shortName: 'E波乗り', type: 'skill', defaultDuration: 1, startsSkillCooldown: true, description: '夜魂の加護・サメボード突入' },
      { id: 'mualani_bite', name: 'サメサメバイト (3層累積時超火力蒸発)', shortName: 'サメバイト', type: 'charged', defaultDuration: 0.8, description: '標的3層蓄積時の超絶一撃水ダメージ' },
      { id: 'mualani_q', name: '元素爆発: 爆裂サメミサイル', shortName: 'Q', type: 'burst', defaultDuration: 1.5, startsBurstCooldown: true, description: '巨大サメミサイル投射' },
    ]
  },
  {
    id: 'kinich',
    name: 'キニチ',
    element: 'dendro',
    weaponType: 'claymore',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    color: '#059669',
    accentColor: '#34d399',
    energyRecharge: 120,
    weaponName: '山の王の長牙 / 狼の末路',
    artifactSetName: '黒曜の秘典 4セット',
    constellation: 0,
    availableActions: [
      { id: 'kinich_e', name: '元素スキル: 鉤縄射出・旋回走行', shortName: 'E鉤縄', type: 'skill', defaultDuration: 0.9, startsSkillCooldown: true, description: '敵に鉤縄を引っ掛けて高速周囲周回' },
      { id: 'kinich_cannon', name: '廻影の大砲 (夜魂値100時)', shortName: '大砲射撃', type: 'charged', defaultDuration: 0.6, description: '夜魂値フル充填時の超極大草元素大砲' },
      { id: 'kinich_q', name: '元素爆発: 聖竜アハウ召喚', shortName: 'Q', type: 'burst', defaultDuration: 1.6, startsBurstCooldown: true, description: 'アハウ降臨ブレス継続射出' },
    ]
  },
  {
    id: 'xilonen',
    name: 'シロネン',
    element: 'geo',
    weaponType: 'sword',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    color: '#f59e0b',
    accentColor: '#fbbf24',
    energyRecharge: 130,
    weaponName: '岩峰を巡る歌 / 西風剣',
    artifactSetName: '灰燼の城に立つ英雄の絵巻 4セット',
    constellation: 0,
    availableActions: [
      { id: 'xilonen_e', name: '元素スキル: ローラースケートステップ', shortName: 'E滑走', type: 'skill', defaultDuration: 0.8, startsSkillCooldown: true, description: 'サンプル音源切り替え・属性デバフ-36%' },
      { id: 'xilonen_q', name: '元素爆発: DJミキサーDJビート', shortName: 'Q', type: 'burst', defaultDuration: 1.4, startsBurstCooldown: true, description: '全体回復＋岩・元素ダメージ' },
    ]
  },
];

/** 手作業定義のIDとマスター (genshin-db 英語名由来) のIDが異なるもの */
/** 手作業定義（プリセット用）の旧キーのうち、英語名から作った旧キーと異なるもの → 英語名由来の旧キー */
const CURATED_LEGACY_ALIASES: Record<string, string> = {
  raiden: 'raidenshogun',
  kazuha: 'kaedeharakazuha',
  childe: 'tartaglia',
  shinobu: 'kukishinobu',
  ayaka: 'kamisatoayaka',
};

/** genshin-db + gcsim から生成したキャラクターマスター (npm run build:master で再生成) */
export const MASTER_CHARACTERS = masterDataJson as CharacterConfig[];

/** 旧形式のキャラキー（英語名由来 "hutao" / "traveleranemo"、手作業定義の "raiden" など）→ 新形式（公式ID-元素） */
const LEGACY_CHARACTER_ID_MAP: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const c of MASTER_CHARACTERS) {
    if (!c.englishName) continue;
    const slug = legacyCharacterSlug(c.englishName);
    map.set(slug, c.id);
    // 旧生成器は英語名が重複したとき公式IDを末尾に付けていた
    if (c.source?.genshinId) map.set(`${slug}${c.source.genshinId}`, c.id);
  }
  for (const [curatedId, slug] of Object.entries(CURATED_LEGACY_ALIASES)) {
    const key = map.get(slug);
    if (key) map.set(curatedId, key);
  }
  return map;
})();

/**
 * 保存データなどに残っている旧形式のキャラキーを、新形式（公式ID-元素）に置き換える。
 * 新形式・カスタムキャラ・未設定スロット・対応が見つからないキーはそのまま返す
 */
export function resolveLegacyCharacterId(id: string): string {
  if (isOfficialCharacterKey(id) || id.startsWith('custom_') || id.startsWith(EMPTY_SLOT_ID_PREFIX)) return id;
  return LEGACY_CHARACTER_ID_MAP.get(id) ?? id;
}

/**
 * 手作業定義のアクションで CT・効果継続時間が未指定のものは、
 * マスターの同種アクション (E / 長押しE / Q) の値を引き継ぐ。
 */
function inheritTimings(action: ActionDefinition, master?: CharacterConfig): ActionDefinition {
  if (!master || !(action.startsSkillCooldown || action.startsBurstCooldown)) return action;
  const find = (suffix: string) => master.availableActions.find(a => a.id === `${master.id}_${suffix}`);
  const source = action.type === 'burst'
    ? find('q')
    : action.type === 'skill_hold' ? (find('e_hold') ?? find('e')) : find('e');
  if (!source) return action;
  return {
    ...action,
    cooldown: action.cooldown ?? source.cooldown,
    effectDuration: action.effectDuration ?? source.effectDuration,
  };
}

export const ALL_CHARACTERS_ROSTER: CharacterConfig[] = (() => {
  const map = new Map<string, CharacterConfig>(MASTER_CHARACTERS.map(c => [c.id, c]));

  // 手作業定義 (コンボ・バフ連動・装備メモ) をマスターに重ねる
  for (const curated of RAW_CURATED_ROSTER) {
    const id = resolveLegacyCharacterId(curated.id);
    const master = map.get(id);
    map.set(id, {
      ...master,
      ...curated,
      id,
      avatarUrl: master?.avatarUrl || curated.avatarUrl,
      source: master?.source,
      availableActions: curated.availableActions.map(a => inheritTimings(a, master)),
    });
  }

  return Array.from(map.values());
})();
