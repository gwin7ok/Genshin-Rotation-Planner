import { atkSpdAdjust, CHARGED_ATTACK_SPEED_KEYS } from '../../masterdata/attackSpeedEffects';
import { actionDelayOf } from '../actionDelay';
import { CharacterActionInstance } from '../../types/genshin';
import type { ActionFrames } from '../../types/genshin';
import { CharacterModel } from '../../models/CharacterModel';
import { MODE_HOLD_ACTION_ID } from '../modeHoldAction';
import { type LayerEvent } from '../stateBars';
import { type ModeWindow } from './types';
import { HITLAG_FRAMES, canQueueFrames, cancelKeyOf, type HitlagBase0, type HitlagBase, type HitlagAfter } from './frameTables';
import { isModeActive, modeMaxUses, consValue } from './modeHelpers';
import type { RotationState } from './state';
import type { StintContext, ActionContext } from './context';
import { t } from '../../i18n';
import { charName, loc } from '../../i18n/loc';

/** フレーム表の選択: 通常攻撃の段・モード専用のフレーム・モードを終わらせる動作のフレーム */
export function selectFrames(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { modeWindows } = state;
  const { burstModeDef, char, sIdx } = sc;
  const { act, actionDef, actionStartTime, modeEnder, modeKind, modeRepress, mw, opensMode, stackDetonation } = ac;
  // 通常攻撃: 連続した N の段（gcsim と同じく、他のアクションを挟むと1段目に戻り、最大段数を超えたら1段目に戻る）
  let frames = actionDef?.frames;
  let hitFallbackDuration: number | undefined;
  let normalHitIndex = 0;
  let normalHitFrames: ActionFrames | undefined;
  // モードの専用のフレーム（`mode.normalFrames` / `chargedFrames`）を使った通常攻撃・重撃（ヒットストップの延びのキーと段）
  let modeHit: { key: string; index: number; window: ModeWindow } | undefined;
  // モードの窓の中の、スキルの再押し（ディルックの 2・3 回目の E など）のフレームと、ヒットストップの表のキー
  let repressHit: { key: string; index: number; frames: ActionFrames } | undefined;
  // モードの間だけ、通常攻撃・元素爆発が別の動作になるキャラ（クロリンデの夜巡り）
  const frameMode = [...modeWindows.values()].find(m => isModeActive(m, char.id, sIdx, actionStartTime) && actionStartTime >= m.start - 0.001 && (m.def.normalFrames || m.def.burstFrames || m.def.chargedFrames));
  if (act.type === 'normal') {
    const hits = actionDef?.normalHits;
    if (hits && hits.length > 0) {
      const hit = hits[sc.normalStreak % hits.length];
      normalHitIndex = sc.normalStreak % hits.length;
      normalHitFrames = hit.frames;
      frames = hit.frames ?? frames;
      hitFallbackDuration = hit.duration;
    }
    const ridingDrain = [...modeWindows.values()].find(m => m.def.drain && m.drain?.riding && isModeActive(m, char.id, sIdx, actionStartTime) && actionStartTime >= m.start - 0.001);
    const modeNormal = frameMode?.def.normalFrames ?? ridingDrain?.def.drain?.riddenNormalFrames;
    if (modeNormal?.length) {
      frames = modeNormal[sc.normalStreak % modeNormal.length];
      if (frameMode?.def.normalFrames) modeHit = { key: `${frameMode.actionDefId}#n`, index: sc.normalStreak % modeNormal.length, window: frameMode };
    }
    sc.normalStreak += 1;
  } else {
    // 命ノ星座で、モードの間は通常攻撃の段が戻らない（兹白の C4。gcsim: ResetNormalCounter。モードを開く E もモードの中で数える）
    const constellationNow = CharacterModel.fromConfig(char).constellation;
    const keepChain = [...modeWindows.values()].some(m => m.charId === char.id && isModeActive(m, char.id, sIdx, actionStartTime) && actionStartTime >= m.start - 0.001
      && !!consValue(m.def, m.opener.constellation, 'keepNormalChain'))
      || (opensMode && !!actionDef?.mode && !!consValue(actionDef.mode, constellationNow, 'keepNormalChain'));
    if (!keepChain) sc.normalStreak = 0;
  }
  if (act.type === 'burst' && frameMode?.def.burstFrames) frames = frameMode.def.burstFrames;
  if (act.type === 'charged' && frameMode?.def.chargedFrames) {
    frames = frameMode.def.chargedFrames;
    modeHit = { key: `${frameMode.actionDefId}#ca`, index: 0, window: frameMode };
  }
  // モードを終わらせる動作・もう一度使った動作のフレーム（夢見月瑞希の状態の解除・クロリンデの突き・閑雲の跳躍）
  if (modeEnder?.ender.frames) {
    const ns = modeEnder.window.def.nStacks;
    frames = ns && (modeEnder.window.stacks ?? 0) >= ns.max ? ns.detonate : modeEnder.ender.frames;
  }
  if (stackDetonation) {
    frames = stackDetonation.frames;
    sc.normalStreak = 0;
  }
  if (modeRepress) {
    const rp = modeRepress.window.def.repress!;
    const rpFrames = rp.frames;
    // アクションごとのフレーム（ドゥリン: 受付の間の N は黒の再発動）。通常攻撃の段は 1 段目に戻る
    const byAction = rp.framesByAction?.[act.actionTypeId.slice(char.id.length + 1)];
    if (byAction) {
      frames = Array.isArray(byAction) ? byAction[Math.min(modeRepress.index, byAction.length - 1)] : byAction;
      if (act.type === 'normal') sc.normalStreak = 0;
    } else if (rpFrames.length) {
      const ri = Math.min(modeRepress.index, rpFrames.length - 1);
      frames = rpFrames[ri];
      repressHit = { key: `${modeRepress.window.actionDefId}#r`, index: ri, frames: rpFrames[ri] };
    }
  }
  if (modeKind && burstModeDef && mw) {
    if (modeKind === 'punch') {
      const h = burstModeDef.inputFrames[Math.min(mw.inputs, burstModeDef.inputFrames.length - 1)];
      mw.inputs += 1;
      frames = { total: h, cancels: {}, source: 'burst.go:punchHitmarks（入力のパンチ）' };
      hitFallbackDuration = undefined;
      sc.normalStreak = 0;
    } else if (modeKind === 'kick') {
      frames = { total: burstModeDef.finisher.total, cancels: burstModeDef.finisher.cancels, source: 'burst.go:kickFrames（フィニッシュの蹴り）' };
      hitFallbackDuration = undefined;
      if (act.type === 'normal') sc.normalStreak = 0;
    } else {
      frames = { total: Math.round((actionDef?.defaultDuration ?? 0.2) * 60), cancels: { jump: burstModeDef.dashToJumpFrames }, source: 'dash.go:burstDashDuration（ジャンプへ）' };
    }
  }
  ac.frames = frames;
  ac.hitFallbackDuration = hitFallbackDuration;
  ac.modeHit = modeHit;
  ac.normalHitFrames = normalHitFrames;
  ac.normalHitIndex = normalHitIndex;
  ac.repressHit = repressHit;
}

/** 所要時間の決定: ヒットストップ・受付の延長・攻撃速度・実行結果の記録（命中の時刻など） */
export function resolveDuration(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { attackSpeedOf, burstSnapshotByChar, burstStartByChar, chargedStartByChar, hitTimesByChar, hitlagIncluded, hitlagTotalByChar, modeWindows, normalsSinceSkillByChar, options, skillSnapshotByChar, skillStartByChar } = state;
  const { char, extendSpecial, holdRemainingAt, rawActions, sIdx } = sc;
  const { aIdx, act, actionDef, actionStartTime, frames, hitFallbackDuration, modeHit, normalHitFrames, normalHitIndex, repressHit } = ac;
  // 所要時間: 編集済み（durationManual）ならその値。未編集なら、次に続くアクションに応じたキャンセルフレーム
  // （出場の最後は次が交代）。フレームが無いアクションは、登録時の値を使う
  let autoDuration: number | undefined;
  // ヒットストップで延びるフレーム（フレーム表そのものを使うときだけ。モードなどで別のフレームに置き換えたときは、足さない）
  let hitlagFrames = 0;
  // 次が待機で、ヒットストップが待機に吸収された（所要時間には足さないが、受付の延長などの判定では「含まれる」扱い）
  let hitlagAbsorbed = false;
  // 選んだ表の値（次のアクションの種類で、値を選ぶ）と、遅延なしの値を使うか
  let hitlagSrc: { base: HitlagBase; noDelay: boolean; charged?: HitlagAfter; chargedNoDelay?: boolean } | undefined;
  const hitlagFor = (nextKey: string | undefined): number => {
    if (!hitlagSrc) return 0;
    const { base, noDelay } = hitlagSrc;
    const v: HitlagBase0 = (nextKey && base.byNext?.[nextKey]) || base;
    const p = noDelay && v.d0 ? v.d0 : v;
    let total = options?.defHalt === false ? p.without : p.with;
    // 重撃の直後の通常攻撃の 1 段目: 構えの違い（差）を足す
    const o0 = hitlagSrc.charged;
    const o: HitlagBase0 | undefined = o0 && ((nextKey && o0.byNext?.[nextKey]) || o0);
    if (o) {
      const q = hitlagSrc.chargedNoDelay && o.d0 ? o.d0 : o;
      total += options?.defHalt === false ? q.without : q.with;
    }
    return total;
  };
  if (frames && actionDef) {
    const entry = HITLAG_FRAMES[actionDef.id];
    if (Array.isArray(entry)) {
      const e = act.type === 'normal' && frames === normalHitFrames ? entry[normalHitIndex] : undefined;
      if (e) {
        hitlagSrc = { base: e, noDelay: actionDelayOf(act) === 0 };
        const prevAct = rawActions[aIdx - 1];
        const afterPrev = prevAct?.type === 'charged' ? e.afterCharged : prevAct?.type === 'burst' ? e.afterBurst
          : prevAct?.type === 'skill' ? e.afterSkill : prevAct?.type === 'dash' ? e.afterDash : prevAct?.type === 'jump' ? e.afterJump : undefined;
        if (normalHitIndex === 0 && prevAct && afterPrev) {
          hitlagSrc.charged = afterPrev;
          hitlagSrc.chargedNoDelay = actionDelayOf(prevAct) === 0;
        }
      }
    } else if (entry && frames === actionDef.frames) {
      const prev = rawActions[aIdx - 1];
      const afterNormal = act.type === 'charged' && prev?.type === 'normal' && entry.afterNormal;
      // 遅延なしの値は、重撃の直前の通常攻撃の遅延がないとき（それ以外は、そのアクション自身の遅延がないとき）
      hitlagSrc = { base: afterNormal || entry, noDelay: afterNormal ? actionDelayOf(prev) === 0 : actionDelayOf(act) === 0 };
    }
    hitlagFrames = hitlagFor(undefined);
  }
  // モードの専用のフレームの通常攻撃・重撃: ヒットストップの延び（遅延で値が変わるものは d0）と、モードの終わりの延び（ext）。
  // フレームを、後のモードの上書き（終わらせる動作・もう一度使った動作など）で置き換えたときは足さない
  if (repressHit && frames === repressHit.frames) {
    const raw = HITLAG_FRAMES[repressHit.key];
    const e = Array.isArray(raw) ? raw[repressHit.index] : undefined;
    if (e) {
      hitlagSrc = { base: e, noDelay: actionDelayOf(act) === 0 };
      hitlagFrames = hitlagFor(undefined);
    }
  }
  let modeExtFrames = 0;
  if (modeHit && frames && (frames === modeHit.window.def.chargedFrames || modeHit.window.def.normalFrames?.includes(frames))) {
    const raw = HITLAG_FRAMES[modeHit.key];
    const e = Array.isArray(raw) ? raw[modeHit.index] : raw;
    if (e) {
      hitlagSrc = { base: e, noDelay: actionDelayOf(act) === 0 };
      hitlagFrames = hitlagFor(undefined);
      const noDef = options?.defHalt === false;
      if (e.ext) modeExtFrames = noDef ? e.ext.without : e.ext.with;
    }
  }
  {
    if (frames) {
      const nextKey = cancelKeyOf(rawActions[aIdx + 1], char.weaponType);
      // 爆発の次の重撃が、モードの別の動作（ネフェルの幻の戯）になるとき、つなぎのフレームが短い
      let burstCharged: number | undefined;
      const nextAct = rawActions[aIdx + 1];
      if (act.type === 'burst' && nextAct?.type === 'charged') {
        for (const m of modeWindows.values()) {
          const bf = m.def.burstToChargedFrames;
          const rp = m.def.repress;
          if (!bf || !rp || !isModeActive(m, char.id, sIdx, actionStartTime) || actionStartTime < m.start - 0.001) continue;
          const matches = rp.actions ? rp.actions.some(s => nextAct.actionTypeId === `${char.id}_${s}`) : nextAct.actionTypeId === m.actionDefId;
          if (matches && (modeMaxUses(m) === undefined || m.repressUsed < modeMaxUses(m)!)) { burstCharged = bf; break; }
        }
      }
      const motion = nextKey === 'wait' ? canQueueFrames(frames, actionDef, options?.defHalt !== false) : burstCharged ?? (nextKey ? frames.cancels[nextKey] : undefined) ?? frames.total;
      // ヒットストップの延びは、次のアクションの種類で値が違うことがある（次が待機・不明のときは、次が通常攻撃のときの値）
      if (nextKey === 'wait') {
        // 次が待機のとき: gcsim の待機は、CanQueueAfter（ヒット判定）の時点から始まり、ヒットストップの凍結は待機の中に入る。
        // 待機の後のアクションが、このアクションのキャンセル（+ ヒットストップ）より前に始められないときだけ、その不足分が延びる
        // （N → wait(N) → N の間隔 = max(キャンセル + ヒットストップ, CanQueueAfter + 待機)。D239）
        const waitAct = rawActions[aIdx + 1];
        const waitFrames = waitAct.actionTypeId === MODE_HOLD_ACTION_ID ? Infinity : Math.round(Math.max(0, waitAct.duration || 0) * 60);
        const afterKey = cancelKeyOf(rawActions[aIdx + 2], char.weaponType);
        const afterHit = hitlagFor(afterKey === 'wait' ? undefined : afterKey);
        const afterCancel = (afterKey && afterKey !== 'wait' ? frames.cancels[afterKey] : undefined) ?? frames.total;
        hitlagFrames = Math.max(0, afterCancel + afterHit - motion - waitFrames);
        hitlagAbsorbed = afterHit !== 0;
      } else {
        hitlagFrames = hitlagFor(nextKey);
      }
      // 通常攻撃は、武器の攻撃速度で縮む（ヒットストップの延びは、縮んだ後に足される）
      const atkSpd = act.type === 'normal' || (act.type === 'charged' && CHARGED_ATTACK_SPEED_KEYS.has(char.source?.gcsimKey ?? '')) ? attackSpeedOf(char, actionStartTime, sIdx, rawActions[aIdx - 1]?.type === 'normal' ? sc.previousNormal : undefined) : 0;
      // 縮めたキャンセルが、ヒット判定（hitmark）より早くなるときは、ヒット判定まで待つ（gcsim: CanQueueAfter = hitmark。雷電の爆発中の 5 段目 → E など）
      const motionAdjusted = atkSpd > 0 ? Math.max(atkSpdAdjust(motion, atkSpd), Math.min(motion, frames.hitmark ?? 0)) : motion;
      autoDuration = Number(((motionAdjusted + hitlagFrames) / 60).toFixed(3));
      if (hitlagFrames !== 0 || hitlagAbsorbed) hitlagIncluded.add(act.id);
    } else {
      // フレーム表が無いダッシュ・ジャンプは、マスターの値（gcsim の実測。D215）を使う。手で編集していなければ、保存した値（追加した時点の古い値）ではなく、今のマスターの値にする
      autoDuration = hitFallbackDuration ?? ((act.type === 'dash' || act.type === 'jump') && actionDef?.defaultDuration !== undefined ? actionDef.defaultDuration : undefined);
    }
  }
  // gcsim 自身の標準の所要時間（編集済みでも）。ユーザーが標準より長くした分を gcsim に渡すために使う
  const naturalDuration = act.gcsimBaseDuration ?? autoDuration;
  if (act.durationManual) autoDuration = undefined;
  const isHoldAction = act.actionTypeId === MODE_HOLD_ACTION_ID;
  const duration = isHoldAction
    ? (act.durationManual ? Math.max(0, act.duration || 0) : holdRemainingAt(actionStartTime))
    : Math.max(0.05, autoDuration ?? (act.duration || 0.5));
  const actionEndTime = Number((actionStartTime + duration).toFixed(3));
  // 元素爆発の開始（攻撃速度の効果の「爆発の後 N 秒」に使う）と、直前の通常攻撃（「通常攻撃の状態」に使う）
  // 効果は、このアクションの命中（ヒットストップ）より前に付くので、ヒットストップの合計は、このアクションの分を足す前の値
  const hitlagBefore = hitlagTotalByChar.get(char.id) ?? 0;
  if (act.type === 'burst') burstSnapshotByChar.set(char.id, new Map(hitlagTotalByChar));
  if (act.type === 'skill') skillSnapshotByChar.set(char.id, new Map(hitlagTotalByChar));
  hitlagTotalByChar.set(char.id, hitlagBefore + Math.max(0, hitlagFrames) / 60);
  if (act.type === 'burst') burstStartByChar.set(char.id, { t: actionStartTime, sIdx, hitlag: hitlagBefore });
  if (act.type === 'skill') { skillStartByChar.set(char.id, { t: actionStartTime, hitlag: hitlagBefore }); normalsSinceSkillByChar.set(char.id, 0); }
  if (act.type === 'normal' && normalsSinceSkillByChar.has(char.id)) normalsSinceSkillByChar.set(char.id, normalsSinceSkillByChar.get(char.id)! + 1);
  if (act.type === 'charged') chargedStartByChar.set(char.id, actionStartTime);
  if ((act.type === 'normal' || act.type === 'charged' || act.type === 'skill' || act.type === 'burst') && frames?.hitmark !== undefined) {
    hitTimesByChar.set(char.id, [...(hitTimesByChar.get(char.id) ?? []), { t: Number((actionStartTime + frames.hitmark / 60).toFixed(3)), hitlag: hitlagBefore, tag: act.type }]);
  }
  // 通常攻撃の状態は、アニメーションが終わると外れる。ヒットストップで止まった分、アニメーションも延びる
  sc.previousNormal = act.type === 'normal' && frames
    ? { start: actionStartTime, total: frames.total + Math.max(0, hitlagFrames), cancel: (frames.cancels.attack ?? frames.total) + Math.max(0, hitlagFrames) }
    : undefined;
  // モードの終わりを、そのヒットのヒットストップで延ばす（gcsim の `mod extended`。雷電の爆発・綾人のスキルなど。D215）
  if (modeHit && modeExtFrames > 0) extendSpecial(modeHit.window, modeExtFrames / 60);
  ac.actionEndTime = actionEndTime;
  ac.duration = duration;
  ac.hitlagFrames = hitlagFrames;
  ac.naturalDuration = naturalDuration;
}

/** 計算済みのアクション（computedAction）の組み立てと、モード・ゲージの警告 */
export function buildComputedAction(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { layerEventsByChar, modeWindows, options, validationIssues } = state;
  const { char, charActions, computedActions, rawActions, rawStint, sIdx } = sc;
  const { aIdx, act, actionDef, actionEndTime, actionStartTime, blockedMessage, duration, frames, gaugeMessage, hitlagFrames, modeRepress, naturalDuration, opensMode } = ac;
  // 長押しの秒数（CT開始位置が「長押し終了」のアクション）: 所要時間 −（ホールド 0 のときのモーション）。
  // モーション = 次に続くアクションに応じたキャンセルフレーム。frames に長押しが含まれる分（holdInFrames）は差し引く
  const cooldownStart = actionDef?.cooldownStart;
  let holdSeconds: number | undefined;
  if (cooldownStart?.from === 'holdEnd') {
    const nextKey = cancelKeyOf(rawActions[aIdx + 1], char.weaponType);
    const motionFrames = frames ? (nextKey === 'wait' ? canQueueFrames(frames, actionDef, options?.defHalt !== false) : (nextKey ? frames.cancels[nextKey] : undefined) ?? frames.total) : undefined;
    holdSeconds = motionFrames === undefined
      ? 0
      // モードの間に別の動作になった長押し（キィニチの廻狩貫鱗砲）は、フレームが長押しを含まない（既定は最短の照準）
      : Number(Math.max(0, duration - ((motionFrames + hitlagFrames) / 60 - (modeRepress ? 0 : actionDef?.holdInFrames ?? 0))).toFixed(3));
  }

  // 状態によって爆発の種類が変わるキャラ（ドゥリン: 漆黒の否の間は漆黒の法則）: アクションと効果バーの名前を、その種類にする
  const burstVariantMode = act.type === 'burst'
    ? [...modeWindows.values()].find(m => m.charId === char.id && m.def.burstVariant && isModeActive(m, char.id, sIdx, actionStartTime) && actionStartTime >= m.start - 0.001)
    : undefined;
  const computedAction: CharacterActionInstance = {
    ...act,
    // 略号は、保存データのコピーではなく、アクション定義から引く（略号を変えても、保存済みの出場ブロックに反映される）
    ...(actionDef?.shortName ? { shortName: actionDef.shortName } : {}),
    ...(burstVariantMode?.def.burstVariant ? { name: loc(burstVariantMode.def.burstVariant, 'name') } : {}),
    hasCTCollision: false,
    collisionRemainingCT: undefined,
    ...(ac.repressGcsimCommand ? { gcsimCommand: ac.repressGcsimCommand } : {}),
    ...(holdSeconds !== undefined ? { holdSeconds } : {}),
    ...(naturalDuration !== undefined ? { naturalDuration } : {}),
    ...(actionDef?.cooldownPool ? { cooldownPool: actionDef.cooldownPool } : {}),
    modeHoldSeconds: undefined,
    duration,
    startTime: actionStartTime,
    endTime: actionEndTime,
  };
  computedActions.push(computedAction);
  // 層が溜まる効果（ヴェスナ）: E で新しい状態に入る = クリア（命ノ星座 2 は最大層から）、別の動作になった E・爆発 = +1 層
  const layerRule = charActions.find(a => a.layerBuff)?.layerBuff;
  if (layerRule && !blockedMessage && (act.type === 'skill' || act.type === 'burst')) {
    const kind: LayerEvent['kind'] | undefined = act.type === 'burst' ? 'gain' : modeRepress ? 'gain' : opensMode ? 'enter' : undefined;
    if (kind) {
      const entry = layerEventsByChar.get(char.id) ?? { rule: layerRule, events: [] };
      entry.events.push({ time: actionStartTime, kind });
      layerEventsByChar.set(char.id, entry);
    }
  }
  if (blockedMessage) {
    computedAction.specialWindowWarning = blockedMessage;
    validationIssues.push({
      id: `mode_blocked_${act.id}`,
      severity: 'warning',
      characterId: char.id,
      stintId: rawStint.id,
      actionId: act.id,
      time: actionStartTime,
      title: t('messages:rotation.blockedTitle', { name: charName(char) }),
      message: blockedMessage,
    });
  }

  if (gaugeMessage) {
    computedAction.specialWindowWarning = gaugeMessage;
    validationIssues.push({
      id: `mode_gauge_${act.id}`,
      severity: 'warning',
      characterId: char.id,
      stintId: rawStint.id,
      actionId: act.id,
      time: actionStartTime,
      title: t('messages:rotation.gaugeTitle', { name: charName(char) }),
      message: gaugeMessage,
    });
  }
  ac.burstVariantMode = burstVariantMode;
  ac.computedAction = computedAction;
  ac.cooldownStart = cooldownStart;
  ac.holdSeconds = holdSeconds;
}
