/**
 * 夜魂値で無料のスキルが出るキャラ（ヴァレサ）の状態。gcsim の varesa/varesa.go・skill.go・plunge.go・burst.go と同じ規則。
 * - スキル: 夜魂 +gain。猛烈パッション中で、無料の権利があれば、その 1 回は無料（回数も CT も使わない）
 * - 落下攻撃: 猛烈パッション中なら、夜魂を使い切って終わる。そうでなければ +gain して、最大に達したら猛烈パッション（blessingSeconds）に入り、次のスキルが無料になる
 * - 爆発: 夜魂が満タンになり（猛烈パッション中でなければ、落下攻撃と同じく猛烈パッションに入る）
 * 夜魂値は、猛烈パッションが時間で切れても減らない（落下攻撃で使い切るまで残る）。
 * CT の検査（周をまたいで時刻順に見る）と、マキシマムドライブの受付（1 周目の線形の計算）の両方で使う。
 */
export class NightsoulTracker {
  points = 0;
  blessingEnd = -Infinity;
  freeAvail = false;

  inBlessing(t: number): boolean {
    return t < this.blessingEnd;
  }

  /** スキル。無料のスキルなら true（権利を使う） */
  useSkill(t: number, gain: number, max: number): boolean {
    const free = this.freeAvail && this.inBlessing(t);
    if (free) this.freeAvail = false;
    this.points = Math.min(max, this.points + gain);
    return free;
  }

  /** 落下攻撃。猛烈パッション中の落下攻撃は、夜魂を使い切って終わる */
  plunge(t: number, gain: number, max: number, blessingSeconds: number): void {
    if (this.inBlessing(t)) {
      this.points = 0;
      this.blessingEnd = -Infinity;
      this.freeAvail = false;
      return;
    }
    this.points = Math.min(max, this.points + gain);
    if (this.points >= max) {
      this.blessingEnd = t + blessingSeconds;
      this.freeAvail = true;
    }
  }

  /** 爆発。夜魂が満タンになり、猛烈パッション中でなければ入る */
  burst(t: number, gain: number, max: number, blessingSeconds: number): void {
    this.points = max;
    if (!this.inBlessing(t)) {
      this.points = Math.min(max, this.points + gain);
      if (this.points >= max) {
        this.blessingEnd = t + blessingSeconds;
        this.freeAvail = true;
      }
    }
  }
}
