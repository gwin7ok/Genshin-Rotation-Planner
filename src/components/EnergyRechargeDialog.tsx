import React, { useEffect, useRef, useState } from 'react';
import { X, Zap, Play, Square, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Stepper } from './Stepper';
import { t, dateLocale, currentLanguage, joinList, rangeMark, dotMark } from '../i18n';
import { charName } from '../i18n/loc';
import type { CharacterConfig } from '../types/genshin';
import type { AppDatabase } from '../types/database';
import { previewFinalStats } from '../utils/gcsim/finalStatsPreview';
import { runGcsimSample } from '../utils/gcsim/gcsimClient';
import { wasmParallelism, getWasmCores, setWasmCores, wasmMaxCores, WASM_DEFAULT_CORES } from '../utils/gcsim/gcsimWasm';
import { GCSIM_VERSION } from '../utils/gcsim/gcsimConfig';
import { computeBurstTiming, BURST_TIMING_ON_TIME_SECONDS, type BurstTimingResult } from '../utils/gcsim/burstTiming';
import { loadBattleCondition, loadRequiredEr, saveBattleCondition, saveRequiredEr } from '../utils/appSettings';
import { defaultBattleCondition, sameAbyssRunCondition, sanitizeBattleCondition, toAbyssRunCondition, type AppMode, type BattleCondition } from '../utils/battleCondition';
import { BattlePresetsPanel } from './BattlePresetsPanel';
import { ENEMY_STATE_MAX } from '../utils/gcsim/enemyStates';
import { ErAdjustNotice } from './ErAdjustNotice';
import {
  computeRequiredEr,
  fingerprintOf,
  ER_DEFAULT_LOOPS,
  ER_MAX_LOOPS,
  ER_MAX_ADDED,
  ER_DEFAULT_BURST_WAIT_SECONDS,
  ER_DEFAULT_SEEDS,
  ER_MAX_SEEDS,
  ER_DEFAULT_ENEMY_PARTICLES,
  ABYSS_MAX_BATTLE_SECONDS,
  ABYSS_MAX_TIMED_PARTICLES,
  verifyCharacters,
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
  /** いまの元素チャージ効率（枠の設定から gcsim で計算）に使う */
  database: Pick<AppDatabase, 'weapons' | 'artifacts'>;
  /** アプリ全体のモード。幽境モードは、開始エネルギー 0・最初の爆発も判定・時刻指定の粒子・戦闘時間で求め、結果は通常モードとは別に保存する（フェーズ8） */
  mode?: AppMode;
  /** モードの切り替え（アプリ全体のモード。ヘッダーから、この画面へ移した） */
  onChangeMode?: (mode: AppMode) => void;
}

/** 時刻指定の粒子の入力 1 行（入力中は文字列） */
interface TimedInput { key: number; seconds: string; amount: string }

const PHASE_KEY = { baseline: 'phaseBaseline', collect: 'phaseCollect', verify: 'phaseVerify', refine: 'phaseRefine' } as const;

/** 秒数を「m分ss秒」（英語は m:ss）にする */
const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return currentLanguage === 'en' ? `${m}:${String(s).padStart(2, '0')}` : m > 0 ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`;
};

/** チャージ効率計算（フェーズ7）: 全キャラの爆発が毎周出るために必要な ER を、gcsim で求めて表示する。結果は保存し、開き直すと最後の結果を表示する */
export const EnergyRechargeDialog: React.FC<EnergyRechargeDialogProps> = ({ isOpen, onClose, build, characters, database, mode = 'normal', onChangeMode }) => {
  const isAbyss = mode === 'abyss';
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
  const [verifyNames, setVerifyNames] = useState<string[]>([]);
  // 今の編成のキャラ（結果が無い・古いときに、名前だけの空欄の表を出すため）
  const [currentMembers, setCurrentMembers] = useState<{ characterId: string; name: string }[]>([]);
  // いまの元素チャージ効率（キャラ ID → 割合。枠の設定（持ちキャラの装備・仮値）から、gcsim で計算した最終値。計算できなかったキャラは無い）
  const [currentEr, setCurrentEr] = useState<Record<string, number>>({});
  const [wait, setWait] = useState(ER_DEFAULT_BURST_WAIT_SECONDS.toFixed(1));
  // 幽境モードの戦闘条件（入力中は文字列。変えるたびに保存する）
  const [loops, setLoops] = useState(String(ER_DEFAULT_LOOPS));
  const [firstWait, setFirstWait] = useState(defaultBattleCondition().firstBurstWaitSeconds.toFixed(1));
  const [timed, setTimed] = useState<TimedInput[]>([]);
  const timedKey = useRef(0);
  // 戦闘条件のうち、この画面では編集しない分（敵・敵の状態の時間帯。DPS 計算の画面で編集する）。保存するとき・名前を付けて保存するときに、そのまま持ち回る
  const [dpsPart, setDpsPart] = useState<Pick<BattleCondition, 'enemies' | 'enemyStates'>>(() => { const d = defaultBattleCondition(); return { enemies: d.enemies, enemyStates: d.enemyStates }; });
  const [seeds, setSeeds] = useState(String(ER_DEFAULT_SEEDS));
  // 爆発のタイミングの確認（幽境モード。結果は保存しない。編成・条件が変わったら表示しない）
  const [timing, setTiming] = useState<{ key: string; result: BurstTimingResult } | null>(null);
  const [timingRunning, setTimingRunning] = useState(false);
  const [timingMessage, setTimingMessage] = useState<string | null>(null);
  // 使うコアの数（この端末の設定。変えると、すぐ保存する）
  const [cores, setCores] = useState(String(getWasmCores()));
  const changeCores = (v: string) => {
    setCores(v);
    const n = Math.floor(Number(v));
    if (Number.isFinite(n) && n >= 1) setWasmCores(n);
  };
  const cancelRef = useRef(false);
  const buildRef = useRef(build);
  buildRef.current = build;

  // 開いたとき: 最後の結果を読み、今の設定文の指紋を求める（編成・ローテーションが変わっていないかの判定に使う）
  useEffect(() => {
    if (!isOpen) return;
    const last = loadRequiredEr(mode);
    setSaved(last);
    // 幽境モード: 戦闘条件は、保存した条件（モードごと。ER・DPS で共通）から読む。通常モードは、最後の結果の値（古い保存は既定）
    const cond = isAbyss ? loadBattleCondition() : null;
    if (cond) {
      setLoops(String(cond.loops));
      setFirstWait(cond.firstBurstWaitSeconds.toFixed(1));
      setTimed(cond.timedParticles.map(p => ({ key: ++timedKey.current, seconds: String(p.seconds), amount: String(p.amount) })));
      setDpsPart({ enemies: cond.enemies, enemyStates: cond.enemyStates });
    }
    if (!cond) setLoops(String(last?.loops ?? ER_DEFAULT_LOOPS));
    const p = cond?.enemyParticles ?? last?.enemyParticles ?? ER_DEFAULT_ENEMY_PARTICLES;
    setPMin(String(p.minSeconds));
    setPMax(String(p.maxSeconds));
    setPAmount(String(p.amount));
    setWait((last?.burstWaitSeconds ?? ER_DEFAULT_BURST_WAIT_SECONDS).toFixed(1));
    setSeeds(String(last?.seeds ?? ER_DEFAULT_SEEDS));
    setMessage(null);
    const base = buildRef.current({ ignoreBurstEnergy: true, added: {} });
    setPrecise(last?.precise ?? false); // 初期値は概算検証（最後の実行があれば、そのときの選択）
    setCurrentFingerprint(fingerprintOf(base.config));
    // 回復量が自分の ER で決まるキャラ（雷電将軍・九条裟羅・ドリー）がいる編成は、確実の値を精密検証で求める（自動）
    setVerifyNames(verifyCharacters(base.members).map(m => { const c = characters.find(x => x.id === m.characterId); return c ? charName(c) : m.name; }));
    setCurrentMembers(base.members.map(m => ({ characterId: m.characterId, name: m.name })));
    setNotRunnable(base.runnable ? [] : base.warnings.filter(w => w.level === 'error').map(w => w.message));
  }, [isOpen, mode]);

  /** 周回数（ループ部分。範囲に収める。計算にも、爆発のタイミングの確認にも使う） */
  const loopsN = (): number => { const v = Math.round(Number(loops)); return Number.isFinite(v) ? Math.min(ER_MAX_LOOPS, Math.max(1, v)) : ER_DEFAULT_LOOPS; };

  /** 入力中の値から、幽境モードの戦闘条件を作る（空欄・不正な値は、既定・範囲に収める） */
  const readCondition = (): BattleCondition => {
    const raw = (s: string) => (s.trim() === '' ? NaN : Number(s));
    const n = (s: string) => { const v = Number(s); return Number.isFinite(v) && v >= 0 ? v : 0; };
    return sanitizeBattleCondition({
      loops: raw(loops),
      firstBurstWaitSeconds: raw(firstWait),
      timedParticles: timed.map(x => ({ seconds: raw(x.seconds), amount: raw(x.amount) })),
      enemyParticles: { minSeconds: Math.min(n(pMin), n(pMax)), maxSeconds: Math.max(n(pMin), n(pMax)), amount: n(pAmount) },
      enemies: dpsPart.enemies,
      enemyStates: dpsPart.enemyStates,
    });
  };

  // 幽境モードの戦闘条件は、入力を変えるたびに保存する（閉じても残る。DPS 計算が共通で使う設定の元になる）。
  // 開いた直後の読み込み（上の effect）で入力が入りきる前の保存を避けるため、開いている間だけ・変わったときだけ保存する
  const abyssInputs = JSON.stringify([loops, firstWait, timed.map(x => [x.seconds, x.amount]), pMin, pMax, pAmount, dpsPart]);
  const lastSavedInputs = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !isAbyss) { lastSavedInputs.current = null; return; }
    // 開いた直後の最初の値は、保存済みの値の読み込みなので、保存し直さない
    if (lastSavedInputs.current === null) { lastSavedInputs.current = abyssInputs; return; }
    if (lastSavedInputs.current === abyssInputs) return;
    lastSavedInputs.current = abyssInputs;
    saveBattleCondition(readCondition());
  }, [isOpen, isAbyss, abyssInputs]);

  // いまの元素チャージ効率: 開いたとき、編成の各キャラについて、設定（持ちキャラの装備・保存した仮値・既定の仮値）のまま gcsim で計算する
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setCurrentEr({});
    (async () => {
      for (const c of characters) {
        if (c.id.startsWith('empty_slot_')) continue;
        const r = await previewFinalStats(c, undefined, database).catch(() => null);
        if (cancelled) return;
        if (r && r.status === 'ok') setCurrentEr(prev => ({ ...prev, [c.id]: r.stats.er }));
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, characters, database]);

  // 計算中は、1 秒ごとに経過時間を更新する
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!isOpen) return null;

  /** 保存した戦闘条件を、入力欄に入れる（入力が変わるので、上の自動保存が、いまの条件として保存する） */
  const applyCondition = (c: BattleCondition) => {
    setLoops(String(c.loops));
    setFirstWait(c.firstBurstWaitSeconds.toFixed(1));
    setTimed(c.timedParticles.map(p => ({ key: ++timedKey.current, seconds: String(p.seconds), amount: String(p.amount) })));
    setPMin(String(c.enemyParticles.minSeconds));
    setPMax(String(c.enemyParticles.maxSeconds));
    setPAmount(String(c.enemyParticles.amount));
    setDpsPart({ enemies: c.enemies, enemyStates: c.enemyStates });
  };

  /** 実行する戦闘条件と、敵の粒子（入力中の値から）。幽境モードは、敵の周期の粒子も戦闘条件に含まれる */
  const resolveRun = () => {
    const num = (s: string) => { const v = Number(s); return Number.isFinite(v) && v >= 0 ? v : 0; };
    const minS = num(pMin);
    const condition = isAbyss ? readCondition() : null;
    const particles = condition
      ? (condition.enemyParticles.amount > 0 && condition.enemyParticles.maxSeconds > 0 ? condition.enemyParticles : undefined)
      : num(pAmount) > 0 && num(pMax) > 0 ? { minSeconds: Math.min(minS, num(pMax)), maxSeconds: Math.max(minS, num(pMax)), amount: num(pAmount) } : undefined;
    return { condition, particles };
  };
  const seedCount = (): number => { const v = Math.floor(Number(seeds)); return Number.isFinite(v) && v >= 1 ? Math.min(v, ER_MAX_SEEDS) : ER_DEFAULT_SEEDS; };

  // 爆発のタイミングの確認（幽境モード）: いまのビルドで、開始エネルギー 0 から回し、各爆発の計画からの遅れを調べる
  const timingKeyNow = `${currentFingerprint ?? ''}|${JSON.stringify(readCondition())}`;
  const runTiming = async () => {
    const { condition, particles } = resolveRun();
    if (!condition) return;
    saveBattleCondition(condition);
    const key = timingKeyNow;
    setTimingRunning(true);
    setTimingMessage(null);
    let outcome: Awaited<ReturnType<typeof computeBurstTiming>>;
    try {
      outcome = await computeBurstTiming({
        build: extra => buildRef.current(extra),
        enemyParticles: particles,
        abyss: toAbyssRunCondition(condition),
        seeds: seedCount(),
        parallel: wasmParallelism(),
        run: runGcsimSample,
      });
    } catch (e) {
      outcome = { status: 'error', message: e instanceof Error ? e.message : String(e) };
    }
    setTimingRunning(false);
    if (outcome.status === 'ok') setTiming({ key, result: outcome.result });
    else if (outcome.status !== 'cancelled') setTimingMessage(t('gcsim:er.timingFailed', { message: outcome.message }));
  };

  const start = async () => {
    // 幽境モードの戦闘条件（敵の周期の粒子を含む）。実行する条件を、そのまま保存する
    const { condition, particles } = resolveRun();
    if (condition) saveBattleCondition(condition);
    cancelRef.current = false;
    setRunning(true);
    setMessage(null);
    setProgress(null);
    setStartedAt(Date.now());
    setNow(Date.now());
    // Worker を並べて、種を同時に実行する
    const parallel = wasmParallelism();
    let outcome: Awaited<ReturnType<typeof computeRequiredEr>>;
    try {
      outcome = await computeRequiredEr({
        build: extra => buildRef.current(extra),
        loops: loopsN(),
        enemyParticles: particles,
        ...(condition ? { abyss: toAbyssRunCondition(condition) } : {}),
        parallel,
        verifyTolerance: precise ? ER_VERIFY_TOLERANCE_PRECISE : ER_VERIFY_TOLERANCE_ROUGH,
        seeds: seedCount(),
        burstWaitSeconds: (() => { const v = Number(wait); return Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : ER_DEFAULT_BURST_WAIT_SECONDS; })(),
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
      saveRequiredEr(outcome.result, mode);
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
  // 足りる確率: 概算検証は値を最大 ER 10% 高めに丸めているので「以上」、精密検証・計算のみは「約」
  // 「以上」は確実だけ（概算検証は値を最大 ER 10% 高めに丸める）。目安・安定は丸めないので「約」
  const pctLabel = (p: number | undefined, estimated = false) => p === undefined ? null : <span className="ml-1 text-[10px] font-normal text-slate-400">({t(estimated ? 'gcsim:er.pctEstimated' : 'gcsim:er.pctMeasured', { pct: p })})</span>;
  // 目安・安定: 種の数による誤差（80%の範囲の、値からの下・上の幅 -?%〜+?%。範囲そのものはツールチップ）。確実: 検証の丸め（最大 +。概算 = 10、精密 = 1。上方向）
  const rangeLabel = (value: number | undefined, low: number | undefined, high: number | undefined) => {
    if (value === undefined || (low === undefined && high === undefined)) return null;
    const part = (sign: string, d: number) => `${sign}${(Math.ceil(Math.max(0, d) * 10 - 1e-9) / 10).toFixed(1)}%`;
    return <div className="text-[10px] font-normal text-slate-500" title={t('gcsim:er.rangeTitle', { low: low === undefined ? '' : low.toFixed(1), high: high === undefined ? '' : high.toFixed(1) })}>{t('gcsim:er.range', { minus: low === undefined ? '' : part('-', value - low), plus: high === undefined ? '' : part('+', high - value) })}</div>;
  };
  const roundingLabel = shown && shown.verified !== false && shown.precise !== undefined
    ? <div className="text-[10px] font-normal text-slate-500">{t('gcsim:er.rounding', { max: ((shown.precise ? ER_VERIFY_TOLERANCE_PRECISE : ER_VERIFY_TOLERANCE_ROUGH) * 100).toFixed(1) })}</div> : null;
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
            <div role="group" aria-label={t('header:mode.label')} data-testid="app-mode-switch" className="ml-2 flex items-center rounded-lg border border-slate-700 overflow-hidden text-xs font-bold">
              {(['normal', 'abyss'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  disabled={running || timingRunning}
                  aria-pressed={mode === m}
                  data-testid={`app-mode-${m}`}
                  onClick={() => onChangeMode?.(m)}
                  title={t(`header:mode.${m}Title`)}
                  className={`px-2.5 py-1 transition-colors ${mode === m
                    ? (m === 'abyss' ? 'bg-fuchsia-600 text-white' : 'bg-slate-600 text-white')
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
                >
                  {t(`header:mode.${m}`)}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} disabled={running || timingRunning} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40" title={t('action.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm">
          <p className="text-xs text-slate-400 leading-relaxed">{isAbyss ? t('gcsim:er.introAbyss') : t('gcsim:er.intro', { laps: loopsN() })}</p>
          {isAbyss && (
            <div className="text-xs text-fuchsia-200 bg-fuchsia-950/30 border border-fuchsia-900/60 rounded-lg p-3 leading-relaxed" data-testid="er-abyss-banner">{t('gcsim:er.abyssBanner')}</div>
          )}

          {notRunnable.length > 0 && (
            <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg p-3 space-y-1">
              <p className="font-bold">{t('gcsim:er.notRunnable')}</p>
              {notRunnable.map((m, i) => <p key={i}>{m}</p>)}
            </div>
          )}

          {verifyNames.length > 0 && (
            <div className="text-xs text-amber-200 bg-amber-950/30 border border-amber-900/60 rounded-lg p-3 leading-relaxed">
              {t('gcsim:er.verifyAuto', { names: joinList(verifyNames) })}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {running ? (
              <button onClick={() => { cancelRef.current = true; }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 hover:bg-slate-600 text-white">
                <Square className="w-3.5 h-3.5" />{t('gcsim:er.cancel')}
              </button>
            ) : (
              <button onClick={() => void start()} disabled={notRunnable.length > 0 || timingRunning} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-yellow-500 hover:bg-yellow-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed">
                <Play className="w-3.5 h-3.5" />{t('gcsim:er.start')}
              </button>
            )}
            {running && (
              <span className="text-xs text-slate-300">
                {progress ? t(`gcsim:er.${PHASE_KEY[progress.phase]}`) : t('gcsim:er.running')}
                {startedAt !== null && (() => {
                  const elapsed = now - startedAt;
                  // 残り時間 = 塊（同時に実行する種のまとまり）の平均時間 × 残りの塊の数。検証は何回で収まるか分からないので、最小〜最大の幅で出す
                  if (!progress || progress.chunksDone < 2 || elapsed < 5000) return `${dotMark}${t('gcsim:er.elapsedRunningNoEstimate', { elapsed: formatDuration(elapsed) })}`;
                  const perChunk = elapsed / progress.chunksDone;
                  const low = progress.chunksLeftLow * perChunk;
                  const high = progress.chunksLeftHigh * perChunk;
                  if (high < 4000) return `${dotMark}${t('gcsim:er.elapsedRunningSoon', { elapsed: formatDuration(elapsed) })}`;
                  const mid = (low + high) / 2;
                  return `${dotMark}${high - low < Math.max(8000, mid * 0.25)
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

          {shown?.abyss && !running && (
            <p className="text-xs text-fuchsia-200/90" data-testid="er-abyss-result-condition">{t('gcsim:er.abyssResultCondition', { loops: shown.abyss.loops ?? '-', first: shown.abyss.firstBurstWaitSeconds.toFixed(1), timed: shown.abyss.timedParticles.length })}</p>
          )}
          {shown?.adjusted && !running && (
            <p className="text-xs text-sky-300" data-testid="er-adjusted-result">{t('gcsim:er.adjustedResult', { timed: shown.adjusted.timedInjected, windows: shown.adjusted.invulnerableWindows })}</p>
          )}
          {shown?.abyss && !running && !sameAbyssRunCondition(shown.abyss, toAbyssRunCondition(readCondition())) && (
            <p className="text-xs text-amber-300 flex items-center gap-1.5" data-testid="er-abyss-condition-changed"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{t('gcsim:er.abyssConditionChanged')}</p>
          )}

          {(shown || currentMembers.length > 0) && (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800 text-left">
                  <th className="py-1.5 pr-2 font-semibold">{t('gcsim:er.colName')}</th>
                  <th className="py-1.5 pr-2 font-semibold text-right" title={t('gcsim:er.colCurrentTitle')}>{t('gcsim:er.colCurrent')}</th>
                  <th className="py-1.5 pr-2 font-semibold text-right" title={t('gcsim:er.colTypicalTitle')}>{t('gcsim:er.colTypical')}</th>
                  <th className="py-1.5 pr-2 font-semibold text-right" title={t('gcsim:er.colStableTitle')}>{t('gcsim:er.colStable')}</th>
                  <th className="py-1.5 font-semibold text-right" title={t('gcsim:er.colCertainTitle')}>{t('gcsim:er.colCertain')}</th>
                </tr>
              </thead>
              <tbody>
                {(shown?.entries ?? currentMembers.map(m => ({ characterId: m.characterId, name: m.name, status: 'blank' as const }))).map(e => {
                  const c = charOf(e.characterId);
                  return (
                    <tr key={e.characterId} className="border-b border-slate-800/60">
                      <td className="py-1.5 pr-2 text-slate-200">{c ? charName(c) : e.name}</td>
                      <td className="py-1.5 pr-2 text-right font-mono" data-testid={`er-current-${e.characterId}`}>
                        {(() => {
                          const cur = currentEr[e.characterId];
                          if (cur === undefined) return <span className="text-slate-600">-</span>;
                          const pct = cur * 100;
                          // 必要な値（確実 → 安定）と比べて、足りているかを色で示す（結果が無い・爆発なしは、色なし）
                          const cls = e.status !== 'ok' ? 'text-slate-200'
                            : e.certainEr !== undefined && pct >= e.certainEr ? 'text-emerald-300'
                            : e.stableEr !== undefined && pct >= e.stableEr ? 'text-yellow-300'
                            : 'text-rose-300';
                          return <span className={cls}>{pct.toFixed(1)}%</span>;
                        })()}
                      </td>
                      {e.status === 'blank' ? (
                        <td colSpan={3} className="py-1.5">&nbsp;</td>
                      ) : e.status === 'ok' ? (
                        <>
                          <td className="py-1.5 pr-2 text-right text-yellow-200">{e.typicalEr?.toFixed(1)}%{pctLabel(e.typicalPct)}{rangeLabel(e.typicalEr, e.typicalErLow, e.typicalErHigh)}</td>
                          <td className="py-1.5 pr-2 text-right font-bold text-yellow-300">{e.stableEr?.toFixed(1)}%{pctLabel(e.stablePct)}{rangeLabel(e.stableEr, e.stableErLow, e.stableErHigh)}</td>
                          <td className="py-1.5 text-right text-amber-500">{e.certainEr?.toFixed(1)}%{pctLabel(e.certainPct, true)}{roundingLabel}</td>
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
          )}
          {!shown && !running && !stale && <p className="text-xs text-slate-500">{t('gcsim:er.never')}</p>}

          {isAbyss && (() => {
            const shownTiming = timing !== null && timing.key === timingKeyNow ? timing.result : null;
            const fmt = (x: number) => x.toFixed(1);
            return (
              <div className="text-xs text-slate-300 bg-slate-950/50 border border-fuchsia-900/60 rounded-lg p-3 space-y-2" data-testid="er-timing">
                <p className="font-bold text-fuchsia-200">{t('gcsim:er.timingTitle')}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.timingNote', { sec: BURST_TIMING_ON_TIME_SECONDS })}</p>
                <button type="button" onClick={() => void runTiming()} disabled={running || timingRunning || notRunnable.length > 0} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white disabled:opacity-40 disabled:cursor-not-allowed" data-testid="er-timing-start">
                  <Play className="w-3.5 h-3.5" />{timingRunning ? t('gcsim:er.timingRunning') : t('gcsim:er.timingStart')}
                </button>
                {timingMessage && <p className="text-amber-300">{timingMessage}</p>}
                {shownTiming && (
                  <div className="space-y-1" data-testid="er-timing-waits">
                    <p className="font-semibold text-slate-200">{t('gcsim:er.waitsTitle')}</p>
                    <table className="w-full text-left" data-testid="er-timing-table">
                      <thead>
                        <tr className="text-[11px] text-slate-400 border-b border-slate-800">
                          <th className="py-1 pr-2 font-normal">{t('gcsim:er.waitsColChar')}</th>
                          <th className="py-1 pr-2 font-normal text-right" title={t('gcsim:er.waitsColCountTitle', { loops: shownTiming.loops })}>{t('gcsim:er.waitsColCount')}</th>
                          <th className="py-1 pr-2 font-normal text-right" title={t('gcsim:er.waitsColSecondsTitle')}>{t('gcsim:er.waitsColSeconds')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownTiming.waits.map(wt => {
                          const c = charOf(wt.characterId);
                          return (
                            <tr key={wt.characterId} className="border-b border-slate-900" data-testid={`er-timing-wait-${wt.characterId}`}>
                              <td className="py-1 pr-2 text-slate-200">{c ? charName(c) : wt.name}</td>
                              <td className="py-1 pr-2 text-right font-mono">{wt.perLoop.toFixed(2)}</td>
                              <td className="py-1 pr-2 text-right font-mono">{wt.avgSeconds === null ? '-' : wt.avgSeconds.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                        <tr className="font-bold text-slate-100" data-testid="er-timing-waits-total">
                          <td className="py-1 pr-2">{t('gcsim:er.waitsRowTotal')}</td>
                          <td className="py-1 pr-2 text-right font-mono">{shownTiming.waitsTotal.perLoop.toFixed(2)}</td>
                          <td className="py-1 pr-2 text-right font-mono">{shownTiming.waitsTotal.avgSeconds === null ? '-' : shownTiming.waitsTotal.avgSeconds.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.waitsNote', { loops: shownTiming.loops })}</p>
                  </div>
                )}
              </div>
            );
          })()}

          <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-line">{t('gcsim:er.note')}</p>

          <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1.5" data-testid="er-loops-section">
            <p className="font-bold">{t('gcsim:er.loops')}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Stepper value={loops} onChange={setLoops} step={1} min={1} max={ER_MAX_LOOPS} disabled={running || timingRunning} widthClass="w-14" testId="er-loops" />
              <span>{t('gcsim:er.loopsUnit')}</span>
              <button onClick={() => setLoops(String(ER_DEFAULT_LOOPS))} disabled={running || timingRunning} className="ml-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40">{t('gcsim:er.enemyParticlesReset')}</button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.loopsNote', { def: ER_DEFAULT_LOOPS, max: ER_MAX_LOOPS })}</p>
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
            <p className="font-bold">{t('gcsim:er.cores')}</p>
            <div className="flex items-center gap-1.5">
              <Stepper value={cores} onChange={changeCores} step={1} min={1} max={wasmMaxCores()} disabled={running} widthClass="w-14" />
              <span>{t('gcsim:er.coresUnit')}</span>
              <button onClick={() => changeCores(String(Math.min(WASM_DEFAULT_CORES, wasmMaxCores())))} disabled={running} className="ml-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40">{t('gcsim:er.enemyParticlesReset')}</button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.coresNote', { max: wasmMaxCores(), def: WASM_DEFAULT_CORES })}</p>
          </div>

          <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <p className="font-bold">{t('gcsim:er.seeds')}</p>
            <div className="flex items-center gap-1.5">
              <Stepper value={seeds} onChange={setSeeds} step={10} min={1} max={ER_MAX_SEEDS} disabled={running} widthClass="w-14" />
              <span>{t('gcsim:er.seedsUnit')}</span>
              <button onClick={() => setSeeds(String(ER_DEFAULT_SEEDS))} disabled={running} className="ml-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40">{t('gcsim:er.enemyParticlesReset')}</button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.seedsNote', { max: ER_MAX_SEEDS })}</p>
          </div>

          {isAbyss && (
            <div className="text-xs text-slate-300 bg-slate-950/50 border border-fuchsia-900/60 rounded-lg p-3 space-y-2" data-testid="er-abyss-conditions">
              <p className="font-bold text-fuchsia-200">{t('gcsim:er.abyssConditions')}</p>
              <BattlePresetsPanel isOpen={isOpen} current={readCondition()} onApply={applyCondition} busy={running || timingRunning} testIdPrefix="er" />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>{t('gcsim:er.firstBurstWait')}</span>
                <Stepper value={firstWait} onChange={setFirstWait} step={0.5} min={0} max={60} decimals={1} disabled={running} widthClass="w-14" testId="er-first-wait" />
                <span>{t('gcsim:er.firstBurstWaitUnit')}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.firstBurstWaitNote')}</p>
              <div className="space-y-1.5">
                <p className="font-semibold">{t('gcsim:er.timedParticles')}</p>
                {timed.map(row => (
                  <div key={row.key} className="flex items-center gap-1.5 flex-wrap" data-testid="er-timed-row">
                    <Stepper value={row.seconds} onChange={v => setTimed(list => list.map(x => x.key === row.key ? { ...x, seconds: v } : x))} step={1} min={0} max={ABYSS_MAX_BATTLE_SECONDS} decimals={1} disabled={running} widthClass="w-16" />
                    <span>{t('gcsim:er.timedParticlesAt')}</span>
                    <Stepper value={row.amount} onChange={v => setTimed(list => list.map(x => x.key === row.key ? { ...x, amount: v } : x))} step={1} min={1} max={99} disabled={running} widthClass="w-12" />
                    <span>{t('gcsim:er.enemyParticlesUnit')}</span>
                    <button type="button" onClick={() => setTimed(list => list.filter(x => x.key !== row.key))} disabled={running} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40" title={t('gcsim:er.timedParticlesRemove')}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setTimed(list => [...list, { key: ++timedKey.current, seconds: String(list.length > 0 ? Math.min(ABYSS_MAX_BATTLE_SECONDS, Number(list[list.length - 1].seconds) + 30 || 30) : 30), amount: '3' }])} disabled={running || timed.length >= ABYSS_MAX_TIMED_PARTICLES} className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40" data-testid="er-timed-add"><Plus className="w-3.5 h-3.5" />{t('gcsim:er.timedParticlesAdd')}</button>
                <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.timedParticlesNote', { max: ABYSS_MAX_TIMED_PARTICLES })}</p>
                <ErAdjustNotice condition={readCondition()} testId="er-adjust" />
              </div>
              <div className="space-y-1.5" data-testid="er-invulnerable">
                <p className="font-semibold">{t('gcsim:er.invulnerableTitle')}</p>
                {dpsPart.enemyStates.map((w, idx) => {
                  if (w.kind !== 'invulnerable') return null;
                  const bad = !(w.toSeconds > w.fromSeconds);
                  const setWin = (patch: Partial<{ fromSeconds: number; toSeconds: number }>) => setDpsPart(p => ({ ...p, enemyStates: p.enemyStates.map((x, j) => (j === idx ? { ...x, ...patch } : x)) }));
                  const num = (v: string, old: number) => { const n = Number(v); return v.trim() !== '' && Number.isFinite(n) ? n : old; };
                  return (
                    <div key={idx} className="flex items-center gap-1.5 flex-wrap" data-testid="er-invulnerable-row">
                      <span>{t('gcsim:dps.stateFrom')}</span>
                      <Stepper value={String(w.fromSeconds)} onChange={v => setWin({ fromSeconds: num(v, w.fromSeconds) })} step={1} min={0} max={ABYSS_MAX_BATTLE_SECONDS} disabled={running} invalid={bad} widthClass="w-16" testId="er-invulnerable-from" />
                      <span>{t('gcsim:dps.stateSecondsUnit')}</span>
                      <span>{rangeMark}</span>
                      <span>{t('gcsim:dps.stateTo')}</span>
                      <Stepper value={String(w.toSeconds)} onChange={v => setWin({ toSeconds: num(v, w.toSeconds) })} step={1} min={0} max={ABYSS_MAX_BATTLE_SECONDS} disabled={running} invalid={bad} widthClass="w-16" testId="er-invulnerable-to" />
                      <span>{t('gcsim:dps.stateSecondsUnit')}</span>
                      <button type="button" onClick={() => setDpsPart(p => ({ ...p, enemyStates: p.enemyStates.filter((_, j) => j !== idx) }))} disabled={running} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40" title={t('gcsim:dps.stateRemove')} data-testid="er-invulnerable-remove"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
                <button type="button" onClick={() => setDpsPart(p => { const last = p.enemyStates.filter(w => w.kind === 'invulnerable').pop(); const from = last ? Math.min(ABYSS_MAX_BATTLE_SECONDS - 10, last.toSeconds + 10) : 30; return { ...p, enemyStates: [...p.enemyStates, { fromSeconds: from, toSeconds: from + 10, kind: 'invulnerable' as const }] }; })} disabled={running || dpsPart.enemyStates.length >= ENEMY_STATE_MAX} className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40" data-testid="er-invulnerable-add"><Plus className="w-3.5 h-3.5" />{t('gcsim:er.invulnerableAdd')}</button>
                <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.invulnerableNote', { max: ENEMY_STATE_MAX })}</p>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <p className="font-bold">{t('gcsim:er.enemyParticles')}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Stepper value={pMin} onChange={setPMin} step={1} min={0} disabled={running} widthClass="w-12" />
              <span>{rangeMark}</span>
              <Stepper value={pMax} onChange={setPMax} step={1} min={0} disabled={running} widthClass="w-12" />
              <span>{t('gcsim:er.enemyParticlesEvery')}</span>
              <Stepper value={pAmount} onChange={setPAmount} step={1} min={0} disabled={running} widthClass="w-12" />
              <span>{t('gcsim:er.enemyParticlesUnit')}</span>
              <button onClick={() => { setPMin(String(ER_DEFAULT_ENEMY_PARTICLES.minSeconds)); setPMax(String(ER_DEFAULT_ENEMY_PARTICLES.maxSeconds)); setPAmount(String(ER_DEFAULT_ENEMY_PARTICLES.amount)); }} disabled={running} className="ml-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40">{t('gcsim:er.enemyParticlesReset')}</button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.enemyParticlesNote')}</p>
          </div>

          <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <p className="font-bold">{t('gcsim:er.burstWait')}</p>
            <div className="flex items-center gap-1.5">
              <Stepper value={wait} onChange={setWait} step={0.1} min={0} decimals={1} disabled={running} widthClass="w-14" />
              <span>{t('gcsim:er.burstWaitUnit')}</span>
              <button onClick={() => setWait(ER_DEFAULT_BURST_WAIT_SECONDS.toFixed(1))} disabled={running} className="ml-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40">{t('gcsim:er.enemyParticlesReset')}</button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.burstWaitNote')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
