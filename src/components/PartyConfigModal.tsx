import React, { useState, useEffect } from 'react';
import { X, Check, Shield, Zap, Sparkles, UserCheck, RefreshCw, ArrowLeftRight, Sword, Database, Search, Filter, Trash2 } from 'lucide-react';
import { CharacterAvatar } from './CharacterAvatar';
import { CharacterConfig, Stint, ElementType, WeaponType } from '../types/genshin';
import { AppDatabase } from '../types/database';
import { WeaponModel } from '../models/WeaponModel';
import { CharacterFilterBar, matchesCharacterFilter, type ElementFilterValue, type WeaponFilterValue } from './CharacterFilterBar';
import { ELEMENT_COLORS, ELEMENT_NAMES_JA, createEmptySlotCharacter, isEmptySlotCharacter } from '../data/characters';
import {
  migrateStintsToNewCharacter,
  refreshCharactersFromDatabase,
} from '../utils/stintReorder';

interface PartyConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: CharacterConfig[];
  stints: Stint[];
  database: AppDatabase;
  onUpdatePartyAndStints: (newCharacters: CharacterConfig[], newStints: Stint[]) => void;
}

export const PartyConfigModal: React.FC<PartyConfigModalProps> = ({
  isOpen,
  onClose,
  characters,
  stints,
  database,
  onUpdatePartyAndStints,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [editingChars, setEditingChars] = useState<CharacterConfig[]>(characters);
  const [editingStints, setEditingStints] = useState<Stint[]>(stints);

  // Filter States
  const [elementFilter, setElementFilter] = useState<ElementFilterValue>('all');
  const [weaponFilter, setWeaponFilter] = useState<WeaponFilterValue>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setEditingChars(characters);
      setEditingStints(stints);
      setWarningMsg(null);
      setConfirmClearAll(false);
    }
  }, [isOpen, characters, stints]);

  // Filtered Roster
  const filteredRoster = database.characters.filter(rosterChar => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || 
      rosterChar.name.toLowerCase().includes(q) || 
      rosterChar.id.toLowerCase().includes(q) ||
      (rosterChar.englishName ?? '').toLowerCase().includes(q) ||
      (rosterChar.weaponName && rosterChar.weaponName.toLowerCase().includes(q));
    return matchesCharacterFilter(rosterChar, elementFilter, weaponFilter) && matchesSearch;
  });

  if (!isOpen) return null;

  const currentSlotChar = editingChars[selectedSlot];

  const handleSwapCharacter = (newRosterChar: CharacterConfig) => {
    // Avoid duplicates in party
    const alreadyInParty = editingChars.some((c, i) => c.id === newRosterChar.id && i !== selectedSlot);
    if (alreadyInParty) {
      setWarningMsg(`「${newRosterChar.name}」はすでに他のスロットに編成されています。`);
      setTimeout(() => setWarningMsg(null), 3000);
      return;
    }

    const oldChar = editingChars[selectedSlot];
    const updated = [...editingChars];
    updated[selectedSlot] = {
      ...newRosterChar,
    };
    setEditingChars(updated);

    // 右隣のスロットが空（未設定）なら、続けて選べるようフォーカスを移す
    const nextSlot = selectedSlot + 1;
    if (nextSlot < updated.length && isEmptySlotCharacter(updated[nextSlot])) {
      setSelectedSlot(nextSlot);
    }

    // Automatically migrate old character's timeline stints to the new character!
    if (oldChar && !isEmptySlotCharacter(oldChar)) {
      const migrated = migrateStintsToNewCharacter(editingStints, oldChar.id, newRosterChar);
      setEditingStints(migrated);
    }
  };

  const handleMoveSlot = (fromSlot: number, toSlot: number) => {
    if (toSlot < 0 || toSlot >= editingChars.length) return;
    const charA = editingChars[fromSlot];
    const charB = editingChars[toSlot];

    const updated = [...editingChars];
    updated[fromSlot] = charB;
    updated[toSlot] = charA;
    setEditingChars(updated);
    setSelectedSlot(toSlot);

  };

  // 編成中のキャラを、DB（マスターデータ）の最新データで登録し直す（同じキャラのまま）
  const handleRefreshFromDatabase = () => {
    const result = refreshCharactersFromDatabase(editingChars, editingStints, database.characters);
    setEditingChars(result.characters);
    setEditingStints(result.stints);
    const msg = result.refreshed.length > 0
      ? `${result.refreshed.join('・')} をマスターデータで登録し直しました（「編成を保存・適用」で確定）`
      : '登録し直せるキャラがありません';
    setWarningMsg(result.missing.length > 0 ? `${msg}。DBに見つからないキャラ: ${result.missing.join('・')}` : msg);
    setTimeout(() => setWarningMsg(null), 5000);
  };

  const handleClearAll = () => {
    setEditingChars(Array.from({ length: 4 }, (_, i) => createEmptySlotCharacter(i)));
    setEditingStints([]);
    setSelectedSlot(0);
    setConfirmClearAll(false);
  };

  const handleUpdateCurrentField = (field: keyof CharacterConfig, val: any) => {
    const updated = [...editingChars];
    updated[selectedSlot] = {
      ...updated[selectedSlot],
      [field]: val,
    };
    setEditingChars(updated);
  };

  const handleSave = () => {
    onUpdatePartyAndStints(editingChars, editingStints);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base text-white">
                パーティ編成・ステータス設定 (Party Configuration)
              </h3>
              <p className="text-[11px] text-slate-400">
                スロットの入れ替えは、ガントチャートの縦軸（レーン）の並び順に反映されます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Party Slots Navigation */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/30">
          <div className="grid grid-cols-4 gap-2.5">
            {editingChars.map((c, idx) => {
              const isSelected = selectedSlot === idx;
              const elemTheme = ELEMENT_COLORS[c.element];

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedSlot(idx)}
                  className={`relative p-2.5 rounded-xl border text-left transition-all ${
                    isSelected 
                      ? 'bg-slate-800 border-amber-400 shadow-md ring-1 ring-amber-400/40' 
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">
                    SLOT {idx + 1}
                  </span>
                  <div className={`flex items-center gap-2 ${isEmptySlotCharacter(c) ? 'opacity-50' : ''}`}>
                    <CharacterAvatar char={c} className="w-7 h-7 rounded-lg text-xs" borderWidth={1.5} />
                    <div className="truncate">
                      <div className="font-bold text-xs text-white truncate">{c.name}</div>
                      <div className={`text-[10px] font-medium ${elemTheme.text}`}>
                        {isEmptySlotCharacter(c) ? '下の一覧から選択' : ELEMENT_NAMES_JA[c.element]}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Warning Notification Toast */}
        {warningMsg && (
          <div className="mx-4 mt-2 p-2.5 bg-amber-500/20 border border-amber-500/50 rounded-xl text-amber-200 text-xs font-bold flex items-center justify-between animate-fade-in">
            <span>{warningMsg}</span>
            <button onClick={() => setWarningMsg(null)} className="text-amber-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Horizontal Sync Options Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 text-xs">


          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshFromDatabase}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/40 transition-colors shadow-sm"
            title="パーティメンバー全員（同じキャラのまま）を、DB管理の最新マスターデータで登録し直します。武器・聖遺物は残し、登録済みアクションは新しいデータの同じアクションへ付け替えます（「編成を保存・適用」で確定）"
          >
            <Database className="w-3.5 h-3.5" />
            <span>全パーティメンバーをマスターデータで再登録</span>
          </button>

          {confirmClearAll ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-red-300">全キャラ・全アクションを消去しますか？</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors shadow-sm"
              >
                消去する
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                やめる
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/40 transition-colors shadow-sm"
              title="4スロットのキャラ登録と、タイムライン上の全アクション（出場ブロック）を空にします（「編成を保存・適用」で確定）"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>編成・アクションを全クリア</span>
            </button>
          )}
          </div>
        </div>

        {/* Slot Detail & Swap Roster */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {currentSlotChar && !isEmptySlotCharacter(currentSlotChar) && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>選択中スロット {selectedSlot + 1}: {currentSlotChar.name} の設定</span>
                </h4>

                {/* Swap Slot Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleMoveSlot(selectedSlot, selectedSlot - 1)}
                    disabled={selectedSlot === 0}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-25 disabled:pointer-events-none transition-colors"
                    title="このキャラを左のスロットへ移動"
                  >
                    ◀ 左のスロットへ
                  </button>
                  <button
                    onClick={() => handleMoveSlot(selectedSlot, selectedSlot + 1)}
                    disabled={selectedSlot === editingChars.length - 1}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-25 disabled:pointer-events-none transition-colors"
                    title="このキャラを右のスロットへ移動"
                  >
                    右のスロットへ ▶
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Weapon Selection from Database & Refinement Rank */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium flex items-center justify-between">
                    <span>装備武器 (DB連動)</span>
                    <span className="text-[10px] text-sky-400 font-bold">
                      {currentSlotChar.weaponType === 'sword' ? '片手剣' :
                       currentSlotChar.weaponType === 'claymore' ? '両手剣' :
                       currentSlotChar.weaponType === 'polearm' ? '長柄武器' :
                       currentSlotChar.weaponType === 'bow' ? '弓' : '法器'}
                    </span>
                  </label>

                  <div className="flex gap-1.5">
                    <select
                      value={currentSlotChar.weaponName || ''}
                      onChange={(e) => {
                        const newWeaponName = e.target.value;
                        const wObj = database.weapons.find(w => w.name === newWeaponName);
                        const defaultRank = wObj ? (wObj.refinementRank ?? (wObj.rarity >= 5 ? 1 : 5)) : 1;
                        const updated = [...editingChars];
                        updated[selectedSlot] = {
                          ...updated[selectedSlot],
                          weaponName: newWeaponName,
                          weaponRefinementRank: defaultRank,
                        };
                        setEditingChars(updated);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white text-xs focus:border-amber-400 focus:outline-none font-semibold cursor-pointer min-w-0"
                    >
                      <option value="">-- DBから武器を選択 --</option>
                      {database.weapons
                        .filter(w => w.weaponType === currentSlotChar.weaponType)
                        .sort((a, b) => Number(b.id) - Number(a.id))
                        .map(w => (
                          <option key={w.id} value={w.name}>
                            {'★'.repeat(w.rarity)} {w.name}
                          </option>
                        ))
                      }
                      {currentSlotChar.weaponName && !database.weapons.some(w => w.name === currentSlotChar.weaponName) && (
                        <option value={currentSlotChar.weaponName}>{currentSlotChar.weaponName} (カスタム入力)</option>
                      )}
                    </select>

                    {/* Refinement Rank Selector */}
                    {(() => {
                      const weaponModel = WeaponModel.findInDatabase(
                        database.weapons,
                        currentSlotChar.weaponName,
                        currentSlotChar.weaponRefinementRank
                      );
                      if (!weaponModel) return null;
                      return (
                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 shrink-0" title="精錬ランク（R1〜R5）">
                          <span className="text-[10px] text-amber-400 font-black">精錬</span>
                          <select
                            value={weaponModel.rank}
                            onChange={(e) => {
                              const r = parseInt(e.target.value, 10);
                              handleUpdateCurrentField('weaponRefinementRank', r);
                            }}
                            className="bg-slate-950 text-amber-300 font-mono text-xs font-bold px-1 py-0.5 rounded border border-slate-700 focus:outline-none focus:border-amber-400 cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5].map(r => (
                              <option key={`refine_opt_${r}`} value={r}>
                                R{r}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Weapon Dynamic Passive Details (Resolved via WeaponModel) */}
                  {(() => {
                    const weaponModel = WeaponModel.findInDatabase(
                      database.weapons,
                      currentSlotChar.weaponName,
                      currentSlotChar.weaponRefinementRank
                    );
                    if (!weaponModel) return null;
                    return (
                      <div className="bg-slate-950/70 border border-slate-800 rounded p-2 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="font-bold text-amber-300">
                            {weaponModel.passiveName} (R{weaponModel.rank})
                          </span>
                          <span className="text-slate-400">
                            {weaponModel.cooldown ? `⏱️ CT ${weaponModel.cooldown}s` : ''}
                            {weaponModel.duration ? ` / 効果 ${weaponModel.duration}s` : ''}
                          </span>
                        </div>
                        <p className="text-slate-300 line-clamp-2 text-[10px] leading-relaxed">
                          {weaponModel.description}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Artifact Set Selection from Database */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium flex items-center justify-between">
                    <span>聖遺物セット (DB連動)</span>
                  </label>
                  <select
                    value={currentSlotChar.artifactSetName || ''}
                    onChange={(e) => handleUpdateCurrentField('artifactSetName', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white text-xs focus:border-amber-400 focus:outline-none font-semibold cursor-pointer"
                  >
                    <option value="">-- DBから聖遺物を選択 --</option>
                    {[...database.artifacts]
                      .sort((a, b) => Number(b.id) - Number(a.id))
                      .map(a => (
                        <option key={a.id} value={a.name}>
                          {'★'.repeat(a.rarity)} {a.name}
                        </option>
                      ))}
                    {currentSlotChar.artifactSetName && !database.artifacts.some(a => a.name === currentSlotChar.artifactSetName) && (
                      <option value={currentSlotChar.artifactSetName}>{currentSlotChar.artifactSetName} (カスタム入力)</option>
                    )}
                  </select>

                  {/* Artifact Passive Details */}
                  {(() => {
                    const art = database.artifacts.find(a => a.name === currentSlotChar.artifactSetName);
                    if (!art) return null;
                    return (
                      <div className="bg-slate-950/70 border border-slate-800 rounded p-2 text-[11px] space-y-1">
                        <div className="text-[10px] font-mono font-bold text-purple-300">
                          {art.name} (4セット効果)
                        </div>
                        <p className="text-slate-300 line-clamp-2 text-[10px] leading-relaxed">
                          {art.effect4p || art.effect2p || 'セット効果なし'}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Change Character from Database Roster */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>キャラクター入替 ({filteredRoster.length} / 全 {database.characters.length} 人)</span>
              </span>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="キャラ名・英語名・ID検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-48 bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-6 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-semibold"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Filter Buttons Section（DB管理画面と共通） */}
            <CharacterFilterBar
              elementFilter={elementFilter}
              onElementFilterChange={setElementFilter}
              weaponFilter={weaponFilter}
              onWeaponFilterChange={setWeaponFilter}
            />

            {/* Roster Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1 bg-slate-950/50 rounded-xl border border-slate-800/80 custom-scrollbar">
              {filteredRoster.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-slate-400 space-y-1">
                  <p className="font-bold text-slate-300">条件に該当するキャラクターが見つかりません</p>
                  <p className="text-[11px] text-slate-500">元素・武器フィルター解除または検索キーワードを変更してください。</p>
                </div>
              ) : (
                filteredRoster.map(rosterChar => {
                  const elemTheme = ELEMENT_COLORS[rosterChar.element];
                  const isSelectedInSlot = currentSlotChar?.id === rosterChar.id;
                  const isInOtherSlot = editingChars.some((c, i) => c.id === rosterChar.id && i !== selectedSlot);
                  const isCustom = (rosterChar as any).isCustom || rosterChar.id.startsWith('custom_');

                  return (
                    <button
                      key={rosterChar.id}
                      onClick={() => handleSwapCharacter(rosterChar)}
                      disabled={isSelectedInSlot || isInOtherSlot}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                        isSelectedInSlot
                          ? 'bg-amber-500/20 border-amber-400/80 opacity-60 pointer-events-none'
                          : isInOtherSlot
                          ? 'bg-slate-950/40 border-slate-800/40 opacity-30 pointer-events-none'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-600 hover:bg-slate-800'
                      }`}
                    >
                      <CharacterAvatar char={rosterChar} className="w-8 h-8 rounded-lg text-sm" />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate flex items-center gap-1">
                          <span>{rosterChar.name}</span>
                          {isCustom && <span className="text-[8px] text-amber-300 font-mono">✦</span>}
                        </div>
                        <div className={`text-[10px] ${elemTheme.text}`}>
                          {ELEMENT_NAMES_JA[rosterChar.element]}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/80">
          <div className="text-[11px] text-slate-400">
            「編成を保存・適用」を押すと変更が反映されます
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow"
            >
              編成を保存・適用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
