/**
 * 突破段階が不明な持ちキャラ（Lv.20・40・50・60・70・80 ちょうど）を、gcsim の基礎 HP で決める。
 * HoYoLAB が返す基礎 HP（キャラ・Lv・突破で決まる）と、gcsim が突破前・突破後で出す基礎 HP を比べ、合う方を採る
 * （イファ Lv.80 で確認: 突破前 8934 / 突破後 9383 → HoYoLAB は 9383。docs/hoyolab-import/plan.md）。
 */
import { runGcsimSample } from '../gcsim/gcsimClient';
import { buildOwnedCharacterLines, type MasterRef, type OwnedCharacter } from './importCharacters';

/** gcsim の snapshot の基礎 HP の位置 */
const SNAPSHOT_BASE_HP = 23;

const baseHpOf = async (owned: OwnedCharacter, maxLevel: number, gcsimKey: string, masters: { weapons: MasterRef[]; artifacts: MasterRef[] }): Promise<number | undefined> => {
  const { lines } = buildOwnedCharacterLines({ ...owned, maxLevel }, gcsimKey, masters);
  const config = [...lines, 'options iteration=1 duration=1;', 'target lvl=100 resist=0.1;', `active ${gcsimKey};`, `${gcsimKey} attack;`].join('\n');
  const res = await runGcsimSample(config, 1);
  return res.status === 'ok' ? res.characterDetails?.[0]?.snapshot?.[SNAPSHOT_BASE_HP] : undefined;
};

/** 突破段階を決めた持ちキャラを返す。決められなければ（gcsim が使えない・キーが無い）、そのまま返す */
export async function resolveAscension(
  owned: OwnedCharacter,
  gcsimKey: string | undefined,
  masters: { weapons: MasterRef[]; artifacts: MasterRef[] },
): Promise<OwnedCharacter> {
  if (!owned.ambiguousAscension || !owned.hoyolabBaseHp || !gcsimKey) return owned;
  const before = owned.maxLevel;
  const after = before + 10;
  if (after > 90) return owned;
  const [hpBefore, hpAfter] = [await baseHpOf(owned, before, gcsimKey, masters), await baseHpOf(owned, after, gcsimKey, masters)];
  if (hpBefore === undefined || hpAfter === undefined) return owned;
  const diffBefore = Math.abs(hpBefore - owned.hoyolabBaseHp);
  const diffAfter = Math.abs(hpAfter - owned.hoyolabBaseHp);
  // 両方とも 1 以上ずれているときは、決められない（そのまま）
  if (Math.min(diffBefore, diffAfter) > 2) return owned;
  const ascended = diffAfter < diffBefore;
  return { ...owned, maxLevel: ascended ? after : before, ambiguousAscension: false, warnings: owned.warnings.filter(w => !w.includes('突破前か突破後か')) };
}
