import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { GcsimLogSummary, GcsimMemberInfo } from '../utils/gcsim/readGcsimLog';
import { framesToSeconds } from '../utils/gcsim/readGcsimLog';
import type { SacrificialSearchInfo } from '../utils/gcsim/sacrificialSeed';
import { t, currentLanguage } from '../i18n';

interface GcsimLogSummaryViewProps {
  summary: GcsimLogSummary;
  members: GcsimMemberInfo[];
  seed: number;
  /** 辞書を生成した gcsim のコミット */
  gcsimCommit?: string;
  /** 祭礼系の武器があるときの、乱数の種の探索の結果（6-4。D80） */
  sacrificial?: SacrificialSearchInfo;
}

const sec = (frames: number | undefined, digits = 2) => (frames === undefined ? '—' : framesToSeconds(frames).toFixed(digits));

/** 表示名: 表示の言語の名前 → もう一方の言語の名前 → キー名（日本語では displayNameOf と同じ順） */
const entryName = (e: { name?: string; nameEn?: string; key: string }) =>
  (currentLanguage === 'en' ? e.nameEn ?? e.name : e.name ?? e.nameEn) ?? e.key;

/** gcsim の実行結果の読み取り結果（6-2 の確認用。書き戻しはしない） */
export const GcsimLogSummaryView: React.FC<GcsimLogSummaryViewProps> = ({ summary, members, seed, gcsimCommit, sacrificial }) => {
  const nameOf = (i: number | undefined) => (i === undefined ? '—' : i < 0 ? t('gcsim:log.enemy') : members[i]?.name ?? `#${i}`);
  const [showInternalDetail, setShowInternalDetail] = React.useState(false);

  const effects = summary.effects.filter(e => e.entry.kind === 'effect');
  const cooldownKeys = summary.effects.filter(e => e.entry.kind === 'cooldown');

  const th = 'px-1.5 py-0.5 text-left font-semibold text-slate-400 border-b border-slate-700';
  const td = 'px-1.5 py-0.5 border-b border-slate-800/70 align-top';

  return (
    <div className="space-y-3 text-[11px] text-slate-200">
      <div className="text-slate-400">
        {t('gcsim:log.summary', { total: sec(summary.totalFrames), stints: summary.stints.length, actions: summary.stints.reduce((n, s) => n + s.actions.length, 0), cooldowns: summary.cooldowns.length, effects: effects.length, cooldownKeys: cooldownKeys.length, internal: summary.internalSkipped, seed })}
        {gcsimCommit ? t('gcsim:log.commit', { commit: gcsimCommit.slice(0, 8) }) : ''}
      </div>

      {sacrificial && (
        <div className={`rounded-lg border p-2 ${sacrificial.ok ? 'border-emerald-800/70 bg-emerald-950/40 text-emerald-200' : 'border-amber-800/70 bg-amber-950/40 text-amber-200'}`}>
          {t('gcsim:log.sacrificial', { users: sacrificial.users.map(u => t('gcsim:log.sacrificialUser', { name: members[u.index]?.name ?? u.charKey, refine: u.refine })).join(currentLanguage === 'en' ? ', ' : '・') })}{' '}
          {sacrificial.ok
            ? t('gcsim:log.sacrificialOk', { expected: sacrificial.expected, seed: sacrificial.seed, searched: sacrificial.searched })
            : t('gcsim:log.sacrificialNg', { searched: sacrificial.searched, seed: sacrificial.seed, expected: sacrificial.expected, matched: sacrificial.matched, missing: sacrificial.missing, extras: sacrificial.extras })}
        </div>
      )}

      {summary.cooldownWaits.length > 0 && (
        <div className="rounded-lg border border-red-800/70 bg-red-950/50 p-2 space-y-0.5">
          <div className="font-bold text-red-300 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />{t('gcsim:log.waits', { count: summary.cooldownWaits.length })}
          </div>
          {summary.cooldownWaits.map((w, i) => (
            <div key={i} className="text-red-200">
              {nameOf(w.charIndex)}: {w.action} — {t('gcsim:log.waitLine', { from: sec(w.fromFrame), to: sec(w.toFrame), length: sec(w.toFrame - w.fromFrame + 1) })}
            </div>
          ))}
        </div>
      )}

      <section>
        <div className="font-bold text-amber-300 mb-1">{t('gcsim:log.stintsTitle')}</div>
        <div className="space-y-1">
          {summary.stints.map((st, i) => (
            <div key={i} className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1">
              <div className="text-slate-300">
                <span className="font-bold">#{i + 1} {nameOf(st.charIndex)}</span>{' '}
                {t('gcsim:log.stintStart', { start: sec(st.startFrame) })}{st.endFrame !== undefined ? t('gcsim:log.stintSwap', { end: sec(st.endFrame) }) : t('gcsim:log.stintLast')}
              </div>
              <div className="font-mono text-slate-400 break-words">
                {st.actions.map((a, j) => (
                  <span key={j} className="mr-2 whitespace-nowrap">{a.name}@{sec(a.frame)}({sec(a.frames)})</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="font-bold text-sky-300 mb-1">{t('gcsim:log.cooldownsTitle')}</div>
        <table className="w-full border-collapse">
          <thead><tr><th className={th}>{t('gcsim:log.colCharacter')}</th><th className={th}>{t('gcsim:log.colType')}</th><th className={th}>{t('gcsim:log.colStart')}</th><th className={th}>{t('gcsim:log.colEnd')}</th><th className={th}>{t('gcsim:log.colOriginal')}</th><th className={th}>{t('gcsim:log.colOperation')}</th></tr></thead>
          <tbody>
            {summary.cooldowns.map((c, i) => (
              <tr key={i}>
                <td className={td}>{nameOf(c.charIndex)}</td>
                <td className={td}>{c.type === 'skill' ? t('gcsim:log.typeSkill') : c.type === 'special' ? t('gcsim:log.typeSpecial') : t('gcsim:log.typeBurst')}</td>
                <td className={td}>{sec(c.startFrame)}s</td>
                <td className={td}>{c.readyFrame !== undefined ? `${sec(c.readyFrame)}s (${sec(c.readyFrame - c.startFrame)}s)` : '—'}</td>
                <td className={td}>{sec(c.originalFrames)}s</td>
                <td className={td}>{c.forced.map(f => `${sec(f.frame)}s ${f.msg}`).join(' / ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <div className="font-bold text-emerald-300 mb-1">{t('gcsim:log.effectsTitle')}</div>
        <table className="w-full border-collapse">
          <thead><tr><th className={th}>{t('gcsim:log.colEffect')}</th><th className={th}>{t('gcsim:log.colSource')}</th><th className={th}>{t('gcsim:log.colRange')}</th><th className={th}>{t('gcsim:log.colRefresh')}</th><th className={th}>{t('gcsim:log.colRecipients')}</th></tr></thead>
          <tbody>
            {effects.map((e, i) => (
              <tr key={i}>
                <td className={td} title={e.key}>
                  {entryName(e.entry)} <span className="text-slate-500 font-mono">[{e.entry.category}]</span>
                  <div className="text-[10px] text-slate-500 font-mono">{e.key}</div>
                </td>
                <td className={td}>{nameOf(e.sourceCharIndex)}</td>
                <td className={td}>{sec(e.startFrame)}s – {e.endFrame < 0 ? t('gcsim:log.never') : `${sec(e.endFrame)}s (${sec(e.endFrame - e.startFrame)}s)`}</td>
                <td className={td}>{e.refreshFrames.length > 0 ? t('gcsim:log.times', { count: e.refreshFrames.length }) : '—'}</td>
                <td className={td}>{e.recipients.map(nameOf).join(currentLanguage === 'en' ? ', ' : '・')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {cooldownKeys.length > 0 && (
        <section>
          <div className="font-bold text-sky-300 mb-1">{t('gcsim:log.cooldownKeysTitle')}</div>
          <div className="text-slate-400 break-words">
            {cooldownKeys.map((e, i) => (
              <span key={i} className="mr-2 whitespace-nowrap">{entryName(e.entry)}@{sec(e.startFrame)}s</span>
            ))}
          </div>
        </section>
      )}

      <section>
        <button className="text-slate-400 underline" onClick={() => setShowInternalDetail(v => !v)}>
          {t('gcsim:log.unknownKeys', { count: summary.unknownKeys.length })} {showInternalDetail ? '▲' : '▼'}
        </button>
        {showInternalDetail && (
          <div className="mt-1 text-slate-400 font-mono">
            {summary.unknownKeys.length === 0 ? t('gcsim:log.none') : summary.unknownKeys.map(u => `${u.key} ×${u.count}`).join(' / ')}
          </div>
        )}
      </section>
    </div>
  );
};
