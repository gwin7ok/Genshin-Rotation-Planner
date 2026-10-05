/**
 * CharacterModel
 * キャラのマスターデータと凸数（0〜6）から、その凸数で有効なアクション定義を解決するクラス。
 * 精錬ランク（WeaponModel）と違い、凸は凸数以下の段階をすべて累積で適用する。
 */

import { ActionDefinition, CharacterConfig, CharacterConstellationData } from '../types/genshin';

export const MAX_CONSTELLATION = 6;

/** 凸数の既定値（星4=6凸、星5=0凸） */
export const defaultConstellation = (rarity?: number): number => (rarity === 4 ? MAX_CONSTELLATION : 0);

export class CharacterModel {
  public readonly constellation: number;

  constructor(
    public readonly data: CharacterConfig,
    constellation?: number,
  ) {
    this.constellation = constellation !== undefined && constellation >= 0 && constellation <= MAX_CONSTELLATION
      ? constellation
      : defaultConstellation(data.rarity);
  }

  /** 編成のキャラ（凸数を含む）から作る */
  static fromConfig(character: CharacterConfig): CharacterModel {
    return new CharacterModel(character, character.constellation);
  }

  /** 凸数以下の段階（表示用） */
  get activeConstellations(): CharacterConstellationData[] {
    return (this.data.constellations ?? []).filter(c => c.level <= this.constellation);
  }

  /** 凸の変更を適用したアクション定義（同じアクションに複数段階の変更があれば、段階の大きい方を使う） */
  get actions(): ActionDefinition[] {
    const effectDurationById = new Map<string, number>();
    const cooldownById = new Map<string, number>();
    const chargesById = new Map<string, number>();
    for (const c of [...this.activeConstellations].sort((a, b) => a.level - b.level)) {
      for (const change of c.actionChanges ?? []) {
        if (change.effectDuration !== undefined) effectDurationById.set(change.actionId, change.effectDuration);
        if (change.cooldown !== undefined) cooldownById.set(change.actionId, change.cooldown);
        if (change.charges !== undefined) chargesById.set(change.actionId, change.charges);
      }
    }
    if (effectDurationById.size === 0 && cooldownById.size === 0 && chargesById.size === 0) return this.data.availableActions;
    return this.data.availableActions.map(a =>
      effectDurationById.has(a.id) || cooldownById.has(a.id) || chargesById.has(a.id)
        ? {
          ...a,
          ...(effectDurationById.has(a.id) ? { effectDuration: effectDurationById.get(a.id) } : {}),
          ...(cooldownById.has(a.id) ? { cooldown: cooldownById.get(a.id) } : {}),
          ...(chargesById.has(a.id) ? { charges: chargesById.get(a.id) } : {}),
        }
        : a,
    );
  }
}
