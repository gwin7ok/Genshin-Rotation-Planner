/**
 * DBキーの照合表（フェーズ5 / 5-1, D34）
 *
 * genshin-db の公式 ID ↔ gcsim のキー を、名前ではなく ID で突き合わせた結果を「表」として持つ。
 * マスターデータの生成（キャラ・武器・聖遺物）は、この表を引いて gcsimKey を付ける。
 * 表は生成のたびに作り直し、`src/data/gcsim_key_map.json` に保存する（突き合わせできなかったものも一覧で残す）。
 *
 * 突き合わせの元データは gcsim の `ui/packages/ui/src/data/{character,weapon,artifact}.dm.json`（公式 ID と key を持つ）。
 * dm.json だけでは対応できないもの（旅人: 空・蛍で公式 ID が共通）は、手で補う一覧（manual）で指定し、表に「手で補った」印を付ける。
 */

/** gcsim の dm.json の形（data.<key> = { id: 公式ID, key }） */
export type GcsimDmData = Record<string, { id: number; key: string }>;

export interface KeyMapItem {
  /** マスターデータのキー（キャラは "公式キャラID-元素"、武器・聖遺物は公式ID の文字列） */
  id: string;
  /** genshin-db の公式 ID */
  genshinId: number;
  /** 一覧で見分けるための表示名（突き合わせには使わない） */
  name: string;
}

export interface KeyMapRecord extends KeyMapItem {
  gcsimKey: string;
  /** dm.json の公式 ID で自動的に突き合わせた / 手で補った */
  source: 'dm.json' | 'manual';
}

export interface KeyMapSection {
  /** 突き合わせに使った gcsim のコミット */
  gcsimCommit: string;
  records: KeyMapRecord[];
  /** genshin-db にあるが gcsim に対応が無い（gcsim 対象外） */
  genshinOnly: Array<{ id: string; name: string }>;
  /** gcsim にあるが、対応する genshin-db の項目が無い */
  gcsimOnly: Array<{ gcsimKey: string; genshinId: number }>;
}

export interface GcsimKeyMap {
  characters: KeyMapSection;
  weapons: KeyMapSection;
  artifacts: KeyMapSection;
}

/** 手で補う対応（マスターデータのキー → gcsim キー）。dm.json の公式 ID では引けないものに使う */
export interface ManualKeyMapping {
  id: string;
  gcsimKey: string;
}

/**
 * 項目（genshin-db 側）と dm.json（gcsim 側）を、公式 ID で突き合わせる。
 * - 手で補う対応があれば、その key を使う（dm.json に無い key は、対応なしとして扱う）
 * - 手で補う対応が無ければ、公式 ID が一致する dm.json の key を1つだけ使う（複数あるときは曖昧なので対応なしにする）
 */
export function buildKeyMapSection(
  items: KeyMapItem[],
  dm: GcsimDmData,
  gcsimCommit: string,
  manual: ManualKeyMapping[] = [],
): KeyMapSection {
  const keysByGenshinId = new Map<number, string[]>();
  for (const entry of Object.values(dm)) {
    const keys = keysByGenshinId.get(entry.id) ?? [];
    keys.push(entry.key);
    keysByGenshinId.set(entry.id, keys);
  }
  const manualById = new Map(manual.map(m => [m.id, m.gcsimKey]));

  const records: KeyMapRecord[] = [];
  const genshinOnly: KeyMapSection['genshinOnly'] = [];
  for (const item of items) {
    const manualKey = manualById.get(item.id);
    if (manualKey !== undefined) {
      if (dm[manualKey]) records.push({ ...item, gcsimKey: manualKey, source: 'manual' });
      else genshinOnly.push({ id: item.id, name: item.name });
      continue;
    }
    const keys = keysByGenshinId.get(item.genshinId);
    if (keys?.length === 1) records.push({ ...item, gcsimKey: keys[0], source: 'dm.json' });
    else genshinOnly.push({ id: item.id, name: item.name });
  }

  const usedKeys = new Set(records.map(r => r.gcsimKey));
  const gcsimOnly = Object.values(dm)
    .filter(entry => !usedKeys.has(entry.key))
    .map(entry => ({ gcsimKey: entry.key, genshinId: entry.id }))
    .sort((a, b) => a.gcsimKey.localeCompare(b.gcsimKey));

  return { gcsimCommit, records, genshinOnly, gcsimOnly };
}

/** 表から、マスターのキー → gcsim キー の引き表を作る */
export const keyMapLookup = (section: KeyMapSection): Map<string, string> =>
  new Map(section.records.map(r => [r.id, r.gcsimKey]));
