/**
 * 編成（JSON ファイル・保存編成・自動保存・バックアップ）の中身の検査。
 *
 * 目的: 壊れた・古い・手で書き換えたデータが、描画や計算で例外になって、画面が真っ白になるのを防ぐ。
 * 方針（寛容）:
 *   - 画面と計算が落ちない最低限の形だけを検査する（任意の項目は、必須にしない）。
 *   - 編成（party）は、位置が意味を持つので、1 つでも壊れていたら、全体を受け付けない。
 *   - 出場・アクション・グループ・発動バフ・副次効果は、壊れた要素だけ除外して、除外した数を返す。
 *   - 正しい要素は、そのまま（同じオブジェクト）残す。正しいデータは、1 つも変わらない。
 */
import type { CharacterActionInstance, PartyMember, SavedRotationSlot, Stint } from '../types/genshin';
import { t, joinList } from '../i18n';
import {
  MAX_EXPANDED_ACTIONS, MAX_ID_LENGTH, MAX_LIST_ITEMS, MAX_MAP_ENTRIES, MAX_NAME_LENGTH, MAX_NUMBER, MAX_PARTY, MAX_STINTS,
  MAX_SWITCH_DELAY, MAX_TEXT_LENGTH, MAX_TIME_SECONDS, MAX_TOTAL_DURATION, isSafeGcsimCommand,
} from './rotationLimits';

/** 除外した要素の数 */
export interface SkippedRotationItems {
  stints: number;
  actions: number;
  /** グループ・発動バフ・副次効果 */
  others: number;
}

export const emptySkipped = (): SkippedRotationItems => ({ stints: 0, actions: 0, others: 0 });

export const totalSkipped = (s: SkippedRotationItems): number => s.stints + s.actions + s.others;

export const addSkipped = (a: SkippedRotationItems, b: SkippedRotationItems): SkippedRotationItems => ({
  stints: a.stints + b.stints,
  actions: a.actions + b.actions,
  others: a.others + b.others,
});

/** 除外した数の説明（確認・結果の文に使う）。無ければ空文字 */
export function describeSkipped(s: SkippedRotationItems): string {
  const parts: string[] = [];
  if (s.stints > 0) parts.push(t('messages:file.skippedStints', { count: s.stints }));
  if (s.actions > 0) parts.push(t('messages:file.skippedActions', { count: s.actions }));
  if (s.others > 0) parts.push(t('messages:file.skippedOthers', { count: s.others }));
  return joinList(parts);
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** ID・キー: 空でない、長すぎない文字列 */
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_LENGTH;
/** 名前・略号など: 長すぎない文字列（空でもよい） */
const isShortString = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_NAME_LENGTH;
/** メモ・説明など: 長すぎない文字列（空でもよい） */
const isText = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_TEXT_LENGTH;
/** 時間（秒）: 有限で、絶対値が上限以内。極端に大きい値だと、ガントチャートなどが固まる */
const isTime = (v: unknown): v is number => isFiniteNumber(v) && Math.abs(v) <= MAX_TIME_SECONDS;
/** 時間以外の数値: 有限で、絶対値が上限以内 */
const isBoundedNumber = (v: unknown): v is number => isFiniteNumber(v) && Math.abs(v) <= MAX_NUMBER;

/**
 * 任意の項目の型の検査: 無い（undefined）か、期待する型（と、上限以内）のときだけ true。
 * 画面にそのまま出す・計算に使う項目が、別の型（オブジェクトなど）だと、描画や計算で例外になる。
 *   string: 短い文字列／text: 長い文字列（メモ）／number: 時間以外の数値／time: 時間（秒）
 */
function optionalTypes(o: Record<string, unknown>, types: { string?: string[]; text?: string[]; number?: string[]; time?: string[]; boolean?: string[] }): boolean {
  return (types.string ?? []).every(k => o[k] === undefined || isShortString(o[k]))
    && (types.text ?? []).every(k => o[k] === undefined || isText(o[k]))
    && (types.number ?? []).every(k => o[k] === undefined || isBoundedNumber(o[k]))
    && (types.time ?? []).every(k => o[k] === undefined || isTime(o[k]))
    && (types.boolean ?? []).every(k => o[k] === undefined || typeof o[k] === 'boolean');
}

/** 持ちキャラの装備（編成の枠のコピー）: 数値・配列・ステータスの値が、型と範囲に合う（gcsim の設定文に、そのまま出すため） */
export function isValidCustomStats(v: unknown): boolean {
  if (!isRecord(v)) return false;
  const lv = (n: unknown) => isFiniteNumber(n) && Number.isInteger(n) && n >= 1 && n <= 100;
  return lv(v.level) && lv(v.maxLevel) && lv(v.weaponLevel) && lv(v.weaponMaxLevel)
    && Array.isArray(v.talents) && v.talents.length === 3 && v.talents.every(n => isFiniteNumber(n) && Number.isInteger(n) && n >= 1 && n <= 15)
    && isRecord(v.artifactStats) && Object.keys(v.artifactStats).length <= MAX_MAP_ENTRIES
    && Object.entries(v.artifactStats).every(([k, n]) => /^[a-z]+%?$/.test(k) && isFiniteNumber(n) && Math.abs(n) < 100000);
}

export function isValidOwnedBuild(v: unknown): boolean {
  return isValidCustomStats(v) && isRecord(v)
    && Array.isArray(v.artifactSets) && v.artifactSets.length <= 5
    && v.artifactSets.every(s => isRecord(s) && isId(s.id) && isFiniteNumber(s.count) && Number.isInteger(s.count) && s.count >= 2 && s.count <= 5);
}

/** 編成: 配列（枠は MAX_PARTY 以下）で、すべての枠が、キャラの ID（空でない文字列）を持ち、任意の項目は、型が合う */
export function isValidParty(v: unknown): v is PartyMember[] {
  return Array.isArray(v) && v.length <= MAX_PARTY && v.every(m => isRecord(m) && isId(m.characterId)
    && optionalTypes(m, {
      string: ['weaponId', 'artifactSetId', 'artifactSetMode'],
      number: ['constellation', 'weaponRefinementRank', 'energyRecharge'],
      boolean: ['hexerei', 'revelation', 'trueMoon'],
    })
    && (m.build === undefined || isValidOwnedBuild(m.build))
    && (m.customStats === undefined || isValidCustomStats(m.customStats)));
}

const isValidExtraEffect = (e: unknown): boolean =>
  isRecord(e) && isShortString(e.key) && isTime(e.offset) && isTime(e.duration)
  && (e.name === undefined || isShortString(e.name));

const isValidCopyDuration = (c: unknown): boolean =>
  isRecord(c) && isTime(c.base) && isTime(c.duration) && isTime(c.gcsimBaseDuration);

const isValidAction = (a: unknown): a is CharacterActionInstance =>
  isRecord(a) && isId(a.id) && isId(a.actionTypeId) && isShortString(a.type) && isTime(a.duration)
  // 名前・略号・メモは、画面にそのまま出す。文字列でないもの（オブジェクトなど）は、描画で例外になる。長すぎるものも除外する
  && optionalTypes(a, {
    string: ['name', 'shortName', 'groupId', 'cooldownPool'],
    text: ['note', 'specialWindowWarning'],
    number: ['groupCopy', 'gcsimCdResonance'],
    time: ['gcsimBaseDuration', 'cooldown', 'effectDuration', 'gcsimCtOffset', 'delayAfter',
      'startTime', 'endTime', 'naturalDuration', 'holdSeconds', 'modeHoldSeconds'],
    boolean: ['durationManual', 'inStateWindow'],
  })
  // gcsim の設定文に、そのまま入る命令: 決まった形（skill[recast=1] など）だけ。改行・`;`・ループなどの差し込みは、除外する
  && (a.gcsimCommand === undefined || isSafeGcsimCommand(a.gcsimCommand))
  // グループの複製ごとの所要時間: 各値の base・duration・gcsimBaseDuration が有限数（グループの展開で、そのまま所要時間に書き戻される。NaN だと、計算の時刻が壊れる）
  && (a.copyDurations === undefined || (isRecord(a.copyDurations) && Object.keys(a.copyDurations).length <= MAX_MAP_ENTRIES && Object.values(a.copyDurations).every(isValidCopyDuration)))
  && (a.extraEffects === undefined || (Array.isArray(a.extraEffects) && a.extraEffects.length <= MAX_LIST_ITEMS && a.extraEffects.every(isValidExtraEffect)));

/** グループの回数: 1〜99 の整数（画面の編集と同じ範囲。大きな値だと、展開が大量のアクションを作って、画面が止まる） */
const isValidGroup = (g: unknown): boolean =>
  isRecord(g) && isId(g.id) && isFiniteNumber(g.repeat) && Number.isInteger(g.repeat) && g.repeat >= 1 && g.repeat <= 99;

const isValidTrigger = (t: unknown): boolean =>
  isRecord(t) && isId(t.id) && isId(t.passiveEffectId) && isTime(t.offset)
  && optionalTypes(t, { string: ['name', 'gcsimKey'], time: ['duration', 'cooldown'], boolean: ['gcsimMissed'] });

/** 要素を検査して、合うものだけ残す。除外が無ければ、同じ配列を返す */
function filterValid<T>(list: unknown[], ok: (v: unknown) => boolean, skipped: { n: number }): T[] {
  const kept = list.filter(ok);
  skipped.n += list.length - kept.length;
  return (kept.length === list.length ? list : kept) as T[];
}

/**
 * グループを展開した後の、アクションの数の見積もり（グループのアクションは、回数分に増える。actionGroups.ts の展開と同じ数え方）。
 * 展開で、極端に大量のアクションができて、画面が止まるのを防ぐために使う
 */
function expandedActionCount(actions: CharacterActionInstance[], groups: unknown): number {
  const repeat = new Map<string, number>();
  if (Array.isArray(groups)) for (const g of groups) if (isRecord(g) && typeof g.id === 'string' && isFiniteNumber(g.repeat)) repeat.set(g.id, g.repeat);
  let n = 0;
  for (const a of actions) n += a.groupId ? (repeat.get(a.groupId) ?? 1) : 1;
  return n;
}

/**
 * 出場の一覧を検査する。壊れた出場・アクション・グループ・発動バフ・副次効果を除外し、除外した数を返す。
 * 件数の上限（出場 MAX_STINTS 件・展開後のアクション合計 MAX_EXPANDED_ACTIONS 件・出場ごとの副次の項目 MAX_LIST_ITEMS 件）を超える分も、除外する
 */
export function sanitizeStints(list: unknown): { stints: Stint[]; skipped: SkippedRotationItems } {
  const skipped = emptySkipped();
  if (!Array.isArray(list)) return { stints: [], skipped };
  const stints: Stint[] = [];
  let expandedTotal = 0;
  for (const raw of list) {
    if (!isRecord(raw) || !isId(raw.id) || !isId(raw.characterId) || !Array.isArray(raw.actions)) {
      skipped.stints++;
      continue;
    }
    if (stints.length >= MAX_STINTS) {
      skipped.stints++;
      continue;
    }
    const act = { n: 0 };
    const oth = { n: 0 };
    const rawActions = raw.actions.length > MAX_EXPANDED_ACTIONS ? raw.actions.slice(0, MAX_EXPANDED_ACTIONS) : raw.actions;
    act.n += raw.actions.length - rawActions.length;
    const actions = filterValid<CharacterActionInstance>(rawActions, isValidAction, act);
    const next: Record<string, unknown> = { ...raw };
    let changed = actions !== raw.actions;
    if (changed) next.actions = actions;
    const optional: Array<[string, (v: unknown) => boolean]> = [
      ['groups', isValidGroup],
      ['passiveTriggers', isValidTrigger],
      ['extraEffects', isValidExtraEffect],
    ];
    for (const [key, ok] of optional) {
      const v = raw[key];
      if (v === undefined) continue;
      if (!Array.isArray(v)) {
        delete next[key];
        oth.n++;
        changed = true;
        continue;
      }
      const capped = v.length > MAX_LIST_ITEMS ? v.slice(0, MAX_LIST_ITEMS) : v;
      oth.n += v.length - capped.length;
      const kept = filterValid<unknown>(capped, ok, oth);
      if (kept !== v) {
        next[key] = kept;
        changed = true;
      }
    }
    // 展開後のアクションの合計が上限を超える出場は、出場ごと除外する（出場の中の除外数は、数えない）
    const expanded = expandedActionCount(actions, next.groups);
    if (expandedTotal + expanded > MAX_EXPANDED_ACTIONS) {
      skipped.stints++;
      continue;
    }
    expandedTotal += expanded;
    // 出場のメモ・モード維持の指定が、別の型なら、その項目だけ外す（出場は残す）
    for (const [key, type] of [['note', 'string'], ['holdMode', 'boolean']] as const) {
      if (raw[key] !== undefined && (typeof raw[key] !== type || (key === 'note' && !isText(raw[key])))) {
        delete next[key];
        oth.n++;
        changed = true;
      }
    }
    skipped.actions += act.n;
    skipped.others += oth.n;
    stints.push((changed ? next : raw) as unknown as Stint);
  }
  return { stints, skipped };
}

/** 有限で、絶対値が上限以内の数値だけ返す（それ以外は undefined = 既定に任せる） */
const boundedOrUndefined = (v: unknown, max: number): number | undefined => (isFiniteNumber(v) && Math.abs(v) <= max ? v : undefined);

/** 取り込んだ編成（JSON ファイル・貼り付け）の内容 */
export interface RotationPayload {
  party: PartyMember[];
  stints: Stint[];
  loopStartIndex?: number;
  loopStartTime?: number;
  totalDuration?: number;
  switchDelay?: number;
  reactions?: unknown;
  name?: string;
  description?: string;
}

export type ParseRotationResult =
  | { ok: true; value: RotationPayload; skipped: SkippedRotationItems }
  | { ok: false; error: string };

/** 1 つの編成の JSON（書き出し・コピーと同じ形）を検査する。raw は、JSON.parse した結果 */
export function parseRotationPayload(raw: unknown): ParseRotationResult {
  if (!isRecord(raw) || !Array.isArray(raw.party) || !Array.isArray(raw.stints)) {
    return { ok: false, error: t('messages:file.invalidRotation') };
  }
  if (!isValidParty(raw.party)) {
    return { ok: false, error: t('messages:file.brokenParty') };
  }
  const { stints, skipped } = sanitizeStints(raw.stints);
  const loopStartIndex = boundedOrUndefined(raw.loopStartIndex, MAX_STINTS);
  const switchDelay = boundedOrUndefined(raw.switchDelay, MAX_SWITCH_DELAY);
  return {
    ok: true,
    skipped,
    value: {
      party: raw.party,
      stints,
      loopStartIndex: loopStartIndex !== undefined && loopStartIndex >= 0 ? Math.floor(loopStartIndex) : undefined,
      loopStartTime: boundedOrUndefined(raw.loopStartTime, MAX_TIME_SECONDS),
      totalDuration: boundedOrUndefined(raw.totalDuration, MAX_TOTAL_DURATION),
      switchDelay: switchDelay !== undefined && switchDelay >= 0 ? switchDelay : undefined,
      reactions: raw.reactions,
      // 名前・説明は、長すぎれば、切り詰める（編成そのものは、受け付ける）
      name: typeof raw.name === 'string' ? raw.name.slice(0, MAX_NAME_LENGTH) : undefined,
      description: typeof raw.description === 'string' ? raw.description.slice(0, MAX_TEXT_LENGTH) : undefined,
    },
  };
}

/** 編成の数値項目の上限（これを超えるものは、取り除く） */
const ROTATION_NUMBER_MAX: Record<string, number> = {
  loopStartIndex: MAX_STINTS,
  loopStartTime: MAX_TIME_SECONDS,
  totalDuration: MAX_TOTAL_DURATION,
  switchDelay: MAX_SWITCH_DELAY,
};

/**
 * 編成の数値項目（ループ位置・基準・総時間・交代遅延）を検査する。有限の非負数（で、上限以内）でないものは取り除く（既定値が使われる）。
 * 文字列などのままだと、表示の .toFixed() などで画面が落ちる。極端に大きいと、画面が固まる。正しければ、同じオブジェクトを返す
 */
export function sanitizeRotationNumbers<T extends object>(o: T): T {
  const r = o as Record<string, unknown>;
  const bad = Object.keys(ROTATION_NUMBER_MAX).filter(k => r[k] !== undefined && !(isFiniteNumber(r[k]) && (r[k] as number) >= 0 && (r[k] as number) <= ROTATION_NUMBER_MAX[k]));
  if (bad.length === 0) return o;
  const next = { ...r };
  for (const k of bad) delete next[k];
  return next as T;
}

/** 保存編成 1 件を検査する。使えないものは null。使えるものは、壊れた出場・アクションを除いて返す */
export function sanitizeSlot(raw: unknown): { slot: SavedRotationSlot; skipped: SkippedRotationItems } | null {
  if (!isRecord(raw) || !isId(raw.id) || !isValidParty(raw.party)) return null;
  const { stints, skipped } = sanitizeStints(raw.stints ?? []);
  const unchanged = Array.isArray(raw.stints) && stints.length === raw.stints.length && skipped.actions === 0 && skipped.others === 0
    && stints.every((s, i) => s === (raw.stints as unknown[])[i]);
  let slot = sanitizeRotationNumbers((unchanged ? raw : { ...raw, stints }) as unknown as SavedRotationSlot);
  if (typeof slot.name !== 'string') slot = { ...slot, name: t('messages:file.noName') };
  else if (slot.name.length > MAX_NAME_LENGTH) slot = { ...slot, name: slot.name.slice(0, MAX_NAME_LENGTH) };
  // 説明は、画面にそのまま出す。文字列でなければ外す（長すぎれば、切り詰める）
  if (slot.description !== undefined && typeof slot.description !== 'string') {
    const { description: _drop, ...rest } = slot;
    slot = rest as SavedRotationSlot;
  } else if (typeof slot.description === 'string' && slot.description.length > MAX_TEXT_LENGTH) {
    slot = { ...slot, description: slot.description.slice(0, MAX_TEXT_LENGTH) };
  }
  return { slot, skipped };
}
