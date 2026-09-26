/**
 * WeaponModel
 * 武器のマスターデータおよび精錬ランク（R1〜R5）ごとの動的ステータス・効果解決クラス
 */

import { WeaponDatabaseItem, WeaponRefinementData, EquipmentBuffDefinition } from '../types/database';
import { WeaponType } from '../types/genshin';

export class WeaponModel {
  public rank: number;

  constructor(
    public readonly data: WeaponDatabaseItem,
    rank?: number
  ) {
    const defaultRank = data.refinementRank ?? (data.rarity >= 5 ? 1 : 5);
    this.rank = rank !== undefined && rank >= 1 && rank <= 5 ? rank : defaultRank;
  }

  /** 武器 ID (主キー) */
  get id(): string {
    return this.data.id;
  }

  /** 武器名 (日本語) */
  get name(): string {
    return this.data.name;
  }

  /** 武器名 (英語) */
  get englishName(): string | undefined {
    return this.data.englishName;
  }

  /** 武器種 (sword, claymore, polearm, bow, catalyst) */
  get weaponType(): WeaponType {
    return this.data.weaponType;
  }

  /** レアリティ (1〜5) */
  get rarity(): number {
    return this.data.rarity;
  }

  /** アイコン画像 URL */
  get avatarUrl(): string | undefined {
    return this.data.avatarUrl;
  }

  /** 基礎攻撃力 (Lv90) */
  get baseAttack(): number | undefined {
    return this.data.baseAttack;
  }

  /** パッシブスキル名 */
  get passiveName(): string {
    return this.data.passiveName;
  }

  /** 全精錬ランク一覧 (R1〜R5) */
  get allRefinements(): WeaponRefinementData[] {
    return this.data.refinements ?? [];
  }

  /** 現在の精錬ランク (1〜5) に対応する精錬データ */
  get currentRefinement(): WeaponRefinementData | undefined {
    if (!this.data.refinements || this.data.refinements.length === 0) {
      return undefined;
    }
    return this.data.refinements.find(r => r.rank === this.rank) ?? this.data.refinements[0];
  }

  /** 現在ランクでのスキル効果説明文 */
  get description(): string {
    return this.currentRefinement?.description || this.data.description;
  }

  /** 現在ランクでの効果持続時間 (秒) */
  get duration(): number | undefined {
    return this.currentRefinement?.duration ?? this.data.buffEffect?.duration;
  }

  /** 現在ランクでのクールタイム (秒) */
  get cooldown(): number | undefined {
    return this.currentRefinement?.cooldown ?? this.data.buffEffect?.cooldown;
  }

  /** 現在ランクでの効果要約 */
  get statEffectSummary(): string {
    return this.currentRefinement?.statEffectSummary || this.data.buffEffect?.statEffect || 'バフ効果';
  }

  /** 現在ランクでの発動バフ定義一覧 (ガントチャート・タイムライン連携用) */
  get activeBuffEffects(): EquipmentBuffDefinition[] {
    const curRef = this.currentRefinement;
    if (curRef?.buffEffects && curRef.buffEffects.length > 0) {
      return curRef.buffEffects;
    }
    if (this.data.buffEffects && this.data.buffEffects.length > 0) {
      return this.data.buffEffects.map(b => ({
        ...b,
        duration: this.duration ?? b.duration,
        cooldown: this.cooldown ?? b.cooldown,
        description: this.description,
        statEffectSummary: this.statEffectSummary,
      }));
    }
    if (this.data.buffEffect) {
      return [{
        id: this.data.buffEffect.id,
        name: this.data.buffEffect.name,
        sourceType: 'weapon',
        sourceId: this.data.id,
        duration: this.duration,
        cooldown: this.cooldown,
        description: this.description,
        color: this.data.buffEffect.color,
        statEffectSummary: this.statEffectSummary,
      }];
    }
    return [];
  }

  /** プライマリ発動バフ */
  get primaryBuffEffect(): EquipmentBuffDefinition | undefined {
    return this.activeBuffEffects[0];
  }

  /** 指定ランクへ変更 (メソッドチェーン対応) */
  setRank(rank: number): this {
    this.rank = Math.min(5, Math.max(1, rank));
    return this;
  }

  /** 指定したランクの精錬データを直接取得 */
  getRefinementAt(rank: number): WeaponRefinementData | undefined {
    return this.data.refinements?.find(r => r.rank === rank);
  }

  /** ファクトリメソッド */
  static fromDatabase(item: WeaponDatabaseItem, rank?: number): WeaponModel {
    return new WeaponModel(item, rank);
  }

  /** データベース配列から名前・IDで武器を検索して WeaponModel を生成 */
  static findInDatabase(
    weapons: WeaponDatabaseItem[],
    nameOrId: string | undefined | null,
    rank?: number
  ): WeaponModel | null {
    if (!nameOrId) return null;
    const target = weapons.find(
      w => w.name === nameOrId || w.id === nameOrId || w.englishName === nameOrId
    );
    if (!target) return null;
    return new WeaponModel(target, rank);
  }
}
