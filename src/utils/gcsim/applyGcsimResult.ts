/**
 * gcsim の結果 → アプリの編集できる値への書き戻し（フェーズ6 / 6-3、D20）
 *
 * 純粋関数。書き戻しは1周目（初動 + ループ1周目）の値を使う（CT待ちが無ければ周ごとの結果は一致する。D21）。
 *   6-3a: アクションの所要時間（このファイル）
 * ユーザーが手で入れた値は、上書きで失われる（D20。編集済みの所要時間も上書き。D27-2）。
 */
import type { CharacterActionInstance, Stint } from '../../types/genshin.ts';
import { actionDelayOf } from '../actionDelay.ts';
import type { GcsimActionRef } from './buildGcsimConfig.ts';
import { framesToSeconds, type GcsimActionRecord, type GcsimLogSummary } from './readGcsimLog.ts';

export interface AlignedAction {
  /** gcsim のログのアクション */
  executed: GcsimActionRecord;
  /** 設定文のアクション（アプリのアクション ID を持つ） */
  ref: GcsimActionRef;
}

export interface AlignResult {
  pairs: AlignedAction[];
  /** 設定文とログで、アクションの並びが合わなかったときの説明（合っていれば undefined） */
  mismatch?: string;
}

/** 書き戻しに使う周: 初動 と ループ1周目 */
export const isFirstLap = (ref: GcsimActionRef): boolean => ref.phase === 'initial' || ref.loopIteration === 1;

/**
 * gcsim のログのアクション（交代を除く実行順）と、設定文のアクション（actionRefs）を、先頭から順に対応付ける。
 * 命令の種類が食い違ったら、対応付けを信用できないので mismatch にする（書き戻さない）。
 */
export function alignActions(summary: GcsimLogSummary, refs: GcsimActionRef[]): AlignResult {
  const executed = summary.stints.flatMap(st => st.actions).sort((a, b) => a.frame - b.frame);
  const pairs: AlignedAction[] = [];
  const count = Math.min(executed.length, refs.length);
  for (let i = 0; i < count; i++) {
    if (executed[i].name !== refs[i].command) {
      return {
        pairs: [],
        mismatch: `${i + 1} 番目のアクションが一致しません（設定文: ${refs[i].command} / gcsim のログ: ${executed[i].name}）`,
      };
    }
    pairs.push({ executed: executed[i], ref: refs[i] });
  }
  if (executed.length < refs.length) {
    return { pairs, mismatch: `gcsim のログのアクションが設定文より少ないです（${executed.length} / ${refs.length} 件）。途中で止まった可能性があります` };
  }
  return { pairs };
}

export interface DurationChange {
  stintId: string;
  actionId: string;
  name: string;
  before: number;
  after: number;
}

export interface ApplyDurationsResult {
  stints: Stint[];
  changes: DurationChange[];
  /** gcsim の値が取れなかったアクション（ログの最後のアクションなど）の数 */
  skipped: number;
}

/**
 * アクションの所要時間を書き戻す。
 * gcsim のログで分かるのは「次のアクションの開始までの間隔」= 所要時間 + アプリが渡した遅延（delay）。
 * 所要時間 = 間隔 − 遅延。遅延の値は変えない（渡した値のまま）。
 */
export function applyActionDurations(
  stints: Stint[],
  pairs: AlignedAction[],
  /** 画面に出ている所要時間（アクション ID → 秒。次に続くアクションに応じた自動値など、計算後の値）。変更前の表示と差の判定に使う。無ければ保存値 */
  effectiveDurations?: Record<string, number>,
): ApplyDurationsResult {
  const actionById = new Map<string, CharacterActionInstance>();
  for (const st of stints) for (const a of st.actions) actionById.set(a.id, a);

  const next = new Map<string, { seconds: number; base: number }>();
  const changes: DurationChange[] = [];
  let skipped = 0;
  for (const { executed, ref } of pairs) {
    if (!isFirstLap(ref)) continue;
    const act = actionById.get(ref.actionId);
    if (!act) continue;
    if (executed.frames === undefined) {
      skipped++;
      continue;
    }
    // 標準より長くした分（遅延に足して渡した分）は、所要時間に含まれる。gcsim 自身の所要時間は、それを引いた値
    const extra = ref.extraSeconds ?? 0;
    const delayFrames = Math.max(0, Math.round((actionDelayOf(act) + extra) * 60));
    const seconds = Number((framesToSeconds(executed.frames - delayFrames) + extra).toFixed(3));
    if (seconds < 0) {
      skipped++;
      continue;
    }
    next.set(ref.actionId, { seconds, base: Number(Math.max(0.05, seconds - extra).toFixed(3)) });
    const before = effectiveDurations?.[ref.actionId] ?? act.duration;
    if (Math.abs(seconds - before) >= 0.0005) {
      changes.push({ stintId: ref.stintId, actionId: ref.actionId, name: act.name, before, after: seconds });
    }
  }

  const updated = stints.map(st => {
    if (!st.actions.some(a => next.has(a.id))) return st;
    return {
      ...st,
      actions: st.actions.map(a => (next.has(a.id) ? { ...a, duration: next.get(a.id)!.seconds, durationManual: true, gcsimBaseDuration: next.get(a.id)!.base } : a)),
    };
  });
  return { stints: updated, changes, skipped };
}

export interface CooldownChange {
  stintId: string;
  actionId: string;
  name: string;
  type: 'skill' | 'burst' | 'special';
  /** 変更前のCTの長さ（画面に出ている値。CTが無ければ 0） */
  before: number;
  /** gcsim のCTの長さ。CTが発生しなかったアクションは 0 */
  after: number;
  /** gcsim のCT開始位置（アクションの開始から。CTが無ければ undefined） */
  startOffset?: number;
}

export interface ApplyCooldownsResult {
  stints: Stint[];
  changes: CooldownChange[];
}

/**
 * スキル・爆発のCTと、CTの開始位置（D37）を書き戻す。
 *   CTの長さ = `cooldown triggered` 〜 `cooldown ready`（短縮・リセットを反映。`ready` が無ければ元の長さ）
 *   CTの開始位置 = `triggered` − アクションの開始（`gcsimCtOffset` に保存。ユーザーは編集できない）
 * アクションに対応するCTは、そのアクションの開始から、同じキャラの同じ種類の次のアクションの開始までの間の最初の `triggered`。
 * 無ければ「CTが発生しなかった」（窓の中の E など）として cooldown = 0（D27-1）。
 */
export function applyActionCooldowns(
  stints: Stint[],
  pairs: AlignedAction[],
  summary: GcsimLogSummary,
  /** 画面に出ているCTの長さ（アクション ID → 秒） */
  effectiveCooldowns?: Record<string, number>,
  /** CTが特殊元素スキルの枠（`special_skill`。スキルとは別のCT）のアクション ID */
  specialActionIds?: Set<string>,
  /** 書き戻す CT が含む風元素共鳴の倍率（0.95 / 1）。編成の共鳴が変わったときの補正に使う */
  cdResonance = 1,
): ApplyCooldownsResult {
  const actionById = new Map<string, CharacterActionInstance>();
  for (const st of stints) for (const a of st.actions) actionById.set(a.id, a);

  const executedAll = pairs.map(p => p.executed);
  const next = new Map<string, { cooldown: number; offset?: number }>();
  const changes: CooldownChange[] = [];

  for (const { executed, ref } of pairs) {
    if (!isFirstLap(ref)) continue;
    if (ref.command !== 'skill' && ref.command !== 'burst') continue;
    const act = actionById.get(ref.actionId);
    if (!act) continue;
    // 特殊元素スキル（オデットの spE など）は、gcsim では同じ `skill` 命令だが、CTは `special_skill`（別枠）
    const type: 'skill' | 'burst' | 'special' = ref.command === 'skill' && specialActionIds?.has(ref.actionId) ? 'special' : ref.command;

    const nextSameKind = executedAll
      .filter(e => e.charIndex === executed.charIndex && e.name === executed.name && e.frame > executed.frame)
      .reduce((m, e) => Math.min(m, e.frame), Infinity);
    const inWindow = (c: { charIndex: number; startFrame: number }) =>
      c.charIndex === executed.charIndex && c.startFrame >= executed.frame && c.startFrame < nextSameKind;
    // フリンズの嵐槍は、特殊スキルだが、gcsim は CT を `skill` 種別のログで出す（`special_skill` ではない。flins/skill.go の自前のログ）。
    // 特殊スキルの記録が無ければ、同じ範囲の `skill` 種別の記録を使う（受付の外で使って通常のスキルになった場合も、実際の CT を反映できる）
    const record = summary.cooldowns.find(c => c.type === type && inWindow(c))
      ?? (type === 'special' ? summary.cooldowns.find(c => c.type === 'skill' && inWindow(c)) : undefined);

    let cooldown = 0;
    let offset: number | undefined;
    if (record) {
      const lengthFrames = record.readyFrame !== undefined ? record.readyFrame - record.startFrame : record.originalFrames;
      if (lengthFrames === undefined) continue; // 長さが分からない（ログの最後まで終わらない）
      cooldown = Number(framesToSeconds(lengthFrames).toFixed(3));
      offset = Number(framesToSeconds(record.startFrame - executed.frame).toFixed(3));
    }
    next.set(ref.actionId, { cooldown, offset });

    const before = effectiveCooldowns?.[ref.actionId] ?? act.cooldown ?? 0;
    const beforeOffset = act.gcsimCtOffset;
    if (Math.abs(cooldown - before) >= 0.0005 || (offset !== undefined && Math.abs(offset - (beforeOffset ?? 0)) >= 0.0005)) {
      changes.push({ stintId: ref.stintId, actionId: ref.actionId, name: act.name, type, before, after: cooldown, startOffset: offset });
    }
  }

  const updated = stints.map(st => {
    if (!st.actions.some(a => next.has(a.id))) return st;
    return {
      ...st,
      actions: st.actions.map(a => {
        const v = next.get(a.id);
        if (!v) return a;
        const { gcsimCtOffset: _old, ...rest } = a;
        return { ...rest, cooldown: v.cooldown, gcsimCdResonance: cdResonance, ...(v.offset !== undefined ? { gcsimCtOffset: v.offset } : {}) };
      }),
    };
  });
  return { stints: updated, changes };
}

/**
 * スキル・爆発の効果に対応する gcsim のキー（public/data/action_effect_keys.json の entries）。
 * キー = アクション定義 ID。status: ok = キーあり / nokey = 効果の状態のキーが無い / unprobed = 収集できなかった（手で補う）
 */
export type ActionEffectKeyTable = Record<string, {
  status: 'ok' | 'nokey' | 'unprobed';
  keys: { key: string }[];
  /** 効果時間の本体のキー（候補が複数のとき、マスターの効果時間に最も近いキー）。あればこれだけを使う */
  primary?: string;
  /** primary の効果時間の求め方（既定 expiry） */
  mode?: EffectDurationMode;
  /** primary のイベントを、実行したキャラ自身のものだけ使う（夜魂の状態など、全員で同じキーを使うもの） */
  self?: boolean;
}>;

/**
 * 効果時間の求め方
 *   expiry … 最初のイベントの「終了予定 − 発生」（窓の中の延長 `extended` を含む）。状態・設置物・シールド・継続ダメージ
 *   ended  … 最初のイベントの「実際の終了 − 発生」（分からなければ終了予定）。終了予定を持たず、条件で終わる状態（夜魂の状態など）
 *   span   … 窓の中の最後のイベント − 最初のイベント。効果の間ずっと更新され続ける状態（神里綾人の爆発など）
 */
export type EffectDurationMode = 'expiry' | 'ended' | 'span';

/** 手で補う一覧の値: キーだけ（expiry）か、求め方・自分限定つき */
export type EffectKeyOverride = string | { key: string; mode?: EffectDurationMode; self?: boolean; /** 状況によって別のキーで出る場合の代替（例: デュリンの爆発は白の姿と黒の姿でキーが違う）。イベントがあったキーのうち、効果が長いものを使う */ alt?: string[] };

export interface EffectDurationChange {
  stintId: string;
  actionId: string;
  name: string;
  /** 使った gcsim のキー */
  key: string;
  /** 変更前の効果時間（画面に出ている値。効果バーが無ければ 0） */
  before: number;
  after: number;
}

export interface ApplyEffectDurationsResult {
  stints: Stint[];
  changes: EffectDurationChange[];
  /** 対応表に載っていないアクション定義 ID（新しいキャラ・アクションなど。書き戻さなかった）。表を作り直す目印 */
  missingDefs: string[];
}

/**
 * スキル・爆発の効果時間を書き戻す（D20）。
 *   対応表（アクション定義 ID → gcsim キー）でキーを絞り込み、そのアクションの開始から、同じキャラの同じ種類の次のアクションの開始までの間に
 *   起きた、最初の効果イベント（added / refreshed / extended）の「終了予定 − 発生」を効果時間にする。
 *   窓は全周で取る（2周目の先頭で始まる効果を1周目のアクションのものと誤らないため）。書き込みは1周目のアクションだけ。
 *   イベントが無いアクション・切れない効果は書き換えない（CTと違い、効果が出ないことは誤りとは限らない）。
 *   使うキー: 手で補う一覧（overrides）→ 表の primary（候補が複数のとき、マスターの効果時間に最も近いキー）→ 表のキーの中で効果が長いもの。
 */
export function applyActionEffectDurations(
  stints: Stint[],
  pairs: AlignedAction[],
  summary: GcsimLogSummary,
  table: ActionEffectKeyTable,
  /** 手で補う一覧（アクション定義 ID → キー。空文字 = 書き戻さない） */
  overrides: Record<string, EffectKeyOverride> = {},
  /** 画面に出ている効果時間（アクション ID → 秒） */
  effectiveEffects?: Record<string, number>,
): ApplyEffectDurationsResult {
  const actionById = new Map<string, CharacterActionInstance>();
  for (const st of stints) for (const a of st.actions) actionById.set(a.id, a);

  const executedAll = pairs.map(p => p.executed);
  const next = new Map<string, number>();
  const changes: EffectDurationChange[] = [];
  const missing = new Set<string>();

  for (const { executed, ref } of pairs) {
    if (!isFirstLap(ref)) continue;
    if (ref.command !== 'skill' && ref.command !== 'burst') continue;
    const act = actionById.get(ref.actionId);
    if (!act) continue;

    const defId = act.actionTypeId;
    const override = overrides[defId];
    if (override === '') continue;
    const entry = table[defId];
    if (!entry && override === undefined) {
      missing.add(defId);
      continue;
    }
    const ov = typeof override === 'string' ? (override ? { key: override } : undefined) : override;
    const candidates = ov ? [ov.key, ...(ov.alt ?? [])] : entry?.primary ? [entry.primary] : (entry?.keys ?? []).map(c => c.key);
    if (candidates.length === 0) continue;
    const mode: EffectDurationMode = ov ? ov.mode ?? 'expiry' : entry?.mode ?? 'expiry';
    const selfOnly = ov ? ov.self === true : entry?.self === true;

    const nextSameKind = executedAll
      .filter(e => e.charIndex === executed.charIndex && e.name === executed.name && e.frame > executed.frame)
      .reduce((m, e) => Math.min(m, e.frame), Infinity);

    // 窓の中の、候補のキーごとの最初のイベント → 効果時間。長い順（同じなら表の順）
    let best: { key: string; seconds: number } | undefined;
    for (const key of candidates) {
      const inWindow = summary.effectEvents
        .filter(e => e.key === key && e.frame >= executed.frame && e.frame < nextSameKind && (!selfOnly || e.charIndex === executed.charIndex))
        .sort((a, b) => a.frame - b.frame);
      const ev = inWindow[0];
      if (!ev) continue;
      let seconds: number;
      if (mode === 'ended') {
        // 実際の終了。分からなければ終了予定
        const endFrame = ev.ended > ev.frame ? ev.ended : ev.expiry > ev.frame ? ev.expiry : -1;
        if (endFrame < 0) continue;
        seconds = Number(framesToSeconds(endFrame - ev.frame).toFixed(3));
      } else if (mode === 'span') {
        const lastFrame = inWindow[inWindow.length - 1].frame;
        if (lastFrame <= ev.frame) continue;
        seconds = Number(framesToSeconds(lastFrame - ev.frame).toFixed(3));
      } else {
        if (ev.expiry <= 0) continue;
        // 効果の途中で延長された（`extended`）分を含めて、窓の中の最後の終了予定までを効果時間にする（更新 `refreshed` は別の発動なので含めない）
        const lastExpiry = inWindow.reduce((m, e) => (e.kind === 'extended' && e.expiry > 0 ? Math.max(m, e.expiry) : m), ev.expiry);
        seconds = Number(framesToSeconds(lastExpiry - ev.frame).toFixed(3));
      }
      if (!best || seconds > best.seconds) best = { key, seconds };
    }
    if (!best) continue;

    next.set(ref.actionId, best.seconds);
    const before = effectiveEffects?.[ref.actionId] ?? act.effectDuration ?? 0;
    if (Math.abs(best.seconds - before) >= 0.0005) {
      changes.push({ stintId: ref.stintId, actionId: ref.actionId, name: act.name, key: best.key, before, after: best.seconds });
    }
  }

  const updated = stints.map(st => {
    if (!st.actions.some(a => next.has(a.id))) return st;
    return { ...st, actions: st.actions.map(a => (next.has(a.id) ? { ...a, effectDuration: next.get(a.id)! } : a)) };
  });
  return { stints: updated, changes, missingDefs: [...missing] };
}

/** chain 方式で、前のイベントの終了予定から次のイベントまでの隙間がこのフレーム数以内なら、同じバーにする（更新の間隔が効果時間よりわずかに長い印など） */
const CHAIN_GAP_FRAMES = 12;

export interface ExtraEffectChange {
  stintId: string;
  actionId: string;
  name: string;
  /** 書き込む副次効果（開始位置・継続時間つき） */
  extras: { key: string; name: string; offset: number; duration: number }[];
}

export interface ApplyExtraEffectsResult {
  stints: Stint[];
  changes: ExtraEffectChange[];
}

/**
 * 副次効果（スキル・爆発に付随して繰り返し発生する継続効果）を書き戻す。
 * 対応表（アクション定義 ID → キーと表示名）にあるアクションだけが対象。
 * アクションの開始から、同じキャラの同じ種類の次のアクションの開始までの間に起きたイベント（added / refreshed）ごとに1本のバーにする。
 * 対応表にあるアクションで、イベントが無ければ、副次効果を空にする（前回の結果を残さない）。書き込みは1周目のアクションだけ。
 */
export function applyActionExtraEffects(
  stints: Stint[],
  pairs: AlignedAction[],
  summary: GcsimLogSummary,
  extrasTable: Record<string, { key: string; label: string; self?: boolean; mode?: 'each' | 'chain' }[]>,
): ApplyExtraEffectsResult {
  const actionById = new Map<string, CharacterActionInstance>();
  for (const st of stints) for (const a of st.actions) actionById.set(a.id, a);

  const executedAll = pairs.map(p => p.executed);
  const next = new Map<string, { key: string; name: string; offset: number; duration: number }[]>();
  const changes: ExtraEffectChange[] = [];

  for (const { executed, ref } of pairs) {
    if (!isFirstLap(ref)) continue;
    const act = actionById.get(ref.actionId);
    const defs = act ? extrasTable[act.actionTypeId] : undefined;
    if (!act || !defs) continue;

    const nextSameKind = executedAll
      .filter(e => e.charIndex === executed.charIndex && e.name === executed.name && e.frame > executed.frame)
      .reduce((m, e) => Math.min(m, e.frame), Infinity);

    const extras: { key: string; name: string; offset: number; duration: number }[] = [];
    for (const def of defs) {
      const keyRe = def.key.includes('*') ? new RegExp('^' + def.key.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$') : undefined;
      const inWindow = summary.effectEvents
        .filter(e => (keyRe ? keyRe.test(e.key) : e.key === def.key) && e.frame >= executed.frame && e.frame < nextSameKind && e.expiry > e.frame && (!def.self || e.charIndex === executed.charIndex))
        .sort((a, b) => a.frame - b.frame);
      if (def.mode === 'chain') {
        // 更新・延長が続く間を、1本のバーにする（前のイベントの終了予定より前に次のイベントが起きれば、同じバー）
        let start = -1;
        let end = -1;
        const flush = () => {
          if (start >= 0) {
            extras.push({ key: def.key, name: def.label, offset: Number(framesToSeconds(start - executed.frame).toFixed(3)), duration: Number(framesToSeconds(end - start).toFixed(3)) });
          }
        };
        for (const ev of inWindow) {
          if (start >= 0 && ev.frame <= end + CHAIN_GAP_FRAMES) {
            end = Math.max(end, ev.expiry);
          } else {
            flush();
            start = ev.frame;
            end = ev.expiry;
          }
        }
        flush();
      } else {
        // 既定: added / refreshed のイベントごとに1本
        for (const ev of inWindow.filter(e => e.kind === 'added' || e.kind === 'refreshed')) {
          extras.push({
            key: def.key,
            name: def.label,
            offset: Number(framesToSeconds(ev.frame - executed.frame).toFixed(3)),
            duration: Number(framesToSeconds(ev.expiry - ev.frame).toFixed(3)),
          });
        }
      }
    }
    extras.sort((a, b) => a.offset - b.offset);
    next.set(ref.actionId, extras);
    if (JSON.stringify(extras) !== JSON.stringify(act.extraEffects ?? [])) {
      changes.push({ stintId: ref.stintId, actionId: ref.actionId, name: act.name, extras });
    }
  }

  const updated = stints.map(st => {
    if (!st.actions.some(a => next.has(a.id))) return st;
    return {
      ...st,
      actions: st.actions.map(a => {
        const v = next.get(a.id);
        if (!v) return a;
        const { extraEffects: _old, ...rest } = a;
        return v.length > 0 ? { ...rest, extraEffects: v } : rest;
      }),
    };
  });
  return { stints: updated, changes };
}
