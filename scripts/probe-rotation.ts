/**
 * 手で組んだローテーションの DPS を、探索と同じ条件（同じ gcsim・同じ戦闘時間の測り方）で測る。探索の結果との比較用。
 *
 *   node scripts/probe-rotation.ts 八重神子 オデット サンドローネ 七七 --owned=tools/hoyolab-fetch/out/owned-characters.json --rot=回転.json --seconds=120
 *   回転.json: { "loop": 5, "stints": [ { "c": "キャラID", "a": ["e","ca"] }, … ] }（a はアクションの種類。キャラID_ は付けない）
 */
import fs from 'node:fs';
import { createServer } from 'vite';
import { useNodeGcsim } from './gcsim-node.ts';

const args = process.argv.slice(2);
const str = (name: string) => args.find(x => x.startsWith(`--${name}=`))?.split('=')[1];
const num = (name: string, def: number) => { const s = str(name); return s ? Number(s) : def; };
const names = args.filter(x => !x.startsWith('--'));
const SECONDS = num('seconds', 120);
const RUNS = num('runs', 10);
const rot = str('rot') ? JSON.parse(fs.readFileSync(str('rot')!, 'utf8')) : (() => { const p = JSON.parse(fs.readFileSync(`src/data/presets/${str('preset')}.json`, 'utf8')); return { loop: p.loopStartIndex ?? 0, stints: p.stints.map((s: any) => ({ c: s.characterId, a: s.actions.map((a: any) => a.actionTypeId.slice(s.characterId.length + 1)) })) }; })();

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
await useNodeGcsim(server);
const cs = await server.ssrLoadModule('/src/utils/customStats.ts');
const imp = await server.ssrLoadModule('/src/utils/hoyolab/importCharacters.ts');
const { buildGcsimConfig } = await server.ssrLoadModule('/src/utils/gcsim/buildGcsimConfig.ts');
const { computeDps } = await server.ssrLoadModule('/src/utils/gcsim/dpsCalc.ts');
const { runGcsimSample } = await server.ssrLoadModule('/src/utils/gcsim/gcsimClient.ts');

const master: any[] = JSON.parse(fs.readFileSync('src/data/characters_master_data.json', 'utf8'));
const weapons: any[] = JSON.parse(fs.readFileSync('src/data/weapons_master_data.json', 'utf8'));
const artifacts: any[] = JSON.parse(fs.readFileSync('src/data/artifacts_master_data.json', 'utf8'));
const ownedPath = str('owned');
const owned: any[] = ownedPath ? JSON.parse(fs.readFileSync(ownedPath, 'utf8')).characters : [];
const characters: any[] = [];
// --preset=名前: 手組みプリセットの編成・装備をそのまま使う（--rot を省くと、そのプリセットの出場の並びを測る）
const presetName = str('preset');
const preset = presetName ? JSON.parse(fs.readFileSync(`src/data/presets/${presetName}.json`, 'utf8')) : undefined;
if (preset) for (const pc of preset.party) { const { characterId, ...fields } = pc; const m = master.find((c: any) => c.id === characterId); characters.push({ ...structuredClone(m), ...fields }); }
for (const n of preset ? [] : names) {
  const m = master.find(c => c.name === n || c.englishName === n);
  const o = ownedPath ? owned.find(x => imp.matchMasterCharacterId(x, [m.id]) === m.id) : undefined;
  if (o) characters.push({ ...structuredClone(m), ...imp.ownedToPartyFields(o, { weapons, artifacts }).fields });
  else characters.push({ ...structuredClone(m), ...cs.defaultEquipmentFor(m.id, { weapons, artifacts }), customStats: cs.defaultCustomStatsFor(m.id) });
}
let n = 0;
const stints = rot.stints.map((s: any, i: number) => {
  const c = characters.find(x => x.id === s.c);
  return {
    id: `s${i}`, characterId: s.c,
    actions: s.a.map((step: string) => {
      const def = c.availableActions.find((a: any) => a.id === `${c.id}_${step}`);
      return { id: `a${++n}`, actionTypeId: def.id, name: def.name, shortName: def.shortName, type: def.type, duration: def.defaultDuration };
    }),
  };
});
const cfg = buildGcsimConfig({ characters, stints, loopStartIndex: rot.loop ?? 0, switchDelay: 0.5, defHalt: true, weapons, artifacts, battleSeconds: SECONDS });
const out = await computeDps({ config: cfg, runs: RUNS, parallel: 6, run: runGcsimSample, context: { battleSeconds: SECONDS } });
if (out.status !== 'ok') console.log('失敗', out.status, out.message);
else console.log(`DPS ${(out.result.dps.mean / 1000).toFixed(1)}k ±${(out.result.dps.sd / 1000).toFixed(1)}（戦闘 ${SECONDS} 秒・${RUNS} 回）`);
await server.close();
process.exit(0);
