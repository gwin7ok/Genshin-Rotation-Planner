import React, { useEffect, useRef } from 'react';

/** 長押しの繰り返しの設定（待ち時間・間隔・加速・強制停止） */
const REPEAT_FIRST_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 80;
const REPEAT_MAX_HOLD_MS = 10000; // 押しっぱなしの検出もれがあっても、この時間で必ず止める
/** 繰り返した回数に応じた増減の倍率（長く押すほど大きく動く） */
const repeatMultiplier = (ticks: number) => (ticks < 15 ? 1 : ticks < 40 ? 5 : 10);

/**
 * 押している間、繰り返し実行するボタン（押した瞬間に1回、0.4秒後から0.08秒ごと）。
 * 実行する処理は毎回最新のもの（最新の値・状態）を使う。引数は増減の倍率（1 → 5 → 10 と長押しで加速）。
 * 暴走の防止: ①ポインタキャプチャで離した操作を必ず受ける ②window の離す・キャンセル・フォーカス喪失でも止める
 * ③ボタンが押されていない状態を検出したら止める ④前の処理が終わってから次を予約する（処理が積み重ならない）
 * ⑤最長 10 秒で強制停止
 */
export const RepeatButton: React.FC<{ onStep: (multiplier: number) => void; title: string; children: React.ReactNode; className?: string; disabled?: boolean }> = ({ onStep, title, children, className, disabled }) => {
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const timer = useRef<number | undefined>(undefined);
  const cleanup = useRef<(() => void) | null>(null);
  const stop = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    cleanup.current?.();
    cleanup.current = null;
  };
  useEffect(() => stop, []);

  const start = (target: HTMLButtonElement, pointerId: number) => {
    stop();
    const startedAt = performance.now();
    let ticks = 0;
    stepRef.current(1);
    try { target.setPointerCapture(pointerId); } catch { /* 取れなくても、window 側の保険で止める */ }
    const onRelease = () => stop();
    const onMove = (ev: PointerEvent) => { if (ev.buttons === 0) stop(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') stop(); };
    window.addEventListener('pointerup', onRelease, true);
    window.addEventListener('pointercancel', onRelease, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('blur', onRelease);
    document.addEventListener('visibilitychange', onVisibility);
    cleanup.current = () => {
      window.removeEventListener('pointerup', onRelease, true);
      window.removeEventListener('pointercancel', onRelease, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('blur', onRelease);
      document.removeEventListener('visibilitychange', onVisibility);
      try { target.releasePointerCapture(pointerId); } catch { /* すでに解放済み */ }
    };
    // setInterval ではなく、1 回ごとに次を予約する（処理が重くても、待ち行列に積み重ならない）
    const tick = () => {
      if (performance.now() - startedAt > REPEAT_MAX_HOLD_MS) { stop(); return; }
      stepRef.current(repeatMultiplier(ticks));
      ticks++;
      timer.current = window.setTimeout(tick, REPEAT_INTERVAL_MS);
    };
    timer.current = window.setTimeout(tick, REPEAT_FIRST_DELAY_MS);
  };

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={className ?? 'leading-none text-slate-400 hover:text-white text-[9px] hover:font-bold select-none'}
      onPointerDown={(e) => {
        if (e.button !== 0 || disabled) return;
        e.preventDefault(); // 入力欄のフォーカスを奪わない
        e.stopPropagation();
        start(e.currentTarget, e.pointerId);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          stepRef.current(1);
        }
      }}
    >
      {children}
    </button>
  );
};
