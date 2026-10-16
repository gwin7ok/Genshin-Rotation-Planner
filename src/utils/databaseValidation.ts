/**
 * データベースの項目（キャラ・武器・聖遺物）の検査。DB 管理の「JSON 取り込み」と、バックアップの復元で、共通に使う。
 *
 * 目的: ID と名前だけが合っていて、画面・計算が使う項目の型が違うもの（例: availableActions が null のキャラ、
 *       passiveName が無い武器）を、保存する前に除外する。これらは、保存してしまうと、再読み込みのたびに画面が落ちる。
 * 方針（寛容）: 画面と計算が落ちない最低限の形だけを検査する。任意の項目は、あれば型を確かめ、無ければ通す。
 *       マスターのデータ（同梱のもの）は、すべて通ること（scripts/check-backup.ts が確かめる）。
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 無い（undefined）か、期待する型のときだけ true */
function optional(o: Record<string, unknown>, types: { string?: string[]; number?: string[]; boolean?: string[]; array?: string[]; record?: string[] }): boolean {
  return (types.string ?? []).every(k => o[k] === undefined || typeof o[k] === 'string')
    && (types.number ?? []).every(k => o[k] === undefined || isFiniteNumber(o[k]))
    && (types.boolean ?? []).every(k => o[k] === undefined || typeof o[k] === 'boolean')
    && (types.array ?? []).every(k => o[k] === undefined || Array.isArray(o[k]))
    && (types.record ?? []).every(k => o[k] === undefined || isRecord(o[k]));
}

const isValidActionDefinition = (a: unknown): boolean =>
  isRecord(a) && isNonEmptyString(a.id) && typeof a.name === 'string' && typeof a.shortName === 'string' && typeof a.type === 'string'
  && isFiniteNumber(a.defaultDuration)
  && optional(a, { string: ['description', 'buttonLabel'], number: ['cooldown', 'effectDuration'] });

const isValidPassiveEffect = (p: unknown): boolean =>
  isRecord(p) && isNonEmptyString(p.id) && typeof p.name === 'string' && optional(p, { string: ['talentName', 'description'], number: ['duration', 'cooldown'] });

/** キャラ: ID・名前・属性・武器種、アクション定義の配列（各要素の ID・名前・略称・種類・所要時間） */
export function isValidCharacterItem(v: unknown): boolean {
  return isRecord(v) && isNonEmptyString(v.id) && typeof v.name === 'string'
    && typeof v.element === 'string' && typeof v.weaponType === 'string'
    && Array.isArray(v.availableActions) && v.availableActions.every(isValidActionDefinition)
    && (v.passiveEffects === undefined || (Array.isArray(v.passiveEffects) && v.passiveEffects.every(isValidPassiveEffect)))
    && optional(v, {
      string: ['englishName', 'avatarUrl', 'color', 'accentColor'],
      number: ['rarity', 'energyRecharge', 'constellation'],
      boolean: ['isCustom', 'isLocked'],
      array: ['constellations', 'constellationEffects'],
      record: ['source'],
    });
}

/** 武器: ID・名前・武器種・レアリティ・特殊効果名（検索・表示に使う） */
export function isValidWeaponItem(v: unknown): boolean {
  return isRecord(v) && isNonEmptyString(v.id) && typeof v.name === 'string' && typeof v.weaponType === 'string'
    && isFiniteNumber(v.rarity) && typeof v.passiveName === 'string'
    && optional(v, {
      string: ['englishName', 'description', 'avatarUrl', 'gcsimKey'],
      number: ['baseAttack', 'refinementRank'],
      boolean: ['isCustom', 'isLocked'],
      array: ['refinements', 'buffEffects'],
      record: ['buffEffect'],
    });
}

/** 聖遺物セット: ID・名前・レアリティ・2 セット / 4 セット効果（検索・表示に使う） */
export function isValidArtifactItem(v: unknown): boolean {
  return isRecord(v) && isNonEmptyString(v.id) && typeof v.name === 'string'
    && isFiniteNumber(v.rarity) && typeof v.effect2p === 'string' && typeof v.effect4p === 'string'
    && optional(v, {
      string: ['englishName', 'avatarUrl', 'gcsimKey'],
      boolean: ['isCustom', 'isLocked'],
      array: ['rarityList', 'buffEffects'],
      record: ['buffEffect'],
    });
}

/** 形の合う項目だけを残す。同じ ID は最初の 1 件だけ。除外した数を返す */
export function sanitizeDbItems<T>(list: unknown[], isValid: (v: unknown) => boolean): { items: T[]; skipped: number } {
  const seen = new Set<string>();
  const items: T[] = [];
  for (const v of list) {
    if (!isValid(v)) continue;
    const id = (v as { id: string }).id;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push(v as T);
  }
  return { items, skipped: list.length - items.length };
}
