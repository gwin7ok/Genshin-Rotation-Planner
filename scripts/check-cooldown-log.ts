/**
 * gcsim のログからスキル・爆発の CT を読む処理（readGcsimLog.ts の「2. スキル・爆発のCT」）の検査（2026-10-09）。
 *
 *   npm run check:cooldown-log
 *
 *   1. 複数回分のスキルは、CT が順番に回復する（先入れ先出し）。2 つ目の CT は、1 つ目が明けてから減り始める
 *   2. フリンズのスキルと嵐槍は、どちらも `skill` 種別で、別々に終わる。`ready` を取り違えない（画面確認で見つかった不具合: スキルの CT が 6 秒になっていた）
 */
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const { readGcsimLog } = await server.ssrLoadModule('/src/utils/gcsim/readGcsimLog.ts');
const members: any[] = [{ characterId: 'c', name: 'x', gcsimKey: 'x' }];
const read = (logs: any[]) => readGcsimLog(logs.map(l => ({ char_index: 0, logs: {}, ...l })), { members, lookup: () => undefined });
const cd = (frame: number, msg: string, logs: any) => ({ frame, event: 'cooldown', msg, logs });
let failed = 0;
const expect = (name: string, ok: boolean, detail: unknown) => { console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ' ' + JSON.stringify(detail)}`); if (!ok) failed++; };

// 1. 複数回分: 10 秒の CT を 2 回積む。1 つ目 start 50 → ready 650、2 つ目 start 100（キュー）→ 650 から減り始め、ready 1250
{
  const s = read([
    cd(50, 'skill cooldown triggered', { type: 'skill', original_cd: 600, expiry: 600 }),
    cd(100, 'skill cooldown triggered', { type: 'skill', original_cd: 600, expiry: 600 }),
    cd(650, 'skill cooldown ready', { type: 'skill' }),
    cd(1250, 'skill cooldown ready', { type: 'skill' }),
  ]);
  const [a, b] = s.cooldowns;
  expect('複数回分: 1 つ目 50→650', a.readyFrame === 650 && a.queueStartFrame === 50, a);
  expect('複数回分: 2 つ目はキューの開始 650→1250', b.readyFrame === 1250 && b.queueStartFrame === 650, b);
}
// 2. フリンズ: スキル（16 秒 = 960f。標準のログ: expiry は長さ）と嵐槍（6 秒。自前のログ: expiry・original_cd は絶対のフレーム 419）
{
  const s = read([
    cd(50, 'skill cooldown triggered', { type: 'skill', original_cd: 960, expiry: 960 }),
    cd(59, 'skill cooldown triggered', { type: 'skill', original_cd: 419, expiry: 419 }),
    cd(419, 'skill cooldown ready', { type: 'skill' }),
    cd(1010, 'skill cooldown ready', { type: 'skill' }),
  ]);
  const [e, spear] = s.cooldowns;
  expect('フリンズ: スキルは 50→1010（16 秒）', e.readyFrame === 1010 && e.queueStartFrame === 50, e);
  expect('フリンズ: 嵐槍は 59→419（6 秒。待ちなし）', spear.readyFrame === 419 && spear.queueStartFrame === 59, spear);
}
await server.close();
console.log(failed === 0 ? '\n全部一致' : `\n${failed} 件が不一致`);
process.exit(failed === 0 ? 0 : 1);
