import React, { useState } from 'react';
import { X, Copy, Check, FileText, Clock, Sparkles } from 'lucide-react';
import { CharacterConfig, Stint } from '../types/genshin';

interface RotationSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: CharacterConfig[];
  stints: Stint[];
  totalDuration: number;
}

export const RotationSummaryModal: React.FC<RotationSummaryModalProps> = ({
  isOpen,
  onClose,
  characters,
  stints,
  totalDuration,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const characterMap = new Map<string, CharacterConfig>();
  characters.forEach(c => characterMap.set(c.id, c));

  // Generate standard Genshin theorycraft rotation shorthand:
  // e.g. "行秋 [Q E E N1] ➔ ベネット [Q E] ➔ 香菱 [Q E] ➔ 雷電将軍 [Q 3N3C+N1C]"
  const rotationNotation = stints.map(stint => {
    const char = characterMap.get(stint.characterId);
    const charName = char ? char.name : 'Unknown';
    const nonSwapActions = stint.actions.filter(a => 
      a.type !== 'swap' && 
      a.shortName !== '交代' && 
      a.name !== 'キャラ交代' && 
      a.actionTypeId !== 'action_switch_char'
    );
    const actionStr = nonSwapActions.map(a => a.shortName).join(' ');
    return `${charName} [${actionStr}]`;
  }).join(' ➔ ');

  const handleCopy = () => {
    navigator.clipboard.writeText(rotationNotation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-white">
              ローテーション手順書 &amp; テキスト記法 (Cheat Sheet)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Notation Box */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ワンライナー記法 (SNS・共有用)</span>
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'コピーしました' : 'クリップボードにコピー'}</span>
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 font-mono text-xs text-amber-100 border border-slate-800 break-words leading-relaxed select-all">
              {rotationNotation}
            </div>

            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
              <span>想定ローテーション1周所要時間: <strong className="text-white font-mono">{totalDuration.toFixed(1)} 秒</strong></span>
              <span>合計出場ターン数: <strong className="text-white font-mono">{stints.length} 回</strong></span>
            </div>
          </div>

          {/* Detailed Step by Step Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>ステップ別タイムテーブル（秒単位）</span>
            </h4>

            <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden text-xs">
              {stints.map((stint, idx) => {
                const char = characterMap.get(stint.characterId);
                const startTime = (stint.startTime ?? 0).toFixed(2);
                const endTime = (stint.endTime ?? 0).toFixed(2);
                const duration = (stint.duration ?? 0).toFixed(2);

                return (
                  <div key={stint.id} className="p-3 flex items-start gap-3 hover:bg-slate-900/50">
                    <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-mono font-bold flex items-center justify-center shrink-0 text-[11px]">
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{char?.name}</span>
                          <span className="font-mono text-[11px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/50">
                            {startTime}s ~ {endTime}s ({duration}s)
                          </span>
                        </div>
                      </div>

                      {/* Actions List */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {stint.actions.map(act => (
                          <span 
                            key={act.id} 
                            className="px-2 py-0.5 rounded bg-slate-900 text-slate-200 border border-slate-700/80 font-medium text-[11px]"
                          >
                            <strong>{act.shortName}</strong>: {act.name} ({act.duration.toFixed(2)}s)
                          </span>
                        ))}
                      </div>

                      {/* Note */}
                      {stint.note && (
                        <p className="text-[11px] text-slate-400 mt-1.5 italic">
                          💡 {stint.note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
