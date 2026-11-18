/**
 * CT バーにマウスを乗せたときの「CT 残り秒数」（src/utils/ctRemaining.ts。issue #51）の確認。
 *
 *   npm run check:ct-remaining
 *
 * 確かめること:
 *   1. ゲームに合わせた表示: CT の開始の直後が、必ず ?.9 から始まる（10 秒 → 9.9。12 秒 → 11.9）。切り下げ（小数第 1 位）
 *   2. 終わり: 残りが 0 以下のときも、0.0 より小さくならない
 *   3. 並び: 時間が進むと、表示は減るだけで、増えない。0.1 秒ずつ進むと、表示も 0.1 ずつ減る
 *   4. ガントの目印（data-ct-end）が、CT バー（スキル・特殊スキル・爆発・発動バフ）に付いている
 * 画面は使わない（ネットワークも使わない）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ctRemainingTenths, formatCtRemaining } from '../src/utils/ctRemaining.ts';

let passed = 0;
const check = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  OK  ${name}`);
  } catch (e) {
    console.error(`  NG  ${name}\n      ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

console.log('ゲームに合わせた表示（開始の直後は ?.9 から）');
check('CT の開始の時刻に乗せたとき: 10 秒 → 9.9、12 秒 → 11.9、20 秒 → 19.9', () => {
  assert.equal(formatCtRemaining(10, 0), '9.9');
  assert.equal(formatCtRemaining(12, 0), '11.9');
  assert.equal(formatCtRemaining(20, 0), '19.9');
});
check('開始から 1 フレーム（約 0.017 秒）進んだ残り 9.983 秒も、9.9', () => {
  assert.equal(formatCtRemaining(10, 0.017), '9.9');
});
check('開始の時刻が小数でも同じ: 3.27 秒に始まる 10 秒の CT は、3.27 で 9.9', () => {
  assert.equal(formatCtRemaining(13.27, 3.27), '9.9');
});
check('切り下げ: 残り 9.91 → 9.9、9.89 → 9.8、7.49 → 7.4、7.51 → 7.5', () => {
  assert.equal(formatCtRemaining(10, 0.09), '9.9');
  assert.equal(formatCtRemaining(10, 0.11), '9.8');
  assert.equal(formatCtRemaining(10, 2.51), '7.4');
  assert.equal(formatCtRemaining(10, 2.49), '7.5');
});
check('0.1 秒単位の CT（7.5 秒）の開始の直後は、7.4（1 フレーム進んだ残り 7.483 の切り下げ）', () => {
  assert.equal(formatCtRemaining(7.5, 0), '7.4');
});
check('残りがちょうど 0.1 の倍数のときは、直後の値（1 つ下）: 残り 5.0 → 4.9', () => {
  assert.equal(formatCtRemaining(10, 5), '4.9');
});
check('時刻・終わりの浮動小数点の誤差に左右されない: 10.000000000001 秒でも 9.9', () => {
  assert.equal(formatCtRemaining(10.000000000001, 0), '9.9');
  assert.equal(formatCtRemaining(9.999999999999, 0), '9.9');
});

console.log('終わり');
check('残りが 0.1 未満・0・マイナスのときは、0.0', () => {
  assert.equal(formatCtRemaining(10, 9.95), '0.0');
  assert.equal(formatCtRemaining(10, 10), '0.0');
  assert.equal(formatCtRemaining(10, 11), '0.0');
  assert.equal(ctRemainingTenths(10, 11), 0);
});

console.log('並び');
check('0.01 秒ずつ進めると、表示（0.1 秒単位）は減るだけで、増えない', () => {
  let prev = Infinity;
  for (let i = 0; i <= 1100; i++) {
    const now = i / 100;
    const tenths = ctRemainingTenths(10, now);
    assert.ok(tenths <= prev, `${now}s で ${prev} → ${tenths}`);
    prev = tenths;
  }
});
check('0.1 秒ずつ進めると、表示も 0.1 ずつ減る（飛ばない・止まらない）', () => {
  for (let i = 0; i < 99; i++) { // 残り 0.1 秒（9.9s）で 0.0 になり、そのあとは 0.0 のまま
    const a = ctRemainingTenths(10, i / 10);
    const b = ctRemainingTenths(10, (i + 1) / 10);
    assert.equal(a - b, 1, `${i / 10}s → ${(i + 1) / 10}s で ${a} → ${b}`);
  }
});
check('どの 0.1 秒単位の CT でも、開始の直後は「CT − 0.1」', () => {
  for (let k = 1; k <= 300; k++) {
    assert.equal(ctRemainingTenths(k / 10, 0), k - 1, `${k / 10}s`);
  }
});

console.log('ガントの目印');
const gantt = readFileSync(new URL('../src/components/GanttChart.tsx', import.meta.url), 'utf8');
const ganttHas = (text: string, min = 1) => {
  const count = gantt.split(text).length - 1;
  assert.ok(count >= min, `${text} の数: ${count}（${min} 以上のはず）`);
};
check('スキル・特殊スキル・爆発の CT バー（持ち越しを含む）に、data-ct-end={cd.endTime} が付いている', () => {
  ganttHas('data-ct-end={isBarActive ? cd.endTime : undefined}', 3);
});
check('発動バフの CT バー（持ち越し・通常）に、data-ct-end が付いている', () => {
  ganttHas('data-ct-end={isBarActive ? cdEnd : undefined}', 1);
  ganttHas('data-ct-end={isPending ? undefined : start + p.cooldown}', 1);
});
check('マウスの位置から、CT バーの目印を読んで、formatCtRemaining で文字にしている', () => {
  ganttHas("'[data-ct-end]'", 1);
  ganttHas('formatCtRemaining(', 1);
});

console.log(`\n${passed} 件の確認が通りました`);
