import React from 'react';
import { X, HelpCircle, Sparkles } from 'lucide-react';
import { Trans } from 'react-i18next';
import { t, TranslationKey } from '../i18n';

interface UsageGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 「使い方」の各節（見出し + 箇条書きの数）。文は言語ファイル（guide.json の sections.<id>）。画面の表記に合わせて書く */
const GUIDE_SECTIONS: { id: string; items: number }[] = [
  { id: 'basic', items: 6 },
  { id: 'screen', items: 4 },
  { id: 'edit', items: 5 },
  { id: 'group', items: 5 },
  { id: 'chart', items: 6 },
  { id: 'gcsim', items: 5 },
  { id: 'save', items: 4 },
  { id: 'notation', items: 4 },
];

/** 箇条書きの中の部品（<b>・<code>・CT の状態の色） */
const ITEM_COMPONENTS = {
  b: <b />,
  code: <code />,
  ok: <span className="text-emerald-300" />,
  ng: <span className="text-red-300" />,
  warn: <span className="text-amber-300" />,
};

export const UsageGuideModal: React.FC<UsageGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">{t('guide:title')}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title={t('action.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 本文 */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm">
          <p className="text-xs text-slate-400 leading-relaxed">
            {t('guide:intro')}
          </p>
          {GUIDE_SECTIONS.map(section => (
            <section key={section.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <h4 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{t(`guide:sections.${section.id}.title` as TranslationKey)}</span>
              </h4>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-outside pl-4 leading-relaxed marker:text-slate-600">
                {Array.from({ length: section.items }, (_, i) => (
                  <li key={i}>
                    <Trans
                      i18nKey={`guide:sections.${section.id}.items.${i + 1}`}
                      values={{ example: t('guide:sections.notation.example'), braces: '{ }' }}
                      components={ITEM_COMPONENTS}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors">
            {t('action.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
