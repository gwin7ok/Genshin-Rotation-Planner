import type { CharacterActionInstance, Stint } from '../types/genshin';

/**
 * アクションのグループ化（追加作業 20-A / issue #33）。
 *   - 同じ出場ブロックの、隣接するアクションをグループにできる。グループは Stint.groups（回数）と、各アクションの groupId で持つ（入れ子は無し）
 *   - 回数 n のグループは、計算・gcsim の設定文では、中のアクションを n 回、続けて置いたものとして扱う（expandGroupedStints）
 *   - 展開で増えたアクションの複製（groupCopy = 2 回目以降の何回目か）は、保存しない（stripGroupCopies）
 */

export const isGroupCopy = (a: Pick<CharacterActionInstance, 'groupCopy'>): boolean => (a.groupCopy ?? 0) > 0;

/** 複製を除いたアクション（保存・編集の対象） */
export function stripGroupCopies<T extends { groupCopy?: number }>(actions: T[]): T[] {
  return actions.some(a => (a.groupCopy ?? 0) > 0) ? actions.filter(a => !((a.groupCopy ?? 0) > 0)) : actions;
}

/** 出場ブロックのグループの一覧（アクションの並びの中の範囲つき）。複製は数えない */
export interface GroupRun { id: string; start: number; end: number; repeat: number }
export function groupRuns(stint: Pick<Stint, 'groups'> & { actions: Pick<CharacterActionInstance, 'groupId' | 'groupCopy'>[] }): GroupRun[] {
  const actions = stripGroupCopies(stint.actions);
  const runs: GroupRun[] = [];
  actions.forEach((a, i) => {
    if (!a.groupId) return;
    const last = runs[runs.length - 1];
    if (last && last.id === a.groupId && last.end === i - 1) last.end = i;
    else runs.push({ id: a.groupId, start: i, end: i, repeat: stint.groups?.find(g => g.id === a.groupId)?.repeat ?? 1 });
  });
  return runs;
}

/** 回数のあるグループを、計算用に展開した出場ブロック（複製の id は `<元の id>~<回>`）。グループが無ければ、そのまま */
export function expandGroupedStints(stints: Stint[]): Stint[] {
  if (!stints.some(s => s.groups?.length || s.actions.some(a => a.groupId || a.groupCopy))) return stints;
  return stints.map(s => {
    const base = stripGroupCopies(s.actions);
    const runs = groupRuns({ actions: base, groups: s.groups });
    if (!runs.some(r => r.repeat > 1)) return base === s.actions ? s : { ...s, actions: base };
    const out: CharacterActionInstance[] = [];
    base.forEach((a, i) => {
      out.push(a);
      const run = runs.find(r => r.end === i && r.repeat > 1);
      if (!run) return;
      const members = base.slice(run.start, run.end + 1);
      for (let k = 1; k < run.repeat; k++) {
        for (const m of members) out.push({ ...m, id: `${m.id}~${k}`, groupCopy: k });
      }
    });
    return { ...s, actions: out };
  });
}

/** グループの整合を取る: 2 つ未満・隣接でないグループは解除し、使われていないグループの項目を消す */
export function normalizeGroups(stint: Stint): Stint {
  const actions = stripGroupCopies(stint.actions);
  const ids = new Set(actions.map(a => a.groupId).filter((g): g is string => !!g));
  if (ids.size === 0 && !(stint.groups?.length)) return stint;
  const runs = groupRuns({ actions, groups: stint.groups });
  const valid = new Set<string>();
  for (const id of ids) {
    const mine = runs.filter(r => r.id === id);
    const members = actions.filter(a => a.groupId === id).length;
    if (mine.length === 1 && members >= 2) valid.add(id);
  }
  const nextActions = actions.map(a => {
    if (!a.groupId || valid.has(a.groupId)) return a;
    const { groupId: _removed, ...rest } = a;
    return rest as CharacterActionInstance;
  });
  const groups = (stint.groups ?? []).filter(g => valid.has(g.id)).map(g => ({ ...g, repeat: Math.max(1, Math.floor(g.repeat || 1)) }));
  const { groups: _g, ...rest } = stint;
  return groups.length > 0 ? { ...rest, actions: nextActions, groups } : { ...rest, actions: nextActions };
}

/** 隣接するアクションを、グループにする（回数 1）。隣接していない・グループ済みのものを含む・2 つ未満・交代アクションを含むときは、null */
export function createGroup(stint: Stint, actionIds: string[]): Stint | null {
  const actions = stripGroupCopies(stint.actions);
  const idx = actionIds.map(id => actions.findIndex(a => a.id === id)).sort((a, b) => a - b);
  if (idx.length < 2 || idx.some(i => i < 0)) return null;
  for (let k = 1; k < idx.length; k++) if (idx[k] !== idx[k - 1] + 1) return null;
  const members = idx.map(i => actions[i]);
  if (members.some(m => m.groupId || m.type === 'swap')) return null;
  const id = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const ids = new Set(members.map(m => m.id));
  return {
    ...stint,
    actions: actions.map(a => (ids.has(a.id) ? { ...a, groupId: id } : a)),
    groups: [...(stint.groups ?? []), { id, repeat: 1 }],
  };
}

export function ungroup(stint: Stint, groupId: string): Stint {
  return normalizeGroups({
    ...stint,
    actions: stripGroupCopies(stint.actions).map(a => {
      if (a.groupId !== groupId) return a;
      const { groupId: _removed, ...rest } = a;
      return rest as CharacterActionInstance;
    }),
    groups: (stint.groups ?? []).filter(g => g.id !== groupId),
  });
}

export function setGroupRepeat(stint: Stint, groupId: string, repeat: number): Stint {
  const value = Math.max(1, Math.min(99, Math.floor(repeat) || 1));
  return { ...stint, actions: stripGroupCopies(stint.actions), groups: (stint.groups ?? []).map(g => (g.id === groupId ? { ...g, repeat: value } : g)) };
}

/** 他のグループの途中（先頭の手前でも、最後の後ろでもない位置）には入れない: 手前か後ろの近いほうにずらす */
function avoidGroupInterior(rest: CharacterActionInstance[], to: number): number {
  for (const r of groupRuns({ actions: rest, groups: undefined })) {
    if (to > r.start && to <= r.end) return to - r.start <= r.end + 1 - to ? r.start : r.end + 1;
  }
  return to;
}

/**
 * アクションの移動の規則（ユーザー決定 2026-10-11）: グループの中のアクションは、グループの中だけで並び替わる。
 * グループの外のアクションは、グループの中には入れない（グループの手前か後ろにずらす）。先頭の交代アクションの前には入らない。
 * targetIndex = 動かすアクションを抜いた後の並びでの挿入位置。変更が無い・動かせないときは null
 */
export function moveActionRespectingGroups(allActions: CharacterActionInstance[], actionId: string, targetIndex: number): CharacterActionInstance[] | null {
  const actions = stripGroupCopies(allActions);
  const from = actions.findIndex(a => a.id === actionId);
  if (from < 0) return null;
  const item = actions[from];
  if (item.type === 'swap') return null;
  const rest = actions.filter((_, i) => i !== from);
  let to = Math.max(0, Math.min(targetIndex, rest.length));
  to = Math.max(rest[0]?.type === 'swap' ? 1 : 0, to);
  if (item.groupId) {
    const members = rest.map((a, i) => (a.groupId === item.groupId ? i : -1)).filter(i => i >= 0);
    if (members.length > 0) to = Math.max(members[0], Math.min(members[members.length - 1] + 1, to));
  } else {
    to = avoidGroupInterior(rest, to);
  }
  const next = [...rest];
  next.splice(to, 0, item);
  return next.every((a, i) => a.id === actions[i].id) ? null : next;
}

/** グループごとの移動。targetIndex = グループを抜いた後の並びでの挿入位置（他のグループの途中には入れない） */
export function moveGroupBlock(allActions: CharacterActionInstance[], groupId: string, targetIndex: number): CharacterActionInstance[] | null {
  const actions = stripGroupCopies(allActions);
  const members = actions.filter(a => a.groupId === groupId);
  if (members.length === 0) return null;
  const rest = actions.filter(a => a.groupId !== groupId);
  let to = Math.max(rest[0]?.type === 'swap' ? 1 : 0, Math.min(targetIndex, rest.length));
  to = avoidGroupInterior(rest, to);
  const next = [...rest];
  next.splice(to, 0, ...members);
  return next.every((a, i) => a.id === actions[i].id) ? null : next;
}
