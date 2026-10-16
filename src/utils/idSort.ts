/**
 * 武器・聖遺物の ID の並び（新しい順）。
 *   - マスター: 数値の ID（ゲームの ID。大きいほど新しい）
 *   - 利用者の作成: `weapon_custom_<作成時刻>` / `art_custom_<作成時刻>`（時刻が新しいほど新しい）
 * 利用者の作成を先に並べる。どちらの形でもない ID は最後に、文字列の降順で並べる。
 */
function idRank(id: string): { group: 0 | 1 | 2; n: number } {
  if (/^\d+$/.test(id)) return { group: 1, n: Number(id) };
  const custom = id.match(/_custom_(\d+)$/);
  if (custom) return { group: 0, n: Number(custom[1]) };
  return { group: 2, n: 0 };
}

export function compareIdDesc(a: string, b: string): number {
  const ra = idRank(a);
  const rb = idRank(b);
  if (ra.group !== rb.group) return ra.group - rb.group;
  if (ra.group === 2) return b < a ? -1 : b > a ? 1 : 0;
  return rb.n - ra.n;
}
