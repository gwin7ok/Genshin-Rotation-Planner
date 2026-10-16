import { StockSpan } from '../../types/genshin';

/** スキルのストック（積まれている CT の数 = size の変化）の記録。時刻順（2 周分の時間軸） */
export interface StockLog {
  charId: string;
  max: number;
  points: Array<[number, number]>;
}

/**
 * ストックの記録 → 区間（StockSpan）。ストック = 最大回数 − 積まれている CT の数（0 未満にはしない）。
 * 1 周目: 時間 0〜1 周目の終わり（出場しているかに関わらず決まる数。最初は満タン）。
 * 2 周目: 1 周目の終わりの状態から続けて、ループ 1 周分（表示位置は、ループ先頭 + (時刻 − 1 周目の終わり)）。ループの無い編成は 1 周目だけ。
 * 数が同じ区間は 1 本にまとめ、0 の区間・長さ 0 の区間は出さない
 */
export function buildStockSpans(logs: StockLog[], totalDuration: number, loopStartTime: number, loopPeriod: number): StockSpan[] {
  const out: StockSpan[] = [];
  const hasLoop = loopPeriod > 0.05;
  for (const log of logs) {
    const pts = [...log.points].sort((a, b) => a[0] - b[0]);
    const countAt = (size: number) => Math.max(0, log.max - size);
    // 区間の列（[開始, 終了, 数]）。最初は満タン
    const steps: Array<[number, number, number]> = [];
    let from = -Infinity;
    let count = log.max;
    for (const [t, size] of pts) {
      steps.push([from, t, count]);
      from = t;
      count = countAt(size);
    }
    steps.push([from, Infinity, count]);
    const lapSpans = (lap: 1 | 2, w0: number, w1: number, shift: number) => {
      const spans: StockSpan[] = [];
      for (const [s0, s1, c] of steps) {
        const a = Math.max(s0, w0);
        const b = Math.min(s1, w1);
        if (c <= 0 || b - a < 0.001) continue;
        const last = spans[spans.length - 1];
        if (last && last.count === c && Math.abs(last.endTime - (a + shift)) < 0.001) last.endTime = Number((b + shift).toFixed(3));
        else spans.push({ id: '', characterId: log.charId, lap, startTime: Number((a + shift).toFixed(3)), endTime: Number((b + shift).toFixed(3)), count: c, max: log.max });
      }
      return spans;
    };
    // ストックは、出場しているかに関わらず決まる数なので、1 周目の先頭（時間 0）から出す
    const lap1 = lapSpans(1, 0, totalDuration, 0);
    // 2 周目: ループの区間の発動があるキャラだけ（記録が 1 周目の終わりを過ぎている）
    const lap2 = hasLoop && pts.some(([t]) => t >= totalDuration - 1e-6) ? lapSpans(2, totalDuration, totalDuration + loopPeriod, loopStartTime - totalDuration) : [];
    [...lap1, ...lap2].forEach((s, i) => out.push({ ...s, id: `stock_${log.charId}_${s.lap}_${i}` }));
  }
  return out;
}
