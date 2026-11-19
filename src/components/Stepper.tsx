import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { RepeatButton } from './RepeatButton';

/** 数の入力。右の上下ボタンで step ずつ増減する（長押しで連続して増減し、長く押すほど大きく動く）（範囲内に収める）。decimals を指定すると、小数 decimals 桁（x.x など）にそろえて表示する */
export const Stepper: React.FC<{
  value: string;
  onChange: (v: string) => void;
  step: number;
  min?: number;
  max?: number;
  decimals?: number;
  disabled?: boolean;
  widthClass: string;
  /** 入力に誤りがあるとき、枠を赤くする */
  invalid?: boolean;
  testId?: string;
}> = ({ value, onChange, step, min, max, decimals, disabled, widthClass, invalid, testId }) => {
  const fmt = (n: number) => decimals === undefined ? String(n) : n.toFixed(decimals);
  const move = (dir: 1 | -1, multiplier = 1) => {
    const cur = Number(value);
    const next = (Number.isFinite(cur) ? cur : 0) + dir * step * multiplier;
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next));
    onChange(fmt(Math.round(clamped * 1000) / 1000));
  };
  return (
    <span className="inline-flex items-stretch">
      <input
        type="number" min={min} max={max} step={step} value={value} disabled={disabled}
        data-testid={testId}
        onChange={e => onChange(e.target.value)}
        onBlur={() => { const n = Number(value); if (decimals !== undefined && value !== '' && Number.isFinite(n)) onChange(fmt(n)); }}
        className={`${widthClass} bg-slate-800 border ${invalid ? 'border-red-500' : 'border-slate-700'} rounded-l px-1.5 py-0.5 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <span className="flex flex-col border border-l-0 border-slate-700 rounded-r overflow-hidden">
        <RepeatButton onStep={m => move(1, m)} disabled={disabled} title="" className="flex-1 px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 flex items-center select-none"><ChevronUp className="w-3 h-3" /></RepeatButton>
        <RepeatButton onStep={m => move(-1, m)} disabled={disabled} title="" className="flex-1 px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 flex items-center border-t border-slate-700 select-none"><ChevronDown className="w-3 h-3" /></RepeatButton>
      </span>
    </span>
  );
};
