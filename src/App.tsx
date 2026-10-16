/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { StintSequenceEditor } from './components/StintSequenceEditor';
import { GanttChart } from './components/GanttChart';
import { PartyConfigModal } from './components/PartyConfigModal';
import { UsageGuideModal } from './components/UsageGuideModal';
import { SourceNotice } from './components/SourceNotice';
import { UpdateNoticeModal } from './components/UpdateNoticeModal';
import { evaluateVersionNotice, markVersionSeen } from './utils/versionNotice';
import { setWriteFailureHandler } from './utils/persistence';
import { describeSkipped, parseRotationPayload, totalSkipped } from './utils/rotationValidation';
import { DATABASE_VERSION } from './data/databaseMaster';
import { loadDefHalt, saveDefHalt, loadHurt, saveHurt, loadNotationMode, saveNotationMode } from './utils/appSettings';
import { getLastGcsimEngine } from './utils/gcsim/gcsimClient.ts';
import { checkWasmVersionMismatch } from './utils/gcsim/gcsimWasm.ts';
import { GCSIM_COMMIT, GCSIM_VERSION } from './utils/gcsim/gcsimConfig.ts';
import { SaveLoadModal } from './components/SaveLoadModal';
import { useDialogs } from './components/DialogProvider';
import { SaveAsDialog } from './components/SaveAsDialog';
import { DatabaseManagerModal } from './components/DatabaseManagerModal';
import { GcsimConfigDialog } from './components/GcsimConfigDialog';
import { resetToAppCalculation } from './utils/gcsim/resetToAppCalculation';
import { extractReactionRows, anchorReactionRows, reactionLapInputs } from './utils/gcsim/readReactions';
import { applyDragPreview, type DragPreview } from './utils/dragPreview';
import { normalizeGroups } from './utils/actionGroups';
import { buildGcsimConfig, DEFAULT_HURT, type GcsimConfigResult, type HurtSetting } from './utils/gcsim/buildGcsimConfig';
import { PartyMember, Stint, SavedRotationSlot, ReactionRow, ReactionRowRef } from './types/genshin';
import { packReactions, unpackReactions, reactionsStatus } from './utils/gcsim/savedReactions';
import { seedPresetsOnFirstRun } from './utils/presets';
import { AppDatabase } from './types/database';
import { calculateRotation } from './utils/rotationCalculator';
import { getAvailableBuffsForCharacter } from './utils/buffUtils';
import { buildActionLinkTables } from './masterdata/actionGcsimLink';
import { loadActiveState, saveActiveStateDebounced, flushActiveState, clearActiveState, getSavedSlots, trySaveSlot, SLOT_WRITE_FAILED_MESSAGE, buildDefaultSlotName, buildPartyMemberNames, findSlotByName } from './utils/storage';
import { rotationFileName, nameFromFileName, buildRotationExport } from './utils/rotationFile';
import { loadDatabase } from './utils/databaseService';
import { createEmptyParty, resolvePartyCharacters, filterStintsForCharacters, mergeHiddenStints } from './utils/party';
import { resolveLoopStartIndex, normalizeLoopStartIndex } from './utils/loopBoundary';
import { normalizeModeHoldActions, isModeHoldAction } from './utils/modeHoldAction';
import { runGcsimForConfig, computeGcsimApply, summarizeApplyPlan, describeApplyPlan } from './utils/gcsim/gcsimCompute';
import { GcsimComputeBanner, type GcsimComputeBannerState } from './components/GcsimComputeBanner';
import { buildRotationNotation, type NotationMode } from './utils/rotationNotation';

// 累積再生時間 → 周回数と周内の位置（2周目以降は loopStartTime〜totalDuration を繰り返す）
function toLapPosition(elapsed: number, totalDuration: number, loopStartTime: number, loopPeriod: number) {
  if (elapsed < totalDuration || loopPeriod <= 0.05) return { time: Math.min(elapsed, totalDuration), cycle: 1 };
  const sinceLoop = elapsed - totalDuration;
  const lap = Math.floor(sinceLoop / loopPeriod);
  return { time: loopStartTime + (sinceLoop - lap * loopPeriod), cycle: lap + 2 };
}

/**
 * 反応の行が「どの状態の計算結果か」を表す署名。編成（キャラ・装備・凸など）・交代遅延・ループ基準・
 * 出場の並びとアクションの ID が同じなら同じ。所要時間・CT・効果時間の変更では変わらない。
 */
function makeReactionSignature(
  characters: ReturnType<typeof resolvePartyCharacters>,
  switchDelay: number,
  loopStartIndex: number,
  stints: Stint[],
): string {
  return JSON.stringify([
    characters.map(c => [c.id, c.weaponId, c.weaponRefinementRank, c.artifactSetId, c.artifactSetMode, c.constellation, c.hexerei, c.revelation, c.energyRecharge]),
    switchDelay,
    loopStartIndex,
    stints.map(st => [st.characterId, st.actions.map(a => a.id)]),
  ]);
}

export default function App() {
  const { confirm, alert: showAlert, prompt } = useDialogs();
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
  const updateStints = (next: Stint[]) => setStints(mergeHiddenStints(next.map(normalizeGroups), stints, characters, party));
  // Character switch delay (default 0.50s or restored from storage)
  // 敵の防御ヒットストップ（gcsim の defhalt）。回転ごとではなく、アプリ全体の設定（既定: 有効）
  const [defHalt, setDefHaltState] = useState<boolean>(() => loadDefHalt());
  const setDefHalt = (value: boolean) => {
    setDefHaltState(value);
    saveDefHalt(value);
  };
  // 敵から受けるダメージ（gcsim の hurt。追加作業 18）。defHalt と同じく、回転ごとではなく、アプリ全体の設定（既定: 無効）
  const [hurt, setHurtState] = useState<HurtSetting>(() => loadHurt());
  const setHurt = (value: HurtSetting) => {
    setHurtState(value);
    saveHurt(value);
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
  // 初めて使うとき（保存編成の保存先が無いとき）は、同梱のプリセット編成を保存編成に入れる
  const [savedSlots, setSavedSlots] = useState<SavedRotationSlot[]>(() => {
    seedPresetsOnFirstRun();
    return getSavedSlots();
  });
  const [activeSlotId, setActiveSlotId] = useState<string | null>(() => savedInitialState?.activeSlotId ?? null);

  // 2. Playback / Scrubber State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // 再生開始からの累積時間。周回数と周内の位置はここから求める
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // 3. Modals & Action Selection State
  const [isPartyModalOpen, setIsPartyModalOpen] = useState<boolean>(false);
  // 使い方
  const [isUsageOpen, setIsUsageOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState<boolean>(false);
  // マスターデータ（DB）の更新の通知: DB のバージョンが、最後に確認した版より新しければ、DB管理で「全削除 → 動的生成」を促す（D196・D198）
  const [versionNotice, setVersionNotice] = useState(() => evaluateVersionNotice(DATABASE_VERSION));
  useEffect(() => {
    // 通知しないとき（初めての利用など）は、今の DB のバージョンを、確認済みとして記録する
    if (!versionNotice.show) markVersionSeen(DATABASE_VERSION);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 保存の失敗（容量超過・保存が無効）の警告。閉じるまで出す（保存できないまま編集を続けると、データを失うため）
  const [saveFailed, setSaveFailed] = useState<boolean>(false);
  useEffect(() => {
    setWriteFailureHandler(() => setSaveFailed(true));
    return () => setWriteFailureHandler(null);
  }, []);
  const dismissVersionNotice = () => {
    markVersionSeen(DATABASE_VERSION);
    setVersionNotice(n => ({ ...n, show: false }));
  };
  const [copiedNotation, setCopiedNotation] = useState<boolean>(false);
  const [selectedAction, setSelectedAction] = useState<{ stintId: string; actionId: string } | null>(null);

  // 5. Calculate Rotation (strictly non-overlapping consecutive stints & action cascades)
  // gcsim の結果でCT待ちが生じたアクション（アクション ID → 待った秒数）。編集したら消す（結果が古くなるため）
  const [gcsimCtWaits, setGcsimCtWaits] = useState<Record<string, number> | null>(null);
  // 待った原因がスタミナ不足だったアクション ID（表示の理由だけが変わる。D214）
  const [gcsimStaminaWaitIds, setGcsimStaminaWaitIds] = useState<string[]>([]);
  useEffect(() => {
    setGcsimCtWaits(null);
    setGcsimStaminaWaitIds([]);
  }, [characters, visibleStints, switchDelay, loopStartIndex]);
  // gcsim が待たずに実行できたと確認した、アプリの CT 違反のアクション（D214）。保存しない。
  // 反映したときの gcsim の設定文（編成・ローテーション・設定がすべて入る）を覚え、今の設定文と違ったら使わない
  const [gcsimVerified, setGcsimVerified] = useState<{ configText: string; actionIds: string[] } | null>(null);

  // gcsim の結果から読み取った反応の状態（月感電の雲・星電導・草露・月露など。アクション基準。D112）。
  // 実行する前は null（何も出さない）。編成に保存され（gcsim のバージョンつき）、読み込みで戻る。
  // 「どの状態の結果か」を署名で持つ: 編成・交代・ループ基準・アクションの並びを編集して署名が変わったら、出さない
  // （所要時間だけの変更・反映では署名は変わらず、残る）
  const reactionSignature = useMemo(() => makeReactionSignature(characters, switchDelay, loopStartIndex, visibleStints), [characters, switchDelay, loopStartIndex, visibleStints]);
  const reactionSignatureRef = useRef(reactionSignature);
  reactionSignatureRef.current = reactionSignature;
  const [gcsimReactionState, setGcsimReactionState] = useState<{ rows: ReactionRowRef[]; signature: string } | null>(() => {
    const rows = unpackReactions(savedInitialState?.reactions);
    return rows ? { rows, signature: reactionSignature } : null;
  });
  const gcsimReactions: ReactionRowRef[] | null =
    gcsimReactionState && gcsimReactionState.signature === reactionSignature ? gcsimReactionState.rows : null;
  // 読み込んだ編成の反応の行が、古い gcsim のバージョンの計算結果で、出していないとき、そのバージョン（画面に案内を出す。再計算・保存で消す）
  const [staleReactionsVersion, setStaleReactionsVersion] = useState<string | null>(() => {
    const r = reactionsStatus(savedInitialState?.reactions);
    return r.status === 'stale' ? r.savedVersion ?? '旧バージョン' : null;
  });
  /** 反応の行を、今の状態の結果として置く（null で消す） */
  const setGcsimReactions = (rows: ReactionRowRef[] | null) => {
    setGcsimReactionState(rows ? { rows, signature: reactionSignatureRef.current } : null);
    if (rows) setStaleReactionsVersion(null);
  };

  // 4. Automatic Persistence (Every change to characters, stints, loopStartTime is saved)
  // 連続した操作の間は、書き込みを待つ（最後の変更から少し後に 1 回だけ書く）。画面を閉じる・隠すときは、待たずに書く
  useEffect(() => {
    saveActiveStateDebounced({
      party,
      stints,
      loopStartIndex,
      switchDelay,
      activeSlotId,
      reactions: packReactions(gcsimReactions),
    });
  }, [party, stints, loopStartIndex, switchDelay, activeSlotId, gcsimReactions]);
  useEffect(() => {
    const flush = () => flushActiveState();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush(); // 画面の部品が外れるとき（開発中の再読み込みなど）も、書き残さない
    };
  }, []);

  // ガントチャートのドラッグ中の仮の並び（ドロップするまで保存しない。計算だけをこの並びで行う。追加作業 21）
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const previewedStints = useMemo(() => applyDragPreview(visibleStints, dragPreview), [visibleStints, dragPreview]);
  const calculatedResult = useMemo(() => {
    return calculateRotation(characters, previewedStints, { switchDelay, database, loopStartIndex, defHalt, externalCtWaits: gcsimCtWaits ?? undefined, externalStaminaWaitIds: gcsimStaminaWaitIds });
  }, [characters, previewedStints, switchDelay, database, loopStartIndex, defHalt, gcsimCtWaits, gcsimStaminaWaitIds]);

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
  const handleLoadCustomSlot = async (slot: {
    party: PartyMember[];
    stints: Stint[];
    loopStartIndex?: number;
    loopStartTime?: number;
    switchDelay?: number;
    slotId?: string;
    /** 保存した反応の行（gcsim のバージョンが違うときは、出さない） */
    reactions?: unknown;
    /** JSON から読み込んだときの編成名（slotId が無いとき、この名前の保存編成として登録して、読み込み中の編成にする。issue #23） */
    name?: string;
    totalDuration?: number;
  }) => {
    // ファイルから読み込んだ編成（slotId なし・名前あり）は、その名前の保存編成として登録する。
    // 同じ名前の保存編成があるときは、「上書き」か「名前を変更して保存」かを尋ねる（やめたときは、何も読み込まない）
    let importName: string | null = null;
    let overwriteTarget: SavedRotationSlot | undefined;
    if (!slot.slotId && slot.name?.trim()) {
      importName = slot.name.trim();
      for (;;) {
        const dup = findSlotByName(getSavedSlots(), importName);
        if (!dup) break;
        const overwrite = await confirm(
          `「${importName}」と同じ名前の編成が、すでにあります。\n\n` +
          `OK: その編成を上書きして保存する\n` +
          `キャンセル: 名前を変更して保存する`,
        );
        if (overwrite) {
          overwriteTarget = dup;
          break;
        }
        const input = await prompt('変更後の編成名を入力してください', importName);
        if (input === null || !input.trim()) return; // やめる
        importName = input.trim();
      }
    }

    const loadedChars = resolvePartyCharacters(slot.party, database.characters);
    const loadedStints = filterStintsForCharacters(slot.stints, loadedChars);
    const loopIndex = resolveLoopStartIndex(slot, loadedChars, loadedStints, slot);
    setParty(slot.party);
    setStints(slot.stints);
    setLoopStartIndex(loopIndex);
    setSwitchDelay(slot.switchDelay ?? 0.50);
    // 反応の行: 読み込む編成の署名で置く（gcsim のバージョンが違えば、出さない）
    const restoredReactions = unpackReactions(slot.reactions);
    const restoredStatus = reactionsStatus(slot.reactions);
    setStaleReactionsVersion(restoredStatus.status === 'stale' ? restoredStatus.savedVersion ?? '旧バージョン' : null);
    setGcsimReactionState(restoredReactions
      ? { rows: restoredReactions, signature: makeReactionSignature(loadedChars, slot.switchDelay ?? 0.50, loopIndex, loadedStints) }
      : null);
    if (importName) {
      const imported: SavedRotationSlot = {
        // 上書きのときは、既存の保存編成の ID・説明を引き継ぐ
        ...(overwriteTarget ? { description: overwriteTarget.description } : {}),
        id: overwriteTarget ? overwriteTarget.id : `slot_${Date.now()}`,
        name: importName,
        updatedAt: new Date().toISOString(),
        party: slot.party,
        stints: slot.stints,
        loopStartIndex: loopIndex,
        loopStartTime: slot.loopStartTime ?? 0,
        totalDuration: slot.totalDuration ?? 0,
        switchDelay: slot.switchDelay ?? 0.50,
        reactions: packReactions(restoredReactions),
      };
      const saved = trySaveSlot(imported);
      if (saved.ok) {
        setSavedSlots(saved.slots);
        setActiveSlotId(imported.id);
      } else {
        // 編成は読み込めたが、保存編成には登録できなかった（読み込み中の編成にはしない）。
        // 前に開いていた保存編成を指したままだと、「上書き保存」で、取り込んだ内容が、その保存編成を置き換えてしまう
        setActiveSlotId(null);
        showAlert(`編成は読み込みましたが、保存編成には登録できませんでした。
${SLOT_WRITE_FAILED_MESSAGE}`);
      }
      return;
    }
    setActiveSlotId(slot.slotId ?? null);
  };

  // 9. Reset to the initial state (empty party)
  const handleResetToDefault = () => {
    setParty(createEmptyParty());
    setStints([]);
    setLoopStartIndex(0);
    setSwitchDelay(0.50);
    setActiveSlotId(null);
    setGcsimReactionState(null);
    setStaleReactionsVersion(null);
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
  // 記法のモード（略号 / 名称）。回転ごとではなく、アプリ全体の設定（既定: 略号。追加作業 20-B）
  const [notationMode, setNotationModeState] = useState<NotationMode>(() => loadNotationMode());
  const setNotationMode = (mode: NotationMode) => {
    setNotationModeState(mode);
    saveNotationMode(mode);
  };
  const rotationNotation = useMemo(
    () => buildRotationNotation(characters, calculatedResult.calculatedStints, loopStartIndex, notationMode),
    [characters, calculatedResult.calculatedStints, loopStartIndex, notationMode],
  );

  // 現在のメイン画面の状態を、読み込み中の保存編成（スロット）へ上書き保存
  const [overwriteSaved, setOverwriteSaved] = useState<boolean>(false);
  // ヘッダーの「上書き保存」: 読み込み中の編成を、よく上書きする操作なので、確認は出さない（編成管理の「上書」は、確認する）
  const handleOverwriteActiveSlot = () => {
    const slot = savedSlots.find(s => s.id === activeSlotId);
    if (!slot) return;
    const saved = trySaveSlot({
      ...slot,
      party,
      stints,
      loopStartIndex,
      loopStartTime,
      totalDuration,
      switchDelay,
      reactions: packReactions(gcsimReactions),
    });
    if (!saved.ok) {
      showAlert(SLOT_WRITE_FAILED_MESSAGE);
      return;
    }
    setSavedSlots(saved.slots);
    setStaleReactionsVersion(null);
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
      reactions: packReactions(gcsimReactions),
    };
    const saved = trySaveSlot(newSlot);
    if (!saved.ok) {
      // 保存できていないので、保存編成を読み込み中にはしない。ダイアログは開いたままにする（名前を変えて、やり直せる）
      showAlert(SLOT_WRITE_FAILED_MESSAGE);
      return;
    }
    setSavedSlots(saved.slots);
    setStaleReactionsVersion(null);
    setActiveSlotId(newSlot.id);
    setIsSaveAsOpen(false);
  };

  // 「アプリの計算に戻す」: 今のアクションの並びを基準に、gcsim の反映・個別の変更を外して、アプリの計算を全体に再適用する
  const handleResetToAppCalculation = async () => {
    // 戻した後に、前回の「gcsim で計算」の結果の表示・CT 待ちの印・反応の行が残らないようにする
    setGcsimBanner(null);
    setGcsimReactions(null);
    setGcsimCtWaits(null);
    setGcsimVerified(null);
    const summary = resetToAppCalculation(visibleStints);
    // 外す内容がなくても、全体を計算し直す（保存されたアクションの値をすべて作り直した新しい並びで、計算・表示・再生位置を更新する）
    if (summary.actionsChanged === 0 && summary.stintsChanged === 0) {
      updateStints(visibleStints.map(st => ({ ...st, actions: st.actions.map(a => ({ ...a })) })));
      return;
    }
    const ok = await confirm(
      `アクションの並びはそのままに、アプリの計算に戻します。\n\n` +
      `・アクション ${summary.actionsChanged} 件の、所要時間の固定・個別の CT・効果時間・gcsim の補正を外します\n` +
      `・出場ブロック ${summary.stintsChanged} 件の、gcsim から書き込んだ効果を外します（gcsim の結果から追加した発動バフ ${summary.passivesRemoved} 件を削除）\n\n` +
      `※ gcsim の値だけでなく、手で編集した所要時間・CT・効果時間も戻ります。よろしいですか？`,
    );
    if (ok) updateStints(summary.stints);
  };

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
  // 指定の出場・計算結果から gcsim の設定文を作る（コピー・「gcsim で計算」・反映後の「確認済み」の判定で使う）
  const buildGcsimConfigFor = (stintsArg: Stint[], calculatedArg: typeof calculatedResult) => buildGcsimConfig({
      characters,
      stints: stintsArg,
      loopStartIndex,
      switchDelay,
      defHalt,
      hurt,
      weapons: database.weapons,
      artifacts: database.artifacts,
      // 標準より長くした分（所要時間の編集）と、モードの維持のための自動の待ち（出場の最後のアクション。待機のアクションにも足す）
      extraWaitByActionId: Object.fromEntries(
        calculatedArg.calculatedStints.flatMap(s => s.actions)
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
        calculatedArg.calculatedStints.flatMap(s => s.actions).filter(a => a.modeHoldSeconds).map(a => [a.id, a.modeHoldSeconds as number]),
      ),
      holdSecondsByActionId: Object.fromEntries(
        calculatedArg.calculatedStints.flatMap(s => s.actions).filter(a => a.holdSeconds !== undefined).map(a => [a.id, a.holdSeconds as number]),
      ),
      commandByActionId: Object.fromEntries(
        calculatedArg.calculatedStints.flatMap(s => s.actions).filter(a => a.gcsimCommand).map(a => [a.id, a.gcsimCommand as string]),
      ),
    });
  const buildCurrentGcsimConfig = () => buildGcsimConfigFor(visibleStints, calculatedResult);

  // 確認済みの印（D214）: 今の設定文が、確認したときと同じときだけ有効
  const verifiedActionIds = useMemo(() => {
    if (!gcsimVerified) return null;
    const text = buildGcsimConfigFor(visibleStints, calculatedResult).config;
    return text === gcsimVerified.configText ? new Set(gcsimVerified.actionIds) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gcsimVerified, characters, visibleStints, switchDelay, loopStartIndex, defHalt, hurt, database.weapons, database.artifacts, calculatedResult]);
  // 画面に出す出場（確認済みのアクションに印を付ける。計算結果そのものは変えない）
  const displayStints = useMemo(() => {
    if (!verifiedActionIds || verifiedActionIds.size === 0) return calculatedResult.calculatedStints;
    return calculatedResult.calculatedStints.map(st =>
      st.actions.some(a => a.hasCTCollision && verifiedActionIds.has(a.id))
        ? { ...st, actions: st.actions.map(a => (a.hasCTCollision && verifiedActionIds.has(a.id) ? { ...a, ctGcsimVerified: true } : a)) }
        : st);
  }, [calculatedResult, verifiedActionIds]);
  // アプリ自身のCT違反（スキル・爆発。ガントチャートの判定と同じ）。gcsim で確認済みのものは除く
  const ctViolationIssues = useMemo(
    () => calculatedResult.validationIssues.filter(v => /^(skill|burst)_ct_/.test(v.id) && !(v.actionId && verifiedActionIds?.has(v.actionId))),
    [calculatedResult, verifiedActionIds],
  );
  // 全体のCT違反件数（スキル・爆発の発動時点でのクールタイム未終了。確認済みは除く）
  const totalCTCollisions = useMemo(() => {
    let count = 0;
    displayStints.forEach(s => {
      count += s.actions.filter(a => a.hasCTCollision && !a.ctGcsimVerified).length;
    });
    return count;
  }, [displayStints]);

  const handleCopyGcsimConfig = () => {
    const result = buildCurrentGcsimConfig();
    setGcsimResult(result);
    void copyGcsimText(result.config);
  };

  // 「gcsim で計算」（6-5。D120）: 設定文を作り、実行して、CT 待ちが無ければ結果を一括で反映する
  const [gcsimComputing, setGcsimComputing] = useState(false);
  const [gcsimBanner, setGcsimBanner] = useState<GcsimComputeBannerState | null>(null);
  // 画面と、配信している gcsim（WebAssembly 版）の版が合っていないときに警告する（公開サイトで、画面だけ新しい／古いキャッシュが残る場合）
  useEffect(() => {
    let cancelled = false;
    checkWasmVersionMismatch(GCSIM_COMMIT).then(message => {
      if (!cancelled && message) setGcsimBanner({ level: 'warn', title: 'gcsim の版が合っていません', message });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // 「gcsim で計算」の結果（反映した・しなかった・エラー）を、画面の位置にかかわらず見られるよう、結果が出たら最上部へスクロールする
  const scrollToResultRef = useRef(false);
  useEffect(() => {
    if (!scrollToResultRef.current || !gcsimBanner || gcsimBanner.level === 'running') return;
    scrollToResultRef.current = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [gcsimBanner]);
  const handleGcsimCompute = async () => {
    if (gcsimComputing) return;
    scrollToResultRef.current = true;
    const result = buildCurrentGcsimConfig();
    const errors = result.warnings.filter(w => w.level === 'error');
    if (errors.length > 0) {
      setGcsimBanner({
        level: 'error',
        title: 'gcsim で実行できない要素があるため、計算しませんでした',
        message: '「gcsim設定文をコピー」のポップアップで、詳しい警告を確認できます。',
        details: errors.map(w => w.message),
      });
      return;
    }
    // アプリでは CT 違反でも、gcsim で実際に計算すると待たないことがある。実行して確かめる（待ちが出たら反映しない）
    if (ctViolationIssues.length > 0) {
      const ok = await confirm(
        `アプリでは CT 違反が ${ctViolationIssues.length} 件あります。gcsim で実際に計算して確認します（gcsim でも CT 待ちが出たら反映しません）。\n\n` +
        `祭礼の武器があると、数十秒かかります。実行しますか？`,
        { okLabel: '実行する' },
      );
      if (!ok) {
        scrollToResultRef.current = false;
        return;
      }
    }
    setGcsimComputing(true);
    setGcsimBanner({ level: 'running', title: 'gcsim で計算しています…', message: '祭礼の武器があると、種を探すので、数十秒かかることがあります。' });
    const outcome = await runGcsimForConfig(result, calculatedResult);
    setGcsimComputing(false);
    if (outcome.status !== 'ok') {
      setGcsimBanner(outcome.status === 'unreachable'
        ? (getLastGcsimEngine() === 'wasm'
          ? { level: 'error', title: 'gcsim（ブラウザ内の WebAssembly 版）を実行できませんでした', message: outcome.message + '\nページを再読み込みしてください。直らないときは、別のブラウザをお試しください。' }
          : { level: 'error', title: 'gcsim サーバーに接続できませんでした', message: outcome.message + '\nサーバーを起動してください（npm run gcsim:start）。' })
        : { level: 'error', title: 'gcsim の実行エラー', message: outcome.message });
      return;
    }
    const waitIds = Object.keys(outcome.waits.byActionId);
    setGcsimCtWaits(waitIds.length > 0 ? outcome.waits.byActionId : null);
    setGcsimStaminaWaitIds(outcome.waits.staminaActionIds);
    if (waitIds.length > 0 || outcome.align.mismatch) {
      setGcsimReactions(null);
      setGcsimVerified(null);
      const staminaIds = new Set(outcome.waits.staminaActionIds);
      const staminaCount = waitIds.filter(id => staminaIds.has(id)).length;
      const ctCount = waitIds.length - staminaCount;
      const detailLines = waitIds.map(id => {
        const idx = visibleStints.findIndex(st => st.actions.some(a => a.id === id));
        const action = idx >= 0 ? visibleStints[idx].actions.find(a => a.id === id) : undefined;
        const name = idx >= 0 ? characters.find(c => c.id === visibleStints[idx].characterId)?.name : undefined;
        return `${name ?? '?'}（出場 #${idx + 1}）「${action?.name ?? id}」: ${staminaIds.has(id) ? 'スタミナ待ち' : 'CT 待ち'} ${outcome.waits.byActionId[id]} 秒`;
      });
      setGcsimBanner(waitIds.length > 0
        ? {
          level: 'warn',
          title: `gcsim で待ちが生じたため、結果を反映していません（CT 待ち ${ctCount} 件・スタミナ待ち ${staminaCount} 件）`,
          message: '該当アクションに、CT 違反と同じ印を付けました（残り = gcsim で実際に待った秒数）。ガントチャートの該当アクションを直して、もう一度計算してください。',
          details: detailLines,
        }
        : {
          level: 'warn',
          title: '設定文と gcsim のログのアクションの並びが合わないため、反映できません',
          message: outcome.align.mismatch,
        });
      return;
    }
    // 反応の状態（月反応・星反応）
    setGcsimReactions(anchorReactionRows(extractReactionRows(outcome.logs), reactionLapInputs(outcome.align.pairs)));
    const plan = computeGcsimApply({ stints: visibleStints, calculated: calculatedResult, result, buffsByCharacter, actionLinks, outcome });
    // 反映後も残るアプリの CT 違反は、gcsim が待たずに実行できているので「確認済み」にする（D214）。
    // 反映後の状態の設定文を覚え、編集で設定文が変わったら、自動で赤に戻る
    {
      const nextStints = plan.total > 0 ? plan.stints.map(normalizeGroups) : visibleStints;
      const post = plan.total > 0
        ? calculateRotation(characters, nextStints, { switchDelay, database, loopStartIndex, defHalt })
        : calculatedResult;
      const residual = post.calculatedStints.flatMap(st => st.actions).filter(a => a.hasCTCollision).map(a => a.id);
      setGcsimVerified(residual.length > 0
        ? { configText: buildGcsimConfigFor(nextStints, post).config, actionIds: residual }
        : null);
    }
    const warnCount = result.warnings.filter(w => w.level === 'warn').length;
    if (plan.total > 0) updateStints(plan.stints);
    setGcsimBanner({
      level: warnCount > 0 ? 'warn' : 'success',
      title: plan.total > 0 ? 'gcsim の計算結果を反映しました' : 'gcsim で計算しました（アプリの値と同じため、変更はありません）',
      message: summarizeApplyPlan(plan)
        + (warnCount > 0 ? '\n設定文の警告が ' + warnCount + ' 件あります（「gcsim設定文をコピー」のポップアップで確認できます）。' : '')
        + (plan.total > 0 ? '\n取り消すには「アプリの計算に戻す」を押してください。' : ''),
      details: describeApplyPlan(plan, visibleStints, result.members),
    });
  };

  const handleCopyNotation = () => {
    navigator.clipboard.writeText(rotationNotation);
    setCopiedNotation(true);
    setTimeout(() => setCopiedNotation(false), 2000);
  };

  // 12. Export / Import JSON
  const handleExportJson = () => {
    // 編成名: 読み込み中の保存編成の名前。未保存なら「メンバー名（時間）」。ファイル名にも使う（issue #23）
    const name = buildDefaultSlotName(characters, totalDuration, activeSlot);
    const data = buildRotationExport({
      name,
      party,
      stints,
      loopStartIndex,
      loopStartTime,
      totalDuration,
      switchDelay,
      reactions: packReactions(gcsimReactions),
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = rotationFileName(name);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = parseRotationPayload(JSON.parse(ev.target?.result as string));
        if (result.ok === false) {
          showAlert(result.error);
          return;
        }
        const v = result.value;
        handleLoadCustomSlot({
          party: v.party,
          stints: v.stints,
          loopStartIndex: v.loopStartIndex,
          loopStartTime: v.loopStartTime ?? 0,
          switchDelay: v.switchDelay ?? switchDelay,
          totalDuration: v.totalDuration,
          reactions: v.reactions,
          name: v.name || nameFromFileName(file.name),
        });
        if (totalSkipped(result.skipped) > 0) showAlert(`壊れていた項目（${describeSkipped(result.skipped)}）は、読み飛ばして読み込みました。`);
      } catch (err) {
        showAlert('JSONファイルの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {saveFailed && (
        <div role="alert" className="flex items-start justify-between gap-3 bg-red-950 border-b border-red-800 px-4 py-2 text-xs text-red-100">
          <span>
            ブラウザに保存できませんでした（保存容量の不足、またはブラウザの設定で保存が無効になっている可能性があります）。
            このまま編集すると、画面を閉じたときに内容を失います。「保存/読み込み」の「JSONファイル書き出し」で、今の編成をファイルに保存してください（「全データを書き出す」は、保存先を読むので、保存に失敗した最新の編集は入りません）。
          </span>
          <button type="button" onClick={() => setSaveFailed(false)} className="shrink-0 rounded border border-red-700 px-2 py-0.5 hover:bg-red-900">閉じる</button>
        </div>
      )}
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
          reactions: slot.reactions,
        })}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onResetPlayback={resetPlayback}
        currentTime={currentTime}
        totalDuration={totalDuration}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={setPlaybackSpeed}
        onOpenPartyModal={() => setIsPartyModalOpen(true)}
        onOpenHelpModal={() => setIsUsageOpen(true)}
        onOpenSaveModal={() => setIsSaveModalOpen(true)}
        onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onCopyNotation={handleCopyNotation}
        onCopyGcsimConfig={handleCopyGcsimConfig}
        onGcsimCompute={() => void handleGcsimCompute()}
        gcsimComputing={gcsimComputing}
        onResetToAppCalculation={handleResetToAppCalculation}
        copiedNotation={copiedNotation}
        loopStartTime={loopStartTime}
        rotationNotation={rotationNotation}
        notationMode={notationMode}
        onChangeNotationMode={setNotationMode}
        totalCTCollisions={totalCTCollisions}
        totalCTWarnings={totalCTWarnings}
        playbackCycleCount={playbackCycleCount}
        loopPeriod={loopPeriod}
      />

      {/* 「gcsim で計算」の結果（実行中・反映・警告・エラー） */}
      <GcsimComputeBanner state={gcsimBanner} onClose={() => setGcsimBanner(null)} />

      {/* 読み込んだ編成の反応の行が、古い gcsim のバージョンの計算結果のとき（反応の行を出していない理由と、再計算の案内） */}
      {staleReactionsVersion && !gcsimReactions && (
        <div className="mx-auto max-w-[1600px] my-2 px-3 py-2 rounded-lg border border-amber-700/60 bg-amber-950/40 text-amber-100 text-xs flex items-start gap-2" data-testid="stale-reactions-notice">
          <span className="flex-1">
            この編成の「反応の行」は、gcsim {staleReactionsVersion} の計算結果のため、今の gcsim（{GCSIM_VERSION}）では表示しません。
            「gcsim で計算」で再計算すると、表示されます（アクションの並び・CT などは、そのまま使えます）。
          </span>
          <button type="button" className="underline shrink-0" onClick={() => setStaleReactionsVersion(null)}>閉じる</button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {/* Visual Gantt Chart (Swimlanes with strict vertical alignment) */}
        <GanttChart
          database={database}
          characters={characters}
          stints={displayStints}
          onPreviewReorder={setDragPreview}
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
          onSelectAction={(stintId, actionId) => setSelectedAction(stintId ? { stintId, actionId } : null)}
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
          hurt={hurt}
          onUpdateHurt={setHurt}
          selectedAction={selectedAction}
          onSelectAction={(stintId, actionId) => setSelectedAction(stintId ? { stintId, actionId } : null)}
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
        reactions={packReactions(gcsimReactions)}
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

      {/* アプリの更新の通知（マスターデータの全削除 → 動的生成の案内） */}
      <UpdateNoticeModal
        isOpen={versionNotice.show}
        previous={versionNotice.previous}
        current={versionNotice.current}
        onClose={dismissVersionNotice}
        onOpenDatabase={() => {
          dismissVersionNotice();
          setIsDatabaseModalOpen(true);
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

      {/* 使い方（基本の流れ・操作・gcsim・保存・記法） */}
      <UsageGuideModal isOpen={isUsageOpen} onClose={() => setIsUsageOpen(false)} />

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

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 px-4 py-3 text-center text-xs text-slate-500">
        <p>
          原神戦闘ローテーション ガントチャート設計ツール ✦ 出場ターンの数珠つなぎ（直列スナップ）とクールタイム・バフ重複可視化
        </p>
        <SourceNotice />
      </footer>
    </div>
  );
}

