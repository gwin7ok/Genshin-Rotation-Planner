import React, { useState } from 'react';
import { X, Sword } from 'lucide-react';
import { WeaponDatabaseItem } from '../../types/database';
import { WeaponType } from '../../types/genshin';
import { ItemLockButton } from './ItemLockButton';
import { t } from '../../i18n';

/* =========================================================================
   SUB-MODALS: WEAPON EDIT FORM
   ========================================================================= */
interface EditWeaponSubModalProps {
  weapon: WeaponDatabaseItem;
  onToggleLock?: (locked: boolean) => void;
  onClose: () => void;
  onSave: (updated: WeaponDatabaseItem) => void;
}

export const EditWeaponSubModal: React.FC<EditWeaponSubModalProps> = ({ weapon, onToggleLock, onClose, onSave }) => {
  const [form, setForm] = useState<WeaponDatabaseItem>({ ...weapon });
  const [hasBuff, setHasBuff] = useState<boolean>(!!weapon.buffEffect);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const weaponToSave = { ...form };
    if (!hasBuff) {
      delete weaponToSave.buffEffect;
      weaponToSave.buffEffects = [];
    } else if (weaponToSave.buffEffect) {
      const rawDur = typeof weaponToSave.buffEffect.duration === 'number' && !isNaN(weaponToSave.buffEffect.duration)
        ? weaponToSave.buffEffect.duration
        : 1.0;
      const duration = Math.round(Math.max(0.1, rawDur) * 10) / 10;

      const rawCd = typeof weaponToSave.buffEffect.cooldown === 'number' && !isNaN(weaponToSave.buffEffect.cooldown)
        ? weaponToSave.buffEffect.cooldown
        : undefined;
      const cooldown = (rawCd !== undefined && rawCd > 0)
        ? Math.round(rawCd * 10) / 10
        : undefined;

      weaponToSave.buffEffect = {
        ...weaponToSave.buffEffect,
        duration,
        cooldown,
      };
      // buffEffects 配列とも同期
      weaponToSave.buffEffects = [
        {
          id: weaponToSave.buffEffect.id || `wbuff_${weaponToSave.id}`,
          name: weaponToSave.buffEffect.name,
          sourceType: 'weapon',
          sourceId: weaponToSave.id,
          duration,
          cooldown,
          description: weaponToSave.buffEffect.description || weaponToSave.description,
          color: weaponToSave.buffEffect.color,
          statEffectSummary: weaponToSave.buffEffect.statEffect,
        }
      ];
    }
    onSave(weaponToSave);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Sword className="w-4 h-4 text-sky-400" />
            <span>{t('database:edit.weaponTitle', { name: form.name })}</span>
            <span className="font-mono text-xs font-semibold text-slate-400 select-all" title={t('database:edit.weaponId')}>
              （ID:{form.id}）
            </span>
          </h3>
          <div className="flex items-center gap-1">
            <ItemLockButton
              locked={!!form.isLocked}
              onToggle={() => {
                const locked = !form.isLocked;
                setForm(prev => ({ ...prev, isLocked: locked }));
                onToggleLock?.(locked);
              }}
              itemTypeLabel={t('item.weapon')}
            />
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[80vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1">{t('database:edit.weaponName')}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">{t('database:edit.weaponKind')}</label>
              <select
                value={form.weaponType}
                onChange={e => setForm({ ...form, weaponType: e.target.value as WeaponType })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-sky-200 capitalize font-bold"
              >
                {(['sword', 'claymore', 'polearm', 'bow', 'catalyst'] as WeaponType[]).map(wt => (
                  <option key={wt} value={wt}>{wt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">{t('database:edit.rarity')}</label>
              <select
                value={form.rarity}
                onChange={e => setForm({ ...form, rarity: parseInt(e.target.value) as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-amber-300 font-bold"
              >
                <option value={5}>{t('database:edit.rarity5')}</option>
                <option value={4}>{t('database:edit.rarity4')}</option>
                <option value={3}>{t('database:edit.rarity3')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">{t('database:edit.passiveName')}</label>
            <input
              type="text"
              value={form.passiveName}
              onChange={e => setForm({ ...form, passiveName: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-amber-200 font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">{t('database:edit.passiveDescription')}</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200"
            />
          </div>

          {/* Buff Effect連動 */}
          <div className="space-y-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-sky-300">
                <input
                  type="checkbox"
                  checked={hasBuff}
                  onChange={e => {
                    setHasBuff(e.target.checked);
                    if (e.target.checked && !form.buffEffect) {
                      setForm({
                        ...form,
                        buffEffect: {
                          id: `buff_w_${Date.now()}`,
                          name: t('database:edit.weaponBuffName', { name: form.name }),
                          duration: 12.0,
                          statEffect: t('database:edit.weaponBuffEffect'),
                          description: form.description || '',
                          color: '#38bdf8'
                        }
                      });
                    }
                  }}
                  className="rounded border-slate-700 text-sky-500 focus:ring-sky-500"
                />
                <span>{t('database:edit.enableBuff')}</span>
              </label>
            </div>

            {hasBuff && form.buffEffect && (
              <div className="space-y-2 pt-2 border-t border-slate-800 font-mono">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-400 text-[10px]">{t('database:edit.buffName')}</label>
                    <input
                      type="text"
                      value={form.buffEffect.name}
                      onChange={e => setForm({
                        ...form,
                        buffEffect: { ...form.buffEffect!, name: e.target.value }
                      })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px]">{t('database:edit.durationSeconds')}</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={form.buffEffect.duration}
                      onChange={e => setForm({
                        ...form,
                        buffEffect: { ...form.buffEffect!, duration: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-amber-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px]">{t('database:edit.cooldownSeconds')}</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder={t('noneShort')}
                      value={form.buffEffect.cooldown ?? ''}
                      onChange={e => {
                        const val = e.target.value === '' ? undefined : (parseFloat(e.target.value) || undefined);
                        setForm({
                          ...form,
                          buffEffect: { ...form.buffEffect!, cooldown: val }
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-bold placeholder-slate-600"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg">
              {t('action.cancel')}
            </button>
            <button type="submit" className="px-5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg shadow-md">
              {t('action.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
