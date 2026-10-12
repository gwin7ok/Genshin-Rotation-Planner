/**
 * 反応の行（月・星の反応・草露・月露）の、保存編成・現在の編成への保存と復元。
 *
 * 反応の行は、gcsim の実行結果から読み取った区間（アクション基準の位置。ReactionRowRef）。
 * 編成に、gcsim のバージョンと一緒に保存する。復元のとき、gcsim のバージョンが違えば（古い計算結果）、出さない。
 * 編成・交代遅延・ループ基準・アクションの並びを編集したときに消える扱いは、画面側（App.tsx）。
 */
import type { ReactionKind, ReactionRowRef, SavedReactions } from '../../types/genshin.ts';
import { GCSIM_VERSION } from './gcsimConfig.ts';

const KINDS: ReadonlySet<string> = new Set<ReactionKind>([
  'lunarcharged', 'lunarcrystallize', 'verdantdew', 'moonridgedew', 'stellarconduct', 'stellarswirl', 'stellarswirl_airborne',
]);

/** 保存する形にする（無い・空のときは undefined = 保存しない） */
export function packReactions(rows: ReactionRowRef[] | null | undefined): SavedReactions | undefined {
  if (!rows || rows.length === 0) return undefined;
  return { gcsimVersion: GCSIM_VERSION, rows };
}

const isAnchor = (a: unknown): boolean =>
  !!a && typeof a === 'object' && typeof (a as { actionId?: unknown }).actionId === 'string' && Number.isFinite((a as { offset?: unknown }).offset);

/**
 * 保存された反応の行を読む。次のときは null（出さない）:
 *   - 保存が無い・形が違う
 *   - gcsim のバージョンが、今のアプリが使うものと違う（古い計算結果）
 */
export function unpackReactions(saved: unknown, currentGcsimVersion: string = GCSIM_VERSION): ReactionRowRef[] | null {
  if (!saved || typeof saved !== 'object') return null;
  const s = saved as { gcsimVersion?: unknown; rows?: unknown };
  if (s.gcsimVersion !== currentGcsimVersion) return null;
  if (!Array.isArray(s.rows) || s.rows.length === 0) return null;
  const rows: ReactionRowRef[] = [];
  for (const r of s.rows as unknown[]) {
    if (!r || typeof r !== 'object') return null;
    const row = r as { kind?: unknown; lap?: unknown; max?: unknown; segments?: unknown };
    if (typeof row.kind !== 'string' || !KINDS.has(row.kind)) return null;
    if (row.lap !== 1 && row.lap !== 2) return null;
    if (!Array.isArray(row.segments)) return null;
    for (const sg of row.segments as unknown[]) {
      const g = sg as { start?: unknown; end?: unknown; count?: unknown };
      if (!isAnchor(g?.start) || !isAnchor(g?.end)) return null;
      if (g.count !== undefined && !Number.isFinite(g.count)) return null;
    }
    rows.push(row as ReactionRowRef);
  }
  return rows;
}
