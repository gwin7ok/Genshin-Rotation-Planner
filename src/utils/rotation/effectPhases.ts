import { isHexerei, hexereiCount } from '../../masterdata/hexereiCharacters';
import { isRevelation } from '../../masterdata/revelationCharacters';
import { TotemTracker, totemTiming } from '../totemTracker';
import { actionDelayOf } from '../actionDelay';
import { ActiveBuffSpan } from '../../types/genshin';
import { actionKindOf, buildActionEffectSpan } from '../characterActions';
import { CharacterModel } from '../../models/CharacterModel';
import { wrapIndex } from './frameTables';
import { cutBar } from './modeHelpers';
import type { RotationState } from './state';
import type { StintContext, ActionContext } from './context';
import { t } from '../../i18n';
import { actionName, charName, loc } from '../../i18n/loc';

/** 特殊スキル・特殊爆発の受付の延長・閉じ方・CT の短縮 */
export function applySpecialWindows(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { characters, ctEvents, durationHasHitlag, hitlagOf } = state;
  const { char, closeSpecial, extendSpecial, sIdx, specialModes, specialOpenAt, windowOpenAt } = sc;
  const { act, actionDef, actionStartTime, isSpecialBurst } = ac;
  // 受付の延長: ヒットストップ（通常攻撃は段ごと、重撃・特殊スキルは 1 回あたり）、自分の元素爆発（ファルカ）
  const skillWindow = specialModes.skill;
  if (skillWindow && windowOpenAt(actionStartTime)) {
    const sp = skillWindow.def.special!;
    const pool = skillWindow.pool;
    if (act.type === 'burst') extendSpecial(skillWindow, sp.extendOnBurst ?? 0);
    else if (act.type === 'normal') {
      const steps = durationHasHitlag(act) ? hitlagOf(sp)?.normal ?? [] : [];
      extendSpecial(skillWindow, steps.length ? steps[wrapIndex(sc.normalStreak - 1, steps.length)] ?? 0 : 0);
    }
    else if (act.type === 'charged' && pool) {
      extendSpecial(skillWindow, durationHasHitlag(act) ? hitlagOf(sp)?.charged ?? 0 : 0);
      // 受付の間の重撃は、特殊スキルの CT（回数）が空いていれば、特殊重撃「蒼牙」になり、特殊スキルと同じ CT を 1 回分使う（空いていなければ普通の重撃）。
      // 空いているかは、CT の判定と、バーの表示の両方で決める（ここでは「使うかもしれない」発動として記録する）
      ctEvents.push({
        key: `${char.id}:special`,
        time: actionStartTime,
        ctOffset: 0,
        cooldown: Number((pool.cooldown * sc.specialCdScale).toFixed(3)),
        charges: pool.charges,
        optional: true,
        actionId: act.id,
        checked: false,
        stintIndex: sIdx,
        name: actionName(char, act),
        onViolation: () => {},
      });
    }
    else if (actionDef?.cooldownPool === 'special') extendSpecial(skillWindow, durationHasHitlag(act) ? hitlagOf(sp)?.special ?? 0 : 0);
    // 受付の間に特殊スキルを使うと、受付が閉じる（オデット）
    if (actionDef?.cooldownPool === 'special' && sp.singleUse) closeSpecial(skillWindow, actionStartTime);
  }
  // 特殊爆発を使うと、特殊爆発の受付が閉じる（フリンズ・ヴァレサ）
  const burstWindowMode = specialModes.burst;
  if (isSpecialBurst && burstWindowMode && specialOpenAt('burst', actionStartTime) && burstWindowMode.def.special?.singleUse) closeSpecial(burstWindowMode, actionStartTime);

  // 特殊スキルの受付の間の通常攻撃（N）: 特殊スキルの CT を短縮する（ファルカ。N が敵に当たるたびに 0.5 秒、最大 15 回）
  const reducePool = skillWindow?.pool;
  if (act.type === 'normal' && skillWindow && reducePool?.reducePerHit && actionStartTime <= skillWindow.end && skillWindow.reductions < (reducePool.maxReductions ?? 15)) {
    // 連続した N の何段目か（上で normalStreak を進めたあと）。ヒット数は段ごと
    const stepHits = reducePool.hitsPerNormal ?? [1];
    const hits = Math.min(stepHits[wrapIndex(sc.normalStreak - 1, stepHits.length)] ?? 1, (reducePool.maxReductions ?? 15) - skillWindow.reductions);
    skillWindow.reductions += hits;
    // ヘクセレイ：秘儀（ヘクセレイのキャラが 2 人以上で、本人もヘクセレイ）のとき、1 ヒットあたりの短縮が増える
    const perHit = reducePool.reducePerHitHexerei !== undefined && isHexerei(char) && hexereiCount(characters) >= 2
      ? reducePool.reducePerHitHexerei
      : reducePool.reducePerHit;
    // 1 ヒットごとに別の短縮として記録する（先頭の CT がこのヒットの途中で明けると、残りのヒットは次の CT に効くため）
    for (let h = 0; h < hits; h++) {
      ctEvents.push({
        key: `${char.id}:special`,
        time: actionStartTime,
        ctOffset: 0,
        cooldown: 0,
        reduceBy: perHit,
        checked: false,
        stintIndex: sIdx,
        name: actionName(char, act),
        onViolation: () => {},
      });
    }
  }
}

/** 効果バーの生成（モード・殺生桜・炎場・領域・置き直し） */
export function buildEffectBars(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { activeBuffs, barTotems, ctReductionWindows, fieldSpans, totemLifetime, totemMax } = state;
  const { char, rawStint } = sc;
  const { act, actionDef, actionStartTime, burstVariantMode, isSkill, modeKind } = ac;
  // 効果継続時間（アクション定義 or 個別変更値）から効果バーを作る
  // モードを開くアクションの効果バーは、モードのバーが兼ねる（終わらせるアクション・出場の終わりで切れる）
  const effectSpan = ac.inStateWindow || (actionDef?.mode && !actionDef.mode.noBar && !actionDef.mode.keepEffectBar) ? null : buildActionEffectSpan(char, act, actionDef, actionStartTime);
  if (effectSpan && burstVariantMode?.def.burstVariant) {
    effectSpan.name = `${charName(char)} ${act.shortName}: ${loc(burstVariantMode.def.burstVariant, 'effectLabel')}`;
    effectSpan.description = loc(burstVariantMode.def.burstVariant, 'name');
  }
  // 殺生桜（八重神子）: バーは、桜が現れる位置から始まり、寿命（効果継続時間 + 諭示で +10 秒）で終わる。4 つ目が出ると最古が消え、バーをそこで切る
  if (effectSpan && isSkill && actionDef?.spawnsTotem) {
    const tt = totemTiming(actionDef.spawnsTotem, effectSpan.duration, isRevelation(char));
    effectSpan.startTime = Number((actionStartTime + tt.delay).toFixed(3));
    effectSpan.endTime = Number((effectSpan.startTime + tt.lifetime).toFixed(3));
    effectSpan.duration = tt.lifetime;
    effectSpan.stackable = true;
    const tracker = barTotems.get(char.id) ?? new TotemTracker<ActiveBuffSpan>();
    barTotems.set(char.id, tracker);
    const { popped, lane } = tracker.spawn(effectSpan.startTime, tt.lifetime, actionDef.spawnsTotem.max, effectSpan);
    effectSpan.lane = lane;
    totemLifetime.set(effectSpan, tt.lifetime);
    totemMax.set(effectSpan.buffId, actionDef.spawnsTotem.max);
    if (popped) cutBar(popped.tag, popped.end);
  }
  // 炎場（ディシア）: バーは、スキルの startDelayFrames 後（炎場が置かれる位置）から始まる
  if (effectSpan && actionDef?.fieldRecast) {
    const delay = actionDef.fieldRecast.startDelayFrames / 60;
    effectSpan.startTime = Number((effectSpan.startTime + delay).toFixed(3));
    effectSpan.endTime = Number((effectSpan.endTime + delay).toFixed(3));
    fieldSpans.set(char.id, effectSpan);
  }
  // 置き直し（窓の中の E）: 炎場を拾う（バーをここで切る）。命中の recastPlaceFrames 後に、残り時間 + 拾いの延長（命ノ星座 2 以上はさらに延長）で置き直す
  if (ac.inStateWindow && !modeKind && actionDef?.fieldRecast) {
    const fr = actionDef.fieldRecast;
    const field = fieldSpans.get(char.id);
    if (field && actionStartTime < field.endTime) {
      const remaining = field.endTime - actionStartTime;
      const savedFrames = Math.round(remaining * 60) + fr.pickupExtensionFrames + (CharacterModel.fromConfig(char).constellation >= fr.c2Constellation ? fr.c2ExtensionFrames : 0);
      field.endTime = Number((actionStartTime + 1 / 60).toFixed(3));
      field.duration = Number(Math.max(0, field.endTime - field.startTime).toFixed(3));
      const placedAt = Number((actionStartTime + fr.recastPlaceFrames / 60).toFixed(3));
      const placed: ActiveBuffSpan = {
        ...field,
        id: `${field.id}_recast_${act.id}`,
        startTime: placedAt,
        endTime: Number((placedAt + savedFrames / 60).toFixed(3)),
        duration: Number((savedFrames / 60).toFixed(3)),
      };
      activeBuffs.push(placed);
      fieldSpans.set(char.id, placed);
    }
  }
  // 領域が続く間、操作中のキャラに効果を付け直す（重雲）: 氷付与のバーは、命中 + 領域 + 付与の長さまで。凸 2 以上は、同じ期間の CT 短縮のバーを別に出す
  if (effectSpan && actionDef?.fieldEffect && !ac.inStateWindow) {
    const fe = actionDef.fieldEffect;
    const hit = Number((actionStartTime + fe.startDelayFrames / 60).toFixed(3));
    const fieldEnd = Number((hit + fe.fieldFrames / 60 + effectSpan.duration).toFixed(3));
    effectSpan.endTime = fieldEnd;
    effectSpan.duration = Number((fieldEnd - effectSpan.startTime).toFixed(3));
    const cr = fe.ctReduction;
    if (cr && CharacterModel.fromConfig(char).constellation >= cr.minConstellation) {
      ctReductionWindows.push({ start: hit, end: fieldEnd, rate: cr.rate });
      activeBuffs.push({
        id: `field_ct_${act.id}`,
        buffId: `field_ct_${actionDef.id}`,
        actionKind: actionKindOf(actionDef.type),
        name: `${charName(char)} ${loc(cr, 'label')}`,
        sourceCharacterId: char.id,
        sourceType: 'constellation',
        startTime: hit,
        endTime: fieldEnd,
        duration: Number((fieldEnd - hit).toFixed(3)),
        color: char.color,
        description: loc(cr, 'description'),
        noSynergy: true,
        ownerStintId: rawStint.id,
      });
    }
  }
  if (effectSpan) activeBuffs.push(effectSpan);
}

/** 副次効果（実行前はマスターの継続時間、gcsim から書き戻した後はその値）のバー */
export function buildSideEffects(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { activeBuffs } = state;
  const { char, rawStint } = sc;
  const { act, actionDef, actionStartTime } = ac;
  // 実行前（gcsim の結果がまだ無い）の副次効果: マスターの継続時間で、アクションの開始から 1 本（D213 案 2）。実行後は、下の gcsim の値で置き換わる
  if (act.extraEffects === undefined && !ac.inStateWindow) {
    (actionDef?.gcsimExtras ?? []).forEach((ex, exIdx) => {
      if (!(ex.durationFrames && ex.durationFrames > 0)) return;
      const exDuration = Number((ex.durationFrames / 60).toFixed(3));
      activeBuffs.push({
        id: `effect_extra_${char.id}_${act.id}_pre${exIdx}`,
        buffId: `effect_extra_${char.id}_${act.actionTypeId}_${ex.key}`,
        actionKind: actionKindOf(act.type),
        name: `${charName(char)} ${act.shortName}: ${loc(ex, 'label')}`,
        sourceCharacterId: char.id,
        sourceType: 'talent',
        startTime: actionStartTime,
        endTime: Number((actionStartTime + exDuration).toFixed(3)),
        duration: exDuration,
        color: char.color,
        description: t('messages:rotation.extraFromMaster', { action: actionName(char, act), label: loc(ex, 'label') }),
        ownerStintId: rawStint.id,
      });
    });
  }

  // gcsim から書き戻した副次効果（アクションの開始からの位置・継続時間つき）
  (act.extraEffects ?? []).forEach((ex, exIdx) => {
    if (!(ex.duration > 0) || ac.inStateWindow) return;
    const exStart = Number((actionStartTime + Math.max(0, ex.offset)).toFixed(3));
    activeBuffs.push({
      id: `effect_extra_${char.id}_${act.id}_${exIdx}`,
      buffId: `effect_extra_${char.id}_${act.actionTypeId}_${ex.key}`,
      actionKind: actionKindOf(act.type),
      name: `${char.name} ${act.shortName}: ${ex.name}`,
      sourceCharacterId: char.id,
      sourceType: 'talent',
      startTime: exStart,
      endTime: Number((exStart + ex.duration).toFixed(3)),
      duration: ex.duration,
      color: char.color,
      description: t('messages:rotation.extra', { action: actionName(char, act), label: ex.name }),
      ownerStintId: rawStint.id,
    });
  });
}

/** アクションごとの遅延を入れて、時刻を進める */
export function advanceClock(state: RotationState, sc: StintContext, ac: ActionContext): void {
  const { act, actionEndTime } = ac;
  // アクションごとの遅延は、そのアクションの終了後に入れる（出場の最後なら次の交代が遅れる）
  // 待機の後には、遅延を入れない（gcsim の設定文は、待機の後に delay を出さない。アクションの後の遅延は、待機の後の次のアクションの直前に入る）
  state.currentTime = Number((actionEndTime + (act.type === 'wait' ? 0 : actionDelayOf(act))).toFixed(3));
}
