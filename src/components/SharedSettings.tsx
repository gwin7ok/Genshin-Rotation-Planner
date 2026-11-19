import React, { useState } from 'react';
import { Stepper } from './Stepper';
import { t, rangeMark } from '../i18n';
import { getWasmCores, setWasmCores, wasmMaxCores, WASM_DEFAULT_CORES } from '../utils/gcsim/gcsimWasm';
import { ER_DEFAULT_ENEMY_PARTICLES } from '../utils/gcsim/requiredEnergyRecharge';

// DPS 計算と、チャージ効率計算の、両方にある設定の部品。
// 見た目・既定値・「既定に戻す」を 1 か所にまとめる（値の保存先は、画面ごと）。

const BOX = 'text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1.5';
const RESET_BTN = 'ml-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40';

/** 使うコアの数（この端末の設定。変えると、すぐ保存する） */
export function useCoresSetting(): { cores: string; changeCores: (v: string) => void } {
  const [cores, setCores] = useState(String(getWasmCores()));
  const changeCores = (v: string) => {
    setCores(v);
    const n = Math.floor(Number(v));
    if (Number.isFinite(n) && n >= 1) setWasmCores(n);
  };
  return { cores, changeCores };
}

export function CoresSetting({ cores, onChange, disabled }: { cores: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className={BOX}>
      <p className="font-bold">{t('gcsim:er.cores')}</p>
      <div className="flex items-center gap-1.5">
        <Stepper value={cores} onChange={onChange} step={1} min={1} max={wasmMaxCores()} disabled={disabled} widthClass="w-14" />
        <span>{t('gcsim:er.coresUnit')}</span>
        <button onClick={() => onChange(String(Math.min(WASM_DEFAULT_CORES, wasmMaxCores())))} disabled={disabled} className={RESET_BTN}>{t('gcsim:er.enemyParticlesReset')}</button>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.coresNote', { max: wasmMaxCores(), def: WASM_DEFAULT_CORES })}</p>
    </div>
  );
}

/** 敵の粒子（出る間隔の下限・上限と、1 回の個数） */
export function EnemyParticlesInputs(p: {
  pMin: string; pMax: string; pAmount: string;
  setPMin: (v: string) => void; setPMax: (v: string) => void; setPAmount: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Stepper value={p.pMin} onChange={p.setPMin} step={1} min={0} disabled={p.disabled} widthClass="w-12" />
      <span>{rangeMark}</span>
      <Stepper value={p.pMax} onChange={p.setPMax} step={1} min={0} disabled={p.disabled} widthClass="w-12" />
      <span>{t('gcsim:er.enemyParticlesEvery')}</span>
      <Stepper value={p.pAmount} onChange={p.setPAmount} step={1} min={0} disabled={p.disabled} widthClass="w-12" />
      <span>{t('gcsim:er.enemyParticlesUnit')}</span>
      <button
        onClick={() => { p.setPMin(String(ER_DEFAULT_ENEMY_PARTICLES.minSeconds)); p.setPMax(String(ER_DEFAULT_ENEMY_PARTICLES.maxSeconds)); p.setPAmount(String(ER_DEFAULT_ENEMY_PARTICLES.amount)); }}
        disabled={p.disabled}
        className={RESET_BTN}
      >{t('gcsim:er.enemyParticlesReset')}</button>
    </div>
  );
}

/** 回数の設定（周回数・シード数・実行回数）。見出し + ステッパー + 単位 + 既定に戻す + 注意書き */
export function CountSetting(p: {
  title: string; unit: string; note: string;
  value: string; onChange: (v: string) => void;
  def: number; max: number; step?: number; widthClass?: string;
  disabled?: boolean; testId?: string; children?: React.ReactNode;
  /** 「既定に戻す」の右に置くボタンなど */
  extra?: React.ReactNode;
}) {
  return (
    <div className={BOX}>
      <p className="font-bold">{p.title}</p>
      <div className="flex items-center gap-1.5">
        <Stepper value={p.value} onChange={p.onChange} step={p.step ?? 1} min={1} max={p.max} disabled={p.disabled} widthClass={p.widthClass ?? 'w-14'} testId={p.testId} />
        <span>{p.unit}</span>
        <button onClick={() => p.onChange(String(p.def))} disabled={p.disabled} className={RESET_BTN}>{t('gcsim:er.enemyParticlesReset')}</button>
        {p.extra}
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">{p.note}</p>
      {p.children}
    </div>
  );
}
