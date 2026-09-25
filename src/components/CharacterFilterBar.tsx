import React, { useState } from 'react';
import { Filter, Sword } from 'lucide-react';
import { ElementType, WeaponType } from '../types/genshin';
import { ELEMENT_ICON_DATA_URLS } from '../data/elementIcons';

export type ElementFilterValue = ElementType | 'all';
export type WeaponFilterValue = WeaponType | 'all';

/** icon: 画像が無い・読み込めないときの代わりの絵文字。iconUrl: 元素は genshin-db の埋め込み画像 */
export const ELEMENT_FILTER_OPTIONS: Array<{ id: ElementFilterValue; label: string; color: string; icon: string; iconUrl?: string }> = [
  { id: 'all', label: '全元素', color: '#94a3b8', icon: '✦' },
  { id: 'pyro', label: '炎', color: '#ef4444', icon: '🔥', iconUrl: ELEMENT_ICON_DATA_URLS.pyro },
  { id: 'hydro', label: '水', color: '#0284c7', icon: '💧', iconUrl: ELEMENT_ICON_DATA_URLS.hydro },
  { id: 'electro', label: '雷', color: '#a855f7', icon: '⚡', iconUrl: ELEMENT_ICON_DATA_URLS.electro },
  { id: 'dendro', label: '草', color: '#10b981', icon: '🌿', iconUrl: ELEMENT_ICON_DATA_URLS.dendro },
  { id: 'cryo', label: '氷', color: '#06b6d4', icon: '❄️', iconUrl: ELEMENT_ICON_DATA_URLS.cryo },
  { id: 'anemo', label: '風', color: '#14b8a6', icon: '🌀', iconUrl: ELEMENT_ICON_DATA_URLS.anemo },
  { id: 'geo', label: '岩', color: '#f59e0b', icon: '🪨', iconUrl: ELEMENT_ICON_DATA_URLS.geo },
];

/** 武器種アイコン: enka.network のゲーム内アイコン（キャラアイコンと同じ取得元） */
const WEAPON_ICON_BASE_URL = 'https://enka.network/ui';

export const WEAPON_FILTER_OPTIONS: Array<{ id: WeaponFilterValue; label: string; icon: string; iconUrl?: string }> = [
  { id: 'all', label: '全武器', icon: '✦' },
  { id: 'sword', label: '片手剣', icon: '🗡️', iconUrl: `${WEAPON_ICON_BASE_URL}/UI_GachaTypeIcon_Sword.png` },
  { id: 'claymore', label: '両手剣', icon: '⚔️', iconUrl: `${WEAPON_ICON_BASE_URL}/UI_GachaTypeIcon_Claymore.png` },
  { id: 'polearm', label: '長柄武器', icon: '🔱', iconUrl: `${WEAPON_ICON_BASE_URL}/UI_GachaTypeIcon_Pole.png` },
  { id: 'bow', label: '弓', icon: '🏹', iconUrl: `${WEAPON_ICON_BASE_URL}/UI_GachaTypeIcon_Bow.png` },
  { id: 'catalyst', label: '法器', icon: '📖', iconUrl: `${WEAPON_ICON_BASE_URL}/UI_GachaTypeIcon_Catalyst.png` },
];

/** フィルターボタンのアイコン。画像が無い・読み込めないときは絵文字を表示 */
const FilterIcon: React.FC<{ icon: string; iconUrl?: string }> = ({ icon, iconUrl }) => {
  const [failed, setFailed] = useState(false);
  if (!iconUrl || failed) return <span>{icon}</span>;
  return <img src={iconUrl} alt="" className="w-4 h-4 object-contain shrink-0" draggable={false} onError={() => setFailed(true)} />;
};

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
            <FilterIcon icon={elem.icon} iconUrl={elem.iconUrl} />
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
            <FilterIcon icon={w.icon} iconUrl={w.iconUrl} />
            <span>{w.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);
