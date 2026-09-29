import React from 'react';
import { X, Check, AlertTriangle, Copy } from 'lucide-react';
import type { GcsimConfigResult } from '../utils/gcsim/buildGcsimConfig';

interface GcsimConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: GcsimConfigResult | null;
  /** クリップボードへのコピーに成功したか */
  copied: boolean;
  onCopyAgain: () => void;
}

/** 「gcsim設定文をコピー」の結果（設定文と警告）を表示するポップアップ */
export const GcsimConfigDialog: React.FC<GcsimConfigDialogProps> = ({ isOpen, onClose, result, copied, onCopyAgain }) => {
  if (!isOpen || !result) return null;
  const errors = result.warnings.filter(w => w.level === 'error');
  const warns = result.warnings.filter(w => w.level === 'warn');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h3 className="font-bold text-base text-white">gcsim 設定文</h3>
            <p className="text-[11px] text-slate-400">
              {copied ? 'クリップボードにコピーしました' : 'コピーできませんでした。下の文をコピーしてください'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {result.warnings.length === 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-300">
              <Check className="w-4 h-4" />
              <span>警告はありません</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {errors.length > 0 && (
                <div className="text-[11px] font-bold text-red-300">
                  gcsim で実行できない要素があります（設定文はできる範囲で出力しています）
                </div>
              )}
              {[...errors, ...warns].map((w, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border ${
                    w.level === 'error'
                      ? 'bg-red-950/50 border-red-800/70 text-red-200'
                      : 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          <textarea
            readOnly
            value={result.config}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full h-72 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400 resize-y"
          />
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={onCopyAgain}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>もう一度コピー</span>
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
