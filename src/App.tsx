/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { StintSequenceEditor } from './components/StintSequenceEditor';
import { GanttChart } from './components/GanttChart';
import { ValidationPanel } from './components/ValidationPanel';
import { PartyConfigModal } from './components/PartyConfigModal';
import { RotationSummaryModal } from './components/RotationSummaryModal';
import { HelpGuideModal } from './components/HelpGuideModal';
import { SaveLoadModal } from './components/SaveLoadModal';
import { DatabaseManagerModal } from './components/DatabaseManagerModal';
import { ROTATION_PRESETS } from './data/presets';
import { CharacterConfig, Stint, PartyPreset, SavedRotationSlot } from './types/genshin';
import { AppDatabase } from './types/database';
import { calculateRotation } from './utils/rotationCalculator';
import { loadActiveState, saveActiveState, clearActiveState, getSavedSlots, saveSlot } from './utils/storage';
import { loadDatabase } from './utils/databaseService';
import { migrateLegacyCharacter } from './utils/legacyMigration';
import { isEmptySlotCharacter } from './data/characters';

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
  // Loop boundary marker (default 0s or restored from storage)
  const [loopStartTime, setLoopStartTime] = useState<number>(() => {
    return savedInitialState?.loopStartTime ?? 0;
  });
  // Character switch delay (default 0.50s or restored from storage)
  const [switchDelay, setSwitchDelay] = useState<number>(() => {
    return savedInitialState?.switchDelay ?? 0.50;
  });
  // Action gap / execution delay (default 0.10s or restored from storage)
  const [actionDelay, setActionDelay] = useState<number>(() => {
    return savedInitialState?.actionDelay ?? 0.10;
  });

  // User saved rotation slots (shown in the header's 編成選択) & currently loaded slot
  const [savedSlots, setSavedSlots] = useState<SavedRotationSlot[]>(() => getSavedSlots());
  const [activeSlotId, setActiveSlotId] = useState<string | null>(() => savedInitialState?.activeSlotId ?? null);

  // 2. Playback / Scrubber State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
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
      loopStartTime,
      switchDelay,
      actionDelay,
      activeSlotId,
    });
  }, [characters, stints, selectedPresetId, loopStartTime, switchDelay, actionDelay, activeSlotId]);

  // 5. Calculate Rotation (strictly non-overlapping consecutive stints & action cascades)
  const calculatedResult = useMemo(() => {
    return calculateRotation(characters, stints, { switchDelay, actionDelay });
  }, [characters, stints, switchDelay, actionDelay]);

  // Keep playback currentTime bounded within totalDuration
  const totalDuration = calculatedResult.totalDuration;

  // 6. Playback Animation Loop
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
        setCurrentTime(prevTime => {
          const next = prevTime + deltaSec * playbackSpeed;
          if (next >= totalDuration) {
            // Loop back to loop boundary point (loopStartTime) rather than the 0.0s setup start
            const targetLoopStart = (typeof loopStartTime === 'number' && loopStartTime >= 0 && loopStartTime < totalDuration)
              ? loopStartTime
              : 0;
            const overshoot = next - totalDuration;
            return Math.min(totalDuration, targetLoopStart + overshoot);
          }
          return next;
        });
      }
      lastFrameTimeRef.current = timestamp;
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, playbackSpeed, totalDuration, loopStartTime]);

  // 7. Handle Preset Selection
  const handleSelectPreset = (preset: PartyPreset) => {
    setSelectedPresetId(preset.id);
    setCharacters(preset.characters);
    setStints(preset.stints);
    setCurrentTime(0);
    setLoopStartTime(0);
    setSwitchDelay(preset.switchDelay ?? 0.50);
    setActionDelay(preset.actionDelay ?? 0.10);
    setActiveSlotId(null);
    setIsPlaying(false);
  };

  // 8. Handle Custom Slot Loading
  const handleLoadCustomSlot = (slot: {
    characters: CharacterConfig[];
    stints: Stint[];
    loopStartTime: number;
    switchDelay?: number;
    actionDelay?: number;
    presetId?: string;
    slotId?: string;
  }) => {
    setCharacters(slot.characters);
    setStints(slot.stints);
    setLoopStartTime(slot.loopStartTime ?? 0);
    setSwitchDelay(slot.switchDelay ?? 0.50);
    setActionDelay(slot.actionDelay ?? 0.10);
    setSelectedPresetId(slot.presetId || 'custom');
    setActiveSlotId(slot.slotId ?? null);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  // 9. Reset to default preset
  const handleResetToDefault = () => {
    const defaultPreset = ROTATION_PRESETS[0];
    setSelectedPresetId(defaultPreset.id);
    setCharacters(defaultPreset.characters);
    setStints(defaultPreset.stints);
    setLoopStartTime(0);
    setSwitchDelay(defaultPreset.switchDelay ?? 0.50);
    setActiveSlotId(null);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  // 10. Handle Playback Controls
  const togglePlay = () => setIsPlaying(prev => !prev);
  const resetPlayback = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };
  const handleSeek = (time: number) => {
    setCurrentTime(time);
  };

  // 11. Notation Copy & Display
  const rotationNotation = useMemo(() => {
    const charMap = new Map(characters.map(c => [c.id, c.name]));
    return calculatedResult.calculatedStints.map(s => {
      const charName = charMap.get(s.characterId) || '不明';
      const nonSwapActions = s.actions.filter(a => 
        a.type !== 'swap' && 
        a.shortName !== '交代' && 
        a.name !== 'キャラ交代' && 
        a.actionTypeId !== 'action_switch_char'
      );
      const acts = nonSwapActions.map(a => a.shortName).join(' ');
      return `${charName} [${acts}]`;
    }).join(' ➔ ');
  }, [characters, calculatedResult.calculatedStints]);

  // 現在のメイン画面の状態を、読み込み中の保存編成（スロット）へ上書き保存
  const [overwriteSaved, setOverwriteSaved] = useState<boolean>(false);
  const handleOverwriteActiveSlot = () => {
    const slot = savedSlots.find(s => s.id === activeSlotId);
    if (!slot) return;
    const updated = saveSlot({
      ...slot,
      characters,
      stints,
      loopStartTime,
      totalDuration,
      switchDelay,
      actionDelay,
    });
    setSavedSlots(updated);
    setOverwriteSaved(true);
    setTimeout(() => setOverwriteSaved(false), 2000);
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
          setCharacters(parsed.characters.map(migrateLegacyCharacter));
          setStints(parsed.stints);
          if (parsed.presetId) setSelectedPresetId(parsed.presetId);
          if (typeof parsed.loopStartTime === 'number') setLoopStartTime(parsed.loopStartTime);
          setActiveSlotId(null);
          setCurrentTime(0);
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
        onSelectSavedSlot={(slot) => handleLoadCustomSlot({
          characters: slot.characters,
          stints: slot.stints,
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
          onReorderCharacters={setCharacters}
          onReorderCharactersAndStints={(newChars, newStints) => {
            setCharacters(newChars);
            setStints(newStints);
          }}
          onUpdateStints={setStints}
          selectedAction={selectedAction}
          onSelectAction={(stintId, actionId) => setSelectedAction(stintId && actionId ? { stintId, actionId } : null)}
          loopStartTime={loopStartTime}
          onUpdateLoopStartTime={setLoopStartTime}
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
        />

        {/* Cooldown Conflict Validation, Energy Sufficiency & Rotation Loop Diagnosis */}
        <ValidationPanel
          characters={characters}
          validationIssues={calculatedResult.validationIssues}
          characterStates={calculatedResult.characterStates}
          loopStatus={calculatedResult.loopStatus}
          totalDuration={totalDuration}
        />
      </main>

      {/* Save & Load & Backup Modal */}
      <SaveLoadModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        characters={characters}
        stints={stints}
        loopStartTime={loopStartTime}
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

      {/* Party Configuration Modal */}
      <PartyConfigModal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        characters={characters}
        stints={stints}
        database={database}
        onUpdatePartyAndStints={(newChars, newStints) => {
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

