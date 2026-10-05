/**
 * キャラクターマスターデータ生成器 (ブラウザ / Node 共通)
 *
 * データソース (すべてネットから最新を取得する):
 *   - genshin-db API … キャラ基本データ (名前・元素・武器種・レア度)、スキル/爆発の CT・効果継続時間、アイコンのファイル名
 *       https://genshin-db-api.vercel.app/api/v5
 *   - enka.network … ゲーム内アイコン画像 (genshin-db の filename_icon から URL を組み立てる)
 *   - gcsim (GitHub) … 各アクションのモーションフレーム (60 FPS)
 *       https://github.com/genshinsim/gcsim/tree/main/internal/characters
 *
 * キャラの突き合わせは gcsim の ui/packages/ui/src/data/character.dm.json にある
 * 公式キャラID (例: 胡桃 = 10000046) で行う。名前の表記ゆれ (raidenshogun / raiden 等) に依存しない。
 *
 * 取得できなかった値は仮の数値で埋めずに未設定のままにし、レポートに記録する。
 */
import type { ActionDefinition, ActionFrames, ActionType, CharacterConfig, ElementType, WeaponType } from '../types/genshin.ts';
import { parseGoFile, findHitmark, type FrameTable, type ParsedGoFile } from './gcsimParser.ts';
import { buildConstellations, emptyConstellationReport, type ConstellationReport, type GenshinDbConstellation } from './constellationEffects.ts';
import { characterKey } from '../data/characterKeys.ts';
import { buildPassiveEffects, type GenshinDbPassive } from './passiveEffects.ts';
import { EFFECT_DURATION_OVERRIDES, EFFECT_DURATION_SUPPRESSED } from './effectDurationOverrides.ts';
import { parseCooldownCalls, resolveCooldownStart, type CooldownCall, type CooldownStartResolution } from './cooldownStart.ts';
import { buildKeyMapSection, keyMapLookup, type KeyMapItem, type KeyMapSection, type ManualKeyMapping } from './gcsimKeyMap.ts';

export const GENSHIN_DB_API = 'https://genshin-db-api.vercel.app/api/v5';
/** genshin-db の mihoyo_icon は新しいキャラほどリンク切れが多いため、ゲーム内ファイル名から enka の画像を使う */
const ICON_BASE_URL = 'https://enka.network/ui';
import { GCSIM_REPO as CONFIG_GCSIM_REPO, GCSIM_COMMIT as CONFIG_GCSIM_COMMIT } from '../utils/gcsim/gcsimConfig.ts';
const GCSIM_REPO = CONFIG_GCSIM_REPO;
const GCSIM_BRANCH = CONFIG_GCSIM_COMMIT; // gcsim.config.json のコミットに固定（リリースにない最新の変更を取り込まない）
const GCSIM_CHAR_DM_PATH = 'ui/packages/ui/src/data/character.dm.json';

/**
 * 別アクションとして残す派生スキル（gcsim へのパラメータ指定が必要なもの。B）。キー: キャラ ID、値: 派生の名前（小文字）。
 *   フィッシュル `recast=1`、早柚・綺良々 `short_hold=1`、旅人(水) `hold=1`/`hold_ticks`、マーヴィカ `recast=1`
 * これ以外の派生は、状態で gcsim が自動的に切り替える（A）ため、E のボタンにまとめる。
 */
const PARAMETER_DERIVED_SKILLS: Record<string, string[]> = {
  '10000031-electro': ['recast'],
  '10000150-cryo': ['recast'], // オデットの特殊スキル（SPECIAL_SKILLS）
  '10000128-anemo': ['specialskill'], // ファルカの特殊スキル（SPECIAL_SKILLS）
  '10000053-anemo': ['shorthold'],
  '10000061-dendro': ['shorthold'],
  '10000005-hydro': ['shorthold', 'shorthold0ticks'],
  '10000007-hydro': ['shorthold', 'shorthold0ticks'],
  '10000106-pyro': ['recastframestobike', 'recastframestoring'],
};

/**
 * 特殊元素スキル（2026-10-01）。gcsim では、スキルの後の一定時間だけ使える特殊スキルを、同じ `skill` 命令で自動的に切り替えるが、
 * **スキルとは別のCT**（`ActionSpecialSkill`）を持つため、別のアクション（別ボタン）にする。通常のスキルのCTは開始しない。
 * キー: キャラ ID、値: 派生の名前（小文字。PARAMETER_DERIVED_SKILLS と同じ）と、gcsim の値（根拠つき）
 */
const SPECIAL_SKILLS: Record<string, { slug: string; label: string; name: string; cooldown: number; effectDuration: number; source: string; /** CTの開始位置（動作開始からの秒数。既定 0） */ cooldownDelay?: number; /** チャージ数（既定 1） */ charges?: number; /** 特殊スキルの受付時間（秒） */ windowSeconds?: number; /** 受付の延長（ファルカ）: 開始の遅れ・爆発による延長・ヒットストップ */ windowDelay?: number; windowExtendOnBurst?: number; windowHitlag?: { normal?: number[]; charged?: number; special?: number; skill?: number }; windowHitlagNoDefHalt?: { normal?: number[]; charged?: number; special?: number; skill?: number }; /** 受付の間の通常攻撃 1 ヒットあたりの CT 短縮（秒）、通常攻撃の段ごとのヒット数、最大ヒット数 */ reducePerHit?: number; reducePerHitHexerei?: number; hitsPerNormal?: number[]; maxReductions?: number; /** スキル（E・長押し E）を使うと、全チャージ分のCTが同時に始まる */ startedBySkill?: boolean; /** 受付だけを開き、CT は開始しない（オデット）。受付の間に 1 回使うと閉じる。爆発でも受付が開く（秒） */ windowOnly?: boolean; burstWindowSeconds?: number; /** 受付のバーの名前、特殊スキルの効果バーの名前（genshin-db のスキル名から） */ windowLabel?: string; effectLabel?: string }> = {
  '10000128-anemo': {
    slug: 'specialskill',
    label: 'spE',
    name: '特殊元素スキル',
    cooldown: 11,
    effectDuration: 0,
    charges: 2,
    startedBySkill: true,
    cooldownDelay: 39 / 60,
    windowSeconds: 12,
    windowDelay: 39 / 60, // varka/skill.go: QueueCharTask(…, skillHitmark-1) で AddStatus(skillKey, 12*60, true)
    windowExtendOnBurst: 2.3, // varka/burst.go: ExtendStatus(skillKey, 2.3*60)（「説明にはないが延びるらしい」）
    // AddStatus の第3引数 true = ヒットストップで延びる。ヒット 1 回あたりの止まるフレーム数 = ceil((HitlagHaltFrames + 3.6 × [防御ヒットストップ]) × (1 − 0.01))
    // （pkg/core/combat/attack.go: DefHalt が有効（既定 true。pkg/gcs/parser/parser.go）で CanBeDefenseHalted の攻撃は、+3.6 フレーム。pkg/core/player/character/hitlag.go: ApplyHitlag の frozenFrames）。
    // 全ヒットが敵に当たった最大の場合（2026-10-01 に gcsim の実行ログ 6/8/8/9f で確認）:
    //   通常攻撃 N1〜N5 = 6/8/8/9/10f（attack.go: 1 段目 {1.8}、2〜5 段目の 2 ヒット目 {3.6, 3.6, 5.4, 6} フレームに +3.6。1 ヒット目は 0 で防御ヒットストップも無し）
    //   重撃 = 9f（charge.go: 2 ヒット目 5.4+3.6）。特殊重撃（蒼牙）= 2 回 × 9f = 18f（azureDevour: {0, 5.4, 0, 5.4}、防御ヒットストップ有り）。重撃が特殊スキルの回数を使うかは後で決まるので、最大の 18f で見積もる
    //   特殊スキル = 9f（skill.go: fourWindsHitHaltFrame {5.4, 0}、1 ヒット目だけ防御ヒットストップ有り）、スキルの初撃 = 9f（HitlagHaltFrames 5.4 + 3.6。状態は命中の 1f 前に付くので延長される）
    windowHitlag: { normal: [6, 8, 8, 9, 10].map(f => f / 60), charged: 18 / 60, special: 9 / 60, skill: 9 / 60 },
    // defhalt=false（体幹が崩れる敵）: 防御ヒットストップの +3.6f が無い。通常攻撃 2/4/4/6/6f、重撃 6f（特殊重撃は 2 回で 12f）、特殊スキル 6f、スキルの初撃 6f
    windowHitlagNoDefHalt: { normal: [2, 4, 4, 6, 6].map(f => f / 60), charged: 12 / 60, special: 6 / 60, skill: 6 / 60 },
    reducePerHitHexerei: 1.0, // varka/asc.go hexSkillCDReduction: ヘクセレイ：秘儀（ヘクセレイのキャラが 2 人以上）のとき 1 秒（ゲーム内の説明: ヘクセレイ「魔術：秘密の儀式」で 1 秒短縮）
    reducePerHit: 0.5, // varka/skill.go: fourWindsCDRedCB → ReduceActionCooldown（hexSkillCDReduction = 30 フレーム）。ゲーム内の説明: 通常攻撃を与えると 0.5 秒短縮、最大 15 回
    hitsPerNormal: [1, 2, 2, 2, 2], // varka/attack.go の attackHitmarks（1〜5 段目のヒット数。ヒットごとに短縮の判定）
    maxReductions: 15,
    source: 'varka/skill.go: SetCD(action.ActionSpecialSkill, fourWindsCD = 11*60)。スキルを使うと全チャージ分のCTが始まり（convertToFourWinds のとき）、スキルの後 12 秒（skillKey）の間だけ使える。SetNumCharges(ActionSpecialSkill, 2)',
  },
  '10000150-cryo': {
    slug: 'recast',
    label: 'spE',
    name: '特殊元素スキル',
    cooldown: 15,
    effectDuration: 20,
    windowOnly: true,
    windowLabel: '柔き払暁のコーダの受付', // 特殊スキル「柔き払暁のコーダ」（genshin-db の天賦の説明）を使える期間
    effectLabel: '柔き払暁のコーダ後の強化', // danceDoubleUpgradeKey（20 秒）
    startedBySkill: true,
    windowSeconds: 394 / 60, // odette/skill.go: AddStatus(skillRecastKey, 394, true)（スキルの発動と同時。ヒットストップで延びる）
    burstWindowSeconds: (6 * 60 + 1) / 60, // odette/burst.go: AddStatus(skillRecastKey, 6*60+burstSummonFrame, false)（爆発でも受付が開く。ヒットストップでは延びない）
    // 通常攻撃のヒットストップ（odette/attack.go: attackHitlagHaltFrame {1.8}{1.8}{0,1.8}{3}{0}、attackDefHalt {true}{true}{false,false}{false}{true}。HitlagFactor 0.01）
    windowHitlag: { normal: [6, 6, 2, 3, 0].map(f => f / 60) },
    windowHitlagNoDefHalt: { normal: [2, 2, 2, 3, 0].map(f => f / 60) },
    source: 'odette/skill.go: SetCD(action.ActionSpecialSkill, 15*60)、AddStatus(danceDoubleUpgradeKey, 20*60)。スキルの後 394 フレーム（約 6.6 秒）の間だけ使える（AddStatus(skillRecastKey, 394)）',
  },
};

/**
 * 特殊元素爆発（2026-10-05）。状態中のスキル（2 回目の E）の後の一定時間だけ、爆発が特殊爆発に切り替わる。
 * 特殊爆発は、爆発の CT を始めない（CT 中でも使える）。使うと受付が閉じる。受付の外で使うと、通常の爆発（CT が始まる）。
 * キー: キャラ ID
 */
const SPECIAL_BURSTS: Record<string, { tableName: string; name: string; label: string; windowSeconds: number; windowLabel: string; openedBy: string; source: string }> = {
  '10000120-electro': {
    tableName: 'symphonyFrames',
    name: '特殊元素爆発（嵐槍の後）',
    label: 'spQ',
    windowSeconds: 6,
    windowLabel: '雷霆のシンフォニーの受付',
    openedBy: '嵐槍',
    source: 'flins/skill.go: spearStorm の AddStatus(thunderousSymphonyKey, 6*60, true)。flins/burst.go: thunderousSymphony は SetCD せず（爆発の CT を始めない）、ConsumeEnergyPartial(3, 30)（エネルギー 30 で発動）、DeleteStatus(thunderousSymphonyKey)（1 回で閉じる）',
  },
};

/**
 * 長押しの元素スキルを持たないキャラ。genshin-db のクールタイムのラベルに 2 値ある（タルタリヤは「6.0~36.0秒」＝近接モードの継続時間で変わる）ため、
 * 長押し（hE）と誤って生成されるのを防ぐ。
 */
const NO_HOLD_SKILL = new Set(['10000033-hydro']);

/** 旅人 (空 / 蛍)。genshin-db ではキャラとしては元素なし、天賦は元素ごとに別エントリ。空・蛍は別キャラとして元素ごとに登録する (D35) */
const AETHER_ID = 10000005;
const LUMINE_ID = 10000007;
const TRAVELER_IDS = new Set([AETHER_ID, LUMINE_ID]);

/** genshin-db の旅人天賦名 "旅人 (風元素)" の元素文字 → 元素 */
const TRAVELER_ELEMENT_JA: Record<string, ElementType> = {
  炎: 'pyro', 水: 'hydro', 風: 'anemo', 雷: 'electro', 草: 'dendro', 氷: 'cryo', 岩: 'geo',
};

/** gcsim の旅人フレームは先頭添字が性別 (0 = 空, 1 = 蛍)。gcsim のキーは `aether<元素>` / `lumine<元素>` */
const TRAVELERS = [
  { genshinId: AETHER_ID, genderIndex: 0, label: '空', englishLabel: 'Aether', gcsimPrefix: 'aether' },
  { genshinId: LUMINE_ID, genderIndex: 1, label: '蛍', englishLabel: 'Lumine', gcsimPrefix: 'lumine' },
] as const;

/**
 * 元素スキルの記法（D36）: 長押し派生が無いキャラのスキル = E、長押し系があるキャラの一回押し = tE、長押し系 = hE、再発動 = rE。
 * 別ボタンの派生の表記（キー: 派生名（小文字））。長押しの秒数は、フェーズ5・6 でスキル全体の所要時間からの逆算として、表示側で「hE(?s)」と付ける。
 */
const DERIVED_SKILL_NOTATION: Record<string, { label: string; type: ActionType; startsCooldown: boolean }> = {
  shorthold: { label: 'hE(short)', type: 'skill_hold', startsCooldown: true },
  shorthold0ticks: { label: 'hE(0Ticks)', type: 'skill_hold', startsCooldown: true },
  recast: { label: 'rE', type: 'skill', startsCooldown: false },
  recastframestobike: { label: 'rE(bike)', type: 'skill', startsCooldown: false },
  recastframestoring: { label: 'rE(ring)', type: 'skill', startsCooldown: false },
};

/**
 * 旅人(水)の最大ホールド (`skill[hold=1]` = 22 ティック)。gcsim は shortHold(1 ティック) のフレームに 15 フレーム × 21 を足して計算する
 * (traveler/common/hydro/skill.go: skillHold の extend)。ホールドのテーブル自体は無いので、shortHold から合成する。
 */
const TRAVELER_HYDRO_IDS = new Set([characterKey(AETHER_ID, 'hydro'), characterKey(LUMINE_ID, 'hydro')]);
const TRAVELER_HYDRO_MAX_HOLD_EXTEND = 15 * (22 - 1);

/** フレームが取得できなかった場合にタイムライン表示用として使う秒数 (レポートで「仮値」として明示) */
const PLACEHOLDER_DURATION: Partial<Record<ActionType, number>> = {
  normal: 0.4,
  charged: 0.8,
  skill: 0.8,
  skill_hold: 1.2,
  burst: 1.5,
  dash: 0.2,
};

const ELEMENT_MAP: Record<string, ElementType> = {
  ELEMENT_PYRO: 'pyro',
  ELEMENT_HYDRO: 'hydro',
  ELEMENT_ELECTRO: 'electro',
  ELEMENT_DENDRO: 'dendro',
  ELEMENT_CRYO: 'cryo',
  ELEMENT_ANEMO: 'anemo',
  ELEMENT_GEO: 'geo',
};

const ELEMENT_HEX: Record<ElementType, string> = {
  pyro: '#ef4444',
  hydro: '#0ea5e9',
  electro: '#a855f7',
  dendro: '#10b981',
  cryo: '#06b6d4',
  anemo: '#14b8a6',
  geo: '#f59e0b',
  physical: '#94a3b8',
};

const WEAPON_MAP: Record<string, WeaponType> = {
  WEAPON_SWORD_ONE_HAND: 'sword',
  WEAPON_CLAYMORE: 'claymore',
  WEAPON_POLE: 'polearm',
  WEAPON_BOW: 'bow',
  WEAPON_CATALYST: 'catalyst',
};

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export interface GenerationProgress {
  phase: string;
  done: number;
  total: number;
}

export interface CharacterGenerationReport {
  generatedAt: string;
  gcsimCommit: string;
  /** 発動バフの結び付けに使った辞書の gcsim のコミット（画面から生成したとき） */
  catalogCommit?: string;
  totalCharacters: number;
  charactersWithFrames: number;
  /** 生成対象外にしたキャラ */
  skipped: Array<{ name: string; reason: string }>;
  /** フレームが取れず仮の秒数を使ったアクション */
  placeholderDurations: Array<{ characterId: string; name: string; actions: string[]; reason: string }>;
  /** CT が genshin-db から取れなかったスキル/爆発 */
  missingCooldowns: Array<{ characterId: string; name: string; actionId: string }>;
  /** gcsim の式を評価できなかった行数 */
  unresolvedGoLines: Array<{ characterId: string; file: string; count: number }>;
  /** 落下攻撃 LP / HP（D48）: 生成した件数と、plunge.go はあるのにフレーム表を選べなかったキャラ */
  plunge: { lowCount: number; highCount: number; unresolved: Array<{ characterId: string; name: string }> };
  /** 効果継続時間の gcsim による補完（D33 / 5-3）: 補った件数・genshin-db の値との食い違い（genshin-db を優先） */
  effectDuration: {
    supplemented: Array<{ characterId: string; name: string; actionId: string; seconds: number; source: string }>;
    mismatches: Array<{ characterId: string; name: string; actionId: string; genshinDb: number; gcsim: number }>;
    /** 一覧にあるのに、対応するアクションが無い（キャラ・アクションの ID の変更・削除） */
    orphans: string[];
    /** 「効果時間なし」にした（バーに出さない。ユーザー決定）アクション */
    suppressed: Array<{ characterId: string; name: string; actionId: string; genshinDb: number; reason: string }>;
  };
  /** CT開始位置（D37 / D44）: 自動で読めた件数・手で補った件数・未設定の一覧・手で補う値との食い違い */
  cooldownStart: {
    read: number;
    manual: number;
    unresolved: Array<{ characterId: string; name: string; actionId: string; reason: string }>;
    mismatches: Array<{ characterId: string; name: string; actionId: string; readFrames: number; manualFrames: number }>;
  };
  /** 命ノ星座で効果継続時間が延びる「(n凸)」アクションの生成結果 */
  constellations: ConstellationReport;
  errors: string[];
}

export interface CharacterMasterResult {
  characters: CharacterConfig[];
  report: CharacterGenerationReport;
  /** 照合表（キャラの分）。生成のたびに作り直す */
  keyMap: KeyMapSection;
}

interface GenshinDbCharacter {
  id: number;
  name: string;
  elementType: string;
  weaponType: string;
  rarity: number;
  images?: Record<string, string>;
}

interface GenshinDbTalentCombat {
  name: string;
  attributes?: { labels?: string[]; parameters?: Record<string, number[]> };
}

interface GenshinDbTalent {
  id: number;
  name: string;
  combat2?: GenshinDbTalentCombat;
  combat3?: GenshinDbTalentCombat;
  passive1?: GenshinDbPassive;
  passive2?: GenshinDbPassive;
}

// ---------------------------------------------------------------------------
// 取得ヘルパー
// ---------------------------------------------------------------------------

async function fetchWithRetry(url: string, init?: RequestInit, retries = 2): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
      if (res.status === 403 || res.status === 404) break; // レート制限・存在しないものは再試行しない
    } catch (e) {
      lastError = e;
    }
    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => (await fetchWithRetry(url, init)).json() as Promise<T>;
const fetchText = async (url: string): Promise<string> => (await fetchWithRetry(url)).text();

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

// ---------------------------------------------------------------------------
// genshin-db: CT・効果継続時間の抽出
// ---------------------------------------------------------------------------

interface LabeledValue {
  value: number;
  label: string;
}

/** ラベル "クールタイム|{param6:F1}秒" から数値を取り出す (天賦 Lv1 の値)。複数 param があれば全て返す */
function labelValues(label: string, params: Record<string, number[]>): number[] {
  const formula = label.split('|')[1] ?? '';
  return [...formula.matchAll(/\{(param\d+):[^}]*\}/g)]
    .map(m => params[m[1]]?.[0])
    .filter((v): v is number => typeof v === 'number');
}

function findLabel(
  combat: GenshinDbTalentCombat | undefined,
  titles: string[],
  pick: 'first' | 'last' = 'first',
): LabeledValue | undefined {
  const labels = combat?.attributes?.labels ?? [];
  const params = combat?.attributes?.parameters ?? {};
  for (const title of titles) {
    const label = labels.find(l => l.split('|')[0].trim() === title);
    if (!label) continue;
    const values = labelValues(label, params);
    if (values.length === 0) continue;
    return { value: pick === 'first' ? values[0] : values[values.length - 1], label: title };
  }
  return undefined;
}

/** "〜継続時間" / "〜存在時間" / "〜石化時間" / "〜アクティブ時間" で終わるラベルのうち最初のもの (延長・長押し・CT 系は除外) */
function findAnyDuration(combat: GenshinDbTalentCombat | undefined, exclude: RegExp): LabeledValue | undefined {
  const labels = combat?.attributes?.labels ?? [];
  const params = combat?.attributes?.parameters ?? {};
  for (const label of labels) {
    const title = label.split('|')[0].trim();
    if (!/(継続時間|存在時間|石化時間|アクティブ時間)$/.test(title) || exclude.test(title)) continue;
    const values = labelValues(label, params);
    if (values.length > 0) return { value: values[0], label: title };
  }
  return undefined;
}

interface TalentTimings {
  skillTapCooldown?: LabeledValue;
  skillHoldCooldown?: LabeledValue;
  skillTapDuration?: LabeledValue;
  skillHoldDuration?: LabeledValue;
  burstCooldown?: LabeledValue;
  burstDuration?: LabeledValue;
}

function extractTalentTimings(talent: GenshinDbTalent | undefined): TalentTimings {
  const skill = talent?.combat2;
  const burst = talent?.combat3;

  const tapCdTitles = ['一回押しクールタイム', 'クールタイム', 'スキルクールタイム', 'スキルのクールタイム', '基本クールタイム'];
  let skillTapCooldown = findLabel(skill, tapCdTitles);
  let skillHoldCooldown = findLabel(skill, ['長押しクールタイム', '最大チャージクールタイム']);
  // "クールタイム|{一回押し}/{長押し}秒" のように1ラベルに2値ある場合
  if (!skillHoldCooldown) {
    const both = findLabel(skill, ['クールタイム'], 'last');
    if (both && skillTapCooldown && both.value !== skillTapCooldown.value) {
      skillHoldCooldown = { value: both.value, label: 'クールタイム (2値目)' };
    }
  }

  const tapDurTitles = ['継続時間', '一回押し/長押し継続時間', '基礎継続時間', '最大継続時間'];
  const skillTapDuration = findLabel(skill, tapDurTitles) ?? findAnyDuration(skill, /延長|長押し|クールタイム/);
  const skillHoldDuration = findLabel(skill, ['長押し最大継続時間', '長押しの継続時間', '一回押し/長押し継続時間']) ?? skillTapDuration;

  const burstCooldown = findLabel(burst, ['クールタイム']);
  const burstDuration = findLabel(burst, ['継続時間', '基礎継続時間']) ?? findAnyDuration(burst, /延長|クールタイム/);

  return { skillTapCooldown, skillHoldCooldown, skillTapDuration, skillHoldDuration, burstCooldown, burstDuration };
}

// ---------------------------------------------------------------------------
// gcsim: フレームテーブルの選択
// ---------------------------------------------------------------------------

interface ParsedCharacterFiles {
  /** ファイル名 (拡張子なし) → 解析結果 */
  files: Record<string, ParsedGoFile>;
  /** skill.go / burst.go の CT を開始する呼び出し（CT開始位置の読み取り用） */
  cooldownCalls: CooldownCall[];
}

/** "skillFrames[1]" → { base: "skillFrames", index: "1" } */
function splitTableName(name: string): { base: string; index?: string } {
  const m = /^(\w+?)((?:\[\w+\])*)$/.exec(name);
  if (!m || !m[2]) return { base: name };
  return { base: m[1], index: m[2] };
}

/** 同じ配列 (base 名) のうち最初に定義されたテーブルだけを残す */
function firstOfEachFamily(tables: FrameTable[]): FrameTable[] {
  const seen = new Set<string>();
  return tables.filter(t => {
    const { base } = splitTableName(t.name);
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  });
}

function toActionFrames(table: FrameTable, file: string, consts: Map<string, number>): ActionFrames {
  const hitmark = findHitmark(table, consts);
  return {
    total: table.total,
    ...(hitmark !== undefined ? { hitmark } : {}),
    cancels: { ...table.cancels },
    source: `${file}.go:${table.name}`,
  };
}

const framesToSec = (f: number) => Number((f / 60).toFixed(3));

/**
 * plunge.go から低・高の落下攻撃のフレーム表を選ぶ。名前が lowPlungeFrames / highPlungeFrames のものを優先し、
 * 無ければ lowPlungeFramesC のような接尾辞つき、それも無ければ名前に low / high と plunge を含むもの（バイク・炎など特殊形態は除く）。
 * 全体フレームが 1000 以上のものは、gcsim 側が未実装の仮置き（旅人(空)の 5000）なので使わない
 */
function findPlungeTable(tables: FrameTable[], kind: 'low' | 'high'): FrameTable | undefined {
  const usable = firstOfEachFamily(tables).filter(t => t.total < 1000);
  const base = (t: FrameTable) => splitTableName(t.name).base;
  const exact = `${kind}PlungeFrames`;
  return usable.find(t => base(t) === exact)
    ?? usable.find(t => base(t).startsWith(exact))
    ?? usable.find(t => new RegExp(`${kind}.*plunge|plunge.*${kind}`, 'i').test(base(t)) && !/bike|fiery|special/i.test(base(t)));
}

// ---------------------------------------------------------------------------
// アクション定義の組み立て
// ---------------------------------------------------------------------------

interface BuildContext {
  id: string;
  weaponType: WeaponType;
  timings: TalentTimings;
  talent?: GenshinDbTalent;
  parsed?: ParsedCharacterFiles;
}

interface BuildResult {
  actions: ActionDefinition[];
  placeholderActions: string[];
}

function buildActions(ctx: BuildContext): BuildResult {
  const { id, timings, talent, parsed } = ctx;
  const actions: ActionDefinition[] = [];
  const placeholderActions: string[] = [];

  const withDuration = (action: Omit<ActionDefinition, 'defaultDuration'>, durationSec?: number): ActionDefinition => {
    if (durationSec === undefined) {
      placeholderActions.push(action.id);
      return { ...action, defaultDuration: PLACEHOLDER_DURATION[action.type] ?? 0.5 };
    }
    return { ...action, defaultDuration: durationSec };
  };

  const file = (name: string) => parsed?.files[name];

  // --- 通常攻撃 N1..Nn ---------------------------------------------------
  const attack = file('attack');
  let normalTables: FrameTable[] = [];
  if (attack) {
    // 段ごとのテーブルを「最後の添字を除いた名前」でグループ化する
    // (attackFrames[0..4] / attackFrames[attack0Stacks][0..3] / attackFrames[attackTypeLeft] など)
    const groups = new Map<string, FrameTable[]>();
    for (const t of attack.tables) {
      const m = /^(.*)\[\w+\]$/.exec(t.name);
      if (!m) continue;
      if (!groups.has(m[1])) groups.set(m[1], []);
      groups.get(m[1])!.push(t);
    }
    const groupKeys = [...groups.keys()];
    const baseOf = (key: string) => splitTableName(key).base;
    // NewAttackFunc で実際に使われている配列を優先し、無ければ attack* で始まる最初の配列
    const key = attack.attackFuncTables.map(af => groupKeys.find(k => baseOf(k) === af)).find(Boolean)
      ?? groupKeys.find(k => /^attack/i.test(baseOf(k)));
    if (key) normalTables = groups.get(key)!;
  }
  if (attack && normalTables.length > 0) {
    // ボタンは「N」1つ（フェーズ3d / D26）。段ごとの値は normalHits に持ち、連続した N の何段目かは計算時に決める。
    // gcsim の attackFrames[i] は「i+1段目を単体で振った」ときのフレーム (合計ではない)。
    // 次段へ繋ぐ前提: 最終段以外は「次の通常攻撃へのキャンセル」フレーム、最終段は全体フレーム
    const normalHits = normalTables.map((table, i) => {
      const isLast = i === normalTables.length - 1;
      const toNext = isLast ? table.total : (table.cancels.attack ?? table.total);
      return { duration: framesToSec(toNext), frames: toActionFrames(table, 'attack', attack.consts) };
    });
    actions.push({
      id: `${id}_n`,
      name: '通常攻撃',
      shortName: 'N',
      type: 'normal',
      defaultDuration: normalHits[0].duration,
      frames: normalHits[0].frames,
      normalHits,
    });
  } else {
    actions.push(withDuration({ id: `${id}_n`, name: '通常攻撃', shortName: 'N', type: 'normal' }));
  }

  // --- 重撃 / 狙い撃ち -----------------------------------------------------
  const aimed = file('aimed') ?? file('aim');
  const charge = file('charge');
  if (aimed && aimed.tables.length > 0) {
    // aimedFrames[0] = 非チャージ, 最終添字 = フルチャージ
    const family = splitTableName(aimed.tables[0].name).base;
    const levels = aimed.tables.filter(t => splitTableName(t.name).base === family);
    const full = levels[levels.length - 1];
    actions.push(withDuration({
      id: `${id}_ca`,
      name: '狙い撃ち (フルチャージ)',
      shortName: 'CA',
      type: 'charged',
      frames: toActionFrames(full, 'aimed', aimed.consts),
    }, framesToSec(full.total)));
  } else if (charge && charge.tables.length > 0) {
    const table = charge.tables.find(t => t.name === 'chargeFrames')
      ?? charge.tables.find(t => /^charge/i.test(t.name))
      ?? charge.tables[0];
    actions.push(withDuration({
      id: `${id}_ca`,
      name: '重撃',
      shortName: 'CA',
      type: 'charged',
      frames: toActionFrames(table, 'charge', charge.consts),
    }, framesToSec(table.total)));
  } else {
    actions.push(withDuration({ id: `${id}_ca`, name: '重撃', shortName: 'CA', type: 'charged' }));
  }

  // --- 落下攻撃 LP / HP（フェーズ3f / D48）: gcsim の plunge.go にフレーム表があるものだけ ------------
  const plungeFile = file('plunge');
  if (plungeFile) {
    for (const kind of [
      { key: 'low' as const, suffix: 'lp', label: 'LP', name: '落下攻撃(低)', type: 'plunge_low' as const },
      { key: 'high' as const, suffix: 'hp', label: 'HP', name: '落下攻撃(高)', type: 'plunge_high' as const },
    ]) {
      const table = findPlungeTable(plungeFile.tables, kind.key);
      if (!table) continue;
      actions.push({
        id: `${id}_${kind.suffix}`,
        name: kind.name,
        shortName: kind.label,
        type: kind.type,
        defaultDuration: framesToSec(table.total),
        frames: toActionFrames(table, 'plunge', plungeFile.consts),
      });
    }
  }

  // --- 元素スキル (一回押し / 長押し / その他派生) ------------------------------
  const skillName = talent?.combat2?.name;
  const skill = file('skill');
  const skillTables = skill ? skill.tables.filter(t => !/Walk|Dash|Cancel|End|Lag|Delay/i.test(splitTableName(t.name).base)) : [];
  const families = firstOfEachFamily(skillTables);
  const holdTable = families.find(t => /hold/i.test(t.name) && !/short/i.test(t.name));
  const tapTable = families.find(t => !/hold/i.test(t.name));
  let resolvedHoldTable = holdTable;
  // 明示的な Hold テーブルが無く、genshin-db に長押しCTがあり、一回押しが添字付き配列なら [1] を長押しとみなす
  if (!resolvedHoldTable && timings.skillHoldCooldown && tapTable) {
    const { base } = splitTableName(tapTable.name);
    resolvedHoldTable = skillTables.find(t => t.name === `${base}[1]`);
  }

  actions.push(withDuration({
    id: `${id}_e`,
    name: skillName ? `元素スキル: ${skillName}` : '元素スキル',
    shortName: 'E',
    type: 'skill',
    startsSkillCooldown: true,
    cooldown: timings.skillTapCooldown?.value,
    effectDuration: timings.skillTapDuration?.value ?? 0,
    frames: tapTable && skill ? toActionFrames(tapTable, 'skill', skill.consts) : undefined,
    dataSource: {
      cooldown: timings.skillTapCooldown?.label,
      effectDuration: timings.skillTapDuration?.label,
    },
  }, tapTable ? framesToSec(tapTable.total) : undefined));

  if (!NO_HOLD_SKILL.has(id) && (timings.skillHoldCooldown || resolvedHoldTable)) {
    const holdCd = timings.skillHoldCooldown ?? timings.skillTapCooldown;
    actions.push(withDuration({
      id: `${id}_e_hold`,
      name: skillName ? `元素スキル(長押し): ${skillName}` : '元素スキル(長押し)',
      shortName: 'hE',
      type: 'skill_hold',
      startsSkillCooldown: true,
      cooldown: holdCd?.value,
      effectDuration: timings.skillHoldDuration?.value ?? 0,
      frames: resolvedHoldTable && skill ? toActionFrames(resolvedHoldTable, 'skill', skill.consts) : undefined,
      dataSource: {
        cooldown: holdCd?.label,
        effectDuration: timings.skillHoldDuration?.label,
      },
    }, resolvedHoldTable ? framesToSec(resolvedHoldTable.total) : undefined));
  }

  // 派生スキル: gcsim へのパラメータ指定が必要なもの（B）だけを別アクションにする（フェーズ3d / D25・D26）。
  // 状態で gcsim が自動的に切り替えるもの（A: 再発動・ステップなど）は、E のボタンにまとめるため生成しない
  if (skill) {
    for (const table of families) {
      if (table === tapTable || table === holdTable) continue;
      const suffix = splitTableName(table.name).base.replace(/^skill/i, '').replace(/Frames?$/i, '') || 'alt';
      const slug = suffix.charAt(0).toLowerCase() + suffix.slice(1);
      if (!PARAMETER_DERIVED_SKILLS[id]?.includes(slug.toLowerCase())) continue;
      const notation = DERIVED_SKILL_NOTATION[slug.toLowerCase()];
      const special = SPECIAL_SKILLS[id]?.slug === slug.toLowerCase() ? SPECIAL_SKILLS[id] : undefined;
      if (special) {
        // 特殊元素スキル: スキルとは別のCT・効果（スキルのCTは開始しない）
        actions.push({
          id: `${id}_e_${slug.toLowerCase()}`,
          name: `${special.name}${skillName ? `（${skillName}の後）` : ''}`,
          shortName: special.label,
          type: 'skill',
          startsSkillCooldown: false,
          cooldownPool: 'special',
          ...(special.charges ? { charges: special.charges } : {}),
          ...(special.windowOnly ? { requiresWindow: true } : {}),
          ...(special.cooldownDelay ? { cooldownStart: { from: 'motionStart' as const, delay: Number(special.cooldownDelay.toFixed(3)) } } : {}),
          cooldown: special.cooldown,
          effectDuration: special.effectDuration,
          defaultDuration: framesToSec(table.total),
          frames: toActionFrames(table, 'skill', skill.consts),
          dataSource: { cooldown: `gcsim: ${special.source}`, effectDuration: special.effectLabel ?? `gcsim: ${special.source}` },
        });
        continue;
      }
      // 長押し系の派生（旅人(水)・早柚・綺良々の shortHold など）は、gcsim では通常のEと同じCTが始まる (D36)
      const startsCooldown = notation.startsCooldown;
      actions.push({
        id: `${id}_e_${slug.toLowerCase()}`,
        name: `元素スキル派生: ${slug}`,
        shortName: notation.label,
        type: notation.type,
        startsSkillCooldown: startsCooldown,
        ...(startsCooldown ? { cooldown: timings.skillTapCooldown?.value, dataSource: { cooldown: timings.skillTapCooldown?.label } } : {}),
        defaultDuration: framesToSec(table.total),
        frames: toActionFrames(table, 'skill', skill.consts),
      });
    }
  }

  // 特殊スキルのCTをスキルが開始するキャラ（ファルカ）: スキル・長押しスキルに、特殊枠のCTの開始を持たせる
  if (SPECIAL_SKILLS[id]?.startedBySkill) {
    const sp = SPECIAL_SKILLS[id];
    for (const a of actions) {
      if (a.type === 'skill' && !a.cooldownPool || a.type === 'skill_hold') a.startsSpecialPool = {
        cooldown: sp.cooldown,
        charges: sp.charges ?? 1,
        ...(sp.windowSeconds ? { windowSeconds: Number(sp.windowSeconds.toFixed(3)) } : {}),
        ...(sp.windowOnly ? { windowOnly: true, singleUse: true, ...(sp.windowLabel ? { windowLabel: sp.windowLabel } : {}) } : {}),
        ...(sp.windowDelay ? { windowDelay: Number(sp.windowDelay.toFixed(3)) } : {}),
        ...(sp.windowExtendOnBurst ? { windowExtendOnBurst: sp.windowExtendOnBurst } : {}),
        ...(sp.windowHitlag ? { windowHitlag: sp.windowHitlag } : {}),
        ...(sp.windowHitlagNoDefHalt ? { windowHitlagNoDefHalt: sp.windowHitlagNoDefHalt } : {}),
        ...(sp.reducePerHit ? { reducePerHit: sp.reducePerHit, ...(sp.reducePerHitHexerei ? { reducePerHitHexerei: sp.reducePerHitHexerei } : {}), hitsPerNormal: sp.hitsPerNormal ?? [1], maxReductions: sp.maxReductions ?? 15 } : {}),
      };
    }
  }

  // 旅人(水): 最大ホールドは gcsim では shortHold のフレーム + 延長で表す。長押しの CT は一回押しと同じ
  if (skill && TRAVELER_HYDRO_IDS.has(id)) {
    const shortHold = families.find(t => splitTableName(t.name).base === 'skillShortHoldFrames');
    if (shortHold) {
      const base = toActionFrames(shortHold, 'skill', skill.consts);
      const extend = (n: number) => n + TRAVELER_HYDRO_MAX_HOLD_EXTEND;
      const frames: ActionFrames = {
        total: extend(base.total),
        ...(base.hitmark !== undefined ? { hitmark: extend(base.hitmark) } : {}),
        cancels: Object.fromEntries(Object.entries(base.cancels).map(([k, v]) => [k, extend(v)])) as ActionFrames['cancels'],
        source: 'skill.go:skillShortHoldFrames + 15 × (22 − 1) (skillHold, hold=1)',
      };
      actions.push({
        id: `${id}_e_hold`,
        name: skillName ? `元素スキル(最大ホールド): ${skillName}` : '元素スキル(最大ホールド)',
        shortName: 'hE',
        type: 'skill_hold',
        startsSkillCooldown: true,
        cooldown: timings.skillTapCooldown?.value,
        effectDuration: 0,
        defaultDuration: framesToSec(frames.total),
        frames,
        dataSource: { cooldown: timings.skillTapCooldown?.label },
      });
    }
  }

  // 長押し系（hE）が存在するキャラの一回押しは tE、存在しないキャラのスキルは E (D36)
  if (actions.some(a => a.type === 'skill_hold')) {
    const tap = actions.find(a => a.id === `${id}_e`);
    if (tap) tap.shortName = 'tE';
  }

  // --- 元素爆発 -------------------------------------------------------------
  const burstFile = file('burst');
  const burstTable = burstFile?.tables.find(t => /^burst/i.test(t.name)) ?? burstFile?.tables[0];
  const burstName = talent?.combat3?.name;
  actions.push(withDuration({
    id: `${id}_q`,
    name: burstName ? `元素爆発: ${burstName}` : '元素爆発',
    shortName: 'Q',
    type: 'burst',
    startsBurstCooldown: true,
    cooldown: timings.burstCooldown?.value,
    effectDuration: timings.burstDuration?.value ?? 0,
    frames: burstTable && burstFile ? toActionFrames(burstTable, 'burst', burstFile.consts) : undefined,
    dataSource: {
      cooldown: timings.burstCooldown?.label,
      effectDuration: timings.burstDuration?.label,
    },
  }, burstTable ? framesToSec(burstTable.total) : undefined));

  // 爆発でも特殊スキルの受付が開くキャラ（オデット）。ヒットストップでは延びない
  if (SPECIAL_SKILLS[id]?.burstWindowSeconds) {
    const sp = SPECIAL_SKILLS[id];
    for (const a of actions) {
      if (a.type === 'burst') a.startsSpecialPool = { cooldown: sp.cooldown, charges: sp.charges ?? 1, windowOnly: true, singleUse: true, ...(sp.windowLabel ? { windowLabel: sp.windowLabel } : {}), windowSeconds: Number(sp.burstWindowSeconds!.toFixed(3)) };
    }
  }

  // 特殊爆発（フリンズ）: 受付の間だけ使える別アクション。状態中のスキル（2 回目の E）が受付を開く
  if (SPECIAL_BURSTS[id]) {
    const sb = SPECIAL_BURSTS[id];
    const table = burstFile?.tables.find(t => splitTableName(t.name).base === sb.tableName);
    if (table && burstFile) {
      actions.push(withDuration({
        id: `${id}_q_special`,
        name: sb.name,
        shortName: sb.label,
        type: 'burst',
        startsBurstCooldown: false,
        specialBurst: true,
        requiresWindow: true,
        effectDuration: 0,
        frames: toActionFrames(table, 'burst', burstFile.consts),
        dataSource: { cooldown: `gcsim: ${sb.source}` },
      }, framesToSec(table.total)));
      const skillAct = actions.find(a => a.id === `${id}_e`);
      if (skillAct) skillAct.recastOpensWindow = { windowSeconds: sb.windowSeconds, windowLabel: sb.windowLabel, openedBy: sb.openedBy };
    }
  }

  // --- ダッシュ (キャラ固有フレームは gcsim 側で共通処理のため仮値) --------------
  actions.push({ id: `${id}_dash`, name: 'ダッシュ', shortName: 'D', type: 'dash', defaultDuration: PLACEHOLDER_DURATION.dash! });

  return { actions, placeholderActions };
}

// ---------------------------------------------------------------------------
// 旅人: 性別ごとのフレーム（空・蛍それぞれの別ユニットとして切り出す）
// ---------------------------------------------------------------------------

/** "a[1][0]" → ["1", "0"] */
const tableIndices = (name: string) => [...name.matchAll(/\[(\w+)\]/g)].map(m => m[1]);

/**
 * 性別の添字の位置を決める。X[..][c.gender] の参照があればその位置、
 * 無ければ (ローカル変数経由で参照される場合など) 先頭の添字がちょうど 0 と 1 の配列を性別とみなす。
 */
function genderPosition(file: ParsedGoFile, base: string): number | undefined {
  const explicit = file.genderIndexPositions[base];
  if (explicit !== undefined) return explicit;
  const firsts = new Set(file.tables.filter(t => splitTableName(t.name).base === base).map(t => tableIndices(t.name)[0]));
  return firsts.size === 2 && firsts.has('0') && firsts.has('1') ? 0 : undefined;
}

/** 性別で分かれたテーブルから指定性別の分だけを取り出し、性別の添字を外した見え方にする */
function genderView(parsed: ParsedCharacterFiles, gender: number): ParsedCharacterFiles {
  const files: Record<string, ParsedGoFile> = {};
  for (const [name, file] of Object.entries(parsed.files)) {
    const tables = file.tables.flatMap(t => {
      const { base } = splitTableName(t.name);
      const position = genderPosition(file, base);
      if (position === undefined) return [t];
      const indices = tableIndices(t.name);
      if (indices[position] !== String(gender)) return [];
      indices.splice(position, 1);
      return [{ ...t, name: `${base}${indices.map(i => `[${i}]`).join('')}` }];
    });
    files[name] = { ...file, tables };
  }
  return { ...parsed, files };
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------


const GCSIM_FILES = ['attack', 'charge', 'aimed', 'aim', 'skill', 'burst', 'plunge'];

export async function generateCharacterMaster(
  onProgress?: (p: GenerationProgress) => void,
): Promise<CharacterMasterResult> {
  const errors: string[] = [];
  const report: CharacterGenerationReport = {
    generatedAt: new Date().toISOString(),
    gcsimCommit: '',
    totalCharacters: 0,
    charactersWithFrames: 0,
    skipped: [],
    placeholderDurations: [],
    missingCooldowns: [],
    unresolvedGoLines: [],
    plunge: { lowCount: 0, highCount: 0, unresolved: [] },
    effectDuration: { supplemented: [], mismatches: [], orphans: [], suppressed: [] },
    cooldownStart: { read: 0, manual: 0, unresolved: [], mismatches: [] },
    constellations: emptyConstellationReport(),
    errors,
  };

  // 1. genshin-db + gcsim のインデックスを並列取得
  onProgress?.({ phase: 'genshin-db / gcsim の一覧を取得中', done: 0, total: 1 });
  const verbose = 'query=names&matchCategories=true&verboseCategories=true';
  const [charsJa, charsEn, talentsJa, constellationsJa, tree, charDm] = await Promise.all([
    fetchJson<GenshinDbCharacter[]>(`${GENSHIN_DB_API}/characters?${verbose}&resultLanguage=Japanese`),
    fetchJson<GenshinDbCharacter[]>(`${GENSHIN_DB_API}/characters?${verbose}&resultLanguage=English`),
    fetchJson<GenshinDbTalent[]>(`${GENSHIN_DB_API}/talents?${verbose}&resultLanguage=Japanese`),
    fetchJson<GenshinDbConstellation[]>(`${GENSHIN_DB_API}/constellations?${verbose}&resultLanguage=Japanese`),
    fetchJson<{ sha: string; truncated: boolean; tree: Array<{ path: string; type: string }> }>(
      `https://api.github.com/repos/${GCSIM_REPO}/git/trees/${GCSIM_BRANCH}?recursive=1`,
      { headers: { Accept: 'application/vnd.github+json' } },
    ),
    fetchJson<{ data: Record<string, { id: number; key: string }> }>(
      `https://raw.githubusercontent.com/${GCSIM_REPO}/${GCSIM_BRANCH}/${GCSIM_CHAR_DM_PATH}`,
    ),
  ]);
  report.gcsimCommit = tree.sha;
  const rawBase = `https://raw.githubusercontent.com/${GCSIM_REPO}/${tree.sha}/`;

  // 2. gcsim: 公式キャラID → キー → ディレクトリ
  const dirByKey = new Map<string, string>();
  const filesByDir = new Map<string, Set<string>>();
  for (const { path } of tree.tree) {
    const dm = /^internal\/characters\/(.+)\/zz_(\w+)\.dm\.go$/.exec(path);
    if (dm) dirByKey.set(dm[2], dm[1]);
    const go = /^internal\/characters\/(.+)\/(\w+)\.go$/.exec(path);
    if (go) {
      if (!filesByDir.has(go[1])) filesByDir.set(go[1], new Set());
      filesByDir.get(go[1])!.add(go[2]);
    }
  }
  // 照合表（D34）: 公式キャラID（旅人は 空・蛍 × 元素）↔ gcsim キー。名前では突き合わせない。gcsimKey はこの表から引く
  const keyMapItems: KeyMapItem[] = [];
  for (const c of charsJa) {
    if (TRAVELER_IDS.has(c.id) || !ELEMENT_MAP[c.elementType]) continue;
    keyMapItems.push({ id: characterKey(c.id, ELEMENT_MAP[c.elementType]), genshinId: c.id, name: c.name });
  }
  // 旅人は公式IDが元素に関わらず共通（空 / 蛍）なので、dm.json では引けない。gcsim のキー（aether<元素> / lumine<元素>）を手で補う
  const travelerManual: ManualKeyMapping[] = [];
  for (const traveler of TRAVELERS) {
    for (const element of Object.values(TRAVELER_ELEMENT_JA)) {
      const id = characterKey(traveler.genshinId, element);
      keyMapItems.push({ id, genshinId: traveler.genshinId, name: `${traveler.label}(${element})` });
      travelerManual.push({ id, gcsimKey: `${traveler.gcsimPrefix}${element}` });
    }
  }
  const keyMap = buildKeyMapSection(keyMapItems, charDm.data, tree.sha, travelerManual);
  const gcsimKeyById = keyMapLookup(keyMap);

  const englishById = new Map(charsEn.map(c => [c.id, c.name]));
  const talentByName = new Map(talentsJa.map(t => [t.name, t]));
  const talentById = new Map(talentsJa.map(t => [t.id, t]));
  // 凸データの id は天賦と同じ規則（公式キャラID - 10000000）× 100 + 1。旅人は元素ごとに別エントリ（名前 "旅人 (風元素)" で判別）
  const constellationById = new Map(constellationsJa.map(c => [c.id, c]));
  const travelerConstellationByElement = new Map<ElementType, GenshinDbConstellation>();
  for (const c of constellationsJa) {
    const m = /^旅人\s*\((.)元素\)$/.exec(c.name);
    const element = m ? TRAVELER_ELEMENT_JA[m[1]] : undefined;
    if (element) travelerConstellationByElement.set(element, c);
  }
  const iconUrl = (c?: GenshinDbCharacter) =>
    c?.images?.filename_icon ? `${ICON_BASE_URL}/${c.images.filename_icon}.png` : (c?.images?.mihoyo_icon ?? '');

  // 生成単位 (通常キャラ + 元素ごとの旅人)
  interface BuildUnit {
    id: string;
    name: string;
    englishName: string;
    element: ElementType;
    weaponType: WeaponType;
    rarity: number;
    avatarUrl: string;
    genshinId: number;
    talent?: GenshinDbTalent;
    constellation?: GenshinDbConstellation;
    gcsimKey?: string;
    gcsimDir?: string;
    /** 旅人: gcsim のフレームの性別の添字 (0 = 空, 1 = 蛍)。この性別の分だけ切り出して組み立てる */
    genderIndex?: number;
  }
  const units: BuildUnit[] = [];

  for (const c of charsJa) {
    if (TRAVELER_IDS.has(c.id)) continue;
    if (!ELEMENT_MAP[c.elementType]) {
      report.skipped.push({ name: c.name, reason: `元素 ${c.elementType} が未対応` });
      continue;
    }
    const englishName = englishById.get(c.id) ?? c.name;
    // キャラのキーは「公式キャラID-元素」（英語名の変更に左右されない）
    const id = characterKey(c.id, ELEMENT_MAP[c.elementType]);
    const talent = talentByName.get(c.name) ?? talentById.get((c.id - 10000000) * 100 + 1);
    if (!talent) errors.push(`genshin-db: ${c.name} の天賦データが見つかりません`);
    const gcsimKey = gcsimKeyById.get(id);
    units.push({
      id,
      name: c.name,
      englishName,
      element: ELEMENT_MAP[c.elementType],
      weaponType: WEAPON_MAP[c.weaponType] ?? 'sword',
      rarity: c.rarity,
      avatarUrl: iconUrl(c),
      genshinId: c.id,
      talent,
      constellation: constellationById.get((c.id - 10000000) * 100 + 1),
      gcsimKey,
      gcsimDir: gcsimKey ? dirByKey.get(gcsimKey) : undefined,
    });
  }

  // 旅人: genshin-db の元素別天賦 "旅人 (風元素)" ごとに、空・蛍の2キャラ。gcsim のフレームは traveler/common/<元素>（空・蛍共通で性別の添字で分かれる）
  // 天賦・命ノ星座は元素ごとに空・蛍で共通なので、同じ内容を両方に複写する
  for (const t of talentsJa) {
    const m = /^旅人\s*\((.)元素\)$/.exec(t.name);
    const element = m ? TRAVELER_ELEMENT_JA[m[1]] : undefined;
    if (!m || !element) continue;
    const gcsimDir = `traveler/common/${element}`;
    for (const traveler of TRAVELERS) {
      const gcsimKey = `${traveler.gcsimPrefix}${element}`;
      units.push({
        id: characterKey(traveler.genshinId, element), // 旅人は公式IDが空・蛍の2つ、元素と組にして一意にする
        name: `${traveler.label}(${m[1]})`,
        // 「旅人」「Traveler」でも検索できるよう別名を持たせる
        englishName: `${traveler.englishLabel} (${element.charAt(0).toUpperCase()}${element.slice(1)}) Traveler 旅人`,
        element,
        weaponType: 'sword',
        rarity: 5,
        avatarUrl: iconUrl(charsJa.find(c => c.id === traveler.genshinId)),
        genshinId: traveler.genshinId,
        talent: t,
        constellation: travelerConstellationByElement.get(element),
        gcsimKey: gcsimKeyById.get(characterKey(traveler.genshinId, element)),
        gcsimDir: filesByDir.has(gcsimDir) ? gcsimDir : undefined,
        genderIndex: traveler.genderIndex,
      });
    }
  }

  // 3. gcsim の Go ソースを取得・解析
  const parsedById = new Map<string, ParsedCharacterFiles>();
  let done = 0;
  await runPool(units, 12, async u => {
    if (u.gcsimDir) {
      const available = filesByDir.get(u.gcsimDir) ?? new Set();
      const names = GCSIM_FILES.filter(f => available.has(f));
      try {
        const texts = await Promise.all(names.map(f => fetchText(`${rawBase}internal/characters/${u.gcsimDir}/${f}.go`)));
        // ファイル間で定数を共有するため、先に全ファイルの定数を集めてから解析する
        const shared = new Map<string, number>();
        texts.forEach(t => parseGoFile(t).consts.forEach((v, k) => shared.set(k, v)));
        const files: Record<string, ParsedGoFile> = {};
        names.forEach((f, i) => {
          files[f] = parseGoFile(texts[i], shared);
        });
        const cooldownCalls = names.flatMap((f, i) => (f === 'skill' || f === 'burst') ? parseCooldownCalls(texts[i], files[f]) : []);
        parsedById.set(u.id, { files, cooldownCalls });
      } catch (e) {
        errors.push(`gcsim ${u.gcsimDir}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    done++;
    onProgress?.({ phase: 'gcsim のモーションフレームを解析中', done, total: units.length });
  });

  // 4. キャラクター組み立て
  const characters: CharacterConfig[] = [];
  for (const u of units) {
    const timings = extractTalentTimings(u.talent);
    const parsed = parsedById.get(u.id);
    const ctx = { id: u.id, weaponType: u.weaponType, timings, talent: u.talent };

    const { actions, placeholderActions } = buildActions({
      ...ctx,
      parsed: parsed && u.genderIndex !== undefined ? genderView(parsed, u.genderIndex) : parsed,
    });

    if (actions.some(a => a.type === 'plunge_low')) report.plunge.lowCount++;
    if (actions.some(a => a.type === 'plunge_high')) report.plunge.highCount++;
    if (parsed?.files.plunge && !actions.some(a => a.type === 'plunge_low' || a.type === 'plunge_high')) {
      report.plunge.unresolved.push({ characterId: u.id, name: u.name });
    }

    // 効果継続時間の補完（D33 / 5-3）: genshin-db に値が無いものだけ、gcsim の値（手で補う一覧）を入れる。genshin-db に値があれば、それを優先し、食い違いだけ記録する
    for (const a of actions) {
      const o = EFFECT_DURATION_OVERRIDES[a.id];
      if (!o) continue;
      const seconds = framesToSec(o.frames);
      if (a.effectDuration && a.effectDuration > 0) {
        if (Math.abs(a.effectDuration - seconds) > 0.05) report.effectDuration.mismatches.push({ characterId: u.id, name: u.name, actionId: a.id, genshinDb: a.effectDuration, gcsim: seconds });
        continue;
      }
      a.effectDuration = seconds;
      a.dataSource = { ...a.dataSource, effectDuration: `gcsim: ${o.source}` };
      report.effectDuration.supplemented.push({ characterId: u.id, name: u.name, actionId: a.id, seconds, source: o.source });
    }

    // 効果継続時間なし（バーに出さない）: 手で決めた一覧のアクションは 0 にする
    for (const a of actions) {
      const reason = EFFECT_DURATION_SUPPRESSED[a.id];
      if (!reason) continue;
      if (a.effectDuration && a.effectDuration > 0) report.effectDuration.suppressed.push({ characterId: u.id, name: u.name, actionId: a.id, genshinDb: a.effectDuration, reason });
      a.effectDuration = 0;
      a.dataSource = { ...a.dataSource, effectDuration: `効果時間なし: ${reason}` };
    }

    // CT開始位置（D37 / D44）: スキル・爆発のアクションに、gcsim の遅れ（または手で補った値）を持たせる
    for (const a of actions) {
      if (!a.startsSkillCooldown && !a.startsBurstCooldown) continue;
      const r: CooldownStartResolution = resolveCooldownStart(a.id, parsed?.cooldownCalls);
      if (r.cooldownStart) {
        a.cooldownStart = r.cooldownStart;
        a.dataSource = { ...a.dataSource, cooldownStart: r.source };
        if (r.cooldownPerHold !== undefined) a.cooldownPerHold = r.cooldownPerHold;
        if (r.baseCooldown !== undefined) a.cooldown = r.baseCooldown;
        if (r.holdInFrames !== undefined) a.holdInFrames = r.holdInFrames;
        report.cooldownStart[r.status === 'manual' ? 'manual' : 'read']++;
      } else {
        report.cooldownStart.unresolved.push({ characterId: u.id, name: u.name, actionId: a.id, reason: u.gcsimKey ? (r.reason ?? '') : 'gcsim 未実装' });
      }
      if (r.mismatch) report.cooldownStart.mismatches.push({ characterId: u.id, name: u.name, actionId: a.id, ...r.mismatch });
    }

    if (parsed) {
      report.charactersWithFrames++;
      for (const [f, p] of Object.entries(parsed.files)) {
        if (p.unresolved.length > 0) report.unresolvedGoLines.push({ characterId: u.id, file: `${f}.go`, count: p.unresolved.length });
      }
    }
    if (placeholderActions.length > 0) {
      report.placeholderDurations.push({
        characterId: u.id,
        name: u.name,
        actions: placeholderActions,
        reason: !u.gcsimKey ? 'gcsim 未実装キャラ' : !parsed ? 'gcsim ソース取得失敗' : 'gcsim にフレーム定義が見つからない',
      });
    }
    for (const a of actions) {
      if ((a.startsSkillCooldown || a.startsBurstCooldown) && a.cooldown === undefined) {
        report.missingCooldowns.push({ characterId: u.id, name: u.name, actionId: a.id });
      }
    }

    const character: CharacterConfig = {
      id: u.id,
      name: u.name,
      englishName: u.englishName,
      element: u.element,
      weaponType: u.weaponType,
      rarity: u.rarity,
      avatarUrl: u.avatarUrl,
      color: ELEMENT_HEX[u.element],
      accentColor: ELEMENT_HEX[u.element],
      availableActions: actions,
      passiveEffects: buildPassiveEffects(u.id, [u.talent?.passive1, u.talent?.passive2]),
      source: { genshinId: u.genshinId, ...(u.gcsimKey ? { gcsimKey: u.gcsimKey } : {}) },
    };
    // 命ノ星座（1〜6凸）の段階データ。確認済みの効果継続時間の延長を含む
    if (u.constellation) character.constellations = buildConstellations(character, u.constellation, report.constellations);
    characters.push(character);
  }

  const allActionIds = new Set(characters.flatMap(c => c.availableActions.map(a => a.id)));
  report.effectDuration.orphans = [...Object.keys(EFFECT_DURATION_OVERRIDES), ...Object.keys(EFFECT_DURATION_SUPPRESSED)].filter(id => !allActionIds.has(id));

  characters.sort((a, b) => a.id.localeCompare(b.id));
  report.totalCharacters = characters.length;
  return { characters, report, keyMap };
}
