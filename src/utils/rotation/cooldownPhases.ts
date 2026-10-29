import { isRevelation } from '../../masterdata/revelationCharacters';
import { NightsoulTracker } from '../nightsoulTracker';
import { totemTiming } from '../totemTracker';
import { ActiveBuffSpan, CooldownSpan } from '../../types/genshin';
import { CharacterModel } from '../../models/CharacterModel';
import { type ModeWindow } from './types';
import { skillHitFrames } from './frameTables';
import { cutBar, modeKeyOf, modeGaugeInitial, modeGainScale, drainProject, endMode } from './modeHelpers';
import type { RotationState } from './state';
import type { StintContext, ActionContext } from './context';
import { currentLanguage, t } from '../../i18n';
import { charName, actionName, loc } from '../../i18n/loc';

/** CT の計算: 共鳴・書き戻した値・領域による短縮・CT の開始位置 */
export function computeCooldown(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { addViolationIssue, cdResonanceScale, ctReductionScaleAt, options, validationIssues } = state;
  const { char, rawStint } = sc;
  const { act, actionDef, actionStartTime, computedAction, cooldownStart, duration, holdSeconds } = ac;
  // gcsim の結果でCT待ちが生じたアクション: アプリのCT違反と同じ印を付ける
  const externalWait = options?.externalCtWaits?.[act.id];
  if (externalWait !== undefined) {
    computedAction.hasCTCollision = true;
    computedAction.collisionRemainingCT = externalWait;
    addViolationIssue(`skill_ct_gcsim_${act.id}`, char, rawStint.id, act.id, actionStartTime, 'error', t('messages:ct.gcsimWait', { name: charName(char), kind: options?.externalStaminaWaitIds?.includes(act.id) ? t('messages:ct.staminaWait') : t('messages:ct.cooldownWait') }), `「${act.name}」`, externalWait, 0);
    if (options?.externalStaminaWaitIds?.includes(act.id)) {
      const issue = validationIssues.find(v => v.id === `skill_ct_gcsim_${act.id}`);
      if (issue) issue.message = t('messages:ct.staminaWaited', { action: actionName(char, act), seconds: externalWait });
    }
  }

  const isSkill = act.type === 'skill' || act.type === 'skill_hold' || act.type === 'skill_reset';
  // 個別に変更された CT があれば優先
  // （長押しで長さが変わるものは、ホールド 0 のときの値 + 長押し 1 秒あたりの増分 × ホールド秒数）
  const isCdAction = act.type === 'skill' || act.type === 'skill_hold' || act.type === 'skill_reset' || act.type === 'burst';
  // gcsim から書き戻した CT は、書き戻したときの共鳴の倍率を含む。編成の共鳴が変わっていたら、その比で直す
  const writtenCooldown = act.cooldown !== undefined && act.gcsimCdResonance !== undefined && act.gcsimCdResonance !== cdResonanceScale
    ? Number((act.cooldown * cdResonanceScale / act.gcsimCdResonance).toFixed(3))
    : act.cooldown;
  const fieldCtScale = isCdAction && !actionDef?.ignoresCdScale ? ctReductionScaleAt(actionStartTime) : 1;
  const baseCooldown = writtenCooldown ?? Number((((actionDef?.cooldown ?? 0) + (actionDef?.cooldownPerHold ?? 0) * (holdSeconds ?? 0)) * (isCdAction && !actionDef?.ignoresCdScale ? cdResonanceScale * fieldCtScale : 1)).toFixed(3));
  // 風元素共鳴が無く、スキルの CT が書き戻しで変わっている（重雲の命ノ星座2など）ときは、特殊スキルの CT も同じ割合で短くする（gcsim のログで 660f → 627f を確認）
  const cooldown = writtenCooldown === undefined && actionDef?.cooldownPool === 'special' && !actionDef.ignoresCdScale && sc.specialCdScale !== 1 && cdResonanceScale === 1
    ? Number(((baseCooldown / fieldCtScale) * sc.specialCdScale).toFixed(3))
    : baseCooldown;
  // CTの開始位置（動作開始からの遅れ）。マスターの値。未設定は動作開始と同時
  // 動作開始から / 長押し終了から / 状態の終了から（状態の長さは効果継続時間。無ければアクションの終了）
  const effectSeconds = act.effectDuration ?? actionDef?.effectDuration ?? 0;
  const computedCtOffset = Number((cooldownStart
    ? cooldownStart.delay + (cooldownStart.from === 'holdEnd' ? holdSeconds ?? 0 : cooldownStart.from === 'stateEnd' ? (effectSeconds > 0 ? effectSeconds : duration) : 0)
    : 0).toFixed(3));
  // gcsim から書き戻した値があれば優先（D37）
  const ctOffset = act.gcsimCtOffset ?? computedCtOffset;
  const ctStartTime = Number((actionStartTime + ctOffset).toFixed(3));
  ac.cooldown = cooldown;
  ac.ctOffset = ctOffset;
  ac.ctStartTime = ctStartTime;
  ac.effectSeconds = effectSeconds;
  ac.isSkill = isSkill;
  ac.writtenCooldown = writtenCooldown;
}

/** CT の発動（ctEvents）の登録と、スキル・爆発の CT のバー・設置物・夜魂値 */
export function registerCooldownEvents(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { addViolationIssue, barTotems, cdResonanceScale, charStates, ctEvents, sacrificialOf, skillCooldowns, totemBursts, validationIssues } = state;
  const { char, rawStint, sIdx, windowOpenAt } = sc;
  const { act, actionDef, actionStartTime, computedAction, cooldown, ctOffset, effectSeconds, holdSeconds, isSkill, modeEnder, opensMode, writtenCooldown } = ac;
  // CT に関わるスキル・爆発なのにアクション定義が見つからない（旧データの編成など）: CT を判定できないことを知らせる
  if (!actionDef && (isSkill || act.type === 'burst') && act.cooldown === undefined) {
    validationIssues.push({
      id: `missing_def_${act.id}`,
      severity: 'warning',
      characterId: char.id,
      stintId: rawStint.id,
      actionId: act.id,
      time: actionStartTime,
      title: t('messages:ct.noDefTitle', { name: charName(char) }),
      message: t('messages:ct.noDefMessage', { action: actionName(char, act) }),
    });
  }

  if (isSkill) {
    computedAction.inStateWindow = ac.inStateWindow || undefined;
    // CTを開始しない派生技は、CTと無関係。祭礼リセットはCT中でも発動できる（CTは開始する）
    // 特殊元素スキル（cooldownPool = 'special'）は、スキルとは別のCT枠（スキルのCTは開始しない）
    const isSpecial = actionDef?.cooldownPool === 'special';
    // 受付の間だけ使える特殊スキル（ファルカ・オデット）。受付が無い出場では、スキルを使った後でないと使えない
    const needsWindow = isSpecial && ((actionDef?.charges ?? 1) > 1 || !!actionDef?.requiresWindow);
    // 受付の外で使った特殊スキル（ファルカ）は、gcsim では通常のスキルになり、特殊スキルの CT は積まれない（受付の警告は、下で出す）
    const specialOutOfWindow = isSpecial && needsWindow && !ac.inStateWindow && !windowOpenAt(actionStartTime);
    const isTriggeringAction = isSpecial ? !ac.inStateWindow && !specialOutOfWindow : actionDef?.startsSkillCooldown !== false && !ac.inStateWindow;
    // モードの終わりから CT が始まるスキル（タルタリヤ・放浪者）: ここでは、入ったときの短い CT（タルタリヤ 1 秒）だけ。本来の CT は、計算の最後に足す
    const atEnd = opensMode ? actionDef?.mode?.cooldownAtEnd : undefined;
    const evCooldown = atEnd ? Number(((atEnd.entry?.seconds ?? 0) * (actionDef?.ignoresCdScale ? 1 : cdResonanceScale)).toFixed(3)) : cooldown;
    const evOffset = atEnd ? (atEnd.entry ? Number((atEnd.entry.delayFrames / 60).toFixed(3)) : 0) : ctOffset;
    const evCtStart = Number((actionStartTime + evOffset).toFixed(3));
    // 祭礼の武器: スキルのダメージが当たる時刻（命中時刻の表）。スキルを使ったときだけ（モードの間の 2 回目以降の E は、CT を始めないので対象外）
    const sacrificial = sacrificialOf(char);
    const sacrificialHits: number[] = isTriggeringAction && !isSpecial && sacrificial && actionDef ? skillHitFrames(actionDef.id, CharacterModel.fromConfig(char).constellation, holdSeconds) : [];
    // 効果が残っている間に使い直すと CT がリセットされる（凝光の命ノ星座 2）。効果の長さ = この発動の効果継続時間
    const recastRule = !isSpecial && isTriggeringAction ? actionDef?.recastReset : undefined;
    const recastActive = !!recastRule && CharacterModel.fromConfig(char).constellation >= recastRule.minConstellation;
    if (isTriggeringAction) {
      ctEvents.push({
        key: `${char.id}:${isSpecial ? 'special' : 'skill'}`,
        time: actionStartTime,
        ctOffset: evOffset,
        cooldown: evCooldown,
        ...((actionDef?.charges ?? 1) > 1 ? { charges: actionDef!.charges } : {}),
        ...(!isSpecial && (actionDef?.mode?.cooldownReduceOnExpire || sacrificialHits.length > 0) ? { forceQueue: true } : {}),
        ...(recastActive ? { forceQueue: true, recastReset: { icdSeconds: recastRule!.icdSeconds, lifetime: effectSeconds } } : {}),
        ...(!isSpecial && actionDef?.spawnsTotem ? { spawnsTotem: { max: actionDef.spawnsTotem.max, ...totemTiming(actionDef.spawnsTotem, act.effectDuration ?? actionDef.effectDuration ?? 0, isRevelation(char)) } } : {}),
        ...(!isSpecial && actionDef?.nightsoul?.role === 'skill' ? { nightsoul: actionDef.nightsoul } : {}),
        checked: act.type !== 'skill_reset',
        actionId: act.id,
        stintIndex: sIdx,
        name: act.name,
        onViolation: (remaining, cycle) => {
          computedAction.hasCTCollision = true;
          computedAction.collisionRemainingCT = Math.max(computedAction.collisionRemainingCT ?? 0, remaining);
          addViolationIssue(`skill_ct_${act.id}`, char, rawStint.id, act.id, actionStartTime, 'error', isSpecial ? t('messages:ct.specialViolation', { name: charName(char) }) : t('messages:ct.skillViolation', { name: charName(char) }), isSpecial ? t('messages:ct.specialWhat', { action: actionName(char, act) }) : t('messages:ct.skillWhat', { action: actionName(char, act) }), remaining, cycle);
        },
      });
    }
    for (const h of sacrificialHits) {
      ctEvents.push({
        key: `${char.id}:skill`,
        time: Number((actionStartTime + h / 60).toFixed(3)),
        ctOffset: 0,
        cooldown: 0,
        checked: false,
        sacrificial: { icdSeconds: sacrificial!.icdSeconds, hitFrame: h },
        actionId: act.id,
        stintIndex: sIdx,
        name: act.name,
        onViolation: () => {},
      });
    }
    // モードを終わらせて CT を始める E（タルタリヤ）: 自分の CT は持たないが、CT 中（入ったときの 1 秒）なら使えない
    if (modeEnder?.ender.cooldown === 'start') {
      ctEvents.push({
        key: `${char.id}:skill`,
        time: actionStartTime,
        ctOffset: 0,
        cooldown: 0,
        checked: true,
        actionId: act.id,
        stintIndex: sIdx,
        name: act.name,
        onViolation: (remaining, cycle) => {
          computedAction.hasCTCollision = true;
          computedAction.collisionRemainingCT = Math.max(computedAction.collisionRemainingCT ?? 0, remaining);
          addViolationIssue(`skill_ct_${act.id}`, char, rawStint.id, act.id, actionStartTime, 'error', t('messages:ct.skillViolation', { name: charName(char) }), t('messages:ct.skillWhat', { action: actionName(char, act) }), remaining, cycle);
        },
      });
    }

    // スキルが、特殊スキルの別枠のCTを、全チャージ分まとめて開始する（ファルカ）
    if (!isSpecial && !ac.inStateWindow && actionDef?.startsSpecialPool) {
      const pool = actionDef.startsSpecialPool;
      const baseSkillCd = actionDef.cooldown ?? 0;
      sc.specialCdScale = baseSkillCd > 0 && writtenCooldown !== undefined ? writtenCooldown / baseSkillCd : cdResonanceScale;
      const poolCooldown = Number((pool.cooldown * sc.specialCdScale).toFixed(3));
      // 受付（モード）は、下のモードを開く処理で開く。受付の終わりは、出場の終わりで決める
      ac.pendingCtWindow = { until: Infinity };
      if (!pool.windowOnly) ctEvents.push({
        key: `${char.id}:special`,
        time: actionStartTime,
        ctOffset,
        cooldown: poolCooldown,
        charges: pool.charges,
        startsAll: true,
        actionId: act.id,
        window: ac.pendingCtWindow,
        checked: false,
        stintIndex: sIdx,
        name: act.name,
        onViolation: () => {},
      });
    }

    // 2 回分の CT を持つ特殊スキル（ファルカ）のバーは、使った時点では置かない。CT のキューで、前の CT が 0 になって始まった時点に、判定の関数が作る
    // 複数回分の通常のスキル（クレー・魈など）も同じ: バーは、CT のキューで始まった時点に作る
    const isQueuedSpecial = (actionDef?.charges ?? 1) > 1 || !!actionDef?.mode?.cooldownReduceOnExpire || (!isSpecial && sacrificialHits.length > 0) || recastActive;
    if (isTriggeringAction && evCooldown > 0 && !isQueuedSpecial) {
      const cdSpan: CooldownSpan = {
        id: `cd_${isSpecial ? 'special' : 'skill'}_${char.id}_${actionStartTime}`,
        characterId: char.id,
        type: isSpecial ? 'special' : 'skill',
        startTime: evCtStart,
        endTime: Number((evCtStart + evCooldown).toFixed(3)),
        duration: evCooldown,
        actionInstanceId: act.id,
      };
      skillCooldowns.push(cdSpan);
      charStates[char.id].skillCooldowns.push(cdSpan);
    }
  }

  // 八重神子: 爆発が、場の殺生桜 1 つにつき、スキルの CT を 1 回分戻す（固有天賦 1）
  if (act.type === 'burst' && actionDef?.releasesSkillPerTotem) {
    // 効果バー: 諭示が未達成なら、爆発で桜が全部壊れる（バーをここで切る）
    const barTracker = barTotems.get(char.id);
    if (barTracker) {
      const present = barTracker.burst(actionStartTime, !isRevelation(char));
      const burstLog = totemBursts.get(char.id) ?? [];
      burstLog.push({ time: actionStartTime, destroy: !isRevelation(char) });
      totemBursts.set(char.id, burstLog);
      if (!isRevelation(char)) for (const x of present) cutBar(x.tag, x.end);
    }
    ctEvents.push({
      key: `${char.id}:skill`,
      time: actionStartTime,
      ctOffset: 0,
      cooldown: 0,
      checked: false,
      releasesPerTotem: { revelation: isRevelation(char) },
      stintIndex: sIdx,
      name: act.name,
      onViolation: () => {},
    });
  }
  // ヴァレサ: 落下攻撃・爆発が夜魂値を増やし、満タンで猛烈パッションに入る（次のスキルが無料）
  if (actionDef?.nightsoul && actionDef.nightsoul.role !== 'skill') {
    ctEvents.push({
      key: `${char.id}:nightsoul`,
      time: actionStartTime,
      ctOffset: 0,
      cooldown: 0,
      checked: false,
      nightsoul: actionDef.nightsoul,
      stintIndex: sIdx,
      name: act.name,
      onViolation: () => {},
    });
  }
}

/** モードを開く（モードのバー・窓の作成） */
export function openMode(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { activeBuffs, cdResonanceScale, durationHasHitlag, fieldSpans, hitlagOf, modeWindows, retiredModes } = state;
  const { char, charActions, sIdx, specialModes, stintSpecialModes } = sc;
  const { act, actionDef, actionStartTime, cooldown, holdSeconds, opensMode } = ac;
  // モードを開く（続いているモードを終わらせる E の再押しは、開かない）。モードは、アクションの開始から startDelayFrames 後に始まる
  if (opensMode && actionDef?.mode) {
    const md = actionDef.mode;
    // 使い切った後の、新しいモード（閑雲の 4 回目の E）: 続いている前のモードは、ここで終わる
    const key = modeKeyOf(char.id, md);
    const prevMode = modeWindows.get(key);
    if (prevMode && !prevMode.endedBy && prevMode.end > actionStartTime) endMode(prevMode, actionStartTime, 'timeout');
    // 長押しの終わりから始まるモード（藍硯の長押し）は、長押しの秒数（所要時間からの逆算）を足す
    const start = Number((actionStartTime + (md.startAfterHold ? holdSeconds ?? 0 : 0) + md.startDelayFrames / 60).toFixed(3));
    // 最大時間: モードの定義の値。アクションごとの効果継続時間（個別に変更した値・gcsim の結果）のほうが長ければ、その値。
    // 受付（special）は、受付の長さそのもの（効果継続時間は別のもの）。受付を開いたスキルの初撃のヒットストップで延びる（ファルカ。状態は命中の 1 フレーム前に付く）
    const baseSeconds = md.special
      ? md.durationFrames / 60 + (durationHasHitlag(act) ? hitlagOf(md.special)?.skill ?? 0 : 0)
      : md.plusEffectDuration
        ? md.durationFrames / 60 + (act.effectDuration ?? actionDef.effectDuration ?? 0)
        : Math.max(md.durationFrames / 60, act.effectDuration ?? 0);
    const end = Number((start + baseSeconds).toFixed(3));
    const span: ActiveBuffSpan = {
      id: `mode_${actionDef.id}_${act.id}`,
      buffId: `mode_${actionDef.id}`,
      name: `${charName(char)} ${loc(md, 'label')}${md.barNote ? (currentLanguage === 'en' ? ` (${loc(md, 'barNote')})` : `（${md.barNote}）`) : ''}`,
      sourceCharacterId: char.id,
      sourceType: 'talent',
      startTime: start,
      endTime: end,
      duration: Number((end - start).toFixed(3)),
      color: char.color,
      description: loc(md, 'description'),
      // モードを開くアクションの効果バーの代わりなので、既定はバフ重複に数える
      ...(md.noSynergy ? { noSynergy: true } : {}),
      // スキルの後の受付のバー（ガントチャートで、スキルストックとスキル CT の間の行に出す）
      ...(md.description.includes('受付') ? { windowBar: true, standardDuration: Number((md.durationFrames / 60).toFixed(3)) } : {}),
    };
    // バーを出さないモード（受付型）は、効果バーが兼ねる
    if (!md.noBar) activeBuffs.push(span);
    const opened: ModeWindow = {
      key, charId: char.id, actionDefId: actionDef.id, def: md, sIdx, start, end, span, repressUsed: 0, inputs: 0, finished: false, reductions: 0,
      ...(actionDef.fieldRecast ? { hasField: true } : {}),
      opener: {
        actionId: act.id, name: act.name, start: actionStartTime, cooldown,
        cdScale: actionDef.ignoresCdScale ? 1 : cdResonanceScale,
        constellation: CharacterModel.fromConfig(char).constellation,
      },
    };
    // 持ち越すゲージ（兹白の月相の輝き）: 前のモードが終わったときの値 + 命ノ星座の初期増加（上限まで）
    if (md.gauge?.persists) {
      const g = md.gauge;
      let carry = 0;
      if (prevMode) {
        const ps = prevMode.gauge ?? { value: Math.min(g.max, modeGaugeInitial(prevMode)), ticks: 0 };
        const until = Math.min(prevMode.end, actionStartTime);
        const ticks = Math.max(0, Math.floor((until - prevMode.start + 0.0005) / (g.timeGain.everyFrames / 60)));
        carry = Math.min(g.max, ps.value + Math.max(0, ticks - ps.ticks) * g.timeGain.amount * modeGainScale(prevMode));
      }
      opened.gauge = { value: Math.min(g.max, carry + modeGaugeInitial(opened)), ticks: 0 };
    }
    // 減る値のあるモード（カチーナ）: 開いた E が長押しなら乗っている・一回押しなら降りている（独立して存在）
    if (md.drain) {
      const riding = actionDef.id.endsWith('_e_hold');
      opened.drain = { points: md.drain.max, riding, at: start, nextTick: Number((start + md.drain.idle.firstFrames / 60).toFixed(4)) };
      drainProject(opened, start);
    }
    // ディシア: 爆発の開始で、炎場を拾う（炎場が出ていれば。バーをここで切り、残り時間 + 拾いの延長を保存する）
    const fieldDef = actionDef.burstMode ? charActions.find(a => a.fieldRecast)?.fieldRecast : undefined;
    const field = fieldSpans.get(char.id);
    if (fieldDef && field && actionStartTime < field.endTime) {
      opened.pending = { savedFrames: Math.round((field.endTime - actionStartTime) * 60) + fieldDef.pickupExtensionFrames, template: { ...field } };
      field.endTime = Number((actionStartTime + 1 / 60).toFixed(3));
      field.duration = Number(Math.max(0, field.endTime - field.startTime).toFixed(3));
    }
    if (prevMode) retiredModes.push(prevMode);
    modeWindows.set(key, opened);
    // 特殊スキル・特殊爆発の受付: この出場の、種類ごとの受付にする。特殊スキルの CT の仕組みは、スキルの startsSpecialPool（爆発で開いた受付〔オデット〕も同じ）
    if (md.special) {
      specialModes[md.special.kind] = opened;
      stintSpecialModes.push(opened);
      opened.pool = actionDef.startsSpecialPool ?? charActions.find(a => a.startsSpecialPool)?.startsSpecialPool;
      if (md.special.kind === 'skill' && ac.pendingCtWindow) opened.ctWindow = ac.pendingCtWindow;
    }
  }
}

/** キャラ固有の規則: 夜魂値（ヴァレサ）・特殊スキル・特殊爆発の受付の確認 */
export function applySpecialRules(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { addViolationIssue, burstCooldowns, charStates, ctEvents, nightsoulTrackers, validationIssues } = state;
  const { char, closeSpecial, rawStint, sIdx, specialModes, specialOpenAt } = sc;
  const { act, actionDef, actionStartTime, computedAction, cooldown, ctOffset, ctStartTime, writtenCooldown } = ac;
  // ヴァレサ: 夜魂値（猛烈パッション）と、マキシマムドライブ（落下攻撃の開始時に、命ノ星座 2 以上、または猛烈パッション中なら、短い間だけ特殊爆発の受付が開く）
  if (actionDef?.nightsoul) {
    const ns = actionDef.nightsoul;
    const tracker = nightsoulTrackers.get(char.id) ?? new NightsoulTracker();
    nightsoulTrackers.set(char.id, tracker);
    if (ns.role === 'skill') {
      tracker.useSkill(actionStartTime, ns.gain, ns.max);
    } else if (ns.role === 'plunge') {
      tracker.plunge(actionStartTime, ns.gain, ns.max, ns.blessingSeconds);
    } else {
      tracker.burst(actionStartTime, ns.gain, ns.max, ns.blessingSeconds);
    }
  }

  // スキルを使うと閉じる受付（ヴァレサのマキシマムドライブ）
  const burstMode = specialModes.burst;
  if ((act.type === 'skill' || act.type === 'skill_hold') && !actionDef?.cooldownPool && burstMode?.def.special?.closedBySkill && !burstMode.closed) closeSpecial(burstMode, actionStartTime, t('messages:ct.closedBySkill'));

  if (act.type === 'burst') {
    // 特殊爆発（フリンズ・ヴァレサ）: 受付の中は、短い CT（ヴァレサ 1 秒・フリンズ なし）。外では通常の爆発になり、通常の CT が始まる
    const sbc = actionDef?.specialBurst ? actionDef.specialBurstCooldown : undefined;
    const sbInWindow = !!sbc && specialOpenAt('burst', actionStartTime);
    const burstCooldown = sbc ? (writtenCooldown ?? (sbInWindow ? sbc.inWindow : sbc.outOfWindow)) : cooldown;
    const isTriggeringBurst = sbc
      ? (sbInWindow ? sbc.inWindow > 0 || sbc.checkInWindow : sbc.outOfWindow > 0)
      : actionDef?.startsBurstCooldown !== false;
    if (isTriggeringBurst) {
      ctEvents.push({
        key: `${char.id}:burst`,
        time: actionStartTime,
        ctOffset,
        cooldown: burstCooldown,
        checked: sbc && sbInWindow ? sbc.checkInWindow : true,
        stintIndex: sIdx,
        name: act.name,
        onViolation: (remaining, cycle) => {
          computedAction.hasCTCollision = true;
          computedAction.collisionRemainingCT = Math.max(computedAction.collisionRemainingCT ?? 0, remaining);
          addViolationIssue(`burst_ct_${act.id}`, char, rawStint.id, act.id, actionStartTime, 'error', t('messages:ct.burstViolation', { name: charName(char) }), t('messages:ct.burstWhat', { action: actionName(char, act) }), remaining, cycle);
        },
      });
    }

    if (isTriggeringBurst && burstCooldown > 0) {
      const burstCDSpan: CooldownSpan = {
        id: `cd_burst_${char.id}_${actionStartTime}`,
        characterId: char.id,
        type: 'burst',
        startTime: ctStartTime,
        endTime: Number((ctStartTime + burstCooldown).toFixed(3)),
        duration: burstCooldown,
        actionInstanceId: act.id,
      };
      burstCooldowns.push(burstCDSpan);
      charStates[char.id].burstCooldowns.push(burstCDSpan);
    }
  }

  // 特殊スキル・特殊爆発の受付の確認（ファルカ・オデット・フリンズ）: 受付の外（ヒットストップ・爆発の延長を最大に見ても）で使うと、gcsim では通常のスキル・爆発になる（警告）
  const isSpecialBurst = act.type === 'burst' && !!actionDef?.specialBurst;
  if ((actionDef?.cooldownPool === 'special' && ((actionDef.charges ?? 1) > 1 || actionDef.requiresWindow) || isSpecialBurst) && !ac.inStateWindow) {
    const winFor = specialModes[isSpecialBurst ? 'burst' : 'skill'];
    if (!specialOpenAt(isSpecialBurst ? 'burst' : 'skill', actionStartTime)) {
      const windowClosed = !!winFor?.closed;
      const kindName = isSpecialBurst ? t('messages:ct.specialBurst') : t('messages:ct.specialSkill');
      const normalName = isSpecialBurst ? t('messages:ct.normalBurst') : t('messages:ct.normalSkill');
      const noWindowHint = isSpecialBurst ? ((actionDef && loc(actionDef, 'specialBurstHint')) || t('messages:ct.burstNoWindow')) : t('messages:ct.skillNoWindow');
      const windowMessage = windowClosed && winFor?.closedBy ? t('messages:ct.windowClosedBy', { kind: kindName, by: winFor.closedBy, normal: normalName }) : windowClosed ? t('messages:ct.windowUsed', { kind: kindName, normal: normalName }) : winFor
        ? t('messages:ct.windowPassed', { kind: kindName, window: (winFor.end - winFor.opener.start).toFixed(1), over: (actionStartTime - winFor.end).toFixed(1), normal: normalName })
        : t('messages:ct.windowNone', { kind: kindName, hint: noWindowHint, normal: normalName });
      computedAction.specialWindowWarning = windowMessage;
      validationIssues.push({
        id: `special_window_${act.id}`,
        severity: 'warning',
        characterId: char.id,
        stintId: rawStint.id,
        actionId: act.id,
        time: actionStartTime,
        title: t('messages:ct.windowTitle', { name: charName(char), kind: kindName }),
        message: `${kindName}「${actionName(char, act)}」: ${windowMessage}`,
      });
    }
  }
  ac.isSpecialBurst = isSpecialBurst;
}
