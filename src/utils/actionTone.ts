/**
 * アクションの色（「アクション凡例」の色。追加ボタン・アクション構築エリアのアクション要素・ガントチャートのアクション要素で共通。追加作業 25）。
 * 元素スキル系（E・hE・tE・rE・spE など、元素スキルの種類すべて）= 橙、元素爆発 = 紫、通常攻撃 = 空色、重撃 = 緑、それ以外（ダッシュ・ジャンプ・落下攻撃・待機・交代）= 灰。
 * box = 地・文字・枠の色、label = 略号（強調）の文字色
 */
export interface ActionTone { box: string; label: string }

const TONES = {
  amber: { box: 'bg-amber-500/10 text-amber-300 border-amber-500/30', label: 'text-amber-200' },
  purple: { box: 'bg-purple-500/10 text-purple-300 border-purple-500/30', label: 'text-purple-200' },
  sky: { box: 'bg-sky-500/10 text-sky-300 border-sky-500/30', label: 'text-sky-200' },
  emerald: { box: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', label: 'text-emerald-200' },
  slate: { box: 'bg-slate-800 text-slate-300 border-slate-700', label: 'text-white' },
} satisfies Record<string, ActionTone>;

export function actionTone(def: { type: string; shortName: string }): ActionTone {
  if (def.type === 'burst') return TONES.purple;
  if (def.type === 'normal') return TONES.sky;
  if (def.type === 'charged') return TONES.emerald;
  // 元素スキルの種類（E・hE・tE・rE・spE …）は、すべて同じ色（橙）
  if (def.type === 'skill' || def.type === 'skill_hold' || def.type === 'skill_reset') return TONES.amber;
  return TONES.slate;
}

const RGB: Record<string, string> = {
  'bg-amber-500/10': '245,158,11',
  'bg-purple-500/10': '168,85,247',
  'bg-sky-500/10': '14,165,233',
  'bg-emerald-500/10': '16,185,129',
};

/**
 * 他の色の地（ガントチャートの出場ブロックの色）の上に置く要素用。凡例と同じ色（暗い地に 10% の色）になるよう、
 * 暗い地を敷いた上に、色を 10% 重ねる。クラスの地の色（bg-…）を除いた box と、インラインの style を返す
 */
export function actionToneOnColor(def: { type: string; shortName: string }): { className: string; style: { backgroundColor: string; backgroundImage?: string } } {
  const tone = actionTone(def);
  const parts = tone.box.split(' ');
  const bg = parts.find(c => c.startsWith('bg-')) ?? '';
  const rgb = RGB[bg];
  return {
    className: parts.filter(c => !c.startsWith('bg-')).join(' '),
    style: rgb
      ? { backgroundColor: '#020617', backgroundImage: `linear-gradient(rgba(${rgb},0.1),rgba(${rgb},0.1))` }
      : { backgroundColor: '#1e293b' },
  };
}

/**
 * アクション凡例・追加ボタンの並び順（ユーザー指示 2026-10-12）:
 * E（およびその関連: hE・tE・rE・spE …）→ Q → N → C → J → lP / hP → D →（待機は、いつも最後）。
 * 同じ種類の中は、元の並びのまま（Array.sort は安定）
 */
export function actionOrderRank(def: { type: string }): number {
  switch (def.type) {
    case 'skill':
    case 'skill_hold':
    case 'skill_reset':
      return 0;
    case 'burst':
      return 1;
    case 'normal':
      return 2;
    case 'charged':
      return 3;
    case 'jump':
      return 4;
    case 'plunge_low':
      return 5;
    case 'plunge_high':
      return 6;
    case 'dash':
      return 7;
    default:
      return 8;
  }
}
