import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Stepper } from './Stepper';
import { CountSetting, CoresSetting, EnemyParticlesInputs, useCoresSetting } from './SharedSettings';
import { t } from '../i18n';
import { DEFAULT_ENEMY, ENEMY_RESIST_KEYS, type EnemySetting, type EnemyResistKey } from '../utils/gcsim/buildGcsimConfig';
import { DPS_DEFAULT_LOOPS, DPS_DEFAULT_RUNS, DPS_MAX_ENEMIES, DPS_MAX_LOOPS, DPS_MAX_RUNS, type DpsSettings } from '../utils/gcsim/dpsCalc';
import { loadDpsSettings } from '../utils/appSettings';
import { ER_DEFAULT_ENEMY_PARTICLES } from '../utils/gcsim/requiredEnergyRecharge';

// DPS 計算と、ローテーション自動探索の、両方にある「計算の条件」の入力（エネルギー・敵の粒子・周数・実行回数・コア数・敵）。
// 探索の結果を、DPS 計算の結果と同じ条件で比べられるよう、入力・保存先（loadDpsSettings / saveDpsSettings）を 1 か所にまとめる。

const num = (s: string, fb: number) => { const v = Number(s); return Number.isFinite(v) ? v : fb; };

/** 敵の入力（耐性は % の文字列で持つ） */
interface EnemyInput { level: string; resist: Record<EnemyResistKey, string> }
const toInput = (e: EnemySetting): EnemyInput => ({ level: String(e.level), resist: Object.fromEntries(ENEMY_RESIST_KEYS.map(k => [k, String(Math.round(e.resist[k] * 1000) / 10)])) as Record<EnemyResistKey, string> });
const fromInput = (e: EnemyInput): EnemySetting => ({
  level: Math.min(200, Math.max(1, Math.floor(num(e.level, DEFAULT_ENEMY.level)))),
  resist: Object.fromEntries(ENEMY_RESIST_KEYS.map(k => [k, num(e.resist[k], DEFAULT_ENEMY.resist[k] * 100) / 100])) as Record<EnemyResistKey, number>,
});

export interface DpsConditionsState {
  loops: string; setLoops: (v: string) => void;
  runs: string; setRuns: (v: string) => void;
  enemies: EnemyInput[]; setEnemies: React.Dispatch<React.SetStateAction<EnemyInput[]>>;
  energy: boolean; setEnergy: (v: boolean) => void;
  pMin: string; setPMin: (v: string) => void;
  pMax: string; setPMax: (v: string) => void;
  pAmount: string; setPAmount: (v: string) => void;
  cores: string; changeCores: (v: string) => void;
  /** 入力から、DPS 計算の設定を作る（範囲に丸める） */
  settingsNow: () => DpsSettings;
  /** 保存した設定を読んで、入力に入れる */
  loadSaved: () => DpsSettings;
}

export function useDpsConditions(): DpsConditionsState {
  const [loops, setLoops] = useState(String(DPS_DEFAULT_LOOPS));
  const [runs, setRuns] = useState(String(DPS_DEFAULT_RUNS));
  const [enemies, setEnemies] = useState<EnemyInput[]>([toInput(DEFAULT_ENEMY)]);
  const [energy, setEnergy] = useState(true);
  const [pMin, setPMin] = useState(String(ER_DEFAULT_ENEMY_PARTICLES.minSeconds));
  const [pMax, setPMax] = useState(String(ER_DEFAULT_ENEMY_PARTICLES.maxSeconds));
  const [pAmount, setPAmount] = useState(String(ER_DEFAULT_ENEMY_PARTICLES.amount));
  const { cores, changeCores } = useCoresSetting();
  const settingsNow = (): DpsSettings => ({
    loops: Math.min(DPS_MAX_LOOPS, Math.max(1, Math.floor(num(loops, DPS_DEFAULT_LOOPS)))),
    runs: Math.min(DPS_MAX_RUNS, Math.max(1, Math.floor(num(runs, DPS_DEFAULT_RUNS)))),
    enemies: enemies.map(fromInput),
    energy,
    particles: (() => {
      const lo = Math.max(0, num(pMin, ER_DEFAULT_ENEMY_PARTICLES.minSeconds));
      const hi = Math.max(0, num(pMax, ER_DEFAULT_ENEMY_PARTICLES.maxSeconds));
      return { minSeconds: Math.min(lo, hi), maxSeconds: Math.max(lo, hi), amount: Math.max(0, num(pAmount, ER_DEFAULT_ENEMY_PARTICLES.amount)) };
    })(),
  });
  const loadSaved = (): DpsSettings => {
    const s = loadDpsSettings();
    setLoops(String(s.loops));
    setRuns(String(s.runs));
    setEnergy(s.energy);
    setEnemies(s.enemies.map(toInput));
    setPMin(String(s.particles.minSeconds));
    setPMax(String(s.particles.maxSeconds));
    setPAmount(String(s.particles.amount));
    return s;
  };
  return { loops, setLoops, runs, setRuns, enemies, setEnemies, energy, setEnergy, pMin, setPMin, pMax, setPMax, pAmount, setPAmount, cores, changeCores, settingsNow, loadSaved };
}

/** 計算の条件の入力欄（DPS 計算・自動探索で共通） */
export const DpsConditionsForm: React.FC<{ c: DpsConditionsState; disabled?: boolean; runsNoteKey?: string; showRuns?: boolean }> = ({ c, disabled, showRuns = true }) => {
  const { enemies, setEnemies } = c;
  const updateEnemy = (i: number, patch: Partial<EnemyInput>) => setEnemies(list => list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const setAllResist = (i: number, v: string) => updateEnemy(i, { resist: Object.fromEntries(ENEMY_RESIST_KEYS.map(k => [k, v])) as Record<EnemyResistKey, string> });
  return (
    <>
      <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1.5">
        <label className="flex items-center gap-2 font-bold cursor-pointer">
          <input type="checkbox" checked={c.energy} onChange={e => c.setEnergy(e.target.checked)} disabled={disabled} data-testid="dps-energy" />
          {t('gcsim:dps.energy')}
        </label>
        {c.energy && (
          <div className="space-y-1.5">
            <span>{t('gcsim:er.enemyParticles')}</span>
            <EnemyParticlesInputs pMin={c.pMin} pMax={c.pMax} pAmount={c.pAmount} setPMin={c.setPMin} setPMax={c.setPMax} setPAmount={c.setPAmount} disabled={disabled} />
          </div>
        )}
        <p className="text-[11px] text-slate-500 leading-relaxed">{t(c.energy ? 'gcsim:dps.energyNoteOn' : 'gcsim:dps.energyNoteOff')}</p>
      </div>

      <CountSetting title={t('gcsim:dps.loops')} unit={t('gcsim:dps.loopsUnit')} note={t('gcsim:dps.loopsNote', { max: DPS_MAX_LOOPS })} value={c.loops} onChange={c.setLoops} def={DPS_DEFAULT_LOOPS} max={DPS_MAX_LOOPS} disabled={disabled} />

      {showRuns && <CountSetting title={t('gcsim:dps.runs')} unit={t('gcsim:dps.runsUnit')} note={t('gcsim:dps.runsNote', { max: DPS_MAX_RUNS })} value={c.runs} onChange={c.setRuns} def={DPS_DEFAULT_RUNS} max={DPS_MAX_RUNS} step={10} widthClass="w-16" disabled={disabled} />}
      <CoresSetting cores={c.cores} onChange={c.changeCores} disabled={disabled} />

      <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-2">
        <p className="font-bold">{t('gcsim:dps.enemies')}</p>
        {enemies.map((e, i) => (
          <div key={i} className="border border-slate-800 rounded-md p-2 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-200">{t('gcsim:dps.enemyN', { n: i + 1 })}</span>
              <span className="ml-2">{t('gcsim:dps.enemyLevel')}</span>
              <Stepper value={e.level} onChange={v => updateEnemy(i, { level: v })} step={1} min={1} max={200} disabled={disabled} widthClass="w-14" />
              <span className="ml-2">{t('gcsim:dps.enemyResistAll')}</span>
              <Stepper value={ENEMY_RESIST_KEYS.every(k => num(e.resist[k], NaN) === num(e.resist.physical, NaN)) ? e.resist.physical : ''} onChange={v => setAllResist(i, v)} step={5} min={-100} max={200} disabled={disabled} widthClass="w-14" />
              <span>%</span>
              {enemies.length > 1 && (
                <button onClick={() => setEnemies(list => list.filter((_, j) => j !== i))} disabled={disabled} className="ml-auto p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-slate-800 disabled:opacity-40" title={t('gcsim:dps.enemyRemove')}><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {ENEMY_RESIST_KEYS.map(k => (
                <label key={k} className="flex items-center gap-1 text-[11px] text-slate-400">
                  {t(`gcsim:dps.resist.${k}`)}
                  <Stepper value={e.resist[k]} onChange={v => updateEnemy(i, { resist: { ...e.resist, [k]: v } })} step={5} min={-100} max={200} disabled={disabled} widthClass="w-12" />
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <button onClick={() => setEnemies(list => [...list, toInput(DEFAULT_ENEMY)])} disabled={disabled || enemies.length >= DPS_MAX_ENEMIES} className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"><Plus className="w-3 h-3" />{t('gcsim:dps.enemyAdd')}</button>
          <button onClick={() => setEnemies([toInput(DEFAULT_ENEMY)])} disabled={disabled} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40">{t('gcsim:dps.reset')}</button>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:dps.enemiesNote', { max: DPS_MAX_ENEMIES })}</p>
      </div>
    </>
  );
};
