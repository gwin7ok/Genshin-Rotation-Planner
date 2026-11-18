/**
 * CT 違反（赤）・CT 警告（黄）の印の一覧と、ヘッダーの ▲▼ ボタンで「前・次の印」へ進む選び方（issue #57）。
 *
 * ヘッダーの件数（CT違反 N 件・CT警告 N 件）と、移動先の数は、必ず同じになるよう、ここで 1 回だけ数える
 * （件数を別々に数えない）。画面（React）にも DOM にも依存しない（scripts/check-ct-marks.ts で確かめる）。
 */
import type { PassiveSpan, Stint, ValidationIssue } from '../types/genshin';

export type CtMarkKind = 'violation' | 'warning';

export interface CtMark {
  /** 一覧の中で一意の識別子（「前・次」の続きを覚えるのに使う） */
  id: string;
  kind: CtMarkKind;
  /** 印がある出場ブロックの ID（印そのものが見つからないときの移動先） */
  stintId?: string;
  /** 印が付いているアクション（ガントのアクションのバー） */
  actionId?: string;
  /** 印が付いている発動バフ（固有天賦・武器・聖遺物）のバー */
  passiveId?: string;
  /** 印の時刻（1 周目の秒。再生位置の移動に使う） */
  time: number;
}

/**
 * CT 警告として数える検証メッセージ（ヘッダーの「CT警告」の件数に入るもの）。
 * 発動バフの CT 中の発動は、検証メッセージ（passive_ct_）ではなく、発動バフ（PassiveSpan）の印で数える（二重に数えない）
 */
export const CT_WARNING_ISSUE_PATTERN = /^(special_window_|plunge_prereq_|gcsim_unsupported_|mode_blocks_|mode_blocked_)/;

/** ガントの印の目印（data-ct-target）の値 */
export const ctActionTarget = (actionId: string): string => `act:${actionId}`;
export const ctPassiveTarget = (passiveId: string): string => `passive:${passiveId}`;

/** 移動先の印の、ガント上の目印の値（印のアクション・発動バフが無いときは null。出場ブロックの行へ移動する） */
export function ctTargetKey(mark: Pick<CtMark, 'actionId' | 'passiveId'>): string | null {
  if (mark.actionId) return ctActionTarget(mark.actionId);
  if (mark.passiveId) return ctPassiveTarget(mark.passiveId);
  return null;
}

export interface CtMarks {
  /** CT 違反（スキル・爆発。gcsim で待たずに実行できると確認済みのものは除く） */
  violations: CtMark[];
  /** CT 警告（発動バフの CT 中の発動・特殊スキルの受付時間外・落下攻撃の前提不足・gcsim 未対応など） */
  warnings: CtMark[];
}

/**
 * 印の一覧を作る。並びは、ガントの上から下（出場ブロックの順）、同じ出場の中では時刻の順
 * （▲ = 上・前、▼ = 下・次 の向きと、一致させる）
 */
export function buildCtMarks(stints: readonly Stint[], passiveSpans: readonly PassiveSpan[], validationIssues: readonly ValidationIssue[]): CtMarks {
  const stintOrder = new Map<string, number>();
  stints.forEach((s, i) => stintOrder.set(s.id, i));
  const orderOf = (m: CtMark): number => (m.stintId !== undefined ? stintOrder.get(m.stintId) : undefined) ?? Number.MAX_SAFE_INTEGER;
  const sort = (list: CtMark[]): CtMark[] => list
    .map((m, i) => ({ m, i }))
    .sort((a, b) => orderOf(a.m) - orderOf(b.m) || a.m.time - b.m.time || a.i - b.i)
    .map(x => x.m);

  const violations: CtMark[] = [];
  for (const s of stints) {
    for (const a of s.actions) {
      if (a.hasCTCollision && !a.ctGcsimVerified) {
        violations.push({ id: `v:${a.id}`, kind: 'violation', stintId: s.id, actionId: a.id, time: a.startTime ?? 0 });
      }
    }
  }

  const warnings: CtMark[] = [];
  for (const p of passiveSpans) {
    if (p.hasCTViolation) {
      warnings.push({ id: `w:passive:${p.id}`, kind: 'warning', stintId: p.stintId, passiveId: p.id, time: p.startTime });
    }
  }
  for (const v of validationIssues) {
    if (CT_WARNING_ISSUE_PATTERN.test(v.id)) {
      warnings.push({ id: `w:${v.id}`, kind: 'warning', stintId: v.stintId, actionId: v.actionId, time: v.time });
    }
  }

  return { violations: sort(violations), warnings: sort(warnings) };
}

/**
 * 「前・次」の印を選ぶ。lastId = 最後に移動した印（まだ移動していなければ null）。dir = 1（▼ 次）/ -1（▲ 前）。
 * - 最初に ▼ を押すと 1 件目、最初に ▲ を押すと最後の 1 件。端では、反対側の端へ回る
 * - lastId が一覧に無い（編集で、その印が無くなった）ときも、最初の押し方と同じ（▼ は先頭、▲ は末尾）
 */
export function stepCtMark(list: readonly CtMark[], lastId: string | null, dir: 1 | -1): CtMark | null {
  if (list.length === 0) return null;
  const index = lastId === null ? -1 : list.findIndex(m => m.id === lastId);
  if (index < 0) return dir > 0 ? list[0] : list[list.length - 1];
  return list[(index + dir + list.length) % list.length];
}

/** 最後に移動した印が、一覧の何件目か（1 から。まだ移動していない・一覧に無いときは 0。ボタンの説明に出す） */
export function ctMarkPosition(list: readonly CtMark[], lastId: string | null): number {
  if (lastId === null) return 0;
  return list.findIndex(m => m.id === lastId) + 1;
}
