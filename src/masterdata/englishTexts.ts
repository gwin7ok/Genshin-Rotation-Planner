/**
 * マスターの英語の表示用の文（D249・D255。docs/i18n/plan.md 4.3.2 の 3-2）。
 *
 * - 名前: 日本語の名前の中の、天賦名・命ノ星座名（genshin-db の日本語と英語の組）と、決まった語（「元素スキル」など）を置き換えて作る。
 *   日本語が残るもの（アプリが手で書いた名前など。3-3 で英語を足す）は、英語を持たない（表示は日本語のまま）。
 * - 説明文: genshin-db の英語の説明文（日本語と同じ対応で選ぶ）。
 * - 処理（数値の抽出・判定・gcsim）は、日本語の欄だけを見る。ここで作るのは表示用の `en` の欄だけ。
 */
import type { CharacterConfig } from '../types/genshin';

const JAPANESE = /[぀-ヿ一-鿿]/;

/** genshin-db の天賦（必要な欄だけ） */
export interface TalentTexts {
  name?: string;
  [key: string]: unknown;
}
/** genshin-db の命ノ星座（必要な欄だけ） */
export interface ConstellationTexts {
  [key: string]: unknown;
}

interface NamedText {
  name?: string;
  description?: string;
}

const textOf = (obj: unknown, key: string): NamedText | undefined => {
  const v = (obj as Record<string, unknown> | undefined)?.[key];
  return v && typeof v === 'object' ? (v as NamedText) : undefined;
};

/** 天賦・命ノ星座の欄（combat1〜 / passive1〜 / c1〜c6） */
const TALENT_KEYS = ['combat1', 'combat2', 'combat3', 'combatsp', 'passive1', 'passive2', 'passive3', 'passive4'];
const CONSTELLATION_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];

/** 名前の中の決まった語（長いものから置き換える） */
const NAME_TERMS: [string, string][] = [
  ['元素スキル(長押し（低い段）)', 'Elemental Skill (Hold, low)'],
  ['元素スキル(長押し・落下)', 'Elemental Skill (Hold, plunge)'],
  ['元素スキル(最大ホールド)', 'Elemental Skill (max hold)'],
  ['元素スキル(長押し)', 'Elemental Skill (Hold)'],
  ['元素スキル派生', 'Elemental Skill variant'],
  ['特殊元素スキル', 'Special Elemental Skill'],
  ['特殊元素爆発', 'Special Elemental Burst'],
  ['狙い撃ち (フルチャージ)', 'Aimed Shot (fully charged)'],
  ['落下攻撃(低)', 'Low Plunge'],
  ['落下攻撃(高)', 'High Plunge'],
  ['元素スキル', 'Elemental Skill'],
  ['元素爆発', 'Elemental Burst'],
  ['通常攻撃', 'Normal Attack'],
  ['重撃', 'Charged Attack'],
  ['ダッシュ', 'Sprint'],
  ['ジャンプ', 'Jump'],
];

/** 日本語の名前 → 英語の名前の組（キャラごと。天賦・命ノ星座・キャラ名） */
export type NameDictionary = [string, string][];

export interface CharacterEnglishSources {
  /** 英語の表示名（キャラ名） */
  name: string;
  /** 日本語の名前（キャラ名） */
  nameJa: string;
  talentJa?: TalentTexts;
  talentEn?: TalentTexts;
  constellationJa?: ConstellationTexts;
  constellationEn?: ConstellationTexts;
}

export function buildNameDictionary(src: CharacterEnglishSources): NameDictionary {
  const pairs: NameDictionary = [[src.nameJa, src.name]];
  for (const [ja, en, keys] of [
    [src.talentJa, src.talentEn, TALENT_KEYS],
    [src.constellationJa, src.constellationEn, CONSTELLATION_KEYS],
  ] as const) {
    for (const k of keys) {
      const j = textOf(ja, k)?.name;
      const e = textOf(en, k)?.name;
      if (j && e) pairs.push([j, e]);
    }
  }
  return pairs.sort((a, b) => b[0].length - a[0].length);
}

/** 日本語の名前を英語にする。日本語が残るときは undefined（表示は日本語のまま） */
export function translateName(ja: string | undefined, dict: NameDictionary): string | undefined {
  if (!ja) return undefined;
  let s = ja;
  for (const [j, e] of dict) if (j) s = s.split(j).join(e);
  for (const [j, e] of NAME_TERMS) s = s.split(j).join(e);
  s = s
    .replace(/（([^（）]+?)の後）/g, ' (after $1)')
    .replace(/「([^「」]+)」/g, '"$1"')
    .replace(/\((\d+(?:\.\d+)?)秒\)/g, '($1s)')
    .replace(/（/g, ' (')
    .replace(/）/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
  return JAPANESE.test(s) ? undefined : s;
}

/** 英語を持てなかった文（日本語のまま表示されるもの）。生成のレポート用 */
export interface EnglishMissing {
  characterId: string;
  field: string;
  text: string;
}

/**
 * キャラのマスターに英語の表示用の文（`en`）を付ける（その場で書き換える）。
 * 日本語の欄は変えない。英語を作れなかった名前は missing に入れる
 */
export function attachCharacterEnglish(c: CharacterConfig, src: CharacterEnglishSources, missing: EnglishMissing[]): void {
  const dict = buildNameDictionary(src);
  const note = (field: string, text: string) => missing.push({ characterId: c.id, field, text });
  const name = (field: string, ja: string | undefined) => {
    const en = translateName(ja, dict);
    if (ja && JAPANESE.test(ja) && !en) note(field, ja);
    return en;
  };
  const desc = (obj: unknown, key: string) => textOf(obj, key)?.description;

  c.en = { name: src.name };

  // アクション: 説明文は、日本語と同じ対応（スキル系 = combat2、爆発 = combat3、通常・重撃・落下 = combat1）
  const skillJa = desc(src.talentJa, 'combat2');
  const burstJa = desc(src.talentJa, 'combat3');
  const normalJa = desc(src.talentJa, 'combat1');
  for (const a of c.availableActions) {
    const en: NonNullable<typeof a.en> = {};
    const n = name(`action:${a.id}`, a.name);
    if (n) en.name = n;
    if (a.buttonLabel && JAPANESE.test(a.buttonLabel)) {
      const b = name(`buttonLabel:${a.id}`, a.buttonLabel);
      if (b) en.buttonLabel = b;
    }
    if (a.description) {
      const d = a.description === skillJa ? desc(src.talentEn, 'combat2')
        : a.description === burstJa ? desc(src.talentEn, 'combat3')
        : a.description === normalJa ? desc(src.talentEn, 'combat1')
        : undefined;
      if (d) en.description = d;
    }
    if (Object.keys(en).length > 0) a.en = en;
    for (const x of a.gcsimExtras ?? []) {
      const l = name(`gcsimExtra:${a.id}:${x.key}`, x.label);
      if (l) x.en = { label: l };
    }
    if (a.mode) {
      const l = name(`mode:${a.id}`, a.mode.label);
      if (l) a.mode.en = { ...a.mode.en, label: l };
    }
  }

  // 固有天賦の効果: 天賦名・説明文は passive{枠}
  for (const p of c.passiveEffects ?? []) {
    const key = `passive${p.talentSlot}`;
    const en: NonNullable<typeof p.en> = {};
    const n = name(`passive:${p.id}`, p.name);
    if (n) en.name = n;
    const tn = textOf(src.talentEn, key)?.name;
    if (tn) en.talentName = tn;
    const d = desc(src.talentEn, key);
    if (d) en.description = d;
    if (Object.keys(en).length > 0) p.en = en;
  }

  // 命ノ星座の段階（名前・説明文は c{段階}）
  for (const lv of c.constellations ?? []) {
    const t = textOf(src.constellationEn, `c${lv.level}`);
    if (t?.name || t?.description) lv.en = { ...(t.name ? { name: t.name } : {}), ...(t.description ? { description: t.description } : {}) };
  }
  // 命ノ星座の効果（発動バフ）は、この後の linkCharacterBuffs（buffGcsimLink.ts）が、段階の en を写して作る
}
