import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Save, 
  FolderOpen, 
  Download, 
  Upload, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles, 
  Clock, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle,
  FileCode,
  Layers,
  ChevronRight
} from 'lucide-react';
import { CharacterConfig, Stint, SavedRotationSlot, PartyPreset } from '../types/genshin';
import { getSavedSlots, saveSlot, deleteSlot, clearActiveState } from '../utils/storage';
import { ROTATION_PRESETS } from '../data/presets';
import { isEmptySlotCharacter } from '../data/characters';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: CharacterConfig[];
  stints: Stint[];
  loopStartTime: number;
  totalDuration: number;
  switchDelay?: number;
  actionDelay?: number;
  currentPresetId: string;
  onSelectPreset: (preset: PartyPreset) => void;
  activeSlotId: string | null;
  /** 保存スロット一覧が変わったとき。currentSlotId を渡すと「現在読み込み中の編成」もそのIDに更新する */
  onSlotsChanged: (slots: SavedRotationSlot[], currentSlotId?: string | null) => void;
  onLoadSlot: (slot: {
    characters: CharacterConfig[];
    stints: Stint[];
    loopStartTime: number;
    switchDelay?: number;
    actionDelay?: number;
    presetId?: string;
    name?: string;
    slotId?: string;
  }) => void;
  onResetToDefault: () => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  isOpen,
  onClose,
  characters,
  stints,
  loopStartTime,
  totalDuration,
  switchDelay,
  actionDelay,
  currentPresetId,
  onSelectPreset,
  activeSlotId,
  onSlotsChanged,
  onLoadSlot,
  onResetToDefault,
}) => {
  const [savedSlots, setSavedSlots] = useState<SavedRotationSlot[]>([]);
  const [newSlotName, setNewSlotName] = useState('');
  const [newSlotDesc, setNewSlotDesc] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [showJsonArea, setShowJsonArea] = useState(false);
  const [activeTab, setActiveTab] = useState<'slots' | 'json'>('slots');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // プリセット読込直後は、保存名の初期値をプリセット名にする（キャラ変更による自動命名で上書きしない）
  const presetNameForSlotRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSavedSlots(getSavedSlots());
      const charNames = characters.filter(c => !isEmptySlotCharacter(c)).map(c => c.name).join('・');
      setNewSlotName(presetNameForSlotRef.current ?? `${charNames} (${totalDuration.toFixed(1)}s)`);
      setNewSlotDesc('');
      if (!presetNameForSlotRef.current) setSaveSuccessMsg(null);
    } else {
      presetNameForSlotRef.current = null;
    }
  }, [isOpen, characters, totalDuration]);

  if (!isOpen) return null;

  const totalActionsCount = stints.reduce((sum, s) => sum + s.actions.length, 0);

  // Save new custom slot
  const handleSaveNew = () => {
    if (!newSlotName.trim()) return;
    const newSlot: SavedRotationSlot = {
      id: `slot_${Date.now()}`,
      name: newSlotName.trim(),
      description: newSlotDesc.trim() || undefined,
      updatedAt: new Date().toISOString(),
      characters,
      stints,
      loopStartTime,
      totalDuration,
      switchDelay,
      actionDelay,
    };
    const updated = saveSlot(newSlot);
    setSavedSlots(updated);
    onSlotsChanged(updated, newSlot.id);
    setSaveSuccessMsg(`「${newSlot.name}」を保存しました！`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Overwrite existing slot
  const handleOverwrite = (slot: SavedRotationSlot) => {
    const updatedSlot: SavedRotationSlot = {
      ...slot,
      characters,
      stints,
      loopStartTime,
      totalDuration,
      switchDelay,
      actionDelay,
      updatedAt: new Date().toISOString(),
    };
    const updated = saveSlot(updatedSlot);
    setSavedSlots(updated);
    onSlotsChanged(updated, slot.id);
    setSaveSuccessMsg(`「${slot.name}」を上書き保存しました！`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Delete slot
  const handleDelete = (slotId: string, name: string) => {
    const updated = deleteSlot(slotId);
    setSavedSlots(updated);
    onSlotsChanged(updated);
    setSaveSuccessMsg(`「${name}」を削除しました。`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Load slot
  const handleLoad = (slot: SavedRotationSlot) => {
    onLoadSlot({
      characters: slot.characters,
      stints: slot.stints,
      loopStartTime: slot.loopStartTime ?? 0,
      switchDelay: slot.switchDelay,
      actionDelay: slot.actionDelay,
      name: slot.name,
      slotId: slot.id,
    });
    onClose();
  };

  // Export slot or current rotation as JSON file
  const handleExportJsonFile = (slot?: SavedRotationSlot) => {
    const payload = slot ? {
      name: slot.name,
      description: slot.description,
      characters: slot.characters,
      stints: slot.stints,
      loopStartTime: slot.loopStartTime ?? 0,
      totalDuration: slot.totalDuration,
      switchDelay: slot.switchDelay,
      exportedAt: new Date().toISOString(),
    } : {
      name: newSlotName || '原神ローテーション',
      characters,
      stints,
      loopStartTime,
      totalDuration,
      switchDelay,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rotation_${(slot?.name || 'custom').replace(/\s+/g, '_')}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy JSON to clipboard
  const handleCopyJson = (slot?: SavedRotationSlot) => {
    const payload = slot ? {
      name: slot.name,
      description: slot.description,
      characters: slot.characters,
      stints: slot.stints,
      loopStartTime: slot.loopStartTime ?? 0,
      totalDuration: slot.totalDuration,
      exportedAt: new Date().toISOString(),
    } : {
      name: newSlotName || '原神ローテーション',
      characters,
      stints,
      loopStartTime,
      totalDuration,
      exportedAt: new Date().toISOString(),
    };

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    const targetId = slot ? slot.id : 'current';
    setCopiedId(targetId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Import JSON from file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.characters && parsed.stints) {
          onLoadSlot({
            characters: parsed.characters,
            stints: parsed.stints,
            loopStartTime: parsed.loopStartTime ?? 0,
            name: parsed.name,
          });
          onClose();
        } else {
          alert('無効なローテーションJSONファイルです。');
        }
      } catch (err) {
        alert('JSONファイルの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Import JSON from text area
  const handleImportText = () => {
    try {
      const parsed = JSON.parse(importJsonText.trim());
      if (parsed.characters && parsed.stints) {
        onLoadSlot({
          characters: parsed.characters,
          stints: parsed.stints,
          loopStartTime: parsed.loopStartTime ?? 0,
          name: parsed.name,
        });
        onClose();
      } else {
        alert('無効なローテーションJSON形式です。');
      }
    } catch (err) {
      alert('JSON構文が正しくありません。');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>編成管理</span>
              </h2>
              <p className="text-xs text-slate-400">
                編集した内容は自動保存されています。名前を付けてスロット保存やJSONバックアップも可能です。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto-save & Status Notice */}
        <div className="px-6 py-2.5 bg-emerald-950/40 border-b border-emerald-800/40 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>常時自動保存中:</strong> アクション順序や持続時間の編集はブラウザ内に自動記録されます。
            </span>
          </div>
          <div className="text-[11px] text-emerald-400/80 font-mono">
            現在: {characters.length}キャラ / 計{stints.length}ターン / {totalActionsCount}動作用
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="px-6 py-2 bg-amber-950/80 border-b border-amber-500/50 text-amber-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-6 pt-2 bg-slate-950/30 gap-2">
          <button
            onClick={() => setActiveTab('slots')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === 'slots'
                ? 'border-amber-400 text-amber-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>保存スロット一覧 ({savedSlots.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === 'json'
                ? 'border-amber-400 text-amber-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>JSON バックアップ・共有</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'slots' ? (
            <>
              {/* Section 0: Load from built-in presets */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-2">
                <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>プリセットから読込</span>
                </h3>
                <select
                  value={!activeSlotId && ROTATION_PRESETS.some(p => p.id === currentPresetId) ? currentPresetId : ''}
                  onChange={(e) => {
                    const p = ROTATION_PRESETS.find(x => x.id === e.target.value);
                    if (p) {
                      presetNameForSlotRef.current = p.name;
                      setNewSlotName(p.name);
                      onSelectPreset(p);
                      setSaveSuccessMsg(`プリセット「${p.name}」を読み込みました。`);
                      setTimeout(() => setSaveSuccessMsg(null), 3000);
                    }
                  }}
                  className="w-full bg-slate-900 text-xs font-semibold text-amber-200 rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="" disabled hidden>-- プリセットを選択 --</option>
                  {ROTATION_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  選択すると現在の編集内容がプリセットで置き換わります（必要なら先に下でスロット保存してください）。
                </p>
              </div>

              {/* Section 1: Save Current as New Slot */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Save className="w-4 h-4" />
                    <span>現在のローテーションを名前をつけて保存</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    計 {totalDuration.toFixed(1)}s / ループ開始 {loopStartTime.toFixed(1)}s
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newSlotName}
                      onChange={(e) => setNewSlotName(e.target.value)}
                      placeholder="例: 雷電ナショナル (高速ループ最適化版)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
                    />
                  </div>
                  <button
                    onClick={handleSaveNew}
                    disabled={!newSlotName.trim()}
                    className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>スロットに保存</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={newSlotDesc}
                  onChange={(e) => setNewSlotDesc(e.target.value)}
                  placeholder="メモ・備考（任意: 聖遺物、チャージ効率、立ち回り注意点など）"
                  className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Section 2: Saved Custom Slots List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                    <span>保存済みスロット</span>
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {savedSlots.length === 0 ? '保存されたスロットはありません' : `${savedSlots.length} 件`}
                  </span>
                </div>

                {savedSlots.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                    <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">
                      まだ保存されたカスタムローテーションがありません。
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      上の入力欄から現在のローテーションを保存できます。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {savedSlots.map((slot) => {
                      const dateStr = new Date(slot.updatedAt).toLocaleString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const slotActionCount = slot.stints.reduce((sum, s) => sum + s.actions.length, 0);

                      return (
                        <div
                          key={slot.id}
                          className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 hover:border-slate-600 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-white">{slot.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                                ⏱️ {(slot.totalDuration ?? 0).toFixed(1)}s / {slot.stints.length}ターン ({slotActionCount}手)
                              </span>
                              <span className="text-[10px] text-slate-500">{dateStr}</span>
                            </div>

                            {slot.description && (
                              <p className="text-xs text-slate-300">{slot.description}</p>
                            )}

                            {/* Character Badges */}
                            <div className="flex items-center gap-1.5 pt-1">
                              {slot.characters.map((c) => (
                                <div
                                  key={c.id}
                                  className="flex items-center gap-1 bg-slate-900/80 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300"
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: c.color }}
                                  />
                                  <span>{c.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            <button
                              onClick={() => handleLoad(slot)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1 shadow transition-colors"
                              title="このローテーションを読み込んで適用"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              <span>呼出</span>
                            </button>
                            <button
                              onClick={() => handleOverwrite(slot)}
                              className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg flex items-center gap-1 transition-colors"
                              title="現在の編集内容でこのスロットを上書き"
                            >
                              <Save className="w-3.5 h-3.5 text-amber-400" />
                              <span>上書</span>
                            </button>
                            <button
                              onClick={() => handleCopyJson(slot)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                              title="JSON形式でクリップボードにコピー"
                            >
                              {copiedId === slot.id ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleExportJsonFile(slot)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                              title="JSONファイルとしてダウンロード"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(slot.id, slot.name)}
                              className="p-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* JSON Tab */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleExportJsonFile()}
                  className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-amber-400 transition-all flex items-center gap-3 text-left group"
                >
                  <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white">JSONファイル書き出し</h4>
                    <p className="text-[11px] text-slate-400">
                      現在のローテーション設定を .json ファイルで保存
                    </p>
                  </div>
                </button>

                <label className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-amber-400 transition-all flex items-center gap-3 cursor-pointer group">
                  <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 group-hover:bg-sky-500 group-hover:text-slate-950 transition-colors">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white">JSONファイル読み込み</h4>
                    <p className="text-[11px] text-slate-400">
                      保存した .json ファイルを選択して復元
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Direct JSON Text Area */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <span>JSONテキスト直接編集・貼り付け復元</span>
                  </h4>
                  <button
                    onClick={() => handleCopyJson()}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                  >
                    {copiedId === 'current' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>コピー完了</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>現在のJSONをコピー</span>
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="ここに保存したJSONテキストを貼り付けて復元できます..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleImportText}
                    disabled={!importJsonText.trim()}
                    className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>貼り付けたJSONから復元</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-slate-800 bg-slate-950/70">
          <button
            onClick={() => {
              if (window.confirm('現在の編集内容を初期プリセットに戻しますか？')) {
                clearActiveState();
                onResetToDefault();
                onClose();
              }
            }}
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>初期プリセット状態にリセット</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
