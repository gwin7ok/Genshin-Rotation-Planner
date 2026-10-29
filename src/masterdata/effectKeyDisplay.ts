/**
 * gcsim の効果のキーの、画面での扱い（同じ効果の別名・名前）。D181。
 *
 * 1 つの効果の定義が、複数の gcsim のキーを持つとき、アプリはキーごとに別のバーを作る。次の 2 つの問題を、ここで扱う。
 *   1. 同じ効果が、「状態（status）」と「ステータス修正（mod）」の 2 つのキーで登録されるもの（同じ関数が、同じ長さで同時に登録する）。
 *      → 別名の表（EFFECT_KEY_ALIASES）。別名のキーは、主のキーがあるときバーにしない（主のキー = 持ち主に付く状態。
 *        修正のほうは、受け手ごとのヒットラグで長さが少しずれる）。
 *   2. 名前が同じで、中身（数値・長さ）が違うキー（絵巻4: +12%・15 秒 と +28%・20 秒）。
 *      → キーごとの名前（labelForKey）。
 */

/**
 * 別名のキー → 主のキー。確認済み（gcsim のソースで、同じ関数が同じ長さで、状態と修正を同時に登録するもの）だけを書く。
 *   - 香菱 6 凸: `xlc6`（状態）と `xiangling-c6`（炎ダメージ+15%の修正）… internal/characters/xiangling/cons.go の c6
 *   - シグウィン 固有天賦 1: `sigewinne-convalescence`（状態）と `sigewinne-a1`（水ダメージ+の修正）… asc.go の a1Self
 *   - プルーネ 6 凸: `prune-c6-window`（状態）と `prune-c6-self-buff`（攻撃力+350 の修正）… cons.go の c6Init（どちらも 5.5 秒）
 * 武器のキー（「ダメージの修正」と「重ねがけ数の印」など）は、別の効果の可能性が高いので、対象にしない。
 */
export const EFFECT_KEY_ALIASES: Readonly<Record<string, string>> = {
  'xiangling-c6': 'xlc6',
  'sigewinne-a1': 'sigewinne-convalescence',
  'prune-c6-self-buff': 'prune-c6-window',
};

/** 別名のキーの、主のキー（別名でなければ undefined） */
export const aliasPrimaryOf = (key: string): string | undefined => EFFECT_KEY_ALIASES[key];

/** 定義のキーの一覧から、別名のキー（主のキーも同じ定義にあるもの）を除く */
export function effectiveGcsimKeys(defKeys: readonly string[]): string[] {
  return defKeys.filter(k => {
    const primary = EFFECT_KEY_ALIASES[k];
    return !(primary && defKeys.includes(primary));
  });
}

/** このキーが、定義の中で別名として扱われる（バーにしない）か */
export function isAliasKeyInDef(key: string, defKeys: readonly string[]): boolean {
  const primary = EFFECT_KEY_ALIASES[key];
  return !!primary && defKeys.includes(primary);
}

const ELEMENT_JA: Record<string, string> = {
  cryo: '氷', hydro: '水', pyro: '炎', electro: '雷', anemo: '風', geo: '岩', dendro: '草', physical: '物理',
};

/**
 * 名前が同じ定義の中の、別の効果のキー（キーごとに、固定の名前）。
 *   - コロンビーナ 2 凸（cons.go の c2OnGravityTick）: `columbina-c2` = 最大 HP +40%（コロンビーナ自身）。
 *     `columbina-c2-lb` / `-lc` / `-lcr` = 月兆レベル 2 以上のとき、反応ごとに 1 つだけ付く、フィールド上のキャラへの補正
 *     （月開花: 元素熟知 +最大 HP の 0.35%／月感電: 攻撃力 +1%／月結晶: 防御力 +1%。どれも 8 秒）
 */
const KEY_LABELS: Readonly<Record<string, string>> = {
  'columbina-c2': '2凸: 最大HP+40%（コロンビーナ）',
  'columbina-c2-lb': '2凸: 月開花の補正（フィールド上のキャラの元素熟知 +最大HP×0.35%）',
  'columbina-c2-lc': '2凸: 月感電の補正（フィールド上のキャラの攻撃力 +最大HP×1%）',
  'columbina-c2-lcr': '2凸: 月結晶の補正（フィールド上のキャラの防御力 +最大HP×1%）',
};

/**
 * キーごとの、バーの名前（定義の名前では区別がつかないとき）。無ければ undefined。
 *   - 灰燼の都に立つ英雄の絵巻 4 セット: `scroll-4pc-<元素>` = 元素ダメージ+12%・15 秒、
 *     `scroll-4pc-nightsoul-<元素>` = +28%・20 秒（持ち主が夜魂の加護中のときだけ追加）。定義の名前は、合計の「+40%」。
 */
export function labelForKey(key: string): string | undefined {
  const fixed = KEY_LABELS[key];
  if (fixed) return fixed;
  const night = key.match(/^scroll-4pc-nightsoul-([a-z]+)$/);
  if (night) return `絵巻4: ${ELEMENT_JA[night[1]] ?? night[1]}元素ダメージ+28%（夜魂の加護中）`;
  const base = key.match(/^scroll-4pc-([a-z]+)$/);
  if (base) return `絵巻4: ${ELEMENT_JA[base[1]] ?? base[1]}元素ダメージ+12%`;
  return undefined;
}

const ELEMENT_EN: Record<string, string> = {
  cryo: 'Cryo', hydro: 'Hydro', pyro: 'Pyro', electro: 'Electro', anemo: 'Anemo', geo: 'Geo', dendro: 'Dendro', physical: 'Physical',
};

const KEY_LABELS_EN: Readonly<Record<string, string>> = {
  'columbina-c2': 'C2: Max HP +40% (Columbina)',
  'columbina-c2-lb': 'C2: Lunar-Bloom bonus (on-field character EM + Max HP × 0.35%)',
  'columbina-c2-lc': 'C2: Lunar-Charged bonus (on-field character ATK + Max HP × 1%)',
  'columbina-c2-lcr': 'C2: Lunar-Crystallize bonus (on-field character DEF + Max HP × 1%)',
};

/** labelForKey の英語（表示用。D255。保存する名前・照合は日本語の labelForKey） */
export function labelForKeyEn(key: string): string | undefined {
  const fixed = KEY_LABELS_EN[key];
  if (fixed) return fixed;
  const night = key.match(/^scroll-4pc-nightsoul-([a-z]+)$/);
  if (night) return `Scroll 4P: ${ELEMENT_EN[night[1]] ?? night[1]} DMG +28% (Nightsoul's Blessing)`;
  const base = key.match(/^scroll-4pc-([a-z]+)$/);
  if (base) return `Scroll 4P: ${ELEMENT_EN[base[1]] ?? base[1]} DMG +12%`;
  return undefined;
}
