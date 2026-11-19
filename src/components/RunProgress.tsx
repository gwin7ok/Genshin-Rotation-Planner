import React, { useEffect, useState } from 'react';
import { t, currentLanguage, dotMark } from '../i18n';

/** 秒数を「m分ss秒」（英語は m:ss）にする */
export const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return currentLanguage === 'en' ? `${m}:${String(s).padStart(2, '0')}` : m > 0 ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`;
};

/** 実行の進み具合（塊 = 同時に実行する種のまとまり）。残り時間は、塊の平均時間 × 残りの塊の数で出す */
export interface ChunkProgress {
  chunksDone: number;
  /** 残りの塊の数の見積り（最小〜最大。幅が無いときは同じ値） */
  chunksLeftLow: number;
  chunksLeftHigh: number;
}

/**
 * 実行中の表示: 「段階の名前・経過時間・残り時間」。チャージ効率計算と、足りているかの確認で共通。
 * 経過時間は、この部品の中で 1 秒ごとに更新する
 */
export function RunProgress({ label, startedAt, progress }: { label: string; startedAt: number | null; progress: ChunkProgress | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const text = (() => {
    if (startedAt === null) return null;
    const elapsed = Math.max(0, now - startedAt);
    if (!progress || progress.chunksDone < 2 || elapsed < 5000) return t('gcsim:er.elapsedRunningNoEstimate', { elapsed: formatDuration(elapsed) });
    const perChunk = elapsed / progress.chunksDone;
    const low = progress.chunksLeftLow * perChunk;
    const high = progress.chunksLeftHigh * perChunk;
    if (high < 4000) return t('gcsim:er.elapsedRunningSoon', { elapsed: formatDuration(elapsed) });
    const mid = (low + high) / 2;
    return high - low < Math.max(8000, mid * 0.25)
      ? t('gcsim:er.elapsedRunning', { elapsed: formatDuration(elapsed), remaining: formatDuration(mid) })
      : t('gcsim:er.elapsedRunningRange', { elapsed: formatDuration(elapsed), low: formatDuration(low), high: formatDuration(high) });
  })();
  return (
    <span className="text-xs text-slate-300" data-testid="run-progress">
      {label}
      {text !== null && `${dotMark}${text}`}
    </span>
  );
}
