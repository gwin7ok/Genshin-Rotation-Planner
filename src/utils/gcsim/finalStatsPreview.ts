/**
 * 「ステータスを変更」の画面で、gcsim が計算する最終ステータス（参考）を出す。
 * その枠のキャラ・武器・聖遺物・凸に、入力中のステータスを足した設定文を、gcsim で 1 回だけ実行し、開始時のスナップショットを読む。
 * 設定文は、実際の計算と同じ buildGcsimConfig から作る（キャラ・武器・聖遺物・ステータスの行だけ使う）。
 */
import type { CharacterConfig, CustomStats } from '../../types/genshin';
import type { AppDatabase } from '../../types/database';
import { buildGcsimConfig } from './buildGcsimConfig';
import { runGcsimSample } from './gcsimClient';

/** gcsim の snapshot の並び（Stat の列挙）: 2=DEF 3=HP 5=ATK 7=ER 8=EM 9=CR 10=CD 11=Heal 12..18=炎水氷雷風岩草 19=物理 */
const SNAP = { def: 2, hp: 3, atk: 5, er: 7, em: 8, cr: 9, cd: 10, heal: 11 } as const;
const ELEMENT_SNAP: Record<string, number> = { pyro: 12, hydro: 13, cryo: 14, electro: 15, anemo: 16, geo: 17, dendro: 18, physical: 19 };

export interface FinalStats {
  hp: number; atk: number; def: number; em: number;
  /** 割合は小数（0.5 = 50%）。er は基礎の 1.0 を含む */
  cr: number; cd: number; er: number; heal: number;
  /** そのキャラの元素ダメージバフ（割合）、物理ダメージバフ */
  elementDmg: number; physDmg: number;
}

export type FinalStatsResult =
  | { status: 'ok'; stats: FinalStats }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

export async function previewFinalStats(
  char: CharacterConfig,
  stats: CustomStats,
  database: Pick<AppDatabase, 'weapons' | 'artifacts'>,
): Promise<FinalStatsResult> {
  const key = char.source?.gcsimKey;
  if (!key) return { status: 'unsupported' };
  const cfg = buildGcsimConfig({
    characters: [{ ...char, build: undefined, customStats: stats }],
    stints: [],
    loopStartIndex: 0,
    switchDelay: 0.5,
    weapons: database.weapons,
    artifacts: database.artifacts,
  });
  const lines = cfg.config.split(/\r?\n/).filter(l => l.startsWith(`${key} `) && / char | add weapon| add set| add stats/.test(l));
  const config = [...lines, 'options iteration=1 duration=1;', 'target lvl=100 resist=0.1;', `active ${key};`, `${key} attack;`].join('\n');
  const res = await runGcsimSample(config, 1);
  if (res.status !== 'ok') return { status: 'error', message: res.message };
  const snap = res.characterDetails?.[0]?.snapshot;
  if (!snap) return { status: 'error', message: 'no snapshot' };
  return {
    status: 'ok',
    stats: {
      hp: snap[SNAP.hp], atk: snap[SNAP.atk], def: snap[SNAP.def], em: snap[SNAP.em],
      cr: snap[SNAP.cr], cd: snap[SNAP.cd], er: snap[SNAP.er], heal: snap[SNAP.heal],
      elementDmg: snap[ELEMENT_SNAP[char.element] ?? ELEMENT_SNAP.physical], physDmg: snap[ELEMENT_SNAP.physical],
    },
  };
}
