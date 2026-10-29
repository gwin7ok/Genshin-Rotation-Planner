import React, { useState } from 'react';
import { X, Plus, Trash2, Zap } from 'lucide-react';
import { CharacterConfig, ElementType, WeaponType, ActionDefinition, PassiveEffectDefinition } from '../../types/genshin';
import { t } from '../../i18n';
import { elementLabel } from '../../i18n/labels';
import { CharacterLockButton } from './ItemLockButton';

/* =========================================================================
   SUB-MODALS: CHARACTER EDIT FORM
   ========================================================================= */
interface EditCharacterSubModalProps {
  character: CharacterConfig;
  onToggleLock: (locked: boolean) => void;
  onClose: () => void;
  onSave: (updated: CharacterConfig) => void;
}

export const EditCharacterSubModal: React.FC<EditCharacterSubModalProps> = ({ character, onToggleLock, onClose, onSave }) => {
  const [form, setForm] = useState<CharacterConfig>({ ...character });
  const [actions, setActions] = useState<ActionDefinition[]>([...character.availableActions]);
  const [passives, setPassives] = useState<PassiveEffectDefinition[]>([...(character.passiveEffects ?? [])]);
  const updatePassive = (index: number, patch: Partial<PassiveEffectDefinition>) => {
    setPassives(prev => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      availableActions: actions,
      passiveEffects: passives,
    });
  };

  const handleActionChange = (index: number, field: keyof ActionDefinition, val: any) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], [field]: val };
    setActions(updated);
  };

  const handleAddAction = () => {
    setActions([
      ...actions,
      {
        id: `act_${Date.now()}`,
        name: t('database:edit.newAction'),
        shortName: 'Act',
        type: 'normal',
        defaultDuration: 0.5,
        description: t('database:edit.newActionDescription'),
      }
    ]);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>{t('database:edit.characterTitle', { name: form.name })}</span>
            <span className="font-mono text-xs font-semibold text-slate-400 select-all" title={t('database:edit.characterKeyTitle')}>
              （ID:{form.id}）
            </span>
          </h3>
          <div className="flex items-center gap-1">
            <CharacterLockButton
              locked={!!form.isLocked}
              onToggle={() => {
                const locked = !form.isLocked;
                setForm(prev => ({ ...prev, isLocked: locked }));
                onToggleLock(locked);
              }}
            />
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          
          {/* Basic Information */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <h4 className="font-bold text-amber-300 text-xs">{t('database:edit.basic')}</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">{t('database:edit.characterName')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t('database:edit.element')}</label>
                <select
                  value={form.element}
                  onChange={e => setForm({ ...form, element: e.target.value as ElementType })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-amber-200"
                >
                  {(['pyro', 'hydro', 'electro', 'dendro', 'cryo', 'anemo', 'geo', 'physical'] as ElementType[]).map(elem => (
                    <option key={elem} value={elem}>{elementLabel(elem)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t('database:edit.weaponType')}</label>
                <select
                  value={form.weaponType}
                  onChange={e => setForm({ ...form, weaponType: e.target.value as WeaponType })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sky-200"
                >
                  {(['sword', 'claymore', 'polearm', 'bow', 'catalyst'] as WeaponType[]).map(wt => (
                    <option key={wt} value={wt}>{wt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t('database:edit.iconUrl')}</label>
                <input
                  type="text"
                  value={form.avatarUrl}
                  onChange={e => setForm({ ...form, avatarUrl: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* 固有天賦の効果（発動バフ）: アクション構築で出場ごとに登録し、ガントチャートで発動位置を動かす */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-lime-300 text-xs">{t('database:edit.passives', { count: passives.length })}</h4>
              <button
                type="button"
                onClick={() => setPassives(prev => [...prev, {
                  id: `${form.id}_pcustom_${Date.now()}`,
                  name: t('database:edit.newEffect'),
                  talentName: t('database:edit.newEffect'),
                  talentSlot: 1,
                  duration: 10,
                }])}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-lime-900/60 hover:bg-lime-800 text-lime-100 text-xs font-bold border border-lime-700/70"
              >
                <Plus className="w-3.5 h-3.5" /> {t('database:edit.addEffect')}
              </button>
            </div>
            {passives.length === 0 ? (
              <p className="text-[11px] text-slate-500">{t('database:edit.noPassives')}</p>
            ) : (
              <div className="space-y-2">
                {passives.map((p, idx) => (
                  <div key={p.id} className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={p.name}
                        onChange={e => updatePassive(idx, { name: e.target.value })}
                        className="flex-1 min-w-[160px] bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-semibold"
                      />
                      <span className="text-lime-400 font-bold">{t('database:edit.effectDuration')}</span>
                      <input
                        type="number"
                        min={0}
                        step="any" /* ▲▼は1秒単位。小数も保存できるよう step 制限はかけない */
                        value={p.duration ?? ''}
                        placeholder={t('notSet')}
                        onChange={e => updatePassive(idx, { duration: e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-16 bg-slate-950 border border-lime-900/60 focus:border-lime-500 rounded px-1.5 py-0.5 text-lime-300 font-mono font-bold text-center"
                      />
                      <span className="text-slate-500">s</span>
                      <span className="text-sky-400 font-bold">CT:</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={p.cooldown ?? ''}
                        placeholder={t('noneShort')}
                        onChange={e => updatePassive(idx, { cooldown: e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-16 bg-slate-950 border border-sky-900/60 focus:border-sky-500 rounded px-1.5 py-0.5 text-sky-300 font-mono font-bold text-center"
                      />
                      <span className="text-slate-500">s</span>
                      <button
                        type="button"
                        onClick={() => setPassives(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-500 hover:text-red-400"
                        title={t('database:edit.deleteEffect')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {p.description && (
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        <span className="text-slate-500">{t('database:edit.passiveSource', { name: p.talentName })}</span>{p.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Templates Manager */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sky-300 text-xs">{t('database:edit.actions', { count: actions.length })}</h4>
              <button
                type="button"
                onClick={handleAddAction}
                className="flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('database:edit.addAction')}</span>
              </button>
            </div>

            <div className="space-y-2">
              {actions.map((act, idx) => {
                const actCooldown = act.cooldown ?? 0;
                const actDuration = act.effectDuration ?? 0;
                return (
                  <div key={act.id || idx} className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={act.type}
                        onChange={e => handleActionChange(idx, 'type', e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sky-300 font-bold text-[11px]"
                      >
                        <option value="normal">{t('database:edit.typeNormal')}</option>
                        <option value="charged">{t('database:edit.typeCharged')}</option>
                        <option value="plunge_low">{t('database:edit.typePlungeLow')}</option>
                        <option value="plunge_high">{t('database:edit.typePlungeHigh')}</option>
                        <option value="skill">{t('database:edit.typeSkill')}</option>
                        <option value="skill_hold">{t('database:edit.typeSkillHold')}</option>
                        <option value="burst">{t('database:edit.typeBurst')}</option>
                        <option value="dash">{t('database:edit.typeDash')}</option>
                        <option value="jump">{t('database:edit.typeJump')}</option>
                        <option value="swap">{t('database:edit.typeSwap')}</option>
                      </select>

                      <input
                        type="text"
                        value={act.name}
                        placeholder={t('database:edit.actionName')}
                        onChange={e => handleActionChange(idx, 'name', e.target.value)}
                        className="flex-1 min-w-[130px] bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-semibold text-xs"
                      />

                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[10px]">{t('database:edit.shortName')}</span>
                        <input
                          type="text"
                          value={act.shortName}
                          placeholder={t('database:edit.shortNamePlaceholder')}
                          title={t('database:edit.shortNameTitle')}
                          onChange={e => handleActionChange(idx, 'shortName', e.target.value)}
                          className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-amber-300 font-bold font-mono text-center text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[10px]">{t('database:edit.buttonLabel')}</span>
                        <input
                          type="text"
                          value={act.buttonLabel ?? ''}
                          placeholder={act.shortName || t('database:edit.buttonLabelPlaceholder')}
                          title={t('database:edit.buttonLabelTitle')}
                          onChange={e => handleActionChange(idx, 'buttonLabel', e.target.value)}
                          className="w-24 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-sky-300 font-bold text-center text-xs"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveAction(idx)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Per-action timing specs: Motion Duration, Cooldown (CT), and Effect Duration */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono border-t border-slate-800/60">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">{t('database:edit.motionTime')}</span>
                        <input
                          type="number"
                          step="0.05"
                          value={act.defaultDuration}
                          onChange={e => handleActionChange(idx, 'defaultDuration', parseFloat(e.target.value) || 0.1)}
                          className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-amber-300 font-mono font-bold text-center"
                        />
                        <span className="text-slate-500">s</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-amber-400 font-bold">{t('database:edit.cooldown')}</span>
                        <input
                          type="number"
                          step="any" /* ▲▼は1秒単位（step="any" の既定の増減幅は1）。小数の値もそのまま保存できるよう step 制限はかけない */
                          value={actCooldown}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = [...actions];
                            updated[idx] = {
                              ...updated[idx],
                              cooldown: val,
                              startsSkillCooldown: act.type.startsWith('skill') ? true : act.startsSkillCooldown,
                              startsBurstCooldown: act.type === 'burst' ? true : act.startsBurstCooldown
                            };
                            setActions(updated);
                          }}
                          className="w-16 bg-slate-950 border border-amber-900/60 focus:border-amber-500 rounded px-1.5 py-0.5 text-amber-300 font-mono font-bold text-center"
                        />
                        <span className="text-slate-500">s</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-purple-400 font-bold">{t('database:edit.effectDuration')}</span>
                        <input
                          type="number"
                          step="any" /* ▲▼は1秒単位（step="any" の既定の増減幅は1）。小数の値もそのまま保存できるよう step 制限はかけない */
                          value={actDuration}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = [...actions];
                            updated[idx] = {
                              ...updated[idx],
                              effectDuration: val,
                            };
                            setActions(updated);
                          }}
                          className="w-16 bg-slate-950 border border-purple-900/60 focus:border-purple-500 rounded px-1.5 py-0.5 text-purple-300 font-mono font-bold text-center"
                        />
                        <span className="text-slate-500">s</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg">
              {t('action.cancel')}
            </button>
            <button type="submit" className="px-5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow-md">
              {t('database:edit.saveToDatabase')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
