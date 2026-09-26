import { 
  CharacterConfig, 
  Stint, 
  CharacterActionInstance, 
  ActiveBuffSpan, 
  CooldownSpan, 
  ValidationIssue, 
  CharacterRuntimeState,
  PassiveSpan,
} from '../types/genshin';
import { GenshinDatabase } from '../types/database';
import { buildActionEffectSpan, countDistinctActiveBuffs } from './characterActions';
import { getAvailableBuffsForCharacter, BuffCategory } from './buffUtils';

export interface CalculatedRotation {
  totalDuration: number;
  calculatedStints: Stint[];
  activeBuffs: ActiveBuffSpan[];
  skillCooldowns: CooldownSpan[];
  burstCooldowns: CooldownSpan[];
  characterStates: Record<string, CharacterRuntimeState>;
  validationIssues: ValidationIssue[];
  activeBuffCountBySecond: { time: number; count: number; activeBuffs: string[] }[];
  /** 発動バフ（固有天賦・武器・聖遺物）の効果・CT */
  passiveSpans: PassiveSpan[];
  loopStatus: {
    canLoopImmediately: boolean;
    longestRemainingCT: { characterName: string; type: 'skill' | 'burst'; remaining: number } | null;
  };
}

export interface RotationOptions {
  switchDelay?: number;
  actionDelay?: number;
  database?: GenshinDatabase;
}

export function calculateRotation(
  characters: CharacterConfig[],
  rawStints: Stint[],
  options?: RotationOptions
): CalculatedRotation {
  const switchDelay = typeof options?.switchDelay === 'number' ? Math.max(0, options.switchDelay) : 0.50;
  const actionDelay = typeof options?.actionDelay === 'number' ? Math.max(0, options.actionDelay) : 0.10;
  const characterMap = new Map<string, CharacterConfig>();
  characters.forEach(c => characterMap.set(c.id, c));

  let currentTime = 0;
  const calculatedStints: Stint[] = [];
  const activeBuffs: ActiveBuffSpan[] = [];
  const skillCooldowns: CooldownSpan[] = [];
  const burstCooldowns: CooldownSpan[] = [];
  const validationIssues: ValidationIssue[] = [];
  const passiveSpans: PassiveSpan[] = [];
  // 固有天賦ごとの直近の CT 終了時刻（キャラID + 効果ID）
  const latestPassiveCTEnd: Record<string, number> = {};

  // Track runtime status for each character:
  const charStates: Record<string, CharacterRuntimeState> = {};
  characters.forEach(c => {
    charStates[c.id] = {
      characterId: c.id,
      totalActiveTime: 0,
      stints: [],
      skillCooldowns: [],
      burstCooldowns: [],
    };
  });

  // Track latest cooldown end times:
  const latestSkillCTEnd: Record<string, { time: number; actionName: string }> = {};
  const latestBurstCTEnd: Record<string, { time: number; actionName: string }> = {};

  // 1. Process Stints and Actions in strict chronological order
  for (let sIdx = 0; sIdx < rawStints.length; sIdx++) {
    const rawStint = rawStints[sIdx];
    const char = characterMap.get(rawStint.characterId);
    if (!char) continue;

    const stintStartTime = currentTime;
    const computedActions: CharacterActionInstance[] = [];

    // If 2nd or subsequent character and switchDelay > 0, include switch action as first action inside this stint
    if (sIdx > 0 && switchDelay > 0) {
      const switchActionStartTime = currentTime;
      const switchActionEndTime = Number((currentTime + switchDelay).toFixed(3));
      const switchAction: CharacterActionInstance = {
        id: `switch_stint_${rawStint.id}`,
        actionTypeId: 'action_switch_char',
        name: 'キャラ交代',
        shortName: '交代',
        type: 'swap',
        duration: switchDelay,
        startTime: switchActionStartTime,
        endTime: switchActionEndTime,
      };
      computedActions.push(switchAction);
      currentTime = switchActionEndTime;
    }

    // Filter out any runtime-generated swap actions in raw actions to avoid duplicates
    const rawActions = rawStint.actions.filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char');

    for (let aIdx = 0; aIdx < rawActions.length; aIdx++) {
      // If there are already actions in this stint (switch action or previous action), insert actionDelay gap
      if (computedActions.length > 0 && actionDelay > 0) {
        currentTime = Number((currentTime + actionDelay).toFixed(3));
      }

      const act = rawActions[aIdx];
      const actionStartTime = currentTime;
      const duration = Math.max(0.05, act.duration || 0.5);
      const actionEndTime = Number((actionStartTime + duration).toFixed(3));

      const computedAction: CharacterActionInstance = {
        ...act,
        duration,
        startTime: actionStartTime,
        endTime: actionEndTime,
      };
      computedActions.push(computedAction);

      // CT・効果継続時間はアクション定義ごとに持つ
      const actionDef = char.availableActions.find(a => a.id === act.actionTypeId);
      const isSkill = act.type === 'skill' || act.type === 'skill_hold' || act.type === 'skill_reset';
      // 個別に変更された CT があれば優先
      const cooldown = act.cooldown ?? actionDef?.cooldown ?? 0;

      if (isSkill) {
        // 祭礼リセット等はCT中でも発動可能
        const lastCT = latestSkillCTEnd[char.id];
        if (lastCT && lastCT.time > actionStartTime + 0.05 && act.type !== 'skill_reset') {
          const remaining = Number((lastCT.time - actionStartTime).toFixed(1));
          computedAction.hasCTCollision = true;
          computedAction.collisionRemainingCT = remaining;
          validationIssues.push({
            id: `skill_ct_${act.id}_${actionStartTime}`,
            severity: 'error',
            characterId: char.id,
            stintId: rawStint.id,
            actionId: act.id,
            time: actionStartTime,
            title: `${char.name}: スキルCT違反`,
            message: `スキル発動時点でクールタイムがまだ ${remaining} 秒残っています（直前の${lastCT.actionName}によるCT中）`
          });
        }

        if (actionDef?.startsSkillCooldown && cooldown > 0) {
          const cdSpan: CooldownSpan = {
            id: `cd_skill_${char.id}_${actionStartTime}`,
            characterId: char.id,
            type: 'skill',
            startTime: actionStartTime,
            endTime: actionStartTime + cooldown,
            duration: cooldown,
            actionInstanceId: act.id,
          };
          skillCooldowns.push(cdSpan);
          charStates[char.id].skillCooldowns.push(cdSpan);
          latestSkillCTEnd[char.id] = { time: actionStartTime + cooldown, actionName: act.name };
        }
      }

      if (act.type === 'burst') {
        const lastBurstCT = latestBurstCTEnd[char.id];
        if (lastBurstCT && lastBurstCT.time > actionStartTime + 0.05) {
          const remaining = Number((lastBurstCT.time - actionStartTime).toFixed(1));
          computedAction.hasCTCollision = true;
          computedAction.collisionRemainingCT = remaining;
          validationIssues.push({
            id: `burst_ct_${act.id}_${actionStartTime}`,
            severity: 'error',
            characterId: char.id,
            stintId: rawStint.id,
            actionId: act.id,
            time: actionStartTime,
            title: `${char.name}: 元素爆発CT違反`,
            message: `爆発発動時点で爆発CTがまだ ${remaining} 秒残っています`
          });
        }

        if (actionDef?.startsBurstCooldown !== false && cooldown > 0) {
          const burstCDSpan: CooldownSpan = {
            id: `cd_burst_${char.id}_${actionStartTime}`,
            characterId: char.id,
            type: 'burst',
            startTime: actionStartTime,
            endTime: actionStartTime + cooldown,
            duration: cooldown,
            actionInstanceId: act.id,
          };
          burstCooldowns.push(burstCDSpan);
          charStates[char.id].burstCooldowns.push(burstCDSpan);
          latestBurstCTEnd[char.id] = { time: actionStartTime + cooldown, actionName: act.name };
        }
      }

      // 効果継続時間（アクション定義 or 個別変更値）から効果バーを作る
      const effectSpan = buildActionEffectSpan(char, act, actionDef, actionStartTime);
      if (effectSpan) activeBuffs.push(effectSpan);

      currentTime = actionEndTime;
    }

    const stintEndTime = currentTime;
    const stintDuration = stintEndTime - stintStartTime;

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
          title: 'キャラ交代CT近接 (Swap CD)',
          message: `出場時間が ${stintDuration.toFixed(2)}秒です。原神の交代内部CT(約1.0秒)に近い素早い交代です。`
        });
      }
    }

    // 連動・発動バフ（固有天賦・武器・聖遺物）: 発動位置は出場の先頭からの秒数（出場時間の範囲内に収める）
    const availableBuffs = getAvailableBuffsForCharacter(char, options?.database);

    for (const trigger of rawStint.passiveTriggers ?? []) {
      const def = availableBuffs.find(b => b.id === trigger.passiveEffectId);
      const category: BuffCategory = def?.category || (trigger.passiveEffectId.startsWith('wbuff_') ? 'weapon' : trigger.passiveEffectId.startsWith('abuff_') ? 'artifact' : 'talent');
      const duration = trigger.duration ?? def?.duration ?? 0;
      const cooldown = trigger.cooldown ?? def?.cooldown ?? 0;
      const startTime = Number((stintStartTime + Math.min(Math.max(0, trigger.offset), stintDuration)).toFixed(3));
      const ctKey = `${char.id}:${trigger.passiveEffectId}`;
      const hasCTViolation = (latestPassiveCTEnd[ctKey] ?? -Infinity) > startTime + 0.05;
      const collisionRemainingCT = hasCTViolation
        ? Number(((latestPassiveCTEnd[ctKey] ?? 0) - startTime).toFixed(1))
        : undefined;

      if (hasCTViolation) {
        const catLabel = category === 'weapon' ? '武器バフ' : category === 'artifact' ? '聖遺物バフ' : '固有天賦バフ';
        validationIssues.push({
          id: `passive_ct_${trigger.id}`,
          severity: 'warning',
          characterId: char.id,
          stintId: rawStint.id,
          time: startTime,
          title: `${char.name}: ${catLabel}CT中`,
          message: `「${trigger.name}」の発動時点でCTがまだ ${collisionRemainingCT} 秒残っています`,
        });
      }
      if (cooldown > 0) latestPassiveCTEnd[ctKey] = startTime + cooldown;

      const buffColor = def?.color || (category === 'weapon' ? '#0284c7' : category === 'artifact' ? '#c084fc' : char.color);

      passiveSpans.push({
        id: `passive_${trigger.id}`,
        triggerId: trigger.id,
        stintId: rawStint.id,
        characterId: char.id,
        passiveEffectId: trigger.passiveEffectId,
        name: trigger.name,
        category,
        startTime,
        duration,
        endTime: startTime + duration,
        cooldown,
        cooldownEnd: startTime + cooldown,
        hasCTViolation,
        collisionRemainingCT,
        color: buffColor,
        description: def?.description ?? trigger.name,
      });
      if (duration > 0) {
        activeBuffs.push({
          id: `passive_buff_${trigger.id}`,
          buffId: `buff_${char.id}_${trigger.passiveEffectId}`, // 同じバフは重複集計で1つとして数える
          name: `${char.name}: ${trigger.name}`,
          sourceCharacterId: char.id,
          sourceType: category,
          startTime,
          endTime: startTime + duration,
          duration,
          color: buffColor,
          description: def?.description ?? trigger.name,
          origin: 'passive',
        });
      }
    }

    const calculatedStint: Stint = {
      ...rawStint,
      startTime: stintStartTime,
      endTime: stintEndTime,
      duration: stintDuration,
      actions: computedActions,
    };

    calculatedStints.push(calculatedStint);
    charStates[char.id].stints.push(calculatedStint);
    charStates[char.id].totalActiveTime += stintDuration;
  }

  const totalDuration = Number(currentTime.toFixed(2));

  // Calculate buff overlap counts by second (0 to ceil(totalDuration))
  const maxSec = Math.ceil(totalDuration);
  const activeBuffCountBySecond: { time: number; count: number; activeBuffs: string[] }[] = [];
  for (let s = 0; s <= maxSec; s += 0.5) {
    // 同じアクション由来のバーが重なっても1つとして数える
    const { count, names } = countDistinctActiveBuffs(activeBuffs, s);
    activeBuffCountBySecond.push({
      time: s,
      count,
      activeBuffs: names,
    });
  }

  // Loopability check: Are all skill and burst cooldowns ended by totalDuration?
  let canLoopImmediately = true;
  let longestRemainingCT: { characterName: string; type: 'skill' | 'burst'; remaining: number } | null = null;

  for (const c of characters) {
    const sCT = latestSkillCTEnd[c.id];
    if (sCT && sCT.time > totalDuration) {
      const remaining = Number((sCT.time - totalDuration).toFixed(1));
      if (!longestRemainingCT || remaining > longestRemainingCT.remaining) {
        longestRemainingCT = { characterName: c.name, type: 'skill', remaining };
      }
      canLoopImmediately = false;
    }

    const bCT = latestBurstCTEnd[c.id];
    if (bCT && bCT.time > totalDuration) {
      const remaining = Number((bCT.time - totalDuration).toFixed(1));
      if (!longestRemainingCT || remaining > longestRemainingCT.remaining) {
        longestRemainingCT = { characterName: c.name, type: 'burst', remaining };
      }
      canLoopImmediately = false;
    }
  }

  if (!canLoopImmediately && longestRemainingCT) {
    validationIssues.push({
      id: 'loop_cd_remaining',
      severity: 'info',
      time: totalDuration,
      title: 'ローテーション2周目ループCT注意',
      message: `2周目を直ちに開始した場合、${longestRemainingCT.characterName}の${longestRemainingCT.type === 'burst' ? '元素爆発' : 'スキル'}CTが残り約 ${longestRemainingCT.remaining} 秒あります。ローテーションの延長または通常攻撃での時間調整が推奨されます。`
    });
  }

  return {
    totalDuration,
    calculatedStints,
    activeBuffs,
    skillCooldowns,
    burstCooldowns,
    characterStates: charStates,
    validationIssues,
    activeBuffCountBySecond,
    passiveSpans,
    loopStatus: {
      canLoopImmediately,
      longestRemainingCT,
    }
  };
}
