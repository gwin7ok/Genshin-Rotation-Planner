import React from 'react';
import { Languages } from 'lucide-react';
import { t } from '../i18n';
import { autoLanguage, changeLanguagePreference, getLanguagePreference, LanguagePreference } from '../i18n/language';

/** 表示の言語の切り替え（自動 / 日本語 / English。D246）。選ぶと保存して再読み込みする（D245） */
export const LanguageSwitcher: React.FC = () => {
  const preference = getLanguagePreference();
  const options: { value: LanguagePreference; label: string; title: string }[] = [
    { value: 'auto', label: t('language.auto'), title: t('language.autoTitle', { language: t(autoLanguage() === 'ja' ? 'language.ja' : 'language.en') }) },
    { value: 'ja', label: t('language.ja'), title: t('language.switchTitle') },
    { value: 'en', label: t('language.en'), title: t('language.switchTitle') },
  ];

  return (
    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg border border-slate-700 bg-slate-900" title={t('language.switchTitle')}>
      <Languages className="w-3.5 h-3.5 text-slate-400 mr-0.5" aria-label={t('language.label')} />
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => o.value !== preference && changeLanguagePreference(o.value)}
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
            preference === o.value
              ? 'bg-sky-500 text-slate-950 border-sky-400'
              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-sky-400'
          }`}
          title={o.title}
          aria-pressed={preference === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};
