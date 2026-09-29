/**
 * gcsim の結果のCT待ち → アプリのアクション（フェーズ6 / 6-3b、D21）
 *
 * ログの CT待ち（`could not execute <action>; action not ready`）は、待ったあとに実行されたアクションを
 * 設定文のアクション（`actionRefs`）と実行順で対応付けて、アプリのアクションに引き当てる。
 * 交代の待ち（swap）はアクションではないので対象外（交代の内部CT）。
 */
import type { GcsimActionRef } from './buildGcsimConfig.ts';
import { framesToSeconds, type GcsimLogSummary } from './readGcsimLog.ts';

export interface CtWaitMarks {
  /** アプリのアクション ID → gcsim で待った秒数（複数の周・待ちがあれば最大） */
  byActionId: Record<string, number>;
  /** 対応付けできなかった待ち（設定文とログの並びが合わない）。開発時に気づけるよう記録する */
  unmatched: { action: string; charIndex: number; frame: number }[];
  /** 交代の待ち（対象外）の件数 */
  swapWaits: number;
}

export function mapCtWaitsToActions(summary: GcsimLogSummary, refs: GcsimActionRef[]): CtWaitMarks {
  const executed = summary.stints.flatMap(st => st.actions).sort((a, b) => a.frame - b.frame);
  const marks: CtWaitMarks = { byActionId: {}, unmatched: [], swapWaits: 0 };

  for (const wait of summary.cooldownWaits) {
    if (wait.action === 'swap') {
      marks.swapWaits++;
      continue;
    }
    // 待ったあとに実行されたアクション（待ち終わりの直後の、同じキャラ・同じ種類）
    const index = executed.findIndex(a => a.charIndex === wait.charIndex && a.name === wait.action && a.frame >= wait.toFrame);
    const ref = index >= 0 ? refs[index] : undefined;
    if (!ref || ref.command !== wait.action) {
      marks.unmatched.push({ action: wait.action, charIndex: wait.charIndex, frame: wait.fromFrame });
      continue;
    }
    // 「実行できない」と出た最後のフレームの次で実行される。待ち始めからそのフレームまで
    const seconds = Number(framesToSeconds(wait.toFrame - wait.fromFrame + 1).toFixed(2));
    marks.byActionId[ref.actionId] = Math.max(marks.byActionId[ref.actionId] ?? 0, seconds);
  }
  return marks;
}
