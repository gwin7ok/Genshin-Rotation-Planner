import React from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { t } from '../../i18n';

/** アイテム（キャラ・武器・聖遺物）のロック切り替えボタン（南京錠） */
interface ItemLockButtonProps {
  locked: boolean;
  onToggle: () => void;
  itemTypeLabel?: string;
}

export const ItemLockButton: React.FC<ItemLockButtonProps> = ({ locked, onToggle, itemTypeLabel = t('item.item') }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
      locked ? 'text-sky-300 bg-sky-500/15 hover:bg-sky-500/25' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
    }`}
    title={locked
      ? t('database:lock.locked', { items: itemTypeLabel })
      : t('database:lock.unlocked', { items: itemTypeLabel })}
    aria-pressed={locked}
  >
    {locked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
  </button>
);

export const CharacterLockButton = ItemLockButton;
