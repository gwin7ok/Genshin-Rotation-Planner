import type { CharacterActionInstance, Stint } from '../../types/genshin';

/**
 * 「アプリの計算に戻す」: アクションの並びはそのままに、gcsim の結果の書き戻し・手での個別の変更をすべて外し、
 * 所要時間・CT・効果時間・副次効果を、アプリの計算（マスターのフレームと CT）で全体に再適用できる状態にする。
 *
 * 外すもの（アクション）: 所要時間の固定（durationManual。gcsim の値も手の編集値も区別できない）、gcsimBaseDuration、
 *   個別の CT（cooldown）・効果時間（effectDuration）、gcsimCtOffset、gcsimCdResonance、extraEffects
 * 外すもの（出場）: gcsim から書き込んだ、キャラに紐づく効果（extraEffects）、gcsim の結果から追加した発動バフ（gcsimKey あり）
 * 残すもの: アクションの種類・順番、手で置いた発動バフ（印 gcsimMissed だけ外す。位置・個別の値は、gcsim が上書きしていても元に戻せない）、ディレイ・メモ
 */
export interface ResetSummary {
  stints: Stint[];
  /** 外したものの件数（0 なら変更なし） */
  actionsChanged: number;
  stintsChanged: number;
  passivesRemoved: number;
}

const ACTION_OVERRIDE_KEYS = [
  'durationManual', 'gcsimBaseDuration', 'cooldown', 'effectDuration', 'gcsimCtOffset', 'gcsimCdResonance', 'extraEffects',
] as const satisfies readonly (keyof CharacterActionInstance)[];

export function resetToAppCalculation(stints: Stint[]): ResetSummary {
  let actionsChanged = 0;
  let stintsChanged = 0;
  let passivesRemoved = 0;

  const next = stints.map(st => {
    let changed = false;

    const actions = st.actions.map(a => {
      if (!ACTION_OVERRIDE_KEYS.some(k => a[k] !== undefined)) return a;
      const copy = { ...a };
      for (const k of ACTION_OVERRIDE_KEYS) delete copy[k];
      actionsChanged++;
      changed = true;
      return copy;
    });

    let passiveTriggers = st.passiveTriggers;
    if (passiveTriggers?.some(p => p.gcsimKey !== undefined || p.gcsimMissed)) {
      const kept = passiveTriggers.filter(p => p.gcsimKey === undefined);
      passivesRemoved += passiveTriggers.length - kept.length;
      passiveTriggers = kept.map(p => {
        if (!p.gcsimMissed) return p;
        const { gcsimMissed: _missed, ...rest } = p;
        return rest;
      });
      changed = true;
    }

    const { extraEffects, ...stintRest } = st;
    const hadExtra = extraEffects !== undefined;
    if (hadExtra) changed = true;

    if (!changed) return st;
    stintsChanged++;
    return { ...stintRest, actions, ...(passiveTriggers ? { passiveTriggers } : {}) };
  });

  return { stints: next, actionsChanged, stintsChanged, passivesRemoved };
}
