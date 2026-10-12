/**
 * 発動バフの書き戻しで、同じ効果が複数のバーに分かれない・キーごとの名前が付くことの確認（D181）。
 *
 *   npm run check:effects
 *
 * 合成した gcsim の結果（効果のイベント）を applyPassiveTriggers に渡して確認する（gcsim の実行は使わない）。
 *   - 同じ効果の「状態 + 修正」（香菱 6 凸: xlc6 / xiangling-c6）は 1 本になる。前回の結果に残っていた別名のバーは取り除く。
 *   - 主のキーが無いときは、別名のキーのバーを残す（効果を落とさない）。
 *   - 絵巻 4 セット: +12%（15 秒）と +28%（20 秒）は、別の名前の別のバー。
 *   - 別の効果（シトラリ A1 の水・炎）は、そのまま 2 本。
 */
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { applyPassiveTriggers } = await server.ssrLoadModule('/src/utils/gcsim/applyBuffEffects.ts');
const display = await server.ssrLoadModule('/src/masterdata/effectKeyDisplay.ts');

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

// --- 合成データ ---
const ACTION = { id: 'executed-1' };
const effectEntry = { kind: 'effect', permanent: false };
const ev = (key: string, frame: number, expiry: number) => ({ key, frame, charIndex: 0, expiry, ended: expiry, kind: 'added' });
const eff = (key: string, start: number, end: number) => ({ key, entry: effectEntry, sourceCharIndex: 0, recipients: [0], startFrame: start, endFrame: end, refreshFrames: [] });

const stints = (extra: unknown[] = []) => [{ id: 's1', characterId: 'char-a', note: '', actions: [{ id: 'a1' }], passiveTriggers: extra }];
const pairs = [{ executed: ACTION, ref: { stintId: 's1', phase: 'initial', loopIteration: 1 } }];
const members = [{ characterId: 'char-a', gcsimKey: 'a' }];
const run = (def: Record<string, unknown>, events: ReturnType<typeof ev>[], effects: ReturnType<typeof eff>[], existing: unknown[] = []) => {
  const summary = {
    totalFrames: 3000, initialCharIndex: 0,
    stints: [{ charIndex: 0, startFrame: 0, actions: [ACTION] }],
    cooldowns: [], effects, effectEvents: events, cooldownWaits: [], unknownKeys: [], internalSkipped: 0,
  };
  return applyPassiveTriggers(stints(existing) as any, pairs as any, summary as any, members as any, { 'char-a': [def] } as any, 0) as {
    stints: { passiveTriggers?: { name: string; gcsimKey?: string; duration?: number }[] }[];
    changes: { kind: string; key: string }[];
  };
};
const triggersOf = (r: ReturnType<typeof run>) => r.stints[0].passiveTriggers ?? [];

// --- 別名の表 ---
check('別名: 主のキーがあれば、別名のキーを除く', () => {
  assert.deepEqual(display.effectiveGcsimKeys(['xiangling-c6', 'xlc6']), ['xlc6']);
  assert.deepEqual(display.effectiveGcsimKeys(['xiangling-c6']), ['xiangling-c6'], '主のキーが定義に無ければ、別名を残す');
  assert.deepEqual(display.effectiveGcsimKeys(['citlali-a1-hydro', 'citlali-a1-pyro']), ['citlali-a1-hydro', 'citlali-a1-pyro']);
});
check('名前: 絵巻 4 のキー別の名前', () => {
  assert.equal(display.labelForKey('scroll-4pc-pyro'), '絵巻4: 炎元素ダメージ+12%');
  assert.equal(display.labelForKey('scroll-4pc-nightsoul-hydro'), '絵巻4: 水元素ダメージ+28%（夜魂の加護中）');
  assert.equal(display.labelForKey('citlali-a1-hydro'), undefined);
});

// --- 香菱 6 凸 ---
const XIANGLING = { id: 'xl_c6', name: '6凸「竜巻旋火輪」', gcsimKeys: ['xiangling-c6', 'xlc6'], gcsimTarget: true };
check('香菱 6 凸: 状態と修正が 1 本になり、名前にキーの接尾辞が付かない（長さは状態のもの）', () => {
  const r = run(XIANGLING, [ev('xlc6', 100, 940), ev('xiangling-c6', 100, 946)], [eff('xlc6', 100, 940), eff('xiangling-c6', 100, 946)]);
  const t = triggersOf(r);
  assert.equal(t.length, 1);
  assert.equal(t[0].name, '6凸「竜巻旋火輪」');
  assert.equal(t[0].gcsimKey, 'xlc6');
  assert.equal(t[0].duration, 14);
});
check('香菱 6 凸: 前回の結果に残っていた別名のバーは、取り除く（統合として記録）', () => {
  const old = [
    { id: 'old1', passiveEffectId: 'xl_c6', name: '6凸「竜巻旋火輪」（xlc6）', offset: 0, duration: 14, gcsimKey: 'xlc6' },
    { id: 'old2', passiveEffectId: 'xl_c6', name: '6凸「竜巻旋火輪」（xiangling-c6）', offset: 0, duration: 14.1, gcsimKey: 'xiangling-c6' },
  ];
  const r = run(XIANGLING, [ev('xlc6', 100, 940), ev('xiangling-c6', 100, 946)], [eff('xlc6', 100, 940), eff('xiangling-c6', 100, 946)], old);
  const t = triggersOf(r);
  assert.equal(t.length, 1);
  assert.equal(t[0].gcsimKey, 'xlc6');
  assert.equal(t[0].name, '6凸「竜巻旋火輪」', '既存の名前も、接尾辞なしに更新される');
  assert.equal(r.changes.filter(c => c.kind === 'merged').length, 1);
});
check('香菱 6 凸: 主のキーが結果に出なかったときは、別名のキーのバーを残す', () => {
  const r = run(XIANGLING, [ev('xiangling-c6', 100, 946)], [eff('xiangling-c6', 100, 946)]);
  const t = triggersOf(r);
  assert.equal(t.length, 1);
  assert.equal(t[0].gcsimKey, 'xiangling-c6');
});

// --- 絵巻 4 セット ---
const SCROLL = { id: 'scroll4', name: '絵巻4: 該当元素ダメバフ+40%', gcsimKeys: ['scroll-4pc-*', 'scroll-4pc-nightsoul-*'], gcsimTarget: true };
check('絵巻 4: +12%（15 秒）と +28%（20 秒）が、別の名前の別のバーになる', () => {
  const r = run(
    SCROLL,
    [ev('scroll-4pc-cryo', 100, 1000), ev('scroll-4pc-nightsoul-cryo', 100, 1300)],
    [eff('scroll-4pc-cryo', 100, 1000), eff('scroll-4pc-nightsoul-cryo', 100, 1300)],
  );
  const t = triggersOf(r).sort((a, b) => (a.duration ?? 0) - (b.duration ?? 0));
  assert.equal(t.length, 2);
  assert.equal(t[0].name, '絵巻4: 氷元素ダメージ+12%');
  assert.equal(t[0].duration, 15);
  assert.equal(t[1].name, '絵巻4: 氷元素ダメージ+28%（夜魂の加護中）');
  assert.equal(t[1].duration, 20);
});

// --- 別の効果は、そのまま ---
const CITLALI = { id: 'cit_a1', name: '五重天の寒雨', gcsimKeys: ['citlali-a1-hydro', 'citlali-a1-pyro'], gcsimTarget: true };
check('シトラリ A1: 水と炎は別の効果として、2 本のまま（キーの接尾辞つき）', () => {
  const r = run(CITLALI, [ev('citlali-a1-hydro', 100, 840), ev('citlali-a1-pyro', 100, 840)], [eff('citlali-a1-hydro', 100, 840), eff('citlali-a1-pyro', 100, 840)]);
  const t = triggersOf(r).map(x => x.name).sort();
  assert.deepEqual(t, ['五重天の寒雨（citlali-a1-hydro）', '五重天の寒雨（citlali-a1-pyro）']);
});

await server.close();
console.log(`\n✓ 効果のキーの扱い: ${passed} 項目すべて合格`);
process.exit(0);
