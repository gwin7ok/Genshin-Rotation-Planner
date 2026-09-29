import React, { useEffect, useState } from 'react';
import { X, Check, AlertTriangle, Copy, ShieldCheck, Loader2, Play } from 'lucide-react';
import type { GcsimConfigResult } from '../utils/gcsim/buildGcsimConfig';
import { validateGcsimConfig, runGcsimSample, type GcsimValidateResult } from '../utils/gcsim/gcsimClient';
import { readGcsimLog, type GcsimLogSummary } from '../utils/gcsim/readGcsimLog';
import { loadKeyCatalog } from '../utils/gcsim/keyCatalogLookup';
import { GcsimLogSummaryView } from './GcsimLogSummaryView';

/** 実行の乱数の種（祭礼リセットの種の探索は 6-4） */
const DEFAULT_SEED = 1;

interface GcsimConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: GcsimConfigResult | null;
  /** クリップボードへのコピーに成功したか */
  copied: boolean;
  onCopyAgain: () => void;
  /** アプリ自身のCT違反（スキル・爆発・発動バフ）。無ければ空 */
  ctIssues: { id: string; title: string; message: string }[];
}

/** 「gcsim設定文をコピー」の結果（設定文と警告）を表示するポップアップ */
export const GcsimConfigDialog: React.FC<GcsimConfigDialogProps> = ({ isOpen, onClose, result, copied, onCopyAgain, ctIssues }) => {
  // gcsim サーバーでの文法チェック（/validate）の結果
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<GcsimValidateResult | null>(null);
  // gcsim の実行結果の読み取り（6-2 の確認用。書き戻しはしない）
  const [running, setRunning] = useState(false);
  const [runOutcome, setRunOutcome] = useState<
    | { status: 'ok'; summary: GcsimLogSummary; seed: number; gcsimCommit?: string }
    | { status: 'error' | 'unreachable'; message: string }
    | null
  >(null);

  // ポップアップを開き直す・設定文が変わったら、前回のチェック結果を消す
  useEffect(() => {
    setValidation(null);
    setValidating(false);
    setRunOutcome(null);
    setRunning(false);
  }, [isOpen, result?.config]);

  if (!isOpen || !result) return null;

  const handleValidate = async () => {
    const target = result.config;
    setValidating(true);
    setValidation(null);
    const res = await validateGcsimConfig(target);
    setValidating(false);
    setValidation(res);
  };
  const handleRun = async () => {
    setRunning(true);
    setRunOutcome(null);
    const res = await runGcsimSample(result.config, DEFAULT_SEED);
    if (res.status !== 'ok') {
      setRunning(false);
      setRunOutcome({ status: res.status, message: res.message });
      return;
    }
    const catalog = await loadKeyCatalog();
    const summary = readGcsimLog(res.logs, { members: result.members, lookup: catalog.lookup, initialCharacterKey: res.initialCharacter });
    setRunning(false);
    setRunOutcome({ status: 'ok', summary, seed: res.seed, gcsimCommit: catalog.gcsimCommit });
  };
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

          {/* アプリ自身のCT違反（ガントチャートの判定と同じ） */}
          <div className="space-y-1.5">
            {ctIssues.length === 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                <Check className="w-4 h-4" />
                <span>アプリのCT違反: なし</span>
              </div>
            ) : (
              <>
                <div className="text-[11px] font-bold text-red-300">アプリのCT違反: {ctIssues.length}件（先に解消してください）</div>
                {ctIssues.map(issue => (
                  <div key={issue.id} className="flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border bg-red-950/50 border-red-800/70 text-red-200">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span><span className="font-bold">{issue.title}</span>: {issue.message}</span>
                  </div>
                ))}
              </>
            )}
            <div className="text-[10px] text-slate-500">
              ※ アプリ自身の判定です。gcsim で実際に実行したときのCT待ち（アプリの判定と一致しないことがあります）は、今後の gcsim 実行機能で確認できるようにします。
            </div>
          </div>

          {/* 文法チェック（gcsim ローカルサーバーの /validate） */}
          <div className="space-y-1.5">
            <button
              onClick={handleValidate}
              disabled={validating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white border border-emerald-500/60"
              title="gcsim ローカルサーバー（localhost:54321）で、この設定文の文法をチェックします（実行はしません）"
            >
              {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>{validating ? 'チェック中...' : 'gcsim で文法チェック'}</span>
            </button>
            {validation && (
              <div
                className={`text-xs rounded-lg px-2.5 py-1.5 border whitespace-pre-wrap break-words ${
                  validation.status === 'ok'
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                    : validation.status === 'invalid'
                    ? 'bg-red-950/50 border-red-800/70 text-red-200'
                    : 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                }`}
              >
                {validation.status === 'invalid' && <div className="font-bold mb-0.5">文法エラー</div>}
                {validation.message}
              </div>
            )}
          </div>

          {/* gcsim の実行と読み取り結果（6-2 の確認用） */}
          <div className="space-y-1.5">
            <button
              onClick={handleRun}
              disabled={running || !result.runnable}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-700/80 hover:bg-sky-600 disabled:opacity-50 text-white border border-sky-500/60"
              title={result.runnable ? 'gcsim ローカルサーバーでこの設定文を1回実行し、ログの読み取り結果を表示します（アプリの値は書き換えません）' : '実行できない要素があります（上の赤い警告を解消してください）'}
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>{running ? '実行中...' : 'gcsim で実行して読み取り結果を見る'}</span>
            </button>
            {runOutcome && runOutcome.status !== 'ok' && (
              <div
                className={`text-xs rounded-lg px-2.5 py-1.5 border whitespace-pre-wrap break-words ${
                  runOutcome.status === 'error'
                    ? 'bg-red-950/50 border-red-800/70 text-red-200'
                    : 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                }`}
              >
                {runOutcome.status === 'error' && <div className="font-bold mb-0.5">gcsim の実行エラー</div>}
                {runOutcome.message}
              </div>
            )}
            {runOutcome && runOutcome.status === 'ok' && (
              <GcsimLogSummaryView summary={runOutcome.summary} members={result.members} seed={runOutcome.seed} gcsimCommit={runOutcome.gcsimCommit} />
            )}
          </div>

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
