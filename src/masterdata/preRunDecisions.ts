/**
 * 副次効果を「実行前のバーにしない」と決めたものと、その理由（手で決める一覧。D213 案 2。2026-10-15。ユーザー決定: 案 B）
 *
 * 副次効果（ActionGcsimExtra）のバーは、gcsim で計算した後にだけ出るのが既定。実行前から出すものだけ、`preRun: true`
 * （actionEffectExtras.ts）を付ける（辞書の継続時間を、アクションの開始から 1 本のバーにする）。
 * 辞書に継続時間がある副次効果は、`preRun: true` を付けるか、ここに理由つきで載せる（どちらでもないと check:action-links が失敗する）。
 *
 * 基準（実行前に出してよいもの）: 使った時点で必ず付く／3 秒以上／同じ内容の主効果のバーと重ならない／モードのバーと重ならない。
 * キーは gcsim のキー（キャラ・アクションが違っても、同じキーは同じ判断）。
 */
export type PreRunReason =
  /** 主効果（本体のバー）とほぼ同じ長さで、同じ効果を二重に出すことになる */
  | 'redundant-with-main'
  /** 命中・被ダメージ・特定の状態が要る（付かない場合があるので、実行前に出すと誤解を招く） */
  | 'conditional'
  /** 短く（約 2 秒以下）、バーとして意味が薄い */
  | 'short'
  /** モードを開くスキル・爆発で、モードのバーと重なる */
  | 'overlaps-mode'
  /** 更新され続ける効果で、単発の継続時間では、実際の長さを表せない */
  | 'refreshed-longer';

export interface PreRunDecision {
  reason: PreRunReason;
  note: string;
}

export const PRE_RUN_DECISIONS: Record<string, PreRunDecision> = {
  'kaveh-q-dmg-bonus': { reason: 'redundant-with-main', note: 'カーヴェ Q: 12 秒。主効果（爆発の持続 12 秒）と同じ' },
  'xianyun-airborne-buff': { reason: 'redundant-with-main', note: '閑雲 Q: 16 秒。主効果（爆発の持続 16 秒）と同じ' },
  'lauma-pale-hymn-moonsong': { reason: 'redundant-with-main', note: 'ラウマ Q: 15 秒。主効果（爆発の持続 15 秒）と同じ' },
  'jahoda-meowball': { reason: 'redundant-with-main', note: 'ヤフォダ E: 約 19.6 秒。主効果（20 秒）とほぼ同じ' },
  'marked-as-prey': { reason: 'redundant-with-main', note: 'ムアラニ E: 10 秒。主効果（10 秒）と同じ。サーフィン中の命中も要る' },
  'blood-blossom': { reason: 'conditional', note: '胡桃 E: 血梅香（敵への継続ダメージ）。命中で付く。モードのバーもある' },
  'dehya-redmanes-blood': { reason: 'conditional', note: 'ディシア E: 紅鬃の血。ダメージを受けたときに付く' },
  'lauma-skill-shred-dendro': { reason: 'conditional', note: 'ラウマ E: 耐性ダウン。命中で付く（更新される）' },
  'lauma-skill-shred-hydro': { reason: 'conditional', note: 'ラウマ E: 耐性ダウン。命中で付く（更新される）' },
  'lunarprayer': { reason: 'conditional', note: 'ニィロウ N: 月の祈り。剣舞の状態で、通常攻撃のときに付く' },
  'ganyu-burst-mark': { reason: 'short', note: '甘雨 Q: 印。約 1.4 秒' },
  'shenhe-burst-shred-cryo': { reason: 'short', note: '申鶴 Q: 耐性ダウン。約 0.6 秒（命中のたびに更新）' },
  'shenhe-burst-shred-phys': { reason: 'short', note: '申鶴 Q: 耐性ダウン。約 0.6 秒（命中のたびに更新）' },
  'nahida-q-within': { reason: 'short', note: 'ナヒーダ Q: 領域内の判定。約 1 秒（領域の間、更新される）' },
  'aino-burst-mark': { reason: 'short', note: 'アイノ Q: 印。約 0.8 秒' },
  'columbina-gravity': { reason: 'short', note: 'コロンビーナ E: 重力。2 秒（月の反応で更新される）' },
  'columbina-q-buff': { reason: 'short', note: 'コロンビーナ Q: 反応ボーナス。約 1.2 秒（更新される）' },
  'tranquilityaura': { reason: 'overlaps-mode', note: 'ニィロウ E: 静謐の光環 12 秒。剣舞のモードのバーと重なる' },
  'thunderous-symphony': { reason: 'overlaps-mode', note: 'フリンズ E: 雷鳴の交響 6 秒。特殊爆発の受付（モード）のバーと重なる' },
  'denial-of-darkness': { reason: 'overlaps-mode', note: 'ドゥリン N: 黒の姿 30 秒。モードのバーと重なる' },
  'confirmation-of-purity': { reason: 'overlaps-mode', note: 'ドゥリン E: 白の姿 30 秒。モードのバーと重なる' },
  'faruzan-q-dmg-bonus': { reason: 'refreshed-longer', note: 'ファルザン Q: 4 秒ずつ更新され、実際は爆発の間（12 秒）続く。単発の 4 秒では、実際の長さを表せない' },
  'faruzan-q-shred': { reason: 'refreshed-longer', note: 'ファルザン Q: 同上（耐性ダウン）' },
};
