/**
 * gcsim キーの表示名の元データ（genshin-db の日本語・英語の名前）を集める（scripts/build-key-catalog.ts から使う）。
 * 照合表（src/data/gcsim_key_map.json）で、gcsim のキー ↔ 公式ID を引き、公式IDで genshin-db の名前を引く（名前では突き合わせない。D34）。
 */
import fs from 'node:fs';
import path from 'node:path';
import type { CharacterNames, LanguageNames, NameSources } from '../src/masterdata/gcsimKeyNames.ts';

const API = 'https://genshin-db-api.vercel.app/api/v5';
const QUERY = 'query=names&matchCategories=true&verboseCategories=true';

/** 旅人の天賦・命ノ星座は元素ごとに別エントリ（genshin-db の id）。gcsim のキーは `aether<元素>` / `lumine<元素>` */
const TRAVELER_TALENT_ID: Record<string, number> = { anemo: 704, cryo: 705, dendro: 708, electro: 707, geo: 706, hydro: 703, pyro: 702 };

interface Named { name: string }
interface GdbTalent { id: number; name: string; combat2?: Named; combat3?: Named; passive1?: Named; passive2?: Named }
interface GdbConstellation { id: number; name: string; c1?: Named; c2?: Named; c3?: Named; c4?: Named; c5?: Named; c6?: Named }
interface GdbWeapon { id: number; name: string; effectName?: string }
interface GdbArtifact { id: number; name: string }
interface GdbCharacter { id: number; name: string }

async function fetchList<T>(category: string, language: 'Japanese' | 'English'): Promise<T[]> {
  const res = await fetch(`${API}/${category}?${QUERY}&resultLanguage=${language}`);
  if (!res.ok) throw new Error(`genshin-db ${category} (${language}): HTTP ${res.status}`);
  return res.json() as Promise<T[]>;
}

interface KeyMapRecord { genshinId: number; name: string; gcsimKey: string }

export async function loadNameSources(): Promise<NameSources> {
  const keyMap = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data/gcsim_key_map.json'), 'utf-8')) as {
    characters: { records: KeyMapRecord[] };
    weapons: { records: KeyMapRecord[] };
    artifacts: { records: KeyMapRecord[] };
  };

  const build = async (language: 'Japanese' | 'English'): Promise<LanguageNames> => {
    const [chars, talents, constellations, weapons, artifacts] = await Promise.all([
      fetchList<GdbCharacter>('characters', language),
      fetchList<GdbTalent>('talents', language),
      fetchList<GdbConstellation>('constellations', language),
      fetchList<GdbWeapon>('weapons', language),
      fetchList<GdbArtifact>('artifacts', language),
    ]);
    const charById = new Map(chars.map(c => [c.id, c.name]));
    const talentById = new Map(talents.map(t => [t.id, t]));
    const constellationById = new Map(constellations.map(c => [c.id, c]));

    const result: LanguageNames = { characters: new Map(), weapons: new Map(), artifacts: new Map() };
    for (const r of keyMap.characters.records) {
      const traveler = /^(?:aether|lumine)(\w+)$/.exec(r.gcsimKey);
      const talentId = traveler ? TRAVELER_TALENT_ID[traveler[1]] : (r.genshinId - 10000000) * 100 + 1;
      const talent = talentById.get(talentId);
      const constellation = constellationById.get(talentId);
      const name: CharacterNames = {
        name: traveler ? (language === 'Japanese' ? '旅人' : 'Traveler') : charById.get(r.genshinId) ?? r.name,
        skill: talent?.combat2?.name,
        burst: talent?.combat3?.name,
        passive1: talent?.passive1?.name,
        passive2: talent?.passive2?.name,
        constellations: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(k => (constellation?.[k as 'c1']?.name) ?? ''),
      };
      result.characters.set(r.gcsimKey, name);
    }
    const weaponById = new Map(weapons.map(w => [w.id, w]));
    for (const r of keyMap.weapons.records) {
      const w = weaponById.get(r.genshinId);
      if (w) result.weapons.set(r.gcsimKey, { name: w.name, ...(w.effectName ? { effect: w.effectName } : {}) });
    }
    const artifactById = new Map(artifacts.map(a => [a.id, a]));
    for (const r of keyMap.artifacts.records) {
      const a = artifactById.get(r.genshinId);
      if (a) result.artifacts.set(r.gcsimKey, { name: a.name });
    }
    return result;
  };

  const [ja, en] = await Promise.all([build('Japanese'), build('English')]);
  return { ja, en };
}
