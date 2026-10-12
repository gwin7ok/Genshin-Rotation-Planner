/**
 * キャラの装備（武器・聖遺物）の、ガントチャートの見出し用の要約。
 * 精錬ランクの既定値は、計算（rotationCalculator・buildGcsimConfig）と同じ:
 * 編成の指定 → 武器の既定 → 星5 = 1 / 星4 以下 = 5。
 */
import type { CharacterConfig } from '../types/genshin';
import type { GenshinDatabase } from '../types/database';
import { defaultConstellation } from '../models/CharacterModel';

export interface EquipmentSummary {
  /** 例: "舟歌 R5"。武器が未設定なら null */
  weapon: string | null;
  /** 例: "絶縁の旗印 4セット" / "2+2（効果なし）"。未設定なら null */
  artifact: string | null;
}

export function summarizeEquipment(char: CharacterConfig, database?: Pick<GenshinDatabase, 'weapons' | 'artifacts'>): EquipmentSummary {
  let weapon: string | null = null;
  if (char.weaponId) {
    const w = database?.weapons.find(x => x.id === char.weaponId);
    const refine = char.weaponRefinementRank ?? w?.refinementRank ?? (w && w.rarity >= 5 ? 1 : 5);
    weapon = `${w?.name ?? char.weaponId} R${refine}`;
  }
  let artifact: string | null = null;
  if (char.artifactSetMode === '2+2') {
    artifact = '2+2（効果なし）';
  } else if (char.artifactSetId) {
    const a = database?.artifacts.find(x => x.id === char.artifactSetId);
    artifact = `${a?.name ?? char.artifactSetId} 4セット`;
  }
  return { weapon, artifact };
}

/** 凸数（編成の指定 → 既定: 星4 = 6 / それ以外 = 0） */
export function constellationOf(char: CharacterConfig): number {
  return char.constellation ?? defaultConstellation(char.rarity);
}
