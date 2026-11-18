/**
 * CT バーにマウスを乗せたときの「CT 残り秒数」（issue #51）。
 *
 * ゲーム画面の CT の表示に合わせて、小数第 1 位までを、切り下げて出す。
 * ゲームは、CT の開始の直後の表示が、必ず ?.9（10 秒の CT なら 9.9）から始まる（ユーザーが確認。2026-11-18）。
 * これは、開始から 1 フレーム進んだ残り（9.98…）を、切り下げた値。そこで、その時刻の「直後」の残りを切り下げて出す。
 * （残りがちょうど 0.1 の倍数のときだけ、1 つ下がる。CT の開始の時刻に乗せたときも、?.9 から始まるようにするため）
 *
 * 画面の部品（GanttChart）は、CT バーの終わりの時刻（data-ct-end）と、マウスの位置の時刻から、ここで文字を作る。
 */

/** 浮動小数点の誤差を吸収する大きさ（残りは 0.01 秒単位。10 倍した値が整数のときだけ、境目になる） */
const CT_REMAINING_EPSILON = 1e-6;

/** 残りを、0.1 秒を 1 とした整数で返す（切り下げ。0 より小さくならない） */
export function ctRemainingTenths(endTime: number, now: number): number {
  const remaining = endTime - now;
  return Math.max(0, Math.ceil(remaining * 10 - CT_REMAINING_EPSILON) - 1);
}

/** 画面に出す文字（秒。小数第 1 位まで。例: "9.9"） */
export function formatCtRemaining(endTime: number, now: number): string {
  return (ctRemainingTenths(endTime, now) / 10).toFixed(1);
}
