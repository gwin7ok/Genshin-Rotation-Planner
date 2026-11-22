import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Sparkles, Play, Square, Check } from 'lucide-react';
import { t } from '../i18n';
import { charName } from '../i18n/loc';
import type { CharacterConfig, CharacterRole, Stint } from '../types/genshin';
import type { AppDatabase } from '../types/database';
import type { HurtSetting } from '../utils/gcsim/buildGcsimConfig';
import { wasmParallelism } from '../utils/gcsim/gcsimWasm';
import { DpsConditionsForm, useDpsConditions } from './DpsConditions';
import { loadNotationMode, saveDpsSettings } from '../utils/appSettings';
import { buildRotationNotation } from '../utils/rotationNotation';
import { effectiveRoles, loadRoleOverrides, normalizeRoles, ROLE_ORDER } from '../utils/characterRoleStore';
import { knowledgeSource } from '../utils/knowledge/source';
import { expandGroupedStints } from '../utils/actionGroups';
import { DEFAULT_SEARCH_SETTINGS, searchRotation, stintsForApp, type SearchOutcome, type SearchProgress, type SearchSettings } from '../utils/rotationSearch/search';

interface AutoSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  characters: CharacterConfig[];
  database: Pick<AppDatabase, 'weapons' | 'artifacts'>;
  switchDelay: number;
  defHalt: boolean;
  hurt: HurtSetting;
  /** 選んだ候補の出場を、ガントチャートに置く */
  onApply: (stints: Stint[], loopStartIndex: number) => void;
  /** いまガントチャートにあるローテーション（「いまのローテーションから探索」の出発点） */
  currentStints: Stint[];
  currentLoopStartIndex: number;
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
export const AutoSearchDialog: React.FC<AutoSearchDialogProps> = ({ isOpen, onClose, characters, database, switchDelay, defHalt, hurt, onApply, currentStints, currentLoopStartIndex }) => {
  const [keep1, setKeep1] = useState(String(DEFAULT_SEARCH_SETTINGS.keep1));
  const [runs1, setRuns1] = useState(String(DEFAULT_SEARCH_SETTINGS.runs1));
  const [keep2, setKeep2] = useState(String(DEFAULT_SEARCH_SETTINGS.keep2));
  const [runs2, setRuns2] = useState(String(DEFAULT_SEARCH_SETTINGS.runs2));
  /** party: 編成のキャラだけから探索 / current: いまガントチャートにあるローテーションを出発点に、より DPS の高いものを探索 */
  const [mode, setMode] = useState<'party' | 'current'>('party');
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
  // 役割の既定は、開くたびにマスターのキャラの役割（データベース管理で変えていれば、その上書き）から作る。この画面での変更は、この探索だけに使い、保存しない
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaultRoles = useMemo(() => { const o = loadRoleOverrides(); return Object.fromEntries(members.map(c => [c.id, effectiveRoles(c, o)])) as Record<string, CharacterRole[]>; }, [members, isOpen]);
  const [roleEdit, setRoleEdit] = useState<Record<string, CharacterRole[]>>({});
  useEffect(() => { setRoleEdit({}); }, [defaultRoles]);
  const roles: Record<string, CharacterRole[]> = useMemo(() => Object.fromEntries(members.map(c => [c.id, roleEdit[c.id] ?? defaultRoles[c.id] ?? []])), [members, roleEdit, defaultRoles]);
  const toggleRole = (id: string, r: CharacterRole) => setRoleEdit(prev => {
    const cur = prev[id] ?? defaultRoles[id] ?? [];
    return { ...prev, [id]: normalizeRoles(cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r]) };
  });

  // いまのローテーション（編成にいるキャラの出場だけ。グループは展開する）。出場が無ければ、「いまのローテーションから探索」は使えない
  const currentSeed = useMemo(() => {
    const ids = new Set(members.map(c => c.id));
    const st = expandGroupedStints(currentStints.filter(x => ids.has(x.characterId)));
    return st.length > 0 && st.some(x => x.actions.length > 0) ? { stints: st, loopStartIndex: Math.min(currentLoopStartIndex, st.length - 1) } : null;
  }, [members, currentStints, currentLoopStartIndex]);
  const effectiveMode = mode === 'current' && currentSeed ? 'current' : 'party';
  // 結果のローテーションは、メイン画面の記法（略号 / 名称）で書く。時間（長押しの秒数・待機）は書かない
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const notationMode = useMemo(() => loadNotationMode(), [isOpen]);

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
    // 知識辞書（サーバー側）から、編成のキャラの分だけ取得する。取得できなければ、辞書なしで探索する
    const fromCurrent = effectiveMode === 'current' && currentSeed !== null;
    // 「いまのローテーションから探索」では、辞書は使わない（いまのローテーションだけを出発点に、そこから変えて登る）
    const knowledge = fromCurrent ? {} : await knowledgeSource.load(members.map(c => c.id)).catch(() => ({}));
    // アタッカー: 役割にアタッカーを持つキャラ（いまのローテーションに出るもの）。いなければ、最後に出るキャラ
    const inRot = new Set(currentSeed?.stints.map(x => x.characterId));
    const attackers = members.filter(c => inRot.has(c.id) && (roles[c.id] ?? []).includes('attacker')).map(c => c.id);
    const lastId = currentSeed?.stints[currentSeed.stints.length - 1]?.characterId;
    const attackerIds = attackers.length > 0 ? attackers : lastId ? [lastId] : [];
    const assignment = Object.fromEntries(members.map(c => [c.id, attackerIds.includes(c.id) ? 'attacker' : ((roles[c.id] ?? []).find(r => r !== 'attacker') ?? 'supporter')])) as Record<string, CharacterRole>;
    const out = await searchRotation({
      knowledge,
      // どちらのモードも、いまのローテーションを順位に載せる（結果の一番上に出す）。「いまのローテーションから探索」は、それだけを出発点にする
      ...(currentSeed ? { extraSeeds: [{ stints: currentSeed.stints, loopStartIndex: currentSeed.loopStartIndex, assignment }], keepFirstSeed: true, ...(fromCurrent ? { seedsOnly: true } : {}) } : {}),
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
      // ガントチャートには、利用者が選んだ候補だけを置く（自動では置かない）
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
  // キャラごとの、爆発のエネルギー待ち（DPS 計算と同じ仕様: 1 周あたりの回数 = 回数 ÷（周数 − 1）、待ち 1 回の平均時間。エネルギーの計算が有効なときだけ）
  const energyWaitLine = (r: { energyWaits?: Array<{ characterId: string; waits: number; seconds: number | null }>; loops?: number }): React.ReactNode => {
    if (!r.energyWaits || r.loops === undefined) return null;
    const loops = r.loops;
    const items = r.energyWaits.map(w => {
      const c = members.find(x => x.id === w.characterId);
      const name = c ? charName(c) : w.characterId;
      if (loops < 2) return null;
      const waited = w.waits > 0 && w.seconds !== null;
      // 待ちがあるキャラは、DPS の赤と同じ色で表示する
      return { id: w.characterId, waited, text: !waited || w.seconds === null ? t('gcsim:search.energyWaitItemNone', { name }) : t('gcsim:search.energyWaitItem', { name, n: (w.waits / (loops - 1)).toFixed(2), s: w.seconds.toFixed(2) }) };
    }).filter((x): x is { id: string; waited: boolean; text: string } => x !== null);
    return (
      <div className="mt-1 text-[11px] text-slate-500" title={t('gcsim:search.energyWaitTitle')} data-testid="search-energy-waits">
        {t('gcsim:search.energyWaitLabel')}: {loops < 2 ? t('gcsim:search.energyWaitNoLap') : items.map((x, i) => (
          <React.Fragment key={x.id}>{i > 0 && t('gcsim:search.energyWaitSep')}<span className={x.waited ? 'text-rose-300 font-mono' : undefined}>{x.text}</span></React.Fragment>
        ))}
      </div>
    );
  };
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

          <div className="space-y-1.5" role="radiogroup" aria-label={t('gcsim:search.modeTitle')}>
            <p className="text-xs font-bold text-slate-300">{t('gcsim:search.modeTitle')}</p>
            {(['party', 'current'] as const).map(m => {
              const disabled = running || (m === 'current' && !currentSeed);
              return (
                <label key={m} className={`flex items-start gap-2 text-xs rounded-lg border px-2.5 py-1.5 ${effectiveMode === m ? 'bg-violet-950/40 border-violet-500/50' : 'bg-slate-950/60 border-slate-800'} ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input type="radio" name="search-mode" checked={effectiveMode === m} disabled={disabled} onChange={() => setMode(m)} data-testid={`search-mode-${m}`} className="mt-0.5" />
                  <span>
                    <span className="font-bold text-slate-200">{t(`gcsim:search.mode.${m}`)}</span>
                    <span className="block text-slate-400 leading-relaxed">{t(`gcsim:search.modeHint.${m}`)}</span>
                    {m === 'current' && !currentSeed && <span className="block text-amber-300">{t('gcsim:search.modeNoCurrent')}</span>}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-300">{t('gcsim:search.rolesTitle')}</p>
            {members.length === 0 ? (
              <p className="text-xs text-amber-300">{t('gcsim:search.noMembers')}</p>
            ) : (
              <>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {members.map(c => (
                    <li key={c.id} className="flex items-center gap-2 text-xs bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 flex-wrap">
                      <span className="font-bold text-slate-200 mr-1">{charName(c)}</span>
                      {ROLE_ORDER.map(r => {
                        const on = (roles[c.id] ?? []).includes(r);
                        return (
                          <button key={r} onClick={() => toggleRole(c.id, r)} disabled={running} aria-pressed={on} data-testid={`role-${c.id}-${r}`}
                            className={`px-2 py-0.5 rounded border font-bold disabled:opacity-40 ${on ? 'bg-amber-500/20 border-amber-500/50 text-amber-200' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}`}>{roleName(r)}</button>
                        );
                      })}
                      {(roles[c.id] ?? []).length === 0 && <span className="text-slate-500">{t('gcsim:search.roleNone')}</span>}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span>{t('gcsim:search.rolesHint')}</span>
                  <button onClick={() => setRoleEdit({})} disabled={running} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40">{t('gcsim:dps.reset')}</button>
                </div>
              </>
            )}
          </div>

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
              {applied === null && <p className="text-xs text-amber-300">{t('gcsim:search.appliedFirst')}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 text-left">
                      <th className="px-2 py-1 w-10">{t('gcsim:search.colRank')}</th>
                      <th className="px-2 py-1 w-28 text-right">{t('gcsim:search.colDps')}</th>
                      <th className="px-2 py-1 w-16 text-right">{t('gcsim:search.colLength')}</th>
                      <th className="px-2 py-1 w-28 text-right" title={t('gcsim:search.colParticlesTitle')}>{t('gcsim:search.colParticles')}</th>
                      <th className="px-2 py-1">{t('gcsim:search.colRoute')}</th>
                      <th className="px-2 py-1 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {outcome.results.map((r, i) => ({ r, i })).filter(({ r, i }) => i < 10 || r.isCurrent).sort((a, b) => Number(!!b.r.isCurrent) - Number(!!a.r.isCurrent) || a.i - b.i).map(({ r, i }) => (
                      <tr key={r.candidate.id} className={`border-t border-slate-800 ${applied === i ? 'bg-violet-950/40' : ''}`}>
                        <td className="px-2 py-1.5 text-slate-300 font-bold">{i + 1}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-rose-300">{Math.round(r.dps).toLocaleString()} <span className="text-slate-500">±{Math.round(r.sd).toLocaleString()}</span></td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-400">{r.totalSeconds.toFixed(1)}s</td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-300" title={r.particles ? [...r.particles.energyByChar10s.map(x => `${charName(members.find(c => c.id === x.characterId) ?? { name: x.characterId })}: ${x.energy10s.toFixed(1)}`), t('gcsim:search.particlesDetail', { own: (r.particles.total - r.particles.enemy).toFixed(0), enemy: r.particles.enemy.toFixed(0), seconds: r.particles.seconds.toFixed(0) })].join(String.fromCharCode(10)) : undefined}>{r.particles && r.particles.seconds > 0 ? r.particles.energyPerMember10s.toFixed(1) : '-'}</td>
                        <td className="px-2 py-1.5 text-slate-300 break-words">{r.isCurrent && <span className="mr-1.5 px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-200 font-bold">{t('gcsim:search.currentBadge')}</span>}<span className="font-mono break-words" title={r.candidate.label}>{buildRotationNotation(members, stintsForApp(r.candidate.stints), r.candidate.loopStartIndex ?? 0, notationMode, false)}</span>{energyWaitLine(r)}</td>
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

          <details className="text-xs" open>
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

        </div>
      </div>
    </div>
  );
};
