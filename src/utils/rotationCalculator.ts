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
  /** 2周目折り返し（Carry-Over）情報 */
  carryOverCooldowns: CooldownSpan[];
  carryOverBuffs: ActiveBuffSpan[];
  carryOverPassives: PassiveSpan[];
  loopStartTime: number;
  loopPeriod: number;
}

export interface RotationOptions {
  switchDelay?: number;
  actionDelay?: number;
  database?: GenshinDatabase;
  loopStartIndex?: number;
}

export function calculateRotation(
  characters: CharacterConfig[],
  rawStints: Stint[],
  options?: RotationOptions
): CalculatedRotation {
  const switchDelay = typeof options?.switchDelay === 'number' ? Math.max(0, options.switchDelay) : 0.50;
  const actionDelay = typeof options?.actionDelay === 'number' ? Math.max(0, options.actionDelay) : 0.10;
  const loopStartIndex = typeof options?.loopStartIndex === 'number' ? Math.max(0, options.loopStartIndex) : 0;
  const characterMap = new Map<string, CharacterConfig>();
  characters.forEach(c => characterMap.set(c.id, c));

  let currentTime = 0;
  const calculatedStints: Stint[] = [];
  const activeBuffs: ActiveBuffSpan[] = [];
  const skillCooldowns: CooldownSpan[] = [];
  const burstCooldowns: CooldownSpan[] = [];
  const validationIssues: ValidationIssue[] = [];
  const passiveSpans: PassiveSpan[] = [];

  // CT を持つ発動（スキル・爆発・発動バフ）。CT違反の判定はすべて計算後にまとめて行う（checkCooldownViolations）
  const ctEvents: CooldownEvent[] = [];

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

  // CT違反の検証メッセージ（同じアクションは1件にまとめ、残り秒数は最大値）
  const violationRemaining = new Map<string, number>();
  const addViolationIssue = (
    id: string,
    char: CharacterConfig,
    stintId: string,
    actionId: string | undefined,
    time: number,
    severity: 'error' | 'warning',
    title: string,
    what: string,
    remaining: number,
    cycle: number,
  ) => {
    const where = cycle === 0 ? '' : `（ループ${cycle + 1}周目の発動時）`;
    const message = `${what}の発動時点で CT がまだ ${remaining} 秒残っています${where}`;
    const prev = violationRemaining.get(id);
    if (prev !== undefined) {
      if (remaining > prev) {
        violationRemaining.set(id, remaining);
        const existing = validationIssues.find(v => v.id === id);
        if (existing) existing.message = message;
      }
      return;
    }
    violationRemaining.set(id, remaining);
    validationIssues.push({ id, severity, characterId: char.id, stintId, actionId, time, title, message });
  };


  // 1. Process Stints and Actions in strict chronological order
  for (let sIdx = 0; sIdx < rawStints.length; sIdx++) {
    const rawStint = rawStints[sIdx];
    const char = characterMap.get(rawStint.characterId);
    if (!char) continue;

    const stintStartTime = currentTime;
    const computedActions: CharacterActionInstance[] = [];

    // 2-C: 先頭キャラも含め、全出場に交代時間を設ける（switchDelay > 0の場合）
    // これにより先頭キャラの例外処理が不要になり、ループ開始位置へ戻った時も自然に交代時間が入る
    if (switchDelay > 0) {
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
        hasCTCollision: false,
        collisionRemainingCT: undefined,
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

      // CT に関わるスキル・爆発なのにアクション定義が見つからない（旧データの編成など）: CT を判定できないことを知らせる
      if (!actionDef && (isSkill || act.type === 'burst') && act.cooldown === undefined) {
        validationIssues.push({
          id: `missing_def_${act.id}`,
          severity: 'warning',
          characterId: char.id,
          stintId: rawStint.id,
          actionId: act.id,
          time: actionStartTime,
          title: `${char.name}: アクション定義が見つかりません`,
          message: `「${act.name}」の定義がキャラデータにないため、CT を判定できません（編成設定の「全パーティメンバーをマスターデータで再登録」で直ります）`,
        });
      }

      if (isSkill) {
        // CTを開始しない派生技（ニィロウのステップ等）はCTと無関係。祭礼リセットはCT中でも発動できる（CTは開始する）
        const isTriggeringAction = actionDef?.startsSkillCooldown !== false;
        if (isTriggeringAction) {
          ctEvents.push({
            key: `${char.id}:skill`,
            time: actionStartTime,
            cooldown,
            checked: act.type !== 'skill_reset',
            stintIndex: sIdx,
            name: act.name,
            onViolation: (remaining, cycle) => {
              computedAction.hasCTCollision = true;
              computedAction.collisionRemainingCT = Math.max(computedAction.collisionRemainingCT ?? 0, remaining);
              addViolationIssue(`skill_ct_${act.id}`, char, rawStint.id, act.id, actionStartTime, 'error', `${char.name}: スキルCT違反`, `スキル「${act.name}」`, remaining, cycle);
            },
          });
        }

        if (isTriggeringAction && cooldown > 0) {
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
        }
      }

      if (act.type === 'burst') {
        const isTriggeringBurst = actionDef?.startsBurstCooldown !== false;
        if (isTriggeringBurst) {
          ctEvents.push({
            key: `${char.id}:burst`,
            time: actionStartTime,
            cooldown,
            checked: true,
            stintIndex: sIdx,
            name: act.name,
            onViolation: (remaining, cycle) => {
              computedAction.hasCTCollision = true;
              computedAction.collisionRemainingCT = Math.max(computedAction.collisionRemainingCT ?? 0, remaining);
              addViolationIssue(`burst_ct_${act.id}`, char, rawStint.id, act.id, actionStartTime, 'error', `${char.name}: 元素爆発CT違反`, `元素爆発「${act.name}」`, remaining, cycle);
            },
          });
        }

        if (isTriggeringBurst && cooldown > 0) {
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

    // 連動・発動バフ（固有天賦・武器・聖遺物）: 発動位置は出場の先頭からの秒数（退場後も自由移動可能）
    const availableBuffs = getAvailableBuffsForCharacter(char, options?.database);

    for (const trigger of rawStint.passiveTriggers ?? []) {
      const def = availableBuffs.find(b => b.id === trigger.passiveEffectId);
      const category: BuffCategory = def?.category || (trigger.passiveEffectId.startsWith('wbuff_') ? 'weapon' : trigger.passiveEffectId.startsWith('abuff_') ? 'artifact' : 'talent');
      const duration = trigger.duration ?? def?.duration ?? 0;
      // 個別に変更した CT を優先（継続時間と同じ優先順）
      const cooldown = trigger.cooldown ?? def?.cooldown ?? 0;
      const startTime = Number((stintStartTime + Math.max(0, trigger.offset)).toFixed(3));

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
        hasCTViolation: false,
        collisionRemainingCT: undefined,
        color: buffColor,
        description: def?.description ?? trigger.name,
      });
      const passiveSpan = passiveSpans[passiveSpans.length - 1];
      const catLabel = category === 'weapon' ? '武器バフ' : category === 'artifact' ? '聖遺物バフ' : '固有天賦バフ';
      ctEvents.push({
        key: `${char.id}:passive:${trigger.passiveEffectId}`,
        time: startTime,
        cooldown,
        checked: true,
        stintIndex: sIdx,
        name: trigger.name,
        onViolation: (remaining, cycle) => {
          passiveSpan.hasCTViolation = true;
          passiveSpan.collisionRemainingCT = Math.max(passiveSpan.collisionRemainingCT ?? 0, remaining);
          addViolationIssue(`passive_ct_${trigger.id}`, char, rawStint.id, undefined, startTime, 'warning', `${char.name}: ${catLabel}CT中`, `「${trigger.name}」`, remaining, cycle);
        },
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
  const safeLoopStartIndex = Math.min(loopStartIndex, Math.max(0, calculatedStints.length - 1));
  const loopStartTime = calculatedStints[safeLoopStartIndex]?.startTime ?? 0;
  const loopPeriod = Math.max(0, totalDuration - loopStartTime);

  // CT違反の判定（1周目・2周目を区別せず、ループを必要な周数だけ並べた時間軸で時刻順に判定）
  checkCooldownViolations(ctEvents, safeLoopStartIndex, loopPeriod);

  const carryOverCooldowns: CooldownSpan[] = [];
  const carryOverBuffs: ActiveBuffSpan[] = [];
  const carryOverPassives: PassiveSpan[] = [];

  if (loopPeriod > 0.05) {
    // 1. スキルCTの2周目折り返し
    for (const cd of skillCooldowns) {
      if (cd.endTime > totalDuration + 0.02) {
        const overflow = Number((cd.endTime - totalDuration).toFixed(3));
        const wrapEnd = Math.min(totalDuration, Number((loopStartTime + overflow).toFixed(3)));
        carryOverCooldowns.push({
          id: `wrap_cd_skill_${cd.id}`,
          characterId: cd.characterId,
          type: 'skill',
          startTime: loopStartTime,
          endTime: wrapEnd,
          duration: overflow,
          actionInstanceId: cd.actionInstanceId,
          isCarryOver: true,
          originalStartTime: cd.startTime,
          originalEndTime: cd.endTime,
        });
      }
    }

    // 2. 元素爆発CTの2周目折り返し
    for (const cd of burstCooldowns) {
      if (cd.endTime > totalDuration + 0.02) {
        const overflow = Number((cd.endTime - totalDuration).toFixed(3));
        const wrapEnd = Math.min(totalDuration, Number((loopStartTime + overflow).toFixed(3)));
        carryOverCooldowns.push({
          id: `wrap_cd_burst_${cd.id}`,
          characterId: cd.characterId,
          type: 'burst',
          startTime: loopStartTime,
          endTime: wrapEnd,
          duration: overflow,
          actionInstanceId: cd.actionInstanceId,
          isCarryOver: true,
          originalStartTime: cd.startTime,
          originalEndTime: cd.endTime,
        });
      }
    }

    // 3. アクション効果バフの2周目折り返し（発動パッシブバフは除外）
    for (const b of activeBuffs) {
      if (b.origin !== 'passive' && b.endTime > totalDuration + 0.02) {
        const overflow = Number((b.endTime - totalDuration).toFixed(3));
        carryOverBuffs.push({
          ...b,
          id: `wrap_buff_${b.id}`,
          buffId: b.buffId,
          startTime: loopStartTime,
          endTime: Math.min(totalDuration, Number((loopStartTime + overflow).toFixed(3))),
          duration: overflow,
          isCarryOver: true,
          originalStartTime: b.startTime,
        });
      }
    }

    // 4. 発動バフ（固有天賦・武器・聖遺物）の2周目折り返し
    for (const p of passiveSpans) {
      if (p.duration > 0 && p.endTime > totalDuration + 0.02) {
        const overflow = Number((p.endTime - totalDuration).toFixed(3));
        carryOverPassives.push({
          ...p,
          id: `wrap_passive_buff_${p.id}`,
          startTime: loopStartTime,
          endTime: Math.min(totalDuration, Number((loopStartTime + overflow).toFixed(3))),
          duration: overflow,
          isCarryOver: true,
          originalStartTime: p.startTime,
        });
      }
    }
  }

  // 3-D: 持ち越しバフも含め、同じ buffId は1つとして数える（全タイムラインで重複度を一貫計算）
  const allDistinctBuffs = [...activeBuffs, ...carryOverBuffs];
  const maxSec = Math.ceil(totalDuration);
  const activeBuffCountBySecond: { time: number; count: number; activeBuffs: string[] }[] = [];
  for (let s = 0; s <= maxSec; s += 0.5) {
    const { count, names } = countDistinctActiveBuffs(allDistinctBuffs, s);
    activeBuffCountBySecond.push({
      time: s,
      count,
      activeBuffs: names,
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
    carryOverCooldowns,
    carryOverBuffs,
    carryOverPassives,
    loopStartTime,
    loopPeriod,
  };
}

/** CT を持つ1回の発動 */
interface CooldownEvent {
  /** CT の共有単位（キャラ + スキル / 爆発 / 発動バフ） */
  key: string;
  /** 1周目の時間軸での発動時刻 */
  time: number;
  /** この発動が開始する CT（0 なら CT を開始しない） */
  cooldown: number;
  /** CT 中の発動を違反として扱うか（祭礼リセットなど CT 中でも撃てるものは false） */
  checked: boolean;
  stintIndex: number;
  name: string;
  /** 違反時: remaining = 残り CT 秒、cycle = 何周目の発動で違反したか（0 = 1周目） */
  onViolation: (remaining: number, cycle: number) => void;
}

const CT_TOLERANCE_SEC = 0.05;

/**
 * CT違反をまとめて判定する（1周目と2周目を1本の時間軸に並べ、同じ CT を共有する発動を時刻順に見ていく）。
 * - ループ区間（loopStartIndex 番目以降の出場）の発動は、1周目と、loopPeriod ずらした2周目に並べる
 * - 初動部分（ループ区間より前）の発動は1回だけ
 * 3周目以降は、各発動の直前にある同じ CT の発動が2周目と同じ（1周前の同じ位置）になるため、2周分の判定で足りる。
 * どちらの周で違反しても、元の発動に違反の印を付ける。
 */
function checkCooldownViolations(events: CooldownEvent[], loopStartIndex: number, loopPeriod: number): void {
  const extraCycles = loopPeriod > 0.05 ? 1 : 0;

  const timeline: Array<{ event: CooldownEvent; time: number; cycle: number; order: number }> = [];
  events.forEach((event, order) => {
    const repeats = event.stintIndex >= loopStartIndex ? extraCycles : 0;
    for (let cycle = 0; cycle <= repeats; cycle++) {
      timeline.push({ event, time: event.time + cycle * loopPeriod, cycle, order });
    }
  });
  timeline.sort((a, b) => a.time - b.time || a.order - b.order);

  const cooldownEnd = new Map<string, number>();
  for (const item of timeline) {
    const end = cooldownEnd.get(item.event.key) ?? -Infinity;
    if (item.event.checked && end > item.time + CT_TOLERANCE_SEC) {
      item.event.onViolation(Number((end - item.time).toFixed(1)), item.cycle);
    }
    if (item.event.cooldown > 0) cooldownEnd.set(item.event.key, item.time + item.event.cooldown);
  }
}
