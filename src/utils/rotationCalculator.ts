import { 
  CharacterConfig, 
  Stint, 
  CharacterActionInstance, 
  ActiveBuffSpan, 
  CooldownSpan, 
  ValidationIssue, 
  CharacterRuntimeState,
  EnergyHistoryPoint
} from '../types/genshin';
import { BUFF_DEFINITIONS } from '../data/characters';

export interface CalculatedRotation {
  totalDuration: number;
  calculatedStints: Stint[];
  activeBuffs: ActiveBuffSpan[];
  skillCooldowns: CooldownSpan[];
  burstCooldowns: CooldownSpan[];
  characterStates: Record<string, CharacterRuntimeState>;
  validationIssues: ValidationIssue[];
  activeBuffCountBySecond: { time: number; count: number; activeBuffs: string[] }[];
  loopStatus: {
    canLoopImmediately: boolean;
    longestRemainingCT: { characterName: string; type: 'skill' | 'burst'; remaining: number } | null;
  };
}

export interface RotationOptions {
  switchDelay?: number;
  actionDelay?: number;
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

  // Track runtime status for each character:
  const charStates: Record<string, CharacterRuntimeState> = {};
  characters.forEach(c => {
    charStates[c.id] = {
      characterId: c.id,
      totalActiveTime: 0,
      stints: [],
      skillCooldowns: [],
      burstCooldowns: [],
      energyPoints: [{ time: 0, energy: c.burstEnergyCost, eventDescription: 'ローテーション開始時(満タン)' }],
      finalEnergy: c.burstEnergyCost,
      energySufficiency: true,
    };
  });

  // Track latest cooldown end times:
  const latestSkillCTEnd: Record<string, { time: number; actionName: string }> = {};
  const latestBurstCTEnd: Record<string, { time: number; actionName: string }> = {};

  // Track energy for each character:
  const currentEnergy: Record<string, number> = {};
  characters.forEach(c => {
    // Standard rotation theory assumes characters enter rotation with burst ready (100% cost)
    currentEnergy[c.id] = c.burstEnergyCost;
  });

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

      // Check for skill cooldown conflicts
      const isSkill = act.type === 'skill' || act.type === 'skill_hold' || act.type === 'skill_reset';
      const actionDef = char.availableActions.find(a => a.id === act.actionTypeId);

      if (isSkill) {
        const lastCT = latestSkillCTEnd[char.id];
        if (lastCT && lastCT.time > actionStartTime + 0.05 && act.type !== 'skill_reset') {
          const remaining = (lastCT.time - actionStartTime).toFixed(1);
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

        // Apply skill cooldown
        const skillCT = actionDef?.cooldown ?? actionDef?.skillCooldown ?? (
          act.actionTypeId === 'bennett_e_burst' 
            ? 2.0 
            : act.actionTypeId === 'kazuha_tap_e_plunge'
            ? 6.0
            : act.actionTypeId === 'kazuha_hold_e_plunge'
            ? 9.0
            : char.skillCooldown
        );

        const cdSpan: CooldownSpan = {
          id: `cd_skill_${char.id}_${actionStartTime}`,
          characterId: char.id,
          type: 'skill',
          startTime: actionStartTime,
          endTime: actionStartTime + skillCT,
          duration: skillCT,
          actionInstanceId: act.id,
        };
        skillCooldowns.push(cdSpan);
        charStates[char.id].skillCooldowns.push(cdSpan);
        latestSkillCTEnd[char.id] = { time: actionStartTime + skillCT, actionName: act.name };

        // Generate particle energy after 0.8s travel time
        const particleCount = char.skillParticles;
        if (particleCount > 0) {
          const particleArrival = actionStartTime + 0.8;
          characters.forEach(targetChar => {
            const isSameElement = targetChar.element === char.element;
            // On-field gets 3 per same elem, 1 per diff elem; off-field gets 1.8 / 0.6
            const baseGainPerParticle = isSameElement ? 3.0 : 1.0;
            // We approximate active on-field recipient
            const erMultiplier = (targetChar.energyRecharge || 100) / 100;
            const energyGained = particleCount * baseGainPerParticle * erMultiplier;
            
            const newEnergy = Math.min(targetChar.burstEnergyCost, (currentEnergy[targetChar.id] || 0) + energyGained);
            currentEnergy[targetChar.id] = newEnergy;
            charStates[targetChar.id].energyPoints.push({
              time: particleArrival,
              energy: Number(newEnergy.toFixed(1)),
              eventDescription: `${char.name}のE粒子回収 (+${energyGained.toFixed(1)})`
            });
          });
        }
      }

      // Check for burst cooldown and energy cost
      if (act.type === 'burst') {
        const lastBurstCT = latestBurstCTEnd[char.id];
        if (lastBurstCT && lastBurstCT.time > actionStartTime + 0.05) {
          const remaining = (lastBurstCT.time - actionStartTime).toFixed(1);
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

        // Check energy
        const energyAvailable = currentEnergy[char.id] || 0;
        if (energyAvailable < char.burstEnergyCost - 1.0) {
          validationIssues.push({
            id: `burst_energy_${act.id}_${actionStartTime}`,
            severity: 'warning',
            characterId: char.id,
            stintId: rawStint.id,
            actionId: act.id,
            time: actionStartTime,
            title: `${char.name}: 元素エネルギー不足の可能性`,
            message: `必要エネルギー ${char.burstEnergyCost} に対し、推計値は約 ${energyAvailable.toFixed(0)} です。チャージ効率を上げるか同属性の粒子を拾わせてください。`
          });
          charStates[char.id].energySufficiency = false;
        }

        // Deduct energy & start burst cooldown
        currentEnergy[char.id] = 0;
        charStates[char.id].energyPoints.push({
          time: actionStartTime,
          energy: 0,
          eventDescription: `${char.name} 元素爆発発動 (-${char.burstEnergyCost})`
        });

        const burstCT = actionDef?.cooldown ?? actionDef?.burstCooldown ?? char.burstCooldown;

        const burstCDSpan: CooldownSpan = {
          id: `cd_burst_${char.id}_${actionStartTime}`,
          characterId: char.id,
          type: 'burst',
          startTime: actionStartTime,
          endTime: actionStartTime + burstCT,
          duration: burstCT,
          actionInstanceId: act.id,
        };
        burstCooldowns.push(burstCDSpan);
        charStates[char.id].burstCooldowns.push(burstCDSpan);
        latestBurstCTEnd[char.id] = { time: actionStartTime + burstCT, actionName: act.name };

        // Special: Raiden Shogun burst generates ~25 flat energy for party over her combo
        if (char.id === 'raiden') {
          setTimeout(() => {}, 0); // placeholder
        }
      }

      // Special energy generator: Raiden burst combo gives flat ~24 energy to all
      if (act.actionTypeId === 'raiden_combo') {
        characters.forEach(targetChar => {
          const flatGain = 24.0;
          const newEnergy = Math.min(targetChar.burstEnergyCost, (currentEnergy[targetChar.id] || 0) + flatGain);
          currentEnergy[targetChar.id] = newEnergy;
          charStates[targetChar.id].energyPoints.push({
            time: actionStartTime + 5.0,
            energy: Number(newEnergy.toFixed(1)),
            eventDescription: `雷電 夢想の一心による味方全体チャージ (+24)`
          });
        });
      }

      // Trigger attached buffs
      const matchedCharActionDef = char.availableActions.find(a => a.id === act.actionTypeId);
      const buffIdsToTrigger = matchedCharActionDef?.triggersBuffIds || [];

      buffIdsToTrigger.forEach(buffId => {
        const buffDef = BUFF_DEFINITIONS[buffId];
        if (buffDef) {
          activeBuffs.push({
            id: `buff_${buffId}_${actionStartTime}`,
            buffId: buffDef.id,
            name: buffDef.name,
            sourceCharacterId: buffDef.sourceCharacterId || char.id,
            sourceType: buffDef.sourceType,
            startTime: actionStartTime,
            endTime: actionStartTime + buffDef.duration,
            duration: buffDef.duration,
            color: buffDef.color,
            description: buffDef.description,
            isSnapshot: buffDef.snapshotable,
          });
        }
      });

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

  // Final energy state recording
  characters.forEach(c => {
    charStates[c.id].finalEnergy = Number((currentEnergy[c.id] || 0).toFixed(1));
    charStates[c.id].energyPoints.push({
      time: totalDuration,
      energy: charStates[c.id].finalEnergy,
      eventDescription: 'ローテーション終了時点'
    });
  });

  // Calculate buff overlap counts by second (0 to ceil(totalDuration))
  const maxSec = Math.ceil(totalDuration);
  const activeBuffCountBySecond: { time: number; count: number; activeBuffs: string[] }[] = [];
  for (let s = 0; s <= maxSec; s += 0.5) {
    const curBuffs = activeBuffs.filter(b => b.startTime <= s && b.endTime >= s);
    activeBuffCountBySecond.push({
      time: s,
      count: curBuffs.length,
      activeBuffs: curBuffs.map(b => b.name)
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
    loopStatus: {
      canLoopImmediately,
      longestRemainingCT,
    }
  };
}
