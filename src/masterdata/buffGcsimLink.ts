/**
 * 発動バフと gcsim のキーの辞書の結び付け（フェーズ5 / 5-6、D28・D38〜D41・D52）
 *
 * マスターの発動バフ（固有天賦・武器・聖遺物）の定義に、gcsim の辞書（gcsim_key_catalog.json）のキーと分類を付け、
 * gcsim にだけある時間つきの効果（命ノ星座・武器）を、発動バフの新しい定義として追加する。
 * 生成済みのマスターに対して後から適用する処理（純粋関数。マスターは書き換える）。
 *
 * 分類（D40）:
 *   computed    … 辞書に、時間つきの効果のキーがある（gcsim が発動位置を計算する）
 *   always      … 辞書の効果が永続のみ（常時）
 *   conditional … 上のどちらでもない（既定。辞書に効果のキーはあるが時間が分からない・辞書に効果のキーが無い）
 * gcsim 対象外（gcsimTarget = false）: gcsim 未実装のキャラ・武器・聖遺物、辞書に効果のキーが無いもの
 */
import type { KeyCatalog, KeyCatalogEntry } from './gcsimKeyCatalog.ts';
import type {
  BuffTiming, CharacterConfig, ConstellationBuffDefinition, ConstellationLevel, GcsimBuffLink, PassiveEffectDefinition,
} from '../types/genshin.ts';
import type { ArtifactSetDatabaseItem, EquipmentBuffDefinition, WeaponDatabaseItem } from '../types/database.ts';

/** 時間つきの効果とみなす最短の継続時間（フレーム）。これより短いものは内部の猶予として扱う */
const MIN_TIMED_FRAMES = 30;
/** 発動間隔（CT）とみなす最短の長さ（フレーム。1 秒未満は効果を重ねる間隔・内部の間隔） */
const MIN_COOLDOWN_FRAMES = 60;
/** gcsim の値で、genshin-db に無い継続時間を補うときの最短（フレーム）。これより短い効果（内部の猶予・判定）は補わない */
const MIN_FILL_FRAMES = 120;

const framesToSec = (f: number) => Number((f / 60).toFixed(3));

// ---------------------------------------------------------------------------
// 辞書の索引
// ---------------------------------------------------------------------------

export interface CatalogIndex {
  /** 持ち主（gcsim のキャラ・武器・聖遺物のキー）→ その持ち主のキー */
  byOwner: Map<string, KeyCatalogEntry[]>;
  /** 共有パッケージ（weapons/common）にあるキー。武器ごとに割り当てる */
  shared: KeyCatalogEntry[];
}

export function indexCatalog(catalog: Pick<KeyCatalog, 'entries'>): CatalogIndex {
  const byOwner = new Map<string, KeyCatalogEntry[]>();
  const shared: KeyCatalogEntry[] = [];
  for (const e of catalog.entries) {
    if (e.isPattern) continue;
    if (e.owner.type === 'weapon' && e.owner.gcsimKey === 'common') {
      shared.push(e);
      continue;
    }
    if (e.owner.type !== 'character' && e.owner.type !== 'weapon' && e.owner.type !== 'artifact') continue;
    for (const key of e.owner.gcsimKeys ?? [e.owner.gcsimKey]) {
      if (!byOwner.has(key)) byOwner.set(key, []);
      byOwner.get(key)!.push(e);
    }
  }
  return { byOwner, shared };
}

/** 共有パッケージのキー → どの武器のものか（武器の gcsim キーの条件）。golden-majesty は 4 本の武器、他は武器シリーズ */
const SHARED_WEAPON_RULES: Array<{ keyPrefix: string; weapon: (weaponKey: string) => boolean }> = [
  { keyPrefix: 'golden-majesty', weapon: k => ['memoryofdust', 'summitshaper', 'theunforged', 'vortexvanquisher'].includes(k) },
  { keyPrefix: 'blackcliff', weapon: k => k.startsWith('blackcliff') },
  { keyPrefix: 'lithic', weapon: k => k.startsWith('lithic') },
  { keyPrefix: 'royal', weapon: k => k.startsWith('royal') },
  { keyPrefix: 'wavebreaker', weapon: k => k.startsWith('wavebreaker') },
  { keyPrefix: 'favonius', weapon: k => k.startsWith('favonius') },
  { keyPrefix: 'sacrificial', weapon: k => k.startsWith('sacrificial') },
];

const tokensOf = (e: KeyCatalogEntry) => e.key.split('-');
const hasToken = (e: KeyCatalogEntry, re: RegExp) => tokensOf(e).some(t => re.test(t));

const isTimed = (e: KeyCatalogEntry) => !e.permanent && (e.durationFrames ?? 0) >= MIN_TIMED_FRAMES;

// ---------------------------------------------------------------------------
// 分類
// ---------------------------------------------------------------------------

interface Summary extends Required<Pick<GcsimBuffLink, 'timing' | 'gcsimTarget'>> {
  gcsimKeys?: string[];
  gcsimCooldownKeys?: string[];
  /** 時間つきの効果のうち最長（秒） */
  duration?: number;
  durationKey?: string;
  /** genshin-db に継続時間が無いときに補う値（2 秒以上の時間つきの効果の最長。内部の確認用のキーは除く） */
  fillDuration?: number;
  fillKey?: string;
  /** 発動間隔（秒。1 つに決まるときだけ） */
  cooldown?: number;
  cooldownKey?: string;
}

/** 辞書のキー（効果・発動間隔）から、分類と対応キーをまとめる */
function summarize(entries: KeyCatalogEntry[]): Summary {
  const effects = entries.filter(e => e.kind === 'effect');
  const cooldowns = entries.filter(e => e.kind === 'cooldown');
  const timed = effects.filter(isTimed);
  const permanent = effects.filter(e => e.permanent);
  const cooldownInfo: Pick<Summary, 'gcsimCooldownKeys' | 'cooldown' | 'cooldownKey'> = {};
  if (cooldowns.length > 0) {
    cooldownInfo.gcsimCooldownKeys = cooldowns.map(e => e.key);
    const long = cooldowns.filter(e => (e.durationFrames ?? 0) >= MIN_COOLDOWN_FRAMES);
    if (long.length === 1) {
      cooldownInfo.cooldown = framesToSec(long[0].durationFrames!);
      cooldownInfo.cooldownKey = long[0].key;
    }
  }
  if (timed.length > 0) {
    const longest = timed.reduce((a, b) => ((b.durationFrames ?? 0) > (a.durationFrames ?? 0) ? b : a));
    const fillable = timed.filter(e => (e.durationFrames ?? 0) >= MIN_FILL_FRAMES && !/check/.test(e.key));
    const fill = fillable.length > 0 ? fillable.reduce((a, b) => ((b.durationFrames ?? 0) > (a.durationFrames ?? 0) ? b : a)) : undefined;
    return {
      timing: 'computed', gcsimTarget: true, gcsimKeys: timed.map(e => e.key), duration: framesToSec(longest.durationFrames!), durationKey: longest.key,
      ...(fill ? { fillDuration: framesToSec(fill.durationFrames!), fillKey: fill.key } : {}),
      ...cooldownInfo,
    };
  }
  if (permanent.length > 0) return { timing: 'always', gcsimTarget: true, gcsimKeys: permanent.map(e => e.key), ...cooldownInfo };
  if (effects.length > 0) return { timing: 'conditional', gcsimTarget: true, gcsimKeys: effects.map(e => e.key), ...cooldownInfo };
  return { timing: 'conditional', gcsimTarget: false, ...cooldownInfo };
}

/** 定義に、対応キーと分類を書く（gcsim のキーが無ければ「対象外」） */
function applyLink(def: GcsimBuffLink, s: Summary): void {
  def.timing = s.timing;
  def.gcsimTarget = s.gcsimTarget;
  if (s.gcsimKeys?.length) def.gcsimKeys = s.gcsimKeys; else delete def.gcsimKeys;
  if (s.gcsimCooldownKeys?.length) def.gcsimCooldownKeys = s.gcsimCooldownKeys; else delete def.gcsimCooldownKeys;
}

// ---------------------------------------------------------------------------
// レポート
// ---------------------------------------------------------------------------

export interface BuffLinkReport {
  /** 分類ごとの定義数（種別ごと） */
  counts: Record<string, Record<BuffTiming | 'unsupported', number>>;
  /** genshin-db に時間が無く、gcsim の時間で補った定義 */
  durationFilled: Array<{ id: string; name: string; duration: number; source: string }>;
  /** 追加した定義（命ノ星座・武器） */
  added: Array<{ id: string; name: string; sourceName: string; duration?: number; keys: string[] }>;
  /** 命ノ星座のキーのうち、定義にしなかったもの: 永続のみの凸（常時。定義にせず辞書から直接扱う）、時間が分からない凸、凸の番号が分からないキー */
  constellationSkipped: { permanentOnly: number; unknownDuration: number; noLevel: number };
}

export const emptyBuffLinkReport = (): BuffLinkReport => ({
  counts: {}, durationFilled: [], added: [], constellationSkipped: { permanentOnly: 0, unknownDuration: 0, noLevel: 0 },
});

function count(report: BuffLinkReport, kind: string, def: GcsimBuffLink): void {
  report.counts[kind] ??= { always: 0, conditional: 0, computed: 0, unsupported: 0 };
  report.counts[kind][def.gcsimTarget ? (def.timing ?? 'conditional') : 'unsupported']++;
}

// ---------------------------------------------------------------------------
// キャラ: 固有天賦・命ノ星座
// ---------------------------------------------------------------------------

/**
 * キャラの発動バフを辞書と結び付ける。
 *   - 固有天賦: キーの名前に a1（固有天賦1）/ a4（固有天賦2）を含むものを、その枠の定義に対応させる。
 *     1 つの枠に定義が複数ある（継続時間が別の効果）ときは、継続時間が合うキーを、合うものが無ければ全てのキーを対応させる。
 *     genshin-db に継続時間・CT が無い定義には、gcsim の値（時間つきの効果の最長・発動間隔）を入れる（D33）
 *   - 命ノ星座: 名前に c1〜c6 を含む時間つきの効果のキーを、凸ごとに 1 つの定義にする
 */
export function linkCharacterBuffs(characters: CharacterConfig[], index: CatalogIndex): BuffLinkReport {
  const report = emptyBuffLinkReport();
  for (const char of characters) {
    const key = char.source?.gcsimKey;
    const entries = key ? index.byOwner.get(key) ?? [] : [];

    // 固有天賦
    for (const slot of [1, 2] as const) {
      const defs = (char.passiveEffects ?? []).filter(p => p.talentSlot === slot);
      if (defs.length === 0) continue;
      let slotEntries = entries.filter(e => hasToken(e, slot === 1 ? /^a1$/ : /^a4$/));
      // a1 / a4 の名前を持つキーが無いキャラは、固有天賦のファイル（asc.go）で登録された時間つきのキーを、継続時間が合う枠の定義に対応させる
      const named = entries.some(e => hasToken(e, /^a[14]$/));
      const ascKeys = named ? [] : entries.filter(e => e.category === 'talent' && !hasToken(e, /^c[1-6]$/));
      for (const def of defs) {
        let mine = slotEntries;
        if (!named && def.duration !== undefined) {
          mine = ascKeys.filter(e => e.durationFrames !== undefined && Math.abs(framesToSec(e.durationFrames) - def.duration!) < 0.05);
        } else if (defs.length > 1 && def.duration !== undefined) {
          const sameLength = slotEntries.filter(e => e.durationFrames !== undefined && Math.abs(framesToSec(e.durationFrames) - def.duration!) < 0.05);
          if (sameLength.length > 0) mine = sameLength;
        }
        const s = summarize(mine);
        applyLink(def, s);
        fillFromGcsim(def, s, report);
        count(report, 'talent', def);
      }
    }

    // 命ノ星座
    const effects: ConstellationBuffDefinition[] = [];
    if (key) {
      const byLevel = new Map<number, KeyCatalogEntry[]>();
      for (const e of entries) {
        const m = tokensOf(e).map(t => /^c([1-6])$/.exec(t)).find(Boolean);
        if (!m) {
          if (e.category === 'constellation' && e.kind === 'effect') report.constellationSkipped.noLevel++;
          continue;
        }
        const level = Number(m[1]);
        if (!byLevel.has(level)) byLevel.set(level, []);
        byLevel.get(level)!.push(e);
      }
      for (const [level, list] of [...byLevel].sort((a, b) => a[0] - b[0])) {
        const s = summarize(list);
        if (s.timing !== 'computed') {
          const effectsOnly = list.filter(e => e.kind === 'effect');
          if (effectsOnly.some(e => e.permanent)) report.constellationSkipped.permanentOnly++;
          else if (effectsOnly.length > 0) report.constellationSkipped.unknownDuration++;
          continue;
        }
        const data = char.constellations?.find(c => c.level === level);
        const def: ConstellationBuffDefinition = {
          id: `${char.id}_c${level}`,
          level: level as ConstellationLevel,
          name: data?.name ?? `${level}凸`,
          duration: s.duration,
          ...(s.cooldown !== undefined ? { cooldown: s.cooldown } : {}),
          ...(data?.description ? { description: data.description } : {}),
          dataSource: { duration: `gcsim: ${s.durationKey}`, ...(s.cooldownKey ? { cooldown: `gcsim: ${s.cooldownKey}` } : {}) },
        };
        applyLink(def, s);
        effects.push(def);
        count(report, 'constellation', def);
        report.added.push({ id: def.id, name: `${char.name} ${level}凸「${def.name}」`, sourceName: char.name, duration: def.duration, keys: def.gcsimKeys ?? [] });
      }
    }
    if (effects.length > 0) char.constellationEffects = effects;
    else delete char.constellationEffects;
  }
  return report;
}

/** genshin-db に継続時間・CT が無い定義に、gcsim の値を入れる（genshin-db の値があれば使わない。D33） */
function fillFromGcsim(def: PassiveEffectDefinition, s: Summary, report: BuffLinkReport): void {
  if (def.duration === undefined && s.fillDuration !== undefined) {
    def.duration = s.fillDuration;
    def.dataSource = { ...def.dataSource, duration: `gcsim: ${s.fillKey}` };
    report.durationFilled.push({ id: def.id, name: def.name, duration: s.fillDuration, source: s.fillKey! });
  }
  if (def.cooldown === undefined && s.cooldown !== undefined) {
    def.cooldown = s.cooldown;
    def.dataSource = { ...def.dataSource, cooldown: `gcsim: ${s.cooldownKey}` };
  }
}

// ---------------------------------------------------------------------------
// 武器・聖遺物
// ---------------------------------------------------------------------------

/** 武器の gcsim のキーに対応する辞書のキー（個別のキー ＋ 共有パッケージのキー） */
function weaponEntries(weaponKey: string, index: CatalogIndex): KeyCatalogEntry[] {
  const own = index.byOwner.get(weaponKey) ?? [];
  const shared = index.shared.filter(e => SHARED_WEAPON_RULES.some(r => e.key.startsWith(r.keyPrefix) && r.weapon(weaponKey)));
  return [...own, ...shared];
}

/**
 * 武器・聖遺物の発動バフを辞書と結び付ける。
 *   - 武器: 持ち主が武器の全ての効果のキー（共有パッケージのキーは武器シリーズごとに割り当て）を、その武器の定義に対応させる
 *   - 聖遺物: セットの効果のキーのうち、2 セット効果（名前に 2pc）を除いたものを、4 セットの定義に対応させる
 *   - 武器に定義が無く、辞書に時間つきの効果がある場合は、新しい定義を追加する（若水・アースシェイカーなど。D28）
 */
export function linkEquipmentBuffs(
  weapons: WeaponDatabaseItem[],
  artifacts: ArtifactSetDatabaseItem[],
  index: CatalogIndex,
): BuffLinkReport {
  const report = emptyBuffLinkReport();

  for (const w of weapons) {
    const entries = w.gcsimKey ? weaponEntries(w.gcsimKey, index) : [];
    const defs = w.buffEffects ?? [];
    const s = summarize(entries);
    if (defs.length > 0) {
      for (const def of defs) {
        applyLink(def, s);
        count(report, 'weapon', def);
      }
    } else if (s.timing === 'computed') {
      const def: EquipmentBuffDefinition = {
        id: `wbuff_${w.id}`,
        name: w.passiveName || w.name,
        sourceType: 'weapon',
        sourceId: w.id,
        duration: s.duration,
        ...(s.cooldown !== undefined ? { cooldown: s.cooldown } : {}),
        description: w.description,
        dataSource: { duration: `gcsim: ${s.durationKey}`, ...(s.cooldownKey ? { cooldown: `gcsim: ${s.cooldownKey}` } : {}) },
      };
      applyLink(def, s);
      w.buffEffects = [def];
      count(report, 'weapon', def);
      report.added.push({ id: def.id, name: `${w.name}「${def.name}」`, sourceName: w.name, duration: def.duration, keys: def.gcsimKeys ?? [] });
    }
  }

  for (const a of artifacts) {
    const entries = (a.gcsimKey ? index.byOwner.get(a.gcsimKey) ?? [] : []).filter(e => !hasToken(e, /^2pc$/));
    const s = summarize(entries);
    for (const def of a.buffEffects ?? []) {
      applyLink(def, s);
      count(report, 'artifact', def);
    }
  }
  return report;
}
