import React, { useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { WeaponDatabaseItem } from '../../types/database';
import { WeaponModel } from '../../models/WeaponModel';
import { ItemLockButton } from './ItemLockButton';

/** 武器カード（精錬ランク R1〜R5 切り替えプレビュー対応） */
interface DatabaseWeaponCardItemProps {
  weapon: WeaponDatabaseItem;
  onToggleLock: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const DatabaseWeaponCardItem: React.FC<DatabaseWeaponCardItemProps> = ({
  weapon,
  onToggleLock,
  onEdit,
  onDelete,
}) => {
  const [selectedRank, setSelectedRank] = useState<number>(
    weapon.refinementRank ?? (weapon.rarity >= 5 ? 1 : 5)
  );
  const model = React.useMemo(
    () => WeaponModel.fromDatabase(weapon, selectedRank),
    [weapon, selectedRank]
  );

  return (
    <div
      className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
        weapon.isLocked
          ? 'border-sky-500/50 bg-sky-950/20 shadow-md shadow-sky-500/5'
          : weapon.isCustom
          ? 'border-amber-500/50 bg-slate-900/90 shadow-md shadow-amber-500/5'
          : 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold text-xs">
              {'★'.repeat(weapon.rarity)}
            </span>
            <h3 className="font-bold text-sm text-white">{weapon.name}</h3>
            {weapon.isCustom && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                カスタム
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
            <span className="capitalize">{weapon.weaponType}</span>
            {weapon.baseAttack && <span>/ 基礎攻撃 {weapon.baseAttack}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ItemLockButton
            locked={!!weapon.isLocked}
            onToggle={onToggleLock}
            itemTypeLabel="武器"
          />
          <button
            onClick={onEdit}
            className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Refinement Rank Switcher (R1..R5) */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-800/60 pt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-amber-400 font-mono">精錬:</span>
          <div className="flex gap-0.5 bg-slate-950 p-0.5 rounded border border-slate-800">
            {[1, 2, 3, 4, 5].map(r => (
              <button
                key={`db_w_rank_${weapon.id}_${r}`}
                type="button"
                onClick={() => setSelectedRank(r)}
                className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded transition-colors ${
                  selectedRank === r
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                R{r}
              </button>
            ))}
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          {model.cooldown ? `⏱️ CT ${model.cooldown}s` : ''}
          {model.duration ? ` / 効果 ${model.duration}s` : ''}
        </div>
      </div>

      {/* Passive Details for Selected Refinement */}
      <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
        <div className="font-bold text-amber-200">
          {weapon.passiveName} <span className="font-mono text-xs text-amber-400">(R{model.rank})</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">{model.description}</p>
      </div>

      {model.primaryBuffEffect && (
        <div className="flex items-center justify-between text-[11px] font-mono bg-sky-950/40 border border-sky-800/50 px-2.5 py-1 rounded text-sky-200">
          <span className="truncate mr-2">連動バフ: {model.primaryBuffEffect.name}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {model.duration !== undefined && (
              <strong className="text-amber-300">{Number(model.duration).toFixed(1)}s 持続</strong>
            )}
            {model.cooldown !== undefined && model.cooldown > 0 && (
              <span className="text-cyan-300 text-[10px]">/ CT {Number(model.cooldown).toFixed(1)}s</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
