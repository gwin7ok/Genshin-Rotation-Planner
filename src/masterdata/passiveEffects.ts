/**
 * 固有天賦（passive1 / passive2）の効果を、マスターデータの「発動バフ」定義にする。
 *
 * genshin-db の固有天賦には数値データが無く説明文しか無いため、説明文から
 *   継続時間: 「継続時間30秒」「10秒間」
 *   CT      : 「8秒毎に1回」「12秒ごとに1回」
 * を読み取って初期値にする。読み取れない場合は未設定（DB管理・アクション構築で手入力できる）。
 * 1つの固有天賦に継続時間が複数ある場合は、効果ごとに別の項目にする。
 * passive3 以降（料理・探索などの戦闘外効果）は対象外。
 */
import type { PassiveEffectDefinition } from '../types/genshin.ts';

export interface GenshinDbPassive {
  name: string;
  description: string;
}

const DURATION_PATTERNS = [/継続時間\s*([\d.]+)\s*秒/g, /([\d.]+)\s*秒間/g];
const COOLDOWN_PATTERN = /([\d.]+)\s*秒(?:毎|ごと)に\s*(?:1|一)\s*回/;

/** 説明文中の継続時間を、出てくる順に取り出す（同じ位置の重複は除く） */
function findDurations(text: string): Array<{ value: number; label: string }> {
  const hits: Array<{ index: number; value: number; label: string }> = [];
  for (const pattern of DURATION_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const index = m.index ?? 0;
      if (hits.some(h => Math.abs(h.index - index) < 4)) continue;
      hits.push({ index, value: Number(m[1]), label: m[0] });
    }
  }
  return hits
    .filter(h => Number.isFinite(h.value) && h.value > 0)
    .sort((a, b) => a.index - b.index)
    .map(({ value, label }) => ({ value, label }));
}

export function buildPassiveEffects(
  characterId: string,
  passives: Array<GenshinDbPassive | undefined>,
): PassiveEffectDefinition[] {
  const effects: PassiveEffectDefinition[] = [];
  passives.forEach((passive, i) => {
    if (!passive?.name) return;
    const slot = (i + 1) as 1 | 2;
    const text = (passive.description ?? '').replace(/\s+/g, ' ');
    const durations = findDurations(text);
    const cd = COOLDOWN_PATTERN.exec(text);
    const cooldown = cd ? Number(cd[1]) : undefined;
    const base = {
      talentName: passive.name,
      talentSlot: slot,
      description: text,
      ...(cooldown ? { cooldown } : {}),
    };

    if (durations.length <= 1) {
      effects.push({
        ...base,
        id: `${characterId}_p${slot}`,
        name: passive.name,
        ...(durations[0] ? { duration: durations[0].value } : {}),
        dataSource: { duration: durations[0]?.label, cooldown: cd?.[0] },
      });
      return;
    }
    durations.forEach((d, n) => {
      effects.push({
        ...base,
        id: `${characterId}_p${slot}_${n + 1}`,
        name: `${passive.name} (${d.value}秒)`,
        duration: d.value,
        dataSource: { duration: d.label, cooldown: cd?.[0] },
      });
    });
  });
  return effects;
}
