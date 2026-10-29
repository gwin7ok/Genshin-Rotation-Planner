import React from 'react';
import { Database, X, RefreshCw } from 'lucide-react';
import { Trans } from 'react-i18next';
import { t } from '../i18n';

interface UpdateNoticeModalProps {
  isOpen: boolean;
  /** 前回確認した（または、保存済みの）DB のバージョン（分からないとき null） */
  previous: number | null;
  /** 今の DB のバージョン */
  current: number;
  /** 「DB管理を開く」 */
  onOpenDatabase: () => void;
  /** 「閉じる」（今回の版では、もう通知しない） */
  onClose: () => void;
}

/**
 * マスターデータ（DB）のバージョンが上がったときの、更新の案内（ページの読み込み時に、1 度だけ出す。D196・D198）。
 * 同梱のマスターは、アプリの更新で変わることがある。ブラウザに保存した DB は、自動では入れ替わらない項目があるため、
 * DB管理で「全削除 → 動的生成」して、最新にしてもらう。
 */
export const UpdateNoticeModal: React.FC<UpdateNoticeModalProps> = ({ isOpen, previous, current, onOpenDatabase, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="update-notice-title">
      <div className="bg-slate-900 border border-amber-500/50 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/40 shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 id="update-notice-title" className="font-bold text-base text-white">{t('notice:update.title')}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                <Trans
                  i18nKey={previous !== null ? 'notice:update.versionChanged' : 'notice:update.version'}
                  values={{ previous, current }}
                  components={{ strong: <strong className="text-amber-300" /> }}
                />
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title={t('action.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-sm text-slate-200">
          <p className="text-xs leading-relaxed text-slate-300">
            {t('notice:update.intro')}
          </p>
          <ol className="list-decimal list-outside pl-5 space-y-1.5 text-xs leading-relaxed">
            <li><Trans i18nKey="notice:update.step1" components={{ b: <b /> }} /></li>
            <li><Trans i18nKey="notice:update.step2" components={{ b: <b /> }} /></li>
            <li>{t('notice:update.step3')}</li>
          </ol>
          <div className="text-[11px] text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-2.5 leading-relaxed">
            {t('notice:update.noteLocked')}<br />
            {t('notice:update.noteRotations')}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            title={t('notice:update.closeTitle')}
          >
            {t('action.close')}
          </button>
          <button
            onClick={onOpenDatabase}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{t('notice:update.openDatabase')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
