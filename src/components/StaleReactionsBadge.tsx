import React from 'react';
import { GCSIM_VERSION } from '../utils/gcsim/gcsimConfig';
import { reactionsStatus } from '../utils/gcsim/savedReactions';

/** 保存編成の反応の行が、古い gcsim のバージョンの計算結果のとき、「旧 gcsim」の印を返す（それ以外は null）。選択メニューの badge・編成管理の一覧で共通 */
export function staleReactionsBadge(reactions: unknown): React.ReactNode {
  const r = reactionsStatus(reactions);
  if (r.status !== 'stale') return null;
  return (
    <span
      className="ml-1.5 px-1 py-0.5 rounded border border-amber-500/50 bg-amber-500/10 text-[9px] font-bold text-amber-300 whitespace-nowrap"
      title={`反応の行は、gcsim ${r.savedVersion ?? '（旧バージョン）'} の計算結果です。今は ${GCSIM_VERSION} なので、反応の行は出ません。「gcsim で計算」で再計算してください`}
    >
      旧 gcsim
    </span>
  );
}
