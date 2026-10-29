import type { ActionMode, CharacterActionInstance, Stint } from '../../types/genshin';
import { CharacterModel } from '../../models/CharacterModel';
import { MODE_HOLD_ACTION_ID } from '../modeHoldAction';
import { type ModeWindow } from './types';
import { warnQuickSwap, addPassiveTriggers, addCharacterEffectBars } from './stintParts';
import { modeKeyOf, drainAdvance, drainProject, endMode } from './modeHelpers';
import type { StintContext } from './context';
import type { RotationState } from './state';
import { t, joinList } from '../../i18n';
import { charName, loc } from '../../i18n/loc';

/** 出場の準備: キャラ・アクション定義・特殊スキルの受付の補助を揃え、交代のアクションを足して、StintContext を作る。キャラが見つからない出場は undefined */
export function beginStint(state: RotationState, sIdx: number): StintContext | undefined {
  const { rawStints, switchDelay, characterMap, modeWindows, enterFieldByChar, hitlagTotalByChar, nightsoulTrackers, cdResonanceScale } = state;
  const rawStint = rawStints[sIdx];
  const char = characterMap.get(rawStint.characterId);
  if (!char) return undefined;
  const charActions = CharacterModel.fromConfig(char).actions;
  // 爆発の後のモードに、固有の項目（パンチ・蹴り・炎場の拾い）を持つキャラ（ディシア）
  const burstModeAction = charActions.find(a => a.burstMode && a.mode);
  const burstModeDef = burstModeAction?.burstMode;
  // 入力がなければ、状態が切れた後の最初の自動のパンチ（autoPunchFrames ごと）の後に、蹴りが命中する。その時刻（入力があるときは、最も遅い場合）
  const autoKickAt = (m: ModeWindow) => {
    if (!burstModeDef) return m.end;
    const punchAt = m.inputs === 0
      ? m.start + Math.ceil((m.end - m.start) * 60 / burstModeDef.autoPunchFrames - 0.001) * burstModeDef.autoPunchFrames / 60
      : m.end + burstModeDef.autoPunchFrames / 60;
    return punchAt + (burstModeDef.kickHitFrames + burstModeDef.fieldPlaceAfterKickFrames) / 60;
  };

  const stintStartTime = state.currentTime;
  const computedActions: CharacterActionInstance[] = [];
  // 特殊スキル・特殊爆発の受付（モードの定義の special。D78）: この出場で、種類ごとに最後に開いた受付（交代で消える）
  const specialModes: { skill?: ModeWindow; burst?: ModeWindow } = {};
  // この出場で開いた受付（新しい受付に置き換わったものも含む）。出場の終わりで、CT の待機の終わり（ctWindow）を決める
  const stintSpecialModes: ModeWindow[] = [];
  // 時刻 t に、特殊スキル（skill）・特殊爆発（burst）の受付が開いているか（閉じた受付は開いていない）
  const specialOpenAt = (kind: 'skill' | 'burst', t: number) => {
    const m = specialModes[kind];
    return !!m && !m.closed && t <= m.end + 0.001;
  };
  const windowOpenAt = (t: number) => specialOpenAt('skill', t);
  // 受付を延ばす（ヒットストップ・爆発）／閉じる（モードのバーの終わりも動かす）
  const extendSpecial = (m: ModeWindow, seconds: number) => {
    if (!(seconds > 0)) return;
    m.end = Number((m.end + seconds).toFixed(3));
    m.span.endTime = m.end;
    m.span.duration = Number((m.end - m.start).toFixed(3));
  };
  const closeSpecial = (m: ModeWindow, t: number, by?: string) => {
    endMode(m, t, 'ender');
    m.closed = true;
    if (by) m.closedBy = by;
  };
  // 受付の開く条件（ヴァレサの落下攻撃: 命ノ星座・猛烈パッション、フリンズの嵐槍: 幽炎の露顕の間）
  const specialConditionOk = (md: ActionMode, t: number) => {
    const cond = md.special?.openCondition;
    if (!cond) return true;
    if (cond.requiresOpen && !specialOpenAt(cond.requiresOpen, t)) return false;
    if (cond.minConstellation !== undefined || cond.orBlessing) {
      const consOk = cond.minConstellation !== undefined && CharacterModel.fromConfig(char).constellation >= cond.minConstellation;
      const blessingOk = !!cond.orBlessing && !!nightsoulTrackers.get(char.id)?.inBlessing(t);
      if (!consOk && !blessingOk) return false;
    }
    return true;
  };

  // 2-C: 先頭キャラも含め、全出場に交代時間を設ける（switchDelay > 0の場合）
  // これにより先頭キャラの例外処理が不要になり、ループ開始位置へ戻った時も自然に交代時間が入る
  if (sIdx > 0) enterFieldByChar.set(char.id, [...(enterFieldByChar.get(char.id) ?? []), { t: state.currentTime, hitlag: hitlagTotalByChar.get(char.id) ?? 0 }]);
  if (switchDelay > 0) {
    const switchActionStartTime = state.currentTime;
    const switchActionEndTime = Number((state.currentTime + switchDelay).toFixed(3));
    const switchAction: CharacterActionInstance = {
      id: `switch_stint_${rawStint.id}`,
      actionTypeId: 'action_switch_char',
      name: t('messages:rotation.swapName'),
      shortName: t('messages:rotation.swapShort'),
      type: 'swap',
      duration: switchDelay,
      startTime: switchActionStartTime,
      endTime: switchActionEndTime,
    };
    computedActions.push(switchAction);
    state.currentTime = switchActionEndTime;
  }

  // Filter out any runtime-generated swap actions in raw actions to avoid duplicates
  const rawActions = rawStint.actions.filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char');
  // 「維持」のアクション（並びの中の本物のアクション。D114）: 長さは、その開始時刻から、維持が有効なモードの終わりまでの残り
  const hasHoldAction = rawActions.some(a => a.actionTypeId === MODE_HOLD_ACTION_ID);
  const holdRemainingAt = (t: number): number => {
    const modes = [...modeWindows.values()].filter(m => m.charId === char.id && m.sIdx === sIdx && m.def.swap !== 'persists' && !m.def.noHold && !m.endedBy && (rawStint.holdMode ?? m.def.holdByDefault));
    const target = Math.max(0, ...modes.map(m => (m.actionDefId === burstModeAction?.id && !m.finished ? autoKickAt(m) : m.end)));
    return Math.max(0, Number((target - t).toFixed(3)));
  };
  return { rawStint, char, charActions, burstModeAction, burstModeDef, computedActions, specialModes, stintSpecialModes, specialOpenAt, windowOpenAt, extendSpecial, closeSpecial, specialConditionOk, rawActions, holdRemainingAt, sIdx, specialCdScale: cdResonanceScale, normalStreak: 0, previousNormal: undefined, hasHoldAction, autoKickAt, stintStartTime };
}

/** 出場の終わり: モードの維持・モードの終わり方・受付の終わり・交代の警告・発動バフ・副次効果のバー・計算済みの出場の記録 */
export function finishStint(state: RotationState, sc: StintContext): void {
  const { rawStints, calculatedStints, activeBuffs, validationIssues, passiveSpans, ctEvents, charStates, modeWindows, layerEventsByChar, placePickedField, addViolationIssue, options } = state;
  const { rawStint, char, burstModeAction, burstModeDef, computedActions, stintSpecialModes, sIdx, hasHoldAction, autoKickAt, stintStartTime } = sc;
  // モードの維持: 維持が有効なら、出場を、モードの終わりまで延ばす（出場の最後のアクションの後の、自動の待ち。秒数は保存しない）。
  // 延ばすのは、「交代で終わる」「終わらせないと交代できない」モードだけ。「交代しても続く」モードは延ばさず、バーだけ交代の後も続く。
  // 出場ごとの切り替え（holdMode）は、延長を足すかどうかだけに効く（モードの終わりの計算には関わらない）
  const stintModes = [...modeWindows.values()].filter(m => m.charId === char.id && m.sIdx === sIdx && m.def.swap !== 'persists');
  // 維持の延長を出さないモード（放浪者）は、切り替えも出さない
  const holdableModes = stintModes.filter(m => !m.def.noHold);
  const holdOn = (m: ModeWindow) => !m.def.noHold && (rawStint.holdMode ?? m.def.holdByDefault);

  // 維持の目標の時刻: モードの終わり。ディシアは、状態が切れた後の自動の蹴りが命中するまで
  const holdTargetOf = (m: ModeWindow) => (m.actionDefId === burstModeAction?.id && !m.finished ? autoKickAt(m) : m.end);
  const lastAction = [...computedActions].reverse().find(a => a.type !== 'swap');
  let modeHoldSeconds = 0;
  if (hasHoldAction) {
    // 維持のアクションが並びにあるときは、その長さが維持（最後に自動で足さない）
    modeHoldSeconds = Number(computedActions.filter(a => a.actionTypeId === MODE_HOLD_ACTION_ID).reduce((sum, a) => sum + a.duration, 0).toFixed(3));
  } else if (lastAction) {
    const target = Math.max(0, ...stintModes.filter(m => !m.endedBy && holdOn(m)).map(holdTargetOf));
    const extra = Number((target - state.currentTime).toFixed(3));
    if (extra >= 0.005) {
      modeHoldSeconds = extra;
      lastAction.modeHoldSeconds = extra;
      state.currentTime = Number((state.currentTime + extra).toFixed(3));
    }
  }

  const stintEndTime = state.currentTime;
  // 層が溜まる効果: 退場でクリア
  const layerEntry = layerEventsByChar.get(char.id);
  if (layerEntry) layerEntry.events.push({ time: stintEndTime, kind: 'exit' });
  // ディシア: 拾った炎場は、交代の fieldPlaceAfterExitFrames 後、または自動の蹴りの命中の後に置き直される（早いほう）
  const burstModeAtEnd = burstModeAction?.mode ? modeWindows.get(modeKeyOf(char.id, burstModeAction.mode)) : undefined;
  if (burstModeDef && burstModeAtEnd && burstModeAtEnd.sIdx === sIdx && burstModeAtEnd.pending) {
    placePickedField(char.id, burstModeAtEnd, Math.min(stintEndTime + burstModeDef.fieldPlaceAfterExitFrames / 60, autoKickAt(burstModeAtEnd)));
  }
  // 出場の終わりでの、モードの終わり方: 時間切れ／交代で終わる／終わらせないと交代できない（警告）。「交代しても続く」モードは、そのまま続く
  for (const m of stintModes) {
    if (m.endedBy) continue;
    if (m.end <= stintEndTime + 0.001) m.endedBy = 'timeout';
    else if (m.def.swap === 'ends') endMode(m, stintEndTime, 'swap');
    else {
      validationIssues.push({
        id: `mode_blocks_${rawStint.id}_${m.actionDefId}`,
        severity: 'warning',
        characterId: char.id,
        stintId: rawStint.id,
        actionId: lastAction?.id,
        time: stintEndTime,
        title: t('messages:rotation.modeNotEndedTitle', { name: charName(char) }),
        message: m.def.noHold
          ? t('messages:rotation.modeNotEndedHold', { mode: loc(m.def, 'label'), remaining: (m.end - stintEndTime).toFixed(1) })
          : t('messages:rotation.modeNotEnded', { mode: loc(m.def, 'label'), remaining: (m.end - stintEndTime).toFixed(1) }),
      });
    }
  }
  // 受付の有効な終わり（モードの終わり = 受付の終わり〔延長を含む〕・出場の終わり〔交代で消える〕・次の受付の始まりの早いもの）。
  // 特殊スキルの CT は、この時刻より後に始まる待機中のものを積まない
  for (const m of stintSpecialModes) {
    if (m.ctWindow) m.ctWindow.until = m.ctWindow.effectiveEnd = m.end;
  }
  const stintDuration = stintEndTime - stintStartTime;

  warnQuickSwap({ rawStints, sIdx, rawStint, char, stintStartTime, stintDuration, validationIssues });

  addPassiveTriggers({ char, rawStint, sIdx, stintStartTime, database: options?.database, passiveSpans, activeBuffs, ctEvents, addViolationIssue });

  addCharacterEffectBars({ char, rawStint, stintStartTime, activeBuffs });

  // 交代したら、乗っていても降りる（ぐるぐるコマちゃんは独立して残る）。降りた直後の最初の攻撃は、resumeFrames 後
  for (const m of modeWindows.values()) {
    if (!m.def.drain || !m.drain || m.charId !== char.id || m.endedBy || !m.drain.riding || m.sIdx !== sIdx) continue;
    if (stintEndTime >= m.end - 0.001) continue;
    drainAdvance(m, stintEndTime);
    m.drain.riding = false;
    m.drain.nextTick = Number((stintEndTime + m.def.drain.idle.resumeFrames / 60).toFixed(4));
    drainProject(m, stintEndTime);
  }

  const calculatedStint: Stint = {
    ...rawStint,
    startTime: stintStartTime,
    endTime: stintEndTime,
    duration: stintDuration,
    actions: computedActions,
    modeHold: holdableModes.length > 0
      ? { on: holdableModes.some(holdOn), seconds: modeHoldSeconds, label: joinList([...new Set(holdableModes.map(m => loc(m.def, 'label')))]) }
      : undefined,
  };

  calculatedStints.push(calculatedStint);
  charStates[char.id].stints.push(calculatedStint);
  charStates[char.id].totalActiveTime += stintDuration;
}
