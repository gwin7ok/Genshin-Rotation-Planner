import React from 'react';
import { GCSIM_VERSION } from '../utils/gcsim/gcsimConfig';
import { reactionsStatus } from '../utils/gcsim/savedReactions';
import { t } from '../i18n';

/** 保存編成の反応の行が、古い gcsim のバージョンの計算結果のとき、「旧 gcsim」の印を返す（それ以外は null）。選択メニューの badge・編成管理の一覧で共通 */
export function staleReactionsBadge(reactions: unknown): React.ReactNode {
  const r = reactionsStatus(reactions);
  if (r.status !== 'stale') return null;
  return (
    <span
      className="ml-1.5 px-1 py-0.5 rounded border border-amber-500/50 bg-amber-500/10 text-[9px] font-bold text-amber-300 whitespace-nowrap"
      title={t('gcsim:stale.title', { savedVersion: r.savedVersion ?? t('gcsim:stale.oldVersion'), currentVersion: GCSIM_VERSION })}
    >
      {t('gcsim:stale.label')}
    </span>
  );
}
