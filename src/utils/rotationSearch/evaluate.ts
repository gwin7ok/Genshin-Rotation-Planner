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
import { mapAction } from '../gcsim/actionMapping';
import { CHARGE_REQUIRES_ATTACK } from '../gcsim/chargeRules';
import { CT_WARNING_ISSUE_PATTERN } from '../ctMarks';

/**
 * 重撃の直前が通常攻撃でない並び（gcsim は実行エラーにする）があるか。buildGcsimConfig の検査と同じ規則を、gcsim に渡す前に見る。
 * 初動 → ループ → ループ（2 周）の順に、直前の動作を追う
 */
export function chargeViolation(characters: CharacterConfig[], stints: Candidate['stints'], loopStartIndex: number): boolean {
  const sequence = [...stints.slice(0, loopStartIndex), ...stints.slice(loopStartIndex), ...stints.slice(loopStartIndex)];
  let prev = 'none';
  let prevCharId: string | undefined;
  for (const stint of sequence) {
    const c = characters.find(x => x.id === stint.characterId);
    if (!c) continue;
    if (prevCharId !== undefined && prevCharId !== stint.characterId) prev = 'swap';
    prevCharId = stint.characterId;
    const needs = CHARGE_REQUIRES_ATTACK.has(c.source?.gcsimKey ?? '');
    for (const act of stint.actions) {
      if (act.type === 'swap' || act.actionTypeId === 'action_switch_char' || act.type === 'wait') continue;
      const command = act.gcsimCommand ?? mapAction(act.actionTypeId, c.weaponType).command;
      if (!command) continue;
      const base = command.replace(/\[.*$/, '');
      if (base === 'charge' && needs && prev !== 'attack' && !(c.source?.gcsimKey === 'iansan' && prev === 'skill')) return true;
      prev = base;
    }
  }
  return false;
}

/** 周回の長さが、全体に対してこの割合に満たない並びは捨てる */
const MIN_LOOP_RATIO = 0.5;

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
  /** 非同期実行時にメインスレッドを譲る間隔（候補数。既定 150） */
  yieldChunkSize?: number;
  /** 中断チェック */
  shouldCancel?: () => boolean;
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

function evaluateOne(
  candidate: Candidate,
  characters: CharacterConfig[],
  weight: number,
  options: ScoreOptions,
): { scored?: ScoredCandidate; rejectedKey?: string } {
  const result = calculateRotation(characters, candidate.stints, { switchDelay: options.switchDelay ?? 0.5, loopStartIndex: candidate.loopStartIndex ?? 0, defHalt: options.defHalt ?? true });
  // 前提条件（マスターデータの sequenceRules）を満たさない並びは、gcsim で実行できないので、測る前に捨てる
  const pre = prerequisiteViolations(candidate.stints, id => characters.find(c => c.id === id)?.element);
  if (pre.length > 0) {
    const key = `${characters.find(c => c.id === pre[0].rule.characterId)?.name ?? ''}: ${pre[0].rule.resource}が無いのに使っている`;
    return { rejectedKey: key };
  }
  // 周回の部分が短すぎる並び（初動で全部のバフ・爆発を使い切り、周回は通常攻撃 1 回だけなど）は、繰り返せるローテーションではない。
  // 画面の DPS 計算（初動 + 周回）では、初動の爆発が薄まらず、DPS が高く出てしまう。周回が全体の半分に満たないものは捨てる
  if ((candidate.loopStartIndex ?? 0) > 0 && result.totalDuration > 0 && result.loopPeriod < result.totalDuration * MIN_LOOP_RATIO) {
    return { rejectedKey: '周回の部分が短すぎる' };
  }
  if (chargeViolation(characters, result.calculatedStints, candidate.loopStartIndex ?? 0)) {
    return { rejectedKey: '重撃の直前が通常攻撃でない' };
  }
  // 捨てるのは、CT 違反（スキル・爆発の CT 中の使用）と、gcsim で実行エラーになる警告（落下攻撃の前提不足・ゲージ不足・未対応アクション・モード中の禁止操作）。
  // 画面の「CT 警告」のうち、発動バフの内部 CT（passive_ct_）や特殊スキルの受付時間外（special_window_）など gcsim の計算が止まらないものは、捨てる理由にしない
  const isGcsimFatalWarning = (id: string) =>
    id.startsWith('plunge_prereq_') || id.startsWith('mode_gauge_') || id.startsWith('gcsim_unsupported_') || id.startsWith('mode_blocked_') || id.startsWith('mode_blocks_');
  const fatalWarning = result.validationIssues.find(v => isGcsimFatalWarning(v.id));
  if (fatalWarning) {
    return { rejectedKey: fatalWarning.title };
  }
  // 設置物の位置を動かすだけのスキル再発動（フィッシュルのオズ再配置など）は、探索では無意味な別出場を増やすだけなので捨てる
  if (result.calculatedStints.some(s => s.actions.some(a => a.gcsimCommand === 'skill[recast=1]' || a.actionTypeId === '10000031-electro_e_recast'))) {
    return { rejectedKey: '設置物の位置直しのみのスキル再発動' };
  }
  // タルタリヤの近接モード（E）中は弓の狙い撃ち（ca / aim）が実行できない
  for (const s of result.calculatedStints) {
    if (s.characterId !== '10000033-hydro') continue;
    let inMelee = false;
    for (const a of s.actions) {
      if (a.actionTypeId === '10000033-hydro_e') inMelee = !inMelee;
      else if (inMelee && a.actionTypeId === '10000033-hydro_ca') {
        return { rejectedKey: 'タルタリヤ: 近接モード中の狙い撃ち' };
      }
    }
  }
  // 放浪者の低空落下（lp）は、浮遊モード終了（同出場内の 2 回目の E）の直後、またはジャンプ直後のみ
  for (const s of result.calculatedStints) {
    if (s.characterId !== '10000075-anemo') continue;
    let skillCount = 0;
    let prevReal: string | undefined;
    for (const a of s.actions) {
      if (a.type === 'swap' || a.actionTypeId === 'action_switch_char' || a.type === 'wait') continue;
      if (a.actionTypeId === '10000075-anemo_e') skillCount++;
      else if (a.actionTypeId === '10000075-anemo_lp' && prevReal !== '10000075-anemo_jump' && !(skillCount >= 2 && prevReal === '10000075-anemo_e')) {
        return { rejectedKey: '放浪者: 浮遊終了後以外の低空落下' };
      }
      prevReal = a.actionTypeId;
    }
  }
  const bad = result.validationIssues.filter(v => v.severity !== 'info' && !CT_WARNING_ISSUE_PATTERN.test(v.id) && !v.id.startsWith('passive_ct_'));
  const isCt = (id: string) => id.startsWith('skill_ct_') || id.startsWith('burst_ct_');
  if (bad.length > (options.maxCtIssues ?? 0) || (bad.length > 0 && bad.some(v => !isCt(v.id)))) {
    return { rejectedKey: bad[0].title };
  }
  const attackerIds = new Set(Object.entries(candidate.assignment).filter(([, r]) => r === 'attacker').map(([id]) => id));
  const s = simpleScore(result, attackerIds, weight);
  return { scored: { candidate, totalSeconds: result.totalDuration, ...s, score: s.score * 0.93 ** bad.length, ctIssues: bad.length } };
}

/** 候補を、アプリの計算に通し、CT 違反などがあるものを捨て、簡易スコアをつける（同期版） */
export function evaluateCandidates(characters: CharacterConfig[], candidates: Candidate[], options: ScoreOptions = {}): EvaluateResult {
  const weight = options.overlapWeight ?? 0.25;
  const scored: ScoredCandidate[] = [];
  const rejectedBy: Record<string, number> = {};
  let rejected = 0;
  for (const candidate of candidates) {
    const res = evaluateOne(candidate, characters, weight, options);
    if (res.rejectedKey) {
      rejected++;
      rejectedBy[res.rejectedKey] = (rejectedBy[res.rejectedKey] ?? 0) + 1;
    } else if (res.scored) {
      scored.push(res.scored);
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return { scored, rejected, rejectedBy };
}

/** 候補を評価する非同期版（一定件数ごとにメインスレッドを譲り、UI のホバーや描画を滑らかに保つ） */
export async function evaluateCandidatesAsync(characters: CharacterConfig[], candidates: Candidate[], options: ScoreOptions = {}): Promise<EvaluateResult> {
  const weight = options.overlapWeight ?? 0.25;
  const chunkSize = options.yieldChunkSize ?? 150;
  const scored: ScoredCandidate[] = [];
  const rejectedBy: Record<string, number> = {};
  let rejected = 0;
  let last = performance.now();
  for (let i = 0; i < candidates.length; i++) {
    // 件数ではなく経過時間（約 40ms）で譲る（1 件が重くても固まらない）
    if (i > 0 && (i % Math.max(1, Math.floor(chunkSize / 10)) === 0) && performance.now() - last > 40) {
      await new Promise<void>(resolve => { setTimeout(resolve, 0); });
      last = performance.now();
      if (options.shouldCancel?.()) break;
    }
    const res = evaluateOne(candidates[i], characters, weight, options);
    if (res.rejectedKey) {
      rejected++;
      rejectedBy[res.rejectedKey] = (rejectedBy[res.rejectedKey] ?? 0) + 1;
    } else if (res.scored) {
      scored.push(res.scored);
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return { scored, rejected, rejectedBy };
}
