import { CharacterConfig, ElementType, WeaponType, ActionDefinition } from '../types/genshin';
import { ELEMENT_COLORS, ALL_CHARACTERS_ROSTER } from '../data/characters';
import genshinDb from 'genshin-db';

export interface SyncProgress {
  status: 'idle' | 'fetching' | 'success' | 'error';
  message: string;
  count: number;
}

/**
 * Maps element strings to valid ElementType
 */
function normalizeElement(elemStr?: string): ElementType {
  if (!elemStr) return 'pyro';
  const lower = elemStr.toLowerCase();
  if (lower.includes('pyro') || lower.includes('炎')) return 'pyro';
  if (lower.includes('hydro') || lower.includes('水')) return 'hydro';
  if (lower.includes('electro') || lower.includes('雷')) return 'electro';
  if (lower.includes('dendro') || lower.includes('草')) return 'dendro';
  if (lower.includes('cryo') || lower.includes('氷')) return 'cryo';
  if (lower.includes('anemo') || lower.includes('風')) return 'anemo';
  if (lower.includes('geo') || lower.includes('岩')) return 'geo';
  return 'physical';
}

/**
 * Maps weapon strings to valid WeaponType
 */
function normalizeWeapon(wStr?: string): WeaponType {
  if (!wStr) return 'sword';
  const lower = wStr.toLowerCase();
  if (lower.includes('sword') || lower.includes('片手剣')) return 'sword';
  if (lower.includes('claymore') || lower.includes('両手剣')) return 'claymore';
  if (lower.includes('polearm') || lower.includes('長柄') || lower.includes('槍')) return 'polearm';
  if (lower.includes('bow') || lower.includes('弓')) return 'bow';
  if (lower.includes('catalyst') || lower.includes('法器')) return 'catalyst';
  return 'sword';
}

/**
 * Character Name translation dictionary (English to Japanese)
 */
const EN_TO_JA_CHAR_NAMES: Record<string, string> = {
  'raiden': '雷電将軍',
  'bennett': 'ベネット',
  'xiangling': '香菱',
  'xingqiu': '行秋',
  'yelan': '夜蘭',
  'hutao': '胡桃',
  'zhongli': '鍾離',
  'kazuha': '楓原万葉',
  'childe': 'タルタリヤ',
  'tartaglia': 'タルタリヤ',
  'furina': 'フリーナ',
  'neuvillette': 'ヌヴィレット',
  'nahida': 'ナヒーダ',
  'alhaitham': 'アルハイゼン',
  'shinobu': '久岐忍',
  'kuki-shinobu': '久岐忍',
  'arlecchino': 'アルレッキーノ',
  'clorinde': 'クロリンデ',
  'navia': 'ナヴィア',
  'xianyun': '留雲 (閑雲)',
  'chiori': '千織',
  'lyney': 'リネ',
  'wriothesley': 'リオセスリ',
  'mualani': 'ムアラニ',
  'kinich': 'キニチ',
  'xilonen': 'シロネン',
  'emilie': 'エミリエ',
  'albedo': 'アルベド',
  'aloy': 'アーロイ',
  'amber': 'アンバー',
  'arataki-itto': '荒瀧一斗',
  'itto': '荒瀧一斗',
  'baizhu': '白朮',
  'beidou': '北斗',
  'candace': 'キャンディス',
  'charlotte': 'シャルロット',
  'chevreuse': 'シュヴルーズ',
  'chongyun': '重雲',
  'cyno': 'セノ',
  'collei': 'コレレイ',
  'diluc': 'ディルック',
  'diona': 'ディオナ',
  'dori': 'ドリー',
  'eula': 'エウルア',
  'faruzan': 'ファルザン',
  'fischl': 'フィッシュル',
  'ganyu': '甘雨',
  'gorou': 'ゴロー',
  'jean': 'ジン',
  'kachina': 'カチーナ',
  'kaeya': 'ガイア',
  'kaveh': 'カーヴェ',
  'keqing': '刻晴',
  'kirara': '綺良々',
  'klee': 'クレー',
  'kujou-sara': '九条裟羅',
  'sara': '九条裟羅',
  'layla': 'レイラ',
  'lisa': 'リサ',
  'lumi': 'ルミ',
  'lynette': 'リネット',
  'mika': 'ミカ',
  'mona': 'モナ',
  'ningguang': '凝光',
  'noelle': 'ノエル',
  'qiqi': '七七',
  'razor': 'レザー',
  'rosaria': 'ロサリア',
  'sangonomiya-kokomi': '珊瑚宮心海',
  'kokomi': '珊瑚宮心海',
  'sayu': '早柚',
  'sethos': 'セトス',
  'shenhe': '申鶴',
  'shikanoin-heizou': '鹿野院平蔵',
  'heizou': '鹿野院平蔵',
  'sucrose': 'スクロース',
  'thoma': 'トーマ',
  'tighnari': 'ティナリ',
  'venti': 'ウェンティ',
  'wanderer': '放浪者',
  'xiao': '魈',
  'yae-miko': '八重神子',
  'yae': '八重神子',
  'yanfei': '煙緋',
  'yaoyao': 'ヨォーヨ',
  'yoimiya': '宵宮',
  'yun-jin': '雲菫',
  'yunjin': '雲菫',
  'columbina': 'コロンビーナ (少女)',
  'sandrone': 'サンドローネ (傀儡)',
  'mavuika': 'マヴィカ (炎神)',
  'citlali': 'シトラリ',
  'capitano': 'キャピターノ (隊長)',
  'chasca': 'チャスカ',
  'ororon': 'オロルン',
  'iansan': 'イアンサ',
  'dottore': 'ドットーレ (博士)',
  'pantalone': 'パンタローネ (富者)',
  'pierro': 'ピエロ (道化)',
  'pulcinella': 'プルチネッラ (鶏雛)'
};

export interface OnlineSyncOptions {
  useOnlineApi?: boolean;
  useWiki?: boolean;
}

interface CharacterSpec {
  element: ElementType;
  weaponType: WeaponType;
  skillCooldown: number;
  burstCooldown: number;
  burstEnergyCost: number;
  skillParticles?: number;
}

const KNOWN_CHAR_SPECS: Record<string, CharacterSpec> = {
  'albedo': { element: 'geo', weaponType: 'sword', skillCooldown: 4.0, burstCooldown: 12.0, burstEnergyCost: 40 },
  'alhaitham': { element: 'dendro', weaponType: 'sword', skillCooldown: 18.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'aloy': { element: 'cryo', weaponType: 'bow', skillCooldown: 20.0, burstCooldown: 12.0, burstEnergyCost: 40 },
  'amber': { element: 'pyro', weaponType: 'bow', skillCooldown: 15.0, burstCooldown: 12.0, burstEnergyCost: 40 },
  'arataki-itto': { element: 'geo', weaponType: 'claymore', skillCooldown: 10.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'itto': { element: 'geo', weaponType: 'claymore', skillCooldown: 10.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'arlecchino': { element: 'pyro', weaponType: 'polearm', skillCooldown: 30.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'baizhu': { element: 'dendro', weaponType: 'catalyst', skillCooldown: 10.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'barbara': { element: 'hydro', weaponType: 'catalyst', skillCooldown: 32.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'beidou': { element: 'electro', weaponType: 'claymore', skillCooldown: 7.5, burstCooldown: 20.0, burstEnergyCost: 80 },
  'bennett': { element: 'pyro', weaponType: 'sword', skillCooldown: 4.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'candace': { element: 'hydro', weaponType: 'polearm', skillCooldown: 9.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'charlotte': { element: 'cryo', weaponType: 'catalyst', skillCooldown: 12.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'chasca': { element: 'anemo', weaponType: 'bow', skillCooldown: 6.5, burstCooldown: 15.0, burstEnergyCost: 60 },
  'chevreuse': { element: 'pyro', weaponType: 'polearm', skillCooldown: 15.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'chiori': { element: 'geo', weaponType: 'sword', skillCooldown: 16.0, burstCooldown: 13.5, burstEnergyCost: 50 },
  'chongyun': { element: 'cryo', weaponType: 'claymore', skillCooldown: 15.0, burstCooldown: 12.0, burstEnergyCost: 40 },
  'citlali': { element: 'cryo', weaponType: 'catalyst', skillCooldown: 12.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'clorinde': { element: 'electro', weaponType: 'sword', skillCooldown: 16.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'collei': { element: 'dendro', weaponType: 'bow', skillCooldown: 12.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'cyno': { element: 'electro', weaponType: 'polearm', skillCooldown: 7.5, burstCooldown: 20.0, burstEnergyCost: 80 },
  'diluc': { element: 'pyro', weaponType: 'claymore', skillCooldown: 10.0, burstCooldown: 12.0, burstEnergyCost: 40 },
  'diona': { element: 'cryo', weaponType: 'bow', skillCooldown: 15.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'dori': { element: 'electro', weaponType: 'claymore', skillCooldown: 9.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'emilie': { element: 'dendro', weaponType: 'polearm', skillCooldown: 14.0, burstCooldown: 13.5, burstEnergyCost: 50 },
  'eula': { element: 'cryo', weaponType: 'claymore', skillCooldown: 4.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'faruzan': { element: 'anemo', weaponType: 'bow', skillCooldown: 6.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'fischl': { element: 'electro', weaponType: 'bow', skillCooldown: 25.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'furina': { element: 'hydro', weaponType: 'sword', skillCooldown: 20.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'ganyu': { element: 'cryo', weaponType: 'bow', skillCooldown: 10.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'gorou': { element: 'geo', weaponType: 'bow', skillCooldown: 10.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'hutao': { element: 'pyro', weaponType: 'polearm', skillCooldown: 16.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'hu-tao': { element: 'pyro', weaponType: 'polearm', skillCooldown: 16.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'iansan': { element: 'electro', weaponType: 'polearm', skillCooldown: 10.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'jean': { element: 'anemo', weaponType: 'sword', skillCooldown: 6.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'kachina': { element: 'geo', weaponType: 'polearm', skillCooldown: 12.0, burstCooldown: 20.0, burstEnergyCost: 50 },
  'kaeya': { element: 'cryo', weaponType: 'sword', skillCooldown: 6.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'kaveh': { element: 'dendro', weaponType: 'claymore', skillCooldown: 6.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'kazuha': { element: 'anemo', weaponType: 'sword', skillCooldown: 6.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'keqing': { element: 'electro', weaponType: 'sword', skillCooldown: 7.5, burstCooldown: 12.0, burstEnergyCost: 40 },
  'kinich': { element: 'dendro', weaponType: 'claymore', skillCooldown: 18.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'kirara': { element: 'dendro', weaponType: 'sword', skillCooldown: 8.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'klee': { element: 'pyro', weaponType: 'catalyst', skillCooldown: 20.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'kokomi': { element: 'hydro', weaponType: 'catalyst', skillCooldown: 20.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'sangonomiya-kokomi': { element: 'hydro', weaponType: 'catalyst', skillCooldown: 20.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'kujou-sara': { element: 'electro', weaponType: 'bow', skillCooldown: 10.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'sara': { element: 'electro', weaponType: 'bow', skillCooldown: 10.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'kuki-shinobu': { element: 'electro', weaponType: 'sword', skillCooldown: 15.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'shinobu': { element: 'electro', weaponType: 'sword', skillCooldown: 15.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'layla': { element: 'cryo', weaponType: 'sword', skillCooldown: 12.0, burstCooldown: 12.0, burstEnergyCost: 40 },
  'lisa': { element: 'electro', weaponType: 'catalyst', skillCooldown: 1.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'lyney': { element: 'pyro', weaponType: 'bow', skillCooldown: 15.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'lynette': { element: 'anemo', weaponType: 'sword', skillCooldown: 12.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'mavuika': { element: 'pyro', weaponType: 'claymore', skillCooldown: 12.0, burstCooldown: 18.0, burstEnergyCost: 80 },
  'mika': { element: 'cryo', weaponType: 'polearm', skillCooldown: 15.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'mona': { element: 'hydro', weaponType: 'catalyst', skillCooldown: 12.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'mualani': { element: 'hydro', weaponType: 'catalyst', skillCooldown: 6.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'nahida': { element: 'dendro', weaponType: 'catalyst', skillCooldown: 5.0, burstCooldown: 13.5, burstEnergyCost: 50 },
  'navia': { element: 'geo', weaponType: 'claymore', skillCooldown: 9.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'neuvillette': { element: 'hydro', weaponType: 'catalyst', skillCooldown: 12.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'nilou': { element: 'hydro', weaponType: 'sword', skillCooldown: 18.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'ningguang': { element: 'geo', weaponType: 'catalyst', skillCooldown: 12.0, burstCooldown: 12.0, burstEnergyCost: 40 },
  'noelle': { element: 'geo', weaponType: 'claymore', skillCooldown: 24.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'ororon': { element: 'electro', weaponType: 'bow', skillCooldown: 15.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'qiqi': { element: 'cryo', weaponType: 'sword', skillCooldown: 30.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'raiden': { element: 'electro', weaponType: 'polearm', skillCooldown: 10.0, burstCooldown: 18.0, burstEnergyCost: 90 },
  'razor': { element: 'electro', weaponType: 'claymore', skillCooldown: 6.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'rosaria': { element: 'cryo', weaponType: 'polearm', skillCooldown: 6.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'sayu': { element: 'anemo', weaponType: 'claymore', skillCooldown: 6.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'sethos': { element: 'electro', weaponType: 'bow', skillCooldown: 8.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'shenhe': { element: 'cryo', weaponType: 'polearm', skillCooldown: 10.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'heizou': { element: 'anemo', weaponType: 'catalyst', skillCooldown: 10.0, burstCooldown: 12.0, burstEnergyCost: 40 },
  'shikanoin-heizou': { element: 'anemo', weaponType: 'catalyst', skillCooldown: 10.0, burstCooldown: 12.0, burstEnergyCost: 40 },
  'sucrose': { element: 'anemo', weaponType: 'catalyst', skillCooldown: 15.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'tartaglia': { element: 'hydro', weaponType: 'bow', skillCooldown: 18.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'childe': { element: 'hydro', weaponType: 'bow', skillCooldown: 18.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'thoma': { element: 'pyro', weaponType: 'polearm', skillCooldown: 15.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'tighnari': { element: 'dendro', weaponType: 'bow', skillCooldown: 12.0, burstCooldown: 12.0, burstEnergyCost: 40 },
  'venti': { element: 'anemo', weaponType: 'bow', skillCooldown: 6.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'wanderer': { element: 'anemo', weaponType: 'catalyst', skillCooldown: 6.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'scaramouche': { element: 'anemo', weaponType: 'catalyst', skillCooldown: 6.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'wriothesley': { element: 'cryo', weaponType: 'catalyst', skillCooldown: 16.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'xiangling': { element: 'pyro', weaponType: 'polearm', skillCooldown: 12.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'xianyun': { element: 'anemo', weaponType: 'catalyst', skillCooldown: 12.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'xiao': { element: 'anemo', weaponType: 'polearm', skillCooldown: 10.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'xilonen': { element: 'geo', weaponType: 'sword', skillCooldown: 7.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'xingqiu': { element: 'hydro', weaponType: 'sword', skillCooldown: 21.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'xinyan': { element: 'pyro', weaponType: 'claymore', skillCooldown: 18.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'yae-miko': { element: 'electro', weaponType: 'catalyst', skillCooldown: 4.0, burstCooldown: 22.0, burstEnergyCost: 90 },
  'yae': { element: 'electro', weaponType: 'catalyst', skillCooldown: 4.0, burstCooldown: 22.0, burstEnergyCost: 90 },
  'yanfei': { element: 'pyro', weaponType: 'catalyst', skillCooldown: 9.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'yaoyao': { element: 'dendro', weaponType: 'polearm', skillCooldown: 15.0, burstCooldown: 20.0, burstEnergyCost: 80 },
  'yelan': { element: 'hydro', weaponType: 'bow', skillCooldown: 10.0, burstCooldown: 18.0, burstEnergyCost: 70 },
  'yoimiya': { element: 'pyro', weaponType: 'bow', skillCooldown: 18.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'yun-jin': { element: 'geo', weaponType: 'polearm', skillCooldown: 9.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'yunjin': { element: 'geo', weaponType: 'polearm', skillCooldown: 9.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'zhongli': { element: 'geo', weaponType: 'polearm', skillCooldown: 12.0, burstCooldown: 12.0, burstEnergyCost: 40 },
  'aether': { element: 'anemo', weaponType: 'sword', skillCooldown: 6.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'lumine': { element: 'anemo', weaponType: 'sword', skillCooldown: 6.0, burstCooldown: 15.0, burstEnergyCost: 60 },
  'traveler': { element: 'anemo', weaponType: 'sword', skillCooldown: 6.0, burstCooldown: 15.0, burstEnergyCost: 60 },
};

/**
  * Crawls individual character pages from Genshin Impact Fandom Wiki via MediaWiki API
  * to extract exact element and weapon values from each character page's wikitext Infobox.
  */
export async function fetchFandomWikiCharacters(): Promise<CharacterConfig[]> {
  const wikiCharactersMap = new Map<string, CharacterConfig>();
  const pageTitlesSet = new Set<string>();

  // 1. Gather page titles from Cargo query
  try {
    const cargoUrl = 'https://genshin-impact.fandom.com/api.php?action=cargoquery&tables=characters&fields=_pageName=page,name,element,weapon,rarity&limit=500&format=json&origin=*';
    const res = await fetch(cargoUrl);
    if (res.ok) {
      const data = await res.json();
      const cargoRows = data?.cargoquery || [];
      for (const row of cargoRows) {
        if (row?.title?.name) {
          pageTitlesSet.add(row.title.name.trim());
        }
      }
    }
  } catch (err) {
    console.warn('Fandom Wiki Cargo API error:', err);
  }

  // 2. Gather page titles from Playable Characters Category
  try {
    const catUrl = 'https://genshin-impact.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:Playable_Characters&cmlimit=500&format=json&origin=*';
    const res = await fetch(catUrl);
    if (res.ok) {
      const data = await res.json();
      const members = data?.query?.categorymembers || [];
      for (const m of members) {
        if (m?.title) {
          const clean = m.title.trim().replace(/^Category:/i, '');
          if (clean && !clean.includes('/') && !clean.toLowerCase().includes('traveler')) {
            pageTitlesSet.add(clean);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Fandom Wiki Category Playable Characters API error:', err);
  }

  // 3. Gather page titles from Upcoming Characters Category
  try {
    const upcomingUrl = 'https://genshin-impact.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:Upcoming_Characters&cmlimit=500&format=json&origin=*';
    const res = await fetch(upcomingUrl);
    if (res.ok) {
      const data = await res.json();
      const members = data?.query?.categorymembers || [];
      for (const m of members) {
        if (m?.title) {
          const clean = m.title.trim().replace(/^Category:/i, '');
          if (clean && !clean.includes('/') && !clean.toLowerCase().includes('traveler')) {
            pageTitlesSet.add(clean);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Fandom Wiki Category Upcoming Characters API error:', err);
  }

  // 4. Crawl individual character pages (batching 30 titles per MediaWiki API request)
  const titlesArray = Array.from(pageTitlesSet);
  const crawledPageMap = new Map<string, { element?: string; weapon?: string }>();

  for (let i = 0; i < titlesArray.length; i += 30) {
    const batch = titlesArray.slice(i, i + 30);
    try {
      const queryUrl = `https://genshin-impact.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${batch.map(encodeURIComponent).join('|')}&format=json&origin=*`;
      const res = await fetch(queryUrl);
      if (res.ok) {
        const data = await res.json();
        const pages = data?.query?.pages || {};
        for (const pId in pages) {
          const page = pages[pId];
          const pageTitle = page?.title;
          const wikitext = page?.revisions?.[0]?.slots?.main?.['*'] || '';

          if (pageTitle && wikitext) {
            const elemMatch = wikitext.match(/\|element\s*=\s*([^\n\|\}]+)/i);
            const weaponMatch = wikitext.match(/\|weapon\s*=\s*([^\n\|\}]+)/i);

            crawledPageMap.set(pageTitle.toLowerCase(), {
              element: elemMatch?.[1]?.trim(),
              weapon: weaponMatch?.[1]?.trim(),
            });
          }
        }
      }
    } catch (err) {
      console.warn('MediaWiki page crawler batch error:', err);
    }
  }

  // 5. Construct CharacterConfig for each crawled character
  for (const rawName of titlesArray) {
    const cleanName = rawName.trim().replace(/^Category:/i, '');
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!slug || wikiCharactersMap.has(slug)) continue;

    const jaName = EN_TO_JA_CHAR_NAMES[slug] || EN_TO_JA_CHAR_NAMES[cleanName.toLowerCase()] || cleanName;

    // Check official roster match first
    const rosterMatch = ALL_CHARACTERS_ROSTER.find(c => 
      c.id === slug || 
      c.name.toLowerCase() === cleanName.toLowerCase() ||
      c.name === jaName
    );

    if (rosterMatch) {
      wikiCharactersMap.set(slug, {
        ...rosterMatch,
        id: slug,
        name: jaName || rosterMatch.name,
        avatarUrl: `https://genshin-impact.fandom.com/wiki/Special:Redirect/file/${encodeURIComponent(cleanName.replace(/\s+/g, '_'))}_Icon.png`
      });
      continue;
    }

    // Crawled infobox values from individual Wiki page
    const crawledInfo = crawledPageMap.get(cleanName.toLowerCase()) || crawledPageMap.get(rawName.toLowerCase());
    const specMatch = KNOWN_CHAR_SPECS[slug] || KNOWN_CHAR_SPECS[cleanName.toLowerCase()];

    const rawElem = crawledInfo?.element || (specMatch ? specMatch.element : undefined);
    const rawWeapon = crawledInfo?.weapon || (specMatch ? specMatch.weaponType : undefined);

    const elem = normalizeElement(rawElem);
    const wType = normalizeWeapon(rawWeapon);
    const skillCD = specMatch ? specMatch.skillCooldown : 10.0;
    const burstCD = specMatch ? specMatch.burstCooldown : 15.0;
    const burstCost = specMatch ? specMatch.burstEnergyCost : 60;

    const colorObj = ELEMENT_COLORS[elem] || ELEMENT_COLORS.physical;

    const actions = [
      {
        id: `${slug}_e`,
        name: '元素スキル',
        shortName: 'E',
        type: 'skill' as const,
        defaultDuration: wType === 'claymore' ? 1.1 : 0.8,
        startsSkillCooldown: true,
        description: `${jaName}の元素スキル`
      },
      {
        id: `${slug}_q`,
        name: '元素爆発',
        shortName: 'Q',
        type: 'burst' as const,
        defaultDuration: 1.5,
        startsBurstCooldown: true,
        energyCost: burstCost,
        description: `${jaName}の元素爆発`
      },
      {
        id: `${slug}_n1`,
        name: '通常攻撃 1段',
        shortName: 'N1',
        type: 'normal' as const,
        defaultDuration: 0.3,
        description: '通常攻撃'
      },
      {
        id: `${slug}_ca`,
        name: '重撃',
        shortName: 'CA',
        type: 'charged' as const,
        defaultDuration: 0.8,
        description: '重撃'
      }
    ];

    wikiCharactersMap.set(slug, {
      id: slug,
      name: jaName,
      element: elem,
      weaponType: wType,
      avatarUrl: `https://genshin-impact.fandom.com/wiki/Special:Redirect/file/${encodeURIComponent(cleanName.replace(/\s+/g, '_'))}_Icon.png`,
      color: colorObj.hex,
      accentColor: colorObj.hex,
      skillCooldown: skillCD,
      burstCooldown: burstCD,
      burstEnergyCost: burstCost,
      skillParticles: 3.5,
      energyRecharge: 100,
      availableActions: actions,
    });
  }

  return Array.from(wikiCharactersMap.values());
}

/**
 * Fetches character data online:
 * 1. Base character configs and talents are built from genshin-db (npm package)
 * 2. Action motion durations (frameData / defaultDuration) use the Web/gcsim parsed dataset
 * 3. https://genshin.jmp.blue is used STRICTLY for fetching icon image URLs (avatarUrl)
 */
export async function fetchOnlineGenshinData(
  options: OnlineSyncOptions = { useOnlineApi: true, useWiki: false }
): Promise<CharacterConfig[]> {
  const resultCharactersMap = new Map<string, CharacterConfig>();

  // 1. Build character profiles from ALL_CHARACTERS_ROSTER & genshin-db
  for (const masterChar of ALL_CHARACTERS_ROSTER) {
    let dbTalent: any = null;
    let dbChar: any = null;
    try {
      const gDb = genshinDb as any;
      dbTalent = gDb.talents(masterChar.id, { resultLanguage: 'Japanese' }) || gDb.talents(masterChar.name, { resultLanguage: 'Japanese' });
      dbChar = gDb.characters(masterChar.id, { resultLanguage: 'Japanese' }) || gDb.characters(masterChar.name, { resultLanguage: 'Japanese' });
    } catch {
      // Fallback to built-in if genshin-db query fails
    }

    const elem = dbChar?.elementText ? normalizeElement(dbChar.elementText) : masterChar.element;
    const wType = dbChar?.weaponText ? normalizeWeapon(dbChar.weaponText) : masterChar.weaponType;
    const colorObj = ELEMENT_COLORS[elem] || { hex: masterChar.color };

    let skillCD = masterChar.skillCooldown;
    let burstCD = masterChar.burstCooldown;
    let burstEnergy = masterChar.burstEnergyCost;
    let skillDur = masterChar.skillDuration || 0;
    let burstDur = masterChar.burstDuration || 0;

    if (dbTalent?.combat2?.attributes?.parameters) {
      const params = dbTalent.combat2.attributes.parameters;
      if (params.param7 && Array.isArray(params.param7) && params.param7[0]) skillCD = Number(params.param7[0]);
    }

    if (dbTalent?.combat3?.attributes?.parameters) {
      const params = dbTalent.combat3.attributes.parameters;
      if (params.param6 && Array.isArray(params.param6) && params.param6[0]) burstCD = Number(params.param6[0]);
      if (params.param7 && Array.isArray(params.param7) && params.param7[0]) burstEnergy = Number(params.param7[0]);
      if (params.param5 && Array.isArray(params.param5) && params.param5[0]) burstDur = Number(params.param5[0]);
    }

    // Preserve Web-crawled / gcsim motion frame durations for actions and inject action-specific CT/durations
    const actionsWithMotionData: ActionDefinition[] = masterChar.availableActions.map(act => {
      if (act.type === 'skill' || act.type === 'skill_hold') {
        return {
          ...act,
          skillCooldown: act.skillCooldown ?? (act.customSkillCT || skillCD),
          skillDuration: act.skillDuration ?? skillDur
        };
      }
      if (act.type === 'burst') {
        return {
          ...act,
          burstCooldown: act.burstCooldown ?? burstCD,
          burstDuration: act.burstDuration ?? burstDur,
          energyCost: act.energyCost ?? burstEnergy
        };
      }
      return act;
    });

    const charConfig: CharacterConfig = {
      ...masterChar,
      name: dbChar?.name || masterChar.name,
      element: elem,
      weaponType: wType,
      color: colorObj.hex,
      accentColor: colorObj.hex,
      skillCooldown: skillCD,
      skillDuration: skillDur,
      burstCooldown: burstCD,
      burstDuration: burstDur,
      burstEnergyCost: burstEnergy,
      avatarUrl: masterChar.avatarUrl || `https://genshin.jmp.blue/characters/${masterChar.id}/icon`,
      availableActions: actionsWithMotionData
    };

    resultCharactersMap.set(masterChar.id, charConfig);
  }

  // 2. Fetch icon images from https://genshin.jmp.blue STRICTLY for icon validation / avatar URL enrichment
  if (options.useOnlineApi) {
    try {
      const response = await fetch('https://genshin.jmp.blue/characters');
      if (response.ok) {
        const charNamesList = await response.json();
        if (Array.isArray(charNamesList)) {
          for (const nameSlug of charNamesList) {
            const charId = nameSlug.toLowerCase();
            const existing = resultCharactersMap.get(charId);
            if (existing) {
              // STRICTLY update icon URL only - no settings, stats, or actions overwrite!
              existing.avatarUrl = `https://genshin.jmp.blue/characters/${charId}/icon`;
            }
          }
        }
      }
    } catch (err) {
      console.warn('genshin.jmp.blue icon image fetch warning:', err);
    }
  }

  return Array.from(resultCharactersMap.values());
}
