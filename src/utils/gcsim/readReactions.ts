/**
 * 反応の状態の読み取り（月感電の雲・月結晶の設置物・星電導のフィールド・星拡散の渦と爆発後の強化。D112）。
 *
 * 純粋関数。gcsim の詳細ログ（/sample の logs）から、キャラに属さない「反応側の状態」を、種類ごとの区間（フレーム）にまとめる。
 * 区間には、スタック数（月結晶の設置物の数・星電導のスタック・星拡散のスタック）を持たせる。
 * アクションの開始を基準にした位置（anchorReactionRows）に直して、編集後も位置がずれないようにする。
 *
 * 出典（gcsim pkg/reactable）:
 *   月感電   … `lunarcharged-cloud`（5.5 秒。反応のたびに延びる）
 *   月結晶   … 設置物 `LunarCrystallize`（3 つ。9 秒）
 *   星電導   … `polestar-field`（フィールド 6 秒。4 秒ごとに適用中のスタックを更新。最大 12）
 *   星拡散   … ダメージ `Stellar Swirl`（渦に 1 スタック。最大 6）→ `Stellar Swirl Detonation`（渦の爆発。181f で爆発）、
 *              爆発後に `ssw-airborne-buff`（5 秒）
 *   月開花   … 状態が無い（バーにならない）
 */
import type { GcsimLogEvent } from './gcsimClient.ts';
import type { GcsimActionRef } from './buildGcsimConfig.ts';
import type { ReactionKind, ReactionRowRef } from '../../types/genshin.ts';

export interface FrameSegment {
  startFrame: number;
  endFrame: number;
  /** スタック数・設置物の数（無いものは undefined） */
  count?: number;
}

export interface FrameReactionRow {
  kind: ReactionKind;
  /** スタックの最大（count を持つ行） */
  max?: number;
  segments: FrameSegment[];
}

const VORTEX_FRAMES = 181;

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const keyOf = (e: GcsimLogEvent): string | undefined => (typeof e.logs?.key === 'string' ? e.logs.key : undefined);

/** 区間の和集合（重なる・接するものを 1 つにする） */
function mergeIntervals(list: { start: number; end: number }[]): { start: number; end: number }[] {
  const sorted = [...list].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: { start: number; end: number }[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

/** 状態キーのイベント（added / refreshed）から、区間の和集合を作る。終わりは `ended`・`expiry` の大きいほう */
function statusIntervals(logs: GcsimLogEvent[], key: string): { start: number; end: number }[] {
  const list: { start: number; end: number }[] = [];
  for (const e of logs) {
    if (e.event !== 'status' || keyOf(e) !== key) continue;
    if (!/added|refreshed/.test(e.msg)) continue;
    const end = Math.max(num(e.ended) ?? -1, num(e.logs?.expiry) ?? -1, e.frame);
    list.push({ start: e.frame, end });
  }
  return mergeIntervals(list);
}

export function extractReactionRows(logs: GcsimLogEvent[]): FrameReactionRow[] {
  const rows: FrameReactionRow[] = [];

  // 月感電の雲
  {
    const iv = statusIntervals(logs, 'lunarcharged-cloud');
    if (iv.length) rows.push({ kind: 'lunarcharged', segments: iv.map(i => ({ startFrame: i.start, endFrame: i.end })) });
  }

  // 月結晶の設置物（作られたら +1・壊れたら −1。数が変わるたびに区間を分ける）
  {
    const steps: { frame: number; delta: number }[] = [];
    for (const e of logs) {
      if (e.event !== 'construct') continue;
      if (e.msg.startsWith('construct created: LunarCrystallize')) steps.push({ frame: e.frame, delta: 1 });
      else if (e.msg.startsWith('construct destroyed: LunarCrystallize')) steps.push({ frame: e.frame, delta: -1 });
    }
    steps.sort((a, b) => a.frame - b.frame);
    const segments: FrameSegment[] = [];
    let count = 0;
    let max = 0;
    for (let i = 0; i < steps.length; i++) {
      count = Math.max(0, count + steps[i].delta);
      max = Math.max(max, count);
      const next = steps[i + 1]?.frame;
      if (count > 0 && next !== undefined && next > steps[i].frame) segments.push({ startFrame: steps[i].frame, endFrame: next, count });
    }
    if (segments.length) rows.push({ kind: 'lunarcrystallize', max: Math.max(3, max), segments });
  }

  // 星電導のフィールド（フィールドの区間を、適用中のスタックの更新で分ける）
  {
    const fields = statusIntervals(logs, 'polestar-field');
    const updates = logs
      .filter(e => e.event === 'element' && e.msg === 'Updating polestar field buff stacks')
      .map(e => ({ frame: e.frame, stacks: num(e.logs?.new_stacks) ?? 0 }))
      .sort((a, b) => a.frame - b.frame);
    const segments: FrameSegment[] = [];
    for (const f of fields) {
      // 区間の中の更新（フィールドが出た瞬間の更新を含む）
      const inside = updates.filter(u => u.frame >= f.start && u.frame <= f.end);
      let cur = f.start;
      let stacks = 0;
      for (const u of inside) {
        if (u.frame > cur) {
          segments.push({ startFrame: cur, endFrame: u.frame, count: stacks });
          cur = u.frame;
        }
        stacks = u.stacks;
      }
      if (f.end > cur) segments.push({ startFrame: cur, endFrame: f.end, count: stacks });
    }
    if (segments.length) rows.push({ kind: 'stellarconduct', max: 12, segments });
  }

  // 星拡散の渦（スタック +1 ごとに区間を分ける。爆発で 0 に戻る）と、爆発後の強化
  {
    const swirls = new Set<number>();
    const bursts = new Set<number>();
    for (const e of logs) {
      if (e.event !== 'damage') continue;
      const abil = e.logs?.abil;
      if (abil === 'Stellar Swirl') swirls.add(num(e.logs?.source_frame) ?? e.frame);
      else if (abil === 'Stellar Swirl Detonation') bursts.add(e.frame);
    }
    const timeline = [
      ...[...swirls].map(frame => ({ frame, kind: 'swirl' as const })),
      ...[...bursts].map(frame => ({ frame, kind: 'burst' as const })),
    ].sort((a, b) => a.frame - b.frame || (a.kind === 'swirl' ? -1 : 1));
    const segments: FrameSegment[] = [];
    let stacks = 0;
    let vortexStart = -1;
    let segStart = -1;
    const close = (end: number) => {
      if (stacks > 0 && segStart >= 0 && end > segStart) segments.push({ startFrame: segStart, endFrame: end, count: stacks });
    };
    for (const ev of timeline) {
      if (ev.kind === 'swirl') {
        // 爆発が記録されないまま 181f 過ぎていたら、そこで爆発したとみなす
        if (stacks > 0 && vortexStart >= 0 && ev.frame >= vortexStart + VORTEX_FRAMES) {
          close(vortexStart + VORTEX_FRAMES);
          stacks = 0;
        }
        if (stacks === 0) vortexStart = ev.frame;
        else close(ev.frame);
        stacks = Math.min(6, stacks + 1);
        segStart = ev.frame;
      } else {
        close(ev.frame);
        stacks = 0;
        vortexStart = -1;
        segStart = -1;
      }
    }
    if (stacks > 0 && vortexStart >= 0) close(vortexStart + VORTEX_FRAMES);
    if (segments.length) rows.push({ kind: 'stellarswirl', max: 6, segments });

    const air = statusIntervals(logs, 'ssw-airborne-buff');
    if (air.length) rows.push({ kind: 'stellarswirl_airborne', segments: air.map(i => ({ startFrame: i.start, endFrame: i.end })) });
  }

  return rows;
}

/** 反応の区間を、アクションの開始を基準にした位置に直す。lapEndFrame 以降（2 周目以降）は含めない */
export function anchorReactionRows(
  rows: FrameReactionRow[],
  pairs: { executedFrame: number; actionId: string }[],
  lapEndFrame: number,
): ReactionRowRef[] {
  if (pairs.length === 0) return [];
  const sorted = [...pairs].sort((a, b) => a.executedFrame - b.executedFrame);
  const anchorOf = (frame: number) => {
    let pick = sorted[0];
    for (const p of sorted) {
      if (p.executedFrame <= frame) pick = p;
      else break;
    }
    return { actionId: pick.actionId, offset: Number(((frame - pick.executedFrame) / 60).toFixed(3)) };
  };
  const out: ReactionRowRef[] = [];
  for (const row of rows) {
    const segments = row.segments
      .filter(s => s.startFrame < lapEndFrame)
      .map(s => ({
        start: anchorOf(s.startFrame),
        end: anchorOf(Math.min(s.endFrame, lapEndFrame)),
        ...(s.count !== undefined ? { count: s.count } : {}),
      }));
    if (segments.length) out.push({ kind: row.kind, ...(row.max !== undefined ? { max: row.max } : {}), segments });
  }
  return out;
}

/** 設定文のアクションとログの対応（alignActions の結果）から、アンカーの入力と、1 周目の終わりのフレームを作る */
export function reactionAnchorInput(
  pairs: { executed: { frame: number }; ref: GcsimActionRef }[],
): { anchors: { executedFrame: number; actionId: string }[]; lapEndFrame: number } {
  const isFirst = (r: GcsimActionRef) => r.phase === 'initial' || r.loopIteration === 1;
  const first = pairs.filter(p => isFirst(p.ref));
  const later = pairs.filter(p => !isFirst(p.ref));
  return {
    anchors: first.map(p => ({ executedFrame: p.executed.frame, actionId: p.ref.actionId })),
    lapEndFrame: later.length ? Math.min(...later.map(p => p.executed.frame)) : Infinity,
  };
}
