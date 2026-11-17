import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Stepper } from './Stepper';
import { t, type TranslationKey } from '../i18n';
import type { CharacterConfig, CustomStats } from '../types/genshin';
import type { AppDatabase } from '../types/database';
import { previewFinalStats, type FinalStatsResult } from '../utils/gcsim/finalStatsPreview';
import { ARTIFACT_STAT_KEYS, DEFAULT_CUSTOM_STATS } from '../utils/customStats';

interface StatsEditModalProps {
  /** 開いたときの値（持ちキャラの装備を適用中ならその値、そうでなければ保存済みの仮値か既定の仮値） */
  initial: CustomStats;
  /** 持ちキャラの装備を適用中か（説明の出し分け用） */
  fromOwned: boolean;
  /** 最終ステータス（参考）の計算に使う、この枠のキャラ（武器・聖遺物・凸を解決済み）と DB */
  previewChar?: CharacterConfig;
  database: Pick<AppDatabase, 'weapons' | 'artifacts'>;
  onSave: (stats: CustomStats) => void;
  onClose: () => void;
}

const MAX_LEVELS = [20, 40, 50, 60, 70, 80, 90, 95, 100];
/** 設定値を最後に変えてから、最終ステータスを計算するまでの待ち時間 */
const PREVIEW_DELAY_MS = 2000;
const toText = (n: number) => String(Number(n.toFixed(4)));
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** 編成の設定にある項目（凸・諭示・魔女の課題・武器・聖遺物）以外のステータスを変更する画面。保存した値は、その枠の仮値になる */
export const StatsEditModal: React.FC<StatsEditModalProps> = ({ initial, fromOwned, previewChar, database, onSave, onClose }) => {
  const [level, setLevel] = useState(String(initial.level));
  const [maxLevel, setMaxLevel] = useState(initial.maxLevel);
  const [talents, setTalents] = useState(initial.talents.map(String));
  const [weaponLevel, setWeaponLevel] = useState(String(initial.weaponLevel));
  const [weaponMaxLevel, setWeaponMaxLevel] = useState(initial.weaponMaxLevel);
  // 聖遺物ステータス（% の項目は、百分率で入力する）
  const initialStatText = (key: string, percent: boolean) => {
    const v = initial.artifactStats[key];
    return v === undefined ? '0' : toText(percent ? v * 100 : v);
  };
  const [statTexts, setStatTexts] = useState<Record<string, string>>(
    () => Object.fromEntries(ARTIFACT_STAT_KEYS.map(s => [s.key, initialStatText(s.key, s.percent)])),
  );

  const intIn = (s: string, min: number, max: number): number | null => {
    const n = Number(s);
    return s.trim() !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const levelN = intIn(level, 1, maxLevel);
  const weaponLevelN = intIn(weaponLevel, 1, weaponMaxLevel);
  const talentNs = talents.map(s => intIn(s, 1, 15));
  const statNs = ARTIFACT_STAT_KEYS.map(s => {
    const text = statTexts[s.key].trim();
    if (text === '') return { key: s.key, value: undefined as number | undefined, ok: true };
    const n = Number(text);
    return { key: s.key, value: Number.isFinite(n) && Math.abs(n) < 100000 ? (s.percent ? n / 100 : n) : undefined, ok: Number.isFinite(n) && Math.abs(n) < 100000 };
  });
  const valid = levelN !== null && weaponLevelN !== null && talentNs.every(n => n !== null) && statNs.every(s => s.ok);

  // 入力中の値（検査に通らないときは null）
  const current = useMemo((): CustomStats | null => {
    if (!valid) return null;
    const artifactStats: Record<string, number> = {};
    for (const s of statNs) if (s.value !== undefined && s.value !== 0) artifactStats[s.key] = Number(s.value.toFixed(6));
    return {
      level: levelN!, maxLevel, talents: talentNs as unknown as [number, number, number],
      weaponLevel: weaponLevelN!, weaponMaxLevel, artifactStats,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, maxLevel, talents, weaponLevel, weaponMaxLevel, statTexts]);

  // gcsim が計算する最終ステータス（参考）。設定値を変えるたびに、待ち時間（2 秒）をはじめから数え直し、入力が止まって 2 秒たってから 1 回だけ実行する。
  // 待っている間は、前の結果を出したままにする（初回だけ「計算中…」）
  const [preview, setPreview] = useState<FinalStatsResult | 'loading' | null>(null);
  useEffect(() => {
    if (!previewChar || !current) { setPreview(null); return; }
    let cancelled = false;
    setPreview(p => (p !== null && p !== 'loading' && p.status === 'ok' ? p : 'loading'));
    const timer = setTimeout(() => {
      previewFinalStats(previewChar, current, database).then(r => { if (!cancelled) setPreview(r); }).catch(e => { if (!cancelled) setPreview({ status: 'error', message: String(e) }); });
    }, PREVIEW_DELAY_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [previewChar, current, database]);

  const handleSave = () => {
    if (current) onSave(current);
  };

  const handleReset = () => {
    const d = DEFAULT_CUSTOM_STATS;
    setLevel(String(d.level)); setMaxLevel(d.maxLevel); setTalents(d.talents.map(String));
    setWeaponLevel(String(d.weaponLevel)); setWeaponMaxLevel(d.weaponMaxLevel);
    setStatTexts(Object.fromEntries(ARTIFACT_STAT_KEYS.map(s => {
      const v = d.artifactStats[s.key];
      return [s.key, v === undefined ? '0' : toText(s.percent ? v * 100 : v)];
    })));
  };

  const selectCls = 'bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" data-testid="stats-edit-modal" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <h2 className="text-sm font-bold text-white">{t('party:stats.title')}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-300">
          <p className="text-[11px] text-slate-400">{fromOwned ? t('party:stats.introOwned') : t('party:stats.intro')}</p>

          <div className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 items-center">
            <span className="font-semibold text-slate-200">{t('party:stats.charLevel')}</span>
            <span className="flex items-center gap-1.5">
              <Stepper value={level} onChange={setLevel} step={1} min={1} max={maxLevel} widthClass="w-16" invalid={levelN === null} testId="stats-level" />
              <span>/</span>
              <select value={maxLevel} onChange={e => setMaxLevel(Number(e.target.value))} className={selectCls} data-testid="stats-max-level">
                {MAX_LEVELS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </span>
            <span className="font-semibold text-slate-200">{t('party:stats.talents')}</span>
            <span className="flex items-center gap-1.5">
              {(['normal', 'skill', 'burst'] as const).map((k, i) => (
                <label key={k} className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500">{t(`party:stats.talent_${k}`)}</span>
                  <Stepper value={talents[i]} onChange={v => setTalents(talents.map((x, j) => j === i ? v : x))} step={1} min={1} max={15} widthClass="w-11" invalid={talentNs[i] === null} testId={`stats-talent-${i}`} />
                </label>
              ))}
            </span>
            <span className="font-semibold text-slate-200">{t('party:stats.weaponLevel')}</span>
            <span className="flex items-center gap-1.5">
              <Stepper value={weaponLevel} onChange={setWeaponLevel} step={1} min={1} max={weaponMaxLevel} widthClass="w-16" invalid={weaponLevelN === null} testId="stats-weapon-level" />
              <span>/</span>
              <select value={weaponMaxLevel} onChange={e => setWeaponMaxLevel(Number(e.target.value))} className={selectCls} data-testid="stats-weapon-max-level">
                {MAX_LEVELS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </span>
          </div>

          {previewChar && (
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 space-y-1.5" data-testid="stats-final-preview">
              <h3 className="font-bold text-slate-200">{t('party:stats.finalTitle')}</h3>
              {preview === null || preview === 'loading' ? (
                <p className="text-[11px] text-slate-500">{preview === 'loading' ? t('party:stats.finalLoading') : t('party:stats.finalInvalid')}</p>
              ) : preview.status === 'unsupported' ? (
                <p className="text-[11px] text-slate-500">{t('party:stats.finalUnsupported')}</p>
              ) : preview.status === 'error' ? (
                <p className="text-[11px] text-amber-300">{t('party:stats.finalError', { message: preview.message })}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 font-mono">
                  {([
                    ['hp', Math.round(preview.stats.hp)], ['atk', Math.round(preview.stats.atk)], ['def', Math.round(preview.stats.def)],
                    ['em', Math.round(preview.stats.em)], ['cr', pct(preview.stats.cr)], ['cd', pct(preview.stats.cd)],
                    ['er', pct(preview.stats.er)], ['heal', pct(preview.stats.heal)],
                    // 0% のダメージバフは出さない
                    ...Object.entries(preview.stats.dmgBonus).filter(([, v]) => Math.abs(v) >= 0.00005).map(([k, v]) => [k, pct(v)]),
                  ] as [string, string | number][]).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-slate-400 font-sans">{t((k.endsWith('%') && k !== 'hp%' ? `party:stats.key.${k}` : `party:stats.final.${k}`) as TranslationKey)}</span>
                      <span className="text-slate-100" data-testid={`stats-final-${k}`}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-500">{t('party:stats.finalNote')}</p>
            </div>
          )}

          <div>
            <h3 className="font-bold text-slate-200 mb-1">{t('party:stats.artifactStats')}</h3>
            <p className="text-[10px] text-slate-500 mb-2">{t('party:stats.artifactStatsHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {ARTIFACT_STAT_KEYS.map((s, i) => (
                <label key={s.key} className="flex items-center gap-2">
                  <span className="w-28 text-slate-300">{t(`party:stats.key.${s.key}` as TranslationKey)}</span>
                  <Stepper
                    value={statTexts[s.key]} onChange={v => setStatTexts({ ...statTexts, [s.key]: v })}
                    step={1} min={0} widthClass="w-20" invalid={!statNs[i].ok} testId={`stats-art-${s.key}`}
                  />
                  <span className="text-slate-500">{s.percent ? '%' : ''}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/50 shrink-0">
          <button onClick={handleReset} className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-xs" data-testid="stats-reset">{t('party:stats.reset')}</button>
          <button onClick={onClose} className="ml-auto px-3 py-1.5 rounded-lg text-slate-300 hover:text-white text-xs font-semibold">{t('party:stats.cancel')}</button>
          <button onClick={handleSave} disabled={!valid} data-testid="stats-save" className="px-4 py-1.5 rounded-lg font-bold bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 text-xs">{t('party:stats.save')}</button>
        </div>
      </div>
    </div>
  );
};
