import React from 'react';
import { X, ArrowUp, ArrowDown, GripVertical, CornerDownRight, CheckCircle2, Repeat, Sparkles, HelpCircle, Clock } from 'lucide-react';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                登場キャラの順番入れ替え・操作ガイド
              </h3>
              <p className="text-xs text-slate-400">
                原神ローテーション ガントチャートの基本操作と直列スナップ仕様
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          
          {/* Main Question Answered */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <h4 className="font-bold text-amber-300 text-sm flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              登場キャラの順番（ターン）を入れ替える3つの方法
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              出場順序エディター内の各キャラクター登場ブロックは、以下のいずれかの方法で自由に前後を入れ替えることができます。
            </p>

            <div className="mt-3 space-y-2.5">
              {/* Method 1 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="text-xs">
                  <span className="font-bold text-white">「▲ 上へ」「▼ 下へ」ボタンを押す（一番確実・簡単）</span>
                  <p className="text-slate-400 mt-0.5">
                    各キャラカードの左側にある <span className="inline-flex items-center text-amber-300 font-semibold px-1 py-0.5 bg-slate-800 rounded border border-slate-700">▲ 上へ</span> または <span className="inline-flex items-center text-amber-300 font-semibold px-1 py-0.5 bg-slate-800 rounded border border-slate-700">▼ 下へ</span> ボタンをクリックすると、1つ前または後ろの順番と即座に入れ替わります。
                  </p>
                </div>
              </div>

              {/* Method 2 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="text-xs">
                  <span className="font-bold text-white">クイック並び替えパイプラインを使う</span>
                  <p className="text-slate-400 mt-0.5">
                    エディター上部にある「登場順序クイックパイプライン」のチップに表示された <span className="inline-flex items-center text-amber-300 font-semibold px-1 py-0.5 bg-slate-800 rounded border border-slate-700">◀ 前へ</span> <span className="inline-flex items-center text-amber-300 font-semibold px-1 py-0.5 bg-slate-800 rounded border border-slate-700">次へ ▶</span> 矢印をクリックするか、チップ自体を左右にドラッグします。
                  </p>
                </div>
              </div>

              {/* Method 3 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="text-xs">
                  <span className="font-bold text-white">ドラッグ＆ドロップで掴んで移動</span>
                  <p className="text-slate-400 mt-0.5">
                    カード左端の <span className="inline-flex items-center text-amber-300 font-semibold px-1 py-0.5 bg-slate-800 rounded border border-slate-700">⠿ ドラッグ</span> つまみをマウスで長押ししながら、移動させたい位置まで上下にスライドします。
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Continuous Snap Explanation */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <CornerDownRight className="w-4 h-4 text-sky-400" />
              <span>順番を入れ替えたときの自動計算（直列スナップ）</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              原神ではフィールドに出られるキャラは常に1人のみです。本ツールでは順番を入れ替えると、<strong>「前のキャラの退場時刻」と「次のキャラの登場時刻」がミリ秒単位で完全に一致（重なりゼロ）</strong>するように全後続ブロックの開始・終了時刻が自動で垂直スナップします。
            </p>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
              <span className="text-amber-300">#1 雷電 (0.0s ~ 1.2s)</span>
              <span className="text-slate-500">➔ 交代 ➔</span>
              <span className="text-amber-300">#2 行秋 (1.2s ~ 4.4s)</span>
              <span className="text-slate-500">➔ ... ➔</span>
              <span className="text-amber-300">#5 雷電 (9.4s ~ 18.4s)</span>
            </div>
          </div>

          {/* Stint-by-Stint Waterfall Rows */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>同一キャラの複数回登場（行の分割表示・階段ウォーターフォール）</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              雷電ナショナルなどのように<strong>同じキャラが1ローテーション内で2回以上登場する場合（例: 始動Eと終盤爆発アタッカー）</strong>、ガントチャート上でも<strong>登場回数ごとに行が分かれて別々に下へと追加表示</strong>されます。
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              これにより、時間が進むにつれてブロックが右上から左下へと階段状に流れる直感的なウォーターフォールチャートになります。各行の <span className="text-sky-300 font-semibold">▲ / ▼</span> を押せば、その登場ターンの順番を直接上下に前後移動できます（右上のボタンで従来の「4キャラ集約（1人1行）」表示にもワンクリックで切り替え可能です）。
            </p>
          </div>

          {/* Party Lane Order (Swimlane) & Horizontal Sync */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-purple-400" />
              <span>「編成設定」やレーン並び替え時の横軸（タイムライン）連動機能</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              「編成設定」でスロットを <span className="text-amber-300 font-semibold">◀ 左へ / 右へ ▶</span> 入れ替えたり、ガントチャート左側の <span className="text-sky-300 font-semibold">▲ / ▼</span> ボタンでキャラの行を入れ替えると、<strong>縦軸の並び順だけでなく横軸の登場順序（タイムライン）も自動で連動してスワップ</strong>されます。
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              また、登場順序エディター上部または編成設定モーダル内の <span className="text-amber-300 font-semibold">「🔄 編成スロット順（1→2→3→4）に横軸を整列」</span> ボタンを押すと、現在のパーティ枠番順（1枠目→2枠目→3枠目→4枠目）に横軸の出場順を一括で揃えることができます。
            </p>
          </div>

          {/* CT and Effect Duration Color Scheme */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>「CT」と「効果持続時間」の直感的な統一カラー設計</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              ガントチャート上では、スキル／爆発別ではなく<strong>「CT（再使用待機中）」</strong>と<strong>「効果持続時間（バフ・設置物・追撃継続中）」</strong>の役割ごとに色を明確に統一しています。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-lg bg-sky-950/60 border border-sky-500/50 text-xs space-y-1">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-sky-500/40 border border-sky-400 inline-block"></span>
                  <span>CT（クールタイム）: 水色統一</span>
                </div>
                <p className="text-[11px] text-sky-200/80">
                  スキルCT・元素爆発CTともに共通で水色バーとして表示。技発動からの再使用待機カウントダウンがひと目で分かります。
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-xs space-y-1">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-400 inline-block"></span>
                  <span>効果持続時間: エメラルド緑統一</span>
                </div>
                <p className="text-[11px] text-emerald-200/80">
                  古華剣・旋火輪・素晴らしい旅・雷電Eなどのバフや設置物の有効時間が緑色バーとして統一表示されます。
                </p>
              </div>
            </div>
          </div>

          {/* Actions editing */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>ブロック内のアクション追加・微調整</span>
            </h4>
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside leading-relaxed">
              <li>カード右下の「+E」「+Q」「+N1」などのボタンを押すと、スキルや爆発を即座に追加できます。</li>
              <li>アクションの所要時間（0.5sなど）の横の「▲/▼」を押すと、0.1秒単位で実行フレームを微調整できます。</li>
              <li>アクションチップ内の「◀」「▶」を押すと、同一キャラ内の行動順（例: E→Q から Q→E）を変更できます。</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow"
          >
            理解しました（閉じる）
          </button>
        </div>
      </div>
    </div>
  );
};
