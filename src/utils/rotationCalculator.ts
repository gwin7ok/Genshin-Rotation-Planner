import { actionDelayOf } from './actionDelay';
import { ACTION_STATE_RULES } from '../data/actionStateRules';
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
import type { CancelTarget } from '../types/genshin';
import { passiveGroupOf } from '../types/genshin';
import { buildActionEffectSpan, countDistinctActiveBuffs } from './characterActions';
import { getAvailableBuffsForCharacter, BuffCategory } from './buffUtils';
import { CharacterModel } from '../models/CharacterModel';

/** バフ重複行の1区間（この区間の間はバフ数が変わらない） */
export interface BuffOverlapSegment {
  start: number;
  end: number;
  count: number;
  activeBuffs: string[];
}

export interface CalculatedRotation {
  totalDuration: number;
  calculatedStints: Stint[];
  activeBuffs: ActiveBuffSpan[];
  skillCooldowns: CooldownSpan[];
  burstCooldowns: CooldownSpan[];
  characterStates: Record<string, CharacterRuntimeState>;
  validationIssues: ValidationIssue[];
  /** バフ重複行（1周目: 折り返し部分を含まない / 2周目以降: 含む） */
  buffOverlapSegments: BuffOverlapSegment[];
  loopedBuffOverlapSegments: BuffOverlapSegment[];
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
  database?: GenshinDatabase;
  loopStartIndex?: number;
  /** gcsim の結果でCT待ちが生じたアクション（アクション ID → 待った秒数）。CT違反と同じ印を付ける（フェーズ6 / D21） */
  externalCtWaits?: Record<string, number>;
}

/** 次に続くアクションの種類 → キャンセルフレームの表のキー（gcsim の action.ActionXxx）。出場の最後は次が交代 */
function cancelKeyOf(next: CharacterActionInstance | undefined, weaponType?: string): CancelTarget | undefined {
  if (!next) return 'swap';
  switch (next.type) {
    case 'normal': return 'attack';
    case 'charged': return weaponType === 'bow' ? 'aim' : 'charge';
    case 'skill':
    case 'skill_hold':
    case 'skill_reset': return 'skill';
    case 'burst': return 'burst';
    case 'dash': return 'dash';
    case 'jump': return 'jump';
    case 'plunge_low': return 'lowPlunge';
    case 'plunge_high': return 'highPlunge';
    default: return undefined; // 待機など: 全体のフレーム
  }
}

export function calculateRotation(
  characters: CharacterConfig[],
  rawStints: Stint[],
  options?: RotationOptions
): CalculatedRotation {
  const switchDelay = typeof options?.switchDelay === 'number' ? Math.max(0, options.switchDelay) : 0.50;
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
  // アクション状態の窓（キャラごと）
  const stateWindows = new Map<string, { end: number; usesLeft?: number; used: number }>();

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
    const charActions = CharacterModel.fromConfig(char).actions;

    const stintStartTime = currentTime;
    const computedActions: CharacterActionInstance[] = [];
    // 連続した通常攻撃の段（gcsim と同じく、他のアクションを挟むと1段目に戻る）
    let normalStreak = 0;

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
      const act = rawActions[aIdx];
      const actionStartTime = currentTime;
      // CT・効果継続時間はアクション定義ごとに持つ（凸の変更を適用済み）
      const actionDef = charActions.find(a => a.id === act.actionTypeId);

      // アクション状態の規則辞書: 窓（ニィロウの pirouette など）の中の E か、窓の中の何回目か
      let inStateWindow = false;
      let stageIndex = 0;
      const rule = ACTION_STATE_RULES[char.id];
      if (rule && act.type === 'skill' && act.actionTypeId === `${char.id}_e`) {
        const win = stateWindows.get(char.id);
        if (win && actionStartTime < win.end && (win.usesLeft === undefined || win.usesLeft > 0)) {
          inStateWindow = true;
          stageIndex = win.used;
          win.used += 1;
          if (win.usesLeft !== undefined) {
            win.usesLeft -= 1;
            if (win.usesLeft <= 0) stateWindows.delete(char.id);
          }
        } else {
          stateWindows.set(char.id, { end: actionStartTime + rule.windowSeconds, usesLeft: rule.maxUses, used: 0 });
        }
      }

      // 通常攻撃: 連続した N の段（gcsim と同じく、他のアクションを挟むと1段目に戻り、最大段数を超えたら1段目に戻る）
      let frames = actionDef?.frames;
      let hitFallbackDuration: number | undefined;
      if (act.type === 'normal') {
        const hits = actionDef?.normalHits;
        if (hits && hits.length > 0) {
          const hit = hits[normalStreak % hits.length];
          frames = hit.frames ?? frames;
          hitFallbackDuration = hit.duration;
        }
        normalStreak += 1;
      } else {
        normalStreak = 0;
      }
      if (inStateWindow && rule?.stageFrames?.length) {
        frames = rule.stageFrames[Math.min(stageIndex, rule.stageFrames.length - 1)];
      }

      // 所要時間: 編集済み（durationManual）ならその値。未編集なら、次に続くアクションに応じたキャンセルフレーム
      // （出場の最後は次が交代）。フレームが無いアクションは、登録時の値を使う
      let autoDuration: number | undefined;
      {
        if (frames) {
          const nextKey = cancelKeyOf(rawActions[aIdx + 1], char.weaponType);
          autoDuration = Number((((nextKey ? frames.cancels[nextKey] : undefined) ?? frames.total) / 60).toFixed(3));
        } else {
          autoDuration = hitFallbackDuration;
        }
      }
      // gcsim 自身の標準の所要時間（編集済みでも）。ユーザーが標準より長くした分を gcsim に渡すために使う
      const naturalDuration = act.gcsimBaseDuration ?? autoDuration;
      if (act.durationManual) autoDuration = undefined;
      const duration = Math.max(0.05, autoDuration ?? (act.duration || 0.5));
      const actionEndTime = Number((actionStartTime + duration).toFixed(3));

      // 長押しの秒数（CT開始位置が「長押し終了」のアクション）: 所要時間 −（ホールド 0 のときのモーション）。
      // モーション = 次に続くアクションに応じたキャンセルフレーム。frames に長押しが含まれる分（holdInFrames）は差し引く
      const cooldownStart = actionDef?.cooldownStart;
      let holdSeconds: number | undefined;
      if (cooldownStart?.from === 'holdEnd') {
        const nextKey = cancelKeyOf(rawActions[aIdx + 1], char.weaponType);
        const motionFrames = frames ? (nextKey ? frames.cancels[nextKey] : undefined) ?? frames.total : undefined;
        holdSeconds = motionFrames === undefined
          ? 0
          : Number(Math.max(0, duration - (motionFrames / 60 - (actionDef?.holdInFrames ?? 0))).toFixed(3));
      }

      const computedAction: CharacterActionInstance = {
        ...act,
        hasCTCollision: false,
        collisionRemainingCT: undefined,
        ...(holdSeconds !== undefined ? { holdSeconds } : {}),
        ...(naturalDuration !== undefined ? { naturalDuration } : {}),
        duration,
        startTime: actionStartTime,
        endTime: actionEndTime,
      };
      computedActions.push(computedAction);

      // gcsim の結果でCT待ちが生じたアクション: アプリのCT違反と同じ印を付ける
      const externalWait = options?.externalCtWaits?.[act.id];
      if (externalWait !== undefined) {
        computedAction.hasCTCollision = true;
        computedAction.collisionRemainingCT = externalWait;
        addViolationIssue(`skill_ct_gcsim_${act.id}`, char, rawStint.id, act.id, actionStartTime, 'error', `${char.name}: gcsim でCT待ち`, `「${act.name}」`, externalWait, 0);
      }

      const isSkill = act.type === 'skill' || act.type === 'skill_hold' || act.type === 'skill_reset';
      // 個別に変更された CT があれば優先
      // （長押しで長さが変わるものは、ホールド 0 のときの値 + 長押し 1 秒あたりの増分 × ホールド秒数）
      const cooldown = act.cooldown ?? Number(((actionDef?.cooldown ?? 0) + (actionDef?.cooldownPerHold ?? 0) * (holdSeconds ?? 0)).toFixed(3));
      // CTの開始位置（動作開始からの遅れ）。マスターの値。未設定は動作開始と同時
      // 動作開始から / 長押し終了から / 状態の終了から（状態の長さは効果継続時間。無ければアクションの終了）
      const effectSeconds = act.effectDuration ?? actionDef?.effectDuration ?? 0;
      const computedCtOffset = Number((cooldownStart
        ? cooldownStart.delay + (cooldownStart.from === 'holdEnd' ? holdSeconds ?? 0 : cooldownStart.from === 'stateEnd' ? (effectSeconds > 0 ? effectSeconds : duration) : 0)
        : 0).toFixed(3));
      // gcsim から書き戻した値があれば優先（D37）
      const ctOffset = act.gcsimCtOffset ?? computedCtOffset;
      const ctStartTime = Number((actionStartTime + ctOffset).toFixed(3));

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
          message: `「${act.name}」の定義がキャラデータにないため、CT を判定できません（DB 管理で、そのキャラのアクションを確認してください）`,
        });
      }

      if (isSkill) {
        computedAction.inStateWindow = inStateWindow || undefined;
        // CTを開始しない派生技は、CTと無関係。祭礼リセットはCT中でも発動できる（CTは開始する）
        const isTriggeringAction = actionDef?.startsSkillCooldown !== false && !inStateWindow;
        if (isTriggeringAction) {
          ctEvents.push({
            key: `${char.id}:skill`,
            time: actionStartTime,
            ctOffset,
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
            startTime: ctStartTime,
            endTime: Number((ctStartTime + cooldown).toFixed(3)),
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
            ctOffset,
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
            startTime: ctStartTime,
            endTime: Number((ctStartTime + cooldown).toFixed(3)),
            duration: cooldown,
            actionInstanceId: act.id,
          };
          burstCooldowns.push(burstCDSpan);
          charStates[char.id].burstCooldowns.push(burstCDSpan);
        }
      }

      // 効果継続時間（アクション定義 or 個別変更値）から効果バーを作る
      const effectSpan = inStateWindow ? null : buildActionEffectSpan(char, act, actionDef, actionStartTime);
      if (effectSpan) activeBuffs.push(effectSpan);

      // gcsim から書き戻した副次効果（アクションの開始からの位置・継続時間つき）
      (act.extraEffects ?? []).forEach((ex, exIdx) => {
        if (!(ex.duration > 0) || inStateWindow) return;
        const exStart = Number((actionStartTime + Math.max(0, ex.offset)).toFixed(3));
        activeBuffs.push({
          id: `effect_extra_${char.id}_${act.id}_${exIdx}`,
          buffId: `effect_extra_${char.id}_${act.actionTypeId}_${ex.key}`,
          name: `${char.name} ${act.shortName}: ${ex.name}`,
          sourceCharacterId: char.id,
          sourceType: 'talent',
          startTime: exStart,
          endTime: Number((exStart + ex.duration).toFixed(3)),
          duration: ex.duration,
          color: char.color,
          description: `${act.name}（副次効果: ${ex.name}）`,
          ownerStintId: rawStint.id,
        });
      });

      // アクションごとの遅延は、そのアクションの終了後に入れる（出場の最後なら次の交代が遅れる）
      currentTime = Number((actionEndTime + actionDelayOf(act)).toFixed(3));
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
      // 発動位置は出場の前にも置ける（下限は時間 0）
      const startTime = Number(Math.max(0, stintStartTime + trigger.offset).toFixed(3));

      const buffColor = def?.color || (category === 'weapon' ? '#0284c7' : category === 'artifact' ? '#c084fc' : char.color);

      passiveSpans.push({
        id: `passive_${trigger.id}`,
        triggerId: trigger.id,
        stintId: rawStint.id,
        characterId: char.id,
        passiveEffectId: trigger.passiveEffectId,
        gcsimKey: trigger.gcsimKey,
        effectGroup: passiveGroupOf(trigger.passiveEffectId, trigger.gcsimKey),
        gcsimMissed: trigger.gcsimMissed,
        name: trigger.gcsimMissed ? `${trigger.name}（gcsim では発動せず）` : trigger.name,
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
          addViolationIssue(`passive_ct_${trigger.id}`, char, rawStint.id, undefined, startTime, 'warning', `${char.name}: ${catLabel}CT中`, `「${trigger.name}」`, remaining, cycle);
        },
      });

      if (duration > 0) {
        activeBuffs.push({
          id: `passive_buff_${trigger.id}`,
          buffId: `buff_${char.id}_${passiveGroupOf(trigger.passiveEffectId, trigger.gcsimKey)}`, // 同じバフ（キー単位）は重複集計で1つとして数える
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
        description: `キャラクターに紐づく効果: ${ex.name}`,
        ownerStintId: rawStint.id,
      });
    });

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

  // 同じ効果を再発動したら、前の発動の効果はそこで終わる（残りは上書きされる）
  endAtNextStart(activeBuffs, b => b.buffId);
  endAtNextStart(passiveSpans, p => `${p.characterId}:${p.effectGroup}`);

  const carryOverCooldowns: CooldownSpan[] = [];
  const carryOverBuffs: ActiveBuffSpan[] = [];
  const carryOverPassives: PassiveSpan[] = [];

  // 効果の折り返し部分: ループ先頭から残り時間分。ループ区間で同じ効果を再発動したらそこで終わる。
  // 本体の終了時刻も、折り返し後の実際の終了（totalDuration + 折り返し部分の長さ）に合わせる。
  // 開始が周の終端以降の発動（2周目の発動。D39）は、ループ先頭 + (開始 − 総時間) の位置から始まる
  const wrapEffect = (span: { id: string; startTime: number; endTime: number }, sameEffect: { id?: string; startTime: number }[]) => {
    const wrapDelay = Math.max(0, span.startTime - totalDuration);
    const wrapStart = loopStartTime + wrapDelay;
    const toLapTwo = (t: number) => (t >= totalDuration ? loopStartTime + (t - totalDuration) : t);
    const nextStart = Math.min(
      ...sameEffect
        .filter(s => (wrapDelay > 0 ? (s as { id?: string }).id !== span.id && toLapTwo(s.startTime) > wrapStart : s.startTime >= loopStartTime))
        .map(s => toLapTwo(s.startTime)),
    );
    const end = Number(Math.min(totalDuration, loopStartTime + (span.endTime - totalDuration), nextStart).toFixed(3));
    span.endTime = totalDuration + Math.max(0, end - loopStartTime);
    if (end <= wrapStart + 0.02) return null;
    return {
      startTime: Number(wrapStart.toFixed(3)),
      endTime: end,
      duration: end - wrapStart,
      isCarryOver: true,
      originalStartTime: span.startTime,
      sourceId: span.id,
    };
  };

  if (loopPeriod > 0.05) {
    // 1. スキルCTの2周目折り返し
    for (const cd of skillCooldowns) {
      if (cd.endTime > totalDuration + 0.02) {
        // CTの開始が周の終端より後（CT開始位置の遅れ）なら、折り返し後もその分だけ遅れて始まる
        const wrapDelay = Math.max(0, cd.startTime - totalDuration);
        const overflow = Number((cd.endTime - totalDuration - wrapDelay).toFixed(3));
        const wrapStart = Number((loopStartTime + wrapDelay).toFixed(3));
        const wrapEnd = Math.min(totalDuration, Number((wrapStart + overflow).toFixed(3)));
        carryOverCooldowns.push({
          id: `wrap_cd_skill_${cd.id}`,
          characterId: cd.characterId,
          type: 'skill',
          startTime: wrapStart,
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
        // CTの開始が周の終端より後（CT開始位置の遅れ）なら、折り返し後もその分だけ遅れて始まる
        const wrapDelay = Math.max(0, cd.startTime - totalDuration);
        const overflow = Number((cd.endTime - totalDuration - wrapDelay).toFixed(3));
        const wrapStart = Number((loopStartTime + wrapDelay).toFixed(3));
        const wrapEnd = Math.min(totalDuration, Number((wrapStart + overflow).toFixed(3)));
        carryOverCooldowns.push({
          id: `wrap_cd_burst_${cd.id}`,
          characterId: cd.characterId,
          type: 'burst',
          startTime: wrapStart,
          endTime: wrapEnd,
          duration: overflow,
          actionInstanceId: cd.actionInstanceId,
          isCarryOver: true,
          originalStartTime: cd.startTime,
          originalEndTime: cd.endTime,
        });
      }
    }

    // 3. 効果バフの2周目折り返し（発動バフ分はバフ数の集計用。バーは carryOverPassives で表示する）
    for (const b of activeBuffs) {
      if (b.endTime <= totalDuration + 0.02) continue;
      const carry = wrapEffect(b, activeBuffs.filter(x => x.buffId === b.buffId));
      if (carry) carryOverBuffs.push({ ...b, ...carry, id: `wrap_buff_${b.id}` });
    }

    // 4. 発動バフ（固有天賦・武器・聖遺物）の2周目折り返し
    for (const p of passiveSpans) {
      if (p.duration <= 0 || p.endTime <= totalDuration + 0.02) continue;
      const carry = wrapEffect(p, passiveSpans.filter(x => x.characterId === p.characterId && x.effectGroup === p.effectGroup));
      if (carry) {
        // CTも折り返した位置に合わせる（本体のCT終了は元の時刻のまま）
        const cooldownEnd = p.cooldownEnd > totalDuration ? Number((loopStartTime + (p.cooldownEnd - totalDuration)).toFixed(3)) : carry.startTime;
        carryOverPassives.push({ ...p, ...carry, cooldownEnd, id: `wrap_passive_buff_${p.id}` });
      }
    }
  }

  // バフ重複行: 1周目は折り返し部分をまだ数えず、2周目以降は数える
  const buffOverlapSegments = buildBuffOverlapSegments(activeBuffs, totalDuration);
  const loopedBuffOverlapSegments = buildBuffOverlapSegments([...activeBuffs, ...carryOverBuffs], totalDuration);

  return {
    totalDuration,
    calculatedStints,
    activeBuffs,
    skillCooldowns,
    burstCooldowns,
    characterStates: charStates,
    validationIssues,
    buffOverlapSegments,
    loopedBuffOverlapSegments,
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
  /** 発動時刻から CT の開始までの秒数（CT開始位置。発動バフは 0） */
  ctOffset: number;
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

/** バフ数が変わる時刻（各バフの開始・終了）で区切り、区間ごとに数える（同じ buffId は1つ） */
function buildBuffOverlapSegments(buffs: ActiveBuffSpan[], totalDuration: number): BuffOverlapSegment[] {
  const cuts = [...new Set([0, totalDuration, ...buffs.flatMap(b => [b.startTime, b.endTime])])]
    .filter(t => t >= 0 && t <= totalDuration)
    .sort((a, b) => a - b);
  const segments: BuffOverlapSegment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i];
    const end = cuts[i + 1];
    if (end - start < 0.001) continue;
    const { count, names } = countDistinctActiveBuffs(buffs, (start + end) / 2);
    const prev = segments[segments.length - 1];
    if (prev && prev.count === count && prev.activeBuffs.join() === names.join()) prev.end = end;
    else segments.push({ start, end, count, activeBuffs: names });
  }
  return segments;
}

function endAtNextStart<T extends { startTime: number; endTime: number }>(spans: T[], effectKey: (s: T) => string): void {
  const byKey = new Map<string, T[]>();
  for (const s of spans) byKey.set(effectKey(s), [...(byKey.get(effectKey(s)) ?? []), s]);
  for (const list of byKey.values()) {
    list.sort((a, b) => a.startTime - b.startTime);
    list.forEach((s, i) => {
      const next = list[i + 1];
      if (next && next.startTime < s.endTime) s.endTime = next.startTime;
    });
  }
}

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
    if (item.event.cooldown > 0) cooldownEnd.set(item.event.key, item.time + item.event.ctOffset + item.event.cooldown);
  }
}
