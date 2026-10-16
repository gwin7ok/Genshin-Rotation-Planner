import { ActiveBuffSpan, CooldownSpan, PassiveSpan } from '../../types/genshin';
import { TotemTracker } from '../totemTracker';
import { countDistinctActiveBuffs } from '../characterActions';
import type { BuffOverlapSegment } from './types';

/** バフ数が変わる時刻（各バフの開始・終了）で区切り、区間ごとに数える（同じ buffId は1つ） */
export function buildBuffOverlapSegments(buffs: ActiveBuffSpan[], totalDuration: number): BuffOverlapSegment[] {
  const cuts = [...new Set([0, totalDuration, ...buffs.flatMap(b => [b.startTime, b.endTime])])]
    .filter(t => t >= 0 && t <= totalDuration)
    .sort((a, b) => a - b);
  const segments: BuffOverlapSegment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i];
    const end = cuts[i + 1];
    if (end - start < 0.001) continue;
    const { count, names } = countDistinctActiveBuffs(buffs, (start + end) / 2);
    const prev = segments[segments.length - 1];
    // 同じ数の時間帯は 1 つのバーにする（追加作業 22 / issue #8）。入れ替わりがあるときは、その間に有効だったバフ名をまとめる
    if (prev && prev.count === count) {
      prev.end = end;
      for (const n of names) if (!prev.activeBuffs.includes(n)) prev.activeBuffs.push(n);
    }
    else segments.push({ start, end, count, activeBuffs: names });
  }
  return segments;
}

/**
 * 殺生桜（行を持つバー）の 2 周目折り返し。1 周目の終わりに残る桜を初期状態にして、ループの区間の桜の設置・爆発を時刻順に流す（2 周目の動きの再現）。
 *   - 置き換えられた（最古として押し出された）持ち越しの桜は、その時刻で切る。置き換えた新しい桜のバーの行を、持ち越しバーの行にする（同じ行で、持ち越しが終わる時刻 = 新しいバーが始まる時刻）
 *   - 爆発で壊れた桜（諭示未達成）は、その時刻で切る
 *   - 置き換えられずに寿命で終わる桜は、1 周目のバーが使っていない行に置く（全部埋まるときは、元の行）
 */
export function wrapTotems(
  bars: ActiveBuffSpan[],
  totalDuration: number,
  loopStartTime: number,
  lifetimes: Map<ActiveBuffSpan, number>,
  maxByBuff: Map<string, number>,
  burstsByChar: Map<string, Array<{ time: number; destroy: boolean }>>,
): ActiveBuffSpan[] {
  const out: ActiveBuffSpan[] = [];
  if (totalDuration - loopStartTime <= 0.05) return out;
  const byBuff = new Map<string, ActiveBuffSpan[]>();
  for (const b of bars) byBuff.set(b.buffId, [...(byBuff.get(b.buffId) ?? []), b]);
  for (const [buffId, group] of byBuff) {
    const max = maxByBuff.get(buffId) ?? 3;
    type Tag = { carry?: ActiveBuffSpan };
    // 持ち越し: 1 周目の終わりより後まで残る桜（開始が 1 周目の終わり以降の設置を含む）
    const carried = group.filter(b => b.endTime > totalDuration + 0.02).sort((a, b) => a.startTime - b.startTime).map(b => {
      const start = b.startTime >= totalDuration ? loopStartTime + (b.startTime - totalDuration) : loopStartTime;
      const fullEnd = loopStartTime + (b.endTime - totalDuration);
      const carry: ActiveBuffSpan = {
        ...b,
        id: `wrap_buff_${b.id}`,
        startTime: Number(start.toFixed(3)),
        endTime: Number(Math.min(totalDuration, fullEnd).toFixed(3)),
        isCarryOver: true,
        originalStartTime: b.startTime,
        sourceId: b.id,
      };
      carry.duration = Number((carry.endTime - carry.startTime).toFixed(3));
      return { src: b, carry, fullEnd };
    });
    // ループの区間の設置（2 周目にも同じ時刻に起きる）と、爆発
    const spawns = group.filter(b => b.startTime >= loopStartTime - 1e-6 && b.startTime < totalDuration).sort((a, b) => a.startTime - b.startTime);
    const charId = group[0].sourceCharacterId;
    const bursts = (burstsByChar.get(charId) ?? []).filter(x => x.time >= loopStartTime - 1e-6 && x.time < totalDuration);
    type Ev = { t: number; order: number; kind: 'carry' | 'spawn' | 'burst'; i: number };
    const events: Ev[] = [
      ...carried.map((c, i): Ev => ({ t: c.carry.startTime, order: 0, kind: 'carry', i })),
      ...spawns.map((s, i): Ev => ({ t: s.startTime, order: 1, kind: 'spawn', i })),
      ...bursts.map((x, i): Ev => ({ t: x.time, order: 1, kind: 'burst', i })),
    ].sort((a, b) => a.t - b.t || a.order - b.order);
    const tracker = new TotemTracker<Tag>();
    const assigned = new Set<ActiveBuffSpan>();
    for (const ev of events) {
      if (ev.kind === 'carry') {
        const c = carried[ev.i];
        tracker.spawn(ev.t, c.fullEnd - ev.t, max, { carry: c.carry }, c.src.lane);
      } else if (ev.kind === 'spawn') {
        const s = spawns[ev.i];
        const { popped } = tracker.spawn(ev.t, lifetimes.get(s) ?? s.duration, max, {});
        const cb = popped?.tag.carry;
        if (cb) {
          cb.endTime = Number(Math.max(cb.startTime, Math.min(cb.endTime, popped!.end)).toFixed(3));
          cb.lane = s.lane;
          assigned.add(cb);
        }
      } else {
        for (const x of tracker.burst(ev.t, bursts[ev.i].destroy)) {
          const cb = x.tag.carry;
          if (cb) cb.endTime = Number(Math.max(cb.startTime, Math.min(cb.endTime, x.end)).toFixed(3));
        }
      }
    }
    // 置き換えられずに終わる桜: 1 周目のバーが使っていない行へ
    const placed: ActiveBuffSpan[] = [];
    for (const c of carried) {
      c.carry.duration = Number((c.carry.endTime - c.carry.startTime).toFixed(3));
      if (c.carry.duration <= 0.02) continue;
      if (!assigned.has(c.carry)) {
        const busy = new Set<number>();
        for (const o of [...group, ...placed]) {
          if (o !== c.src && o.lane !== undefined && o.startTime < c.carry.endTime - 1e-6 && Math.min(o.endTime, totalDuration) > c.carry.startTime + 1e-6) busy.add(o.lane);
        }
        let lane = 0;
        while (lane < max && busy.has(lane)) lane++;
        if (lane < max) c.carry.lane = lane;
      }
      placed.push(c.carry);
    }
    out.push(...placed);
  }
  return out;
}

export function endAtNextStart<T extends { startTime: number; endTime: number }>(spans: T[], effectKey: (s: T) => string): void {
  const byKey = new Map<string, T[]>();
  for (const s of spans) byKey.set(effectKey(s), [...(byKey.get(effectKey(s)) ?? []), s]);
  for (const list of byKey.values()) {
    list.sort((a, b) => a.startTime - b.startTime);
    list.forEach((s, i) => {
      const next = list[i + 1];
      if (next && next.startTime < s.endTime) s.endTime = next.startTime;
    });
  }
}

/** 2 周目の折り返し（持ち越し）: CT・効果バフ・発動バフを、ループ先頭へ折り返した部分を作る。折り返した効果の本体の終わりも、ここで合わせる */
export function buildCarryOver(a: { skillCooldowns: CooldownSpan[]; burstCooldowns: CooldownSpan[]; activeBuffs: ActiveBuffSpan[]; passiveSpans: PassiveSpan[]; totalDuration: number; loopStartTime: number; loopPeriod: number; totemLifetime: Map<ActiveBuffSpan, number>; totemMax: Map<string, number>; totemBursts: Map<string, Array<{ time: number; destroy: boolean }>> }): { carryOverCooldowns: CooldownSpan[]; carryOverBuffs: ActiveBuffSpan[]; carryOverPassives: PassiveSpan[] } {
  const { skillCooldowns, burstCooldowns, activeBuffs, passiveSpans, totalDuration, loopStartTime, loopPeriod, totemLifetime, totemMax, totemBursts } = a;
  const carryOverCooldowns: CooldownSpan[] = [];
  const carryOverBuffs: ActiveBuffSpan[] = [];
  const carryOverPassives: PassiveSpan[] = [];

  // 効果の折り返し部分: ループ先頭から残り時間分。ループ区間で同じ効果を再発動したらそこで終わる。
  // 本体の終了時刻も、折り返し後の実際の終了（totalDuration + 折り返し部分の長さ）に合わせる。
  // 開始が周の終端以降の発動（2周目の発動。D39）は、ループ先頭 + (開始 − 総時間) の位置から始まる
  const wrapEffect = (span: { id: string; startTime: number; endTime: number }, sameEffect: { id?: string; startTime: number }[]) => {
    const wrapDelay = Math.max(0, span.startTime - totalDuration);
    const wrapStart = loopStartTime + wrapDelay;
    const toLapTwo = (t: number) => (t >= totalDuration ? loopStartTime + (t - totalDuration) : t);
    const nextStart = Math.min(
      ...sameEffect
        .filter(s => (wrapDelay > 0 ? (s as { id?: string }).id !== span.id && toLapTwo(s.startTime) > wrapStart : s.startTime >= loopStartTime))
        .map(s => toLapTwo(s.startTime)),
    );
    const end = Number(Math.min(totalDuration, loopStartTime + (span.endTime - totalDuration), nextStart).toFixed(3));
    span.endTime = totalDuration + Math.max(0, end - loopStartTime);
    if (end <= wrapStart + 0.02) return null;
    return {
      startTime: Number(wrapStart.toFixed(3)),
      endTime: end,
      duration: end - wrapStart,
      isCarryOver: true,
      originalStartTime: span.startTime,
      sourceId: span.id,
    };
  };

  if (loopPeriod > 0.05) {
    // 1. スキルCTの2周目折り返し
    for (const cd of skillCooldowns) {
      if (cd.endTime > totalDuration + 0.02) {
        // CTの開始が周の終端より後（CT開始位置の遅れ）なら、折り返し後もその分だけ遅れて始まる
        const wrapDelay = Math.max(0, cd.startTime - totalDuration);
        const overflow = Number((cd.endTime - totalDuration - wrapDelay).toFixed(3));
        const wrapStart = Number((loopStartTime + wrapDelay).toFixed(3));
        const wrapEnd = Math.min(totalDuration, Number((wrapStart + overflow).toFixed(3)));
        carryOverCooldowns.push({
          id: `wrap_cd_${cd.type === 'special' ? 'special' : 'skill'}_${cd.id}`,
          characterId: cd.characterId,
          type: cd.type,
          startTime: wrapStart,
          endTime: wrapEnd,
          duration: overflow,
          actionInstanceId: cd.actionInstanceId,
          isCarryOver: true,
          originalStartTime: cd.startTime,
          originalEndTime: cd.endTime,
        });
      }
    }

    // 2. 元素爆発CTの2周目折り返し
    for (const cd of burstCooldowns) {
      if (cd.endTime > totalDuration + 0.02) {
        // CTの開始が周の終端より後（CT開始位置の遅れ）なら、折り返し後もその分だけ遅れて始まる
        const wrapDelay = Math.max(0, cd.startTime - totalDuration);
        const overflow = Number((cd.endTime - totalDuration - wrapDelay).toFixed(3));
        const wrapStart = Number((loopStartTime + wrapDelay).toFixed(3));
        const wrapEnd = Math.min(totalDuration, Number((wrapStart + overflow).toFixed(3)));
        carryOverCooldowns.push({
          id: `wrap_cd_burst_${cd.id}`,
          characterId: cd.characterId,
          type: 'burst',
          startTime: wrapStart,
          endTime: wrapEnd,
          duration: overflow,
          actionInstanceId: cd.actionInstanceId,
          isCarryOver: true,
          originalStartTime: cd.startTime,
          originalEndTime: cd.endTime,
        });
      }
    }

    // 3. 効果バフの2周目折り返し（発動バフ分はバフ数の集計用。バーは carryOverPassives で表示する）
    // 殺生桜（行を持つバー）は、2 周目の動きを再現して持ち越す（別に処理する）
    carryOverBuffs.push(...wrapTotems(activeBuffs.filter(b => b.stackable && b.lane !== undefined), totalDuration, loopStartTime, totemLifetime, totemMax, totemBursts));
    for (const b of activeBuffs) {
      if (b.stackable && b.lane !== undefined) continue;
      if (b.endTime <= totalDuration + 0.02) continue;
      const carry = wrapEffect(b, activeBuffs.filter(x => x.buffId === b.buffId));
      if (carry) carryOverBuffs.push({ ...b, ...carry, id: `wrap_buff_${b.id}` });
    }

    // 4. 発動バフ（固有天賦・武器・聖遺物）の2周目折り返し
    for (const p of passiveSpans) {
      if (p.duration <= 0 || p.endTime <= totalDuration + 0.02) continue;
      const carry = wrapEffect(p, passiveSpans.filter(x => x.characterId === p.characterId && x.effectGroup === p.effectGroup));
      if (carry) {
        // CTも折り返した位置に合わせる（本体のCT終了は元の時刻のまま）
        const cooldownEnd = p.cooldownEnd > totalDuration ? Number((loopStartTime + (p.cooldownEnd - totalDuration)).toFixed(3)) : carry.startTime;
        carryOverPassives.push({ ...p, ...carry, cooldownEnd, id: `wrap_passive_buff_${p.id}` });
      }
    }
  }
  return { carryOverCooldowns, carryOverBuffs, carryOverPassives };
}
