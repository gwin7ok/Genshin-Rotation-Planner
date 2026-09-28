/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { StintSequenceEditor } from './components/StintSequenceEditor';
import { GanttChart } from './components/GanttChart';
import { PartyConfigModal } from './components/PartyConfigModal';
import { RotationSummaryModal } from './components/RotationSummaryModal';
import { HelpGuideModal } from './components/HelpGuideModal';
import { SaveLoadModal } from './components/SaveLoadModal';
import { SaveAsDialog } from './components/SaveAsDialog';
import { DatabaseManagerModal } from './components/DatabaseManagerModal';
import { ROTATION_PRESETS } from './data/presets';
import { CharacterConfig, Stint, PartyPreset, SavedRotationSlot } from './types/genshin';
import { AppDatabase } from './types/database';
import { calculateRotation } from './utils/rotationCalculator';
import { loadActiveState, saveActiveState, clearActiveState, getSavedSlots, saveSlot, buildDefaultSlotName, buildPartyMemberNames } from './utils/storage';
import { loadDatabase } from './utils/databaseService';
import { migrateLegacyCharacter, migrateCharacterIds } from './utils/legacyMigration';
import { resolveLoopStartIndex, normalizeLoopStartIndex } from './utils/loopBoundary';
import { buildRotationNotation } from './utils/rotationNotation';
import { isEmptySlotCharacter } from './data/characters';

const PLAYBACK_START = { time: 0, cycle: 1 };

export default function App() {
  // 0. Active App Database (Characters, Weapons, Artifacts persisted in LocalStorage)
  const [database, setDatabase] = useState<AppDatabase>(() => loadDatabase());

  // 1. Initial State from LocalStorage (Auto-restore) or Default Preset
  const savedInitialState = useMemo(() => loadActiveState(), []);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    return savedInitialState?.selectedPresetId || 'raiden_national';
  });
  const [characters, setCharacters] = useState<CharacterConfig[]>(() => {
    if (savedInitialState && savedInitialState.characters?.length > 0) {
      return savedInitialState.characters;
    }
    return ROTATION_PRESETS[0].characters;
  });
  const [stints, setStints] = useState<Stint[]>(() => {
    if (savedInitialState && savedInitialState.stints?.length > 0) {
      return savedInitialState.stints;
    }
    return ROTATION_PRESETS[0].stints;
  });
  // Character switch delay (default 0.50s or restored from storage)
  const [switchDelay, setSwitchDelay] = useState<number>(() => {
    return savedInitialState?.switchDelay ?? 0.50;
  });
  // Action gap / execution delay (default 0.10s or restored from storage)
  const [actionDelay, setActionDelay] = useState<number>(() => {
    return savedInitialState?.actionDelay ?? 0.10;
  });
  // 2周目ループの開始位置（何番目の出場キャラの前か。0=基準なし）。旧データの秒数は番号へ変換
  const [loopStartIndex, setLoopStartIndex] = useState<number>(() => {
    if (!savedInitialState) return 0;
    return resolveLoopStartIndex(savedInitialState, characters, stints, { switchDelay, actionDelay });
  });

  // User saved rotation slots (shown in the header's 編成選択) & currently loaded slot
  const [savedSlots, setSavedSlots] = useState<SavedRotationSlot[]>(() => getSavedSlots());
  const [activeSlotId, setActiveSlotId] = useState<string | null>(() => savedInitialState?.activeSlotId ?? null);

  // 2. Playback / Scrubber State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // 再生位置と周回数は必ず一緒に更新する（別 state にすると食い違う）
  const [playback, setPlayback] = useState(PLAYBACK_START);
  const currentTime = playback.time;
  const playbackCycleCount = playback.cycle;
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // 3. Modals & Action Selection State
  const [isPartyModalOpen, setIsPartyModalOpen] = useState<boolean>(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState<boolean>(false);
  const [copiedNotation, setCopiedNotation] = useState<boolean>(false);
  const [selectedAction, setSelectedAction] = useState<{ stintId: string; actionId: string } | null>(null);

  // 4. Automatic Persistence (Every change to characters, stints, loopStartTime, or preset is saved)
  useEffect(() => {
    saveActiveState({
      characters,
      stints,
      selectedPresetId,
      loopStartIndex,
      switchDelay,
      actionDelay,
      activeSlotId,
    });
  }, [characters, stints, selectedPresetId, loopStartIndex, switchDelay, actionDelay, activeSlotId]);

  // 5. Calculate Rotation (strictly non-overlapping consecutive stints & action cascades)
  const calculatedResult = useMemo(() => {
    return calculateRotation(characters, stints, { switchDelay, actionDelay, database, loopStartIndex });
  }, [characters, stints, switchDelay, actionDelay, database, loopStartIndex]);

  // Keep playback currentTime bounded within totalDuration
  const totalDuration = calculatedResult.totalDuration;
  const loopStartTime = calculatedResult.loopStartTime;
  const loopPeriod = calculatedResult.loopPeriod;

  // 全体のCT違反件数計算（発動時点でのクールタイム未終了）
  const totalCTCollisions = useMemo(() => {
    let count = 0;
    calculatedResult.calculatedStints.forEach(s => {
      count += s.actions.filter(a => a.hasCTCollision).length;
    });
    calculatedResult.passiveSpans.forEach(p => {
      if (p.hasCTViolation) count++;
    });
    return count;
  }, [calculatedResult]);

  // 出場キャラの削除などで基準番号が出場キャラの数を超えたら、基準を解除して先頭に戻す
  useEffect(() => {
    const normalized = normalizeLoopStartIndex(loopStartIndex, stints.length);
    if (normalized !== loopStartIndex) setLoopStartIndex(normalized);
  }, [loopStartIndex, stints.length]);

  // 6. Playback Animation Loop
  // 再生順: 1周目(0s 〜 totalDuration) → ループ開始点(loopStartTime)へ戻り周回数を+1
  const lastFrameTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      lastFrameTimeRef.current = null;
      return;
    }

    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (lastFrameTimeRef.current !== null) {
        const deltaSec = (timestamp - lastFrameTimeRef.current) / 1000;
        setPlayback(prev => {
          const next = prev.time + deltaSec * playbackSpeed;
          if (totalDuration <= 0 || next < totalDuration) return { ...prev, time: next };
          if (loopPeriod <= 0.05) return PLAYBACK_START;
          return { time: loopStartTime + (next - totalDuration) % loopPeriod, cycle: prev.cycle + 1 };
        });
      }
      lastFrameTimeRef.current = timestamp;
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, playbackSpeed, totalDuration, loopStartTime, loopPeriod]);

  // 7. Handle Preset Selection
  const handleSelectPreset = (preset: PartyPreset) => {
    setSelectedPresetId(preset.id);
    setCharacters(preset.characters);
    setStints(preset.stints);
    setPlayback(PLAYBACK_START);
    setLoopStartIndex(0);
    setSwitchDelay(preset.switchDelay ?? 0.50);
    setActionDelay(preset.actionDelay ?? 0.10);
    setActiveSlotId(null);
    setIsPlaying(false);
  };

  // 8. Handle Custom Slot Loading
  const handleLoadCustomSlot = (slot: {
    characters: CharacterConfig[];
    stints: Stint[];
    loopStartIndex?: number;
    loopStartTime?: number;
    switchDelay?: number;
    actionDelay?: number;
    presetId?: string;
    slotId?: string;
  }) => {
    // 旧形式のキャラキーで書き出された JSON などにも対応
    const { characters: loadedChars, stints: loadedStints } = migrateCharacterIds({
      characters: slot.characters.map(c => migrateLegacyCharacter(c as unknown as Record<string, unknown>)),
      stints: slot.stints,
    });
    setCharacters(loadedChars);
    setStints(loadedStints);
    setLoopStartIndex(resolveLoopStartIndex(slot, loadedChars, loadedStints, slot));
    setSwitchDelay(slot.switchDelay ?? 0.50);
    setActionDelay(slot.actionDelay ?? 0.10);
    setSelectedPresetId(slot.presetId || 'custom');
    setActiveSlotId(slot.slotId ?? null);
    setPlayback(PLAYBACK_START);
    setIsPlaying(false);
  };

  // 9. Reset to default preset
  const handleResetToDefault = () => {
    const defaultPreset = ROTATION_PRESETS[0];
    setSelectedPresetId(defaultPreset.id);
    setCharacters(defaultPreset.characters);
    setStints(defaultPreset.stints);
    setLoopStartIndex(0);
    setSwitchDelay(defaultPreset.switchDelay ?? 0.50);
    setActiveSlotId(null);
    setPlayback(PLAYBACK_START);
    setIsPlaying(false);
  };

  // 10. Handle Playback Controls
  const togglePlay = () => setIsPlaying(prev => !prev);
  const resetPlayback = () => {
    setIsPlaying(false);
    setPlayback(PLAYBACK_START);
  };
  const handleSeek = (time: number) => {
    const clamped = Math.max(0, Math.min(time, totalDuration));
    // 初動（ループ開始点より前）は1周目にしか存在しない
    setPlayback(prev => ({ time: clamped, cycle: clamped < loopStartTime ? 1 : prev.cycle }));
  };

  // 11. Notation Copy & Display
  const rotationNotation = useMemo(
    () => buildRotationNotation(characters, calculatedResult.calculatedStints, loopStartIndex),
    [characters, calculatedResult.calculatedStints, loopStartIndex],
  );

  // 現在のメイン画面の状態を、読み込み中の保存編成（スロット）へ上書き保存
  const [overwriteSaved, setOverwriteSaved] = useState<boolean>(false);
  const handleOverwriteActiveSlot = () => {
    const slot = savedSlots.find(s => s.id === activeSlotId);
    if (!slot) return;
    const updated = saveSlot({
      ...slot,
      characters,
      stints,
      loopStartIndex,
      loopStartTime,
      totalDuration,
      switchDelay,
      actionDelay,
    });
    setSavedSlots(updated);
    setOverwriteSaved(true);
    setTimeout(() => setOverwriteSaved(false), 2000);
  };

  // 「名前をつけて保存」: 現在の状態を保存スロットとして保存し、読み込み中の編成にする
  // （同名の編成がある場合は確認のうえ overwriteSlotId のスロットへ上書き）
  const [isSaveAsOpen, setIsSaveAsOpen] = useState<boolean>(false);
  const activeSlot = savedSlots.find(s => s.id === activeSlotId) ?? null;
  const handleSaveAs = (name: string, description: string | undefined, overwriteSlotId?: string) => {
    const newSlot: SavedRotationSlot = {
      id: overwriteSlotId ?? `slot_${Date.now()}`,
      name,
      description,
      updatedAt: new Date().toISOString(),
      characters,
      stints,
      loopStartIndex,
      loopStartTime,
      totalDuration,
      switchDelay,
      actionDelay,
    };
    setSavedSlots(saveSlot(newSlot));
    setActiveSlotId(newSlot.id);
    setIsSaveAsOpen(false);
  };

  const handleCopyNotation = () => {
    navigator.clipboard.writeText(rotationNotation);
    setCopiedNotation(true);
    setTimeout(() => setCopiedNotation(false), 2000);
  };

  // 12. Export / Import JSON
  const handleExportJson = () => {
    const data = {
      presetId: selectedPresetId,
      characters,
      stints,
      loopStartIndex,
      loopStartTime,
      totalDuration,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genshin_rotation_${selectedPresetId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.characters && parsed.stints) {
          const { characters: importedChars, stints: importedStints } = migrateCharacterIds({
            characters: parsed.characters.map(migrateLegacyCharacter),
            stints: parsed.stints,
          });
          setCharacters(importedChars);
          setStints(importedStints);
          if (parsed.presetId) setSelectedPresetId(parsed.presetId);
          setLoopStartIndex(resolveLoopStartIndex(parsed, importedChars, importedStints, { switchDelay, actionDelay }));
          setActiveSlotId(null);
          setPlayback(PLAYBACK_START);
          setIsPlaying(false);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navigation & Controls */}
      <Header
        savedSlots={savedSlots}
        activeSlotId={activeSlotId}
        onOverwriteActiveSlot={handleOverwriteActiveSlot}
        overwriteSaved={overwriteSaved}
        onOpenSaveAs={() => setIsSaveAsOpen(true)}
        onSelectSavedSlot={(slot) => handleLoadCustomSlot({
          characters: slot.characters,
          stints: slot.stints,
          loopStartIndex: slot.loopStartIndex,
          loopStartTime: slot.loopStartTime ?? 0,
          switchDelay: slot.switchDelay,
          actionDelay: slot.actionDelay,
          slotId: slot.id,
        })}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onResetPlayback={resetPlayback}
        currentTime={currentTime}
        totalDuration={totalDuration}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={setPlaybackSpeed}
        onOpenPartyModal={() => setIsPartyModalOpen(true)}
        onOpenSummaryModal={() => setIsSummaryModalOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        onOpenSaveModal={() => setIsSaveModalOpen(true)}
        onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onCopyNotation={handleCopyNotation}
        copiedNotation={copiedNotation}
        loopStartTime={loopStartTime}
        rotationNotation={rotationNotation}
        totalCTCollisions={totalCTCollisions}
        playbackCycleCount={playbackCycleCount}
        loopPeriod={loopPeriod}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {/* Visual Gantt Chart (Swimlanes with strict vertical alignment) */}
        <GanttChart
          characters={characters}
          stints={calculatedResult.calculatedStints}
          activeBuffs={calculatedResult.activeBuffs}
          skillCooldowns={calculatedResult.skillCooldowns}
          burstCooldowns={calculatedResult.burstCooldowns}
          characterStates={calculatedResult.characterStates}
          totalDuration={totalDuration}
          activeTime={currentTime}
          onSeek={handleSeek}
          activeBuffCountBySecond={calculatedResult.activeBuffCountBySecond}
          passiveSpans={calculatedResult.passiveSpans}
          carryOverCooldowns={calculatedResult.carryOverCooldowns}
          carryOverBuffs={calculatedResult.carryOverBuffs}
          carryOverPassives={calculatedResult.carryOverPassives}
          playbackCycleCount={playbackCycleCount}
          onReorderCharacters={setCharacters}
          onReorderCharactersAndStints={(newChars, newStints) => {
            setCharacters(newChars);
            setStints(newStints);
          }}
          onUpdateStints={setStints}
          selectedAction={selectedAction}
          onSelectAction={(stintId, actionId) => setSelectedAction(stintId && actionId ? { stintId, actionId } : null)}
          loopStartTime={loopStartTime}
          loopStartIndex={loopStartIndex}
          onUpdateLoopStartIndex={setLoopStartIndex}
          switchDelay={switchDelay}
          actionDelay={actionDelay}
        />

        {/* 2-Tier Sequence Editor (Macro Stint DnD + Micro Action Reordering) */}
        <StintSequenceEditor
          characters={characters}
          stints={calculatedResult.calculatedStints}
          onUpdateStints={setStints}
          activeTime={currentTime}
          onSeek={handleSeek}
          switchDelay={switchDelay}
          onUpdateSwitchDelay={setSwitchDelay}
          actionDelay={actionDelay}
          onUpdateActionDelay={setActionDelay}
          onOpenHelpModal={() => setIsHelpModalOpen(true)}
          selectedAction={selectedAction}
          onSelectAction={(stintId, actionId) => setSelectedAction(stintId && actionId ? { stintId, actionId } : null)}
          loopStartTime={loopStartTime}
          loopStartIndex={loopStartIndex}
          database={database}
        />
      </main>

      {/* Save & Load & Backup Modal */}
      <SaveLoadModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        characters={characters}
        stints={stints}
        loopStartTime={loopStartTime}
        loopStartIndex={loopStartIndex}
        totalDuration={totalDuration}
        switchDelay={switchDelay}
        actionDelay={actionDelay}
        currentPresetId={selectedPresetId}
        onSelectPreset={handleSelectPreset}
        activeSlotId={activeSlotId}
        onSlotsChanged={(slots, currentSlotId) => {
          setSavedSlots(slots);
          if (currentSlotId !== undefined) setActiveSlotId(currentSlotId);
          else if (activeSlotId && !slots.some(s => s.id === activeSlotId)) setActiveSlotId(null);
        }}
        onLoadSlot={handleLoadCustomSlot}
        onResetToDefault={handleResetToDefault}
      />

      {/* 名前をつけて保存 Popup */}
      <SaveAsDialog
        isOpen={isSaveAsOpen}
        initialName={buildDefaultSlotName(characters, totalDuration, activeSlot)}
        initialDescription={activeSlot?.description ?? ''}
        savedSlots={savedSlots}
        memberNames={buildPartyMemberNames(characters)}
        onClose={() => setIsSaveAsOpen(false)}
        onSave={handleSaveAs}
      />

      {/* Party Configuration Modal */}
      <PartyConfigModal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        characters={characters}
        stints={stints}
        database={database}
        onUpdatePartyAndStints={(newChars, newStints) => {
          // メンバー自体（キャラIDの並び）が変わった場合のみ保存スロットとの紐付けを解除
          // メンバーを変えずに武器・聖遺物のみ変更した場合は、編成名（アクティブな保存スロット）を維持
          const memberIdsChanged =
            newChars.length !== characters.length ||
            newChars.some((c, i) => c.id !== characters[i]?.id);
          if (memberIdsChanged) {
            setActiveSlotId(null);
          }
          setCharacters(newChars);
          setStints(newStints);
        }}
      />

      {/* Database Management & Customization Modal */}
      <DatabaseManagerModal
        isOpen={isDatabaseModalOpen}
        onClose={() => setIsDatabaseModalOpen(false)}
        database={database}
        onUpdateDatabase={(newDb) => {
          setDatabase(newDb);
          // Sync active party characters & stints with the updated database
          const validIds = new Set(newDb.characters.map(c => c.id));
          const nextActiveChars = characters.filter(c => validIds.has(c.id) || isEmptySlotCharacter(c));
          if (nextActiveChars.length !== characters.length) {
            setCharacters(nextActiveChars);
            const nextStints = stints.filter(s => nextActiveChars.some(c => c.id === s.characterId));
            setStints(nextStints);
          }
        }}
      />

      {/* Rotation Cheat Sheet & Step-by-Step Modal */}
      <RotationSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        characters={characters}
        stints={calculatedResult.calculatedStints}
        totalDuration={totalDuration}
        loopStartIndex={loopStartIndex}
      />

      {/* Help & Reordering Guide Modal */}
      <HelpGuideModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 px-4 py-3 text-center text-xs text-slate-500">
        <p>
          原神戦闘ローテーション ガントチャート設計ツール ✦ 出場ターンの数珠つなぎ（直列スナップ）とクールタイム・バフ重複可視化
        </p>
      </footer>
    </div>
  );
}

