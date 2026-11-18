/**
 * CT 違反・CT 警告の印の一覧と、ヘッダーの ▲▼ の「前・次」の選び方（src/utils/ctMarks.ts。issue #57）の確認。
 *
 *   npm run check:ct-marks
 *
 * 確かめること:
 *   1. 件数: 一覧の件数が、これまでヘッダーで数えていた式（アクションの印・発動バフの印・検証メッセージ）と、必ず同じになる
 *   2. 並び: 出場ブロックの順（ガントの上から下）、同じ出場の中は時刻の順。入力の並びに左右されない
 *   3. 前・次: 最初の ▼ は先頭、最初の ▲ は末尾、端では反対側へ回る。印が無くなったあとも、続けられる
 *   4. ガントの目印（data-ct-target）が、一覧の移動先と同じ書き方で、ガントのバーに付いている
 * 画面は使わない（ネットワークも使わない）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PassiveSpan, Stint, ValidationIssue } from '../src/types/genshin.ts';
import { buildCtMarks, CT_WARNING_ISSUE_PATTERN, ctActionTarget, ctMarkPosition, ctPassiveTarget, ctTargetKey, stepCtMark, type CtMark } from '../src/utils/ctMarks.ts';

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

const act = (id: string, extra: Record<string, unknown> = {}) => ({ id, type: 'skill', startTime: 0, ...extra });
const stint = (id: string, actions: Array<Record<string, unknown>>) => ({ id, actions }) as unknown as Stint;
const passive = (id: string, stintId: string, startTime: number, hasCTViolation: boolean) => ({ id, stintId, startTime, hasCTViolation }) as unknown as PassiveSpan;
const issue = (id: string, stintId: string | undefined, time: number, actionId?: string) => ({ id, severity: 'warning', stintId, actionId, time, title: '', message: '' }) as ValidationIssue;

// 3 つの出場ブロック。s1: a1（違反）・a2。s2: a3（違反だが gcsim で確認済み）・a4（違反）。s3: a5（違反）
const stints = [
  stint('s1', [act('a1', { hasCTCollision: true, startTime: 4 }), act('a2', { startTime: 3 })]),
  stint('s2', [act('a3', { hasCTCollision: true, ctGcsimVerified: true, startTime: 11 }), act('a4', { hasCTCollision: true, startTime: 15 })]),
  stint('s3', [act('a5', { hasCTCollision: true, startTime: 21 })]),
];
const passives = [
  passive('p1', 's2', 12, true), // 警告（s2）
  passive('p2', 's1', 5, false), // 印なし
  passive('p3', 's3', 20.5, true), // 警告（s3）
];
const issues = [
  issue('special_window_a2', 's1', 3, 'a2'),
  issue('mode_blocks_s2_x', 's2', 10), // 出場ブロック全体の警告（アクションなし）
  issue('plunge_prereq_a4', 's2', 15, 'a4'),
  issue('gcsim_unsupported_a5', 's3', 21, 'a5'),
  issue('mode_blocked_a2', 's1', 2, 'a2'),
  issue('passive_ct_t1', 's2', 12), // 発動バフは、PassiveSpan の印で数える（二重に数えない）
  issue('skill_ct_a1', 's1', 4, 'a1'), // 違反は、アクションの印で数える
  issue('nightsoul_burst_ct_x', 's2', 13), // ヘッダーの件数に入らない警告
];

console.log('一覧の件数と並び');
const marks = buildCtMarks(stints, passives, issues);

check('違反: 確認済み（a3）を除いて、上から下・時刻の順（a1, a4, a5）', () => {
  assert.deepEqual(marks.violations.map(m => m.actionId), ['a1', 'a4', 'a5']);
  assert.ok(marks.violations.every(m => m.kind === 'violation'));
});

check('警告: s1（mode_blocked 2 秒 → special_window 3 秒）、s2（mode_blocks 10 秒 → 発動バフ 12 秒 → 落下攻撃 15 秒）、s3（発動バフ 20.5 秒 → gcsim 未対応 21 秒）', () => {
  assert.deepEqual(marks.warnings.map(m => m.id), [
    'w:mode_blocked_a2', 'w:special_window_a2',
    'w:mode_blocks_s2_x', 'w:passive:p1', 'w:plunge_prereq_a4',
    'w:passive:p3', 'w:gcsim_unsupported_a5',
  ]);
  assert.ok(marks.warnings.every(m => m.kind === 'warning'));
});

check('件数は、これまでヘッダーで数えていた式と同じ', () => {
  // これまでの App.tsx の式（totalCTCollisions / totalCTWarnings）
  const oldViolations = stints.reduce((n, s) => n + s.actions.filter(a => a.hasCTCollision && !a.ctGcsimVerified).length, 0);
  const oldWarnings = passives.filter(p => p.hasCTViolation).length
    + issues.filter(v => v.id.startsWith('special_window_') || v.id.startsWith('plunge_prereq_') || v.id.startsWith('gcsim_unsupported_') || v.id.startsWith('mode_blocks_') || v.id.startsWith('mode_blocked_')).length;
  assert.equal(marks.violations.length, oldViolations);
  assert.equal(marks.warnings.length, oldWarnings);
  assert.equal(CT_WARNING_ISSUE_PATTERN.test('passive_ct_x'), false);
});

check('入力の並びを変えても、同じ並び', () => {
  const again = buildCtMarks([...stints], [...passives].reverse(), [...issues].reverse());
  assert.deepEqual(again.violations.map(m => m.id), marks.violations.map(m => m.id));
  assert.deepEqual(again.warnings.map(m => m.id), marks.warnings.map(m => m.id));
});

check('出場ブロックが分からない警告は、数えて、いちばん最後に置く', () => {
  const r = buildCtMarks(stints, [], [issue('special_window_x', undefined, 1), issue('special_window_a2', 's1', 3, 'a2')]);
  assert.deepEqual(r.warnings.map(m => m.id), ['w:special_window_a2', 'w:special_window_x']);
});

check('印が無いときは、空の一覧', () => {
  const r = buildCtMarks([stint('s1', [act('a1')])], [passive('p1', 's1', 1, false)], []);
  assert.deepEqual(r, { violations: [], warnings: [] });
});

check('ガントの目印の値: アクション・発動バフ・出場ブロック（目印なし）', () => {
  assert.equal(ctTargetKey({ actionId: 'a1' }), ctActionTarget('a1'));
  assert.equal(ctTargetKey({ passiveId: 'p1' }), ctPassiveTarget('p1'));
  assert.equal(ctTargetKey({}), null);
  assert.equal(ctTargetKey(marks.violations[0]), 'act:a1');
  assert.equal(ctTargetKey(marks.warnings.find(m => m.id === 'w:passive:p1')!), 'passive:p1');
  assert.equal(ctTargetKey(marks.warnings.find(m => m.id === 'w:mode_blocks_s2_x')!), null);
});

console.log('前・次の選び方');
const list: CtMark[] = marks.violations; // a1, a4, a5

check('最初の ▼ は先頭、最初の ▲ は末尾', () => {
  assert.equal(stepCtMark(list, null, 1)?.actionId, 'a1');
  assert.equal(stepCtMark(list, null, -1)?.actionId, 'a5');
});

check('▼ で順に進み、末尾の次は先頭へ回る', () => {
  assert.equal(stepCtMark(list, 'v:a1', 1)?.actionId, 'a4');
  assert.equal(stepCtMark(list, 'v:a4', 1)?.actionId, 'a5');
  assert.equal(stepCtMark(list, 'v:a5', 1)?.actionId, 'a1');
});

check('▲ で順に戻り、先頭の前は末尾へ回る', () => {
  assert.equal(stepCtMark(list, 'v:a5', -1)?.actionId, 'a4');
  assert.equal(stepCtMark(list, 'v:a4', -1)?.actionId, 'a1');
  assert.equal(stepCtMark(list, 'v:a1', -1)?.actionId, 'a5');
});

check('最後に移動した印が無くなった（編集で解消した）ときは、最初の押し方と同じ', () => {
  assert.equal(stepCtMark(list, 'v:gone', 1)?.actionId, 'a1');
  assert.equal(stepCtMark(list, 'v:gone', -1)?.actionId, 'a5');
});

check('1 件だけのときは、▼ も ▲ も、その 1 件', () => {
  const one = [list[0]];
  assert.equal(stepCtMark(one, null, 1)?.id, 'v:a1');
  assert.equal(stepCtMark(one, 'v:a1', 1)?.id, 'v:a1');
  assert.equal(stepCtMark(one, 'v:a1', -1)?.id, 'v:a1');
});

check('一覧が空のときは null', () => {
  assert.equal(stepCtMark([], null, 1), null);
  assert.equal(stepCtMark([], 'v:a1', -1), null);
});

check('何件目か（まだ移動していない・無くなったときは 0）', () => {
  assert.equal(ctMarkPosition(list, null), 0);
  assert.equal(ctMarkPosition(list, 'v:a1'), 1);
  assert.equal(ctMarkPosition(list, 'v:a5'), 3);
  assert.equal(ctMarkPosition(list, 'v:gone'), 0);
});

console.log('ガントの目印');
const gantt = readFileSync(new URL('../src/components/GanttChart.tsx', import.meta.url), 'utf8');
check('アクションのバーに、data-ct-target={ctActionTarget(act.id)} が付いている', () => {
  assert.ok(gantt.includes('data-ct-target={ctActionTarget(act.id)}'));
});
check('発動バフのバー（効果の行・CT の行）に、data-ct-target={ctPassiveTarget(p.id)} が付いている', () => {
  const count = gantt.split('data-ct-target={ctPassiveTarget(p.id)}').length - 1;
  assert.ok(count >= 2, `付いている数: ${count}`);
});

console.log(`\n${passed} 件の確認が通りました`);
