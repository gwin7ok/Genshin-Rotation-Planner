/**
 * ER 計算の、エネルギーの時系列の補正（フェーズ8 / D371）。gcsim の実行では表せないものを、アプリ側で時系列に足し引きする。
 *
 * 1. **時刻指定の粒子の書き足し**: gcsim は `energy` の行を、最後の 1 行しか使わない（D369）。
 *    gcsim に渡せない時刻指定の粒子（2 件以上・敵の周期の粒子との併用）は、アプリが、各キャラの時系列に粒子として書き足す
 *    （出場中のキャラは満額、控えは gcsim と同じ割合で減らす。ER は、求める ER の倍率として、あとから掛かる）。
 * 2. **ダメージ無効の間の補正**: 無効の時間帯には、「ダメージが入ることが条件」の発生源（西風・クレー・鶴の鳴きなど）のエネルギーが入らない
 *    （ユーザーの確認 2026-11-19。docs/gcsim-integration/phase-8-abyss-mode/gcsim-幽境機能の有無と粒子の発生源.md の 3-3b）。
 *    gcsim はダメージ無効を知らず、それらのエネルギーを入れて実行するので、時系列から取り除く。
 *
 * どちらも、ログに残った時系列の加工だけ（gcsim の実行は変えない）。そのため、補正をしたときは、gcsim で最後に確かめる実行（検証）はしない
 * （検証の実行には、書き足した粒子が入らず、取り除いたエネルギーが入るので、結果が食い違うため）。
 */
import type { GcsimLogEvent } from './gcsimClient';
import type { EnergyTimeline, InvulnerableWindow, TimedParticle } from './requiredEnergyRecharge';

/** 敵の周期の粒子（`energy every`）が有効か（個数・間隔が有効なとき） */
export const periodicParticlesOn = (p: { amount: number; maxSeconds: number } | undefined): boolean => !!p && p.amount > 0 && p.maxSeconds > 0;

/**
 * 時刻指定の粒子を、gcsim に渡す分と、アプリが ER の時系列に書き足す分に分ける。
 * gcsim が使える `energy` の行は 1 行だけなので:
 * - 敵の周期の粒子が無効で、時刻指定の粒子が 1 件だけ: その 1 件を gcsim に渡す（gcsim が正確に扱う。書き足し不要）
 * - それ以外（2 件以上、または、敵の周期の粒子と併用）: gcsim には敵の周期の粒子だけ渡し（乱数で、種ごとに違うため）、時刻指定の粒子は全部書き足す
 */
export function splitTimedParticles(timed: TimedParticle[], periodicOn: boolean): { toGcsim: TimedParticle[]; injected: TimedParticle[] } {
  if (timed.length === 0) return { toGcsim: [], injected: [] };
  if (!periodicOn && timed.length === 1) return { toGcsim: timed.map(p => ({ ...p })), injected: [] };
  return { toGcsim: [], injected: timed.map(p => ({ ...p })) };
}

/** 秒 → フレーム（gcsim に渡す `interval` と同じ。1 フレーム未満にならない） */
const toFrame = (seconds: number): number => Math.max(1, Math.round(seconds * 60));
/** gcsim は、`energy once interval=N` の粒子を、N の次のフレームに配る（実測 2026-11-19: interval=600 → フレーム 601） */
export const TIMED_PARTICLE_FRAME_OFFSET = 1;
/** gcsim の粒子の控えの減り方: 1 − 0.1 × 編成の人数（`pkg/core/player/player.go`・`character/energy.go`）。クリア粒子の基礎量は 2 */
export const CLEAR_PARTICLE_BASE_ENERGY = 2;
export const benchFactor = (partyCount: number): number => Math.max(0, 1 - 0.1 * partyCount);

/**
 * ダメージが入ることが条件の発生源（ログの `source`）。ダメージ無効の間は出ない（ユーザーの確認。3-3b）。
 * - 粒子: 西風系（`favonius-<キャラ>`）・ディシアのスキルの粒子（`dehya`。ディシアの粒子は、このスキルのダメージだけ）
 * - 固定のエネルギー: アルベド C1・クレー固有天賦 4・ロサリア C4・鶴の鳴き（`crane`）・月光（`moonglow`）・桂木斬長正（`nagamasa`）・`kitain`・
 *   ルミドゥ（`lumidouceelegy-energy`）・旅人（氷）C1・ミカ C4
 * スカークの粒子（`skirk`）は、確認が済むまで入れない（出る扱い）
 */
const DAMAGE_CONDITIONAL_SOURCES: ReadonlySet<string> = new Set([
  'dehya', 'albedo-c1', 'klee-a4', 'rosaria-c4', 'crane', 'moonglow', 'nagamasa', 'kitain', 'lumidouceelegy-energy', 'travelercryo-c1', 'mika-c4',
]);
/** 桂木斬長正・`kitain`: スキルのダメージで 3 を失い（負の回復）、そのあと 3 回（2 秒ごと）回復する。失う分が取り除かれたら、そのあとの 3 回も取り除く */
const CHAINED_SOURCES: ReadonlyMap<string, number> = new Map([['nagamasa', 3], ['kitain', 3]]);

export const isDamageConditionalSource = (source: string | undefined): boolean => source !== undefined && (source.startsWith('favonius-') || DAMAGE_CONDITIONAL_SOURCES.has(source));

/** ログの、キャラの交代（`executed swap`）。char_index は、交代後の出場キャラ */
export function readSwaps(logs: GcsimLogEvent[]): { frame: number; index: number }[] {
  const out: { frame: number; index: number }[] = [];
  for (const l of logs) {
    if (l.msg === 'executed swap' && l.char_index !== undefined) out.push({ frame: Number(l.frame), index: l.char_index });
  }
  return out;
}

/** あるフレームに出場しているキャラ（そのフレームまでの最後の交代。無ければ最初のキャラ） */
export function activeCharAt(swaps: { frame: number; index: number }[], firstActive: number, frame: number): number {
  let active = firstActive;
  for (const s of swaps) {
    if (s.frame <= frame) active = s.index; else break;
  }
  return active;
}

/** 時間帯 [開始, 終了) のフレーム（`makeDamageFactor` と同じ丸め） */
const windowFrames = (w: InvulnerableWindow): [number, number] => [Math.round(w.fromSeconds * 60), Math.round(w.toSeconds * 60)];

export interface AdjustOptions {
  /** gcsim に渡せず、アプリが書き足す時刻指定の粒子 */
  injected: TimedParticle[];
  /** ダメージ無効の時間帯 */
  invulnerable: InvulnerableWindow[];
  /** 編成の人数（控えの減り方に使う） */
  partyCount: number;
  /** 最初の出場キャラ（char_index） */
  firstActive: number;
}

/** 補正が要るか（要らなければ、時系列をそのまま使い、検証もできる） */
export const needsAdjust = (injected: TimedParticle[], invulnerable: InvulnerableWindow[] | undefined): boolean => injected.length > 0 || (invulnerable?.length ?? 0) > 0;

/**
 * 1 回の実行（logs）の時系列を補正する。元の時系列は変えない。
 * 1. ダメージ無効の時間帯にある、ダメージが条件の発生源のエネルギー・粒子を取り除く
 * 2. 時刻指定の粒子を、その時刻の出場キャラに満額、控えに減らして、粒子として書き足す
 */
export function adjustTimelines(tls: Map<number, EnergyTimeline>, logs: GcsimLogEvent[], opts: AdjustOptions): Map<number, EnergyTimeline> {
  const windows = opts.invulnerable.map(windowFrames).filter(([a, b]) => b > a);
  const inWindow = (frame: number) => windows.some(([a, b]) => frame >= a && frame < b);
  const swaps = opts.injected.length > 0 ? readSwaps(logs) : [];
  const out = new Map<number, EnergyTimeline>();
  for (const [idx, tl] of tls) {
    // 1. 取り除く
    const chain = new Map<string, number>(); // 連鎖の発生源 → 取り除く残りの回復の回数
    const events: EnergyTimeline['events'] = [];
    for (const ev of tl.events) {
      if ((ev.kind === 'particle' || ev.kind === 'flat') && isDamageConditionalSource(ev.source)) {
        const src = ev.source!;
        const chainLen = CHAINED_SOURCES.get(src);
        if (chainLen !== undefined && ev.kind === 'flat') {
          if (ev.amount < 0) {
            // 失う分（スキルのダメージ）。時間帯の中なら、これと、そのあとの回復を取り除く
            if (inWindow(ev.frame)) { chain.set(src, chainLen); continue; }
            chain.delete(src);
          } else if ((chain.get(src) ?? 0) > 0) {
            chain.set(src, chain.get(src)! - 1);
            continue;
          }
          events.push(ev);
          continue;
        }
        if (inWindow(ev.frame)) continue;
      }
      events.push(ev);
    }
    out.set(idx, { max: tl.max, events });
  }
  // 2. 書き足す（時刻の順。同じフレームのイベントのあとに入れる）
  for (const p of [...opts.injected].sort((a, b) => a.seconds - b.seconds)) {
    const frame = toFrame(p.seconds) + TIMED_PARTICLE_FRAME_OFFSET;
    const active = activeCharAt(swaps, opts.firstActive, frame);
    for (const [idx, tl] of out) {
      const raw = CLEAR_PARTICLE_BASE_ENERGY * p.amount * (idx === active ? 1 : benchFactor(opts.partyCount));
      if (raw <= 0) continue;
      let at = tl.events.length;
      while (at > 0 && tl.events[at - 1].frame > frame) at--;
      tl.events.splice(at, 0, { kind: 'particle', raw, frame, source: 'timed-injected' });
    }
  }
  return out;
}
