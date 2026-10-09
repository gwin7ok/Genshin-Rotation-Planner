/**
 * CT開始位置の手で補う一覧（フェーズ5 / 5-4、D37・D44）
 *
 * gcsim のソースから自動で読めないもの（遅れがホールド依存・添字が状態で決まる配列・評価できない式・派生アクション）を、ここで補う。
 * 自動読み取りより優先される。自動読み取りの値と食い違うものは、マスター生成のレポートに出る（gcsim の更新で古くなったことに気づくため）。
 *
 * - キー: アクション定義 ID（`<キャラID>_e` / `_e_hold` / `_e_shorthold` / `_q` など。D13）
 * - from: `motionStart`（動作開始から）/ `holdEnd`（長押し終了から）/ `stateEnd`（状態の終了から。夜魂・スキル状態が終わったときに gcsim が CT を始めるもの。D45）
 * - delayFrames: 遅れ（60fps のフレーム。gcsim のソースと照合しやすいようフレームで書く。生成時に秒へ換算）
 * - cooldownPerHold / baseCooldown: 長押し 1 秒あたりの CT の増分（秒）と、ホールド 0 のときの CT（秒）。CT の長さ = baseCooldown + cooldownPerHold × ホールド秒数
 * - note: 根拠（gcsim ソースの場所）
 */
export interface CooldownStartOverride {
  from: 'motionStart' | 'holdEnd' | 'stateEnd';
  delayFrames: number;
  cooldownPerHold?: number;
  /** cooldownPerHold があるとき、ホールド 0 のときの CT（秒）。マスターの cooldown をこの値にする（genshin-db の値は最大ホールドのときのもの） */
  baseCooldown?: number;
  /** frames に含まれる長押しのフレーム数（早柚・綺良々は最大ホールド 600f 込み）。生成時に秒へ換算して holdInFrames にする */
  holdInFrames?: number;
  note: string;
}

export const COOLDOWN_START_OVERRIDES: Record<string, CooldownStartOverride> = {
  // キャンディス: skillCDStarts = [14, 89]（添字は chargeLevel。一回押し 0 / 長押し 1）
  '10000072-hydro_e': { from: 'motionStart', delayFrames: 14, note: 'candace/skill.go: skillCDStarts[0]' },
  '10000072-hydro_e_hold': { from: 'motionStart', delayFrames: 89, note: 'candace/skill.go: skillCDStarts[1]' },
  // 千織: skillCDStarts = [19, 34]（添字は hold。一回押し 0）
  '10000094-geo_e': { from: 'motionStart', delayFrames: 19, note: 'chiori/skill.go: skillCDStarts[0]' },
  // セノ: 通常時は Tasks.Add(triggerSkillCD, skillCDDelay)。爆発中（skillB）は 26f
  '10000071-electro_e': { from: 'motionStart', delayFrames: 17, note: 'cyno/skill.go: skillCDDelay（爆発中の skillBCDDelay は 26f）' },
  // フリーナ: 自動で切り替わる 2 形態（pneuma 10f / ousia 0f）。先頭の pneuma を採用
  '10000089-hydro_e': { from: 'motionStart', delayFrames: 10, note: 'furina/skill.go: pneumaCDDelay（ousiaCDDelay は 0f）' },
  // ジン: 遅れは hitmark-2（hitmark = skillHitmark + hold）。一回押し（hold=0）
  '10000003-anemo_e': { from: 'motionStart', delayFrames: 19, note: 'jean/skill.go: skillHitmark(21) - 2（hold=0）' },
  // ナヴィア: firingTime（一回押しは skillPressCDStart）
  '10000091-geo_e': { from: 'motionStart', delayFrames: 11, note: 'navia/skill.go: skillPressCDStart（firingTime の既定値）' },
  // レザー: 爆発中でないとき（burstActive=0）。爆発中は 31f（一回押し）
  '10000020-electro_e': { from: 'motionStart', delayFrames: 30, note: 'razor/skill.go: skillPressCDStarts[0]（爆発中は 31f）' },
  '10000020-electro_e_hold': { from: 'motionStart', delayFrames: 52, note: 'razor/skill.go: skillHoldCDStarts[0]（爆発中も 52f）' },
  // 鹿野院平蔵: skillRelease(delay) の skillCDStart + delay（一回押しは delay=0）
  '10000059-anemo_e': { from: 'motionStart', delayFrames: 18, note: 'heizou/skill.go: skillCDStart（一回押しは delay=0）' },
  // シグウィン: 一回押し（hold=0）。短押し・長押しは 40f / 66f
  '10000095-hydro_e': { from: 'motionStart', delayFrames: 16, note: 'sigewinne/skill.go: skillPressCDStart' },
  // タルタリヤ: 遠隔（既定）は cdDelay=14、歩き・ダッシュ中は 0、近接の解除時は 11。爆発は遠隔 0f / 近接 66f
  '10000033-hydro_e': { from: 'motionStart', delayFrames: 14, note: 'tartaglia/skill.go: cdDelay（既定。歩き・ダッシュ中は 0f）' },
  '10000033-hydro_q': { from: 'motionStart', delayFrames: 0, note: 'tartaglia/burst.go: 遠隔時の SetCDWithDelay(..., 0)（近接時は 66f）' },
  // ウェンティ: 一回押し cdstart=21、長押し（hold != 0）34
  '10000022-anemo_e': { from: 'motionStart', delayFrames: 21, note: 'venti/skill.go: cdstart（一回押し）' },
  '10000022-anemo_e_hold': { from: 'motionStart', delayFrames: 34, note: 'venti/skill.go: cdstart（hold != 0）' },
  // 雲菫: skillCDStarts = [11, 48, 90]（添字は animIdx。一回押し 0）
  '10000064-geo_e': { from: 'motionStart', delayFrames: 11, note: 'yunjin/skill.go: skillCDStarts[0]' },
  // 旅人(岩): skillCDStart = [23, 25]（添字は short_hold。既定 0）
  '10000005-geo_e': { from: 'motionStart', delayFrames: 23, note: 'traveler/common/geo/skill.go: skillCDStart[0]' },
  '10000007-geo_e': { from: 'motionStart', delayFrames: 23, note: 'traveler/common/geo/skill.go: skillCDStart[0]' },
  // 旅人(風): 一回押し hitmark(34) - 5
  '10000005-anemo_e': { from: 'motionStart', delayFrames: 29, note: 'traveler/common/anemo/skill.go: SkillPress の hitmark(34) - 5' },
  '10000007-anemo_e': { from: 'motionStart', delayFrames: 29, note: 'traveler/common/anemo/skill.go: SkillPress の hitmark(34) - 5' },
  // 旅人(水): 一回押し 24f・hE(0Ticks) 11f・最大ホールド 56 + 15 × 21 = 371f（短押し 56f は自動）
  '10000005-hydro_e': { from: 'motionStart', delayFrames: 24, note: 'traveler/common/hydro/skill.go: skillPressCdStart' },
  '10000007-hydro_e': { from: 'motionStart', delayFrames: 24, note: 'traveler/common/hydro/skill.go: skillPressCdStart' },
  '10000005-hydro_e_shorthold0ticks': { from: 'motionStart', delayFrames: 11, note: 'traveler/common/hydro/skill.go: skillShortHold0TicksCdStart' },
  '10000007-hydro_e_shorthold0ticks': { from: 'motionStart', delayFrames: 11, note: 'traveler/common/hydro/skill.go: skillShortHold0TicksCdStart' },
  '10000005-hydro_e_hold': { from: 'motionStart', delayFrames: 371, note: 'traveler/common/hydro/skill.go: skillShortHoldCdStart(56) + extend(15 × 21)' },
  '10000007-hydro_e_hold': { from: 'motionStart', delayFrames: 371, note: 'traveler/common/hydro/skill.go: skillShortHoldCdStart(56) + extend(15 × 21)' },
  // ホールドの長さに依存するもの（長押し終了から）
  '10000073-dendro_e_hold': { from: 'holdEnd', delayFrames: 30, note: 'nahida/skill.go: SetCDWithDelay(..., hold+30)' },
  '10000088-cryo_e_hold': { from: 'holdEnd', delayFrames: 109, note: 'charlotte/skill.go: hitmark-2（hitmark = hold + skillHoldHitmark(111)）' },
  '10000090-pyro_e_hold': { from: 'holdEnd', delayFrames: 13, note: 'chevreuse/skill.go: cdStart = hold + skillHoldCDStart(13)' },
  '10000114-cryo_e_hold': { from: 'holdEnd', delayFrames: 18, note: 'skirk/skill.go: extraDuration + skillHoldGainSS(18)' },
  '10000053-anemo_e_hold': { from: 'holdEnd', delayFrames: 50, cooldownPerHold: 0.5, baseCooldown: 6, holdInFrames: 600, note: 'sayu/skill.go: (skillHoldCDStart(648) - 600) + duration + 2。CT は 6秒 + 長押し × 0.5' },
  // リネット・藍硯の長押し（`hold=<フレーム数>` で渡す。モード維持の段階 ③。2026-10-08）。frames は最大の長押し込み
  '10000083-anemo_e_hold': { from: 'holdEnd', delayFrames: 34 + 14, holdInFrames: 150, note: 'lynette/skill.go: SetCDWithDelay(..., duration + skillHoldEndCDStart(14))、duration = hold + 34' },
  '10000108-anemo_e_hold': { from: 'holdEnd', delayFrames: 4, holdInFrames: 610, note: 'lanyan/skill.go: SetCDWithDelay(ActionSkill, 16*60, 4+hold)。羽月の輪の受付が終わった後に CT の残りが表示されるのは、表示の話で、CT の開始位置は gcsim と同じ（ユーザー確認 2026-10-09）' },
  '10000061-dendro_e_hold': { from: 'holdEnd', delayFrames: 14, cooldownPerHold: 0.4, baseCooldown: 8, holdInFrames: 600, note: 'kirara/skill.go: (skillHoldCDStart(614) - 600) + duration。CT は 8秒 + duration/30 × 12f（長押し 1 秒あたり 0.4 秒）' },
  // 旅人(風): 長押し（2 ティック以上）。gcsim の SkillHold は hitmark - 5 で CT を始める。hitmark = 31 + 15 × ティック数 + 5 - 15 + 5 なので、
  // 長押し（15f × ティック数）の終了から 21f。1 ティック以下は CT 5 秒・遅れ 16f（ホールド秒数を使う 5-5 で扱う）
  '10000005-anemo_e_hold': { from: 'holdEnd', delayFrames: 21, note: 'traveler/common/anemo/skill.go: SkillHold の hitmark(2ティック以上) - 5。長押し = 15f × ティック数' },
  '10000007-anemo_e_hold': { from: 'holdEnd', delayFrames: 21, note: 'traveler/common/anemo/skill.go: SkillHold の hitmark(2ティック以上) - 5。長押し = 15f × ティック数' },
  // 状態の終了で CT が始まるもの（D45）。状態が何で終わるか（夜魂ポイントの枯渇・再発動・時間切れなど）は 5-5 以降で扱う
  '10000104-anemo_e': { from: 'stateEnd', delayFrames: 0, note: 'chasca/skill.go: exitNightsoul() の SetCD(6.5秒)' },
  '10000113-anemo_e': { from: 'stateEnd', delayFrames: 0, note: 'ifa/skill.go: exitNightsoul() の SetCD(7.5秒)' },
  '10000124-anemo_e': { from: 'stateEnd', delayFrames: 0, note: 'jahoda/skill.go: cancelPursuit() の SetCD(skillCD + skillWindup)' },
  '10000102-hydro_e': { from: 'stateEnd', delayFrames: 0, note: 'mualani/skill.go: cancelNightsoul() の SetCD(6秒)' },
  '10000114-cryo_e': { from: 'stateEnd', delayFrames: 0, note: 'skirk/skill.go: exitSkillState() の SetCD(8秒)' },
  '10000075-anemo_e': { from: 'stateEnd', delayFrames: 0, note: 'wanderer/skill.go: skillEndRoutine() の SetCD(6秒)' },
  '10000103-geo_e': { from: 'stateEnd', delayFrames: 0, note: 'xilonen/skill.go: exitNightsoul() の SetCD(7秒)' },
};
