import { CharacterConfig, Stint, ActiveBuffSpan, ValidationIssue, PassiveSpan } from '../../types/genshin';
import { passiveGroupOf } from '../../types/genshin';
import { getAvailableBuffsForCharacter, BuffCategory } from '../buffUtils';
import { type CooldownEvent } from './cooldownCheck';
import type { GenshinDatabase } from '../../types/database';
import { t } from '../../i18n';
import { charName, loc, triggerName } from '../../i18n/loc';

/** 出場の終わりで、交代の内部 CT（約 1 秒）に近い素早い交代を、情報として知らせる */
export function warnQuickSwap(a: { rawStints: Stint[]; sIdx: number; rawStint: Stint; char: CharacterConfig; stintStartTime: number; stintDuration: number; validationIssues: ValidationIssue[] }): void {
  const { rawStints, sIdx, rawStint, char, stintStartTime, stintDuration, validationIssues } = a;
  // Check swap internal cooldown (1.0s)
  if (sIdx < rawStints.length - 1) {
    const nextStint = rawStints[sIdx + 1];
    if (nextStint.characterId !== rawStint.characterId && stintDuration < 1.0) {
      validationIssues.push({
        id: `swap_cd_${rawStint.id}`,
        severity: 'info',
        characterId: char.id,
        stintId: rawStint.id,
        time: stintStartTime,
        title: t('messages:rotation.swapCdTitle'),
        message: t('messages:rotation.swapCd', { seconds: stintDuration.toFixed(2) })
      });
    }
  }
}

/** CT 違反の警告を足す（同じ id は、残り秒数が大きいほうで 1 件にまとめる）。calculateRotation の中の addViolationIssue と同じ形 */
export type AddViolationIssue = (id: string, char: CharacterConfig, stintId: string, actionId: string | undefined, time: number, severity: 'error' | 'warning', title: string, what: string, remaining: number, cycle: number) => void;

/** 出場に登録した発動バフ（固有天賦・武器・聖遺物）を、発動バフのバー・効果バー・CT の発動にする */
export function addPassiveTriggers(a: { char: CharacterConfig; rawStint: Stint; sIdx: number; stintStartTime: number; database: GenshinDatabase | undefined; passiveSpans: PassiveSpan[]; activeBuffs: ActiveBuffSpan[]; ctEvents: CooldownEvent[]; addViolationIssue: AddViolationIssue }): void {
  const { char, rawStint, sIdx, stintStartTime, database, passiveSpans, activeBuffs, ctEvents, addViolationIssue } = a;
  // 連動・発動バフ（固有天賦・武器・聖遺物）: 発動位置は出場の先頭からの秒数（退場後も自由移動可能）
  const availableBuffs = getAvailableBuffsForCharacter(char, database);

  for (const trigger of rawStint.passiveTriggers ?? []) {
    const def = availableBuffs.find(b => b.id === trigger.passiveEffectId);
    const category: BuffCategory = def?.category || (trigger.passiveEffectId.startsWith('wbuff_') ? 'weapon' : trigger.passiveEffectId.startsWith('abuff_') ? 'artifact' : 'talent');
    const duration = trigger.duration ?? def?.duration ?? 0;
    // 個別に変更した CT を優先（継続時間と同じ優先順）
    const cooldown = trigger.cooldown ?? def?.cooldown ?? 0;
    // 発動位置は出場の前にも置ける（下限は時間 0）
    const startTime = Number(Math.max(0, stintStartTime + trigger.offset).toFixed(3));

    const buffColor = def?.color || (category === 'weapon' ? '#0284c7' : category === 'artifact' ? '#c084fc' : char.color);
    // 表示名・説明（D255）: 保存されている名前が定義の名前と同じなら、表示の言語の名前（キーごとに分けた名前などは、保存されている名前）
    const shownName = triggerName(def, trigger);
    const shownDescription = def?.description ? loc(def, 'description') : trigger.name;

    passiveSpans.push({
      id: `passive_${trigger.id}`,
      triggerId: trigger.id,
      stintId: rawStint.id,
      characterId: char.id,
      passiveEffectId: trigger.passiveEffectId,
      gcsimKey: trigger.gcsimKey,
      effectGroup: passiveGroupOf(trigger.passiveEffectId, trigger.gcsimKey),
      gcsimMissed: trigger.gcsimMissed,
      name: trigger.gcsimMissed ? t('messages:rotation.gcsimMissed', { name: shownName }) : shownName,
      category,
      startTime,
      duration,
      endTime: startTime + duration,
      cooldown,
      cooldownEnd: startTime + cooldown,
      hasCTViolation: false,
      collisionRemainingCT: undefined,
      color: buffColor,
      description: shownDescription,
    });
    const passiveSpan = passiveSpans[passiveSpans.length - 1];
    const catLabel = category === 'weapon' ? t('messages:ct.catWeapon') : category === 'artifact' ? t('messages:ct.catArtifact') : category === 'constellation' ? t('messages:ct.catConstellation') : t('messages:ct.catTalent');
    ctEvents.push({
      key: `${char.id}:passive:${passiveGroupOf(trigger.passiveEffectId, trigger.gcsimKey)}`,
      time: startTime,
      ctOffset: 0,
      cooldown,
      checked: true,
      stintIndex: sIdx,
      name: trigger.name,
      onViolation: (remaining, cycle) => {
        passiveSpan.hasCTViolation = true;
        passiveSpan.collisionRemainingCT = Math.max(passiveSpan.collisionRemainingCT ?? 0, remaining);
        addViolationIssue(`passive_ct_${trigger.id}`, char, rawStint.id, undefined, startTime, 'warning', t('messages:ct.passiveWarning', { name: charName(char), category: catLabel }), `「${shownName}」`, remaining, cycle);
      },
    });

    if (duration > 0) {
      activeBuffs.push({
        id: `passive_buff_${trigger.id}`,
        buffId: `buff_${char.id}_${passiveGroupOf(trigger.passiveEffectId, trigger.gcsimKey)}`, // 同じバフ（キー単位）は重複集計で1つとして数える
        name: `${charName(char)}: ${shownName}`,
        sourceCharacterId: char.id,
        sourceType: category,
        startTime,
        endTime: startTime + duration,
        duration,
        color: buffColor,
        description: shownDescription,
        origin: 'passive',
      });
    }
  }
}

/** gcsim から書き込んだ、キャラクターに紐づく効果（D57）を、効果バーにする */
export function addCharacterEffectBars(a: { char: CharacterConfig; rawStint: Stint; stintStartTime: number; activeBuffs: ActiveBuffSpan[] }): void {
  const { char, rawStint, stintStartTime, activeBuffs } = a;
  // gcsim から書き込んだ、キャラクターに紐づく効果（D57）。出場の先頭からの位置（出場より前は負。時間 0 より前には出さない）
  (rawStint.extraEffects ?? []).forEach((ex, exIdx) => {
    if (!(ex.duration > 0)) return;
    const exStart = Number(Math.max(0, stintStartTime + ex.offset).toFixed(3));
    activeBuffs.push({
      id: `effect_char_${char.id}_${rawStint.id}_${exIdx}`,
      buffId: `effect_char_${char.id}_${ex.key}`,
      name: `${char.name}: ${ex.name}`,
      sourceCharacterId: char.id,
      sourceType: 'talent',
      startTime: exStart,
      endTime: Number((exStart + ex.duration).toFixed(3)),
      duration: ex.duration,
      color: char.color,
      description: t('messages:rotation.charEffect', { name: ex.name }),
      ownerStintId: rawStint.id,
    });
  });
}
