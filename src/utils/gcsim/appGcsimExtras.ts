/**
 * アプリの計算（calculateRotation）の結果から、gcsim の設定文に渡す「アクションごとの追加情報」を作る。
 * 標準より長くした所要時間（待ち）・モードの維持・長押しの秒数・コマンド。アプリの画面（DPS 計算・チャージ効率・設定文の出力）と、
 * ローテーション自動探索が、同じ作り方で gcsim に渡すための共通の関数（探索の DPS が、置いたあとの DPS 計算と食い違わないように）
 */
import type { CalculatedRotation } from '../rotationCalculator';
import { isModeHoldAction } from '../modeHoldAction';
import type { GcsimConfigInput } from './buildGcsimConfig';

export type AppGcsimExtras = Pick<GcsimConfigInput, 'extraWaitByActionId' | 'modeHoldByActionId' | 'holdSecondsByActionId' | 'commandByActionId'>;

export function appGcsimExtras(calculatedStints: CalculatedRotation['calculatedStints']): AppGcsimExtras {
  const acts = calculatedStints.flatMap(s => s.actions);
  return {
    // 標準より長くした分（所要時間の編集）と、モードの維持のための自動の待ち（出場の最後のアクション。待機のアクションにも足す）
    extraWaitByActionId: Object.fromEntries(
      acts
        .filter(a => a.type !== 'swap')
        .map(a => {
          const manual = a.durationManual && a.holdSeconds === undefined && a.naturalDuration !== undefined && a.type !== 'wait' ? Math.max(0, a.duration - a.naturalDuration) : 0;
          // 維持のアクション（待機）: 長さが自動のときは、計算した長さを gcsim の `wait` に渡す（元の所要時間は 0）
          if (isModeHoldAction(a) && !a.durationManual) return [a.id, Number(a.duration.toFixed(3))] as const;
          return [a.id, Number(((manual >= 0.005 ? manual : 0) + (a.modeHoldSeconds ?? 0)).toFixed(3))] as const;
        })
        .filter(([, extra]) => extra > 0),
    ),
    modeHoldByActionId: Object.fromEntries(acts.filter(a => a.modeHoldSeconds).map(a => [a.id, a.modeHoldSeconds as number])),
    holdSecondsByActionId: Object.fromEntries(acts.filter(a => a.holdSeconds !== undefined).map(a => [a.id, a.holdSeconds as number])),
    commandByActionId: Object.fromEntries(acts.filter(a => a.gcsimCommand).map(a => [a.id, a.gcsimCommand as string])),
  };
}
