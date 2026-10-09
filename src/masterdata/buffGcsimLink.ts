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
import { isDisplayWorthyNature, natureOfText, NATURE_EXCEPTIONS } from './effectNature.ts';
import type { KeyCatalog, KeyCatalogEntry } from './gcsimKeyCatalog.ts';
import { findDurations } from './passiveEffects.ts';
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

/**
 * 効果継続時間に意味が無い固有天賦（条件を満たすたびにほぼ常時発動する・発動間隔が効果の時間ではない・スキルの状態やゲージで終わりが決まる）。
 * gcsim に時間つきのキーがあっても、継続時間を補わず、分類は「条件付き」にする（キーは対応付けたまま）。キー: 固有天賦の定義 ID
 */
export const NO_DURATION_TALENTS: Record<string, string> = {
  '10000029-pyro_p1': 'クレー こんこんプレゼント: 条件付きでほぼ常時発動する',
  '10000070-hydro_p2': 'ニィロウ 軽やかに舞う永世の夢: 条件付きでほぼ常時発動する',
  '10000083-anemo_p2': 'リネット プロップは完備: 条件付きでほぼ常時発動する',
  '10000075-anemo_p2': '放浪者 夢跡一風: 条件付きでほぼ常時発動する',
  '10000068-electro_p1': 'ドリー ゴールドマイニング: 3 秒は発動間隔（CT）で、効果は瞬間',
  '10000075-anemo_p1': '放浪者 拾玉得花: スキルの状態（20秒）より先に、別管理のゲージの消費で終わる',
};

/** 同じ固有天賦でも、gcsim が別キーで記録する効果は1定義に集約し、キーごとに別バーを作る。 */
const TALENT_KEY_ADDITIONS: Record<string, string[]> = {
  // A1 のスキル起動（20秒）と、月兆・満照時の常時攻撃補正は別効果・別バー。
  '10000119-dendro_p1': ['light-for-the-frosty-night'],
};

/**
 * 効果継続時間に意味が無い命ノ星座の効果（領域・状態が続く間だけ有効で、gcsim の値は更新の間隔・継続時間が無い・瞬間の効果）。
 * 定義は作るが、継続時間は持たない（分類は「条件付き」。キーは対応付けたまま）。キー: 命ノ星座の効果の定義 ID（`<キャラID>_c<凸>`）
 */
export const NO_DURATION_CONSTELLATIONS: Record<string, string> = {
  '10000003-anemo_c4': 'ジン 4凸: 領域内の敵に有効（更新の間隔）',
  '10000005-dendro_c6': '空(草) 6凸: 草蓮灯の影響を受けている間',
  '10000007-dendro_c6': '蛍(草) 6凸: 草蓮灯の影響を受けている間',
  '10000005-geo_c1': '空(岩) 1凸: 岩の山に包囲されている間',
  '10000007-geo_c1': '蛍(岩) 1凸: 岩の山に包囲されている間',
  '10000006-electro_c2': 'リサ 2凸: 蒼雷長押し中',
  '10000038-geo_c4': 'アルベド 4凸: 陽華のエリア内',
  '10000038-geo_c6': 'アルベド 6凸: 陽華のエリア内',
  '10000039-cryo_c6': 'ディオナ 6凸: 特製スピリッツのエリア内',
  '10000068-electro_c4': 'ドリー 4凸: ランプの精とリンクしている間',
  '10000047-anemo_c2': '万葉 2凸: 流風秋野の中',
  '10000106-pyro_c2': 'マーヴィカ 2凸: 夜魂の加護状態の間',
  '10000127-geo_c4': 'イルーガ 4凸: 「闇の小夜啼歌」の間',
  '10000035-cryo_c6': '七七 6凸: 復活（CT 15 分）で、継続時間が無い',
  '10000058-electro_c1': '八重神子 1凸: エネルギー回復で、継続時間が無い',
  '10000128-anemo_c6': 'ファルカ 6凸: 使用回数を消費しない、ごく短い猶予',
};

/** 命ノ星座の効果の定義にしないもの（効果ではなく、他の効果の継続時間の延長など）。キー: 定義 ID */
export const EXCLUDED_CONSTELLATIONS: Record<string, string> = {
  '10000110-electro_c6': 'イアンサ 6凸: 運動量メーターの継続時間+3秒（効果ではなく延長）',
};

/**
 * 辞書のキーが、固有天賦の枠（a1 / a4）・命ノ星座の凸（c1〜c6）のどれのものか。
 *   - 登録している関数の名前（asc.go の `a1` / `a1Init` / `makeA4`、cons.go の `c2` など）と、キー名の `a1` / `c2` の 2 つから決める
 *   - 2 つが一致すればその枠。片方だけ分かるときはその枠。食い違う・関数名に複数の枠が含まれる（`c4c6`）ときは、キー名を採用
 *   - 固有天賦は asc.go のキー、命ノ星座は cons.go のキーだけ（他方のファイルだけで登録されたキーは、名前が似ていても対象にしない）
 */
export function slotOfEntry(e: KeyCatalogEntry, kind: 'a' | 'c'): number | undefined {
  const otherFile = kind === 'a' ? /[/]cons[.]go$/ : /[/]asc[.]go$/;
  if (e.sources.length > 0 && e.sources.every(s => otherFile.test(s.file))) return undefined;
  const ownFile = kind === 'a' ? /[/]asc[.]go$/ : /[/]cons[.]go$/;
  const pattern = kind === 'a' ? /(?<![A-Za-z])[aA]([14])(?![0-9])|(?<=[a-z])A([14])(?![0-9])/g : /(?<![A-Za-z])[cC]([1-6])(?![0-9])|(?<=[a-z])C([1-6])(?![0-9])/g;
  const fromFunc = new Set<number>();
  for (const s of e.sources) {
    if (!ownFile.test(s.file) || !s.func) continue;
    const found = [...s.func.matchAll(pattern)].map(m => Number(m[1] ?? m[2]));
    if (found.length === 1) fromFunc.add(found[0]);
  }
  const tokenRe = kind === 'a' ? /^a([14])$/ : /^c([1-6])$/;
  const fromToken = e.key.split('-').map(x => tokenRe.exec(x)).find(Boolean);
  const byToken = fromToken ? Number(fromToken[1]) : undefined;
  if (byToken !== undefined) return byToken;
  return fromFunc.size === 1 ? [...fromFunc][0] : undefined;
}

/**
 * スキル・爆発のファイル（skill.go・burst.go）で登録されているが、実際は命ノ星座の効果のキー。キー → 凸と役割（D92。2026-10-09）。
 *   - main: その凸の定義の効果のキー（時間つきなら、別のバーになる）
 *   - extra: 同じ効果の別のキー・付随する状態（別のバーにしない。gcsimExtraKeys）
 */
export const CONSTELLATION_KEYS_IN_ACTION_FILES: Record<string, { level: ConstellationLevel; role: 'main' | 'extra' }> = {
  // 夜蘭 4 凸: HP 上限+10%（25 秒）。yelan-c4 と同じ効果の、ステータス変更側のキー
  'yelanc4': { level: 4, role: 'extra' },
  // 夜蘭 6 凸: 「権謀術数」状態（最大 20 秒。打破の矢）
  'yelan_c6': { level: 6, role: 'main' },
  // フリーナ 6 凸: 「万民のまなざし」（10 秒）
  'center-of-attention': { level: 6, role: 'main' },
  // 北斗 6 凸: 雷斫り継続中の雷元素耐性-15%（爆発の効果の間。短い更新のキーなので、バーにしない）
  'beidouc6': { level: 6, role: 'extra' },
};

/**
 * 定義に対応付けないと確認したキー（固有天賦・命ノ星座のファイルで登録されているが、アプリの発動バフの定義にならないもの）。キー → 理由。
 * 新しい gcsim で増えたキーは、マスター生成のレポートの「未確認のキー」に出るので、ここに理由を書くか、規則を直す
 */
export const IGNORED_KEYS: Record<string, string> = {
  // ヘクセライ（魔女会）系の追加の固有天賦。固有天賦 1・2 の枠に属さず、アプリに定義が無い
  'fischl-hexerei-atkp': 'ヘクセライの追加の固有天賦（アプリに定義が無い）',
  'fischl-hexerei-em': 'ヘクセライの追加の固有天賦（アプリに定義が無い）',
  'mona-hexerei-astral-glow-vaporize': 'ヘクセライの追加の固有天賦（アプリに定義が無い）',
  'mona-astral-glow': 'ヘクセライの追加の固有天賦（アプリに定義が無い）',
  'sucrose-hexerei-burst': 'ヘクセライの追加の固有天賦（アプリに定義が無い）',
  'sucrose-hexerei-skill': 'ヘクセライの追加の固有天賦（アプリに定義が無い）',
  'prune-hex-self-buff': 'ヘクセライの追加の固有天賦（アプリに定義が無い）',
  'prune-hex-team-buff': 'ヘクセライの追加の固有天賦（アプリに定義が無い）',
  // 枠（a1 / a4）が読めない固有天賦
  'kokomi-passive': '枠が読めない固有天賦（関数名 passive）',
  'arlecchino-passive': '枠が読めない固有天賦（関数名 passive）',
  // スキル・爆発の効果に付随するもの
  'omen-debuff': 'モナ: スキル・爆発の効果（星異のデバフ）',
  'iansan-c6': 'イアンサ 6凸: 運動量メーターの延長（EXCLUDED_CONSTELLATIONS）',
};

/**
 * 内部の重複防止の間隔（ダメージ・粒子・エネルギー回復などの再発動の制限）のキー。ユーザーに見せる発動制限ではないので、定義に結び付けず「対象外」にする（D90。2026-10-09）。キー → 理由
 */
export const INTERNAL_INTERVAL_KEYS: Record<string, string> = {
  'alhaitham-c1-icd': '内部の重複防止の間隔（1 秒）。ユーザーに見せる発動制限ではない',
  'candace-c6-icd': '内部の重複防止の間隔（2.3 秒）。ユーザーに見せる発動制限ではない',
  'chongyun-c4-icd': '内部の重複防止の間隔（2 秒）。ユーザーに見せる発動制限ではない',
  'dehya-a1-icd': '内部の重複防止の間隔（2 秒）。ユーザーに見せる発動制限ではない',
  'emilie-c1-attack-icd': '内部の重複防止の間隔（2.9 秒）。ユーザーに見せる発動制限ではない',
  'glimbrightIcdKey': '内部の重複防止の間隔（1 秒）。ユーザーに見せる発動制限ではない',
  'kinich-c4-icd-key': '内部の重複防止の間隔（2.8 秒）。ユーザーに見せる発動制限ではない',
  'lanyan-c2-icd': '内部の重複防止の間隔（2 秒）。ユーザーに見せる発動制限ではない',
  'neuvillette-c6-icd': '内部の重複防止の間隔（2 秒）。ユーザーに見せる発動制限ではない',
  'prune-c1-icd': '内部の重複防止の間隔（1.8 秒）。ユーザーに見せる発動制限ではない',
  'razor-hexerei-icd': '内部の重複防止の間隔（2.23 秒）。ユーザーに見せる発動制限ではない',
  'spine-dmgtaken-icd': '内部の重複防止の間隔（1 秒）。ユーザーに見せる発動制限ではない',
  'travelerhydro-c4-icd': '内部の重複防止の間隔（2 秒）。ユーザーに見せる発動制限ではない',
  'wriothesley-c1-icd': '内部の重複防止の間隔（2.5 秒）。ユーザーに見せる発動制限ではない',
  'gaming-c4': '内部の重複防止の間隔（0.2 秒）。ユーザーに見せる発動制限ではない',
};

/**
 * gcsim のキーに結び付けない固有天賦の定義（gcsim に、この効果が無い）。理由は TALENT_NOTE_OVERRIDES に書く。
 * 同じ枠に継続時間の違う定義が複数あり、gcsim のキーの継続時間がどれかに合うときは、合わない定義は、自動で結び付けない（下の linkCharacterBuffs）。
 * 自動で判定できないもの（gcsim のキーの継続時間が決まっていない）を、ここに書く
 */
const UNLINKED_TALENTS: Record<string, string> = {
  '10000131-pyro_p1_2': 'ニコ: 3 秒は、観測の対象が出場してから聖祝の導きに昇格するまでの滞在時間（条件）で、効果の継続時間ではない。昇格した聖祝の導き（gcsim: guidance-of-theosis）は、20 秒の観測の定義（p1_1）に結び付ける',
};

/** gcsim 対象外の固有天賦のうち、効果が元素スキル・爆発の効果（アクションのバー）の中で処理されているもの。理由の文言を、個別に書く */
const TALENT_NOTE_OVERRIDES: Record<string, string> = {
  '10000016-pyro_p2': 'ディルック: 黎明の炎元素付与の延長と炎ダメージ+20% は、gcsim では元素爆発の効果（diluc-q）の中で処理される。元素爆発の効果バーに反映される',
  ...Object.fromEntries(Object.entries(UNLINKED_TALENTS)),
  '10000079-pyro_p1_2': 'ディシア: 熔金の躰（浄焔怒涛の 9 秒後、チーム全員の炎場の中の中断耐性）は、gcsim が未実装（dehya/asc.go のコメント「interrupt res part of a1 is not implemented」。実行でも、状態が付かないことを確認）',
  '10000037-cryo_p2': '甘雨: 降衆天華のエリア内の氷ダメージ+20% は、gcsim では元素爆発の効果（ganyu-field）の中で処理される。元素爆発の効果バーに反映される',
};

const tokensOf = (e: KeyCatalogEntry) => e.key.split('-');
const hasToken = (e: KeyCatalogEntry, re: RegExp) => tokensOf(e).some(t => re.test(t));

const isTimed = (e: KeyCatalogEntry) => !e.permanent && (e.durationFrames ?? 0) >= MIN_TIMED_FRAMES;

// ---------------------------------------------------------------------------
// 分類
// ---------------------------------------------------------------------------

interface Summary extends Required<Pick<GcsimBuffLink, 'timing' | 'gcsimTarget'>> {
  gcsimKeys?: string[];
  gcsimExtraKeys?: string[];
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
  const s = summarizeMain(entries);
  // 主のキー（gcsimKeys）に入らない効果のキーは、extra として残す（永続・時間が分からない・短い判定）
  const main = new Set(s.gcsimKeys ?? []);
  const extra = entries.filter(e => e.kind === 'effect' && !main.has(e.key)).map(e => e.key);
  if (extra.length > 0) s.gcsimExtraKeys = extra;
  return s;
}

function summarizeMain(entries: KeyCatalogEntry[]): Summary {
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
  // 効果のキーは無いが、発動間隔（CT）のキーがある: gcsim が CT を持つ（CT のバーに使える）ので、対象にする
  if (cooldowns.length > 0) return { timing: 'conditional', gcsimTarget: true, ...cooldownInfo };
  return { timing: 'conditional', gcsimTarget: false, ...cooldownInfo };
}

/** gcsim 対象外の理由（画面のホバーの説明。D41） */
function applyNote(def: GcsimBuffLink, hasGcsim: boolean): void {
  if (def.gcsimTarget) {
    delete def.gcsimNote;
    return;
  }
  def.gcsimNote = hasGcsim
    ? 'gcsim に、この効果の状態のキーが無い（即時の効果・ステータス加算・回復・エネルギー回復など）。gcsim の結果では上書きされない'
    : 'gcsim が未実装';
}

/** 定義に、対応キーと分類を書く（gcsim のキーが無ければ「対象外」） */
function applyLink(def: GcsimBuffLink, s: Summary): void {
  def.timing = s.timing;
  def.gcsimTarget = s.gcsimTarget;
  if (s.gcsimKeys?.length) def.gcsimKeys = s.gcsimKeys; else delete def.gcsimKeys;
  if (s.gcsimCooldownKeys?.length) def.gcsimCooldownKeys = s.gcsimCooldownKeys; else delete def.gcsimCooldownKeys;
  if (s.gcsimExtraKeys?.length) def.gcsimExtraKeys = s.gcsimExtraKeys; else delete def.gcsimExtraKeys;
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
  /** 命ノ星座の効果の継続時間を、説明文（genshin-db）の値にしたもの（gcsim の値と食い違うもの） */
  constellationDurationFromText: Array<{ id: string; name: string; text: number; gcsim: number }>;
  /** 固有天賦・命ノ星座のファイルのキーで、定義に対応付けておらず、確認済みの一覧にも無いもの（要確認。0 件になるように IGNORED_KEYS に理由を書く） */
  unreviewedKeys: string[];
}

export const emptyBuffLinkReport = (): BuffLinkReport => ({
  counts: {}, durationFilled: [], added: [], constellationSkipped: { permanentOnly: 0, unknownDuration: 0, noLevel: 0 }, constellationDurationFromText: [], unreviewedKeys: [],
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
      let slotEntries = entries.filter(e => slotOfEntry(e, 'a') === (slot === 1 ? 1 : 4));
      // a1 / a4 の名前を持つキーが無いキャラは、固有天賦のファイル（asc.go）で登録された時間つきのキーを、継続時間が合う枠の定義に対応させる
      const named = entries.some(e => slotOfEntry(e, 'a') !== undefined);
      const ascKeys = named ? [] : entries.filter(e => e.category === 'talent' && !hasToken(e, /^c[1-6]$/));
      for (const def of defs) {
        let mine = slotEntries;
        const matchesLength = (list: KeyCatalogEntry[], d: PassiveEffectDefinition) =>
          d.duration !== undefined ? list.filter(e => e.durationFrames !== undefined && Math.abs(framesToSec(e.durationFrames) - d.duration!) < 0.05) : [];
        if (!named && def.duration !== undefined) {
          mine = ascKeys.filter(e => e.durationFrames !== undefined && Math.abs(framesToSec(e.durationFrames) - def.duration!) < 0.05);
        } else if (defs.length > 1 && def.duration !== undefined) {
          const sameLength = slotEntries.filter(e => e.durationFrames !== undefined && Math.abs(framesToSec(e.durationFrames) - def.duration!) < 0.05);
          if (sameLength.length > 0) mine = sameLength;
          // この定義に合うキーが無く、同じ枠の別の定義が、そのキーに合っているときは、結び付けない（ディシア: 6 秒のキーに、9 秒の効果「熔金の躰」を結び付けない）
          else if (defs.some(other => other !== def && matchesLength(slotEntries, other).length > 0)) mine = [];
        }
        if (UNLINKED_TALENTS[def.id]) mine = [];
        const s = summarize(mine);
        const additionalKeys = TALENT_KEY_ADDITIONS[def.id] ?? [];
        if (additionalKeys.length > 0) {
          // timing / duration は主の時間つきキーから取り、追加キーも別バー対象として明示する。
          s.gcsimKeys = [...new Set([...additionalKeys, ...(s.gcsimKeys ?? [])])];
          s.gcsimExtraKeys = s.gcsimExtraKeys?.filter(key => !additionalKeys.includes(key));
          if (s.gcsimExtraKeys?.length === 0) delete s.gcsimExtraKeys;
        }
        // 継続時間に意味が無い固有天賦は、条件付き扱い（継続時間は補わない）
        if (NO_DURATION_TALENTS[def.id] && s.gcsimTarget) s.timing = 'conditional';
        applyLink(def, s);
        applyNote(def, Boolean(key));
        if (!def.gcsimTarget && TALENT_NOTE_OVERRIDES[def.id]) def.gcsimNote = TALENT_NOTE_OVERRIDES[def.id];
        if (!NO_DURATION_TALENTS[def.id]) fillFromGcsim(def, s, report);
        count(report, 'talent', def);
      }
    }

    // 命ノ星座
    const effects: ConstellationBuffDefinition[] = [];
    if (key) {
      const byLevel = new Map<number, KeyCatalogEntry[]>();
      for (const e of entries) {
        const slotLevel = CONSTELLATION_KEYS_IN_ACTION_FILES[e.key]?.level ?? slotOfEntry(e, 'c');
        const m = slotLevel !== undefined ? [String(slotLevel), String(slotLevel)] : undefined;
        if (!m) {
          if (e.category === 'constellation' && e.kind === 'effect') report.constellationSkipped.noLevel++;
          continue;
        }
        const level = Number(m[1]);
        if (!byLevel.has(level)) byLevel.set(level, []);
        byLevel.get(level)!.push(e);
      }
      for (const [level, rawList] of [...byLevel].sort((a, b) => a[0] - b[0])) {
        const defId = `${char.id}_c${level}`;
        if (EXCLUDED_CONSTELLATIONS[defId]) continue;
        // 内部の重複防止の間隔のキーは、定義に結び付けない（対象外。D90）
        const list = rawList.filter(e => !INTERNAL_INTERVAL_KEYS[e.key]);
        if (list.length === 0) continue;
        // 別のファイルで登録された「同じ効果の別のキー」は、別のバーにせず、extra にする
        const forcedExtra = list.filter(e => CONSTELLATION_KEYS_IN_ACTION_FILES[e.key]?.role === 'extra');
        const mainList = list.filter(e => !forcedExtra.includes(e));
        const s: Summary = mainList.length > 0 ? summarize(mainList) : { timing: 'conditional', gcsimTarget: true };
        if (forcedExtra.length > 0) s.gcsimExtraKeys = [...(s.gcsimExtraKeys ?? []), ...forcedExtra.map(e => e.key)];
        const timed = s.timing === 'computed';
        if (!timed) {
          // 時間の無い効果（常時・条件つき・CT だけ）は、画面に出す価値のあるもの（ステータス・ダメージの増減、CT 短縮）だけを定義にする（6-A2。D91）
          const effectsOnly = list.filter(e => e.kind === 'effect');
          const text = char.constellations?.find(c => c.level === level)?.description ?? '';
          const worthy = list.some(e => NATURE_EXCEPTIONS[e.key]) || isDisplayWorthyNature(natureOfText(text));
          const hasKeys = (s.gcsimKeys?.length ?? 0) > 0 || (s.gcsimCooldownKeys?.length ?? 0) > 0 || (s.gcsimExtraKeys?.length ?? 0) > 0;
          if (!worthy || !hasKeys) {
            if (effectsOnly.some(e => e.permanent)) report.constellationSkipped.permanentOnly++;
            else if (effectsOnly.length > 0) report.constellationSkipped.unknownDuration++;
            continue;
          }
        }
        const data = char.constellations?.find(c => c.level === level);
        const noDuration = !timed || Boolean(NO_DURATION_CONSTELLATIONS[defId]);
        // 継続時間: 説明文（genshin-db）に継続時間が 1 つだけ書いてあればそれを優先し（D33）、無ければ gcsim の値。意味が無いものは持たない
        const fromText = noDuration ? [] : [...new Set(findDurations(data?.description ?? '').map(d => d.value))];
        const textDuration = fromText.length === 1 ? fromText[0] : undefined;
        const def: ConstellationBuffDefinition = {
          id: defId,
          level: level as ConstellationLevel,
          name: data?.name ?? `${level}凸`,
          ...(noDuration ? {} : { duration: textDuration ?? s.duration }),
          ...(s.cooldown !== undefined ? { cooldown: s.cooldown } : {}),
          ...(data?.description ? { description: data.description } : {}),
          dataSource: {
            ...(noDuration ? {} : { duration: textDuration !== undefined ? 'genshin-db: 説明文の継続時間' : `gcsim: ${s.durationKey}` }),
            ...(s.cooldownKey ? { cooldown: `gcsim: ${s.cooldownKey}` } : {}),
          },
        };
        if (textDuration !== undefined && Math.abs(textDuration - (s.duration ?? 0)) > 0.05) {
          report.constellationDurationFromText.push({ id: defId, name: `${char.name} ${level}凸`, text: textDuration, gcsim: s.duration ?? 0 });
        }
        applyLink(def, s);
        if (noDuration && timed) def.timing = 'conditional';
        applyNote(def, true);
        effects.push(def);
        count(report, 'constellation', def);
        report.added.push({ id: def.id, name: `${char.name} ${level}凸「${def.name}」`, sourceName: char.name, duration: def.duration, keys: def.gcsimKeys ?? [] });
      }
    }
    if (effects.length > 0) char.constellationEffects = effects;
    else delete char.constellationEffects;

    // 固有天賦・命ノ星座のファイルで登録された効果のキーのうち、どの定義にも対応付けておらず、確認済みの一覧（IGNORED_KEYS）にも無いもの
    const used = new Set<string>([
      ...(char.passiveEffects ?? []).flatMap(p => [...(p.gcsimKeys ?? []), ...(p.gcsimExtraKeys ?? [])]),
      ...(char.constellationEffects ?? []).flatMap(c => [...(c.gcsimKeys ?? []), ...(c.gcsimExtraKeys ?? [])]),
    ]);
    for (const e of entries) {
      if (e.kind !== 'effect' || used.has(e.key) || IGNORED_KEYS[e.key]) continue;
      const inAsc = e.sources.some(s => /[/]asc[.]go$/.test(s.file));
      const inCons = e.sources.some(s => /[/]cons[.]go$/.test(s.file));
      if (!inAsc && !inCons) continue;
      // 命ノ星座は、時間つきの効果だけを定義にする方針（永続・時間が分からない・短い判定は定義にしない）
      if (!inAsc && !isTimed(e)) continue;
      report.unreviewedKeys.push(`${char.name}: ${e.key}`);
    }
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
    const entries = (w.gcsimKey ? weaponEntries(w.gcsimKey, index) : []).filter(e => !INTERNAL_INTERVAL_KEYS[e.key]);
    const defs = w.buffEffects ?? [];
    const s = summarize(entries);
    if (defs.length > 0) {
      for (const def of defs) {
        applyLink(def, s);
        applyNote(def, Boolean(w.gcsimKey));
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
    } else if (s.timing === 'always' && (s.gcsimKeys?.length ?? 0) > 0 && (entries.some(e => NATURE_EXCEPTIONS[e.key]) || isDisplayWorthyNature(natureOfText(w.description ?? '')))) {
      // 常時の効果（時間が無い）。定義が無いものは、画面の「時間指定のない効果」の行に出すため、定義にする（6-A2。D91）
      const def: EquipmentBuffDefinition = {
        id: `wbuff_${w.id}`,
        name: w.passiveName || w.name,
        sourceType: 'weapon',
        sourceId: w.id,
        ...(s.cooldown !== undefined ? { cooldown: s.cooldown } : {}),
        description: w.description,
        dataSource: { ...(s.cooldownKey ? { cooldown: `gcsim: ${s.cooldownKey}` } : {}) },
      };
      applyLink(def, s);
      w.buffEffects = [def];
      count(report, 'weapon', def);
      report.added.push({ id: def.id, name: `${w.name}「${def.name}」（常時）`, sourceName: w.name, duration: undefined, keys: def.gcsimKeys ?? [] });
    }
  }

  for (const a of artifacts) {
    const entries = (a.gcsimKey ? index.byOwner.get(a.gcsimKey) ?? [] : []).filter(e => !hasToken(e, /^2pc$/) && !INTERNAL_INTERVAL_KEYS[e.key]);
    const s = summarize(entries);
    if ((a.buffEffects ?? []).length === 0 && !a.buffEffect && s.timing === 'always' && (s.gcsimKeys?.length ?? 0) > 0
      && (entries.some(e => NATURE_EXCEPTIONS[e.key]) || isDisplayWorthyNature(natureOfText(a.effect4p ?? '')))) {
      // 常時の 4 セット効果（時間が無い）。定義が無いものは、画面の「時間指定のない効果」の行に出すため、定義にする（6-A2。D91）
      const def: EquipmentBuffDefinition = {
        id: `abuff_${a.id}`,
        name: `${a.name} 4セット`,
        sourceType: 'artifact',
        sourceId: a.id,
        ...(s.cooldown !== undefined ? { cooldown: s.cooldown } : {}),
        description: a.effect4p ?? '',
        dataSource: { ...(s.cooldownKey ? { cooldown: `gcsim: ${s.cooldownKey}` } : {}) },
      };
      applyLink(def, s);
      a.buffEffects = [def];
      report.added.push({ id: def.id, name: `${a.name} 4セット（常時）`, sourceName: a.name, duration: undefined, keys: def.gcsimKeys ?? [] });
    }
    for (const def of a.buffEffects ?? []) {
      applyLink(def, s);
      applyNote(def, Boolean(a.gcsimKey));
      count(report, 'artifact', def);
    }
  }
  return report;
}
