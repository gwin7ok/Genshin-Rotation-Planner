import { attackSpeedFor } from '../../masterdata/attackSpeedEffects';
import { CharacterConfig } from '../../types/genshin';
import { CharacterModel } from '../../models/CharacterModel';
import type { RotationState } from './state';
import type { RotationOptions } from './types';

/** 通常攻撃速度（gcsim の AtkSpd）。効果の表は masterdata/attackSpeedEffects.ts。アクションの開始時点の状態から、速度の合計を求める */
export const attackSpeedOfIn = (state: RotationState, options: RotationOptions | undefined, c: CharacterConfig, start: number, sIdx: number, previousNormal: { start: number; total: number; cancel: number } | undefined): number => {
  const { characters, burstStartByChar, burstSnapshotByChar, skillSnapshotByChar, hitlagTotalByChar, chargedStartByChar, skillStartByChar, normalsSinceSkillByChar, enterFieldByChar, hitTimesByChar } = state;
  const w = options?.database?.weapons.find(x => x.id === c.weaponId);
  // 聖遺物は、4 セットの効果が有効なとき（組み合わせが 2+2 でない）だけ
  const art = c.artifactSetMode === '2+2' ? undefined : options?.database?.artifacts?.find(x => x.id === c.artifactSetId);
  if (!w?.gcsimKey && !art?.gcsimKey && !c.source?.gcsimKey) return 0;
  const refine = w ? c.weaponRefinementRank ?? w.refinementRank ?? (w.rarity >= 5 ? 1 : 5) : 1;
  const burstAt = burstStartByChar.get(c.id);
  const chargedAt = chargedStartByChar.get(c.id);
  const skillAt = skillStartByChar.get(c.id);
  const hitlagNow = hitlagTotalByChar.get(c.id) ?? 0;
  const teamOwners = characters.filter(o => o.source?.gcsimKey).map(o => {
    const b = burstStartByChar.get(o.id);
    const s = skillStartByChar.get(o.id);
    const ow = options?.database?.weapons.find(x => x.id === o.weaponId);
    return {
      weaponKey: ow?.gcsimKey,
      refine: o.weaponRefinementRank ?? ow?.refinementRank ?? (ow && ow.rarity >= 5 ? 1 : 5),
      hitTimes: hitTimesByChar.get(o.id),
      characterKey: o.source!.gcsimKey as string,
      constellation: CharacterModel.fromConfig(o).constellation,
      secondsSinceBurst: b === undefined ? undefined : start - b.t,
      hitlagSinceBurst: b === undefined ? undefined : hitlagNow - (burstSnapshotByChar.get(o.id)?.get(c.id) ?? 0),
      secondsSinceSkill: s === undefined ? undefined : start - s.t,
      hitlagSinceSkill: s === undefined ? undefined : hitlagNow - (skillSnapshotByChar.get(o.id)?.get(c.id) ?? 0),
    };
  });
  return attackSpeedFor({
    teamOwners,
    weaponKey: w?.gcsimKey,
    artifactKey: art?.gcsimKey,
    characterKey: c.source?.gcsimKey,
    constellation: CharacterModel.fromConfig(c).constellation,
    weaponType: c.weaponType,
    refine,
    secondsSinceBurst: burstAt === undefined ? undefined : start - burstAt.t,
    burstInSameStint: burstAt?.sIdx === sIdx,
    hitlagSinceBurst: burstAt === undefined ? undefined : hitlagNow - burstAt.hitlag,
    secondsSinceSkill: skillAt === undefined ? undefined : start - skillAt.t,
    hitlagSinceSkill: skillAt === undefined ? undefined : hitlagNow - skillAt.hitlag,
    hitlagNow,
    normalAttacksSinceSkill: normalsSinceSkillByChar.get(c.id),
    enterFieldTimes: enterFieldByChar.get(c.id),
    hitTimes: hitTimesByChar.get(c.id),
    now: start,
    secondsSinceChargedAttack: chargedAt === undefined ? undefined : start - chargedAt,
    previousNormalAttack: previousNormal
      ? { animationFrames: previousNormal.total, cancelFrames: previousNormal.cancel, elapsedFrames: Math.round((start - previousNormal.start) * 60) }
      : undefined,
  });
};
