/**
 * アクションのグループ化の確認（src/utils/actionGroups.ts・rotationNotation.ts。追加作業 20-A・D182）。
 *
 *   npm run check:groups
 *
 * 1 つのアクションだけのグループ（そのアクションを繰り返す。記法は `3C`）を含めて、作成・整合・展開・記法を確かめる。
 */
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const g = await server.ssrLoadModule('/src/utils/actionGroups.ts');
const n = await server.ssrLoadModule('/src/utils/rotationNotation.ts');

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

const act = (id: string, shortName: string, type: string) => ({ id, actionTypeId: `x_${shortName.toLowerCase()}`, name: shortName, shortName, type, duration: 1 });
const baseStint = () => ({
  id: 's1', characterId: 'c', note: '',
  actions: [act('swap', 'S', 'swap'), act('n1', 'N', 'normal'), act('c1', 'C', 'charged'), act('e1', 'E', 'skill')],
});
const notation = (st: unknown, mode = 'short') => n.buildStintNotation(st, mode) as string;

check('作成: 1 つのアクションだけでも、グループにできる（回数の初期値は 1）', () => {
  const st = g.createGroup(baseStint(), ['c1']);
  assert.ok(st, '作成できる');
  assert.equal(st.groups.length, 1);
  assert.equal(st.groups[0].repeat, 1);
  assert.equal(st.actions.find((a: any) => a.id === 'c1').groupId, st.groups[0].id);
});
check('作成: 複数のアクションのグループの回数の初期値も 1', () => {
  const st = g.createGroup(baseStint(), ['n1', 'c1']);
  assert.equal(st.groups[0].repeat, 1);
});
check('作成: 交代・グループ済み・隣接しない・空は、作れない', () => {
  assert.equal(g.createGroup(baseStint(), ['swap']), null);
  assert.equal(g.createGroup(baseStint(), []), null);
  assert.equal(g.createGroup(baseStint(), ['n1', 'e1']), null, '隣接しない');
  const once = g.createGroup(baseStint(), ['c1']);
  assert.equal(g.createGroup(once, ['c1']), null, 'グループ済み');
});
check('整合: 1 つだけのグループは、正規化で解除されない', () => {
  const st = g.normalizeGroups(g.createGroup(baseStint(), ['c1']));
  assert.equal(st.groups.length, 1);
  assert.ok(st.actions.find((a: any) => a.id === 'c1').groupId);
});
check('展開: 回数 3 の 1 つのグループは、そのアクションを 3 回並べる', () => {
  let st = g.createGroup(baseStint(), ['c1']);
  st = g.setGroupRepeat(st, st.groups[0].id, 3);
  const [expanded] = g.expandGroupedStints([st]);
  assert.deepEqual(expanded.actions.map((a: any) => a.shortName), ['S', 'N', 'C', 'C', 'C', 'E']);
  assert.equal(expanded.actions.filter((a: any) => a.groupCopy > 0).length, 2);
});
check('記法（略号）: C を 3 回 → 「3C」（CCC ではない）', () => {
  let st = g.createGroup(baseStint(), ['c1']);
  st = g.setGroupRepeat(st, st.groups[0].id, 3);
  assert.equal(notation(st), 'N1 3C E');
});
check('記法（略号）: 回数 1 は、括弧も数字も出さない', () => {
  let st = g.createGroup(baseStint(), ['c1']);
  st = g.setGroupRepeat(st, st.groups[0].id, 1);
  assert.equal(notation(st), 'N1CE');
});
check('記法（略号）: 複数のアクションのグループは、従来どおり n[ … ]', () => {
  let st = g.createGroup(baseStint(), ['n1', 'c1']);
  st = g.setGroupRepeat(st, st.groups[0].id, 2);
  assert.equal(notation(st), '2[N1C] E');
});
check('記法（名称）: 3×重撃（括弧なし）', () => {
  let st = g.createGroup(baseStint(), ['c1']);
  st = g.setGroupRepeat(st, st.groups[0].id, 3);
  const text = notation(st, 'name');
  assert.match(text, /3×[^\[\s]+/);
  assert.ok(!text.includes('['), `括弧が入っている: ${text}`);
});
check('記法: 長押しの秒数つきでも、1 つのグループは 3E@2.0s', () => {
  const st0 = baseStint();
  st0.actions[3] = { ...st0.actions[3], shortName: 'hE', type: 'skill_hold', holdSeconds: 2 } as any;
  let st = g.createGroup(st0, ['e1']);
  st = g.setGroupRepeat(st, st.groups[0].id, 3);
  assert.match(notation(st), /3hE@2\.0s/);
});
check('移動: 1 つだけのグループのアクションを動かしても、壊れない', () => {
  let st = g.createGroup(baseStint(), ['c1']);
  const moved = g.moveActionRespectingGroups(st.actions, 'c1', 0);
  // 先頭の交代アクションの前には入らない。N の前（位置 1）に移る
  assert.ok(moved === null || moved.findIndex((a: any) => a.id === 'c1') >= 1);
  const block = g.moveGroupBlock(st.actions, st.groups[0].id, 1);
  assert.ok(block === null || block.some((a: any) => a.id === 'c1'));
});

check('解除: 回数 3 の 1 つのグループは、C が 3 つの通常のアクションになる（1 回に戻らない）', () => {
  let st = g.createGroup(baseStint(), ['c1']);
  st = g.setGroupRepeat(st, st.groups[0].id, 3);
  const un = g.ungroup(st, st.groups[0].id);
  assert.deepEqual(un.actions.map((a: any) => a.shortName), ['S', 'N', 'C', 'C', 'C', 'E']);
  assert.equal(un.groups, undefined, 'グループは残らない');
  assert.ok(un.actions.every((a: any) => !a.groupId && !a.groupCopy));
  assert.equal(new Set(un.actions.map((a: any) => a.id)).size, un.actions.length, 'ID が重ならない');
  assert.equal(notation(un), 'N1CCCE', '記法は、グループなしの並び');
});
check('解除: 複数のアクションのグループ（回数 2）は、N C N C に展開される', () => {
  let st = g.createGroup(baseStint(), ['n1', 'c1']);
  st = g.setGroupRepeat(st, st.groups[0].id, 2);
  const un = g.ungroup(st, st.groups[0].id);
  assert.deepEqual(un.actions.map((a: any) => a.shortName), ['S', 'N', 'C', 'N', 'C', 'E']);
});
check('解除: 回数 1 なら、並びは変わらない', () => {
  const st = g.createGroup(baseStint(), ['n1', 'c1']);
  const un = g.ungroup(st, st.groups[0].id);
  assert.deepEqual(un.actions.map((a: any) => a.id), ['swap', 'n1', 'c1', 'e1']);
});
check('解除: 解除した並びは、グループの展開と同じ計算になる（アクションの内容・順序）', () => {
  let st = g.createGroup(baseStint(), ['c1']);
  st = g.setGroupRepeat(st, st.groups[0].id, 4);
  const expanded = g.expandGroupedStints([st])[0].actions.map((a: any) => [a.shortName, a.type, a.duration]);
  const un = g.ungroup(st, st.groups[0].id).actions.map((a: any) => [a.shortName, a.type, a.duration]);
  assert.deepEqual(un, expanded);
});
check('解除: ほかのグループは、そのまま残る', () => {
  const st0 = baseStint();
  st0.actions.push(act('c2', 'C', 'charged'), act('c3', 'C', 'charged'));
  let st = g.createGroup(st0, ['c1']);
  st = g.setGroupRepeat(st, st.groups[0].id, 2);
  st = g.createGroup(st, ['c2', 'c3']);
  st = g.setGroupRepeat(st, st.groups[1].id, 3);
  const un = g.ungroup(st, st.groups[0].id);
  assert.equal(un.groups.length, 1);
  assert.equal(un.groups[0].repeat, 3);
  assert.deepEqual(un.actions.map((a: any) => a.shortName), ['S', 'N', 'C', 'C', 'E', 'C', 'C']);
});

await server.close();
console.log(`\n✓ グループ化: ${passed} 項目すべて合格`);
process.exit(0);
