import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { t } from '../i18n';
import { useDialogs } from './DialogProvider';
import { loadBattlePresets, saveBattlePresets } from '../utils/appSettings';
import { BATTLE_PRESET_MAX, BATTLE_PRESET_NAME_MAX, removePreset, savePreset, type BattleCondition, type BattleConditionPreset } from '../utils/battleCondition';

interface BattlePresetsPanelProps {
  /** 開いているか（開くたびに、保存した一覧を読み直す） */
  isOpen: boolean;
  /** いまの戦闘条件（保存するもの。「いまの条件」の印を出す比較にも使う） */
  current: BattleCondition;
  /** 保存した条件を呼び出す（呼び出し側が、入力欄に入れる） */
  onApply: (c: BattleCondition) => void;
  /** 計算中など、操作できないとき */
  busy: boolean;
  /** テスト用の ID の前に付ける名前（ER 計算の画面 = er、DPS 計算の画面 = dps） */
  testIdPrefix: string;
}

/**
 * 戦闘条件の名前付き保存（幽境モード。ボスごとの条件の呼び出し。D367）。
 * チャージ効率計算と DPS 計算の画面で共通（保存した一覧も共通）。条件には、敵・敵の状態の時間帯も含まれる（D368）
 */
export const BattlePresetsPanel: React.FC<BattlePresetsPanelProps> = ({ isOpen, current, onApply, busy, testIdPrefix }) => {
  const { confirm, alert: showAlert } = useDialogs();
  const [presets, setPresets] = useState<BattleConditionPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const p = testIdPrefix;

  useEffect(() => {
    if (!isOpen) return;
    setPresets(loadBattlePresets());
    setPresetName('');
  }, [isOpen]);

  /** いまの入力の戦闘条件に、名前を付けて保存する（同じ名前は、確認して上書き） */
  const saveCurrentAsPreset = async () => {
    const name = presetName.trim().slice(0, BATTLE_PRESET_NAME_MAX);
    if (name === '') return;
    if (presets.some(x => x.name === name) && !(await confirm(t('gcsim:er.presetOverwriteConfirm', { name }), { okLabel: t('gcsim:er.presetOverwrite'), danger: true }))) return;
    const r = savePreset(presets, name, current, () => `bc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`);
    if (r.reason === 'full') { await showAlert(t('gcsim:er.presetFull', { max: BATTLE_PRESET_MAX })); return; }
    if (r.reason) return;
    if (!saveBattlePresets(r.list)) { await showAlert(t('gcsim:er.presetSaveFailed')); return; }
    setPresets(r.list);
    setPresetName('');
  };
  const deletePreset = async (x: BattleConditionPreset) => {
    if (!(await confirm(t('gcsim:er.presetDeleteConfirm', { name: x.name }), { okLabel: t('gcsim:er.presetDelete'), danger: true }))) return;
    const list = removePreset(presets, x.id);
    if (!saveBattlePresets(list)) { await showAlert(t('gcsim:er.presetSaveFailed')); return; }
    setPresets(list);
  };

  const currentJson = JSON.stringify(current);
  return (
    <div className="space-y-1.5 pb-2 border-b border-slate-800" data-testid={`${p}-presets`}>
      <p className="font-semibold">{t('gcsim:er.presetsTitle')}</p>
      <p className="text-[11px] text-slate-500 leading-relaxed">{t('gcsim:er.presetsNote', { max: BATTLE_PRESET_MAX })}</p>
      {presets.length === 0
        ? <p className="text-slate-500" data-testid={`${p}-presets-empty`}>{t('gcsim:er.presetsEmpty')}</p>
        : (
          <ul className="space-y-1">
            {presets.map(x => (
              <li key={x.id} className="flex items-center gap-1.5" data-testid={`${p}-preset-row`}>
                <button type="button" onClick={() => onApply(x.condition)} disabled={busy} title={t('gcsim:er.presetLoadTitle')} className="flex-1 min-w-0 text-left px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40" data-testid={`${p}-preset-load`}>
                  <span className="font-semibold">{x.name}</span>
                  <span className="ml-2 text-[10px] text-slate-400">{t('gcsim:er.presetSummary', { loops: x.condition.loops, first: x.condition.firstBurstWaitSeconds.toFixed(1), timed: x.condition.timedParticles.length, enemies: x.condition.enemies.length, states: x.condition.enemyStates.length })}</span>
                  {JSON.stringify(x.condition) === currentJson && <span className="ml-2 text-[10px] text-emerald-300" data-testid={`${p}-preset-active`}>{t('gcsim:er.presetActive')}</span>}
                </button>
                <button type="button" onClick={() => void deletePreset(x)} disabled={busy} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40" title={t('gcsim:er.presetDelete')} data-testid={`${p}-preset-delete`}><Trash2 className="w-3.5 h-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      <div className="flex items-center gap-1.5 flex-wrap">
        <input type="text" value={presetName} maxLength={BATTLE_PRESET_NAME_MAX} onChange={e => setPresetName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void saveCurrentAsPreset(); }} placeholder={t('gcsim:er.presetNamePlaceholder')} disabled={busy} className="w-52 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100 text-xs placeholder:text-slate-500 disabled:opacity-40" data-testid={`${p}-preset-name`} />
        <button type="button" onClick={() => void saveCurrentAsPreset()} disabled={busy || presetName.trim() === ''} className="px-2.5 py-1 rounded bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-bold disabled:opacity-40" data-testid={`${p}-preset-save`}>
          {presets.some(x => x.name === presetName.trim()) ? t('gcsim:er.presetOverwrite') : t('gcsim:er.presetSave')}
        </button>
      </div>
    </div>
  );
};
