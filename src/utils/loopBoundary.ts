import { CharacterConfig, Stint } from '../types/genshin';
import { calculateRotation } from './rotationCalculator';

/**
 * ループ基準（2周目ループの開始位置）は「何番目の出場キャラの前か」を 0 始まりの番号で持つ。
 *   0      : 基準なし（先頭から全周同一）
 *   k (≥1) : k+1 番目の出場キャラの前。k 番目以降（0 始まり）の出場キャラが 2周目ループの対象
 *
 * 旧データ（秒数 loopStartTime のみ）は、一番近い出場キャラの境目の番号に変換する。
 */
export function resolveLoopStartIndex(
  source: { loopStartIndex?: number; loopStartTime?: number },
  characters: CharacterConfig[],
  stints: Stint[],
  options: { switchDelay?: number; actionDelay?: number },
): number {
  if (typeof source.loopStartIndex === 'number') {
    return normalizeLoopStartIndex(source.loopStartIndex, stints.length);
  }

  const legacyTime = source.loopStartTime ?? 0;
  if (!(legacyTime > 0) || stints.length < 2) return 0;

  const calculated = calculateRotation(characters, stints, {
    switchDelay: options.switchDelay ?? 0.5,
    actionDelay: options.actionDelay ?? 0.1,
  }).calculatedStints;

  let bestIndex = 0;
  let bestDiff = Math.abs(legacyTime);
  calculated.forEach((s, i) => {
    if (i === 0) return;
    const diff = Math.abs((s.startTime ?? 0) - legacyTime);
    if (diff < bestDiff) {
      bestIndex = i;
      bestDiff = diff;
    }
  });
  return bestIndex;
}

/** 出場キャラの数を超えた番号は基準解除（0）にする */
export function normalizeLoopStartIndex(index: number, stintCount: number): number {
  const i = Math.floor(index);
  return i > 0 && i < stintCount ? i : 0;
}
