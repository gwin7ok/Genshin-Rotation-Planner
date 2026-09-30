/**
 * ユーザーがゲーム内の説明（wiki）と照合して承認した、継続時間の一致による状態キーの対応（2026-09-30）
 * scripts/link-effect-by-duration.ts が「要確認」の印を付けないために、scripts/build-effect-coverage.ts が「承認済み」にするために読む。
 */
export const APPROVED_STATUS_LINKS = new Set<string>([
  'travelerdendro-q', // 空・蛍(草)の爆発: 草蓮灯の存在時間 12 秒
  'xingqiu-orbital', // 行秋のスキル: 雨簾剣の存在時間 15 秒
  'qiqi-talisman', // 七七の爆発: 度厄の札の存在時間 15 秒
  'kokomiskill', // 珊瑚宮心海のスキル: 化海月の存在時間 12 秒
  'lynette-q', // リネットの爆発: ビックラキャット・ボックスの継続時間 12 秒
  'xilonen-a4', // シロネンのスキル: サンプル音源のアクティブ時間 15 秒
  'seven-phase-flash', // スカークのスキル: 七相一閃モードの継続時間 12.5 秒
]);
