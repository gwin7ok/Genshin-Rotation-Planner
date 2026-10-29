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
import { t } from '../i18n';

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
  return parts.join('・');
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * 任意の項目の型の検査: 無い（undefined）か、期待する型のときだけ true。
 * 画面にそのまま出す・計算に使う項目が、別の型（オブジェクトなど）だと、描画や計算で例外になる
 */
function optionalTypes(o: Record<string, unknown>, types: { string?: string[]; number?: string[]; boolean?: string[] }): boolean {
  return (types.string ?? []).every(k => o[k] === undefined || typeof o[k] === 'string')
    && (types.number ?? []).every(k => o[k] === undefined || isFiniteNumber(o[k]))
    && (types.boolean ?? []).every(k => o[k] === undefined || typeof o[k] === 'boolean');
}

/** 編成: 配列で、すべての枠が、キャラの ID（空でない文字列）を持ち、任意の項目は、型が合う */
export function isValidParty(v: unknown): v is PartyMember[] {
  return Array.isArray(v) && v.every(m => isRecord(m) && isNonEmptyString(m.characterId)
    && optionalTypes(m, {
      string: ['weaponId', 'artifactSetId', 'artifactSetMode'],
      number: ['constellation', 'weaponRefinementRank', 'energyRecharge'],
      boolean: ['hexerei', 'revelation'],
    }));
}

const isValidExtraEffect = (e: unknown): boolean =>
  isRecord(e) && typeof e.key === 'string' && isFiniteNumber(e.offset) && isFiniteNumber(e.duration)
  && (e.name === undefined || typeof e.name === 'string');

const isValidCopyDuration = (c: unknown): boolean =>
  isRecord(c) && isFiniteNumber(c.base) && isFiniteNumber(c.duration) && isFiniteNumber(c.gcsimBaseDuration);

const isValidAction = (a: unknown): a is CharacterActionInstance =>
  isRecord(a) && isNonEmptyString(a.id) && isNonEmptyString(a.actionTypeId) && typeof a.type === 'string' && isFiniteNumber(a.duration)
  // 名前・略号・メモは、画面にそのまま出す。文字列でないもの（オブジェクトなど）は、描画で例外になる
  && optionalTypes(a, {
    string: ['name', 'shortName', 'note', 'groupId', 'cooldownPool', 'gcsimCommand', 'specialWindowWarning'],
    number: ['groupCopy', 'gcsimBaseDuration', 'cooldown', 'effectDuration', 'gcsimCtOffset', 'gcsimCdResonance', 'delayAfter',
      'startTime', 'endTime', 'naturalDuration', 'holdSeconds', 'modeHoldSeconds'],
    boolean: ['durationManual', 'inStateWindow'],
  })
  // グループの複製ごとの所要時間: 各値の base・duration・gcsimBaseDuration が有限数（グループの展開で、そのまま所要時間に書き戻される。NaN だと、計算の時刻が壊れる）
  && (a.copyDurations === undefined || (isRecord(a.copyDurations) && Object.values(a.copyDurations).every(isValidCopyDuration)))
  && (a.extraEffects === undefined || (Array.isArray(a.extraEffects) && a.extraEffects.every(isValidExtraEffect)));

/** グループの回数: 1〜99 の整数（画面の編集と同じ範囲。大きな値だと、展開が大量のアクションを作って、画面が止まる） */
const isValidGroup = (g: unknown): boolean =>
  isRecord(g) && isNonEmptyString(g.id) && isFiniteNumber(g.repeat) && Number.isInteger(g.repeat) && g.repeat >= 1 && g.repeat <= 99;

const isValidTrigger = (t: unknown): boolean =>
  isRecord(t) && isNonEmptyString(t.id) && isNonEmptyString(t.passiveEffectId) && isFiniteNumber(t.offset)
  && optionalTypes(t, { string: ['name', 'gcsimKey'], number: ['duration', 'cooldown'], boolean: ['gcsimMissed'] });

/** 要素を検査して、合うものだけ残す。除外が無ければ、同じ配列を返す */
function filterValid<T>(list: unknown[], ok: (v: unknown) => boolean, skipped: { n: number }): T[] {
  const kept = list.filter(ok);
  skipped.n += list.length - kept.length;
  return (kept.length === list.length ? list : kept) as T[];
}

/** 出場の一覧を検査する。壊れた出場・アクション・グループ・発動バフ・副次効果を除外し、除外した数を返す */
export function sanitizeStints(list: unknown): { stints: Stint[]; skipped: SkippedRotationItems } {
  const skipped = emptySkipped();
  if (!Array.isArray(list)) return { stints: [], skipped };
  const stints: Stint[] = [];
  for (const raw of list) {
    if (!isRecord(raw) || !isNonEmptyString(raw.id) || !isNonEmptyString(raw.characterId) || !Array.isArray(raw.actions)) {
      skipped.stints++;
      continue;
    }
    const act = { n: 0 };
    const oth = { n: 0 };
    const actions = filterValid<CharacterActionInstance>(raw.actions, isValidAction, act);
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
      const kept = filterValid<unknown>(v, ok, oth);
      if (kept !== v) {
        next[key] = kept;
        changed = true;
      }
    }
    // 出場のメモ・モード維持の指定が、別の型なら、その項目だけ外す（出場は残す）
    for (const [key, type] of [['note', 'string'], ['holdMode', 'boolean']] as const) {
      if (raw[key] !== undefined && typeof raw[key] !== type) {
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

const finiteOrUndefined = (v: unknown): number | undefined => (isFiniteNumber(v) ? v : undefined);

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
  const loopStartIndex = finiteOrUndefined(raw.loopStartIndex);
  const switchDelay = finiteOrUndefined(raw.switchDelay);
  return {
    ok: true,
    skipped,
    value: {
      party: raw.party,
      stints,
      loopStartIndex: loopStartIndex !== undefined && loopStartIndex >= 0 ? Math.floor(loopStartIndex) : undefined,
      loopStartTime: finiteOrUndefined(raw.loopStartTime),
      totalDuration: finiteOrUndefined(raw.totalDuration),
      switchDelay: switchDelay !== undefined && switchDelay >= 0 ? switchDelay : undefined,
      reactions: raw.reactions,
      name: typeof raw.name === 'string' ? raw.name : undefined,
      description: typeof raw.description === 'string' ? raw.description : undefined,
    },
  };
}

/**
 * 編成の数値項目（ループ位置・基準・総時間・交代遅延）を検査する。有限の非負数でないものは取り除く（既定値が使われる）。
 * 文字列などのままだと、表示の .toFixed() などで画面が落ちる。正しければ、同じオブジェクトを返す
 */
export function sanitizeRotationNumbers<T extends object>(o: T): T {
  const r = o as Record<string, unknown>;
  const bad = ['loopStartIndex', 'loopStartTime', 'totalDuration', 'switchDelay'].filter(k => r[k] !== undefined && !(isFiniteNumber(r[k]) && (r[k] as number) >= 0));
  if (bad.length === 0) return o;
  const next = { ...r };
  for (const k of bad) delete next[k];
  return next as T;
}

/** 保存編成 1 件を検査する。使えないものは null。使えるものは、壊れた出場・アクションを除いて返す */
export function sanitizeSlot(raw: unknown): { slot: SavedRotationSlot; skipped: SkippedRotationItems } | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.id) || !isValidParty(raw.party)) return null;
  const { stints, skipped } = sanitizeStints(raw.stints ?? []);
  const unchanged = Array.isArray(raw.stints) && stints.length === raw.stints.length && skipped.actions === 0 && skipped.others === 0
    && stints.every((s, i) => s === (raw.stints as unknown[])[i]);
  let slot = sanitizeRotationNumbers((unchanged ? raw : { ...raw, stints }) as unknown as SavedRotationSlot);
  if (typeof slot.name !== 'string') slot = { ...slot, name: t('messages:file.noName') };
  // 説明は、画面にそのまま出す。文字列でなければ外す
  if (slot.description !== undefined && typeof slot.description !== 'string') {
    const { description: _drop, ...rest } = slot;
    slot = rest as SavedRotationSlot;
  }
  return { slot, skipped };
}
