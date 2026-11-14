import React, { useState, useEffect, useRef } from 'react';
import { X, Pencil, AlertTriangle } from 'lucide-react';
import { SavedRotationSlot } from '../types/genshin';
import { findSlotByName } from '../utils/storage';
import { Trans } from 'react-i18next';
import { t } from '../i18n';

interface RenameSlotDialogProps {
  /** 名前を変える保存編成（null のとき閉じている） */
  slot: SavedRotationSlot | null;
  /** 入力欄の初期値（今の表示名） */
  initialName: string;
  savedSlots: SavedRotationSlot[];
  onClose: () => void;
  onRename: (slot: SavedRotationSlot, newName: string) => void;
}

/** 保存編成の名前を変えるポップアップ。ほかの保存編成と同じ名前にはできない */
export const RenameSlotDialog: React.FC<RenameSlotDialogProps> = ({
  slot,
  initialName,
  savedSlots,
  onClose,
  onRename,
}) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (slot) {
      setName(initialName);
      // 開いた直後に全選択して、そのまま打ち替えられるようにする
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [slot, initialName]);

  if (!slot) return null;

  const trimmed = name.trim();
  // 自分自身との一致は、重複にしない
  const found = trimmed ? findSlotByName(savedSlots, trimmed) : undefined;
  const duplicate = found && found.id !== slot.id ? found : undefined;
  const canSubmit = !!trimmed && !duplicate;

  const submit = () => {
    if (!canSubmit) return;
    onRename(slot, trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Pencil className="w-4 h-4 text-amber-400" />
            <span>{t('save:rename.title')}</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">{t('save:saveAs.name')}</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
              }}
              placeholder={t('save:saveAs.namePlaceholder')}
              data-testid="rename-slot-input"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
            />
          </div>

          {duplicate ? (
            <div
              className="p-3 rounded-lg bg-red-950/60 border border-red-500/50 text-xs text-red-200 flex items-start gap-2"
              data-testid="rename-slot-duplicate"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                <Trans i18nKey="save:rename.duplicate" values={{ name: duplicate.name }} components={{ strong: <strong /> }} />
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">{t('save:rename.hint')}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/70">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {t('action.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            data-testid="rename-slot-submit"
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 transition-colors shadow"
          >
            {t('save:rename.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};
