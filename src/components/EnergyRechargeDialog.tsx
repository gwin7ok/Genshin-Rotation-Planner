import React, { useEffect, useRef, useState } from 'react';
import { X, Zap, Play, Square, AlertTriangle } from 'lucide-react';
import { t, dateLocale, currentLanguage } from '../i18n';
import { charName } from '../i18n/loc';
import type { CharacterConfig } from '../types/genshin';
import { runGcsimSample } from '../utils/gcsim/gcsimClient';
import { resolveEngine, wasmParallelism } from '../utils/gcsim/gcsimWasm';
import { GCSIM_VERSION } from '../utils/gcsim/gcsimConfig';
import { loadRequiredEr, saveRequiredEr } from '../utils/appSettings';
import {
  computeRequiredEr,
  fingerprintOf,
  ER_LOOP_ITERATIONS,
  ER_MAX_ADDED,
  ER_DEFAULT_BURST_WAIT_SECONDS,
  ER_DEFAULT_ENEMY_PARTICLES,
  ER_VERIFY_TOLERANCE_PRECISE,
  ER_VERIFY_TOLERANCE_ROUGH,
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

const PHASE_KEY = { baseline: 'phaseBaseline', collect: 'phaseCollect', verify: 'phaseVerify' } as const;

/** 秒数を「m分ss秒」（英語は m:ss）にする */
const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return currentLanguage === 'en' ? `${m}:${String(s).padStart(2, '0')}` : m > 0 ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`;
};

/** チャージ効率計算（フェーズ7）: 全キャラの爆発が毎周出るために必要な ER を、gcsim で求めて表示する。結果は保存し、開き直すと最後の結果を表示する */
export const EnergyRechargeDialog: React.FC<EnergyRechargeDialogProps> = ({ isOpen, onClose, build, characters }) => {
  const [saved, setSaved] = useState<RequiredErResult | null>(null);
  const [currentFingerprint, setCurrentFingerprint] = useState<string | null>(null);
  const [notRunnable, setNotRunnable] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RequiredErProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // 敵の粒子の設定（実行前に変えられる。入力中は文字列。最後に実行した値があればそれを使う）
  const [pMin, setPMin] = useState(String(ER_DEFAULT_ENEMY_PARTICLES.minSeconds));
  const [pMax, setPMax] = useState(String(ER_DEFAULT_ENEMY_PARTICLES.maxSeconds));
  const [pAmount, setPAmount] = useState(String(ER_DEFAULT_ENEMY_PARTICLES.amount));
  const [precise, setPrecise] = useState(false);
  const [wait, setWait] = useState(String(ER_DEFAULT_BURST_WAIT_SECONDS));
  const cancelRef = useRef(false);
  const buildRef = useRef(build);
  buildRef.current = build;

  // 開いたとき: 最後の結果を読み、今の設定文の指紋を求める（編成・ローテーションが変わっていないかの判定に使う）
  useEffect(() => {
    if (!isOpen) return;
    const last = loadRequiredEr();
    setSaved(last);
    // 古い保存（この設定が無かった頃）は、既定にする
    const p = last?.enemyParticles ?? ER_DEFAULT_ENEMY_PARTICLES;
    setPMin(String(p.minSeconds));
    setPMax(String(p.maxSeconds));
    setPAmount(String(p.amount));
    setPrecise(last?.precise === true);
    setWait(String(last?.burstWaitSeconds ?? ER_DEFAULT_BURST_WAIT_SECONDS));
    setMessage(null);
    const base = buildRef.current({ ignoreBurstEnergy: true, added: {} });
    setCurrentFingerprint(fingerprintOf(base.config));
    setNotRunnable(base.runnable ? [] : base.warnings.filter(w => w.level === 'error').map(w => w.message));
  }, [isOpen]);

  // 計算中は、1 秒ごとに経過時間を更新する
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!isOpen) return null;

  const start = async () => {
    const num = (s: string) => { const v = Number(s); return Number.isFinite(v) && v >= 0 ? v : 0; };
    const minS = num(pMin);
    const particles = num(pAmount) > 0 && num(pMax) > 0 ? { minSeconds: Math.min(minS, num(pMax)), maxSeconds: Math.max(minS, num(pMax)), amount: num(pAmount) } : undefined;
    cancelRef.current = false;
    setRunning(true);
    setMessage(null);
    setProgress(null);
    setStartedAt(Date.now());
    setNow(Date.now());
    // WASM（ブラウザの中で実行）のときは、Worker を並べて、種を同時に実行する
    const parallel = (await resolveEngine()) === 'wasm' ? wasmParallelism() : 1;
    let outcome: Awaited<ReturnType<typeof computeRequiredEr>>;
    try {
      outcome = await computeRequiredEr({
        build: extra => buildRef.current(extra),
        enemyParticles: particles,
        parallel,
        burstWaitSeconds: (() => { const v = Number(wait); return Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : ER_DEFAULT_BURST_WAIT_SECONDS; })(),
        verifyTolerance: precise ? ER_VERIFY_TOLERANCE_PRECISE : ER_VERIFY_TOLERANCE_ROUGH,
        run: runGcsimSample,
        gcsimVersion: GCSIM_VERSION,
        onProgress: setProgress,
        shouldCancel: () => cancelRef.current,
      });
    } catch (e) {
      // 想定外の例外でも、「計算中」のまま止まらないようにする
      outcome = { status: 'error', message: e instanceof Error ? e.message : String(e) };
    }
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
  // 編成・ローテーションが前回の計算のときから変わっているときは、前回の結果を表示しない（指紋が出るまでも出さない）
  const shown = saved !== null && currentFingerprint !== null && saved.fingerprint === currentFingerprint ? saved : null;
  // 足りる確率: 概算は値を最大 ER 20% 高めに丸めているので「以上」、精密は「約」
  const pctLabel = (p?: number) => p === undefined ? null : <span className="ml-1 text-[10px] font-normal text-slate-400">({t(shown?.precise ? 'gcsim:er.pctAbout' : 'gcsim:er.pctAtLeast', { pct: p })})</span>;
  const oldVersion = saved !== null && saved.gcsimVersion !== GCSIM_VERSION;

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
          <p className="text-xs text-slate-400 leading-relaxed">{t('gcsim:er.intro', { laps: ER_LOOP_ITERATIONS })}</p>

          {notRunnable.length > 0 && (
            <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg p-3 space-y-1">
              <p className="font-bold">{t('gcsim:er.notRunnable')}</p>
              {notRunnable.map((m, i) => <p key={i}>{m}</p>)}
            </div>
          )}

          <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <p className="font-bold">{t('gcsim:er.enemyParticles')}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <input type="number" min={0} step={0.5} value={pMin} onChange={e => setPMin(e.target.value)} disabled={running} className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-right" />
              <span>〜</span>
              <input type="number" min={0} step={0.5} value={pMax} onChange={e => setPMax(e.target.value)} disabled={running} className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-right" />
              <span>{t('gcsim:er.enemyParticlesEvery')}</span>
              <input type="number" min={0} step={1} value={pAmount} onChange={e => setPAmount(e.target.value)} disabled={running} className="w-14 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-right" />
              <span>{t('gcsim:er.enemyParticlesUnit')}</span>
              <button onClick={() => { setPMin(String(ER_DEFAULT_ENEMY_PARTICLES.minSeconds)); setPMax(String(ER_DEFAULT_ENEMY_PARTICLES.maxSeconds)); setPAmount(String(ER_DEFAULT_ENEMY_PARTICLES.amount)); }} disabled={running} className="ml-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40">{t('gcsim:er.enemyParticlesReset')}</button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.enemyParticlesNote')}</p>
          </div>

          <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <p className="font-bold">{t('gcsim:er.precision')}</p>
            <div className="flex items-center gap-1.5">
              {([false, true] as const).map(v => (
                <button key={String(v)} onClick={() => setPrecise(v)} disabled={running} className={`px-2.5 py-0.5 rounded border disabled:opacity-40 ${precise === v ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 font-bold' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                  {t(v ? 'gcsim:er.precisionPrecise' : 'gcsim:er.precisionRough')}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.precisionNote')}</p>
          </div>

          <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <p className="font-bold">{t('gcsim:er.burstWait')}</p>
            <div className="flex items-center gap-1.5">
              <input type="number" min={0} step={0.1} value={wait} onChange={e => setWait(e.target.value)} disabled={running} className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-right" />
              <span>{t('gcsim:er.burstWaitUnit')}</span>
              <button onClick={() => setWait(String(ER_DEFAULT_BURST_WAIT_SECONDS))} disabled={running} className="ml-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40">{t('gcsim:er.enemyParticlesReset')}</button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.burstWaitNote')}</p>
          </div>

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
                {progress ? t(`gcsim:er.${PHASE_KEY[progress.phase]}`) : t('gcsim:er.running')}
                {startedAt !== null && (() => {
                  const elapsed = now - startedAt;
                  // 残り時間 = 塊（同時に実行する種のまとまり）の平均時間 × 残りの塊の数。確かめは何回で収まるか分からないので、最小〜最大の幅で出す
                  if (!progress || progress.chunksDone < 2 || elapsed < 5000) return ` ・ ${t('gcsim:er.elapsedRunningNoEstimate', { elapsed: formatDuration(elapsed) })}`;
                  const perChunk = elapsed / progress.chunksDone;
                  const low = progress.chunksLeftLow * perChunk;
                  const high = progress.chunksLeftHigh * perChunk;
                  if (high < 4000) return ` ・ ${t('gcsim:er.elapsedRunningSoon', { elapsed: formatDuration(elapsed) })}`;
                  const mid = (low + high) / 2;
                  return ` ・ ${high - low < Math.max(8000, mid * 0.25)
                    ? t('gcsim:er.elapsedRunning', { elapsed: formatDuration(elapsed), remaining: formatDuration(mid) })
                    : t('gcsim:er.elapsedRunningRange', { elapsed: formatDuration(elapsed), low: formatDuration(low), high: formatDuration(high) })}`;
                })()}
              </span>
            )}
            {shown && !running && (
              <span className="text-xs text-slate-500">
                {shown.elapsedMs !== undefined
                  ? t('gcsim:er.lastRunWithTime', { date: new Date(shown.ranAt).toLocaleString(dateLocale), seeds: shown.seeds, elapsed: formatDuration(shown.elapsedMs) })
                  : t('gcsim:er.lastRun', { date: new Date(shown.ranAt).toLocaleString(dateLocale), seeds: shown.seeds })}
              </span>
            )}
          </div>

          {message && <p className="text-xs text-amber-300">{message}</p>}
          {stale && !running && (
            <p className="text-xs text-amber-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{t('gcsim:er.stale')}</p>
          )}
          {oldVersion && !running && shown && (
            <p className="text-xs text-amber-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{t('gcsim:er.oldVersion', { saved: shown.gcsimVersion, current: GCSIM_VERSION })}</p>
          )}

          {shown ? (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800 text-left">
                  <th className="py-1.5 pr-2 font-semibold">{t('gcsim:er.colName')}</th>
                  <th className="py-1.5 pr-2 font-semibold text-right">{t('gcsim:er.colCurrent')}</th>
                  <th className="py-1.5 pr-2 font-semibold text-right" title={t('gcsim:er.colTypicalTitle')}>{t('gcsim:er.colTypical')}</th>
                  <th className="py-1.5 pr-2 font-semibold text-right" title={t('gcsim:er.colStableTitle')}>{t('gcsim:er.colStable')}</th>
                  <th className="py-1.5 font-semibold text-right" title={t('gcsim:er.colCertainTitle')}>{t('gcsim:er.colCertain')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.entries.map(e => {
                  const c = charOf(e.characterId);
                  return (
                    <tr key={e.characterId} className="border-b border-slate-800/60">
                      <td className="py-1.5 pr-2 text-slate-200">{c ? charName(c) : e.name}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-400">{c ? `${c.energyRecharge ?? 100}%` : '-'}</td>
                      {e.status === 'ok' ? (
                        <>
                          <td className="py-1.5 pr-2 text-right text-yellow-200">{e.typicalEr}%{pctLabel(e.typicalPct)}</td>
                          <td className="py-1.5 pr-2 text-right font-bold text-yellow-300">{e.stableEr}%{pctLabel(e.stablePct)}</td>
                          <td className="py-1.5 text-right text-amber-500">{e.certainEr}%{pctLabel(e.certainPct)}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="py-1.5 text-right">
                          {e.status === 'noBurst' && <span className="text-slate-500">{t('gcsim:er.noBurst')}</span>}
                          {e.status === 'unreachable' && <span className="text-rose-400">{t('gcsim:er.unreachable', { max: ER_MAX_ADDED * 100 })}</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            !running && !stale && <p className="text-xs text-slate-500">{t('gcsim:er.never')}</p>
          )}

          <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.note', { seeds: shown?.seeds ?? 10, laps: ER_LOOP_ITERATIONS })}</p>
        </div>
      </div>
    </div>
  );
};
