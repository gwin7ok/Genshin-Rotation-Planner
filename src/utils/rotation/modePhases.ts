import { ActiveBuffSpan } from '../../types/genshin';
import type { ActionFrames, ModeEnder } from '../../types/genshin';
import { CharacterModel } from '../../models/CharacterModel';
import { type ModeWindow } from './types';
import { isModeActive, modeKeyOf, modeMaxUses, modeGaugeInitial, consValue, modeGainScale, drainAdvance, drainProject, endMode } from './modeHelpers';
import type { RotationState } from './state';
import type { StintContext, ActionContext } from './context';
import { actionName, charName, loc } from '../../i18n/loc';
import { actionKindOf } from '../characterActions';
import { t } from '../../i18n';

/** モードの判定: このアクションが、続いているモードを終わらせる・もう一度使う・ブロックされる・新しいモードを開くか */
export function detectModeContext(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { modeWindows, placePickedField } = state;
  const { burstModeAction, burstModeDef, char, computedActions, sIdx, specialConditionOk } = sc;
  const { act, actionDef, actionStartTime } = ac;
  // モードの中の E（終わらせる E・別の動作になる E。CT・効果バーを持たない）
  ac.inStateWindow = false;

  // モード（スキル・爆発で入る状態）: このアクションが、続いているモードを終わらせるアクションか（モードの定義の enders）。
  // 「交代しても続く」モードは、後の出場のアクションでも終わらせられる
  let modeEnder: { window: ModeWindow; ender: ModeEnder } | undefined;
  // モードの間に、開いたアクションをもう一度使った（終わらせない別の動作。クロリンデの突き・閑雲の 2・3 段目の跳躍）
  let modeRepress: { window: ModeWindow; index: number } | undefined;
  // 別の動作になった E の、gcsim の命令（パラメータ付き。フィッシュルのオズの間の E = skill[recast=1]）
      
  for (const m of modeWindows.values()) {
    if (!isModeActive(m, char.id, sIdx, actionStartTime)) continue;
    const ender = m.def.enders.find(e => (e.by === 'self' ? act.actionTypeId === m.actionDefId : act.type === e.by));
    if (ender) {
      modeEnder = { window: m, ender };
      break;
    }
    const rp = m.def.repress;
    const repressMatches = rp && (rp.actions ? rp.actions.some(s => act.actionTypeId === `${char.id}_${s}`) : act.actionTypeId === m.actionDefId);
    if (rp && repressMatches && (modeMaxUses(m) === undefined || m.repressUsed < modeMaxUses(m)!)) {
      modeRepress = { window: m, index: m.repressUsed };
      break;
    }
  }

  // 通常攻撃で溜まるスタック（フレミネのペールスタイマー）: N のたびに溜まり、max の後の N は起爆（モードを終わらせる）になる
  let stackDetonation: { window: ModeWindow; frames: ActionFrames } | undefined;
  if (!modeEnder && act.type === 'normal') {
    for (const m of modeWindows.values()) {
      const ns = m.def.nStacks;
      if (!ns || !isModeActive(m, char.id, sIdx, actionStartTime)) continue;
      if ((m.stacks ?? 0) >= ns.max) {
        stackDetonation = { window: m, frames: ns.detonate };
        endMode(m, actionStartTime, 'ender');
      } else {
        const boosted = !!ns.boostedBy && [...modeWindows.values()].some(x => x.charId === char.id && x.def.label === ns.boostedBy && isModeActive(x, char.id, sIdx, actionStartTime));
        m.stacks = Math.min(ns.max, (m.stacks ?? 0) + (boosted ? ns.boostedPerUse ?? ns.perUse : ns.perUse));
      }
    }
  }

  // 爆発の後のモード（ディシア）の固有の扱い: モードの間の N・E はパンチ、ダッシュは短く（ジャンプへ）、ジャンプは蹴りかモードの終わり、終わった後の最初の N・E は蹴り
  const mw = burstModeAction?.mode ? modeWindows.get(modeKeyOf(char.id, burstModeAction.mode)) : undefined;
  let modeKind: 'punch' | 'kick' | 'dash' | undefined;
  if (burstModeDef && mw && mw.sIdx === sIdx) {
    const isInput = act.type === 'normal' || (act.type === 'skill' && act.actionTypeId === `${char.id}_e`);
    if (!mw.endedBy && actionStartTime < mw.end - 0.001) {
      if (isInput) modeKind = 'punch';
      else if (act.type === 'dash') modeKind = 'dash';
      else if (modeEnder?.window === mw) {
        const prevAct = computedActions[computedActions.length - 1];
        const dashJump = prevAct?.type === 'dash' && actionStartTime - (prevAct.startTime ?? 0) <= burstModeDef.dashJumpKickFrames / 60 + 0.001;
        mw.finished = true;
        if (dashJump) modeKind = 'kick';
        else placePickedField(char.id, mw, actionStartTime); // ジャンプで状態が終わると、拾った炎場がその場に置かれる
      }
    } else if (!mw.finished && isInput && actionStartTime < mw.end + burstModeDef.finisherWindowFrames / 60) {
      modeKind = 'kick';
    }
  }
  // パンチ・蹴りになった E（ディシアの爆発の後）は、炎場の置き直しにならず、新しいモードも開かない
  if (modeKind === 'punch' || modeKind === 'kick') modeRepress = undefined;
  // このアクションが、新しいモードを開くか（続いているモードの、終わらせるアクション・もう一度使った動作・パンチではない）
  // モードの間に置けない操作（夢見月瑞希の夢浮かみの間の通常攻撃など）: 黄色の警告（アプリの時間は変えない）
  const blockingMode = [...modeWindows.values()].find(m => isModeActive(m, char.id, sIdx, actionStartTime) && actionStartTime >= m.start - 0.001 && !!m.def.blocked?.types.includes(act.type)
    && !m.def.blocked.except?.some(s => act.actionTypeId === `${char.id}_${s}`));
  const blockedMessage = blockingMode?.def.blocked
    ? t('messages:rotation.blocked', {
      mode: loc(blockingMode.def, 'label'),
      action: actionName(char, act),
      result: blockingMode.def.blocked.result === 'wait'
        ? t('messages:rotation.blockedWait', { mode: loc(blockingMode.def, 'label'), seconds: (blockingMode.end - actionStartTime).toFixed(1) })
        : blockingMode.def.blocked.result === 'none' ? t('messages:rotation.blockedNone') : t('messages:rotation.blockedError'),
      hint: loc(blockingMode.def.blocked, 'hint'),
    })
    : undefined;
  // gcsim で実行エラーになる操作（スカークの七相一閃の間の E）は、自分の CT・効果バーを持たない
  if ((blockingMode?.def.blocked?.result === 'error' || blockingMode?.def.blocked?.result === 'none') && (act.type === 'skill' || act.type === 'skill_hold')) ac.inStateWindow = true;
  const opensMode = !!actionDef?.mode && !(modeEnder && modeEnder.window.key === modeKeyOf(char.id, actionDef.mode)) && !modeRepress
    && modeKind !== 'punch' && modeKind !== 'kick' && specialConditionOk(actionDef.mode, actionStartTime)
    // モードの間に置けない操作（スカークの七相一閃の間の E）は、新しいモードを開かない
    && !blockedMessage;
  // スキルが全回数分の特殊スキルの CT を積むとき（ファルカ）の、受付の終わり（このアクションが開く受付に付ける）
      
  ac.blockedMessage = blockedMessage;
  ac.modeEnder = modeEnder;
  ac.modeKind = modeKind;
  ac.modeRepress = modeRepress;
  ac.mw = mw;
  ac.opensMode = opensMode;
  ac.stackDetonation = stackDetonation;
}

/** モードを終わらせるアクション・もう一度使った動作の反映（モードの終わりの更新・続けて開くモード） */
export function applyModeEnderAndRepress(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { activeBuffs, modeWindows } = state;
  const { char, sIdx } = sc;
  const { act, actionStartTime, modeEnder, modeRepress } = ac;
  if (modeEnder) {
    endMode(modeEnder.window, actionStartTime, 'ender');
    // 終わらせる E（夢見月瑞希の解除・タルタリヤの遠距離への戻り）は、自分の CT・効果バーを持たない（CT は、モードを開いたアクションの分。cooldownAtEnd）
    if (act.type === 'skill') ac.inStateWindow = true;
  }
  if (modeRepress) {
    const { window: m, index } = modeRepress;
    m.repressUsed += 1;
    ac.inStateWindow = true;
    ac.repressGcsimCommand = m.def.repress?.gcsimCommand;
    // 命ノ星座で、使うたびにモードの終わりが延びる（ローエンの C6: 1.25 秒。icdFrames に 1 回まで）
    const extend = consValue(m.def, m.opener.constellation, 'repressExtend');
    // wiki: 愉悦が回復した後の「次の」魂を穿つ痛みで延びる。1 回目で回復するので、延びるのは 2 回目から
    if (extend && m.repressUsed >= 2 && (m.lastExtendAt === undefined || actionStartTime >= m.lastExtendAt + extend.icdFrames / 60 - 0.001)) {
      m.lastExtendAt = actionStartTime;
      m.end = Number((m.end + extend.frames / 60).toFixed(3));
      m.span.endTime = m.end;
      m.span.duration = Number((m.end - m.span.startTime).toFixed(3));
    }
    // 使うたびに、モードの終わりを更新する（閑雲の跳躍）
    const rp = m.def.repress!;
    const rf = rp.refreshFrames;
    if (rf?.length) {
      const newEnd = Number((actionStartTime + rf[Math.min(index, rf.length - 1)] / 60).toFixed(3));
      if (rp.barPerUse) {
        // 使うたびに、前のバーをここで終わらせ、新しいバーを同じ行に置く（ディルックの連撃の受付）。最後の 1 回の後は、新しいバーを置かない
        m.span.endTime = Number(Math.min(m.span.endTime, actionStartTime).toFixed(3));
        m.span.duration = Number((m.span.endTime - m.span.startTime).toFixed(3));
        m.end = newEnd;
        const last = rp.endsOnLast && modeMaxUses(m) !== undefined && m.repressUsed >= modeMaxUses(m)!;
        if (!last) {
          const next: ActiveBuffSpan = { ...m.span, id: `${m.span.id}_u${m.repressUsed}`, startTime: actionStartTime, endTime: newEnd, duration: Number((newEnd - actionStartTime).toFixed(3)) };
          if (!m.def.noBar) activeBuffs.push(next);
          m.span = next;
        }
      } else {
        m.end = newEnd;
        m.span.endTime = m.end;
        m.span.duration = Number((m.end - m.start).toFixed(3));
      }
    }
    // 使い切るとモードが終わる（ニィロウのステップ 3 段目）
    if (rp.endsOnLast && modeMaxUses(m) !== undefined && m.repressUsed >= modeMaxUses(m)!) {
      endMode(m, actionStartTime, 'ender');
      // そのアクションで終えたときだけ続けて開くモード（ニィロウ: N で 3 段目を終えると祈月）
      const fu = rp.followUps?.[act.actionTypeId.slice(char.id.length + 1)];
      if (fu) {
        // 置き換えるモード（純白の正 ⇔ 漆黒の否）は、ここで終わる
        for (const label of fu.replaces ?? []) {
          const other = modeWindows.get(`${char.id}:${label}`);
          if (other && !other.endedBy) endMode(other, actionStartTime, 'ender');
        }
        const fStart = Number((actionStartTime + fu.startDelayFrames / 60).toFixed(3));
        const fEnd = Number((fStart + fu.durationFrames / 60).toFixed(3));
        const fSpan: ActiveBuffSpan = {
          id: `mode_${m.actionDefId}_${act.id}_followup`,
          buffId: `mode_${m.actionDefId}_followup`,
          actionKind: actionKindOf(char.availableActions.find(a => a.id === m.actionDefId)?.type),
          name: `${charName(char)} ${loc(fu, 'label')}`,
          sourceCharacterId: char.id,
          sourceType: 'talent',
          startTime: fStart,
          endTime: fEnd,
          duration: Number((fEnd - fStart).toFixed(3)),
          color: char.color,
          description: loc(fu, 'description'),
          noSynergy: true,
        };
        if (!fu.noBar) activeBuffs.push(fSpan);
        modeWindows.set(modeKeyOf(char.id, fu), {
          key: modeKeyOf(char.id, fu), charId: char.id, actionDefId: `${m.actionDefId}#${fu.label}`, def: fu, sIdx, start: fStart, end: fEnd, span: fSpan,
          repressUsed: 0, inputs: 0, finished: false, reductions: 0, opener: m.opener,
        });
      }
    }
  }
}

/** 爆発によるモードの延長、減る値（カチーナの夜魂値）・ゲージ（キィニチの夜魂値）の更新 */
export function updateModeGaugesAndDrain(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { activeBuffs, modeWindows, placePickedField, retiredModes } = state;
  const { burstModeDef, char, charActions, sIdx } = sc;
  const { act, actionStartTime, modeKind, modeRepress, mw } = ac;
  // モードの間の自分の元素爆発で、モードの終わりが延びる（兹白: 隙を過ぐる月 +1.7 秒。gcsim: ExtendStatus(skillKey, 1.7*60)）
  if (act.type === 'burst') {
    for (const m of modeWindows.values()) {
      const ext = m.def.extendByBurstFrames;
      if (!ext || !isModeActive(m, char.id, sIdx, actionStartTime) || actionStartTime < m.start - 0.001) continue;
      m.end = Number((m.end + ext / 60).toFixed(3));
      m.span.endTime = m.end;
      m.span.duration = Number((m.end - m.span.startTime).toFixed(3));
    }
  }
  // 減る値（カチーナの夜魂値）: ここまでの時間による消費を数え、E の乗り降り・乗っている間の通常攻撃・爆発での回復を反映して、モードの終わりを求め直す
  for (const m of modeWindows.values()) {
    const d = m.def.drain;
    if (!d || !m.drain || m.charId !== char.id || m.endedBy || actionStartTime < m.start - 0.001) continue;
    if (!isModeActive(m, char.id, sIdx, actionStartTime)) continue;
    drainAdvance(m, actionStartTime);
    if (modeRepress?.window === m && (act.type === 'skill' || act.type === 'skill_hold')) {
      if (act.actionTypeId.endsWith('_e_hold')) m.drain.riding = true;
      else if (m.drain.riding) {
        m.drain.riding = false;
        m.drain.nextTick = Number((actionStartTime + d.idle.resumeFrames / 60).toFixed(4));
      } else m.drain.riding = true;
    } else if (m.drain.riding && (d.costByType[act.type] ?? 0) > 0) {
      m.drain.points = Math.max(0, m.drain.points - (d.costByType[act.type] ?? 0));
      if (m.drain.points <= 0.0001) {
        // 命中の時点で夜魂値が尽きる（通常攻撃の命中）
        const hit = (d.riddenNormalFrames[0]?.hitmark ?? 0) / 60;
        m.drain.at = Number((actionStartTime + hit).toFixed(3));
        drainProject(m, m.drain.at);
        continue;
      }
    } else if (act.type === 'burst' && d.burstGain && m.opener.constellation >= d.burstGain.minConstellation) {
      m.drain.points = Math.min(d.max, m.drain.points + d.burstGain.amount);
    }
    drainProject(m, actionStartTime);
  }
  // 尽きた後の再開（カチーナの C2: 爆発で夜魂値 20 から、降りている状態で開き直す）。続いているモードがあるときは、上の drain の処理が回復する
  if (act.type === 'burst') {
    const constellation = CharacterModel.fromConfig(char).constellation;
    for (const reopenDef of charActions) {
      const md = reopenDef.mode;
      const bg = md?.drain?.burstGain;
      if (!md || !md.drain || !bg?.reopens || constellation < bg.minConstellation) continue;
      const key = modeKeyOf(char.id, md);
      const prev = modeWindows.get(key);
      if (prev && isModeActive(prev, char.id, sIdx, actionStartTime) && actionStartTime >= prev.start - 0.001) continue;
      const reStart = actionStartTime;
      const reSpan: ActiveBuffSpan = {
        id: `mode_${reopenDef.id}_${act.id}_reopen`,
        buffId: `mode_${reopenDef.id}`,
        actionKind: actionKindOf(reopenDef.type),
        name: `${charName(char)} ${loc(md, 'label')}`,
        sourceCharacterId: char.id,
        sourceType: 'talent',
        startTime: reStart,
        endTime: Number((reStart + md.durationFrames / 60).toFixed(3)),
        duration: Number((md.durationFrames / 60).toFixed(3)),
        color: char.color,
        description: loc(md, 'description'),
        ...(md.noSynergy ? { noSynergy: true } : {}),
      };
      const reopened: ModeWindow = {
        key, charId: char.id, actionDefId: reopenDef.id, def: md, sIdx, start: reStart, end: reSpan.endTime, span: reSpan, repressUsed: 0, inputs: 0, finished: false, reductions: 0,
        opener: { actionId: act.id, name: act.name, start: actionStartTime, cooldown: 0, cdScale: 1, constellation },
      };
      // 一回押しの E と同じ（降りている）。開始から最初の消費まで firstFrames
      reopened.drain = { points: bg.amount, riding: false, at: reStart, nextTick: Number((reStart + md.drain.idle.firstFrames / 60).toFixed(4)) };
      drainProject(reopened, reStart);
      if (!md.noBar) activeBuffs.push(reSpan);
      if (prev) retiredModes.push(prev);
      modeWindows.set(key, reopened);
    }
  }
  // モードのゲージ（キィニチの夜魂値）: 時間の増加 → このアクションの増加（N）／使用（別の動作になった E は、満タンのときだけ使え、0 になる）
  let gaugeMessage: string | undefined;
  for (const m of modeWindows.values()) {
    const g = m.def.gauge;
    // 使い切って終わる回（endsOnLast の最後の E）も、ここで消費を数える（モードは、この処理の前に終わっている）
    const usedUp = modeRepress?.window === m;
    if (!g || m.charId !== char.id || !(isModeActive(m, char.id, sIdx, actionStartTime) || usedUp) || actionStartTime < m.start - 0.001) continue;
    const scale = modeGainScale(m);
    const gaugeState = m.gauge ?? { value: Math.min(g.max, modeGaugeInitial(m)), ticks: 0 };
    const ticksNow = Math.max(0, Math.floor((actionStartTime - m.start + 0.0005) / (g.timeGain.everyFrames / 60)));
    gaugeState.value = Math.min(g.max, gaugeState.value + (ticksNow - gaugeState.ticks) * g.timeGain.amount * scale);
    gaugeState.ticks = ticksNow;
    if (modeRepress?.window === m && (act.type === 'skill' || act.type === 'skill_hold')) {
      // 命ノ星座で、この回は消費しない（ヴェスナの C1: 最高ランクの 1 回目）
      const freeIndex = consValue(m.def, m.opener.constellation, 'repressFreeIndex');
      const free = freeIndex !== undefined && modeRepress.index === freeIndex;
      const need = free ? 0 : g.cost ?? g.max;
      if (gaugeState.value < need) gaugeMessage = t('messages:rotation.gauge', { gauge: loc(g, 'label'), value: Math.floor(gaugeState.value), need, hint: loc(g, 'hint') });
      if (!free) {
        const costAll = !!consValue(m.def, m.opener.constellation, 'gaugeCostAll');
        gaugeState.value = costAll || g.cost === undefined ? 0 : Math.max(0, gaugeState.value - g.cost);
      }
      // 命ノ星座で、使った後に上限まで回復する（ローエンの C6）
      if (consValue(m.def, m.opener.constellation, 'gaugeRefillOnRepress')) gaugeState.value = g.max;
    } else {
      // 通常攻撃は、連続した N の何段目か（ここで数える normalStreak は、この N の前までの連続数）で増加量が変わる場合がある
      const gain = act.type === 'normal' && g.gainByNormalIndex?.length
        ? g.gainByNormalIndex[sc.normalStreak % g.gainByNormalIndex.length]
        : g.gainByType[act.type] ?? 0;
      gaugeState.value = Math.min(g.max, gaugeState.value + gain * scale);
    }
    m.gauge = gaugeState;
  }
  if (modeKind === 'punch' || modeKind === 'kick') {
    if (act.type === 'skill') ac.inStateWindow = true; // スキルの CT・効果・窓の規則は使わない
    if (modeKind === 'kick') {
      mw!.finished = true;
      placePickedField(char.id, mw!, actionStartTime + (burstModeDef!.kickHitFrames + burstModeDef!.fieldPlaceAfterKickFrames) / 60);
    }
  }
  ac.gaugeMessage = gaugeMessage;
}
