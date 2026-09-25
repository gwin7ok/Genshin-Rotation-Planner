import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
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
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Target,
  X
} from 'lucide-react';
import { 
  CharacterConfig, 
  Stint, 
  CharacterActionInstance, 
  ActionDefinition,
  ActionType
} from '../types/genshin';
import { ELEMENT_COLORS, isEmptySlotCharacter } from '../data/characters';
import { alignStintsToCharacterOrder } from '../utils/stintReorder';

interface StintSequenceEditorProps {
  characters: CharacterConfig[];
  stints: Stint[];
  onUpdateStints: (newStints: Stint[]) => void;
  activeTime: number;
  onSeek?: (time: number) => void;
  switchDelay?: number;
  onUpdateSwitchDelay?: (delay: number) => void;
  actionDelay?: number;
  onUpdateActionDelay?: (delay: number) => void;
  onOpenHelpModal?: () => void;
  selectedAction?: { stintId: string; actionId: string } | null;
  onSelectAction?: (stintId: string, actionId: string) => void;
  loopStartTime?: number;
}

export const StintSequenceEditor: React.FC<StintSequenceEditorProps> = ({
  characters,
  stints,
  onUpdateStints,
  activeTime,
  onSeek,
  switchDelay = 0.50,
  onUpdateSwitchDelay,
  actionDelay = 0.10,
  onUpdateActionDelay,
  onOpenHelpModal,
  selectedAction,
  onSelectAction,
  loopStartTime = 0,
}) => {
  const [draggedStintIndex, setDraggedStintIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedAction, setDraggedAction] = useState<{ stintIndex: number; actionIndex: number } | null>(null);
  const [editingNoteStintId, setEditingNoteStintId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showGuideBanner, setShowGuideBanner] = useState(true);
  const [confirmClearStints, setConfirmClearStints] = useState(false);

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

  // Sanitize helper to ensure raw stints stored in parent state do not hold duplicate automatic swap actions
  const sanitizeStintsForUpdate = (rawList: Stint[]): Stint[] => {
    return rawList.map(s => ({
      ...s,
      actions: s.actions.filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char')
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
        }))
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
      note: `${char.name}の出場`,
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

  const addActionToStint = (stintIndex: number, actionDef: ActionDefinition) => {
    const targetStint = stints[stintIndex];
    if (!targetStint) return;

    const newAction: CharacterActionInstance = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      actionTypeId: actionDef.id,
      name: actionDef.name,
      shortName: actionDef.shortName,
      type: actionDef.type,
      duration: actionDef.defaultDuration,
    };

    const nextStints = [...stints];
    nextStints[stintIndex] = {
      ...targetStint,
      actions: [...targetStint.actions, newAction]
    };
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
  };

  const removeActionFromStint = (stintIndex: number, actionIndex: number) => {
    const targetStint = stints[stintIndex];
    if (!targetStint) return;

    const userActions = targetStint.actions.filter(a => a.type !== 'swap');
    if (userActions.length === 0) return;

    const nextStints = [...stints];
    nextStints[stintIndex] = {
      ...targetStint,
      actions: targetStint.actions.filter((_, i) => i !== actionIndex)
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
    nextActions[actionIndex] = { ...act, duration: newDuration };
    nextStints[stintIndex] = { ...targetStint, actions: nextActions };
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
  };

  const saveNote = (stintIndex: number) => {
    const nextStints = [...stints];
    nextStints[stintIndex] = { ...nextStints[stintIndex], note: noteText };
    onUpdateStints(sanitizeStintsForUpdate(nextStints));
    setEditingNoteStintId(null);
  };

  return (
    <section ref={sectionRef} className="bg-slate-900 border-b border-slate-800 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Sticky Header Container: Section Title through Action Legend & Description */}
        <div className="sticky top-[var(--header-height,0px)] z-30 bg-slate-900/95 backdrop-blur-md pt-2 pb-3 -mx-4 px-4 border-b border-slate-800/80 shadow-xl space-y-3 transition-all">
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
                  （チップの「◀」「▶」クリック、またはドラッグで順番を変更できます）
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateStints(alignStintsToCharacterOrder(stints, characters))}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-slate-700/80 hover:border-amber-400 text-[11px] font-semibold transition-colors"
                  title="パーティ編成の1→2→3→4枠目の順序に合わせて横軸の登場順を一括整列します"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>編成スロット順（1→2→3→4）に横軸を整列</span>
                </button>
                <button
                  onClick={() => setShowGuideBanner(!showGuideBanner)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  {showGuideBanner ? 'ガイドを非表示' : '操作方法を見る'}
                </button>
              </div>
            </div>

            {/* Guide Banner */}
            {showGuideBanner && (
              <div className="mb-3 p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200/90 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">💡 順番の入れ替え方:</span>
                  <span>
                    下のパイプラインの <strong>「◀ 前へ / 次へ ▶」</strong> ボタンを押すか、各カードの <strong>「▲ 上へ / ▼ 下へ」</strong> を押すと登場順が即座に入れ替わります。
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
                  const el = document.getElementById(`stint-card-${stint.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }
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
                          ? 'bg-amber-500/30 border-yellow-400 text-yellow-100 ring-2 ring-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.6)] font-bold scale-[1.02]'
                          : isCurrent
                          ? 'bg-amber-500/20 border-amber-400 shadow-md ring-1 ring-amber-400/50'
                          : dragOverIndex === idx
                          ? 'bg-sky-500/20 border-sky-400 scale-105'
                          : 'bg-slate-900 border-slate-700/80 hover:border-slate-500'
                      }`}
                    >
                      {/* Move Earlier Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveStint(idx, idx - 1);
                        }}
                        disabled={isFirst}
                        title="このキャラの登場順を1つ前（左）へ"
                        className="p-1 rounded bg-slate-800 text-slate-300 hover:text-amber-300 hover:bg-slate-700 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>

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
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: `${char.color}33`, color: char.accentColor, border: `1px solid ${char.color}` }}
                        >
                          {char.name.slice(0, 1)}
                        </div>
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

                      {/* Move Later Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveStint(idx, idx + 1);
                        }}
                        disabled={isLast}
                        title="このキャラの登場順を1つ次（右）へ"
                        className="p-1 rounded bg-slate-800 text-slate-300 hover:text-amber-300 hover:bg-slate-700 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                      >
                        <ArrowRight className="w-3 h-3" />
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
              2. Action Type Notation Legend (凡例) - Right below Quick Reorder Pipeline
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
                <strong className="font-bold text-sky-200">N (N1~N5)</strong>: 通常攻撃
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <strong className="font-bold text-emerald-200">C</strong>: チャージアタック(重撃)
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                <strong className="font-bold text-white">D</strong>: ダッシュ(回避)
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                <strong className="font-bold text-cyan-200">長押しE</strong>: スキル長押し
              </span>
            </div>
          </div>

          {/* =========================================================================
              3. Selected Action Focused Control Bar or Action Description Line
          ========================================================================= */}
          {selectedActionInfo ? (
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
          ) : (
            <div className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs text-slate-400 flex items-center justify-between shadow-sm">
              <span className="flex items-center gap-1.5">
                <span className="text-amber-400 font-bold">💡</span>
                <span>ガントチャート上のアクション（E / Q / 通常など）をクリックすると、ここに対象アクションが連動選択され、詳細編集が行えます。また、アクションの順序入れ替えはガントチャート上で直接ドラッグ＆ドロップでも可能です。</span>
              </span>
            </div>
          )}
        </div>

        {/* =========================================================================
            3. Timing Delays (交代所要時間 & アクション間所要時間)
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

          {/* 2. Action Execution Delay (アクション間所要時間) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 font-bold shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-200">
                    ⏱️ アクション間所要時間（アクション実行遅延）
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-300 border border-amber-700">
                    アクション間に自動挿入
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  スキルや爆発、通常攻撃間の入力硬直・先行入力遅延を設定（初期値 0.10秒）。アクションの間に空白として反映されます。
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Stepper controls */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => onUpdateActionDelay?.(Math.max(0, Number((actionDelay - 0.05).toFixed(2))))}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 font-mono font-bold text-xs transition-colors"
                  title="-0.05秒"
                >
                  -0.05s
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateActionDelay?.(Math.max(0, Number((actionDelay - 0.02).toFixed(2))))}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 font-mono font-bold text-xs transition-colors"
                  title="-0.02秒"
                >
                  -0.02s
                </button>
                <div className="px-2 py-1 bg-slate-950 rounded border border-slate-700 font-mono font-bold text-sm text-amber-300 min-w-[62px] text-center">
                  {actionDelay.toFixed(2)}s
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateActionDelay?.(Number((actionDelay + 0.02).toFixed(2)))}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 font-mono font-bold text-xs transition-colors"
                  title="+0.02秒"
                >
                  +0.02s
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateActionDelay?.(Number((actionDelay + 0.05).toFixed(2)))}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 font-mono font-bold text-xs transition-colors"
                  title="+0.05秒"
                >
                  +0.05s
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1">
                {[
                  { label: '0.00s (即時/先行入力)', value: 0.00 },
                  { label: '0.05s', value: 0.05 },
                  { label: '0.10s (標準)', value: 0.10 },
                  { label: '0.15s', value: 0.15 },
                  { label: '0.20s', value: 0.20 },
                ].map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => onUpdateActionDelay?.(preset.value)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                      Math.abs(actionDelay - preset.value) < 0.01
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700 hover:border-amber-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
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
            const elemTheme = ELEMENT_COLORS[char.element];
            const isCurrentlyActive = (stint.startTime ?? 0) <= activeTime && activeTime < (stint.endTime ?? 0);
            const isStintSelected = selectedAction?.stintId === stint.id;
            const stintDuration = (stint.duration ?? 0).toFixed(2);
            const startTimeStr = (stint.startTime ?? 0).toFixed(2);
            const endTimeStr = (stint.endTime ?? 0).toFixed(2);
            const isFirst = stintIndex === 0;
            const isLast = stintIndex === stints.length - 1;

            // Relative time formatter
            const fmtRel = (t: number) => {
              if (!loopStartTime || loopStartTime <= 0) return `${t.toFixed(2)}s`;
              const rel = t - loopStartTime;
              if (Math.abs(rel) < 0.005) return '0.00s';
              if (rel < 0) return `-${Math.abs(rel).toFixed(2)}s`;
              return `+${rel.toFixed(2)}s`;
            };

            const isSetupStint = loopStartTime > 0 && (stint.endTime ?? 0) <= loopStartTime;
            const isLoopStint = loopStartTime > 0 && (stint.startTime ?? 0) >= loopStartTime;

            return (
              <div
                key={stint.id}
                id={`stint-card-${stint.id}`}
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
                    ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/10'
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
                    
                    {/* Left: Reorder Controls & Character Info */}
                    <div className="flex items-center gap-2.5">
                      
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
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner"
                          style={{ backgroundColor: `${char.color}33`, color: char.accentColor, border: `1.5px solid ${char.color}` }}
                        >
                          {char.name.slice(0, 1)}
                        </div>
                        <span className="font-bold text-sm text-white">{char.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${elemTheme.bg} ${elemTheme.border} ${elemTheme.text}`}>
                          {char.element.toUpperCase()}
                        </span>
                        {isStintSelected && (
                          <span className="px-1.5 py-0.5 rounded font-black text-[10px] bg-yellow-400 text-slate-950 animate-pulse">
                            フォーカス中
                          </span>
                        )}
                      </div>

                      {/* Phase badge if loopStartTime > 0 */}
                      {loopStartTime > 0 && (
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
                    </div>

                    {/* Right: Notes, Duplicate, Delete */}
                    <div className="flex items-center gap-1">
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
                    <div className="flex flex-wrap items-center gap-2">
                      {stint.actions.map((act, actIdx) => {
                        const isSwap = act.type === 'swap' || act.actionTypeId === 'action_switch_char';
                        const isActionActive = (act.startTime ?? 0) <= activeTime && activeTime < (act.endTime ?? 0);
                        const isBurst = act.type === 'burst';
                        const isSkill = act.type === 'skill' || act.type === 'skill_hold' || act.type === 'skill_reset';
                        const isSelected = selectedAction?.stintId === stint.id && selectedAction?.actionId === act.id;
                        const hasSwapAtHead = stint.actions[0]?.type === 'swap';

                        const gapElement = actIdx > 0 && actionDelay > 0 ? (
                          <div
                            key={`gap-${act.id}`}
                            className="flex items-center gap-1 px-1.5 py-1 rounded bg-slate-950/80 border border-dashed border-amber-500/40 text-[10px] font-mono text-amber-300 select-none shadow-sm"
                            title={`【アクション間所要時間（アクション実行遅延）】: +${actionDelay.toFixed(2)}s\nアクションの間に自動挿入される空白遅延です。`}
                          >
                            <Clock className="w-2.5 h-2.5 text-amber-400" />
                            <span className="font-bold">+{actionDelay.toFixed(2)}s</span>
                          </div>
                        ) : null;

                        if (isSwap) {
                          return (
                            <React.Fragment key={act.id}>
                              {gapElement}
                              <div
                                id={`action-item-${act.id}`}
                                onClick={() => {
                                  onSelectAction?.(stint.id, act.id);
                                  if (onSeek) onSeek(act.startTime ?? 0);
                                }}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs select-none cursor-pointer shadow-sm ${
                                  isSelected
                                    ? 'bg-amber-500/30 border-yellow-400 text-yellow-100 ring-2 ring-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.6)] font-bold'
                                    : isActionActive
                                    ? 'bg-sky-500/30 border-sky-400 text-sky-100 ring-2 ring-sky-400/60 shadow-sky-500/20 font-bold'
                                    : 'bg-sky-950/80 border-sky-500/80 text-sky-200 hover:border-sky-400'
                                }`}
                                title={`【キャラ交代所要時間（出場時間の先頭）】\n所要時間: ${act.duration.toFixed(2)}s\n期間: [${(act.startTime ?? 0).toFixed(2)}s ~ ${(act.endTime ?? 0).toFixed(2)}s] (クリックで選択フォーカス)`}
                              >
                                {/* Action Type Badge */}
                                <span className="px-1.5 py-0.5 rounded font-black text-[10px] bg-sky-400 text-slate-950 flex items-center gap-1 shadow-sm">
                                  <RefreshCw className="w-3 h-3" />
                                  交代
                                </span>

                                {/* Action Name */}
                                <span className="font-semibold text-sky-200 truncate">
                                  キャラ交代
                                </span>

                                {isSelected && (
                                  <span className="px-1.5 py-0.2 rounded font-black text-[9px] bg-yellow-400 text-slate-950 animate-pulse">
                                    選択中
                                  </span>
                                )}

                                {/* Duration & Tweaks */}
                                <div className="flex items-center gap-0.5 ml-1 bg-slate-950/90 rounded px-1.5 py-0.5 border border-sky-600/70 text-[11px] font-mono">
                                  <span className="text-sky-300 font-bold">{act.duration.toFixed(2)}s</span>
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
                            {gapElement}
                            <div
                              id={`action-item-${act.id}`}
                              onClick={() => {
                                onSelectAction?.(stint.id, act.id);
                                if (onSeek) onSeek(act.startTime ?? 0);
                              }}
                              draggable
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
                                isSelected
                                  ? 'bg-amber-500/30 border-yellow-400 text-yellow-100 ring-2 ring-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.6)] font-bold'
                                  : isActionActive
                                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50 shadow'
                                  : isBurst
                                  ? 'bg-purple-950/70 border-purple-600/70 text-purple-200 hover:border-purple-400'
                                  : isSkill
                                  ? 'bg-sky-950/70 border-sky-600/70 text-sky-200 hover:border-sky-400'
                                  : 'bg-slate-900 border-slate-700/80 text-slate-200 hover:border-slate-500'
                              }`}
                            >
                              {/* Action Type Badge */}
                              <span 
                                className={`px-1.5 py-0.2 rounded font-extrabold text-[11px] ${
                                  isBurst 
                                    ? 'bg-purple-500 text-slate-950' 
                                    : isSkill 
                                    ? 'bg-sky-400 text-slate-950' 
                                    : 'bg-slate-700 text-slate-200'
                                }`}
                              >
                                {act.shortName}
                              </span>

                              {/* Action Name */}
                              <span className="font-medium max-w-[150px] truncate" title={act.name}>
                                {act.name}
                              </span>

                              {/* Selected Badge */}
                              {isSelected && (
                                <span className="px-1.5 py-0.2 rounded font-black text-[9px] bg-yellow-400 text-slate-950 animate-pulse">
                                  選択中
                                </span>
                              )}

                              {/* Duration & Tweaks */}
                              <div className="flex items-center gap-0.5 ml-1 bg-slate-950/60 rounded px-1.5 py-0.5 border border-slate-800 text-[11px] font-mono">
                                <span className="text-amber-300 font-semibold">{act.duration.toFixed(2)}s</span>
                                <div className="flex flex-col ml-0.5">
                                  <button
                                    onClick={() => updateActionDuration(stintIndex, actIdx, 0.1)}
                                    className="leading-none text-slate-400 hover:text-white text-[9px] hover:font-bold"
                                    title="+0.1秒"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    onClick={() => updateActionDuration(stintIndex, actIdx, -0.1)}
                                    className="leading-none text-slate-400 hover:text-white text-[9px] hover:font-bold"
                                    title="-0.1秒"
                                  >
                                    ▼
                                  </button>
                                </div>
                              </div>

                              {/* Quick Move Left / Right inside stint */}
                              <button
                                onClick={() => moveAction(stintIndex, actIdx, actIdx - 1)}
                                disabled={actIdx === 0 || (hasSwapAtHead && actIdx === 1)}
                                className="text-slate-500 hover:text-slate-200 disabled:opacity-20"
                                title="アクションを前に移動"
                              >
                                ◀
                              </button>
                              <button
                                onClick={() => moveAction(stintIndex, actIdx, actIdx + 1)}
                                disabled={actIdx === stint.actions.length - 1}
                                className="text-slate-500 hover:text-slate-200 disabled:opacity-20"
                                title="アクションを後ろに移動"
                              >
                                ▶
                              </button>

                              {/* Remove Action */}
                              <button
                                onClick={() => removeActionFromStint(stintIndex, actIdx)}
                                disabled={stint.actions.filter(a => a.type !== 'swap').length === 0}
                                className="text-slate-500 hover:text-red-400 disabled:opacity-20 ml-0.5"
                                title="アクション削除"
                              >
                                ✕
                              </button>
                            </div>
                          </React.Fragment>
                        );
                      })}

                      {/* Quick Add Action Palette for this Character */}
                      <div className="flex items-center gap-1 pl-1">
                        <span className="text-[11px] text-slate-500 font-medium">+ 追加:</span>
                        {char.availableActions.map(actionDef => (
                          <button
                            key={actionDef.id}
                            onClick={() => addActionToStint(stintIndex, actionDef)}
                            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] font-semibold border border-slate-700/70 hover:border-slate-500 transition-colors"
                            title={`${actionDef.name} (${actionDef.defaultDuration}s) を追加 [記法略称: ${actionDef.shortName}]`}
                          >
                            +{actionDef.buttonLabel || actionDef.shortName}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
