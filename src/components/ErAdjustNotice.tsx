import React from 'react';
import { t } from '../i18n';
import { periodicParticlesOn, splitTimedParticles } from '../utils/gcsim/erAdjust';
import { toAbyssRunCondition, type BattleCondition } from '../utils/battleCondition';

/**
 * ER 計算の、時系列の補正の知らせ（D371）。幽境モードの条件で、アプリが ER の時系列を補正して計算するときだけ表示する。
 * - gcsim に渡せない時刻指定の粒子（2 件以上・敵の周期の粒子との併用）は、アプリが書き足す
 * - ダメージ無効の時間帯の間は、ダメージが条件の発生源のエネルギーを取り除く
 * 補正をすると、gcsim で最後に確かめる実行（検証）はしない（計算のみ）。「爆発のタイミングの確認」は gcsim だけで動くので、時刻指定の粒子が 1 件だけ入る
 */
export const ErAdjustNotice: React.FC<{ condition: BattleCondition; testId: string }> = ({ condition, testId }) => {
  const run = toAbyssRunCondition(condition);
  const { injected } = splitTimedParticles(run.timedParticles, periodicParticlesOn(condition.enemyParticles));
  const windows = run.invulnerable?.length ?? 0;
  if (injected.length === 0 && windows === 0) return null;
  return (
    <div className="text-[11px] text-sky-300 leading-relaxed space-y-0.5" data-testid={testId}>
      {injected.length > 0 && <p data-testid={`${testId}-timed`}>{t('gcsim:er.adjustTimed', { n: injected.length, total: run.timedParticles.length })}</p>}
      {windows > 0 && <p data-testid={`${testId}-invulnerable`}>{t('gcsim:er.adjustInvulnerable', { n: windows })}</p>}
      <p>{t('gcsim:er.adjustNoVerify')}</p>
    </div>
  );
};
