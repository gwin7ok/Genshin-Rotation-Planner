import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Sparkles, Play, Square, Check } from 'lucide-react';
import { t } from '../i18n';
import { charName } from '../i18n/loc';
import type { CharacterConfig, Stint } from '../types/genshin';
import type { AppDatabase } from '../types/database';
import type { HurtSetting } from '../utils/gcsim/buildGcsimConfig';
import { wasmParallelism } from '../utils/gcsim/gcsimWasm';
import { DpsConditionsForm, useDpsConditions } from './DpsConditions';
import { saveDpsSettings } from '../utils/appSettings';
import { effectiveRoles, loadRoleOverrides } from '../utils/characterRoleStore';
import { DEFAULT_SEARCH_SETTINGS, searchRotation, stintsForApp, type SearchOutcome, type SearchProgress, type SearchSettings } from '../utils/rotationSearch/search';

interface AutoSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  characters: CharacterConfig[];
  database: Pick<AppDatabase, 'weapons' | 'artifacts'>;
  switchDelay: number;
  defHalt: boolean;
  hurt: HurtSetting;
  /** いまのアクション（出場の数。0 でなければ、置き換わる旨を出す） */
  stintCount: number;
  /** 選んだ候補の出場を、ガントチャートに置く */
  onApply: (stints: Stint[], loopStartIndex: number) => void;
}

const num = (s: string, fb: number, min: number, max: number): number => {
  const v = Math.floor(Number(s));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fb;
};

/** 探索の失敗の理由（内部の符号は、読める文に直す） */
const errorText = (message: string): string => {
  if (message === 'NO_CANDIDATES') return t('gcsim:search.noCandidates');
  if (message === 'NO_VALID_CANDIDATES') return t('gcsim:search.noValid');
  return t('gcsim:search.failed', { message });
};

/** ローテーション自動探索（フェーズ 9）: 編成の役割から候補を作り、gcsim で DPS の高い順に並べて、1 位をガントチャートに置く */
export const AutoSearchDialog: React.FC<AutoSearchDialogProps> = ({ isOpen, onClose, characters, database, switchDelay, defHalt, hurt, stintCount, onApply }) => {
  const [keep1, setKeep1] = useState(String(DEFAULT_SEARCH_SETTINGS.keep1));
  const [runs1, setRuns1] = useState(String(DEFAULT_SEARCH_SETTINGS.runs1));
  const [keep2, setKeep2] = useState(String(DEFAULT_SEARCH_SETTINGS.keep2));
  const [runs2, setRuns2] = useState(String(DEFAULT_SEARCH_SETTINGS.runs2));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Extract<SearchOutcome, { status: 'ok' }> | null>(null);
  /** 置いている候補（outcome.results の番号） */
  const [applied, setApplied] = useState<number | null>(null);
  const cancelRef = useRef(false);
  const cond = useDpsConditions();
  // 開くたびに、保存した DPS 計算の設定を読む（DPS 計算と共有）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isOpen) cond.loadSaved(); }, [isOpen]);

  const members = useMemo(() => characters.filter(c => !c.id.startsWith('empty_slot_')), [characters]);
  // 開くたびに、上書きを読み直す（データベース管理で変えたあとに反映される）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const roles = useMemo(() => { const o = loadRoleOverrides(); return Object.fromEntries(members.map(c => [c.id, effectiveRoles(c, o)])); }, [members, isOpen]);

  if (!isOpen) return null;

  const settingsNow = (): SearchSettings => ({
    battleSeconds: DEFAULT_SEARCH_SETTINGS.battleSeconds,
    keep1: num(keep1, DEFAULT_SEARCH_SETTINGS.keep1, 1, 2000),
    runs1: num(runs1, DEFAULT_SEARCH_SETTINGS.runs1, 1, 50),
    keep2: num(keep2, DEFAULT_SEARCH_SETTINGS.keep2, 1, 200),
    runs2: num(runs2, DEFAULT_SEARCH_SETTINGS.runs2, 1, 200),
    maxCandidates: DEFAULT_SEARCH_SETTINGS.maxCandidates,
  });

  const start = async () => {
    cancelRef.current = false;
    setRunning(true);
    setMessage(null);
    setOutcome(null);
    setApplied(null);
    setProgress({ phase: 'generate', done: 0, total: 1 });
    const dpsSettings = cond.settingsNow();
    saveDpsSettings(dpsSettings);
    const out = await searchRotation({
      characters: members,
      roles: Object.fromEntries(members.map(c => [c.id, roles[c.id] ?? []])),
      weapons: database.weapons,
      artifacts: database.artifacts,
      settings: settingsNow(),
      switchDelay,
      defHalt,
      hurt,
      dps: { loops: dpsSettings.loops, energy: dpsSettings.energy, particles: dpsSettings.particles, enemies: dpsSettings.enemies },
      cores: wasmParallelism(),
      onProgress: setProgress,
      shouldCancel: () => cancelRef.current,
    });
    setRunning(false);
    setProgress(null);
    if (out.status === 'ok') {
      setOutcome(out);
      setApplied(0);
      onApply(stintsForApp(out.results[0].candidate.stints), out.results[0].candidate.loopStartIndex ?? 0);
    } else if (out.status === 'cancelled') {
      setMessage(t('gcsim:search.cancelled'));
    } else {
      setMessage(errorText(out.message));
    }
  };

  const progressText = (p: SearchProgress): string =>
    p.phase === 'generate' ? t('gcsim:search.phase.generate')
      : p.phase === 'quick' ? t('gcsim:search.phase.quick', { done: p.done, total: p.total })
        : p.phase === 'refine' ? t('gcsim:search.phase.refine', { done: p.done, total: p.total })
        : t('gcsim:search.phase.verify', { done: p.done, total: p.total });
  const roleName = (r: string): string => (r === 'attacker' ? t('database:edit.role.attacker') : r === 'subAttacker' ? t('database:edit.role.subAttacker') : t('database:edit.role.supporter'));
  const input = 'w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono text-right';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 text-violet-300 flex items-center justify-center border border-violet-500/30"><Sparkles className="w-5 h-5" /></div>
            <h3 className="font-bold text-base text-white">{t('gcsim:search.title')}</h3>
          </div>
          <button onClick={onClose} disabled={running} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40" title={t('action.close')}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm">
          <p className="text-xs text-slate-400 leading-relaxed">{t('gcsim:search.intro')}</p>

          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-300">{t('gcsim:search.rolesTitle')}</p>
            {members.length === 0 ? (
              <p className="text-xs text-amber-300">{t('gcsim:search.noMembers')}</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {members.map(c => (
                  <li key={c.id} className="flex items-center gap-2 text-xs bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
                    <span className="font-bold text-slate-200">{charName(c)}</span>
                    <span className="text-amber-200">{(roles[c.id] ?? []).length > 0 ? (roles[c.id] ?? []).map(roleName).join('・') : t('gcsim:search.roleNone')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-slate-300 font-bold">{t('gcsim:search.settings')}</summary>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {([
                ['keep1', keep1, setKeep1],
                ['runs1', runs1, setRuns1],
                ['keep2', keep2, setKeep2],
                ['runs2', runs2, setRuns2],
              ] as const).map(([key, value, set]) => (
                <label key={key} className="flex items-center justify-between gap-2 text-slate-400">
                  <span>{t(`gcsim:search.${key}`)}</span>
                  <input type="number" min={1} value={value} onChange={e => set(e.target.value)} disabled={running} className={input} />
                </label>
              ))}
            </div>
            <p className="mt-2 text-slate-500">{t('gcsim:search.settingsHint')}</p>
          </details>

          <details className="text-xs" open>
            <summary className="cursor-pointer text-slate-300 font-bold">{t('gcsim:search.conditions')}</summary>
            <div className="mt-2 space-y-2">
              <p className="text-slate-500 leading-relaxed">{t('gcsim:search.conditionsHint')}</p>
              <DpsConditionsForm c={cond} disabled={running} showRuns={false} />
            </div>
          </details>

          {stintCount > 0 && <p className="text-xs text-amber-300">{t('gcsim:search.overwrite', { count: stintCount })}</p>}

          <div className="flex items-center gap-3 flex-wrap">
            {running ? (
              <button onClick={() => { cancelRef.current = true; }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 hover:bg-slate-600 text-white"><Square className="w-3.5 h-3.5" />{t('gcsim:search.cancel')}</button>
            ) : (
              <button onClick={() => void start()} disabled={members.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed"><Play className="w-3.5 h-3.5" />{t('gcsim:search.start')}</button>
            )}
            {running && progress && (
              <div className="flex-1 min-w-[200px] space-y-1">
                <span className="text-xs text-slate-300">{progressText(progress)}</span>
                <div className="h-1.5 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-violet-400 transition-all" style={{ width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%` }} /></div>
              </div>
            )}
          </div>
          {message && <p className="text-xs text-amber-300">{message}</p>}

          {outcome && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-200">{t('gcsim:search.resultTitle')}</h4>
              <p className="text-xs text-slate-400">{t('gcsim:search.summary', { candidates: outcome.counts.candidates, rejected: outcome.counts.rejected, quick: outcome.counts.quick, seconds: (outcome.elapsedMs / 1000).toFixed(1) })}</p>
              <p className="text-xs text-emerald-300">{t('gcsim:search.appliedFirst')}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 text-left">
                      <th className="px-2 py-1 w-10">{t('gcsim:search.colRank')}</th>
                      <th className="px-2 py-1 w-28 text-right">{t('gcsim:search.colDps')}</th>
                      <th className="px-2 py-1 w-16 text-right">{t('gcsim:search.colLength')}</th>
                      <th className="px-2 py-1">{t('gcsim:search.colRoute')}</th>
                      <th className="px-2 py-1 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {outcome.results.slice(0, 10).map((r, i) => (
                      <tr key={r.candidate.id} className={`border-t border-slate-800 ${applied === i ? 'bg-violet-950/40' : ''}`}>
                        <td className="px-2 py-1.5 text-slate-300 font-bold">{i + 1}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-rose-300">{Math.round(r.dps).toLocaleString()} <span className="text-slate-500">±{Math.round(r.sd).toLocaleString()}</span></td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-400">{r.totalSeconds.toFixed(1)}s</td>
                        <td className="px-2 py-1.5 text-slate-300 break-words">{r.candidate.label}</td>
                        <td className="px-2 py-1.5 text-right">
                          {applied === i ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300"><Check className="w-3.5 h-3.5" />{t('gcsim:search.applied')}</span>
                          ) : (
                            <button onClick={() => { setApplied(i); onApply(stintsForApp(r.candidate.stints), r.candidate.loopStartIndex ?? 0); }} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold">{t('gcsim:search.apply')}</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!cond.energy && <p className="text-[11px] text-slate-500">{t('gcsim:search.energyNote')}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
