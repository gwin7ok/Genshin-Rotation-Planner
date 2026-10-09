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
import { GcsimConfigDialog } from './components/GcsimConfigDialog';
import { resetToAppCalculation } from './utils/gcsim/resetToAppCalculation';
import { buildGcsimConfig, type GcsimConfigResult } from './utils/gcsim/buildGcsimConfig';
import { PartyMember, Stint, SavedRotationSlot, ReactionRow, ReactionRowRef } from './types/genshin';
import { AppDatabase } from './types/database';
import { calculateRotation } from './utils/rotationCalculator';
import { getAvailableBuffsForCharacter } from './utils/buffUtils';
import { buildActionLinkTables } from './masterdata/actionGcsimLink';
import { loadActiveState, saveActiveState, clearActiveState, getSavedSlots, saveSlot, buildDefaultSlotName, buildPartyMemberNames } from './utils/storage';
import { loadDatabase } from './utils/databaseService';
import { createEmptyParty, resolvePartyCharacters, filterStintsForCharacters, mergeHiddenStints } from './utils/party';
import { resolveLoopStartIndex, normalizeLoopStartIndex } from './utils/loopBoundary';
import { normalizeModeHoldActions, isModeHoldAction } from './utils/modeHoldAction';
import { buildRotationNotation } from './utils/rotationNotation';

// 累積再生時間 → 周回数と周内の位置（2周目以降は loopStartTime〜totalDuration を繰り返す）
function toLapPosition(elapsed: number, totalDuration: number, loopStartTime: number, loopPeriod: number) {
  if (elapsed < totalDuration || loopPeriod <= 0.05) return { time: Math.min(elapsed, totalDuration), cycle: 1 };
  const sinceLoop = elapsed - totalDuration;
  const lap = Math.floor(sinceLoop / loopPeriod);
  return { time: loopStartTime + (sinceLoop - lap * loopPeriod), cycle: lap + 2 };
}

export default function App() {
  // 0. Active App Database (Characters, Weapons, Artifacts persisted in LocalStorage)
  const [database, setDatabase] = useState<AppDatabase>(() => loadDatabase());

  // 1. Initial State from LocalStorage (Auto-restore) or empty party
  const savedInitialState = useMemo(() => loadActiveState(), []);

  // 編成はキャラの ID と編成ごとの設定だけを持ち、キャラのデータは DB から引く
  const [party, setParty] = useState<PartyMember[]>(() => {
    if (savedInitialState && savedInitialState.party?.length > 0) {
      return savedInitialState.party;
    }
    return createEmptyParty();
  });
  const characters = useMemo(() => resolvePartyCharacters(party, database.characters), [party, database.characters]);
  const [stints, setStints] = useState<Stint[]>(() => {
    if (savedInitialState && savedInitialState.stints?.length > 0) {
      return savedInitialState.stints;
    }
    return [];
  });
  // DB に無いキャラの出場ブロックは、計算・表示から除く（保存データには残す）
  const visibleStints = useMemo(() => filterStintsForCharacters(stints, characters), [stints, characters]);
  // 出場ブロックの編集。DB に無いキャラ（表示から外れている）の出場ブロックは、編成が参照している間は残す
  const updateStints = (next: Stint[]) => setStints(mergeHiddenStints(next, stints, characters, party));
  // Character switch delay (default 0.50s or restored from storage)
  // 敵の防御ヒットストップ（gcsim の defhalt）。回転ごとではなく、アプリ全体の設定（既定: 有効）
  const [defHalt, setDefHaltState] = useState<boolean>(() => {
    try { return localStorage.getItem('gcsimDefHalt') !== 'false'; } catch { return true; }
  });
  const setDefHalt = (value: boolean) => {
    setDefHaltState(value);
    try { localStorage.setItem('gcsimDefHalt', String(value)); } catch { /* 保存できなくても動く */ }
  };
  const [switchDelay, setSwitchDelay] = useState<number>(() => {
    return savedInitialState?.switchDelay ?? 0.50;
  });
  // 2周目ループの開始位置（何番目の出場キャラの前か。0=基準なし）。旧データの秒数は番号へ変換
  const [loopStartIndex, setLoopStartIndex] = useState<number>(() => {
    if (!savedInitialState) return 0;
    return resolveLoopStartIndex(savedInitialState, characters, visibleStints, { switchDelay });
  });

  // User saved rotation slots (shown in the header's 編成選択) & currently loaded slot
  const [savedSlots, setSavedSlots] = useState<SavedRotationSlot[]>(() => getSavedSlots());
  const [activeSlotId, setActiveSlotId] = useState<string | null>(() => savedInitialState?.activeSlotId ?? null);

  // 2. Playback / Scrubber State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // 再生開始からの累積時間。周回数と周内の位置はここから求める
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // 3. Modals & Action Selection State
  const [isPartyModalOpen, setIsPartyModalOpen] = useState<boolean>(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState<boolean>(false);
  const [copiedNotation, setCopiedNotation] = useState<boolean>(false);
  const [selectedAction, setSelectedAction] = useState<{ stintId: string; actionId: string } | null>(null);

  // 4. Automatic Persistence (Every change to characters, stints, loopStartTime is saved)
  useEffect(() => {
    saveActiveState({
      party,
      stints,
      loopStartIndex,
      switchDelay,
      activeSlotId,
    });
  }, [party, stints, loopStartIndex, switchDelay, activeSlotId]);

  // 5. Calculate Rotation (strictly non-overlapping consecutive stints & action cascades)
  // gcsim の結果でCT待ちが生じたアクション（アクション ID → 待った秒数）。編集したら消す（結果が古くなるため）
  const [gcsimCtWaits, setGcsimCtWaits] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    setGcsimCtWaits(null);
  }, [characters, visibleStints, switchDelay, loopStartIndex]);

  // gcsim の結果から読み取った反応の状態（月感電の雲・星電導など。アクション基準。D112）。実行する前は null（何も出さない）。
  // 編成・交代・ループ基準・アクションの並びを編集したら消す（所要時間だけの変更・反映では残す）
  const [gcsimReactions, setGcsimReactions] = useState<ReactionRowRef[] | null>(null);
  const actionIdKey = useMemo(() => visibleStints.map(st => `${st.characterId}:${st.actions.map(a => a.id).join(',')}`).join('|'), [visibleStints]);
  useEffect(() => {
    setGcsimReactions(null);
  }, [characters, switchDelay, loopStartIndex, actionIdKey]);

  const calculatedResult = useMemo(() => {
    return calculateRotation(characters, visibleStints, { switchDelay, database, loopStartIndex, defHalt, externalCtWaits: gcsimCtWaits ?? undefined });
  }, [characters, visibleStints, switchDelay, database, loopStartIndex, defHalt, gcsimCtWaits]);

  // 反応の区間を、現在のアクションの開始時刻に直す（アクションが見つからない区間は出さない）
  const reactionRows = useMemo<ReactionRow[]>(() => {
    if (!gcsimReactions) return [];
    const startOf = new Map<string, number>();
    for (const st of calculatedResult.calculatedStints) for (const a of st.actions) if (a.startTime !== undefined) startOf.set(a.id, a.startTime);
    const rows: ReactionRow[] = [];
    for (const row of gcsimReactions) {
      const segments: ReactionRow['segments'] = [];
      for (const sg of row.segments) {
        const s0 = startOf.get(sg.start.actionId);
        const e0 = startOf.get(sg.end.actionId);
        if (s0 === undefined || e0 === undefined) continue;
        const startTime = Number((s0 + sg.start.offset).toFixed(3));
        const endTime = Number((e0 + sg.end.offset).toFixed(3));
        if (endTime > startTime) segments.push({ startTime, endTime, ...(sg.count !== undefined ? { count: sg.count } : {}) });
      }
      if (segments.length) rows.push({ kind: row.kind, lap: row.lap, ...(row.max !== undefined ? { max: row.max } : {}), segments });
    }
    return rows;
  }, [gcsimReactions, calculatedResult]);

  // 「維持」のアクション（モード維持を並びの中の本物のアクションにしたもの。D114）を、計算結果に合わせて出し入れする。
  // モードを開いたら並びの最後に足し、維持をオフにしたら外す。変更が無ければ何もしない（再計算しても同じ結果になる）
  useEffect(() => {
    const next = normalizeModeHoldActions(visibleStints, calculatedResult.calculatedStints);
    if (next) updateStints(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatedResult]);

  const totalDuration = calculatedResult.totalDuration;
  const loopStartTime = calculatedResult.loopStartTime;
  const loopPeriod = calculatedResult.loopPeriod;
  const { time: currentTime, cycle: playbackCycleCount } = toLapPosition(elapsedTime, totalDuration, loopStartTime, loopPeriod);

  // 編集で計算結果が変わったら、再生を止めて1周目の先頭へ戻す（累積時間から求める周内の位置がずれるため）
  useEffect(() => {
    setIsPlaying(false);
    setElapsedTime(0);
  }, [calculatedResult]);

  // 全体のCT違反件数計算（スキル・爆発の発動時点でのクールタイム未終了。gcsim では実行できずCT待ちになる）
  const totalCTCollisions = useMemo(() => {
    let count = 0;
    calculatedResult.calculatedStints.forEach(s => {
      count += s.actions.filter(a => a.hasCTCollision).length;
    });
    return count;
  }, [calculatedResult]);
  // CT警告件数: 発動バフ（固有天賦・武器・聖遺物）のCT中の発動（効果が発動しないだけ）と、特殊スキルの受付時間外（gcsim では通常のスキルになる）、落下攻撃の前提を満たさない配置（gcsim では実行エラー）
  const totalCTWarnings = useMemo(
    () => calculatedResult.passiveSpans.filter(p => p.hasCTViolation).length
      + calculatedResult.validationIssues.filter(v => v.id.startsWith('special_window_') || v.id.startsWith('plunge_prereq_') || v.id.startsWith('gcsim_unsupported_') || v.id.startsWith('mode_blocks_') || v.id.startsWith('mode_blocked_')).length,
    [calculatedResult],
  );

  // 出場キャラの削除などで基準番号が出場キャラの数を超えたら、基準を解除して先頭に戻す
  useEffect(() => {
    const normalized = normalizeLoopStartIndex(loopStartIndex, visibleStints.length);
    if (normalized !== loopStartIndex) setLoopStartIndex(normalized);
  }, [loopStartIndex, visibleStints.length]);

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
        setElapsedTime(prev => {
          const next = prev + deltaSec * playbackSpeed;
          // ループ区間がなければ先頭へ戻る
          return loopPeriod <= 0.05 && next >= totalDuration ? 0 : next;
        });
      }
      lastFrameTimeRef.current = timestamp;
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, playbackSpeed, totalDuration, loopPeriod]);

  // 8. Handle Custom Slot Loading
  const handleLoadCustomSlot = (slot: {
    party: PartyMember[];
    stints: Stint[];
    loopStartIndex?: number;
    loopStartTime?: number;
    switchDelay?: number;
    slotId?: string;
  }) => {
    const loadedChars = resolvePartyCharacters(slot.party, database.characters);
    const loadedStints = filterStintsForCharacters(slot.stints, loadedChars);
    setParty(slot.party);
    setStints(slot.stints);
    setLoopStartIndex(resolveLoopStartIndex(slot, loadedChars, loadedStints, slot));
    setSwitchDelay(slot.switchDelay ?? 0.50);
    setActiveSlotId(slot.slotId ?? null);
  };

  // 9. Reset to the initial state (empty party)
  const handleResetToDefault = () => {
    setParty(createEmptyParty());
    setStints([]);
    setLoopStartIndex(0);
    setSwitchDelay(0.50);
    setActiveSlotId(null);
  };

  // 10. Handle Playback Controls
  const togglePlay = () => setIsPlaying(prev => !prev);
  const resetPlayback = () => {
    setIsPlaying(false);
    setElapsedTime(0);
  };
  const handleSeek = (time: number) => {
    const t = Math.max(0, Math.min(time, totalDuration));
    // 初動（ループ開始点より前）は1周目にしか存在しない。ループ区間内なら今の周のまま移動する
    setElapsedTime(playbackCycleCount === 1 || t < loopStartTime
      ? t
      : totalDuration + (playbackCycleCount - 2) * loopPeriod + (t - loopStartTime));
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
      party,
      stints,
      loopStartIndex,
      loopStartTime,
      totalDuration,
      switchDelay,
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
      party,
      stints,
      loopStartIndex,
      loopStartTime,
      totalDuration,
      switchDelay,
    };
    setSavedSlots(saveSlot(newSlot));
    setActiveSlotId(newSlot.id);
    setIsSaveAsOpen(false);
  };

  // 「アプリの計算に戻す」: 今のアクションの並びを基準に、gcsim の反映・個別の変更を外して、アプリの計算を全体に再適用する
  const handleResetToAppCalculation = () => {
    const summary = resetToAppCalculation(visibleStints);
    // 外す内容がなくても、全体を計算し直す（保存されたアクションの値をすべて作り直した新しい並びで、計算・表示・再生位置を更新する）
    if (summary.actionsChanged === 0 && summary.stintsChanged === 0) {
      updateStints(visibleStints.map(st => ({ ...st, actions: st.actions.map(a => ({ ...a })) })));
      return;
    }
    const ok = window.confirm(
      `アクションの並びはそのままに、アプリの計算に戻します。\n\n` +
      `・アクション ${summary.actionsChanged} 件の、所要時間の固定・個別の CT・効果時間・gcsim の補正を外します\n` +
      `・出場ブロック ${summary.stintsChanged} 件の、gcsim から書き込んだ効果を外します（gcsim の結果から追加した発動バフ ${summary.passivesRemoved} 件を削除）\n\n` +
      `※ gcsim の値だけでなく、手で編集した所要時間・CT・効果時間も戻ります。よろしいですか？`,
    );
    if (ok) updateStints(summary.stints);
  };

  // アプリ自身のCT違反（スキル・爆発。ガントチャートの判定と同じ。gcsim の計算を止める）
  const ctViolationIssues = useMemo(
    () => calculatedResult.validationIssues.filter(v => /^(skill|burst)_ct_/.test(v.id)),
    [calculatedResult],
  );
  // アプリ自身のCT警告（発動バフ・特殊スキルの受付時間外。gcsim の計算は止めない）
  const ctWarningIssues = useMemo(
    () => calculatedResult.validationIssues.filter(v => /^(passive_ct_|special_window_|plunge_prereq_|gcsim_unsupported_|mode_blocks_|mode_blocked_)/.test(v.id)),
    [calculatedResult],
  );

  // gcsim 設定文（現在の編成・ローテーションを変換してコピー。警告はポップアップで表示）
  const [gcsimResult, setGcsimResult] = useState<GcsimConfigResult | null>(null);
  const [gcsimCopied, setGcsimCopied] = useState<boolean>(false);
  const copyGcsimText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setGcsimCopied(true);
    } catch {
      setGcsimCopied(false);
    }
  };
  // キャラ ID → 発動できる発動バフの定義（gcsim の結果の書き戻しで、gcsim のキーとの対応付けに使う）
  const buffsByCharacter = useMemo(
    () => Object.fromEntries(characters.map(c => [c.id, getAvailableBuffsForCharacter(c, database).filter(b => !b.autoApplied)])),
    [characters, database],
  );
  // スキル・爆発の効果と gcsim のキーの紐付け（アクション定義から集める。gcsim の結果の書き戻しに使う）
  const actionLinks = useMemo(() => buildActionLinkTables(characters), [characters]);
  const handleCopyGcsimConfig = () => {
    const result = buildGcsimConfig({
      characters,
      stints: visibleStints,
      loopStartIndex,
      switchDelay,
      defHalt,
      weapons: database.weapons,
      artifacts: database.artifacts,
      // 標準より長くした分（所要時間の編集）と、モードの維持のための自動の待ち（出場の最後のアクション。待機のアクションにも足す）
      extraWaitByActionId: Object.fromEntries(
        calculatedResult.calculatedStints.flatMap(s => s.actions)
          .filter(a => a.type !== 'swap')
          .map(a => {
            const manual = a.durationManual && a.holdSeconds === undefined && a.naturalDuration !== undefined && a.type !== 'wait' ? Math.max(0, a.duration - a.naturalDuration) : 0;
            // 維持のアクション（待機）: 長さが自動のときは、計算した長さを gcsim の `wait` に渡す（元の所要時間は 0）
            if (isModeHoldAction(a) && !a.durationManual) return [a.id, Number(a.duration.toFixed(3))] as const;
            return [a.id, Number(((manual >= 0.005 ? manual : 0) + (a.modeHoldSeconds ?? 0)).toFixed(3))] as const;
          })
          .filter(([, extra]) => extra > 0),
      ),
      modeHoldByActionId: Object.fromEntries(
        calculatedResult.calculatedStints.flatMap(s => s.actions).filter(a => a.modeHoldSeconds).map(a => [a.id, a.modeHoldSeconds as number]),
      ),
      holdSecondsByActionId: Object.fromEntries(
        calculatedResult.calculatedStints.flatMap(s => s.actions).filter(a => a.holdSeconds !== undefined).map(a => [a.id, a.holdSeconds as number]),
      ),
    });
    setGcsimResult(result);
    void copyGcsimText(result.config);
  };

  const handleCopyNotation = () => {
    navigator.clipboard.writeText(rotationNotation);
    setCopiedNotation(true);
    setTimeout(() => setCopiedNotation(false), 2000);
  };

  // 12. Export / Import JSON
  const handleExportJson = () => {
    const data = {
      party,
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
    a.download = `genshin_rotation_${Date.now()}.json`;
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
        if (Array.isArray(parsed.party) && Array.isArray(parsed.stints)) {
          const importedParty: PartyMember[] = parsed.party;
          const importedChars = resolvePartyCharacters(importedParty, database.characters);
          const importedStints: Stint[] = filterStintsForCharacters(parsed.stints, importedChars);
          setParty(importedParty);
          setStints(parsed.stints);
          setLoopStartIndex(resolveLoopStartIndex(parsed, importedChars, importedStints, { switchDelay }));
          setActiveSlotId(null);
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
          party: slot.party,
          stints: slot.stints,
          loopStartIndex: slot.loopStartIndex,
          loopStartTime: slot.loopStartTime ?? 0,
          switchDelay: slot.switchDelay,
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
        onCopyGcsimConfig={handleCopyGcsimConfig}
        onResetToAppCalculation={handleResetToAppCalculation}
        copiedNotation={copiedNotation}
        loopStartTime={loopStartTime}
        rotationNotation={rotationNotation}
        totalCTCollisions={totalCTCollisions}
        totalCTWarnings={totalCTWarnings}
        playbackCycleCount={playbackCycleCount}
        loopPeriod={loopPeriod}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {/* Visual Gantt Chart (Swimlanes with strict vertical alignment) */}
        <GanttChart
          database={database}
          characters={characters}
          stints={calculatedResult.calculatedStints}
          activeBuffs={calculatedResult.activeBuffs}
          skillCooldowns={calculatedResult.skillCooldowns}
          burstCooldowns={calculatedResult.burstCooldowns}
          characterStates={calculatedResult.characterStates}
          totalDuration={totalDuration}
          activeTime={currentTime}
          onSeek={handleSeek}
          buffOverlapSegments={calculatedResult.buffOverlapSegments}
          loopedBuffOverlapSegments={calculatedResult.loopedBuffOverlapSegments}
          passiveSpans={calculatedResult.passiveSpans}
          stockSpans={calculatedResult.stockSpans}
          reactionRows={reactionRows}
          carryOverCooldowns={calculatedResult.carryOverCooldowns}
          carryOverBuffs={calculatedResult.carryOverBuffs}
          carryOverPassives={calculatedResult.carryOverPassives}
          elapsedTime={elapsedTime}
          onUpdateStints={updateStints}
          selectedAction={selectedAction}
          onSelectAction={(stintId, actionId) => setSelectedAction(stintId && actionId ? { stintId, actionId } : null)}
          loopStartTime={loopStartTime}
          loopStartIndex={loopStartIndex}
          onUpdateLoopStartIndex={setLoopStartIndex}
          switchDelay={switchDelay}
        />

        {/* 2-Tier Sequence Editor (Macro Stint DnD + Micro Action Reordering) */}
        <StintSequenceEditor
          characters={characters}
          stints={calculatedResult.calculatedStints}
          onUpdateStints={updateStints}
          activeTime={currentTime}
          onSeek={handleSeek}
          switchDelay={switchDelay}
          onUpdateSwitchDelay={setSwitchDelay}
          defHalt={defHalt}
          onUpdateDefHalt={setDefHalt}
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
        party={party}
        characters={characters}
        database={database}
        stints={stints}
        loopStartTime={loopStartTime}
        loopStartIndex={loopStartIndex}
        totalDuration={totalDuration}
        switchDelay={switchDelay}
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
        party={party}
        stints={visibleStints}
        database={database}
        onUpdatePartyAndStints={(newParty, newStints) => {
          // メンバー自体（キャラIDの並び）が変わった場合のみ保存スロットとの紐付けを解除
          // メンバーを変えずに武器・聖遺物のみ変更した場合は、編成名（アクティブな保存スロット）を維持
          const memberIdsChanged =
            newParty.length !== party.length ||
            newParty.some((m, i) => m.characterId !== party[i]?.characterId);
          if (memberIdsChanged) {
            setActiveSlotId(null);
          }
          setParty(newParty);
          setStints(mergeHiddenStints(newStints, stints, characters, newParty));
        }}
      />

      {/* Database Management & Customization Modal */}
      <DatabaseManagerModal
        isOpen={isDatabaseModalOpen}
        onClose={() => setIsDatabaseModalOpen(false)}
        database={database}
        // 編成は ID だけを持つので、キャラの編集は自動で反映される。
        // DB から削除されたキャラの枠は、DB に戻るまで未設定枠として表示する（編成の ID は書き換えない）
        onUpdateDatabase={setDatabase}
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

      {/* gcsim 設定文 */}
      <GcsimConfigDialog
        isOpen={gcsimResult !== null}
        onClose={() => setGcsimResult(null)}
        result={gcsimResult}
        copied={gcsimCopied}
        onCopyAgain={() => gcsimResult && void copyGcsimText(gcsimResult.config)}
        ctIssues={ctViolationIssues}
        ctWarnings={ctWarningIssues}
        onCtWaits={setGcsimCtWaits}
        onReactions={setGcsimReactions}
        stints={visibleStints}
        calculated={calculatedResult}
        buffsByCharacter={buffsByCharacter}
        actionLinks={actionLinks}
        onApplyStints={updateStints}
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

