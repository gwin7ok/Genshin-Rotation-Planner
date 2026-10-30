import React, { useEffect, useRef, useState } from 'react';
import { X, Zap, Play, Square, AlertTriangle } from 'lucide-react';
import { t, dateLocale } from '../i18n';
import { charName } from '../i18n/loc';
import type { CharacterConfig } from '../types/genshin';
import { runGcsimSample } from '../utils/gcsim/gcsimClient';
import { GCSIM_VERSION } from '../utils/gcsim/gcsimConfig';
import { loadRequiredEr, saveRequiredEr } from '../utils/appSettings';
import {
  computeRequiredEr,
  fingerprintOf,
  ER_MAX_ADDED,
  ER_SEEDS,
  type BuildForEr,
  type RequiredErProgress,
  type RequiredErResult,
} from '../utils/gcsim/requiredEnergyRecharge';

interface EnergyRechargeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 今の編成・ローテーションから、算出用の gcsim 設定文を作る */
  build: BuildForEr;
  /** 編成のキャラ（名前と、編成の ER の表示に使う） */
  characters: CharacterConfig[];
}

/** チャージ効率計算（フェーズ7）: 全キャラの爆発が毎周出るために必要な ER を、gcsim で求めて表示する。結果は保存し、開き直すと最後の結果を表示する */
export const EnergyRechargeDialog: React.FC<EnergyRechargeDialogProps> = ({ isOpen, onClose, build, characters }) => {
  const [saved, setSaved] = useState<RequiredErResult | null>(null);
  const [currentFingerprint, setCurrentFingerprint] = useState<string | null>(null);
  const [notRunnable, setNotRunnable] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RequiredErProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const buildRef = useRef(build);
  buildRef.current = build;

  // 開いたとき: 最後の結果を読み、今の設定文の指紋を求める（編成・ローテーションが変わっていないかの判定に使う）
  useEffect(() => {
    if (!isOpen) return;
    setSaved(loadRequiredEr());
    setMessage(null);
    const base = buildRef.current({ ignoreBurstEnergy: true, added: {} });
    setCurrentFingerprint(fingerprintOf(base.config));
    setNotRunnable(base.runnable ? [] : base.warnings.filter(w => w.level === 'error').map(w => w.message));
  }, [isOpen]);

  if (!isOpen) return null;

  const start = async () => {
    cancelRef.current = false;
    setRunning(true);
    setMessage(null);
    setProgress(null);
    const outcome = await computeRequiredEr({
      build: extra => buildRef.current(extra),
      run: runGcsimSample,
      gcsimVersion: GCSIM_VERSION,
      onProgress: setProgress,
      shouldCancel: () => cancelRef.current,
    });
    setRunning(false);
    setProgress(null);
    if (outcome.status === 'ok') {
      saveRequiredEr(outcome.result);
      setSaved(outcome.result);
      setCurrentFingerprint(outcome.result.fingerprint);
    } else if (outcome.status === 'cancelled') {
      setMessage(t('gcsim:er.cancelled'));
    } else {
      setMessage(t('gcsim:er.failed', { message: outcome.message }));
    }
  };

  const charOf = (id: string) => characters.find(c => c.id === id);
  const stale = saved !== null && currentFingerprint !== null && saved.fingerprint !== currentFingerprint;
  const oldVersion = saved !== null && saved.gcsimVersion !== GCSIM_VERSION;

  const diffCell = (entry: RequiredErResult['entries'][number]) => {
    if (entry.status !== 'ok' || entry.totalEr === undefined) return null;
    const current = charOf(entry.characterId)?.energyRecharge ?? 100;
    const diff = Math.round((current - entry.totalEr) * 10) / 10;
    return diff >= 0
      ? <span className="text-emerald-400">{diff === 0 ? t('gcsim:er.enough') : t('gcsim:er.surplus', { diff })}</span>
      : <span className="text-rose-400">{t('gcsim:er.short', { diff: Math.abs(diff) })}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center border border-yellow-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">{t('gcsim:er.title')}</h3>
          </div>
          <button onClick={onClose} disabled={running} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40" title={t('action.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm">
          <p className="text-xs text-slate-400 leading-relaxed">{t('gcsim:er.intro', { seeds: ER_SEEDS })}</p>

          {notRunnable.length > 0 && (
            <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg p-3 space-y-1">
              <p className="font-bold">{t('gcsim:er.notRunnable')}</p>
              {notRunnable.map((m, i) => <p key={i}>{m}</p>)}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {running ? (
              <button onClick={() => { cancelRef.current = true; }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 hover:bg-slate-600 text-white">
                <Square className="w-3.5 h-3.5" />{t('gcsim:er.cancel')}
              </button>
            ) : (
              <button onClick={() => void start()} disabled={notRunnable.length > 0} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-yellow-500 hover:bg-yellow-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed">
                <Play className="w-3.5 h-3.5" />{t('gcsim:er.start')}
              </button>
            )}
            {running && (
              <span className="text-xs text-slate-300">
                {progress && progress.name
                  ? t('gcsim:er.progress', { name: progress.name, done: progress.done + 1, total: progress.total })
                  : t('gcsim:er.running')}
              </span>
            )}
            {saved && !running && (
              <span className="text-xs text-slate-500">
                {t('gcsim:er.lastRun', { date: new Date(saved.ranAt).toLocaleString(dateLocale), seeds: saved.seeds })}
              </span>
            )}
          </div>

          {message && <p className="text-xs text-amber-300">{message}</p>}
          {stale && !running && (
            <p className="text-xs text-amber-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{t('gcsim:er.stale')}</p>
          )}
          {oldVersion && !running && saved && (
            <p className="text-xs text-amber-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{t('gcsim:er.oldVersion', { saved: saved.gcsimVersion, current: GCSIM_VERSION })}</p>
          )}

          {saved ? (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800 text-left">
                  <th className="py-1.5 pr-2 font-semibold">{t('gcsim:er.colName')}</th>
                  <th className="py-1.5 pr-2 font-semibold text-right">{t('gcsim:er.colCurrent')}</th>
                  <th className="py-1.5 pr-2 font-semibold text-right">{t('gcsim:er.colRequired')}</th>
                  <th className="py-1.5 font-semibold text-right">{t('gcsim:er.colDiff')}</th>
                </tr>
              </thead>
              <tbody>
                {saved.entries.map(e => {
                  const c = charOf(e.characterId);
                  return (
                    <tr key={e.characterId} className="border-b border-slate-800/60">
                      <td className="py-1.5 pr-2 text-slate-200">{c ? charName(c) : e.name}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-400">{c ? `${c.energyRecharge ?? 100}%` : '-'}</td>
                      <td className="py-1.5 pr-2 text-right font-bold text-yellow-300">
                        {e.status === 'ok' && `${e.totalEr}%`}
                        {e.status === 'noBurst' && <span className="font-normal text-slate-500">{t('gcsim:er.noBurst')}</span>}
                        {e.status === 'unreachable' && <span className="font-normal text-rose-400">{t('gcsim:er.unreachable', { max: ER_MAX_ADDED * 100 })}</span>}
                      </td>
                      <td className="py-1.5 text-right">{diffCell(e)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            !running && <p className="text-xs text-slate-500">{t('gcsim:er.never')}</p>
          )}

          <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.note')}</p>
        </div>
      </div>
    </div>
  );
};
