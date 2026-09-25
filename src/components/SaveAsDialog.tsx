import React, { useState, useEffect, useRef } from 'react';
import { X, FilePlus2 } from 'lucide-react';

interface SaveAsDialogProps {
  isOpen: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string, description?: string) => void;
}

/** メイン画面の「名前をつけて保存」ポップアップ */
export const SaveAsDialog: React.FC<SaveAsDialogProps> = ({
  isOpen,
  initialName,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription('');
      // 開いた直後に編成名を全選択して、そのまま打ち替えられるようにする
      requestAnimationFrame(() => nameInputRef.current?.select());
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), description.trim() || undefined);
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
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSave();
              }}
              placeholder="例: 雷電ナショナル (高速ループ最適化版)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
            />
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="メモ・備考（任意）"
            className="w-full bg-slate-950/80 border border-slate-700/60 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
          <p className="text-[11px] text-slate-500">
            新しい保存スロットとして保存します（既存の保存編成は変更されません）。
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/70">
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
        </div>
      </div>
    </div>
  );
};
