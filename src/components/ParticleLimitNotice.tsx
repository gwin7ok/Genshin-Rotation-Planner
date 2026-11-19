import React from 'react';
import { t } from '../i18n';
import { particleLimits, type BattleCondition } from '../utils/battleCondition';

/**
 * 幽境モードの戦闘条件の、粒子の設定の制限の知らせ（D369）。
 * gcsim は、粒子の設定（`energy` の行）を最後の 1 行しか使わないので、時刻指定の粒子が 2 件以上あるとき・時刻指定の粒子と敵の周期の粒子を併用するときは、
 * 効かないものがある。計算に使われないものがあるときだけ表示する
 */
export const ParticleLimitNotice: React.FC<{ condition: Pick<BattleCondition, 'timedParticles' | 'enemyParticles'>; testId: string }> = ({ condition, testId }) => {
  const lim = particleLimits(condition);
  if (lim.ignoredTimed === 0 && !lim.periodicIgnored) return null;
  return (
    <div className="text-[11px] text-amber-300 leading-relaxed space-y-0.5" data-testid={testId}>
      {lim.ignoredTimed > 0 && <p>{t('gcsim:er.particleLimitTimed', { n: condition.timedParticles.length, seconds: lim.usedTimedSeconds, ignored: lim.ignoredTimed })}</p>}
      {lim.periodicIgnored && <p>{t('gcsim:er.particleLimitPeriodic')}</p>}
    </div>
  );
};
