/**
 * 武器・聖遺物マスターデータ動的生成器 (ブラウザ / Node 共通)
 *
 * データソース (すべてネットから最新を取得する):
 *   - genshin-db API (https://genshin-db-api.vercel.app/api/v5)
 *     全武器・全聖遺物の基本情報、パッシブテキスト、ステータス、ゲーム内画像名をオンライン取得
 *   - enka.network (https://enka.network/ui/<filename>.png)
 *     公式ゲーム内アイコン画像を解決
 *   - equipmentBuffParser (正規表現抽出 + 補正辞書)
 *     「効果継続時間」「CT」「要約」「カラー」を自動抽出・構造化
 */

import type { WeaponDatabaseItem, ArtifactSetDatabaseItem } from '../types/database';
import type { WeaponType } from '../types/genshin';
import { parseWeaponBuffs, parseArtifactBuffs } from './equipmentBuffParser.ts';

export const GENSHIN_DB_API = 'https://genshin-db-api.vercel.app/api/v5';
const ICON_BASE_URL = 'https://enka.network/ui';

export interface EquipmentGenerationProgress {
  phase: string;
  done: number;
  total: number;
}

export interface BuffExtractionEntry {
  sourceType: 'weapon' | 'artifact';
  sourceName: string;
  buffName: string;
  duration?: number;
  cooldown?: number;
  statSummary?: string;
}

export interface WeaponGenerationReport {
  generatedAt: string;
  totalWeapons: number;
  weaponsWithBuffs: number;
  extractedBuffsList: BuffExtractionEntry[];
  constantPassiveItems: Array<{ sourceType: 'weapon'; name: string }>;
  errors: string[];
  sourceApiUrl?: string;
  networkDurationMs?: number;
  fetchedRawCountJa?: number;
  fetchedRawCountEn?: number;
}

export interface ArtifactGenerationReport {
  generatedAt: string;
  totalArtifacts: number;
  artifactsWithBuffs: number;
  extractedBuffsList: BuffExtractionEntry[];
  constantPassiveItems: Array<{ sourceType: 'artifact'; name: string }>;
  errors: string[];
  sourceApiUrl?: string;
  networkDurationMs?: number;
  fetchedRawCountJa?: number;
  fetchedRawCountEn?: number;
}

export interface EquipmentGenerationReport {
  generatedAt: string;
  totalWeapons: number;
  weaponsWithBuffs: number;
  totalArtifacts: number;
  artifactsWithBuffs: number;
  extractedBuffsList: BuffExtractionEntry[];
  constantPassiveItems: Array<{
    sourceType: 'weapon' | 'artifact';
    name: string;
  }>;
  errors: string[];
  sourceApiUrl?: string;
  networkDurationMs?: number;
}

export interface EquipmentMasterResult {
  weapons: WeaponDatabaseItem[];
  artifacts: ArtifactSetDatabaseItem[];
  report: EquipmentGenerationReport;
}

// 武器種マッピング
const WEAPON_TYPE_MAP: Record<string, WeaponType> = {
  WEAPON_SWORD_ONE_HAND: 'sword',
  WEAPON_CLAYMORE: 'claymore',
  WEAPON_POLE: 'polearm',
  WEAPON_POLEARM: 'polearm',
  WEAPON_BOW: 'bow',
  WEAPON_CATALYST: 'catalyst',
  Sword: 'sword',
  Claymore: 'claymore',
  Polearm: 'polearm',
  Bow: 'bow',
  Catalyst: 'catalyst',
  片手剣: 'sword',
  両手剣: 'claymore',
  長柄武器: 'polearm',
  弓: 'bow',
  法器: 'catalyst',
};

// ---------------------------------------------------------------------------
// 取得ヘルパー
// ---------------------------------------------------------------------------

async function fetchWithRetry(url: string, init?: RequestInit, retries = 2): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
      if (res.status === 403 || res.status === 404) break;
    } catch (e) {
      lastError = e;
    }
    await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> =>
  (await fetchWithRetry(url, init)).json() as Promise<T>;

/**
 * 最新の武器データを genshin-db API からオンライン取得・解析して生成する
 */
export async function generateWeaponsMasterOnline(
  onProgress?: (progress: EquipmentGenerationProgress) => void,
): Promise<{ weapons: WeaponDatabaseItem[]; report: WeaponGenerationReport }> {
  const errors: string[] = [];
  const report: WeaponGenerationReport = {
    generatedAt: new Date().toISOString(),
    totalWeapons: 0,
    weaponsWithBuffs: 0,
    extractedBuffsList: [],
    constantPassiveItems: [],
    errors,
  };

  onProgress?.({ phase: '最新の武器データを API からオンライン取得中...', done: 0, total: 3 });

  const verbose = 'query=names&matchCategories=true&verboseCategories=true';
  let weaponsJa: any[] = [];
  let weaponsEn: any[] = [];
  const networkStart = Date.now();

  try {
    const results = await Promise.all([
      fetchJson<any[]>(`${GENSHIN_DB_API}/weapons?${verbose}&resultLanguage=Japanese`),
      fetchJson<any[]>(`${GENSHIN_DB_API}/weapons?${verbose}&resultLanguage=English`),
    ]);
    weaponsJa = results[0];
    weaponsEn = results[1];
    report.sourceApiUrl = `${GENSHIN_DB_API}/weapons`;
    report.networkDurationMs = Date.now() - networkStart;
    report.fetchedRawCountJa = weaponsJa.length;
    report.fetchedRawCountEn = weaponsEn.length;
  } catch (apiErr) {
    // Node.js 環境のみローカル genshin-db パッケージをフォールバックとして試行
    if (typeof window === 'undefined') {
      try {
        const pkgName = 'genshin-db';
        // @ts-ignore
        const genshinDb = await import(/* @vite-ignore */ pkgName);
        const g = genshinDb.default || genshinDb;
        const wNames = g.weapons('names', { matchCategories: true }) || [];
        weaponsJa = wNames.map((n: string) => g.weapons(n, { resultLanguage: 'Japanese' as any })).filter(Boolean);
        weaponsEn = wNames.map((n: string) => g.weapons(n, { resultLanguage: 'English' as any })).filter(Boolean);
      } catch (localErr) {
        throw new Error(`武器データのオンライン取得に失敗しました: ${apiErr instanceof Error ? apiErr.message : String(apiErr)}`);
      }
    } else {
      throw new Error(`武器データのオンライン取得に失敗しました: ${apiErr instanceof Error ? apiErr.message : String(apiErr)} (ネットワーク環境を確認してください)`);
    }
  }

  onProgress?.({ phase: '武器パッシブ効果・発動バフを解析・構造化中...', done: 1, total: 3 });

  const nowStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const weaponsEnMap = new Map<string, any>(weaponsEn.map(w => [w.name, w]));
  const weaponsList: WeaponDatabaseItem[] = [];
  const seenWeaponIds = new Set<string>();

  for (let i = 0; i < weaponsJa.length; i++) {
    const wJa = weaponsJa[i];
    if (!wJa || !wJa.name) continue;

    const rarity = parseInt(String(wJa.rarity || 1), 10);
    // 戦闘プランナー向けに主に3星以上の武器（1,2星はスキルを持たないため除外）
    if (rarity < 3) continue;

    const wEn = weaponsEnMap.get(wJa.name) || weaponsEn[i] || {};
    const englishName = wEn.name || wJa.name;

    // ID: genshin-db公式ID (例: "15503") を主キーとして使用
    let id = String(wJa.id ?? wEn.id ?? englishName
      .toLowerCase()
      .replace(/['"-]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, ''));

    // 重複IDの回避（「一心伝」名刀などゲーム内別バリアント対策）
    if (seenWeaponIds.has(id)) {
      let counter = 2;
      while (seenWeaponIds.has(`${id}_${counter}`)) {
        counter++;
      }
      id = `${id}_${counter}`;
    }
    seenWeaponIds.add(id);

    const rawType = wJa.weaponType || wEn.weaponType || 'Sword';
    const weaponType: WeaponType = WEAPON_TYPE_MAP[rawType] || 'sword';

    // アイコン画像の解決
    let avatarUrl = '';
    const filenameIcon = wJa.images?.filename_icon || wEn.images?.filename_icon;
    if (filenameIcon) {
      avatarUrl = `${ICON_BASE_URL}/${filenameIcon}.png`;
    } else if (wJa.images?.icon || wJa.images?.mihoyo_icon) {
      avatarUrl = wJa.images.icon || wJa.images.mihoyo_icon;
    }

    // スキル効果テキスト (r1の文章を基本とする)
    const passiveName = wJa.effectName || 'パッシブ効果';
    const effectDescription = wJa.r1?.description || wJa.description || '';

    // 基礎攻撃力
    let baseAttack: number | undefined;

    // Node環境等で stats(90) が利用可能な場合
    if (typeof wJa.stats === 'function') {
      try {
        const s90 = wJa.stats(90);
        if (s90) {
          baseAttack = Math.round(s90.attack || 0);
        }
      } catch {
        // ignore
      }
    }

    // stats関数が使えない場合の推定値・Lv1値
    if (baseAttack === undefined) {
      if (wJa.baseAtkValue) {
        baseAttack = Math.round(wJa.baseAtkValue * (rarity === 5 ? 13.2 : rarity === 4 ? 11.5 : 9.5));
      }
    }

    // 発動バフの解析・生成
    const buffEffects = parseWeaponBuffs({
      id,
      name: wJa.name,
      englishName,
      passiveName,
      description: effectDescription,
      rarity,
    });

    if (buffEffects.length > 0) {
      report.weaponsWithBuffs++;
      for (const b of buffEffects) {
        report.extractedBuffsList.push({
          sourceType: 'weapon',
          sourceName: wJa.name,
          buffName: b.name,
          duration: b.duration,
          cooldown: b.cooldown,
          statSummary: b.statEffectSummary,
        });
      }
    } else {
      report.constantPassiveItems.push({
        sourceType: 'weapon',
        name: wJa.name,
      });
    }

    // 旧形式互換用 buffEffect
    const primaryBuff = buffEffects[0];
    const legacyBuffEffect = primaryBuff
      ? {
          id: primaryBuff.id,
          name: primaryBuff.name,
          duration: primaryBuff.duration || 10,
          cooldown: primaryBuff.cooldown,
          statEffect: primaryBuff.statEffectSummary || 'バフ効果',
          description: primaryBuff.description,
          color: primaryBuff.color || '#3b82f6',
        }
      : undefined;

    weaponsList.push({
      id,
      name: wJa.name,
      englishName,
      weaponType,
      rarity,
      passiveName,
      description: effectDescription || '常時発動または特殊効果なし',
      baseAttack,
      avatarUrl,
      buffEffects,
      buffEffect: legacyBuffEffect,
      isCustom: false,
      updatedAt: nowStr,
    });
  }

  // レアリティ降順、名前昇順でソート
  weaponsList.sort((a, b) => {
    if (b.rarity !== a.rarity) return b.rarity - a.rarity;
    return a.name.localeCompare(b.name, 'ja');
  });

  report.totalWeapons = weaponsList.length;
  onProgress?.({ phase: '武器マスター生成完了', done: 3, total: 3 });

  return { weapons: weaponsList, report };
}

/**
 * 最新の聖遺物データを genshin-db API からオンライン取得・解析して生成する
 */
export async function generateArtifactsMasterOnline(
  onProgress?: (progress: EquipmentGenerationProgress) => void,
): Promise<{ artifacts: ArtifactSetDatabaseItem[]; report: ArtifactGenerationReport }> {
  const errors: string[] = [];
  const report: ArtifactGenerationReport = {
    generatedAt: new Date().toISOString(),
    totalArtifacts: 0,
    artifactsWithBuffs: 0,
    extractedBuffsList: [],
    constantPassiveItems: [],
    errors,
  };

  onProgress?.({ phase: '最新の聖遺物データを API からオンライン取得中...', done: 0, total: 3 });

  const verbose = 'query=names&matchCategories=true&verboseCategories=true';
  let artifactsJa: any[] = [];
  let artifactsEn: any[] = [];
  const networkStart = Date.now();

  try {
    const results = await Promise.all([
      fetchJson<any[]>(`${GENSHIN_DB_API}/artifacts?${verbose}&resultLanguage=Japanese`),
      fetchJson<any[]>(`${GENSHIN_DB_API}/artifacts?${verbose}&resultLanguage=English`),
    ]);
    artifactsJa = results[0];
    artifactsEn = results[1];
    report.sourceApiUrl = `${GENSHIN_DB_API}/artifacts`;
    report.networkDurationMs = Date.now() - networkStart;
    report.fetchedRawCountJa = artifactsJa.length;
    report.fetchedRawCountEn = artifactsEn.length;
  } catch (apiErr) {
    if (typeof window === 'undefined') {
      try {
        const pkgName = 'genshin-db';
        // @ts-ignore
        const genshinDb = await import(/* @vite-ignore */ pkgName);
        const g = genshinDb.default || genshinDb;
        const aNames = g.artifacts('names', { matchCategories: true }) || [];
        artifactsJa = aNames.map((n: string) => g.artifacts(n, { resultLanguage: 'Japanese' as any })).filter(Boolean);
        artifactsEn = aNames.map((n: string) => g.artifacts(n, { resultLanguage: 'English' as any })).filter(Boolean);
      } catch (localErr) {
        throw new Error(`聖遺物データのオンライン取得に失敗しました: ${apiErr instanceof Error ? apiErr.message : String(apiErr)}`);
      }
    } else {
      throw new Error(`聖遺物データのオンライン取得に失敗しました: ${apiErr instanceof Error ? apiErr.message : String(apiErr)} (ネットワーク環境を確認してください)`);
    }
  }

  onProgress?.({ phase: '聖遺物セット効果・発動バフを解析・構造化中...', done: 1, total: 3 });

  const nowStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const artifactsEnMap = new Map<string, any>(artifactsEn.map(a => [a.name, a]));
  const artifactsList: ArtifactSetDatabaseItem[] = [];
  const seenArtifactIds = new Set<string>();

  for (let i = 0; i < artifactsJa.length; i++) {
    const aJa = artifactsJa[i];
    if (!aJa || !aJa.name) continue;

    const aEn = artifactsEnMap.get(aJa.name) || artifactsEn[i] || {};
    const englishName = aEn.name || aJa.name;

    // ID: genshin-db公式ID (例: "15002") を主キーとして使用
    let id = String(aJa.id ?? aEn.id ?? englishName
      .toLowerCase()
      .replace(/['"-]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, ''));

    if (seenArtifactIds.has(id)) {
      let counter = 2;
      while (seenArtifactIds.has(`${id}_${counter}`)) {
        counter++;
      }
      id = `${id}_${counter}`;
    }
    seenArtifactIds.add(id);

    const rarityList: number[] = Array.isArray(aJa.rarityList)
      ? aJa.rarityList.map((r: any) => parseInt(String(r), 10)).filter((r: number) => !isNaN(r))
      : [4, 5];
    const maxRarity = rarityList.length > 0 ? Math.max(...rarityList) : 5;

    // アイコン画像 (花 Flower)
    let avatarUrl = '';
    const filenameFlower = aJa.images?.filename_flower || aEn.images?.filename_flower;
    if (filenameFlower) {
      avatarUrl = `${ICON_BASE_URL}/${filenameFlower}.png`;
    } else if (aJa.images?.flower || aJa.images?.mihoyo_flower) {
      avatarUrl = aJa.images.flower || aJa.images.mihoyo_flower;
    }

    const effect2p = aJa.effect2Pc || aJa.effect2pc || aJa.effect2p || '2セット効果なし';
    const effect4p = aJa.effect4Pc || aJa.effect4pc || aJa.effect4p || '';

    // 発動バフの解析・生成 (4セット効果)
    const buffEffects = parseArtifactBuffs({
      id,
      name: aJa.name,
      englishName,
      effect2p,
      effect4p,
    });

    if (buffEffects.length > 0) {
      report.artifactsWithBuffs++;
      for (const b of buffEffects) {
        report.extractedBuffsList.push({
          sourceType: 'artifact',
          sourceName: aJa.name,
          buffName: b.name,
          duration: b.duration,
          cooldown: b.cooldown,
          statSummary: b.statEffectSummary,
        });
      }
    } else {
      report.constantPassiveItems.push({
        sourceType: 'artifact',
        name: aJa.name,
      });
    }

    // 旧形式互換用 buffEffect
    const primaryBuff = buffEffects[0];
    const legacyBuffEffect = primaryBuff
      ? {
          id: primaryBuff.id,
          name: primaryBuff.name,
          duration: primaryBuff.duration || 10,
          cooldown: primaryBuff.cooldown,
          statEffect: primaryBuff.statEffectSummary || '4セット効果バフ',
          description: primaryBuff.description,
          color: primaryBuff.color || '#ec4899',
        }
      : undefined;

    artifactsList.push({
      id,
      name: aJa.name,
      englishName,
      rarity: maxRarity,
      rarityList,
      avatarUrl,
      effect2p,
      effect4p: effect4p || '4セット効果なし',
      buffEffects,
      buffEffect: legacyBuffEffect,
      isCustom: false,
      updatedAt: nowStr,
    });
  }

  // レアリティ降順、名前昇順でソート
  artifactsList.sort((a, b) => {
    if (b.rarity !== a.rarity) return b.rarity - a.rarity;
    return a.name.localeCompare(b.name, 'ja');
  });

  report.totalArtifacts = artifactsList.length;
  onProgress?.({ phase: '聖遺物マスター生成完了', done: 3, total: 3 });

  return { artifacts: artifactsList, report };
}

/**
 * 武器と聖遺物の両方を一括で最新データソースから動的に生成する
 */
export async function generateEquipmentMaster(
  onProgress?: (progress: EquipmentGenerationProgress) => void,
): Promise<EquipmentMasterResult> {
  onProgress?.({ phase: '武器マスターデータをオンライン生成中...', done: 0, total: 4 });

  const { weapons, report: wReport } = await generateWeaponsMasterOnline(p => {
    onProgress?.({ phase: p.phase, done: Math.min(2, p.done), total: 4 });
  });

  onProgress?.({ phase: '聖遺物マスターデータをオンライン生成中...', done: 2, total: 4 });

  const { artifacts, report: aReport } = await generateArtifactsMasterOnline(p => {
    onProgress?.({ phase: p.phase, done: 2 + Math.min(2, p.done), total: 4 });
  });

  const combinedReport: EquipmentGenerationReport = {
    generatedAt: new Date().toISOString(),
    totalWeapons: wReport.totalWeapons,
    weaponsWithBuffs: wReport.weaponsWithBuffs,
    totalArtifacts: aReport.totalArtifacts,
    artifactsWithBuffs: aReport.artifactsWithBuffs,
    extractedBuffsList: [...wReport.extractedBuffsList, ...aReport.extractedBuffsList],
    constantPassiveItems: [...wReport.constantPassiveItems, ...aReport.constantPassiveItems],
    errors: [...wReport.errors, ...aReport.errors],
  };

  onProgress?.({ phase: '全マスターデータ生成完了', done: 4, total: 4 });

  return {
    weapons,
    artifacts,
    report: combinedReport,
  };
}
