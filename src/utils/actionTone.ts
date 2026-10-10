/**
 * アクションの色（「アクション凡例」の色。追加ボタン・アクション構築エリアのアクション要素・ガントチャートのアクション要素で共通。追加作業 25）。
 * 元素スキル（E）= 橙、元素爆発 = 紫、通常攻撃 = 空色、重撃 = 緑、スキル長押し・一回押し（tE）・再発動（rE）など = シアン、それ以外（ダッシュ・ジャンプ・落下攻撃・待機・交代）= 灰。
 * box = 地・文字・枠の色、label = 略号（強調）の文字色
 */
export interface ActionTone { box: string; label: string }

const TONES = {
  amber: { box: 'bg-amber-500/10 text-amber-300 border-amber-500/30', label: 'text-amber-200' },
  purple: { box: 'bg-purple-500/10 text-purple-300 border-purple-500/30', label: 'text-purple-200' },
  sky: { box: 'bg-sky-500/10 text-sky-300 border-sky-500/30', label: 'text-sky-200' },
  emerald: { box: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', label: 'text-emerald-200' },
  cyan: { box: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30', label: 'text-cyan-200' },
  slate: { box: 'bg-slate-800 text-slate-300 border-slate-700', label: 'text-white' },
} satisfies Record<string, ActionTone>;

export function actionTone(def: { type: string; shortName: string }): ActionTone {
  if (def.type === 'burst') return TONES.purple;
  if (def.type === 'normal') return TONES.sky;
  if (def.type === 'charged') return TONES.emerald;
  if (def.type === 'skill') return def.shortName === 'E' ? TONES.amber : TONES.cyan;
  if (def.type === 'skill_hold' || def.type === 'skill_reset') return TONES.cyan;
  return TONES.slate;
}
