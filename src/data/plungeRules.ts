/**
 * 落下攻撃（低空・高空）が、gcsim で実行できる前提条件（2026-10-05。gcsim 1e6c1a86 の各キャラの `plunge.go`・`jump.go`、`pkg/core/player/exec.go`）
 *
 * 既定のキャラは、「空中状態」でないと実行エラーになる。空中状態になるのは、閑雲の爆発バフ（爆発から 16 秒、全員。星の宿りの落下攻撃 8 回で消える）の間のジャンプの直後、
 * または星拡散の渦の爆発（ジャンプ開始から 10f 以内。アプリでは判定できない）だけ。ジャンプの後は、落下攻撃以外のアクションはエラーになる。
 * キャラ固有の例外（空中状態にならずに、特定のアクションの直後なら実行できる）は、下の表。表に無いキャラは、既定（空中状態のみ）。
 *
 * 判定はアプリの計算（1 周目）で、直前のアクション（同じ出場の中。待機・交代をはさむと、直前なし）を見る。gcsim の結果の確認ではないので、状態の条件（夜魂など）は一部しか見られない。
 */
import type { ActionType } from '../types/genshin';

export interface PlungeRule {
  /** 直前のアクションがこの種類のどれかなら、空中状態でなくても実行できる */
  after?: ActionType[];
  /** 同じ出場の中に、元素スキルがあれば（以前のどこかで）実行できる（夜魂の飛行の終了後。終了の判定はできないため、元素スキルが無い場合だけ警告する） */
  skillInStint?: boolean;
  /** 閑雲の爆発バフの間のジャンプの直後（空中状態）でも、実行できる。既定は true */
  airborne?: boolean;
  /** 警告に出す、必要な条件の説明 */
  needs: string;
}

export interface CharacterPlungeRules {
  low?: PlungeRule;
  high?: PlungeRule;
}

/** 閑雲（爆発が全員を空中状態にできる）のキャラ ID と、バフの長さ（秒）・消える落下攻撃の回数 */
export const XIANYUN_ID = '10000093-anemo';
export const XIANYUN_AIRBORNE_SECONDS = 16;
export const XIANYUN_AIRBORNE_PLUNGES = 8;

const AIRBORNE_ONLY: PlungeRule = {
  airborne: true,
  needs: '空中状態（閑雲の爆発から 16 秒の間のジャンプの直後など）',
};

export const PLUNGE_RULES: Record<string, CharacterPlungeRules> = {
  // 魈: ジャンプの直後なら、空中状態にならなくても実行できる（xiao/plunge.go: CurrentState == JumpState。爆発中は 5/6f でキャンセル）
  '10000026-anemo': {
    low: { after: ['jump'], needs: '直前のアクションがジャンプ' },
    high: { after: ['jump'], needs: '直前のアクションがジャンプ' },
  },
  // マーヴィカ: 夜魂のバイクの状態で、歩行中にジャンプした後なら低空（mavuika/jump.go: canBikePlunge。バイクの状態はアプリでは判定できない）。高空は空中状態のみ
  '10000106-pyro': {
    low: { after: ['jump'], needs: '夜魂のバイクの状態でのジャンプの直後（空中状態でも可）' },
    high: AIRBORNE_ONLY,
  },
  // ヴァレサ: 重撃の直後なら高空。低空は空中状態のみ
  '10000111-electro': {
    low: AIRBORNE_ONLY,
    high: { after: ['charged'], needs: '直前のアクションが重撃（空中状態でも可）' },
  },
  // 放浪者・チャスカ・イファ: 夜魂の飛行（元素スキル）が終わった直後の 26f だけ、低空
  '10000075-anemo': { low: { skillInStint: true, needs: '元素スキルの飛行が終わった直後（元素スキルより後）' }, high: AIRBORNE_ONLY },
  '10000104-anemo': { low: { skillInStint: true, needs: '元素スキルの夜魂の状態が終わった直後（元素スキルより後）' }, high: AIRBORNE_ONLY },
  '10000113-anemo': { low: { skillInStint: true, needs: '元素スキルの夜魂の状態が終わった直後（元素スキルより後）' }, high: AIRBORNE_ONLY },
  // ウェンティ: 一回押しの元素スキルの直後に、高空だけ（venti/plunge.go: 直前が自分のスキルで hold = 0。低空の落下攻撃は gcsim が未実装）
  '10000022-anemo': { high: { after: ['skill'], needs: '直前のアクションが元素スキル（一回押し）' } },
  // 千織: 長押しの元素スキルの直後に、低空だけ
  '10000094-geo': { low: { after: ['skill_hold'], needs: '直前のアクションが長押しの元素スキル（空中状態でも可）' } },
  // アルハイゼン: 長押しの元素スキルの直後に低空（空中状態でも可）。高空は空中状態のみ
  '10000078-dendro': {
    low: { after: ['skill_hold'], needs: '直前のアクションが長押しの元素スキル（空中状態でも可）' },
    high: AIRBORNE_ONLY,
  },
  // 楓原万葉: 元素スキルの直後に、高空。低空は、元素スキルの直後は不可（空中状態のみ）
  '10000047-anemo': {
    low: AIRBORNE_ONLY,
    high: { after: ['skill', 'skill_hold'], needs: '直前のアクションが元素スキル（空中状態でも可）' },
  },
  // 閑雲: 雲の変化の状態の間（元素スキルの跳躍の直後）なら実行できる（xianyun/plunge.go: skillStateKey）
  [XIANYUN_ID]: {
    low: { after: ['skill'], needs: '直前のアクションが元素スキル（跳躍の状態の間。空中状態でも可）' },
    high: { after: ['skill'], needs: '直前のアクションが元素スキル（跳躍の状態の間。空中状態でも可）' },
  },
};

/** 表に無いキャラの規則（空中状態のみ） */
export const DEFAULT_PLUNGE_RULE: PlungeRule = AIRBORNE_ONLY;
