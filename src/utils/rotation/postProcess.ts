import { countNatlan, nightsoulBurstCooldown, isNightsoulBurstTriggered } from '../../masterdata/nightsoulBurst';
import { checkPlungePrerequisites } from '../plungePrerequisites';
import { CharacterConfig, Stint, ActiveBuffSpan, CooldownSpan, ValidationIssue, CharacterRuntimeState, PassiveSpan } from '../../types/genshin';
import { passiveGroupOf } from '../../types/genshin';
import { getAvailableBuffsForCharacter, type TriggerableBuffDefinition } from '../buffUtils';
import { CharacterModel } from '../../models/CharacterModel';
import { simulateLayers, type LayerBuffRule, type LayerEvent } from '../stateBars';
import type { ModeWindow, SacrificialProc } from './types';
import type { CooldownEvent } from './cooldownCheck';
import type { GenshinDatabase } from '../../types/database';
import { t } from '../../i18n';
import { charName, actionName } from '../../i18n/loc';

/** モードの終わりに関わる CT を、CT の発動（ctEvents）に足す: 時間切れで終わったモードのスキルの CT 短縮（閑雲）と、モードの終わりから始まる CT（タルタリヤ・放浪者） */
export function addModeEndCooldowns(a: { retiredModes: ModeWindow[]; modeWindows: Map<string, ModeWindow>; ctEvents: CooldownEvent[]; skillCooldowns: CooldownSpan[]; charStates: Record<string, CharacterRuntimeState>; switchDelay: number }): void {
  const { retiredModes, modeWindows, ctEvents, skillCooldowns, charStates, switchDelay } = a;
  // 時間切れで終わったモードが、スキルの CT を短縮する（閑雲）。終わらせるアクション（落下攻撃）で終わったものと、同じアクションの使い直しで切れたものは、短縮しない。
  // 交代で終わったものは、afterSwap なら、本来の終わりの時刻に短縮する
  for (const m of [...retiredModes, ...modeWindows.values()]) {
    const red = m.def.cooldownReduceOnExpire;
    if (!red || m.def.special) continue;
    const natural = m.naturalEnd ?? m.end;
    // 'timeout' は、出場の終わりまでに自然に切れた（naturalEnd が無い）ものと、同じモードを開き直して切られた（naturalEnd がある）ものがある。後者は短縮しない
    if (m.endedBy === 'ender' || (m.endedBy === 'timeout' && m.naturalEnd !== undefined) || (m.endedBy === 'swap' && !red.afterSwap)) continue;
    ctEvents.push({ key: `${m.charId}:skill`, time: Number(natural.toFixed(3)), ctOffset: 0, cooldown: 0, reduceBy: red.seconds, checked: false, stintIndex: m.sIdx, name: m.opener.name, onViolation: () => {} });
  }

  // モードの終わりから始まる CT（タルタリヤ・放浪者）: モードの計算の結果（終わりの時刻・終わり方）を受け取って、CT の発動を足す。
  // 長さは、滞在時間（モードを開いたアクションの開始〜モードの終わり）の表、無ければアクションの CT。交代で終わったときは、交代の動作の後から
  for (const m of modeWindows.values()) {
    const cae = m.def.cooldownAtEnd;
    if (!cae) continue;
    const by = m.endedBy ?? 'timeout';
    const at = Number((m.end + (by === 'swap' ? switchDelay : 0) + cae.delayFrames[by] / 60).toFixed(3));
    let length = m.opener.cooldown;
    if (cae.byStay?.length) {
      const stay = m.end - m.opener.start;
      const row = cae.byStay.find(r => r.below === undefined || stay < r.below - 0.0001) ?? cae.byStay[cae.byStay.length - 1];
      length = (row.seconds + (row.plusStay ? stay : 0)) * m.opener.cdScale;
      if (cae.consScale && m.opener.constellation >= cae.consScale.minConstellation) length *= cae.consScale.scale;
    }
    length = Number(length.toFixed(3));
    if (!(length > 0)) continue;
    ctEvents.push({ key: `${m.charId}:skill`, time: at, ctOffset: 0, cooldown: length, checked: false, actionId: m.opener.actionId, stintIndex: m.sIdx, name: m.opener.name, onViolation: () => {} });
    const span: CooldownSpan = {
      id: `cd_skill_${m.charId}_${m.opener.actionId}_end`,
      characterId: m.charId,
      type: 'skill',
      startTime: at,
      endTime: Number((at + length).toFixed(3)),
      duration: length,
      actionInstanceId: m.opener.actionId,
    };
    skillCooldowns.push(span);
    charStates[m.charId]?.skillCooldowns.push(span);
  }
}

/** gcsim が実装していないアクションの警告（アクションに印を付け、validationIssues に足す） */
export function warnGcsimUnsupportedActions(a: { characters: CharacterConfig[]; calculatedStints: Stint[]; validationIssues: ValidationIssue[] }): void {
  const { characters, calculatedStints, validationIssues } = a;
  // gcsim が実装していないアクション（大剣の重撃など）: 実行すると「action ... not implemented」のエラーになる（警告）
  for (const st of calculatedStints) {
    const stChar = characters.find(c => c.id === st.characterId);
    if (!stChar) continue;
    for (const a of st.actions) {
      if (!stChar.availableActions.find(d => d.id === a.actionTypeId)?.gcsimUnsupported) continue;
      const message = t('messages:rotation.gcsimMissingAction');
      a.specialWindowWarning = message;
      validationIssues.push({
        id: `gcsim_unsupported_${a.id}`,
        severity: 'warning',
        characterId: st.characterId,
        stintId: st.id,
        actionId: a.id,
        time: a.startTime ?? 0,
        title: t('messages:rotation.gcsimMissingActionTitle', { name: charName(stChar) }),
        message: `「${actionName(stChar, a)}」: ${message}`,
      });
    }
  }
}

/** 落下攻撃が gcsim で実行できる前提を満たしているかの警告 */
export function warnPlungePrerequisites(a: { characters: CharacterConfig[]; calculatedStints: Stint[]; validationIssues: ValidationIssue[] }): void {
  const { characters, calculatedStints, validationIssues } = a;
  // 落下攻撃が、gcsim で実行できる前提（直前のアクション・閑雲の爆発バフなど。data/plungeRules.ts）を満たしているか。満たさないと、gcsim は実行エラーになる（警告）
  for (const w of checkPlungePrerequisites(characters, calculatedStints)) {
    const action = calculatedStints.find(s => s.id === w.stintId)?.actions.find(a => a.id === w.actionId);
    if (action) action.specialWindowWarning = w.message;
    const ownerName = charName(characters.find(c => c.id === w.characterId));
    validationIssues.push({
      id: `plunge_prereq_${w.actionId}`,
      severity: 'warning',
      characterId: w.characterId,
      stintId: w.stintId,
      actionId: w.actionId,
      time: w.time,
      title: t('messages:plunge.title', { name: ownerName }),
      message: `「${w.actionName}」: ${w.message}`,
    });
  }
}

/** 層が溜まる効果・印のバフを、期間（バー）にして activeBuffs に足す */
export function addStateBars(a: { characters: CharacterConfig[]; activeBuffs: ActiveBuffSpan[]; layerEventsByChar: Map<string, { rule: LayerBuffRule; events: LayerEvent[] }> }): void {
  const { characters, activeBuffs, layerEventsByChar } = a;
  // 層が溜まる効果・印のバフを、期間（バー）にする（ヴェスナの粛清・アリョーシャの狩猟の印と狩人の照準）
  const stateBar = (char: CharacterConfig, id: string, name: string, start: number, end: number, description: string, noSynergy: boolean) => {
    const startTime = Number(start.toFixed(3));
    const endTime = Number(end.toFixed(3));
    if (endTime - startTime < 0.001) return;
    activeBuffs.push({
      id,
      buffId: id,
      name: `${char.name} ${name}`,
      sourceCharacterId: char.id,
      sourceType: 'talent',
      startTime,
      endTime,
      duration: Number((endTime - startTime).toFixed(3)),
      color: char.color,
      description,
      ...(noSynergy ? { noSynergy: true } : {}),
    });
  };
  for (const [charId, entry] of layerEventsByChar) {
    const char = characters.find(c => c.id === charId);
    if (!char) continue;
    const { layers, fullPeriods } = simulateLayers(entry.events, entry.rule, CharacterModel.fromConfig(char).constellation);
    layers.forEach((l, i) => stateBar(char, `layer_${charId}_${i}`, t('messages:rotation.layer', { label: entry.rule.label, index: l.index }), l.start, l.end, entry.rule.description, true));
    fullPeriods.forEach((p, i) => stateBar(char, `layerfull_${charId}_${i}`, entry.rule.fullBuff!.label, p.start, p.end, entry.rule.fullBuff!.description, true));
  }
}

/** 祭礼の武器効果の発動を、発動バフのバー（auto）として passiveSpans に足す */
export function addSacrificialPassiveSpans(a: { sacrificialProcs: SacrificialProc[]; characterMap: Map<string, CharacterConfig>; database: GenshinDatabase | undefined; calculatedStints: Stint[]; passiveSpans: PassiveSpan[] }): void {
  const { sacrificialProcs, characterMap, database, calculatedStints, passiveSpans } = a;
  // 祭礼の武器効果（確率 100%）の発動を、発動バフのバー（効果と、武器の内部 CT。長さは精錬で決まる）として自動で出す。
  // 出すのは 1 周目の発動だけ（2 周目折り返しは、既存の持ち越しの仕組み）。手で置く発動バフ（triggerId）ではない（auto）
  const sacrificialDefs = new Map<string, TriggerableBuffDefinition | undefined>();
  for (const p of sacrificialProcs) {
    if (p.cycle !== 0) continue;
    const owner = characterMap.get(p.charId);
    if (!owner) continue;
    if (!sacrificialDefs.has(p.charId)) sacrificialDefs.set(p.charId, getAvailableBuffsForCharacter(owner, database).find(b => b.autoApplied));
    const def = sacrificialDefs.get(p.charId);
    const stint = calculatedStints.find(st => st.characterId === p.charId && p.time >= st.startTime - 1e-6 && p.time < st.endTime + 1e-6);
    if (!def || !stint) continue;
    const duration = def.duration ?? 0.1;
    passiveSpans.push({
      id: `passive_auto_sac_${p.actionId}_${p.hitFrame}`,
      triggerId: `auto_sac_${p.actionId}_${p.hitFrame}`,
      auto: true,
      stintId: stint.id,
      characterId: p.charId,
      passiveEffectId: def.id,
      effectGroup: passiveGroupOf(def.id),
      name: def.name,
      category: 'weapon',
      startTime: p.time,
      duration,
      endTime: Number((p.time + duration).toFixed(3)),
      cooldown: p.icdSeconds,
      cooldownEnd: Number((p.time + p.icdSeconds).toFixed(3)),
      hasCTViolation: false,
      color: def.color,
      description: def.description,
    });
  }
}

/** 夜魂バーストで発動する効果の、チーム共通の間隔（CT 警告）。アプリの時間は変えない */
export function applyNightsoulBurstInterval(a: { characters: CharacterConfig[]; characterMap: Map<string, CharacterConfig>; passiveSpans: PassiveSpan[]; validationIssues: ValidationIssue[] }): void {
  const { characters, characterMap, passiveSpans, validationIssues } = a;
  // 夜魂バーストで発動する効果（カチーナの山のこだまなど）は、チーム共通の間隔（ナタのキャラ 1 人 18 秒・2 人 12 秒・3 人以上 9 秒）を空ける。
  // 同じ時刻（0.05 秒以内）の発動は、同じ夜魂バーストに反応したものとして数える。間隔が足りない発動は、CT 警告にする（アプリの時間は変えない）
  {
    const natlan = countNatlan(characters);
    const burstCd = nightsoulBurstCooldown(natlan);
    const triggered = passiveSpans.filter(p => {
      if (p.auto || p.category !== 'talent') return false;
      const def = characterMap.get(p.characterId)?.passiveEffects?.find(e => e.id === p.passiveEffectId);
      return isNightsoulBurstTriggered(def?.description);
    }).sort((a, b) => a.startTime - b.startTime);
    if (triggered.length > 0 && burstCd === undefined) {
      const first = triggered[0];
      const ch = characterMap.get(first.characterId);
      validationIssues.push({
        id: `nightsoul_burst_none_${first.id}`,
        severity: 'warning',
        characterId: first.characterId,
        stintId: first.stintId,
        time: first.startTime,
        title: t('messages:rotation.noNightsoulBurstTitle', { name: charName(ch) }),
        message: t('messages:rotation.noNightsoulBurst'),
      });
    } else if (triggered.length > 0 && burstCd !== undefined) {
      let anchor = -Infinity;
      for (const sp of triggered) {
        if (sp.startTime - anchor < 0.05) continue; // 同じ夜魂バースト
        const gap = sp.startTime - anchor;
        if (gap < burstCd - 0.001) {
          const remaining = Number((burstCd - gap).toFixed(2));
          for (const same of triggered.filter(t => Math.abs(t.startTime - sp.startTime) < 0.05)) {
            same.hasCTViolation = true;
            same.collisionRemainingCT = Math.max(same.collisionRemainingCT ?? 0, remaining);
          }
          const ch = characterMap.get(sp.characterId);
          validationIssues.push({
            id: `nightsoul_burst_ct_${sp.id}`,
            severity: 'warning',
            characterId: sp.characterId,
            stintId: sp.stintId,
            time: sp.startTime,
            title: t('messages:rotation.nightsoulIntervalTitle', { name: charName(ch) }),
            message: t('messages:rotation.nightsoulInterval', { action: sp.name, remaining, count: natlan, interval: burstCd }),
          });
        } else {
          anchor = sp.startTime;
        }
      }
    }
  }
}
