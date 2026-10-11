/**
 * 自分の操作が引き金になる、層・印の効果の時間軸の計算（issue #36。D165）。
 *   - 層が溜まる効果（ヴェスナの粛清）: 層ごとに独立した継続時間。最大層を超えると、最も古い層が置き換わる
 *   - 印と、印の発動で付くバフ（アリョーシャの狩猟の印・狩人の照準）: 2 回目の命中で印が発動し、バフが付く
 * 結果は、期間（バー）の一覧だけ。ダメージ・ステータスの値は計算しない（いつ有効か、を示す）
 */
import type { ActionDefinition } from '../types/genshin';

export type LayerBuffRule = NonNullable<ActionDefinition['layerBuff']>;
export type MarkCycleRule = NonNullable<ActionDefinition['markCycle']>['rule'];

export interface LayerEvent {
  time: number;
  /** enter = 新しい状態に入る（E。層をクリアし、命ノ星座によっては最大層から）／gain = 層が 1 つ増える／exit = 退場（層をクリア） */
  kind: 'enter' | 'gain' | 'exit';
}

export interface LayerSpan {
  start: number;
  end: number;
  /** 増えた時点の層数（1 から） */
  index: number;
}

/** 層が溜まる効果の期間の一覧と、最大層の期間（命ノ星座で効果が付くもの） */
export function simulateLayers(events: LayerEvent[], rule: LayerBuffRule, constellation: number): { layers: LayerSpan[]; fullPeriods: { start: number; end: number }[] } {
  const duration = rule.durationFrames / 60;
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const layers: LayerSpan[] = [];
  let alive: LayerSpan[] = [];
  const cut = (at: number) => {
    for (const l of alive) l.end = Math.min(l.end, at);
    alive = [];
  };
  const add = (at: number) => {
    alive = alive.filter(l => l.end > at + 1e-9);
    if (alive.length >= rule.max) {
      // 最大層のとき: 最も古い層を、新しい層で置き換える
      const oldest = alive.reduce((a, b) => (b.end < a.end ? b : a));
      oldest.end = at;
      alive = alive.filter(l => l !== oldest);
    }
    const span: LayerSpan = { start: at, end: Number((at + duration).toFixed(3)), index: 0 };
    alive.push(span);
    span.index = alive.length;
    layers.push(span);
  };
  // 最大層の期間: 生きている層が max の間
  const fullChanges: number[] = [];
  for (const ev of sorted) {
    if (ev.kind === 'enter') {
      cut(ev.time);
      if (rule.fullOnEnter && constellation >= rule.fullOnEnter.minConstellation) for (let i = 0; i < rule.max; i++) add(ev.time);
    } else if (ev.kind === 'exit') {
      cut(ev.time);
    } else {
      add(ev.time);
    }
    fullChanges.push(ev.time);
  }
  const fullPeriods: { start: number; end: number }[] = [];
  if (rule.fullBuff && constellation >= rule.fullBuff.minConstellation) {
    // 層の数が変わる時刻（増減・期限切れ）で区切り、max 以上の間を 1 本にまとめる
    const points = [...new Set([...layers.flatMap(l => [l.start, l.end]), ...fullChanges])].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i++) {
      const mid = (points[i] + points[i + 1]) / 2;
      const count = layers.filter(l => l.start <= mid && mid < l.end).length;
      if (count >= rule.max && points[i + 1] > points[i] + 1e-6) {
        const last = fullPeriods[fullPeriods.length - 1];
        if (last && Math.abs(last.end - points[i]) < 1e-6) last.end = points[i + 1];
        else fullPeriods.push({ start: points[i], end: points[i + 1] });
      }
    }
  }
  return { layers, fullPeriods };
}

export interface MarkEvent {
  /** skill = E の命中（印を付ける。印があれば発動）／tugarin = 爆発の攻撃（印があれば発動するだけ。付けない）／field = 爆発の領域（命ノ星座で印を付ける） */
  kind: 'skill' | 'tugarin' | 'field';
  /** 印の処理をする時刻（命中 + 遅れ） */
  time: number;
}

export interface MarkPeriod {
  start: number;
  end: number;
}

/** 印・バフの期間の一覧（バフは、発動のたびに更新される 1 本。層数は発動時点の層数） */
export function simulateMarks(events: MarkEvent[], rule: MarkCycleRule, constellation: number): { marks: MarkPeriod[]; buffs: (MarkPeriod & { stacks: number })[] } {
  const duration = rule.durationFrames / 60;
  const maxStacks = 1 + (rule.extraStacks && constellation >= rule.extraStacks.minConstellation ? rule.extraStacks.extra : 0);
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const marks: MarkPeriod[] = [];
  const buffs: (MarkPeriod & { stacks: number })[] = [];
  let mark: MarkPeriod | undefined;
  let buff: (MarkPeriod & { stacks: number }) | undefined;
  for (const ev of sorted) {
    const markAlive = !!mark && ev.time < mark.end - 1e-9;
    const trigger = () => {
      if (mark) mark.end = Math.min(mark.end, ev.time);
      mark = undefined;
      const buffAlive = !!buff && ev.time < buff.end - 1e-9;
      const stacks = Math.min((buffAlive ? buff!.stacks : 0) + 1, maxStacks);
      // 発動のたびに、バフを 1 本の期間として更新する（前のバーは、ここで終わり、新しいバーが始まる）
      if (buff && buffAlive) buff.end = ev.time;
      buff = { start: ev.time, end: Number((ev.time + duration).toFixed(3)), stacks };
      buffs.push(buff);
    };
    const apply = () => {
      mark = { start: ev.time, end: Number((ev.time + duration).toFixed(3)) };
      marks.push(mark);
    };
    if (ev.kind === 'skill') {
      if (markAlive) trigger();
      else apply();
    } else if (ev.kind === 'tugarin') {
      if (markAlive) trigger();
    } else {
      // 爆発の領域: 命ノ星座で、印を付ける（発動はしない。すでにある印は更新）
      if (mark && markAlive) mark.end = Math.min(mark.end, ev.time);
      apply();
    }
  }
  // 続けて更新される同じ層数のバフは、1 本にまとめる（爆発の間の、2 秒ごとの更新など）
  const merged: (MarkPeriod & { stacks: number })[] = [];
  for (const b of buffs) {
    const last = merged[merged.length - 1];
    if (last && last.stacks === b.stacks && b.start <= last.end + 1e-6) last.end = Math.max(last.end, b.end);
    else merged.push({ ...b });
  }
  return { marks, buffs: merged };
}
