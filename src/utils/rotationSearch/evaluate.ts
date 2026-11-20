/**
 * ローテーション自動探索の、CT 違反の除去と簡易スコア（設計.md の ②③）。gcsim は使わない（アプリの時間計算だけ）。
 *
 * 簡易スコアは、正しさではなく足切り。多少外れても、次の段（gcsim の少ない回数の実行）が拾い直す。
 *   スコア = アタッカーの表の時間の割合 ×（1 + 重なりの重み × アタッカーの表の 1 秒あたりの、他のキャラの効果の重なった秒数）
 */
import { prerequisiteViolations } from '../../masterdata/sequenceRules';
import type { CharacterConfig } from '../../types/genshin';
import { calculateRotation, type CalculatedRotation } from '../rotationCalculator';
import type { Candidate } from './candidates';

export interface ScoreOptions {
  switchDelay?: number;
  defHalt?: boolean;
  /** 重なりの重み（既定 0.25） */
  overlapWeight?: number;
  /**
   * 許す CT 違反（スキル・爆発の CT 待ち）の数（既定 0 = 1 件でもあれば捨てる）。
   * gcsim は CT が明けるまで待ってから動くので、待ちを含む形も実測の DPS は正しく出る（手で組んだ例にも、周回の継ぎ目で CT 待ちが出るものがある）。
   * 許した候補は、違反 1 件につき簡易スコアを 7% 下げて並べる
   */
  maxCtIssues?: number;
}

export interface ScoredCandidate {
  candidate: Candidate;
  /** アプリの計算でのローテーションの長さ（秒） */
  totalSeconds: number;
  attackerFraction: number;
  /** アタッカーの表の 1 秒あたりの、他のキャラの効果の重なった秒数 */
  overlapPerSecond: number;
  score: number;
  /** 許した CT 違反の数 */
  ctIssues: number;
}

export interface EvaluateResult {
  scored: ScoredCandidate[];
  /** CT 違反などで捨てた数 */
  rejected: number;
  /** 捨てた理由の内訳（検証の見出し → 件数） */
  rejectedBy: Record<string, number>;
}

const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** 1 候補の簡易スコア（計算結果から） */
export function simpleScore(result: CalculatedRotation, attackerIds: Set<string>, overlapWeight: number): { attackerFraction: number; overlapPerSecond: number; score: number } {
  const windows = result.calculatedStints.filter(s => attackerIds.has(s.characterId)).map(s => [s.startTime ?? 0, s.endTime ?? 0] as const);
  const attackerTime = windows.reduce((sum, [a, b]) => sum + Math.max(0, b - a), 0);
  const total = Math.max(0.01, result.totalDuration);
  let overlapSeconds = 0;
  for (const b of result.activeBuffs) {
    if (attackerIds.has(b.sourceCharacterId) || b.noSynergy) continue;
    for (const [w0, w1] of windows) overlapSeconds += overlap(b.startTime, b.endTime, w0, w1);
  }
  for (const p of result.passiveSpans) {
    if (attackerIds.has(p.characterId)) continue;
    for (const [w0, w1] of windows) overlapSeconds += overlap(p.startTime, p.endTime, w0, w1);
  }
  const overlapPerSecond = attackerTime > 0 ? overlapSeconds / attackerTime : 0;
  const attackerFraction = attackerTime / total;
  return { attackerFraction, overlapPerSecond, score: attackerFraction * (1 + overlapWeight * overlapPerSecond) };
}

/** 候補を、アプリの計算に通し、CT 違反などがあるものを捨て、簡易スコアをつける */
export function evaluateCandidates(characters: CharacterConfig[], candidates: Candidate[], options: ScoreOptions = {}): EvaluateResult {
  const weight = options.overlapWeight ?? 0.25;
  const scored: ScoredCandidate[] = [];
  const rejectedBy: Record<string, number> = {};
  let rejected = 0;
  for (const candidate of candidates) {
    const result = calculateRotation(characters, candidate.stints, { switchDelay: options.switchDelay ?? 0.5, loopStartIndex: candidate.loopStartIndex ?? 0, defHalt: options.defHalt ?? true });
    // 前提条件（マスターデータの sequenceRules）を満たさない並びは、gcsim で実行できないので、測る前に捨てる
    const pre = prerequisiteViolations(candidate.stints, id => characters.find(c => c.id === id)?.element);
    if (pre.length > 0) {
      rejected++;
      const key = `${characters.find(c => c.id === pre[0].rule.characterId)?.name ?? ''}: ${pre[0].rule.resource}が無いのに使っている`;
      rejectedBy[key] = (rejectedBy[key] ?? 0) + 1;
      continue;
    }
    const bad = result.validationIssues.filter(v => v.severity !== 'info');
    const isCt = (id: string) => id.startsWith('skill_ct_') || id.startsWith('burst_ct_');
    if (bad.length > (options.maxCtIssues ?? 0) || (bad.length > 0 && bad.some(v => !isCt(v.id)))) {
      rejected++;
      const key = bad[0].title;
      rejectedBy[key] = (rejectedBy[key] ?? 0) + 1;
      continue;
    }
    const attackerIds = new Set(Object.entries(candidate.assignment).filter(([, r]) => r === 'attacker').map(([id]) => id));
    const s = simpleScore(result, attackerIds, weight);
    scored.push({ candidate, totalSeconds: result.totalDuration, ...s, score: s.score * 0.93 ** bad.length, ctIssues: bad.length });
  }
  scored.sort((a, b) => b.score - a.score);
  return { scored, rejected, rejectedBy };
}
