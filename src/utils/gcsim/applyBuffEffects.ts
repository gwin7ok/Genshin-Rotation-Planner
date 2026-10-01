/**
 * gcsim の結果 → 発動バフ（固有天賦・武器・聖遺物）とキャラクターに紐づく効果への書き戻し（フェーズ6 / 6-3c）
 *
 * 純粋関数。決定:
 *   D29  … ユーザーが追加している要素は発動位置・効果持続時間・CT を上書き、未追加の要素はアプリが追加してから上書き
 *   D38  … 1つの定義に複数のキーがあるときは、キーごとに別のバー（トリガーの `gcsimKey`）。同じ出場ブロックの複数回は時刻順に対応付け、
 *          足りない分は追加し、gcsim に出なかった手動の発動は残して印（`gcsimMissed`）を付ける。置き場所は発動元の直前の出場ブロック
 *   D40-1… 2周目のイベントは、直前の出場ブロックが2周目のコピーなら1周目と同一とみなして追加しない。1周目の出場ブロックの後ろにはみ出るものだけ
 *          （発動位置が周の終端を超える）を2周目の発動として追加する
 *   D57  … 命中・反応由来の「キャラクターに紐づく効果」は `Stint.extraEffects` に書く（直前の出場ブロック。無ければ将来方向で一番近い出場ブロックで、秒数は負）
 */
import type { PassiveTriggerInstance, Stint } from '../../types/genshin.ts';
import type { TriggerableBuffDefinition } from '../buffUtils.ts';
import type { AlignedAction } from './applyGcsimResult.ts';
import { isFirstLap } from './applyGcsimResult.ts';
import { framesToSeconds, type GcsimEffectRecord, type GcsimLogSummary, type GcsimMemberInfo } from './readGcsimLog.ts';

// ---------------------------------------------------------------------------
// 共通: 出場ブロックの対応付け
// ---------------------------------------------------------------------------

export interface StintPlacement {
  charIndex: number;
  /** gcsim の出場の開始フレーム */
  startFrame: number;
  /** アプリの出場ブロック ID */
  stintId: string;
  /** 1周目（初動 + ループ1周目）の出場ブロックか。false = 2周目のコピー */
  firstLap: boolean;
}

/** gcsim の出場（summary.stints）を、アプリの出場ブロックに対応付ける（出場の最初のアクションの actionRefs から引く） */
export function placeStints(summary: GcsimLogSummary, pairs: AlignedAction[], swapDelayFrames = 0): StintPlacement[] {
  const refOf = new Map(pairs.map(p => [p.executed, p.ref]));
  const out: StintPlacement[] = [];
  for (const st of summary.stints) {
    const first = st.actions[0];
    const ref = first ? refOf.get(first) : undefined;
    if (!ref) continue;
      // アプリの出場は、交代遅延から始まる（出場の先頭 = 交代の要求。最初の出場も同じ）。gcsim の出場の開始（`executed swap`）は、要求の swap_delay 後
    out.push({ charIndex: st.charIndex, startFrame: st.startFrame - swapDelayFrames, stintId: ref.stintId, firstLap: isFirstLap(ref) });
  }
  return out.sort((a, b) => a.startFrame - b.startFrame);
}

/** 2周目の先頭（1周目のあとに始まる2周目のコピーの出場の開始フレーム。無ければ Infinity）。charIndex を渡すと、そのキャラの2周目のコピーの最初の出場 */
export function lapEndFrame(placements: StintPlacement[], charIndex?: number): number {
  return placements.filter(p => !p.firstLap && (charIndex === undefined || p.charIndex === charIndex)).reduce((m, p) => Math.min(m, p.startFrame), Infinity);
}

/**
 * 効果のイベントを、更新が続く間（前のイベントの終了予定より前に次のイベントが起きる間。gapFrames までの隙間は許す）ごとの「まとまり」にする。
 * 2周目の先頭（lapEnd）をまたいでは、まとめない（2周目の更新で1周目の発動が延びて見えないように）。
 * 発動元キャラの2周目のコピーの出場（cutFrame）以降のイベントは、そのコピーの出場に属する（1周目と同一）ので無視する。終了予定が分からないイベントも無視する
 */
export function chainEvents(
  events: { frame: number; expiry: number; ended: number }[],
  lapEnd: number,
  gapFrames = 0,
  cutFrame = Infinity,
): { startFrame: number; endFrame: number }[] {
  const chains: { startFrame: number; endFrame: number }[] = [];
  for (const ev of [...events].sort((a, b) => a.frame - b.frame)) {
    if (ev.frame >= cutFrame) continue;
    const end = ev.expiry > ev.frame ? ev.expiry : ev.ended > ev.frame ? ev.ended : -1;
    if (end < 0) continue;
    const last = chains[chains.length - 1];
    // 1周目の発動と2周目の発動は、まとめない（2周目の更新で1周目の発動が延びて見えないように）
    const joinable = last !== undefined && (ev.frame < lapEnd) === (last.startFrame < lapEnd);
    if (last && joinable && ev.frame <= last.endFrame + gapFrames) last.endFrame = Math.max(last.endFrame, end);
    else chains.push({ startFrame: ev.frame, endFrame: end });
  }
  return chains;
}

export interface EffectPlacement {
  stintId: string;
  /** 出場の先頭からの秒数（出場より前に起きた効果は負） */
  offset: number;
  /** 出場の前の効果を、将来方向の出場ブロックに置いた */
  beforeFirstStint?: boolean;
}

/**
 * 効果の開始フレームを置く出場ブロック。
 *   発動元キャラの、開始より前で一番近い出場ブロック（2周目のコピーなら null = 1周目と同一とみなして追加しない）。
 *   無ければ、将来方向で一番近い出場ブロック（1周目のもの）に、負の秒数で置く
 */
export function placeEffect(placements: StintPlacement[], charIndex: number, frame: number): EffectPlacement | null {
  const mine = placements.filter(p => p.charIndex === charIndex);
  let prev: StintPlacement | undefined;
  for (const p of mine) if (p.startFrame <= frame) prev = p;
  if (prev) {
    if (!prev.firstLap) return null;
    return { stintId: prev.stintId, offset: Number(framesToSeconds(frame - prev.startFrame).toFixed(3)) };
  }
  const next = mine.find(p => p.firstLap);
  if (!next) return null;
  return { stintId: next.stintId, offset: Number(framesToSeconds(frame - next.startFrame).toFixed(3)), beforeFirstStint: true };
}

/** 辞書のキー（`vv{element}` や `scroll-4pc-*` のパターンを含む）にログのキーが一致するか */
export function matchesGcsimKey(pattern: string, key: string): boolean {
  if (pattern === key) return true;
  if (!pattern.includes('*') && !pattern.includes('{element}')) return false;
  const re = new RegExp('^' + pattern.replace(/[.+?^$()|[\]\\]/g, '\\$&').replace('{element}', '[a-z]+').replace(/\*/g, '.*') + '$');
  return re.test(key);
}

// ---------------------------------------------------------------------------
// 発動バフ（固有天賦・武器・聖遺物）
// ---------------------------------------------------------------------------

export interface PassiveChange {
  stintId: string;
  defId: string;
  name: string;
  key: string;
  kind: 'add' | 'update' | 'missed';
  offset?: number;
  duration?: number;
  cooldown?: number;
  /** 更新のとき、変更前 */
  before?: { offset: number; duration?: number; cooldown?: number };
  /** 発動元キャラの出場の前の効果を、最初の出場ブロックの先頭に置いた（D38-3） */
  warnBeforeStint?: boolean;
}

export interface ApplyPassivesResult {
  stints: Stint[];
  changes: PassiveChange[];
}

const uid = (() => { let n = 0; return () => `ptrg_gcsim_${Date.now().toString(36)}_${(n++).toString(36)}`; })();

/** 効果の継続時間と、同じ持ち主の発動間隔（CT）のキーからの CT */
function cooldownFor(rec: { startFrame: number }, cts: GcsimEffectRecord[]): number | undefined {
  // CT は効果とほぼ同時に始まる（±0.5 秒）。最も近いものを使う
  let best: GcsimEffectRecord | undefined;
  for (const c of cts) {
    if (c.endFrame <= c.startFrame) continue;
    if (Math.abs(c.startFrame - rec.startFrame) > 30) continue;
    if (!best || Math.abs(c.startFrame - rec.startFrame) < Math.abs(best.startFrame - rec.startFrame)) best = c;
  }
  return best ? Number(framesToSeconds(best.endFrame - best.startFrame).toFixed(3)) : undefined;
}

/**
 * 発動バフを書き戻す（D29・D38・D40-1）。
 * 対象: 定義が gcsim の効果のキー（gcsimKeys）を持ち、gcsim の結果にそのキーの効果（終わりのあるもの）が出たもの。
 */
export function applyPassiveTriggers(
  stints: Stint[],
  pairs: AlignedAction[],
  summary: GcsimLogSummary,
  members: GcsimMemberInfo[],
  /** キャラ ID → そのキャラが発動できる発動バフの定義（getAvailableBuffsForCharacter） */
  buffsByCharacter: Record<string, TriggerableBuffDefinition[]>,
  /** 交代遅延（swap_delay）のフレーム数 */
  swapDelayFrames = 0,
): ApplyPassivesResult {
  const placements = placeStints(summary, pairs, swapDelayFrames);
  const lapEnd = lapEndFrame(placements);
  const changes: PassiveChange[] = [];
  const stintById = new Map(stints.map(s => [s.id, s]));
  // 出場ブロックごとの、書き込み後のトリガー
  const triggers = new Map<string, PassiveTriggerInstance[]>(stints.map(s => [s.id, (s.passiveTriggers ?? []).map(t => ({ ...t }))]));
  const claimed = new Set<string>();

  // gcsim の出場に対応付けできた出場ブロック（実行した出場）。これ以外の出場ブロックの手動の発動は印の対象にしない
  const executedStints = new Set(placements.filter(p => p.firstLap).map(p => p.stintId));

  members.forEach((member, charIndex) => {
    const defs = (buffsByCharacter[member.characterId] ?? []).filter(d => d.gcsimTarget !== false && (d.gcsimKeys?.length ?? 0) > 0);
    if (defs.length === 0) return;
    const mine = summary.effects.filter(e => e.sourceCharIndex === charIndex);

    for (const def of defs) {
      const cts = mine.filter(e => e.entry.kind === 'cooldown' && (def.gcsimCooldownKeys ?? []).includes(e.key));
      const effectsOfDef = mine.filter(e => e.entry.kind === 'effect' && (def.gcsimKeys ?? []).some(k => matchesGcsimKey(k, e.key)));
      const multiKey = (def.gcsimKeys?.length ?? 0) > 1 || (def.gcsimKeys ?? []).some(k => k.includes('*') || k.includes('{element}'));
      const keys = [...new Set(effectsOfDef.map(e => e.key))];

      for (const key of keys) {
        // 終わりのある効果だけ（常時の効果は時刻の情報が無い）
        // チームバフは受け取るキャラごとに開始・終了が少しずつ違って記録されるので、効果のイベントを更新が続く間ごとに1つの発動にまとめる
        // （アプリは、同じ効果を再発動すると前の発動はそこで終わる扱い）。2周目の更新では、1周目の発動を延ばさない
        const recs = chainEvents(summary.effectEvents.filter(ev => ev.key === key), lapEnd, 0, lapEndFrame(placements, charIndex));
        // 出場ブロックごとに、時刻順に並べる
        const byStint = new Map<string, { rec: { startFrame: number; endFrame: number }; place: EffectPlacement }[]>();
        for (const rec of recs) {
          const place = placeEffect(placements, charIndex, rec.startFrame);
          if (!place) continue;
          if (!byStint.has(place.stintId)) byStint.set(place.stintId, []);
          byStint.get(place.stintId)!.push({ rec, place });
        }
        for (const [stintId, list] of byStint) {
          if (!stintById.has(stintId)) continue;
          const arr = triggers.get(stintId)!;
          // 既存: 同じ定義で、同じキーのもの、または手動で置いたもの（キー無し）。発動位置の順
          const existing = arr
            .filter(t => t.passiveEffectId === def.id && (t.gcsimKey === key || t.gcsimKey === undefined) && !claimed.has(t.id))
            .sort((a, b) => a.offset - b.offset);
          list.forEach(({ rec, place }, i) => {
            const duration = Number(framesToSeconds(rec.endFrame - rec.startFrame).toFixed(3));
            const cooldown = cooldownFor(rec, cts);
            const name = multiKey ? `${def.name}（${key}）` : def.name;
            const t = existing[i];
            if (t) {
              claimed.add(t.id);
              const beforeDuration = t.duration ?? def.duration;
              const beforeCooldown = t.cooldown ?? def.cooldown;
              const same = t.gcsimKey === key && Math.abs(t.offset - place.offset) < 0.0005 && beforeDuration !== undefined && Math.abs(beforeDuration - duration) < 0.0005
                && (cooldown === undefined || (beforeCooldown !== undefined && Math.abs(beforeCooldown - cooldown) < 0.0005));
              if (!same) {
                changes.push({
                  stintId, defId: def.id, name, key, kind: 'update', offset: place.offset, duration, cooldown,
                  before: { offset: t.offset, duration: beforeDuration, cooldown: beforeCooldown },
                  warnBeforeStint: place.beforeFirstStint,
                });
              }
              t.gcsimKey = key;
              t.offset = place.offset;
              t.duration = duration;
              if (cooldown !== undefined) t.cooldown = cooldown;
              delete t.gcsimMissed;
            } else {
              const nt: PassiveTriggerInstance = {
                id: uid(), passiveEffectId: def.id, name, offset: place.offset, duration, gcsimKey: key,
                ...(cooldown !== undefined ? { cooldown } : {}),
              };
              claimed.add(nt.id);
              arr.push(nt);
              changes.push({ stintId, defId: def.id, name, key, kind: 'add', offset: place.offset, duration, cooldown, warnBeforeStint: place.beforeFirstStint });
            }
          });
        }
      }
    }
  });

  // 定義が gcsim のキーを持つのに、gcsim の結果に出なかった発動は、削除せず残して印を付ける（D38-2）
  const gcsimDefs = new Map<string, TriggerableBuffDefinition>();
  for (const defs of Object.values(buffsByCharacter)) for (const d of defs) if (d.gcsimTarget !== false && (d.gcsimKeys?.length ?? 0) > 0) gcsimDefs.set(d.id, d);
  for (const [stintId, arr] of triggers) {
    for (const t of arr) {
      if (claimed.has(t.id)) continue;
      const def = gcsimDefs.get(t.passiveEffectId);
      if (!def || !executedStints.has(stintId)) {
        delete t.gcsimMissed;
        continue;
      }
      if (!t.gcsimMissed) {
        changes.push({ stintId, defId: def.id, name: t.name, key: t.gcsimKey ?? '', kind: 'missed', offset: t.offset });
      }
      t.gcsimMissed = true;
    }
  }

  const updated = stints.map(st => {
    const arr = triggers.get(st.id)!;
    const before = st.passiveTriggers ?? [];
    if (arr.length === 0 && before.length === 0) return st;
    if (JSON.stringify(arr) === JSON.stringify(before)) return st;
    return { ...st, passiveTriggers: arr };
  });
  return { stints: updated, changes };
}

// ---------------------------------------------------------------------------
// キャラクターに紐づく効果（D57）
// ---------------------------------------------------------------------------

/** キャラクターに紐づく効果の定義（src/masterdata/characterLinkedEffects.ts） */
export interface CharacterLinkedEffectDef {
  /** gcsim の効果のキー */
  key: string;
  /** バーの表示名 */
  label: string;
  /** 各回の発動を別のバーにする（each。既定）か、更新が続く間を1本にする（chain） */
  mode?: 'each' | 'chain';
}

export interface CharacterEffectChange {
  stintId: string;
  name: string;
  effects: { key: string; name: string; offset: number; duration: number }[];
}

export interface ApplyCharacterEffectsResult {
  stints: Stint[];
  changes: CharacterEffectChange[];
}

/** chain 方式で、前のイベントの終了予定から次のイベントまでの隙間がこのフレーム数以内なら、同じバーにする */
const CHAIN_GAP_FRAMES = 12;

/**
 * 「キャラクターに紐づく効果」を書き戻す。対象のキャラ（table のキー = gcsim のキャラのキー）の出場ブロックの `extraEffects` を作り直す。
 * 効果のイベントは、そのキャラ自身に記録されたものだけを使う。1周目のイベントだけ書き込む（D21・D40-1 と同じ置き場所の規則）。
 */
export function applyCharacterLinkedEffects(
  stints: Stint[],
  pairs: AlignedAction[],
  summary: GcsimLogSummary,
  members: GcsimMemberInfo[],
  table: Record<string, CharacterLinkedEffectDef[]>,
  /** 交代遅延（swap_delay）のフレーム数 */
  swapDelayFrames = 0,
): ApplyCharacterEffectsResult {
  const placements = placeStints(summary, pairs, swapDelayFrames);
  const lapEnd = lapEndFrame(placements);
  const next = new Map<string, { key: string; name: string; offset: number; duration: number }[]>();
  const touched = new Set<string>();

  members.forEach((member, charIndex) => {
    const defs = table[member.gcsimKey];
    if (!defs) return;
    // このキャラの出場ブロックは、まず空にする（前回の結果を残さない）
    for (const p of placements) if (p.charIndex === charIndex && p.firstLap) touched.add(p.stintId);
    for (const def of defs) {
      const events = summary.effectEvents
        .filter(e => e.key === def.key && e.charIndex === charIndex && e.expiry > e.frame)
        .sort((a, b) => a.frame - b.frame);
      const bars: { start: number; end: number }[] = [];
      if (def.mode === 'chain') {
        for (const c of chainEvents(events, lapEnd, CHAIN_GAP_FRAMES, lapEndFrame(placements, charIndex))) bars.push({ start: c.startFrame, end: c.endFrame });
      } else {
        for (const ev of events.filter(e => e.kind === 'added' || e.kind === 'refreshed')) bars.push({ start: ev.frame, end: ev.expiry });
      }
      for (const bar of bars) {
        const place = placeEffect(placements, charIndex, bar.start);
        if (!place) continue;
        if (!next.has(place.stintId)) next.set(place.stintId, []);
        next.get(place.stintId)!.push({ key: def.key, name: def.label, offset: place.offset, duration: Number(framesToSeconds(bar.end - bar.start).toFixed(3)) });
      }
    }
  });

  const changes: CharacterEffectChange[] = [];
  const updated = stints.map(st => {
    if (!touched.has(st.id) && !next.has(st.id)) return st;
    const effects = (next.get(st.id) ?? []).sort((a, b) => a.offset - b.offset);
    if (JSON.stringify(effects) === JSON.stringify(st.extraEffects ?? [])) return st;
    changes.push({ stintId: st.id, name: st.characterId, effects });
    const { extraEffects: _old, ...rest } = st;
    return effects.length > 0 ? { ...rest, extraEffects: effects } : rest;
  });
  return { stints: updated, changes };
}
