import React, { useEffect, useRef, useState } from 'react';
import { X, Swords, Play, Square } from 'lucide-react';
import { DpsConditionsForm, useDpsConditions } from './DpsConditions';
import { t, rangeMark, dotMark } from '../i18n';
import { charName, loc } from '../i18n/loc';
import type { CharacterConfig } from '../types/genshin';
import type { AppDatabase } from '../types/database';
import type { EnemySetting, GcsimConfigResult } from '../utils/gcsim/buildGcsimConfig';
import { wasmParallelism } from '../utils/gcsim/gcsimWasm';
import { saveDpsSettings } from '../utils/appSettings';
import type { EnemyParticles } from '../utils/gcsim/requiredEnergyRecharge';
import { previewFinalStats, type FinalStats } from '../utils/gcsim/finalStatsPreview';
import { runGcsimSample } from '../utils/gcsim/gcsimClient';
import { GCSIM_VERSION } from '../utils/gcsim/gcsimConfig';
import { computeDps, type DpsOutcome, type DpsProgress, type DpsResult, type DpsSettings } from '../utils/gcsim/dpsCalc';

interface DpsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 今の編成・ローテーションから、DPS 計算用の gcsim 設定文を作る（周数と敵を渡す） */
  build: (extra: { loopIterations: number; enemies: EnemySetting[]; ignoreBurstEnergy: boolean; enemyParticles?: EnemyParticles }) => GcsimConfigResult;
  characters: CharacterConfig[];
  database: Pick<AppDatabase, 'weapons' | 'artifacts'>;
}

const num = (s: string, fb: number) => { const v = Number(s); return Number.isFinite(v) ? v : fb; };
const fmt = (n: number) => Math.round(n).toLocaleString();

/** DPS 計算（D343）: 初動 + ループ N 周を、種を変えて複数回 gcsim で実行し、DPS の平均とばらつき・キャラ別の内訳を表示する */
export const DpsDialog: React.FC<DpsDialogProps> = ({ isOpen, onClose, build, characters, database }) => {
  const cond = useDpsConditions();
  const { energy } = cond;
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DpsProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // configText・settings: 実行したときの設定文と設定。開き直したとき、編成・ローテーションが変わっていないかの確認に使う（D353）
  const [result, setResult] = useState<{ result: DpsResult; members: { characterId: string; name: string }[]; elapsedMs: number; energy: boolean; loops: number; configText: string; settings: DpsSettings } | null>(null);
  const [stale, setStale] = useState(false);
  // 計算中の途中経過の表に使う、編成のキャラ（結果が出るまでの間）
  const [runMembers, setRunMembers] = useState<{ characterId: string; name: string }[]>([]);
  const [notRunnable, setNotRunnable] = useState<string[]>([]);
  // キャラごとの最終ステータス（持ちキャラの装備・仮値のまま gcsim で計算した開始時の値）
  const [stats, setStats] = useState<Record<string, FinalStats>>({});
  const cancelRef = useRef(false);
  const buildRef = useRef(build);
  buildRef.current = build;

  const settingsNow = (): DpsSettings => cond.settingsNow();
  /** 設定文を作る（エネルギーを考慮しないときは、爆発を無視し、粒子も出さない） */
  const buildFor = (s: ReturnType<typeof settingsNow>) => buildRef.current({
    loopIterations: s.loops, enemies: s.enemies, ignoreBurstEnergy: !s.energy,
    // 粒子の間隔の最大が 0 のときは出さない（チャージ効率の計算と同じ）
    enemyParticles: s.energy && s.particles.amount > 0 && s.particles.maxSeconds > 0 ? s.particles : undefined,
  });

  // 開いたとき: 保存した設定を読み、実行できるかを確かめる
  useEffect(() => {
    if (!isOpen) return;
    const s = cond.loadSaved();
    setMessage(null);
    const base = buildRef.current({ loopIterations: s.loops, enemies: s.enemies, ignoreBurstEnergy: !s.energy });
    const errors = base.warnings.filter(w => w.level === 'error').map(w => w.message);
    setNotRunnable(base.runnable ? [] : errors.length > 0 ? errors : [t('gcsim:dps.notRunnableUnknown')]);
    // 前の結果があるときは、実行したときの設定で作り直した設定文が、そのときと同じか確かめる（違えば、編成・ローテーションが変わっている）
    setStale(result ? buildFor(result.settings).config !== result.configText : false);
  }, [isOpen]);

  // 装備・ステータスの表示用: 編成の各キャラの最終ステータスを求める
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStats({});
    (async () => {
      for (const c of characters) {
        if (c.id.startsWith('empty_slot_')) continue;
        const r = await previewFinalStats(c, undefined, database).catch(() => null);
        if (cancelled) return;
        if (r && r.status === 'ok') setStats(prev => ({ ...prev, [c.id]: r.stats }));
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, characters, database]);

  if (!isOpen) return null;

  const start = async () => {
    const s = settingsNow();
    saveDpsSettings(s);
    const config = buildFor(s);
    const loopsUsed = s.loops;
    cancelRef.current = false;
    setRunMembers(config.members.map(m => ({ characterId: m.characterId, name: m.name })));
    setRunning(true);
    setMessage(null);
    setProgress(null);
    const t0 = Date.now();
    const parallel = wasmParallelism();
    let outcome: DpsOutcome;
    try {
      outcome = await computeDps({ config, runs: s.runs, loops: s.loops, parallel, run: runGcsimSample, onProgress: setProgress, shouldCancel: () => cancelRef.current });
    } catch (e) {
      outcome = { status: 'error', message: e instanceof Error ? e.message : String(e) };
    }
    setRunning(false);
    setProgress(null);
    if (outcome.status === 'ok') {
      setResult({ result: outcome.result, members: outcome.members.map(m => ({ characterId: m.characterId, name: m.name })), elapsedMs: Date.now() - t0, energy: s.energy, loops: loopsUsed, configText: config.config, settings: s });
      setStale(false);
    } else if (outcome.status === 'cancelled') {
      setMessage(t('gcsim:dps.cancelled'));
    } else {
      setMessage(t('gcsim:dps.failed', { message: outcome.message }));
    }
  };

  const charOf = (id: string) => characters.find(c => c.id === id);
  const equipText = (c: CharacterConfig): string => {
    const w = c.weaponId ? database.weapons.find(x => x.id === c.weaponId) : undefined;
    const sets = c.build?.artifactSets?.length
      ? c.build.artifactSets
      : c.artifactSetId ? [{ id: c.artifactSetId, count: c.artifactSetMode === '2+2' ? 2 : 4 }] : [];
    const setNames = sets.map(s => { const a = database.artifacts.find(x => x.id === s.id); return a ? `${loc(a, 'name')}×${s.count}` : null; }).filter(Boolean).join(' / ');
    return [w ? `${loc(w, 'name')} R${c.weaponRefinementRank ?? '?'}` : null, setNames || null].filter(Boolean).join(dotMark);
  };

  // 計算中は、ここまでの途中経過の平均を出す（終わると、最終結果になる）
  const r = running ? progress?.partial : result?.result;
  // 爆発のエネルギー待ちの回数（1 周あたり）。割る数 = ローテーションの周数 − 1（最初の 1 周は、初動を含むので除く）。計算中は、画面の設定
  const waitEnergyOn = running ? energy : (result?.energy ?? false);
  const waitLoops = running ? settingsNow().loops : (result?.loops ?? 1);
  const perLap = (n: number): string | null => (waitLoops >= 2 ? (n / (waitLoops - 1)).toFixed(2) : null);
  // 爆発のエネルギー待ち 1 回あたりの平均の待ち時間（秒）。待ちが 1 回も無ければ null（周数には依らない）
  const waitSeconds = (s: number | null): string | null => (s === null ? null : s.toFixed(2));
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30"><Swords className="w-5 h-5" /></div>
            <h3 className="font-bold text-base text-white">{t('gcsim:dps.title')}</h3>
          </div>
          <button onClick={onClose} disabled={running} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40" title={t('action.close')}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm">
          <p className="text-xs text-slate-400 leading-relaxed">{t('gcsim:dps.intro')}</p>
          {notRunnable.length > 0 && (
            <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg p-3 space-y-1">
              <p className="font-bold">{t('gcsim:dps.notRunnable')}</p>
              {notRunnable.map((m, i) => <p key={i}>{m}</p>)}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {running ? (
              <button onClick={() => { cancelRef.current = true; }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 hover:bg-slate-600 text-white"><Square className="w-3.5 h-3.5" />{t('gcsim:dps.cancel')}</button>
            ) : (
              <button onClick={() => void start()} disabled={notRunnable.length > 0} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed"><Play className="w-3.5 h-3.5" />{t('gcsim:dps.start')}</button>
            )}
            {running && <span className="text-xs text-slate-300">{progress ? t('gcsim:dps.progress', { done: progress.done, total: progress.total }) : t('gcsim:dps.running')}</span>}
            {result && !running && <span className="text-xs text-slate-500">{t('gcsim:dps.lastRun', { loops: result.loops, runs: r?.runs ?? 0, seconds: (result.elapsedMs / 1000).toFixed(1) })}</span>}
          </div>
          {message && <p className="text-xs text-amber-300">{message}</p>}
          {stale && !running && result && <p className="text-xs text-amber-300" data-testid="dps-stale">{t('gcsim:dps.stale')}</p>}

          {r && r.runs > 0 && (
            <div className="space-y-3" data-testid="dps-result">
              <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                <div className="text-[11px] text-slate-400">{running ? t('gcsim:dps.totalDpsPartial', { done: progress?.done ?? 0, total: progress?.total ?? 0 }) : t('gcsim:dps.totalDps')}</div>
                <div className="text-3xl font-bold text-rose-300 font-mono" data-testid="dps-value">{fmt(r.dps.mean)}<span className="text-sm font-normal text-slate-400 ml-1">DPS</span></div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t('gcsim:dps.spread', { sd: fmt(r.dps.sd), min: fmt(r.dps.min), max: fmt(r.dps.max) })}
                </div>
                <div className="text-[11px] text-slate-500">{t('gcsim:dps.totalDamage', { total: fmt(r.total.mean), seconds: r.seconds.toFixed(1) })}</div>
                {r.stateAdjust !== 0 && (
                  <div className="text-[11px] text-fuchsia-300" data-testid="dps-state-adjust">
                    {t('gcsim:dps.stateAdjust', { amount: `${r.stateAdjust > 0 ? '+' : ''}${fmt(r.stateAdjust)}`, percent: (r.total.mean - r.stateAdjust) > 0 ? (r.stateAdjust / (r.total.mean - r.stateAdjust) * 100).toFixed(1) : '0.0' })}
                  </div>
                )}
                {r.shortRuns !== undefined && (
                  <div className="text-[11px] text-amber-300" data-testid="dps-battle-short">{t('gcsim:dps.battleShort', { count: r.shortRuns, runs: r.runs })}</div>
                )}
                {r.truncated && (
                  <div className="text-[11px] text-amber-300" data-testid="dps-truncated">
                    {t('gcsim:dps.truncated', { loops: waitLoops, worst: r.truncated.worst, count: r.truncated.count, runs: r.runs })}
                  </div>
                )}
                {waitEnergyOn && (
                  <div className="text-[11px] text-slate-500" data-testid="dps-energy-waits">
                    {perLap(r.energyWaits) === null ? t('gcsim:dps.energyWaitsNoLap') : t('gcsim:dps.energyWaitsTotal', { n: perLap(r.energyWaits), laps: waitLoops - 1 })}
                  </div>
                )}
                {waitEnergyOn && (
                  <div className="text-[11px] text-slate-500" data-testid="dps-energy-wait-seconds">
                    {waitSeconds(r.energyWaitSeconds) === null ? t('gcsim:dps.energyWaitSecondsNone') : t('gcsim:dps.energyWaitSecondsTotal', { n: waitSeconds(r.energyWaitSeconds) })}
                  </div>
                )}
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 text-left">
                    <th className="py-1.5 pr-2 font-semibold">{t('gcsim:dps.colName')}</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">{t('gcsim:dps.colDps')}</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">{t('gcsim:dps.colDamage')}</th>
                    {waitEnergyOn && <th className="py-1.5 pr-2 font-semibold text-right" title={t('gcsim:dps.colEnergyWaitsTitle', { laps: Math.max(1, waitLoops - 1) })}>{t('gcsim:dps.colEnergyWaits')}</th>}
                    {waitEnergyOn && <th className="py-1.5 pr-2 font-semibold text-right" title={t('gcsim:dps.colEnergyWaitSecondsTitle')}>{t('gcsim:dps.colEnergyWaitSeconds')}</th>}
                    <th className="py-1.5 font-semibold text-right">{t('gcsim:dps.colShare')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(running ? runMembers : result!.members).map((m, i) => {
                    const c = charOf(m.characterId);
                    const row = r.byChar[i];
                    return (
                      <tr key={m.characterId} className="border-b border-slate-800/60">
                        <td className="py-1.5 pr-2 text-slate-200">{c ? charName(c) : m.name}</td>
                        <td className="py-1.5 pr-2 text-right font-mono text-rose-200">{fmt(row.dps)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono text-slate-300">{fmt(row.damage)}</td>
                        {waitEnergyOn && <td className="py-1.5 pr-2 text-right font-mono text-slate-300" data-testid="dps-energy-wait-cell">{perLap(row.energyWaits) ?? '-'}</td>}
                        {waitEnergyOn && <td className="py-1.5 pr-2 text-right font-mono text-slate-300" data-testid="dps-energy-wait-seconds-cell">{waitSeconds(row.energyWaitSeconds) ?? '-'}</td>}
                        <td className="py-1.5 text-right">
                          <span className="inline-block align-middle h-1.5 rounded bg-rose-500/60 mr-1.5" style={{ width: `${Math.round(row.share * 80)}px` }} />
                          <span className="font-mono text-slate-300">{pct(row.share)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!r && !running && <p className="text-xs text-slate-500">{t('gcsim:dps.never')}</p>}

          <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <p className="font-bold">{t('gcsim:dps.build')}</p>
            <div className="space-y-1">
              {characters.filter(c => !c.id.startsWith('empty_slot_')).map(c => {
                const s = stats[c.id];
                return (
                  <div key={c.id} className="leading-relaxed">
                    <span className="text-slate-200 font-semibold">{charName(c)}</span>
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">{c.build ? t('gcsim:dps.buildOwned') : t('gcsim:dps.buildTentative')}</span>
                    <div className="text-[11px] text-slate-400">{equipText(c) || '-'}</div>
                    {s && <div className="text-[11px] text-slate-500 font-mono">{t('gcsim:dps.stats', { hp: fmt(s.hp), atk: fmt(s.atk), def: fmt(s.def), em: fmt(s.em), cr: pct(s.cr), cd: pct(s.cd), er: pct(s.er) })}</div>}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:dps.buildNote')}</p>
          </div>

          <DpsConditionsForm c={cond} disabled={running} />

          <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-line">{t('gcsim:dps.note', { version: GCSIM_VERSION })}</p>
        </div>
      </div>
    </div>
  );
};
