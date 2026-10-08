import React, { useEffect, useState } from 'react';
import { X, Check, AlertTriangle, Copy, ShieldCheck, Loader2, Play } from 'lucide-react';
import type { GcsimConfigResult } from '../utils/gcsim/buildGcsimConfig';
import { validateGcsimConfig, runGcsimSample, type GcsimValidateResult } from '../utils/gcsim/gcsimClient';
import { runWithSacrificialSeed, type SacrificialSearchInfo } from '../utils/gcsim/sacrificialSeed';
import { readGcsimLog, type GcsimLogSummary } from '../utils/gcsim/readGcsimLog';
import { loadKeyCatalog } from '../utils/gcsim/keyCatalogLookup';
import { fetchRuntimeData } from '../utils/gcsim/runtimeData';
import { mapCtWaitsToActions, type CtWaitMarks } from '../utils/gcsim/mapCtWaits';
import { GcsimLogSummaryView } from './GcsimLogSummaryView';
import { applyPassiveTriggers, applyCharacterLinkedEffects } from '../utils/gcsim/applyBuffEffects';
import { CHARACTER_LINKED_EFFECTS } from '../masterdata/characterLinkedEffects';
import type { TriggerableBuffDefinition } from '../utils/buffUtils';
import { alignActions, applyActionDurations, applyActionCooldowns, applyActionEffectDurations, applyActionExtraEffects, type AlignResult, type ActionEffectKeyTable } from '../utils/gcsim/applyGcsimResult';
import { ACTION_EFFECT_KEY_OVERRIDES } from '../masterdata/actionEffectKeyOverrides';
import { ACTION_EFFECT_EXTRAS } from '../masterdata/actionEffectExtras';
import type { CalculatedRotation } from '../utils/rotationCalculator';
import type { Stint } from '../types/genshin';

/** 実行の乱数の種（祭礼リセットの種の探索は 6-4） */
const DEFAULT_SEED = 1;

interface GcsimConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: GcsimConfigResult | null;
  /** クリップボードへのコピーに成功したか */
  copied: boolean;
  onCopyAgain: () => void;
  /** アプリ自身のCT違反（スキル・爆発・発動バフ）。無ければ空 */
  ctIssues: { id: string; title: string; message: string }[];
  /** アプリ自身のCT警告（発動バフのCT中の発動。gcsim の計算は止めない）。無ければ空 */
  ctWarnings?: { id: string; title: string; message: string }[];
  /** gcsim の結果でCT待ちが生じたアクション（アクション ID → 待った秒数）を、違反マークとして渡す。無ければ null（マークを消す） */
  onCtWaits: (waits: Record<string, number> | null) => void;
  /** 設定文の元になった出場ブロック（書き戻し先） */
  stints: Stint[];
  /** 画面に出ている所要時間（計算後の出場ブロック。変更前の表示に使う） */
  calculated: CalculatedRotation;
  /** キャラ ID → 発動できる発動バフの定義（gcsim のキーとの対応付け用） */
  buffsByCharacter: Record<string, TriggerableBuffDefinition[]>;
  /** gcsim の結果を反映した出場ブロックを渡す（6-3。確認用の反映ボタン） */
  onApplyStints: (next: Stint[]) => void;
}

/** 「gcsim設定文をコピー」の結果（設定文と警告）を表示するポップアップ */
export const GcsimConfigDialog: React.FC<GcsimConfigDialogProps> = ({ isOpen, onClose, result, copied, onCopyAgain, ctIssues, ctWarnings = [], onCtWaits, stints, calculated, buffsByCharacter, onApplyStints }) => {
  // gcsim サーバーでの文法チェック（/validate）の結果
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<GcsimValidateResult | null>(null);
  // gcsim の実行結果の読み取り（6-2 の確認用。書き戻しはしない）
  const [running, setRunning] = useState(false);
  const [applied, setApplied] = useState(false);
  const [runOutcome, setRunOutcome] = useState<
    | { status: 'ok'; summary: GcsimLogSummary; seed: number; sacrificial?: SacrificialSearchInfo; gcsimCommit?: string; waits: CtWaitMarks; align: AlignResult; effectTable: ActionEffectKeyTable }
    /** 実行前のアプリのCT違反があるため、gcsim を実行しなかった（D21-1） */
    | { status: 'blocked' }
    | { status: 'error' | 'unreachable'; message: string }
    | null
  >(null);

  // ポップアップを開き直す・設定文が変わったら、前回のチェック結果を消す
  useEffect(() => {
    setValidation(null);
    setValidating(false);
    setRunOutcome(null);
    setRunning(false);
    setApplied(false);
  }, [isOpen, result?.config]);

  if (!isOpen || !result) return null;

  const handleValidate = async () => {
    const target = result.config;
    setValidating(true);
    setValidation(null);
    const res = await validateGcsimConfig(target);
    setValidating(false);
    setValidation(res);
  };
  const handleRun = async () => {
    setRunOutcome(null);
    // 実行前にアプリ自身のCT違反があれば、解消を促して実行しない
    if (ctIssues.length > 0) {
      setRunOutcome({ status: 'blocked' });
      return;
    }
    setRunning(true);
    // 祭礼系の武器があれば、アプリの発動がすべて発動し、余分な発動が無い乱数の種を探す（6-4・D86。無ければ、最初の種で 1 回だけ実行）
    const res = await runWithSacrificialSeed(result.config, runGcsimSample, { appProcs: calculated.sacrificialProcs, refs: result.actionRefs }, DEFAULT_SEED);
    if (res.status !== 'ok') {
      setRunning(false);
      setRunOutcome({ status: res.status, message: res.message });
      return;
    }
    const catalog = await loadKeyCatalog();
    const effectTable = (await fetchRuntimeData<{ entries: ActionEffectKeyTable }>('action_effect_keys.json')).entries;
    const summary = readGcsimLog(res.logs, { members: result.members, lookup: catalog.lookup, initialCharacterKey: res.initialCharacter });
    setRunning(false);
    // gcsim でCT待ちが生じたら、結果は反映せず、該当アクションに違反マークを付ける（D21-2）
    const waits = mapCtWaitsToActions(summary, result.actionRefs);
    onCtWaits(Object.keys(waits.byActionId).length > 0 ? waits.byActionId : null);
    setApplied(false);
    setRunOutcome({ status: 'ok', summary, seed: res.seed, sacrificial: res.sacrificial, gcsimCommit: catalog.gcsimCommit, waits, align: alignActions(summary, result.actionRefs), effectTable });
  };
  const waitCount = runOutcome?.status === 'ok' ? Object.keys(runOutcome.waits.byActionId).length : 0;
  const errors = result.warnings.filter(w => w.level === 'error');
  const warns = result.warnings.filter(w => w.level === 'warn');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h3 className="font-bold text-base text-white">gcsim 設定文</h3>
            <p className="text-[11px] text-slate-400">
              {copied ? 'クリップボードにコピーしました' : 'コピーできませんでした。下の文をコピーしてください'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {result.warnings.length === 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-300">
              <Check className="w-4 h-4" />
              <span>警告はありません</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {errors.length > 0 && (
                <div className="text-[11px] font-bold text-red-300">
                  gcsim で実行できない要素があります（設定文はできる範囲で出力しています）
                </div>
              )}
              {[...errors, ...warns].map((w, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border ${
                    w.level === 'error'
                      ? 'bg-red-950/50 border-red-800/70 text-red-200'
                      : 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* アプリ自身のCT違反（ガントチャートの判定と同じ） */}
          <div className="space-y-1.5">
            {ctIssues.length === 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                <Check className="w-4 h-4" />
                <span>アプリのCT違反: なし</span>
              </div>
            ) : (
              <>
                <div className="text-[11px] font-bold text-red-300">アプリのCT違反: {ctIssues.length}件（先に解消してください）</div>
                {ctIssues.map(issue => (
                  <div key={issue.id} className="flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border bg-red-950/50 border-red-800/70 text-red-200">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span><span className="font-bold">{issue.title}</span>: {issue.message}</span>
                  </div>
                ))}
              </>
            )}
            {ctWarnings.length > 0 && (
              <>
                <div className="text-[11px] font-bold text-amber-300">アプリのCT警告: {ctWarnings.length}件（発動バフがCT中に発動する配置は、効果が発動しないだけ。特殊スキルの受付時間外は、gcsim では通常のスキルになる。どちらも gcsim の計算は制限されません）</div>
                {ctWarnings.map(issue => (
                  <div key={issue.id} className="flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border bg-amber-950/40 border-amber-700/60 text-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span><span className="font-bold">{issue.title}</span>: {issue.message}</span>
                  </div>
                ))}
              </>
            )}
            <div className="text-[10px] text-slate-500">
              ※ アプリ自身の判定です。gcsim で実際に実行したときのCT待ち（アプリの判定と一致しないことがあります）は、下の「gcsim で実行して読み取り結果を見る」で確認できます。
            </div>
          </div>

          {/* 文法チェック（gcsim ローカルサーバーの /validate） */}
          <div className="space-y-1.5">
            <button
              onClick={handleValidate}
              disabled={validating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white border border-emerald-500/60"
              title="gcsim ローカルサーバー（localhost:54321）で、この設定文の文法をチェックします（実行はしません）"
            >
              {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>{validating ? 'チェック中...' : 'gcsim で文法チェック'}</span>
            </button>
            {validation && (
              <div
                className={`text-xs rounded-lg px-2.5 py-1.5 border whitespace-pre-wrap break-words ${
                  validation.status === 'ok'
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                    : validation.status === 'invalid'
                    ? 'bg-red-950/50 border-red-800/70 text-red-200'
                    : 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                }`}
              >
                {validation.status === 'invalid' && <div className="font-bold mb-0.5">文法エラー</div>}
                {validation.message}
              </div>
            )}
          </div>

          {/* gcsim の実行と読み取り結果（6-2 の確認用） */}
          <div className="space-y-1.5">
            <button
              onClick={handleRun}
              disabled={running || !result.runnable}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-700/80 hover:bg-sky-600 disabled:opacity-50 text-white border border-sky-500/60"
              title={result.runnable ? 'gcsim ローカルサーバーでこの設定文を1回実行し、ログの読み取り結果を表示します（アプリの値は書き換えません）' : '実行できない要素があります（上の赤い警告を解消してください）'}
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>{running ? '実行中...' : 'gcsim で実行して読み取り結果を見る'}</span>
            </button>
            {runOutcome && runOutcome.status === 'blocked' && (
              <div className="text-xs rounded-lg px-2.5 py-1.5 border bg-red-950/50 border-red-800/70 text-red-200">
                <div className="font-bold mb-0.5">gcsim を実行しませんでした</div>
                アプリのCT違反が {ctIssues.length} 件あります。先に解消してください（上の「アプリのCT違反」の一覧を参照）。
              </div>
            )}
            {runOutcome && (runOutcome.status === 'error' || runOutcome.status === 'unreachable') && (
              <div
                className={`text-xs rounded-lg px-2.5 py-1.5 border whitespace-pre-wrap break-words ${
                  runOutcome.status === 'error'
                    ? 'bg-red-950/50 border-red-800/70 text-red-200'
                    : 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                }`}
              >
                {runOutcome.status === 'error' && <div className="font-bold mb-0.5">gcsim の実行エラー</div>}
                {runOutcome.message}
              </div>
            )}
            {runOutcome && runOutcome.status === 'ok' && waitCount > 0 && (
              <div className="text-xs rounded-lg px-2.5 py-1.5 border bg-red-950/50 border-red-800/70 text-red-200">
                <div className="font-bold mb-0.5">gcsim でCT待ちが生じたため、結果を反映していません</div>
                {waitCount} 件のアクションに、CT違反と同じ印を付けました（残りCT = gcsim で実際に待った秒数）。
                ガントチャートの該当アクションを直して、もう一度実行してください。
                {runOutcome.waits.swapWaits > 0 && `（交代の内部CT待ち ${runOutcome.waits.swapWaits} 件は対象外）`}
                {runOutcome.waits.unmatched.length > 0 && `（アプリのアクションに対応付けできなかった待ち ${runOutcome.waits.unmatched.length} 件）`}
              </div>
            )}
            {runOutcome && runOutcome.status === 'ok' && waitCount === 0 && (() => {
              if (runOutcome.align.mismatch) {
                return (
                  <div className="text-xs rounded-lg px-2.5 py-1.5 border bg-amber-950/40 border-amber-700/60 text-amber-200">
                    設定文と gcsim のログのアクションの並びが合わないため、反映できません: {runOutcome.align.mismatch}
                  </div>
                );
              }
              // 変更前は、画面に出ている値（計算後）を使う
              const effectiveDurations: Record<string, number> = {};
              for (const st of calculated.calculatedStints) for (const a of st.actions) effectiveDurations[a.id] = a.duration;
              const effectiveCooldowns: Record<string, number> = {};
              for (const cd of [...calculated.skillCooldowns, ...calculated.burstCooldowns]) {
                if (cd.actionInstanceId) effectiveCooldowns[cd.actionInstanceId] = cd.duration;
              }
              const durations = applyActionDurations(stints, runOutcome.align.pairs, effectiveDurations);
              const specialActionIds = new Set(calculated.calculatedStints.flatMap(st => st.actions).filter(a => a.cooldownPool === 'special').map(a => a.id));
              // 祭礼の武器を持つキャラのスキルの CT は、書き戻さない（発動による CT のリセットは、アプリの計算が持つ。書き戻すと、CT がすでに短く、発動の判定と武器の内部 CT の管理が失われる）
              const sacrificialSkillIds = new Set(
                calculated.calculatedStints.filter(st => calculated.sacrificialCharIds.includes(st.characterId)).flatMap(st => st.actions).filter(a => a.type === 'skill' || a.type === 'skill_hold').map(a => a.id),
              );
              const cooldowns = applyActionCooldowns(durations.stints, runOutcome.align.pairs, runOutcome.summary, effectiveCooldowns, specialActionIds, calculated.cdResonanceScale, sacrificialSkillIds);
              const effectiveEffects: Record<string, number> = {};
              for (const b of calculated.activeBuffs) {
                if (b.origin === 'passive') continue;
                for (const a of stints.flatMap(st => st.actions)) {
                  if (b.id.includes(`_${a.id}_`)) effectiveEffects[a.id] = b.duration;
                }
              }
              const effects = applyActionEffectDurations(cooldowns.stints, runOutcome.align.pairs, runOutcome.summary, runOutcome.effectTable, ACTION_EFFECT_KEY_OVERRIDES, effectiveEffects);
              const extras = applyActionExtraEffects(effects.stints, runOutcome.align.pairs, runOutcome.summary, ACTION_EFFECT_EXTRAS);
              const passives = applyPassiveTriggers(extras.stints, runOutcome.align.pairs, runOutcome.summary, result.members, buffsByCharacter, result.swapDelayFrames);
              const charEffects = applyCharacterLinkedEffects(passives.stints, runOutcome.align.pairs, runOutcome.summary, result.members, CHARACTER_LINKED_EFFECTS, result.swapDelayFrames);
              const total = durations.changes.length + cooldowns.changes.length + effects.changes.length + extras.changes.length + passives.changes.length + charEffects.changes.length;
              // 誰の（何番目の出場の）アクションか
              const ownerLabel = (stintId: string) => {
                const idx = stints.findIndex(st => st.id === stintId);
                const owner = idx >= 0 ? result.members.find(m => m.characterId === stints[idx].characterId)?.name : undefined;
                return `${owner ?? '?'}${idx >= 0 ? `（出場 #${idx + 1}）` : ''}`;
              };
              return (
                <div className="text-xs rounded-lg px-2.5 py-1.5 border bg-sky-950/40 border-sky-700/60 text-sky-100 space-y-1">
                  <div className="font-bold">アクションの所要時間: {durations.changes.length} 件が変わります（1周目の値。遅延は変えません）</div>
                  {durations.changes.length > 0 && (
                    <div className="font-mono text-[11px] text-sky-200 max-h-32 overflow-y-auto">
                      {durations.changes.map(c => (
                        <div key={c.actionId}>{ownerLabel(c.stintId)} {c.name}: {c.before.toFixed(3)}s → {c.after.toFixed(3)}s</div>
                      ))}
                    </div>
                  )}
                  <div className="font-bold">スキル・爆発のCT: {cooldowns.changes.length} 件が変わります（CTの長さ / 開始位置 = アクション開始から）</div>
                  {cooldowns.changes.length > 0 && (
                    <div className="font-mono text-[11px] text-sky-200 max-h-32 overflow-y-auto">
                      {cooldowns.changes.map(c => (
                        <div key={c.actionId}>
                          {ownerLabel(c.stintId)} {c.name}: CT {c.before.toFixed(2)}s → {c.after.toFixed(2)}s
                          {c.startOffset !== undefined ? `（開始 +${c.startOffset.toFixed(2)}s）` : '（CTなし）'}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="font-bold">スキル・爆発の効果時間: {effects.changes.length} 件が変わります（gcsim のキーの状態。ある分だけ）</div>
                  {effects.changes.length > 0 && (
                    <div className="font-mono text-[11px] text-sky-200 max-h-32 overflow-y-auto">
                      {effects.changes.map(c => (
                        <div key={c.actionId} title={c.key}>
                          {ownerLabel(c.stintId)} {c.name}: 効果 {c.before.toFixed(2)}s → {c.after.toFixed(2)}s
                          <span className="text-sky-400/70"> [{c.key}]</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="font-bold">副次効果のバー: {extras.changes.length} 件のアクションが変わります（1つのアクションから繰り返し発生する効果）</div>
                  {extras.changes.length > 0 && (
                    <div className="font-mono text-[11px] text-sky-200 max-h-32 overflow-y-auto">
                      {extras.changes.map(c => (
                        <div key={c.actionId}>
                          {ownerLabel(c.stintId)} {c.name}: {c.extras.length === 0 ? '（なし）' : c.extras.map(x => `${x.name.replace(/（.*$/, '')} +${x.offset.toFixed(2)}s/${x.duration.toFixed(1)}s`).join(', ')}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="font-bold">発動バフ（固有天賦・武器・聖遺物）: {passives.changes.length} 件が変わります（追加 {passives.changes.filter(c => c.kind === 'add').length} / 更新 {passives.changes.filter(c => c.kind === 'update').length} / gcsim に出なかった手動の発動 {passives.changes.filter(c => c.kind === 'missed').length}）</div>
                  {passives.changes.length > 0 && (
                    <div className="font-mono text-[11px] text-sky-200 max-h-32 overflow-y-auto">
                      {passives.changes.map((c, i) => (
                        <div key={i} title={c.key}>
                          {ownerLabel(c.stintId)} {c.name}:{' '}
                          {c.kind === 'missed'
                            ? `gcsim の結果に出ませんでした（残して印を付けます。+${(c.offset ?? 0).toFixed(2)}s）`
                            : `${c.kind === 'add' ? '追加' : '更新'} +${(c.offset ?? 0).toFixed(2)}s / 効果 ${(c.duration ?? 0).toFixed(2)}s${c.cooldown !== undefined ? ` / CT ${c.cooldown.toFixed(2)}s` : ''}`}
                          {c.before && <span className="text-sky-400/70">（変更前 +{c.before.offset.toFixed(2)}s{c.before.duration !== undefined ? ` / 効果 ${c.before.duration.toFixed(2)}s` : ''}）</span>}
                          {c.warnBeforeStint && <span className="text-amber-300"> ※発動元の出場の前に起きた効果。出場の先頭に置きます</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="font-bold">キャラクターに紐づく効果: {charEffects.changes.length} 件の出場ブロックが変わります（命中・反応由来。直前の出場ブロックに表示）</div>
                  {charEffects.changes.length > 0 && (
                    <div className="font-mono text-[11px] text-sky-200 max-h-32 overflow-y-auto">
                      {charEffects.changes.map(c => (
                        <div key={c.stintId}>
                          {ownerLabel(c.stintId)}: {c.effects.length === 0 ? '（なし）' : c.effects.map(x => `${x.name.replace(/（.*$/, '')} ${x.offset >= 0 ? '+' : ''}${x.offset.toFixed(2)}s/${x.duration.toFixed(1)}s`).join(', ')}
                        </div>
                      ))}
                    </div>
                  )}
                  {effects.missingDefs.length > 0 && (
                    <div className="text-[11px] text-amber-200">
                      効果のキーの対応表に無いアクション定義があり、効果時間は書き戻していません: {effects.missingDefs.join(' / ')}（scripts/probe-effect-keys.ts で表を作り直してください）
                    </div>
                  )}
                  <button
                    onClick={() => { onApplyStints(charEffects.stints); setApplied(true); }}
                    disabled={applied || total === 0}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white border border-sky-400/60"
                    title="編集済みの所要時間・CTも、gcsim の値で上書きします"
                  >
                    {applied ? '反映しました' : 'gcsim の結果をアプリに反映'}
                  </button>
                </div>
              );
            })()}
            {runOutcome && runOutcome.status === 'ok' && (
              <GcsimLogSummaryView summary={runOutcome.summary} members={result.members} seed={runOutcome.seed} gcsimCommit={runOutcome.gcsimCommit} sacrificial={runOutcome.sacrificial} />
            )}
          </div>

          <textarea
            readOnly
            value={result.config}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full h-72 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400 resize-y"
          />
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={onCopyAgain}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>もう一度コピー</span>
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
