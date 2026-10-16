import { ActiveBuffSpan } from '../../types/genshin';
import type { ActionMode } from '../../types/genshin';
import type { RotationState } from './state';
import type { ModeWindow } from './types';

/** モード（スキル・爆発で入る状態）の計算の補助。状態（RotationState）を使うものは、第 1 引数で受け取る */

// モードの間か（交代で終わるモードは、同じ出場の中だけ）
export const isModeActive = (m: ModeWindow, charId: string, sIdx: number, t: number) =>
  m.charId === charId && !m.endedBy && t < m.end - 0.001 && (m.sIdx === sIdx || m.def.swap === 'persists');

export const cutBar = (span: ActiveBuffSpan, at: number) => {
  span.endTime = Number(Math.max(span.startTime, at).toFixed(3));
  span.duration = Number((span.endTime - span.startTime).toFixed(3));
};
export const modeKeyOf = (charId: string, md: ActionMode) => `${charId}:${md.label}`;
// 命ノ星座による、別の動作の使える回数（兹白の C1: 4 → 5）・ゲージの初期値（C1: 100）
export const modeMaxUses = (m: ModeWindow): number | undefined => {
  let v = m.def.repress?.maxUses;
  for (const c of m.def.byConstellation ?? []) if (m.opener.constellation >= c.minConstellation && c.repressMaxUses !== undefined) v = c.repressMaxUses;
  return v;
};
export const modeGaugeInitial = (m: ModeWindow): number => {
  let v = 0;
  for (const c of m.def.byConstellation ?? []) if (m.opener.constellation >= c.minConstellation && c.gaugeInitial !== undefined) v = c.gaugeInitial;
  return v;
};
// 命ノ星座による変化（byConstellation）のうち、その項目を持つ最も高い星座の値（その星座以上のとき）
export const consValue = <K extends keyof NonNullable<ActionMode['byConstellation']>[number]>(
  def: ActionMode, constellation: number, key: K,
): NonNullable<ActionMode['byConstellation']>[number][K] | undefined => {
  let v: NonNullable<ActionMode['byConstellation']>[number][K] | undefined;
  for (const c of def.byConstellation ?? []) if (constellation >= c.minConstellation && c[key] !== undefined) v = c[key];
  return v;
};
export const modeGainScale = (m: ModeWindow): number => consValue(m.def, m.opener.constellation, 'gaugeGainScale') ?? 1;
// 減る値（カチーナの夜魂値）: 時刻 to まで、時間による消費を数える（乗っている間は連続、降りている間は一定の間隔の離散）
export const drainAdvance = (m: ModeWindow, to: number) => {
  const d = m.def.drain;
  const st = m.drain;
  if (!d || !st || to <= st.at) return;
  if (st.points > 0) {
    if (st.riding) {
      st.points = Math.max(0, st.points - (d.ridden.amount / (d.ridden.everyFrames / 60)) * (to - st.at));
    } else {
      const every = d.idle.everyFrames / 60;
      while (st.nextTick <= to + 1e-6 && st.points > 0) {
        st.points = Math.max(0, st.points - d.idle.amount);
        st.nextTick = Number((st.nextTick + every).toFixed(4));
      }
    }
  }
  st.at = to;
};
// 減る値の残りから、モードの終わりの時刻を求め直す（バーの終わりも更新する）
export const drainProject = (m: ModeWindow, fromTime: number) => {
  const d = m.def.drain;
  const st = m.drain;
  if (!d || !st || m.endedBy) return;
  let end: number;
  if (st.points <= 0.0001) end = fromTime;
  else if (st.riding) end = st.at + st.points / (d.ridden.amount / (d.ridden.everyFrames / 60));
  else end = st.nextTick + (Math.ceil(st.points / d.idle.amount - 1e-6) - 1) * (d.idle.everyFrames / 60);
  m.end = Number(Math.max(m.start, end).toFixed(3));
  m.span.endTime = m.end;
  m.span.duration = Number((m.end - m.span.startTime).toFixed(3));
};
export const endMode = (m: ModeWindow, at: number, by: NonNullable<ModeWindow['endedBy']>) => {
  m.naturalEnd ??= m.end;
  m.end = Number(Math.max(m.start, Math.min(m.end, at)).toFixed(3));
  m.endedBy = by;
  m.span.endTime = m.end;
  m.span.duration = Number((m.end - m.span.startTime).toFixed(3));
};
// 爆発が拾った炎場（ディシア）を、時刻 at に置き直す（残り時間 + 拾いの延長のバーを出す。まだ置き直していない回の再生成の窓は、新しい炎場の終わりまで延ばす）
export const placePickedFieldIn = (state: RotationState, charId: string, mw: { pending?: { savedFrames: number; template: ActiveBuffSpan } }, at: number) => {
  const { activeBuffs, fieldSpans, modeWindows } = state;
  if (!mw.pending) return;
  const { savedFrames, template } = mw.pending;
  mw.pending = undefined;
  const startTime = Number(at.toFixed(3));
  const placed: ActiveBuffSpan = {
    ...template,
    id: `${template.id}_burst_${startTime}`,
    startTime,
    endTime: Number((startTime + savedFrames / 60).toFixed(3)),
    duration: Number((savedFrames / 60).toFixed(3)),
  };
  activeBuffs.push(placed);
  fieldSpans.set(charId, placed);
  // 置き直しの受付（剣域熾焔）が未使用なら、新しい炎場の終わりまで延ばす
  for (const m of modeWindows.values()) {
    if (m.charId === charId && m.hasField && !m.endedBy) m.end = Math.max(m.end, placed.endTime);
  }
};
