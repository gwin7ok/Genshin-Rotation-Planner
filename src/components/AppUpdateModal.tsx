import React, { useState } from 'react';
import { History, X } from 'lucide-react';
import { Trans } from 'react-i18next';
import { t } from '../i18n';
import type { ChangelogEntry } from '../utils/changelog';

interface AppUpdateModalProps {
  isOpen: boolean;
  /** 最後に開いた版（分からないとき null） */
  previous: string | null;
  /** 今の版 */
  current: string;
  entries: ChangelogEntry[];
  /** すべての版の更新履歴（「すべての更新履歴を表示」で出す） */
  allEntries: ChangelogEntry[];
  onClose: () => void;
}

/** 更新履歴の文の中の `コード` を、等幅にする */
const renderItem = (text: string): React.ReactNode =>
  text.split('`').map((part, i) => (i % 2 === 1 ? <code key={i} className="px-1 rounded bg-slate-800 text-slate-200">{part}</code> : <React.Fragment key={i}>{part}</React.Fragment>));

/**
 * アプリの版が上がったときの、更新履歴の案内（起動時に 1 度だけ出す）。
 * 最後に開いた版と、今の版、その間の更新履歴（CHANGELOG.md）を出す
 */
export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({ isOpen, previous, current, entries, allEntries, onClose }) => {
  const [showAll, setShowAll] = useState(false);
  if (!isOpen) return null;
  const shown = showAll ? allEntries : entries;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="app-update-title" data-testid="app-update-modal">
      <div className="bg-slate-900 border border-sky-500/50 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center border border-sky-500/40 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 id="app-update-title" className="font-bold text-base text-white">{t('notice:appUpdate.title')}</h3>
              <p className="text-xs text-slate-400 mt-0.5" data-testid="app-update-versions">
                <Trans
                  i18nKey={previous !== null ? 'notice:appUpdate.versionChanged' : 'notice:appUpdate.versionUnknown'}
                  values={{ previous, current }}
                  components={{ strong: <strong className="text-sky-300" /> }}
                />
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title={t('action.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-sm text-slate-200 flex-1">
          {shown.length === 0 && <p className="text-xs text-slate-400">{t('notice:appUpdate.noEntries')}</p>}
          {shown.map(e => (
            <section key={e.version} className="space-y-1.5" data-testid="app-update-entry">
              <h4 className="font-bold text-sky-200 text-sm">v{e.version}{e.date && <span className="ml-2 text-[11px] font-normal text-slate-500">{e.date}</span>}</h4>
              {e.sections.map(s => (
                <div key={s.title}>
                  <p className="text-[11px] font-semibold text-slate-400">{s.title}</p>
                  <ul className="list-disc list-outside pl-5 space-y-1 text-xs leading-relaxed">
                    {s.items.map((it, i) => <li key={i}>{renderItem(it)}</li>)}
                  </ul>
                </div>
              ))}
            </section>
          ))}
          <p className="text-[11px] text-slate-500">{t('notice:appUpdate.note')}</p>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={() => setShowAll(v => !v)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors" data-testid="app-update-toggle-all">
            {t(showAll ? 'notice:appUpdate.showRecent' : 'notice:appUpdate.showAll', { count: allEntries.length })}
          </button>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors shadow" data-testid="app-update-close">
            {t('action.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
