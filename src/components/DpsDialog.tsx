import React, { useEffect, useRef, useState } from 'react';
import { X, Swords, Play, Square, Plus, Trash2 } from 'lucide-react';
import { Stepper } from './Stepper';
import { t } from '../i18n';
import { charName, loc } from '../i18n/loc';
import type { CharacterConfig } from '../types/genshin';
import type { AppDatabase } from '../types/database';
import { DEFAULT_ENEMY, ENEMY_RESIST_KEYS, type EnemySetting, type EnemyResistKey, type GcsimConfigResult } from '../utils/gcsim/buildGcsimConfig';
import { previewFinalStats, type FinalStats } from '../utils/gcsim/finalStatsPreview';
import { runGcsimSample } from '../utils/gcsim/gcsimClient';
import { resolveEngine, wasmParallelism, getWasmCores, setWasmCores, wasmMaxCores, WASM_DEFAULT_CORES } from '../utils/gcsim/gcsimWasm';
import { GCSIM_VERSION } from '../utils/gcsim/gcsimConfig';
import { computeDps, DPS_DEFAULT_LOOPS, DPS_DEFAULT_RUNS, DPS_MAX_ENEMIES, DPS_MAX_LOOPS, DPS_MAX_RUNS, type DpsOutcome, type DpsProgress, type DpsResult } from '../utils/gcsim/dpsCalc';
import { loadDpsSettings, saveDpsSettings } from '../utils/appSettings';

interface DpsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 今の編成・ローテーションから、DPS 計算用の gcsim 設定文を作る（周数と敵を渡す） */
  build: (extra: { loopIterations: number; enemies: EnemySetting[] }) => GcsimConfigResult;
  characters: CharacterConfig[];
  database: Pick<AppDatabase, 'weapons' | 'artifacts'>;
}

const num = (s: string, fb: number) => { const v = Number(s); return Number.isFinite(v) ? v : fb; };
const fmt = (n: number) => Math.round(n).toLocaleString();

/** 敵の入力（耐性は % の文字列で持つ） */
interface EnemyInput { level: string; resist: Record<EnemyResistKey, string> }
const toInput = (e: EnemySetting): EnemyInput => ({ level: String(e.level), resist: Object.fromEntries(ENEMY_RESIST_KEYS.map(k => [k, String(Math.round(e.resist[k] * 1000) / 10)])) as Record<EnemyResistKey, string> });
const fromInput = (e: EnemyInput): EnemySetting => ({
  level: Math.min(200, Math.max(1, Math.floor(num(e.level, DEFAULT_ENEMY.level)))),
  resist: Object.fromEntries(ENEMY_RESIST_KEYS.map(k => [k, num(e.resist[k], DEFAULT_ENEMY.resist[k] * 100) / 100])) as Record<EnemyResistKey, number>,
});

/** DPS 計算（D343）: 初動 + ループ N 周を、種を変えて複数回 gcsim で実行し、DPS の平均とばらつき・キャラ別の内訳を表示する */
export const DpsDialog: React.FC<DpsDialogProps> = ({ isOpen, onClose, build, characters, database }) => {
  const [loops, setLoops] = useState(String(DPS_DEFAULT_LOOPS));
  const [runs, setRuns] = useState(String(DPS_DEFAULT_RUNS));
  const [enemies, setEnemies] = useState<EnemyInput[]>([toInput(DEFAULT_ENEMY)]);
  const [cores, setCores] = useState(String(getWasmCores()));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DpsProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ result: DpsResult; members: { characterId: string; name: string }[]; ranAt: number; elapsedMs: number; settingsText: string } | null>(null);
  const [notRunnable, setNotRunnable] = useState<string[]>([]);
  // キャラごとの最終ステータス（持ちキャラの装備・仮値のまま gcsim で計算した開始時の値）
  const [stats, setStats] = useState<Record<string, FinalStats>>({});
  const cancelRef = useRef(false);
  const buildRef = useRef(build);
  buildRef.current = build;

  const changeCores = (v: string) => {
    setCores(v);
    const n = Math.floor(Number(v));
    if (Number.isFinite(n) && n >= 1) setWasmCores(n);
  };

  const settingsNow = () => ({
    loops: Math.min(DPS_MAX_LOOPS, Math.max(1, Math.floor(num(loops, DPS_DEFAULT_LOOPS)))),
    runs: Math.min(DPS_MAX_RUNS, Math.max(1, Math.floor(num(runs, DPS_DEFAULT_RUNS)))),
    enemies: enemies.map(fromInput),
  });

  // 開いたとき: 保存した設定を読み、実行できるかを確かめる
  useEffect(() => {
    if (!isOpen) return;
    const s = loadDpsSettings();
    setLoops(String(s.loops));
    setRuns(String(s.runs));
    setEnemies(s.enemies.map(toInput));
    setMessage(null);
    const base = buildRef.current({ loopIterations: s.loops, enemies: s.enemies });
    setNotRunnable(base.runnable ? [] : base.warnings.filter(w => w.level === 'error').map(w => w.message));
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
    const config = buildRef.current({ loopIterations: s.loops, enemies: s.enemies });
    cancelRef.current = false;
    setRunning(true);
    setMessage(null);
    setProgress(null);
    const t0 = Date.now();
    const parallel = (await resolveEngine()) === 'wasm' ? wasmParallelism() : 1;
    let outcome: DpsOutcome;
    try {
      outcome = await computeDps({ config, runs: s.runs, parallel, run: runGcsimSample, onProgress: setProgress, shouldCancel: () => cancelRef.current });
    } catch (e) {
      outcome = { status: 'error', message: e instanceof Error ? e.message : String(e) };
    }
    setRunning(false);
    setProgress(null);
    if (outcome.status === 'ok') {
      setResult({ result: outcome.result, members: outcome.members.map(m => ({ characterId: m.characterId, name: m.name })), ranAt: Date.now(), elapsedMs: Date.now() - t0, settingsText: `${s.loops}/${s.runs}` });
    } else if (outcome.status === 'cancelled') {
      setMessage(t('gcsim:dps.cancelled'));
    } else {
      setMessage(t('gcsim:dps.failed', { message: outcome.message }));
    }
  };

  const charOf = (id: string) => characters.find(c => c.id === id);
  const updateEnemy = (i: number, patch: Partial<EnemyInput>) => setEnemies(list => list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const setAllResist = (i: number, v: string) => updateEnemy(i, { resist: Object.fromEntries(ENEMY_RESIST_KEYS.map(k => [k, v])) as Record<EnemyResistKey, string> });

  const equipText = (c: CharacterConfig): string => {
    const w = c.weaponId ? database.weapons.find(x => x.id === c.weaponId) : undefined;
    const sets = c.build?.artifactSets?.length
      ? c.build.artifactSets
      : c.artifactSetId ? [{ id: c.artifactSetId, count: c.artifactSetMode === '2+2' ? 2 : 4 }] : [];
    const setNames = sets.map(s => { const a = database.artifacts.find(x => x.id === s.id); return a ? `${loc(a, 'name')}×${s.count}` : null; }).filter(Boolean).join(' / ');
    return [w ? `${loc(w, 'name')} R${c.weaponRefinementRank ?? '?'}` : null, setNames || null].filter(Boolean).join(' ・ ');
  };

  const r = result?.result;
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
            {result && !running && <span className="text-xs text-slate-500">{t('gcsim:dps.lastRun', { loops: result.settingsText.split('/')[0], runs: r?.runs ?? 0, seconds: (result.elapsedMs / 1000).toFixed(1) })}</span>}
          </div>
          {message && <p className="text-xs text-amber-300">{message}</p>}

          {r && r.runs > 0 && (
            <div className="space-y-3" data-testid="dps-result">
              <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                <div className="text-[11px] text-slate-400">{t('gcsim:dps.totalDps')}</div>
                <div className="text-3xl font-bold text-rose-300 font-mono" data-testid="dps-value">{fmt(r.dps.mean)}<span className="text-sm font-normal text-slate-400 ml-1">DPS</span></div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t('gcsim:dps.spread', { sd: fmt(r.dps.sd), min: fmt(r.dps.min), max: fmt(r.dps.max) })}
                </div>
                <div className="text-[11px] text-slate-500">{t('gcsim:dps.totalDamage', { total: fmt(r.total.mean), seconds: r.seconds.toFixed(1) })}</div>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 text-left">
                    <th className="py-1.5 pr-2 font-semibold">{t('gcsim:dps.colName')}</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">{t('gcsim:dps.colDps')}</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">{t('gcsim:dps.colDamage')}</th>
                    <th className="py-1.5 font-semibold text-right">{t('gcsim:dps.colShare')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result!.members.map((m, i) => {
                    const c = charOf(m.characterId);
                    const row = r.byChar[i];
                    return (
                      <tr key={m.characterId} className="border-b border-slate-800/60">
                        <td className="py-1.5 pr-2 text-slate-200">{c ? charName(c) : m.name}</td>
                        <td className="py-1.5 pr-2 text-right font-mono text-rose-200">{fmt(row.dps)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono text-slate-300">{fmt(row.damage)}</td>
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

          <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <p className="font-bold">{t('gcsim:dps.loops')}</p>
            <div className="flex items-center gap-1.5">
              <Stepper value={loops} onChange={setLoops} step={1} min={1} max={DPS_MAX_LOOPS} disabled={running} widthClass="w-14" />
              <span>{t('gcsim:dps.loopsUnit')}</span>
              <button onClick={() => setLoops(String(DPS_DEFAULT_LOOPS))} disabled={running} className="ml-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40">{t('gcsim:er.enemyParticlesReset')}</button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:dps.loopsNote', { max: DPS_MAX_LOOPS })}</p>
          </div>

          <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <p className="font-bold">{t('gcsim:dps.runs')}</p>
            <div className="flex items-center gap-1.5">
              <Stepper value={runs} onChange={setRuns} step={10} min={1} max={DPS_MAX_RUNS} disabled={running} widthClass="w-16" />
              <span>{t('gcsim:dps.runsUnit')}</span>
              <button onClick={() => setRuns(String(DPS_DEFAULT_RUNS))} disabled={running} className="ml-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40">{t('gcsim:er.enemyParticlesReset')}</button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:dps.runsNote', { max: DPS_MAX_RUNS })}</p>
            <div className="flex items-center gap-1.5 pt-1">
              <span>{t('gcsim:er.cores')}</span>
              <Stepper value={cores} onChange={changeCores} step={1} min={1} max={wasmMaxCores()} disabled={running} widthClass="w-14" />
              <span className="text-[11px] text-slate-500">{t('gcsim:er.coresNote', { max: wasmMaxCores(), def: WASM_DEFAULT_CORES })}</span>
            </div>
          </div>

          <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-2">
            <p className="font-bold">{t('gcsim:dps.enemies')}</p>
            {enemies.map((e, i) => (
              <div key={i} className="border border-slate-800 rounded-md p-2 space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-slate-200">{t('gcsim:dps.enemyN', { n: i + 1 })}</span>
                  <span className="ml-2">{t('gcsim:dps.enemyLevel')}</span>
                  <Stepper value={e.level} onChange={v => updateEnemy(i, { level: v })} step={1} min={1} max={200} disabled={running} widthClass="w-14" />
                  <span className="ml-2">{t('gcsim:dps.enemyResistAll')}</span>
                  <Stepper value={e.resist.physical} onChange={v => setAllResist(i, v)} step={5} min={-100} max={200} disabled={running} widthClass="w-14" />
                  <span>%</span>
                  {enemies.length > 1 && (
                    <button onClick={() => setEnemies(list => list.filter((_, j) => j !== i))} disabled={running} className="ml-auto p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-slate-800 disabled:opacity-40" title={t('gcsim:dps.enemyRemove')}><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {ENEMY_RESIST_KEYS.map(k => (
                    <label key={k} className="flex items-center gap-1 text-[11px] text-slate-400">
                      {t(`gcsim:dps.resist.${k}`)}
                      <Stepper value={e.resist[k]} onChange={v => updateEnemy(i, { resist: { ...e.resist, [k]: v } })} step={5} min={-100} max={200} disabled={running} widthClass="w-12" />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button onClick={() => setEnemies(list => [...list, toInput(DEFAULT_ENEMY)])} disabled={running || enemies.length >= DPS_MAX_ENEMIES} className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"><Plus className="w-3 h-3" />{t('gcsim:dps.enemyAdd')}</button>
              <button onClick={() => setEnemies([toInput(DEFAULT_ENEMY)])} disabled={running} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40">{t('gcsim:er.enemyParticlesReset')}</button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:dps.enemiesNote', { max: DPS_MAX_ENEMIES })}</p>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-line">{t('gcsim:dps.note', { version: GCSIM_VERSION })}</p>
        </div>
      </div>
    </div>
  );
};
