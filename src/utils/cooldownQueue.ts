/**
 * 複数回分の CT を順番に回復するキュー（gcsim の `cdQueue`。internal/template/character/cooldown.go と同じ形）。
 * - 先頭の CT だけが時間で減る。2 つ目以降は待機中で、先頭が明けた時点から満額で始まる
 * - 通常攻撃などによる短縮は、先頭だけに効く。先頭の残りより大きい分は捨てる（超過分は次の CT に回らない）
 * - 使うと、新しい CT がキューの末尾に積まれる（キューが空なら、すぐ先頭として始まる）
 * 判定（CT違反）とバー表示の両方で使う。時刻は、呼び出し側が時刻順に渡す。
 */
export interface QueueHead<T> {
  start: number;
  end: number;
  tag?: T;
}

export class CooldownQueue<T = undefined> {
  /** 今動いている先頭の CT（無ければ undefined） */
  head: QueueHead<T> | undefined;
  /** 待機中の CT（先頭の次から。長さだけを持つ） */
  private waiting: { duration: number; tag?: T }[] = [];
  /** これより後に始まる待機中の CT は、積まない（ファルカ: 疾風怒濤が終わった後に始まる CT）。既定は制限なし */
  private limit = Infinity;

  /** 同時に持てる回数（これだけ CT が積まれていたら、使えない） */
  readonly charges: number;
  /** CT が先頭になった（始まった）ときに呼ぶ。バーの位置の確定に使う */
  private readonly onStart: ((head: QueueHead<T>) => void) | undefined;
  /** 明けた誤差（秒） */
  private readonly tolerance: number;

  /** 積まれている CT の数が変わったときに呼ぶ（先頭が明けた・解放した）。使った（push）ときは呼ばない（使った時刻は、呼び出し側が知っている） */
  private readonly onSize: ((t: number, size: number) => void) | undefined;

  constructor(charges: number, onStart?: (head: QueueHead<T>) => void, tolerance = 0.001, onSize?: (t: number, size: number) => void) {
    this.charges = charges;
    this.onStart = onStart;
    this.tolerance = tolerance;
    this.onSize = onSize;
  }

  /** 積まれている CT の数（先頭を含む） */
  get size(): number {
    return (this.head ? 1 : 0) + this.waiting.length;
  }

  /** 回数に空きがある（今使える）か */
  get hasFree(): boolean {
    return this.size < this.charges;
  }

  private start(start: number, duration: number, tag?: T): void {
    this.head = { start, end: start + duration, tag };
    this.onStart?.(this.head);
  }

  /** 時刻 t までに明けた先頭を外し、次を、その終点から満額で始める（続けて明けているものも） */
  advance(t: number): void {
    while (this.head && this.head.end <= t + this.tolerance) {
      const endedAt = this.head.end;
      this.head = undefined;
      // 始まる時刻が制限を過ぎていたら、待機中の CT は積まない
      if (endedAt > this.limit + this.tolerance) this.waiting = [];
      const next = this.waiting.shift();
      if (next) this.start(endedAt, next.duration, next.tag);
      this.onSize?.(endedAt, this.size);
    }
  }

  /** 先頭を除く、積まれている CT を全部明けた時刻まで進めて、バーの位置を確定する */
  drain(): void {
    this.advance(Infinity);
  }

  /** 積まれている CT を捨てて、全回数分を積み直す（スキルを使うと、全回数分の CT が始まる） */
  reset(start: number, durations: { duration: number; tag?: T }[], limit = Infinity): void {
    // 捨てる先頭の CT は、ここで終わる（バーを、積み直しの時刻で切る）
    if (this.head) this.head.end = Math.min(this.head.end, start);
    this.head = undefined;
    this.waiting = [];
    this.limit = limit;
    durations.forEach((d, i) => {
      if (i === 0) this.start(start, d.duration, d.tag);
      else this.waiting.push(d);
    });
  }

  /** 使った。新しい CT を末尾に積む（キューが空なら、start から始まる） */
  push(start: number, duration: number, tag?: T): void {
    if (!this.head) this.start(start, duration, tag);
    else this.waiting.push({ duration, tag });
  }

  /** 先頭を捨てて、回数を 1 つ戻す（gcsim の ResetActionCooldown）。次の CT は、t から満額で始まる。何も積まれていなければ何もしない。解放の前に advance(t) しておくこと */
  release(t: number): void {
    if (!this.head) return;
    this.head.end = Math.min(this.head.end, t);
    this.head = undefined;
    const next = this.waiting.shift();
    if (next) this.start(t, next.duration, next.tag);
    this.onSize?.(t, this.size);
  }

  /** 先頭を、amount 秒短縮する（先頭の残りまで。超過分は捨てる）。短縮の前に advance(t) しておくこと */
  reduce(t: number, amount: number): void {
    if (!this.head) return;
    this.head.end = Math.max(t, this.head.end - amount);
  }
}
