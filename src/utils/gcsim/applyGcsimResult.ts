/**
 * gcsim の結果 → アプリの編集できる値への書き戻し（フェーズ6 / 6-3、D20）
 *
 * 純粋関数。書き戻しは1周目（初動 + ループ1周目）の値を使う（CT待ちが無ければ周ごとの結果は一致する。D21）。
 *   6-3a: アクションの所要時間（このファイル）
 * ユーザーが手で入れた値は、上書きで失われる（D20。編集済みの所要時間も上書き。D27-2）。
 */
import type { CharacterActionInstance, Stint } from '../../types/genshin.ts';
import { actionDelayOf } from '../actionDelay.ts';
import type { GcsimActionRef } from './buildGcsimConfig.ts';
import { framesToSeconds, type GcsimActionRecord, type GcsimLogSummary } from './readGcsimLog.ts';

export interface AlignedAction {
  /** gcsim のログのアクション */
  executed: GcsimActionRecord;
  /** 設定文のアクション（アプリのアクション ID を持つ） */
  ref: GcsimActionRef;
}

export interface AlignResult {
  pairs: AlignedAction[];
  /** 設定文とログで、アクションの並びが合わなかったときの説明（合っていれば undefined） */
  mismatch?: string;
}

/** 書き戻しに使う周: 初動 と ループ1周目 */
export const isFirstLap = (ref: GcsimActionRef): boolean => ref.phase === 'initial' || ref.loopIteration === 1;

/**
 * gcsim のログのアクション（交代を除く実行順）と、設定文のアクション（actionRefs）を、先頭から順に対応付ける。
 * 命令の種類が食い違ったら、対応付けを信用できないので mismatch にする（書き戻さない）。
 */
export function alignActions(summary: GcsimLogSummary, refs: GcsimActionRef[]): AlignResult {
  const executed = summary.stints.flatMap(st => st.actions).sort((a, b) => a.frame - b.frame);
  const pairs: AlignedAction[] = [];
  const count = Math.min(executed.length, refs.length);
  for (let i = 0; i < count; i++) {
    if (executed[i].name !== refs[i].command) {
      return {
        pairs: [],
        mismatch: `${i + 1} 番目のアクションが一致しません（設定文: ${refs[i].command} / gcsim のログ: ${executed[i].name}）`,
      };
    }
    pairs.push({ executed: executed[i], ref: refs[i] });
  }
  if (executed.length < refs.length) {
    return { pairs, mismatch: `gcsim のログのアクションが設定文より少ないです（${executed.length} / ${refs.length} 件）。途中で止まった可能性があります` };
  }
  return { pairs };
}

export interface DurationChange {
  stintId: string;
  actionId: string;
  name: string;
  before: number;
  after: number;
}

export interface ApplyDurationsResult {
  stints: Stint[];
  changes: DurationChange[];
  /** gcsim の値が取れなかったアクション（ログの最後のアクションなど）の数 */
  skipped: number;
}

/**
 * アクションの所要時間を書き戻す。
 * gcsim のログで分かるのは「次のアクションの開始までの間隔」= 所要時間 + アプリが渡した遅延（delay）。
 * 所要時間 = 間隔 − 遅延。遅延の値は変えない（渡した値のまま）。
 */
export function applyActionDurations(stints: Stint[], pairs: AlignedAction[]): ApplyDurationsResult {
  const actionById = new Map<string, CharacterActionInstance>();
  for (const st of stints) for (const a of st.actions) actionById.set(a.id, a);

  const next = new Map<string, number>();
  const changes: DurationChange[] = [];
  let skipped = 0;
  for (const { executed, ref } of pairs) {
    if (!isFirstLap(ref)) continue;
    const act = actionById.get(ref.actionId);
    if (!act) continue;
    if (executed.frames === undefined) {
      skipped++;
      continue;
    }
    const delayFrames = Math.max(0, Math.round(actionDelayOf(act) * 60));
    const seconds = Number(framesToSeconds(executed.frames - delayFrames).toFixed(3));
    if (seconds < 0) {
      skipped++;
      continue;
    }
    next.set(ref.actionId, seconds);
    if (Math.abs(seconds - act.duration) >= 0.0005) {
      changes.push({ stintId: ref.stintId, actionId: ref.actionId, name: act.name, before: act.duration, after: seconds });
    }
  }

  const updated = stints.map(st => {
    if (!st.actions.some(a => next.has(a.id))) return st;
    return {
      ...st,
      actions: st.actions.map(a => (next.has(a.id) ? { ...a, duration: next.get(a.id)!, durationManual: true } : a)),
    };
  });
  return { stints: updated, changes, skipped };
}
