import React from 'react';
import { Filter, Sword } from 'lucide-react';
import { ElementType, WeaponType } from '../types/genshin';

export type ElementFilterValue = ElementType | 'all';
export type WeaponFilterValue = WeaponType | 'all';

export const ELEMENT_FILTER_OPTIONS: Array<{ id: ElementFilterValue; label: string; color: string; icon: string }> = [
  { id: 'all', label: '全元素', color: '#94a3b8', icon: '✦' },
  { id: 'pyro', label: '炎', color: '#ef4444', icon: '🔥' },
  { id: 'hydro', label: '水', color: '#0284c7', icon: '💧' },
  { id: 'electro', label: '雷', color: '#a855f7', icon: '⚡' },
  { id: 'dendro', label: '草', color: '#10b981', icon: '🌿' },
  { id: 'cryo', label: '氷', color: '#06b6d4', icon: '❄️' },
  { id: 'anemo', label: '風', color: '#14b8a6', icon: '🌀' },
  { id: 'geo', label: '岩', color: '#f59e0b', icon: '🪨' },
  { id: 'physical', label: '物理', color: '#64748b', icon: '⚔️' },
];

export const WEAPON_FILTER_OPTIONS: Array<{ id: WeaponFilterValue; label: string; icon: string }> = [
  { id: 'all', label: '全武器', icon: '✦' },
  { id: 'sword', label: '片手剣', icon: '🗡️' },
  { id: 'claymore', label: '両手剣', icon: '⚔️' },
  { id: 'polearm', label: '長柄武器', icon: '🔱' },
  { id: 'bow', label: '弓', icon: '🏹' },
  { id: 'catalyst', label: '法器', icon: '📖' },
];

/** 元素・武器種フィルターに一致するか */
export const matchesCharacterFilter = (
  c: { element: ElementType; weaponType: WeaponType },
  elementFilter: ElementFilterValue,
  weaponFilter: WeaponFilterValue,
): boolean =>
  (elementFilter === 'all' || c.element === elementFilter) &&
  (weaponFilter === 'all' || c.weaponType === weaponFilter);

interface CharacterFilterBarProps {
  elementFilter: ElementFilterValue;
  onElementFilterChange: (value: ElementFilterValue) => void;
  weaponFilter: WeaponFilterValue;
  onWeaponFilterChange: (value: WeaponFilterValue) => void;
  className?: string;
}

/** キャラクターの元素・武器種フィルター（パーティ編成画面・DB管理画面で共通） */
export const CharacterFilterBar: React.FC<CharacterFilterBarProps> = ({
  elementFilter,
  onElementFilterChange,
  weaponFilter,
  onWeaponFilterChange,
  className = '',
}) => (
  <div className={`space-y-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 ${className}`}>
    {/* Element Filter Bar */}
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-[10px] font-bold text-slate-400 mr-1 flex items-center gap-1">
        <Filter className="w-3 h-3 text-amber-400" /> 元素:
      </span>
      {ELEMENT_FILTER_OPTIONS.map((elem) => {
        const isActive = elementFilter === elem.id;
        return (
          <button
            key={elem.id}
            type="button"
            onClick={() => onElementFilterChange(elem.id)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-all border ${
              isActive
                ? 'text-white shadow-sm scale-105 font-extrabold'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
            }`}
            style={
              isActive
                ? {
                    backgroundColor: `${elem.color}33`,
                    borderColor: elem.color,
                    color: elem.color === '#94a3b8' ? '#ffffff' : elem.color,
                    boxShadow: `0 0 8px ${elem.color}40`,
                  }
                : {}
            }
          >
            <span>{elem.icon}</span>
            <span>{elem.label}</span>
          </button>
        );
      })}
    </div>

    {/* Weapon Filter Bar */}
    <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-slate-800/60">
      <span className="text-[10px] font-bold text-slate-400 mr-1 flex items-center gap-1">
        <Sword className="w-3 h-3 text-amber-400" /> 武器:
      </span>
      {WEAPON_FILTER_OPTIONS.map((w) => {
        const isActive = weaponFilter === w.id;
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => onWeaponFilterChange(w.id)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-all border ${
              isActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/80 shadow-sm scale-105 font-extrabold'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span>{w.icon}</span>
            <span>{w.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);
