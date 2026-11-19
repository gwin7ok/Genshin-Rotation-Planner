import React from 'react';
import { t } from '../i18n';

/** 「持ちキャラ」タグ: 持ちキャラの取り込み済みのキャラに付ける（編成設定・DB管理のキャラ一覧） */
export const OwnedBadge: React.FC = () => (
  <span
    data-testid="owned-badge"
    title={t('party:ownedTagTitle')}
    className="inline-flex items-center shrink-0 px-1.5 py-px rounded border border-sky-500/50 bg-sky-500/15 text-sky-300 text-[9px] font-bold leading-tight whitespace-nowrap select-none"
  >
    {t('party:ownedTag')}
  </span>
);
