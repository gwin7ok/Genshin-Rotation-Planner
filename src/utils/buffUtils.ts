import { CharacterConfig } from '../types/genshin';
import { EquipmentBuffDefinition, GenshinDatabase } from '../types/database';

export type BuffCategory = 'talent' | 'weapon' | 'artifact';

export interface TriggerableBuffDefinition {
  id: string;                      // 例: "amber_pyro_p1", "wbuff_15503", "abuff_15007"
  name: string;                    // 表示名
  category: BuffCategory;          // 'talent' | 'weapon' | 'artifact'
  sourceId: string;                // キャラクターID / 武器ID / 聖遺物ID
  sourceName?: string;             // キャラクター名 / 武器名 / 聖遺物名
  duration?: number;               // 持続時間 (秒)
  cooldown?: number;               // クールタイム (秒)
  description?: string;            // 詳細説明文
  color?: string;                  // ガントチャート表示色
  statEffectSummary?: string;      // バフ効果要約
}

/**
 * 指定されたキャラクターが発動可能な全バフ（固有天賦・装備武器・装備聖遺物）を収集する
 */
export function getAvailableBuffsForCharacter(
  character: CharacterConfig,
  database?: GenshinDatabase
): TriggerableBuffDefinition[] {
  const result: TriggerableBuffDefinition[] = [];

  // 1. キャラクター固有天賦バフ
  if (character.passiveEffects && character.passiveEffects.length > 0) {
    for (const p of character.passiveEffects) {
      result.push({
        id: p.id,
        name: p.name,
        category: 'talent',
        sourceId: character.id,
        sourceName: character.name,
        duration: p.duration,
        cooldown: p.cooldown,
        description: p.description,
        color: character.color || '#84cc16',
      });
    }
  }

  // 2. 装備武器の連動バフ
  if (character.weaponName && database?.weapons) {
    const matchedWeapon = database.weapons.find(w => w.name === character.weaponName);
    if (matchedWeapon) {
      const buffs: EquipmentBuffDefinition[] = matchedWeapon.buffEffects && matchedWeapon.buffEffects.length > 0
        ? matchedWeapon.buffEffects
        : matchedWeapon.buffEffect
        ? [
            {
              id: matchedWeapon.buffEffect.id || `wbuff_${matchedWeapon.id}`,
              name: matchedWeapon.buffEffect.name,
              sourceType: 'weapon',
              sourceId: matchedWeapon.id,
              duration: matchedWeapon.buffEffect.duration,
              cooldown: matchedWeapon.buffEffect.cooldown,
              description: matchedWeapon.buffEffect.description,
              color: matchedWeapon.buffEffect.color || '#0284c7',
              statEffectSummary: matchedWeapon.buffEffect.statEffect,
            }
          ]
        : [];

      for (const b of buffs) {
        result.push({
          id: b.id,
          name: b.name,
          category: 'weapon',
          sourceId: matchedWeapon.id,
          sourceName: matchedWeapon.name,
          duration: b.duration,
          cooldown: b.cooldown,
          description: b.description,
          color: b.color || '#0284c7',
          statEffectSummary: b.statEffectSummary,
        });
      }
    }
  }

  // 3. 装備聖遺物の連動バフ (4セット効果)
  if (character.artifactSetName && database?.artifacts) {
    const matchedArtifact = database.artifacts.find(a => a.name === character.artifactSetName);
    if (matchedArtifact) {
      const buffs: EquipmentBuffDefinition[] = matchedArtifact.buffEffects && matchedArtifact.buffEffects.length > 0
        ? matchedArtifact.buffEffects
        : matchedArtifact.buffEffect
        ? [
            {
              id: matchedArtifact.buffEffect.id || `abuff_${matchedArtifact.id}`,
              name: matchedArtifact.buffEffect.name,
              sourceType: 'artifact',
              sourceId: matchedArtifact.id,
              duration: matchedArtifact.buffEffect.duration,
              cooldown: matchedArtifact.buffEffect.cooldown,
              description: matchedArtifact.buffEffect.description,
              color: matchedArtifact.buffEffect.color || '#c084fc',
              statEffectSummary: matchedArtifact.buffEffect.statEffect,
            }
          ]
        : [];

      for (const b of buffs) {
        result.push({
          id: b.id,
          name: b.name,
          category: 'artifact',
          sourceId: matchedArtifact.id,
          sourceName: matchedArtifact.name,
          duration: b.duration,
          cooldown: b.cooldown,
          description: b.description,
          color: b.color || '#c084fc',
          statEffectSummary: b.statEffectSummary,
        });
      }
    }
  }

  return result;
}

/**
 * バフのカテゴリ（天賦・武器・聖遺物）に応じたUIバッジ配色とアイコン定義を返す
 * CTバーの色はキャラのアクションのCT（Sky Blue）に統一し、効果持続時間バーのみ由来元で色分けする
 */
export function getBuffBadgeConfig(category: BuffCategory = 'talent') {
  // キャラクターのアクションCTバー（スキルCT・爆発CT）と同一の共通CTスタイル
  const unifiedCooldownBarClass = 'bg-sky-950 border-sky-400/90 text-sky-200 hover:border-sky-300';
  const unifiedTimingValueClass = 'text-sky-300';

  switch (category) {
    case 'weapon':
      return {
        label: '武器',
        icon: '⚔️',
        badgeClass: 'bg-blue-950/70 border-blue-600/80 text-blue-200',
        hoverButtonClass: 'bg-blue-950/60 hover:bg-blue-900/80 text-blue-200 hover:text-white border-blue-700/80 hover:border-blue-400',
        ganttBarClass: 'bg-blue-700 border-blue-300 text-white shadow-sm hover:border-blue-200 hover:brightness-110',
        cooldownBarClass: unifiedCooldownBarClass,
        timingValueClass: unifiedTimingValueClass,
      };
    case 'artifact':
      return {
        label: '聖遺物',
        icon: '🛡️',
        badgeClass: 'bg-purple-950/60 border-purple-700/70 text-purple-200',
        hoverButtonClass: 'bg-purple-950/50 hover:bg-purple-900/60 text-purple-200 hover:text-white border-purple-800/70 hover:border-purple-500',
        ganttBarClass: 'bg-purple-950 border-purple-400 text-purple-100 hover:border-purple-300',
        cooldownBarClass: unifiedCooldownBarClass,
        timingValueClass: unifiedTimingValueClass,
      };
    case 'talent':
    default:
      return {
        label: '天賦',
        icon: '🎯',
        badgeClass: 'bg-emerald-950/60 border-emerald-700/70 text-emerald-200',
        hoverButtonClass: 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-200 hover:text-white border-emerald-800/70 hover:border-emerald-500',
        ganttBarClass: 'bg-lime-950 border-lime-400 text-lime-100 hover:border-lime-300',
        cooldownBarClass: unifiedCooldownBarClass,
        timingValueClass: unifiedTimingValueClass,
      };
  }
}
