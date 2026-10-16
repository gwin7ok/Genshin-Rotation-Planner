import React from 'react';
import { Lock, LockOpen } from 'lucide-react';

/** アイテム（キャラ・武器・聖遺物）のロック切り替えボタン（南京錠） */
interface ItemLockButtonProps {
  locked: boolean;
  onToggle: () => void;
  itemTypeLabel?: string;
}

export const ItemLockButton: React.FC<ItemLockButtonProps> = ({ locked, onToggle, itemTypeLabel = 'アイテム' }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
      locked ? 'text-sky-300 bg-sky-500/15 hover:bg-sky-500/25' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
    }`}
    title={locked
      ? `ロック中: 最新マスターデータの同期で上書きされず、全${itemTypeLabel}一括削除・全データクリアでも削除されません（クリックで解除）`
      : `ロックする: 最新マスターデータの同期での上書きや、全${itemTypeLabel}一括削除・全データクリアでの削除から保護します`}
    aria-pressed={locked}
  >
    {locked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
  </button>
);

export const CharacterLockButton = ItemLockButton;
