import React from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Repeat, 
  Zap, 
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { ValidationIssue, CharacterConfig, CharacterRuntimeState } from '../types/genshin';

interface ValidationPanelProps {
  characters: CharacterConfig[];
  validationIssues: ValidationIssue[];
  characterStates: Record<string, CharacterRuntimeState>;
  loopStatus: {
    canLoopImmediately: boolean;
    longestRemainingCT: { characterName: string; type: 'skill' | 'burst'; remaining: number } | null;
  };
  totalDuration: number;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({
  characters,
  validationIssues,
  characterStates,
  loopStatus,
  totalDuration,
}) => {
  const errors = validationIssues.filter(v => v.severity === 'error');
  const warnings = validationIssues.filter(v => v.severity === 'warning');
  const infos = validationIssues.filter(v => v.severity === 'info');

  return (
    <section className="bg-slate-900/90 border-b border-slate-800 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
            ローテーション検証・エネルギー診断 (Validation &amp; Loop)
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
              errors.length === 0 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                : 'bg-red-500/20 text-red-300 border border-red-500/40'
            }`}>
              {errors.length === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {errors.length === 0 ? 'CT整合性クリア' : `CTエラー ${errors.length}件`}
            </span>

            <span className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
              loopStatus.canLoopImmediately
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}>
              <Repeat className="w-3.5 h-3.5" />
              {loopStatus.canLoopImmediately ? '即座に2周目ループ可能' : `2周目CT待ちあり`}
            </span>
          </div>
        </div>

        {/* 3 Column Grid: Loop & CT Status, Energy Sufficiency, Theorycraft Advice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          {/* Column 1: Rotation Loop & Cooldown Conflicts */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 mb-2">
              <Repeat className="w-4 h-4 text-amber-400" />
              <span>ループ性 (2周目の成立判定)</span>
            </div>

            {loopStatus.canLoopImmediately ? (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>2周目への即座移行が可能です</span>
                </div>
                <p className="text-[11px] text-emerald-300/80">
                  全キャラのスキル・爆発CTがローテーション完了時（{totalDuration.toFixed(1)}s）までに終了しており、無駄な待機なくループできます。
                </p>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{loopStatus.longestRemainingCT?.characterName}のCTが約 {loopStatus.longestRemainingCT?.remaining}秒残っています</span>
                </div>
                <p className="text-[11px] text-amber-300/80">
                  通常攻撃（N1〜N3）の追加や、バッテリー用のスキル発動を挟んでローテーション時間を約{loopStatus.longestRemainingCT?.remaining}秒延長するとスムーズになります。
                </p>
              </div>
            )}

            {/* Any Cooldown errors inside rotation */}
            {errors.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {errors.map((err, i) => (
                  <div key={i} className="p-2 rounded bg-red-950/60 border border-red-800/60 text-[11px] text-red-200">
                    <div className="font-bold flex items-center gap-1 text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{err.title} ({err.time.toFixed(1)}s)</span>
                    </div>
                    <p className="text-red-300/80 mt-0.5">{err.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column 3: Theorycrafting / Synergy Tips */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 mb-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>原神TC セオリー・最適化ポイント</span>
            </div>

            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li className="flex items-start gap-1.5 p-1.5 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="text-amber-400 font-bold">●</span>
                <span>
                  <strong>スナップショット:</strong> 香菱の旋火輪はベネット爆発の攻撃力バフを領域外に出ても14秒間維持します。必ずベネット爆発後に発動しましょう。
                </span>
              </li>
              <li className="flex items-start gap-1.5 p-1.5 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="text-sky-400 font-bold">●</span>
                <span>
                  <strong>自己粒子回収:</strong> 行秋は「Q → E」の順で撃つことで、Eで出た水粒子を行秋自身が出場状態で受けて爆発ゲージを急速充填できます。
                </span>
              </li>
              <li className="flex items-start gap-1.5 p-1.5 rounded bg-slate-900/60 border border-slate-800/80">
                <span className="text-emerald-400 font-bold">●</span>
                <span>
                  <strong>バッテリー運用:</strong> ベネットのE粒子を即座に香菱に交代して拾わせると、香菱の重い80族爆発を安定して回せます。
                </span>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
};
