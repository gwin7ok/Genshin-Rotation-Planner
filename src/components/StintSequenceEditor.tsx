import { GcsimMissingBadge } from './GcsimMissingBadge';
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
  Sparkles,
  ChevronUp,
  ChevronDown,
  RefreshCw
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
import { actionTone, actionOrderRank } from '../utils/actionTone';
import { actionDescription } from '../utils/actionDescription';
import { DEVICE_KEYS, readString, writeString } from '../utils/persistence';
import { createGroup, groupRuns, moveActionRespectingGroups, moveGroupBlock, setGroupRepeat, stripGroupCopies, ungroup, type GroupRun } from '../utils/actionGroups';
import { DEFAULT_HURT, hurtStatement, type HurtSetting } from '../utils/gcsim/buildGcsimConfig';
import { isModeHoldAction } from '../utils/modeHoldAction';
import { t } from '../i18n';

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
  selectedAction?: { stintId: string; actionId: string } | null;
  onSelectAction?: (stintId: string, actionId: string) => void;
  loopStartTime?: number;
  /** 2周目ループの開始位置（何番目の出場キャラの前か。0=基準なし） */
  loopStartIndex?: number;
  database?: GenshinDatabase;
}

export const StintSequenceEditor: React.FC<StintSequenceEditorProps> = ({
  characters,
  stints: calculatedStints,
  onUpdateStints,
  activeTime,
  onSeek,
  switchDelay = 0.50,
  onUpdateSwitchDelay,
  defHalt = true,
  onUpdateDefHalt,
  hurt = DEFAULT_HURT,
  onUpdateHurt,
  selectedAction,
  onSelectAction,
  loopStartTime = 0,
  loopStartIndex = 0,
  database,
}) => {
  // グループの展開で増えた複製は、構築エリアには出さない・編集の対象にしない（追加作業 20-A）
  const baseStints = useMemo(() => calculatedStints.map(s => ({ ...s, actions: stripGroupCopies(s.actions) })), [calculatedStints]);
  // ドラッグ（出場カード・アクション・グループ）の間の、仮の並び。ドロップで確定し、中断（Esc・枠外へのドロップ）では捨てる。
  // ドラッグの途中の並びを、自動保存・計算に流さない（ガントチャートのドラッグと同じ。issue のレビュー指摘）。ドラッグ中は、この並びで描画する
  const [dragDraft, setDragDraft] = useState<Stint[] | null>(null);
  const dragDraftRef = useRef<Stint[] | null>(null);
  /** ドラッグの種類。chip = パイプラインのチップ（ドロップで、その場で確定。仮の並びは使わない）、card・action・group = 仮の並びで動かす */
  const dragKindRef = useRef<'chip' | 'card' | 'action' | 'group' | null>(null);
  const droppedRef = useRef(false);
  // 連続して発生するドラッグの移動で、再描画を待たずに、最新の位置を使うための複製
  const draggedStintIndexRef = useRef<number | null>(null);
  const draggedActionRef = useRef<{ stintIndex: number; actionIndex: number } | null>(null);
  const stints = dragDraft ?? baseStints;
  // Ctrl+クリックで複数選択したアクション（グループ化の対象）と、ドラッグ中のグループ
  const [multiSel, setMultiSel] = useState<{ stintId: string; ids: string[] } | null>(null);
  const [draggedGroup, setDraggedGroup] = useState<{ stintIndex: number; groupId: string } | null>(null);
  // フォーカス中のグループ（グループの枠の、アクション要素ではない部分をクリックすると、フォーカスされる）。
  // 有効なのは、その出場がフォーカスされていて、アクションが選択されていないとき（アクションの選択・別の出場のフォーカスで、自然に外れる）
  const [focusedGroup, setFocusedGroup] = useState<{ stintId: string; groupId: string } | null>(null);
  const activeFocusedGroup = focusedGroup && selectedAction && selectedAction.stintId === focusedGroup.stintId && !selectedAction.actionId ? focusedGroup : null;
  const [draggedStintIndex, setDraggedStintIndexState] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedAction, setDraggedActionState] = useState<{ stintIndex: number; actionIndex: number } | null>(null);
  const setDraggedStintIndex = (v: number | null) => {
    draggedStintIndexRef.current = v;
    setDraggedStintIndexState(v);
  };
  const setDraggedAction = (v: { stintIndex: number; actionIndex: number } | null) => {
    draggedActionRef.current = v;
    setDraggedActionState(v);
  };
  const [editingNoteStintId, setEditingNoteStintId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  // ガイド（アクション凡例・操作のヒント）の表示。端末に覚えておく（既定: 表示）
  const [showGuide, setShowGuide] = useState<boolean>(() => readString(DEVICE_KEYS.editorGuideVisible) !== 'false');
  const toggleGuide = () => {
    const next = !showGuide;
    setShowGuide(next);
    writeString(DEVICE_KEYS.editorGuideVisible, String(next));
  };
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

  // Sanitize helper to ensure raw stints stored in parent state do not hold duplicate automatic swap actions or stale runtime CT properties
  const sanitizeStintsForUpdate = (rawList: Stint[]): Stint[] => {
    return rawList.map(({ modeHold, ...s }) => ({
      ...s,
      actions: s.actions
        .filter(a => a.type !== 'swap' && a.actionTypeId !== 'action_switch_char')
        .map(a => {
          const { hasCTCollision, collisionRemainingCT, ctGcsimVerified, specialWindowWarning, usedSpecialCharge, holdSeconds, inStateWindow, modeHoldSeconds, gcsimCommand, startTime, endTime, ...rest } = a;
          return rest;
        })
    }));
  };

  // --- ドラッグの仮の並び ---
  /** 今の並び（ドラッグ中は、仮の並び。再描画を待たずに、最新のもの） */
  const currentStints = (): Stint[] => dragDraftRef.current ?? stints;
  /** 並びを反映する。ドラッグ中は、仮の並びに置くだけ（保存・計算はしない）。それ以外は、すぐに反映する */
  const commitStints = (next: Stint[]) => {
    if (dragKindRef.current && dragKindRef.current !== 'chip') {
      dragDraftRef.current = next;
      setDragDraft(next);
      return;
    }
    onUpdateStints(sanitizeStintsForUpdate(next));
  };
  const beginDrag = (kind: 'chip' | 'card' | 'action' | 'group') => {
    dragKindRef.current = kind;
    droppedRef.current = false;
    dragDraftRef.current = null;
  };
  /** ドラッグの終わり（ドロップの後も、中断のときも、ドラッグ元で呼ばれる）。ドロップされていれば、仮の並びを確定し、そうでなければ、捨てる */
  const endDrag = () => {
    const kind = dragKindRef.current;
    const draft = dragDraftRef.current;
    const dropped = droppedRef.current;
    dragKindRef.current = null;
    dragDraftRef.current = null;
    droppedRef.current = false;
    setDragDraft(null);
    setDraggedStintIndex(null);
    setDragOverIndex(null);
    setDraggedAction(null);
    setDraggedGroup(null);
    if (kind && kind !== 'chip' && dropped && draft) onUpdateStints(sanitizeStintsForUpdate(draft));
  };

  // --- Stint Macro Reordering ---
  const moveStint = (fromIndex: number, toIndex: number) => {
    const base = currentStints();
    if (toIndex < 0 || toIndex >= base.length) return;
    const next = [...base];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    commitStints(next);
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

  // フォーカス（選択）中の出場の位置（無ければ -1）。出場のチップ・カードのクリック、その中のアクションの選択で、フォーカスされる
  const focusedStintIndex = selectedAction ? stints.findIndex(s => s.id === selectedAction.stintId) : -1;

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
    // 追加位置（アクションの追加と同じ仕様。issue #48）: フォーカス（選択）中の出場があれば、その直前。フォーカスが無いときは、末尾。
    // 追加しても、フォーカスは変えない（連続して追加すると、追加した順に並ぶ）
    const next = [...stints];
    next.splice(focusedStintIndex >= 0 ? focusedStintIndex : next.length, 0, newStint);
    updateStintsKeepingScroll(sanitizeStintsForUpdate(next));
  };

  // --- Action Micro Operations ---
  // アクションの移動。グループの規則: グループの中のアクションは、グループの中だけで並び替わる。外のアクションは、グループの中に入らない
  const moveAction = (stintIndex: number, fromActIdx: number, toActIdx: number) => {
    const base = currentStints();
    const targetStint = base[stintIndex];
    if (!targetStint || toActIdx < 0 || toActIdx >= targetStint.actions.length) return;
    const moving = targetStint.actions[fromActIdx];
    if (!moving) return;
    const moved = moveActionRespectingGroups(targetStint.actions, moving.id, toActIdx);
    if (!moved) return;
    const nextStints = [...base];
    nextStints[stintIndex] = { ...targetStint, actions: moved };
    commitStints(nextStints);
  };

  // グループ（追加作業 20-A）: 選択したアクションをグループにする・解除・回数・グループごとの移動
  const updateStintAt = (stintIndex: number, fn: (s: Stint) => Stint) => {
    const base = currentStints();
    const next = [...base];
    next[stintIndex] = fn(base[stintIndex]);
    commitStints(next);
  };
  const groupSelected = (stintIndex: number) => {
    const st = stints[stintIndex];
    if (!st || !multiSel || multiSel.stintId !== st.id) return;
    const grouped = createGroup(st, multiSel.ids);
    if (!grouped) return;
    updateStintAt(stintIndex, () => grouped);
    setMultiSel(null);
  };
  const moveGroupTo = (stintIndex: number, groupId: string, overActionId: string) => {
    const st = currentStints()[stintIndex];
    if (!st) return;
    const rest = st.actions.filter(a => a.groupId !== groupId);
    const to = rest.findIndex(a => a.id === overActionId);
    if (to < 0) return;
    const moved = moveGroupBlock(st.actions, groupId, to);
    if (moved) updateStintAt(stintIndex, cur => ({ ...cur, actions: moved }));
  };

  /**
   * 出場ブロックのアクションの並びを、グループの枠つきで出す。グループは、隣接するアクションを 1 つの枠で囲み、回数の入力欄と解除ボタンを付ける。
   * 枠の背景をドラッグするとグループごとの移動、中のアクション要素をドラッグするとグループの中での並び替え（ユーザー決定 2026-10-11）
   */
  const renderActionSegments = (
    stint: Stint,
    stintIndex: number,
    renderOne: (act: CharacterActionInstance, actIdx: number) => React.ReactNode,
  ): React.ReactNode[] => {
    const runs = groupRuns(stint);
    const nodes: React.ReactNode[] = [];
    let i = 0;
    while (i < stint.actions.length) {
      const run = runs.find(r => r.start === i);
      if (!run) {
        nodes.push(renderOne(stint.actions[i], i));
        i += 1;
        continue;
      }
      const members = stint.actions.slice(run.start, run.end + 1);
      const isGroupFocused = activeFocusedGroup?.stintId === stint.id && activeFocusedGroup.groupId === run.id;
      nodes.push(
        <div
          key={`group_${run.id}`}
          draggable
          onDragStart={(e) => {
            e.stopPropagation(); // 出場カードのドラッグにしない
            beginDrag('group');
            setDraggedGroup({ stintIndex, groupId: run.id });
          }}
          onDragEnd={(e) => {
            e.stopPropagation();
            endDrag();
          }}
          onClick={(e) => {
            // 枠の、アクション要素・ボタン・入力欄ではない部分のクリック: グループをフォーカスする（アクションの選択は外れる）
            const t = e.target as HTMLElement;
            if (t.closest('button, input, select, textarea, a, label, [id^="action-item-"]')) return;
            e.stopPropagation();
            setMultiSel(null);
            onSelectAction?.(stint.id, '');
            setFocusedGroup({ stintId: stint.id, groupId: run.id });
          }}
          title={t('editor:groupTitle')}
          className={`flex flex-wrap items-center gap-2 p-1.5 rounded-xl border border-dashed bg-fuchsia-500/5 cursor-grab ${
            isGroupFocused ? 'border-yellow-400 ring-2 ring-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.6)]' : 'border-fuchsia-400/70'
          } ${draggedGroup?.groupId === run.id ? 'opacity-60' : ''}`}
        >
          {/* グループ × [回数] 回 [▲▼] [解除]（秒数の入力欄と同じ形） */}
          <div className="flex items-center gap-1 text-[11px] font-mono text-fuchsia-200 select-none">
            <span className="font-sans font-bold text-[10px]">{t('editor:group')}</span>
            <span>×</span>
            <div
              className="flex items-center gap-0.5 rounded px-1 py-0.5 border bg-slate-950/60 border-slate-800"
              title={t('editor:repeatTitle')}
            >
              <StepperNumberInput
                value={run.repeat}
                decimals={0}
                onCommit={(v) => updateStintAt(stintIndex, cur => setGroupRepeat(cur, run.id, v))}
                className="w-7 text-fuchsia-100"
              />
              <span className="text-slate-400 font-sans text-[10px]">{t('editor:times')}</span>
              <div className="flex flex-col">
                <RepeatButton onStep={() => updateStintAt(stintIndex, cur => setGroupRepeat(cur, run.id, run.repeat + 1))} title={t('editor:repeatUp')}>▲</RepeatButton>
                <RepeatButton onStep={() => updateStintAt(stintIndex, cur => setGroupRepeat(cur, run.id, run.repeat - 1))} title={t('editor:repeatDown')}>▼</RepeatButton>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateStintAt(stintIndex, cur => ungroup(cur, run.id))}
              className="px-1.5 py-0.5 rounded border border-fuchsia-500/50 text-fuchsia-200 hover:bg-fuchsia-500/20 font-sans text-[10px]"
              title={t('editor:ungroupTitle')}
            >
              {t('editor:ungroup')}
            </button>
          </div>
          {members.map((m, k) => renderOne(m, run.start + k))}
        </div>,
      );
      i = run.end + 1;
    }
    return nodes;
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

  /**
   * アクションの追加位置（追加作業 21 / issue #26）:
   *   - この出場のアクションを選択中: その直前（交代アクションなら、その直後）。選択中のアクションがグループの中にあれば、グループの中の、そのアクションの直前（追加したアクションは、グループに入る）
   *   - この出場のグループをフォーカス中（アクションは選択していない）: グループの外の、グループの直前
   *   - それ以外（選択なし・別の出場を選択中）: 末尾
   * 追加しても、選択・フォーカスは変えない（連続して追加すると、追加した順に並ぶ）。
   * 追加ボタンのツールチップ（describeInsertPosition）も、この結果から説明を作る
   */
  const actionInsertPosition = (targetStint: Stint) => {
    let insertAt = targetStint.actions.length;
    let anchor: CharacterActionInstance | undefined;
    let joinGroupId: string | undefined;
    let groupRun: GroupRun | undefined;
    if (selectedAction && selectedAction.stintId === targetStint.id && selectedAction.actionId) {
      const idx = targetStint.actions.findIndex(a => a.id === selectedAction.actionId);
      if (idx >= 0) {
        anchor = targetStint.actions[idx];
        insertAt = anchor.type === 'swap' ? idx + 1 : idx;
        if (anchor.type !== 'swap' && anchor.groupId) joinGroupId = anchor.groupId;
      }
    } else if (activeFocusedGroup && activeFocusedGroup.stintId === targetStint.id) {
      groupRun = groupRuns(targetStint).find(r => r.id === activeFocusedGroup.groupId);
      if (groupRun) insertAt = groupRun.start;
    }
    return { insertAt, anchor, joinGroupId, groupRun };
  };

  /** 追加ボタンのツールチップの先頭に出す、追加位置の説明 */
  const describeInsertPosition = (targetStint: Stint): string => {
    const { anchor, joinGroupId, groupRun } = actionInsertPosition(targetStint);
    const where = groupRun
      ? t('editor:insertBeforeGroup', { count: groupRun.repeat })
      : !anchor
        ? t('editor:insertAtEnd')
        : anchor.type === 'swap'
          ? t('editor:insertAtStart')
          : t('editor:insertBefore', { name: anchor.name });
    return `${t('editor:insertPosition', { where })}${joinGroupId ? t('editor:insertJoinsGroup') : ''}`;
  };

  const addActionToStint = (stintIndex: number, actionDef: ActionDefinition | 'wait') => {
    const targetStint = stints[stintIndex];
    if (!targetStint) return;

    const newId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newAction: CharacterActionInstance = actionDef === 'wait'
      ? { id: newId, actionTypeId: 'wait', name: t('editor:waitName'), shortName: 'w', type: 'wait', duration: WAIT_DEFAULT_SECONDS }
      : {
        id: newId,
        actionTypeId: actionDef.id,
        name: actionDef.name,
        shortName: actionDef.shortName,
        type: actionDef.type,
        duration: actionDef.defaultDuration,
      };

    // 追加位置は、actionInsertPosition（ツールチップの説明と同じ規則）
    const { insertAt, joinGroupId } = actionInsertPosition(targetStint);
    const actions = [...targetStint.actions];
    // 選択中のアクションがグループの中なら、追加したアクションも、そのグループに入れる
    if (joinGroupId) newAction.groupId = joinGroupId;
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
          {/* Section Header（見出し + 全クリア の行 / 出場追加の行） */}
          <div className="flex flex-col items-stretch gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-wide flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                  {t('editor:title')}
                </h2>

                {/* 出場ブロック・アクションのみ全クリア（編成のキャラ登録は維持） */}
                {confirmClearStints ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-red-300">{t('editor:clearConfirm')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        updateStintsKeepingScroll([]);
                        setConfirmClearStints(false);
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors shadow-sm"
                    >
                      {t('party:clear')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearStints(false)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      {t('save:saveAs.back')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearStints(true)}
                    disabled={stints.length === 0}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/40 transition-colors shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                    title={t('editor:clearAllTitle')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('editor:clearAll')}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Add Stint Button Group */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 px-2 font-medium">{t('editor:addStint')}</span>
                {characters.filter(c => !isEmptySlotCharacter(c)).map(c => {
                  const elemTheme = ELEMENT_COLORS[c.element];
                  return (
                    <React.Fragment key={c.id}>
                    <GcsimMissingBadge char={c} />
                    <button
                      onClick={() => addStint(c.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 transition-colors shadow-sm"
                      title={focusedStintIndex >= 0
                        ? t('editor:addStintBefore', { name: c.name, index: focusedStintIndex + 1 })
                        : t('editor:addStintEnd', { name: c.name })}
                    >
                      <span className={`w-2 h-2 rounded-full ${elemTheme.bg} border ${elemTheme.border}`}></span>
                      <span>{c.name}</span>
                      <Plus className="w-3 h-3 text-slate-400" />
                    </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* =========================================================================
              1. Prominent Quick Reorder Pipeline (登場順序クイック並び替えバー)
          ========================================================================= */}
          {/* ガイド（凡例・ヒント）を直下に出すときは、下の余白を無くして、すき間なく並べる */}
          <div
            className="bg-slate-950 p-3 rounded-xl border border-slate-800"
            style={showGuide ? { marginBottom: 0 } : undefined}
            onClick={(e) => {
              // パイプラインの背景のクリック: 出場のフォーカスを解除する（追加は末尾になる。issue #48）。
              // チップ（出場のフォーカス・ドラッグ・削除）・ボタンのクリックは、対象外
              const t = e.target as HTMLElement;
              if (t.closest('button, input, select, textarea, a, label, [draggable="true"]')) return;
              onSelectAction?.('', '');
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('editor:quickReorder')}</span>
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  {t('editor:quickReorderHint')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleGuide}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                  title={t('editor:guideToggleTitle')}
                >
                  {showGuide ? t('editor:hideGuide') : t('editor:showGuide')}
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
                  // 出場トラックだけをフォーカスする（先頭のアクションは選択しない。カードの背景のクリックと同じ状態）
                  const targetAct = stint.actions.find(a => a.type !== 'swap') || stint.actions[0];
                  setFocusedGroup(null);
                  onSelectAction?.(stint.id, '');
                  if (targetAct && onSeek) {
                    onSeek(targetAct.startTime ?? 0);
                  }
                  scrollStintCardBelowSticky(stint.id);
                };

                return (
                  <React.Fragment key={stint.id}>
                    <div
                      draggable
                      onDragStart={() => {
                        beginDrag('chip');
                        setDraggedStintIndex(idx);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragKindRef.current === 'chip') setDragOverIndex(idx);
                      }}
                      onDrop={() => {
                        // チップのドロップだけで並べ替える（出場カードのドラッグを、チップに落としても、何もしない）
                        const from = draggedStintIndexRef.current;
                        if (dragKindRef.current === 'chip' && from !== null && from !== idx) {
                          moveStint(from, idx);
                        }
                      }}
                      onDragEnd={endDrag}
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
                        title={t('editor:chipFocusTitle', { name: char.name })}
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
                            {t('editor:selected')}
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
                        className="p-0.5 rounded flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors shrink-0"
                        title={t('editor:deleteStintTitle', { name: char.name, index: idx + 1 })}
                        aria-label={t('editor:deleteStintLabel')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

          {/* アクション凡例・操作ヒント（固定表示の中。パイプラインの直下。「ガイドを非表示 / 表示」で切り替え） */}
          {showGuide && (
            <div className="space-y-1.5">
            {/* =========================================================================
                2. Action Type Notation Legend (凡例)
            ========================================================================= */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-950/90 rounded-xl border border-slate-800 text-xs">
              <span className="font-bold text-amber-300 text-[11px] shrink-0 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('editor:legendTitle')}</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  <strong className="font-bold text-amber-200">E</strong>: {t('editor:legendE')}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  <strong className="font-bold text-amber-200">hE</strong>: {t('editor:legendHE')}
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  <strong className="font-bold text-purple-200">Q</strong>: {t('editor:legendQ')}
                </span>
                <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
                  <strong className="font-bold text-sky-200">N</strong>: {t('editor:legendN')}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  <strong className="font-bold text-emerald-200">C</strong>: {t('editor:legendC')}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  <strong className="font-bold text-white">J</strong>: {t('editor:legendJ')}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  <strong className="font-bold text-white">lP / hP</strong>: {t('editor:legendP')}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  <strong className="font-bold text-white">D</strong>: {t('editor:legendD')}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  <strong className="font-bold text-white">{t('editor:legendWait')}</strong>: {t('editor:legendWaitText')}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs text-slate-400 flex items-center justify-between shadow-sm">
              <span className="flex items-center gap-1.5">
                <span className="text-amber-400 font-bold">💡</span>
                <span>{t('editor:hint')}</span>
              </span>
            </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            4. Stint Cards Sequence (Full Detailed Micro Editor)
        ========================================================================= */}
        <div
          className="space-y-3"
          onDragOver={(e) => {
            if (dragKindRef.current && dragKindRef.current !== 'chip') e.preventDefault();
          }}
          onDrop={() => {
            if (dragKindRef.current && dragKindRef.current !== 'chip') droppedRef.current = true;
          }}
        >
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
                  setFocusedGroup(null);
                  onSelectAction?.(stint.id, '');
                }}
                draggable
                onDragStart={() => {
                  beginDrag('card');
                  setDraggedStintIndex(stintIndex);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  const from = draggedStintIndexRef.current;
                  if (dragKindRef.current === 'card' && from !== null && from !== stintIndex) {
                    moveStint(from, stintIndex);
                    setDraggedStintIndex(stintIndex);
                  }
                }}
                onDragEnd={endDrag}
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
                      <span>{t('editor:switchIn', { delay: switchDelay.toFixed(2), name: char.name, time: fmtRel(stint.startTime ?? 0) })}</span>
                    ) : (
                      <span>{t('editor:switchInstant', { time: fmtRel(stint.startTime ?? 0), name: char.name })}</span>
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
                          // 出場トラックだけをフォーカスする（先頭のアクションは選択しない。パイプラインのチップと同じ）
                          const targetAct = stint.actions.find(a => a.type !== 'swap') || stint.actions[0];
                          setFocusedGroup(null);
                          onSelectAction?.(stint.id, '');
                          if (targetAct && onSeek) {
                            onSeek(targetAct.startTime ?? 0);
                          }
                        }}
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        title={t('editor:focusStintTitle')}
                      >
                        <CharacterAvatar char={char} className="w-7 h-7 rounded-lg text-xs shadow-inner" borderWidth={1.5} />
                        <span className="font-bold text-sm text-white">{char.name}</span>
                        <ElementIcon element={char.element} className="w-5 h-5" />
                        {isStintSelected && (
                          <span className="px-1.5 py-0.5 rounded font-black text-[10px] bg-yellow-400 text-slate-950 animate-pulse">
                            {t('editor:focused')}
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
                          {isSetupStint ? t('editor:phaseOpener') : isLoopStint ? t('editor:phaseLoop') : t('editor:phaseCross')}
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
                          title={t('editor:upTitle')}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>{t('editor:up')}</span>
                        </button>

                        <button
                          onClick={() => moveStint(stintIndex, stintIndex + 1)}
                          disabled={isLast}
                          className="flex items-center gap-0.5 px-2 py-1 rounded text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-amber-500 hover:text-slate-950 disabled:opacity-20 disabled:pointer-events-none transition-all shadow-sm"
                          title={t('editor:downTitle')}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>{t('editor:down')}</span>
                        </button>
                      </div>

                      {/* Drag Handle with explicit label */}
                      <div 
                        className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 bg-slate-900 px-2 py-1 rounded border border-slate-700/60 cursor-grab active:cursor-grabbing select-none"
                        title={t('editor:dragTitle')}
                      >
                        <GripVertical className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t('editor:drag')}</span>
                      </div>

                      {/* ガントチャートの該当出場行へ移動 */}
                      <button
                        type="button"
                        onClick={() => focusStintInGantt(stint, onSelectAction)}
                        className="flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-semibold bg-slate-900 text-sky-300 border border-sky-700/60 hover:bg-sky-500 hover:text-slate-950 transition-all shadow-sm"
                        title={t('editor:toGanttTitle')}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                        <span>{t('editor:toGantt')}</span>
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
                          title={t('editor:modeHoldTitle', { mode: stint.modeHold.label })}
                        >
                          {t('editor:modeHold', { state: stint.modeHold.on ? (stint.modeHold.seconds > 0 ? t('editor:onSeconds', { seconds: stint.modeHold.seconds.toFixed(1) }) : t('editor:on')) : t('editor:off') })}
                        </button>
                      )}
                      {/* Note button */}
                      {editingNoteStintId === stint.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder={t('editor:memoPlaceholder')}
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
                            {t('action.save')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingNoteStintId(stint.id);
                            setNoteText(stint.note || '');
                          }}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                          title={t('editor:editMemo')}
                        >
                          <Edit3 className="w-3 h-3" />
                          <span className="max-w-[120px] truncate">{stint.note || t('editor:addMemo')}</span>
                        </button>
                      )}

                      {/* Duplicate */}
                      <button
                        onClick={() => duplicateStint(stintIndex)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                        title={t('editor:duplicateTitle')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => removeStint(stintIndex)}
                        className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
                        title={t('editor:deleteTitle')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Actions inside this Stint (Micro Sequence) */}
                  <div className="pt-2.5">
                  {/* アクション追加ボタン（出場の見出しの直下。アクションが増えて折り返しても、位置が動かない。追加作業 27 / issue #35） */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="h-7 w-14 shrink-0 mr-2.5 inline-flex items-center justify-center text-xs font-extrabold text-red-100 bg-red-600/60 border border-red-400 rounded shadow-sm shadow-red-900/50" title={t('editor:addTitle')}>{t('editor:add')}</span>
                      {[...CharacterModel.fromConfig(char).actions].sort((a, b) => actionOrderRank(a) - actionOrderRank(b)).map(actionDef => (
                        <button
                          key={actionDef.id}
                          onClick={() => addActionToStint(stintIndex, actionDef)}
                          className={`h-7 px-2 inline-flex items-center rounded border font-mono text-[11px] hover:brightness-125 transition-all ${actionTone(actionDef).box}`}
                          title={`${describeInsertPosition(stint)}\n---------\n${t('editor:addActionTitle', { name: actionDef.name, duration: actionDef.defaultDuration, short: actionDef.shortName })}${actionDescription(actionDef, actionDef) ? `\n\n${actionDescription(actionDef, actionDef)}` : ''}`}
                        >
                          <strong className={`font-bold ${actionTone(actionDef).label}`}>+{actionDef.buttonLabel || actionDef.shortName}</strong>
                        </button>
                      ))}
                      {/* グループ化（Ctrl+クリックで選んだ、隣接するアクション。追加作業 20-A） */}
                      {multiSel && multiSel.stintId === stint.id && multiSel.ids.length >= 1 && (
                        <button
                          type="button"
                          onClick={() => groupSelected(stintIndex)}
                          disabled={createGroup(stint, multiSel.ids) === null}
                          className="px-2 py-0.5 rounded border border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-200 font-mono text-[11px] hover:bg-fuchsia-500/20 disabled:opacity-40"
                          title={createGroup(stint, multiSel.ids) === null ? t('editor:groupNeedAdjacent') : multiSel.ids.length === 1 ? t('editor:groupOneTitle') : t('editor:groupManyTitle')}
                        >
                          {multiSel.ids.length === 1 ? t('editor:groupOne') : t('editor:groupMany', { count: multiSel.ids.length })}
                        </button>
                      )}
                      {/* 待機（何もしないで待つ。長さは、アクションの所要時間の欄で変える） */}
                      <button
                        onClick={() => addActionToStint(stintIndex, 'wait')}
                        className={`h-7 px-2 inline-flex items-center rounded border font-mono text-[11px] hover:brightness-125 transition-all ${actionTone({ type: 'wait', shortName: 'w' }).box}`}
                        title={`${describeInsertPosition(stint)}\n---------\n${t('editor:waitTitle', { seconds: WAIT_DEFAULT_SECONDS })}`}
                      >
                        <strong className={`font-bold ${actionTone({ type: 'wait', shortName: 'w' }).label}`}>{t('editor:addWait')}</strong>
                      </button>
                    </div>
                    {/* 連動・発動バフの登録（「+ 登録」の行） */}
                    {renderBuffSection('palette')}
                    {/* 追加済みのアクション要素・バフの領域（「+ 追加」「+ 登録」の行と、背景色・実線の枠で区別する） */}
                    <div className="mt-2 p-2 rounded-lg border border-solid border-slate-600/80 bg-indigo-950/40" data-testid="stint-added-area">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* ラベル（「連動・発動バフ:」と同じスタイル） */}
                      <span className="text-[11px] font-bold text-amber-300 shrink-0 flex items-center gap-1">
                        <span>{t('editor:actions')}</span>
                      </span>
                      {renderActionSegments(stint, stintIndex, (act, actIdx) => {
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
                            className="flex items-center gap-0.5 h-7 px-1.5 rounded bg-slate-950/80 border border-dashed border-amber-500/40 shrink-0 text-[10px] font-mono text-amber-300 select-none shadow-sm"
                            title={t('editor:delayTitle', { seconds: delayValue.toFixed(2) })}
                          >
                            <Clock className="w-2.5 h-2.5 text-amber-400" />
                            <span className="font-bold">+{delayValue.toFixed(2)}s</span>
                            <div className="flex flex-col ml-0.5">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); updateActionDelay(stintIndex, act.id, delayValue + 0.05); }}
                                className="leading-none text-amber-400 hover:text-amber-200 text-[9px]"
                                title={t('editor:delayUp')}
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); updateActionDelay(stintIndex, act.id, delayValue - 0.05); }}
                                className="leading-none text-amber-400 hover:text-amber-200 text-[9px]"
                                title={t('editor:delayDown')}
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
                                className={`flex items-center gap-1.5 h-7 px-2 rounded-lg border transition-all text-xs select-none cursor-pointer shrink-0 shadow-sm ${
                                  `${actionTone(act).box} hover:brightness-125`
                                } ${
                                  // 選択中は、黄色の太い枠だけを足す（地の色は、種別の色のまま）
                                  isSelected
                                    ? 'ring-2 ring-yellow-400 border-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.6)] font-bold'
                                    : isActionActive ? 'border-amber-400 ring-1 ring-amber-400/50 shadow' : ''
                                }`}
                                title={t('editor:swapTitle', { duration: act.duration.toFixed(2), start: (act.startTime ?? 0).toFixed(2), end: (act.endTime ?? 0).toFixed(2) })}
                              >
                                {/* Action Type Badge */}
                                <span className={`px-0.5 font-mono font-extrabold text-[11px] flex items-center gap-1 whitespace-nowrap shrink-0 ${actionTone(act).label}`}>
                                  <RefreshCw className="w-3 h-3 text-sky-300" />
                                  {t('editor:swapShort')}
                                </span>

                                {/* Action Name */}
                                <span className="font-medium truncate">
                                  {t('editor:swap')}
                                </span>

                                {isSelected && (
                                  <span className="px-1.5 py-0.2 rounded font-black text-[9px] bg-yellow-400 text-slate-950 animate-pulse">
                                    {t('editor:selected')}
                                  </span>
                                )}

                                {/* Duration & Tweaks */}
                                <div className="flex items-center gap-0.5 ml-1 h-5 bg-slate-950/90 rounded px-1.5 border border-slate-700 text-[11px] font-mono shrink-0">
                                  <span className="text-slate-200 font-bold">{act.duration.toFixed(1)}s</span>
                                  <div className="flex flex-col ml-0.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateSwitchDelay?.(Number((switchDelay + 0.05).toFixed(2)));
                                      }}
                                      className="leading-none text-sky-400 hover:text-sky-200 text-[9px] hover:font-bold"
                                      title={t('editor:swapUp')}
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
                                      title={t('editor:swapDown')}
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
                              onClick={(e) => {
                                // Ctrl（Mac は Cmd）+クリック: 複数選択（グループ化の対象。同じ出場ブロックの中だけ）
                                if (e.ctrlKey || e.metaKey) {
                                  e.preventDefault();
                                  setMultiSel(prev => {
                                    const current = prev && prev.stintId === stint.id
                                      ? prev.ids
                                      : (selectedAction?.stintId === stint.id && selectedAction.actionId ? [selectedAction.actionId] : []);
                                    const fromSingleSelected = !(prev && prev.stintId === stint.id) && current.length === 1 && current[0] === act.id;
                                    const ids = fromSingleSelected ? current : current.includes(act.id) ? current.filter(x => x !== act.id) : [...current, act.id];
                                    return ids.length > 0 ? { stintId: stint.id, ids } : null;
                                  });
                                  return;
                                }
                                setMultiSel(null);
                                onSelectAction?.(stint.id, act.id);
                                if (onSeek) onSeek(act.startTime ?? 0);
                              }}
                              draggable={ctHoverActionId !== act.id}
                              onDragStart={(e) => {
                                e.stopPropagation(); // 枠（グループ）のドラッグにしない
                                beginDrag('action');
                                setDraggedAction({ stintIndex, actionIndex: actIdx });
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                // グループごとの移動: 重ねた要素の手前へ
                                if (draggedGroup && draggedGroup.stintIndex === stintIndex) {
                                  if (act.groupId !== draggedGroup.groupId) moveGroupTo(stintIndex, draggedGroup.groupId, act.id);
                                  return;
                                }
                                const dragging = draggedActionRef.current;
                                if (
                                  dragKindRef.current === 'action' &&
                                  dragging &&
                                  dragging.stintIndex === stintIndex &&
                                  dragging.actionIndex !== actIdx
                                ) {
                                  // Prevent dragging over swap action at index 0
                                  if (hasSwapAtHead && actIdx === 0) return;
                                  moveAction(stintIndex, dragging.actionIndex, actIdx);
                                  setDraggedAction({ stintIndex, actionIndex: actIdx });
                                }
                              }}
                              onDragEnd={(e) => {
                                e.stopPropagation();
                                endDrag();
                              }}
                              className={`flex items-center gap-1.5 h-7 px-2 rounded-lg border transition-all text-xs select-none cursor-pointer shrink-0 ${
                                `${actionTone(act).box} hover:brightness-125`
                              } ${
                                // 選択中（複数選択を含む）は、黄色の太い枠だけを足す（地の色は、種別の色のまま）
                                isSelected || (multiSel?.stintId === stint.id && multiSel.ids.includes(act.id))
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
                                  title={t('editor:specialChargedTitle')}
                                >
                                  {t('editor:specialCharged')}
                                </span>
                              )}

                              {/* Selected Badge */}
                              {isSelected && (
                                <span className="px-1.5 py-0.2 rounded font-black text-[9px] bg-yellow-400 text-slate-950 animate-pulse">
                                  {t('editor:selected')}
                                </span>
                              )}

                              {/* モーション時間（数値入力 + ▲▼ 長押しで連続増減） */}
                              <div
                                className="flex items-center gap-0.5 ml-1 h-5 bg-slate-950/60 rounded px-1 border border-slate-800 text-[11px] font-mono shrink-0"
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={() => setCtHoverActionId(act.id)}
                                onMouseLeave={() => setCtHoverActionId(prev => (prev === act.id ? null : prev))}
                                title={t('editor:motionTitle')}
                              >
                                <StepperNumberInput
                                  value={act.duration}
                                  decimals={2}
                                  onCommit={(v) => updateActionDuration(stintIndex, actIdx, v - act.duration)}
                                  className="w-10 text-amber-300"
                                />
                                <span className="text-slate-400">s</span>
                                <div className="flex flex-col ml-0.5">
                                  <RepeatButton onStep={() => updateActionDuration(stintIndex, actIdx, 0.1)} title={t('editor:plus01')}>▲</RepeatButton>
                                  <RepeatButton onStep={() => updateActionDuration(stintIndex, actIdx, -0.1)} title={t('editor:minus01')}>▼</RepeatButton>
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
                                        title={t('editor:ctTitle', { kind: ctInfo.kind === 'burst' ? t('editor:burst') : t('editor:skill'), seconds: ctInfo.defaultCooldown })}
                                        onChange={(v) => updateActionTiming(stintIndex, actIdx, 'cooldown', v, ctInfo.defaultCooldown)}
                                        {...hoverProps}
                                      />
                                    )}
                                    {effectInfo && (
                                      <ActionTimingInput
                                        label={t('editor:effect')}
                                        value={effectInfo.duration}
                                        defaultValue={effectInfo.defaultDuration}
                                        valueClassName="text-pink-300"
                                        title={t('editor:effectTitle', { label: effectInfo.label, seconds: effectInfo.defaultDuration })}
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
                                className="p-0.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none ml-0.5 flex items-center justify-center shrink-0"
                                title={t('editor:deleteActionTitle')}
                                aria-label={t('editor:deleteActionLabel')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
              </div>
            );
          })}
        </div>

        {/* =========================================================================
            5. 時間の設定（出場トラックの下）: キャラチェンジ所要時間 → アクション遅延 → 敵の防御ヒットストップ → 敵から受けるダメージ
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
                    {t('editor:switchDelay')}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-900/60 text-sky-300 border border-sky-700">
                    {t('editor:switchDelayBadge')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {t('editor:switchDelayHint')}
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
                  title={t('editor:minus010')}
                >
                  -0.1s
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSwitchDelay?.(Math.max(0, Number((switchDelay - 0.05).toFixed(2))))}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-sky-300 font-mono font-bold text-xs transition-colors"
                  title={t('editor:minus005')}
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
                  title={t('editor:plus005')}
                >
                  +0.05s
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSwitchDelay?.(Number((switchDelay + 0.10).toFixed(2)))}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-sky-300 font-mono font-bold text-xs transition-colors"
                  title={t('editor:plus010')}
                >
                  +0.1s
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1">
                {[
                  { label: t('editor:instant'), value: 0.00 },
                  { label: '0.30s', value: 0.30 },
                  { label: t('editor:standard'), value: 0.50 },
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

          {/* 2. Action Execution Delay (アクションごとの遅延: 一括設定) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 font-bold shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-200">
                    {t('editor:actionDelay')}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-300 border border-amber-700">
                    {t('editor:actionDelayBadge')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {t('editor:actionDelayHint')}
                </div>
              </div>
            </div>

            {/* 一括設定 */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[11px] text-slate-400 mr-1">{t('editor:setAll')}</span>
              {[0.00, 0.05, 0.10, 0.15, 0.20].map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAllActionDelays(value)}
                  className="px-2 py-1 rounded text-[11px] font-semibold transition-all bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700 hover:border-amber-400"
                  title={t('editor:setAllTitle', { seconds: value.toFixed(2) })}
                >
                  {value.toFixed(2)}s
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-850 my-1" />

          {/* 敵の防御ヒットストップ（gcsim の defhalt） */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <div className="font-bold text-slate-200">{t('editor:defHalt')}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 max-w-xl">
                {t('editor:defHaltHint')}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {[{ label: t('editor:enabledDefault'), value: true }, { label: t('editor:disabled'), value: false }].map(opt => (
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
              <div className="font-bold text-slate-200">{t('editor:hurt')}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 max-w-xl">
                {t('editor:hurtHint')}
              </div>
              {hurt.enabled && (
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-300">
                  <span>{t('editor:interval')}</span>
                  <input type="number" min={0.1} step={0.1} value={hurt.intervalMin} onChange={e => onUpdateHurt?.({ ...hurt, intervalMin: Number(e.target.value) })} className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5" aria-label={t('editor:intervalMin')} />
                  <span>〜</span>
                  <input type="number" min={0.1} step={0.1} value={hurt.intervalMax} onChange={e => onUpdateHurt?.({ ...hurt, intervalMax: Number(e.target.value) })} className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5" aria-label={t('editor:intervalMax')} />
                  <span className="ml-2">{t('editor:damage')}</span>
                  <input type="number" min={1} step={100} value={hurt.amountMin} onChange={e => onUpdateHurt?.({ ...hurt, amountMin: Number(e.target.value) })} className="w-20 bg-slate-900 border border-slate-700 rounded px-1 py-0.5" aria-label={t('editor:damageMin')} />
                  <span>〜</span>
                  <input type="number" min={1} step={100} value={hurt.amountMax} onChange={e => onUpdateHurt?.({ ...hurt, amountMax: Number(e.target.value) })} className="w-20 bg-slate-900 border border-slate-700 rounded px-1 py-0.5" aria-label={t('editor:damageMax')} />
                  {!hurtStatement(hurt) && <span className="text-amber-300">{t('editor:hurtInvalid')}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {[{ label: t('editor:disabledDefault'), value: false }, { label: t('editor:enabled'), value: true }].map(opt => (
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
      className={`flex items-center gap-0.5 ml-1 h-5 rounded px-1 border text-[11px] font-mono shrink-0 ${
        isCustom ? 'bg-amber-950/60 border-amber-500/60' : 'bg-slate-950/60 border-slate-800'
      }`}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      title={`${title}${isCustom ? t('editor:customized') : ''}`}
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
        <RepeatButton onStep={() => onChange(value + 1)} title={t('editor:plus1', { label })}>▲</RepeatButton>
        <RepeatButton onStep={() => onChange(value - 1)} title={t('editor:minus1', { label })}>▼</RepeatButton>
      </div>
      {isCustom && (
        <button
          type="button"
          onClick={() => onChange(defaultValue)}
          className="ml-0.5 text-amber-400 hover:text-white text-[11px] leading-none"
          title={t('editor:resetDefault', { seconds: defaultValue })}
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
  // この入力欄の打鍵で値が変わった（呼び出し側が、最小値などに丸めて返した）ときは、打った文字を書き換えない
  // （所要時間の最小値 0.1 秒で、先頭の「0」が「0.10」に書き換わり、「0.5」と打てなくなるのを防ぐ）。
  // 丸めた値は、入力欄を離れたとき（onBlur）に表示される
  const ownChange = useRef(false);
  // ▲▼ などで外から値が変わったら、入力中の表示も追従させる
  useEffect(() => {
    if (ownChange.current || draft === null) return;
    const parsed = parseFloat(draft);
    if (Number.isFinite(parsed) && Math.abs(parsed - value) > 1e-9) setDraft(value.toFixed(decimals));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  // 描画のたびに、フラグを戻す（上の効果は、この効果より先に走る。値が変わらなかったときにも、次の外からの変更を妨げない）
  useEffect(() => {
    ownChange.current = false;
  });

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
        if (Number.isFinite(parsed)) {
          ownChange.current = true;
          onCommit(parsed);
        }
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={`bg-slate-900 border border-slate-700 rounded px-0.5 py-0 text-right font-semibold focus:outline-none focus:border-amber-400 ${className}`}
    />
  );
};
