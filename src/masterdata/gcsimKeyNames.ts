/**
 * gcsim キーの表示名の自動付与（フェーズ5 / 5-2b の続き）
 *
 * gcsim のキー（例: `lauma-a1-ascendant`、`khaj-nisut-team-buff`）には日本語名が無いので、
 * 「持ち主の名前（genshin-db）＋ キー名の意味（規則）」で組み立てる。
 *   - キャラのキー: `-a1` = 固有天賦1「天賦名」、`-a4` = 固有天賦2、`-c1`〜`-c6` = 命ノ星座「凸名」、
 *     スキルのキー = 元素スキル「スキル名」、爆発のキー = 元素爆発「爆発名」
 *   - 武器のキー: 武器名（効果名）、聖遺物のキー: セット名 ＋ 2セット / 4セット
 *   - キー名の残り: 語彙表（icd = 発動間隔 など）で日本語にし、分からない語は元のまま（英語）で付ける
 * 手で補う一覧（gcsimKeyCatalogOverrides.ts）の表示名が優先。
 *
 * 表示名の品質（nameSource）:
 *   manual  … 手で補う一覧
 *   rule    … 規則だけで組み立てられた（全ての語を日本語にできた）
 *   partial … 持ち主の名前は日本語だが、キー名の一部が英語のまま
 *   （無し）… 持ち主が分からない（システム・共通のキー）。表示は英語名 → キー名の順に落とす（displayNameOf）
 */
import type { KeyCatalogEntry } from './gcsimKeyCatalog.ts';

/** キャラの名前（日本語 / 英語のどちらか 1 言語分） */
export interface CharacterNames {
  name: string;
  skill?: string;
  burst?: string;
  passive1?: string;
  passive2?: string;
  /** 命ノ星座の名前（1〜6 凸） */
  constellations: string[];
}

export interface WeaponNames {
  name: string;
  effect?: string;
}

export interface LanguageNames {
  characters: Map<string, CharacterNames>;
  weapons: Map<string, WeaponNames>;
  artifacts: Map<string, { name: string }>;
}

/** 表示名の元データ。キーは gcsim のキー（キャラ・武器・聖遺物） */
export interface NameSources {
  ja: LanguageNames;
  en: LanguageNames;
}

export type NameSource = 'manual' | 'rule' | 'partial';

const ELEMENTS_JA: Record<string, string> = {
  pyro: '炎', hydro: '水', electro: '雷', cryo: '氷', dendro: '草', anemo: '風', geo: '岩', physical: '物理',
};
const ELEMENTS_EN: Record<string, string> = {
  pyro: 'Pyro', hydro: 'Hydro', electro: 'Electro', cryo: 'Cryo', dendro: 'Dendro', anemo: 'Anemo', geo: 'Geo', physical: 'Physical',
};

/** キー名の語 → [日本語, 英語]。複数語の並びは長いものから先に一致させる */
const VOCABULARY: Array<[string[], string, string]> = [
  [['particle', 'icd'], '元素粒子の発生間隔', 'Particle interval'],
  [['team', 'buff'], 'バフ（チーム）', 'Team buff'],
  [['icd'], '発動間隔', 'Interval'],
  [['cooldown'], 'クールタイム', 'Cooldown'],
  [['buff'], 'バフ', 'Buff'],
  [['stack'], 'スタック', 'Stack'],
  [['stacks'], 'スタック', 'Stacks'],
  [['em'], '元素熟知', 'Elemental Mastery'],
  [['hp'], 'HP', 'HP'],
  [['hpp'], 'HP%', 'HP%'],
  [['atk'], '攻撃力', 'ATK'],
  [['def'], '防御力', 'DEF'],
  [['cr'], '会心率', 'CRIT Rate'],
  [['dmg'], 'ダメージ', 'DMG'],
  [['shred'], '耐性ダウン', 'RES shred'],
  [['debuff'], 'デバフ', 'Debuff'],
  [['timer'], 'タイマー', 'Timer'],
  [['ascendant'], '月兆', 'Ascendant'],
  [['within'], '領域内', 'Within'],
  [['recast'], '再発動', 'Recast'],
  [['hold'], '長押し', 'Hold'],
  [['skill'], 'スキル', 'Skill'],
  [['burst'], '爆発', 'Burst'],
  [['element'], '（元素別）', '(per element)'],
  [['na'], '通常攻撃', 'Normal Attack'],
  [['ca'], '重撃', 'Charged Attack'],
  [['normal'], '通常攻撃', 'Normal Attack'],
  [['plunge'], '落下攻撃', 'Plunge'],
  [['press'], '一回押し', 'Press'],
  [['energy'], 'エネルギー', 'Energy'],
  [['bonus'], 'ボーナス', 'Bonus'],
  [['boost'], '強化', 'Boost'],
  [['heal'], '回復', 'Heal'],
  [['window'], '猶予', 'Window'],
  [['mark'], '印', 'Mark'],
  [['field'], '領域', 'Field'],
  [['crit'], '会心', 'CRIT'],
  [['atkspd'], '攻撃速度', 'ATK SPD'],
  [['atkp'], '攻撃力%', 'ATK%'],
  [['defp'], '防御力%', 'DEF%'],
  [['extra'], '追加', 'Extra'],
  [['active'], '発動中', 'Active'],
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Part {
  ja: string;
  en: string;
  /** 語彙表・元素で日本語にできたか（false = 英語のまま） */
  translated: boolean;
}

/** キー名の残りの語（接頭辞・a1/cN/スキル/爆発を除いたもの）を、語彙表で日本語・英語にする */
function describeTokens(tokens: string[], kind: KeyCatalogEntry['kind']): Part[] {
  const parts: Part[] = [];
  let i = 0;
  while (i < tokens.length) {
    // 「-cd」は、効果として登録されたものは会心ダメージ、CT として登録されたものは発動間隔
    if (tokens[i] === 'cd') {
      parts.push(kind === 'cooldown' || kind === 'internal'
        ? { ja: '発動間隔', en: 'Interval', translated: true }
        : { ja: '会心ダメージ', en: 'CRIT DMG', translated: true });
      i++;
      continue;
    }
    const element = ELEMENTS_JA[tokens[i]];
    if (element) {
      parts.push({ ja: element, en: ELEMENTS_EN[tokens[i]], translated: true });
      i++;
      continue;
    }
    const hit = VOCABULARY.find(([words]) => words.every((w, k) => tokens[i + k] === w));
    if (hit) {
      parts.push({ ja: hit[1], en: hit[2], translated: true });
      i += hit[0].length;
      continue;
    }
    parts.push({ ja: tokens[i], en: cap(tokens[i]), translated: false });
    i++;
  }
  return parts;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const STOP_WORDS = /^(of|the|a|an|and)$/i;

/**
 * キー名の先頭が持ち主を表す語なら取り除く。
 *   - 持ち主のキーの先頭部分（`lauma` ← `lauma`、`nocturnes` ← `nocturnescurtaincall`）
 *   - 持ち主の英語名の先頭部分（`covenant-of-frost-and-snow` ← "Covenant of Frost and Snow"）、名前に含まれる語（`ayaka` ← "Kamisato Ayaka"）、頭文字（`bs` ← "Blizzard Strayer"）
 */
function stripOwnerPrefix(tokens: string[], ownerKey: string, enName?: string): string[] {
  const owner = ownerKey.toLowerCase();
  // 持ち主のキー・英語名の先頭にあたる最も長い語の並びを取り除く（`covenant-of-frost-and-snow-em`、`a-thousand-floating-dreams-...`）
  const target = enName ? norm(enName) : '';
  for (let n = tokens.length; n >= 2; n--) {
    const joined = tokens.slice(0, n).join('');
    if (joined === owner || (joined.length >= 6 && (owner.startsWith(joined) || target.startsWith(joined)))) return tokens.slice(n);
  }
  // 1 語目が持ち主のキーの先頭部分（`lauma` ← `lauma`、`nocturnes` ← `nocturnescurtaincall`）
  if (tokens.length > 0 && tokens[0].length >= 3 && owner.startsWith(tokens[0])) return tokens.slice(1);
  if (enName) {
    if (tokens[0] && tokens[0].length >= 4 && target.startsWith(tokens[0])) return tokens.slice(1);
    if (tokens[0] && tokens[0].length >= 4 && target.includes(tokens[0])) return tokens.slice(1);
    const initials = enName.split(/[\s-]+/).filter(w => w && !STOP_WORDS.test(w)).map(w => w[0].toLowerCase()).join('');
    if (initials.length >= 2 && tokens[0] === initials) return tokens.slice(1);
  }
  return tokens;
}

function ownerKeyOf(entry: KeyCatalogEntry): string | undefined {
  const t = entry.owner.type;
  return t === 'character' || t === 'weapon' || t === 'artifact' ? entry.owner.gcsimKey : undefined;
}

/** 1 言語分の表示名を組み立てる。持ち主が分からないときは undefined */
function compose(
  entry: KeyCatalogEntry,
  lang: 'ja' | 'en',
  names: LanguageNames,
  english: LanguageNames,
): { text: string; complete: boolean } | undefined {
  const ownerKey = ownerKeyOf(entry);
  if (!ownerKey) return undefined;
  const ja = lang === 'ja';
  const enName = entry.owner.type === 'weapon' ? english.weapons.get(ownerKey)?.name
    : entry.owner.type === 'artifact' ? english.artifacts.get(ownerKey)?.name
    : english.characters.get(ownerKey)?.name;
  const tokens = stripOwnerPrefix(entry.key.replace(/[{}*]/g, '-').split('-').filter(Boolean), ownerKey, enName);

  if (entry.owner.type === 'weapon') {
    const w = names.weapons.get(ownerKey);
    if (!w) return undefined;
    const base = w.effect ? `${w.name}${ja ? `（${w.effect}）` : ` (${w.effect})`}` : w.name;
    const parts = describeTokens(tokens, entry.kind);
    return { text: parts.length > 0 ? `${base}: ${parts.map(p => (ja ? p.ja : p.en)).join(ja ? ' ' : ' ')}` : base, complete: parts.every(p => p.translated) };
  }

  if (entry.owner.type === 'artifact') {
    const a = names.artifacts.get(ownerKey);
    if (!a) return undefined;
    // `2pc` / `4pc`（`tom-4pc-icd`、`dm-2pc`）
    const rest = [...tokens];
    const pcIndex = rest.findIndex(t => t === '2pc' || t === '4pc');
    let base = a.name;
    if (pcIndex >= 0) {
      const n = rest.splice(pcIndex, 1)[0][0];
      base = ja ? `${a.name} ${n}セット` : `${a.name} ${n}-Piece`;
    }
    const parts = describeTokens(rest, entry.kind);
    return { text: parts.length > 0 ? `${base}: ${parts.map(p => (ja ? p.ja : p.en)).join(' ')}` : base, complete: parts.every(p => p.translated) };
  }

  // キャラ（スキル・爆発・固有天賦・命ノ星座・通常攻撃・その他）
  const c = names.characters.get(ownerKey);
  if (!c) return undefined;
  const rest = [...tokens];
  let role = '';
  const take = (pattern: RegExp): RegExpExecArray | undefined => {
    const i = rest.findIndex(t => pattern.test(t));
    if (i < 0) return undefined;
    const m = pattern.exec(rest[i])!;
    rest.splice(i, 1);
    return m;
  };
  let m: RegExpExecArray | undefined;
  if ((m = take(/^a([14])$/))) {
    const title = m[1] === '1' ? c.passive1 : c.passive2;
    role = ja ? `固有天賦${m[1] === '1' ? 1 : 2}${title ? `「${title}」` : ''}` : `Ascension ${m[1] === '1' ? 1 : 2} Passive${title ? ` "${title}"` : ''}`;
  } else if ((m = take(/^c([1-6])$/))) {
    const title = c.constellations[Number(m[1]) - 1];
    role = ja ? `命ノ星座${m[1]}${title ? `「${title}」` : ''}` : `Constellation ${m[1]}${title ? ` "${title}"` : ''}`;
  } else if (take(/^(e|skill)$/) || entry.category === 'skill') {
    role = ja ? `元素スキル${c.skill ? `「${c.skill}」` : ''}` : `Elemental Skill${c.skill ? ` "${c.skill}"` : ''}`;
  } else if (take(/^(q|burst)$/) || entry.category === 'burst') {
    role = ja ? `元素爆発${c.burst ? `「${c.burst}」` : ''}` : `Elemental Burst${c.burst ? ` "${c.burst}"` : ''}`;
  } else if (entry.category === 'attack') {
    role = ja ? '通常攻撃' : 'Normal Attack';
  }
  const parts = describeTokens(rest, entry.kind);
  const tail = parts.map(p => (ja ? p.ja : p.en)).join(' ');
  const head = role ? `${c.name} ${role}` : c.name;
  return { text: tail ? `${head}: ${tail}` : head, complete: parts.every(p => p.translated) };
}

export interface NamingReport {
  manual: number;
  rule: number;
  partial: number;
  /** 持ち主が分からず、表示名を付けられなかったキー（表示は英語名 → キー名） */
  unnamed: number;
}

/** 手で補う一覧に表示名が無いキーへ、表示名（日本語 name / 英語 nameEn）を付ける */
export function assignNames(entries: KeyCatalogEntry[], sources: NameSources): NamingReport {
  const report: NamingReport = { manual: 0, rule: 0, partial: 0, unnamed: 0 };
  for (const e of entries) {
    const en = compose(e, 'en', sources.en, sources.en);
    if (en) e.nameEn = en.text;
    if (e.name) {
      e.nameSource = 'manual';
      report.manual++;
      continue;
    }
    const ja = compose(e, 'ja', sources.ja, sources.en);
    if (!ja) {
      report.unnamed++;
      continue;
    }
    e.name = ja.text;
    e.nameSource = ja.complete ? 'rule' : 'partial';
    report[e.nameSource]++;
  }
  return report;
}

/** 表示する名前: 日本語名 → 英語名 → キー名の順に落とす */
export function displayNameOf(entry: Pick<KeyCatalogEntry, 'name' | 'nameEn' | 'key'>): string {
  return entry.name ?? entry.nameEn ?? entry.key;
}
