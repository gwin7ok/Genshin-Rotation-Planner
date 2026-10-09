/**
 * 「維持」のアクション（モード維持を、出場のアクションの並びの中の本物のアクションにしたもの。D114）。
 *
 * 今まで: 維持は、出場の最後のアクションの後ろに自動で足される表示だけの待ち（保存しない）だった。
 *   E の後ろにアクションを足すと、モードの途中に入り、モードが終わってからのアクションを置けなかった。
 * 今: 維持を、`type: 'wait'`・`actionTypeId: MODE_HOLD_ACTION_ID` のアクションとして並びに持つ。
 *   - 長さは、既定では、そのアクションの開始時刻から「モードが切れるまでの残り」で、自動で決まる（計算側。durationManual で手動の固定にできる）
 *   - 「アクションを追加」は、維持の後ろに入る（モードが終わってからのアクションを置ける）。モードの途中に置きたいものは、維持の前へ移す
 *   - gcsim の設定文には、待機と同じ `wait` として出す
 * 維持のアクションの出し入れ（モード維持のオン・オフ、モードを開いたとき）は、normalizeModeHoldActions が行う。
 */
import type { CharacterActionInstance, Stint } from '../types/genshin';

export const MODE_HOLD_ACTION_ID = 'mode_hold';

export const isModeHoldAction = (a: { actionTypeId?: string }): boolean => a.actionTypeId === MODE_HOLD_ACTION_ID;

export function createModeHoldAction(): CharacterActionInstance {
  return {
    id: `act_hold_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    actionTypeId: MODE_HOLD_ACTION_ID,
    name: '維持',
    shortName: '維',
    type: 'wait',
    duration: 0,
  };
}

/**
 * 計算結果（calculatedStints の modeHold）に合わせて、維持のアクションを出し入れする。変更が無ければ null。
 * - 維持がオン（モードがあり、出場ごとの切り替え・既定でオン）で、維持の余り（seconds）があるのに、維持のアクションが無い → 並びの最後に足す
 * - 維持のアクションがあるのに、維持がオフ・モードが無い → 外す
 * （維持が 0 秒になっても、並びにある維持のアクションは外さない。位置が入れ替わり続けるのを避ける）
 */
export function normalizeModeHoldActions(
  stints: Stint[],
  calculated: { id: string; modeHold?: { on: boolean; seconds: number } }[],
): Stint[] | null {
  const byId = new Map(calculated.map(c => [c.id, c.modeHold] as const));
  let changed = false;
  const next = stints.map(st => {
    const hold = byId.get(st.id);
    const has = st.actions.some(isModeHoldAction);
    if (has && (!hold || !hold.on)) {
      changed = true;
      return { ...st, actions: st.actions.filter(a => !isModeHoldAction(a)) };
    }
    if (!has && hold && hold.on && hold.seconds >= 0.005) {
      changed = true;
      return { ...st, actions: [...st.actions, createModeHoldAction()] };
    }
    return st;
  });
  return changed ? next : null;
}
