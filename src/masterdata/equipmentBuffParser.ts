/**
 * 武器・聖遺物効果テキスト解析パーサー
 *
 * 仕様書 (EQUIPMENT_MASTER_SPECIFICATION.md) に基づき、
 * 説明文から「継続時間 (秒)」「クールタイム (秒)」を自動抽出し、
 * 確認済み補正辞書 (equipmentBuffOverrides.ts) と統合して
 * ガントチャート用の EquipmentBuffDefinition を生成します。
 */

import type { EquipmentBuffDefinition } from '../types/database';
import {
  WEAPON_BUFF_OVERRIDES,
  ARTIFACT_BUFF_OVERRIDES,
  type EquipmentBuffOverride,
} from './equipmentBuffOverrides.ts';

export interface ExtractedTimings {
  duration?: number;
  cooldown?: number;
  durationMatch?: string;
  cooldownMatch?: string;
}

/**
 * 日本語の説明文から「継続時間」および「クールタイム」を抽出する
 */
export function extractEquipmentTimings(text: string): ExtractedTimings {
  if (!text) return {};

  let duration: number | undefined;
  let durationMatch: string | undefined;
  let cooldown: number | undefined;
  let cooldownMatch: string | undefined;

  // --- 1. クールタイム (Cooldown) の正規表現抽出 ---
  // 先にクールタイム文脈（発動後のXX秒間...など）を検出し、持続時間との誤認を防ぐ
  const cdPatterns: Array<{ re: RegExp; group: number }> = [
    // 確実なCT表記: "クールタイムは20秒", "CT: 15秒", "CD 20秒"
    { re: /(?:CD|クールタイム|CT)[：:\s]*(?:は)?\s*([\d.]+)\s*秒/i, group: 1 },
    // "発動後(の)20秒間、...再度獲得することはできない/発動できない"
    { re: /(?:発動後|発動すると)(?:の)?\s*([\d.]+)\s*秒(?:間|の間)?、?[^。]*?(?:再度|再発動|CT|再び|獲得することはできな|発動できな)/i, group: 1 },
    // "再発動可能になるまで20秒"
    { re: /(?:再発動可能になるまで|再発動のクールタイムは|次の発動まで)\s*([\d.]+)\s*秒/i, group: 1 },
    // "最短で6秒毎に1回発動"
    { re: /最短で\s*([\d.]+)\s*秒(?:毎|ごと)に\s*(?:1|一)\s*回/i, group: 1 },
    // "20秒毎に1回のみ発動可能", "20秒ごとに1回"
    { re: /([\d.]+)\s*秒(?:毎|ごと)に\s*(?:1|一)\s*回/i, group: 1 },
    // "20秒に1回のみ発動"
    { re: /([\d.]+)\s*秒に(?:1|一)回(?:のみ)?(?:発動|獲得)?/i, group: 1 },
  ];

  for (const { re, group } of cdPatterns) {
    const match = text.match(re);
    if (match && match[group]) {
      const val = parseFloat(match[group]);
      if (!isNaN(val) && val > 0) {
        cooldown = Math.round(val * 10) / 10;
        cooldownMatch = match[0];
        break;
      }
    }
  }

  // --- 2. 継続時間 (Duration) の正規表現抽出 ---
  // 例: "継続時間12秒", "12秒間", "12秒継続", "10秒の間"
  // 注意: クールタイム文脈（「発動後の20秒間、...再度」など）でマッチした秒数と同一の場合は除外
  const durPatterns: Array<{ re: RegExp; group: number }> = [
    { re: /(?:継続時間|持続時間)\s*([\d.]+)\s*秒/i, group: 1 },
    { re: /([\d.]+)\s*秒継続/i, group: 1 },
    { re: /(?<!発動後(?:の)?)\b([\d.]+)\s*秒間(?![^。]*?(?:再度|再発動|獲得することはできな))/i, group: 1 },
    { re: /([\d.]+)\s*秒(?:の間|持続)/i, group: 1 },
    { re: /([\d.]+)\s*秒間/i, group: 1 },
  ];

  for (const { re, group } of durPatterns) {
    const match = text.match(re);
    if (match && match[group]) {
      const val = parseFloat(match[group]);
      if (!isNaN(val) && val > 0) {
        // cooldownMatch に含まれる秒数と被っている場合は、CTを優先して次の候補を探す
        if (cooldownMatch && cooldownMatch.includes(`${val}秒`) && cooldownMatch.includes('発動後')) {
          continue;
        }
        duration = Math.round(val * 10) / 10;
        durationMatch = match[0];
        break;
      }
    }
  }

  return { duration, cooldown, durationMatch, cooldownMatch };
}

/**
 * 効果内容のテキストから適切なテーマカラーを推定する
 */
export function inferBuffColor(text: string): string {
  if (!text) return '#3b82f6';
  if (/元素チャージ|エネルギー|チャージ効率/i.test(text)) return '#c084fc'; // パープル
  if (/元素熟知|開花|激化|草元素/i.test(text)) return '#10b981'; // グリーン
  if (/拡散|風元素/i.test(text)) return '#14b8a6'; // ティール
  if (/攻撃力|炎元素|燃焼/i.test(text)) return '#f87171'; // レッド
  if (/会心率|会心ダメージ/i.test(text)) return '#fbbf24'; // アンバー
  if (/水元素|蒸発|HP上限|回復/i.test(text)) return '#38bdf8'; // スカイブルー
  if (/シールド|防御力|岩元素/i.test(text)) return '#f59e0b'; // イエローオレンジ
  if (/氷元素|凍結/i.test(text)) return '#06b6d4'; // シアン
  return '#6366f1'; // インディゴ (デフォルト)
}

/**
 * 効果説明文から簡潔な要約を生成する
 */
export function generateStatSummary(text: string): string {
  if (!text) return 'バフ効果';
  // 文中のキーフレーズを抽出して要約を作成
  const parts: string[] = [];
  const atkMatch = text.match(/攻撃力\+(\d+%?)/);
  if (atkMatch) parts.push(`攻撃力+${atkMatch[1]}`);

  const emMatch = text.match(/元素熟知\+(\d+)/);
  if (emMatch) parts.push(`熟知+${emMatch[1]}`);

  const crMatch = text.match(/会心率\+(\d+%?)/);
  if (crMatch) parts.push(`会心率+${crMatch[1]}`);

  const cdMatch = text.match(/会心ダメージ\+(\d+%?)/);
  if (cdMatch) parts.push(`会心ダメ+${cdMatch[1]}`);

  const dmgMatch = text.match(/(?:通常攻撃|重撃|元素スキル|元素爆発|全元素|与える)?ダメージ\+(\d+%?)/);
  if (dmgMatch) parts.push(`ダメ+${dmgMatch[1]}`);

  const resMatch = text.match(/(?:全元素|[\u4e00-\u9fa5]+元素)?耐性-(\d+%?)/);
  if (resMatch) parts.push(`耐性-${resMatch[1]}`);

  if (parts.length > 0) {
    return parts.slice(0, 2).join(' / ');
  }

  // 1行目の先頭を短く切る
  const clean = text.replace(/「[^」]*」/g, '').trim();
  return clean.length > 24 ? clean.slice(0, 22) + '...' : clean;
}

/**
 * 武器データから発動バフ一覧を解析・生成する
 */
export function parseWeaponBuffs(weapon: {
  id: string;
  name: string;
  englishName?: string;
  passiveName?: string;
  description?: string;
  rarity?: number;
}): EquipmentBuffDefinition[] {
  // 1. 補正辞書の検索 (日本語名、英語名、IDで照合)
  const override: EquipmentBuffOverride | undefined =
    WEAPON_BUFF_OVERRIDES[weapon.name] ??
    (weapon.englishName ? WEAPON_BUFF_OVERRIDES[weapon.englishName] : undefined) ??
    WEAPON_BUFF_OVERRIDES[weapon.id];

  const descText = weapon.description || '';

  // 2. テキスト自動抽出
  const timings = extractEquipmentTimings(descText);

  // 3. 継続時間が補正辞書にも説明文にも存在しない場合は、常時パッシブとみなして発動バフは生成しない
  const finalDuration = override?.duration ?? timings.duration;
  const finalCooldown = override?.cooldown ?? timings.cooldown;

  if (finalDuration === undefined && finalCooldown === undefined && !override) {
    return [];
  }

  // 継続時間が 0 または 未設定でも、クールタイムのある効果（例: 西風・祭礼など）は発動可能とする
  const effectiveDuration = finalDuration ?? 0;

  const buffName = override?.name ?? `${weapon.name}: ${weapon.passiveName || '効果'}`;
  const summary = override?.statEffectSummary ?? generateStatSummary(descText);
  const color = override?.color ?? inferBuffColor(descText);

  const buffDef: EquipmentBuffDefinition = {
    id: `wbuff_${weapon.id}`,
    name: buffName,
    sourceType: 'weapon',
    sourceId: weapon.id,
    duration: effectiveDuration > 0 ? effectiveDuration : undefined,
    cooldown: finalCooldown && finalCooldown > 0 ? finalCooldown : undefined,
    description: descText,
    color,
    statEffectSummary: summary,
    dataSource: {
      duration: timings.durationMatch,
      cooldown: timings.cooldownMatch,
    },
  };

  return [buffDef];
}

/**
 * 聖遺物データから発動バフ一覧を解析・生成する (主に4セット効果)
 */
export function parseArtifactBuffs(artifact: {
  id: string;
  name: string;
  englishName?: string;
  effect2p?: string;
  effect4p?: string;
}): EquipmentBuffDefinition[] {
  // 聖遺物の主要な発動バフは 4セット効果 (effect4p)
  const effect4pText = artifact.effect4p || '';

  // 1. 補正辞書の検索 (セット名、英語名、IDで照合)
  const cleanName = artifact.name.replace(/\s*4セット$/, '').trim();
  const override: EquipmentBuffOverride | undefined =
    ARTIFACT_BUFF_OVERRIDES[cleanName] ??
    ARTIFACT_BUFF_OVERRIDES[artifact.name] ??
    (artifact.englishName ? ARTIFACT_BUFF_OVERRIDES[artifact.englishName] : undefined) ??
    ARTIFACT_BUFF_OVERRIDES[artifact.id];

  // 2. 4P効果テキストの自動抽出
  const timings = extractEquipmentTimings(effect4pText);

  const finalDuration = override?.duration ?? timings.duration;
  const finalCooldown = override?.cooldown ?? timings.cooldown;

  // 継続時間もCTも無く、辞書にも無い場合は常時パッシブ（発動バフなし）
  if (finalDuration === undefined && finalCooldown === undefined && !override) {
    return [];
  }

  const effectiveDuration = finalDuration ?? 0;
  const buffName = override?.name ?? `${cleanName}4: 効果`;
  const summary = override?.statEffectSummary ?? generateStatSummary(effect4pText);
  const color = override?.color ?? inferBuffColor(effect4pText);

  const buffDef: EquipmentBuffDefinition = {
    id: `abuff_${artifact.id}`,
    name: buffName,
    sourceType: 'artifact',
    sourceId: artifact.id,
    duration: effectiveDuration > 0 ? effectiveDuration : undefined,
    cooldown: finalCooldown && finalCooldown > 0 ? finalCooldown : undefined,
    description: effect4pText,
    color,
    statEffectSummary: summary,
    dataSource: {
      duration: timings.durationMatch,
      cooldown: timings.cooldownMatch,
    },
  };

  return [buffDef];
}
