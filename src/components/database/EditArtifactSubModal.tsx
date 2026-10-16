import React, { useState } from 'react';
import { X, Shield } from 'lucide-react';
import { ArtifactSetDatabaseItem } from '../../types/database';
import { ItemLockButton } from './ItemLockButton';

/* =========================================================================
   SUB-MODALS: ARTIFACT EDIT FORM
   ========================================================================= */
interface EditArtifactSubModalProps {
  artifact: ArtifactSetDatabaseItem;
  onToggleLock?: (locked: boolean) => void;
  onClose: () => void;
  onSave: (updated: ArtifactSetDatabaseItem) => void;
}

export const EditArtifactSubModal: React.FC<EditArtifactSubModalProps> = ({ artifact, onToggleLock, onClose, onSave }) => {
  const [form, setForm] = useState<ArtifactSetDatabaseItem>({ ...artifact });
  const [hasBuff, setHasBuff] = useState<boolean>(!!artifact.buffEffect);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const artifactToSave = { ...form };
    if (!hasBuff) {
      delete artifactToSave.buffEffect;
      artifactToSave.buffEffects = [];
    } else if (artifactToSave.buffEffect) {
      const rawDur = typeof artifactToSave.buffEffect.duration === 'number' && !isNaN(artifactToSave.buffEffect.duration)
        ? artifactToSave.buffEffect.duration
        : 1.0;
      const duration = Math.round(Math.max(0.1, rawDur) * 10) / 10;

      const rawCd = typeof artifactToSave.buffEffect.cooldown === 'number' && !isNaN(artifactToSave.buffEffect.cooldown)
        ? artifactToSave.buffEffect.cooldown
        : undefined;
      const cooldown = (rawCd !== undefined && rawCd > 0)
        ? Math.round(rawCd * 10) / 10
        : undefined;

      artifactToSave.buffEffect = {
        ...artifactToSave.buffEffect,
        duration,
        cooldown,
      };
      // buffEffects 配列とも同期
      artifactToSave.buffEffects = [
        {
          id: artifactToSave.buffEffect.id || `abuff_${artifactToSave.id}`,
          name: artifactToSave.buffEffect.name,
          sourceType: 'artifact',
          sourceId: artifactToSave.id,
          duration,
          cooldown,
          description: artifactToSave.buffEffect.description || artifactToSave.effect4p,
          color: artifactToSave.buffEffect.color,
          statEffectSummary: artifactToSave.buffEffect.statEffect,
        }
      ];
    }
    onSave(artifactToSave);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span>聖遺物定義編集: {form.name}</span>
            <span className="font-mono text-xs font-semibold text-slate-400 select-all" title="聖遺物ID">
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
              itemTypeLabel="聖遺物"
            />
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[80vh]">
          <div>
            <label className="block text-slate-400 mb-1">聖遺物セット名</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-bold"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">2セット効果説明</label>
            <input
              type="text"
              value={form.effect2p}
              onChange={e => setForm({ ...form, effect2p: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-purple-200"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">4セット効果説明</label>
            <textarea
              rows={3}
              value={form.effect4p}
              onChange={e => setForm({ ...form, effect4p: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200"
            />
          </div>

          {/* Buff Effect */}
          <div className="space-y-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-300">
              <input
                type="checkbox"
                checked={hasBuff}
                onChange={e => {
                  setHasBuff(e.target.checked);
                  if (e.target.checked && !form.buffEffect) {
                    setForm({
                      ...form,
                      buffEffect: {
                        id: `buff_art_${Date.now()}`,
                        name: `${form.name}: 4Pバフ`,
                        duration: 12.0,
                        statEffect: '4Pセットバフ',
                        description: form.effect4p || '',
                        color: '#c084fc'
                      }
                    });
                  }
                }}
                className="rounded border-slate-700 text-purple-500 focus:ring-purple-500"
              />
              <span>タイムライン連動バフを有効化</span>
            </label>

            {hasBuff && form.buffEffect && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-slate-400 text-[10px]">バフ表示名</label>
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
                  <label className="block text-slate-400 text-[10px]">持続時間 (秒)</label>
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
                  <label className="block text-slate-400 text-[10px]">CT / クールタイム (秒)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="なし"
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
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg">
              キャンセル
            </button>
            <button type="submit" className="px-5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-md">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
