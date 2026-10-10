import React, { useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

/** 「gcsim で計算」の結果の表示（実行中・成功・警告・エラー。D120）。詳細は、押すと開く */
export interface GcsimComputeBannerState {
  level: 'running' | 'success' | 'warn' | 'error';
  title: string;
  message?: string;
  details?: string[];
}

export const GcsimComputeBanner: React.FC<{ state: GcsimComputeBannerState | null; onClose: () => void }> = ({ state, onClose }) => {
  const [open, setOpen] = useState(false);
  if (!state) return null;
  const style =
    state.level === 'success' ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-100'
    : state.level === 'warn' ? 'bg-amber-950/50 border-amber-700/60 text-amber-100'
    : state.level === 'error' ? 'bg-red-950/50 border-red-800/70 text-red-100'
    : 'bg-sky-950/50 border-sky-700/60 text-sky-100';
  const Icon = state.level === 'success' ? CheckCircle2 : state.level === 'warn' ? AlertTriangle : state.level === 'error' ? XCircle : Loader2;
  return (
    <div className={`mx-auto max-w-[1600px] my-2 px-3 py-2 rounded-lg border text-xs ${style}`} data-testid="gcsim-compute-banner">
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${state.level === 'running' ? 'animate-spin' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="font-bold">{state.title}</div>
          {state.message && <div className="whitespace-pre-wrap break-words mt-0.5">{state.message}</div>}
          {state.details && state.details.length > 0 && (
            <>
              <button type="button" className="mt-1 underline text-[11px]" onClick={() => setOpen(v => !v)}>
                {open ? '詳細を閉じる' : `詳細（${state.details.length} 行）`}
              </button>
              {open && (
                <div className="mt-1 font-mono text-[11px] max-h-48 overflow-y-auto space-y-0.5 opacity-90">
                  {state.details.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              )}
            </>
          )}
        </div>
        {state.level !== 'running' && (
          <button type="button" onClick={onClose} className="shrink-0 p-0.5 rounded hover:bg-black/20" title="閉じる">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
