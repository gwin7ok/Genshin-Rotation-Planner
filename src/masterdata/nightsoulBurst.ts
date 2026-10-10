/**
 * 夜魂バースト（ナタのキャラの固有天賦が反応する、チーム共通の出来事）。
 *
 * 「付近にいるチーム内キャラクターが夜魂バーストを起こした後〜」の効果（カチーナ・キィニチ・ムアラニ・チャスカ・オロルン・マーヴィカ・イアンサ・ヴァレサ・イファ）の
 * 発動の間隔は、チーム全体で共通で、チーム内のナタのキャラの人数で決まる（gcsim: pkg/simulation/setup.go の nightsoulBurstICD = 0・18・12・9・9 秒。
 * wiki: カチーナのみだと 18 秒、+1 体で 12 秒、+2 体で 9 秒）。ナタのキャラがいなければ起きない。
 * 爆発（元素爆発）の CT ではない。
 */

/**
 * ナタのキャラの公式 ID（genshin-db の region = ナタ。gcsim の CharZone == ZoneNatlan。2026-10-11 に確認。11 人）。
 * 新しいナタのキャラが実装されたら、ここに足す
 */
export const NATLAN_GENSHIN_IDS: ReadonlySet<number> = new Set([
  10000100, // カチーナ
  10000101, // キィニチ
  10000102, // ムアラニ
  10000103, // シロネン
  10000104, // チャスカ
  10000105, // オロルン
  10000106, // マーヴィカ
  10000107, // シトラリ
  10000110, // イアンサ
  10000111, // ヴァレサ
  10000113, // イファ
]);

/** チーム内のナタのキャラの人数 */
export const countNatlan = (characters: Array<{ id: string; source?: { genshinId?: number } }>): number =>
  characters.filter(c => !c.id.startsWith('empty_slot_') && c.source?.genshinId !== undefined && NATLAN_GENSHIN_IDS.has(c.source.genshinId)).length;

/** ナタのキャラの人数 → 夜魂バーストの間隔（秒）。0 人は起きない（undefined） */
export const nightsoulBurstCooldown = (natlanCount: number): number | undefined =>
  natlanCount <= 0 ? undefined : [0, 18, 12, 9, 9][Math.min(natlanCount, 4)];

/** 固有天賦の説明が、「チーム内キャラクターが夜魂バーストを起こした／発動した」ことを条件にする効果か（シロネンの自分の夜魂値の効果は含めない） */
export const isNightsoulBurstTriggered = (description: string | undefined): boolean =>
  /^付近にいるチーム内キャラクターが「夜魂バースト」を(?:起こした|発動)/.test((description ?? '').trim());
