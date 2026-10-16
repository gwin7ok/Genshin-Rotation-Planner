import { NightsoulTracker } from '../nightsoulTracker';
import { TotemTracker } from '../totemTracker';
import { CooldownSpan } from '../../types/genshin';
import { CooldownQueue, type QueueHead } from '../cooldownQueue';
import type { SacrificialProc } from './types';
import type { StockLog } from './stockSpans';

/** CT を持つ1回の発動 */
export interface CooldownEvent {
  /** CT の共有単位（キャラ + スキル / 爆発 / 発動バフ） */
  key: string;
  /** 1周目の時間軸での発動時刻 */
  time: number;
  /** 発動時刻から CT の開始までの秒数（CT開始位置。発動バフは 0） */
  ctOffset: number;
  /** この発動が開始する CT（0 なら CT を開始しない） */
  cooldown: number;
  /** CT 中の発動を違反として扱うか（祭礼リセットなど CT 中でも撃てるものは false） */
  checked: boolean;
  /** この枠のチャージ数（同時に溜められる回数。無ければ 1）。どのチャージもCT中なら違反 */
  charges?: number;
  /** 祭礼の武器: スキルのダメージが敵に当たる時刻の判定（確率 100%）。使用者が場にいて、スキルが CT 中で、武器の内部 CT が明けていれば、スキルの先頭の CT を捨てる */
  sacrificial?: { icdSeconds: number; hitFrame: number };
  /** true のとき、回数が 1 でも CT のキューで持つ（CT を後から短縮されるスキル。閑雲。バーの終わりが短縮で動く） */
  forceQueue?: boolean;
  /** 凝光の命ノ星座 2: 前の発動から lifetime 秒以内（光幕が残っている）に、CT が明けた状態で使い直すと、CT がすぐリセットされる（icdSeconds に 1 回まで） */
  recastReset?: { icdSeconds: number; lifetime: number };
  /** true のとき、この発動が全回数分のCTをキューに積む（1 つ目はこの時刻から、2 つ目は 1 つ目が明けてから。検査はしない。ファルカのスキルが特殊スキルのCTを開始する）。この枠は、短縮が先頭だけに効く */
  startsAll?: boolean;
  /** この発動のアクション ID（特殊スキルの CT のバーが、どの発動の分かを示す） */
  actionId?: string;
  /** startsAll の発動の受付（疾風怒濤）。有効な終わりより後に始まる待機中の CT は積まない */
  window?: { until: number; effectiveEnd?: number };
  /** true のとき、特殊スキルの CT が空いていれば 1 回分使い、空いていなければ何もしない（ファルカの受付の間の重撃 = 特殊重撃「蒼牙」） */
  optional?: boolean;
  /** 0 より大きいとき、この発動は CT を始めず、CT 中のチャージの CT を、この秒数だけ短縮する（ファルカの通常攻撃） */
  reduceBy?: number;
  /** 設置物（八重神子の殺生桜）を 1 つ出す発動。寿命（秒）と上限。上限を超えると最古が消える */
  spawnsTotem?: { max: number; delay: number; lifetime: number };
  /** 爆発: 場の設置物 1 つにつき、この枠（スキル）の先頭の CT を解放する（八重神子）。revelation が false なら、爆発のあと設置物が全部壊れる。検査はしない */
  releasesPerTotem?: { revelation: boolean };
  /** 夜魂値（ヴァレサ）。skill = スキル（無料のスキルなら、回数も CT も使わない）、plunge = 落下攻撃、burst = 爆発 */
  nightsoul?: { role: 'skill' | 'plunge' | 'burst'; gain: number; max: number; blessingSeconds: number };
  stintIndex: number;
  name: string;
  /** 違反時: remaining = 残り CT 秒、cycle = 何周目の発動で違反したか（0 = 1周目） */
  onViolation: (remaining: number, cycle: number) => void;
}

export const CT_TOLERANCE_SEC = 0.05;

/**
 * CT違反をまとめて判定する（1周目と2周目を1本の時間軸に並べ、同じ CT を共有する発動を時刻順に見ていく）。
 * - ループ区間（loopStartIndex 番目以降の出場）の発動は、1周目と、loopPeriod ずらした2周目に並べる
 * - 初動部分（ループ区間より前）の発動は1回だけ
 * 3周目以降は、各発動の直前にある同じ CT の発動が2周目と同じ（1周前の同じ位置）になるため、2周分の判定で足りる。
 * どちらの周で違反しても、元の発動に違反の印を付ける。
 */
export function checkCooldownViolations(events: CooldownEvent[], loopStartIndex: number, loopPeriod: number, isActiveAt: (charId: string, t: number) => boolean, procsOut?: SacrificialProc[], stockOut?: StockLog[], optionalUsedOut?: Set<string>): CooldownSpan[] {
  const extraCycles = loopPeriod > 0.05 ? 1 : 0;

  const timeline: Array<{ event: CooldownEvent; time: number; cycle: number; order: number }> = [];
  events.forEach((event, order) => {
    const repeats = event.stintIndex >= loopStartIndex ? extraCycles : 0;
    for (let cycle = 0; cycle <= repeats; cycle++) {
      timeline.push({ event, time: event.time + cycle * loopPeriod, cycle, order });
    }
  });
  timeline.sort((a, b) => a.time - b.time || a.order - b.order);

  // CT枠ごとの、チャージごとの CT の終わり（チャージが 1 つの枠は、要素 1 つ）。チャージは順番に回復する（gcsim の cooldown_queue）
  // ファルカの特殊スキル（startsAll の発動を見た枠）は、gcsim と同じキュー（CooldownQueue）で持つ
  interface QueueTag { actionId: string; cycle: number }
  const queues = new Map<string, CooldownQueue<QueueTag>>();
  // 八重神子の殺生桜（枠のキー → 消える時刻の一覧）、ヴァレサの夜魂値（キャラ ID → 状態）
  const totems = new Map<string, TotemTracker>();
  // 祭礼の武器の内部 CT が明ける時刻（キャラ ID → 時刻）
  const sacrificialIcdUntil = new Map<string, number>();
  // 使い直しの CT リセット（凝光）: 枠のキー → 前の発動の時刻・前のリセットの時刻
  const recastStates = new Map<string, { lastCast: number; lastReset: number }>();
  const nightsouls = new Map<string, NightsoulTracker>();
  // キューで CT が始まった（先頭になった）1 周目の発動の分は、その時点でバーを作る。終わりは、後の短縮で動くので、最後に確定する
  const queuedSpans: Array<{ span: CooldownSpan; head: QueueHead<QueueTag> }> = [];
  const stockLogs = new Map<string, StockLog>();
  const cooldownEnd = new Map<string, number[]>();
  // CT のキューを作る。キューで CT が始まった時点に、バー（1 周目の分だけ）を作る。バーの種類は、枠のキー（`キャラ:special` / `キャラ:skill`）で決まる
  const makeQueue = (ev: CooldownEvent, charges: number) => {
    // 回数が 2 以上の通常のスキルは、ストック数の変化（積まれている CT の数）を記録する
    const [stockCharId, stockKind] = ev.key.split(':');
    let log: StockLog | undefined;
    if (stockOut && stockKind === 'skill' && charges > 1) {
      log = { charId: stockCharId, max: charges, points: [] };
      stockOut.push(log);
      stockLogs.set(ev.key, log);
    }
    return new CooldownQueue<QueueTag>(charges, startedHead => onQueueStart(ev, startedHead), 0.001, log ? (t, size) => log!.points.push([t, size]) : undefined);
  };
  const onQueueStart = (ev: CooldownEvent, head: QueueHead<QueueTag>) => {
    if (!head.tag || head.tag.cycle !== 0) return;
    const [barCharId, kind] = ev.key.split(':');
    const type = kind === 'special' ? 'special' : 'skill';
    const span: CooldownSpan = {
      id: `cd_${type}_${barCharId}_${head.tag.actionId}_${queuedSpans.length}`,
      characterId: barCharId,
      type,
      startTime: head.start,
      endTime: head.end,
      duration: head.end - head.start,
      baseDuration: head.end - head.start,
      actionInstanceId: head.tag.actionId,
    };
    queuedSpans.push({ span, head });
  };
  for (const item of timeline) {
    const slots = cooldownEnd.get(item.event.key) ?? [];
    const charges = Math.max(1, item.event.charges ?? 1);
    while (slots.length < charges) slots.push(-Infinity);
    cooldownEnd.set(item.event.key, slots);
    const ev = item.event;
    let queue = queues.get(item.event.key);
    queue?.advance(item.time);
    const charId = ev.key.split(':')[0];
    // 祭礼の武器: スキルのダメージが当たった。使用者が場にいて、スキルが CT 中（先頭の CT がもう始まっている）で、武器の内部 CT が明けていれば、先頭の CT を捨てる（gcsim の ResetActionCooldown）。
    // スキルを使った時点で CT は積んであるが、CT が始まるのは少し後（CT 開始位置）。始まる前の命中では、gcsim の Cooldown が 0 なので、発動しない
    if (ev.sacrificial) {
      if (queue?.head && item.time >= queue.head.start - 1e-6 && isActiveAt(charId, ev.time) && item.time >= (sacrificialIcdUntil.get(charId) ?? -Infinity) - 1e-9) {
        queue.release(item.time);
        sacrificialIcdUntil.set(charId, item.time + ev.sacrificial.icdSeconds);
        procsOut?.push({ charId, actionId: ev.actionId ?? '', hitFrame: ev.sacrificial.hitFrame, cycle: item.cycle, time: Number(item.time.toFixed(3)), icdSeconds: ev.sacrificial.icdSeconds });
      }
      continue;
    }
    // 夜魂値（ヴァレサ）: 落下攻撃・爆発（nightsoulTracker.ts）。猛烈パッション中の落下攻撃は夜魂を使い切って終わる。満タンなら猛烈パッションに入り、次のスキルが無料になる
    if (ev.nightsoul && ev.nightsoul.role !== 'skill') {
      const tracker = nightsouls.get(charId) ?? new NightsoulTracker();
      nightsouls.set(charId, tracker);
      if (ev.nightsoul.role === 'plunge') tracker.plunge(item.time, ev.nightsoul.gain, ev.nightsoul.max, ev.nightsoul.blessingSeconds);
      else tracker.burst(item.time, ev.nightsoul.gain, ev.nightsoul.max, ev.nightsoul.blessingSeconds);
      continue;
    }
    // 八重神子の爆発: 場の殺生桜 1 つにつき、スキルの先頭の CT を解放する
    if (ev.releasesPerTotem) {
      const present = totems.get(ev.key)?.burst(item.time, !ev.releasesPerTotem.revelation) ?? [];
      for (let i = 0; i < present.length; i++) queue?.release(item.time);
      continue;
    }
    // 八重神子のスキル: 殺生桜が 1 つ増える（上限を超えたら最古が消える）
    if (ev.spawnsTotem) {
      const tracker = totems.get(ev.key) ?? new TotemTracker();
      totems.set(ev.key, tracker);
      tracker.spawn(item.time + ev.spawnsTotem.delay, ev.spawnsTotem.lifetime, ev.spawnsTotem.max, undefined);
    }
    // ヴァレサのスキル: 夜魂 +20。猛烈パッション中の最初のスキルは無料（回数も CT も使わない）
    if (ev.nightsoul?.role === 'skill') {
      const tracker = nightsouls.get(charId) ?? new NightsoulTracker();
      nightsouls.set(charId, tracker);
      if (tracker.useSkill(item.time, ev.nightsoul.gain, ev.nightsoul.max)) continue;
    }
    if (ev.reduceBy && ev.reduceBy > 0) {
      if (queue) {
        queue.reduce(item.time, ev.reduceBy);
      } else {
        // キュー方式: CT 中のものの終わりを、短縮する（後ろの回の CT も同じだけ早まる）
        for (let i = 0; i < slots.length; i++) if (slots[i] > item.time) slots[i] = Math.max(item.time, slots[i] - ev.reduceBy);
      }
      continue;
    }
    const startAt = item.time + ev.ctOffset;
    if (ev.startsAll) {
      // スキルを使うと、全回数分の CT が積まれる（1 つ目はスキルの時刻から、2 つ目以降は前の CT が明けてから）。それまでの CT は捨てる
      const q = queue ?? makeQueue(ev, charges);
      const tag: QueueTag = { actionId: ev.actionId ?? '', cycle: item.cycle };
      q.reset(startAt, ev.cooldown > 0 ? Array.from({ length: charges }, () => ({ duration: ev.cooldown, tag })) : [], ev.window ? ev.window.effectiveEnd ?? ev.window.until : Infinity);
      queues.set(item.event.key, q);
      continue;
    }
    // 複数回分の通常のスキル（クレー・魈・八重神子など）も、gcsim と同じキューで持つ
    if (!queue && (charges > 1 || ev.forceQueue) && !ev.optional && ev.cooldown > 0) {
      queue = makeQueue(ev, charges);
      queues.set(item.event.key, queue);
    }
    if (queue) {
      let violated = false;
      if (ev.optional) {
        // 受付の間の重撃: 回数に空きがあれば特殊重撃になって 1 回分使う。空いていなければ普通の重撃（違反ではない）
        if (!queue.hasFree) continue;
        if (item.cycle === 0 && ev.actionId) optionalUsedOut?.add(ev.actionId);
      } else if (ev.checked && !queue.hasFree && queue.head) {
        violated = true;
        ev.onViolation(Number((queue.head.end - item.time).toFixed(1)), item.cycle);
      }
      // 使うと、新しい CT がキューの末尾に積まれる（キューが空なら、すぐ始まる）
      queue.push(startAt, ev.cooldown, { actionId: ev.actionId ?? '', cycle: item.cycle });
      stockLogs.get(item.event.key)?.points.push([item.time, queue.size]);
      // 光幕が残っている間の使い直し（置き換えで破裂）: 積んだ CT をすぐリセットする（6 秒に 1 回まで）。CT 違反の発動は、gcsim では実行されないので数えない
      if (ev.recastReset && !violated) {
        const st = recastStates.get(item.event.key) ?? { lastCast: -Infinity, lastReset: -Infinity };
        const alive = item.time < st.lastCast + ev.recastReset.lifetime - 1e-6;
        if (alive && item.time >= st.lastReset + ev.recastReset.icdSeconds - 1e-6) {
          queue.release(item.time);
          st.lastReset = item.time;
        }
        st.lastCast = item.time;
        recastStates.set(item.event.key, st);
      }
      continue;
    }
    // キューの無い枠（スキルより前など）の、受付の間の重撃は、何もしない
    if (ev.optional) continue;
    // 一番早く明けるチャージを使う。どのチャージも CT 中なら違反
    let idx = 0;
    for (let i = 1; i < slots.length; i++) if (slots[i] < slots[idx]) idx = i;
    if (ev.checked && slots[idx] > item.time + CT_TOLERANCE_SEC) {
      ev.onViolation(Number((slots[idx] - item.time).toFixed(1)), item.cycle);
    }
    if (ev.cooldown > 0) {
      // 回復の開始 = 使った時刻と、他のチャージの回復の終わり（キューの末尾）の遅いほう
      const tail = slots.reduce((m, e, i) => (i !== idx && e > item.time ? Math.max(m, e) : m), -Infinity);
      slots[idx] = Math.max(startAt, tail) + ev.cooldown;
    }
  }

  // 待機中のまま残った CT を、始まる位置まで進めてから、バーの位置を確定する
  for (const q of queues.values()) q.drain();
  // 解放（八重神子の爆発）で、始まった直後に捨てられた CT（長さ 0）のバーは出さない
  return queuedSpans.filter(({ head }) => head.end - head.start > 0.001).map(({ span, head }) => ({
    ...span,
    startTime: Number(head.start.toFixed(3)),
    endTime: Number(head.end.toFixed(3)),
    duration: Number((head.end - head.start).toFixed(3)),
  }));
}
