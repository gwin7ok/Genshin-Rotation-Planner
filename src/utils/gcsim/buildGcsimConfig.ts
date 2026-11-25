import { expandGroupedStints } from '../actionGroups';
/**
 * 編成 → gcsim 設定文の変換（フェーズ4）
 *
 * 純粋関数。編成（解決済みのキャラ）・出場ブロック・ループ開始点・交代遅延・DB から、gcsim の設定文と警告を作る。
 * 設定文の構成と決定事項は docs/gcsim-integration/phase-4-config-converter/plan.md を参照。
 */
import { HEXEREI_GCSIM_KEYS, HEXEREI_GCSIM_PARAM } from '../../masterdata/hexereiCharacters.ts';
import { REVELATION_GCSIM_KEYS, REVELATION_GCSIM_PARAM } from '../../masterdata/revelationCharacters.ts';
import type { CharacterConfig, Stint } from '../../types/genshin.ts';
import type { ArtifactSetDatabaseItem, WeaponDatabaseItem } from '../../types/database.ts';
import { actionDelayOf } from '../actionDelay.ts';
import { isSafeGcsimCommand, isSafeGcsimKey } from '../rotationLimits.ts';
import { applyHoldSeconds, mapAction } from './actionMapping.ts';
import { CHARGE_REQUIRES_ATTACK, PREVIOUS_ACTION_LABELS } from './chargeRules.ts';
import { isTravelerKey, travelerParams } from '../hoyolab/importCharacters';
import type { GcsimMemberInfo } from './readGcsimLog.ts';
import { t, joinList } from '../../i18n';
import { charName, actionName, loc } from '../../i18n/loc';

import { DEFAULT_CUSTOM_STATS } from '../customStats';

/** ループ部分を回す周数（2周目の先頭で、1周目から続くCTが間に合うかを確かめるため 2周） */
export const LOOP_ITERATIONS = 2;
/** 戦闘時間（battleSeconds）から自動で決める周数の上限（ローテーションが極端に短いときの、実行時間の暴走を防ぐ） */
export const AUTO_LOOP_MAX = 30;
/** duration の余裕（CT待ちで周が延びても足りるように、見積りの倍＋固定秒） */
const DURATION_MARGIN_FACTOR = 2;
const DURATION_MARGIN_SECONDS = 30;
/** 余裕を少なくした見積り（必要な元素チャージ効率の算出。実行回数が多いので、動作が終わったあとの空き時間を減らす） */
const TIGHT_DURATION_MARGIN_FACTOR = 1.3;
const TIGHT_DURATION_MARGIN_SECONDS = 10;

/** gcsim の `swap_delay`（交代の要求から実行までのフレーム数）。交代遅延は `swap; delay(...)` で入れるため、最小にする */
const SWAP_DELAY_FRAMES = 1;

const toFrames = (seconds: number): number => Math.max(0, Math.round(seconds * 60));

export interface GcsimWarning {
  /** error: gcsim を実行できない / warn: 実行はできるが結果がずれる可能性 */
  level: 'error' | 'warn';
  message: string;
}

/**
 * 敵から受けるダメージの設定（追加作業 18）。ディシアの「紅き血」（自分が受けたダメージで HP が減ったとき）など、外からの HP の減少が条件の効果を再現する。
 * 間隔は秒、ダメージ量は HP。元素は物理（gcsim の `hurt every interval=… amount=… element=physical`）。ダメージは、間隔・量とも範囲の中の乱数
 */
export interface HurtSetting {
  enabled: boolean;
  intervalMin: number;
  intervalMax: number;
  amountMin: number;
  amountMax: number;
}

/** 既定（無効）。値は、D122 で確認した例（240〜300f ごとに 1000〜1500）と同じ */
export const DEFAULT_HURT: HurtSetting = { enabled: false, intervalMin: 4, intervalMax: 5, amountMin: 1000, amountMax: 1500 };

/** 設定文の `hurt` 行（無効・不正な値のときは undefined） */
export function hurtStatement(h: HurtSetting | undefined): string | undefined {
  if (!h?.enabled) return undefined;
  const lo = Math.round(h.intervalMin * 60);
  const hi = Math.round(h.intervalMax * 60);
  const a = Math.round(h.amountMin);
  const b = Math.round(h.amountMax);
  if (![lo, hi, a, b].every(Number.isFinite) || lo < 1 || hi < lo || a < 1 || b < a) return undefined;
  return `hurt every interval=${lo},${hi} amount=${a},${b} element=physical;`;
}

/** 敵の元素・物理耐性の種類（gcsim の `target` の項目名） */
export const ENEMY_RESIST_KEYS = ['physical', 'pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'] as const;
export type EnemyResistKey = (typeof ENEMY_RESIST_KEYS)[number];

/** 敵 1 体の設定（DPS 計算。耐性は割合: 0.1 = 10%、マイナスも可） */
export interface EnemySetting {
  level: number;
  resist: Record<EnemyResistKey, number>;
}

/** 既定の敵（Lv100・全耐性 10%。これまでの固定値） */
export const DEFAULT_ENEMY: EnemySetting = {
  level: 100,
  resist: { physical: 0.1, pyro: 0.1, hydro: 0.1, cryo: 0.1, electro: 0.1, anemo: 0.1, geo: 0.1, dendro: 0.1 },
};

/** 敵の `target` の行を作る（無い・空なら、これまでと同じ 1 体の固定値）。全員が同じ位置（原点）にいる = 範囲攻撃はすべての敵に当たる */
export function targetStatements(enemies: EnemySetting[] | undefined): string[] {
  // 指定が無いときは、これまでと同じ行（確認済みの判定の設定文の一致を変えない）
  if (!enemies || enemies.length === 0) return ['target lvl=100 resist=0.1;'];
  return enemies.map(e => {
    const lvl = Math.max(1, Math.min(200, Math.round(Number.isFinite(e.level) ? e.level : 100)));
    const vals = ENEMY_RESIST_KEYS.map(k => (Number.isFinite(e.resist?.[k]) ? e.resist[k] : 0.1));
    const res = vals.every(v => v === vals[0]) ? `resist=${vals[0]}` : ENEMY_RESIST_KEYS.map((k, i) => `${k}=${vals[i]}`).join(' ');
    return `target lvl=${lvl} ${res};`;
  });
}

/**
 * 時刻指定の粒子の行（`energy once interval=<フレーム> amount=<個数>;`。1 件 1 行）。
 * 時刻の早い順に並べる（同じ入力から同じ設定文になる）。個数が 1 未満・時刻が不正なものは出さない
 */
export function timedParticleStatements(list: { seconds: number; amount: number }[] | undefined): string[] {
  if (!list) return [];
  return list
    .filter(p => Number.isFinite(p.seconds) && p.seconds >= 0 && Number.isFinite(p.amount) && Math.round(p.amount) >= 1)
    .map(p => ({ frame: Math.max(1, Math.round(p.seconds * 60)), amount: Math.round(p.amount) }))
    .sort((a, b) => a.frame - b.frame || a.amount - b.amount)
    .map(p => `energy once interval=${p.frame} amount=${p.amount};`);
}

export interface GcsimConfigInput {
  /** 編成を DB と合わせて解決したキャラ（未設定枠を含む 4 枠） */
  characters: CharacterConfig[];
  /** 表示中（DB に有るキャラの）出場ブロック */
  stints: Stint[];
  /** 2周目ループの開始位置（0=先頭から全周） */
  loopStartIndex: number;
  /** キャラ交代の所要時間（秒） */
  switchDelay: number;
  /** 敵の防御ヒットストップ（gcsim の defhalt）。既定 true。false のとき `defhalt=false` を渡す（体幹が崩れる敵に当てる場合） */
  defHalt?: boolean;
  /** 敵（DPS 計算で指定。無ければ Lv100・全耐性 10% の 1 体） */
  enemies?: EnemySetting[];
  /** 敵から受けるダメージ（gcsim の `hurt every`。出場中のキャラが一定の間隔でダメージを受ける）。無い・無効なら、設定文に出さない */
  hurt?: HurtSetting;
  /**
   * 爆発のエネルギーを無視するか（gcsim の `ignore_burst_energy`。既定 true = 通常の計算）。
   * false のとき、爆発はエネルギーが足りるまで実行されない（必要な元素チャージ効率の算出で使う。フェーズ7）
   */
  ignoreBurstEnergy?: boolean;
  /** ループ部分を回す周数（既定 LOOP_ITERATIONS = 2）。必要な元素チャージ効率の算出は、エネルギーが落ち着く周まで回すため、多くする */
  loopIterations?: number;
  /** シミュレーション時間の余裕を少なくする（算出で、エネルギー待ちによる遅れが小さいときだけ使う。足りないと、爆発が基準より少なく出て「ずれ」と判定される） */
  tightDuration?: boolean;
  /** 敵から出る粒子（gcsim の `energy every`。クリア粒子 = 元素なし）。必要な元素チャージ効率の算出で使う。無い・amount 0 以下なら出さない */
  enemyParticles?: { minSeconds: number; maxSeconds: number; amount: number };
  /**
   * 開始エネルギーを 0 にするか（gcsim の `+params=[start_energy=0]`。全キャラ。幽境モード。既定 false = 満タン）。
   * 爆発のエネルギーを使う実行（ignoreBurstEnergy = false）のときに意味がある
   */
  startEnergyZero?: boolean;
  /**
   * 時刻指定の粒子（gcsim の `energy once interval=<フレーム> amount=<個数>`。クリア粒子 = 元素なし。ER が掛かり、控えのキャラは gcsim が減らして計算する）。
   * seconds = 戦闘開始からの秒。amount = 個数（整数に丸める。1 個未満は出さない）。複数指定できる。幽境モード
   */
  timedParticles?: { seconds: number; amount: number }[];
  /**
   * 戦闘時間（秒）。指定すると、ループを回す周数を、ローテーションの見積りの長さから自動で決める
   * （初動 + ループ × 周数 ≧ 戦闘時間。1〜AUTO_LOOP_MAX 周）。このとき loopIterations は使わない。幽境モード
   */
  battleSeconds?: number;
  /** キャラ ID → 仮ステータスに足す元素チャージ効率（割合。1 = +100%。武器・聖遺物のサブステの分は gcsim が別に足す）。無いキャラは足さない */
  addedEnergyRechargeByCharacterId?: Record<string, number>;
  /** キャラ ID → 元素チャージ効率の増減（割合。+0.1 = +10%、マイナスは下げる）。今のステータスの上に、そのまま足す（爆発のタイミングの確認で、ER を指定するのに使う） */
  energyRechargeDeltaByCharacterId?: Record<string, number>;
  weapons: WeaponDatabaseItem[];
  artifacts: ArtifactSetDatabaseItem[];
  /** 長押しの秒数（アクション ID → 秒）。計算後のアクションの holdSeconds。無いアクションは最短の長押し（hold=1）になる */
  holdSecondsByActionId?: Record<string, number>;
  /**
   * ユーザーが標準の所要時間より長くした分（アクション ID → 秒）。gcsim にはアクションの長さを渡せないため、そのアクションの後の遅延に足して渡す。
   * 長押し（holdSeconds で渡すアクション）は含めない
   */
  extraWaitByActionId?: Record<string, number>;
  /** extraWaitByActionId のうち、モードの維持のための自動の待ち（アクション ID → 秒）。書き戻しで、保存する所要時間から引く（維持の秒数は保存しない） */
  modeHoldByActionId?: Record<string, number>;
  /** アクション ID → gcsim の命令（モードの別の動作になった E が、パラメータ付きの命令になるもの。計算結果の `gcsimCommand`。フィッシュルのオズの間の E = skill[recast=1]） */
  commandByActionId?: Record<string, string>;
}

export interface GcsimConfigResult {
  config: string;
  warnings: GcsimWarning[];
  /** error の警告が無く、gcsim に送れる */
  runnable: boolean;
  /** 設定文のキャラの並び（gcsim のログの char_index の順）。ログの読み取り（6-2）が使う */
  members: GcsimMemberInfo[];
  /**
   * 設定文のアクションと、アプリのアクションの対応（実行順に展開: 初動 → ループ × LOOP_ITERATIONS）。
   * gcsim のログの `executed <action>`（交代を除く）を先頭から数えた番号が、この配列の番号に一致する（6-3b・6-3）
   */
  actionRefs: GcsimActionRef[];
  /** 交代遅延（`swap_delay`）のフレーム数。出場の開始位置（アプリは交代遅延を出場に含める）を合わせるために使う */
  swapDelayFrames: number;
  /** ループ部分を回す周数（設定文の `while i <= N` の N。戦闘時間を指定したときは、ローテーションの長さから自動で決まった周数） */
  loopIterations: number;
  /** 最初の出場キャラの gcsim のキー（設定文の `active <キー>;`。無ければ undefined）。ER 計算が、時刻指定の粒子を書き足すときの、最初の出場キャラに使う */
  firstActiveKey?: string;
}

export interface GcsimActionRef {
  stintId: string;
  actionId: string;
  /** gcsim の命令の基本名（attack / skill / burst / charge / aim / dash / low_plunge ...。パラメータは含まない） */
  command: string;
  /** 遅延に足して渡した、標準より長くした分（秒）。書き戻しで、gcsim 自身の所要時間を求めるために引く。無ければ 0 */
  extraSeconds?: number;
  /** extraSeconds のうち、モードの維持のための自動の待ち（秒）。書き戻す所要時間には含めない。無ければ 0 */
  modeHoldSeconds?: number;
  /** このアクションの直後に置いた待機（待機のアクション・維持）の合計（秒）。gcsim のログのアクションの間隔に含まれるので、書き戻す所要時間から引く */
  waitAfterSeconds?: number;
  /** 設定文の中の位置: 初動 / ループ（何周目か） */
  phase: 'initial' | 'loop';
  /** phase = loop のとき、何周目か（1 始まり） */
  loopIteration?: number;
}

/**
 * 設定文の先頭に編成名のコメント行（`# 編成名`）を付ける（コピー用。gcsim の設定文に編成名の項目は無いので、コメントで持つ。D326）。
 * 読込（parseGcsimConfig）は、先頭のコメントを編成名にする。名前が空なら、そのまま返す。確認済みの判定（設定文の一致）には使わない
 */
export function withConfigTitle(config: string, name: string | undefined): string {
  const title = (name ?? '').replace(/\s+/g, ' ').trim();
  return title ? `# ${title}\n${config}` : config;
}

const isEmptySlot = (c: CharacterConfig) => c.id.startsWith('empty_slot_');

/**
 * 設定文に入れてよい gcsim のキー（決まった形のものだけ。無い・不正なものは undefined = キー無しの扱い）。
 * キーは、設定文に、そのまま、または `"…"` の中に入る。DB 管理の取り込みなどで入った、引用符・`;`・改行を含むキーで、別の命令を差し込めないようにする
 */
const safeGcsimKey = (key: string | undefined): string | undefined => (isSafeGcsimKey(key) ? key : undefined);

export function buildGcsimConfig(rawInput: GcsimConfigInput): GcsimConfigResult {
  // グループの回数を展開する（追加作業 20-A）
  const input: GcsimConfigInput = { ...rawInput, stints: expandGroupedStints(rawInput.stints) };
  // 戦闘時間（battleSeconds）の指定があるときは、ローテーションの長さが分かってから、下で決め直す
  let loopIterations = Math.max(1, Math.floor(rawInput.loopIterations ?? LOOP_ITERATIONS));
  const warnings: GcsimWarning[] = [];
  const error = (message: string) => warnings.push({ level: 'error', message });
  const warn = (message: string) => warnings.push({ level: 'warn', message });

  const members = input.characters.filter(c => !isEmptySlot(c));
  const keyOf = new Map<string, string>();
  const lines: string[] = [];
  const memberInfos: GcsimMemberInfo[] = [];

  if (members.length === 0) error(t('messages:config.noMembers'));
  if (input.stints.length === 0) error(t('messages:config.noStints'));

  // 1. キャラごと（キャラ・武器・聖遺物・仮ステータス）
  for (const c of members) {
    const key = safeGcsimKey(c.source?.gcsimKey);
    if (!key) {
      error(t('messages:config.noCharKey', { name: charName(c) }));
      continue;
    }
    keyOf.set(c.id, key);
    const weaponForInfo = input.weapons.find(w => w.id === c.weaponId);
    const artifactForInfo = c.artifactSetMode !== '2+2' ? input.artifacts.find(a => a.id === c.artifactSetId) : undefined;
    memberInfos.push({
      characterId: c.id,
      name: charName(c),
      gcsimKey: key,
      weaponKey: safeGcsimKey(weaponForInfo?.gcsimKey),
      artifactKey: safeGcsimKey(artifactForInfo?.gcsimKey),
    });
    // 持ちキャラの装備（build）があれば、その値を使う。必要チャージ効率の算出（addedEnergyRecharge が渡る実行）も、同じ設定値で行う
    // （聖遺物ステータスの元素チャージ効率だけは、算出で動かす値に置き換える。下の add stats）
    const build = c.build;
    const cons = c.constellation ?? (c.rarity === 4 ? 6 : 0);
    // ヘクセレイ（魔女の宿題クリア）に対応するキャラは、明示的に渡す（gcsim の既定は有効）
    // 諭示（八重神子・七七）も同じく、明示的に渡す（gcsim の既定は達成済み）
    const paramList = [
      ...(HEXEREI_GCSIM_KEYS.has(key) ? [`${HEXEREI_GCSIM_PARAM}=${c.hexerei === false ? 0 : 1}`] : []),
      ...(REVELATION_GCSIM_KEYS.has(key) ? [`${REVELATION_GCSIM_PARAM}=${c.revelation === false ? 0 : 1}`] : []),
      // 旅人の真月（gcsim の既定は有効なので、未達成のときだけ渡す）
      ...(build && isTravelerKey(key) ? travelerParams(c.trueMoon !== false) : []),
      // 開始エネルギー 0（幽境モード。全キャラ）
      ...(input.startEnergyZero ? ['start_energy=0'] : []),
    ];
    const hexText = paramList.length > 0 ? ` +params=[${paramList.join(',')}]` : '';
    // 持ちキャラの装備が無ければ、「ステータスを変更」で保存した仮値、それも無ければ既定の仮値（D2）
    const stats = build ?? c.customStats ?? DEFAULT_CUSTOM_STATS;
    const charLevel = `lvl=${stats.level}/${stats.maxLevel}`;
    const talentLevels = stats.talents.join(',');
    lines.push(`${key} char ${charLevel} cons=${cons} talent=${talentLevels}${hexText};`);

    const weapon = input.weapons.find(w => w.id === c.weaponId);
    if (!c.weaponId) {
      warn(t('messages:config.noWeapon', { name: charName(c) }));
    } else if (!weapon) {
      error(t('messages:config.weaponNotFound', { name: charName(c) }));
    } else if (!safeGcsimKey(weapon.gcsimKey)) {
      error(t('messages:config.noWeaponKey', { name: charName(c), weapon: loc(weapon, 'name') }));
    } else {
      const refine = c.weaponRefinementRank ?? weapon.refinementRank ?? (weapon.rarity >= 5 ? 1 : 5);
      lines.push(`${key} add weapon="${weapon.gcsimKey}" refine=${refine} lvl=${stats.weaponLevel}/${stats.weaponMaxLevel};`);
    }

    if (build) {
      // 持ちキャラ: 実際のセット数（2 個以上のもの）から出す（2+2 の組み合わせも、gcsim が両方の 2 個効果を数える）
      for (const set of build.artifactSets) {
        const artifact = input.artifacts.find(a => a.id === set.id);
        if (!artifact) error(t('messages:config.artifactNotFound', { name: charName(c) }));
        else if (!safeGcsimKey(artifact.gcsimKey)) error(t('messages:config.noArtifactKey', { name: charName(c), artifact: loc(artifact, 'name') }));
        else lines.push(`${key} add set="${artifact.gcsimKey}" count=${set.count >= 4 ? 4 : 2};`);
      }
    } else if (c.artifactSetMode !== '2+2') {
      // 2+2 は聖遺物の発動バフなし（D5）なので出力しない
      const artifact = input.artifacts.find(a => a.id === c.artifactSetId);
      if (!c.artifactSetId) {
        warn(t('messages:config.noArtifact', { name: charName(c) }));
      } else if (!artifact) {
        error(t('messages:config.artifactNotFound', { name: charName(c) }));
      } else if (!safeGcsimKey(artifact.gcsimKey)) {
        error(t('messages:config.noArtifactKey', { name: charName(c), artifact: loc(artifact, 'name') }));
      } else {
        lines.push(`${key} add set="${artifact.gcsimKey}" count=4;`);
      }
    }
    const addedEr = input.addedEnergyRechargeByCharacterId?.[c.id];
    // 必要チャージ効率の算出では、聖遺物の元素チャージ効率（er）を、算出で動かす値に置き換える
    const statEntries = Object.entries(stats.artifactStats).filter(([k]) => addedEr === undefined || k !== 'er').map(([k, v]) => `${k}=${v}`);
    if (addedEr !== undefined) statEntries.push(`er=${Number(addedEr.toFixed(4))}`);
    if (statEntries.length > 0) lines.push(`${key} add stats ${statEntries.join(' ')};`);
    const erDelta = input.energyRechargeDeltaByCharacterId?.[c.id];
    if (erDelta !== undefined && Math.abs(erDelta) > 1e-9) lines.push(`${key} add stats er=${Number(erDelta.toFixed(4))};`);
  }

  // 2. ローテーション本体
  const loopStart = input.loopStartIndex > 0 && input.loopStartIndex < input.stints.length ? input.loopStartIndex : 0;
  const initialStints = input.stints.slice(0, loopStart);
  const loopStints = input.stints.slice(loopStart);

  // 出場 1 回の長さの見積り（秒）。シミュレーション時間の見積りと、戦闘時間からの周数の決定に使う
  const stintSeconds = (s: Stint) =>
    input.switchDelay + s.actions
      .filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char')
      .reduce((sum, a) => sum + Math.max(0, a.duration || 0) + actionDelayOf(a), 0);
  const initialSeconds = initialStints.reduce((t, s) => t + stintSeconds(s), 0);
  const loopSeconds = loopStints.reduce((t, s) => t + stintSeconds(s), 0);
  // 戦闘時間が指定されたとき: 戦闘が終わるまでローテーションが続く周数にする（最後の周は、戦闘時間をはみ出してもよい）
  if (input.battleSeconds !== undefined && Number.isFinite(input.battleSeconds) && input.battleSeconds > 0 && loopSeconds > 0) {
    loopIterations = Math.min(AUTO_LOOP_MAX, Math.max(1, Math.ceil((input.battleSeconds - initialSeconds) / loopSeconds - 1e-9)));
  }

  const charById = new Map(input.characters.map(c => [c.id, c]));
  // 落下攻撃を含むキャラ（gcsim は空中状態などの前提条件があり、実行できない場合がある。D48）
  const plungeChars = new Set<string>();
  // 出場の先頭: 前の出場と違うキャラなら `<キャラ> swap;` で交代を実行し（swap_delay は 1 フレームだけ）、続けて交代遅延ぶんの `wait` を入れる。
  //   アプリの交代遅延は「交代が終わってから最初の入力まで」で、gcsim の交代CT（交代の実行から 60 フレーム）にも含まれる。
  //   gcsim の `swap_delay` は交代の実行までの待ちで、CTはその後から始まってしまうため使わない（フィッシュルの爆発だけの出場が、交代CT待ちになる）
  const switchFrames = toFrames(input.switchDelay);
  const stintLines = (
    stintList: Stint[],
    indent: string,
    refs: { stintId: string; actionId: string; command: string; extraSeconds?: number; modeHoldSeconds?: number; waitAfterSeconds?: number }[],
    /** 最初の出場の直前のキャラのキー（1周目と2周目以降で違うときは `loopPrevKeys`）。無ければ交代しない（最初の出場など） */
    firstPrevKey: string | undefined,
    /** ループの最初の出場の直前のキャラのキー（周ごとに違うとき: 1周目 / 2周目以降） */
    loopPrevKeys?: { first: string | undefined; later: string | undefined },
  ): string[] => {
    const out: string[] = [];
    let prevKey = firstPrevKey;
    let isFirst = true;
    for (const stint of stintList) {
      const char = charById.get(stint.characterId);
      const key = keyOf.get(stint.characterId);
      if (!char || !key) continue; // キーが無いキャラは上で error 済み
      // 交代の実行（`swap`）は 1 フレームかかる（gcsim の実測: 要求から次のアクションまでは、`swap; wait(N)` で N + 1 フレーム。どの場合も一定。D225）。
      // アプリの交代遅延は、要求から最初のアクションまでなので、`wait` は、その 1f を引いた長さにする（交代しない出場は、そのまま）
      let swapFrames = 0; // 0: 交代しない / 1: 交代する / 条件つきは、交代しないときだけ足りない 1f を足す
      let missingWhen: string | undefined;
      if (isFirst && loopPrevKeys) {
        const needFirst = loopPrevKeys.first !== undefined && loopPrevKeys.first !== key;
        const needLater = loopPrevKeys.later !== undefined && loopPrevKeys.later !== key;
        if (needFirst && needLater) { out.push(`${indent}${key} swap;`); swapFrames = 1; }
        else if (needLater) { out.push(`${indent}if i > 1 {`, `${indent}  ${key} swap;`, `${indent}}`); swapFrames = 1; missingWhen = 'i < 2'; }
        else if (needFirst) { out.push(`${indent}if i < 2 {`, `${indent}  ${key} swap;`, `${indent}}`); swapFrames = 1; missingWhen = 'i > 1'; }
      } else if (prevKey !== undefined && prevKey !== key) {
        out.push(`${indent}${key} swap;`);
        swapFrames = 1;
      }
      // 交代遅延は `wait`（交代の直後にその時間を使う）。`delay` は次のアクションが実行できる状態になった「後」に入るため、
      // 最初のアクションのCT待ちと重ならず、アプリの時間より長くなってしまう
      const waitFrames = Math.max(0, switchFrames - swapFrames);
      if (waitFrames > 0) out.push(`${indent}wait(${waitFrames});`);
      // 条件つきの交代で、交代しない周: 交代の 1f がないので、その分を足す
      if (missingWhen && switchFrames > 0) out.push(`${indent}if ${missingWhen} {`, `${indent}  wait(1);`, `${indent}}`);
      isFirst = false;
      prevKey = key;
      // 出場の最後のアクション（次は交代）: 標準より長くした分は `wait` で渡す。`delay` は次の交代が実行できる状態になった「後」に入り、
      // 交代CTの待ちと重ならないため（爆発・重撃の後なら `wait` がちょうど交代へのキャンセルの時点から始まる）
      const lastCommandAct = [...stint.actions].reverse().find(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char' && a.type !== 'wait');
      for (const act of stint.actions) {
        if (act.type === 'swap' || act.actionTypeId === 'action_switch_char') continue;
        if (act.type === 'wait') {
          // 出場の最後の待機には、モードの維持のための自動の待ちを足す。
          // 待機は `wait`（その場で、その時間を使う）。`delay` は次のアクションが実行できる状態になった「後」に入るため、待機の途中で CT が明ける
          // 並び（E → 待機 → E）でも、gcsim が次のアクションを待機の前に試して CT 待ちになり、実行が待機の分だけ遅れてしまう（2026-10-09）
          const frames = toFrames(act.duration + Math.max(0, input.extraWaitByActionId?.[act.id] ?? 0));
          if (frames > 0) {
            out.push(`${indent}wait(${frames});`);
            // 直前のアクション（この出場の）の、書き戻す所要時間から引く待ち
            const prev = refs[refs.length - 1];
            if (prev && prev.stintId === stint.id) prev.waitAfterSeconds = Number(((prev.waitAfterSeconds ?? 0) + frames / 60).toFixed(3));
          }
          continue;
        }
        // gcsim が実装していないアクション（大剣の重撃など）は、実行すると「action ... not implemented」のエラーになるので、設定文に入れない
        if (char.availableActions.find(a => a.id === act.actionTypeId)?.gcsimUnsupported) {
          error(t('messages:config.actionMissing', { name: charName(char), action: actionName(char, act) }));
          continue;
        }
        const mapped = mapAction(act.actionTypeId, char.weaponType);
        if (!mapped.command) {
          error(t('messages:config.noRule', { name: charName(char), action: actionName(char, act), type: act.actionTypeId }));
          continue;
        }
        if (act.type === 'plunge_low' || act.type === 'plunge_high') plungeChars.add(charName(char));
        // 渡された命令（計算結果の gcsimCommand。読み込んだ編成・DB 管理の取り込みを通ってくることがある）は、決まった形（skill[recast=1] など）だけ設定文に入れる。
        // 改行・`;`・ループなどを含むものは、使わない（別の命令の差し込みを防ぐ）
        const givenCommand = input.commandByActionId?.[act.id];
        const command = (isSafeGcsimCommand(givenCommand) ? givenCommand : undefined) ?? applyHoldSeconds(act.actionTypeId, mapped.command, input.holdSecondsByActionId?.[act.id]);
        out.push(`${indent}${key} ${command};`);
        const extra = Math.max(0, input.extraWaitByActionId?.[act.id] ?? 0);
        const modeHold = Math.max(0, input.modeHoldByActionId?.[act.id] ?? 0);
        refs.push({ stintId: stint.id, actionId: act.id, command: command.replace(/\[.*$/, ''), ...(extra > 0 ? { extraSeconds: extra } : {}), ...(modeHold > 0 ? { modeHoldSeconds: modeHold } : {}) });
        // 出場の最後のアクション、または追加分が長い（0.5 秒以上）ときは `wait`。長い待ちは、`wait` が交代・次の行動へのキャンセルより早く始まって吸収される分（最大 0.2 秒程度）が小さく、
        // `delay`（次のアクションが実行できる状態になった後に入る）だと、CT待ちの後にさらに待つため、特殊スキルの受付（12 秒など）を過ぎてしまうことがある
        // モードの維持の分は、`delay` で渡す（交代できる状態になった後から数える）。`wait` は、最も早いキャンセル（交代へのキャンセルより前のことがある）から始まるため、
        // 交代が状態の期限より早くなる（胡桃のスキルで 24f。2026-10-08 に実行で確認）。維持は数秒あるので、交代 CT（1 秒）の待ちとは重ならない
        const manualExtra = Number(Math.max(0, extra - modeHold).toFixed(3));
        if (manualExtra > 0 && (act === lastCommandAct || manualExtra >= 0.5)) {
          out.push(`${indent}wait(${toFrames(manualExtra)});`);
          const delayOnly = toFrames(actionDelayOf(act) + modeHold);
          if (delayOnly > 0) out.push(`${indent}delay(${delayOnly});`);
        } else {
          const delayFrames = toFrames(actionDelayOf(act) + manualExtra + modeHold);
          if (delayFrames > 0) out.push(`${indent}delay(${delayFrames});`);
        }
      }
    }
    return out;
  };

  const initialRefs: { stintId: string; actionId: string; command: string; extraSeconds?: number; modeHoldSeconds?: number; waitAfterSeconds?: number }[] = [];
  const loopRefs: { stintId: string; actionId: string; command: string; extraSeconds?: number; modeHoldSeconds?: number; waitAfterSeconds?: number }[] = [];
  const stintKey = (s: Stint | undefined) => (s ? keyOf.get(s.characterId) : undefined);
  const firstKey0 = input.stints.map(s => keyOf.get(s.characterId)).find(Boolean);
  const initialLines = stintLines(initialStints, '', initialRefs, undefined);
  // ループの最初の出場の直前: 1周目は初動の最後（初動が無ければ最初のキャラ = active）、2周目以降はループの最後
  const lastOf = (list: Stint[]) => [...list].reverse().map(stintKey).find(Boolean);
  const loopLines = stintLines(loopStints, '  ', loopRefs, undefined, {
    first: lastOf(initialStints) ?? firstKey0,
    later: lastOf(loopStints),
  });
  const actionRefs: GcsimActionRef[] = [
    ...initialRefs.map(r => ({ ...r, phase: 'initial' as const })),
    ...Array.from({ length: loopIterations }, (_, i) => loopRefs.map(r => ({ ...r, phase: 'loop' as const, loopIteration: i + 1 }))).flat(),
  ];

  if (plungeChars.size > 0) {
    warn(t('messages:config.plungeWarning', { names: joinList([...plungeChars]) }));
  }

  // 重撃の直前が通常攻撃でないキャラ（gcsim は実行エラーにする）。初動 → ループ → ループ（2周）の順に、直前のアクションを追う
  {
    const stintNumber = new Map(input.stints.map((s, i) => [s.id, i + 1]));
    const reported = new Set<string>();
    const sequence = [...initialStints, ...loopStints, ...loopStints];
    let prev = 'none';
    let prevCharId: string | undefined;
    for (const stint of sequence) {
      const char = charById.get(stint.characterId);
      const key = keyOf.get(stint.characterId);
      if (!char || !key) continue;
      if (prevCharId !== undefined && prevCharId !== stint.characterId) prev = 'swap';
      prevCharId = stint.characterId;
      for (const act of stint.actions) {
        if (act.type === 'swap' || act.actionTypeId === 'action_switch_char' || act.type === 'wait') continue;
        const command = mapAction(act.actionTypeId, char.weaponType).command;
        if (!command) continue;
        const base = command.replace(/\[.*$/, '');
        if (base === 'charge' && CHARGE_REQUIRES_ATTACK.has(key) && prev !== 'attack' && !(key === 'iansan' && prev === 'skill') && !reported.has(act.id)) {
          reported.add(act.id);
          const prevLabel = prev === 'none' ? t('messages:config.rotationStart') : t('messages:config.quoted', { label: PREVIOUS_ACTION_LABELS[prev] ?? prev });
          error(t('messages:config.chargeNeedsNormal', { name: charName(char), index: stintNumber.get(stint.id), action: actionName(char, act), prev: prevLabel }));
        }
        prev = base;
      }
    }
  }

  // 3. シミュレーション時間の見積り（初動 + ループ×周数）を余裕付きで
  const estimated = initialSeconds + loopSeconds * loopIterations;
  const duration = input.tightDuration
    ? Math.ceil(estimated * TIGHT_DURATION_MARGIN_FACTOR + TIGHT_DURATION_MARGIN_SECONDS)
    : Math.ceil(estimated * DURATION_MARGIN_FACTOR + DURATION_MARGIN_SECONDS);

  const firstKey = input.stints.map(s => keyOf.get(s.characterId)).find(Boolean);
  const hurtLine = hurtStatement(input.hurt);

  const config: string[] = [
    ...lines,
    '',
    `options iteration=1 duration=${duration} swap_delay=${SWAP_DELAY_FRAMES}${input.ignoreBurstEnergy === false ? '' : ' ignore_burst_energy=true'}${input.defHalt === false ? ' defhalt=false' : ''};`,
    ...targetStatements(input.enemies),
    // 最大の間隔が 0 のときは出さない（最小 0・最大 0 だと、1 フレームごとに粒子が出て、実行が止まらなくなる）
    ...(input.enemyParticles && input.enemyParticles.amount > 0 && input.enemyParticles.maxSeconds > 0
      ? (() => {
        // 最小と最大が同じだと gcsim が止まる（Intn の引数が 0）。最大を 1 フレーム広げる
        const minF = Math.round(input.enemyParticles.minSeconds * 60);
        const maxF = Math.max(Math.round(input.enemyParticles.maxSeconds * 60), minF + 1);
        return [`energy every interval=${minF},${maxF} amount=${input.enemyParticles.amount};`];
      })()
      : []),
    ...timedParticleStatements(input.timedParticles),
    ...(hurtLine ? [hurtLine] : []),
    ...(firstKey ? [`active ${firstKey};`] : []),
    '',
    ...initialLines,
    'let i = 1;',
    `while i <= ${loopIterations} {`,
    '  print("loop ", i);',
    ...loopLines,
    '  i = i + 1;',
    '}',
  ];

  return {
    config: config.join('\n') + '\n',
    warnings,
    runnable: !warnings.some(w => w.level === 'error'),
    members: memberInfos,
    actionRefs,
    swapDelayFrames: SWAP_DELAY_FRAMES,
    loopIterations,
    ...(firstKey ? { firstActiveKey: firstKey } : {}),
  };
}
