import type { Stint } from '../types/genshin';
import { moveActionRespectingGroups } from './actionGroups';

/**
 * ガントチャートのドラッグ中の、仮の並び（2026-10-10。追加作業 21 / issue #16）。
 * ドロップするまで保存せず、計算だけをこの並びで行う。to は、ドラッグ中の要素を抜いた後の並びでの挿入位置（splice の位置）。
 * アクションは、保存データに自動の交代アクション（先頭）が無いことがあるため、番号ではなく ID で指し、to は交代を数えない位置にする
 */
export type DragPreview =
  | { kind: 'stint'; from: number; to: number }
  | { kind: 'action'; stintId: string; actionId: string; /** 交代アクションを数えない挿入位置 */ to: number };

const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
};

/** 仮の並びを適用した出場ブロックの並び（preview が無ければ、そのまま） */
export function applyDragPreview(stints: Stint[], preview: DragPreview | null): Stint[] {
  if (!preview) return stints;
  if (preview.kind === 'stint') return moveItem(stints, preview.from, preview.to);
  return stints.map(s => {
    if (s.id !== preview.stintId) return s;
    const item = s.actions.find(a => a.id === preview.actionId);
    if (!item) return s;
    const rest = s.actions.filter(a => a.id !== preview.actionId);
    // 交代でないアクションを to 個、飛ばした位置に入れる（先頭の交代アクションの前には入れない）
    let pos = 0;
    let seen = 0;
    while (pos < rest.length && (seen < preview.to || rest[pos].type === 'swap')) {
      if (rest[pos].type !== 'swap') seen++;
      pos++;
    }
    // グループの規則（グループの中のアクションは、グループの中だけ。外のアクションは、グループの中に入らない）
    return { ...s, actions: moveActionRespectingGroups(s.actions, preview.actionId, pos) ?? s.actions };
  });
}
