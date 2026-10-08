import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { GcsimLogSummary, GcsimMemberInfo } from '../utils/gcsim/readGcsimLog';
import { framesToSeconds } from '../utils/gcsim/readGcsimLog';
import type { SacrificialSearchInfo } from '../utils/gcsim/sacrificialSeed';

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

/** 表示名: 日本語名 → 英語名 → キー名（displayNameOf と同じ順） */
const entryName = (e: { name?: string; nameEn?: string; key: string }) => e.name ?? e.nameEn ?? e.key;

/** gcsim の実行結果の読み取り結果（6-2 の確認用。書き戻しはしない） */
export const GcsimLogSummaryView: React.FC<GcsimLogSummaryViewProps> = ({ summary, members, seed, gcsimCommit, sacrificial }) => {
  const nameOf = (i: number | undefined) => (i === undefined ? '—' : i < 0 ? '敵' : members[i]?.name ?? `#${i}`);
  const [showInternalDetail, setShowInternalDetail] = React.useState(false);

  const effects = summary.effects.filter(e => e.entry.kind === 'effect');
  const cooldownKeys = summary.effects.filter(e => e.entry.kind === 'cooldown');

  const th = 'px-1.5 py-0.5 text-left font-semibold text-slate-400 border-b border-slate-700';
  const td = 'px-1.5 py-0.5 border-b border-slate-800/70 align-top';

  return (
    <div className="space-y-3 text-[11px] text-slate-200">
      <div className="text-slate-400">
        読み取り結果: 総時間 {sec(summary.totalFrames)}s / 出場 {summary.stints.length} 回 / アクション{' '}
        {summary.stints.reduce((n, s) => n + s.actions.length, 0)} 件 / スキル・爆発CT {summary.cooldowns.length} 件 / 効果 {effects.length} 件
        （発動間隔 {cooldownKeys.length} 件・内部として除外 {summary.internalSkipped} 件）/ シード {seed}
        {gcsimCommit ? ` / 辞書の gcsim コミット ${gcsimCommit.slice(0, 8)}` : ''}
      </div>

      {sacrificial && (
        <div className={`rounded-lg border p-2 ${sacrificial.ok ? 'border-emerald-800/70 bg-emerald-950/40 text-emerald-200' : 'border-amber-800/70 bg-amber-950/40 text-amber-200'}`}>
          祭礼の武器（{sacrificial.users.map(u => `${members[u.index]?.name ?? u.charKey} 精錬${u.refine}`).join('・')}）:{' '}
          {sacrificial.ok
            ? `スキルの CT リセットが発動できる機会 ${sacrificial.opportunities} 回のすべてで発動する乱数の種 ${sacrificial.seed} を使っています（${sacrificial.searched} 個を探索）`
            : `すべての機会で発動する種が見つからなかったため（${sacrificial.searched} 個を探索）、最も発動の多い種 ${sacrificial.seed}（機会 ${sacrificial.opportunities} 回のうち ${sacrificial.procs} 回で発動）を使っています。CT の長さが実際と異なる可能性があります`}
        </div>
      )}

      {summary.cooldownWaits.length > 0 && (
        <div className="rounded-lg border border-red-800/70 bg-red-950/50 p-2 space-y-0.5">
          <div className="font-bold text-red-300 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />CT待ち（gcsim で実行できず待った）: {summary.cooldownWaits.length} 件
          </div>
          {summary.cooldownWaits.map((w, i) => (
            <div key={i} className="text-red-200">
              {nameOf(w.charIndex)}: {w.action} — {sec(w.fromFrame)}s 〜 {sec(w.toFrame)}s（{sec(w.toFrame - w.fromFrame + 1)}s 待ち）
            </div>
          ))}
        </div>
      )}

      <section>
        <div className="font-bold text-amber-300 mb-1">出場とアクション（開始時刻 / 次までの長さ。長さ = 所要時間 + 遅延）</div>
        <div className="space-y-1">
          {summary.stints.map((st, i) => (
            <div key={i} className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1">
              <div className="text-slate-300">
                <span className="font-bold">#{i + 1} {nameOf(st.charIndex)}</span>{' '}
                出場 {sec(st.startFrame)}s{st.endFrame !== undefined ? ` → 交代要求 ${sec(st.endFrame)}s` : '（最後）'}
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
        <div className="font-bold text-sky-300 mb-1">スキル・爆発のCT（開始 〜 終了 / 元の長さ）</div>
        <table className="w-full border-collapse">
          <thead><tr><th className={th}>キャラ</th><th className={th}>種類</th><th className={th}>開始</th><th className={th}>終了</th><th className={th}>元のCT</th><th className={th}>操作</th></tr></thead>
          <tbody>
            {summary.cooldowns.map((c, i) => (
              <tr key={i}>
                <td className={td}>{nameOf(c.charIndex)}</td>
                <td className={td}>{c.type === 'skill' ? 'スキル' : c.type === 'special' ? '特殊スキル' : '爆発'}</td>
                <td className={td}>{sec(c.startFrame)}s</td>
                <td className={td}>{c.readyFrame !== undefined ? `${sec(c.readyFrame)}s（${sec(c.readyFrame - c.startFrame)}s）` : '—'}</td>
                <td className={td}>{sec(c.originalFrames)}s</td>
                <td className={td}>{c.forced.map(f => `${sec(f.frame)}s ${f.msg}`).join(' / ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <div className="font-bold text-emerald-300 mb-1">効果（発動バフ・状態。辞書で「効果」のキー）</div>
        <table className="w-full border-collapse">
          <thead><tr><th className={th}>効果（辞書の表示名）</th><th className={th}>発動元</th><th className={th}>開始 〜 終了</th><th className={th}>更新</th><th className={th}>受け手</th></tr></thead>
          <tbody>
            {effects.map((e, i) => (
              <tr key={i}>
                <td className={td} title={e.key}>
                  {entryName(e.entry)} <span className="text-slate-500 font-mono">[{e.entry.category}]</span>
                  <div className="text-[10px] text-slate-500 font-mono">{e.key}</div>
                </td>
                <td className={td}>{nameOf(e.sourceCharIndex)}</td>
                <td className={td}>{sec(e.startFrame)}s 〜 {e.endFrame < 0 ? '切れない' : `${sec(e.endFrame)}s（${sec(e.endFrame - e.startFrame)}s）`}</td>
                <td className={td}>{e.refreshFrames.length > 0 ? `${e.refreshFrames.length} 回` : '—'}</td>
                <td className={td}>{e.recipients.map(nameOf).join('・')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {cooldownKeys.length > 0 && (
        <section>
          <div className="font-bold text-sky-300 mb-1">発動間隔（内部CT）のキー</div>
          <div className="text-slate-400 break-words">
            {cooldownKeys.map((e, i) => (
              <span key={i} className="mr-2 whitespace-nowrap">{entryName(e.entry)}@{sec(e.startFrame)}s</span>
            ))}
          </div>
        </section>
      )}

      <section>
        <button className="text-slate-400 underline" onClick={() => setShowInternalDetail(v => !v)}>
          辞書に無いキー（除外）: {summary.unknownKeys.length} 件 {showInternalDetail ? '▲' : '▼'}
        </button>
        {showInternalDetail && (
          <div className="mt-1 text-slate-400 font-mono">
            {summary.unknownKeys.length === 0 ? 'なし' : summary.unknownKeys.map(u => `${u.key} ×${u.count}`).join(' / ')}
          </div>
        )}
      </section>
    </div>
  );
};
