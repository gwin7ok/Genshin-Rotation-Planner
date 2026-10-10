import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  Clock, 
  Zap, 
  Flame, 
  GripVertical, 
  Edit3, 
  CornerDownRight,
  Info,
  HelpCircle,
  Sparkles,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Target,
  X
} from 'lucide-react';
import { CharacterAvatar } from './CharacterAvatar';
import { ElementIcon } from './ElementIcon';
import { 
  CharacterConfig, 
  Stint, 
  CharacterActionInstance, 
  ActionDefinition,
  ActionType,
  PassiveEffectDefinition,
  PassiveTriggerInstance,
} from '../types/genshin';
import { GenshinDatabase } from '../types/database';
import { ELEMENT_COLORS, isEmptySlotCharacter } from '../data/characters';
import { getActionCooldownInfo, getActionEffectInfo } from '../utils/characterActions';
import { scrollStintCardBelowSticky, focusStintInGantt, ACTION_BUILDER_STICKY_ID, ACTION_BUILDER_BOTTOM_SPACER_ID } from '../utils/scrollToStintCard';
import { StintBuffTriggersSection } from './StintBuffTriggersSection';
import { CharacterModel } from '../models/CharacterModel';
import { actionDelayOf } from '../utils/actionDelay';
import { actionTone } from '../utils/actionTone';
import { actionDescription } from '../utils/actionDescription';
import { DEFAULT_HURT, hurtStatement, type HurtSetting } from '../utils/gcsim/buildGcsimConfig';
import { isModeHoldAction } from '../utils/modeHoldAction';

interface StintSequenceEditorProps {
  characters: CharacterConfig[];
  stints: Stint[];
  onUpdateStints: (newStints: Stint[]) => void;
  activeTime: number;
  onSeek?: (time: number) => void;
  switchDelay?: number;
  onUpdateSwitchDelay?: (delay: number) => void;
  /** 敵の防御ヒットストップ（gcsim の defhalt）。既定 true */
  defHalt?: boolean;
  onUpdateDefHalt?: (value: boolean) => void;
  /** 敵から受けるダメージ（gcsim の hurt。既定: 無効） */
  hurt?: HurtSetting;
  onUpdateHurt?: (value: HurtSetting) => void;
  onOpenHelpModal?: () => void;
  selectedAction?: { stintId: string; actionId: string } | null;
  onSelectAction?: (stintId: string, actionId: string) => void;
  loopStartTime?: number;
  /** 2周目ループの開始位置（何番目の出場キャラの前か。0=基準なし） */
  loopStartIndex?: number;
  database?: GenshinDatabase;
}

/** 固定表示部分の「ガントチャート連動選択中」バーを表示するか（現在は非表示。要素は残してある） */
const SHOW_SELECTED_ACTION_BAR = false;

export const StintSequenceEditor: React.FC<StintSequenceEditorProps> = ({
  characters,
  stints,
  onUpdateStints,
  activeTime,
  onSeek,
  switchDelay = 0.50,
  onUpdateSwitchDelay,
  defHalt = true,
  onUpdateDefHalt,
  hurt = DEFAULT_HURT,
  onUpdateHurt,
  onOpenHelpModal,
  selectedAction,
  onSelectAction,
  loopStartTime = 0,
  loopStartIndex = 0,
  database,
}) => {
  const [draggedStintIndex, setDraggedStintIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedAction, setDraggedAction] = useState<{ stintIndex: number; actionIndex: number } | null>(null);
  const [editingNoteStintId, setEditingNoteStintId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showGuideBanner, setShowGuideBanner] = useState(true);
  const [confirmClearStints, setConfirmClearStints] = useState(false);
  // CT入力欄の操作中は、アクションチップのドラッグ移動を無効にする（入力欄の文字選択と干渉するため）
  const [ctHoverActionId, setCtHoverActionId] = useState<string | null>(null);

  // 出場ブロックの追加・削除でガントチャート（このエリアより上）の高さが変わっても、
  // 見た目上スクロールしないよう、変更前後のこのエリアの位置差分だけスクロール位置を補正する
  const sectionRef = useRef<HTMLElement>(null);
  const pendingScrollAnchorTop = useRef<number | null>(null);

  const updateStintsKeepingScroll = (next: Stint[]) => {
    if (sectionRef.current) {
      pendingScrollAnchorTop.current = sectionRef.current.getBoundingClientRect().top;
    }
    onUpdateStints(next);
  };

  useLayoutEffect(() => {
    const prevTop = pendingScrollAnchorTop.current;
    if (prevTop === null || !sectionRef.current) return;
    pendingScrollAnchorTop.current = null;
    const delta = sectionRef.current.getBoundingClientRect().top - prevTop;
    if (Math.abs(delta) >= 1) window.scrollBy(0, delta);
  });

  const characterMap = useMemo(() => {
    const map = new Map<string, CharacterConfig>();
    characters.forEach(c => map.set(c.id, c));
    return map;
  }, [characters]);

  // Find detailed info about the currently selected action (synchronized with Gantt Chart)
  const selectedActionInfo = useMemo(() => {
    if (!selectedAction) return null;
    const stintIndex = stints.findIndex(s => s.id === selectedAction.stintId);
    if (stintIndex === -1) return null;
    const stint = stints[stintIndex];
    const actIndex = stint.actions.findIndex(a => a.id === selectedAction.actionId);
    if (actIndex === -1) return null;
    const action = stint.actions[actIndex];
    const char = characterMap.get(stint.characterId) || characters[0];
    return { stint, stintIndex, action, actIndex, char };
  }, [selectedAction, stints, characterMap, characters]);

  // Sanitize helper to ensure raw stints stored in parent state do not hold duplicate automatic swap actions or stale runtime CT properties
  const sanitizeStintsForUpdate = (rawList: Stint[]): Stint[] => {
    return rawList.map(({ modeHold, ...s }) => ({
      ...s,
      actions: s.actions
        .filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char')
        .map(a => {
          const { hasCTCollision, collisionRemainingCT, specialWindowWarning, usedSpecialCharge, holdSeconds, inStateWindow, modeHoldSeconds, startTime, endTime, ...rest } = a;
          return rest;
        })
    }));
  };

  // --- Stint Macro Reordering ---
  const moveStint = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= stints.length) return;
    const next = [...stints];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onUpdateStints(sanitizeStintsForUpdate(next));
  };

  const duplicateStint = (index: number) => {
    const original = stints[index];
    const cloned: Stint = {
      ...original,
      id: `stint_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      actions: original.actions
        .filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char')
        .map(a => ({
          ...a,
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
        })),
      passiveTriggers: (original.passiveTriggers ?? []).map(t => ({
        ...t,
        id: `ptrg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      })),
    };
    const next = [...stints];
    next.splice(index + 1, 0, cloned);
    updateStintsKeepingScroll(sanitizeStintsForUpdate(next));
  };

  const removeStint = (index: number) => {
    const next = stints.filter((_, i) => i !== index);
    updateStintsKeepingScroll(sanitizeStintsForUpdate(next));
  };

  const addStint = (characterId: string) => {
    const char = characterMap.get(characterId);
    if (!char) return;
    
    // アクションは空で登録（2番目以降のキャラ交代は計算時に自動挿入される）
    const newStint: Stint = {
      id: `stint_${Date.now()}`,
      characterId,
      note: '',
      actions: [],
    };
    updateStintsKeepingScroll(sanitizeStintsForUpdate([...stints, newStint]));
  };

  // --- Action Micro Operations ---
  const moveAction = (stintIndex: number, fromActIdx: number, toActIdx: number) => {
    const targetStint = stints[stintIndex];
    if (!targetStint || toActIdx < 0 || toActIdx >= targetStint.actions.length) return;
    
    // Prevent moving into or past the swap action at index 0 if present
    const hasSwap = targetStint.actions[0]?.type === 'swap';
    if (hasSwap && (toActIdx === 0 || fromActIdx === 0)) return;

    const newActions = [...targetStint.actions];
    const [moved] = newActions.splice(fromActIdx, 1);
    newActions.splice(toActIdx, 0, moved);

    const nextStints = [...stints];
    nextStints[stintIndex] = { ...targetStint, actions: newActions };
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
  };

  // アクションごとの遅延（そのアクションの終了後に入れる秒数）
  const updateActionDelay = (stintIndex: number, actionId: string, delay: number) => {
    const value = Math.max(0, Number(delay.toFixed(2)));
    const nextStints = stints.map((s, i) => i !== stintIndex ? s : {
      ...s,
      actions: s.actions.map(a => a.id === actionId ? { ...a, delayAfter: value } : a),
    });
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
  };

  // 全アクションの遅延を同じ値にそろえる
  const setAllActionDelays = (delay: number) => {
    const nextStints = stints.map(s => ({
      ...s,
      actions: s.actions.map(a => (a.type === 'swap' ? a : { ...a, delayAfter: delay })),
    }));
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
  };

  /** 「待機」（何もしないで待つアクション。issue #28）。長さの既定は 1 秒。所要時間の欄で変える */
  const WAIT_DEFAULT_SECONDS = 1;

  const addActionToStint = (stintIndex: number, actionDef: ActionDefinition | 'wait') => {
    const targetStint = stints[stintIndex];
    if (!targetStint) return;

    const newId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newAction: CharacterActionInstance = actionDef === 'wait'
      ? { id: newId, actionTypeId: 'wait', name: '待機', shortName: 'w', type: 'wait', duration: WAIT_DEFAULT_SECONDS }
      : {
        id: newId,
        actionTypeId: actionDef.id,
        name: actionDef.name,
        shortName: actionDef.shortName,
        type: actionDef.type,
        duration: actionDef.defaultDuration,
      };

    // 追加位置（追加作業 21 / issue #26）: 選択中のアクションが、この出場の中にあれば、その直前（交代アクションなら、その直後）。
    // 別の出場のアクションを選択中・アクションの選択なしのときは、末尾。追加しても、選択は変えない（連続して追加すると、追加した順に並ぶ）
    let insertAt = targetStint.actions.length;
    if (selectedAction && selectedAction.stintId === targetStint.id && selectedAction.actionId) {
      const idx = targetStint.actions.findIndex(a => a.id === selectedAction.actionId);
      if (idx >= 0) insertAt = targetStint.actions[idx].type === 'swap' ? idx + 1 : idx;
    }
    const actions = [...targetStint.actions];
    actions.splice(insertAt, 0, newAction);

    const nextStints = [...stints];
    nextStints[stintIndex] = { ...targetStint, actions };
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
  };

  // 登録済みアクションの CT / 効果継続時間を個別に変更（アクション定義と同じ値になったら個別設定を解除）
  const updateActionTiming = (
    stintIndex: number,
    actionIndex: number,
    field: 'cooldown' | 'effectDuration',
    value: number,
    defaultValue: number,
  ) => {
    const targetStint = stints[stintIndex];
    if (!targetStint || !Number.isFinite(value)) return;
    const act = targetStint.actions[actionIndex];
    if (!act || act.type === 'swap') return;

    const nextValue = Math.min(999, Math.max(0, Number(value.toFixed(2))));
    const nextActions = [...targetStint.actions];
    const { [field]: _omit, ...rest } = act;
    nextActions[actionIndex] = nextValue === defaultValue ? rest : { ...rest, [field]: nextValue };
    const nextStints = [...stints];
    nextStints[stintIndex] = { ...targetStint, actions: nextActions };
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
  };

  // --- 発動バフ（固有天賦） ---
  const updateStintPassiveTriggers = (stintIndex: number, update: (list: PassiveTriggerInstance[]) => PassiveTriggerInstance[]) => {
    const targetStint = stints[stintIndex];
    if (!targetStint) return;
    const nextStints = [...stints];
    nextStints[stintIndex] = { ...targetStint, passiveTriggers: update(targetStint.passiveTriggers ?? []) };
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
  };

  // 登録時の発動位置: 出場の先頭（キャラ交代があればその直後）
  const addPassiveTrigger = (stintIndex: number, def: PassiveEffectDefinition) => {
    const stint = stints[stintIndex];
    if (!stint) return;
    const swap = stint.actions.find(a => a.type === 'swap' || a.actionTypeId === 'action_switch_char');
    const offset = swap ? Number(((swap.endTime ?? 0) - (stint.startTime ?? 0)).toFixed(3)) : 0;
    updateStintPassiveTriggers(stintIndex, list => [
      ...list,
      { id: `ptrg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, passiveEffectId: def.id, name: def.name, offset },
    ]);
  };

  const updatePassiveTriggerTiming = (
    stintIndex: number,
    triggerId: string,
    field: 'duration' | 'cooldown',
    value: number,
    defaultValue: number,
  ) => {
    if (!Number.isFinite(value)) return;
    const nextValue = Math.min(999, Math.max(0, Number(value.toFixed(2))));
    updateStintPassiveTriggers(stintIndex, list => list.map(t => {
      if (t.id !== triggerId) return t;
      const { [field]: _omit, ...rest } = t;
      return nextValue === defaultValue ? rest : { ...rest, [field]: nextValue };
    }));
  };

  const removePassiveTrigger = (stintIndex: number, triggerId: string) => {
    updateStintPassiveTriggers(stintIndex, list => list.filter(t => t.id !== triggerId));
  };

  const removeActionFromStint = (stintIndex: number, actionIndex: number) => {
    const targetStint = stints[stintIndex];
    if (!targetStint) return;

    const userActions = targetStint.actions.filter(a => a.type !== 'swap');
    if (userActions.length === 0) return;

    const nextStints = [...stints];
    // 維持のアクションを外したら、この出場の維持をオフにする（オンのままだと、自動でまた足される）
    const removingHold = isModeHoldAction(targetStint.actions[actionIndex] ?? {});
    nextStints[stintIndex] = {
      ...targetStint,
      actions: targetStint.actions.filter((_, i) => i !== actionIndex),
      ...(removingHold ? { holdMode: false } : {}),
    };
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
  };

  const updateActionDuration = (stintIndex: number, actionIndex: number, delta: number) => {
    const targetStint = stints[stintIndex];
    if (!targetStint) return;

    const act = targetStint.actions[actionIndex];
    if (act.type === 'swap') {
      const nextDelay = Math.max(0, Number((switchDelay + delta).toFixed(2)));
      onUpdateSwitchDelay?.(nextDelay);
      return;
    }

    const newDuration = Math.max(0.1, Number((act.duration + delta).toFixed(2)));

    const nextStints = [...stints];
    const nextActions = [...targetStint.actions];
    // 所要時間の編集はホールド秒数の編集になりうるので、gcsim から書き戻したCT開始位置は消して計算値に戻す（D37-2）
    const { gcsimCtOffset: _dropped, ...actWithoutCtOffset } = act;
    nextActions[actionIndex] = { ...actWithoutCtOffset, duration: newDuration, durationManual: true };
    nextStints[stintIndex] = { ...targetStint, actions: nextActions };
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
  };

  // モードの維持（出場を、モードの終わりまで自動で延ばす）の切り替え。保存するのは、切り替えの状態だけ
  const toggleHoldMode = (stintIndex: number) => {
    const nextStints = [...stints];
    nextStints[stintIndex] = { ...nextStints[stintIndex], holdMode: !nextStints[stintIndex].modeHold?.on };
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
  };

  const saveNote = (stintIndex: number) => {
    const nextStints = [...stints];
    nextStints[stintIndex] = { ...nextStints[stintIndex], note: noteText };
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
    setEditingNoteStintId(null);
  };

  return (
    <section ref={sectionRef} className="bg-slate-900 border-b border-slate-800 p-4 w-full max-w-full">
      <div className="w-full space-y-4">
        
        {/* Sticky Header Container: セクション見出し・並び替えパイプライン・選択中アクション */}
        <div id={ACTION_BUILDER_STICKY_ID} className="sticky top-[var(--header-height,0px)] z-30 bg-slate-900/95 backdrop-blur-md pt-2 pb-3 -mx-4 px-4 border-b border-slate-800/80 shadow-xl space-y-3 transition-all">
          {/* Section Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  アクション構築
                  <span className="text-xs font-semibold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                    順番入れ替え対応
                  </span>
                </h2>

                {/* 出場ブロック・アクションのみ全クリア（編成のキャラ登録は維持） */}
                {confirmClearStints ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-red-300">出場キャラ・アクションを全て消去しますか？（編成は残ります）</span>
                    <button
                      type="button"
                      onClick={() => {
                        updateStintsKeepingScroll([]);
                        setConfirmClearStints(false);
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors shadow-sm"
                    >
                      消去する
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearStints(false)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      やめる
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearStints(true)}
                    disabled={stints.length === 0}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/40 transition-colors shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                    title="編成のキャラ登録は残したまま、タイムライン上の出場ブロックとアクションをすべて消去します"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>出場キャラ・アクションを全クリア</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                各キャラの登場順を入れ替えると、前の退場と次の登場が自動で数珠つなぎ（垂直スナップ）されます。
              </p>
            </div>

            <div className="flex items-center gap-2">
              {onOpenHelpModal && (
                <button
                  onClick={onOpenHelpModal}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors"
                  title="順番の入れ替え方法を見る"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>入れ替え方法ガイド</span>
                </button>
              )}

              {/* Add Stint Button Group */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 px-2 font-medium">出場追加:</span>
                {characters.filter(c => !isEmptySlotCharacter(c)).map(c => {
                  const elemTheme = ELEMENT_COLORS[c.element];
                  return (
                    <button
                      key={c.id}
                      onClick={() => addStint(c.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 transition-colors shadow-sm"
                      title={`${c.name}の出場ブロックを末尾に追加`}
                    >
                      <span className={`w-2 h-2 rounded-full ${elemTheme.bg} border ${elemTheme.border}`}></span>
                      <span>{c.name}</span>
                      <Plus className="w-3 h-3 text-slate-400" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* =========================================================================
              1. Prominent Quick Reorder Pipeline (登場順序クイック並び替えバー)
          ========================================================================= */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>登場順序クイック並び替えパイプライン</span>
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  （チップをドラッグして順番を変更できます）
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGuideBanner(!showGuideBanner)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  {showGuideBanner ? 'ガイドを非表示' : '操作方法を見る'}
                </button>
              </div>
            </div>

            {/* Interactive Chips Pipeline */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 custom-scrollbar">
              {stints.map((stint, idx) => {
                const char = characterMap.get(stint.characterId);
                if (!char) return null;
                const isFirst = idx === 0;
                const isLast = idx === stints.length - 1;
                const isCurrent = (stint.startTime ?? 0) <= activeTime && activeTime < (stint.endTime ?? 0);
                const isSelected = selectedAction?.stintId === stint.id;

                const handleChipClick = () => {
                  const targetAct = stint.actions.find(a => a.type !== 'swap') || stint.actions[0];
                  if (targetAct && onSelectAction) {
                    onSelectAction(stint.id, targetAct.id);
                  }
                  if (targetAct && onSeek) {
                    onSeek(targetAct.startTime ?? 0);
                  }
                  scrollStintCardBelowSticky(stint.id);
                };

                return (
                  <React.Fragment key={stint.id}>
                    <div
                      draggable
                      onDragStart={() => setDraggedStintIndex(idx)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverIndex(idx);
                      }}
                      onDrop={() => {
                        if (draggedStintIndex !== null && draggedStintIndex !== idx) {
                          moveStint(draggedStintIndex, idx);
                        }
                        setDraggedStintIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedStintIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={`shrink-0 flex items-center gap-1.5 p-1.5 pr-2 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-slate-900 ring-2 ring-yellow-400 border-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.6)] font-bold scale-[1.02]'
                          : isCurrent
                          ? 'bg-amber-500/20 border-amber-400 shadow-md ring-1 ring-amber-400/50'
                          : dragOverIndex === idx
                          ? 'bg-sky-500/20 border-sky-400 scale-105'
                          : 'bg-slate-900 border-slate-700/80 hover:border-slate-500'
                      }`}
                    >
                      {/* Character Avatar & Number (Click to Select Focus) */}
                      <div
                        onClick={handleChipClick}
                        className="flex items-center gap-1.5 select-none cursor-pointer"
                        title={`${char.name}の出場ブロックを選択フォーカス（クリックでガントチャート＆設定画面に連動強調表示）`}
                      >
                        <span className={`w-4 h-4 rounded-full text-[10px] font-mono font-bold flex items-center justify-center border ${
                          isSelected
                            ? 'bg-yellow-400 text-slate-950 border-yellow-300 shadow-sm'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {idx + 1}
                        </span>
                        <CharacterAvatar char={char} className="w-5 h-5 rounded-md text-[10px]" borderWidth={1} />
                        <span className="text-xs font-bold text-white truncate max-w-[80px]">
                          {char.name}
                        </span>
                        {isSelected && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-black bg-yellow-400 text-slate-950 animate-pulse shrink-0">
                            選択中
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-amber-300/80">
                          ({(stint.duration ?? 0).toFixed(1)}s)
                        </span>
                      </div>

                      {/* この出場ブロックを削除（右端。順序の入れ替えはドラッグ＆ドロップ） */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeStint(idx);
                        }}
                        className="w-4 h-4 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-red-600 transition-colors shrink-0"
                        title={`${char.name}の出場ブロック（${idx + 1}番目）を削除`}
                        aria-label="出場ブロックを削除"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Arrow Connector between chips */}
                    {!isLast && (
                      <span className="text-slate-600 shrink-0 text-xs font-bold">➔</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* =========================================================================
              3. Selected Action Focused Control Bar or Action Description Line
          ========================================================================= */}
          {SHOW_SELECTED_ACTION_BAR && selectedActionInfo ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/70 border-2 border-amber-400 rounded-xl shadow-2xl text-xs animate-in fade-in">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2 py-0.5 rounded font-black text-xs bg-amber-400 text-slate-950 flex items-center gap-1 shadow-sm">
                  <Target className="w-3.5 h-3.5" />
                  <span>ガントチャート連動選択中</span>
                </span>
                <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedActionInfo.char.color }} />
                  <span>{selectedActionInfo.char.name}</span>
                  <span className="text-amber-300 font-mono text-xs">
                    {selectedActionInfo.action.shortName} ({selectedActionInfo.action.name})
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-300 bg-slate-950/70 px-2 py-0.5 rounded border border-slate-700">
                  <span>開始: {(selectedActionInfo.action.startTime ?? 0).toFixed(2)}s</span>
                  <span>→</span>
                  <span>終了: {(selectedActionInfo.action.endTime ?? 0).toFixed(2)}s</span>
                  <span className="text-amber-400 font-bold ml-1">({selectedActionInfo.action.duration.toFixed(2)}s)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded border border-slate-700">
                  <span className="text-[10px] text-slate-400 px-1">秒数調整:</span>
                  <button
                    onClick={() => updateActionDuration(selectedActionInfo.stintIndex, selectedActionInfo.actIndex, 0.1)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 font-mono font-bold text-xs"
                    title="所要時間 +0.1秒"
                  >
                    +0.1s
                  </button>
                  <button
                    onClick={() => updateActionDuration(selectedActionInfo.stintIndex, selectedActionInfo.actIndex, -0.1)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 font-mono font-bold text-xs"
                    title="所要時間 -0.1秒"
                  >
                    -0.1s
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded border border-slate-700">
                  <span className="text-[10px] text-slate-400 px-1">順序入替:</span>
                  <button
                    onClick={() => moveAction(selectedActionInfo.stintIndex, selectedActionInfo.actIndex, selectedActionInfo.actIndex - 1)}
                    disabled={selectedActionInfo.actIndex === 0}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs disabled:opacity-20"
                    title="前の順序へ"
                  >
                    ◀ 前へ
                  </button>
                  <button
                    onClick={() => moveAction(selectedActionInfo.stintIndex, selectedActionInfo.actIndex, selectedActionInfo.actIndex + 1)}
                    disabled={selectedActionInfo.actIndex === selectedActionInfo.stint.actions.length - 1}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs disabled:opacity-20"
                    title="次の順序へ"
                  >
                    次へ ▶
                  </button>
                </div>

                <button
                  onClick={() => {
                    removeActionFromStint(selectedActionInfo.stintIndex, selectedActionInfo.actIndex);
                    onSelectAction?.('', '');
                  }}
                  disabled={selectedActionInfo.action.type === 'swap'}
                  className="px-2 py-1 rounded bg-red-950 hover:bg-red-800 text-red-200 text-xs border border-red-800 disabled:opacity-20 flex items-center gap-1"
                  title="このアクションを削除"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>削除</span>
                </button>

                <button
                  onClick={() => onSelectAction?.('', '')}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                  title="選択を解除"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* =========================================================================
            固定表示の対象外: 並び替えガイド・アクション凡例・操作ヒント
        ========================================================================= */}
        <div className="space-y-3">
          {/* Guide Banner */}
          {showGuideBanner && (
            <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200/90 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">💡 順番の入れ替え方:</span>
                <span>
                  上のパイプラインのチップを <strong>ドラッグ＆ドロップ</strong> するか、各カードの <strong>「▲ 上へ / ▼ 下へ」</strong> を押すと登場順が即座に入れ替わります。
                </span>
              </div>
              <button 
                onClick={onOpenHelpModal} 
                className="text-amber-300 underline font-semibold hover:text-white"
              >
                詳しい解説 →
              </button>
            </div>
          )}

          {/* =========================================================================
              2. Action Type Notation Legend (凡例)
          ========================================================================= */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-950/90 rounded-xl border border-slate-800 text-xs">
            <span className="font-bold text-amber-300 text-[11px] shrink-0 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>【アクション凡例】</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                <strong className="font-bold text-amber-200">E</strong>: 元素スキル
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                <strong className="font-bold text-purple-200">Q</strong>: 元素爆発
              </span>
              <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
                <strong className="font-bold text-sky-200">N</strong>: 通常攻撃（連続した N は自動で1段目・2段目…と数えます）
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <strong className="font-bold text-emerald-200">C</strong>: チャージアタック(重撃)
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                <strong className="font-bold text-white">D</strong>: ダッシュ(回避)
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                <strong className="font-bold text-cyan-200">hE</strong>: スキル長押し（tE: 長押しがあるキャラの一回押し、rE: 再発動）
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                <strong className="font-bold text-white">lP / hP</strong>: 落下攻撃（低 / 高）
              </span>
            </div>
          </div>

          {!(SHOW_SELECTED_ACTION_BAR && selectedActionInfo) && (
            <div className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs text-slate-400 flex items-center justify-between shadow-sm">
              <span className="flex items-center gap-1.5">
                <span className="text-amber-400 font-bold">💡</span>
                <span>ガントチャート上のアクション（E / Q / 通常など）をクリックすると、該当する出場キャラのカードへ移動し、アクションが選択表示されます。また、アクションの順序入れ替えはガントチャート上で直接ドラッグ＆ドロップでも可能です。</span>
              </span>
            </div>
          )}
        </div>

        {/* =========================================================================
            3. Timing Delays (交代所要時間 & アクションごとの遅延)
        ========================================================================= */}
        <div className="bg-slate-950/90 border border-slate-700/80 rounded-xl p-3.5 shadow-md space-y-3">
          {/* 1. Character Change Delay */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400 flex items-center justify-center text-sky-300 font-bold shrink-0">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-sky-200">
                    🔄 キャラチェンジ所要時間（交代遅延）
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-900/60 text-sky-300 border border-sky-700">
                    全交代箇所に自動挿入
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  キャラ切替時の操作硬直・交代内部CTを設定（初期値 0.50秒）。全登場ターン間に自動反映されます。
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Stepper controls */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => onUpdateSwitchDelay?.(Math.max(0, Number((switchDelay - 0.10).toFixed(2))))}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-sky-300 font-mono font-bold text-xs transition-colors"
                  title="-0.10秒"
                >
                  -0.1s
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSwitchDelay?.(Math.max(0, Number((switchDelay - 0.05).toFixed(2))))}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-sky-300 font-mono font-bold text-xs transition-colors"
                  title="-0.05秒"
                >
                  -0.05s
                </button>
                <div className="px-2 py-1 bg-slate-950 rounded border border-slate-700 font-mono font-bold text-sm text-sky-300 min-w-[62px] text-center">
                  {switchDelay.toFixed(2)}s
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSwitchDelay?.(Number((switchDelay + 0.05).toFixed(2)))}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-sky-300 font-mono font-bold text-xs transition-colors"
                  title="+0.05秒"
                >
                  +0.05s
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSwitchDelay?.(Number((switchDelay + 0.10).toFixed(2)))}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-sky-300 font-mono font-bold text-xs transition-colors"
                  title="+0.10秒"
                >
                  +0.1s
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1">
                {[
                  { label: '0.00s (即時)', value: 0.00 },
                  { label: '0.30s', value: 0.30 },
                  { label: '0.50s (標準)', value: 0.50 },
                  { label: '0.80s', value: 0.80 },
                  { label: '1.00s', value: 1.00 },
                ].map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => onUpdateSwitchDelay?.(preset.value)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                      Math.abs(switchDelay - preset.value) < 0.01
                        ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700 hover:border-sky-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-850 my-1" />

          {/* 敵の防御ヒットストップ（gcsim の defhalt） */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <div className="font-bold text-slate-200">🛡️ 敵の防御ヒットストップ（gcsim の defhalt）</div>
              <div className="text-[10px] text-slate-400 mt-0.5 max-w-xl">
                有効: 体幹が崩れない敵（大型のボスなど）。攻撃のヒットストップが 1 ヒットあたり 0.06 秒長くなる。無効: 体幹が崩れる敵（小型の敵）。gcsim にも `defhalt=false` を渡す。疾風怒濤の受付への反映は、gcsim から所要時間を書き戻したアクションだけ（所要時間にも止まった分が含まれるため）。
              </div>
            </div>
            <div className="flex items-center gap-1">
              {[{ label: '有効（既定）', value: true }, { label: '無効', value: false }].map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => onUpdateDefHalt?.(opt.value)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                    defHalt === opt.value
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700 hover:border-sky-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-850 my-1" />

          {/* 敵から受けるダメージ（gcsim の hurt。追加作業 18） */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <div className="font-bold text-slate-200">💥 敵から受けるダメージ（gcsim の hurt）</div>
              <div className="text-[10px] text-slate-400 mt-0.5 max-w-xl">
                有効にすると、gcsim の実行で、出場中のキャラが一定の間隔で物理ダメージを受ける（間隔・量とも範囲の中の乱数）。ディシアの「紅き血」など、自分が受けたダメージで HP が減ることが条件の効果を再現する。無効のときは、ダメージを受けない。アプリの計算は変わらない。
              </div>
              {hurt.enabled && (
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-300">
                  <span>間隔（秒）</span>
                  <input type="number" min={0.1} step={0.1} value={hurt.intervalMin} onChange={e => onUpdateHurt?.({ ...hurt, intervalMin: Number(e.target.value) })} className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5" aria-label="間隔の最小（秒）" />
                  <span>〜</span>
                  <input type="number" min={0.1} step={0.1} value={hurt.intervalMax} onChange={e => onUpdateHurt?.({ ...hurt, intervalMax: Number(e.target.value) })} className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5" aria-label="間隔の最大（秒）" />
                  <span className="ml-2">ダメージ（HP）</span>
                  <input type="number" min={1} step={100} value={hurt.amountMin} onChange={e => onUpdateHurt?.({ ...hurt, amountMin: Number(e.target.value) })} className="w-20 bg-slate-900 border border-slate-700 rounded px-1 py-0.5" aria-label="ダメージの最小" />
                  <span>〜</span>
                  <input type="number" min={1} step={100} value={hurt.amountMax} onChange={e => onUpdateHurt?.({ ...hurt, amountMax: Number(e.target.value) })} className="w-20 bg-slate-900 border border-slate-700 rounded px-1 py-0.5" aria-label="ダメージの最大" />
                  {!hurtStatement(hurt) && <span className="text-amber-300">値が不正です（最小 ≤ 最大・1 以上）。gcsim には渡しません</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {[{ label: '無効（既定）', value: false }, { label: '有効', value: true }].map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => onUpdateHurt?.({ ...hurt, enabled: opt.value })}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                    hurt.enabled === opt.value
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700 hover:border-sky-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-850 my-1" />

          {/* 2. Action Execution Delay (アクションごとの遅延: 一括設定) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 font-bold shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-200">
                    ⏱️ アクション遅延（アクションごと）
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-300 border border-amber-700">
                    各アクションの終了後に挿入
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  入力硬直・先行入力の遅れを、アクションごとに設定します（初期値 0.10秒。下の各アクションの右の「+0.10s」で個別に変更）。
                </div>
              </div>
            </div>

            {/* 一括設定 */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[11px] text-slate-400 mr-1">全アクションに一括設定:</span>
              {[0.00, 0.05, 0.10, 0.15, 0.20].map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAllActionDelays(value)}
                  className="px-2 py-1 rounded text-[11px] font-semibold transition-all bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700 hover:border-amber-400"
                  title={`全アクションの遅延を ${value.toFixed(2)}秒 にする`}
                >
                  {value.toFixed(2)}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* =========================================================================
            4. Stint Cards Sequence (Full Detailed Micro Editor)
        ========================================================================= */}
        <div className="space-y-3">
          {stints.map((stint, stintIndex) => {
            const char = characterMap.get(stint.characterId);
            if (!char) return null;
            const isCurrentlyActive = (stint.startTime ?? 0) <= activeTime && activeTime < (stint.endTime ?? 0);
            const isStintSelected = selectedAction?.stintId === stint.id;
            const stintDuration = (stint.duration ?? 0).toFixed(1);
            const startTimeStr = (stint.startTime ?? 0).toFixed(2);
            const endTimeStr = (stint.endTime ?? 0).toFixed(2);
            const isFirst = stintIndex === 0;
            const isLast = stintIndex === stints.length - 1;

            // Relative time formatter
            const fmtRel = (t: number) => {
              if (!loopStartTime || loopStartTime <= 0) return `${t.toFixed(1)}s`;
              const rel = t - loopStartTime;
              if (Math.abs(rel) < 0.05) return '0.0s';
              if (rel < 0) return `-${Math.abs(rel).toFixed(1)}s`;
              return `+${rel.toFixed(1)}s`;
            };

            // ループ基準は出場キャラの番号で持つ（基準番号より前が1周目初動、以降が定常ループ）
            const isSetupStint = loopStartIndex > 0 && stintIndex < loopStartIndex;
            const isLoopStint = loopStartIndex > 0 && stintIndex >= loopStartIndex;
            // 連動・発動バフ: 「+ 登録」の行（palette）と、登録済みの一覧（list）を、別の場所に出す
            const renderBuffSection = (part: 'palette' | 'list') => (
      <StintBuffTriggersSection
        part={part}
        stintIndex={stintIndex}
        stint={stint}
        char={char}
        database={database}
        onUpdatePassiveTriggers={updateStintPassiveTriggers}
        setCtHoverActionId={setCtHoverActionId}
        renderTimingInput={(label, value, defaultValue, valueClassName, title, onChange, onHoverChange) => (
          <ActionTimingInput
            label={label}
            value={value}
            defaultValue={defaultValue}
            valueClassName={valueClassName}
            title={title}
            onChange={onChange}
            onHoverChange={onHoverChange}
          />
        )}
      />
            );

            return (
              <div
                key={stint.id}
                id={`stint-card-${stint.id}`}
                onClick={(e) => {
                  // 出場カードの背景のクリック: この出場をフォーカスしたまま、アクションの選択を外す（追加は末尾になる）。
                  // ボタン・入力・説明つきの要素・アクション自身のクリックは、対象外
                  const t = e.target as HTMLElement;
                  if (t.closest('button, input, select, textarea, a, label, [title], [id^="action-item-"]')) return;
                  onSelectAction?.(stint.id, '');
                }}
                draggable
                onDragStart={() => setDraggedStintIndex(stintIndex)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedStintIndex !== null && draggedStintIndex !== stintIndex) {
                    moveStint(draggedStintIndex, stintIndex);
                    setDraggedStintIndex(stintIndex);
                  }
                }}
                onDragEnd={() => setDraggedStintIndex(null)}
                className={`relative rounded-xl border transition-all ${
                  isStintSelected
                    ? 'bg-slate-950/70 border-yellow-400 ring-2 ring-yellow-400 shadow-xl shadow-yellow-500/10'
                    : isCurrentlyActive 
                    ? 'bg-slate-850 border-amber-400/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/40' 
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Connecting Arrow from previous stint */}
                {stintIndex > 0 && (
                  <div className="absolute -top-3 left-8 z-10 flex items-center gap-1 text-[10px] text-sky-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-sky-700 shadow-sm">
                    <CornerDownRight className="w-3 h-3 text-sky-400" />
                    {switchDelay > 0 ? (
                      <span>🔄 キャラチェンジ (+{switchDelay.toFixed(2)}s) ➔ {char.name}登場 @ {fmtRel(stint.startTime ?? 0)}</span>
                    ) : (
                      <span>⚡ 即時交代 @ {fmtRel(stint.startTime ?? 0)} ➔ {char.name}登場</span>
                    )}
                  </div>
                )}

                <div className="p-3">
                  {/* Top Bar of Stint Card */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                    
                    {/* Left: Character Info（#番号〜出場時間）& Reorder Controls */}
                    <div className="flex items-center gap-2.5">
                      
                      {/* Stint Order Badge */}
                      <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center border border-amber-500/40 shadow-inner">
                        #{stintIndex + 1}
                      </span>

                      {/* Character Avatar & Name (Click to focus stint and action) */}
                      <div 
                        onClick={() => {
                          const targetAct = stint.actions.find(a => a.type !== 'swap') || stint.actions[0];
                          if (targetAct && onSelectAction) {
                            onSelectAction(stint.id, targetAct.id);
                          }
                          if (targetAct && onSeek) {
                            onSeek(targetAct.startTime ?? 0);
                          }
                        }}
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        title="この出場ブロックを選択フォーカス（クリックでガントチャート＆設定画面に連動強調表示）"
                      >
                        <CharacterAvatar char={char} className="w-7 h-7 rounded-lg text-xs shadow-inner" borderWidth={1.5} />
                        <span className="font-bold text-sm text-white">{char.name}</span>
                        <ElementIcon element={char.element} className="w-5 h-5" />
                        {isStintSelected && (
                          <span className="px-1.5 py-0.5 rounded font-black text-[10px] bg-yellow-400 text-slate-950 animate-pulse">
                            フォーカス中
                          </span>
                        )}
                      </div>

                      {/* Phase badge if loop base is set */}
                      {loopStartIndex > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          isSetupStint
                            ? 'bg-amber-950/80 text-amber-300 border-amber-600/70'
                            : isLoopStint
                            ? 'bg-purple-950/80 text-purple-300 border-purple-600/70'
                            : 'bg-indigo-950/80 text-indigo-300 border-indigo-600/70'
                        }`}>
                          {isSetupStint ? '1周目初動' : isLoopStint ? '定常ループ' : '初動➔ループ跨ぎ'}
                        </span>
                      )}

                      {/* Exact Vertical Timeline Snap Badge */}
                      <div className="flex items-center gap-1 text-xs font-mono bg-slate-900 px-2.5 py-0.5 rounded-md border border-slate-800">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span className="text-amber-300 font-bold">{fmtRel(stint.startTime ?? 0)}</span>
                        <span className="text-slate-500">→</span>
                        <span className="text-amber-300 font-bold">{fmtRel(stint.endTime ?? 0)}</span>
                        <span className="text-slate-400 ml-1">({stintDuration}s)</span>
                      </div>

                      {/* Explicit Up / Down Reorder Buttons */}
                      <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700/80">
                        <button
                          onClick={() => moveStint(stintIndex, stintIndex - 1)}
                          disabled={isFirst}
                          className="flex items-center gap-0.5 px-2 py-1 rounded text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-amber-500 hover:text-slate-950 disabled:opacity-20 disabled:pointer-events-none transition-all shadow-sm"
                          title="このキャラの登場順を1つ前（上）へ"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>上へ</span>
                        </button>

                        <button
                          onClick={() => moveStint(stintIndex, stintIndex + 1)}
                          disabled={isLast}
                          className="flex items-center gap-0.5 px-2 py-1 rounded text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-amber-500 hover:text-slate-950 disabled:opacity-20 disabled:pointer-events-none transition-all shadow-sm"
                          title="このキャラの登場順を1つ次（下）へ"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>下へ</span>
                        </button>
                      </div>

                      {/* Drag Handle with explicit label */}
                      <div 
                        className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 bg-slate-900 px-2 py-1 rounded border border-slate-700/60 cursor-grab active:cursor-grabbing select-none"
                        title="ドラッグ＆ドロップで上下に並び替え"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-amber-400" />
                        <span>ドラッグ移動</span>
                      </div>

                      {/* ガントチャートの該当出場行へ移動 */}
                      <button
                        type="button"
                        onClick={() => focusStintInGantt(stint, onSelectAction)}
                        className="flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-semibold bg-slate-900 text-sky-300 border border-sky-700/60 hover:bg-sky-500 hover:text-slate-950 transition-all shadow-sm"
                        title="ガントチャートのこの出場の行へ移動"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                        <span>ガントチャートへ</span>
                      </button>
                    </div>

                    {/* Right: Notes, Duplicate, Delete */}
                    <div className="flex items-center gap-1">
                      {/* モードの維持の切り替え（この出場で、維持の対象のモードに入ったときだけ） */}
                      {stint.modeHold && (
                        <button
                          type="button"
                          onClick={() => toggleHoldMode(stintIndex)}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all shadow-sm ${
                            stint.modeHold.on
                              ? 'bg-emerald-900/40 text-emerald-300 border-emerald-600/60 hover:bg-emerald-800/60'
                              : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                          }`}
                          title={`【モード維持】「${stint.modeHold.label}」が最大時間まで続くように、出場の最後のアクションの後を自動で延ばします（延ばした秒数は保存しません。gcsim の設定文には wait として出します）。\nオフにすると、最後のアクションの直後に交代します。途中で終わらせたいときは、終わらせるアクションを置いてください。`}
                        >
                          モード維持: {stint.modeHold.on ? `オン${stint.modeHold.seconds > 0 ? `（+${stint.modeHold.seconds.toFixed(1)}s）` : ''}` : 'オフ'}
                        </button>
                      )}
                      {/* Note button */}
                      {editingNoteStintId === stint.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="メモ (例: スナップショット)"
                            className="bg-slate-900 text-xs text-white px-2 py-1 rounded border border-slate-700 w-40 focus:outline-none focus:border-amber-400"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveNote(stintIndex);
                              if (e.key === 'Escape') setEditingNoteStintId(null);
                            }}
                          />
                          <button
                            onClick={() => saveNote(stintIndex)}
                            className="px-2 py-1 text-xs bg-amber-500 text-slate-950 font-bold rounded hover:bg-amber-400"
                          >
                            保存
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingNoteStintId(stint.id);
                            setNoteText(stint.note || '');
                          }}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                          title="メモを編集"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span className="max-w-[120px] truncate">{stint.note || 'メモ追加'}</span>
                        </button>
                      )}

                      {/* Duplicate */}
                      <button
                        onClick={() => duplicateStint(stintIndex)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                        title="この登場ブロックを複製"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => removeStint(stintIndex)}
                        className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
                        title="登場ブロックを削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Actions inside this Stint (Micro Sequence) */}
                  <div className="pt-2.5">
                  {/* アクション追加ボタン（出場の見出しの直下。アクションが増えて折り返しても、位置が動かない。追加作業 27 / issue #35） */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] text-slate-500 font-medium">+ 追加:</span>
                      {CharacterModel.fromConfig(char).actions.map(actionDef => (
                        <button
                          key={actionDef.id}
                          onClick={() => addActionToStint(stintIndex, actionDef)}
                          className={`px-2 py-0.5 rounded border font-mono text-[11px] hover:brightness-125 transition-all ${actionTone(actionDef).box}`}
                          title={`${actionDef.name} (${actionDef.defaultDuration}s) を追加 [記法略称: ${actionDef.shortName}]${actionDescription(actionDef, actionDef) ? `\n\n${actionDescription(actionDef, actionDef)}` : ''}`}
                        >
                          <strong className={`font-bold ${actionTone(actionDef).label}`}>+{actionDef.buttonLabel || actionDef.shortName}</strong>
                        </button>
                      ))}
                      {/* 待機（何もしないで待つ。長さは、アクションの所要時間の欄で変える） */}
                      <button
                        onClick={() => addActionToStint(stintIndex, 'wait')}
                        className={`px-2 py-0.5 rounded border font-mono text-[11px] hover:brightness-125 transition-all ${actionTone({ type: 'wait', shortName: 'w' }).box}`}
                        title={`待機（何もしないで ${WAIT_DEFAULT_SECONDS} 秒待つ。長さは、追加したアクションの所要時間の欄で変えられます）`}
                      >
                        <strong className={`font-bold ${actionTone({ type: 'wait', shortName: 'w' }).label}`}>+待機</strong>
                      </button>
                    </div>
                    {/* 連動・発動バフの登録（「+ 登録」の行） */}
                    {renderBuffSection('palette')}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {stint.actions.map((act, actIdx) => {
                        const isSwap = act.type === 'swap' || act.actionTypeId === 'action_switch_char';
                        const isActionActive = (act.startTime ?? 0) <= activeTime && activeTime < (act.endTime ?? 0);
                        const isBurst = act.type === 'burst';
                        const isSkill = act.type === 'skill' || act.type === 'skill_hold' || act.type === 'skill_reset';
                        const isSelected = selectedAction?.stintId === stint.id && selectedAction?.actionId === act.id;
                        const hasSwapAtHead = stint.actions[0]?.type === 'swap';

                        // 交代の直後はアクションの遅延を持たない。アクションごとの遅延は、そのアクションの後ろに表示・編集する
                        const delayValue = actionDelayOf(act);
                        const gapElement = !isSwap ? (
                          <div
                            key={`gap-${act.id}`}
                            className="flex items-center gap-0.5 px-1.5 py-1 rounded bg-slate-950/80 border border-dashed border-amber-500/40 text-[10px] font-mono text-amber-300 select-none shadow-sm"
                            title={`【このアクションの後の遅延】: +${delayValue.toFixed(2)}s\nこのアクションの終了後に入る空白です（▲▼で0.05秒ずつ変更）。`}
                          >
                            <Clock className="w-2.5 h-2.5 text-amber-400" />
                            <span className="font-bold">+{delayValue.toFixed(2)}s</span>
                            <div className="flex flex-col ml-0.5">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); updateActionDelay(stintIndex, act.id, delayValue + 0.05); }}
                                className="leading-none text-amber-400 hover:text-amber-200 text-[9px]"
                                title="遅延を+0.05秒"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); updateActionDelay(stintIndex, act.id, delayValue - 0.05); }}
                                className="leading-none text-amber-400 hover:text-amber-200 text-[9px]"
                                title="遅延を-0.05秒"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        ) : null;

                        if (isSwap) {
                          return (
                            <React.Fragment key={act.id}>
                              <div
                                id={`action-item-${act.id}`}
                                onClick={() => {
                                  onSelectAction?.(stint.id, act.id);
                                  if (onSeek) onSeek(act.startTime ?? 0);
                                }}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs select-none cursor-pointer shadow-sm ${
                                  `${actionTone(act).box} hover:brightness-125`
                                } ${
                                  // 選択中は、黄色の太い枠だけを足す（地の色は、種別の色のまま）
                                  isSelected
                                    ? 'ring-2 ring-yellow-400 border-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.6)] font-bold'
                                    : isActionActive ? 'border-amber-400 ring-1 ring-amber-400/50 shadow' : ''
                                }`}
                                title={`【キャラ交代所要時間（出場時間の先頭）】\n所要時間: ${act.duration.toFixed(2)}s\n期間: [${(act.startTime ?? 0).toFixed(2)}s ~ ${(act.endTime ?? 0).toFixed(2)}s] (クリックで選択フォーカス)`}
                              >
                                {/* Action Type Badge */}
                                <span className={`px-0.5 font-mono font-extrabold text-[11px] flex items-center gap-1 ${actionTone(act).label}`}>
                                  <RefreshCw className="w-3 h-3 text-sky-300" />
                                  交代
                                </span>

                                {/* Action Name */}
                                <span className="font-medium truncate">
                                  キャラ交代
                                </span>

                                {isSelected && (
                                  <span className="px-1.5 py-0.2 rounded font-black text-[9px] bg-yellow-400 text-slate-950 animate-pulse">
                                    選択中
                                  </span>
                                )}

                                {/* Duration & Tweaks */}
                                <div className="flex items-center gap-0.5 ml-1 bg-slate-950/90 rounded px-1.5 py-0.5 border border-slate-700 text-[11px] font-mono">
                                  <span className="text-slate-200 font-bold">{act.duration.toFixed(1)}s</span>
                                  <div className="flex flex-col ml-0.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateSwitchDelay?.(Number((switchDelay + 0.05).toFixed(2)));
                                      }}
                                      className="leading-none text-sky-400 hover:text-sky-200 text-[9px] hover:font-bold"
                                      title="交代所要時間を+0.05秒"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateSwitchDelay?.(Math.max(0, Number((switchDelay - 0.05).toFixed(2))));
                                      }}
                                      className="leading-none text-sky-400 hover:text-sky-200 text-[9px] hover:font-bold"
                                      title="交代所要時間を-0.05秒"
                                    >
                                      ▼
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        }

                        return (
                          <React.Fragment key={act.id}>
                            <div
                              id={`action-item-${act.id}`}
                              onClick={() => {
                                onSelectAction?.(stint.id, act.id);
                                if (onSeek) onSeek(act.startTime ?? 0);
                              }}
                              draggable={ctHoverActionId !== act.id}
                              onDragStart={() => setDraggedAction({ stintIndex, actionIndex: actIdx })}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (
                                  draggedAction && 
                                  draggedAction.stintIndex === stintIndex && 
                                  draggedAction.actionIndex !== actIdx
                                ) {
                                  // Prevent dragging over swap action at index 0
                                  if (hasSwapAtHead && actIdx === 0) return;
                                  moveAction(stintIndex, draggedAction.actionIndex, actIdx);
                                  setDraggedAction({ stintIndex, actionIndex: actIdx });
                                }
                              }}
                              onDragEnd={() => setDraggedAction(null)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs select-none cursor-pointer ${
                                `${actionTone(act).box} hover:brightness-125`
                              } ${
                                // 選択中は、黄色の太い枠だけを足す（地の色は、種別の色のまま）
                                isSelected
                                  ? 'ring-2 ring-yellow-400 border-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.6)] font-bold'
                                  : isActionActive ? 'border-amber-400 ring-1 ring-amber-400/50 shadow' : ''
                              }`}
                            >
                              {/* Action Type Badge */}
                              <span 
                                className={`px-0.5 font-mono font-extrabold text-[11px] ${actionTone(act).label}`}
                              >
                                {act.shortName}
                              </span>

                              {/* Action Name */}
                              <span
                                className="font-medium max-w-[150px] truncate"
                                title={(() => {
                                  const desc = actionDescription(act, char.availableActions.find(d => d.id === act.actionTypeId));
                                  return desc ? `${act.name}\n\n${desc}` : act.name;
                                })()}
                              >
                                {act.name}
                              </span>

                              {/* 特殊重撃（蒼牙）: 特殊スキルの使用回数を 1 回分使った重撃 */}
                              {act.usedSpecialCharge && (
                                <span
                                  className="px-1.5 py-0.2 rounded font-black text-[9px] bg-cyan-400 text-slate-950 shrink-0"
                                  title="特殊重撃（蒼牙）: 特殊スキルの使用回数を 1 回分使います（スタミナは使いません）。回数が空いていなければ、普通の重撃になります"
                                >
                                  特殊重撃
                                </span>
                              )}

                              {/* Selected Badge */}
                              {isSelected && (
                                <span className="px-1.5 py-0.2 rounded font-black text-[9px] bg-yellow-400 text-slate-950 animate-pulse">
                                  選択中
                                </span>
                              )}

                              {/* モーション時間（数値入力 + ▲▼ 長押しで連続増減） */}
                              <div
                                className="flex items-center gap-0.5 ml-1 bg-slate-950/60 rounded px-1 py-0.5 border border-slate-800 text-[11px] font-mono"
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={() => setCtHoverActionId(act.id)}
                                onMouseLeave={() => setCtHoverActionId(prev => (prev === act.id ? null : prev))}
                                title="モーション時間（直接入力、または ▲▼ で0.1秒ずつ。押し続けると連続で増減）"
                              >
                                <StepperNumberInput
                                  value={act.duration}
                                  decimals={2}
                                  onCommit={(v) => updateActionDuration(stintIndex, actIdx, v - act.duration)}
                                  className="w-10 text-amber-300"
                                />
                                <span className="text-slate-400">s</span>
                                <div className="flex flex-col ml-0.5">
                                  <RepeatButton onStep={() => updateActionDuration(stintIndex, actIdx, 0.1)} title="+0.1秒（長押しで連続）">▲</RepeatButton>
                                  <RepeatButton onStep={() => updateActionDuration(stintIndex, actIdx, -0.1)} title="-0.1秒（長押しで連続）">▼</RepeatButton>
                                </div>
                              </div>

                              {/* CT・効果継続時間 — 追加後に個別変更できる */}
                              {(() => {
                                const def = CharacterModel.fromConfig(char).actions.find(a => a.id === act.actionTypeId);
                                // 状態の窓の中の E（ステップ・再発動など）は、CT・効果バーを持たない
                                const ctInfo = act.inStateWindow ? null : getActionCooldownInfo(act, def);
                                const effectInfo = act.inStateWindow ? null : getActionEffectInfo(act, def);
                                const hoverProps = {
                                  onHoverChange: (hovering: boolean) =>
                                    setCtHoverActionId(prev => (hovering ? act.id : prev === act.id ? null : prev)),
                                };
                                return (
                                  <>
                                    {ctInfo && (
                                      <ActionTimingInput
                                        label="CT"
                                        value={ctInfo.cooldown}
                                        defaultValue={ctInfo.defaultCooldown}
                                        valueClassName="text-emerald-300"
                                        title={`${ctInfo.kind === 'burst' ? '元素爆発' : '元素スキル'}のCT（初期値 ${ctInfo.defaultCooldown}s）`}
                                        onChange={(v) => updateActionTiming(stintIndex, actIdx, 'cooldown', v, ctInfo.defaultCooldown)}
                                        {...hoverProps}
                                      />
                                    )}
                                    {effectInfo && (
                                      <ActionTimingInput
                                        label="効果"
                                        value={effectInfo.duration}
                                        defaultValue={effectInfo.defaultDuration}
                                        valueClassName="text-pink-300"
                                        title={`効果継続時間: ${effectInfo.label}（初期値 ${effectInfo.defaultDuration}s）\nガントチャートに効果バーとして表示されます（0sで非表示）`}
                                        onChange={(v) => updateActionTiming(stintIndex, actIdx, 'effectDuration', v, effectInfo.defaultDuration)}
                                        {...hoverProps}
                                      />
                                    )}
                                  </>
                                );
                              })()}

                              {/* Remove Action（右端。順序の入れ替えはドラッグ＆ドロップ） */}
                              <button
                                onClick={() => removeActionFromStint(stintIndex, actIdx)}
                                disabled={stint.actions.filter(a => a.type !== 'swap').length === 0}
                                className="text-slate-500 hover:text-red-400 disabled:opacity-20 ml-0.5"
                                title="アクション削除"
                              >
                                ✕
                              </button>
                            </div>
                            {gapElement}
                          </React.Fragment>
                        );
                      })}

                    </div>

                    {/* 連動・発動バフの一覧（登録済みのもの） */}
                    {renderBuffSection('list')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* パイプライン / ガントチャートからの移動で、末尾付近のカードも固定表示エリア直下まで上げるための下余白 */}
      <div id={ACTION_BUILDER_BOTTOM_SPACER_ID} aria-hidden="true" />
    </section>
  );
};

/** アクションチップ上の秒数入力欄（CT・効果継続時間）。初期値から変えると強調表示し、↺ で初期値に戻せる */
const ActionTimingInput: React.FC<{
  label: string;
  value: number;
  defaultValue: number;
  valueClassName: string;
  title: string;
  onChange: (value: number) => void;
  onHoverChange: (hovering: boolean) => void;
}> = ({ label, value, defaultValue, valueClassName, title, onChange, onHoverChange }) => {
  const isCustom = value !== defaultValue;
  return (
    <div
      className={`flex items-center gap-0.5 ml-1 rounded px-1 py-0.5 border text-[11px] font-mono ${
        isCustom ? 'bg-amber-950/60 border-amber-500/60' : 'bg-slate-950/60 border-slate-800'
      }`}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      title={`${title}${isCustom ? '\n※個別に変更されています' : ''}`}
    >
      <span className="font-sans font-bold text-[10px] text-slate-400">{label}</span>
      {/* 小数第1位まで表示。2桁（99.9）まで収まる幅 */}
      <StepperNumberInput
        value={value}
        decimals={1}
        onCommit={onChange}
        className={`w-9 ${isCustom ? 'text-amber-300' : valueClassName}`}
      />
      <span className="text-slate-400">s</span>
      <div className="flex flex-col">
        <RepeatButton onStep={() => onChange(value + 1)} title={`${label} +1秒（長押しで連続）`}>▲</RepeatButton>
        <RepeatButton onStep={() => onChange(value - 1)} title={`${label} -1秒（長押しで連続）`}>▼</RepeatButton>
      </div>
      {isCustom && (
        <button
          type="button"
          onClick={() => onChange(defaultValue)}
          className="ml-0.5 text-amber-400 hover:text-white text-[11px]"
          title={`初期値 ${defaultValue}s に戻す`}
        >
          ↺
        </button>
      )}
    </div>
  );
};


/**
 * 押している間、繰り返し実行するボタン（押した瞬間に1回、0.4秒後から0.08秒ごと）。
 * 実行する処理は毎回最新のもの（最新の値・状態）を使う
 */
const RepeatButton: React.FC<{ onStep: () => void; title: string; children: React.ReactNode }> = ({ onStep, title, children }) => {
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const timers = useRef<{ delay?: number; repeat?: number }>({});
  const stop = () => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.repeat);
    timers.current = {};
  };
  useEffect(() => stop, []);

  return (
    <button
      type="button"
      title={title}
      className="leading-none text-slate-400 hover:text-white text-[9px] hover:font-bold select-none"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault(); // 入力欄のフォーカスを奪わない
        e.stopPropagation();
        stop();
        stepRef.current();
        timers.current.delay = window.setTimeout(() => {
          timers.current.repeat = window.setInterval(() => stepRef.current(), 80);
        }, 400);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          stepRef.current();
        }
      }}
    >
      {children}
    </button>
  );
};

/**
 * 秒数の入力欄。入力中は打った文字をそのまま表示し（途中の「1.」なども可）、数値として読めるたびに反映する。
 * 入力していないときは小数点以下 decimals 桁で表示する
 */
const StepperNumberInput: React.FC<{
  value: number;
  decimals: number;
  onCommit: (value: number) => void;
  className: string;
}> = ({ value, decimals, onCommit, className }) => {
  const [draft, setDraft] = useState<string | null>(null);
  // ▲▼ などで外から値が変わったら、入力中の表示も追従させる
  useEffect(() => {
    if (draft === null) return;
    const parsed = parseFloat(draft);
    if (Number.isFinite(parsed) && Math.abs(parsed - value) > 1e-9) setDraft(value.toFixed(decimals));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft ?? value.toFixed(decimals)}
      onFocus={(e) => {
        setDraft(value.toFixed(decimals));
        e.target.select();
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (Number.isFinite(parsed)) onCommit(parsed);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={`bg-slate-900 border border-slate-700 rounded px-0.5 py-0 text-right font-semibold focus:outline-none focus:border-amber-400 ${className}`}
    />
  );
};
