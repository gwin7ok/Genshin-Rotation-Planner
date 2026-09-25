import React, { useState, useEffect, useRef } from 'react';
import { X, FilePlus2, AlertTriangle } from 'lucide-react';
import { SavedRotationSlot } from '../types/genshin';
import { findSlotByName } from '../utils/storage';

interface SaveAsDialogProps {
  isOpen: boolean;
  initialName: string;
  initialDescription?: string;
  savedSlots: SavedRotationSlot[];
  onClose: () => void;
  /** overwriteSlotId がある場合は、同名の既存スロットへの上書き保存 */
  onSave: (name: string, description: string | undefined, overwriteSlotId?: string) => void;
}

/** メイン画面の「名前をつけて保存」ポップアップ */
export const SaveAsDialog: React.FC<SaveAsDialogProps> = ({
  isOpen,
  initialName,
  initialDescription = '',
  savedSlots,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // 同じ編成名の既存スロット（上書き確認中）
  const [duplicateSlot, setDuplicateSlot] = useState<SavedRotationSlot | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
      setDuplicateSlot(null);
      // 開いた直後に編成名を全選択して、そのまま打ち替えられるようにする
      requestAnimationFrame(() => nameInputRef.current?.select());
    }
  }, [isOpen, initialName, initialDescription]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    const dup = findSlotByName(savedSlots, name);
    if (dup) {
      setDuplicateSlot(dup);
      return;
    }
    onSave(name.trim(), description.trim() || undefined);
  };

  const handleConfirmOverwrite = () => {
    if (!duplicateSlot) return;
    onSave(name.trim(), description.trim() || undefined, duplicateSlot.id);
  };

  const handleCancelOverwrite = () => {
    setDuplicateSlot(null);
    requestAnimationFrame(() => nameInputRef.current?.select());
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          if (duplicateSlot) handleCancelOverwrite();
          else onClose();
        }
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FilePlus2 className="w-4 h-4 text-amber-400" />
            <span>名前をつけて保存</span>
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
            <label className="text-xs font-semibold text-slate-300">編成名</label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDuplicateSlot(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  if (duplicateSlot) handleConfirmOverwrite();
                  else handleSave();
                }
              }}
              placeholder="例: 雷電ナショナル (高速ループ最適化版)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">メモ</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="メモ・備考（任意）"
              className="w-full bg-slate-950/80 border border-slate-700/60 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {duplicateSlot ? (
            <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-500/50 text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                「<strong>{duplicateSlot.name}</strong>」という編成は既に保存されています。<br />
                現在の内容で上書きしますか？
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              新しい保存スロットとして保存します。同じ名前の編成がある場合は上書き確認が表示されます。
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/70">
          {duplicateSlot ? (
            <>
              <button
                onClick={handleCancelOverwrite}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                やめる
              </button>
              <button
                onClick={handleConfirmOverwrite}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors shadow"
              >
                上書きする
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 transition-colors shadow"
              >
                名前をつけて保存
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
