/**
 * gcsim の詳細ログ（/sample の logs）の読み取り（フェーズ6 / 6-2）
 *
 * 純粋関数。ログのイベントを、アクション・出場・スキル/爆発のCT・効果（発動バフ）・CT待ちにまとめる。
 * 書き戻し（6-3）は、この結果を使う。ここでは値を読み取るだけで、アプリのデータは触らない。
 *
 * 読み取るイベント（全体計画 3.2）:
 *   action   … `executed <action>`（アクションの開始）、`executed swap`（出場の開始）、`swapping A to B`（交代の要求 = 出場の終了）
 *   cooldown … `skill/burst cooldown triggered` 〜 `ready`、`forcefully reset/reduced/discarded`
 *   status   … `mod|status added/refreshed/extended`（開始 `frame`、終了 `ended`）。キーは辞書で引く
 *   sim      … `could not execute <action>; action not ready`（CT待ち）
 * 未知のイベント・メッセージは無視する（gcsim の更新対策）。
 */
import type { KeyCatalogEntry } from '../../masterdata/gcsimKeyCatalog.ts';
import type { GcsimLogEvent } from './gcsimClient.ts';

export const GCSIM_FPS = 60;
export const framesToSeconds = (frames: number): number => frames / GCSIM_FPS;

/** char_index の並び（設定文のキャラの並び）に対応する編成のキャラ */
export interface GcsimMemberInfo {
  /** アプリのキャラ ID */
  characterId: string;
  name: string;
  /** gcsim のキャラのキー */
  gcsimKey: string;
  /** 装備の gcsim のキー（効果の発動元キャラを引くため） */
  weaponKey?: string;
  artifactKey?: string;
}

/** 辞書のキーの引き方（パターンのキーを含む）。引けなければ undefined */
export type KeyLookup = (key: string) => KeyCatalogEntry | undefined;

export interface GcsimActionRecord {
  /** gcsim のアクション名（attack / skill / burst / charge / aim / dash / low_plunge ...） */
  name: string;
  charIndex: number;
  frame: number;
  /** 次のアクション（または交代の要求）の開始までのフレーム。ログの最後のアクションは undefined */
  frames?: number;
}

export interface GcsimStintRecord {
  charIndex: number;
  /** 出場の開始（最初は 0、以降は `executed swap` のフレーム） */
  startFrame: number;
  /** 交代の要求のフレーム（最後の出場は undefined） */
  endFrame?: number;
  actions: GcsimActionRecord[];
}

export interface GcsimCooldownRecord {
  charIndex: number;
  type: 'skill' | 'burst';
  /** CTの開始（`cooldown triggered`） */
  startFrame: number;
  /** CTの終了（`cooldown ready`）。ログの終わりまでに終了しなければ undefined */
  readyFrame?: number;
  /** 短縮・リセットを反映する前のCTの長さ（フレーム） */
  originalFrames?: number;
  /** 短縮・リセットなどの操作（`forcefully ...`）があった場合のメッセージ */
  forced: { frame: number; msg: string }[];
}

export interface GcsimEffectRecord {
  key: string;
  /** 辞書のエントリ */
  entry: KeyCatalogEntry;
  /** 発動元のキャラ（char_index）。辞書で引けなかった・キャラに紐づかないときは undefined */
  sourceCharIndex?: number;
  /** 効果を受けたキャラ（char_index。-1 は敵）。チームバフは受け取るキャラごとに記録されるので、まとめている */
  recipients: number[];
  startFrame: number;
  /** 終了（`ended`）。-1 = 切れない効果 */
  endFrame: number;
  /** 効果を更新・延長した時刻（`refreshed` / `extended`） */
  refreshFrames: number[];
}

export interface GcsimCooldownWaitRecord {
  /** 実行できなかったアクション（skill / burst / swap ...） */
  action: string;
  charIndex: number;
  /** 待ち始めと、待ち終わり（最後に「実行できない」と出たフレーム）。実際に実行されるのは終わりの直後 */
  fromFrame: number;
  toFrame: number;
}

export interface GcsimLogSummary {
  /** ログの最後のフレーム */
  totalFrames: number;
  initialCharIndex: number;
  stints: GcsimStintRecord[];
  cooldowns: GcsimCooldownRecord[];
  effects: GcsimEffectRecord[];
  cooldownWaits: GcsimCooldownWaitRecord[];
  /** 辞書に無いキー（除外した）とその出現数。開発時に分かるよう記録する */
  unknownKeys: { key: string; count: number; sample: string }[];
  /** 辞書で「内部」とされたため除外した status イベントの数 */
  internalSkipped: number;
}

const STATUS_MSG = /^(?:.+ )?(?:mod|status) (added|refreshed|extended)$/;
const CT_WAIT_MSG = /^could not execute (\S+); action not ready$/;

export interface ReadGcsimLogOptions {
  members: GcsimMemberInfo[];
  lookup: KeyLookup;
  /** 実行結果の initial_character（キャラのキー）。無ければ先頭 */
  initialCharacterKey?: string;
}

export function readGcsimLog(logs: GcsimLogEvent[], options: ReadGcsimLogOptions): GcsimLogSummary {
  const { members, lookup } = options;
  const totalFrames = logs.reduce((m, l) => Math.max(m, l.frame), 0);
  const initialIdx = options.initialCharacterKey
    ? members.findIndex(m => m.gcsimKey === options.initialCharacterKey)
    : 0;
  const initialCharIndex = initialIdx >= 0 ? initialIdx : 0;

  // ---- 1. アクションと出場 ----
  const stints: GcsimStintRecord[] = [];
  let current: GcsimStintRecord | null = null;
  const openStint = (charIndex: number, startFrame: number) => {
    current = { charIndex, startFrame, actions: [] };
    stints.push(current);
  };
  openStint(initialCharIndex, 0);
  for (const l of logs) {
    if (l.event !== 'action') continue;
    if (l.msg.startsWith('swapping ')) {
      if (current) (current as GcsimStintRecord).endFrame = l.frame;
      continue;
    }
    const m = /^executed (\S+)$/.exec(l.msg);
    if (!m) continue;
    if (m[1] === 'swap') {
      openStint(l.char_index ?? 0, l.frame);
      continue;
    }
    (current as GcsimStintRecord | null)?.actions.push({ name: m[1], charIndex: l.char_index ?? 0, frame: l.frame });
  }
  // アクションの長さ = 次のアクション（または交代の要求）の開始まで
  for (const st of stints) {
    st.actions.forEach((a, i) => {
      const nextStart = st.actions[i + 1]?.frame ?? st.endFrame;
      if (nextStart !== undefined) a.frames = nextStart - a.frame;
    });
  }

  // ---- 2. スキル・爆発のCT ----
  const cooldowns: GcsimCooldownRecord[] = [];
  const openCd = new Map<string, GcsimCooldownRecord>();
  for (const l of logs) {
    if (l.event !== 'cooldown') continue;
    const type = (l.logs?.type as string | undefined) ?? l.msg.split(' ')[0];
    if (type !== 'skill' && type !== 'burst') continue;
    const idx = `${l.char_index ?? 0}:${type}`;
    if (l.msg.endsWith('cooldown triggered')) {
      const rec: GcsimCooldownRecord = {
        charIndex: l.char_index ?? 0,
        type,
        startFrame: l.frame,
        originalFrames: typeof l.logs?.original_cd === 'number' ? (l.logs.original_cd as number) : undefined,
        forced: [],
      };
      cooldowns.push(rec);
      openCd.set(idx, rec);
    } else if (l.msg.endsWith('cooldown ready')) {
      const rec = openCd.get(idx);
      if (rec && rec.readyFrame === undefined) rec.readyFrame = l.frame;
      openCd.delete(idx);
    } else if (l.msg.includes('forcefully')) {
      const rec = openCd.get(idx);
      if (rec) {
        rec.forced.push({ frame: l.frame, msg: l.msg });
        // リセット・破棄はその時点でCTが終わる（`ready` は出ない）。短縮は残りが減るだけで、終わりは `ready` を待つ
        if (/reset|discard/.test(l.msg) && rec.readyFrame === undefined) {
          rec.readyFrame = l.frame;
          openCd.delete(idx);
        }
      }
    }
  }

  // ---- 3. 効果（辞書で引く） ----
  const unknown = new Map<string, { count: number; sample: string }>();
  let internalSkipped = 0;
  // key + char_index ごとの、更新をまとめた発動
  interface Instance { key: string; entry: KeyCatalogEntry; charIndex: number; startFrame: number; endFrame: number; refreshFrames: number[] }
  const instances: Instance[] = [];
  const openInst = new Map<string, Instance>();
  for (const l of logs) {
    if (l.event !== 'status') continue;
    const sm = STATUS_MSG.exec(l.msg);
    if (!sm) continue;
    const key = (l.logs?.key as string | undefined) ?? (l.logs?.status as string | undefined);
    if (!key) continue;
    const entry = lookup(key);
    if (!entry) {
      const u = unknown.get(key) ?? { count: 0, sample: l.msg };
      u.count++;
      unknown.set(key, u);
      continue;
    }
    if (entry.kind === 'internal') {
      internalSkipped++;
      continue;
    }
    const charIndex = l.char_index ?? 0;
    const idx = `${key}\u0000${charIndex}`;
    if (sm[1] === 'added') {
      const inst: Instance = { key, entry, charIndex, startFrame: l.frame, endFrame: l.ended ?? -1, refreshFrames: [] };
      instances.push(inst);
      openInst.set(idx, inst);
    } else {
      // refreshed / extended: 直前の発動に対する更新。発動が無い（ログの途中から）ときは新しい発動として扱う
      let inst = openInst.get(idx);
      if (!inst || (inst.endFrame !== -1 && inst.endFrame < l.frame)) {
        inst = { key, entry, charIndex, startFrame: l.frame, endFrame: l.ended ?? -1, refreshFrames: [] };
        instances.push(inst);
        openInst.set(idx, inst);
      } else {
        inst.refreshFrames.push(l.frame);
        if (inst.endFrame !== -1 && typeof l.ended === 'number' && l.ended > inst.endFrame) inst.endFrame = l.ended;
      }
    }
  }

  // 発動元のキャラ: キャラの効果 = そのキャラ、武器・聖遺物の効果 = 装備しているキャラ
  const sourceOf = (entry: KeyCatalogEntry): number | undefined => {
    const o = entry.owner;
    let idx = -1;
    if (o.type === 'character') {
      idx = members.findIndex(m => m.gcsimKey === o.gcsimKey || (o.gcsimKeys ?? []).includes(m.gcsimKey));
    } else if (o.type === 'weapon') {
      idx = members.findIndex(m => m.weaponKey !== undefined && (m.weaponKey === o.gcsimKey || (o.gcsimKeys ?? []).includes(m.weaponKey)));
    } else if (o.type === 'artifact') {
      idx = members.findIndex(m => m.artifactKey !== undefined && (m.artifactKey === o.gcsimKey || (o.gcsimKeys ?? []).includes(m.artifactKey)));
    }
    return idx >= 0 ? idx : undefined;
  };

  // チームバフは受け取るキャラごとに記録されるので、同じキー・同じ開始・同じ終了は1つにまとめる
  const merged = new Map<string, GcsimEffectRecord>();
  for (const inst of instances) {
    const k = `${inst.key}\u0000${inst.startFrame}\u0000${inst.endFrame}`;
    const found = merged.get(k);
    if (found) {
      found.recipients.push(inst.charIndex);
      for (const f of inst.refreshFrames) if (!found.refreshFrames.includes(f)) found.refreshFrames.push(f);
    } else {
      merged.set(k, {
        key: inst.key,
        entry: inst.entry,
        sourceCharIndex: sourceOf(inst.entry),
        recipients: [inst.charIndex],
        startFrame: inst.startFrame,
        endFrame: inst.endFrame,
        refreshFrames: [...inst.refreshFrames],
      });
    }
  }
  const effects = [...merged.values()].sort((a, b) => a.startFrame - b.startFrame);
  for (const e of effects) e.refreshFrames.sort((a, b) => a - b);

  // ---- 4. CT待ち ----
  const cooldownWaits: GcsimCooldownWaitRecord[] = [];
  const openWait = new Map<string, GcsimCooldownWaitRecord>();
  for (const l of logs) {
    if (l.event !== 'sim') continue;
    const m = CT_WAIT_MSG.exec(l.msg);
    if (!m) continue;
    const charIndex = l.char_index ?? 0;
    const idx = `${m[1]}:${charIndex}`;
    const w = openWait.get(idx);
    if (w && l.frame - w.toFrame <= 1) {
      w.toFrame = l.frame;
    } else {
      const rec = { action: m[1], charIndex, fromFrame: l.frame, toFrame: l.frame };
      cooldownWaits.push(rec);
      openWait.set(idx, rec);
    }
  }

  return {
    totalFrames,
    initialCharIndex,
    stints,
    cooldowns,
    effects,
    cooldownWaits,
    unknownKeys: [...unknown.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.count - a.count),
    internalSkipped,
  };
}
